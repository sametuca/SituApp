// Tam Ekran (Fullscreen) geçiş kancası ve düğmesi (yatay/dikey ekran serbest).
import { useCallback, useEffect, useState } from 'react'

const getNativeFsElement = () =>
  typeof document !== 'undefined'
    ? document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null
    : null

const canNativeFullscreen = () => {
  if (typeof document === 'undefined') return false
  const el = document.documentElement
  return Boolean(
    (document.fullscreenEnabled && el?.requestFullscreen) ||
      (document.webkitFullscreenEnabled && el?.webkitRequestFullscreen),
  )
}

let pseudoListeners = new Set()
let pseudoActive = false
const setPseudoFs = (val) => {
  pseudoActive = val
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('situapp-immersive', val)
  }
  pseudoListeners.forEach((fn) => fn(val))
}

export function useFullscreen() {
  const [nativeFs, setNativeFs] = useState(() => Boolean(getNativeFsElement()))
  const [pseudoFs, setPseudoState] = useState(() => pseudoActive)
  const [iosTip, setIosTip] = useState(false)

  useEffect(() => {
    const sync = () => setNativeFs(Boolean(getNativeFsElement()))
    const onPseudo = (v) => setPseudoState(v)
    pseudoListeners.add(onPseudo)
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
    return () => {
      pseudoListeners.delete(onPseudo)
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync)
    }
  }, [])

  const isFullscreen = nativeFs || pseudoFs

  const enterFullscreen = useCallback(async () => {
    const el = document.documentElement
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: 'hide' })
        return true
      }
      if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen()
        return true
      }
    } catch {
      /* iOS Safari sekmesinde yerel Fullscreen API desteklenmezse sahte tam ekrana düş */
    }
    setPseudoFs(true)
    window.scrollTo(0, 1)
    setIosTip(true)
    setTimeout(() => setIosTip(false), 4200)
    return false
  }, [])

  const exitFullscreen = useCallback(async () => {
    if (getNativeFsElement()) {
      try {
        if (document.exitFullscreen) await document.exitFullscreen()
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen()
      } catch {
        /* ignore */
      }
    }
    if (pseudoActive) setPseudoFs(false)
    setIosTip(false)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (getNativeFsElement() || pseudoActive) return exitFullscreen()
    return enterFullscreen()
  }, [enterFullscreen, exitFullscreen])

  return { isFullscreen, toggleFullscreen, enterFullscreen, exitFullscreen, iosTip, nativeSupported: canNativeFullscreen() }
}

export function FullscreenIcon({ active = false, size = 22 }) {
  return active ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 3v3a2 2 0 0 1-2 2H3" />
      <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
      <path d="M3 16h3a2 2 0 0 1 2 2v3" />
      <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  )
}

export function FullscreenButton({ className = '' }) {
  const { isFullscreen, toggleFullscreen, iosTip } = useFullscreen()
  return (
    <>
      <button
        type="button"
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? 'Tam ekrandan çık' : 'Tam ekran yap'}
        title={isFullscreen ? 'Tam ekrandan çık' : 'Tam ekran yap'}
        className={`grid h-11 w-11 place-items-center rounded-full border-2 border-white bg-white/92 text-[#4a3b5c] shadow-soft transition hover:bg-white active:scale-95 sm:h-14 sm:w-14 ${
          isFullscreen ? 'ring-2 ring-[#a88bff] text-[#5b3fa8]' : ''
        } ${className}`}
      >
        <FullscreenIcon active={isFullscreen} size={22} />
      </button>
      {iosTip && (
        <div className="pointer-events-none fixed left-1/2 top-14 z-[90] w-[min(88vw,21rem)] -translate-x-1/2 rounded-2xl border border-white/60 bg-[#23183d]/92 px-3.5 py-2 text-center text-[11px] font-extrabold text-white shadow-lg">
          📱 Safari adres çubuğunu gizlemek için <strong>Aa → Araç Çubuğunu Gizle</strong> veya <strong>Paylaş → Ana Ekrana Ekle</strong> seçebilirsin.
        </div>
      )}
    </>
  )
}
