// Kiralama: bisiklet her yerden kiralanır (🚲 düğmesi; Havalimanı salonunda da kart var), araba ASLA kiralanamaz (bakiye ne olursa olsun, hile yapılsa bile).
//   istemci → sunucu: { t: 'rent', kind: 'bike' | 'car' }
//   sunucu → istemci: { t: 'rental', kind: 'bike', until }  (kiralama başarılı)   welcome.bikeUntil, welcome.first (hesap yeni)
// Sunucu otoriter: bisikletsiz oyuncunun anim='ride' hareketi game.js'te idle'a çevrilir (me.bikeUntil).
// Yeni hesaba bir kez başlangıç altını verilir (bisiklet için yeter, araba için yetmez).
import { user, save } from '../store.js'
import { claimStarter } from '../guard.js'

export const RENT = {
  bike: { price: 0, ms: 45 * 60 * 1000, name: 'Bisiklet' },
  car: { price: 12000, name: 'Araba', available: false }, // available:false → hiçbir koşulda verilmez
}
export const STARTER_COINS = 100

export default function rental(ctx) {
  const { send } = ctx
  return {
    onJoin(me) {
      const u = user(me.key)
      me.bikeUntil = u.stats.bikeUntil ?? 0
      me.first = !u.stats.starter // hesap yeni mi: Havalimanı çıkış salonu yalnızca bir kez gösterilir
      if (!u.stats.starter) {
        u.stats.starter = 1
        save()
        if (claimStarter(me.ip)) ctx.addCoins?.(me, STARTER_COINS, 'hosgeldin')
      }
    },
    welcome: (me) => ({ bikeUntil: me.bikeUntil ?? 0, first: Boolean(me.first) }),
    handlers: {
      rent(me, msg) {
        const now = Date.now()
        if (now - (me.lastRent ?? 0) < 800) return
        me.lastRent = now
        const kind = msg.kind
        if (kind === 'car' || !RENT[kind]?.price || RENT[kind].available === false) {
          if (kind !== 'car') ctx.strike?.(me, 'geçersiz kiralama türü', 3) // arayüz yalnızca bike/car gönderir
          return send(me.ws, { t: 'info', text: '🚗 Araba kiralamak için yeterli bakiyen yok. Önce bisikletle şehri gez 😄' })
        }
        const it = RENT[kind]
        if (it.price > 0 && !ctx.spendCoins?.(me, it.price, 'kira')) return send(me.ws, { t: 'info', text: `🪙 ${it.name} için ${it.price} altın gerekiyor.` })
        const base = Math.max(now, me.bikeUntil ?? 0)
        me.bikeUntil = base + it.ms
        user(me.key).stats.bikeUntil = me.bikeUntil
        save()
        send(me.ws, { t: 'rental', kind, until: me.bikeUntil })
        send(me.ws, { t: 'info', text: '🚲 Bisikletin hazır! Şehirde B tuşuyla veya soldaki 🚲 düğmesiyle istediğin zaman binebilirsin.' })
        ctx.emitEvent?.(me, 'rent', 1)
      },
    },
  }
}
