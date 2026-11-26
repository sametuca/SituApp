import { useEffect, useRef, useState } from 'react'
import { VENUE_SOFT_CAP } from './venues'

const glass = 'border-2 border-white bg-white/92 shadow-soft backdrop-blur-md'
const NEARBY_PICK_RANGE = 8.5

/**
 * Mekân içi salon (kanal) seçici hap.
 * Tek mekân 24 kişiyi geçince otomatik Salon 2, 3 açılır; oyuncu tek tıkla salon değiştirebilir.
 */
export function VenueChannelPill({ venueName, channel = 1, channels = [], inRoomCount = 1, onSwitch, onRefresh }) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const off = (e) => {
      if (!boxRef.current?.contains(e.target)) setOpen(false)
    }
    window.addEventListener('pointerdown', off)
    return () => window.removeEventListener('pointerdown', off)
  }, [open])

  const list = channels.length ? channels : [{ ch: channel, count: inRoomCount, cap: VENUE_SOFT_CAP }]
  const cur = list.find((c) => c.ch === channel) ?? { ch: channel, count: inRoomCount, cap: VENUE_SOFT_CAP }
  const count = Math.max(cur.count, inRoomCount)
  const cap = cur.cap ?? VENUE_SOFT_CAP
  const crowded = count >= cap

  return (
    <div
      ref={boxRef}
      className="pointer-events-auto fixed left-1/2 top-0 z-20 -translate-x-1/2"
      style={{ marginTop: 'max(0.65rem, env(safe-area-inset-top))' }}
    >
      <button
        type="button"
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) onRefresh?.()
        }}
        className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-extrabold text-[#4a3b5c] transition hover:bg-white active:scale-95 ${glass}`}
      >
        <span className={`h-2 w-2 rounded-full ${crowded ? 'bg-amber-400' : 'bg-emerald-400'}`} />
        <span className="max-w-[9rem] truncate">{venueName}</span>
        <span className="text-[#a394b5]">·</span>
        <span className="text-[#6d4ec7]">Salon {channel}</span>
        <span className="rounded-full bg-[#f4ecff] px-1.5 py-0.5 text-[11px] font-black text-[#5d42b8]">
          {count}/{cap}
        </span>
      </button>

      {open && (
        <div className="mt-2 w-64 rounded-3xl border-2 border-white bg-white/96 p-2.5 shadow-toy backdrop-blur-md">
          <div className="mb-1.5 flex items-center justify-between px-2">
            <span className="text-xs font-black text-[#4a3b5c]">Mekân Salonları</span>
            <span className="text-[11px] font-bold text-[#8a7a9c]">Kapasite {cap} kişi</span>
          </div>
          <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
            {list.map((c) => {
              const active = c.ch === channel
              const pct = Math.min(100, Math.round((c.count / (c.cap || VENUE_SOFT_CAP)) * 100))
              const full = c.count >= (c.cap || VENUE_SOFT_CAP)
              return (
                <button
                  key={c.ch}
                  type="button"
                  disabled={active}
                  onClick={() => {
                    setOpen(false)
                    onSwitch?.(c.ch)
                  }}
                  className={`flex flex-col gap-1 rounded-2xl px-3 py-2 text-left transition ${
                    active ? 'bg-[#f4ecff] ring-2 ring-[#b799ff]' : 'hover:bg-[#fff6ec] active:scale-[0.98]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-extrabold text-[#4a3b5c]">
                    <span>
                      Salon {c.ch} {active ? '(Buradasın)' : ''}
                    </span>
                    <span className={full ? 'text-amber-600' : 'text-[#6d4ec7]'}>
                      {c.count}/{c.cap || VENUE_SOFT_CAP}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#efe8f8]">
                    <div
                      className={`h-full rounded-full transition-all ${full ? 'bg-amber-400' : 'bg-[#8f74e8]'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 px-2 text-[11px] font-semibold text-[#8a7a9c]">
            Arkadaşların aynı mekândaysa otomatik aynı salona yönlendirilirsin.
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Kalabalıkta hızlı kişi seçici ("Yakındakiler"):
 * 8,5 m içinde 3 veya daha fazla oyuncu varsa çıkar; üst üste binen avatarlara tıklamadan seçim sağlar.
 */
export function NearbyPicker({ remotes, roster, focusRef, touch = false, onPick }) {
  const [open, setOpen] = useState(false)
  const [list, setList] = useState([])
  const boxRef = useRef(null)

  useEffect(() => {
    const refresh = () => {
      const f = focusRef.current
      if (!f) return
      const byId = new Map(roster.map((p) => [p.id, p]))
      const found = []
      for (const r of remotes.current.values()) {
        const d = Math.hypot(r.x - f.x, r.z - f.z)
        if (d <= NEARBY_PICK_RANGE) {
          const info = byId.get(r.id)
          found.push({ id: r.id, name: info?.name ?? r.name, dist: d })
        }
      }
      found.sort((a, b) => a.dist - b.dist)
      setList(found.slice(0, 18))
    }
    refresh()
    const id = setInterval(refresh, 600)
    return () => clearInterval(id)
  }, [remotes, roster, focusRef])

  useEffect(() => {
    if (!open) return
    const off = (e) => {
      if (!boxRef.current?.contains(e.target)) setOpen(false)
    }
    window.addEventListener('pointerdown', off)
    return () => window.removeEventListener('pointerdown', off)
  }, [open])

  if (list.length < 3) return null

  return (
    <div
      ref={boxRef}
      className={`pointer-events-auto fixed z-20 ${touch ? 'right-3 top-16' : 'bottom-[15.6rem] left-3'}`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-extrabold text-[#4a3b5c] transition hover:bg-white active:scale-95 ${glass}`}
      >
        <span>👥</span>
        <span>Yakındakiler</span>
        <span className="rounded-full bg-[#ffe8cc] px-1.5 py-0.5 text-[11px] font-black text-[#c26a1b]">{list.length}</span>
      </button>

      {open && (
        <div className={`mt-1.5 w-56 rounded-3xl border-2 border-white bg-white/96 p-2 shadow-toy backdrop-blur-md ${touch ? 'ml-auto' : ''}`}>
          <div className="mb-1 px-2 text-[11px] font-black text-[#8a7a9c]">Yakındaki Oyuncular</div>
          <div className="flex max-h-52 flex-col gap-0.5 overflow-y-auto">
            {list.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setOpen(false)
                  onPick?.(p.id)
                }}
                className="flex items-center justify-between rounded-2xl px-2.5 py-1.5 text-left text-xs font-extrabold text-[#4a3b5c] transition hover:bg-[#f4ecff]"
              >
                <span className="truncate">{p.name}</span>
                <span className="ml-2 shrink-0 text-[11px] font-bold text-[#8a7a9c]">{p.dist.toFixed(1)} m</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
