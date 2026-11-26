// Sörf Yarışı — Dalgalardan Kaç! (2–10 oyunculu gerçek zamanlı + tek kişilik bot antrenmanı + genel puan tablosu).
// Sörfçü Kaan'dan (Quicksörf) açılır. Sörf sırasında 3B avatar geçici olarak sörf kıyafetine (turkuaz wetsuit + gözlük) geçer.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Ico } from '../../components/Icon'
import { cosStore } from '../cosStore'

const LOCAL_BOARD_KEY = 'situapp_surf_board_v1'
const BOARD_STYLES = [
  { board: '#ff8fb8', stripe: '#fff8ee', suit: '#1ea8c7', shorts: '#ffd35e', hair: '#4a3326' },
  { board: '#7fcdf3', stripe: '#ffe48f', suit: '#ff7b6b', shorts: '#4a3b5c', hair: '#2a2230' },
  { board: '#8fdcb4', stripe: '#ffffff', suit: '#7a5fd0', shorts: '#fec172', hair: '#7c4d2e' },
  { board: '#ffd35e', stripe: '#ff8fb8', suit: '#2bb89a', shorts: '#3b4a6b', hair: '#c98a3b' },
  { board: '#b79cff', stripe: '#fff3c4', suit: '#f2785c', shorts: '#2e6f95', hair: '#3a2a22' },
  { board: '#fdb252', stripe: '#ffffff', suit: '#3a8fd6', shorts: '#ff9ec7', hair: '#5a3a26' },
]

const BOT_NAMES = ['Dalga Ece', 'Köpük Mert', 'Mercan Su', 'Rüzgar Alp']

