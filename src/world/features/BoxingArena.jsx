// Boks maçı arenası: maç öncesi hazır onay penceresi + cihaza özel animasyonlu rehber,
// klavyede timeline çember tuş yakalama, mobilde çember içi yön oku parmak sürtme (swipe), 3B yumruk/slash SFX.
import { useCallback, useEffect, useRef, useState } from 'react'
import { BLOCK_MS, BOX, BOX_DIRS, CUE_META, boxCues, gradeWindow, hitDamage, matchDuration, roundStart } from '../boxing'
import BoxingArena3D from './BoxingArena3D'
import { isTyping } from './fitnessLocal'

const TIMELINE_SPAN_MS = 1850
const SWIPE_MIN_PX = 24

const emitSfx = (name, opt) => {
  window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: opt ? { name, ...opt } : name }))
}

function ReadyHelperAnimation({ touch }) {
  if (touch) {
    return (
      <div className="relative flex flex-col items-center gap-2 rounded-2xl border-2 border-[#efe6ff] bg-[#1e1435] px-4 py-3.5 text-white shadow-inner">
        <style>{`
          @keyframes boxArrowFlow {
            0% { transform: translateX(68px) scale(0.75); opacity: 0; }
            25% { opacity: 1; }
            55% { transform: translateX(0px) scale(1.08); opacity: 1; }
            85% { transform: translateX(-48px) scale(0.85); opacity: 0; }
            100% { transform: translateX(-48px) scale(0.85); opacity: 0; }
          }
          @keyframes boxFingerSwipe {
            0%, 36% { transform: translate(-18px, 14px) scale(0.92); opacity: 0; }
            46% { transform: translate(-18px, 8px) scale(1); opacity: 1; }
            72% { transform: translate(34px, 8px) scale(1.06); opacity: 1; }
            90%, 100% { transform: translate(44px, 8px) scale(0.9); opacity: 0; }
          }
          @keyframes boxRingPulse {
            0%, 42%, 100% { transform: scale(1); border-color: rgba(255,255,255,0.55); box-shadow: none; }
            55%, 68% { transform: scale(1.14); border-color: #ffd35e; box-shadow: 0 0 18px rgba(255,211,94,0.65); }
          }
        `}</style>
        <div className="relative flex h-20 w-full max-w-[15rem] items-center justify-center overflow-hidden">
          <div className="h-1.5 w-full rounded-full bg-white/10" />
          <div
            className="absolute grid h-14 w-14 place-items-center rounded-full border-4 border-white/60 bg-[#2f2052]"
            style={{ animation: 'boxRingPulse 2.1s infinite ease-in-out' }}
          />
          <div
            className="absolute grid h-10 w-10 place-items-center rounded-full bg-[#ffd35e] text-xl font-black text-[#23183d] shadow"
            style={{ animation: 'boxArrowFlow 2.1s infinite ease-in-out' }}
          >
            →
          </div>
          <div
            className="pointer-events-none absolute text-2xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
            style={{ animation: 'boxFingerSwipe 2.1s infinite ease-out' }}
          >
            👆
          </div>
        </div>
        <p className="text-center text-xs font-extrabold leading-snug text-[#efe6ff]">
          Çemberin içinden geçen <span className="text-[#ffd35e]">ok yönüne doğru</span> parmağını ekranda sürükle!
        </p>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col items-center gap-2 rounded-2xl border-2 border-[#efe6ff] bg-[#1e1435] px-4 py-3.5 text-white shadow-inner">
      <style>{`
        @keyframes boxKeySlide {
          0% { transform: translateX(88px) scale(0.8); opacity: 0; }
          20% { opacity: 1; }
          56% { transform: translateX(0px) scale(1.08); opacity: 1; }
          76%, 100% { transform: translateX(-20px) scale(1.2); opacity: 0; }
        }
        @keyframes boxKeyPress {
          0%, 48%, 100% { transform: translateY(0px) scale(1); background-color: #fff8ee; color: #2d1f47; }
          56%, 68% { transform: translateY(3px) scale(0.94); background-color: #ffd35e; color: #23183d; }
        }
        @keyframes boxCircleGlow {
          0%, 44%, 100% { transform: scale(1); border-color: rgba(255,255,255,0.55); box-shadow: none; }
          56%, 68% { transform: scale(1.14); border-color: #8fdcb4; box-shadow: 0 0 18px rgba(143,220,180,0.7); }
        }
      `}</style>
      <div className="flex w-full max-w-[16rem] items-center justify-between gap-3">
        <div className="relative flex h-16 flex-1 items-center overflow-hidden pl-3">
          <div className="h-1.5 w-full rounded-full bg-white/15" />
          <div
            className="absolute left-3 grid h-13 w-13 place-items-center rounded-full border-4 border-white/60 bg-[#2f2052]"
            style={{ width: '3.25rem', height: '3.25rem', animation: 'boxCircleGlow 2s infinite ease-in-out' }}
          >
            <div
              className="grid h-9 w-9 place-items-center rounded-xl border-b-2 border-black/25 bg-[#7fcdf3] text-sm font-black text-[#23183d] shadow"
              style={{ animation: 'boxKeySlide 2s infinite ease-in-out' }}
            >
              A
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1 pr-1">
          <div
            className="grid h-10 w-10 place-items-center rounded-xl border-b-4 border-[#c9b79c] text-sm font-black shadow"
            style={{ animation: 'boxKeyPress 2s infinite ease-in-out' }}
          >
            A
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-[#ffd35e]">Bas!</span>
        </div>
      </div>
      <p className="text-center text-xs font-extrabold leading-snug text-[#efe6ff]">
        Timeline’dan gelen <span className="text-[#ffd35e]">klavye tuşu</span> çemberin tam içine oturduğunda o tuşa bas!
      </p>
    </div>
  )
}

export function BoxingArena({ match, selfName, touch = false, liveState, onReady, onSendHit, onSoloEnd, onExit }) {
  const [hud, setHud] = useState({ round: 1, hp: BOX.hp, ohp: BOX.hp, combo: 0, msg: 'Hazır ol!' })
  const [timelineUi, setTimelineUi] = useState({ countdown: 3, items: [], ringHot: false, banner: '', bannerCol: '#ffd35e' })
  const [ringPulse, setRingPulse] = useState(null) // { col, dir, ts }
  const cuesRef = useRef(boxCues(match.seed))
  const swipeRef = useRef(null)

  useEffect(() => {
    cuesRef.current = boxCues(match.seed)
  }, [match.seed])

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
    youHit: false,
    youType: 'jab',
    oppPunch: 0,
    oppHit: false,
    oppType: 'jab',
    shake: 0,
    banner: '',
    bannerCol: '#ffd35e',
    bannerAt: 0,
    ended: false,
  })

  // PvP sunucu durumunu 3B sahne animasyonuna ve ses efektlerine yansıt
  useEffect(() => {
    if (match.solo || !liveState) return
    const s = localRef.current
    if (liveState.you) {
      if (liveState.you.hp < s.hp) {
        s.oppPunch = 1
        s.oppHit = true
        s.oppType = liveState.lastHit?.type || 'hook'
        s.shake = 0.28
        emitSfx('punch')
      }
      s.hp = liveState.you.hp
      s.combo = liveState.you.combo
      s.score = liveState.you.score
      if (liveState.you.shield) s.shieldUntil = Date.now() + 900
    }
    if (liveState.opp) {
      if (liveState.opp.hp < s.ohp) {
        s.youPunch = 1
        s.youHit = true
        s.shake = 0.24
      }
      s.ohp = liveState.opp.hp
      if (liveState.opp.shield) s.oppShieldUntil = Date.now() + 900
    }
    setHud((h) => ({ ...h, hp: s.hp, ohp: s.ohp, combo: s.combo }))
  }, [match.solo, liveState])

  const resolveAttempt = useCallback(
    (input) => {
      // input: { kind: 'key', code, key } | { kind: 'swipe', dir }
      const s = localRef.current
      if (s.ended || match.waitingReady || !match.startAt) return
      const now = Date.now()
      const elapsed = now - match.startAt
      if (elapsed < BOX.leadMs - 200) return

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

      if (!best || bestDiff > win.good + 160) {
        s.combo = 0
        s.youType = 'jab'
        s.youHit = false
        s.youPunch = 0.55
        s.banner = 'BOŞA SAVURDUN!'
        s.bannerCol = '#ff8a7a'
        s.bannerAt = now
        emitSfx('slash')
        setRingPulse({ col: '#ff8a7a', label: '✕', ts: now })
        setHud((h) => ({ ...h, combo: 0, msg: touch ? 'Ok çembere girince kaydır!' : 'Tuş çembere gelince bas!' }))
        return
      }

      s.seen.add(best.i)
      const matched =
        input.kind === 'swipe'
          ? input.dir === best.dir
          : input.code === best.keyCode || input.key === best.keyLabel

      if (!matched || bestDiff > win.good + 35) {
        s.combo = 0
        s.youType = best.type
        s.youHit = false
        s.youPunch = 0.6
        s.banner = !matched ? (touch ? 'YANLIŞ YÖN!' : 'YANLIŞ TUŞ!') : 'GEÇ KALDIN!'
        s.bannerCol = '#ff8a7a'
        s.bannerAt = now
        emitSfx('slash')
        setRingPulse({ col: '#ff8a7a', label: '✕', ts: now })
        if (!match.solo) onSendHit(best.i, 'miss')
        setHud((h) => ({
          ...h,
          combo: 0,
          msg: !matched ? (touch ? `Doğru yön: ${BOX_DIRS[best.dir].label} (${best.arrow})` : `Doğru tuş: ${best.keyLabel}`) : 'Zamanlama kaçtı!',
        }))
        return
      }

      const type = best.type
      const grade = bestDiff <= win.perfect + 20 ? 'perfect' : 'good'
      s.combo += 1
      s.youType = type
      s.youHit = type !== 'block'
      s.youPunch = type === 'block' ? 0.38 : 1
      s.banner = grade === 'perfect' ? `MÜKEMMEL ${CUE_META[type].label.toUpperCase()}! 💥` : `İYİ ${CUE_META[type].label.toUpperCase()}!`
      s.bannerCol = grade === 'perfect' ? '#ffd35e' : '#8fdcb4'
      s.bannerAt = now

      if (type === 'block') {
        emitSfx('block')
      } else {
        emitSfx('slash')
        emitSfx('punch', { heavy: grade === 'perfect' || type === 'upper' })
      }
      setRingPulse({ col: grade === 'perfect' ? '#ffd35e' : '#8fdcb4', label: touch ? best.arrow : best.keyLabel, ts: now })

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
        s.shake = grade === 'perfect' ? 0.38 : 0.2
      }
      setHud((h) => ({ ...h, hp: s.hp, ohp: s.ohp, combo: s.combo, msg: s.banner }))
      if (s.ohp <= 0 && !s.ended) {
        s.ended = true
        onSoloEnd('win', 'ko', s.score)
      }
    },
    [match, touch, onSendHit, onSoloEnd],
  )

  // Klavye dinleyicisi (masaüstü timeline tuş eşleşmesi + hazır ol ekranında Enter/Space)
  useEffect(() => {
    const onKey = (e) => {
      if (isTyping(e) || e.repeat) return
      if (match.waitingReady) {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault()
          onReady?.()
        }
        return
      }
      if (touch) return
      const key = (e.key || '').toUpperCase()
      if (/^Key[A-Z]$/.test(e.code) || /^[A-Z]$/.test(key)) {
        e.preventDefault()
        resolveAttempt({ kind: 'key', code: e.code, key })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [match.waitingReady, touch, onReady, resolveAttempt])

  // Mobil parmak sürtme (swipe) algılayıcı
  const onSwipeStart = (e) => {
    if (!touch || match.waitingReady) return
    swipeRef.current = { x: e.clientX, y: e.clientY, done: false }
  }
  const onSwipeMove = (e) => {
    const st = swipeRef.current
    if (!st || st.done) return
    const dx = e.clientX - st.x
    const dy = e.clientY - st.y
    if (Math.hypot(dx, dy) < SWIPE_MIN_PX) return
    st.done = true
    const dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
    resolveAttempt({ kind: 'swipe', dir })
  }
  const onSwipeEnd = () => {
    swipeRef.current = null
  }

  // 60 Hz timeline + 3B animasyon sönümleme + Solo Koç Kaan AI döngüsü
  useEffect(() => {
    const totalMs = matchDuration()
    let prev = performance.now()
    const tid = setInterval(() => {
      const nowPerf = performance.now()
      const dt = Math.min(0.1, (nowPerf - prev) / 1000)
      prev = nowPerf
      const s = localRef.current
      s.youPunch = Math.max(0, s.youPunch - dt * 3.8)
      s.oppPunch = Math.max(0, s.oppPunch - dt * 3.8)
      s.shake = Math.max(0, s.shake - dt * 2.0)

      if (match.waitingReady || !match.startAt) return

      const now = Date.now()
      const elapsed = now - match.startAt

      // Zamanı geçen kaçırılmış vuruşları otomatik temizle ve komboyu sıfırla
      const win = gradeWindow(match.you.ski)
      for (const c of cuesRef.current) {
        if (!s.seen.has(c.i) && elapsed - c.t > win.good + 140) {
          s.seen.add(c.i)
          if (s.combo > 0) {
            s.combo = 0
            setHud((h) => ({ ...h, combo: 0, msg: 'Hamle kaçtı! Gözün çemberde olsun.' }))
          }
        }
      }

      if (match.solo && !s.ended) {
        for (const c of cuesRef.current) {
          if (elapsed >= c.t && !s.aiSeen.has(c.i)) {
            s.aiSeen.add(c.i)
            const roll = ((c.i * 37 + match.seed) % 100) / 100
            if (roll < 0.65) {
              if (c.type === 'block') {
                s.oppShieldUntil = now + BLOCK_MS
                emitSfx('block')
              } else {
                const grade = roll < 0.25 ? 'perfect' : 'good'
                const dmg = hitDamage(c.type, grade, 1, match.opp.str, match.you.sta, s.shieldUntil > now)
                s.hp = Math.max(0, s.hp - dmg)
                s.oppType = c.type
                s.oppHit = true
                s.oppPunch = 1
                s.shake = 0.24
                emitSfx('slash')
                emitSfx('punch')
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

      const items = []
      let ringHot = false
      for (const c of cuesRef.current) {
        if (s.seen.has(c.i)) continue
        const dtCue = c.t - elapsed
        if (dtCue <= TIMELINE_SPAN_MS && dtCue >= -180) {
          const ratio = dtCue / TIMELINE_SPAN_MS // 1 = sağ uç, 0 = çemberin tam merkezi
          if (Math.abs(dtCue) <= win.good) ringHot = true
          items.push({
            i: c.i,
            type: c.type,
            keyLabel: c.keyLabel,
            arrow: c.arrow,
            ratio,
            inZone: Math.abs(dtCue) <= win.good,
          })
        }
        if (dtCue > TIMELINE_SPAN_MS) break
      }

      setHud((h) => (h.round === rNow ? h : { ...h, round: rNow }))
      setTimelineUi({
        countdown: elapsed < BOX.leadMs ? Math.max(1, Math.ceil((BOX.leadMs - elapsed) / 1000)) : 0,
        items,
        ringHot,
        banner: now - s.bannerAt < 800 ? s.banner : '',
        bannerCol: s.bannerCol,
      })
    }, 16)
    return () => clearInterval(tid)
  }, [match, onSoloEnd])

  return (
    <div
      className="fixed inset-0 z-50 flex select-none flex-col items-center justify-center bg-[#23183d]/88 p-3"
      style={{ touchAction: 'none' }}
      onPointerDown={onSwipeStart}
      onPointerMove={onSwipeMove}
      onPointerUp={onSwipeEnd}
      onPointerCancel={onSwipeEnd}
    >
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
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onExit}
            className="shrink-0 rounded-full bg-[#f6f0ff] px-3 py-1.5 text-xs font-black text-[#8a7a9c] hover:bg-[#ece0ff]"
          >
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

        {/* Gerçek 3D Boks Ringi + Onay Penceresi */}
        <div className="relative h-72 w-full overflow-hidden rounded-2xl border-2 border-[#efe6ff] bg-[#24193d] sm:h-80">
          <BoxingArena3D stateRef={localRef} />

          {/* Maç Öncesi 2 Taraflı Hazır Ol Onay Penceresi + Animasyonlu Cihaz Rehberi */}
          {match.waitingReady ? (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute inset-0 z-20 flex items-center justify-center bg-[#1b1130]/82 p-3 backdrop-blur-[3px]"
            >
              <div className="flex w-full max-w-[24rem] flex-col gap-2.5 rounded-3xl border-2 border-white/90 bg-white/95 p-4 text-[#4a3b5c] shadow-xl">
                <div className="text-center">
                  <p className="text-base font-black text-[#4a3b5c]">🥊 Maç Hazırlığı</p>
                  <p className="text-[11px] font-bold text-[#8a7a9c]">İki taraf da hazır olduğunda zil çalar!</p>
                </div>

                {/* İki tarafın hazır durumu */}
                <div className="grid grid-cols-2 gap-2">
                  <div className={`flex items-center justify-between rounded-2xl border-2 px-3 py-2 text-xs font-black ${match.youReady ? 'border-[#8fdcb4] bg-[#eefbf3] text-[#236b48]' : 'border-[#efe6ff] bg-[#faf7ff] text-[#6b5a7e]'}`}>
                    <span className="truncate">{selfName}</span>
                    <span>{match.youReady ? '✓ Hazır' : '⏳ Bekliyor'}</span>
                  </div>
                  <div className={`flex items-center justify-between rounded-2xl border-2 px-3 py-2 text-xs font-black ${match.oppReady ? 'border-[#8fdcb4] bg-[#eefbf3] text-[#236b48]' : 'border-[#efe6ff] bg-[#faf7ff] text-[#6b5a7e]'}`}>
                    <span className="truncate">{match.opp.name}</span>
                    <span>{match.oppReady ? '✓ Hazır' : '⏳ Bekliyor'}</span>
                  </div>
                </div>

                {/* Cihaza göre animasyonlu oynanış rehberi */}
                <ReadyHelperAnimation touch={touch} />

                <button
                  type="button"
                  disabled={match.youReady}
                  onClick={() => onReady?.()}
                  className={`w-full rounded-2xl py-2.5 text-sm font-black text-white shadow-soft transition ${
                    match.youReady
                      ? 'cursor-default bg-[#8fdcb4] text-[#1f573b]'
                      : 'border-b-4 border-[#d96c5b] bg-[#ff8a7a] hover:brightness-105 active:translate-y-[2px]'
                  }`}
                >
                  {match.youReady ? '✓ Hazırsın — Rakip Bekleniyor…' : '🥊 Hazırım! Maça Başla'}
                </button>
              </div>
            </div>
          ) : (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between py-2.5">
              <div className="flex min-h-[1.75rem] items-center justify-center">
                {timelineUi.banner && (
                  <span className="rounded-full bg-[#23183d]/85 px-4 py-1 text-sm font-black shadow-lg" style={{ color: timelineUi.bannerCol }}>
                    {timelineUi.banner}
                  </span>
                )}
              </div>
              {timelineUi.countdown > 0 ? (
                <div className="grid h-20 w-20 place-items-center rounded-full border-4 border-[#ffd35e] bg-[#23183d]/85 text-3xl font-black text-[#ffd35e] shadow-lg">
                  {timelineUi.countdown}
                </div>
              ) : (
                <div />
              )}
              <span className="rounded-full bg-[#23183d]/75 px-3 py-0.5 text-[11px] font-black tracking-wider text-white">
                RAUNT {hud.round}/{BOX.rounds}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-1 text-xs font-black text-[#6b4fc0]">
          <span className="truncate">{hud.msg}</span>
          <span className="shrink-0">🔥 Kombo: x{hud.combo}</span>
        </div>

        {/* Cihaza Göre Timeline + Hedef Çemberi (Klavyede Tuş Akışı / Mobilde Yön Oku + Swipe) */}
        <div className="relative flex h-20 w-full items-center overflow-hidden rounded-2xl border-2 border-[#e8dcff] bg-gradient-to-r from-[#24193d] via-[#2f2150] to-[#24193d] px-4 shadow-inner">
          {/* Timeline çizgisi */}
          <div className="pointer-events-none absolute left-14 right-4 h-1.5 rounded-full bg-white/15" />

          {/* Sabit Hedef Çemberi */}
          <div
            className={`relative z-10 grid h-14 w-14 shrink-0 place-items-center rounded-full border-4 transition-transform duration-100 ${
              timelineUi.ringHot
                ? 'scale-110 border-[#ffd35e] bg-[#ffd35e]/20 shadow-[0_0_20px_rgba(255,211,94,0.65)]'
                : 'border-white/75 bg-white/10'
            }`}
          >
            {ringPulse && Date.now() - ringPulse.ts < 260 ? (
              <span className="text-lg font-black" style={{ color: ringPulse.col }}>
                {ringPulse.label}
              </span>
            ) : (
              <span className="text-[10px] font-black uppercase tracking-wider text-white/60">
                {touch ? 'KAYDIR' : 'HEDEF'}
              </span>
            )}
          </div>

          {/* Timeline'dan Çembere Akan Tuşlar veya Yön Okları */}
          <div className="pointer-events-none relative h-full flex-1">
            {timelineUi.items.map((it) => {
              const meta = CUE_META[it.type]
              const pct = Math.max(-8, Math.min(100, it.ratio * 100))
              return (
                <div
                  key={it.i}
                  style={{
                    left: `calc(${pct}% - 1.35rem)`,
                    backgroundColor: meta.color,
                  }}
                  className={`absolute top-1/2 flex h-11 w-11 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 text-[#23183d] shadow-md transition-transform duration-75 ${
                    it.inZone ? 'scale-115 border-white ring-4 ring-[#ffd35e]/80' : 'border-white/85'
                  }`}
                >
                  <span className="text-base font-black leading-none">{touch ? it.arrow : it.keyLabel}</span>
                  <span className="text-[8px] font-black uppercase leading-none opacity-80">{meta.label}</span>
                </div>
              )
            })}
          </div>

          {/* Sağ köşe ipucu rozeti */}
          <span className="pointer-events-none hidden rounded-xl bg-white/10 px-2.5 py-1 text-[10px] font-extrabold text-white/80 sm:inline-block">
            {touch ? '👆 Ok çemberdeyken sürükle' : '⌨️ Tuş çemberdeyken bas'}
          </span>
        </div>
      </div>
    </div>
  )
}
