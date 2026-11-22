import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

const particles = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 4 + 2,
  duration: Math.random() * 4 + 3,
  delay: Math.random() * 3,
}))

export default function LandingPage() {
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setTimeout(() => setLoaded(true), 100)
  }, [])

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0a0010] flex flex-col items-center justify-center">

      {/* gradient bg */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a0030] via-[#0a0010] to-[#000820] z-0" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-purple-900/20 blur-[120px] z-0" />
      <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] rounded-full bg-pink-900/20 blur-[80px] z-0" />

      {/* floating particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-purple-400/30 animate-pulse z-0"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}

      {/* content */}
      <div
        className={`relative z-10 flex flex-col items-center gap-6 px-6 text-center transition-all duration-700 ${
          loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        {/* logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-[0_0_40px_rgba(168,85,247,0.4)]">
            <span className="text-3xl">💫</span>
          </div>
          <h1 className="text-5xl font-bold text-white tracking-tight mt-2">
            Situ<span className="text-purple-400">App</span>
          </h1>
          <p className="text-purple-300/70 text-sm tracking-widest uppercase">
            find your situationship
          </p>
        </div>

        {/* tagline */}
        <div className="max-w-xs">
          <p className="text-white/60 text-base leading-relaxed">
            Avatarını seç. Mekânı bul. Bağlantını kur.
          </p>
        </div>

        {/* cta */}
        <button
          onClick={() => navigate('/avatar')}
          className="mt-4 px-10 py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-lg shadow-[0_0_30px_rgba(168,85,247,0.3)] hover:shadow-[0_0_50px_rgba(168,85,247,0.5)] hover:scale-105 active:scale-95 transition-all duration-200"
        >
          Dünyaya Gir
        </button>

        {/* hint */}
        <p className="text-white/20 text-xs mt-2">
          Ücretsiz • Kayıt gerekmez
        </p>
      </div>

      {/* bottom wave */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0010] to-transparent z-0" />

      {/* version */}
      <div className="absolute bottom-6 text-white/10 text-xs z-10">
        v0.1 alpha
      </div>

      {/* dev link */}
      <a href="/studio" className="absolute top-4 right-4 text-white/15 text-xs z-10 hover:text-white/40">
        studio
      </a>
    </div>
  )
}
