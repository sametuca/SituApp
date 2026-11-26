// Fitness Kulübü (MakFit): 4 karakter statı, günlük enerji, ağırlık & koşu bandı mini oyunları,
// 60 FPS ritim-zamanlama boks arenası (PvP + Koç Kaan), otomatik boks kıyafeti ve haftalık şampiyon kemeri.
import { useCallback, useEffect, useRef, useState } from 'react'
import { BLOCK_MS, BOX, CUE_META, CUE_TYPES, STAT_KEYS, STAT_META, STAT_MAX, STAT_START, boxCues, coinBonusPct, energyMax, gradeWindow, hitDamage, matchDuration, roundStart } from '../boxing'
import { cosStore } from '../cosStore'
import { fitnessStore } from '../fitnessStore'
import { work } from './jobStore'
import { DoorPrompt } from '../Social'
import { Modal } from '../Hud'

const LOCAL_ATTR_KEY = 'situapp_attr_v1'
const LOCAL_BOARD_KEY = 'situapp_box_board_v1'
const LOCAL_EN_KEY = 'situapp_gym_en_v1'

const todayStr = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10)
const isTyping = (e) => e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)

function readLocalAttr() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_ATTR_KEY))
    if (raw && typeof raw === 'object') {
      return {
        str: Number(raw.str) || STAT_START,
        sta: Number(raw.sta) || STAT_START,
        cha: Number(raw.cha) || STAT_START,
        ski: Number(raw.ski) || STAT_START,
      }
    }
  } catch {
    /* ignore */
  }
  return { str: STAT_START, sta: STAT_START, cha: STAT_START, ski: STAT_START }
}

function saveLocalAttr(attr) {
  try {
    localStorage.setItem(LOCAL_ATTR_KEY, JSON.stringify(attr))
  } catch {
    /* ignore */
  }
}

function readLocalEnergy(attr) {
  const max = energyMax(attr)
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_EN_KEY))
    if (raw?.day === todayStr()) return { left: Math.max(0, max - (raw.used || 0)), max }
  } catch {
    /* ignore */
  }
  return { left: max, max }
}

function consumeLocalEnergy(attr) {
  const day = todayStr()
  let used = 0
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_EN_KEY))
    if (raw?.day === day) used = raw.used || 0
  } catch {
    /* ignore */
  }
  const max = energyMax(attr)
  if (used >= max) return { ok: false, left: 0, max }
  used += 1
  try {
    localStorage.setItem(LOCAL_EN_KEY, JSON.stringify({ day, used }))
  } catch {
    /* ignore */
  }
  return { ok: true, left: Math.max(0, max - used), max }
}

function readLocalBoard() {
  try {
    const a = JSON.parse(localStorage.getItem(LOCAL_BOARD_KEY))
    return Array.isArray(a) ? a : []
  } catch {
    return []
  }
}

function pushLocalBoard(name, win, ko, pts) {
  const list = readLocalBoard()
  const key = name || 'Sen'
  const i = list.findIndex((r) => r.name === key)
  if (i >= 0) {
    list[i].points += pts
    if (win) list[i].wins += 1
    if (ko) list[i].ko += 1
  } else {
    list.push({ key, name: key, points: pts, wins: win ? 1 : 0, ko: ko ? 1 : 0 })
  }
  list.sort((a, b) => b.points - a.points || b.wins - a.wins)
  const top = list.slice(0, 15)
  try {
    localStorage.setItem(LOCAL_BOARD_KEY, JSON.stringify(top))
  } catch {
    /* ignore */
  }
  return top
}

// ======================= 1. AĞIRLIK ÇALIŞMA MİNİ OYUNU (+GÜÇ) =======================
function WeightWorkoutModal({ ski, energy, energyMaxVal, onDone, onClose }) {
  const [phase, setPhase] = useState('ready') // ready | play | done
  const [reps, setReps] = useState(0)
  const [perfects, setPerfects] = useState(0)
  const [left, setLeft] = useState(18)
  const [feedback, setFeedback] = useState('İmleç parlak alana gelince Boşluk ya da düğmeye bas.')
  const [pos, setPos] = useState(0) // 0..100
  const stRef = useRef({ pos: 10, dir: 1, reps: 0, perfects: 0, done: false })

  // Beceri arttıkça hedef bölge genişler
  const halfGood = Math.min(22, 13 + Math.round(ski * 0.08))
  const halfPerf = Math.min(10, 5 + Math.round(ski * 0.04))

  useEffect(() => {
    if (phase !== 'play') return undefined
    let raf = 0
    let prev = performance.now()
    const loop = (now) => {
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now
      const s = stRef.current
      const speed = 78 + Math.min(55, s.reps * 4.5)
      s.pos += s.dir * speed * dt
      if (s.pos >= 100) {
        s.pos = 100
        s.dir = -1
      } else if (s.pos <= 0) {
        s.pos = 0
        s.dir = 1
      }
      setPos(s.pos)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const tid = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          clearInterval(tid)
          if (!stRef.current.done) {
            stRef.current.done = true
            setPhase('done')
            onDone(stRef.current.reps, stRef.current.perfects)
          }
          return 0
        }
        return l - 1
      })
    }, 1000)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(tid)
    }
  }, [phase, onDone])

  const tapLift = useCallback(() => {
    if (phase !== 'play') return
    const dist = Math.abs(stRef.current.pos - 50)
    if (dist <= halfPerf) {
      stRef.current.reps += 1
      stRef.current.perfects += 1
      setReps(stRef.current.reps)
      setPerfects(stRef.current.perfects)
      setFeedback('Mükemmel kaldırış (+1)')
      window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'collect' }))
    } else if (dist <= halfGood) {
      stRef.current.reps += 1
      setReps(stRef.current.reps)
      setFeedback('İyi tekrar (+1)')
      window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
    } else {
      setFeedback('Kaçırdın — parlak alanı bekle.')
    }
  }, [phase, halfPerf, halfGood])

  useEffect(() => {
    if (phase !== 'play') return undefined
    const onKey = (e) => {
      if (isTyping(e)) return
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault()
        tapLift()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, tapLift])

  const start = () => {
    stRef.current = { pos: 10, dir: 1, reps: 0, perfects: 0, done: false }
    setReps(0)
    setPerfects(0)
    setLeft(18)
    setFeedback('Hadi! Ortadaki parlak bölgede kaldır!')
    setPhase('play')
  }

  return (
    <Modal onClose={onClose} label="Ağırlık Antrenmanı" theme="gym" dockBottom>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-black text-white">💪 Ağırlık Sehpası</h2>
          <p className="text-xs font-semibold text-white/70">İmleç parlak alana gelince kaldır.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black text-[#ffd35e]">⚡ {energy}/{energyMaxVal}</span>
          <button type="button" onClick={onClose} aria-label="Kapat" className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-xs font-black text-white">✖️</button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs font-black text-white/85">
        <span>Tekrar: {reps}</span>
        <span>Mükemmel: {perfects}</span>
        <span className="tabular-nums">⏱ {left} sn</span>
      </div>

      {/* Zamanlama çubuğu */}
      <div className="relative mt-2.5 h-8 w-full overflow-hidden rounded-full border-2 border-white/25 bg-white/10">
        <div
          className="absolute top-0 h-full bg-[#7fd3b8]/70"
          style={{ left: `${50 - halfGood}%`, width: `${halfGood * 2}%` }}
        />
        <div
          className="absolute top-0 h-full bg-[#ffd35e]"
          style={{ left: `${50 - halfPerf}%`, width: `${halfPerf * 2}%` }}
        />
        <div
          className="absolute top-0.5 h-6 w-3 -translate-x-1/2 rounded-full border-2 border-[#221b38] bg-white shadow"
          style={{ left: `${pos}%` }}
        />
      </div>

      <p className="mt-2 text-center text-xs font-bold text-[#ffd35e]">{feedback}</p>

      <div className="mt-3 flex gap-2">
        {phase === 'ready' ? (
          <button
            type="button"
            disabled={energy <= 0}
            onClick={start}
            className="w-full rounded-2xl border-b-4 border-[#c75646] bg-[#ff7e70] py-3 text-sm font-black text-white shadow-soft active:translate-y-[2px] disabled:opacity-50"
          >
            {energy <= 0 ? 'Bugünkü enerji doldu' : 'Başla (1 ⚡)'}
          </button>
        ) : phase === 'play' ? (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault()
              tapLift()
            }}
            className="w-full select-none rounded-2xl border-b-4 border-[#d98a1c] bg-[#fdb252] py-3.5 text-base font-black text-white shadow-soft active:translate-y-[2px]"
          >
            KALDIR (Boşluk)
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl border-b-4 border-[#5aa886] bg-[#7fd3b8] py-3 text-sm font-black text-[#1d3b2e]"
          >
            Bitir
          </button>
        )}
      </div>
    </Modal>
  )
}

