// Ev kademeleri: garaj evi → stüdyo → müstakil ev → villa (src/world/homeTiers.js). Her ev ayrı bir oda olduğundan şehirde yer tutmaz.
//   istemci → sunucu: { t: 'home_upgrade' }     bir üst kademeye geç (altın harcar)
//   sunucu → istemci: { t: 'home_tier', owner, tier }   evin kademesi değişti (evdekilerin hepsine); welcome.homeTier; room.tier
import { HOME_TIERS, MAX_TIER } from '../../src/world/homeTiers.js'
import { getTier, setTier } from '../homes.js'

export default function housing(ctx) {
  const { send, broadcast } = ctx
  return {
    welcome: (me) => ({ homeTier: getTier(me.homeKey) }),
    handlers: {
      home_upgrade(me) {
        const now = Date.now()
        if (now - (me.lastUpgrade ?? 0) < 1500) return
        me.lastUpgrade = now
        const cur = getTier(me.homeKey)
        if (cur >= MAX_TIER) return send(me.ws, { t: 'info', text: '🏰 Evin zaten en büyük kademede.' })
        const next = HOME_TIERS[cur + 1]
        if (!ctx.spendCoins?.(me, next.price, 'ev')) return send(me.ws, { t: 'info', text: `🪙 ${next.name} için ${next.price} altın gerekiyor.` })
        const tier = setTier(me.homeKey, me.name, cur + 1)
        const msg = { t: 'home_tier', owner: me.homeKey, tier }
        send(me.ws, msg)
        broadcast(msg, me.id, `home:${me.homeKey}`)
        send(me.ws, { t: 'info', text: `${next.emoji} Evin ${next.name} oldu!` })
        ctx.emitEvent?.(me, 'home_upgrade', 1)
      },
    },
  }
}
