// 5 yüksek kaliteli, 60 FPS animasyonlu mini oyun arenası (masaüstü + mobil dokunmatik uyumlu):
//   RhythmArena (Kulüp Babil), ColorTilesArena (Playstasyon), BaristaArena (Kafe/Tatlı), BikeSprintArena (Park), BalloonPopArena (Lobi)
import { useEffect, useRef, useState } from 'react'

function makeRng(seed) {
  let s = (seed >>> 0) || 424242
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

// ======================= 1. RİTİM & DANS SAVAŞI (KULÜP BABİL) =======================
const LANES = [
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
        <button type="button" onClick={onExit} className="rounded-full bg-[#ffe8e8] px-3 py-1 text-xs font-black text-[#b54141]">Çık ✕</button>
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

// ======================= 2. RENK KAROSU — DÜŞMEDEN KAL! (PLAYSTASYON) =======================
const TILE_COLORS = [
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
        <button type="button" onClick={onExit} className="rounded-full bg-[#ffe8e8] px-3 py-1 text-xs font-black text-[#b54141]">Çık ✕</button>
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

// ======================= 3. BARİSTA SİPARİŞ YARIŞI (KAFE / TATLI) =======================
const INGS = [
  { id: 'esp', label: 'Espresso', emoji: '☕', color: '#6b4226' },
  { id: 'milk', label: 'Süt', emoji: '🥛', color: '#fff8ee' },
  { id: 'straw', label: 'Çilek', emoji: '🍓', color: '#ff9ec7' },
  { id: 'matcha', label: 'Matcha', emoji: '🍵', color: '#8fdcb4' },
  { id: 'caramel', label: 'Karamel', emoji: '🍯', color: '#f3b659' },
  { id: 'cream', label: 'Krema', emoji: '🍦', color: '#efe2ff' },
]

function nextOrder(rng, count) {
  const len = count > 4 ? 4 : 3
  return Array.from({ length: len }, () => INGS[Math.floor(rng() * INGS.length)])
}

export function BaristaArena({ seed, onFinish, onExit }) {
  const rngRef = useRef(makeRng(seed))
  const [order, setOrder] = useState(() => nextOrder(rngRef.current, 0))
  const [cup, setCup] = useState([])
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [left, setLeft] = useState(40)
  const [msg, setMsg] = useState('Siparişi alttan üste doğru hazırla!')
  const scoreRef = useRef(0)

  useEffect(() => {
    const id = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          clearInterval(id)
          onFinish(scoreRef.current, 40_000)
          return 0
        }
        return l - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [onFinish])

  const pickIng = (ing) => {
    if (left <= 0) return
    const want = order[cup.length]
    if (want.id === ing.id) {
      const next = [...cup, ing]
      window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
      if (next.length === order.length) {
        const pts = 100 + streak * 25
        scoreRef.current += pts
        setScore(scoreRef.current)
        setStreak((s) => s + 1)
        setMsg(`✨ Harika! +${pts} puan!`)
        setCup([])
        setOrder(nextOrder(rngRef.current, streak + 1))
      } else {
        setCup(next)
      }
    } else {
      setStreak(0)
      setCup([])
      setMsg('Yanlış katman! Bardak sıfırlandı 😅')
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#3a2a45]/60 p-4 backdrop-blur-sm">
      <div className="flex w-[min(94vw,28rem)] animate-pop flex-col items-center rounded-[2rem] border-2 border-white bg-[#fffaf4] p-5 shadow-toy">
        <div className="flex w-full items-center justify-between">
          <div className="flex gap-2">
            <span className="rounded-full bg-[#fff3c8] px-3 py-1 text-xs font-black text-[#8a5a00]">☕ {score} puan</span>
            <span className="rounded-full bg-[#dff3ff] px-3 py-1 text-xs font-black text-[#12688a]">⏱ {left} sn</span>
          </div>
          <button type="button" onClick={onExit} className="rounded-full bg-[#ffe8e8] px-3 py-1 text-xs font-black text-[#b54141]">Çık ✕</button>
        </div>

        <p className="mt-3 text-xs font-extrabold text-[#8a7a9c]">{msg}</p>

        {/* Hedef Sipariş + Canlı Dolum Bardağı */}
        <div className="mt-3 flex w-full items-end justify-center gap-6">
          <div className="flex flex-col items-center">
            <span className="mb-1 text-[11px] font-black text-[#8a7a9c]">MÜŞTERİ SİPARİŞİ</span>
            <div className="flex h-36 w-24 flex-col-reverse overflow-hidden rounded-b-3xl rounded-t-xl border-4 border-white bg-[#f3ece4] shadow-inner">
              {order.map((ing, i) => (
                <div key={i} className="flex flex-1 items-center justify-center text-xs font-black text-[#4a3b5c]" style={{ background: ing.color }}>
                  {ing.emoji}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center">
            <span className="mb-1 text-[11px] font-black text-[#e8952c]">SENİN BARDAĞIN</span>
            <div className="flex h-36 w-24 flex-col-reverse overflow-hidden rounded-b-3xl rounded-t-xl border-4 border-[#fdb252] bg-white shadow-soft">
              {cup.map((ing, i) => (
                <div key={i} className="flex h-1/3 animate-pop items-center justify-center text-sm" style={{ background: ing.color }}>
                  {ing.emoji}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 grid w-full grid-cols-3 gap-2">
          {INGS.map((ing) => (
            <button
              key={ing.id}
              type="button"
              onPointerDown={(e) => { e.preventDefault(); pickIng(ing) }}
              className="flex flex-col items-center gap-1 rounded-2xl border-2 border-white bg-white py-3 text-xs font-black text-[#4a3b5c] shadow-soft transition active:scale-95"
            >
              <span className="text-2xl">{ing.emoji}</span>
              <span>{ing.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

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
        <button type="button" onClick={onExit} className="rounded-full bg-[#ffe8e8] px-3 py-1 text-xs font-black text-[#b54141]">Çık ✕</button>
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
        <button type="button" onClick={onExit} className="rounded-full bg-[#ffe8e8] px-3 py-1 text-xs font-black text-[#b54141]">Çık ✕</button>
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
