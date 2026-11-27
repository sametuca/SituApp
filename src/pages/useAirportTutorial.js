// Havalimanı başlangıç eğitimi adımları: yıldız topla → çanta → örnek kapı → gardırop → çıkış (World.jsx'ten ayrıldı).
import { useCallback, useEffect, useRef, useState } from 'react'
import { START_VENUE } from './worldConfig'

export function useAirportTutorial({ venue, panel, fade, setFade, beginTransition }) {
  // Havalimanı başlangıç eğitim holü: yıldız topla → çanta (envanter) → örnek kapı → gardırop → çıkış
  const [tutStep, setTutStep] = useState('collect') // collect | inventory | door | wardrobe | exit | done
  const [tutNear, setTutNear] = useState(null)
  const [tutCelebrate, setTutCelebrate] = useState(null)
  const tutOpenedWardrobe = useRef(false)
  const tutOpenedInv = useRef(false)
  const tutCelebTimer = useRef(null)
  const flashTutCelebrate = useCallback((msg) => {
    setTutCelebrate(msg)
    clearTimeout(tutCelebTimer.current)
    tutCelebTimer.current = setTimeout(() => setTutCelebrate(null), 2600)
  }, [])
  useEffect(() => () => clearTimeout(tutCelebTimer.current), [])
  const inTutorial = venue === START_VENUE && tutStep !== 'done'
  const onTutCollect = useCallback(() => {
    if (tutStep !== 'collect') return
    setTutNear(null)
    window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'collect' }))
    window.dispatchEvent(new CustomEvent('situapp:inv-add', { detail: { id: 'welcome_soda', label: 'Hoş Geldin Limonata', emoji: '🍋', alcohol: false, style: 'eat' } }))
    flashTutCelebrate('⭐ Süper! Hediyen 🎒 çantana eklendi (1/5)')
    setTutStep('inventory')
  }, [tutStep, flashTutCelebrate])
  useEffect(() => {
    if (!inTutorial || tutStep !== 'inventory') return
    if (panel === 'inventory') {
      tutOpenedInv.current = true
    } else if (panel === null && tutOpenedInv.current) {
      tutOpenedInv.current = false
      window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'quest' }))
      flashTutCelebrate('🎒 Harika! Şimdi okları takip edip kapıyı dene (2/5)')
      setTutStep('door')
    }
  }, [inTutorial, tutStep, panel, flashTutCelebrate])
  const onTutDoor = useCallback(() => {
    if (tutStep !== 'door' || fade) return
    setTutNear(null)
    beginTransition()
    window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'quest' }))
    setTimeout(() => {
      setFade(false)
      setTutStep('wardrobe')
      flashTutCelebrate('🚪 Süper! Soldaki 👗 Gardırop açıldı (3/5)')
    }, 420)
  }, [beginTransition, tutStep, fade, flashTutCelebrate])
  useEffect(() => {
    if (!inTutorial || tutStep !== 'wardrobe') return
    if (panel === 'wardrobe') {
      tutOpenedWardrobe.current = true
    } else if (panel === null && tutOpenedWardrobe.current) {
      tutOpenedWardrobe.current = false
      window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'quest' }))
      flashTutCelebrate('👗 Çok şık! Şimdi okları takip edip şehre çık (4/5)')
      setTutStep('exit')
    }
  }, [inTutorial, tutStep, panel, flashTutCelebrate])

  return { tutStep, setTutStep, tutNear, setTutNear, tutCelebrate, inTutorial, onTutCollect, onTutDoor }
}
