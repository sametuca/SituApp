// Mekân etkinlikleri (istemci): Gece Kulübü karaokesi (kuyruk, sözler, alkış) ve mekân içi çarpışma kaydı.
// Sunucu: server/features/venues.js. Mekân sahnesi: src/world/Venue.jsx, oturma: features/together.jsx.
import { useEffect, useRef, useState } from 'react'
import { KARAOKE_QUEUE_MAX, KARAOKE_SONGS, KARAOKE_SONG_BY_ID, KARAOKE_VENUE } from '../karaokeSongs'
import { resolveVenueRoom, venueLayout } from '../venueLayout'
import { together } from './togetherStore'
import { venueStore } from './venueStore'

const glass = 'border-2 border-white bg-white/85 shadow-soft backdrop-blur-md'

function SongPicker({ onPick, onClose }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-extrabold text-[#8a7a9c]">Bir şarkı seç (sahnede 30 sn):</p>
      {KARAOKE_SONGS.map((s) => (
        <button key={s.id} onClick={() => onPick(s.id)} className="flex items-center gap-2 rounded-2xl border-b-4 border-[#c9b6f5] bg-[#f1e8ff] px-3 py-2 text-left active:translate-y-[2px] active:border-b-2">
          <span className="text-2xl">{s.emoji}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-black text-[#4a3b5c]">{s.title}</span>
            <span className="block truncate text-[11px] font-bold text-[#8a7a9c]">{s.tag} · “{s.lines[0]}”</span>
          </span>
        </button>
      ))}
      <button onClick={onClose} className="rounded-xl py-1 text-xs font-extrabold text-[#8a7a9c]">
        Vazgeç
      </button>
    </div>
  )
}

function Lyrics({ song, left, dur }) {
  const lines = KARAOKE_SONG_BY_ID[song]?.lines ?? []
  const idx = Math.max(0, Math.min(lines.length - 1, Math.floor(((dur - left) / dur) * lines.length)))
  return (
    <div className="mt-2 rounded-2xl bg-[#2b1f4d] px-3 py-2 text-center">
      <p className="truncate text-[11px] font-bold text-[#9d8ac7]">{lines[idx - 1] ?? '♪'}</p>
      <p key={idx} className="animate-pop text-base font-black leading-snug text-[#9ce8da]">
        {lines[idx]}
      </p>
      <p className="truncate text-[11px] font-bold text-[#9d8ac7]">{lines[idx + 1] ?? '♪'}</p>
    </div>
  )
}

function KaraokeCard({ k, selfId, claps, result, onJoin, onLeave, onClap }) {
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!k?.now) return
    const t = setInterval(() => setTick((n) => n + 1), 250)
    return () => clearInterval(t)
  }, [k?.now])
  const now = k?.now
  const left = now ? Math.max(0, now.left - (Date.now() - k.at)) : 0
  const mine = now?.id === selfId
  const place = k?.queue.findIndex((q) => q.id === selfId) ?? -1
  const song = now ? KARAOKE_SONG_BY_ID[now.song] : null
  // sıra gelince / biri söylerken kart kendiliğinden açılır
  const show = open || mine || Boolean(now)
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[5.4rem] z-20 flex flex-col items-center px-3">
      <div className={`pointer-events-auto w-[min(94vw,22rem)] animate-pop rounded-3xl p-2.5 ${glass}`}>
        <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left" aria-expanded={show}>
          <span className="text-xl" aria-hidden>
            🎤
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-black text-[#4a3b5c]">
            {now ? `${now.name} söylüyor${song ? ` · ${song.title}` : ''}` : 'Karaoke · sahne boş'}
          </span>
          {now && <span className="rounded-full bg-[#e8faf9] px-2 py-0.5 text-xs font-black text-[#4a8e8c]">👏 {claps}</span>}
          <span className="text-xs font-black text-[#8a7a9c]">{show ? '▾' : '▸'}</span>
        </button>
        {show && (
          <div className="mt-2">
            {now && (
              <>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#f1e8ff]">
                  <div className="h-full rounded-full bg-[#71dedd] transition-[width] duration-300" style={{ width: `${(left / now.dur) * 100}%` }} />
                </div>
                <Lyrics song={now.song} left={left} dur={now.dur} />
                {mine ? (
                  <div className="mt-2 flex items-center gap-2">
                    <p className="min-w-0 flex-1 text-xs font-extrabold text-[#4a8e8c]">Sahne senin! Alkış: {claps} 👏</p>
                    <button onClick={onLeave} className="rounded-xl border-b-4 border-[#c9b6f5] bg-[#e9ddff] px-3 py-1.5 text-xs font-extrabold text-[#5b3fa8] active:translate-y-[2px] active:border-b-2">
                      İn
                    </button>
                  </div>
                ) : (
                  <button onClick={onClap} className="mt-2 w-full rounded-2xl border-b-4 border-[#53c1bf] bg-[#71dedd] py-2.5 text-base font-extrabold text-white active:translate-y-[2px] active:border-b-2">
                    👏 Alkışla
                  </button>
                )}
              </>
            )}
            {result && !now && (
              <p className="animate-pop rounded-2xl bg-[#fff3c8] px-3 py-2 text-center text-sm font-black text-[#8a5a00]">
                🎉 {result.name} {KARAOKE_SONG_BY_ID[result.song]?.title ? `“${KARAOKE_SONG_BY_ID[result.song].title}” ile ` : ''}
                {result.claps} alkış aldı!
              </p>
            )}
            {k?.queue.length > 0 && (
              <p className="mt-2 truncate text-xs font-bold text-[#8a7a9c]">
                Sırada ({k.queue.length}/{KARAOKE_QUEUE_MAX}): {k.queue.map((q) => q.name).join(', ')}
              </p>
            )}
            <div className="mt-2">
              {picking ? (
                <SongPicker
                  onPick={(id) => {
                    setPicking(false)
                    onJoin(id)
                  }}
                  onClose={() => setPicking(false)}
                />
              ) : mine ? null : place >= 0 ? (
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 text-xs font-extrabold text-[#4a3b5c]">Sıradasın ({place + 1}.)</p>
                  <button onClick={onLeave} className="rounded-xl bg-[#e9ddff] px-3 py-1.5 text-xs font-extrabold text-[#5b3fa8] active:scale-95">
                    Sıradan çık
                  </button>
                </div>
              ) : (
                <button onClick={() => setPicking(true)} className="w-full rounded-2xl border-b-4 border-[#53c1bf] bg-[#71dedd] py-2.5 text-sm font-extrabold text-white active:translate-y-[2px] active:border-b-2">
                  🎤 Karaoke sırasına gir
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function useVenues(ctx) {
  const { net, venue, focusRef } = ctx
  const { on, send } = net
  const inClub = venue === KARAOKE_VENUE
  const [k, setK] = useState(null) // { queue, now, at }
  const [claps, setClaps] = useState(0)
  const [result, setResult] = useState(null)
  const selfId = net.selfId.current
  const resultTimer = useRef(null)

  // mekân içi çarpışma (koltuktan kalkış noktası için): together.collide
  useEffect(() => {
    if (!venue) return
    const L = venueLayout(venue)
    together.collide = (x, z) => resolveVenueRoom(x, z, L.colliders)
    return () => {
      together.collide = null
    }
  }, [venue])

  // karaoke ağ mesajları
  useEffect(() => {
    const offs = [
      on('room', (m) => {
        setK(null)
        setClaps(0)
        setResult(null)
        venueStore.singing = false
        if (m.venue === KARAOKE_VENUE) send({ t: 'kar_get' })
      }),
      on('kar', (m) => {
        setK({ queue: m.queue ?? [], now: m.now, at: Date.now() })
        setClaps(m.now?.claps ?? 0)
        venueStore.singing = Boolean(m.now)
        if (m.now) setResult(null)
      }),
      on('kar_claps', (m) => setClaps(m.n)),
      on('kar_turn', (m) => {
        focusRef.current.teleport = [m.x, m.z, m.ry]
      }),
      on('kar_end', (m) => {
        setResult({ name: m.name, song: m.song, claps: m.claps })
        clearTimeout(resultTimer.current)
        resultTimer.current = setTimeout(() => setResult(null), 6000)
      }),
    ]
    return () => {
      offs.forEach((off) => off())
      clearTimeout(resultTimer.current)
      venueStore.singing = false
    }
  }, [on, send, focusRef])

  const overlays = inClub ? (
    <KaraokeCard
      k={k}
      selfId={selfId}
      claps={claps}
      result={result}
      onJoin={(song) => send({ t: 'kar_join', song })}
      onLeave={() => send({ t: 'kar_leave' })}
      onClap={() => send({ t: 'kar_clap' })}
    />
  ) : null

  return { overlays }
}
