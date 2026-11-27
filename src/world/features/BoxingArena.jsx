// Boks maçı arenası: girdi, vuruş/blok mantığı, HUD ve sonuç ekranı.
import { useCallback, useEffect, useRef, useState } from 'react'
import { BLOCK_MS, BOX, CUE_META, CUE_TYPES, boxCues, gradeWindow, hitDamage, matchDuration, roundStart } from '../boxing'
import BoxingArena3D from './BoxingArena3D'
import { isTyping } from './fitnessLocal'
// ======================= 3. 3D GERÇEK ZAMANLI BOKS ARENASI =======================
export function BoxingArena({ match, selfName, liveState, onSendHit, onSoloEnd, onExit }) {
  const [hud, setHud] = useState({ round: 1, hp: BOX.hp, ohp: BOX.hp, combo: 0, msg: 'Hazır ol!' })
  const [cueUi, setCueUi] = useState({ countdown: 3, active: null, progress: 0, banner: '', bannerCol: '#ffd35e' })
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
    youType: 'jab',
    oppPunch: 0,
    oppType: 'jab',
    shake: 0,
    banner: '',
    bannerCol: '#ffd35e',
    bannerAt: 0,
    ended: false,
  })

  // PvP sunucu durumunu 3B sahne animasyonuna yansıt
  useEffect(() => {
    if (match.solo || !liveState) return
    const s = localRef.current
    if (liveState.you) {
      if (liveState.you.hp < s.hp) {
        s.oppPunch = 1
        s.oppType = 'hook'
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
        s.youType = type
        s.youPunch = 0.45
        s.banner = 'ERKEN / KAÇTI'
        s.bannerCol = '#ff8a7a'
        s.bannerAt = now
        setHud((h) => ({ ...h, combo: 0, msg: 'Ritmi bekle! Halka daralınca vur.' }))
        return
      }

      s.seen.add(best.i)
      const wrong = type !== best.type
      if (wrong || bestDiff > win.good) {
        s.combo = 0
        s.banner = wrong ? 'YANLIŞ HAMLE!' : 'KAÇTI!'
        s.bannerCol = '#ff8a7a'
        s.bannerAt = now
        if (!match.solo) onSendHit(best.i, type)
        setHud((h) => ({ ...h, combo: 0, msg: wrong ? `Doğru hamle: ${CUE_META[best.type].label}` : 'Zamanlama kaçtı!' }))
        return
      }

      const grade = bestDiff <= win.perfect ? 'perfect' : 'good'
      s.combo += 1
      s.youType = type
      s.youPunch = type === 'block' ? 0.3 : 1
      s.banner = grade === 'perfect' ? `MÜKEMMEL ${CUE_META[type].label.toUpperCase()}!` : `İYİ ${CUE_META[type].label.toUpperCase()}!`
      s.bannerCol = grade === 'perfect' ? '#ffd35e' : '#8fdcb4'
      s.bannerAt = now
      window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: grade === 'perfect' ? 'collect' : 'pop' }))

      if (!match.solo) {
        onSendHit(best.i, type)
        setHud((h) => ({ ...h, combo: s.combo, msg: s.banner }))
        return
      }

      if (type === 'block') {
        s.shieldUntil = now + BLOCK_MS
        s.score += grade === 'perfect' ? 35 : 20
      } else {
        const dmg = hitDamage(type, grade, s.combo, match.you.str, match.opp.sta, s.oppShieldUntil > now)
        s.ohp = Math.max(0, s.ohp - dmg)
        s.score += dmg * 10 + (grade === 'perfect' ? 30 : 15)
        s.shake = grade === 'perfect' ? 0.35 : 0.18
      }
      setHud((h) => ({ ...h, hp: s.hp, ohp: s.ohp, combo: s.combo, msg: s.banner }))
      if (s.ohp <= 0 && !s.ended) {
        s.ended = true
        onSoloEnd('win', 'ko', s.score)
      }
    },
    [match, onSendHit, onSoloEnd],
  )

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

  // 30 Hz HUD zamanlama + Solo Koç Kaan AI döngüsü
  useEffect(() => {
    const totalMs = matchDuration()
    let prev = performance.now()
    const tid = setInterval(() => {
      const nowPerf = performance.now()
      const dt = Math.min(0.1, (nowPerf - prev) / 1000)
      prev = nowPerf
      const now = Date.now()
      const elapsed = now - match.startAt
      const s = localRef.current
      s.youPunch = Math.max(0, s.youPunch - dt * 4.5)
      s.oppPunch = Math.max(0, s.oppPunch - dt * 4.5)
      s.shake = Math.max(0, s.shake - dt * 1.8)

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
                s.oppType = c.type
                s.oppPunch = 1
                s.shake = 0.22
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

      let rNow = 1
      for (let r = 0; r < BOX.rounds; r++) if (elapsed >= roundStart(r)) rNow = r + 1
      let activeCue = null
      let progress = 0
      for (const c of cuesRef.current) {
        if (s.seen.has(c.i)) continue
        const dtCue = c.t - elapsed
        if (dtCue <= 950 && dtCue >= -240) {
          activeCue = c
          progress = Math.max(0, 1 - dtCue / 950)
          break
        }
      }
      setHud((h) => (h.round === rNow ? h : { ...h, round: rNow }))
      setCueUi({
        countdown: elapsed < BOX.leadMs ? Math.max(1, Math.ceil((BOX.leadMs - elapsed) / 1000)) : 0,
        active: activeCue,
        progress,
        banner: now - s.bannerAt < 750 ? s.banner : '',
        bannerCol: s.bannerCol,
      })
    }, 16)
    return () => clearInterval(tid)
  }, [match, onSoloEnd])

  const activeMeta = cueUi.active ? CUE_META[cueUi.active.type] : null

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#23183d]/88 p-3">
      <div className="flex w-[min(96vw,46rem)] flex-col gap-2.5 rounded-[2rem] border-2 border-white bg-white/95 p-4 shadow-toy">
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

        {/* Gerçek 3D Boks Ringi + Zamanlama Hedefi */}
        <div className="relative h-72 w-full overflow-hidden rounded-2xl border-2 border-[#efe6ff] bg-[#24193d] sm:h-80">
          <BoxingArena3D stateRef={localRef} />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between py-2.5">
            <div className="flex min-h-[1.75rem] items-center justify-center">
              {cueUi.banner && (
                <span className="rounded-full bg-[#23183d]/80 px-4 py-1 text-sm font-black shadow" style={{ color: cueUi.bannerCol }}>
                  {cueUi.banner}
                </span>
              )}
            </div>
            {cueUi.countdown > 0 ? (
              <div className="grid h-20 w-20 place-items-center rounded-full border-4 border-[#ffd35e] bg-[#23183d]/85 text-3xl font-black text-[#ffd35e] shadow-lg">
                {cueUi.countdown}
              </div>
            ) : activeMeta ? (
              <div className="relative grid h-20 w-20 place-items-center">
                <div
                  className="h-16 w-16 rounded-full border-4"
                  style={{
                    borderColor: activeMeta.color,
                    transform: `scale(${Math.max(0.86, 2.1 - cueUi.progress * 1.1)})`,
                    opacity: cueUi.progress > 1.05 ? 0.5 : 1,
                  }}
                />
                <div
                  className={`absolute grid h-16 w-16 place-items-center rounded-full border-2 text-center shadow-lg ${cueUi.progress >= 0.86 && cueUi.progress <= 1.14 ? 'border-[#ffd35e] ring-4 ring-white/75' : 'border-white'}`}
                  style={{ backgroundColor: activeMeta.color }}
                >
                  <span className="text-[11px] font-black uppercase text-[#2d1f47]">{activeMeta.label}</span>
                </div>
              </div>
            ) : (
              <div />
            )}
            <span className="rounded-full bg-[#23183d]/75 px-3 py-0.5 text-[11px] font-black tracking-wider text-white">
              RAUNT {hud.round}/{BOX.rounds}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between px-1 text-xs font-black text-[#6b4fc0]">
          <span>{hud.msg}</span>
          <span>🔥 Kombo: x{hud.combo}</span>
        </div>

        {/* 4 Boks Hamlesi */}
        <div className="grid grid-cols-4 gap-2">
          {CUE_TYPES.map((t) => {
            const m = CUE_META[t]
            const active = cueUi.active?.type === t
            return (
              <button
                key={t}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault()
                  triggerAction(t)
                }}
                style={{ backgroundColor: m.color }}
                className={`flex select-none flex-col items-center justify-center rounded-2xl border-b-4 border-black/15 py-3 text-[#2d1f47] shadow-soft transition active:translate-y-[2px] ${
                  active ? 'ring-4 ring-[#4a3b5c]/35 scale-[1.03]' : ''
                }`}
              >
                <span className="text-xs font-black leading-none">{m.label}</span>
                <span className="mt-1 rounded-md bg-white/55 px-1.5 py-0.5 text-[10px] font-extrabold">{m.key}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
