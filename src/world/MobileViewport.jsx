// Mobil yatay ekran zorunluluğu (LandscapeGuard) ve Tam Ekran (Fullscreen) geçiş bileşenleri.
import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useIsTouch } from './useIsTouch'

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
        await screen.orientation?.lock?.('landscape')?.catch?.(() => {})
        return true
      }
      if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen()
        await screen.orientation?.lock?.('landscape')?.catch?.(() => {})
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
      screen.orientation?.unlock?.()
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
        <div className="pointer-events-none fixed left-1/2 top-16 z-[90] w-[min(92vw,24rem)] -translate-x-1/2 rounded-2xl border-2 border-white bg-[#23183d]/92 px-4 py-2.5 text-center text-xs font-extrabold text-white shadow-lg">
          📱 Safari adres çubuğunu tamamen gizlemek için <strong>Aa → Araç Çubuğunu Gizle</strong> veya <strong>Paylaş → Ana Ekrana Ekle</strong> seçebilirsin.
        </div>
      )}
    </>
  )
}

export function LandscapeGuard() {
  const touch = useIsTouch()
  const { pathname } = useLocation()
  const { enterFullscreen, nativeSupported } = useFullscreen()
  const [portrait, setPortrait] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia?.('(orientation: portrait)')?.matches ?? window.innerHeight > window.innerWidth
  })

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const mq = window.matchMedia?.('(orientation: portrait)')
    const check = () => {
      const p = mq ? mq.matches : window.innerHeight > window.innerWidth
      setPortrait(p)
    }
    check()
    mq?.addEventListener?.('change', check)
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      mq?.removeEventListener?.('change', check)
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])

  // Dokunmatik cihazlarda ilk dokunuşta tarayıcı destekliyorsa yatay kilidi dene
  useEffect(() => {
    if (!touch) return undefined
    const tryLock = () => {
      screen.orientation?.lock?.('landscape')?.catch?.(() => {})
    }
    window.addEventListener('pointerdown', tryLock, { once: true })
    return () => window.removeEventListener('pointerdown', tryLock)
  }, [touch])

  if (!touch || !portrait || pathname.startsWith('/admin') || pathname.startsWith('/studio')) return null

  return (
    <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-gradient-to-br from-[#23183d] via-[#34235a] to-[#1d1433] p-6 text-center text-white select-none">
      <style>{`
        @keyframes situPhoneTilt {
          0%, 18% { transform: rotate(0deg); }
          52%, 82% { transform: rotate(-90deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>
      <div className="flex max-w-xs flex-col items-center gap-4 rounded-[2rem] border-2 border-white/20 bg-white/10 px-7 py-8 shadow-2xl backdrop-blur-md">
        <div className="grid h-24 w-24 place-items-center rounded-full bg-white/10">
          <div
            className="relative flex h-16 w-10 flex-col items-center justify-between rounded-xl border-[3px] border-[#ffd35e] bg-[#2a1d49] py-1.5 shadow-lg"
            style={{ animation: 'situPhoneTilt 2.4s infinite ease-in-out' }}
          >
            <span className="h-1 w-3 rounded-full bg-white/50" />
            <span className="text-xs font-black text-[#ffd35e]">⟳</span>
            <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
          </div>
        </div>

        <div>
          <h2 className="text-xl font-black text-white">Telefonunu Yan Çevir</h2>
          <p className="mt-1.5 text-xs font-bold leading-relaxed text-white/80">
            Rastla yatay ekran için tasarlandı. Oynamaya başlamak için telefonunu yan konuma getir.
          </p>
        </div>

        {nativeSupported && (
          <button
            type="button"
            onClick={enterFullscreen}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl border-b-4 border-[#d98a1c] bg-[#fdb252] px-4 py-3 text-xs font-black text-white shadow-lg active:translate-y-[2px]"
          >
            <FullscreenIcon active={false} size={16} />
            <span>Tam Ekran & Yatay Başlat</span>
          </button>
        )}
      </div>
    </div>
  )
}
