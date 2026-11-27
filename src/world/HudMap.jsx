// Mini harita ve büyük harita çizimi (ada, yollar, mekânlar).
import { useEffect, useRef, useState } from 'react'
import { emojiSrc } from '../components/emoji'
import { Ico } from '../components/Icon'
import { BEACH, BEACH_PARTY, BUILDINGS, GUIDE, ISLAND, PLAZA_R, RIM, RING, ROAD_END, ROAD_HALF, ROAD_START, ZONES, zoneAt } from './layout'

const glass = 'border-2 border-white bg-white/92 shadow-soft'

// ---------- harita ----------
// Küçük harita: oyuncuyu ortalar, yakın çevreyi (±LOCAL_R m) gösterir, mekân ikonları + yakındaki oyuncular. Dokununca büyür:
// tüm şehir + bölge adları + bölgelere ışınlanma düğmeleri. Çizim canvas'ta (yüksek çözünürlük).
const LOCAL_R = 30 // küçük harita yarıçapı (m)
const WORLD_R = 112 // büyük harita yarıçapı (m); merkez (0, -25)
const iconCache = new Map()
const iconOf = (emoji) => {
  const src = emojiSrc(emoji)
  if (!src) return null
  let im = iconCache.get(src)
  if (!im) {
    im = new Image()
    im.src = src
    iconCache.set(src, im)
  }
  return im.complete && im.naturalWidth ? im : null
}
const ZONE_CENTER = Object.fromEntries(ZONES.map((z) => [z.id, z.shape === 'circle' ? [z.x, z.z] : [(z.x0 + z.x1) / 2, (z.z0 + z.z1) / 2]]))

