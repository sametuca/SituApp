// Medya özelliği (istemci): özel sohbette sesli mesaj ve çıkartmalar. Sunucu tarafı: server/features/media.js.
import { useEffect, useRef, useState } from 'react'
import { STICKER_SETS, stickerById } from './stickers'

export const VOICE_MAX_SEC = 10
const VOICE_MIN_SEC = 0.6
const VOICE_MAX_BYTES = 96 * 1024
const BUBBLE_MS = 6000

function blobUrl(b64, mime) {
  try {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return URL.createObjectURL(new Blob([bytes], { type: mime }))
  } catch {
    return null
  }
}

const fileToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = reject
    r.readAsDataURL(blob)
  })

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported?.(m)) ?? ''
}

/** Mesaj akışına sesli mesaj / çıkartma ekler; çıkartmayı kafa üstü balon olarak da gösterir. */
export function useMedia({ net, pushFeed }) {
  const { on, selfId, bubbles } = net
  useEffect(() => {
    const offVoice = on('voice', (m) => {
      const url = blobUrl(m.data, m.mime)
      if (!url) return
      pushFeed({ id: m.id, name: m.name, ts: m.ts, to: m.to, dm: true, self: m.id === selfId.current, text: '🎤 Sesli mesaj', voice: { url, dur: m.dur } })
    })
    const offSticker = on('sticker', (m) => {
      const s = stickerById(m.sticker)
      if (!s) return
      if (!m.dm) bubbles.current.set(m.id, { text: s.art, big: true, until: Date.now() + BUBBLE_MS })
      pushFeed({ id: m.id, name: m.name, ts: m.ts, to: m.to, dm: Boolean(m.dm), self: m.id === selfId.current, text: `${s.art} ${s.label}`, sticker: s.id })
    })
    return () => {
      offVoice()
      offSticker()
    }
  }, [on, pushFeed, selfId, bubbles])
  return {}
}

// ---------------------------------------------------------------- sohbet bileşenleri

/** Sohbet balonunda büyük çıkartma. */
export function StickerBubble({ id, self }) {
  const s = stickerById(id)
  if (!s) return null
  return (
    <div className={`flex w-fit max-w-[85%] flex-col items-center rounded-3xl border-2 border-white px-4 py-2 shadow-soft ${self ? 'self-end' : 'self-start'}`} style={{ background: s.bg }}>
      <span className="text-5xl leading-tight">{s.art}</span>
      <span className="text-[0.6875rem] font-extrabold text-[#4a3b5c]">{s.label}</span>
    </div>
  )
}

/** Sesli mesaj balonu: oynat/durdur + süre. */
export function VoiceBubble({ voice, self }) {
  const audio = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)

  useEffect(
    () => () => {
      audio.current?.pause()
    },
    [],
  )

  const toggle = () => {
    if (!audio.current) {
      const a = new Audio(voice.url)
      a.ontimeupdate = () => setPos(a.duration ? a.currentTime / a.duration : 0)
      const duckMusic = (on) => window.dispatchEvent(new CustomEvent('situapp:duck', { detail: on }))
      a.onended = () => {
        duckMusic(false)
        setPlaying(false)
        setPos(0)
      }
      a.onpause = () => {
        duckMusic(false)
        setPlaying(false)
      }
      a.onplay = () => {
        duckMusic(true)
        setPlaying(true)
      }
      audio.current = a
    }
    const a = audio.current
    if (a.paused) a.play().catch(() => setPlaying(false))
    else a.pause()
  }
  const secs = Math.max(1, Math.round(voice.dur))
  return (
    <div className={`flex w-48 max-w-[85%] items-center gap-2 rounded-2xl px-2 py-1.5 ${self ? 'self-end bg-[#a9ddf5] text-[#2f4a5c]' : 'self-start bg-[#f1e6ff] text-[#4a3b5c]'}`}>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Sesi durdur' : 'Sesli mesajı oynat'}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-b-2 border-[#e8952c] bg-[#fdb252] text-sm text-white active:translate-y-px"
      >
        {playing ? '🛑' : '🎵'}
      </button>
      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/70">
        <div className="h-full rounded-full bg-[#fdb252] transition-[width]" style={{ width: `${Math.round(pos * 100)}%` }} />
      </div>
      <span className="shrink-0 text-xs font-extrabold tabular-nums">0:{String(secs).padStart(2, '0')}</span>
    </div>
  )
}

