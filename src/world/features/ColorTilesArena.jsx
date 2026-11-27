// Renkli fayans mini oyunu arenası.
import { useEffect, useRef, useState } from 'react'
import { makeRng } from './minigameShared'
// ======================= 2. RENK KAROSU — DÜŞMEDEN KAL! (PLAYSTASYON) =======================
export const TILE_COLORS = [
  { id: 0, name: 'PEMBE', bg: '#ff9ec7', border: '#ff6ba8' },
  { id: 1, name: 'MİNT', bg: '#8fdcb4', border: '#4cc48a' },
  { id: 2, name: 'ALTIN', bg: '#ffd35e', border: '#f0a51a' },
  { id: 3, name: 'LİLA', bg: '#b79cff', border: '#8763f5' },
]

export function ColorTilesArena({ seed, touch, onFinish, onExit }) {
  const cvRef = useRef(null)
  const inputRef = useRef({ l: false, r: false, u: false, d: false, px: null, py: null })
  const [hud, setHud] = useState({ round: 1, target: TILE_COLORS[0], phase: 'warn', time: 2.5, alive: 5 })

  useEffect(() => {
    const onD = (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') inputRef.current.l = true
      if (e.code === 'ArrowRight' || e.code === 'KeyD') inputRef.current.r = true
      if (e.code === 'ArrowUp' || e.code === 'KeyW') inputRef.current.u = true
      if (e.code === 'ArrowDown' || e.code === 'KeyS') inputRef.current.d = true
    }
    const onU = (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') inputRef.current.l = false
      if (e.code === 'ArrowRight' || e.code === 'KeyD') inputRef.current.r = false
      if (e.code === 'ArrowUp' || e.code === 'KeyW') inputRef.current.u = false
      if (e.code === 'ArrowDown' || e.code === 'KeyS') inputRef.current.d = false
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
    const makeGrid = () => Array.from({ length: 16 }, () => Math.floor(rng() * 4))
    let grid = makeGrid()
    let target = Math.floor(rng() * 4)
    let round = 1
    let phase = 'warn' // warn | drop
    let phaseT = 2.6
    let done = false
    const startMs = performance.now()
    const players = [
      { id: 'me', name: 'Sen', x: 0.5, y: 0.5, alive: true, me: true, c: '#ffffff' },
      { id: 'b1', name: 'Mert', x: 0.25, y: 0.25, alive: true, skill: 0.85, c: '#ff9ec7' },
      { id: 'b2', name: 'Ece', x: 0.75, y: 0.25, alive: true, skill: 0.78, c: '#7fcdf3' },
      { id: 'b3', name: 'Can', x: 0.25, y: 0.75, alive: true, skill: 0.7, c: '#ffd35e' },
      { id: 'b4', name: 'Su', x: 0.75, y: 0.75, alive: true, skill: 0.65, c: '#8fdcb4' },
    ]
    let prev = performance.now()
    let lastHud = 0
    let raf = 0

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

      // Oyuncu hareketi
      const me = players[0]
      if (me.alive && !done) {
        let dx = 0, dy = 0
        if (inputRef.current.px !== null) {
          dx = (inputRef.current.px - me.x) * 4
          dy = (inputRef.current.py - me.y) * 4
        } else {
          if (inputRef.current.l) dx -= 1
          if (inputRef.current.r) dx += 1
          if (inputRef.current.u) dy -= 1
          if (inputRef.current.d) dy += 1
        }
        const len = Math.hypot(dx, dy)
        if (len > 1) { dx /= len; dy /= len }
        me.x = Math.max(0.06, Math.min(0.94, me.x + dx * 0.55 * dt))
        me.y = Math.max(0.06, Math.min(0.94, me.y + dy * 0.55 * dt))
      }

      // Bot hareketi (en yakın hedef renk karosuna koşar)
      for (const b of players) {
        if (b.me || !b.alive) continue
        let bx = b.x, by = b.y, bestD = 9
        for (let i = 0; i < 16; i++) {
          if (grid[i] !== target) continue
          const cx = ((i % 4) + 0.5) / 4
          const cy = (Math.floor(i / 4) + 0.5) / 4
          const d = Math.hypot(cx - b.x, cy - b.y)
          if (d < bestD) { bestD = d; bx = cx; by = cy }
        }
        const dx = bx - b.x, dy = by - b.y
        const len = Math.hypot(dx, dy) || 1
        if (len > 0.03) {
          b.x += (dx / len) * 0.44 * b.skill * dt
          b.y += (dy / len) * 0.44 * b.skill * dt
        }
      }

      // Tur zamanlayıcı
      phaseT -= dt
      if (phaseT <= 0 && !done) {
        if (phase === 'warn') {
          phase = 'drop'
          phaseT = 1.35
          // Hedef renkte olmayanlar düşer!
          for (const p of players) {
            if (!p.alive) continue
            const col = Math.min(3, Math.floor(p.x * 4))
            const row = Math.min(3, Math.floor(p.y * 4))
            if (grid[row * 4 + col] !== target) {
              p.alive = false
              if (p.me) window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
            }
          }
          const aliveCnt = players.filter((p) => p.alive).length
          if (!me.alive || aliveCnt <= 1 || round >= 10) {
            done = true
            const score = round * 120 + (me.alive ? 250 : 0)
            setTimeout(() => onFinish(score, Math.round(now - startMs)), 700)
          }
        } else {
          round++
          grid = makeGrid()
          target = Math.floor(rng() * 4)
          phase = 'warn'
          phaseT = Math.max(1.25, 2.6 - round * 0.14)
        }
      }

      // Çizim
      ctx.fillStyle = '#1f163b'
      ctx.fillRect(0, 0, W, H)
      const sz = Math.min(W, H) * 0.88
      const ox = (W - sz) / 2
      const oy = (H - sz) / 2
      const cell = sz / 4

      for (let i = 0; i < 16; i++) {
        const c = i % 4
        const r = Math.floor(i / 4)
        const tc = TILE_COLORS[grid[i]]
        if (phase === 'drop' && grid[i] !== target) continue
        const shake = phase === 'warn' && phaseT < 0.7 && grid[i] !== target ? (Math.random() - 0.5) * 4 : 0
        ctx.fillStyle = tc.bg
        ctx.strokeStyle = tc.border
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.roundRect(ox + c * cell + 5 + shake, oy + r * cell + 5 + shake, cell - 10, cell - 10, 14)
        ctx.fill()
        ctx.stroke()
      }

      for (const p of players) {
        if (!p.alive) continue
        const px = ox + p.x * sz
        const py = oy + p.y * sz
        ctx.fillStyle = p.me ? '#4a3b5c' : p.c
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 3.5
        ctx.beginPath()
        ctx.arc(px, py, p.me ? 16 : 13, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.font = '900 11px Nunito, sans-serif'
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.fillText(p.name, px, py - 21)
      }

      if (now - lastHud > 80) {
        lastHud = now
        setHud({ round, target: TILE_COLORS[target], phase, time: Math.max(0, phaseT), alive: players.filter((p) => p.alive).length })
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [seed, onFinish])

  const setPtr = (e) => {
    const r = cvRef.current?.getBoundingClientRect()
    if (!r) return
    const sz = Math.min(r.width, r.height) * 0.88
    const ox = (r.width - sz) / 2
    const oy = (r.height - sz) / 2
    inputRef.current.px = Math.max(0.05, Math.min(0.95, (e.clientX - r.left - ox) / sz))
    inputRef.current.py = Math.max(0.05, Math.min(0.95, (e.clientY - r.top - oy) / sz))
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1f163b] select-none touch-none">
      <div className="flex items-center justify-between gap-2 bg-white/95 px-4 py-2.5 shadow-soft">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#f3e8ff] px-3 py-1 text-xs font-black text-[#5b3fa8]">Tur {hud.round}</span>
          <span className="rounded-full px-3.5 py-1 text-xs font-black text-[#4a3b5c] shadow-sm" style={{ background: hud.target.bg }}>
            🎯 {hud.target.name} KAROSUNA KOŞ! ({hud.time.toFixed(1)}s)
          </span>
          <span className="hidden rounded-full bg-[#dff3ff] px-3 py-1 text-xs font-black text-[#12688a] sm:inline-block">👥 {hud.alive}/5</span>
        </div>
        <button type="button" onClick={onExit} className="rounded-full bg-[#ffe8e8] px-3 py-1 text-xs font-black text-[#b54141]">Çık ✖️</button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <canvas
          ref={cvRef}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setPtr(e) }}
          onPointerMove={(e) => { if (e.buttons > 0 || e.pointerType === 'touch') setPtr(e) }}
          onPointerUp={() => { inputRef.current.px = null; inputRef.current.py = null }}
          className="block h-full w-full"
        />
        <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/85 px-4 py-1 text-xs font-extrabold text-[#4a3b5c]">
          {touch ? 'Parmağınla hedef renge sürükle!' : 'WASD veya ok tuşlarıyla hedef renge koş!'}
        </p>
      </div>
    </div>
  )
}
