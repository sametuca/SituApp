// Kişiselleştirme: aksesuar, evcil hayvan, ev dekoru ve hediyeleşme.
//  - cos_set      aksesuar {id,color} / evcil hayvan seçimi (kalıcı: store.user(key).cosmetics); odaya `cos` olarak yayılır
//  - decor_set/get ev dekoru (duvar, desen, zemin, romantik ışık); yalnızca ev sahibi yazar, kalıcı: homes.json
//  - gift_send/reply  hediye: ≤ 8 m, aynı oda, engel/DND denetimi; kabulde alıcının `gifts` envanterine düşer
import crypto from 'node:crypto'
import { save, user } from '../store.js'
import { getDecor, setDecor, setGiftResolver } from '../homes.js'
import { sanitizeLook } from '../../src/world/lookData.js'
import { GIFT_BY_ID, GIFT_RANGE, sanitizeCos } from '../../src/world/cosmeticsData.js'

const OFFER_TTL_MS = 90_000
const MAX_GIFTS = 60 // envanter sınırı
const MAX_OPEN_FROM_ME = 3 // aynı anda bekleyen giden teklif
const MAX_OPEN_TO_YOU = 5 // bir kişiye aynı anda bekleyen gelen teklif (spam sınırı)

const giftList = (key) => user(key).gifts.map((g) => ({ uid: g.uid, kind: g.kind, from: g.from, ts: g.ts }))
const savedCos = (key) => {
  const c = user(key).cosmetics ?? {}
  return sanitizeCos({ acc: c.accessory, pet: c.pet })
}