/** Çıkartma seçici: set sekmeleri + 4×2 ızgara. */
export function StickerPanel({ onPick }) {
  const [setId, setSetId] = useState(STICKER_SETS[0].id)
  const set = STICKER_SETS.find((s) => s.id === setId)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5" role="tablist" aria-label="Çıkartma setleri">
        {STICKER_SETS.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={s.id === setId}
            type="button"
            onClick={() => setSetId(s.id)}
            className={`flex-1 rounded-xl px-1 py-1.5 text-xs font-extrabold transition active:scale-95 ${s.id === setId ? 'bg-[#fdb252] text-white' : 'bg-white text-[#4a3b5c]'}`}
          >
            {s.emoji} {s.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {set.items.map((it, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPick(`${set.id}-${i}`)}
            aria-label={it.label}
            className="flex flex-col items-center rounded-2xl border-2 border-white px-0.5 py-1 shadow-soft transition active:scale-90"
            style={{ background: set.bg }}
          >
            <span className="text-3xl leading-tight">{it.art}</span>
            <span className="line-clamp-1 w-full text-center text-[0.5625rem] font-extrabold text-[#4a3b5c]">{it.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Basılı tut → kaydet, bırak → gönder, sola kaydır → iptal. onSend({ mime, dur, data }) → boolean (çevrimiçi mi).
 */
export function MicButton({ onSend }) {
  const [recording, setRecording] = useState(false)
  const [secs, setSecs] = useState(0)
  const [cancel, setCancel] = useState(false)
  const [notice, setNotice] = useState('')
  const job = useRef(null)
  const noticeTimer = useRef(null)

  const say = (t) => {
    setNotice(t)
    clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(''), 4500)
  }
  useEffect(
    () => () => {
      clearTimeout(noticeTimer.current)
      const j = job.current
      if (j) {
        j.cancelled = true
        j.released = true
        if (j.recorder?.state === 'recording') j.recorder.stop()
        j.stream?.getTracks().forEach((t) => t.stop())
      }
    },
    [],
  )

  const finish = (cancelled) => {
    const j = job.current
    if (!j || j.released) return
    j.released = true
    j.cancelled = cancelled
    if (j.recorder?.state === 'recording') j.recorder.stop()
  }

  const start = (e) => {
    if (job.current || e.button > 0) return
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* sorun değil */
    }
    if (!navigator.mediaDevices?.getUserMedia || pickMime() === null) return say('🎤 Bu tarayıcı sesli mesajı desteklemiyor.')
    const j = { x0: e.clientX, released: false, cancelled: false, chunks: [], recorder: null, stream: null, t0: 0, timers: [] }
    job.current = j
    const cleanup = () => {
      j.timers.forEach(clearTimeout)
      j.timers.forEach(clearInterval)
      j.stream?.getTracks().forEach((t) => t.stop())
      job.current = null
      setRecording(false)
      setCancel(false)
      setSecs(0)
    }
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        j.stream = stream
        if (j.released) {
          cleanup()
          return say('🎤 Mikrofon hazır. Kaydetmek için düğmeye basılı tut.')
        }
        const mimeType = pickMime()
        const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 24000 })
        j.recorder = recorder
        recorder.ondataavailable = (ev) => ev.data.size && j.chunks.push(ev.data)
        recorder.onstop = async () => {
          const dur = (Date.now() - j.t0) / 1000
          const cancelled = j.cancelled
          const mime = recorder.mimeType || mimeType || 'audio/webm'
          const blob = new Blob(j.chunks, { type: mime })
          cleanup()
          if (cancelled) return
          if (dur < VOICE_MIN_SEC) return say('🎤 Biraz daha uzun basılı tut.')
          if (blob.size > VOICE_MAX_BYTES) return say('🎤 Kayıt çok büyük oldu, daha kısa tut.')
          try {
            const data = await fileToBase64(blob)
            if (!onSend({ mime, dur: Math.round(Math.min(dur, VOICE_MAX_SEC) * 10) / 10, data })) say('Şu an çevrimdışısın, ses gönderilemedi.')
          } catch {
            say('🎤 Kayıt gönderilemedi.')
          }
        }
        recorder.start()
        j.t0 = Date.now()
        setRecording(true)
        j.timers.push(setInterval(() => setSecs(Math.min(VOICE_MAX_SEC, (Date.now() - j.t0) / 1000)), 100))
        j.timers.push(setTimeout(() => finish(j.cancelled), VOICE_MAX_SEC * 1000))
      })
      .catch(() => {
        cleanup()
        say('🎤 Mikrofon izni gerekli. Tarayıcı ayarlarından izin verip tekrar dene.')
      })
  }

  const move = (e) => {
    const j = job.current
    if (!j || j.released || !j.recorder) return
    const c = e.clientX - j.x0 < -70
    if (c !== j.cancelled) {
      j.cancelled = c
      setCancel(c)
    }
  }
  const end = () => finish(job.current?.cancelled ?? false)

  return (
    <div className="relative">
      {notice && (
        <p role="status" className="absolute bottom-full right-0 z-10 mb-2 w-60 animate-pop rounded-2xl bg-[#4a3b5c] px-3 py-2 text-xs font-bold text-white shadow-toy">
          {notice}
        </p>
      )}
      {recording && (
        <div className={`absolute bottom-full right-0 z-10 mb-2 flex w-56 animate-pop items-center gap-2 rounded-2xl px-3 py-2 text-xs font-extrabold shadow-toy ${cancel ? 'bg-[#ffe3e3] text-[#c0392b]' : 'bg-[#fff2e0] text-[#a36a21]'}`}>
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-[#fda521]" />
          <span className="tabular-nums">0:{String(Math.floor(secs)).padStart(2, '0')}</span>
          <span className="min-w-0 flex-1 truncate text-right">{cancel ? 'Bırak: iptal' : '← kaydır: iptal'}</span>
        </div>
      )}
      <button
        type="button"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={() => finish(true)}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Sesli mesaj: basılı tut ve konuş"
        title="Basılı tut, konuş, bırakınca gönder"
        style={{ touchAction: 'none' }}
        className={`grid h-11 w-11 shrink-0 select-none place-items-center rounded-2xl border-2 text-xl transition active:scale-95 ${recording ? (cancel ? 'border-[#ff9a9a] bg-[#ffe3e3]' : 'scale-110 border-[#fdb252] bg-[#fff2e0]') : 'border-[#d6c7ff]/70 bg-white'}`}
      >
        🎤
      </button>
    </div>
  )
}
