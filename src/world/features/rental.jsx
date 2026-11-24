// Kiralama kartı (Havalimanı çıkış salonu): bisiklet kiralanır, arabalar listede ama kiralanamaz. Sunucu: server/features/rental.js.
import { useEffect, useState } from 'react'
import { Em } from '../../components/emoji'

const glass = 'border-2 border-white bg-white/85 shadow-soft backdrop-blur-md'
const CARS = [
  { id: 'car1', emoji: '🚗', name: 'Pembe Cabrio', price: 12000 },
  { id: 'car2', emoji: '🚙', name: 'Şehir Arabası', price: 18000 },
]

export function useRental({ net, venue }) {
  const { on } = net
  const [coins, setCoins] = useState(0)
  const [until, setUntil] = useState(0)
  const [, tick] = useState(0)
  useEffect(() => {
    const offs = [
      on('welcome', (m) => (setCoins(m.coins ?? 0), setUntil(m.bikeUntil ?? 0))),
      on('coins', (m) => setCoins(m.n)),
      on('rental', (m) => setUntil(m.until)),
    ]
    return () => offs.forEach((off) => off())
  }, [on])
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 10000)
    return () => clearInterval(t)
  }, [])

  if (venue !== 'havalimani') return {}
  const left = Math.max(0, Math.ceil((until - Date.now()) / 60000))
  const canBike = coins >= 20
  const overlays = (
    <div className={`pointer-events-auto absolute right-3 top-[9.5rem] z-10 w-60 rounded-3xl p-3 ${glass}`}>
      <p className="px-1 text-sm font-black text-[#4a3b5c]">🔑 Kiralama</p>
      <div className="mt-2 flex items-center gap-3 rounded-2xl bg-[#eef8ff] px-3 py-2">
        <Em e="🚲" size={30} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-[#4a3b5c]">Bisiklet</p>
          <p className="text-[11px] font-semibold text-[#8a7a9c]">{left > 0 ? `Kirada · ${left} dk kaldı` : '45 dk · 🪙 20'}</p>
        </div>
        <button
          onClick={() => net.send({ t: 'rent', kind: 'bike' })}
          disabled={!canBike}
          className="rounded-full bg-[#ff7eb3] px-3 py-1 text-[11px] font-black text-white shadow transition active:scale-95 disabled:opacity-50"
        >
          {left > 0 ? 'Uzat' : 'Kirala'}
        </button>
      </div>
      {CARS.map((c) => (
        <div key={c.id} className="mt-2 flex items-center gap-3 rounded-2xl bg-[#f5f2fa] px-3 py-2">
          <Em e={c.emoji} size={30} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-[#4a3b5c]">{c.name}</p>
            <p className="text-[11px] font-semibold text-[#8a7a9c]">🪙 {c.price.toLocaleString('tr-TR')}</p>
          </div>
          <button
            onClick={() => net.send({ t: 'rent', kind: 'car' })}
            className="rounded-full bg-[#d9d2e6] px-3 py-1 text-[11px] font-black text-[#8a7a9c]"
            title="Bakiye yetersiz"
          >
            Yetersiz
          </button>
        </div>
      ))}
      <p className="mt-2 px-1 text-[11px] font-bold text-[#8a7a9c]">Bakiyen: 🪙 {coins}</p>
    </div>
  )
  return { overlays }
}
