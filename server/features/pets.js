// Evcil hayvan süresi: yeni oyuncu ilk girişte 1 haftalık ücretsiz bir arkadaş seçer (kedi/köpek); süre bitince hayvan kalkar,
// "1 hafta daha" altınla yenilenir. Seçim/ödeme sunucuda; cosmetics.js cos_set pet'i yalnızca süre sürüyorsa kabul eder (ctx.petActive).
//   istemci → sunucu: { t:'pet_adopt', pet:'cat'|'dog' }  (yalnızca bir kez)    { t:'pet_renew' }  (PET_RENEW_PRICE 🪙, +7 gün)
//   sunucu → istemci: welcome.petUntil / welcome.petOffer ;  { t:'pet_until', until }
import { save, user } from '../store.js'
import { PET_RENEW_PRICE, PET_WEEK_MS } from '../../src/world/cosmeticsData.js'

const TRIAL = new Set(['cat', 'dog'])

export default function pets(ctx) {
  const { send, broadcast } = ctx
  const until = (key) => user(key).stats.petUntil ?? 0
  ctx.petActive = (me) => until(me.key) > Date.now()

  const setPet = (me, pet) => {
    me.cos = { ...(me.cos ?? { acc: null }), pet }
    const u = user(me.key)
    u.cosmetics = { accessory: me.cos.acc ?? null, pet }
    save()
    broadcast({ t: 'cos', id: me.id, cos: me.cos }, undefined, me.room)
    send(me.ws, { t: 'cos', id: me.id, cos: me.cos })
  }

  return {
    onJoin(me) {
      // süre bittiyse hayvan kalkar
      if (me.cos?.pet && !ctx.petActive(me)) {
        me.cos = { ...me.cos, pet: null }
        user(me.key).cosmetics = { accessory: me.cos.acc ?? null, pet: null }
        save()
      }
    },
    welcome: (me) => ({ petUntil: until(me.key), petOffer: !user(me.key).stats.petOffered }),
    handlers: {
      pet_adopt(me, msg) {
        const u = user(me.key)
        if (u.stats.petOffered || !TRIAL.has(msg.pet)) return
        u.stats.petOffered = 1
        u.stats.petUntil = Date.now() + PET_WEEK_MS
        setPet(me, msg.pet)
        send(me.ws, { t: 'pet_until', until: u.stats.petUntil })
        send(me.ws, { t: 'info', text: `${msg.pet === 'dog' ? '🐶' : '🐱'} Yeni arkadaşın 1 hafta boyunca seninle! Gardırop’tan değiştirebilirsin.` })
        ctx.emitEvent?.(me, 'pet_adopt', 1)
      },
      pet_renew(me) {
        const now = Date.now()
        if (now - (me.lastPetRenew ?? 0) < 1500) return
        me.lastPetRenew = now
        if (!ctx.spendCoins?.(me, PET_RENEW_PRICE, 'pet')) return send(me.ws, { t: 'info', text: `🪙 Evcil hayvan bakımı için ${PET_RENEW_PRICE} altın gerekiyor.` })
        const u = user(me.key)
        u.stats.petOffered = 1
        u.stats.petUntil = Math.max(now, u.stats.petUntil ?? 0) + PET_WEEK_MS
        save()
        send(me.ws, { t: 'pet_until', until: u.stats.petUntil })
        send(me.ws, { t: 'info', text: '🐾 Evcil hayvan süren 1 hafta uzadı!' })
      },
    },
  }
}
