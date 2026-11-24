// Altın ekonomisi (küçük işlerden kazanılır; mağaza/harcama sonraki adım). Kalıcı: store.user(key).stats.coins.
// Diğer modüller: ctx.addCoins?.(oyuncu, n, sebep) → yeni bakiye. Oyuncu bağlıysa { t:'coins', n, d, why } gönderilir.
//   istemci → sunucu: { t: 'coins_get' }     sunucu → istemci: { t: 'coins', n: bakiye, d: değişim, why } ; welcome.coins
import { save, user } from '../store.js'

const MAX_COINS = 1_000_000

export default function economy(ctx) {
  const { players, send } = ctx

  const coinsOf = (key) => (key ? (user(key).stats.coins ?? 0) : 0)

  ctx.coinsOf = coinsOf
  ctx.addCoins = (who, amount, why = '') => {
    const d = Math.trunc(amount)
    if (!who?.key || !Number.isFinite(d) || d === 0) return coinsOf(who?.key)
    const u = user(who.key)
    u.stats.coins = Math.min(MAX_COINS, Math.max(0, (u.stats.coins ?? 0) + d))
    save()
    const p = who.ws ? who : [...players.values()].find((o) => o.key === who.key)
    if (p) send(p.ws, { t: 'coins', n: u.stats.coins, d, why })
    return u.stats.coins
  }

  /** Altın harcar; yetmezse false döner (bakiye değişmez). */
  ctx.spendCoins = (who, amount, why = '') => {
    const n = Math.trunc(amount)
    if (!who?.key || !Number.isFinite(n) || n < 0) return false
    if (coinsOf(who.key) < n) return false
    if (n > 0) ctx.addCoins(who, -n, why)
    return true
  }

  return {
    welcome: (me) => ({ coins: coinsOf(me.key) }),
    handlers: {
      coins_get(me) {
        send(me.ws, { t: 'coins', n: coinsOf(me.key), d: 0, why: '' })
      },
    },
  }
}
