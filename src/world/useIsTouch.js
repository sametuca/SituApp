import { useEffect, useState } from 'react'

// Test için ?touch=1 ile masaüstünde de dokunmatik arayüz açılır.
const forced = () => new URLSearchParams(window.location.search).get('touch') === '1'
const query = () => window.matchMedia('(pointer: coarse)')
const detect = () => {
  if (typeof window === 'undefined') return false
  const uaMobile = typeof navigator !== 'undefined' && (
    navigator.userAgentData?.mobile ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  )
  return forced() ||
    query().matches ||
    uaMobile ||
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && window.innerWidth <= 1024)
}

/** Ana işaretçi dokunmatikse (telefon/tablet) true döner. */
export function useIsTouch() {
  const [touch, setTouch] = useState(detect)
  useEffect(() => {
    const mq = query()
    const updateViewport = () => {
      const height = window.visualViewport?.height || window.innerHeight
      document.documentElement.style.setProperty('--app-height', `${height}px`)
    }
    const onChange = () => {
      setTouch(detect())
      document.documentElement.dataset.touch = detect() ? 'true' : 'false'
      updateViewport()
    }
    onChange()
    mq.addEventListener('change', onChange)
    window.addEventListener('resize', onChange)
    window.addEventListener('orientationchange', onChange)
    window.visualViewport?.addEventListener('resize', updateViewport)
    return () => {
      mq.removeEventListener('change', onChange)
      window.removeEventListener('resize', onChange)
      window.removeEventListener('orientationchange', onChange)
      window.visualViewport?.removeEventListener('resize', updateViewport)
      delete document.documentElement.dataset.touch
    }
  }, [])
  return touch
}

export function useVisualViewport(enabled) {
  const [viewport, setViewport] = useState(null)
  useEffect(() => {
    const visual = window.visualViewport
    if (!enabled || !visual) return undefined
    const update = () => setViewport({ height: visual.height, bottom: Math.max(0, window.innerHeight - visual.height - visual.offsetTop) })
    update()
    visual.addEventListener('resize', update)
    visual.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      visual.removeEventListener('resize', update)
      visual.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [enabled])
  return enabled ? viewport : null
}
