// Ev kademeleri (istemci): ⚙️ menüsünde "🏡 Evini büyüt" satırı → kademe paneli. Sunucu: server/features/housing.js.
import { useEffect, useState } from 'react'
import { Modal } from '../Hud'
import { ToyButton } from '../../components/ui'
import { HOME_TIERS, MAX_TIER } from '../homeTiers'

export function useHousing({ net, home, panel, setPanel }) {
  const { on } = net
  const [coins, setCoins] = useState(0)
  useEffect(() => {
    const offs = [on('welcome', (m) => setCoins(m.coins ?? 0)), on('coins', (m) => setCoins(m.n))]
    return () => offs.forEach((off) => off())
  }, [on])

  const own = Boolean(home) && (!home.owner || home.owner === net.homeKey)
  const tier = net.homeTier ?? 0

  const menuNodes = own ? (
    <button onClick={() => setPanel('housing')} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm font-extrabold text-[#4a3b5c] transition hover:bg-[#fff0f6]">
      <span className="text-lg">{HOME_TIERS[tier].emoji}</span>
      <span className="flex-1">Evini büyüt</span>
      {tier < MAX_TIER && <span className="rounded-full bg-[#fff3c8] px-2 py-0.5 text-[11px] font-black text-[#8a5a00]">🪙 {HOME_TIERS[tier + 1].price}</span>}
    </button>
  ) : null

  const overlays =
    panel === 'housing' ? (
      <Modal onClose={() => setPanel(null)} label="Evini büyüt">
        <h2 className="text-xl font-black text-ink">🏡 Evini büyüt</h2>
        <p className="mt-1 text-sm font-semibold text-ink-soft">Evin şehirden bağımsız, sana özel bir dünya. Büyüdükçe daha fazla eşya koyabilirsin. Altını küçük işlerden (örn. kulüpte DJ olmak) kazanırsın.</p>
        <ul className="mt-4 flex flex-col gap-2">
          {HOME_TIERS.map((t, i) => {
            const state = i < tier ? 'done' : i === tier ? 'now' : i === tier + 1 ? 'next' : 'locked'
            return (
              <li key={t.id} className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-2 ${state === 'now' ? 'border-[#ff9fc6] bg-[#fff0f6]' : 'border-white bg-white/70'} ${state === 'locked' ? 'opacity-55' : ''}`}>
                <span className="text-2xl">{t.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-[#4a3b5c]">
                    {t.name} {state === 'now' && <span className="ml-1 rounded-full bg-[#ff7eb3] px-2 py-0.5 text-[10px] text-white">Evin</span>}
                  </p>
                  <p className="text-xs font-semibold text-[#8a7a9c]">
                    {t.desc} · en fazla {t.max} eşya
                  </p>
                </div>
                {state === 'done' && <span className="text-lg">✅</span>}
                {state === 'next' && <span className="text-xs font-black text-[#8a5a00]">🪙 {t.price}</span>}
              </li>
            )
          })}
        </ul>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="rounded-full bg-[#fff3c8] px-3 py-1 text-sm font-black text-[#8a5a00]">🪙 {coins}</span>
          {tier < MAX_TIER ? (
            <ToyButton onClick={() => net.send({ t: 'home_upgrade' })} disabled={coins < HOME_TIERS[tier + 1].price}>
              {coins < HOME_TIERS[tier + 1].price ? `${HOME_TIERS[tier + 1].price - coins} altın eksik` : `${HOME_TIERS[tier + 1].name}'a geç`}
            </ToyButton>
          ) : (
            <span className="text-sm font-extrabold text-[#8a7a9c]">En büyük kademedesin 🎉</span>
          )}
        </div>
      </Modal>
    ) : null

  return { menuNodes, overlays }
}
