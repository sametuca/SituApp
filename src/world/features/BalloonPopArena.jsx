// Balon patlatma mini oyunu arenası.
import { useEffect, useRef, useState } from 'react'
import { makeRng } from './minigameShared'
// ======================= 5. BALON PATLATMA (LOBİ MEYDANI) =======================
export function BalloonPopArena({ seed, onFinish, onExit }) {
  const cvRef = useRef(null)
  const popRef = useRef(null)
  const [hud, setHud] = useState({ score: 0, left: 35, combo: 0 })

  useEffect(() => {
    const cv = cvRef.current
    if (!cv) return undefined
    const ctx = cv.getContext('2d')
    const rng = makeRng(seed)
    const DURATION = 35
    const balloons = []
    const bursts = []
    let score = 0, combo = 0, nextSpawn = 0.2, done = false
    const t0 = performance.now()
    let prev = t0, lastHud = 0, raf = 0

    const COLORS = [
      { c: '#ff9ec7', pts: 15 },
      { c: '#7fcdf3', pts: 20 },
      { c: '#ffd35e', pts: 40 },
      { c: '#b79cff', pts: 25 },
    ]

    const onPop = (cx, cy) => {
      if (done) return
      const r = cv.getBoundingClientRect()
      const px = cx - r.left
      const py = cy - r.top
      for (let i = balloons.length - 1; i >= 0; i--) {
        const b = balloons[i]
        if (Math.hypot(px - b.x * r.width, py - b.y * r.height) <= b.rad + 14) {
          balloons.splice(i, 1)
          if (b.bomb) {
            score = Math.max(0, score - 40)
            combo = 0
          } else {
            combo++
            score += b.pts + Math.min(30, combo * 2)
          }
          window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
          for (let k = 0; k < 12; k++) {
            bursts.push({ x: px, y: py, vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200, r: 4 + Math.random() * 4, life: 0.45, c: b.bomb ? '#4a3b5c' : b.c })
          }
          break
        }
      }
    }
    popRef.current = onPop

    const loop = (now) => {
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now
      const elapsed = (now - t0) / 1000
      const rect = cv.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const W = Math.max(280, Math.floor(rect.width))
      const H = Math.max(280, Math.floor(rect.height))
      if (cv.width !== Math.floor(W * dpr) || cv.height !== Math.floor(H * dpr)) {
        cv.width = Math.floor(W * dpr)
        cv.height = Math.floor(H * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      nextSpawn -= dt
      if (nextSpawn <= 0 && !done) {
        nextSpawn = Math.max(0.28, 0.6 - elapsed * 0.008)
        const bomb = rng() < 0.16
        const pick = COLORS[Math.floor(rng() * COLORS.length)]
        balloons.push({
          x: 0.1 + rng() * 0.8,
          y: 1.08,
          vy: 0.22 + rng() * 0.18 + elapsed * 0.004,
          rad: bomb ? 26 : pick.pts === 40 ? 22 : 28,
          c: bomb ? '#3a2d4d' : pick.c,
          pts: pick.pts,
          bomb,
          ph: rng() * 6,
        })
      }

      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, '#c8eeff')
      bg.addColorStop(1, '#fff3e8')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      for (let i = balloons.length - 1; i >= 0; i--) {
        const b = balloons[i]
        b.y -= b.vy * dt
        b.x += Math.sin(elapsed * 2.5 + b.ph) * 0.04 * dt
        if (b.y < -0.12) { balloons.splice(i, 1); continue }
        const bx = b.x * W, by = b.y * H
        ctx.strokeStyle = 'rgba(74,59,92,0.3)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(bx, by + b.rad)
        ctx.quadraticCurveTo(bx + 8, by + b.rad + 18, bx, by + b.rad + 34)
        ctx.stroke()

        ctx.fillStyle = b.c
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(bx, by, b.rad, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()

        if (b.bomb) {
          ctx.font = '20px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('💣', bx, by)
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.5)'
          ctx.beginPath()
          ctx.ellipse(bx - b.rad * 0.3, by - b.rad * 0.3, b.rad * 0.22, b.rad * 0.14, -0.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      for (let i = bursts.length - 1; i >= 0; i--) {
        const p = bursts[i]
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt
        if (p.life <= 0) { bursts.splice(i, 1); continue }
        ctx.globalAlpha = Math.max(0, p.life / 0.45)
        ctx.fillStyle = p.c
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      if (now - lastHud > 80) {
        lastHud = now
        setHud({ score, left: Math.max(0, Math.ceil(DURATION - elapsed)), combo })
      }
      if (elapsed >= DURATION && !done) {
        done = true
        onFinish(score, DURATION * 1000)
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [seed, onFinish])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#c8eeff] select-none touch-none">
      <div className="flex items-center justify-between bg-white/95 px-4 py-2.5 shadow-soft">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#fff3c8] px-3 py-1 text-xs font-black text-[#8a5a00]">🎈 {hud.score} puan</span>
          <span className="rounded-full bg-[#f3e8ff] px-3 py-1 text-xs font-black text-[#5b3fa8]">🔥 {hud.combo}x</span>
          <span className="rounded-full bg-[#dff3ff] px-3 py-1 text-xs font-black text-[#12688a]">⏱ {hud.left} sn</span>
        </div>
        <button type="button" onClick={onExit} className="rounded-full bg-[#ffe8e8] px-3 py-1 text-xs font-black text-[#b54141]">Çık ✖️</button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <canvas
          ref={cvRef}
          onPointerDown={(e) => { e.preventDefault(); popRef.current?.(e.clientX, e.clientY) }}
          className="block h-full w-full cursor-pointer"
        />
      </div>
    </div>
  )
}
