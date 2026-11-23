import { useEffect, useRef, useState } from 'react'
import { ToyButton } from '../components/ui'
import { BUILDINGS, GUIDE, ROAD_HALF, ZONES } from './layout'

const glass = 'border-2 border-white bg-white/75 shadow-soft backdrop-blur-md'

// ---------- üst çubuk ----------
// extraButtons: özellik modüllerinin düğmeleri [{ key, emoji, label, onClick, badge? }] (sol sütunda, geri düğmesinin altında)
export function TopBar({ zone, online, status, dnd, onExit, onHelp, onSettings, extraButtons = [] }) {
  const dot = status === 'online' ? 'bg-emerald-400' : status === 'connecting' ? 'bg-amber-400' : 'bg-rose-400'
  const label = status === 'online' ? `${online} çevrimiçi` : status === 'connecting' ? 'Bağlanıyor…' : 'Çevrimdışı (tek başına)'
  return (
    <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-start justify-between gap-2 px-3 py-3">
      <div className="pointer-events-auto flex flex-col gap-2">
        <button
          onClick={onExit}
          aria-label="Karakter seçimine dön"
          className={`grid h-10 w-10 place-items-center rounded-full text-lg font-black text-[#4a3b5c] transition hover:bg-white ${glass}`}
        >
          ←
        </button>
        {extraButtons.map((b) => (
          <button key={b.key} onClick={b.onClick} aria-label={b.label} title={b.label} className={`relative grid h-10 w-10 place-items-center rounded-full text-lg transition hover:bg-white active:scale-95 ${glass}`}>
            {b.emoji}
            {b.badge ? <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#ff7eb3] px-1 text-[10px] font-black text-white">{b.badge}</span> : null}
          </button>
        ))}
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 ${glass}`}>
          <span>{zone.emoji}</span>
          <span className="text-sm font-extrabold text-[#4a3b5c]">{zone.name}</span>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold text-[#8a7a9c] ${glass}`}>
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          {label}
          {dnd && <span title="Rahatsız etme açık"> · 🌙</span>}
        </div>
      </div>
      <div className="pointer-events-auto flex gap-2">
        {onSettings && (
          <button onClick={onSettings} aria-label="Ayarlar" className={`grid h-10 w-10 place-items-center rounded-full text-lg transition hover:bg-white ${glass}`}>
            ⚙️
          </button>
        )}
        <button
          onClick={onHelp}
          aria-label="Yardım"
          className={`grid h-10 w-10 place-items-center rounded-full text-lg font-black text-[#ff7eb3] transition hover:bg-white ${glass}`}
        >
          ?
        </button>
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
const MAP = 150
const RANGE = 48 // harita ±48 m
const toMap = (v) => ((v + RANGE) / (RANGE * 2)) * MAP

export function Minimap({ focusRef, remotes, compact }) {
  const canvas = useRef(null)
  useEffect(() => {
    const ctx = canvas.current.getContext('2d')
    const draw = () => {
      ctx.clearRect(0, 0, MAP, MAP)
      ctx.fillStyle = '#d4f3dc'
      ctx.fillRect(0, 0, MAP, MAP)
      ctx.fillStyle = '#9fd8f5' // deniz
      ctx.fillRect(0, toMap(46), MAP, MAP)
      ctx.fillStyle = '#ffe9b8' // kum
      ctx.fillRect(toMap(-14), toMap(30), toMap(14) - toMap(-14), toMap(46) - toMap(30))
      ctx.fillStyle = '#e4d9f2' // yollar
      ctx.fillRect(toMap(-ROAD_HALF), 0, toMap(ROAD_HALF) - toMap(-ROAD_HALF), MAP)
      ctx.fillRect(0, toMap(-ROAD_HALF), MAP, toMap(ROAD_HALF) - toMap(-ROAD_HALF))
      ctx.fillStyle = '#fff3f8' // meydan
      ctx.beginPath()
      ctx.arc(toMap(0), toMap(0), toMap(11) - toMap(0), 0, Math.PI * 2)
      ctx.fill()
      for (const b of BUILDINGS) {
        if (b.gazebo) continue
        ctx.fillStyle = b.roof
        ctx.fillRect(toMap(b.x - b.w / 2), toMap(b.z - b.d / 2), (b.w / (RANGE * 2)) * MAP, (b.d / (RANGE * 2)) * MAP)
      }
      ctx.fillStyle = '#ff7eb3'
      ctx.beginPath()
      ctx.arc(toMap(GUIDE.x), toMap(GUIDE.z), 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#a88bff'
      for (const r of remotes.current.values()) {
        ctx.beginPath()
        ctx.arc(toMap(r.x), toMap(r.z), 3.2, 0, Math.PI * 2)
        ctx.fill()
      }
      // kendin: yönü gösteren üçgen
      const f = focusRef.current
      ctx.save()
      ctx.translate(toMap(f.x), toMap(f.z))
      ctx.rotate(-f.ry + Math.PI)
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = '#e85a98'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, -6)
      ctx.lineTo(4.5, 5)
      ctx.lineTo(-4.5, 5)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }
    draw()
    const timer = setInterval(draw, 120)
    return () => clearInterval(timer)
  }, [focusRef, remotes])

  return (
    <div className={`pointer-events-none absolute right-3 top-16 z-10 overflow-hidden rounded-2xl p-1 ${glass}`} aria-label="Harita">
      <canvas ref={canvas} width={MAP} height={MAP} className="block rounded-xl" style={{ width: MAP * (compact ? 0.62 : 0.85), height: MAP * (compact ? 0.62 : 0.85) }} />
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
                ? 'bg-[#ff7eb3]/90 text-white'
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
      <span className={`rounded-full px-3 py-1.5 ${glass}`}>WASD yürü · Shift koş · Enter sohbet · H yardım</span>
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

      <h3 className="mt-4 text-sm font-extrabold uppercase tracking-wide text-[#ff7eb3]">Hareket</h3>
      <ul className="mt-2 flex flex-col gap-2">
        <Row k="W A S D">veya ok tuşlarıyla yürü</Row>
        <Row k="Shift">basılı tut, koş</Row>
        <Row k="E">kapının önündeyken içeri gir / dışarı çık</Row>
        <Row k="Fare">sürükle: kamerayı döndür · tekerlek: yakınlaştır</Row>
      </ul>

      <h3 className="mt-4 text-sm font-extrabold uppercase tracking-wide text-[#ff7eb3]">Sohbet</h3>
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

      <h3 className="mt-4 text-sm font-extrabold uppercase tracking-wide text-[#ff7eb3]">Flört 💗</h3>
      <ul className="mt-2 flex flex-col gap-2">
        <Row k="Karaktere tıkla">ya da yakındaki kartta 💗: kalp, çiçek, göz kırp, öpücük, selam, dans</Row>
        <Row k="🤫 Fısılda">yalnızca o kişi duyar; etraftakiler yazdığını görmez</Row>
        <Row k="💞 Eşleşme">ikiniz de birbirine kalp gönderirseniz (10 dk içinde) eşleşirsiniz</Row>
      </ul>

      <h3 className="mt-4 text-sm font-extrabold uppercase tracking-wide text-[#ff7eb3]">Mekanlar</h3>
      <ul className="mt-2 flex flex-col gap-1 text-sm font-semibold text-[#4a3b5c]">
        {ZONES.map((z) => (
          <li key={z.id}>
            {z.emoji} <b>{z.name}</b> <span className="text-[#8a7a9c]">— {z.desc}</span>
          </li>
        ))}
      </ul>

      <p className="mt-4 rounded-2xl bg-[#ffd6e8]/60 px-4 py-3 text-xs font-bold text-[#4a3b5c]">
        🤝 Herkese saygılı ol. Rahatsız edici biriyle karşılaşırsan konuşmayı bırak ve uzaklaş.
      </p>

      <div className="mt-5">
        <ToyButton onClick={onClose}>Anladım</ToyButton>
      </div>
    </Modal>
  )
}

// ---------- ilk girişte köşede beliren küçük ipuçları ----------
const TIPS = [
  { emoji: '🚶', title: 'Yürümek için', text: 'W A S D ya da ok tuşları. Shift ile koşarsın.' },
  { emoji: '💬', title: 'Sohbet', text: 'Enter’a bas, yaz, tekrar Enter. /yardım ile komutlar.' },
  { emoji: '💗', title: 'Etkileşim', text: 'Birine tıkla: kalp, çiçek ya da fısıltı 🤫. 1-9 tuşları emoji uçurur.' },
  { emoji: '🗺️', title: 'Harita', text: 'Sağ üstteki haritadan yolunu bul. Rehber lobide, çeşmenin yanında.' },
]
const TIP_START_MS = 1500
const TIP_GAP_MS = 6000
const TIP_LIFETIME_MS = 9000

/** Tek tek, sırayla beliren küçük pastel kutucuklar. Kendiliğinden kaybolur, ✕ ile kapatılır. */
export function TipStack({ onDone }) {
  const [visible, setVisible] = useState([])
  useEffect(() => {
    const timers = []
    TIPS.forEach((_, i) => {
      timers.push(setTimeout(() => setVisible((v) => [...v, i]), TIP_START_MS + i * TIP_GAP_MS))
      timers.push(setTimeout(() => setVisible((v) => v.filter((x) => x !== i)), TIP_START_MS + i * TIP_GAP_MS + TIP_LIFETIME_MS))
    })
    timers.push(setTimeout(onDone, TIP_START_MS + (TIPS.length - 1) * TIP_GAP_MS + TIP_LIFETIME_MS))
    return () => timers.forEach(clearTimeout)
  }, [onDone])

  if (!visible.length) return null
  return (
    <div className="absolute right-3 top-[14.5rem] z-10 flex w-52 flex-col gap-2" aria-live="polite">
      {visible.map((i) => (
        <div key={i} className={`relative animate-pop rounded-2xl py-2 pl-3 pr-7 ${glass}`}>
          <p className="text-xs font-extrabold text-[#4a3b5c]">
            {TIPS[i].emoji} {TIPS[i].title}
          </p>
          <p className="text-xs font-semibold leading-snug text-[#8a7a9c]">{TIPS[i].text}</p>
          <button
            onClick={() => setVisible((v) => v.filter((x) => x !== i))}
            aria-label="İpucunu kapat"
            className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full text-[10px] font-black text-[#8a7a9c] hover:bg-[#ffd6e8]/70"
          >
            ✕
          </button>
        </div>
      ))}
      <button onClick={onDone} className="self-end rounded-full px-2 text-[11px] font-bold text-[#8a7a9c]/80 hover:text-[#8a7a9c]">
        ipuçlarını kapat
      </button>
    </div>
  )
}
