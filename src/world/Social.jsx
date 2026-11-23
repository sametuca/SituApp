import { useEffect, useRef, useState } from 'react'
import { ToyButton } from '../components/ui'

const glass = 'border-2 border-white bg-white/80 shadow-soft backdrop-blur-md'

const QUICK_REPLIES = ['Merhaba 👋', 'Nasılsın?', 'Kahve içelim mi? ☕', 'Dans edelim mi? 💃', 'Yürüyüşe çıkalım mı? 🌳']

// ---------- sanal joystick (dokunmatik cihazlar) ----------
const BASE = 132
const KNOB = 56
const MAX = (BASE - KNOB) / 2 + 6

/**
 * Sol altta sanal joystick. inputRef.current = { x, y } (-1..1; y aşağı = geri) değerini günceller.
 * Kenara kadar itersen (>%85) karakter koşar.
 */
export function Joystick({ inputRef }) {
  const base = useRef(null)
  const pointer = useRef(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const [running, setRunning] = useState(false)
  const [dragging, setDragging] = useState(false)

  const apply = (e) => {
    const r = base.current.getBoundingClientRect()
    let dx = e.clientX - (r.left + r.width / 2)
    let dy = e.clientY - (r.top + r.height / 2)
    const d = Math.hypot(dx, dy)
    if (d > MAX) {
      dx = (dx / d) * MAX
      dy = (dy / d) * MAX
    }
    setKnob({ x: dx, y: dy })
    inputRef.current.x = dx / MAX
    inputRef.current.y = dy / MAX
    setRunning(Math.hypot(dx, dy) / MAX > 0.85)
  }
  const release = (e) => {
    if (pointer.current !== e.pointerId) return
    pointer.current = null
    inputRef.current.x = 0
    inputRef.current.y = 0
    setKnob({ x: 0, y: 0 })
    setRunning(false)
    setDragging(false)
  }

  return (
    <div
      ref={base}
      role="application"
      aria-label="Hareket joystick'i"
      className={`absolute z-10 touch-none select-none rounded-full ${glass} ${running ? 'ring-4 ring-[#a9ddf5]' : ''}`}
      style={{ width: BASE, height: BASE, left: 'max(1.25rem, env(safe-area-inset-left))', bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      onPointerDown={(e) => {
        if (pointer.current !== null) return
        pointer.current = e.pointerId
        setDragging(true)
        try {
          e.currentTarget.setPointerCapture(e.pointerId) // parmak joystick'ten kaysa bile takip et
        } catch {
          /* bazı tarayıcılarda yapay olaylarda desteklenmez */
        }
        apply(e)
      }}
      onPointerMove={(e) => pointer.current === e.pointerId && apply(e)}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div
        className={`absolute rounded-full border-2 border-white shadow-md ${running ? 'bg-[#5fc0ea]' : 'bg-[#ff7eb3]'}`}
        style={{
          width: KNOB,
          height: KNOB,
          left: (BASE - KNOB) / 2,
          top: (BASE - KNOB) / 2,
          transform: `translate(${knob.x}px, ${knob.y}px)`,
          transition: dragging ? 'none' : 'transform 120ms ease-out',
        }}
      />
      <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center text-xl opacity-30">
        ✥
      </span>
    </div>
  )
}

// ---------- yakındaki oyuncu kartı ----------
export function NearbyCard({ peer, touch, onChat, onDismiss }) {
  return (
    <div
      className={`absolute left-1/2 z-10 w-[min(92vw,20rem)] -translate-x-1/2 animate-pop ${touch ? 'bottom-44' : 'bottom-4'}`}
      role="status"
    >
      <div className={`flex items-center gap-3 rounded-3xl p-2.5 pr-3 ${glass}`}>
        <img src={`/avatars/${peer.avatar}.png`} alt="" width="44" height="44" className="h-11 w-11 shrink-0 rounded-full border-2 border-white bg-white/60 object-cover object-top" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-[#4a3b5c]">{peer.name}</p>
          <p className="text-xs font-bold text-[#8a7a9c]">yakınında 👋</p>
        </div>
        <div className="w-28 shrink-0">
          <ToyButton className="!rounded-xl !py-2 !text-sm" onClick={onChat}>
            💬 Sohbet
          </ToyButton>
        </div>
        <button onClick={onDismiss} aria-label="Kapat" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black text-[#8a7a9c] hover:bg-[#ffd6e8]/70">
          ✕
        </button>
      </div>
    </div>
  )
}

// ---------- kapı ("Eve gir" / "Dışarı çık") ----------
export function DoorPrompt({ emoji, label, action, touch, raised, onGo }) {
  return (
    <div
      className={`absolute left-1/2 z-10 w-[min(92vw,20rem)] -translate-x-1/2 animate-pop ${touch ? (raised ? 'bottom-64' : 'bottom-44') : raised ? 'bottom-24' : 'bottom-4'}`}
      role="status"
    >
      <div className={`flex items-center gap-3 rounded-3xl p-2.5 pl-4 ${glass}`}>
        <span className="text-2xl" aria-hidden>
          {emoji}
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-black text-[#4a3b5c]">{label}</p>
        <div className="w-32 shrink-0">
          <ToyButton className="!rounded-xl !py-2 !text-sm" onClick={onGo}>
            {touch ? action : `E · ${action}`}
          </ToyButton>
        </div>
      </div>
    </div>
  )
}

// ---------- gelen özel mesaj bildirimi ----------
export function IncomingChip({ from, onOpen, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 8000)
    return () => clearTimeout(t)
  }, [from, onClose])
  return (
    <button
      onClick={onOpen}
      className={`absolute left-1/2 top-24 z-20 w-[min(92vw,20rem)] -translate-x-1/2 animate-pop rounded-3xl px-4 py-2.5 text-left ${glass}`}
    >
      <p className="text-xs font-extrabold text-[#ff7eb3]">💌 {from.name} sana yazdı</p>
      <p className="truncate text-sm font-semibold text-[#4a3b5c]">{from.text}</p>
    </button>
  )
}

// ---------- sohbet çekmecesi (özel veya herkese açık) ----------
export function ChatSheet({ peer, feed, onSend, onClose, touch }) {
  const [text, setText] = useState('')
  const list = useRef(null)
  const input = useRef(null)

  const messages = feed.filter((m) =>
    peer ? m.kind === 'chat' && m.dm && (m.id === peer.id || m.to === peer.id) : m.kind === 'system' || !m.dm,
  )

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [messages.length])
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  useEffect(() => {
    if (!touch) input.current?.focus() // telefonda klavye kendiliğinden açılmasın
  }, [touch])

  const submit = (e) => {
    e.preventDefault()
    const t = text.trim()
    if (t) onSend(t)
    setText('')
  }

  return (
    <div
      className={`absolute z-20 flex flex-col gap-3 bg-white/92 p-4 shadow-toy backdrop-blur-md animate-pop ${
        touch ? 'inset-x-0 bottom-0 max-h-[72svh] rounded-t-[2rem] border-t-2 border-white pb-[max(1rem,env(safe-area-inset-bottom))]' : 'bottom-3 left-3 w-[22rem] rounded-[2rem] border-2 border-white'
      }`}
      role="dialog"
      aria-label={peer ? `${peer.name} ile sohbet` : 'Sohbet'}
    >
      <div className="flex items-center gap-3">
        {peer ? (
          <img src={`/avatars/${peer.avatar}.png`} alt="" width="40" height="40" className="h-10 w-10 rounded-full border-2 border-white bg-white/60 object-cover object-top" />
        ) : (
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#d6c7ff]/60 text-xl">💬</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-black text-[#4a3b5c]">{peer ? peer.name : 'Herkese açık sohbet'}</p>
          <p className="text-xs font-bold text-[#8a7a9c]">{peer ? 'Özel sohbet · sadece ikiniz görürsünüz' : 'Yakındaki herkes duyar'}</p>
        </div>
        <button onClick={onClose} aria-label="Sohbeti kapat" className="grid h-9 w-9 place-items-center rounded-full text-sm font-black text-[#8a7a9c] hover:bg-[#ffd6e8]/70">
          ✕
        </button>
      </div>

      <div ref={list} className="flex min-h-24 flex-1 flex-col gap-1.5 overflow-y-auto" role="log" aria-live="polite" style={{ maxHeight: touch ? '32svh' : '14rem' }}>
        {messages.length === 0 && <p className="m-auto text-center text-sm font-semibold text-[#8a7a9c]">{peer ? `${peer.name} ile ilk mesajı sen at 👋` : 'Henüz mesaj yok.'}</p>}
        {messages.map((m, i) => (
          <p
            key={`${m.ts}-${i}`}
            className={`max-w-[85%] break-words rounded-2xl px-3 py-1.5 text-sm font-semibold ${
              m.kind === 'system' ? 'w-fit bg-[#ff7eb3]/90 text-white' : m.self ? 'self-end bg-[#a9ddf5] text-[#2f4a5c]' : 'self-start bg-[#f1e6ff] text-[#4a3b5c]'
            }`}
          >
            {m.kind === 'system' ? `🧭 ${m.text}` : !peer && !m.self ? <><b>{m.name}: </b>{m.text}</> : m.text}
          </p>
        ))}
      </div>

      {peer && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {QUICK_REPLIES.map((q) => (
            <button
              key={q}
              onClick={() => onSend(q)}
              className="shrink-0 rounded-full border-2 border-white bg-[#ffd6e8]/70 px-3 py-1.5 text-xs font-extrabold text-[#4a3b5c] active:scale-95"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="flex gap-2">
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={140}
          autoComplete="off"
          enterKeyHint="send"
          aria-label="Mesaj"
          placeholder="Mesaj yaz…"
          className="min-w-0 flex-1 rounded-2xl border-2 border-[#d6c7ff]/70 bg-white px-4 py-2.5 text-base font-semibold text-[#4a3b5c] outline-none placeholder:text-[#8a7a9c]/60 focus:ring-4 focus:ring-[#d6c7ff]/60"
        />
        <button type="submit" aria-label="Gönder" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border-b-4 border-[#e85a98] bg-[#ff7eb3] text-lg text-white active:translate-y-0.5 active:border-b-2">
          ➤
        </button>
      </form>
    </div>
  )
}

// ---------- dokunmatik cihaz: sohbet aç düğmesi ----------
export function ChatFab({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Sohbeti aç"
      className={`absolute z-10 grid h-14 w-14 place-items-center rounded-full text-2xl ${glass}`}
      style={{ right: 'max(1rem, env(safe-area-inset-right))', bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
    >
      💬
    </button>
  )
}
