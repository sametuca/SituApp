// Şehir yaşamı oynanışı: Lobi Çeşmesi dilek tutma, hız halkaları ve günlük 5 bölge keşif turu.
import { useCallback, useEffect, useRef, useState } from 'react'
import { DoorPrompt } from '../Social'
import { speedBoost } from '../bikeStore'
import { SPEED_RING_POS, zoneAt } from '../layout'

const SPEED_RINGS = SPEED_RING_POS.map(([x, z]) => [x, z])
const WISHES = [
  '✨ Bugün şehirde yeni bir arkadaşla tanışacaksın!',
  '🍀 Şans seninle — plajda sürpriz hazine seni bekliyor!',
  '🎶 Kulüp Babil bu akşam harika çalacak!',
  '☀️ Güneşli bir günde kahve molası her şeye iyi gelir!',
  '🌟 Çeşme dileğini duydu, günün neşeli geçecek!',
]
const TOUR_ZONES = ['lobby', 'cafe', 'club', 'beach', 'park']
const todayKey = () => new Date().toISOString().slice(0, 10)

export function useCityLife({ focusRef, home, venue, touch, say, panel }) {
  const [nearFountain, setNearFountain] = useState(false)
  const [wishedDay, setWishedDay] = useState(() => {
    try {
      return localStorage.getItem('situapp_wish_day') || ''
    } catch {
      return ''
    }
  })
  const [visited, setVisited] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('situapp_tour') || '{}')
      return raw.day === todayKey() && Array.isArray(raw.zones) ? raw.zones : []
    } catch {
      return []
    }
  })
  const lastRing = useRef(0)

  const inCity = !home && !venue

  useEffect(() => {
    if (!inCity) {
      setNearFountain(false)
      return
    }
    const id = setInterval(() => {
      const f = focusRef.current
      const fd = Math.hypot(f.x, f.z)
      setNearFountain(fd < 4.5 && fd > 1.8)

      // Hız halkaları kontrolü
      const now = Date.now()
      if (now - lastRing.current > 4000) {
        for (const [rx, rz] of SPEED_RINGS) {
          if (Math.hypot(f.x - rx, f.z - rz) < 1.35) {
            lastRing.current = now
            speedBoost.until = now + 3500
            window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
            say('⚡ Hız artışı!')
            break
          }
        }
      }

      // Şehir turu bölge takibi
      const z = zoneAt(f.x, f.z)
      if (z && TOUR_ZONES.includes(z.id)) {
        setVisited((prev) => {
          if (prev.includes(z.id)) return prev
          const next = [...prev, z.id]
          try {
            localStorage.setItem('situapp_tour', JSON.stringify({ day: todayKey(), zones: next }))
          } catch {
            /* ignore */
          }
          if (next.length === TOUR_ZONES.length) {
            say('🏆 Tebrikler! Bugün şehrin 5 ana bölgesini de keşfettin!')
          } else {
            say(`🧭 Şehir turu: ${z.name} keşfedildi (${next.length}/${TOUR_ZONES.length})`)
          }
          return next
        })
      }
    }, 300)
    return () => clearInterval(id)
  }, [inCity, focusRef, say])

  const makeWish = useCallback(() => {
    const today = todayKey()
    if (wishedDay === today) {
      return say('⛲ Bugünkü dileğini zaten tuttun! Yarın tekrar gel.')
    }
    setWishedDay(today)
    try {
      localStorage.setItem('situapp_wish_day', today)
    } catch {
      /* ignore */
    }
    const msg = WISHES[Math.floor(Math.random() * WISHES.length)]
    window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'collect' }))
    say(msg)
  }, [wishedDay, say])

  const wishRef = useRef(makeWish)
  useEffect(() => {
    wishRef.current = makeWish
  })
  useEffect(() => {
    if (!inCity || !nearFountain) return
    const onKey = (e) => {
      if ((e.code !== 'KeyE' && e.key !== 'e' && e.key !== 'E') || e.ctrlKey || e.metaKey || e.altKey) return
      const typing = e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)
      if (typing) return
      wishRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [inCity, nearFountain])

  const overlays = (
    <>
      {inCity && nearFountain && !panel && (
        <DoorPrompt emoji="⛲" label="Lobi Çeşmesi" action="Dilek Tut" touch={touch} raised onGo={makeWish} />
      )}
      {inCity && visited.length > 0 && visited.length < TOUR_ZONES.length && (
        <div className="pointer-events-none absolute left-[4.5rem] top-3 z-10 hidden sm:flex items-center gap-1.5 rounded-full border-2 border-white bg-white/90 px-3.5 py-1.5 text-xs font-extrabold text-[#4a3b5c] shadow-soft">
          <span>🧭</span>
          <span>Şehir Turu {visited.length}/{TOUR_ZONES.length}</span>
        </div>
      )}
    </>
  )

  return { overlays }
}
