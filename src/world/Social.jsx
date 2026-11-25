import { useEffect, useRef, useState } from 'react'
import { Ico } from '../components/Icon'
import { ToyButton } from '../components/ui'
import { MicButton, StickerBubble, StickerPanel, VoiceBubble } from './features/media'
import { CHAT_EMOJIS, GESTURES, GESTURE_BY_KIND, QUICK_REPLIES, REACTIONS, SKILL_COOLDOWN_MS, SKILLS, WHISPER_RANGE } from './interact'
import { levelOf } from './collectibles'
import Portrait from './Portrait'

const glass = 'border-2 border-white bg-white/80 shadow-soft backdrop-blur-md'


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
        className={`absolute rounded-full border-2 border-white shadow-md ${running ? 'bg-[#5fc0ea]' : 'bg-[#fdb252]'}`}
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
export function NearbyCard({ peer, touch, onChat, onInteract, onDismiss }) {
  return (
    <div
      className={`pointer-events-auto absolute left-1/2 z-20 w-[min(94vw,24rem)] -translate-x-1/2 animate-pop ${touch ? 'bottom-[13rem]' : 'bottom-[7.75rem]'}`}
      role="status"
    >
      <div className={`flex items-center gap-3 rounded-3xl p-2.5 pr-3 ${glass}`}>
        <Portrait peer={peer} size={44} className="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-[#4a3b5c]">{peer.name}</p>
          <p className="text-xs font-bold text-[#8a7a9c]">yakınında 👋</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button onClick={onInteract} aria-label="Etkileşim menüsü" title="Kalp, çiçek, fısıltı…" className="grid h-10 w-10 place-items-center rounded-xl border-b-4 border-[#e8952c] bg-[#fecb89] text-lg shadow-soft active:translate-y-[2px] active:border-b-2">
            💗
          </button>
          <div className="w-28">
            <ToyButton className="!rounded-xl !py-2 !text-sm" onClick={onChat}>
              💬 Sohbet
            </ToyButton>
          </div>
        </div>
        <button onClick={onDismiss} aria-label="Kapat" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black text-[#8a7a9c] hover:bg-[#ffedd6]/70">
          ✕
        </button>
      </div>
    </div>
  )
}

// ---------- kapı ("Eve gir" / "Dışarı çık" / etkileşim istemi — SkillBar'ın hemen üstünde) ----------
export function DoorPrompt({ emoji, label, action, touch, raised, onGo }) {
  return (
    <div
      className={`pointer-events-auto absolute left-1/2 z-20 w-[min(92vw,21rem)] -translate-x-1/2 animate-pop ${touch ? (raised ? 'bottom-[17.5rem]' : 'bottom-[13rem]') : raised ? 'bottom-[12.25rem]' : 'bottom-[7.75rem]'}`}
      role="status"
    >
      <div className={`flex items-center gap-3 rounded-3xl p-2.5 pl-4 ${glass}`}>
        {emoji && (
          <span className="text-2xl" aria-hidden>
            {emoji}
          </span>
        )}
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

// ---------- emoji tepki çubuğu ----------
export function ReactionBar({ onReact, touch }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="absolute z-10"
      style={touch ? { right: 'calc(max(1rem, env(safe-area-inset-right)) + 4.6rem)', bottom: 'max(1.5rem, env(safe-area-inset-bottom))' } : { right: '0.75rem', bottom: '4rem' }}
    >
      {open && (
        <div className={`absolute bottom-full right-0 mb-2 grid w-max animate-pop grid-cols-4 gap-1.5 rounded-3xl p-2 ${glass}`} role="menu" aria-label="Emoji tepkileri">
          {REACTIONS.map((e, i) => (
            <button
              key={e}
              role="menuitem"
              onClick={() => {
                onReact(e)
                setOpen(false)
              }}
              className="relative grid h-12 w-12 place-items-center rounded-2xl text-2xl transition hover:bg-[#ffedd6]/70 active:scale-90"
            >
              {e}
              {!touch && i < 10 && <span className="absolute bottom-0 right-1 text-[10px] font-black text-[#8a7a9c]">{(i + 1) % 10}</span>}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Emoji tepkisi gönder"
        aria-expanded={open}
        className={`grid ${touch ? 'h-16 w-16 text-3xl' : 'h-14 w-14 text-2xl'} place-items-center rounded-full transition hover:bg-white ${glass}`}
      >
        <Ico name="smile" size={touch ? 34 : 32} />
      </button>
    </div>
  )
}

// ---------- alt beceri ve EXP çubuğu (Skill 1-4 · 5 sn bekleme) ----------
export function SkillBar({ xp = 0, cooldowns, onSkill, onOpenExp, touch }) {
  const [now, setNow] = useState(() => Date.now())
  const hasCd = SKILLS.some((s) => (cooldowns[s.id] ?? 0) > now)

  useEffect(() => {
    if (!hasCd) return
    const t = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(t)
  }, [hasCd])

  const lv = levelOf(xp)
  const pct = Math.min(100, Math.round((lv.into / (lv.span || 1)) * 100))

  return (
    <div
      className={`pointer-events-auto absolute left-1/2 z-10 flex w-[min(92vw,21rem)] -translate-x-1/2 flex-col gap-1.5 rounded-3xl px-2.5 py-2 ${glass} ${touch ? 'bottom-[6.25rem] sm:bottom-3' : 'bottom-3'}`}
      aria-label="Beceri ve deneyim çubuğu"
    >
      <div className="grid grid-cols-4 gap-1.5">
        {SKILLS.map((sk) => {
          const rem = Math.min(SKILL_COOLDOWN_MS, Math.max(0, (cooldowns[sk.id] ?? 0) - now))
          const onCd = rem > 0
          const fillPct = onCd ? Math.min(100, (rem / SKILL_COOLDOWN_MS) * 100) : 0
          const secs = Math.ceil(rem / 1000)
          return (
            <button
              key={sk.id}
              type="button"
              disabled={onCd}
              onClick={() => onSkill(sk)}
              title={`${sk.label} (${sk.key}) · 5 sn`}
              aria-label={`${sk.label}${onCd ? ` (${secs} saniye bekle)` : ''}`}
              className={`relative flex h-12 flex-col items-center justify-center overflow-hidden rounded-2xl border-2 transition ${
                onCd ? 'cursor-not-allowed border-white/70 bg-[#ede6fa]' : 'border-white bg-[#faf6ff] shadow-sm hover:-translate-y-0.5 hover:bg-white active:scale-95'
              }`}
            >
              {!touch && (
                <span className="absolute left-1.5 top-0.5 text-[9px] font-black text-[#8a7a9c]">
                  {sk.key}
                </span>
              )}
              <span className={`text-xl leading-none ${onCd ? 'opacity-45 grayscale-[35%]' : ''}`}>{sk.emoji}</span>
              <span className="mt-0.5 text-[10px] font-extrabold leading-none text-[#5b4a70]">{sk.label}</span>
              {onCd && (
                <>
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-[#4a3b5c]/35 transition-[height] duration-100" style={{ height: `${fillPct}%` }} />
                  <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm font-black text-white drop-shadow-[0_1px_3px_rgba(74,59,92,0.85)] tabular-nums">
                    {secs}
                  </span>
                </>
              )}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        onClick={onOpenExp}
        title="Koleksiyon ve seviye ilerlemesini aç"
        className="flex items-center gap-2 rounded-2xl bg-[#faf6ff]/90 px-2 py-1 text-left transition hover:bg-white active:scale-[0.99]"
      >
        <span className="shrink-0 rounded-full bg-[#ffe48f] px-2 py-0.5 text-[10px] font-black text-[#7a5b00]">
          Sv. {lv.level}
        </span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#eadfff]">
          <div className="h-full rounded-full bg-gradient-to-r from-[#ffe48f] via-[#fdb252] to-[#ff9248] transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="shrink-0 text-[10px] font-black tabular-nums text-[#6b4fc0]">
          EXP {lv.into}/{lv.span}
        </span>
      </button>
    </div>
  )
}

// ---------- etkileşim menüsü (bir oyuncuya kalp, çiçek, fısıltı…) ----------
export function InteractSheet({ peer, near, canInvite, touch, extras = [], header = null, onClose, onChat, onGesture, onWhisper, onInvite }) {
  const [whisper, setWhisper] = useState(false)
  const [text, setText] = useState('')
  const input = useRef(null)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  useEffect(() => {
    if (whisper && !touch) input.current?.focus()
  }, [whisper, touch])

  const sendWhisper = (e) => {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    onWhisper(t)
    setText('')
  }

  return (
    <div
      className={`absolute z-20 flex flex-col gap-3 bg-white/92 p-4 shadow-toy backdrop-blur-md animate-pop ${
        touch ? 'inset-x-0 bottom-0 rounded-t-[2rem] border-t-2 border-white pb-[max(1rem,env(safe-area-inset-bottom))]' : 'bottom-3 left-3 w-[22rem] rounded-[2rem] border-2 border-white'
      }`}
      role="dialog"
      aria-label={`${peer.name} ile etkileşim`}
    >
      <div className="flex items-center gap-3">
        <Portrait peer={peer} size={48} className="h-12 w-12" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-black text-[#4a3b5c]">{peer.name}</p>
          <p className={`text-xs font-bold ${near ? 'text-emerald-500' : 'text-[#8a7a9c]'}`}>
            {peer.dnd ? '🌙 rahatsız etme açık · şimdilik ulaşılamaz' : near ? 'yakınında · jestler açık' : 'biraz uzakta · jest için yaklaş'}
          </p>
        </div>
        <button onClick={onClose} aria-label="Kapat" className="grid h-9 w-9 place-items-center rounded-full text-sm font-black text-[#8a7a9c] hover:bg-[#ffedd6]/70">
          ✕
        </button>
      </div>

      {header}

      <div className="grid grid-cols-3 gap-2">
        {GESTURES.map((g) => (
          <button
            key={g.kind}
            onClick={() => onGesture(g.kind)}
            disabled={!near}
            className="flex flex-col items-center gap-0.5 rounded-2xl border-2 border-white bg-[#fff2e3]/80 py-2 text-[#4a3b5c] transition active:scale-95 enabled:hover:bg-[#ffead0] disabled:opacity-45"
          >
            <span className="text-2xl">{g.emoji}</span>
            <span className="text-[11px] font-extrabold">{g.label}</span>
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={onChat} className="flex-1 rounded-2xl border-b-4 border-[#e8952c] bg-[#fdb252] py-2 text-sm font-extrabold text-white active:translate-y-[2px] active:border-b-2">
          💬 Sohbet
        </button>
        <button
          onClick={() => setWhisper((w) => !w)}
          aria-pressed={whisper}
          className={`flex-1 rounded-2xl border-b-4 py-2 text-sm font-extrabold active:translate-y-[2px] active:border-b-2 ${whisper ? 'border-[#8a6bd1] bg-[#a88bff] text-white' : 'border-[#c9b6f5] bg-[#e9ddff] text-[#5b3fa8]'}`}
        >
          🤫 Fısılda
        </button>
        {canInvite && (
          <button onClick={onInvite} className="flex-1 rounded-2xl border-b-4 border-[#5fb0d8] bg-[#7fcdf3] py-2 text-sm font-extrabold text-white active:translate-y-[2px] active:border-b-2">
            🏠 Davet
          </button>
        )}
      </div>

      {extras.length > 0 && (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-[#ece3f7] pt-2">
          {extras.map((x) => (
            <button key={x.key} onClick={x.onClick} className={`text-xs font-extrabold hover:underline ${x.danger ? 'text-rose-400' : 'text-[#8a7a9c]'}`}>
              {x.emoji} {x.label}
            </button>
          ))}
        </div>
      )}

      {whisper && (
        <form onSubmit={sendWhisper} className="flex flex-col gap-1.5">
          <p className="text-xs font-bold text-[#6b4fc0]">
            {near ? `Yalnızca ${peer.name} duyar. Etraftakiler “fısıldıyor 🤫” görür, ne dediğini görmez.` : `${peer.name} fısıldamak için çok uzakta (en fazla ${WHISPER_RANGE} m).`}
          </p>
          <div className="flex gap-2">
            <input
              ref={input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={140}
              autoComplete="off"
              enterKeyHint="send"
              aria-label="Fısıltı"
              placeholder="Kulağına bir şey söyle…"
              className="min-w-0 flex-1 rounded-2xl border-2 border-[#d6c7ff] bg-[#faf6ff] px-4 py-2.5 text-base font-semibold italic text-[#4a3b5c] outline-none placeholder:text-[#8a7a9c]/60 focus:ring-4 focus:ring-[#d6c7ff]/60"
            />
            <button type="submit" disabled={!near} aria-label="Fısılda" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border-b-4 border-[#8a6bd1] bg-[#a88bff] text-lg text-white active:translate-y-0.5 active:border-b-2 disabled:opacity-50">
              🤫
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ---------- birinden jest geldi ----------
export function GestureChip({ from, onBack, onChat, onClose }) {
  const g = GESTURE_BY_KIND[from.kind]
  useEffect(() => {
    const t = setTimeout(onClose, 14000)
    return () => clearTimeout(t)
  }, [from, onClose])
  return (
    <div className={`absolute left-1/2 top-24 z-20 w-[min(92vw,22rem)] -translate-x-1/2 animate-pop rounded-3xl p-2.5 pl-4 ${glass}`} role="status">
      <div className="flex items-center gap-3">
        <span className="text-3xl" aria-hidden>
          {from.emoji}
        </span>
        <p className="min-w-0 flex-1 text-sm font-black text-[#4a3b5c]">
          <span className="text-[#fdb252]">{from.name}</span> {g?.text ?? 'sana bir jest yaptı'}
        </p>
        <button onClick={onClose} aria-label="Kapat" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black text-[#8a7a9c] hover:bg-[#ffedd6]/70">
          ✕
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        <button onClick={onBack} className="flex-1 rounded-xl border-b-4 border-[#e8952c] bg-[#fdb252] py-1.5 text-sm font-extrabold text-white active:translate-y-[2px] active:border-b-2">
          {from.emoji} Karşılık ver
        </button>
        <button onClick={onChat} className="flex-1 rounded-xl border-b-4 border-[#c9b6f5] bg-[#e9ddff] py-1.5 text-sm font-extrabold text-[#5b3fa8] active:translate-y-[2px] active:border-b-2">
          💬 Yaz
        </button>
      </div>
    </div>
  )
}

// ---------- 💞 eşleşme: karşılıklı kalp ----------
export function MatchOverlay({ peer, onChat, onClose }) {
  // kalpler ilk render'da bir kez rastgele üretilir (state başlatıcısı: render'lar arasında sabit kalır)
  const [spec] = useState(() =>
    Array.from({ length: 26 }, (_, i) => ({
      left: Math.round(Math.random() * 96),
      size: 18 + Math.round(Math.random() * 30),
      delay: +(Math.random() * 2.4).toFixed(2),
      dur: +(3.2 + Math.random() * 2.6).toFixed(2),
      glyph: ['💗', '💖', '💞', '💕', '🌸', '✨'][i % 6],
    })),
  )
  useEffect(() => {
    const t = setTimeout(onClose, 14000)
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])
  return (
    <div className="absolute inset-0 z-40 grid place-items-center overflow-hidden bg-gradient-to-br from-[#ffead0]/85 via-[#e9ddff]/85 to-[#cfeaff]/85 p-4 backdrop-blur-[3px]" role="dialog" aria-label="Eşleşme">
      {spec.map((h, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute bottom-0 opacity-0"
          style={{ left: `${h.left}%`, fontSize: h.size, animation: `heart-rise ${h.dur}s ease-in ${h.delay}s infinite` }}
        >
          {h.glyph}
        </span>
      ))}
      <div className="relative flex w-full max-w-sm animate-pop flex-col items-center gap-3 rounded-[2rem] border-2 border-white bg-white/90 p-6 text-center shadow-toy">
        <p className="text-sm font-extrabold uppercase tracking-widest text-[#fdb252]">Eşleşme</p>
        <Portrait peer={peer} size={112} className="h-28 w-28 !border-4 shadow-soft [animation:match-pulse_1.6s_ease-in-out_infinite]" />
        <h2 className="text-3xl font-black text-[#4a3b5c]">💞 {peer.name}</h2>
        <p className="text-sm font-semibold text-[#6f5f82]">Birbirinize kalp gönderdiniz. Belki de ilk adımı atma zamanı… 🌙</p>
        <div className="mt-1 flex w-full flex-col gap-2">
          <ToyButton onClick={onChat}>💬 Sohbet et</ToyButton>
          <button onClick={onClose} className="rounded-2xl py-2 text-sm font-extrabold text-[#8a7a9c] hover:bg-[#ffedd6]/60">
            Daha sonra
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- ev daveti ----------
export function InviteChip({ from, onGo, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 20000)
    return () => clearTimeout(t)
  }, [from, onClose])
  return (
    <div className={`absolute left-1/2 top-24 z-20 flex w-[min(92vw,22rem)] -translate-x-1/2 animate-pop items-center gap-3 rounded-3xl p-2.5 pl-4 ${glass}`} role="status">
      <span className="text-2xl" aria-hidden>
        🏠
      </span>
      <p className="min-w-0 flex-1 text-sm font-black text-[#4a3b5c]">
        {from.ownerName} seni evine çağırıyor
      </p>
      <div className="w-20 shrink-0">
        <ToyButton className="!rounded-xl !py-2 !text-sm" onClick={onGo}>
          Git
        </ToyButton>
      </div>
      <button onClick={onClose} aria-label="Kapat" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black text-[#8a7a9c] hover:bg-[#ffedd6]/70">
        ✕
      </button>
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
      <p className="text-xs font-extrabold text-[#fdb252]">{from.whisper ? `🤫 ${from.name} sana fısıldadı` : `💌 ${from.name} sana yazdı`}</p>
      <p className="truncate text-sm font-semibold text-[#4a3b5c]">{from.text}</p>
    </button>
  )
}

// ---------- sohbet çekmecesi (özel veya herkese açık) ----------
export function ChatSheet({ peer, feed, onSend, onClose, touch, typing, onTyping, readUpTo = 0, onSticker, onVoice }) {
  const [text, setText] = useState('')
  const [emojis, setEmojis] = useState(false)
  const [pickTab, setPickTab] = useState('emoji') // emoji | sticker
  const list = useRef(null)
  const input = useRef(null)

  const messages = feed.filter((m) =>
    peer ? m.kind === 'chat' && (m.dm || m.whisper) && (m.id === peer.id || m.to === peer.id) : m.kind === 'system' || (!m.dm && !m.whisper),
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
          <Portrait peer={peer} size={40} className="h-10 w-10" />
        ) : (
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#d6c7ff]/60 text-xl">💬</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-black text-[#4a3b5c]">{peer ? peer.name : 'Herkese açık sohbet'}</p>
          <p className="text-xs font-bold text-[#8a7a9c]">{peer ? 'Özel sohbet · sadece ikiniz görürsünüz' : 'Yakındaki herkes duyar'}</p>
        </div>
        <button onClick={onClose} aria-label="Sohbeti kapat" className="grid h-9 w-9 place-items-center rounded-full text-sm font-black text-[#8a7a9c] hover:bg-[#ffedd6]/70">
          ✕
        </button>
      </div>

      <div ref={list} className="flex min-h-24 flex-1 flex-col gap-1.5 overflow-y-auto" role="log" aria-live="polite" style={{ maxHeight: touch ? '32svh' : '14rem' }}>
        {messages.length === 0 && <p className="m-auto text-center text-sm font-semibold text-[#8a7a9c]">{peer ? `${peer.name} ile ilk mesajı sen at 👋` : 'Henüz mesaj yok.'}</p>}
        {peer && typing && (
          <p className="flex w-fit items-center gap-1 self-start rounded-2xl bg-[#f1e6ff] px-3 py-1.5 text-sm font-bold text-[#8a7a9c]" aria-live="polite">
            {peer.name} yazıyor
            <span className="inline-flex gap-0.5" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#a88bff]" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
          </p>
        )}
        {messages.map((m, i) =>
          m.sticker ? (
            <StickerBubble key={`${m.ts}-${i}`} id={m.sticker} self={m.self} />
          ) : m.voice ? (
            <VoiceBubble key={`${m.ts}-${i}`} voice={m.voice} self={m.self} />
          ) : (
          <p
            key={`${m.ts}-${i}`}
            className={`max-w-[85%] break-words rounded-2xl px-3 py-1.5 text-sm font-semibold ${
              m.kind === 'system'
                ? 'w-fit bg-[#fdb252]/90 text-white'
                : m.whisper
                  ? `italic border-2 border-dashed border-[#c9b6f5] bg-[#f4edff] text-[#5b3fa8] ${m.self ? 'self-end' : 'self-start'}`
                  : m.self
                    ? 'self-end bg-[#a9ddf5] text-[#2f4a5c]'
                    : 'self-start bg-[#f1e6ff] text-[#4a3b5c]'
            }`}
          >
            {m.kind === 'system' ? `🧭 ${m.text}` : m.whisper ? `🤫 ${m.text}` : !peer && !m.self ? <><b>{m.name}: </b>{m.text}</> : peer && m.self && m.dm ? <>{m.text}<span className={`ml-1.5 text-[11px] font-black ${m.ts <= readUpTo ? 'text-[#3b8fd6]' : 'text-[#2f4a5c]/50'}`} title={m.ts <= readUpTo ? 'Okundu' : 'Gönderildi'}>{m.ts <= readUpTo ? '✓✓' : '✓'}</span></> : m.text}
          </p>
          ),
        )}
      </div>

      {peer && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {QUICK_REPLIES.map((q) => (
            <button
              key={q}
              onClick={() => onSend(q)}
              className="shrink-0 rounded-full border-2 border-white bg-[#ffedd6]/70 px-3 py-1.5 text-xs font-extrabold text-[#4a3b5c] active:scale-95"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {emojis && onSticker && (
        <div className="flex gap-1.5" role="tablist" aria-label="Emoji ve çıkartma">
          {[
            ['emoji', '😊 Emoji'],
            ['sticker', '🧸 Çıkartma'],
          ].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={pickTab === id} onClick={() => setPickTab(id)} className={`flex-1 rounded-xl py-1.5 text-xs font-extrabold active:scale-95 ${pickTab === id ? 'bg-[#a88bff] text-white' : 'bg-[#f1e6ff] text-[#4a3b5c]'}`}>
              {label}
            </button>
          ))}
        </div>
      )}
      {emojis && onSticker && pickTab === 'sticker' && (
        <StickerPanel
          onPick={(id) => {
            onSticker(id)
            setEmojis(false)
          }}
        />
      )}
      {emojis && (pickTab === 'emoji' || !onSticker) && (
        <div className="grid grid-cols-8 gap-1 rounded-2xl bg-[#faf6ff] p-1.5">
          {CHAT_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                setText((t) => (t + e).slice(0, 140))
                input.current?.focus()
              }}
              className="grid h-9 place-items-center rounded-xl text-xl active:scale-90 hover:bg-[#ffedd6]/60"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="flex gap-2">
        <button type="button" onClick={() => setEmojis((o) => !o)} aria-label="Emoji seç" aria-expanded={emojis} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border-2 border-[#d6c7ff]/70 bg-white text-xl active:scale-95">
          😊
        </button>
        <input
          ref={input}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (peer && e.target.value) onTyping?.(peer.id)
          }}
          maxLength={140}
          autoComplete="off"
          enterKeyHint="send"
          aria-label="Mesaj"
          placeholder="Mesaj yaz…"
          className="min-w-0 flex-1 rounded-2xl border-2 border-[#d6c7ff]/70 bg-white px-4 py-2.5 text-base font-semibold text-[#4a3b5c] outline-none placeholder:text-[#8a7a9c]/60 focus:ring-4 focus:ring-[#d6c7ff]/60"
        />
        <button type="submit" aria-label="Gönder" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border-b-4 border-[#e8952c] bg-[#fdb252] text-lg text-white active:translate-y-0.5 active:border-b-2">
          ➤
        </button>
        {onVoice && !text.trim() && <MicButton onSend={onVoice} />}
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
      className={`absolute z-10 grid h-16 w-16 place-items-center rounded-full text-3xl ${glass}`}
      style={{ right: 'max(1rem, env(safe-area-inset-right))', bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
    >
      <Ico name="chat" size={32} />
    </button>
  )
}
