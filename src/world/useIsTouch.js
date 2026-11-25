import { useEffect, useState } from 'react'

// Test için ?touch=1 ile masaüstünde de dokunmatik arayüz açılır.
const forced = () => new URLSearchParams(window.location.search).get('touch') === '1'
const query = () => window.matchMedia('(pointer: coarse)')
const detect = () =>
  forced() ||
  query().matches ||
  (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && window.innerWidth <= 1024)

/** Ana işaretçi dokunmatikse (telefon/tablet) true döner. */
export function useIsTouch() {
  const [touch, setTouch] = useState(detect)
  useEffect(() => {
    const mq = query()
    const onChange = () => setTouch(detect())
    mq.addEventListener('change', onChange)
    window.addEventListener('resize', onChange)
    return () => {
      mq.removeEventListener('change', onChange)
      window.removeEventListener('resize', onChange)
    }
  }, [])
  return touch
}
