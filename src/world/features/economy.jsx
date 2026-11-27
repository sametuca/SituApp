// Altın göstergesi (üst çubukta 🪙 sayısı) ve kazanç bildirimi. Sunucu: server/features/economy.js.
import { useEffect, useState } from 'react'

const glass = 'border-2 border-white bg-white/75 shadow-soft backdrop-blur-md'
const WHY = { dj: 'DJ kazancı', meetup: 'Buluşma', voley: 'Voleybol', kale: 'Kum kalesi', surf: 'Sörf yarışı', minigame: 'Mini oyun', boxing: 'Boks maçı', workout: 'Antrenman', fish: 'Balıkçılık', post: 'Postacılık', job_crop: 'Pazar', job_fish: 'Pazar', job_post: 'Teslimat', job_quest: 'Meslek görevi', duo: 'Ortak görev', pet: '', ev: '', kira: '' }

export function useEconomy({ net, touch }) {
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
    <div className={`flex h-12 items-center gap-1.5 rounded-full px-4 text-base font-black text-[#4a3b5c] ${glass}`} title="Türk Lirası (₺)" aria-label={`${coins} TL`}>
      <span className="text-lg font-black text-[#e8952c]">₺</span>
      <span className="tabular-nums">{coins}</span>
    </div>
  )

  const overlays =
    pops.length > 0 ? (
      <div className="pointer-events-none absolute right-3 top-[4.5rem] z-30 flex flex-col items-end gap-1">
        {pops.map((p) => (
          <div key={p.k} className="animate-pop rounded-full border-2 border-white bg-[#fff3c8] px-3.5 py-1 text-sm font-black text-[#8a5a00] shadow-soft">
            +{p.d} ₺ {WHY[p.why] ?? ''}
          </div>
        ))}
      </div>
    ) : null

  const menuNodes = (
    <div className={`flex items-center justify-between rounded-2xl bg-[#fff8ec] px-3 py-2 text-xs font-extrabold text-[#4a3b5c] ${touch ? '' : 'md:hidden'}`}>
      <span className="text-[#8a5a00]">Bakiyen</span>
      <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-black text-[#e8952c] shadow-sm">₺ {coins}</span>
    </div>
  )

  return { extraNodes, menuNodes, overlays }
}
