import { useEffect, useState } from 'react'

// Test için ?touch=1 ile masaüstünde de dokunmatik arayüz açılır.
const forced = () => new URLSearchParams(window.location.search).get('touch') === '1'
const query = () => window.matchMedia('(pointer: coarse)')

/** Ana işaretçi dokunmatikse (telefon/tablet) true döner. */
export function useIsTouch() {
  const [touch, setTouch] = useState(() => forced() || query().matches)
  useEffect(() => {
    const mq = query()
    const onChange = () => setTouch(forced() || mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return touch
}
