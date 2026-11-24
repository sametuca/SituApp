// Küçük iş (istemci): Gece Kulübü'nde DJ olma. Sunucu: server/features/dj.js; bağlantı ayrıştırıcı: src/world/djLinks.js.
// Çalma: YouTube (IFrame API, herkeste aynı noktadan: sunucu zamanına göre seekTo) ve Spotify (resmi embed; dinleyici Spotify'a
// giriş yapmadıysa 30 sn önizleme çalar). Oynatıcı gizlenmez (platform kuralı): yerel "sessize al" oynatıcıyı kapatır.
import { useEffect, useRef, useState } from 'react'
import { isTrack, parseTrack, trackLabel } from '../djLinks'

const VENUE = 'kulup'
const glass = 'border-2 border-white bg-white/90 shadow-soft backdrop-blur-md'
const HISTORY_KEY = 'situapp_dj_history'
const btn = 'rounded-xl border-b-4 px-3 py-2 text-sm font-extrabold active:translate-y-[2px] active:border-b-2'

// ---------- oynatıcı komut dosyaları (bir kez yüklenir) ----------
let ytReady = null
const loadYT = () =>
  (ytReady ??= new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT)
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve(window.YT)
    }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.async = true
    s.onerror = () => {
      ytReady = null
      reject(new Error('youtube'))
    }
    document.head.appendChild(s)
  }))

let spReady = null
const loadSp = () =>
  (spReady ??= new Promise((resolve, reject) => {
    if (window.__spApi) return resolve(window.__spApi)
    window.onSpotifyIframeApiReady = (api) => {
      window.__spApi = api
      resolve(api)
    }
    const s = document.createElement('script')
    s.src = 'https://open.spotify.com/embed/iframe-api/v1'
    s.async = true
    s.onerror = () => {
      spReady = null
      reject(new Error('spotify'))
    }
    document.head.appendChild(s)
  }))