// ======================= 2. KOŞU BANDI MİNİ OYUNU (+KONDİSYON) =======================
function CardioWorkoutModal({ energy, energyMaxVal, onDone, onClose }) {
  const [phase, setPhase] = useState('ready')
  const [steps, setSteps] = useState(0)
  const [nextFoot, setNextFoot] = useState('L') // L | R
  const [left, setLeft] = useState(16)
  const [pace, setPace] = useState(40)
  const stRef = useRef({ steps: 0, foot: 'L', pace: 40, done: false })

  useEffect(() => {
    if (phase !== 'play') return undefined
    const decay = setInterval(() => {
      stRef.current.pace = Math.max(0, stRef.current.pace - 4)
      setPace(stRef.current.pace)
    }, 150)
    const tid = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          clearInterval(tid)
          clearInterval(decay)
          if (!stRef.current.done) {
            stRef.current.done = true
            setPhase('done')
            const reps = Math.max(1, Math.round(stRef.current.steps / 4))
            onDone(reps, Math.floor(reps / 2))
          }
          return 0
        }
        return l - 1
      })
    }, 1000)
    return () => {
      clearInterval(decay)
      clearInterval(tid)
    }
  }, [phase, onDone])

  const stepFoot = useCallback(
    (side) => {
      if (phase !== 'play') return
      if (side === stRef.current.foot) {
        stRef.current.steps += 1
        stRef.current.foot = side === 'L' ? 'R' : 'L'
        stRef.current.pace = Math.min(100, stRef.current.pace + 14)
        setSteps(stRef.current.steps)
        setNextFoot(stRef.current.foot)
        setPace(stRef.current.pace)
        window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
      } else {
        stRef.current.pace = Math.max(0, stRef.current.pace - 8)
        setPace(stRef.current.pace)
      }
    },
    [phase],
  )

  useEffect(() => {
    if (phase !== 'play') return undefined
    const onKey = (e) => {
      if (isTyping(e)) return
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault()
        stepFoot('L')
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault()
        stepFoot('R')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, stepFoot])

  const start = () => {
    stRef.current = { steps: 0, foot: 'L', pace: 35, done: false }
    setSteps(0)
    setNextFoot('L')
    setLeft(16)
    setPace(35)
    setPhase('play')
  }

  return (
    <Modal onClose={onClose} label="Koşu Bandı" theme="gym" dockBottom>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-black text-white">🏃 Koşu Bandı</h2>
          <p className="text-xs font-semibold text-white/70">Sol ve sağ adımlara sırayla bas.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black text-[#7fcdf3]">⚡ {energy}/{energyMaxVal}</span>
          <button type="button" onClick={onClose} aria-label="Kapat" className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-xs font-black text-white">✖️</button>
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-white/10 p-3">
        <div className="flex items-center justify-between text-xs font-black text-white/90">
          <span>Adım: {steps}</span>
          <span>Tempo: %{pace}</span>
          <span className="tabular-nums">⏱ {left} sn</span>
        </div>
        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-gradient-to-r from-[#7fcdf3] to-[#8fdcb4] transition-all duration-100" style={{ width: `${pace}%` }} />
        </div>
      </div>

      <div className="mt-4">
        {phase === 'ready' ? (
          <button
            type="button"
            disabled={energy <= 0}
            onClick={start}
            className="w-full rounded-2xl border-b-4 border-[#4da5d1] bg-[#7fcdf3] py-3.5 text-base font-black text-white shadow-soft active:translate-y-[2px] disabled:opacity-50"
          >
            {energy <= 0 ? '⚡ Bugünkü enerjin bitti (Yarın yenilenir)' : '🏃 Koşuya Başla (1 ⚡)'}
          </button>
        ) : phase === 'play' ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault()
                stepFoot('L')
              }}
              className={`select-none rounded-2xl border-b-4 py-5 text-lg font-black text-white transition active:translate-y-[2px] ${nextFoot === 'L' ? 'border-[#4da5d1] bg-[#7fcdf3] ring-4 ring-[#7fcdf3]/40' : 'border-[#c5bdd8] bg-[#d6cef0] text-[#6d6185]'}`}
            >
              SOL (A)
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault()
                stepFoot('R')
              }}
              className={`select-none rounded-2xl border-b-4 py-5 text-lg font-black text-white transition active:translate-y-[2px] ${nextFoot === 'R' ? 'border-[#5aa886] bg-[#7fd3b8] ring-4 ring-[#7fd3b8]/40' : 'border-[#c5bdd8] bg-[#d6cef0] text-[#6d6185]'}`}
            >
              SAĞ (D)
            </button>
          </div>
        ) : (
          <button type="button" onClick={onClose} className="w-full rounded-2xl border-b-4 border-[#5aa886] bg-[#7fd3b8] py-3 text-base font-black text-white">
            Süper Tempo! Kapat
          </button>
        )}
      </div>
    </Modal>
  )
}

