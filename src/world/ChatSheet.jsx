// Özel sohbet (DM) çekmecesi ve sohbet açma düğmesi.
import { useEffect, useRef, useState } from 'react'
import { Ico } from '../components/Icon'
import { MicButton, StickerBubble, StickerPanel, VoiceBubble } from './features/media'
import { CHAT_EMOJIS, QUICK_REPLIES } from './interact'
import Portrait from './Portrait'
import { glass } from './socialShared'
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
        <button onClick={onClose} aria-label="Sohbeti kapat" className="grid h-9 w-9 place-items-center rounded-full hover:bg-[#ffedd6]/70">
          <Ico name="close" size={14} />
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
            {m.kind === 'system' ? m.text : m.whisper ? m.text : !peer && !m.self ? <><b>{m.name}: </b>{m.text}</> : peer && m.self && m.dm ? <>{m.text}<span className={`ml-1.5 text-[11px] font-black ${m.ts <= readUpTo ? 'text-[#3b8fd6]' : 'text-[#2f4a5c]/50'}`} title={m.ts <= readUpTo ? 'Okundu' : 'Gönderildi'}>{m.ts <= readUpTo ? '✓✓' : '✓'}</span></> : m.text}
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
      className={`absolute z-10 grid h-14 w-14 place-items-center rounded-full text-2xl transition active:scale-95 ${glass}`}
      style={{ right: 'max(0.85rem, env(safe-area-inset-right))', bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <Ico name="chat" size={28} />
    </button>
  )
}
