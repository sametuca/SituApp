import { useEffect, useRef, useState } from 'react'
import { Em } from '../components/emoji'
import { CHAT_EMOJIS } from './interact'

const fmtClock = (ts) => {
  try {
    const d = new Date(ts || Date.now())
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

function getThreads(items) {
  const byPeer = new Map()
  for (const item of items) {
    const id = item.self ? item.toId : item.fromId
    if (!id) continue
    const name = item.self ? item.toName : item.fromName
    let thread = byPeer.get(id)
    if (!thread) {
      thread = { id, name, items: [], latest: 0 }
      byPeer.set(id, thread)
    }
    thread.items.push(item)
    thread.latest = Math.max(thread.latest, item.ts ?? 0)
  }
  return [...byPeer.values()]
    .map((thread) => ({ ...thread, items: thread.items.sort((a, b) => a.ts - b.ts) }))
    .sort((a, b) => b.latest - a.latest)
}

/** Fısıltıları kişi bazında, karşılıklı sohbet akışı olarak gösterir. */
export default function WhisperInbox({ open = false, onClose, items = [], touch = false, onReadAll, onClear, onReply, onInspect }) {
  const [selectedId, setSelectedId] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const boxRef = useRef(null)
  const messageListRef = useRef(null)
  const inputRef = useRef(null)
  const threads = getThreads(items)
  const selectedIdIsValid = threads.some((thread) => thread.id === selectedId)
  const activeThread = threads.find((thread) => thread.id === (selectedIdIsValid ? selectedId : threads[0]?.id))
  const activeMessages = activeThread?.items ?? []

  useEffect(() => {
    if (!open) return
    onReadAll?.()
  }, [open, items.length, onReadAll])

  useEffect(() => {
    if (!open) return
    const off = (e) => {
      if (e.target instanceof Element && e.target.closest('[aria-label="Fısıltı Sohbetleri"]')) return
      if (!boxRef.current?.contains(e.target)) onClose?.()
    }
    const esc = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('pointerdown', off)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('pointerdown', off)
      window.removeEventListener('keydown', esc)
    }
  }, [open, onClose])

  useEffect(() => {
    messageListRef.current?.scrollTo({ top: messageListRef.current.scrollHeight })
  }, [activeThread?.id, activeMessages.length])

  useEffect(() => {
    if (open && activeThread && !touch) inputRef.current?.focus()
  }, [open, activeThread?.id, touch])

  const sendReply = (e) => {
    e.preventDefault()
    const text = replyText.trim()
    if (!text || !activeThread) return
    if (onReply?.(activeThread.id, text)) {
      setReplyText('')
      setEmojiOpen(false)
    }
  }

  if (!open) return null

  return (
    <div
      ref={boxRef}
      className="pointer-events-auto fixed left-[3.85rem] top-[4.5rem] z-30 sm:left-[4.75rem] sm:top-[5rem]"
    >
      <div className="flex h-[min(70svh,34rem)] min-h-[20rem] w-[min(calc(100vw-4.6rem),23rem)] animate-pop flex-col rounded-3xl border-2 border-white bg-white/96 p-3 shadow-toy backdrop-blur-md">
        <div className="flex shrink-0 items-center justify-between gap-2 pb-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white bg-[#efe6ff] text-base font-black text-[#6b4fc0] shadow-sm">
              {activeThread ? activeThread.name.slice(0, 1).toLocaleUpperCase('tr-TR') : <Em e="💌" size={20} />}
            </span>
            <div className="min-w-0">
              {activeThread ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose?.()
                    onInspect?.(activeThread.id)
                  }}
                  className="block max-w-full truncate text-left text-sm font-black text-[#4a3b5c] hover:underline"
                >
                  {activeThread.name}
                </button>
              ) : (
                <h3 className="text-sm font-black text-[#4a3b5c]">Fısıltılar</h3>
              )}
              <p className="truncate text-[11px] font-bold text-[#8a7a9c]">
                {activeThread ? 'Özel fısıltı konuşması' : 'Özel konuşmaların burada görünür'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {items.length > 0 && (
              <button
                type="button"
                onClick={onClear}
                className="rounded-full bg-[#fff2e3] px-2.5 py-1.5 text-[11px] font-black text-[#94601e] hover:bg-[#ffe8ca]"
              >
                Temizle
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              className="grid h-8 w-8 place-items-center rounded-full bg-[#f6f0ff] hover:bg-[#ece2ff]"
            >
              <Em e="✖️" size={12} />
            </button>
          </div>
        </div>

        {threads.length > 1 && (
          <div className="flex shrink-0 gap-1.5 overflow-x-auto border-y border-[#eee6f8] py-2 [scrollbar-width:none]" aria-label="Konuşmalar">
            {threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => {
                  setSelectedId(thread.id)
                  setReplyText('')
                  setEmojiOpen(false)
                }}
                aria-pressed={thread.id === activeThread?.id}
                className={`max-w-36 shrink-0 truncate rounded-full px-3 py-1.5 text-xs font-extrabold ${
                  thread.id === activeThread?.id ? 'bg-[#a88bff] text-white' : 'bg-[#f6f0ff] text-[#6b4fc0]'
                }`}
              >
                {thread.name}
              </button>
            ))}
          </div>
        )}

        {activeThread ? (
          <>
            <div
              ref={messageListRef}
              className="my-1 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto rounded-2xl border border-white bg-gradient-to-b from-[#faf8ff] to-[#f4f8ff] px-2.5 py-3 [scrollbar-width:thin]"
              role="log"
              aria-label={`${activeThread.name} ile fısıltı konuşması`}
              aria-live="polite"
            >
              {activeMessages.map((message) => (
                <div key={message.uid} className={`flex w-full ${message.self ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                      message.self
                        ? 'rounded-br-md border border-[#c9e8f4] bg-[#dff3fa] text-[#2f4a5c]'
                        : 'rounded-bl-md border border-[#e5d8fa] bg-[#f0e9ff] text-[#4a3b5c]'
                    }`}
                  >
                    <p className="break-words text-sm font-semibold leading-relaxed">{message.text}</p>
                    <p className={`mt-0.5 text-right text-[10px] font-bold ${message.self ? 'text-[#6a95a8]' : 'text-[#978aa7]'}`}>
                      {fmtClock(message.ts)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {emojiOpen && (
              <div className="mb-2 grid shrink-0 grid-cols-8 gap-1 rounded-2xl border border-[#eee6f8] bg-[#faf7ff] p-1.5" role="group" aria-label="Emoji seç">
                {CHAT_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    aria-label={emoji}
                    onClick={() => {
                      setReplyText((text) => (text.length + emoji.length <= 140 ? text + emoji : text))
                      if (!touch) inputRef.current?.focus()
                    }}
                    className="grid h-9 place-items-center rounded-xl text-xl transition hover:bg-[#ffedd6]/70 active:scale-90"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={sendReply} className="flex shrink-0 items-center gap-2 rounded-2xl border border-[#e7dff0] bg-white p-1.5 shadow-sm">
              <button
                type="button"
                onClick={() => setEmojiOpen((isOpen) => !isOpen)}
                aria-label="Emoji seç"
                aria-expanded={emojiOpen}
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl transition active:scale-95 ${
                  emojiOpen ? 'bg-[#efe6ff] text-[#6b4fc0]' : 'bg-[#faf7ff] text-[#8a7a9c] hover:bg-[#efe6ff]'
                }`}
              >
                😊
              </button>
              <input
                ref={inputRef}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                maxLength={140}
                autoComplete="off"
                enterKeyHint="send"
                aria-label={`${activeThread.name} kişisine fısıltı yaz`}
                placeholder="Mesajını yaz…"
                className="min-w-0 flex-1 rounded-xl bg-transparent px-2.5 py-2.5 text-sm font-semibold text-[#4a3b5c] outline-none placeholder:text-[#9b8eaa]"
              />
              <button
                type="submit"
                disabled={!replyText.trim()}
                className={`min-h-11 shrink-0 rounded-xl border-b-4 px-3 text-sm font-extrabold active:translate-y-[2px] active:border-b-2 ${
                  replyText.trim() ? 'border-[#d78a1c] bg-[#fdb252] text-white' : 'border-[#e5e0eb] bg-[#f3f0f6] text-[#9b93a5]'
                }`}
              >
                Gönder
              </button>
            </form>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-2xl bg-[#faf6ff] px-4 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-sm">
              <Em e="💌" size={26} />
            </span>
            <p className="text-sm font-bold text-[#8a7a9c]">Henüz bir fısıltı konuşman yok.</p>
            <p className="text-xs font-semibold text-[#a397b0]">Bir oyuncuya yaklaş ve etkileşim menüsünden fısılda.</p>
          </div>
        )}
      </div>
    </div>
  )
}
