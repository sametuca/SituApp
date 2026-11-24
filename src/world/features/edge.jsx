// Dünya sınırı ipucu: oyuncu sınıra (şamandıra halatı) yaklaşınca tatlı, kısa bir bilgi kartı. Sunucu da sınırı zorlar (hile denetimi).
import { useEffect, useState } from 'react'
import { PLAY_BOUNDS } from '../layout'

export function useEdge({ focusRef, home, venue }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (home || venue) return undefined
    let last = 0
    const id = setInterval(() => {
      const f = focusRef.current
      const d = Math.min(f.x - PLAY_BOUNDS.x0, PLAY_BOUNDS.x1 - f.x, f.z - PLAY_BOUNDS.z0, PLAY_BOUNDS.z1 - f.z)
      if (d < 1.4 && Date.now() - last > 25000) {
        last = Date.now()
        setShow(true)
        setTimeout(() => setShow(false), 3600)
      }
    }, 500)
    return () => clearInterval(id)
  }, [focusRef, home, venue])
  const overlays = show ? (
    <div className="pointer-events-none absolute left-1/2 top-24 z-20 -translate-x-1/2 animate-pop rounded-2xl border-2 border-white bg-white/90 px-4 py-2 text-center shadow-soft backdrop-blur-md">
      <p className="text-sm font-black text-[#4a3b5c]">🌊 Adanın kıyısına geldin</p>
      <p className="text-xs font-bold text-[#8a7a9c]">Şamandıraların ötesi açık deniz, daha ileri gidemezsin.</p>
    </div>
  ) : null
  return { overlays }
}