export default function cosmetics(ctx) {
  const { players, send, broadcast } = ctx
  const mod = () => ctx.features[0].api // moderasyon her zaman ilk modül (ctx.features sonradan atanır)
  const offers = new Map() // teklif id → { from, fromKey, fromName, to, kind, ts }

  // ev düzenine yerleştirilen hediye gerçekten sahibinin envanterinde mi? (homes.js sanitizeItems çağırır)
  setGiftResolver((homeKey, uid, id) => {
    const g = user(homeKey).gifts.find((x) => x.uid === uid && x.kind === id)
    return g ? { from: g.from } : null
  })

  const dropOffers = (pred) => {
    for (const [id, o] of offers) if (pred(o)) offers.delete(id)
  }
  const sweep = setInterval(() => {
    const now = Date.now()
    dropOffers((o) => now - o.ts > OFFER_TTL_MS)
  }, 15_000)
  sweep.unref?.()

  const open = (pred) => [...offers.values()].filter(pred).length

  return {
    onJoin(me) {
      const c = savedCos(me.key)
      me.cos = { acc: c.acc ?? null, pet: c.pet ?? null, look: user(me.key).character?.look ?? null }
    },
    onLeave(me) {
      dropOffers((o) => o.from === me.id || o.to === me.id)
    },
    welcome: (me) => ({
      cos: me.cos,
      gifts: giftList(me.key),
      decor: getDecor(me.homeKey),
    }),
    handlers: {
      // renk değişimi (saç/göz/kıyafet): avatar kimliği değişmez, yalnızca palet indeksleri
      look_set(me, msg) {
        const now = Date.now()
        if (now - (me.lastLook ?? 0) < 800) return
        me.lastLook = now
        const u = user(me.key)
        if (!u.character) return
        u.character.look = sanitizeLook(msg.look)
        me.cos = { ...me.cos, look: u.character.look }
        save()
        broadcast({ t: 'cos', id: me.id, cos: me.cos }, undefined, me.room)
      },

      cos_set(me, msg) {
        const now = Date.now()
        if (now - (me.lastCos ?? 0) < 400) return
        me.lastCos = now
        const c = sanitizeCos(msg)
        if (c.pet && !ctx.petActive?.(me)) {
          delete c.pet // evcil hayvan süresi bitti (features/pets.js)
          send(me.ws, { t: 'info', text: '🐾 Evcil hayvan süren bitti. Gardırop’tan 1 hafta daha ekleyebilirsin.' })
        }
        if (!('acc' in c) && !('pet' in c)) return
        me.cos = { ...me.cos, ...c }
        const u = user(me.key)
        u.cosmetics = { accessory: me.cos.acc, pet: me.cos.pet }
        save()
        broadcast({ t: 'cos', id: me.id, cos: me.cos }, undefined, me.room)
      },

      decor_set(me, msg) {
        const now = Date.now()
        if (now - (me.lastDecor ?? 0) < 250) return
        me.lastDecor = now
        const decor = setDecor(me.homeKey, me.name, msg.decor) // yalnızca kendi evin: anahtar sunucudaki kimlikten gelir
        broadcast({ t: 'decor', owner: me.homeKey, decor }, undefined, `home:${me.homeKey}`)
      },
      decor_get(me, msg) {
        // yalnızca bulunduğun evin dekorunu okuyabilirsin (girmeye iznin yoksa oda değişmez, dolayısıyla veremeyiz)
        const owner = typeof msg.owner === 'string' ? ctx.homeKey(msg.owner) : null
        if (!owner || me.room !== `home:${owner}`) return
        send(me.ws, { t: 'decor', owner, decor: getDecor(owner) })
      },

      gift_send(me, msg) {
        const now = Date.now()
        if (now - (me.lastGift ?? 0) < 2500) return send(me.ws, { t: 'info', text: '🎁 Biraz bekle, az önce bir hediye gönderdin.' })
        const gift = typeof msg.kind === 'string' ? GIFT_BY_ID[msg.kind] : null
        const target = typeof msg.to === 'string' ? players.get(msg.to) : null
        if (!gift) return
        if (!target || target.id === me.id || target.room !== me.room) return send(me.ws, { t: 'info', text: 'Bu kişi artık burada değil.' })
        if (ctx.dist(me, target) > GIFT_RANGE) return send(me.ws, { t: 'info', text: `🎁 ${target.name} çok uzakta, hediye vermek için biraz yaklaş.` })
        const why = mod().reach(me, target, 'gift')
        if (why) {
          if (why.text) send(me.ws, { t: 'info', text: why.text })
          return
        }
        if (open((o) => o.from === me.id) >= MAX_OPEN_FROM_ME) return send(me.ws, { t: 'info', text: '🎁 Bekleyen hediyelerin var, cevap gelmesini bekle.' })
        if (open((o) => o.from === me.id && o.to === target.id)) return send(me.ws, { t: 'info', text: `🎁 ${target.name} önceki hediyene henüz cevap vermedi.` })
        if (open((o) => o.to === target.id) >= MAX_OPEN_TO_YOU) return send(me.ws, { t: 'info', text: `🎁 ${target.name} şu an çok fazla hediye bekliyor, sonra dene.` })
        me.lastGift = now
        const offer = crypto.randomUUID().slice(0, 8)
        offers.set(offer, { from: me.id, fromKey: me.key, fromName: me.name, to: target.id, kind: gift.id, ts: now })
        send(target.ws, { t: 'gift_offer', offer, from: me.id, fromName: me.name, kind: gift.id })
        send(me.ws, { t: 'info', text: `🎁 ${target.name} kişisine ${gift.emoji} ${gift.name} gönderildi, cevap bekleniyor.` })
      },
      gift_reply(me, msg) {
        const o = typeof msg.offer === 'string' ? offers.get(msg.offer) : null
        if (!o || o.to !== me.id) return
        offers.delete(msg.offer)
        const sender = players.get(o.from)
        const gift = GIFT_BY_ID[o.kind]
        if (!msg.accept) {
          if (sender && !mod().blockedPair(me, sender)) send(sender.ws, { t: 'info', text: `🎁 ${me.name} hediyeyi şimdilik almadı.` })
          return
        }
        if (me.blocks?.has(o.fromKey) || sender?.blocks?.has(me.key)) return
        const u = user(me.key)
        if (u.gifts.length >= MAX_GIFTS) return send(me.ws, { t: 'info', text: '🎁 Hediye kutun dolu. Önce birkaç hediyeyi evine yerleştir.' })
        u.gifts.push({ uid: `g${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`, kind: o.kind, from: o.fromName, ts: Date.now() })
        save()
        ctx.emitEvent?.(sender ?? me, 'gift', 1, me)
        send(me.ws, { t: 'gifts', list: giftList(me.key) })
        send(me.ws, { t: 'info', text: `🎁 ${gift.emoji} ${gift.name} envanterine eklendi (${o.fromName}). Evinde Döşe → Hediyeler’den yerleştirebilirsin.` })
        if (sender) {
          send(sender.ws, { t: 'info', text: `🥰 ${me.name} hediyeni kabul etti: ${gift.emoji} “teşekkür ederim!”` })
          broadcast({ t: 'react', id: me.id, e: '🥰' }, undefined, me.room, me)
        }
      },
    },
  }
}
