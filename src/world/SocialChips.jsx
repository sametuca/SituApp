// Sosyal bildirim kartları: jest, eşleşme, ev daveti, gelen mesaj.
import { useEffect, useState } from 'react'
import { TopDock } from '../components/Dock'
import { Ico } from '../components/Icon'
import { ToyButton } from '../components/ui'
import { GESTURE_BY_KIND } from './interact'
import Portrait from './Portrait'
import { glass } from './socialShared'
// ---------- birinden jest geldi ----------
export function GestureChip({ from, onBack, onChat, onClose }) {
  const g = GESTURE_BY_KIND[from.kind]
  useEffect(() => {
    const t = setTimeout(onClose, 14000)
    return () => clearTimeout(t)
  }, [from, onClose])
  return (
    <TopDock><div className={`pointer-events-auto relative w-[min(92vw,22rem)] animate-pop rounded-3xl p-2.5 pl-4 ${glass}`} role="status">
      <div className="flex items-center gap-3">
        <span className="text-3xl" aria-hidden>
          {from.emoji}
        </span>
        <p className="min-w-0 flex-1 text-sm font-black text-[#4a3b5c]">
          <span className="text-[#fdb252]">{from.name}</span> {g?.text ?? 'sana bir jest yaptı'}
        </p>
        <button onClick={onClose} aria-label="Kapat" className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-[#ffedd6]/70">
          <Ico name="close" size={12} />
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
    </div></TopDock>
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
    <TopDock><div className={`pointer-events-auto relative flex w-[min(92vw,22rem)] animate-pop items-center gap-3 rounded-3xl p-2.5 pl-4 ${glass}`} role="status">
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
      <button onClick={onClose} aria-label="Kapat" className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-[#ffedd6]/70">
        <Ico name="close" size={12} />
      </button>
    </div></TopDock>
  )
}

// ---------- gelen özel mesaj bildirimi ----------
export function IncomingChip({ from, onOpen, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 8000)
    return () => clearTimeout(t)
  }, [from, onClose])
  return (
    <TopDock><button
      onClick={onOpen}
      className={`pointer-events-auto relative w-[min(92vw,20rem)] animate-pop rounded-3xl px-4 py-2.5 text-left ${glass}`}
    >
      <p className="text-xs font-extrabold text-[#fdb252]">{from.whisper ? `🤫 ${from.name} sana fısıldadı` : `💌 ${from.name} sana yazdı`}</p>
      <p className="truncate text-sm font-semibold text-[#4a3b5c]">{from.text}</p>
    </button></TopDock>
  )
}
