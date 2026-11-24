import { lazy, Suspense, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGLTF } from '@react-three/drei'
import { useAuth } from '../lib/AuthContext'
import { PastelBackground, TONES, ToyButton } from '../components/ui'
import LookPicker from '../components/LookPicker'
import { emptyLook } from '../world/lookData'

const readSaved = () => {
  try {
    return JSON.parse(localStorage.getItem('situapp_avatar'))
  } catch {
    return null
  }
}

const AvatarPreview = lazy(() => import('../components/3d/AvatarPreview'))

// gender: 'f' → pembe tema, 'm' → mavi tema.
// gradient: World'ün yedek (model yüklenemezse) rengi için eski alan; tint: kart rengi.
const avatars = [
  { id: 1, name: 'Zeynep', gender: 'f', emoji: '👩🏻‍🦰', gradient: 'from-pink-500 to-rose-500', tint: 'bg-candy-pink/50' },
  { id: 2, name: 'Deniz', gender: 'm', emoji: '🧑🏽', gradient: 'from-blue-500 to-cyan-500', tint: 'bg-candy-blue/60' },
  { id: 3, name: 'Elif', gender: 'f', emoji: '👩🏽', gradient: 'from-purple-500 to-fuchsia-500', tint: 'bg-candy-lilac/60' },
  { id: 4, name: 'Kaan', gender: 'm', emoji: '🧔🏻', gradient: 'from-amber-500 to-orange-500', tint: 'bg-candy-blue/40' },
  { id: 5, name: 'Mira', gender: 'f', emoji: '👩🏻', gradient: 'from-teal-500 to-emerald-500', tint: 'bg-candy-mint/70' },
  { id: 6, name: 'Ege', gender: 'm', emoji: '🧑🏻‍🦱', gradient: 'from-violet-500 to-indigo-500', tint: 'bg-candy-lilac/50' },
]

const toneOf = (a) => (a.gender === 'm' ? 'blue' : 'pink')
const PEDESTAL = { pink: '#fecb89', blue: '#a9ddf5' }
const slugOf = (a) => a.name.toLowerCase()

export default function AvatarSelect() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [selected, setSelected] = useState(avatars[0])
  const [look, setLook] = useState(emptyLook)
  const tone = toneOf(selected)

  // TEK KARAKTER: hesabın karakteri zaten oluşturulduysa seçim ekranı atlanır (yeni karakter = yeni üyelik)
  useEffect(() => {
    if (readSaved()?.locked) navigate('/world', { replace: true })
  }, [navigate])

  // seçim anında takılma olmasın diye tüm avatarları arka planda yükle
  // (ilk karakter önce gelsin diye biraz gecikmeli)
  useEffect(() => {
    const timer = setTimeout(() => {
      avatars.forEach((a) => useGLTF.preload(`/models/avatars/${slugOf(a)}.glb`))
    }, 2500)
    return () => clearTimeout(timer)
  }, [])

  const handleContinue = () => {
    localStorage.setItem('situapp_avatar', JSON.stringify({ ...selected, tone, look }))
    navigate('/world')
  }

  // ← → ile avatarlar arasında gez
  const onKeyDown = (e) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const i = avatars.findIndex((a) => a.id === selected.id)
    setSelected(avatars[(i + step + avatars.length) % avatars.length])
  }

  return (
    <PastelBackground tone={tone}>
      <main className="mx-auto grid min-h-svh w-full max-w-5xl content-center gap-6 px-5 py-8 lg:grid-cols-[1.1fr_1fr] lg:gap-x-12">
        <header className="flex flex-col items-center text-center lg:col-span-2">
            <h1 className="mt-4 text-3xl font-black text-ink sm:text-4xl">Karakterini Seç</h1>
          <p className="mt-1 text-sm font-bold text-ink-soft">Dünyada bu karakterle dolaşacak ve yeni insanlarla tanışacaksın.</p>
        </header>

        {/* sahne */}
        <section
          aria-label="Karakter önizleme"
          className="relative h-[22rem] overflow-hidden rounded-[2.5rem] border-2 border-white shadow-toy sm:h-[26rem] lg:h-[34rem]"
        >
          <div
            aria-hidden
            className={`absolute inset-0 bg-[radial-gradient(circle_at_50%_78%,#ffffff_0%,#ffd0e5_62%,#ffb6d3_100%)] transition-opacity duration-700 ${tone === 'pink' ? 'opacity-100' : 'opacity-0'}`}
          />
          <div
            aria-hidden
            className={`absolute inset-0 bg-[radial-gradient(circle_at_50%_78%,#ffffff_0%,#cdeaff_62%,#a9ddf5_100%)] transition-opacity duration-700 ${tone === 'blue' ? 'opacity-100' : 'opacity-0'}`}
          />
          {['left-[10%] top-[14%] text-3xl', 'right-[12%] top-[22%] text-2xl', 'left-[18%] bottom-[26%] text-xl', 'right-[16%] bottom-[32%] text-3xl'].map((c, i) => (
            <span key={i} aria-hidden className={`absolute animate-float text-white/90 ${c}`} style={{ animationDelay: `${i * 0.9}s` }}>
              ✦
            </span>
          ))}
          <Suspense fallback={<div className="grid h-full place-items-center text-7xl">🧸</div>}>
            <AvatarPreview slug={slugOf(selected)} look={look} rotatable pedestal={PEDESTAL[tone]} className="absolute inset-0 h-full w-full" />
          </Suspense>
          <p className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-white/70 px-4 py-1 text-xs font-extrabold text-ink-soft backdrop-blur-sm">
            ↔ sürükleyerek döndür
          </p>
        </section>

        {/* seçim paneli */}
        <section className="flex flex-col justify-center gap-5">
          <div
            role="radiogroup"
            aria-label="Karakter"
            onKeyDown={onKeyDown}
            className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-3"
          >
            {avatars.map((a) => {
              const active = selected.id === a.id
              return (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setSelected(a)}
                  className={`group relative overflow-hidden rounded-3xl border-2 p-2.5 pb-2 transition-all duration-200 ${a.tint}
                    focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-candy-lilac/60
                    ${active ? `scale-105 shadow-toy ${TONES[toneOf(a)].ring}` : 'border-white hover:scale-[1.03]'}`}
                >
                  <img
                    src={`/avatars/${slugOf(a)}.png`}
                    alt=""
                    width="256"
                    height="256"
                    loading="lazy"
                    className="aspect-square w-full rounded-full border-2 border-white/80 bg-white/40 object-cover object-top"
                  />
                  <span className="mt-1 block text-center text-sm font-extrabold text-ink">{a.name}</span>
                  {active && (
                    <span className={`absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-xs font-black text-white ${TONES[toneOf(a)].badge}`}>
                      ✓
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="rounded-3xl border-2 border-white bg-white/70 p-3 shadow-soft backdrop-blur-sm">
            <LookPicker value={look} onChange={setLook} />
          </div>
          <p className="text-center text-xs font-bold text-ink-soft">⚠️ Her hesap yalnızca 1 karakter oluşturabilir. Seçimin kalıcıdır; yeni karakter için yeni üyelik gerekir.</p>

          <ToyButton tone={tone} onClick={handleContinue}>
            Bu Ben! Şehre Gir
          </ToyButton>

          <button
            type="button"
            onClick={async () => {
              await signOut()
              navigate('/')
            }}
            className="self-center text-sm font-bold text-ink-soft/70 hover:text-ink-soft"
          >
            Çıkış yap{user ? ` (${user.username})` : ''}
          </button>
        </section>
      </main>
    </PastelBackground>
  )
}
