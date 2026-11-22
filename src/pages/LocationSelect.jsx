import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const locations = [
  { id: 'cafe', name: 'Kafe', emoji: '☕', desc: 'sakin, samimi sohbetler', gradient: 'from-amber-500 to-orange-600' },
  { id: 'park', name: 'Park', emoji: '🌳', desc: 'açık hava, yürüyüş', gradient: 'from-emerald-500 to-green-600' },
  { id: 'club', name: 'Gece Kulübü', emoji: '🪩', desc: 'enerjik, dans', gradient: 'from-fuchsia-500 to-purple-600' },
  { id: 'beach', name: 'Plaj', emoji: '🏖️', desc: 'gün batımı, rahat', gradient: 'from-cyan-500 to-blue-600' },
]

export default function LocationSelect() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState(null)

  const handleEnter = () => {
    if (!selected) return
    localStorage.setItem('situapp_location', JSON.stringify(selected))
    navigate('/world')
  }

  return (
    <div className="relative min-h-screen w-full bg-[#0a0010] flex flex-col items-center px-6 py-10">
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a0030] via-[#0a0010] to-[#000820] -z-10" />

      <div className="w-full max-w-md flex flex-col items-center gap-2 mb-8">
        <p className="text-purple-300/70 text-xs tracking-widest uppercase">adım 2 / 2</p>
        <h1 className="text-3xl font-bold text-white text-center">Mekanı Seç</h1>
        <p className="text-white/50 text-sm text-center">Nerede bağlantı kuracaksın?</p>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-md mb-8">
        {locations.map((loc) => {
          const isActive = selected?.id === loc.id
          return (
            <button
              key={loc.id}
              onClick={() => setSelected(loc)}
              className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center gap-2 transition-all duration-200 border-2 overflow-hidden ${
                isActive
                  ? 'border-purple-400 scale-105 shadow-[0_0_25px_rgba(168,85,247,0.4)]'
                  : 'border-white/10 hover:border-white/30'
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${loc.gradient} opacity-20`} />
              <span className="text-4xl relative z-10">{loc.emoji}</span>
              <span className="text-white font-medium relative z-10">{loc.name}</span>
              <span className="text-white/50 text-xs relative z-10 px-2 text-center">{loc.desc}</span>
              {isActive && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center z-10">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      <button
        onClick={handleEnter}
        disabled={!selected}
        className={`w-full max-w-md py-4 rounded-2xl font-semibold text-lg transition-all duration-200 ${
          selected
            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-[0_0_30px_rgba(168,85,247,0.3)] active:scale-95'
            : 'bg-white/5 text-white/30 cursor-not-allowed'
        }`}
      >
        Dünyaya Gir
      </button>

      <button onClick={() => navigate('/avatar')} className="mt-4 text-white/30 text-sm">
        ← Geri
      </button>
    </div>
  )
}
