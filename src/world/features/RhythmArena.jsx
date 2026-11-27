// Ritim mini oyunu arenası.
import { useEffect, useRef, useState } from 'react'
import { makeRng } from './minigameShared'
// ======================= 1. RİTİM & DANS SAVAŞI (KULÜP BABİL) =======================
export const LANES = [
  { key: 'KeyA', lbl: 'A', color: '#ff8fb8', glow: 'rgba(255,143,184,0.6)' },
  { key: 'KeyS', lbl: 'S', color: '#ffd35e', glow: 'rgba(255,211,94,0.6)' },
  { key: 'KeyD', lbl: 'D', color: '#7fcdf3', glow: 'rgba(127,205,243,0.6)' },
  { key: 'KeyF', lbl: 'F', color: '#b79cff', glow: 'rgba(183,156,255,0.6)' },
]

export function RhythmArena({ seed, touch, onFinish, onExit }) {
  const cvRef = useRef(null)
  const hitFnRef = useRef(null)
  const [hud, setHud] = useState({ score: 0, combo: 0, left: 32, judge: '' })

  useEffect(() => {
    const cv = cvRef.current
    if (!cv) return undefined
    const ctx = cv.getContext('2d')
    const rng = makeRng(seed)
    const DURATION = 32
    const notes = []
    for (let t = 1.2; t < DURATION - 1.2; t += 0.42) {
      notes.push({ lane: Math.floor(rng() * 4), time: t, hit: false, missed: false })
      if (t > 12 && rng() < 0.25) notes.push({ lane: Math.floor(rng() * 4), time: t + 0.21, hit: false, missed: false })
    }
    const sparks = []
    const flash = [0, 0, 0, 0]
    let score = 0
    let combo = 0
    let judge = ''
    let judgeAt = 0
    let done = false
    let raf = 0
    const t0 = performance.now()
    let prev = t0
    let lastHud = 0

    const triggerLane = (lane) => {
      if (done) return
      flash[lane] = 1
      const elapsed = (performance.now() - t0) / 1000
      let best = null
      let bestD = 0.22
      for (const n of notes) {
        if (n.hit || n.missed || n.lane !== lane) continue
        const d = Math.abs(n.time - elapsed)
        if (d < bestD) {
          bestD = d
          best = n
        }
      }
      if (best) {
        best.hit = true
        combo++
        const mult = 1 + Math.min(2, Math.floor(combo / 8) * 0.5)
        const pts = Math.round((bestD < 0.09 ? 100 : 60) * mult)
        score += pts
        judge = bestD < 0.09 ? `✨ MÜKEMMEL! +${pts}` : `👍 İYİ +${pts}`
        judgeAt = performance.now()
        window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
        const r = cv.getBoundingClientRect()
        const lx = ((lane + 0.5) / 4) * r.width
        const ly = r.height * 0.82
        for (let i = 0; i < 12; i++) {
          sparks.push({ x: lx, y: ly, vx: (Math.random() - 0.5) * 200, vy: -40 - Math.random() * 140, r: 3 + Math.random() * 4, life: 0.45, c: LANES[lane].color })
        }
      } else {
        combo = 0
        judge = 'Kaçtı!'
        judgeAt = performance.now()
      }
    }
    hitFnRef.current = triggerLane

    const onKey = (e) => {
      const idx = LANES.findIndex((l) => l.key === e.code)
      if (idx >= 0) {
        e.preventDefault()
        triggerLane(idx)
      }
    }
    window.addEventListener('keydown', onKey)

    const loop = (now) => {
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now
      const elapsed = (now - t0) / 1000
      const rect = cv.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const W = Math.max(280, Math.floor(rect.width))
      const H = Math.max(260, Math.floor(rect.height))
      if (cv.width !== Math.floor(W * dpr) || cv.height !== Math.floor(H * dpr)) {
        cv.width = Math.floor(W * dpr)
        cv.height = Math.floor(H * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Disko arka plan
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, '#221542')
      bg.addColorStop(1, '#3b2468')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      // Nabız atan disko ışıkları
      const pulse = 0.5 + 0.5 * Math.sin(elapsed * Math.PI * 4)
      ctx.fillStyle = `rgba(183,156,255,${(0.08 + pulse * 0.08).toFixed(2)})`
      ctx.beginPath()
      ctx.arc(W * 0.5, H * 0.15, W * (0.28 + pulse * 0.06), 0, Math.PI * 2)
      ctx.fill()

      const hitY = H * 0.82
      const laneW = W / 4

      // Şeritler ve hedef halkaları
      for (let i = 0; i < 4; i++) {
        flash[i] = Math.max(0, flash[i] - dt * 5)
        const cx = (i + 0.5) * laneW
        ctx.fillStyle = flash[i] > 0.01 ? LANES[i].glow : 'rgba(255,255,255,0.04)'
        ctx.fillRect(i * laneW + 4, 0, laneW - 8, H)
        ctx.strokeStyle = LANES[i].color
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.arc(cx, hitY, 24 + flash[i] * 5, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Düşen notalar
      const fallSec = 1.65
      for (const n of notes) {
        if (n.hit) continue
        const dtNote = n.time - elapsed
        if (dtNote < -0.22 && !n.missed) {
          n.missed = true
          combo = 0
        }
        if (dtNote < -0.3 || dtNote > fallSec) continue
        const y = hitY - (dtNote / fallSec) * (hitY + 30)
        const cx = (n.lane + 0.5) * laneW
        ctx.fillStyle = LANES[n.lane].color
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(cx, y, 20, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = 'rgba(255,255,255,0.55)'
        ctx.beginPath()
        ctx.arc(cx - 6, y - 6, 6, 0, Math.PI * 2)
        ctx.fill()
      }

      // Parçacıklar
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i]
        sp.x += sp.vx * dt
        sp.y += sp.vy * dt
        sp.vy += 320 * dt
        sp.life -= dt
        if (sp.life <= 0) { sparks.splice(i, 1); continue }
        ctx.globalAlpha = Math.max(0, sp.life / 0.45)
        ctx.fillStyle = sp.c
        ctx.beginPath()
        ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      if (now - lastHud > 80) {
        lastHud = now
        setHud({ score, combo, left: Math.max(0, Math.ceil(DURATION - elapsed)), judge: now - judgeAt < 650 ? judge : '' })
      }
      if (elapsed >= DURATION && !done) {
        done = true
        onFinish(score, DURATION * 1000)
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey)
    }
  }, [seed, onFinish])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#221542] select-none touch-none">
      <div className="flex items-center justify-between bg-white/92 px-4 py-2.5 shadow-soft">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#f3e8ff] px-3 py-1 text-xs font-black text-[#5b3fa8]">🪩 {hud.score} puan</span>
          <span className="rounded-full bg-[#fff3c8] px-3 py-1 text-xs font-black text-[#8a5a00]">🔥 {hud.combo}x</span>
          <span className="rounded-full bg-[#dff3ff] px-3 py-1 text-xs font-black text-[#12688a]">⏱ {hud.left} sn</span>
        </div>
        <button type="button" onClick={onExit} className="rounded-full bg-[#ffe8e8] px-3 py-1 text-xs font-black text-[#b54141]">Çık ✖️</button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <canvas ref={cvRef} className="block h-full w-full" />
        {hud.judge && (
          <div className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 rounded-full bg-white/95 px-5 py-1.5 text-base font-black text-[#4a3b5c] shadow-toy">
            {hud.judge}
          </div>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2 bg-[#1a1033] p-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        {LANES.map((l, i) => (
          <button
            key={l.lbl}
            type="button"
            onPointerDown={(e) => { e.preventDefault(); hitFnRef.current?.(i) }}
            className="flex h-16 flex-col items-center justify-center rounded-2xl border-b-4 border-white/40 font-black text-[#2a194d] shadow-md active:translate-y-0.5"
            style={{ background: l.color }}
          >
            <span className="text-xl">{touch ? '🎵' : l.lbl}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
