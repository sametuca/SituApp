// Sohbet paneli (genel/özel mesajlar, yazma ve ikili sohbet bağlantıları).
import { useEffect, useRef, useState } from 'react'
import { Ico } from '../components/Icon'

const glass = 'border-2 border-white bg-white/92 shadow-soft'

// ---------- sohbet ----------
export function ChatPanel({ feed, onSend, status, onAddFriend, onOpenDm, onInspect }) {
  const input = useRef(null)
  const list = useRef(null)
  const popRef = useRef(null)
  const [text, setText] = useState('')
  const [picked, setPicked] = useState(null) // { id, name }

  useEffect(() => {
    const onKey = (e) => {
      const typing = e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)
      if (e.key === 'Escape' && picked) {
        setPicked(null)
        return
      }
      if (e.key === 'Enter' && !typing) {
        e.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [picked])

  useEffect(() => {
    if (!picked) return
    const off = (e) => {
      if (!popRef.current?.contains(e.target)) setPicked(null)
    }
    window.addEventListener('pointerdown', off)
    return () => window.removeEventListener('pointerdown', off)
  }, [picked])

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

  const pickNick = (id, name) => {
    if (!id || !name) return
    setPicked((cur) => (cur?.id === id ? null : { id, name }))
  }

  const startWhisper = (name) => {
    setPicked(null)
    setText(`/f ${name} `)
    requestAnimationFrame(() => input.current?.focus())
  }

  const stripChatIcons = (s) =>
    String(s ?? '')
      .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()

  return (
    <div className="absolute bottom-3 left-3 z-10 flex w-[min(92vw,24rem)] flex-col gap-2">
      {picked && (
        <div
          ref={popRef}
          className={`pointer-events-auto animate-pop flex flex-col gap-1.5 rounded-2xl p-2.5 ${glass}`}
          role="dialog"
          aria-label={picked.name}
        >
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="truncate text-sm font-black text-[#4a3b5c]">{picked.name}</span>
            <button type="button" onClick={() => setPicked(null)} aria-label="Kapat" className="grid h-6 w-6 place-items-center rounded-full bg-[#f6f0ff] hover:bg-[#ffedd6]">
              <Ico name="close" size={11} />
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {onAddFriend && (
              <button
                type="button"
                onClick={() => {
                  onAddFriend(picked)
                  setPicked(null)
                }}
                className="flex h-9 w-full items-center justify-center rounded-xl border-b-2 border-[#d98a1c] bg-[#fdb252] px-3 text-xs font-black text-white active:translate-y-[1px]"
              >
                Arkadaş olarak ekle
              </button>
            )}
            <button
              type="button"
              onClick={() => startWhisper(picked.name)}
              className="flex h-9 w-full items-center justify-center rounded-xl border-b-2 border-[#c9bde6] bg-[#efe8ff] px-3 text-xs font-black text-[#5b3fa8] active:translate-y-[1px]"
            >
              Fısılda
            </button>
            {onOpenDm && (
              <button
                type="button"
                onClick={() => {
                  onOpenDm(picked.id)
                  setPicked(null)
                }}
                className="flex h-9 w-full items-center justify-center rounded-xl border-b-2 border-[#bde0f2] bg-[#e6f6ff] px-3 text-xs font-black text-[#1f5d7a] active:translate-y-[1px]"
              >
                Özel mesaj gönder
              </button>
            )}
            {onInspect && (
              <button
                type="button"
                onClick={() => {
                  onInspect(picked.id)
                  setPicked(null)
                }}
                className="flex h-9 w-full items-center justify-center rounded-xl bg-[#f8f4ff] px-3 text-xs font-extrabold text-[#4a3b5c] hover:bg-[#efe8ff]"
              >
                Profili gör
              </button>
            )}
          </div>
        </div>
      )}
      <div
        ref={list}
        className="pointer-events-auto flex max-h-44 flex-col gap-1 overflow-y-auto rounded-2xl p-1 [scrollbar-width:thin]"
        role="log"
        aria-live="polite"
      >
        {feed.slice(-24).map((m, i) => (
          <p
            key={`${m.ts}-${i}`}
            className={`w-fit max-w-full break-words rounded-2xl px-3 py-1 text-sm font-semibold ${
              m.kind === 'system'
                ? 'bg-[#2b2042]/88 text-[#fff6eb]'
                : m.whisper
                  ? 'border border-[#c9b6f5] bg-[#f4edff]/95 italic text-[#5b3fa8]'
                  : m.self
                    ? 'bg-[#a9ddf5]/95 text-[#2f4a5c]'
                    : 'bg-white/92 text-[#4a3b5c]'
            }`}
          >
            {m.kind === 'system' ? (
              stripChatIcons(m.text)
            ) : m.whisper ? (
              <>
                {m.self ? (
                  <span className="font-extrabold">{`${m.toName ?? ''}’a fısıldadın`}: </span>
                ) : (
                  <>
                    <button type="button" onClick={() => pickNick(m.id, m.name)} className="cursor-pointer font-extrabold hover:underline">
                      {m.name}
                    </button>
                    <span className="font-extrabold"> fısıldadı: </span>
                  </>
                )}
                {stripChatIcons(m.text)}
              </>
            ) : (
              <>
                {m.self ? (
                  <span className="font-extrabold">{m.name}: </span>
                ) : (
                  <>
                    <button type="button" onClick={() => pickNick(m.id, m.name)} className="cursor-pointer font-extrabold text-[#6b4fc0] hover:underline">
                      {m.name}
                    </button>
                    <span className="font-extrabold">: </span>
                  </>
                )}
                {stripChatIcons(m.text)}
              </>
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
          className={`w-full rounded-2xl px-4 py-3 text-base font-semibold text-[#4a3b5c] outline-none placeholder:text-[#8a7a9c]/70 focus:ring-4 focus:ring-[#d6c7ff]/70 ${glass}`}
        />
      </form>
    </div>
  )
}
