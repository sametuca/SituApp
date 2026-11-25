// Başlangıç ödülü ve yeni hesap bayrağı (bisiklet tüm oyunculara varsayılan olarak açıktır; kiralama yoktur).
//   welcome.first (hesap yeni mi → Havalimanı eğitim holü)
import { user, save } from '../store.js'
import { claimStarter } from '../guard.js'

export const STARTER_COINS = 100

export default function rental(ctx) {
  return {
    onJoin(me) {
      const u = user(me.key)
      me.first = !u.stats.starter // hesap yeni mi: Havalimanı çıkış salonu yalnızca bir kez gösterilir
      if (!u.stats.starter) {
        u.stats.starter = 1
        save()
        if (claimStarter(me.ip)) ctx.addCoins?.(me, STARTER_COINS, 'hosgeldin')
      }
    },
    welcome: (me) => ({ first: Boolean(me.first) }),
  }
}