function drawMap(ctx, S, big, f, remotes) {
  const r = big ? WORLD_R : LOCAL_R
  const cx = big ? 0 : f.x
  const cz = big ? -25 : f.z
  const k = S / (r * 2)
  const X = (v) => (v - cx) * k + S / 2
  const Z = (v) => (v - cz) * k + S / 2
  const len = (m) => m * k
  ctx.save()
  ctx.clearRect(0, 0, S, S)
  if (!big) {
    ctx.beginPath()
    ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2)
    ctx.clip() // yuvarlak, oyuncu ortada
  }
  ctx.fillStyle = '#9fdcef' // deniz (adanın dört yanı)
  ctx.fillRect(0, 0, S, S)
  ctx.fillStyle = '#f6e3b0' // kıyı kumu
  ctx.fillRect(X(ISLAND.x0 - RIM), Z(ISLAND.z0 - RIM), len(ISLAND.x1 - ISLAND.x0 + RIM * 2), len(ISLAND.z1 - ISLAND.z0 + RIM * 2))
  ctx.fillStyle = '#c8ecd0' // çimen
  ctx.fillRect(X(ISLAND.x0), Z(ISLAND.z0), len(ISLAND.x1 - ISLAND.x0), len(ISLAND.z1 - ISLAND.z0))
  ctx.fillStyle = '#ffe9b8' // plaj kumu
  ctx.beginPath()
  ctx.arc(X(BEACH.x), Z(BEACH.z), len(BEACH.r + 3), 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#bfeaf5' // gölet
  ctx.beginPath()
  ctx.arc(X(-30), Z(30), len(7), 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#dfcaaf' // kaldırımlar (arnavut kaldırımı tonu)
  const sw = ROAD_HALF * 2 + 2.8
  const nsHn = len(-ROAD_START - ROAD_END.north)
  const nsHs = len(ROAD_END.south - ROAD_START)
  const ewW = len(ROAD_END.east - ROAD_START)
  ctx.fillRect(X(-sw / 2), Z(ROAD_END.north), len(sw), nsHn)
  ctx.fillRect(X(-sw / 2), Z(ROAD_START), len(sw), nsHs)
  ctx.fillRect(X(ROAD_START), Z(-sw / 2), ewW, len(sw))
  ctx.fillRect(X(-26), Z(-1.7), len(11), len(3.4)) // park patikası
  ctx.beginPath() // kavşak kaldırımı
  ctx.arc(X(0), Z(0), len(RING.r1 + RING.side), 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#d8cfe6' // yollar + halka
  ctx.fillRect(X(-ROAD_HALF), Z(ROAD_END.north), len(ROAD_HALF * 2), nsHn)
  ctx.fillRect(X(-ROAD_HALF), Z(ROAD_START), len(ROAD_HALF * 2), nsHs)
  ctx.fillRect(X(ROAD_START), Z(-ROAD_HALF), ewW, len(ROAD_HALF * 2))
  ctx.beginPath()
  ctx.arc(X(0), Z(0), len(RING.r1), 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#dfcaaf'
  ctx.beginPath()
  ctx.arc(X(0), Z(0), len(RING.r0), 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f8ead8' // lobi meydanı
  ctx.beginPath()
  ctx.arc(X(0), Z(0), len(PLAZA_R), 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = Math.max(1, len(0.5))
  ctx.beginPath()
  ctx.arc(X(0), Z(0), len(7), 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = '#9fd8f5' // çeşme
  ctx.beginPath()
  ctx.arc(X(0), Z(0), len(2.4), 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#d9b8ff' // çardak
  ctx.beginPath()
  ctx.arc(X(-30), Z(0), len(3.2), 0, Math.PI * 2)
  ctx.fill()
  // binalar — 1. katman: gölgeli pastel çatı blokları
  for (const b of BUILDINGS) {
    if (b.gazebo) continue
    const side = b.facing === 'e' || b.facing === 'w'
    const w = side ? b.d : b.w
    const d = side ? b.w : b.d
    const bx = X(b.x - w / 2)
    const bz = Z(b.z - d / 2)
    const bw = len(w)
    const bd = len(d)
    const rad = Math.max(2, len(0.9))
    ctx.save()
    ctx.shadowColor = 'rgba(74, 59, 92, 0.14)'
    ctx.shadowBlur = 4
    ctx.shadowOffsetY = 1.5
    ctx.fillStyle = b.homeDoor ? '#ffe699' : b.roof
    ctx.beginPath()
    ctx.roundRect(bx, bz, bw, bd, rad)
    ctx.fill()
    ctx.restore()
    ctx.strokeStyle = b.homeDoor ? '#fdb252' : 'rgba(255,255,255,0.65)'
    ctx.lineWidth = b.homeDoor ? 1.8 : 1
    ctx.beginPath()
    ctx.roundRect(bx, bz, bw, bd, rad)
    ctx.stroke()
  }
  // 2. katman: modern dairesel harita rozetleri (ikonlar net beyaz zemin + renkli halka + yumuşak gölge)
  const drawBadge = (wx, wz, emoji, ringColor, highlight = false) => {
    const im = iconOf(emoji)
    if (!im) return
    const px = X(wx)
    const pz = Z(wz)
    const rad = big ? 10 : 10.5
    if (highlight) {
      ctx.fillStyle = 'rgba(253, 178, 82, 0.30)'
      ctx.beginPath()
      ctx.arc(px, pz, rad + 3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(px, pz, rad, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = ringColor
    ctx.lineWidth = highlight ? 2.2 : 1.8
    ctx.beginPath()
    ctx.arc(px, pz, rad, 0, Math.PI * 2)
    ctx.stroke()
    const icoSz = rad * 1.32
    ctx.drawImage(im, px - icoSz / 2, pz - icoSz / 2, icoSz, icoSz)
  }
  for (const b of BUILDINGS) {
    if (b.gazebo || !b.label) continue
    drawBadge(b.x, b.z, b.label.split(' ')[0], b.homeDoor ? '#fdb252' : b.roof, Boolean(b.homeDoor))
  }
  // Sahil Partisi (Beach Party) rozeti
  drawBadge(BEACH_PARTY.x, BEACH_PARTY.z, '🪩', '#ff8fb8', true)
  // bölge adları (büyük harita)
  if (big) {
    ctx.font = '800 11px Nunito, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.lineJoin = 'round'
    for (const z of ZONES) {
      const [zx, zz] = ZONE_CENTER[z.id]
      const ty = z.id === 'lobby' ? Z(zz + 13.5) : Z(zz)
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.strokeText(z.name, X(zx), ty)
      ctx.fillStyle = '#4a3b5c'
      ctx.fillText(z.name, X(zx), ty)
    }
  }
  // diğer oyuncular
  for (const rp of remotes.current.values()) {
    ctx.save()
    ctx.shadowColor = 'rgba(74, 59, 92, 0.2)'
    ctx.shadowBlur = 3
    ctx.fillStyle = '#a88bff'
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.arc(X(rp.x), Z(rp.z), big ? 3.8 : 4.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
  // Rehber
  ctx.fillStyle = '#fdb252'
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.arc(X(GUIDE.x), Z(GUIDE.z), 3.8, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  // kendin: sıcak turuncu nabız halkası + dolgulu beyaz konturlu yön oku
  const t = (performance.now() % 1600) / 1600
  ctx.strokeStyle = `rgba(253,178,82,${0.6 * (1 - t)})`
  ctx.lineWidth = 2.2
  ctx.beginPath()
  ctx.arc(X(f.x), Z(f.z), 6 + t * 13, 0, Math.PI * 2)
  ctx.stroke()
  ctx.save()
  ctx.translate(X(f.x), Z(f.z))
  ctx.rotate(-f.ry + Math.PI)
  ctx.shadowColor = 'rgba(74, 59, 92, 0.28)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetY = 1.5
  ctx.fillStyle = '#fdb252'
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2.4
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(0, -10)
  ctx.lineTo(7.5, 7.5)
  ctx.lineTo(0, 3.8)
  ctx.lineTo(-7.5, 7.5)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
  ctx.restore()
}

export function Minimap({ focusRef, remotes, compact }) {
  const canvas = useRef(null)
  const [big, setBig] = useState(false)
  const [zoneName, setZoneName] = useState('')
  const [winSize, setWinSize] = useState(() => ({ w: typeof window !== 'undefined' ? window.innerWidth : 1280, h: typeof window !== 'undefined' ? window.innerHeight : 720 }))
  useEffect(() => {
    if (!big) return undefined
    const onResize = () => setWinSize({ w: window.innerWidth, h: window.innerHeight })
    const onKey = (e) => e.key === 'Escape' && setBig(false)
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKey)
    }
  }, [big])
  const S = big ? Math.max(260, Math.min(compact ? 340 : 580, Math.round(Math.min(winSize.w * 0.86, winSize.h * 0.56)))) : compact ? 96 : 204 // ekranda CSS boyutu (px)
  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = S * dpr
    cv.height = S * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    let raf = 0
    let lastT = 0
    let lx = Infinity
    let lz = Infinity
    let lry = Infinity
    const draw = (now = performance.now()) => {
      raf = requestAnimationFrame(draw)
      const f = focusRef.current
      const moved = Math.abs(f.x - lx) > 0.02 || Math.abs(f.z - lz) > 0.02 || Math.abs((f.ry ?? 0) - lry) > 0.015
      if (!moved && now - lastT < 140) return
      lastT = now
      lx = f.x
      lz = f.z
      lry = f.ry ?? 0
      drawMap(ctx, S, big, f, remotes)
      const z = zoneAt(f.x, f.z)
      const short = z.name.replace(' Meydanı', '').replace(' Sokağı', '').replace('Gece ', '')
      setZoneName((prev) => (prev === short ? prev : short))
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [focusRef, remotes, big, S])

  useEffect(() => {
    const onOpen = () => setBig(true)
    const onToggle = () => setBig((b) => !b)
    window.addEventListener('situapp:open-map', onOpen)
    window.addEventListener('situapp:toggle-map', onToggle)
    return () => {
      window.removeEventListener('situapp:open-map', onOpen)
      window.removeEventListener('situapp:toggle-map', onToggle)
    }
  }, [])

  const travel = (z) => {
    window.dispatchEvent(new CustomEvent('situapp:tp', { detail: z.id })) // sunucuya bildirilir (hile denetimi)
    focusRef.current.teleport = z.spawn
    setBig(false)
  }

  if (big) {
    return (
      <div className="fixed inset-0 z-30 grid place-items-center bg-[#4a3b5c]/30 p-3 backdrop-blur-[2px]" onClick={() => setBig(false)}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Şehir Haritası"
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-[94svh] flex-col items-center gap-2.5 overflow-y-auto rounded-[2rem] border-2 border-white bg-white/95 p-4 shadow-toy animate-pop"
          style={{ width: Math.min(winSize.w - 24, S + 36) }}
        >
          <div className="flex w-full items-center justify-between gap-2 px-1">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-black text-[#4a3b5c]"><Ico name="map" size={20} /> Şehir Haritası</h2>
              <p className="text-xs font-bold text-[#8a7a9c]">Gitmek istediğin bölgeye tıkla</p>
            </div>
            <button onClick={() => setBig(false)} aria-label="Haritayı kapat" className="grid h-9 w-9 place-items-center rounded-full bg-[#f6f0ff] hover:bg-[#ffedd6]/70">
              <Ico name="close" size={14} />
            </button>
          </div>
          <canvas ref={canvas} className="block rounded-2xl border-2 border-white shadow-soft" style={{ width: S, height: S }} />
          <div className="flex w-full flex-col items-center gap-2 pb-0.5">
            <p className="text-[11px] font-black uppercase tracking-wider text-[#8a7a9c]">Hızlı Işınlan</p>
            <div className="flex w-full flex-wrap justify-center gap-1.5">
              {ZONES.map((z) => (
                <button key={z.id} onClick={() => travel(z)} className="rounded-full border border-white bg-[#f6f0ff] px-3.5 py-1.5 text-xs font-extrabold text-[#4a3b5c] shadow-sm transition hover:bg-[#ffedd6] active:scale-95">
                  {z.name.replace(' Meydanı', '').replace(' Sokağı', '').replace('Gece Kulübü', 'Kulüp')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="pointer-events-auto absolute right-2.5 z-10 sm:right-3"
      style={{ top: compact ? 'calc(max(0.65rem, env(safe-area-inset-top)) + 3.4rem)' : '5rem' }}
      aria-label="Harita"
    >
      <div className={`overflow-hidden rounded-full p-1.5 ${glass}`}>
        <button onClick={() => setBig(true)} title="Büyüt ve ışınlan" aria-label="Haritayı büyüt" className="relative block active:scale-95 transition-transform">
          <canvas ref={canvas} className="block rounded-full" style={{ width: S, height: S }} />
          <span className="absolute left-1/2 top-1 -translate-x-1/2 rounded-full bg-white/90 px-2 py-[1px] text-[11px] font-black text-[#8a7a9c] shadow-sm">K</span>
          {zoneName && (
            <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/95 px-2.5 py-[2px] text-[11px] font-extrabold text-[#4a3b5c] shadow-sm">
              {zoneName}
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
