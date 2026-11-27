// Dünya klavye kısayolları: E (kapı/mekân/rehber/eğitim), H, M, Esc, 1-9/0 (beceri ve tepki), R/Del (mobilya).
import { useEffect, useRef } from 'react'
import { together } from '../world/features/togetherStore'
import { REACTIONS } from '../world/interact'

export function useWorldKeys({ doorGo, editing, enterVenue, fade, home, inTutorial, nearDoor, nearGuide, nearGuideRef, nearVenue, onTutCollect, onTutDoor, reactRef, removeFurn, rotateFurn, selected, setHelp, setInteractId, setPanel, skillListRef, skillRef, tutNear, tutStep, venue }) {
  const editKeysRef = useRef({ on: false, rotate: () => {}, remove: () => {} })
  useEffect(() => {
    editKeysRef.current = { on: editing && Boolean(selected), rotate: rotateFurn, remove: removeFurn }
  })
  const nearDoorRef = useRef(false)
  const doorGoRef = useRef(() => {})
  const nearVenueRef = useRef(null)
  const enterVenueRef = useRef(() => {})
  const tutActionRef = useRef(null)
  useEffect(() => {
    nearDoorRef.current = nearDoor && !fade && !(inTutorial && tutStep !== 'exit') // eğitim bitmeden havalimanından çıkılmaz
    doorGoRef.current = doorGo
    nearVenueRef.current = !fade && !home && !venue && !nearDoor ? nearVenue : null
    enterVenueRef.current = enterVenue
    nearGuideRef.current = !fade && !home && !venue && !nearDoor && !nearVenue && nearGuide
    tutActionRef.current = inTutorial && !fade ? (tutNear === 'collect' && tutStep === 'collect' ? onTutCollect : tutNear === 'door' && tutStep === 'door' ? onTutDoor : null) : null
  }, [nearDoor, fade, doorGo, nearVenue, home, venue, enterVenue, nearGuide, inTutorial, tutNear, tutStep, onTutCollect, onTutDoor])

  // H tuşu: yardım, M tuşu: harita, Esc: açık pencereyi kapat, E: kapı / eğitim etkileşimi
  useEffect(() => {
    const onKey = (e) => {
      const typing = e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)
      if (e.code === 'Escape' && !typing) {
        setHelp(false)
        setPanel(null)
        setInteractId(null)
        return
      }
      if (e.code === 'KeyH' && !typing) setHelp((h) => !h)
      if (e.code === 'KeyM' && !typing) window.dispatchEvent(new CustomEvent('situapp:toggle-map'))
      if (e.code === 'KeyE' && !typing && tutActionRef.current) tutActionRef.current()
      else if (e.code === 'KeyE' && !typing && nearDoorRef.current) doorGoRef.current()
      else if (e.code === 'KeyE' && !typing && nearVenueRef.current && !together.self.current) enterVenueRef.current(nearVenueRef.current)
      else if (e.code === 'KeyE' && !typing && nearGuideRef.current) setHelp(true)
      if (!typing && /^Digit[0-9]$/.test(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const n = Number(e.code.slice(5))
        if (n >= 1 && n <= 4) {
          skillRef.current(skillListRef.current[n - 1])
        } else {
          const emoji = REACTIONS[(n + 9) % 10]
          if (emoji) reactRef.current(emoji)
        }
      }
      if (typing || !editKeysRef.current.on) return
      if (e.code === 'KeyR') editKeysRef.current.rotate()
      if (e.code === 'Delete' || e.code === 'Backspace') editKeysRef.current.remove()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return {  }
}
