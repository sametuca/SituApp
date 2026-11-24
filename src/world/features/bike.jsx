// Bisiklet (istemci): sol sütunda 🚲 düğmesi ve B tuşu. Kiralık değilse düğme 20 🪙'a kiralar (sunucu: features/rental.js) ve biner; süre bitince iner.
// Binince hız ~2,5 kat, duruş procedural (avatarPose 'bike'), model Meshy GLB. Mekân içlerinde binilmez; oturunca/dans edince iner.
import { useEffect, useRef, useState } from 'react'
import { bike, useRiding } from '../bikeStore'

const isTyping = (e) => e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)

export function useBike({ venue, net, say }) {
  const venueRef = useRef(venue)
  useEffect(() => {
    venueRef.current = venue
  }, [venue])
  const riding = useRiding()
  const { on } = net
  const [coins, setCoins] = useState(0)

  // kiralama süresi sunucudan: bağlanınca ve kiralayınca
  useEffect(() => {
    const offs = [
      on('welcome', (m) => (bike.setUntil(m.bikeUntil), setCoins(m.coins ?? 0))),
      on('coins', (m) => setCoins(m.n)),
      on('rental', (m) => {
        bike.setUntil(m.until)
        window.dispatchEvent(new CustomEvent('situapp:rented'))
        if (!venueRef.current) bike.set(true) // kiralayınca hemen bin
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [on])
  // süre dolunca bisikletten indir
  useEffect(() => {
    if (!bike.rented) return
    const t = setTimeout(() => {
      bike.setUntil(bike.until)
      say?.('🚲 Bisiklet kiralama süren doldu. 🚲 düğmesiyle yeniden kiralayabilirsin (20 🪙).')
    }, Math.max(0, bike.until - Date.now()) + 300)
    return () => clearTimeout(t)
  }, [riding, say, net.status])

  const tryToggle = () => {
    if (venue) return
    if (bike.toggle()) return
    if (coins < 20) return say?.('🚲 Bisiklet kiralamak için 20 altın gerekiyor. Altını küçük işlerden (örn. kulüpte DJ olmak) kazanırsın.')
    net.send({ t: 'rent', kind: 'bike' }) // kiralanmamış: kirala (rental mesajı gelince biner)
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'KeyB' && !isTyping(e) && !e.ctrlKey && !e.metaKey) tryToggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  useEffect(() => {
    if (venue) bike.set(false)
  }, [venue])

  const extraButtons = venue
    ? []
    : [{ key: 'bike', emoji: riding ? '🚶' : '🚲', label: riding ? 'Bisikletten in (B)' : bike.rented ? 'Bisiklete bin (B)' : 'Bisiklet kirala (20 altın)', onClick: tryToggle }]
  return { extraButtons }
}
