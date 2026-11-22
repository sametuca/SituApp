import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const avatars = [
  { id: 1, name: 'Zeynep', emoji: '👩🏻‍🦰', gradient: 'from-pink-500 to-rose-500' },
  { id: 2, name: 'Deniz', emoji: '🧑🏽', gradient: 'from-blue-500 to-cyan-500' },
  { id: 3, name: 'Elif', emoji: '👩🏽', gradient: 'from-purple-500 to-fuchsia-500' },
  { id: 4, name: 'Kaan', emoji: '🧔🏻', gradient: 'from-amber-500 to-orange-500' },
  { id: 5, name: 'Mira', emoji: '👩🏻', gradient: 'from-teal-500 to-emerald-500' },
  { id: 6, name: 'Ege', emoji: '🧑🏻‍🦱', gradient: 'from-violet-500 to-indigo-500' },
]

export default function AvatarSelect() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState(null)

  const handleContinue = () => {
    if (!selected) return
    localStorage.setItem('situapp_avatar', JSON.stringify(selected))
    navigate('/location')
  }

  return (
    <div className="min-h-screen w-full bg-[#0a0010] flex flex-col items-center px-6 py-10">
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a0030] via-[#0a0010] to-[#000820] -z-10" />

      <div className="w-full max-w-md flex flex-col items-center gap-2 mb-8">
        <p className="text-purple-300/70 text-xs tracking-widest uppercase">adım 1 / 2</p>
        <h1 className="text-3xl font-bold text-white text-center">
          Avatarını Seç
        </h1>
        <p className="text-white/50 text-sm text-center">
          Kim olarak bağlantı kuracaksın?
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 w-full max-w-md mb-8">
        {avatars.map((a) => {
          const isActive = selected?.id === a.id
          return (
            <button
              key={a.id}
              onClick={() => setSelected(a)}
              className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-200 border-2 ${
                isActive
                  ? 'border-purple-400 scale-105 shadow-[0_0_25px_rgba(168,85,247,0.4)]'
                  : 'border-white/10 hover:border-white/30'
              }`}
            >
              <div
                className={`w-full h-full rounded-2xl bg-gradient-to-br ${a.gradient} opacity-20 absolute inset-0`}
              />
              <span className="text-3xl relative z-10">{a.emoji}</span>
              <span className="text-white/80 text-xs font-medium relative z-10">
                {a.name}
              </span>
              {isActive && (
                <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center z-10">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      <button
        onClick={handleContinue}
        disabled={!selected}
        className={`w-full max-w-md py-4 rounded-2xl font-semibold text-lg transition-all duration-200 ${
          selected
            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-[0_0_30px_rgba(168,85,247,0.3)] active:scale-95'
            : 'bg-white/5 text-white/30 cursor-not-allowed'
        }`}
      >
        Devam Et
      </button>

      <button
        onClick={() => navigate('/')}
        className="mt-4 text-white/30 text-sm"
      >
        ← Geri
      </button>
    </div>
  )
}
