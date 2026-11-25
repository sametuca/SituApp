// Altın göstergesi (üst çubukta 🪙 sayısı) ve kazanç bildirimi. Sunucu: server/features/economy.js.
import { useEffect, useState } from 'react'
import { Ico } from '../../components/Icon'

const glass = 'border-2 border-white bg-white/75 shadow-soft backdrop-blur-md'
const WHY = { dj: 'DJ kazancı', meetup: 'Buluşma', voley: 'Voleybol', kale: 'Kum kalesi', pet: '', ev: '', kira: '' }

export function useEconomy({ net }) {
  const { on } = net
  const [coins, setCoins] = useState(0)
  const [pops, setPops] = useState([]) // { k, d, why }

  useEffect(() => {
    const offs = [
      on('welcome', (m) => setCoins(m.coins ?? 0)),
      on('coins', (m) => {
        setCoins(m.n)
        if (m.d > 0) {
          const k = `${Date.now()}-${Math.random()}`
          setPops((p) => [...p.slice(-2), { k, d: m.d, why: m.why }])
          setTimeout(() => setPops((p) => p.filter((x) => x.k !== k)), 2600)
          window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
        }
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [on])

  const extraNodes = (
    <div className={`flex h-12 items-center gap-2 rounded-full px-4 text-base font-black text-[#4a3b5c] ${glass}`} title="Altın" aria-label={`${coins} altın`}>
      <Ico name="coins" size={24} /> <span className="tabular-nums">{coins}</span>
    </div>
  )

  const overlays =
    pops.length > 0 ? (
      <div className="pointer-events-none absolute right-3 top-[4.5rem] z-30 flex flex-col items-end gap-1">
        {pops.map((p) => (
          <div key={p.k} className="animate-pop rounded-full border-2 border-white bg-[#fff3c8] px-3.5 py-1 text-sm font-black text-[#8a5a00] shadow-soft">
            +{p.d} 🪙 {WHY[p.why] ?? ''}
          </div>
        ))}
      </div>
    ) : null

  return { extraNodes, overlays }
}
