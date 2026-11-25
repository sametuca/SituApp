// Bisiklet (istemci): sol sütunda 🚲 düğmesi ve B tuşu. Şehirde ücretsiz binilir; hız yürüyüşten bir tık hızlıdır (5,2 m/sn, Shift ile 7,2).
// Binince duruş procedural (avatarPose 'bike'), model Meshy GLB. Mekân içlerinde binilmez; oturunca/dans edince iner.
import { useCallback, useEffect, useRef } from 'react'
import { bike, useRiding } from '../bikeStore'

const isTyping = (e) => e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)

export function useBike({ venue, say }) {
  const venueRef = useRef(venue)
  useEffect(() => {
    venueRef.current = venue
  }, [venue])
  const riding = useRiding()

  const tryToggle = useCallback(() => {
    if (venueRef.current) {
      say?.('🚲 İç mekânda bisiklete binilmez, dışarı çıkınca B tuşuyla binebilirsin.')
      return
    }
    bike.toggle()
  }, [say])

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'KeyB' && !isTyping(e) && !e.ctrlKey && !e.metaKey) tryToggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tryToggle])
  useEffect(() => {
    if (venue) bike.set(false)
  }, [venue])

  const extraButtons = venue
    ? []
    : [{ key: 'bike', icon: riding ? 'walk' : 'bike', label: riding ? 'Bisikletten in (B)' : 'Bisiklete bin (B)', onClick: tryToggle }]
  return { extraButtons }
}
