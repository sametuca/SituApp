// Bisiklet (istemci): sol sütunda 🚲 düğmesi ve B tuşu. Bisiklet Havalimanı'ndan kiralanır (features/rental.jsx); süre bitince iner.
// Binince hız ~2,5 kat, duruş procedural (avatarPose 'bike'), model Meshy GLB. Mekân içlerinde binilmez; oturunca/dans edince iner.
import { useEffect } from 'react'
import { bike, useRiding } from '../bikeStore'

const isTyping = (e) => e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)

export function useBike({ venue, net, say }) {
  const riding = useRiding()
  const { on } = net

  // kiralama süresi sunucudan: bağlanınca ve kiralayınca
  useEffect(() => {
    const offs = [
      on('welcome', (m) => bike.setUntil(m.bikeUntil)),
      on('rental', (m) => {
        bike.setUntil(m.until)
        window.dispatchEvent(new CustomEvent('situapp:rented'))
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [on])
  // süre dolunca bisikletten indir
  useEffect(() => {
    if (!bike.rented) return
    const t = setTimeout(() => {
      bike.setUntil(bike.until)
      say?.('🚲 Bisiklet kiralama süren doldu. Havalimanı’ndan yeniden kiralayabilirsin (/havalimanı).')
    }, Math.max(0, bike.until - Date.now()) + 300)
    return () => clearTimeout(t)
  }, [riding, say, net.status])

  const tryToggle = () => {
    if (venue) return
    if (!bike.toggle()) say?.('🚲 Önce Havalimanı’ndaki kiralama tezgâhından bisiklet kirala (/havalimanı).')
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
    : [{ key: 'bike', emoji: riding ? '🚶' : '🚲', label: riding ? 'Bisikletten in (B)' : 'Bisiklete bin (B)', onClick: tryToggle }]
  return { extraButtons }
}