function makeRng(seed) {
  let s = (seed >>> 0) || 1234567
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function fmtSec(ms) {
  return `${(Math.max(0, ms) / 1000).toFixed(1)} sn`
}

function loadLocalBoard() {
  try {
    const arr = JSON.parse(localStorage.getItem(LOCAL_BOARD_KEY))
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function saveLocalScore(name, pts, won, ms) {
  try {
    const list = loadLocalBoard()
    const key = name || 'Sen'
    const idx = list.findIndex((r) => r.name === key)
    if (idx >= 0) {
      list[idx].points += pts
      list[idx].games += 1
      if (won) list[idx].wins += 1
      list[idx].bestMs = Math.max(list[idx].bestMs, Math.round(ms))
    } else {
      list.push({ key, name: key, points: pts, wins: won ? 1 : 0, games: 1, bestMs: Math.round(ms) })
    }
    list.sort((a, b) => b.points - a.points || b.wins - a.wins || b.bestMs - a.bestMs)
    localStorage.setItem(LOCAL_BOARD_KEY, JSON.stringify(list.slice(0, 15)))
    return list.slice(0, 15)
  } catch {
    return []
  }
}

const MAX_LIVES = 2
const JUMP_CD = 1.8

/** 60 FPS perspektif 3B-hissi veren, dinamik okyanus & animasyonlu sörf arenası. */
function SurfArena({ match, selfId, selfName, touch, remoteRef, onSendPos, onLocalOut, onBotFinish, onExit }) {
  const canvasRef = useRef(null)
  const [hud, setHud] = useState({ countdown: 3, alive: match.players.length, total: match.players.length, ms: 0, speedLv: 1, out: false, jumpReady: 1, combo: 0, lives: MAX_LIVES, wind: 0 })
  const inputRef = useRef({ left: false, right: false, pointerX: null, wantJump: false })

  useEffect(() => {
    const onDown = (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') inputRef.current.left = true
      if (e.code === 'ArrowRight' || e.code === 'KeyD') inputRef.current.right = true
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault()
        inputRef.current.wantJump = true
      }
    }
    const onUp = (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') inputRef.current.left = false
      if (e.code === 'ArrowRight' || e.code === 'KeyD') inputRef.current.right = false
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return undefined
    const ctx = cv.getContext('2d')
    const rng = makeRng(match.seed)
    const isPractice = Boolean(match.practice)

    const surfers = match.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      isSelf: p.id === selfId,
      isBot: Boolean(p.isBot),
      style: BOARD_STYLES[i % BOARD_STYLES.length],
      x: p.x ?? 0.5,
      vx: 0,
      tilt: 0,
      jump: 0,
      jumpVel: 0,
      jumpCd: 0,
      spin: 0,
      alive: true,
      lives: MAX_LIVES,
      invuln: 0,
      outMs: 0,
      botTarget: p.x ?? 0.5,
      botSkill: 0.64 + (i % 4) * 0.09,
      wake: [],
    }))
    const me = surfers.find((s) => s.isSelf) ?? surfers[0]
    const outOrder = []
    const waves = []
    const particles = []
    const splashes = []
    const callouts = []
    // Gökyüzü bulutları ve martılar
    const clouds = Array.from({ length: 6 }, (_, i) => ({
      x: (i / 6) * 1.15,
      y: 0.04 + (i % 3) * 0.036,
      s: 0.7 + (i % 3) * 0.35,
      sp: 0.008 + (i % 4) * 0.004,
    }))
    const birds = Array.from({ length: 4 }, (_, i) => ({
      x: 0.15 + i * 0.22,
      y: 0.07 + (i % 2) * 0.04,
      ph: i * 1.7,
      sp: 0.025 + i * 0.006,
    }))
    let nextWaveY = 0
    let waveIdx = 0
    let shake = 0
    let camShift = 0
    let combo = 0
    let lastPosSend = 0
    let lastHud = 0
    let finished = false
    let raf = 0
    let prev = performance.now()
    const matchStart = match.startAt

    // Perspektif izdüşüm: ufuk çizgisinden (y=0) sörfçüye (y=0.78) doğru derinlik ve ölçek kazanır
    const proj = (nx, ny, W, H, camX) => {
      const horizonY = H * 0.21
      const depth = Math.max(0, Math.min(1.25, ny))
      const persp = Math.pow(Math.max(0, depth), 1.38) // ufukta sıkışık, yakında hızlı akış
      const sy = horizonY + persp * (H - horizonY)
      const scale = 0.28 + persp * 0.86
      const cx = W * 0.5 - camX * W * 0.14 * scale
      const sx = cx + (nx - 0.5) * W * (0.42 + persp * 0.68)
      return { x: sx, y: sy, s: scale, persp }
    }

    const spawnSpray = (x, y, vx, vy, n = 6, color = 'rgba(255,255,255,0.92)') => {
      for (let i = 0; i < n; i++) {
        particles.push({
          x,
          y,
          vx: vx + (Math.random() - 0.5) * 110,
          vy: vy + (Math.random() - 0.5) * 80 - 20,
          r: 2 + Math.random() * 5,
          life: 0.35 + Math.random() * 0.45,
          maxLife: 0.8,
          color,
        })
      }
    }

    const addCallout = (text, x, y, color = '#ffe48f') => {
      callouts.push({ text, x, y, vy: -52, life: 1.05, maxLife: 1.05, color })
    }

    const spawnWave = (elapsedSec) => {
      waveIdx++
      // Daha uzun ve kademeli zorlaşan parkur: daralan geçişler, kayan kanallar ve tam en zıplama dalgaları
      const gapW = Math.max(0.135, 0.255 - elapsedSec * 0.0022)
      const isJumpWall = elapsedSec >= 16 && waveIdx % 6 === 0
      const doubleGap = !isJumpWall && waveIdx % 4 === 0 && elapsedSec > 8
      const gaps = []
      if (!isJumpWall) {
        if (doubleGap) {
          const g1 = 0.1 + rng() * 0.24
          const g2 = 0.58 + rng() * 0.22
          gaps.push([g1, g1 + gapW * 0.84], [g2, g2 + gapW * 0.84])
        } else {
          const g = 0.07 + rng() * (0.86 - gapW)
          gaps.push([g, g + gapW])
        }
      }
      // 12. saniyeden sonra bazı dalgaların güvenli geçişi yanlara doğru kayar
      const canDrift = !isJumpWall && !doubleGap && elapsedSec >= 12 && waveIdx % 2 === 1
      const driftSpeed = canDrift ? (rng() < 0.5 ? -1 : 1) * (0.07 + Math.min(0.12, elapsedSec * 0.0018)) : 0
      waves.push({
        id: waveIdx,
        y: 0.01,
        h: isJumpWall ? 0.056 : 0.066 + rng() * 0.018,
        gaps,
        jumpWall: isJumpWall,
        driftSpeed,
        phase: rng() * Math.PI * 2,
        cleared: false,
        crestColor: isJumpWall ? '#e65c4f' : waveIdx % 3 === 0 ? '#1ea9c9' : '#1390b5',
      })
    }

    const drawSkyAndHorizon = (W, H, time, camX) => {
      const horizonY = H * 0.21
      // Tropikal gökyüzü gradyanı (sıcak güneşli ufuk)
      const sky = ctx.createLinearGradient(0, 0, 0, horizonY)
      sky.addColorStop(0, '#5ec2f2')
      sky.addColorStop(0.55, '#a4e3ff')
      sky.addColorStop(1, '#fff1cf')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, horizonY + 2)

      // Parlayan güneş + ışık halesi
      const sunX = W * 0.5 - camX * W * 0.04
      const sunY = horizonY * 0.62
      const halo = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, Math.min(W, H) * 0.26)
      halo.addColorStop(0, 'rgba(255, 250, 224, 0.98)')
      halo.addColorStop(0.22, 'rgba(255, 228, 152, 0.65)')
      halo.addColorStop(0.6, 'rgba(255, 214, 130, 0.16)')
      halo.addColorStop(1, 'rgba(255, 214, 130, 0)')
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(sunX, sunY, Math.min(W, H) * 0.26, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff9df'
      ctx.beginPath()
      ctx.arc(sunX, sunY, 22, 0, Math.PI * 2)
      ctx.fill()

      // Yumuşak pastel bulutlar
      for (const c of clouds) {
        const cx = (((c.x + time * c.sp) % 1.25) - 0.12) * W - camX * W * 0.03
        const cy = c.y * H
        const r = 18 * c.s
        ctx.fillStyle = 'rgba(255, 255, 255, 0.82)'
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.arc(cx + r * 0.9, cy - r * 0.2, r * 0.85, 0, Math.PI * 2)
        ctx.arc(cx + r * 1.7, cy + r * 0.08, r * 0.72, 0, Math.PI * 2)
        ctx.fill()
      }

      // Uzak tropikal adalar (paralaks siluet)
      const drawIsland = (ix, iw, ih, col) => {
        const x = ix * W - camX * W * 0.06
        ctx.fillStyle = col
        ctx.beginPath()
        ctx.moveTo(x - iw, horizonY + 1)
        ctx.quadraticCurveTo(x, horizonY - ih, x + iw, horizonY + 1)
        ctx.closePath()
        ctx.fill()
      }
      drawIsland(0.16, W * 0.14, 24, '#7ac6c9')
      drawIsland(0.84, W * 0.16, 28, '#6bbbc2')
      drawIsland(0.28, W * 0.09, 14, '#8ed4d1')

      // Süzülen martılar
      ctx.strokeStyle = 'rgba(74, 59, 92, 0.45)'
      ctx.lineWidth = 1.8
      ctx.lineCap = 'round'
      for (const bd of birds) {
        const bx = (((bd.x + time * bd.sp) % 1.2) - 0.1) * W
        const by = bd.y * H + Math.sin(time * 3 + bd.ph) * 4
        const flap = Math.sin(time * 8 + bd.ph) * 4
        ctx.beginPath()
        ctx.moveTo(bx - 7, by + flap)
        ctx.quadraticCurveTo(bx - 3, by - 3, bx, by)
        ctx.quadraticCurveTo(bx + 3, by - 3, bx + 7, by + flap)
        ctx.stroke()
      }

      // Okyanus taban gradyanı (ufukta açık camgöbeği, önde canlı turkuaz)
      const sea = ctx.createLinearGradient(0, horizonY, 0, H)
      sea.addColorStop(0, '#49c8e6')
      sea.addColorStop(0.25, '#25a7cf')
      sea.addColorStop(0.65, '#198cb8')
      sea.addColorStop(1, '#116d96')
      ctx.fillStyle = sea
      ctx.fillRect(0, horizonY, W, H - horizonY)

      // Güneşin sudaki parıltı yolu
      for (let i = 0; i < 16; i++) {
        const f = i / 16
        const sy = horizonY + 4 + Math.pow(f, 1.55) * (H - horizonY) * 0.85
        const sw = (20 + f * 95) * (0.75 + 0.25 * Math.sin(time * 4 + i * 1.3))
        ctx.fillStyle = `rgba(255, 246, 205, ${(0.34 * (1 - f * 0.72)).toFixed(2)})`
        ctx.beginPath()
        ctx.roundRect(sunX - sw / 2 + Math.sin(time * 2.4 + i) * 10 * f, sy, sw, 2.5 + f * 3.5, 4)
        ctx.fill()
      }

      // Perspektif akıntı şeritleri ve su parıltıları
      const lanes = 7
      for (let i = 0; i < lanes; i++) {
        const lx = 0.08 + (i / (lanes - 1)) * 0.84
        const p0 = proj(lx, 0.02, W, H, camX)
        const p1 = proj(lx, 1.05, W, H, camX)
        ctx.strokeStyle = 'rgba(180, 245, 255, 0.11)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(p0.x, p0.y)
        ctx.lineTo(p1.x, p1.y)
        ctx.stroke()
      }

      // Akan dalgacık çizgileri (hız hissiyatı)
      const rippleRows = 12
      for (let i = 0; i < rippleRows; i++) {
        const ny = ((i / rippleRows) + (time * 0.34)) % 1
        const pr = proj(0.5, ny, W, H, camX)
        const alpha = Math.sin(ny * Math.PI) * 0.22
        ctx.strokeStyle = `rgba(215, 250, 255, ${alpha.toFixed(2)})`
        ctx.lineWidth = 1 + pr.s * 2
        ctx.beginPath()
        for (let k = 0; k <= 12; k++) {
          const pt = proj(k / 12, ny, W, H, camX)
          const yy = pt.y + Math.sin(k * 1.4 + time * 4 + i) * 2.5 * pr.s
          if (k === 0) ctx.moveTo(pt.x, yy)
          else ctx.lineTo(pt.x, yy)
        }
        ctx.stroke()
      }
    }

    const drawSurfer = (s, W, H, time, camX) => {
      const base = proj(s.x, 0.78, W, H, camX)
      const px = base.x
      const baseY = base.y
      const jumpLift = s.jump * 64 * base.s
      const bob = Math.sin(time * 5.6 + s.x * 9) * 3.2 * base.s
      const py = baseY + bob - jumpLift

      // İkili köpük izi (V-wake: sağ/sol kenardan açılan profesyonel sörf izi)
      if (s.wake.length > 2) {
        for (const side of [-1, 1]) {
          for (let i = 1; i < s.wake.length; i++) {
            const a = proj(s.wake[i - 1].x, s.wake[i - 1].y, W, H, camX)
            const b = proj(s.wake[i].x, s.wake[i].y, W, H, camX)
            const frac = i / s.wake.length
            const spreadA = (1 - frac) * 22 * a.s * side
            const spreadB = (1 - frac) * 22 * b.s * side
            ctx.strokeStyle = `rgba(230, 252, 255, ${(frac * 0.55).toFixed(2)})`
            ctx.lineWidth = Math.max(1.5, frac * 11 * b.s)
            ctx.lineCap = 'round'
            ctx.beginPath()
            ctx.moveTo(a.x + spreadA, a.y + 14 * a.s)
            ctx.lineTo(b.x + spreadB, b.y + 14 * b.s)
            ctx.stroke()
          }
        }
      }

      // Suda yumuşak gölge + temas köpük halkası
      ctx.save()
      ctx.translate(px, baseY + bob + 16 * base.s)
      const shScale = Math.max(0.45, 1 - s.jump * 0.42) * base.s
      ctx.fillStyle = `rgba(8, 56, 84, ${(0.34 * shScale).toFixed(2)})`
      ctx.beginPath()
      ctx.ellipse(0, 0, 20 * shScale, 11 * shScale, 0, 0, Math.PI * 2)
      ctx.fill()
      if (s.jump < 0.08) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)'
        ctx.lineWidth = 2.2
        ctx.beginPath()
        ctx.ellipse(0, 4, 22 * base.s, 9 * base.s, 0, 0, Math.PI)
        ctx.stroke()
      }
      ctx.restore()

      // Sörf tahtası + stilize karakter (hasar sonrası kısa dokunulmazlık yanıp sönmesi)
      ctx.save()
      if (s.invuln > 0 && Math.floor(time * 16) % 2 === 0) ctx.globalAlpha = 0.45
      ctx.translate(px, py)
      const airSpin = s.jump > 0.02 ? s.spin : 0
      ctx.rotate(s.tilt * 0.44 + airSpin)
      const sc = base.s * (1.06 + s.jump * 0.28)
      ctx.scale(sc, sc)

      // Havadayken altın-turkuaz sıçrama halesi
      if (s.jump > 0.12) {
        const gAura = ctx.createRadialGradient(0, 0, 6, 0, 0, 44)
        gAura.addColorStop(0, 'rgba(255, 236, 153, 0.45)')
        gAura.addColorStop(1, 'rgba(127, 230, 255, 0)')
        ctx.fillStyle = gAura
        ctx.beginPath()
        ctx.arc(0, 0, 44, 0, Math.PI * 2)
        ctx.fill()
      }

      // Sörf tahtası (3B parlak gradyan + kuyruk yüzgeci + beyaz parıltı)
      const bGrad = ctx.createLinearGradient(-16, -34, 16, 32)
      bGrad.addColorStop(0, '#ffffff')
      bGrad.addColorStop(0.22, s.style.board)
      bGrad.addColorStop(1, s.style.board)
      ctx.fillStyle = bGrad
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2.6
      ctx.beginPath()
      ctx.moveTo(0, -37)
      ctx.bezierCurveTo(18, -19, 17, 19, 9, 31)
      ctx.quadraticCurveTo(0, 36, -9, 31)
      ctx.bezierCurveTo(-17, 19, -18, -19, 0, -37)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      // Tahta yarış şeridi + kaymaz ped
      ctx.fillStyle = s.style.stripe
      ctx.beginPath()
      ctx.roundRect(-3.2, -28, 6.4, 56, 3)
      ctx.fill()
      ctx.fillStyle = 'rgba(42, 34, 56, 0.24)'
      ctx.beginPath()
      ctx.roundRect(-7, 14, 14, 12, 4)
      ctx.fill()

      // Atletik sörf duruşu (bükülü dizler, yana yaslı gövde, eklemli denge kolları)
      const lean = s.tilt * 8
      const crouch = s.jump > 0.05 ? 4 : 0
      // Bacaklar & şort
      ctx.strokeStyle = '#f2be9a'
      ctx.lineWidth = 5.5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-5 + lean * 0.3, 1 + crouch)
      ctx.lineTo(-9 + lean * 0.15, 13)
      ctx.moveTo(5 + lean * 0.3, -1 + crouch)
      ctx.lineTo(8 + lean * 0.15, 11)
      ctx.stroke()
      ctx.fillStyle = s.style.shorts
      ctx.beginPath()
      ctx.roundRect(-10 + lean * 0.35, -5 + crouch, 20, 10, 4)
      ctx.fill()

      // Gövde (parlak wetsuit)
      const sGrad = ctx.createLinearGradient(-10, -22, 10, 0)
      sGrad.addColorStop(0, s.style.suit)
      sGrad.addColorStop(1, '#184b68')
      ctx.fillStyle = sGrad
      ctx.beginPath()
      ctx.roundRect(-10.5 + lean * 0.55, -21 + crouch, 21, 18, 8)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.beginPath()
      ctx.roundRect(-8 + lean * 0.55, -16 + crouch, 16, 3.8, 2)
      ctx.fill()

      // Eklemli denge kolları (dirsek + el)
      const armWave = Math.sin(time * 8 + s.x * 12) * 2.5
      ctx.strokeStyle = s.style.suit
      ctx.lineWidth = 5.2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      // sol kol
      ctx.moveTo(-9 + lean * 0.55, -15 + crouch)
      ctx.lineTo(-18 + lean * 0.45, -13 - s.tilt * 7 + armWave + crouch)
      ctx.lineTo(-25 + lean * 0.35, -18 - s.tilt * 10 - armWave + crouch)
      // sağ kol
      ctx.moveTo(9 + lean * 0.55, -15 + crouch)
      ctx.lineTo(18 + lean * 0.45, -13 + s.tilt * 7 - armWave + crouch)
      ctx.lineTo(25 + lean * 0.35, -18 + s.tilt * 10 + armWave + crouch)
      ctx.stroke()

      // Baş + rüzgârda uçuşan saç + parlak güneş gözlüğü
      const hx = lean * 0.65
      const hy = -28 + crouch
      ctx.fillStyle = '#f6c8a8'
      ctx.beginPath()
      ctx.arc(hx, hy, 10, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = s.style.hair
      ctx.beginPath()
      ctx.arc(hx, hy - 2, 10.4, Math.PI * 0.9, Math.PI * 2.12)
      ctx.fill()
      // Uçuşan saç tutamları
      ctx.strokeStyle = s.style.hair
      ctx.lineWidth = 3.2
      ctx.beginPath()
      ctx.moveTo(hx - 6, hy - 7)
      ctx.quadraticCurveTo(hx - 12 - s.tilt * 5, hy - 12 + Math.sin(time * 14) * 2, hx - 14 - s.tilt * 7, hy - 6)
      ctx.stroke()
      // Güneş gözlüğü + beyaz parlama
      ctx.fillStyle = '#241b35'
      ctx.beginPath()
      ctx.roundRect(hx - 7.5, hy - 1.5, 6.4, 4.4, 2)
      ctx.roundRect(hx + 1.1, hy - 1.5, 6.4, 4.4, 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      ctx.fillRect(hx - 6.2, hy - 0.6, 2.2, 1.3)
      ctx.fillRect(hx + 2.4, hy - 0.6, 2.2, 1.3)

      ctx.restore()

      // İsim etiketi
      ctx.save()
      ctx.font = s.isSelf ? '900 12px Nunito, sans-serif' : '800 11px Nunito, sans-serif'
      const lbl = s.isSelf ? `★ ${s.name}` : s.name
      const tw = ctx.measureText(lbl).width + 16
      const tagY = py - 56 * base.s
      ctx.fillStyle = s.isSelf ? 'rgba(255, 243, 196, 0.96)' : 'rgba(255, 255, 255, 0.88)'
      ctx.strokeStyle = s.isSelf ? '#fdb252' : '#ffffff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(px - tw / 2, tagY - 10, tw, 20, 10)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = s.isSelf ? '#8a5a00' : '#4a3b5c'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(lbl, px, tagY)
      ctx.restore()
    }

    const drawWave = (w, W, H, time, camX) => {
      const pTop = proj(0.5, w.y, W, H, camX)
      const pBot = proj(0.5, w.y + w.h, W, H, camX)
      const wy = pTop.y
      const wh = Math.max(8, pBot.y - pTop.y)
      const sc = pTop.s
      const sorted = [...w.gaps].sort((a, b) => a[0] - b[0])
      const segs = []
      let cur = 0
      for (const [g0, g1] of sorted) {
        if (g0 > cur) segs.push([cur, g0])
        cur = Math.max(cur, g1)
      }
      if (cur < 1) segs.push([cur, 1])

      // Güvenli geçiş kanalında parlayan yön okları (veya tam en zıplama duvarı uyarısı)
      if (w.jumpWall) {
        const mid = proj(0.5, w.y + w.h * 0.35, W, H, camX)
        ctx.save()
        ctx.font = `900 ${Math.max(11, Math.round(16 * sc))}px Nunito, sans-serif`
        ctx.textAlign = 'center'
        ctx.strokeStyle = 'rgba(74, 24, 24, 0.8)'
        ctx.lineWidth = 3.5
        ctx.strokeText('⬆ ZIPLA!', mid.x, mid.y - 8 * sc)
        ctx.fillStyle = '#ffe48f'
        ctx.fillText('⬆ ZIPLA!', mid.x, mid.y - 8 * sc)
        ctx.restore()
      }
      for (const [g0, g1] of sorted) {
        const mid = proj((g0 + g1) / 2, w.y + w.h * 0.5, W, H, camX)
        const pulse = 0.35 + 0.35 * Math.sin(time * 7 + w.phase)
        ctx.save()
        ctx.strokeStyle = `rgba(255, 243, 176, ${pulse.toFixed(2)})`
        ctx.lineWidth = Math.max(2, 3.2 * sc)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        const aw = 14 * sc
        const ah = 8 * sc
        ctx.beginPath()
        ctx.moveTo(mid.x - aw, mid.y - ah)
        ctx.lineTo(mid.x, mid.y + ah)
        ctx.lineTo(mid.x + aw, mid.y - ah)
        ctx.stroke()
        ctx.restore()
      }

      // Kıvrılan 3B dalga duvarları
      for (const [s0, s1] of segs) {
        const a = proj(s0, w.y, W, H, camX)
        const b = proj(s1, w.y, W, H, camX)
        const x0 = a.x
        const x1 = b.x
        const sw = x1 - x0
        if (sw < 4) continue

        // Ön su gölgesi
        ctx.fillStyle = 'rgba(7, 54, 82, 0.34)'
        ctx.beginPath()
        ctx.roundRect(x0 - 2, wy + wh * 0.55, sw + 4, wh * 0.85, 16 * sc)
        ctx.fill()

        // Kıvrılan dalga gövdesi (zengin okyanus gradyanı)
        const grad = ctx.createLinearGradient(0, wy - wh * 0.25, 0, wy + wh * 1.05)
        grad.addColorStop(0, '#c8f8ff')
        grad.addColorStop(0.24, '#56d7ee')
        grad.addColorStop(0.62, w.crestColor)
        grad.addColorStop(1, '#0e587d')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.moveTo(x0, wy + wh)
        ctx.quadraticCurveTo(x0 - 4 * sc, wy + wh * 0.2, x0 + 10 * sc, wy)
        const steps = Math.max(4, Math.floor(sw / 26))
        for (let i = 1; i <= steps; i++) {
          const ux = x0 + (i / steps) * sw
          const crest = wy + Math.sin(time * 6.5 + i * 1.4 + w.phase) * 3.5 * sc
          ctx.lineTo(ux, crest)
        }
        ctx.quadraticCurveTo(x1 + 4 * sc, wy + wh * 0.2, x1, wy + wh)
        ctx.closePath()
        ctx.fill()

        // Köpüklü kırılan dalga tepesi (çok katmanlı beyaz köpük)
        const bumps = Math.max(4, Math.floor(sw / (18 * Math.max(0.45, sc))))
        for (let i = 0; i <= bumps; i++) {
          const bx = x0 + (i / bumps) * sw
          const by = wy + 3 * sc + Math.sin(time * 7.5 + i * 1.3 + w.phase) * 3 * sc
          const br = (6.5 + Math.sin(time * 5 + i + w.phase) * 2.2) * sc
          ctx.fillStyle = 'rgba(255, 255, 255, 0.94)'
          ctx.beginPath()
          ctx.arc(bx, by, br, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Kanal kenarlarında su halkalı çizgili şamandıralar
      for (const [g0, g1] of sorted) {
        for (const gn of [g0, g1]) {
          if (gn < 0.03 || gn > 0.97) continue
          const pt = proj(gn, w.y + w.h * 0.45, W, H, camX)
          const by = pt.y + Math.sin(time * 6 + gn * 20) * 3 * sc
          const br = Math.max(4, 9 * sc)
          ctx.strokeStyle = 'rgba(255,255,255,0.55)'
          ctx.lineWidth = 1.6
          ctx.beginPath()
          ctx.ellipse(pt.x, by + br * 0.7, br * 1.4, br * 0.55, 0, 0, Math.PI * 2)
          ctx.stroke()
          ctx.fillStyle = '#ff7b6b'
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = Math.max(1.5, 2.2 * sc)
          ctx.beginPath()
          ctx.arc(pt.x, by, br, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = '#ffe48f'
          ctx.beginPath()
          ctx.arc(pt.x - br * 0.25, by - br * 0.25, br * 0.28, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    const loop = (now) => {
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now
      const time = now / 1000

      const rect = cv.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const W = Math.max(300, Math.floor(rect.width))
      const H = Math.max(260, Math.floor(rect.height))
      if (cv.width !== Math.floor(W * dpr) || cv.height !== Math.floor(H * dpr)) {
        cv.width = Math.floor(W * dpr)
        cv.height = Math.floor(H * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const nowEpoch = Date.now()
      const started = nowEpoch >= matchStart
      const elapsedMs = started ? nowEpoch - matchStart : 0
      const elapsedSec = elapsedMs / 1000
      const speed = 0.27 + Math.min(0.45, elapsedSec * 0.0085)
      // 22. saniyeden sonra periyodik yan akıntı (deterministik: tüm oyuncularda aynı)
      const windPhase = elapsedSec >= 22 ? Math.sin((elapsedSec - 22) * 0.42 + (match.seed % 7)) : 0
      const windForce = Math.abs(windPhase) > 0.55 ? Math.sign(windPhase) * (0.09 + Math.min(0.08, (elapsedSec - 22) * 0.0016)) : 0

      // Yumuşak kamera paralaksı (sörfçünün yatışını takip eder)
      camShift += ((me.x - 0.5) - camShift) * Math.min(1, dt * 4.5)

      // 1. Uzak oyuncuları güncelle (multiplayer)
      if (!isPractice && remoteRef.current) {
        for (const rp of remoteRef.current) {
          const s = surfers.find((x) => x.id === rp.id)
          if (!s || s.isSelf) continue
          s.x += (rp.x - s.x) * Math.min(1, dt * 14)
          s.tilt += (rp.tilt - s.tilt) * Math.min(1, dt * 14)
          s.jump += ((rp.jump ?? 0) - s.jump) * Math.min(1, dt * 16)
          if (s.alive && !rp.alive) {
            s.alive = false
            const sp = proj(s.x, 0.78, W, H, camShift)
            splashes.push({ x: sp.x, y: sp.y, r: 12, life: 0.7 })
            spawnSpray(sp.x, sp.y, 0, -45, 22)
          }
        }
      }

      // 2. Kendi kontrolüm + fizik
      if (started && me.alive && !finished) {
        if (me.invuln > 0) me.invuln = Math.max(0, me.invuln - dt)
        let steer = 0
        if (inputRef.current.pointerX !== null) {
          const diff = inputRef.current.pointerX - me.x
          steer = Math.max(-1, Math.min(1, diff * 7.5))
        } else {
          if (inputRef.current.left) steer -= 1
          if (inputRef.current.right) steer += 1
        }
        const targetVx = steer * 0.78 + (me.jump < 0.05 ? windForce : 0)
        me.vx += (targetVx - me.vx) * Math.min(1, dt * 11)
        me.x = Math.max(0.06, Math.min(0.94, me.x + me.vx * dt))
        me.tilt += (Math.max(-1, Math.min(1, me.vx * 1.9)) - me.tilt) * Math.min(1, dt * 12)

        const mePt = proj(me.x, 0.78, W, H, camShift)
        if (me.jumpCd > 0) me.jumpCd = Math.max(0, me.jumpCd - dt)
        if (inputRef.current.wantJump && me.jump <= 0.001 && me.jumpCd <= 0) {
          me.jumpVel = 3.35
          me.jumpCd = JUMP_CD
          me.spin = 0
          spawnSpray(mePt.x, mePt.y + 18, 0, 50, 14, 'rgba(220,252,255,0.95)')
          window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
        }
        inputRef.current.wantJump = false
        if (me.jump > 0 || me.jumpVel > 0) {
          me.jump += me.jumpVel * dt
          me.jumpVel -= 9.4 * dt
          me.spin += dt * Math.PI * 2.9 // havada şık 360° dönüş
          if (me.jump <= 0) {
            me.jump = 0
            me.jumpVel = 0
            me.spin = 0
            splashes.push({ x: mePt.x, y: mePt.y + 10, r: 8, life: 0.45 })
            spawnSpray(mePt.x, mePt.y + 14, 0, 30, 14)
          }
        }

        if (Math.abs(me.vx) > 0.14 && me.jump < 0.1 && Math.random() < 0.65) {
          spawnSpray(mePt.x - Math.sign(me.vx) * 16, mePt.y + 20, -me.vx * 105, 55, 2, 'rgba(235,253,255,0.92)')
        }

        if (!isPractice && now - lastPosSend > 65) {
          lastPosSend = now
          onSendPos({ x: me.x, tilt: me.tilt, jump: me.jump })
        }
      }

      // 3. Dalgaları üret & ilerlet (kayan geçiş kanalları dahil)
      if (started && !finished) {
        nextWaveY -= speed * dt
        if (nextWaveY <= 0) {
          spawnWave(elapsedSec)
          nextWaveY = Math.max(0.24, 0.48 - elapsedSec * 0.0038)
        }
        for (const w of waves) {
          w.y += speed * dt
          if (w.driftSpeed && w.gaps.length === 1) {
            const g = w.gaps[0]
            const gw = g[1] - g[0]
            let ng0 = g[0] + w.driftSpeed * dt
            if (ng0 < 0.06) {
              ng0 = 0.06
              w.driftSpeed = Math.abs(w.driftSpeed)
            } else if (ng0 + gw > 0.94) {
              ng0 = 0.94 - gw
              w.driftSpeed = -Math.abs(w.driftSpeed)
            }
            g[0] = ng0
            g[1] = ng0 + gw
          }
        }
        while (waves.length && waves[0].y > 1.15) waves.shift()
      }

      // 4. Bot yapay zekâsı (antrenman modu — zıplama ve gerçekçi hata payı dahil)
      if (started && isPractice && !finished) {
        const incoming = waves.find((w) => w.y + w.h > 0.18 && w.y < 0.8)
        for (const s of surfers) {
          if (!s.isBot || !s.alive) continue
          if (s.invuln > 0) s.invuln = Math.max(0, s.invuln - dt)
          if (s.jumpCd > 0) s.jumpCd = Math.max(0, s.jumpCd - dt)
          if (incoming) {
            if (incoming.jumpWall) {
              if (incoming.y > 0.56 && incoming.y < 0.68 && s.jump <= 0.001 && s.jumpCd <= 0 && rng() < s.botSkill * 0.92) {
                s.jumpVel = 3.3
                s.jumpCd = JUMP_CD
              }
            } else if (incoming.gaps.length) {
              let bestGap = incoming.gaps[0]
              let bestD = 9
              for (const g of incoming.gaps) {
                const mid = (g[0] + g[1]) / 2
                const d = Math.abs(mid - s.x)
                if (d < bestD) {
                  bestD = d
                  bestGap = g
                }
              }
              const mid = (bestGap[0] + bestGap[1]) / 2
              const fatigue = Math.min(0.14, elapsedSec * 0.0018)
              const jitter = Math.sin(time * 2.4 + s.botSkill * 20) * (1 - s.botSkill + fatigue) * 0.22
              s.botTarget = Math.max(0.08, Math.min(0.92, mid + jitter))
            }
          }
          if (s.jump > 0 || s.jumpVel > 0) {
            s.jump += s.jumpVel * dt
            s.jumpVel -= 9.4 * dt
            if (s.jump <= 0) {
              s.jump = 0
              s.jumpVel = 0
            }
          }
          const diff = s.botTarget - s.x
          s.vx += (Math.max(-1, Math.min(1, diff * 5)) * 0.64 * s.botSkill + windForce * 0.55 - s.vx) * Math.min(1, dt * 8)
          s.x = Math.max(0.06, Math.min(0.94, s.x + s.vx * dt))
          s.tilt += (Math.max(-1, Math.min(1, s.vx * 1.8)) - s.tilt) * Math.min(1, dt * 10)
        }
      }

      // 5. Çarpışma kontrolü (2 can sistemi + kısa toparlanma süresi) + temiz geçiş ödül efektleri
      for (const s of surfers) {
        if (!s.alive) continue
        if (s.jump < 0.15) {
          s.wake.push({ x: s.x, y: 0.8 })
          if (s.wake.length > 16) s.wake.shift()
        }
        for (const pt of s.wake) pt.y += speed * dt * 1.15

        if (!started || finished) continue
        if (!s.isSelf && !isPractice) continue
        for (const w of waves) {
          if (s.isSelf && !w.cleared && w.y > 0.79) {
            w.cleared = true
            combo++
            const mp = proj(me.x, 0.78, W, H, camShift)
            if (me.jump > 0.2) addCallout(w.jumpWall ? 'MEGA ATLAYIŞ! 🌊' : 'HARİKA ATLAYIŞ! 🌊', mp.x, mp.y - 68, '#ffe48f')
            else if (combo >= 3) addCallout(`${combo}× SERİ! ✨`, mp.x, mp.y - 64, '#a8f0ff')
          }
          if (s.invuln > 0) continue
          if (s.jump > 0.25) continue // havada dalganın üstünden atladı!
          if (w.y + w.h >= 0.735 && w.y <= 0.785) {
            const safe = !w.jumpWall && w.gaps.some(([g0, g1]) => s.x >= g0 + 0.015 && s.x <= g1 - 0.015)
            if (!safe) {
              s.lives -= 1
              const sp = proj(s.x, 0.78, W, H, camShift)
              splashes.push({ x: sp.x, y: sp.y, r: 16, life: 0.8 })
              spawnSpray(sp.x, sp.y, 0, -60, 26)
              if (s.lives > 0) {
                s.invuln = 1.35
                if (s.isSelf) {
                  shake = 10
                  combo = 0
                  addCallout('SON CAN! ❤️', sp.x, sp.y - 68, '#ff9c8f')
                  window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
                }
                break
              }
              s.alive = false
              s.outMs = elapsedMs
              outOrder.push(s)
              if (s.isSelf) {
                shake = 14
                combo = 0
                window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
                if (!isPractice) onLocalOut(elapsedMs)
              }
              break
            }
          }
        }
      }

      // Antrenman modu bitiş kontrolü
      if (started && isPractice && !finished) {
        const aliveList = surfers.filter((s) => s.alive)
        if (aliveList.length <= 1 || (!me.alive && elapsedMs - me.outMs > 1200)) {
          finished = true
          const ordered = [...aliveList, ...[...outOrder].reverse()]
          const standings = ordered.map((s, idx) => {
            const rank = idx + 1
            const pts = rank === 1 ? 100 : rank === 2 ? 60 : rank === 3 ? 35 : 15
            return { rank, id: s.id, name: s.name, ms: Math.round(s.alive ? elapsedMs : s.outMs), pts, coins: 0 }
          })
          const myRow = standings.find((r) => r.id === me.id)
          const top = saveLocalScore(selfName, myRow?.pts ?? 15, myRow?.rank === 1, myRow?.ms ?? elapsedMs)
          onBotFinish({ winner: standings[0], standings, top, practice: true })
        }
      }

      // 6. ÇİZİM — Gökyüzü, perspektif okyanus, dalgalar, sörfçüler, köpük & hız çizgileri
      ctx.save()
      if (shake > 0.2) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake)
        shake *= Math.pow(0.05, dt)
      }

      drawSkyAndHorizon(W, H, time, camShift)

      // Arkadan öne doğru dalgalar (perspektif derinlik sırası)
      const backWaves = waves.filter((w) => w.y <= 0.78)
      const frontWaves = waves.filter((w) => w.y > 0.78)
      for (const w of backWaves) drawWave(w, W, H, time, camShift)

      // Sörfçüler
      for (const s of surfers) if (s.alive) drawSurfer(s, W, H, time, camShift)

      // Sörfçüyü geçmiş ön dalgalar
      for (const w of frontWaves) drawWave(w, W, H, time, camShift)

      // Çarpışma & iniş dalga halkaları
      for (let i = splashes.length - 1; i >= 0; i--) {
        const sp = splashes[i]
        sp.r += dt * 130
        sp.life -= dt
        if (sp.life <= 0) {
          splashes.splice(i, 1)
          continue
        }
        ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, sp.life).toFixed(2)})`
        ctx.lineWidth = 4.5
        ctx.beginPath()
        ctx.ellipse(sp.x, sp.y, sp.r, sp.r * 0.55, 0, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Su spreyi parçacıkları
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += 120 * dt
        p.life -= dt
        if (p.life <= 0) {
          particles.splice(i, 1)
          continue
        }
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife)
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // Yüzen başarı yazıları ("HARİKA ATLAYIŞ!", "3× SERİ!")
      for (let i = callouts.length - 1; i >= 0; i--) {
        const c = callouts[i]
        c.y += c.vy * dt
        c.life -= dt
        if (c.life <= 0) {
          callouts.splice(i, 1)
          continue
        }
        ctx.save()
        ctx.globalAlpha = Math.min(1, c.life * 2)
        ctx.font = '900 16px Nunito, sans-serif'
        ctx.textAlign = 'center'
        ctx.strokeStyle = 'rgba(74, 59, 92, 0.75)'
        ctx.lineWidth = 4
        ctx.strokeText(c.text, c.x, c.y)
        ctx.fillStyle = c.color
        ctx.fillText(c.text, c.x, c.y)
        ctx.restore()
      }

      // Yüksek hızda kenar hız çizgileri
      const speedLv = 1 + Math.floor(elapsedSec / 8)
      if (started && speedLv >= 2) {
        const alpha = Math.min(0.28, (speedLv - 1) * 0.06)
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`
        ctx.lineWidth = 2
        for (let i = 0; i < 10; i++) {
          const leftSide = i % 2 === 0
          const sx = leftSide ? 10 + (i * 7) % 36 : W - 10 - ((i * 7) % 36)
          const sy = ((time * 520 + i * 97) % H)
          ctx.beginPath()
          ctx.moveTo(sx, sy)
          ctx.lineTo(sx + (leftSide ? -6 : 6), sy + 38)
          ctx.stroke()
        }
      }
      ctx.restore()

      // HUD güncelle (~10 Hz)
      if (now - lastHud > 100) {
        lastHud = now
        const cd = started ? 0 : Math.ceil((matchStart - nowEpoch) / 1000)
        const aliveCnt = surfers.filter((s) => s.alive).length
        setHud({
          countdown: cd,
          alive: aliveCnt,
          total: surfers.length,
          ms: elapsedMs,
          speedLv,
          out: !me.alive,
          jumpReady: Math.max(0, Math.min(1, 1 - me.jumpCd / JUMP_CD)),
          combo,
          lives: Math.max(0, me.lives),
          wind: Math.sign(windForce),
        })
      }

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [match, selfId, selfName, remoteRef, onSendPos, onLocalOut, onBotFinish])

  const setPointer = (e) => {
    const r = canvasRef.current?.getBoundingClientRect()
    if (!r) return
    inputRef.current.pointerX = Math.max(0.06, Math.min(0.94, (e.clientX - r.left) / r.width))
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1b7fa3] select-none touch-none">
      {/* Üst canlı skor çubuğu */}
      <div className="flex items-center justify-between gap-2 bg-white/92 px-4 py-2.5 shadow-soft backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#ffe8ee] px-2.5 py-1 text-xs font-black text-[#c93b5a]" title="Kalan can">
            {Array.from({ length: MAX_LIVES }, (_, i) => (i < hud.lives ? '❤️' : '🤍')).join('')}
          </span>
          <span className="rounded-full bg-[#dff7ff] px-3 py-1 text-xs font-black text-[#12688a]">
            🏄 {hud.alive}/{hud.total} Ayakta
          </span>
          <span className="rounded-full bg-[#fff3c8] px-3 py-1 text-xs font-black text-[#8a5a00]">
            🌊 Seviye {hud.speedLv}
          </span>
          <span className="hidden rounded-full bg-[#f6f0ff] px-3 py-1 text-xs font-black tabular-nums text-[#5b4678] sm:inline-block">
            ⏱ {fmtSec(hud.ms)}
          </span>
          {hud.wind !== 0 && (
            <span className="rounded-full bg-[#e3f6ff] px-2.5 py-1 text-xs font-black text-[#0f6b8a]">
              💨 {hud.wind > 0 ? 'Akıntı →' : '← Akıntı'}
            </span>
          )}
          {hud.combo >= 2 && (
            <span className="rounded-full bg-[#ffe8d1] px-3 py-1 text-xs font-black text-[#c7640a]">
              🔥 {hud.combo}× Seri
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onExit}
          className="rounded-full bg-[#ffe8e8] px-3.5 py-1 text-xs font-black text-[#b54141] active:scale-95"
        >
          Çık ✖️
        </button>
      </div>

      {/* 60 FPS Okyanus Canvas */}
      <div className="relative flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture?.(e.pointerId)
            setPointer(e)
          }}
          onPointerMove={(e) => {
            if (e.buttons > 0 || e.pointerType === 'touch') setPointer(e)
          }}
          onPointerUp={() => {
            inputRef.current.pointerX = null
          }}
          onPointerCancel={() => {
            inputRef.current.pointerX = null
          }}
          className="block h-full w-full cursor-ew-resize"
        />

        {/* Başlangıç geri sayımı */}
        {hud.countdown > 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[#125d7a]/30 backdrop-blur-[1px]">
            <div className="animate-pop rounded-[2rem] border-2 border-white bg-white/95 px-8 py-5 text-center shadow-toy">
              <p className="text-sm font-black uppercase tracking-wider text-[#1ea8c7]">Dalgalardan Kaç!</p>
              <p className="mt-1 text-6xl font-black text-[#4a3b5c]">{hud.countdown}</p>
              <p className="mt-1 text-xs font-bold text-[#8a7a9c]">
                {touch ? 'Parmağınla sürükle · Zıpla ile dalga aş!' : 'A / D veya ← → ile kay · Boşluk ile zıpla!'}
              </p>
            </div>
          </div>
        )}

        {/* Elendiyse izleyici bandı */}
        {hud.out && (
          <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border-2 border-white bg-[#4a3b5c]/90 px-5 py-2 text-xs font-black text-white shadow-lg">
            🌊 Dalgaya yakalandın! Kazanan bekleniyor…
          </div>
        )}

        {/* Dalga Sıçraması (Ollie) düğmesi */}
        {!hud.out && hud.countdown === 0 && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault()
              inputRef.current.wantJump = true
            }}
            disabled={hud.jumpReady < 1}
            className={`absolute bottom-5 right-5 flex h-16 w-28 flex-col items-center justify-center rounded-3xl border-2 border-white font-black text-white shadow-toy transition active:scale-95 ${
              hud.jumpReady >= 1 ? 'bg-gradient-to-b from-[#ffb85c] to-[#f08b2d]' : 'bg-[#6b8fa3]/75'
            }`}
            style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            <span className="text-lg leading-none">🌊 Zıpla</span>
            <span className="mt-0.5 text-[10px] opacity-90">{hud.jumpReady >= 1 ? (touch ? 'Dokun' : 'Boşluk') : 'Doluyor…'}</span>
          </button>
        )}
      </div>
    </div>
  )
}

export function useSurf({ net, panel, setPanel, touch, say, name }) {
  const { on, send } = net
  const [view, setView] = useState('lobby') // lobby | board | play | result
  const [lobby, setLobby] = useState({ players: [], min: 2, max: 10, startsAt: 0 })
  const [joined, setJoined] = useState(false)
  const [board, setBoard] = useState(() => loadLocalBoard())
  const [match, setMatch] = useState(null)
  const [result, setResult] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const remoteRef = useRef([])
  const savedCosRef = useRef(null)

  const active = panel === 'surf'

  // Sörf ekranındayken 3B avatara geçici olarak sörf kıyafeti (turkuaz wetsuit + güneş gözlüğü) giydir
  useEffect(() => {
    if (!active) return undefined
    const prev = cosStore.get('self')
    savedCosRef.current = prev ? { ...prev } : null
    cosStore.set('self', {
      ...(prev ?? {}),
      acc: { id: 'shades', color: 'coral' },
      look: { ...(prev?.look ?? { h: -1, e: -1, o: -1 }), o: '#1ea8c7' },
    })
    return () => {
      if (savedCosRef.current) cosStore.set('self', savedCosRef.current)
      else cosStore.set('self', { acc: null, acc2: null, pet: null, look: null })
    }
  }, [active])

  // Sörfçü Kaan'dan gelen açma olayı
  useEffect(() => {
    const onOpen = (e) => {
      const mode = e.detail?.mode === 'board' ? 'board' : 'lobby'
      setView(mode)
      setResult(null)
      setPanel('surf')
      send({ t: 'surf_board' })
    }
    window.addEventListener('situapp:open-surf', onOpen)
    return () => window.removeEventListener('situapp:open-surf', onOpen)
  }, [send, setPanel])

  // Sunucu mesajları
  useEffect(() => {
    const offs = [
      on('surf_board', (m) => {
        if (Array.isArray(m.top)) setBoard(m.top)
      }),
      on('surf_lobby', (m) => {
        setLobby({ players: m.players ?? [], min: m.min ?? 2, max: m.max ?? 10, startsAt: m.startsAt ?? 0 })
        const isIn = (m.players ?? []).some((p) => p.id === net.selfId.current)
        setJoined(isIn)
      }),
      on('surf_left', () => setJoined(false)),
      on('surf_start', (m) => {
        remoteRef.current = m.players ?? []
        setMatch({ matchId: m.matchId, seed: m.seed, startAt: m.startAt, players: m.players ?? [], practice: false })
        setJoined(false)
        setResult(null)
        setView('play')
      }),
      on('surf_state', (m) => {
        remoteRef.current = m.players ?? []
      }),
      on('surf_end', (m) => {
        setMatch(null)
        setResult(m)
        if (Array.isArray(m.top)) setBoard(m.top)
        setView('result')
        window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: m.winner?.id === net.selfId.current ? 'badge' : 'quest' }))
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [on, net.selfId])

  useEffect(() => {
    if (!active || !lobby.startsAt) return undefined
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [active, lobby.startsAt])

  const closeAll = useCallback(() => {
    if (joined || match) send({ t: 'surf_leave' })
    setJoined(false)
    setMatch(null)
    setResult(null)
    setPanel(null)
  }, [joined, match, send, setPanel])

  const joinLobby = () => {
    if (!send({ t: 'surf_join' })) {
      say('Çevrimdışısın — Botlarla Sörf Antrenmanına hemen başlayabilirsin! 🏄')
      return
    }
    setJoined(true)
  }

  const leaveLobby = () => {
    send({ t: 'surf_leave' })
    setJoined(false)
  }

  const startPractice = () => {
    if (joined) send({ t: 'surf_leave' })
    setJoined(false)
    const meId = net.selfId.current ?? 'local'
    const players = [
      { id: meId, name: name || 'Sen', x: 0.5, isBot: false },
      ...BOT_NAMES.map((bn, i) => ({ id: `bot_${i}`, name: bn, x: 0.16 + i * 0.22, isBot: true })),
    ]
    setMatch({
      matchId: `practice_${Date.now()}`,
      seed: Math.floor(Math.random() * 1_000_000),
      startAt: Date.now() + 2600,
      players,
      practice: true,
    })
    setResult(null)
    setView('play')
  }

  const onSendPos = useCallback((p) => send({ t: 'surf_pos', ...p }), [send])
  const onLocalOut = useCallback((ms) => send({ t: 'surf_out', ms }), [send])
  const onBotFinish = useCallback((res) => {
    setMatch(null)
    setResult(res)
    if (Array.isArray(res.top)) setBoard(res.top)
    setView('result')
    window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: res.winner?.id === (net.selfId.current ?? 'local') ? 'badge' : 'quest' }))
  }, [net.selfId])

  const cdSec = lobby.startsAt ? Math.max(0, Math.ceil((lobby.startsAt - now) / 1000)) : 0

  const overlays = active ? (
    view === 'play' && match ? (
      <SurfArena
        match={match}
        selfId={net.selfId.current ?? 'local'}
        selfName={name || 'Sen'}
        touch={touch}
        remoteRef={remoteRef}
        onSendPos={onSendPos}
        onLocalOut={onLocalOut}
        onBotFinish={onBotFinish}
        onExit={closeAll}
      />
    ) : (
      <div className="fixed inset-0 z-40 grid place-items-center bg-[#155a75]/45 p-4 backdrop-blur-[2px]" onClick={closeAll}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Sörf Yarışı"
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-[90svh] w-[min(94vw,29rem)] animate-pop flex-col overflow-hidden rounded-[2rem] border-2 border-white bg-white/95 p-5 shadow-toy backdrop-blur-md"
        >
          {/* Başlık */}
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-black text-[#4a3b5c]">Sörf Yarışı</h2>
              <p className="text-xs font-bold text-[#8a7a9c]">Dalgalardan kaç, en sona kalan kazanır! (2–10 kişi)</p>
            </div>
            <button type="button" onClick={closeAll} aria-label="Kapat" className="grid h-9 w-9 place-items-center rounded-full bg-[#f6f0ff] text-sm font-black text-[#8a7a9c] hover:bg-[#ffedd6]">
              ✖️
            </button>
          </div>

          {/* Sekmeler */}
          <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-2xl bg-[#eef8fc] p-1">
            <button
              type="button"
              onClick={() => setView('lobby')}
              className={`rounded-xl py-2 text-xs font-black transition ${view !== 'board' ? 'bg-white text-[#12688a] shadow-sm' : 'text-[#6c8a99]'}`}
            >
              Yarış Lobisi
            </button>
            <button
              type="button"
              onClick={() => {
                setView('board')
                send({ t: 'surf_board' })
              }}
              className={`rounded-xl py-2 text-xs font-black transition ${view === 'board' ? 'bg-white text-[#8a5a00] shadow-sm' : 'text-[#6c8a99]'}`}
            >
              Puan Tablosu
            </button>
          </div>

          {/* İçerik */}
          <div className="mt-3 flex-1 overflow-y-auto">
            {view === 'board' ? (
              <div className="flex flex-col gap-1.5">
                {board.length === 0 ? (
                  <p className="py-8 text-center text-sm font-bold text-[#8a7a9c]">Henüz sörf skoru yok — ilk şampiyon sen ol! 🏄</p>
                ) : (
                  board.map((r, i) => (
                    <div key={r.key ?? i} className={`flex items-center gap-2.5 rounded-2xl px-3 py-2 ${i === 0 ? 'bg-[#fff3c4]' : 'bg-[#f6f0ff]/70'}`}>
                      <span className="w-7 text-center text-sm font-black text-[#4a3b5c]">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-[#4a3b5c]">{r.name}</p>
                        <p className="text-[11px] font-bold text-[#8a7a9c]">
                          {r.wins} galibiyet · En iyi {fmtSec(r.bestMs)}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-[#12688a] shadow-sm">
                        {r.points} puan
                      </span>
                    </div>
                  ))
                )}
              </div>
            ) : view === 'result' && result ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="rounded-3xl bg-gradient-to-br from-[#fff3c4] via-[#ffffff] to-[#dff7ff] px-5 py-4 shadow-soft">
                  <p className="text-3xl">🏆</p>
                  <p className="mt-1 text-lg font-black text-[#4a3b5c]">
                    {result.winner ? `${result.winner.name} Kazandı!` : 'Yarış Bitti!'}
                  </p>
                  {result.practice && <p className="text-xs font-bold text-[#8a7a9c]">Bot antrenmanı · Skorun tabloya kaydedildi</p>}
                </div>
                <div className="flex w-full flex-col gap-1.5 text-left">
                  {(result.standings ?? []).map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-2xl bg-[#f6f0ff]/75 px-3 py-2 text-xs font-extrabold text-[#4a3b5c]">
                      <span>
                        {s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : `#${s.rank}`} {s.name}
                      </span>
                      <span className="text-[#12688a]">
                        {fmtSec(s.ms)} · +{s.pts} puan{s.coins ? ` · +${s.coins} ₺` : ''}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex w-full gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResult(null)
                      setView('lobby')
                    }}
                    className="flex-1 rounded-2xl border-b-4 border-[#157c9c] bg-[#22b8cf] py-2.5 text-sm font-black text-white active:translate-y-[2px]"
                  >
                    Lobiye Dön
                  </button>
                  <button
                    type="button"
                    onClick={startPractice}
                    className="flex-1 rounded-2xl border-b-4 border-[#d98a1c] bg-[#fdb252] py-2.5 text-sm font-black text-white active:translate-y-[2px]"
                  >
                    Tekrar Sörf
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="rounded-2xl bg-[#eef8fc] p-3.5 text-center">
                  <p className="text-xs font-black text-[#12688a]">
                    👕 Sörf kıyafetin (turkuaz wetsuit & gözlük) otomatik giyildi!
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#5b7a8a]">
                    Gelen dalgaların boşluklarından kay, sıkışınca <b>Zıpla</b> ile dalganın üstünden atla.
                  </p>
                </div>

                {/* Çok oyunculu lobi kutusu */}
                <div className="rounded-2xl border-2 border-[#dff3ff] bg-[#fafdff] p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-[#4a3b5c]">
                      Bekleyen Sörfçüler ({lobby.players.length}/{lobby.max})
                    </span>
                    {cdSec > 0 ? (
                      <span className="rounded-full bg-[#fdb252] px-2.5 py-0.5 text-xs font-black text-white">
                        {cdSec} sn sonra başlıyor!
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#e9ddff] px-2.5 py-0.5 text-[11px] font-black text-[#5b4678]">
                        Min. {lobby.min} kişi
                      </span>
                    )}
                  </div>
                  {lobby.players.length === 0 ? (
                    <p className="mt-2 text-xs font-bold text-[#8a7a9c]">
                      Şu an bekleyen yok. Lobiye katıl, 1 arkadaşın daha gelince 10 sn içinde başlar!
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {lobby.players.map((p) => (
                        <span key={p.id} className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#4a3b5c] shadow-sm">
                          🏄 {p.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex gap-2">
                    {joined ? (
                      <button
                        type="button"
                        onClick={leaveLobby}
                        className="w-full rounded-2xl border-2 border-[#ffd2d2] bg-[#fff5f5] py-2.5 text-sm font-black text-[#b54141] active:scale-95"
                      >
                        Lobiden Ayrıl
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={joinLobby}
                        className="w-full rounded-2xl border-b-4 border-[#157c9c] bg-[#22b8cf] py-2.5 text-sm font-black text-white shadow-soft active:translate-y-[2px]"
                      >
                        🏄 Arkadaş Bekle / Katıl (2–10 Kişi)
                      </button>
                    )}
                  </div>
                </div>

                {/* Tek başına / hemen deneme (botlarla 5 kişilik yarış) */}
                <button
                  type="button"
                  onClick={startPractice}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border-b-4 border-[#d98a1c] bg-[#fdb252] py-3 text-sm font-black text-white shadow-soft active:translate-y-[2px]"
                >
                  <Ico name="quests" size={18} color="#ffffff" />
                  Hemen Oyna (5 Sörfçü · Botlarla)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  ) : null

  return { overlays }
}
