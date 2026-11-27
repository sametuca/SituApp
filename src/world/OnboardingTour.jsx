// Yeni başlayan oyuncular için (Mobil & PC) ekranın geri kalanını karartan (spotlight),
// adım adım kamera sürükleme, joystick'ler, açılır menü (dropdown) elemanları ve beceri çubuğu rehberi.
import { useEffect, useState } from 'react'
import { Ico } from '../components/Icon'

const MOBILE_STEPS = [
  {
    id: 'drag',
    selector: null,
    emoji: '👆',
    title: 'Ekranı Kaydır & Etrafa Bak',
    desc: 'Parmağını ekranda sağa-sola sürükleyerek kamerayı çevirebilir, iki parmakla yakınlaştırabilir ve kumsaldaki oyunculara dokunarak tanışabilirsin.',
  },
  {
    id: 'move-joy',
    selector: '[data-tour="move-joy"]',
    emoji: '🕹️',
    title: 'Hareket Joystick’i',
    desc: 'Sol joystick ile sahilde ve şehirde yürürsün. Topuzu en kenara itersen karakterin koşmaya başlar!',
  },
  {
    id: 'look-joy',
    selector: '[data-tour="look-joy"]',
    emoji: '🔄',
    title: 'Kamera Joystick’i',
    desc: 'Sağdaki kamera joystick’i ile yürürken bile bakış açını kolayca sağa-sola ve yukarı-aşağı çevirebilirsin.',
  },
  {
    id: 'left-menu',
    selector: '[data-tour="left-menu-panel"]',
    fallbackSelector: '[data-tour="left-menu-btn"]',
    emoji: '☰',
    title: 'Sol Hızlı Menü',
    desc: 'Harita & Işınlanma, Gardırop, Bisiklet, Çanta, Sosyal & Buluşma, Ortak Görevler, Paketler ve Fısıltı kutusuna buradan ulaşırsın.',
  },
  {
    id: 'right-menu',
    selector: '[data-tour="right-menu-panel"]',
    emoji: '⚙️',
    title: 'Ayarlar & Durum Menüsü',
    desc: 'TL bakiyeni, Ses aç/kapat ayarını, Arkadaş listeni, Günlük Görevlerini, Statlarını ve Tam Ekran modunu buradan yönetirsin.',
  },
  {
    id: 'skill-bar',
    selector: '[data-tour="skill-bar"]',
    emoji: '✨',
    title: 'Tepki & Dans Çubuğu',
    desc: 'Tek dokunuşla selam ver, dans et veya kalp gönder! Artık hazırsın — önce sahilde kaynaş, sonra birlikte şehre ak!',
  },
]

const DESKTOP_STEPS = [
  {
    id: 'drag',
    selector: null,
    emoji: '🖱️',
    title: 'Kamerayı Kaydır & Yürü',
    desc: 'Farenin sol tuşunu basılı tutup sağa-sola sürükleyerek etrafına bak, tekerlekle yakınlaştır ve WASD / Ok tuşlarıyla sahilde dolaş.',
  },
  {
    id: 'left-rail',
    selector: '[data-tour="desktop-left-bar"]',
    emoji: '🎒',
    title: 'Sol Araç Çubuğu',
    desc: 'Gardırop, Bisiklet, Çanta, Sosyal & Buluşma, Ortak Görevler, Paketler ve Fısıltı sohbetlerin sol menüde elinin altında.',
  },
  {
    id: 'right-menu',
    selector: '[data-tour="right-menu-panel"]',
    emoji: '⚙️',
    title: 'Sağ Üst Menü & Ayarlar',
    desc: 'Arkadaş listene, Günlük Görevlere, Karakter Statlarına, Tam Ekran moduna ve Ses/Grafik ayarlarına buradan ulaşırsın.',
  },
  {
    id: 'skill-bar',
    selector: '[data-tour="skill-bar"]',
    emoji: '💃',
    title: 'Beceri & İfade Çubuğu',
    desc: '1–4 tuşlarıyla veya tıklayarak el salla, dans et, kalp gönder! Artık serbestsin — önce sahilde kaynaş, sonra şehre ak!',
  },
]