// ======================= 3. 60 FPS RİTİM-ZAMANLAMA BOKS ARENASI =======================
function BoxingArena({ match, selfName, liveState, onSendHit, onSoloEnd, onExit }) {
  const canvasRef = useRef(null)
  const [hud, setHud] = useState({ round: 1, hp: BOX.hp, ohp: BOX.hp, combo: 0, msg: 'Hazır ol! 🥊' })
  const cuesRef = useRef(boxCues(match.seed))
  const localRef = useRef({
    hp: BOX.hp,
    ohp: BOX.hp,
    combo: 0,
    score: 0,
    shieldUntil: 0,
    oppShieldUntil: 0,
    seen: new Set(),
    aiSeen: new Set(),
    youPunch: 0,
    oppPunch: 0,
    shake: 0,
    banner: '',
    bannerCol: '#ffd35e',
    bannerAt: 0,
    ended: false,
  })

  // PvP sunucu durumunu sahne animasyonuna yansıt
  useEffect(() => {
    if (match.solo || !liveState) return
    const s = localRef.current
    if (liveState.you) {
      if (liveState.you.hp < s.hp) {
        s.oppPunch = 1
        s.shake = 0.24
      }
      s.hp = liveState.you.hp
      s.combo = liveState.you.combo
      s.score = liveState.you.score
      if (liveState.you.shield) s.shieldUntil = Date.now() + 900
    }
    if (liveState.opp) {
      if (liveState.opp.hp < s.ohp) {
        s.youPunch = 1
        s.shake = 0.2
      }
      s.ohp = liveState.opp.hp
      if (liveState.opp.shield) s.oppShieldUntil = Date.now() + 900
    }
    setHud((h) => ({ ...h, hp: s.hp, ohp: s.ohp, combo: s.combo }))
  }, [match.solo, liveState])

  const triggerAction = useCallback(
    (type) => {
      const s = localRef.current
      if (s.ended) return
      const now = Date.now()
      const elapsed = now - match.startAt
      const win = gradeWindow(match.you.ski)
      // Şu an zamanlama penceresine en yakın işlenmemiş cue'yu bul
      let best = null
      let bestDiff = Infinity
      for (const c of cuesRef.current) {
        if (s.seen.has(c.i)) continue
        const d = Math.abs(elapsed - c.t)
        if (d < bestDiff) {
          bestDiff = d
          best = c
        }
      }
      if (!best || bestDiff > win.good + 120) {
        s.combo = 0
        s.banner = 'ERKEN / KAÇTI'
        s.bannerCol = '#ff8a7a'
        s.bannerAt = now
        setHud((h) => ({ ...h, combo: 0, msg: 'Ritmi bekle! Halka küçülünce bas.' }))
        return
      }

      s.seen.add(best.i)
      const wrong = type !== best.type
      if (wrong || bestDiff > win.good) {
        s.combo = 0
        s.banner = wrong ? 'YANLIŞ TUŞ!' : 'KAÇTI!'
        s.bannerCol = '#ff8a7a'
        s.bannerAt = now
        if (!match.solo) onSendHit(best.i, type)
        setHud((h) => ({ ...h, combo: 0, msg: wrong ? `Doğru tuş: ${CUE_META[best.type].key} ${CUE_META[best.type].label}` : 'Biraz geç/erken!' }))
        return
      }

      const grade = bestDiff <= win.perfect ? 'perfect' : 'good'
      s.combo += 1
      s.youPunch = type === 'block' ? 0.3 : 1
      s.banner = grade === 'perfect' ? `🔥 MÜKEMMEL ${CUE_META[type].label.toUpperCase()}!` : `✨ İYİ ${CUE_META[type].label.toUpperCase()}!`
      s.bannerCol = grade === 'perfect' ? '#ffd35e' : '#8fdcb4'
      s.bannerAt = now
      window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: grade === 'perfect' ? 'collect' : 'pop' }))

      if (!match.solo) {
        onSendHit(best.i, type)
        setHud((h) => ({ ...h, combo: s.combo, msg: s.banner }))
        return
      }

      // Solo (Koç Kaan'a karşı antrenman maçı) yerel hasar hesabı
      if (type === 'block') {
        s.shieldUntil = now + BLOCK_MS
        s.score += grade === 'perfect' ? 35 : 20
      } else {
        const dmg = hitDamage(type, grade, s.combo, match.you.str, match.opp.sta, s.oppShieldUntil > now)
        s.ohp = Math.max(0, s.ohp - dmg)
        s.score += dmg * 10 + (grade === 'perfect' ? 30 : 15)
        s.shake = grade === 'perfect' ? 0.25 : 0.14
      }
      setHud((h) => ({ ...h, hp: s.hp, ohp: s.ohp, combo: s.combo, msg: s.banner }))
      if (s.ohp <= 0 && !s.ended) {
        s.ended = true
        onSoloEnd('win', 'ko', s.score)
      }
    },
    [match, onSendHit, onSoloEnd],
  )

  // Klavye kontrolleri (Ok tuşları + WASD)
  useEffect(() => {
    const onKey = (e) => {
      if (isTyping(e)) return
      for (const t of CUE_TYPES) {
        if (e.code === CUE_META[t].code || e.code === CUE_META[t].alt) {
          e.preventDefault()
          triggerAction(t)
          return
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [triggerAction])

  // 60 FPS Canvas çizim döngüsü + Solo Koç Kaan AI
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return undefined
    const ctx = cv.getContext('2d')
    let raf = 0
    let prev = performance.now()
    const totalMs = matchDuration()

    const drawBoxer = (x, y, facing, bodyCol, gloveCol, punch, shielded, hitFlash) => {
      ctx.save()
      ctx.translate(x, y)
      ctx.scale(facing, 1)
      // Gölge
      ctx.fillStyle = 'rgba(74,59,92,0.18)'
      ctx.beginPath()
      ctx.ellipse(0, 44, 34, 11, 0, 0, Math.PI * 2)
      ctx.fill()
      // Blok kalkanı
      if (shielded) {
        ctx.strokeStyle = '#b79cff'
        ctx.lineWidth = 5
        ctx.beginPath()
        ctx.arc(4, -6, 56, 0, Math.PI * 2)
        ctx.stroke()
      }
      // Boks şortu & gövde
      ctx.fillStyle = hitFlash ? '#ffffff' : bodyCol
      ctx.beginPath()
      ctx.roundRect(-22, -16, 44, 48, 16)
      ctx.fill()
      // Şort kemeri
      ctx.fillStyle = '#fffaf2'
      ctx.fillRect(-22, 6, 44, 8)
      // Kafa
      ctx.fillStyle = '#ffe1c6'
      ctx.beginPath()
      ctx.arc(0, -34, 22, 0, Math.PI * 2)
      ctx.fill()
      // Gözler
      ctx.fillStyle = '#4a3b5c'
      ctx.beginPath()
      ctx.arc(8, -36, 3.2, 0, Math.PI * 2)
      ctx.fill()
      // Kafa bandı
      ctx.fillStyle = gloveCol
      ctx.fillRect(-21, -48, 42, 7)
      // Arka eldiven
      ctx.fillStyle = gloveCol
      ctx.beginPath()
      ctx.arc(16 + punch * 14, -10 - punch * 8, 13, 0, Math.PI * 2)
      ctx.fill()
      // Ön yumruk eldiveni
      ctx.beginPath()
      ctx.arc(28 + punch * 48, -2 - punch * 12, 16, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.beginPath()
      ctx.arc(32 + punch * 48, -7 - punch * 12, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    const frame = (nowPerf) => {
      const dt = Math.min(0.05, (nowPerf - prev) / 1000)
      prev = nowPerf
      const now = Date.now()
      const elapsed = now - match.startAt
      const s = localRef.current
      s.youPunch = Math.max(0, s.youPunch - dt * 5)
      s.oppPunch = Math.max(0, s.oppPunch - dt * 5)
      s.shake = Math.max(0, s.shake - dt * 1.6)

      // Solo AI (Koç Kaan): her cue'yu %70 olasılıkla vurur
      if (match.solo && !s.ended) {
        for (const c of cuesRef.current) {
          if (elapsed >= c.t && !s.aiSeen.has(c.i)) {
            s.aiSeen.add(c.i)
            const roll = ((c.i * 37 + match.seed) % 100) / 100
            if (roll < 0.68) {
              if (c.type === 'block') {
                s.oppShieldUntil = now + BLOCK_MS
              } else {
                const grade = roll < 0.25 ? 'perfect' : 'good'
                const dmg = hitDamage(c.type, grade, 1, match.opp.str, match.you.sta, s.shieldUntil > now)
                s.hp = Math.max(0, s.hp - dmg)
                s.oppPunch = 1
                s.shake = 0.16
                setHud((h) => ({ ...h, hp: s.hp }))
                if (s.hp <= 0) {
                  s.ended = true
                  onSoloEnd('lose', 'ko', s.score)
                }
              }
            }
          }
        }
        if (elapsed >= totalMs && !s.ended) {
          s.ended = true
          const res = s.hp === s.ohp ? 'draw' : s.hp > s.ohp ? 'win' : 'lose'
          onSoloEnd(res, 'time', s.score)
        }
      }

      // Aktif raunt numarası
      let rNow = 1
      for (let r = 0; r < BOX.rounds; r++) if (elapsed >= roundStart(r)) rNow = r + 1

      const W = 680
      const H = 320
      if (cv.width !== W || cv.height !== H) {
        cv.width = W
        cv.height = H
      }
      ctx.clearRect(0, 0, W, H)

      const sx = s.shake > 0 ? (Math.random() - 0.5) * 14 * s.shake : 0
      const sy = s.shake > 0 ? (Math.random() - 0.5) * 10 * s.shake : 0
      ctx.save()
      ctx.translate(sx, sy)

      // Arka plan: pastel arena spotları
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, '#2e224b')
      bg.addColorStop(0.58, '#4a366f')
      bg.addColorStop(1, '#fff3e6')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      // Ring zemini & ipler
      ctx.fillStyle = '#fff7ee'
      ctx.fillRect(0, 215, W, 105)
      ;[140, 172, 204].forEach((ry, i) => {
        ctx.strokeStyle = ['#ff8a7a', '#ffffff', '#7fcdf3'][i]
        ctx.lineWidth = 5
        ctx.beginPath()
        ctx.moveTo(0, ry)
        ctx.lineTo(W, ry)
        ctx.stroke()
      })

      // Boksörler
      const bob = Math.sin(nowPerf / 180) * 4
      drawBoxer(185, 206 + bob, 1, '#ff8a7a', '#ff595e', s.youPunch, s.shieldUntil > now, s.oppPunch > 0.7)
      drawBoxer(495, 206 - bob, -1, '#7fcdf3', '#3b82f6', s.oppPunch, s.oppShieldUntil > now, s.youPunch > 0.7)

      // Yaklaşan ritim halkaları (merkezde daralan zamanlama hedefi)
      const cx = W / 2
      const cy = 122
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(cx, cy, 42, 0, Math.PI * 2)
      ctx.stroke()

      if (elapsed < BOX.leadMs) {
        const sec = Math.max(1, Math.ceil((BOX.leadMs - elapsed) / 1000))
        ctx.fillStyle = '#ffd35e'
        ctx.font = '900 44px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`🥊 ${sec}`, cx, cy + 16)
      } else {
        for (const c of cuesRef.current) {
          if (s.seen.has(c.i)) continue
          const dtCue = c.t - elapsed // ms kaldı
          if (dtCue > 950 || dtCue < -240) continue
          const meta = CUE_META[c.type]
          const radius = 42 + Math.max(0, dtCue / 950) * 66
          ctx.strokeStyle = meta.color
          ctx.lineWidth = 6
          ctx.beginPath()
          ctx.arc(cx, cy, radius, 0, Math.PI * 2)
          ctx.stroke()

          if (dtCue < 520) {
            ctx.fillStyle = meta.color
            ctx.beginPath()
            ctx.arc(cx, cy, 34, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = '#2d1f47'
            ctx.font = '900 28px system-ui, sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText(meta.key, cx, cy + 5)
            ctx.font = '900 11px system-ui, sans-serif'
            ctx.fillText(meta.label.toUpperCase(), cx, cy + 21)
          }
        }
      }

      // Geri bildirim yazısı
      if (now - s.bannerAt < 750 && s.banner) {
        ctx.fillStyle = s.bannerCol
        ctx.font = '900 22px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(s.banner, cx, 44)
      }

      // Raunt etiketi
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.font = '900 14px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`RAUNT ${rNow}/${BOX.rounds}`, cx, 292)

      ctx.restore()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [match, onSoloEnd])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#23183d]/85 p-3 backdrop-blur-sm">
      <div className="flex w-[min(96vw,44rem)] flex-col gap-2.5 rounded-[2rem] border-2 border-white bg-white/95 p-4 shadow-toy">
        {/* Üst can barları */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex justify-between text-xs font-black text-[#4a3b5c]">
              <span className="truncate">🥊 {selfName}</span>
              <span>{hud.hp} HP</span>
            </div>
            <div className="mt-1 h-3.5 overflow-hidden rounded-full bg-[#f3ecff]">
              <div className="h-full rounded-full bg-gradient-to-r from-[#ff8a7a] to-[#ffd35e] transition-all duration-150" style={{ width: `${hud.hp}%` }} />
            </div>
          </div>
          <button type="button" onClick={onExit} className="shrink-0 rounded-full bg-[#f6f0ff] px-3 py-1.5 text-xs font-black text-[#8a7a9c]">
            Çık ✖️
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex justify-between text-xs font-black text-[#4a3b5c]">
              <span>{hud.ohp} HP</span>
              <span className="truncate">{match.opp.name} 🥊</span>
            </div>
            <div className="mt-1 h-3.5 overflow-hidden rounded-full bg-[#f3ecff]">
              <div className="ml-auto h-full rounded-full bg-gradient-to-l from-[#7fcdf3] to-[#b79cff] transition-all duration-150" style={{ width: `${hud.ohp}%` }} />
            </div>
          </div>
        </div>

        {/* 60 FPS Canvas */}
        <canvas ref={canvasRef} className="w-full rounded-2xl border-2 border-[#efe6ff]" />

        <div className="flex items-center justify-between px-1 text-xs font-black text-[#6b4fc0]">
          <span>{hud.msg}</span>
          <span>🔥 Kombo: x{hud.combo}</span>
        </div>

        {/* 4 Büyük Dokunmatik / Klavye Boks Düğmesi (Mobilde rahat başparmak erişimi) */}
        <div className="grid grid-cols-4 gap-2">
          {CUE_TYPES.map((t) => {
            const m = CUE_META[t]
            return (
              <button
                key={t}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault()
                  triggerAction(t)
                }}
                style={{ backgroundColor: m.color }}
                className="flex select-none flex-col items-center justify-center rounded-2xl border-b-4 border-black/15 py-3 text-[#2d1f47] shadow-soft active:translate-y-[2px]"
              >
                <span className="text-xl font-black leading-none">{m.key}</span>
                <span className="mt-0.5 text-[11px] font-black">{m.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ======================= 4. ANA HOOK: useFitness =======================
export function useFitness({ net, say, name, venue, focusRef, panel, setPanel, touch, atDoor }) {
  const { on, send } = net
  const [attr, setAttr] = useState(readLocalAttr)
  const [energy, setEnergy] = useState(() => readLocalEnergy(readLocalAttr()).left)
  const [eMax, setEMax] = useState(() => readLocalEnergy(readLocalAttr()).max)
  const [board, setBoard] = useState(readLocalBoard)
  const [champKey, setChampKey] = useState(null)
  const [selfKey, setSelfKey] = useState(null)
  const [lobby, setLobby] = useState([])
  const [queued, setQueued] = useState(false)
  const [tab, setTab] = useState('lobby') // lobby | train | board
  const [workout, setWorkout] = useState(null) // 'str' | 'sta' | null
  const [match, setMatch] = useState(null)
  const [liveState, setLiveState] = useState(null)
  const [result, setResult] = useState(null)
  const [nearEq, setNearEq] = useState(null) // 'weights' | 'cardio' | 'ring' | null
  const savedCos = useRef(null)

  const inBoxingModal = panel === 'boxing'
  const inStatsModal = panel === 'stats'
  const isChamp = Boolean(champKey && selfKey && champKey === selfKey)

  // Stat & şampiyon deposunu güncel tut (LocalPlayer hızı + 3D şampiyon kemeri için)
  useEffect(() => {
    fitnessStore.set({ attr, champKey })
  }, [attr, champKey])

  // Haftalık şampiyon altın kemerini avatara otomatik tak
  useEffect(() => {
    const cur = cosStore.get('self') ?? {}
    if (Boolean(cur.belt) !== isChamp) cosStore.set('self', { ...cur, belt: isChamp })
  }, [isChamp])

  // Boks lobisi/maçı açıkken otomatik 3D boks kıyafeti (eldiven + şort tonu) giydir, çıkınca geri yükle
  useEffect(() => {
    if (!inBoxingModal && !match) return undefined
    const prev = cosStore.get('self')
    savedCos.current = prev ? { ...prev } : null
    cosStore.set('self', {
      ...(prev ?? {}),
      gloves: true,
      belt: isChamp,
      look: { ...(prev?.look ?? { h: -1, e: -1, o: -1 }), o: '#ff6b6b' },
    })
    return () => {
      const base = savedCos.current ?? { acc: null, acc2: null, pet: null, look: null }
      cosStore.set('self', { ...base, gloves: false, belt: isChamp })
    }
  }, [inBoxingModal, match, isChamp])

  // Sunucu mesajları
  useEffect(() => {
    const offs = [
      on('welcome', (m) => {
        if (m.home) setSelfKey(m.home)
        if (m.fitness) {
          setAttr(m.fitness.attr)
          setEnergy(m.fitness.energy)
          setEMax(m.fitness.energyMax)
          setChampKey(m.fitness.champKey ?? null)
        }
      }),
      on('fitness_state', (m) => {
        if (m.attr) setAttr(m.attr)
        if (m.energy != null) setEnergy(m.energy)
        if (m.energyMax != null) setEMax(m.energyMax)
        if (m.champKey !== undefined) setChampKey(m.champKey)
      }),
      on('box_info', (m) => {
        if (m.attr) setAttr(m.attr)
        if (m.energy != null) setEnergy(m.energy)
        if (m.energyMax != null) setEMax(m.energyMax)
        if (Array.isArray(m.top)) setBoard(m.top)
        if (m.champKey !== undefined) setChampKey(m.champKey)
        if (Array.isArray(m.lobby)) setLobby(m.lobby)
      }),
      on('box_lobby', (m) => {
        const list = m.players ?? []
        setLobby(list)
        setQueued(list.some((p) => p.id === net.selfId.current))
      }),
      on('box_left', () => setQueued(false)),
      on('box_start', (m) => {
        setQueued(false)
        setResult(null)
        setLiveState(null)
        setMatch({ mid: m.mid, seed: m.seed, startAt: m.startAt, you: m.you, opp: m.opp, solo: false })
        setPanel('boxing')
      }),
      on('box_state', (m) => setLiveState(m)),
      on('box_end', (m) => {
        setMatch(null)
        setLiveState(null)
        setResult(m)
        if (Array.isArray(m.top)) setBoard(m.top)
        if (m.champKey !== undefined) setChampKey(m.champKey)
        window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: m.res === 'win' ? 'badge' : 'pop' }))
      }),
      on('box_train_res', (m) => {
        if (!m.ok) {
          if (m.reason === 'energy') say('⚡ Bugünkü antrenman enerjin bitti, yarın yeniden dolacak!')
          return
        }
        setAttr(m.attr)
        setEnergy(m.energy)
        setEMax(m.energyMax)
        const meta = STAT_META[m.kind]
        say(`${meta.emoji} Antrenman tamam! +${m.gain} ${meta.name} kazandın (+${m.coins} ₺)`)
        window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'quest' }))
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [on, net.selfId, say, setPanel])

  // NPC ve özel olaylardan açma
  useEffect(() => {
    const onOpenBox = (e) => {
      setTab(e.detail?.mode === 'board' ? 'board' : 'lobby')
      setResult(null)
      setPanel('boxing')
      send({ t: 'box_info' })
    }
    const onOpenWork = (e) => {
      const k = e.detail?.kind === 'sta' ? 'sta' : 'str'
      setWorkout(k)
      send({ t: 'box_info' })
    }
    window.addEventListener('situapp:open-boxing', onOpenBox)
    window.addEventListener('situapp:open-workout', onOpenWork)
    return () => {
      window.removeEventListener('situapp:open-boxing', onOpenBox)
      window.removeEventListener('situapp:open-workout', onOpenWork)
    }
  }, [send, setPanel])

  // MakFit içindeyken aletlere (bench press, koşu bandı, ring) yaklaşınca hızlı etkileşim istemi
  useEffect(() => {
    if (venue !== 'fitness') {
      setNearEq(null)
      return undefined
    }
    const id = setInterval(() => {
      const f = focusRef.current
      if (!f) return
      const dW = Math.hypot(f.x - 4.5, f.z - -2.4)
      const dC = Math.hypot(f.x - 5.2, f.z - 1.5)
      const dR = Math.hypot(f.x - -3.2, f.z - -0.6)
      if (dW < 2.1) setNearEq('weights')
      else if (dC < 2.2) setNearEq('cardio')
      else if (dR < 2.95) setNearEq('ring')
      else setNearEq(null)
    }, 250)
    return () => clearInterval(id)
  }, [venue, focusRef])

  const openNearEq = useCallback(() => {
    if (!nearEq) return
    if (nearEq === 'weights') setWorkout('str')
    else if (nearEq === 'cardio') setWorkout('sta')
    else if (nearEq === 'ring') {
      setTab('lobby')
      setResult(null)
      setPanel('boxing')
      send({ t: 'box_info' })
    }
  }, [nearEq, send, setPanel])

  useEffect(() => {
    if (!nearEq || panel || workout || match || atDoor) return undefined
    const onKey = (e) => {
      if (isTyping(e)) return
      if (e.code === 'KeyE') openNearEq()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nearEq, panel, workout, match, atDoor, openNearEq])

  const finishWorkout = useCallback(
    (kind, reps, perfects) => {
      if (send({ t: 'box_train', kind, reps, perfects })) return
      // Çevrimdışı yerel fallback
      const en = consumeLocalEnergy(attr)
      if (!en.ok) {
        setEnergy(0)
        return say('⚡ Bugünkü antrenman enerjin bitti!')
      }
      const gain = reps >= 10 || perfects >= 5 ? 3 : reps >= 5 ? 2 : 1
      const next = { ...attr, [kind]: Math.min(STAT_MAX, Math.floor(attr[kind]) + gain) }
      saveLocalAttr(next)
      setAttr(next)
      setEnergy(en.left)
      setEMax(energyMax(next))
      say(`${STAT_META[kind].emoji} Antrenman tamam! +${gain} ${STAT_META[kind].name} kazandın!`)
    },
    [attr, send, say],
  )

  const startSoloBox = () => {
    if (queued) send({ t: 'box_leave' })
    setQueued(false)
    setResult(null)
    setLiveState(null)
    setMatch({
      mid: `solo_${Date.now()}`,
      seed: Math.floor(Math.random() * 1_000_000),
      startAt: Date.now() + 800,
      you: { str: Math.floor(attr.str), sta: Math.floor(attr.sta), ski: Math.floor(attr.ski) },
      opp: { id: 'coach', name: 'Koç Kaan', str: 14, sta: 14, ski: 14 },
      solo: true,
    })
  }

  const onSoloEnd = useCallback(
    (res, reason, score) => {
      setMatch(null)
      const pts = res === 'win' ? (reason === 'ko' ? 90 : 65) : res === 'draw' ? 35 : 15
      const top = pushLocalBoard(name || 'Sen', res === 'win', res === 'win' && reason === 'ko', pts)
      setBoard(top)
      setResult({ res, reason, pts, coins: 0, solo: true, score })
      window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: res === 'win' ? 'badge' : 'pop' }))
    },
    [name],
  )

  // MakFit içinde ağırlık/koşu antrenmanındayken karakteri aletin yanına konumlandırıp canlı 3B antrenman pozu oynat
  useEffect(() => {
    if (!workout) return undefined
    if (venue === 'fitness' && focusRef.current) {
      focusRef.current.teleport = workout === 'str' ? [3.55, -2.4, Math.PI / 2] : [4.4, 1.5, Math.PI]
    }
    work.self.current = { kind: 'work', style: workout === 'str' ? 'bench' : 'cardio', t0: performance.now() / 1000 }
    return () => {
      if (work.self.current?.style === 'bench' || work.self.current?.style === 'cardio') work.self.current = null
    }
  }, [workout, venue, focusRef])

  const closeBoxing = () => {
    if (queued || match) send({ t: 'box_leave' })
    setQueued(false)
    setMatch(null)
    setLiveState(null)
    setResult(null)
    setPanel(null)
  }

  const menuNodes = (
    <button
      onClick={() => {
        setPanel('stats')
        send({ t: 'box_info' })
      }}
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-extrabold text-[#4a3b5c] transition hover:bg-[#fff8f0]"
    >
      <span className="text-lg">💪</span>
      <span className="flex-1">Statlar ve Enerji</span>
      <span className="rounded-full bg-[#fff3c8] px-2 py-0.5 text-[11px] font-black text-[#8a5a00]">⚡ {energy}/{eMax}</span>
    </button>
  )

  const promptMeta =
    nearEq === 'weights'
      ? { emoji: '💪', label: 'Ağırlık Sehpası (+Güç)', action: 'Çalış' }
      : nearEq === 'cardio'
        ? { emoji: '🏃', label: 'Koşu Bandı (+Kondisyon)', action: 'Koş' }
        : nearEq === 'ring'
          ? { emoji: '🥊', label: 'MakFit Boks Ringi', action: 'Ringe Çık' }
          : null

  const overlays = (
    <>
      {promptMeta && !panel && !workout && !match && !atDoor && (
        <DoorPrompt emoji={promptMeta.emoji} label={promptMeta.label} action={promptMeta.action} touch={touch} onGo={openNearEq} />
      )}

      {workout === 'str' && (
        <WeightWorkoutModal
          ski={Math.floor(attr.ski)}
          energy={energy}
          energyMaxVal={eMax}
          onDone={(r, p) => finishWorkout('str', r, p)}
          onClose={() => setWorkout(null)}
        />
      )}

      {workout === 'sta' && (
        <CardioWorkoutModal
          energy={energy}
          energyMaxVal={eMax}
          onDone={(r, p) => finishWorkout('sta', r, p)}
          onClose={() => setWorkout(null)}
        />
      )}

      {match && (
        <BoxingArena
          match={match}
          selfName={name || 'Sen'}
          liveState={liveState}
          onSendHit={(i, type) => send({ t: 'box_hit', i, type })}
          onSoloEnd={onSoloEnd}
          onExit={closeBoxing}
        />
      )}

      {inBoxingModal && !match && (
        <Modal onClose={closeBoxing} label="MakFit Boks Ringi" theme="gym">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-black text-white">🥊 MakFit Ringi</h2>
              <p className="text-xs font-semibold text-white/65">Ritmi yakala, haftalık kemeri al.</p>
            </div>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black text-[#ffd35e]">⚡ {energy}/{eMax}</span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-2xl bg-white/10 p-1">
            {[
              ['lobby', '🥊 Ring'],
              ['train', '💪 Antrenman'],
              ['board', '🏆 Sıralama'],
            ].map(([id, lbl]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTab(id)
                  if (id === 'board') send({ t: 'box_info' })
                }}
                className={`rounded-xl py-2 text-xs font-black transition ${tab === id ? 'bg-[#ff7e70] text-white shadow-sm' : 'text-white/70'}`}
              >
                {lbl}
              </button>
            ))}
          </div>

          <div className="mt-3">
            {result ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-full rounded-3xl bg-gradient-to-br from-[#fff3c4] via-white to-[#efe6ff] p-5 shadow-soft">
                  <p className="text-4xl">{result.res === 'win' ? '🏆' : result.res === 'draw' ? '🤝' : '🥊'}</p>
                  <p className="mt-1 text-lg font-black text-[#4a3b5c]">
                    {result.res === 'win' ? (result.reason === 'ko' ? 'NAKAVT İLE KAZANDIN!' : 'MAÇI KAZANDIN!') : result.res === 'draw' ? 'BERABERE!' : 'İYİ MÜCADELE!'}
                  </p>
                  <p className="mt-1 text-xs font-extrabold text-[#6b4fc0]">
                    +{result.pts} sıralama puanı{result.coins ? ` · +${result.coins} ₺` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="w-full rounded-2xl border-b-4 border-[#d96c5b] bg-[#ff8a7a] py-3 text-sm font-black text-white"
                >
                  Ringe Dön 🥊
                </button>
              </div>
            ) : tab === 'board' ? (
              <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
                {board.length === 0 ? (
                  <p className="py-8 text-center text-sm font-bold text-[#8a7a9c]">Bu hafta henüz maç yok — ilk şampiyon sen ol! 🏆</p>
                ) : (
                  board.map((r, i) => (
                    <div key={r.key ?? i} className={`flex items-center gap-2.5 rounded-2xl px-3 py-2 ${i === 0 ? 'bg-[#fff3c4]' : 'bg-[#f6f0ff]/75'}`}>
                      <span className="w-7 text-center text-sm font-black text-[#4a3b5c]">{i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-[#4a3b5c]">
                          {r.name} {i === 0 ? '· Altın Kemer' : ''}
                        </p>
                        <p className="text-[11px] font-bold text-[#8a7a9c]">{r.wins} galibiyet · {r.ko} KO</p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-[#5b3fa8] shadow-sm">{r.points} p</span>
                    </div>
                  ))
                )}
              </div>
            ) : tab === 'train' ? (
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setPanel(null)
                    setWorkout('str')
                  }}
                  className="flex items-center justify-between rounded-2xl border-2 border-[#ffd4cd] bg-[#fff5f3] p-3.5 text-left transition hover:bg-[#ffebe7]"
                >
                  <div>
                    <p className="text-sm font-black text-[#4a3b5c]">💪 Ağırlık Sehpası (+Güç)</p>
                    <p className="text-xs font-bold text-[#8a7a9c]">Boks yumruk hasarını artırır · Mevcut: {Math.floor(attr.str)}</p>
                  </div>
                  <span className="rounded-xl bg-[#ff8a7a] px-3 py-1.5 text-xs font-black text-white">Çalış</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPanel(null)
                    setWorkout('sta')
                  }}
                  className="flex items-center justify-between rounded-2xl border-2 border-[#cbe8ff] bg-[#f2faff] p-3.5 text-left transition hover:bg-[#e5f4ff]"
                >
                  <div>
                    <p className="text-sm font-black text-[#4a3b5c]">🏃 Koşu Bandı (+Kondisyon)</p>
                    <p className="text-xs font-bold text-[#8a7a9c]">Savunma, enerji ve koşu hızı · Mevcut: {Math.floor(attr.sta)}</p>
                  </div>
                  <span className="rounded-xl bg-[#7fcdf3] px-3 py-1.5 text-xs font-black text-white">Koş</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="rounded-2xl bg-[#fff5f3] p-3 text-center text-xs font-black text-[#b54141]">
                  🥊 Boks eldivenlerin ve şortun otomatik giyildi!
                </div>
                <div className="rounded-2xl border-2 border-[#efe6ff] bg-[#fcfaff] p-3.5">
                  <div className="flex items-center justify-between text-xs font-black text-[#4a3b5c]">
                    <span>1v1 Oyuncu Lobisi</span>
                    <span className="rounded-full bg-[#e9ddff] px-2.5 py-0.5 text-[#5b3fa8]">{lobby.length} bekliyor</span>
                  </div>
                  <div className="mt-3">
                    {queued ? (
                      <button
                        type="button"
                        onClick={() => {
                          send({ t: 'box_leave' })
                          setQueued(false)
                        }}
                        className="w-full rounded-2xl border-2 border-[#ffd2d2] bg-[#fff5f5] py-2.5 text-sm font-black text-[#b54141]"
                      >
                        Rakip Aranıyor… (İptal Et)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (!send({ t: 'box_queue' })) say('Çevrimdışısın — Koç Kaan ile hemen antrenman maçına çıkabilirsin!')
                          else setQueued(true)
                        }}
                        className="w-full rounded-2xl border-b-4 border-[#d96c5b] bg-[#ff8a7a] py-2.5 text-sm font-black text-white shadow-soft active:translate-y-[2px]"
                      >
                        🥊 Başka Oyuncuyla Maç Ara (1v1)
                      </button>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={startSoloBox}
                  className="w-full rounded-2xl border-b-4 border-[#d98a1c] bg-[#fdb252] py-3 text-sm font-black text-white shadow-soft active:translate-y-[2px]"
                >
                  Koç Kaan ile Antrenman Maçı
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {inStatsModal && (
        <Modal onClose={() => setPanel(null)} label="Karakter Statları" theme="bag">
          <div className="mb-3 flex items-center gap-2">
            <div className="grid flex-1 grid-cols-3 gap-1.5 rounded-2xl bg-[#f3ece0] p-1">
              <button type="button" onClick={() => setPanel('inventory')} className="rounded-xl py-1.5 text-xs font-black text-[#8a7a68]">🎒 Çanta</button>
              <button type="button" className="rounded-xl bg-white py-1.5 text-xs font-black text-[#4a3b5c] shadow-sm">💪 Statlar</button>
              <button type="button" onClick={() => setPanel('collection')} className="rounded-xl py-1.5 text-xs font-black text-[#8a7a68]">🧺 Koleksiyon</button>
            </div>
            <button
              type="button"
              onClick={() => setPanel(null)}
              aria-label="Kapat"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f3ece0] text-sm font-black text-[#6b5a4e] transition hover:bg-[#eadcc8] active:scale-95"
            >
              ✖️
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-black text-[#4a3b5c]">Statlar</h2>
              <p className="text-xs font-bold text-[#8a7a9c]">MakFit antrenmanları ve sosyal aktivitelerle gelişir.</p>
            </div>
            <span className="rounded-full bg-[#fff3c8] px-3 py-1 text-xs font-black text-[#8a5a00]">⚡ {energy}/{eMax}</span>
          </div>

          {isChamp && (
            <div className="mt-3 rounded-2xl bg-gradient-to-r from-[#fff3c4] to-[#ffe49e] px-3.5 py-2 text-center text-xs font-black text-[#8a5a00]">
              Bu haftanın MakFit Boks Şampiyonusun! Altın kemerin aktif.
            </div>
          )}

          <div className="mt-3 flex flex-col gap-2.5">
            {STAT_KEYS.map((k) => {
              const m = STAT_META[k]
              const val = Math.floor(attr[k] ?? STAT_START)
              const bonus =
                k === 'str'
                  ? `+%${Math.round((val / 100) * 60)} boks hasarı`
                  : k === 'sta'
                    ? `-%${Math.round((val / 100) * 30)} hasar · +%${Math.round((val / 100) * 12)} koşu`
                    : k === 'cha'
                      ? `+%${coinBonusPct(val)} TL bonusu`
                      : `+${Math.round(val * 0.95)} ms zamanlama`
              return (
                <div key={k} className="rounded-2xl bg-[#f8f4ff] p-3">
                  <div className="flex items-center justify-between text-xs font-black text-[#4a3b5c]">
                    <span>{m.name}</span>
                    <span className="text-[#6b4fc0]">{val}/{STAT_MAX} · {bonus}</span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full transition-all" style={{ width: `${val}%`, backgroundColor: m.color }} />
                  </div>
                  <p className="mt-1 text-[11px] font-bold text-[#8a7a9c]">{m.how}</p>
                </div>
              )
            })}
          </div>
        </Modal>
      )}
    </>
  )

  return { menuNodes, overlays }
}
