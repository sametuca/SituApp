import { useEffect, useRef, useState } from 'react'
import { Em } from '../components/emoji'

const fmtClock = (ts) => {
  try {
    const d = new Date(ts || Date.now())
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

/**
 * Ekranın solunda duran Fısıltı Gelen Kutusu (Inbox):
 * Gelen fısıltıları temiz bir listede okuma ve doğrudan yanıtlama sağlar.
 */
export default function WhisperInbox({ open = false, onClose, items = [], touch = false, onReadAll, onClear, onReply, onInspect }) {
  const [replyId, setReplyId] = useState(null)
  const [replyText, setReplyText] = useState('')
  const boxRef = useRef(null)

  useEffect(() => {
    if (!open) return
    onReadAll?.()
  }, [open, items.length, onReadAll])

  useEffect(() => {
    if (!open) return
    const off = (e) => {
      if (e.target instanceof Element && e.target.closest('[aria-label="Gelen Fısıltılar"]')) return
      if (!boxRef.current?.contains(e.target)) {
        setReplyId(null)
        onClose?.()
      }
    }
    const esc = (e) => {
      if (e.key === 'Escape') {
        setReplyId(null)
        onClose?.()
      }
    }
    window.addEventListener('pointerdown', off)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('pointerdown', off)
      window.removeEventListener('keydown', esc)
    }
  }, [open, onClose])

  const sendReply = (e, item) => {
    e.preventDefault()
    const t = replyText.trim()
    if (!t) return
    if (onReply?.(item.fromId, t)) {
      setReplyText('')
      setReplyId(null)
    }
  }

  if (!open) return null

  return (
    <div
      ref={boxRef}
      className="pointer-events-auto fixed left-[3.85rem] top-[4.5rem] z-30 sm:left-[4.75rem] sm:top-[5rem]"
    >
      <div className="flex w-[min(calc(100vw-4.6rem),20.5rem)] animate-pop flex-col rounded-3xl border-2 border-white bg-white/96 p-3 shadow-toy backdrop-blur-md">
          <div className="flex items-center justify-between gap-2 pb-2">
            <div>
              <h3 className="text-sm font-black text-[#4a3b5c]">Gelen Fısıltılar</h3>
              <p className="text-[11px] font-bold text-[#8a7a9c]">Yakınındakilerden sana özel notlar</p>
            </div>
            <div className="flex items-center gap-1">
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setReplyId(null)
                    onClear?.()
                  }}
                  className="rounded-full bg-[#f6f0ff] px-2.5 py-1 text-[11px] font-black text-[#6b4fc0] hover:bg-[#ece2ff]"
                >
                  Temizle
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setReplyId(null)
                  onClose?.()
                }}
                aria-label="Kapat"
                className="grid h-7 w-7 place-items-center rounded-full bg-[#f6f0ff] hover:bg-[#ece2ff]"
              >
                <Em e="✖️" size={12} />
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-[#faf6ff] px-4 py-6 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-sm">
                <Em e="💌" size={26} />
              </span>
              <p className="text-xs font-bold text-[#8a7a9c]">Henüz gelen bir fısıltı yok.</p>
            </div>
          ) : (
            <div className="flex max-h-60 flex-col gap-1.5 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
              {items.map((w) => {
                const replying = replyId === w.uid
                return (
                  <div
                    key={w.uid}
                    className={`rounded-2xl border p-2.5 transition ${
                      w.self ? 'border-[#e7f2fa] bg-[#f4fafe]' : 'border-[#efe6ff] bg-[#faf6ff]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] font-black">
                      <button
                        type="button"
                        onClick={() => {
                          if (!w.self && w.fromId) {
                            onClose?.()
                            onInspect?.(w.fromId)
                          }
                        }}
                        className="truncate text-[#5b3fa8] hover:underline"
                      >
                        {w.self ? `Sen → ${w.toName}` : w.fromName}
                      </button>
                      <span className="shrink-0 text-[#8a7a9c]">{fmtClock(w.ts)}</span>
                    </div>
                    <p className="mt-1 break-words text-xs font-bold leading-snug text-[#4a3b5c]">{w.text}</p>
                    {!w.self && w.fromId && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setReplyId(replying ? null : w.uid)
                            setReplyText('')
                          }}
                          className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-black text-[#6b4fc0] shadow-sm hover:bg-[#efe6ff]"
                        >
                          {replying ? 'Vazgeç' : 'Yanıtla'}
                        </button>
                      </div>
                    )}
                    {replying && (
                      <form onSubmit={(e) => sendReply(e, w)} className="mt-2 flex gap-1.5">
                        <input
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          maxLength={140}
                          autoFocus={!touch}
                          placeholder={`${w.fromName} kişisine fısılda…`}
                          className="min-w-0 flex-1 rounded-xl border border-[#d6c7ff] bg-white px-2.5 py-1 text-xs font-bold text-[#4a3b5c] outline-none"
                        />
                        <button type="submit" className="rounded-xl bg-[#a88bff] px-2.5 py-1 text-[11px] font-black text-white">
                          Gönder
                        </button>
                      </form>
                    )}
                  </div>
                )
              })}
            </div>
          )}
      </div>
    </div>
  )
}
