// Geri bildirim: ⚙️ menüsünde "Geri bildirim" + ara sıra beliren küçük davet kartı. Gönderim: POST /api/feedback (server/feedback.js);
// alıcı e-posta adresi yalnızca sunucuda durur, burada hiçbir yerde gösterilmez.
import { useEffect, useState } from 'react'
import { Modal } from '../Hud'
import { Ico } from '../../components/Icon'
import { ToyButton } from '../../components/ui'

const KEY = 'situapp_fb_v1'
const FIRST_MS = 10 * 60 * 1000
const EVERY_MS = 40 * 60 * 1000
const MAX_ASKS = 4
const KINDS = [
  ['bug', '🐞 Hata'],
  ['idea', '💡 Öneri'],
  ['love', '😍 Beğendim'],
  ['other', '💬 Diğer'],
]
const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {}
  } catch {
    return {}
  }
}
const write = (v) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(v))
  } catch {
    /* yok say */
  }
}

function FeedbackModal({ who, onClose, onSent }) {
  const [kind, setKind] = useState('idea')
  const [text, setText] = useState('')
  const [contact, setContact] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)
  const send = async () => {
    setBusy(true)
    setErr('')
    try {
      const r = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, text, contact, who, page: location.pathname }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) throw new Error(d.error || 'Gönderilemedi, birazdan tekrar dene.')
      setDone(true)
      onSent?.()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal onClose={onClose} label="Geri bildirim">
      {done ? (
        <div className="text-center">
          <div className="text-5xl">💌</div>
          <h2 className="mt-2 text-xl font-black text-ink">Teşekkürler!</h2>
          <p className="mt-1 text-sm font-semibold text-ink-soft">Mesajın bize ulaştı. SituApp henüz çok yeni, her yorum onu daha iyi yapıyor.</p>
          <div className="mt-4">
            <ToyButton onClick={onClose}>Tamam</ToyButton>
          </div>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-black text-ink">Geri bildirim</h2>
          <p className="mt-1 text-sm font-semibold text-ink-soft">SituApp pre-alpha aşamasında. Ne düşündüğünü, neyi sevdiğini ya da neyin bozuk olduğunu yaz, doğrudan geliştiriciye ulaşır.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {KINDS.map(([id, label]) => (
              <button key={id} onClick={() => setKind(id)} aria-pressed={kind === id} className={`rounded-full border-2 px-3 py-1 text-sm font-extrabold transition active:scale-95 ${kind === id ? 'border-white bg-[#fdb252] text-white shadow' : 'border-white bg-white/70 text-[#4a3b5c]'}`}>
                {label}
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1500}
            rows={5}
            placeholder="Mesajın…"
            className="mt-3 w-full resize-none rounded-2xl border-2 border-white bg-white/80 p-3 text-sm font-semibold text-[#4a3b5c] shadow-inner outline-none focus:border-[#fdb252]"
          />
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            maxLength={120}
            placeholder="E-posta (isteğe bağlı, yanıt istersen)"
            className="mt-2 w-full rounded-2xl border-2 border-white bg-white/80 px-3 py-2 text-sm font-semibold text-[#4a3b5c] outline-none focus:border-[#fdb252]"
          />
          {err && <p className="mt-2 text-xs font-bold text-rose-400">{err}</p>}
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-[0.6875rem] font-bold text-ink-soft">{text.length}/1500</span>
            <ToyButton onClick={send} loading={busy} disabled={text.trim().length < 5}>
              Gönder
            </ToyButton>
          </div>
        </>
      )}
    </Modal>
  )
}

export function useFeedback({ panel, setPanel, venue, home, name: who }) {
  const [ask, setAsk] = useState(false)
  // ara sıra nazik bir davet kartı
  useEffect(() => {
    const st = read()
    if ((st.asks ?? 0) >= MAX_ASKS || st.sent) return undefined
    const born = st.born ?? Date.now()
    if (!st.born) write({ ...st, born })
    const check = () => {
      const s = read()
      if ((s.asks ?? 0) >= MAX_ASKS || s.sent) return
      const due = (s.lastAsk ?? born + FIRST_MS - EVERY_MS) + EVERY_MS
      if (Date.now() >= due && !document.hidden) setAsk(true)
    }
    const t = setInterval(check, 30_000)
    return () => clearInterval(t)
  }, [])

  const dismiss = () => {
    const s = read()
    write({ ...s, asks: (s.asks ?? 0) + 1, lastAsk: Date.now() })
    setAsk(false)
  }
  const open = () => {
    dismiss()
    setPanel('feedback')
  }

  const menuNodes = (
    <button onClick={() => setPanel('feedback')} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm font-extrabold text-[#4a3b5c] transition hover:bg-[#fff3e4]">
      <Ico name="feedback" size={22} />
      <span className="flex-1">Geri bildirim</span>
    </button>
  )

  const overlays = (
    <>
      {ask && !panel && !venue && !home && (
        <div
          className="pointer-events-auto fixed inset-0 z-40 grid place-items-center bg-[#4a3b5c]/30 p-4 backdrop-blur-[2px]"
          onClick={dismiss}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Oyunu nasıl buluyorsun?"
            onClick={(e) => e.stopPropagation()}
            className="relative flex w-[min(92vw,26rem)] animate-pop flex-col items-center rounded-[2rem] border-2 border-white bg-white/95 p-6 text-center shadow-toy backdrop-blur-md"
          >
            <button
              type="button"
              onClick={dismiss}
              aria-label="Kapat"
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-[#f6f0ff] text-sm font-black text-[#8a7a9c] transition hover:bg-[#ffedd6]/70"
            >
              ✕
            </button>
            <span className="grid h-16 w-16 place-items-center rounded-3xl bg-[#fff3c8] shadow-soft">
              <Ico name="feedback" size={38} />
            </span>
            <h2 className="mt-3 text-xl font-black text-[#4a3b5c]">Oyunu nasıl buluyorsun?</h2>
            <p className="mt-1.5 max-w-xs text-sm font-semibold leading-relaxed text-[#8a7a9c]">
              SituApp pre-alpha aşamasında. Kısa bir geri bildirimin oyunu geliştirmemize çok yardımcı olur!
            </p>
            <div className="mt-5 flex w-full gap-2.5">
              <button
                type="button"
                onClick={open}
                className="flex-1 rounded-2xl border-b-4 border-[#d98a1c] bg-[#fdb252] py-3 text-base font-black text-white shadow-soft transition hover:brightness-105 active:translate-y-[2px] active:border-b-2"
              >
                Geri Bildirim Yaz
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="rounded-2xl border-2 border-[#e9ddff] bg-[#faf6ff] px-5 py-3 text-sm font-extrabold text-[#6b4fc0] transition hover:bg-[#f1e8ff] active:scale-95"
              >
                Sonra
              </button>
            </div>
          </div>
        </div>
      )}
      {panel === 'feedback' && (
        <FeedbackModal
          who={who}
          onClose={() => setPanel(null)}
          onSent={() => write({ ...read(), sent: Date.now() })}
        />
      )}
    </>
  )

  return { menuNodes, overlays }
}
