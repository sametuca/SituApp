// Oyuncuya tıklayınca açılan etkileşim çekmecesi: tepki, jest, fısıltı, hediye, davet, arkadaşlık eylemleri.
import { useEffect, useRef, useState } from 'react'
import { Ico } from '../components/Icon'
import { GESTURES } from './interact'
import Portrait from './Portrait'
export const ACTION_CATEGORIES = [
  { id: 'events', label: 'Buluşma' },
  { id: 'gifts', label: 'Hediye' },
  { id: 'safety', label: 'Güvenlik' },
]

// ---------- etkileşim menüsü (bir oyuncuya kalp, çiçek, fısıltı…) ----------
export function InteractSheet({ peer, near, canInvite, touch, extras = [], header = null, onClose, onChat, onGesture, onWhisper, onInvite }) {
  const [whisper, setWhisper] = useState(false)
  const [text, setText] = useState('')
  const [activeCategory, setActiveCategory] = useState('events')
  const input = useRef(null)
  const friendAction = extras.find((action) => action.key === 'friend')
  const groupedActions = ACTION_CATEGORIES.map((category) => ({
    ...category,
    actions: extras.filter((action) => (action.category ?? 'social') === category.id),
  })).filter((category) => category.actions.length > 0)
  const selectedCategory = groupedActions.find((category) => category.id === activeCategory) ?? groupedActions[0]

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
      className={`absolute z-20 flex max-h-[88dvh] flex-col gap-3 overflow-y-auto bg-white/92 p-4 shadow-toy backdrop-blur-md animate-pop ${
        touch ? 'inset-x-0 bottom-0 rounded-t-[2rem] border-t-2 border-white pb-[max(1rem,env(safe-area-inset-bottom))]' : 'bottom-3 left-3 w-[22rem] rounded-[2rem] border-2 border-white'
      }`}
      role="dialog"
      aria-label={`${peer.name} ile etkileşim`}
    >
      <div className="flex items-center gap-3">
        <Portrait peer={peer} size={48} className="h-12 w-12" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-base font-black text-[#4a3b5c]">{peer.name}</p>
            {friendAction && (
              <button
                type="button"
                onClick={friendAction.onClick}
                className="shrink-0 rounded-full bg-[#f3ecff] px-2.5 py-1 text-[10px] font-black text-[#5b3fa8] transition hover:bg-[#e9ddff]"
              >
                Arkadaş ekle
              </button>
            )}
          </div>
          <p className={`text-xs font-bold ${near ? 'text-emerald-500' : 'text-[#8a7a9c]'}`}>
            {peer.dnd ? '🌙 rahatsız etme açık · şimdilik ulaşılamaz' : near ? 'yakınında · jestler açık' : 'biraz uzakta · jest için yaklaş'}
          </p>
        </div>
        <button onClick={onClose} aria-label="Kapat" className="grid h-9 w-9 place-items-center rounded-full hover:bg-[#ffedd6]/70">
          <Ico name="close" size={14} />
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
          Sohbet
        </button>
        <button
          onClick={() => setWhisper((w) => !w)}
          aria-pressed={whisper}
          className={`flex-1 rounded-2xl border-b-4 py-2 text-sm font-extrabold active:translate-y-[2px] active:border-b-2 ${whisper ? 'border-[#8a6bd1] bg-[#a88bff] text-white' : 'border-[#c9b6f5] bg-[#e9ddff] text-[#5b3fa8]'}`}
        >
          Fısılda
        </button>
        {canInvite && (
          <button onClick={onInvite} className="flex-1 rounded-2xl border-b-4 border-[#5fb0d8] bg-[#7fcdf3] py-2 text-sm font-extrabold text-white active:translate-y-[2px] active:border-b-2">
            Eve davet
          </button>
        )}
      </div>

      {groupedActions.length > 0 && (
        <div className="border-t border-[#ece3f7] pt-2">
          <div className="grid grid-cols-3 gap-1 rounded-2xl border-2 border-[#e6dcf3] bg-[#f7f2ff] p-1" role="tablist" aria-label="Etkileşim kategorileri">
            {groupedActions.map((category) => (
              <button
                key={category.id}
                type="button"
                id={`interact-tab-${category.id}`}
                role="tab"
                aria-controls={`interact-panel-${category.id}`}
                aria-selected={selectedCategory?.id === category.id}
                tabIndex={selectedCategory?.id === category.id ? 0 : -1}
                onClick={() => setActiveCategory(category.id)}
                className={`flex min-h-12 items-center justify-center rounded-xl border-b-4 px-2 py-1.5 text-sm font-black transition ${
                  selectedCategory?.id === category.id ? 'border-[#8a6bd1] bg-white text-[#5b3fa8] shadow-soft' : 'border-transparent bg-transparent text-[#8a7a9c] hover:bg-white/70'
                }`}
              >
                <span>{category.label}</span>
              </button>
            ))}
          </div>
          {selectedCategory && (
            <div
              id={`interact-panel-${selectedCategory.id}`}
              aria-labelledby={`interact-tab-${selectedCategory.id}`}
              className="mt-2 rounded-2xl border-2 border-[#e6dcf3] bg-white/80 p-2.5"
              role="tabpanel"
            >
              <p className="mb-2 px-1 text-xs font-black uppercase tracking-wide text-[#8a7a9c]">
                {selectedCategory.label} seçenekleri
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {selectedCategory.actions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    onClick={action.onClick}
                    className={`flex min-h-12 items-center justify-center rounded-xl border border-white px-2.5 py-2 text-center text-[13px] font-extrabold shadow-sm transition active:scale-95 ${
                      action.danger ? 'bg-rose-50 text-rose-500 hover:bg-rose-100' : 'bg-[#faf7ff] text-[#6b587c] hover:bg-[#f1eaff]'
                    }`}
                  >
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {whisper && (
        <form onSubmit={sendWhisper} className="flex flex-col gap-1.5">
          <p className="text-xs font-bold text-[#6b4fc0]">
            Yalnızca {peer.name} duyar. Etraftakiler “fısıldıyor 🤫” görür, ne dediğini görmez.
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
            <button type="submit" aria-label="Fısılda" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border-b-4 border-[#8a6bd1] bg-[#a88bff] text-lg text-white active:translate-y-0.5 active:border-b-2">
              🤫
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