export function OnboardingTour({ active, touch, stepIndex, onStepChange, onDone }) {
  const [narrow, setNarrow] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false))
  const [rect, setRect] = useState(null)

  useEffect(() => {
    const onR = () => setNarrow(window.innerWidth < 768)
    window.addEventListener('resize', onR)
    return () => window.removeEventListener('resize', onR)
  }, [])

  const isMobileLayout = Boolean(touch || narrow)
  const steps = isMobileLayout ? MOBILE_STEPS : DESKTOP_STEPS
  const cur = steps[stepIndex] ?? null

  useEffect(() => {
    if (!active || !cur) {
      setRect(null)
      return undefined
    }
    if (!cur.selector) {
      setRect(null)
      return undefined
    }

    const measure = () => {
      const el =
        document.querySelector(cur.selector) ||
        (cur.fallbackSelector ? document.querySelector(cur.fallbackSelector) : null)
      if (!el) {
        setRect(null)
        return
      }
      const r = el.getBoundingClientRect()
      if (r.width < 4 || r.height < 4) {
        setRect(null)
        return
      }
      const pad = 8
      setRect({
        left: Math.max(4, r.left - pad),
        top: Math.max(4, r.top - pad),
        width: Math.min(window.innerWidth - 8, r.width + pad * 2),
        height: Math.min(window.innerHeight - 8, r.height + pad * 2),
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
      })
    }

    measure()
    const t1 = setTimeout(measure, 70)
    const t2 = setTimeout(measure, 220)
    const iv = setInterval(measure, 350)
    window.addEventListener('resize', measure)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearInterval(iv)
      window.removeEventListener('resize', measure)
    }
  }, [active, cur])

  if (!active || !cur) return null

  const isLast = stepIndex >= steps.length - 1
  const next = () => {
    if (isLast) onDone()
    else onStepChange(stepIndex + 1)
  }

  // Açıklama kartını aydınlatılan öğenin üstünü kapatmayacak şekilde konumlandır
  const vh = typeof window !== 'undefined' ? window.innerHeight : 720
  const placeCardTop = rect ? rect.cy > vh * 0.54 : false

  return (
    <div className="fixed inset-0 z-[80] select-none" role="dialog" aria-modal="true" aria-label={cur.title}>
      {/* Geri kalan ekranı karartan katman / spotlight oyuğu */}
      {rect ? (
        <>
          {/* Tıklamaları yakalayan şeffaf perde */}
          <div className="fixed inset-0" onClick={next} />
          {/* Parlayan hedef çerçevesi + dışını karartan dev gölge */}
          <div
            className="pointer-events-none fixed rounded-3xl border-[3px] border-[#ffd35e] transition-all duration-200"
            style={{
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              boxShadow: '0 0 0 9999px rgba(18, 11, 34, 0.76), 0 0 28px rgba(255, 211, 94, 0.85)',
            }}
          >
            <span className="absolute -inset-1.5 animate-ping rounded-3xl border-2 border-[#ffd35e]/70" />
          </div>
        </>
      ) : (
        <div className="fixed inset-0 bg-[#120b22]/74 backdrop-blur-[2px]" onClick={next} />
      )}

      {/* İlk adımda (kamera kaydırma) havalimanındaki gibi animasyonlu el hareketi */}
      {cur.id === 'drag' && (
        <div className="pointer-events-none fixed inset-x-0 top-[24%] flex flex-col items-center justify-center sm:top-[28%]">
          <div className="relative flex h-24 w-56 items-center justify-center">
            <span className="absolute left-2" style={{ animation: 'hand-arrow 1.8s ease-in-out infinite' }}>
              <Ico name="prev" size={28} />
            </span>
            <span className="absolute right-2" style={{ animation: 'hand-arrow 1.8s ease-in-out 0.9s infinite' }}>
              <Ico name="next" size={28} />
            </span>
            <div className="absolute h-1.5 w-40 rounded-full bg-gradient-to-r from-transparent via-[#ffd35e]/80 to-transparent" />
            <div style={{ animation: 'hand-drag 2.2s ease-in-out infinite' }}>
              <div style={{ animation: 'hand-press 2.2s ease-in-out infinite', filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.45))' }}>
                <Ico name="hand" size={62} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rehber bilgi kartı */}
      <div
        className={`pointer-events-none fixed inset-x-0 z-10 flex justify-center px-3 ${
          cur.id === 'drag'
            ? 'bottom-8 sm:bottom-12'
            : placeCardTop
              ? 'top-14 sm:top-16'
              : 'bottom-6 sm:bottom-10'
        }`}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto flex w-[min(90vw,22.5rem)] animate-pop flex-col gap-2.5 rounded-3xl border-2 border-white bg-white/96 p-4 text-[#4a3b5c] shadow-toy backdrop-blur-md"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="rounded-full bg-[#fff3c8] px-2.5 py-0.5 text-[11px] font-black text-[#8a5a00]">
                {stepIndex + 1}/{steps.length}
              </span>
              <div className="flex gap-1">
                {steps.map((s, i) => (
                  <span
                    key={s.id}
                    className={`h-1.5 rounded-full transition-all ${
                      i === stepIndex ? 'w-4 bg-[#fdb252]' : i < stepIndex ? 'w-1.5 bg-[#8fdcb4]' : 'w-1.5 bg-[#e2d6f5]'
                    }`}
                  />
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={onDone}
              className="rounded-full bg-[#f6f0ff] px-2.5 py-1 text-[11px] font-black text-[#7c6d91] transition hover:bg-[#eadcff] active:scale-95"
            >
              Atla ✕
            </button>
          </div>

          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#fff4e0] text-xl shadow-sm">
              {cur.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-black text-[#4a3b5c] sm:text-base">{cur.title}</h3>
              <p className="mt-0.5 text-xs font-bold leading-relaxed text-[#7b6b90]">{cur.desc}</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-0.5">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={() => onStepChange(stepIndex - 1)}
                className="rounded-xl bg-[#f6f0ff] px-3 py-2 text-xs font-black text-[#6b4fc0] active:scale-95"
              >
                Geri
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="flex-1 rounded-xl border-b-[3px] border-[#d98a1c] bg-[#fdb252] px-4 py-2 text-xs font-black text-white shadow-sm active:translate-y-[1px]"
            >
              {isLast ? '🌴 Başla! Serbestsin' : 'Devam Et →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const ONBOARD_STEPS = { mobile: MOBILE_STEPS, desktop: DESKTOP_STEPS }
