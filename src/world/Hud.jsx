import { useEffect, useRef, useState } from 'react'
import { ToyButton } from '../components/ui'
import { emojiSrc } from '../components/emoji'
import { Ico } from '../components/Icon'
import { BEACH, BUILDINGS, GUIDE, ISLAND, PLAZA_R, RIM, RING, ROAD_END, ROAD_HALF, ROAD_START, ZONES } from './layout'

const glass = 'border-2 border-white bg-white/75 shadow-soft backdrop-blur-md'

// ---------- üst çubuk ----------
// extraButtons: özellik modüllerinin düğmeleri [{ key, emoji, label, onClick, badge? }] (sol sütunda, geri düğmesinin altında)
// extraNodes: hazır JSX düğmeler (sağ grupta, ⚙️'nin solunda)
export function TopBar({ zone, online, status, dnd, onExit, onHelp, onSettings, extraButtons = [], extraNodes = null, menuNodes = null, menuBadge = 0 }) {
  const [menu, setMenu] = useState(false)
  const menuRef = useRef(null)
  useEffect(() => {
    if (!menu) return
    const off = (e) => { if (!menuRef.current?.contains(e.target)) setMenu(false) }
    window.addEventListener('pointerdown', off)
    return () => window.removeEventListener('pointerdown', off)
  }, [menu])
  const dot = status === 'online' ? 'bg-emerald-400' : status === 'connecting' ? 'bg-amber-400' : 'bg-rose-400'
  const label = status === 'online' ? `${online} çevrimiçi` : status === 'connecting' ? 'Bağlanıyor…' : 'Çevrimdışı (tek başına)'
  return (
    <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-start justify-between gap-2 px-3 py-3">
      <div className="pointer-events-auto flex flex-col gap-2">
        <button
          onClick={onExit}
          aria-label="Karakter seçimine dön"
          className={`grid h-10 w-10 place-items-center rounded-full text-lg font-black text-[#4a3b5c] transition hover:bg-white ${glass}`}
        >
          <Ico name="back" size={22} />
        </button>
        {extraButtons.map((b) => (
          <button key={b.key} onClick={b.onClick} aria-label={b.label} title={b.label} className={`relative grid h-10 w-10 place-items-center rounded-full text-lg transition hover:bg-white active:scale-95 ${glass}`}>
            {b.icon ? <Ico name={b.icon} size={22} /> : b.emoji}
            {b.badge ? <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#fdb252] px-1 text-[10px] font-black text-white">{b.badge}</span> : null}
          </button>
        ))}
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 ${glass}`}>
          <span>{zone.emoji}</span>
          <span className="text-sm font-extrabold text-[#4a3b5c]">{zone.name}</span>
        </div>
        {/* çevrimiçi sayısı yalnızca giriş ekranında; burada yalnızca bağlantı sorunu ya da rahatsız etme açıkken bilgi çıkar */}
        {(status !== 'online' || dnd) && (
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold text-[#8a7a9c] ${glass}`}>
            {status !== 'online' && <span className={`h-2 w-2 rounded-full ${dot}`} />}
            {status !== 'online' && label}
            {dnd && <span title="Rahatsız etme açık">{status !== 'online' ? ' · ' : ''}🌙 Rahatsız etme</span>}
          </div>
        )}
      </div>
      <div className="pointer-events-auto relative flex gap-2" ref={menuRef}>
        {extraNodes}
        <button
          onClick={() => setMenu((m) => !m)}
          aria-label="Menü"
          aria-expanded={menu}
          className={`relative grid h-10 w-10 place-items-center rounded-full text-lg transition hover:bg-white ${glass}`}
        >
          <Ico name="settings" size={22} />
          {menuBadge > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full border-2 border-white bg-[#fdb252] px-1 text-[9px] font-black text-white">{menuBadge}</span>}
        </button>
        {menu && (
          <div className="absolute right-0 top-12 z-20 flex w-64 flex-col gap-1 rounded-3xl border-2 border-white bg-white/95 p-2 shadow-soft backdrop-blur-md" onClick={() => setMenu(false)}>
            {menuNodes}
            {onSettings && (
              <button onClick={onSettings} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm font-extrabold text-[#4a3b5c] transition hover:bg-[#fff8f0]">
                <Ico name="settings" size={22} />
                <span className="flex-1">Ayarlar</span>
              </button>
            )}
            <button onClick={onHelp} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm font-extrabold text-[#4a3b5c] transition hover:bg-[#fff8f0]">
              <Ico name="help" size={22} />
              <span className="flex-1">Yardım</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- mahalleye girince çıkan bildirim ----------
export function ZoneToast({ zone }) {
  const [shown, setShown] = useState(null)
  useEffect(() => {
    setShown(zone)
    const t = setTimeout(() => setShown(null), 4200)
    return () => clearTimeout(t)
  }, [zone])
  if (!shown || !shown.desc) return null
  return (
    <div className="pointer-events-none absolute left-1/2 top-28 z-10 w-[min(92vw,22rem)] -translate-x-1/2 animate-pop">
      <div className={`rounded-3xl px-5 py-3 text-center ${glass}`}>
        <p className="text-base font-black text-[#4a3b5c]">
          {shown.emoji} {shown.name}
        </p>
        <p className="text-sm font-semibold text-[#8a7a9c]">{shown.desc}</p>
      </div>
    </div>
  )
}

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
  // binalar
  for (const b of BUILDINGS) {
    if (b.gazebo) continue
    const side = b.facing === 'e' || b.facing === 'w'
    const w = side ? b.d : b.w
    const d = side ? b.w : b.d
    ctx.fillStyle = b.roof
    ctx.beginPath()
    ctx.roundRect(X(b.x - w / 2), Z(b.z - d / 2), len(w), len(d), len(0.8))
    ctx.fill()
    if (b.label) {
      const im = iconOf(b.label.split(' ')[0])
      const sz = Math.max(len(3), big ? 15 : 13)
      if (im) ctx.drawImage(im, X(b.x) - sz / 2, Z(b.z) - sz / 2, sz, sz)
    }
  }
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
    ctx.fillStyle = '#a88bff'
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(X(rp.x), Z(rp.z), big ? 3.4 : 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  // Rehber
  ctx.fillStyle = '#fdb252'
  ctx.beginPath()
  ctx.arc(X(GUIDE.x), Z(GUIDE.z), 3.4, 0, Math.PI * 2)
  ctx.fill()
  // kendin: nabız halkası + yönü gösteren ok
  const t = (performance.now() % 1600) / 1600
  ctx.strokeStyle = `rgba(255,126,179,${0.55 * (1 - t)})`
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(X(f.x), Z(f.z), 6 + t * 12, 0, Math.PI * 2)
  ctx.stroke()
  ctx.translate(X(f.x), Z(f.z))
  ctx.rotate(-f.ry + Math.PI)
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#e8952c'
  ctx.lineWidth = 2.2
  ctx.beginPath()
  ctx.moveTo(0, -8)
  ctx.lineTo(6, 6.5)
  ctx.lineTo(0, 3)
  ctx.lineTo(-6, 6.5)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

export function Minimap({ focusRef, remotes, compact }) {
  const canvas = useRef(null)
  const [big, setBig] = useState(false)
  const S = big ? (compact ? 280 : 360) : compact ? 112 : 160 // ekranda CSS boyutu (px)
  useEffect(() => {
    const cv = canvas.current
    const ctx = cv.getContext('2d')
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = S * dpr
    cv.height = S * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const draw = () => drawMap(ctx, S, big, focusRef.current, remotes)
    draw()
    const timer = setInterval(draw, 100)
    return () => clearInterval(timer)
  }, [focusRef, remotes, big, S])

  const travel = (z) => {
    window.dispatchEvent(new CustomEvent('situapp:tp', { detail: z.id })) // sunucuya bildirilir (hile denetimi)
    focusRef.current.teleport = z.spawn
    setBig(false)
  }
  return (
    <div className="pointer-events-auto absolute right-3 top-16 z-10" aria-label="Harita">
      <div className={`overflow-hidden ${big ? 'rounded-3xl' : 'rounded-full'} p-1 ${glass}`}>
        <button onClick={() => setBig((v) => !v)} aria-label={big ? 'Haritayı küçült' : 'Haritayı büyüt'} className="relative block">
          <canvas ref={canvas} className={`block ${big ? 'rounded-2xl' : 'rounded-full'}`} style={{ width: S, height: S }} />
          {!big && <span className="absolute left-1/2 top-0.5 -translate-x-1/2 rounded-full bg-white/85 px-1.5 text-[9px] font-black text-[#8a7a9c]">K</span>}
        </button>
        {big && (
          <div className="mt-1 flex flex-wrap justify-center gap-1 px-0.5 pb-0.5">
            {ZONES.map((z) => (
              <button key={z.id} onClick={() => travel(z)} className="flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-extrabold text-[#4a3b5c] transition hover:bg-[#ffedd6] active:scale-95">
                <span>{z.emoji}</span>
                {z.name.replace(' Meydanı', '').replace(' Sokağı', '').replace('Gece ', '')}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- sohbet ----------
export function ChatPanel({ feed, onSend, status }) {
  const input = useRef(null)
  const list = useRef(null)
  const [text, setText] = useState('')

  useEffect(() => {
    const onKey = (e) => {
      const typing = e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)
      if (e.key === 'Enter' && !typing) {
        e.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [feed])

  const submit = (e) => {
    e.preventDefault()
    const t = text.trim()
    if (t) onSend(t)
    setText('')
    input.current?.blur() // yürümeye devam edebilmek için odağı bırak
  }

  return (
    <div className="absolute bottom-3 left-3 z-10 flex w-[min(92vw,22rem)] flex-col gap-2">
      <div
        ref={list}
        className="pointer-events-auto flex max-h-40 flex-col gap-1 overflow-y-auto rounded-2xl p-1 [scrollbar-width:thin]"
        role="log"
        aria-live="polite"
      >
        {feed.slice(-30).map((m, i) => (
          <p
            key={`${m.ts}-${i}`}
            className={`w-fit max-w-full break-words rounded-2xl px-3 py-1 text-sm font-semibold ${
              m.kind === 'system'
                ? 'bg-[#fdb252]/90 text-white'
                : m.whisper
                  ? 'border-2 border-dashed border-[#c9b6f5] bg-[#f4edff]/95 italic text-[#5b3fa8]'
                  : m.self
                    ? 'bg-[#a9ddf5]/95 text-[#2f4a5c]'
                    : 'bg-white/90 text-[#4a3b5c]'
            }`}
          >
            {m.kind === 'system' ? (
              <>🧭 {m.text}</>
            ) : (
              m.whisper ? (
                <>
                  🤫 <span className="font-extrabold">{m.self ? `${m.toName ?? ''}’a fısıldadın` : `${m.name} fısıldadı`}: </span>
                  {m.text}
                </>
              ) : (
                <>
                  <span className="font-extrabold">{m.name}: </span>
                  {m.text}
                </>
              )
            )}
          </p>
        ))}
      </div>
      <form onSubmit={submit} className="pointer-events-auto">
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && input.current?.blur()}
          maxLength={140}
          autoComplete="off"
          aria-label="Sohbet mesajı"
          placeholder={status === 'online' ? 'Enter ile yaz… (/yardım)' : 'Çevrimdışı — komutlar çalışır (/yardım)'}
          className={`w-full rounded-2xl px-4 py-2.5 text-sm font-semibold text-[#4a3b5c] outline-none placeholder:text-[#8a7a9c]/70 focus:ring-4 focus:ring-[#d6c7ff]/70 ${glass}`}
        />
      </form>
    </div>
  )
}

// ---------- alt ipucu çubuğu ----------
export function HintBar() {
  return (
    <p className="pointer-events-none absolute bottom-3 right-3 z-10 hidden rounded-full px-4 py-1.5 text-xs font-extrabold text-[#8a7a9c] sm:block">
      <span className={`rounded-full px-3 py-1.5 ${glass}`}>WASD yürü · Sürükle: kamera · H yardım</span>
    </p>
  )
}

// ---------- modal çerçevesi ----------
export function Modal({ children, onClose, label }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-[#4a3b5c]/25 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[90svh] w-full max-w-md animate-pop overflow-y-auto rounded-[2rem] border-2 border-white bg-white/90 p-6 shadow-toy"
      >
        {children}
      </div>
    </div>
  )
}

// ---------- yardım ----------
function Row ({ k, children }) {
  return (
  <li className="flex items-start gap-3 text-sm font-semibold text-[#4a3b5c]">
    <kbd className="shrink-0 rounded-lg border-2 border-[#d6c7ff] bg-[#f6f0ff] px-2 py-0.5 text-xs font-extrabold text-[#7a5fd0]">{k}</kbd>
    <span>{children}</span>
  </li>
  )
}
export function HelpModal({ onClose }) {
  return (
    <Modal onClose={onClose} label="Yardım">
      <h2 className="text-2xl font-black text-[#4a3b5c]">Yardım 🧭</h2>

      <h3 className="mt-4 text-sm font-extrabold uppercase tracking-wide text-[#fdb252]">Hareket</h3>
      <ul className="mt-2 flex flex-col gap-2">
        <Row k="W A S D">veya ok tuşlarıyla yürü</Row>
        <Row k="Shift">basılı tut, koş</Row>
        <Row k="E">kapının önündeyken içeri gir / dışarı çık</Row>
        <Row k="Fare">sürükle: kamerayı döndür · tekerlek: yakınlaştır</Row>
      </ul>

      <h3 className="mt-4 text-sm font-extrabold uppercase tracking-wide text-[#fdb252]">Sohbet</h3>
      <ul className="mt-2 flex flex-col gap-2">
        <Row k="Enter">yazmaya başla / gönder · Esc: vazgeç</Row>
        <Row k="/yakındakiler">yakınındaki oyuncuları listele</Row>
        <Row k="/mekanlar">şehirdeki mekanlar</Row>
        <Row k="/ışınlan kafe">lobi, kafe, kulüp, park veya plaja git</Row>
        <Row k="/f Elif …">yakındaki birine fısılda 🤫 (en fazla 7 m; çevre yalnızca “fısıldıyor” görür)</Row>
        <Row k="1-9, 0">kafanın üstünde emoji uçur ❤️😘😍 (ya da 😊 düğmesi)</Row>
        <Row k="/ev">kendi evine gir (lobideki 🏠 kapıdan da girebilirsin)</Row>
        <Row k="/dışarı">evden şehre dön</Row>
        <Row k="/davet Elif">çevrimiçi birini evine çağır (yakınındaki oyuncu kartından 🏠 ile de olur)</Row>
        <Row k="/ziyaret Elif">açık ya da davetli olduğun bir eve git</Row>
        <Row k="/kapı aç">evini herkese aç · /kapı kapat: yalnızca davetliler</Row>
        <Row k="/yardım">bu paneli aç</Row>
      </ul>

      <h3 className="mt-4 text-sm font-extrabold uppercase tracking-wide text-[#fdb252]">Flört 💗</h3>
      <ul className="mt-2 flex flex-col gap-2">
        <Row k="Karaktere tıkla">ya da yakındaki kartta 💗: kalp, çiçek, göz kırp, öpücük, selam, dans</Row>
        <Row k="🤫 Fısılda">yalnızca o kişi duyar; etraftakiler yazdığını görmez</Row>
        <Row k="💞 Eşleşme">ikiniz de birbirine kalp gönderirseniz (10 dk içinde) eşleşirsiniz</Row>
      </ul>

      <h3 className="mt-4 text-sm font-extrabold uppercase tracking-wide text-[#fdb252]">Mekanlar</h3>
      <ul className="mt-2 flex flex-col gap-1 text-sm font-semibold text-[#4a3b5c]">
        {ZONES.map((z) => (
          <li key={z.id}>
            {z.emoji} <b>{z.name}</b> <span className="text-[#8a7a9c]">— {z.desc}</span>
          </li>
        ))}
      </ul>

      <p className="mt-4 rounded-2xl bg-[#ffedd6]/60 px-4 py-3 text-xs font-bold text-[#4a3b5c]">
        🤝 Herkese saygılı ol. Rahatsız edici biriyle karşılaşırsan konuşmayı bırak ve uzaklaş.
      </p>

      <div className="mt-5">
        <ToyButton onClick={onClose}>Anladım</ToyButton>
      </div>
    </Modal>
  )
}

// ---------- kamera eğitimi: el sağa-sola sürükler ----------
/** İlk şehir girişinde bir kez: animasyonlu el kamerayı çevirmeyi gösterir. İlk gerçek sürüklemede ya da ~10 sn sonra kapanır. */
export function CameraTutorial({ touch, onDone }) {
  // başka bir pencere (evcil hayvan seçimi vb.) açıkken el gösterilmez
  const [blocked, setBlocked] = useState(false)
  useEffect(() => {
    const id = setInterval(() => setBlocked(Boolean(document.querySelector('[role="dialog"][aria-modal="true"]'))), 300)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    if (blocked) return undefined
    const t = setTimeout(onDone, 10000)
    let dist = 0
    let last = null
    const move = (e) => {
      if (e.pointerType === 'mouse' && e.buttons === 0) return
      if (last) dist += Math.abs(e.clientX - last.x)
      last = { x: e.clientX }
      if (dist > 160) onDone()
    }
    const up = () => (last = null)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      clearTimeout(t)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [onDone, blocked])
  if (blocked) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[22%] z-30 grid place-items-center" role="status">
      <div className="flex w-[min(21rem,calc(100vw-1.5rem))] animate-pop flex-col items-center gap-2 rounded-[2rem] border-2 border-white bg-white/85 px-5 pb-4 pt-3 shadow-toy backdrop-blur-md">
        <div className="relative flex h-24 w-full items-center justify-center">
          <span className="absolute left-3 text-4xl font-black text-[#fdb252]" style={{ animation: 'hand-arrow 1.8s ease-in-out infinite' }}>‹</span>
          <span className="absolute right-3 text-4xl font-black text-[#fdb252]" style={{ animation: 'hand-arrow 1.8s ease-in-out 0.9s infinite' }}>›</span>
          <div className="absolute h-1.5 w-40 rounded-full bg-gradient-to-r from-transparent via-[#fdb252]/50 to-transparent" />
          <div style={{ animation: 'hand-drag 2.4s ease-in-out infinite' }}>
            <div style={{ animation: 'hand-press 2.4s ease-in-out infinite', filter: 'drop-shadow(0 6px 8px rgba(74,59,92,.3))' }}>
              <Ico name="hand" size={64} />
            </div>
          </div>
        </div>
        <p className="text-center text-sm font-black text-[#4a3b5c]">Kamerayı çevir</p>
        <p className="text-center text-xs font-bold text-[#8a7a9c]">
          {touch ? 'Parmağını ekranda sağa-sola kaydır. İki parmakla yakınlaştır.' : 'Sol tuşu basılı tutup sağa-sola sürükle. Tekerlekle yakınlaştır.'}
        </p>
      </div>
    </div>
  )
}

// ---------- ilk girişte tek, küçük yönlendirme kartı ----------
/**
 * Ekranı kalabalıklaştırmamak için tek kutu, şehirde sırayla 2 adım: kamerayı çevirme (mobil/masaüstü ayrı) → bisiklet.
 * Evde/mekânda görünmez (orada kendi istemleri var). Bittiğinde (ya da ✕ ile) onDone çağrılır; tekrar gösterilmez.
 */
export function StartGuide({ touch, ready = true, inCity, inAirport = false, onDone }) {
  const [stage, setStage] = useState('camera') // camera | bike
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (!ready || !(inCity || inAirport)) return
    const t = setTimeout(() => setShown(true), inAirport ? 2600 : 1500)
    return () => clearTimeout(t)
  }, [ready, inCity, inAirport])

  useEffect(() => {
    if (!shown || !inCity) return
    const next = () => (stage === 'camera' ? setStage('bike') : onDone())
    const t = setTimeout(next, stage === 'camera' ? 12000 : 9000)
    let moved = 0
    const onMove = (e) => {
      if (stage !== 'camera' || (e.pointerType === 'mouse' && e.buttons === 0)) return
      if (++moved > 12) next()
    }
    window.addEventListener('pointermove', onMove)
    return () => {
      clearTimeout(t)
      window.removeEventListener('pointermove', onMove)
    }
  }, [shown, inCity, stage, onDone])

  if (shown && inAirport && !inCity) {
    return (
      <div className={`pointer-events-auto absolute left-1/2 top-[5.6rem] z-10 flex w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 animate-pop items-center gap-3 rounded-2xl py-2 pl-3 pr-3 ${glass}`} role="status">
        <span className="text-2xl">🔑</span>
        <p className="text-xs font-extrabold leading-snug text-[#4a3b5c]">Kiralama memuru Selin’le konuş: <b className="text-[#fdb252]">bisiklet kirala</b>, sonra karşıdaki kapıdan şehre çık.</p>
      </div>
    )
  }
  if (!shown || !inCity) return null
  if (stage === 'camera') return <CameraTutorial touch={touch} onDone={() => setStage('bike')} />
  const text =
    stage === 'camera' ? (
      touch ? (
        <>Kamerayı çevirmek için ekranda parmağını <b className="text-[#fdb252]">sağa-sola kaydır</b>. İki parmakla yakınlaştır.</>
      ) : (
        <>Kamerayı çevirmek için sol tuşa basıp <b className="text-[#fdb252]">sağa-sola sürükle</b>. Tekerlekle yakınlaştır.</>
      )
    ) : touch ? (
      <>Soldaki <b className="text-[#fdb252]">🚲 düğmesi</b> bisiklet kiralar (20 🪙) ve hızlıca gezdirir.</>
    ) : (
      <><b className="text-[#fdb252]">B</b> tuşu (ya da soldaki 🚲) bisiklet kiralar (20 🪙) ve hızlıca gezdirir.</>
    )
  const icon = stage === 'camera' ? (touch ? '👆' : '🎥') : '🚲'
  return (
    <div className={`pointer-events-auto absolute left-1/2 top-[5.6rem] z-10 flex w-[min(20rem,calc(100vw-1.5rem))] -translate-x-1/2 animate-pop items-center gap-3 rounded-2xl py-2 pl-3 pr-8 ${glass}`} role="status" key={stage}>
      <span className="text-2xl">{icon}</span>
      <p className="text-xs font-extrabold leading-snug text-[#4a3b5c]">{text}</p>
      <button onClick={onDone} aria-label="İpucunu kapat" className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full text-[10px] font-black text-[#8a7a9c] hover:bg-[#ffedd6]/70">
        ✕
      </button>
    </div>
  )
}
