// Bisiklet sprint mini oyunu arenası.
import { useEffect, useRef, useState } from 'react'
import { makeRng } from './minigameShared'
// ======================= 4. BİSİKLET ENGEL YARIŞI (PARK) =======================
export function BikeSprintArena({ seed, touch, onFinish, onExit }) {
  const cvRef = useRef(null)
  const inputRef = useRef({ l: false, r: false, px: null })
  const [hud, setHud] = useState({ score: 0, speed: 1, turbo: false })

  useEffect(() => {
    const onD = (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') inputRef.current.l = true
      if (e.code === 'ArrowRight' || e.code === 'KeyD') inputRef.current.r = true
    }
    const onU = (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') inputRef.current.l = false
      if (e.code === 'ArrowRight' || e.code === 'KeyD') inputRef.current.r = false
    }
    window.addEventListener('keydown', onD)
    window.addEventListener('keyup', onU)
    return () => { window.removeEventListener('keydown', onD); window.removeEventListener('keyup', onU) }
  }, [])

  useEffect(() => {
    const cv = cvRef.current
    if (!cv) return undefined
    const ctx = cv.getContext('2d')
    const rng = makeRng(seed)
    let x = 0.5, vx = 0, dist = 0, bonus = 0, turboT = 0, nextObs = 0.3, done = false
    const obs = []
    const t0 = performance.now()
    let prev = t0, lastHud = 0, raf = 0

    const loop = (now) => {
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now
      const rect = cv.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const W = Math.max(280, Math.floor(rect.width))
      const H = Math.max(280, Math.floor(rect.height))
      if (cv.width !== Math.floor(W * dpr) || cv.height !== Math.floor(H * dpr)) {
        cv.width = Math.floor(W * dpr)
        cv.height = Math.floor(H * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      if (!done) {
        const elapsed = (now - t0) / 1000
        turboT = Math.max(0, turboT - dt)
        const spd = (0.48 + Math.min(0.45, elapsed * 0.015)) * (turboT > 0 ? 1.45 : 1)
        dist += spd * dt * 100
        let steer = 0
        if (inputRef.current.px !== null) steer = Math.max(-1, Math.min(1, (inputRef.current.px - x) * 8))
        else { if (inputRef.current.l) steer -= 1; if (inputRef.current.r) steer += 1 }
        vx += (steer * 0.78 - vx) * Math.min(1, dt * 12)
        x = Math.max(0.18, Math.min(0.82, x + vx * dt))

        nextObs -= spd * dt
        if (nextObs <= 0) {
          nextObs = Math.max(0.24, 0.44 - elapsed * 0.005)
          const laneX = 0.24 + Math.floor(rng() * 4) * 0.173
          const isTurbo = rng() < 0.24
          obs.push({ x: laneX, y: -0.08, kind: isTurbo ? 'turbo' : rng() < 0.5 ? 'cone' : 'puddle', hit: false })
        }

        for (const o of obs) {
          o.y += spd * dt
          if (!o.hit && Math.abs(o.y - 0.78) < 0.055 && Math.abs(o.x - x) < 0.075) {
            o.hit = true
            if (o.kind === 'turbo') {
              turboT = 2.0
              bonus += 80
              window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
            } else {
              done = true
              window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
              onFinish(Math.round(dist + bonus), Math.round(now - t0))
              return
            }
          }
        }
        while (obs.length && obs[0].y > 1.1) obs.shift()

        // Çizim
        ctx.fillStyle = '#a8e3bd'
        ctx.fillRect(0, 0, W, H)
        const roadL = W * 0.14
        const roadW = W * 0.72
        ctx.fillStyle = '#736c8a'
        ctx.fillRect(roadL, 0, roadW, H)
        // Yol şeritleri
        ctx.strokeStyle = 'rgba(255,244,210,0.7)'
        ctx.lineWidth = 4
        ctx.setLineDash([22, 22])
        ctx.lineDashOffset = -(dist * 6)
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath()
          ctx.moveTo(roadL + (roadW * i) / 4, 0)
          ctx.lineTo(roadL + (roadW * i) / 4, H)
          ctx.stroke()
        }
        ctx.setLineDash([])

        // Engeller ve turbo şeritleri
        for (const o of obs) {
          const ox = o.x * W, oy = o.y * H
          if (o.kind === 'turbo') {
            ctx.fillStyle = '#ffe066'
            ctx.beginPath()
            ctx.roundRect(ox - 20, oy - 16, 40, 32, 8)
            ctx.fill()
            ctx.font = '900 18px Nunito, sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('⚡', ox, oy)
          } else if (o.kind === 'cone') {
            ctx.fillStyle = '#ff7b54'
            ctx.beginPath()
            ctx.moveTo(ox, oy - 18)
            ctx.lineTo(ox + 16, oy + 14)
            ctx.lineTo(ox - 16, oy + 14)
            ctx.closePath()
            ctx.fill()
          } else {
            ctx.fillStyle = '#6ec6f5'
            ctx.beginPath()
            ctx.ellipse(ox, oy, 22, 13, 0, 0, Math.PI * 2)
            ctx.fill()
          }
        }

        // Bisikletçi
        const bx = x * W, by = H * 0.78
        ctx.save()
        ctx.translate(bx, by)
        ctx.rotate(vx * 0.35)
        ctx.fillStyle = '#2d253d'
        ctx.fillRect(-4, -28, 8, 56)
        ctx.fillStyle = turboT > 0 ? '#ffe066' : '#fdb252'
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.roundRect(-14, -14, 28, 28, 12)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = '#5fc0ea'
        ctx.beginPath()
        ctx.arc(0, -14, 10, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()

        if (now - lastHud > 80) {
          lastHud = now
          setHud({ score: Math.round(dist + bonus), speed: +(spd * 2).toFixed(1), turbo: turboT > 0 })
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [seed, onFinish])

  const setPtr = (e) => {
    const r = cvRef.current?.getBoundingClientRect()
    if (!r) return
    inputRef.current.px = Math.max(0.18, Math.min(0.82, (e.clientX - r.left) / r.width))
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#a8e3bd] select-none touch-none">
      <div className="flex items-center justify-between bg-white/95 px-4 py-2.5 shadow-soft">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#fff3c8] px-3 py-1 text-xs font-black text-[#8a5a00]">🚲 {hud.score} puan</span>
          {hud.turbo && <span className="rounded-full bg-[#ffe066] px-3 py-1 text-xs font-black text-[#7a5200]">⚡ TURBO!</span>}
        </div>
        <button type="button" onClick={onExit} className="rounded-full bg-[#ffe8e8] px-3 py-1 text-xs font-black text-[#b54141]">Çık ✖️</button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <canvas
          ref={cvRef}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setPtr(e) }}
          onPointerMove={(e) => { if (e.buttons > 0 || e.pointerType === 'touch') setPtr(e) }}
          onPointerUp={() => { inputRef.current.px = null }}
          className="block h-full w-full"
        />
        <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/85 px-4 py-1 text-xs font-extrabold text-[#4a3b5c]">
          {touch ? 'Parmağınla yönlendir · ⚡ şeritleri topla!' : 'A / D veya ← → ile engellerden kaç!'}
        </p>
      </div>
    </div>
  )
}
