import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal } from '../Hud'
import { isTyping } from './fitnessLocal'

// ======================= 1. AĞIRLIK ÇALIŞMA MİNİ OYUNU (+GÜÇ) =======================
export function WeightWorkoutModal({ ski, energy, energyMaxVal, onDone, onClose }) {
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

  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

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
            onDoneRef.current(stRef.current.reps, stRef.current.perfects)
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
  }, [phase])

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
    <Modal onClose={onClose} label="Ağırlık Antrenmanı" theme="gym" dockBottom hideClose>
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
export function CardioWorkoutModal({ energy, energyMaxVal, onDone, onClose }) {
  const [phase, setPhase] = useState('ready')
  const [steps, setSteps] = useState(0)
  const [perfects, setPerfects] = useState(0)
  const [pos, setPos] = useState(10)
  const [left, setLeft] = useState(16)
  const [pace, setPace] = useState(40)
  const [streak, setStreak] = useState(0)
  const [hitFx, setHitFx] = useState(null) // { key, kind, label }
  const [feedback, setFeedback] = useState('İmleç parlak alana gelince bas!')
  const stRef = useRef({ pos: 10, dir: 1, steps: 0, perfects: 0, streak: 0, pace: 40, done: false })
  const fxTimer = useRef(null)

  const halfGood = 18
  const halfPerf = 7

  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (phase !== 'play') return undefined
    let raf = 0
    let last = performance.now()
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const s = stRef.current
      const speed = 105 + Math.min(70, s.steps * 2.5)
      s.pos += s.dir * speed * dt
      if (s.pos >= 96) {
        s.pos = 96
        s.dir = -1
      } else if (s.pos <= 4) {
        s.pos = 4
        s.dir = 1
      }
      setPos(s.pos)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const decay = setInterval(() => {
      stRef.current.pace = Math.max(0, stRef.current.pace - 3)
      setPace(stRef.current.pace)
    }, 200)
    const tid = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          clearInterval(tid)
          clearInterval(decay)
          if (!stRef.current.done) {
            stRef.current.done = true
            setPhase('done')
            const reps = Math.max(1, Math.round(stRef.current.steps / 2))
            onDoneRef.current(reps, stRef.current.perfects)
          }
          return 0
        }
        return l - 1
      })
    }, 1000)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(decay)
      clearInterval(tid)
    }
  }, [phase])

  const triggerFx = useCallback((kind, label) => {
    clearTimeout(fxTimer.current)
    setHitFx({ key: Math.random(), kind, label })
    fxTimer.current = setTimeout(() => setHitFx(null), 360)
  }, [])

  const tapStep = useCallback(() => {
    if (phase !== 'play') return
    const dist = Math.abs(stRef.current.pos - 50)
    if (dist <= halfPerf) {
      stRef.current.steps += 2
      stRef.current.perfects += 1
      stRef.current.streak += 1
      stRef.current.pace = Math.min(100, stRef.current.pace + 18)
      setSteps(stRef.current.steps)
      setPerfects(stRef.current.perfects)
      setStreak(stRef.current.streak)
      setPace(stRef.current.pace)
      setFeedback(stRef.current.streak >= 3 ? `🔥 ${stRef.current.streak}x Seri! Mükemmel tempo (+2)` : '⚡ Mükemmel tempo (+2 adım)')
      triggerFx('perf', stRef.current.streak >= 3 ? `🔥 ${stRef.current.streak}x MÜKEMMEL +2` : '⚡ MÜKEMMEL +2!')
      window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'collect' }))
    } else if (dist <= halfGood) {
      stRef.current.steps += 1
      stRef.current.streak += 1
      stRef.current.pace = Math.min(100, stRef.current.pace + 10)
      setSteps(stRef.current.steps)
      setStreak(stRef.current.streak)
      setPace(stRef.current.pace)
      setFeedback('🏃 İyi adım (+1)')
      triggerFx('good', '✨ İYİ +1!')
      window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
    } else {
      stRef.current.streak = 0
      stRef.current.pace = Math.max(0, stRef.current.pace - 8)
      setStreak(0)
      setPace(stRef.current.pace)
      setFeedback('Kaçırdın — parlak alanı bekle!')
      triggerFx('miss', 'KAÇTI!')
    }
  }, [phase, halfPerf, halfGood, triggerFx])

  useEffect(() => {
    if (phase !== 'play') return undefined
    const onKey = (e) => {
      if (isTyping(e)) return
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        tapStep()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [phase, tapStep])

  const start = () => {
    stRef.current = { pos: 10, dir: 1, steps: 0, perfects: 0, streak: 0, pace: 40, done: false }
    setSteps(0)
    setPerfects(0)
    setStreak(0)
    setHitFx(null)
    setPos(10)
    setLeft(16)
    setPace(40)
    setFeedback('Hadi! İmleç ortadaki parlak alana gelince bas!')
    setPhase('play')
  }

  return (
    <Modal onClose={onClose} label="Koşu Bandı" theme="gym" dockBottom hideClose>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-black text-white">🏃 Koşu Bandı</h2>
          <p className="text-xs font-semibold text-white/70">Doğru zamanda Boşluk tuşuna bas veya tıkla.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black text-[#7fcdf3]">⚡ {energy}/{energyMaxVal}</span>
          <button type="button" onClick={onClose} aria-label="Kapat" className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-xs font-black text-white">✖️</button>
        </div>
      </div>

      <div className="relative mt-3 rounded-2xl bg-white/10 p-3">
        {hitFx && (
          <div
            key={hitFx.key}
            className={`pointer-events-none absolute -top-3 left-1/2 z-10 -translate-x-1/2 animate-pop rounded-full px-3 py-0.5 text-xs font-black shadow-lg ${
              hitFx.kind === 'perf' ? 'bg-[#ffd35e] text-[#4a3b5c]' : hitFx.kind === 'good' ? 'bg-[#7fcdf3] text-white' : 'bg-[#ff7e70] text-white'
            }`}
          >
            {hitFx.label}
          </div>
        )}
        <div className="flex items-center justify-between text-xs font-black text-white/90">
          <span>Adım: {steps}</span>
          <span>Mükemmel: {perfects}</span>
          <span>{streak >= 2 ? `🔥 x${streak}` : `Tempo: %${pace}`}</span>
          <span className="tabular-nums">⏱ {left} sn</span>
        </div>
        {/* Zamanlama çubuğu */}
        <div
          className={`relative mt-2.5 h-8 w-full overflow-hidden rounded-full border-2 bg-white/10 transition-all duration-100 ${
            hitFx?.kind === 'perf'
              ? 'scale-[1.02] border-[#ffd35e] ring-4 ring-[#ffd35e]/55 shadow-[0_0_22px_rgba(255,211,94,0.75)]'
              : hitFx?.kind === 'good'
                ? 'border-[#7fcdf3] ring-4 ring-[#7fcdf3]/45 shadow-[0_0_16px_rgba(127,205,243,0.65)]'
                : hitFx?.kind === 'miss'
                  ? 'border-[#ff7e70] ring-2 ring-[#ff7e70]/50'
                  : 'border-white/25'
          }`}
        >
          <div className="absolute top-0 h-full bg-[#7fcdf3]/65" style={{ left: `${50 - halfGood}%`, width: `${halfGood * 2}%` }} />
          <div className="absolute top-0 h-full bg-[#ffd35e]" style={{ left: `${50 - halfPerf}%`, width: `${halfPerf * 2}%` }} />
          {hitFx && hitFx.kind !== 'miss' && (
            <div
              key={`r-${hitFx.key}`}
              className={`absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full ${
                hitFx.kind === 'perf' ? 'bg-[#ffd35e]/70' : 'bg-[#7fcdf3]/60'
              }`}
            />
          )}
          <div className="absolute top-0.5 h-6 w-3 -translate-x-1/2 rounded-full border-2 border-[#221b38] bg-white shadow" style={{ left: `${pos}%` }} />
        </div>
        <p className={`mt-2 text-center text-xs font-bold ${hitFx?.kind === 'perf' ? 'text-[#ffd35e]' : hitFx?.kind === 'miss' ? 'text-[#ff8a7a]' : 'text-[#7fcdf3]'}`}>
          {feedback}
        </p>
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
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault()
              tapStep()
            }}
            className="w-full select-none rounded-2xl border-b-4 border-[#4da5d1] bg-[#7fcdf3] py-4 text-base font-black text-white shadow-soft active:translate-y-[2px]"
          >
            ADIM AT (Boşluk / Tıkla)
          </button>
        ) : (
          <button type="button" onClick={onClose} className="w-full rounded-2xl border-b-4 border-[#5aa886] bg-[#7fd3b8] py-3 text-base font-black text-white">
            Süper Tempo! Kapat
          </button>
        )}
      </div>
    </Modal>
  )
}
