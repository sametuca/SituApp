// Üst çubuk, ipuçları, yardım, modal ve ortak HUD bileşenleri.
import { useEffect, useRef, useState } from 'react'
import { TopDock } from '../components/Dock'
import { Ico } from '../components/Icon'
import { ZONES } from './layout'
import { FullscreenButton, FullscreenIcon, useFullscreen } from './MobileViewport'

const glass = 'border-2 border-white bg-white/92 shadow-soft'

// ---------- üst çubuk ----------
// extraButtons: özellik modüllerinin düğmeleri [{ key, emoji, label, onClick, badge? }] (sol sütunda, geri düğmesinin altında)
// extraNodes: hazır JSX düğmeler (sağ grupta, ⚙️'nin solunda)
export function TopBar({ online, status, dnd, touch = false, inCity = false, onExit, onHelp, onSettings, extraButtons = [], extraNodes = null, menuNodes = null, menuBadge = 0 }) {
  const [menu, setMenu] = useState(false)
  const [leftOpen, setLeftOpen] = useState(false)
  const [narrowHud, setNarrowHud] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false))
  const menuRef = useRef(null)
  const leftRef = useRef(null)
  const { isFullscreen, toggleFullscreen, iosTip } = useFullscreen()
  useEffect(() => {
    const onR = () => setNarrowHud(window.innerWidth < 768)
    window.addEventListener('resize', onR)
    return () => window.removeEventListener('resize', onR)
  }, [])
  const mobileBar = touch || narrowHud
  useEffect(() => {
    if (!menu && !leftOpen) return
    const off = (e) => {
      if (menu && !menuRef.current?.contains(e.target)) setMenu(false)
      if (leftOpen && !leftRef.current?.contains(e.target)) setLeftOpen(false)
    }
    window.addEventListener('pointerdown', off)
    return () => window.removeEventListener('pointerdown', off)
  }, [menu, leftOpen])
  const dot = status === 'online' ? 'bg-emerald-400' : status === 'connecting' ? 'bg-amber-400' : 'bg-rose-400'
  const label = status === 'online' ? `${online} çevrimiçi` : status === 'connecting' ? 'Bağlanıyor…' : 'Çevrimdışı (tek başına)'
  const hasSpotlight = extraButtons.some((b) => b.hint)
  const leftTotalBadge = extraButtons.reduce((sum, b) => sum + (Number(b.badge) || 0), 0)
  const leftAnyHighlight = extraButtons.some((b) => b.highlight)
  return (
    <>
      {/* "Buraya tıkla" rehber odağı: ekranı karartıp hedef düğmeyi öne çıkarır */}
      {hasSpotlight && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[25] bg-[#160e29]/65 backdrop-blur-[2px] transition-opacity duration-300"
        />
      )}
      <div
        className={`pointer-events-none absolute left-0 right-0 top-0 flex items-start justify-between gap-2 px-2.5 pb-2 sm:px-3 sm:py-3 ${hasSpotlight ? 'z-30' : 'z-20'}`}
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
      >
        {mobileBar && !hasSpotlight ? (
          <div className="pointer-events-auto relative" ref={leftRef}>
            <button
              type="button"
              onClick={() => setLeftOpen((o) => !o)}
              aria-label="Hızlı menü"
              aria-expanded={leftOpen}
              className={`relative grid h-10 w-10 place-items-center rounded-full text-[#4a3b5c] transition hover:bg-white active:scale-95 ${glass} ${
                leftAnyHighlight ? 'ring-2 ring-[#fdb252]' : ''
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden>
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
              {leftTotalBadge > 0 && (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full border border-white bg-[#fdb252] px-1 text-[10px] font-black text-white">
                  {leftTotalBadge}
                </span>
              )}
            </button>
            {leftOpen && (
              <div
                className="absolute left-0 top-12 z-30 flex max-h-[72svh] w-56 flex-col gap-0.5 overflow-y-auto rounded-3xl border-2 border-white bg-white/95 p-2 shadow-toy backdrop-blur-md"
                onClick={() => setLeftOpen(false)}
              >
                {inCity && (
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('situapp:open-map'))}
                    className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2 text-left text-xs font-extrabold text-[#4a3b5c] transition hover:bg-[#fff8f0] active:scale-[0.99]"
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center"><Ico name="map" size={20} /></span>
                    <span className="min-w-0 flex-1 truncate">Harita ve Işınlan</span>
                  </button>
                )}
                {extraButtons.map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={b.onClick}
                    className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2 text-left text-xs font-extrabold text-[#4a3b5c] transition hover:bg-[#fff8f0] active:scale-[0.99]"
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center text-lg">
                      {b.icon ? <Ico name={b.icon} size={20} /> : b.emoji}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{b.label}</span>
                    {b.badge ? (
                      <span className="rounded-full bg-[#fdb252] px-2 py-0.5 text-[10px] font-black text-white">{b.badge}</span>
                    ) : null}
                  </button>
                ))}
                <div className="my-1 h-px bg-[#efe6ff]" />
                <button
                  type="button"
                  onClick={onExit}
                  className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2 text-left text-xs font-extrabold text-rose-500 transition hover:bg-rose-50"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center"><Ico name="back" size={20} /></span>
                  <span className="flex-1">Çıkış Yap</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="pointer-events-auto flex max-h-[calc(100svh-8.5rem)] flex-col flex-wrap content-start gap-1.5 sm:gap-2.5">
            {!hasSpotlight && (
              <button
                onClick={onExit}
                aria-label="Çıkış yap"
                title="Çıkış yap"
                className={`grid h-11 w-11 place-items-center rounded-full text-xl font-black text-[#4a3b5c] transition hover:bg-white active:scale-95 sm:h-14 sm:w-14 sm:text-2xl ${glass}`}
              >
                <Ico name="back" size={28} />
              </button>
            )}
            {extraButtons.map((b) => {
              const spot = Boolean(b.hint)
              return (
                <button
                  key={b.key}
                  onClick={b.onClick}
                  aria-label={b.label}
                  title={b.label}
                  className={`relative grid h-11 w-11 place-items-center rounded-full text-2xl transition hover:bg-white active:scale-95 sm:h-14 sm:w-14 sm:text-3xl ${glass} ${
                    spot
                      ? 'z-40 scale-110 bg-white ring-4 ring-[#ffd35e] shadow-[0_0_34px_rgba(255,211,94,0.95)]'
                      : b.highlight
                        ? 'ring-4 ring-[#fdb252] shadow-[0_0_20px_rgba(253,178,82,0.85)]'
                        : hasSpotlight
                          ? 'opacity-35'
                          : ''
                  }`}
                >
                  {b.highlight || spot ? <span className="pointer-events-none absolute -inset-1.5 animate-ping rounded-full border-2 border-[#ffd35e]/85" /> : null}
                  {b.icon ? <Ico name={b.icon} size={28} /> : b.emoji}
                  {b.badge ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-[#fdb252] px-1 text-[11px] font-black text-white">{b.badge}</span> : null}
                  {!b.badge && b.highlight ? <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-ping rounded-full bg-[#fdb252]" /> : null}
                  {!b.badge && b.highlight ? <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#fdb252]" /> : null}
                  {spot ? (
                    <span className="pointer-events-none absolute left-full top-1/2 ml-3 flex -translate-y-1/2 items-center gap-2 whitespace-nowrap">
                      <span className="flex items-center gap-0.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)] animate-point-left">
                        <Ico name="prev" size={28} />
                      </span>
                      <span className="rounded-full border-2 border-white bg-gradient-to-r from-[#ff9f43] to-[#fdb252] px-4 py-1.5 text-sm font-black text-white shadow-[0_6px_22px_rgba(253,178,82,0.75)]">
                        {b.hint}
                      </span>
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        )}
      <div className="flex min-w-0 flex-col items-center gap-1 sm:gap-2">
        {/* yalnızca bağlantı sorunu ya da rahatsız etme açıkken bilgi çıkar */}
        {(status !== 'online' || dnd) && (
          <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold text-[#8a7a9c] sm:px-3.5 sm:py-1 sm:text-xs ${glass}`}>
            {status !== 'online' && <span className={`h-2 w-2 rounded-full ${dot}`} />}
            {status !== 'online' && label}
            {dnd && <span title="Rahatsız etme açık">{status !== 'online' ? ' · ' : ''}🌙 Rahatsız etme</span>}
          </div>
        )}
      </div>
      <div className="pointer-events-auto relative flex gap-1.5 sm:gap-2" ref={menuRef}>
        {!mobileBar && extraNodes}
        {!mobileBar && <FullscreenButton />}
        <button
          onClick={() => setMenu((m) => !m)}
          aria-label="Menü ve Ayarlar"
          aria-expanded={menu}
          className={`relative grid place-items-center rounded-full text-xl transition hover:bg-white active:scale-95 ${
            mobileBar ? 'h-10 w-10' : 'h-11 w-11 sm:h-14 sm:w-14 sm:text-2xl'
          } ${glass}`}
        >
          <Ico name="settings" size={mobileBar ? 22 : 28} />
          {menuBadge > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full border border-white bg-[#fdb252] px-1 text-[10px] font-black text-white sm:h-5 sm:min-w-5">{menuBadge}</span>}
        </button>
        {menu && (
          <div className="absolute right-0 top-12 z-30 flex max-h-[75svh] w-64 flex-col gap-1 overflow-y-auto rounded-3xl border-2 border-white bg-white/95 p-2 shadow-soft backdrop-blur-md sm:top-14 sm:w-72" onClick={() => setMenu(false)}>
            {menuNodes}
            <button onClick={toggleFullscreen} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-xs font-extrabold text-[#4a3b5c] transition hover:bg-[#fff8f0] sm:py-2.5 sm:text-sm">
              <span className="grid h-6 w-6 place-items-center text-[#6b4fc0]"><FullscreenIcon active={isFullscreen} size={19} /></span>
              <span className="flex-1">{isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran Modu'}</span>
            </button>
            {onSettings && (
              <button onClick={onSettings} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-xs font-extrabold text-[#4a3b5c] transition hover:bg-[#fff8f0] sm:py-2.5 sm:text-sm">
                <Ico name="settings" size={22} />
                <span className="flex-1">Ayarlar</span>
              </button>
            )}
            <button onClick={onHelp} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-xs font-extrabold text-[#4a3b5c] transition hover:bg-[#fff8f0] sm:py-2.5 sm:text-sm">
              <Ico name="help" size={22} />
              <span className="flex-1">Yardım</span>
            </button>
          </div>
        )}
      </div>
      </div>
      {touch && iosTip && (
        <div className="pointer-events-none fixed left-1/2 top-14 z-[90] w-[min(88vw,21rem)] -translate-x-1/2 rounded-2xl border border-white/60 bg-[#23183d]/92 px-3.5 py-2 text-center text-[11px] font-extrabold text-white shadow-lg">
          📱 Safari adres çubuğunu gizlemek için <strong>Aa → Araç Çubuğunu Gizle</strong> veya <strong>Paylaş → Ana Ekrana Ekle</strong> seçebilirsin.
        </div>
      )}
    </>
  )
}

// ---------- mahalleye girince çıkan bildirim ----------
export function ZoneToast({ zone }) {
  const [shown, setShown] = useState(null)
  useEffect(() => {
    setShown(zone)
    const t = setTimeout(() => setShown(null), 2800)
    return () => clearTimeout(t)
  }, [zone])
  if (!shown || !shown.desc) return null
  return (
    <TopDock><div className="relative pointer-events-none w-[min(76vw,16rem)] animate-pop sm:w-[min(92vw,22rem)]">
      <div className={`rounded-2xl px-3 py-1.5 text-center sm:rounded-3xl sm:px-5 sm:py-3 ${glass}`}>
        <p className="text-xs font-black text-[#4a3b5c] sm:text-base">
          {shown.emoji} {shown.name}
        </p>
        <p className="hidden text-sm font-semibold text-[#8a7a9c] sm:block">{shown.desc}</p>
      </div>
    </div></TopDock>
  )
}

// ---------- alt ipucu çubuğu ----------
export function HintBar() {
  return (
    <p className="pointer-events-none absolute bottom-3 right-3 z-10 hidden rounded-full px-4 py-1.5 text-sm font-extrabold text-[#8a7a9c] xl:block">
      <span className={`rounded-full px-4 py-2 ${glass}`}>WASD yürü · Sürükle: kamera · H yardım</span>
    </p>
  )
}

// ---------- modal çerçevesi ----------
const MODAL_THEMES = {
  default: 'border-white bg-white/92 text-[#4a3b5c]',
  bag: 'border-[#f0e5d5] bg-[#fffdf9]/95 text-[#4a3b5c]',
  dating: 'border-[#ffd6e7] bg-gradient-to-b from-[#fff6fa]/96 to-white/95 text-[#4a3b5c]',
  gym: 'border-[#ff9f8e]/70 bg-gradient-to-b from-[#271f3d]/96 to-[#1d1630]/96 text-white',
}

export function Modal({ children, onClose, label, wide = false, theme = 'default', dockBottom = false, hideClose = false }) {
  const scrollRef = useRef(null)
  const [scrollSt, setScrollSt] = useState({ canScroll: false, moreBelow: false, thumbH: 35, thumbTop: 0 })

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const syncScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    const canScroll = scrollHeight > clientHeight + 8
    const moreBelow = canScroll && scrollTop + clientHeight < scrollHeight - 10
    const ratio = canScroll ? Math.max(0.18, clientHeight / scrollHeight) : 1
    const maxScroll = Math.max(1, scrollHeight - clientHeight)
    const progress = canScroll ? Math.min(1, Math.max(0, scrollTop / maxScroll)) : 0
    const thumbH = Math.round(ratio * 100)
    const thumbTop = Math.round(progress * (100 - thumbH))
    setScrollSt((prev) =>
      prev.canScroll === canScroll &&
      prev.moreBelow === moreBelow &&
      Math.abs(prev.thumbH - thumbH) <= 1 &&
      Math.abs(prev.thumbTop - thumbTop) <= 1
        ? prev
        : { canScroll, moreBelow, thumbH, thumbTop },
    )
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return undefined
    syncScroll()
    const t = setTimeout(syncScroll, 80)
    let ro = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(syncScroll)
      ro.observe(el)
      if (el.firstElementChild) ro.observe(el.firstElementChild)
    }
    window.addEventListener('resize', syncScroll)
    return () => {
      clearTimeout(t)
      ro?.disconnect()
      window.removeEventListener('resize', syncScroll)
    }
  }, [children])

  const cls = MODAL_THEMES[theme] ?? MODAL_THEMES.default
  const showClose = Boolean(onClose && !hideClose)
  const closeCls =
    theme === 'gym'
      ? 'bg-white/15 text-white hover:bg-white/25'
      : theme === 'dating'
        ? 'bg-[#ffeef5] text-[#a83668] hover:bg-[#ffdceb]'
        : theme === 'bag'
          ? 'bg-[#f3ece0] text-[#6b5a4e] hover:bg-[#eadcc8]'
          : 'bg-[#f6f0ff] text-[#6b4fc0] hover:bg-[#eadcff]'
  const fadeCls =
    theme === 'gym'
      ? 'from-[#1d1630] via-[#1d1630]/85 to-transparent'
      : theme === 'bag'
        ? 'from-[#fffdf9] via-[#fffdf9]/85 to-transparent'
        : 'from-white via-white/85 to-transparent'

  return (
    <div
      className={`fixed inset-0 z-30 flex p-3 sm:p-4 ${dockBottom ? 'items-end justify-center bg-transparent pointer-events-none' : 'items-center justify-center bg-[#231938]/38 backdrop-blur-[2px]'}`}
      onClick={dockBottom ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal={!dockBottom}
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className={`pointer-events-auto relative flex max-h-[82dvh] w-full animate-pop flex-col overflow-hidden rounded-3xl border-2 shadow-toy sm:max-h-[88svh] sm:rounded-[2rem] ${cls} ${
          wide ? 'max-w-[min(92vw,26rem)] sm:max-w-lg' : 'max-w-[min(90vw,22.5rem)] sm:max-w-md'
        }`}
      >
        {showClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            title="Kapat"
            className={`absolute right-3.5 top-3.5 z-20 grid h-9 w-9 place-items-center rounded-full text-sm font-black shadow-sm transition active:scale-95 sm:right-4 sm:top-4 ${closeCls}`}
          >
            <Ico name="close" size={14} />
          </button>
        )}

        <div
          ref={scrollRef}
          onScroll={syncScroll}
          className={`situ-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y p-4 sm:p-6 ${
            scrollSt.canScroll ? 'pr-5 sm:pr-6' : ''
          } ${showClose ? '[&>h2:first-child]:pr-11 [&>div:first-child]:pr-11' : ''}`}
        >
          {children}
        </div>

        {/* iOS/Android dahil her cihazda sürekli görünür özel kaydırma çubuğu */}
        {scrollSt.canScroll && (
          <div
            aria-hidden
            className={`pointer-events-none absolute bottom-4 right-1.5 z-20 w-1.5 rounded-full ${
              showClose ? 'top-14' : 'top-4'
            } ${theme === 'gym' ? 'bg-white/15' : 'bg-[#ded2f4]/80'}`}
          >
            <div
              className={`w-full rounded-full transition-[top,height] duration-75 ${
                theme === 'gym' ? 'bg-[#ffd35e]' : 'bg-[#7a5fd0]'
              }`}
              style={{ height: `${scrollSt.thumbH}%`, top: `${scrollSt.thumbTop}%`, position: 'absolute' }}
            />
          </div>
        )}

        {/* Altta gizli içerik/tuş varken belirgin gölge + zıplayan "Aşağı kaydır" uyarısı */}
        {scrollSt.moreBelow && (
          <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 flex h-12 items-end justify-center bg-gradient-to-t pb-1.5 ${fadeCls}`}>
            <button
              type="button"
              onClick={() => scrollRef.current?.scrollBy({ top: 180, behavior: 'smooth' })}
              className="pointer-events-auto animate-scroll-nudge flex items-center gap-1 rounded-full border border-white bg-[#6b4fc0] px-3 py-1 text-[11px] font-black text-white shadow-md active:scale-95"
            >
              <span>↓</span>
              <span>Aşağıda devamı var · Kaydır</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- yardım (yan sekmeli "Nasıl Oynanır" penceresi) ----------
function Row({ k, children }) {
  return (
    <li className="flex items-start gap-3 text-sm font-semibold text-[#4a3b5c]">
      <kbd className="shrink-0 rounded-lg border-2 border-[#d6c7ff] bg-[#f6f0ff] px-2 py-0.5 text-xs font-extrabold text-[#7a5fd0]">{k}</kbd>
      <span>{children}</span>
    </li>
  )
}

const GUIDE_TABS = [
  { id: 'start', label: 'Başlangıç' },
  { id: 'world', label: 'Şehir & Mekanlar' },
  { id: 'home', label: 'Evim & Döşeme' },
  { id: 'social', label: 'Sosyal & Sohbet' },
  { id: 'progress', label: 'Görev & Altın' },
]

export function HelpModal({ onClose, inCity = false, onOpenWardrobe, onGoHome, onOpenMap }) {
  const [tab, setTab] = useState('start')
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#4a3b5c]/30 p-3 backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nasıl Oynanır"
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[88svh] w-full max-w-2xl animate-pop flex-col overflow-hidden rounded-[2rem] border-2 border-white bg-white/95 shadow-toy"
      >
        {/* üst başlık */}
        <div className="flex items-center justify-between border-b border-[#efe6ff] px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-[#4a3b5c]">Nasıl Oynanır?</h2>
            <p className="text-xs font-bold text-[#8a7a9c]">Merak ettiğin konuyu soldaki sekmelerden seç</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="rounded-full bg-[#f6f0ff] px-3 py-2 text-xs font-extrabold text-[#7c6d91] transition hover:bg-[#ffedd6] active:scale-95"
          >
            Kapat
          </button>
        </div>

        {/* gövde: solda sekmeler, sağda içerik */}
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <nav aria-label="Rehber sekmeleri" className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-[#efe6ff] bg-[#faf6ff]/80 p-3 sm:w-48 sm:flex-col sm:overflow-x-visible sm:border-b-0 sm:border-r">
            {GUIDE_TABS.map((t) => {
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex shrink-0 items-center rounded-2xl px-3 py-2.5 text-left text-xs font-extrabold transition active:scale-95 ${
                    active ? 'bg-white text-[#4a3b5c] shadow-soft ring-2 ring-[#fdb252]/70' : 'text-[#7c6d91] hover:bg-white/60'
                  }`}
                >
                  <span className="whitespace-nowrap">{t.label}</span>
                </button>
              )
            })}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {tab === 'start' && (
              <div className="flex flex-col gap-4">
                <div className="rounded-2xl border-2 border-[#ffe3b8] bg-[#fff8ec] p-3.5">
                  <p className="text-xs font-black uppercase tracking-wide text-[#e8952c]">🌴 Rastla Hikâyesi: Sahilden Şehre</p>
                  <p className="mt-1 text-xs font-bold leading-relaxed text-[#5c4b6e]">
                    Rastla’da herkes yolculuğa <b>Rastla Sahili</b>’nde başlar! Önce Beach Party pistinde dans et, iki kişilik masalarda oturup insanlarla kaynaş, voleybol ya da sörf oyna. Kafa dengi birilerini bulduğunda kuzey yolundan yürüyerek (veya haritadan) <b>Kafe Sokağı</b>’na, <b>Gece Kulübü</b>’ne, <b>MakFit</b>’e ve kendi evine birlikte akarsınız!
                  </p>
                </div>

                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#e8952c]">Temel Kontroller</h3>
                  <ul className="mt-2.5 flex flex-col gap-2">
                    <Row k="W A S D">veya ok tuşlarıyla yürü</Row>
                    <Row k="Shift">basılı tutarak koş</Row>
                    <Row k="E">mekân kapısına gir, otur, topla ya da NPC ile konuş</Row>
                    <Row k="Fare">sürükle: kamerayı çevir · tekerlek: yakınlaştır</Row>
                    <Row k="1 – 4">alt beceri çubuğundaki tepki ve dansları kullan</Row>
                    <Row k="H">bu rehberi dilediğin zaman aç / kapat</Row>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#e8952c]">Hızlı Erişim</h3>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-2 rounded-2xl border-2 border-white bg-[#faf6ff] p-3 shadow-soft">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-[#4a3b5c]">Gardırop & Stil</p>
                        <p className="text-[11px] font-semibold text-[#8a7a9c]">Saç, aksesuar, dost seçimi</p>
                      </div>
                      {onOpenWardrobe && (
                        <button type="button" onClick={onOpenWardrobe} className="shrink-0 rounded-xl bg-[#a88bff] px-2.5 py-1.5 text-xs font-extrabold text-white active:scale-95">
                          Aç
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-2xl border-2 border-white bg-[#fff8f0] p-3 shadow-soft">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-[#4a3b5c]">Kendi Evin</p>
                        <p className="text-[11px] font-semibold text-[#8a7a9c]">Lobi güneybatısı veya /ev</p>
                      </div>
                      {inCity && onGoHome && (
                        <button type="button" onClick={onGoHome} className="shrink-0 rounded-xl bg-[#fdb252] px-2.5 py-1.5 text-xs font-extrabold text-white active:scale-95">
                          Git
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-2xl border-2 border-white bg-[#f0f9ff] p-3 shadow-soft sm:col-span-2">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-[#4a3b5c]">Şehir Haritası</p>
                        <p className="text-[11px] font-semibold text-[#8a7a9c]">Sağ üstteki yuvarlak haritaya basıp tek tıkla ışınlan</p>
                      </div>
                      {inCity && onOpenMap && (
                        <button type="button" onClick={onOpenMap} className="shrink-0 rounded-xl bg-[#5fc0ea] px-2.5 py-1.5 text-xs font-extrabold text-white active:scale-95">
                          Aç
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'world' && (
              <div className="flex flex-col gap-3">
                <p className="text-xs font-bold text-[#8a7a9c]">
                  Şehirdeki tüm mekanların kapısına yaklaşıp <b>E</b> ile içeri girebilir, sokak satıcılarından (Dondurmacı, Çiçekçi, Baloncu) altınla ürün alabilirsin.
                </p>
                <ul className="flex flex-col gap-2">
                  {ZONES.map((z) => (
                    <li key={z.id} className="rounded-2xl bg-[#faf6ff] px-3.5 py-2.5 text-sm font-semibold text-[#4a3b5c]">
                      <b className="font-black text-[#4a3b5c]">{z.name}</b>
                      <span className="block text-xs font-semibold text-[#8a7a9c]">{z.desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {tab === 'home' && (
              <div className="flex flex-col gap-3">
                <p className="text-xs font-bold text-[#8a7a9c]">
                  Evine girdiğinde döşeme çekmecesi otomatik açılır. Mobilyaları yerleştir, yönünü çevir ve arkadaşlarını davet et.
                </p>
                <ul className="flex flex-col gap-2">
                  <Row k="/ev">veya lobideki Evim kapısından içeri gir</Row>
                  <Row k="R">seçili mobilyayı 90° döndür</Row>
                  <Row k="Delete">seçili mobilyayı odadan kaldır</Row>
                  <Row k="/davet isim">çevrimiçi bir oyuncuyu evine çağır</Row>
                  <Row k="/ziyaret isim">açık ya da davetli olduğun bir eve git</Row>
                  <Row k="/kapı aç">evini herkese aç · /kapı kapat: yalnızca davetliler</Row>
                </ul>
              </div>
            )}

            {tab === 'social' && (
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#e8952c]">Sohbet & Komutlar</h3>
                  <ul className="mt-2 flex flex-col gap-2">
                    <Row k="Enter">yazmaya başla / gönder · Esc: vazgeç</Row>
                    <Row k="/f isim …">aynı odadaki birine fısılda; çevre yalnızca fısıldadığını görür</Row>
                    <Row k="/yakındakiler">yakınındaki oyuncuları listele</Row>
                    <Row k="/ışınlan kafe">lobi, kafe, kulüp, park veya plaja ışınlan</Row>
                    <Row k="/intro">giriş sahnesini tekrar izle</Row>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#e8952c]">Etkileşim & Eşleşme</h3>
                  <ul className="mt-2 flex flex-col gap-2">
                    <Row k="Karaktere tıkla">profilini gör, jest gönder veya dansa davet et</Row>
                    <Row k="Eşleşme">ikiniz de birbirine kalp gönderirseniz karşılıklı eşleşirsiniz</Row>
                  </ul>
                </div>
                <p className="rounded-2xl bg-[#fff3e0]/80 px-3.5 py-2.5 text-xs font-bold text-[#6e5232]">
                  Herkese saygılı ol. Rahatsız edici bir durumla karşılaşırsan oyuncunun profil kartından engelleyebilir veya bildirebilirsin.
                </p>
              </div>
            )}

            {tab === 'progress' && (
              <div className="flex flex-col gap-3">
                <ul className="flex flex-col gap-2">
                  <Row k="Koleksiyon">şehirde parlayan yıldız, çiçek ve gizli sandıkları E ile topla</Row>
                  <Row k="EXP & Seviye">topladığın her eşya alttaki EXP çubuğunu doldurur ve yeni ödüller açar</Row>
                  <Row k="Balıkçılık">meslek seçmeden sahil iskelesinde veya park göletinde E ile olta at</Row>
                  <Row k="Postacılık">lobideki kırmızı posta kutusundan paket alıp mekanlara teslim et (+12 TL)</Row>
                  <Row k="Altın">balık tutarak, posta dağıtarak, kulüpte DJ olarak veya plaj etkinlikleriyle kazan</Row>
                  <Row k="Bisiklet">sol çubuktaki bisiklet düğmesiyle şehirde çok daha hızlı gez</Row>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- kamera eğitimi: el sağa-sola sürükler ----------
/** İlk şehir girişinde bir kez: animasyonlu el kamerayı çevirmeyi gösterir. İlk gerçek sürüklemede ya da ~10 sn sonra kapanır. */
export function CameraTutorial({ touch, onDone }) {
  // başka bir pencere (evcil hayvan seçimi vb.) açıkken el gösterilmez
  const [blocked, setBlocked] = useState(false)
  useEffect(() => {
    const id = setInterval(() => setBlocked(Boolean(document.querySelector('[role="dialog"][aria-modal="true"]'))), 300)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    if (blocked) return undefined
    const t = setTimeout(onDone, 10000)
    let dist = 0
    let last = null
    const move = (e) => {
      if (e.pointerType === 'mouse' && e.buttons === 0) return
      if (last) dist += Math.abs(e.clientX - last.x)
      last = { x: e.clientX }
      if (dist > 160) onDone()
    }
    const up = () => (last = null)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      clearTimeout(t)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [onDone, blocked])
  if (blocked) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[22%] z-30 grid place-items-center" role="status">
      <div className="flex w-[min(21rem,calc(100vw-1.5rem))] animate-pop flex-col items-center gap-2 rounded-[2rem] border-2 border-white bg-white/85 px-5 pb-4 pt-3 shadow-toy backdrop-blur-md">
        <div className="relative flex h-24 w-full items-center justify-center">
          <span className="absolute left-3" style={{ animation: 'hand-arrow 1.8s ease-in-out infinite' }}><Ico name="prev" size={26} /></span>
          <span className="absolute right-3" style={{ animation: 'hand-arrow 1.8s ease-in-out 0.9s infinite' }}><Ico name="next" size={26} /></span>
          <div className="absolute h-1.5 w-40 rounded-full bg-gradient-to-r from-transparent via-[#fdb252]/50 to-transparent" />
          <div style={{ animation: 'hand-drag 2.4s ease-in-out infinite' }}>
            <div style={{ animation: 'hand-press 2.4s ease-in-out infinite', filter: 'drop-shadow(0 6px 8px rgba(74,59,92,.3))' }}>
              <Ico name="hand" size={64} />
            </div>
          </div>
        </div>
        <p className="text-center text-sm font-black text-[#4a3b5c]">Kamerayı çevir</p>
        <p className="text-center text-xs font-bold text-[#8a7a9c]">
          {touch ? 'Parmağını ekranda sağa-sola kaydır. İki parmakla yakınlaştır.' : 'Sol tuşu basılı tutup sağa-sola sürükle. Tekerlekle yakınlaştır.'}
        </p>
      </div>
    </div>
  )
}

// ---------- ilk giriş: hoş geldin → hareket et → yakındaki oyuncuya selam ver ----------
export function StartGuide({ touch, ready = true, inCity, inAirport = false, focusRef, roster, remotes, peerRange, onGreet, onDone, blocked = false }) {
  const [stage, setStage] = useState('welcome') // welcome | move | greet
  const [shown, setShown] = useState(false)
  const [nearbyPeer, setNearbyPeer] = useState(null)
  const moveStart = useRef(null)

  useEffect(() => {
    if (!ready || !inCity || inAirport || blocked) return
    const t = setTimeout(() => setShown(true), 1200)
    return () => clearTimeout(t)
  }, [ready, inCity, inAirport, blocked])

  useEffect(() => {
    if (!shown || !inCity || stage !== 'move' || blocked) return
    const start = moveStart.current
    const t = setInterval(() => {
      const current = focusRef.current
      if (start && Math.hypot(current.x - start.x, current.z - start.z) >= 1.2) setStage('greet')
    }, 250)
    return () => clearInterval(t)
  }, [shown, inCity, stage, focusRef, blocked])

  useEffect(() => {
    if (!shown || !inCity || stage !== 'greet' || blocked) return
    const updateNearbyPeer = () => {
      const current = focusRef.current
      let closest = null
      let closestDistance = peerRange
      for (const peer of roster) {
        if (peer.dnd) continue
        const position = remotes.current.get(peer.id)
        if (!position) continue
        const distance = Math.hypot(position.x - current.x, position.z - current.z)
        if (distance <= closestDistance) {
          closest = peer
          closestDistance = distance
        }
      }
      setNearbyPeer((previous) => previous?.id === closest?.id ? previous : closest)
    }
    updateNearbyPeer()
    const t = setInterval(updateNearbyPeer, 700)
    return () => clearInterval(t)
  }, [shown, inCity, stage, blocked, focusRef, roster, remotes, peerRange])

  if (!shown || !inCity || inAirport || blocked || (stage === 'greet' && !nearbyPeer)) return null

  const startMoving = () => {
    const current = focusRef.current
    moveStart.current = { x: current.x, z: current.z }
    setStage('move')
  }
  const movementHint = touch ? 'Sol joystick ile yürü; sağ joystick ile kamerayı çevir.' : 'WASD ile yürü; fareyle kamerayı çevir.'

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-3"
      style={{ paddingBottom: touch ? 'calc(env(safe-area-inset-bottom) + 7.25rem)' : 'calc(env(safe-area-inset-bottom) + 9.5rem)' }}
    >
      <div className={`pointer-events-auto relative flex w-[min(22rem,calc(100vw-1.5rem))] animate-pop items-center gap-2.5 rounded-2xl px-3.5 py-2.5 pr-9 sm:w-[min(25rem,calc(100vw-1.5rem))] sm:gap-3 sm:rounded-3xl sm:px-4 sm:py-3.5 sm:pr-11 ${glass}`} role="status" key={stage}>
        <span className="shrink-0 text-2xl sm:text-3xl" aria-hidden>{stage === 'welcome' ? '🌴' : stage === 'move' ? '🎶' : '👋'}</span>
        <div className="min-w-0 flex-1">
          {stage === 'welcome' ? (
            <>
              <p className="text-xs font-black text-[#4a3b5c] sm:text-sm">Hikâye sahilde başlıyor!</p>
              <p className="mt-0.5 text-[11px] font-bold text-[#8a7a9c] sm:text-xs">Önce Beach Party masalarında ve pistte kaynaş; sonra birlikte şehre akarsınız.</p>
              <div className="mt-2 flex gap-2">
                <button onClick={startMoving} className="rounded-full bg-[#fdb252] px-3 py-1 text-[11px] font-black text-white shadow-sm active:scale-95 sm:px-3.5 sm:py-1.5 sm:text-xs">Sahile karış</button>
                <button onClick={onDone} className="rounded-full bg-[#f6f0ff] px-3 py-1 text-[11px] font-black text-[#6b4fc0] active:scale-95 sm:px-3.5 sm:py-1.5 sm:text-xs">Atla</button>
              </div>
            </>
          ) : stage === 'move' ? (
            <>
              <p className="text-xs font-black text-[#4a3b5c] sm:text-sm">Sahil partisine doğru yürü</p>
              <p className="mt-0.5 text-[11px] font-bold text-[#8a7a9c] sm:text-xs">{movementHint}</p>
              <button onClick={onDone} className="mt-2 rounded-full bg-[#f6f0ff] px-3 py-1 text-[11px] font-black text-[#6b4fc0] active:scale-95 sm:px-3.5 sm:py-1.5 sm:text-xs">Tamam</button>
            </>
          ) : (
            <>
              <p className="text-xs font-black text-[#4a3b5c] sm:text-sm">Yakınında {nearbyPeer.name} var!</p>
              <p className="mt-0.5 text-[11px] font-bold text-[#8a7a9c] sm:text-xs">Selam verip iki kişilik masaya davet et; kaynaşınca şehre inersiniz.</p>
              <button onClick={() => onGreet(nearbyPeer.id)} className="mt-2 rounded-full bg-[#fdb252] px-3 py-1 text-[11px] font-black text-white shadow-sm active:scale-95 sm:px-3.5 sm:py-1.5 sm:text-xs">
                👋 Selam ver
              </button>
            </>
          )}
        </div>
        <button onClick={onDone} aria-label="İpucunu kapat" className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full hover:bg-[#ffedd6]/70">
          <Ico name="close" size={12} />
        </button>
      </div>
    </div>
  )
}