function YtPlayer({ track, getOffset, onError }) {
  const host = useRef(null)
  useEffect(() => {
    let dead = false
    let player = null
    const el = document.createElement('div')
    host.current.appendChild(el)
    loadYT()
      .then((YT) => {
        if (dead) return
        const vars = { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1, start: Math.floor(getOffset() / 1000) }
        const cfg = { width: '100%', height: '100%', playerVars: vars, events: { onReady: (e) => e.target.playVideo(), onError: () => onError?.() } }
        if (track.kind === 'playlist') {
          vars.listType = 'playlist'
          vars.list = track.id
        } else cfg.videoId = track.id
        player = new YT.Player(el, cfg)
      })
      .catch(() => onError?.())
    return () => {
      dead = true
      try {
        player?.destroy()
      } catch {
        /* oynatıcı zaten kapanmış */
      }
      el.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.id, track.kind])
  return <div ref={host} className="h-full w-full" />
}

function SpPlayer({ track, onError }) {
  const host = useRef(null)
  useEffect(() => {
    let dead = false
    let ctl = null
    const el = document.createElement('div')
    host.current.appendChild(el)
    loadSp()
      .then((api) => {
        if (dead) return
        api.createController(el, { uri: `spotify:${track.kind}:${track.id}`, width: '100%', height: 152 }, (c) => {
          ctl = c
          c.addListener('ready', () => {
            try {
              c.play()
            } catch {
              /* tarayıcı otomatik çalmaya izin vermedi: dinleyici ▶'ye basar */
            }
          })
        })
      })
      .catch(() => onError?.())
    return () => {
      dead = true
      try {
        ctl?.destroy()
      } catch {
        /* zaten kapanmış */
      }
      el.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.id, track.kind])
  return <div ref={host} className="h-full w-full" />
}

function readHistory() {
  try {
    const h = JSON.parse(localStorage.getItem(HISTORY_KEY))
    return Array.isArray(h) ? h.filter((u) => typeof u === 'string').slice(0, 6) : []
  } catch {
    return []
  }
}

function DjCard({ d, selfId, fire, result, muted, setMuted, onJoin, onLeave, onPlay, onStop, onFire }) {
  const [open, setOpen] = useState(true)
  const [url, setUrl] = useState('')
  const [err, setErr] = useState('')
  const [playerErr, setPlayerErr] = useState(false)
  const [history, setHistory] = useState(readHistory)
  const [, setTick] = useState(0)
  const now = d?.now
  const track = isTrack(now?.track) ? now.track : null
  const mine = now?.id === selfId
  const place = d?.queue.findIndex((q) => q.id === selfId) ?? -1

  useEffect(() => {
    if (!now) return
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [now])
  useEffect(() => setPlayerErr(false), [track?.id, now?.track?.at])

  const left = now ? Math.max(0, now.left - (Date.now() - d.at)) : 0
  const mm = Math.floor(left / 60000)
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0')
  const getOffset = () => Math.max(0, Date.now() + d.skew - (now?.track?.at ?? Date.now()))

  const submit = (e, raw = url) => {
    e?.preventDefault()
    if (!parseTrack(raw)) return setErr('Geçerli bir YouTube ya da Spotify bağlantısı yapıştır.')
    setErr('')
    onPlay(raw)
    const next = [raw.trim(), ...history.filter((h) => h !== raw.trim())].slice(0, 6)
    setHistory(next)
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
    } catch {
      /* depolama kapalı */
    }
    setUrl('')
  }

  return (
    <div className="pointer-events-none absolute right-2 top-1/2 z-20 -translate-y-1/2">
      <div className={`pointer-events-auto w-[min(60vw,15.5rem)] animate-pop rounded-3xl p-2.5 ${glass}`}>
        <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left" aria-expanded={open}>
          <span className="text-xl" aria-hidden>
            🎧
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-black text-[#4a3b5c]">{now ? `${now.name} DJ’de` : 'DJ kabini boş'}</span>
          {now && fire > 0 && <span className="rounded-full bg-[#ffe3d0] px-2 py-0.5 text-xs font-black text-[#c2570a]">🔥 {fire}</span>}
          <span className="text-xs font-black text-[#8a7a9c]">{open ? '▾' : '▸'}</span>
        </button>
        {open && (
          <div className="mt-2 flex flex-col gap-2">
            {now && (
              <div className="h-1.5 overflow-hidden rounded-full bg-[#f1e8ff]" title={`Vardiya: ${mm}:${ss}`}>
                <div className="h-full rounded-full bg-[#a88bff] transition-[width] duration-1000" style={{ width: `${(left / now.dur) * 100}%` }} />
              </div>
            )}

            {track && !muted && !playerErr && (
              <div
                key={`${track.p}-${track.id}-${now.track.at}`}
                className={`mx-auto overflow-hidden rounded-2xl bg-black ${track.p === 'yt' ? 'h-[200px] w-[200px]' : 'h-[152px] w-full'}`}
              >
                {track.p === 'yt' ? <YtPlayer track={track} getOffset={getOffset} onError={() => setPlayerErr(true)} /> : <SpPlayer track={track} onError={() => setPlayerErr(true)} />}
              </div>
            )}
            {track && playerErr && <p className="rounded-2xl bg-[#e8faf9] px-3 py-2 text-xs font-bold text-[#4a8e8c]">Bu parça gömülü çalmaya kapalı ya da yüklenemedi.</p>}
            {track && (
              <p className="text-center text-[11px] font-extrabold text-[#8a7a9c]">
                {trackLabel(track)}
                {track.p === 'sp' && ' · giriş yapmadıysan 30 sn önizleme'}
              </p>
            )}
            {now && !track && <p className="text-center text-xs font-bold text-[#8a7a9c]">{mine ? 'Bir bağlantı yapıştırıp çal 👇' : 'DJ yeni şarkı seçiyor…'}</p>}

            {mine ? (
              <form onSubmit={submit} className="flex flex-col gap-1.5">
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="YouTube / Spotify bağlantısı"
                  aria-label="Şarkı bağlantısı"
                  autoComplete="off"
                  className="min-w-0 rounded-xl border-2 border-[#d6c7ff] bg-white px-3 py-2 text-xs font-semibold text-[#4a3b5c] outline-none focus:ring-4 focus:ring-[#d6c7ff]/60"
                />
                {err && <p className="text-[11px] font-bold text-rose-400">{err}</p>}
                <div className="flex gap-1.5">
                  <button type="submit" className={`${btn} flex-1 border-[#53c1bf] bg-[#71dedd] text-white`}>
                    ▶ Çal
                  </button>
                  {track && (
                    <button type="button" onClick={onStop} className={`${btn} border-[#c9b6f5] bg-[#e9ddff] text-[#5b3fa8]`}>
                      ⏹
                    </button>
                  )}
                </div>
                {history.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {history.slice(0, 3).map((h) => (
                      <button key={h} type="button" onClick={() => submit(null, h)} className="max-w-full truncate rounded-full bg-[#f1e8ff] px-2 py-1 text-[10px] font-bold text-[#5b3fa8]">
                        ↻ {h.replace(/^https?:\/\/(www\.)?/, '').slice(0, 26)}
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" onClick={onLeave} className="text-xs font-extrabold text-[#8a7a9c] hover:underline">
                  Vardiyayı bitir
                </button>
              </form>
            ) : (
              <>
                {now && track && (
                  <div className="flex gap-1.5">
                    <button onClick={onFire} className={`${btn} flex-1 border-[#f0a060] bg-[#ffc58a] text-[#7a3a00]`}>
                      🔥 Bahşiş
                    </button>
                    <button onClick={() => setMuted((m) => !m)} aria-pressed={muted} className={`${btn} border-[#c9b6f5] bg-[#e9ddff] text-[#5b3fa8]`} title="Oynatıcıyı kapat/aç">
                      {muted ? '🔇' : '🔊'}
                    </button>
                  </div>
                )}
                {d?.queue.length > 0 && (
                  <p className="truncate text-[11px] font-bold text-[#8a7a9c]">
                    Sırada ({d.queue.length}): {d.queue.map((q) => q.name).join(', ')}
                  </p>
                )}
                {place >= 0 ? (
                  <button onClick={onLeave} className={`${btn} border-[#c9b6f5] bg-[#e9ddff] text-[#5b3fa8]`}>
                    Sıradan çık ({place + 1}.)
                  </button>
                ) : (
                  <button onClick={onJoin} className={`${btn} border-[#53c1bf] bg-[#71dedd] text-white`}>
                    🎧 DJ ol
                  </button>
                )}
              </>
            )}

            {result && !now && (
              <p className="animate-pop rounded-2xl bg-[#fff3c8] px-3 py-2 text-center text-xs font-black text-[#8a5a00]">
                🎧 Vardiya bitti: {result.tracks} şarkı, 🔥 {result.fire}, +{result.earned} 🪙
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function useDj(ctx) {
  const { net, venue, focusRef } = ctx
  const { on, send } = net
  const inClub = venue === VENUE
  const [d, setD] = useState(null) // { queue, now, skew, at }
  const [fire, setFire] = useState(0)
  const [result, setResult] = useState(null)
  const [muted, setMuted] = useState(false)
  const resultTimer = useRef(null)

  useEffect(() => {
    const offs = [
      on('room', (m) => {
        setD(null)
        setFire(0)
        setResult(null)
        if (m.venue === VENUE) send({ t: 'dj_get' })
      }),
      on('dj', (m) => {
        setD({ queue: m.queue ?? [], now: m.now, skew: (m.ts ?? Date.now()) - Date.now(), at: Date.now() })
        setFire(m.now?.fire ?? 0)
        if (m.now) setResult(null)
      }),
      on('dj_fire', (m) => setFire(m.n)),
      on('dj_turn', (m) => {
        focusRef.current.teleport = [m.x, m.z, m.ry]
      }),
      on('dj_end', (m) => {
        setResult(m)
        clearTimeout(resultTimer.current)
        resultTimer.current = setTimeout(() => setResult(null), 9000)
      }),
    ]
    return () => {
      offs.forEach((off) => off())
      clearTimeout(resultTimer.current)
    }
  }, [on, send, focusRef])

  // oynatıcı çalarken ortam müziğini kıs
  const playing = inClub && Boolean(d?.now?.track) && !muted
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('situapp:duck', { detail: playing }))
    return () => window.dispatchEvent(new CustomEvent('situapp:duck', { detail: false }))
  }, [playing])

  const overlays = inClub ? (
    <DjCard
      d={d}
      selfId={net.selfId.current}
      fire={fire}
      result={result}
      muted={muted}
      setMuted={setMuted}
      onJoin={() => send({ t: 'dj_join' })}
      onLeave={() => send({ t: 'dj_leave' })}
      onPlay={(url) => send({ t: 'dj_play', url })}
      onStop={() => send({ t: 'dj_stop' })}
      onFire={() => send({ t: 'dj_fire' })}
    />
  ) : null

  return { overlays }
}
