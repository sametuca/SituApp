// Oyuncuya tıklayınca açılan kompakt, sekmeli etkileşim kartı: Jestler, Buluşma, Hediye ve Profil/Güvenlik.
import { useEffect, useRef, useState } from 'react'
import { Ico } from '../components/Icon'
import { GESTURES } from './interact'
import Portrait from './Portrait'

export const ACTION_CATEGORIES = [
  { id: 'events', label: 'Buluşma' },
  { id: 'gifts', label: 'Hediye' },
  { id: 'safety', label: 'Güvenlik' },
]

export function InteractSheet({ peer, near, canInvite, touch, extras = [], header = null, onClose, onChat, onGesture, onWhisper, onInvite }) {
  const [whisper, setWhisper] = useState(false)
  const [text, setText] = useState('')
  const [tab, setTab] = useState('gestures')
  const input = useRef(null)

  const friendAction = extras.find((action) => action.key === 'friend')
  const eventActions = extras.filter((action) => (action.category ?? 'social') === 'events')
  const giftActions = extras.filter((action) => action.category === 'gifts')
  const safetyActions = extras.filter((action) => action.category === 'safety')

  const tabs = [
    { id: 'gestures', label: 'Jestler' },
    ...(eventActions.length > 0 ? [{ id: 'events', label: 'Buluşma' }] : []),
    ...(giftActions.length > 0 ? [{ id: 'gifts', label: 'Hediye' }] : []),
    ...(header || safetyActions.length > 0 ? [{ id: 'profile', label: 'Profil' }] : []),
  ]
  const currentTab = tabs.some((t) => t.id === tab) ? tab : 'gestures'

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
    setWhisper(false)
  }

  return (
    <div
      className={`absolute z-30 flex flex-col gap-2 bg-white/95 shadow-toy backdrop-blur-md animate-pop ${
        touch
          ? 'bottom-2.5 left-1/2 max-h-[70dvh] w-[min(92vw,24.5rem)] -translate-x-1/2 rounded-[1.6rem] border-2 border-white p-3'
          : 'bottom-3 left-3 max-h-[74dvh] w-[22.5rem] rounded-[1.75rem] border-2 border-white p-3.5'
      }`}
      role="dialog"
      aria-label={`${peer.name} ile etkileşim`}
    >
      {/* Kompakt üst satır */}
      <div className="flex items-center gap-2.5">
        <Portrait peer={peer} size={40} className="h-10 w-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-sm font-black text-[#4a3b5c]">{peer.name}</p>
            {friendAction && (
              <button
                type="button"
                onClick={friendAction.onClick}
                className="shrink-0 rounded-full bg-[#f3ecff] px-2 py-0.5 text-[10px] font-black text-[#5b3fa8] transition hover:bg-[#e9ddff] active:scale-95"
              >
                + Arkadaş
              </button>
            )}
          </div>
          <p className={`truncate text-[11px] font-bold ${near ? 'text-emerald-600' : 'text-[#8a7a9c]'}`}>
            {peer.dnd ? '🌙 Rahatsız etme açık' : near ? '● Yakınında · jestler açık' : '○ Uzakta · jest için yaklaş'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f6f0ff] text-[#6b4fc0] transition hover:bg-[#eadcff] active:scale-95"
        >
          <Ico name="close" size={13} />
        </button>
      </div>

      {/* Hızlı iletişim çubuğu */}
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={onChat}
          className="flex-1 rounded-xl border-b-[3px] border-[#e8952c] bg-[#fdb252] py-1.5 text-xs font-black text-white active:translate-y-[1px]"
        >
          💬 Sohbet
        </button>
        <button
          type="button"
          onClick={() => setWhisper((w) => !w)}
          aria-pressed={whisper}
          className={`flex-1 rounded-xl border-b-[3px] py-1.5 text-xs font-black active:translate-y-[1px] ${
            whisper ? 'border-[#8a6bd1] bg-[#a88bff] text-white' : 'border-[#c9b6f5] bg-[#e9ddff] text-[#5b3fa8]'
          }`}
        >
          🤫 Fısılda
        </button>
        {canInvite && (
          <button
            type="button"
            onClick={onInvite}
            className="flex-1 rounded-xl border-b-[3px] border-[#5fb0d8] bg-[#7fcdf3] py-1.5 text-xs font-black text-white active:translate-y-[1px]"
          >
            🏠 Davet
          </button>
        )}
      </div>

      {/* Fısıltı açıksa tek satırlık hızlı kutu */}
      {whisper && (
        <form onSubmit={sendWhisper} className="flex gap-1.5">
          <input
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={140}
            autoComplete="off"
            enterKeyHint="send"
            aria-label="Fısıltı"
            placeholder={`${peer.name} kişisine fısılda…`}
            className="min-w-0 flex-1 rounded-xl border-2 border-[#d6c7ff] bg-[#faf6ff] px-3 py-1.5 text-xs font-semibold italic text-[#4a3b5c] outline-none placeholder:text-[#8a7a9c]/60 focus:ring-2 focus:ring-[#d6c7ff]"
          />
          <button
            type="submit"
            aria-label="Gönder"
            className="grid h-8 w-9 shrink-0 place-items-center rounded-xl border-b-2 border-[#8a6bd1] bg-[#a88bff] text-sm text-white active:scale-95"
          >
            🤫
          </button>
        </form>
      )}

      {/* Sekme başlıkları */}
      <div
        className="grid gap-1 rounded-xl border border-[#e6dcf3] bg-[#f7f2ff] p-1"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        role="tablist"
        aria-label="Oyuncu kartı sekmeleri"
      >
        {tabs.map((t) => {
          const active = currentTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`rounded-lg py-1.5 text-xs font-black transition ${
                active ? 'bg-white text-[#5b3fa8] shadow-sm' : 'text-[#8a7a9c] hover:bg-white/60'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Seçili sekme içeriği (kompakt & taşarsa kendi içinde belirgin çubukla kayar) */}
      <div className="situ-scroll min-h-0 overflow-y-auto overscroll-contain touch-pan-y pr-1">
        {currentTab === 'gestures' && (
          <div className="grid grid-cols-3 gap-1.5">
            {GESTURES.map((g) => (
              <button
                key={g.kind}
                type="button"
                onClick={() => onGesture(g.kind)}
                disabled={!near}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-white bg-[#fff2e3]/85 px-2 py-2 text-[#4a3b5c] transition active:scale-95 enabled:hover:bg-[#ffead0] disabled:opacity-45"
              >
                <span className="text-base leading-none">{g.emoji}</span>
                <span className="truncate text-[11px] font-extrabold">{g.label}</span>
              </button>
            ))}
          </div>
        )}

        {currentTab === 'events' && (
          <div className="grid grid-cols-2 gap-1.5">
            {eventActions.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                className="flex items-center justify-center rounded-xl border border-white bg-[#faf7ff] px-2.5 py-2 text-center text-xs font-extrabold text-[#5b4678] shadow-sm transition hover:bg-[#f1eaff] active:scale-95"
              >
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}

        {currentTab === 'gifts' && (
          <div className="grid grid-cols-2 gap-1.5">
            {giftActions.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                className="flex items-center justify-center rounded-xl border border-white bg-[#fff7ee] px-2.5 py-2 text-center text-xs font-extrabold text-[#6b4d38] shadow-sm transition hover:bg-[#ffedd8] active:scale-95"
              >
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}

        {currentTab === 'profile' && (
          <div className="situ-scroll flex max-h-40 flex-col gap-2 overflow-y-auto overscroll-contain touch-pan-y pr-1">
            {header}
            {safetyActions.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                {safetyActions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    onClick={action.onClick}
                    className={`flex items-center justify-center rounded-xl border border-white px-2.5 py-2 text-center text-xs font-extrabold shadow-sm transition active:scale-95 ${
                      action.danger ? 'bg-rose-50 text-rose-500 hover:bg-rose-100' : 'bg-[#faf7ff] text-[#6b587c] hover:bg-[#f1eaff]'
                    }`}
                  >
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
