// Asenkron izler: çevrimdışı arkadaşa bırakılan hediye paketleri (notlu) ve "arkadaşın şimdi şurada" sinyalleri.
// Mesaj kutusu (mail_*) friends.js'te; burada paketler ve canlı sinyal var.
// İstemci → sunucu: { t: 'parcel_send', key, kind, note? } (yalnızca arkadaşa, 15 🪙, günde ≤ 5) · { t: 'parcel_open', id } · { t: 'parcel_get' }
// Sunucu → istemci: { t: 'parcels', list: [{ id, name, kind, note, ts }] } · { t: 'parcel_new', from, kind } · { t: 'parcel_sent', ok, text }
//   { t: 'friend_active', key, name, where } (arkadaşın bir mekâna girdi) · welcome.parcels
// Kalıcı: store.user(key).parcels (bekleyen paketler; açılınca user.gifts'e düşer).
import crypto from 'node:crypto'
import { hasUser, save, user } from '../store.js'
import { GIFT_BY_ID } from '../../src/world/cosmeticsData.js'
import { VENUE_BY_ID, isVenueRoom, venueIdOf } from '../../src/world/venues.js'

const PRICE = 15
const PER_DAY = 5
const PENDING_MAX = 10
const PENDING_PER_SENDER = 2
const GIFTS_MAX = 60
const SIGNAL_GAP_MS = 5 * 60_000

export default function away(ctx) {
  const { players, send } = ctx
  const mod = () => ctx.features[0].api
  const info = (me, text) => send(me.ws, { t: 'info', text })
  const online = (key) => [...players.values()].find((p) => p.key === key)
  const signaled = new Map() // "<alıcı>><arkadaş>" → ts
  const listOf = (key) => (user(key).parcels ??= []).map(({ id, name, kind, note, ts }) => ({ id, name, kind, note, ts }))
  const push = (key) => {
    const p = online(key)
    if (p) send(p.ws, { t: 'parcels', list: listOf(key) })
  }
  const isFriends = (a, b) => Boolean(user(a).friends?.[b] && user(b).friends?.[a])

  return {
    welcome: (me) => ({ parcels: listOf(me.key) }),

    // arkadaşım bir mekâna girdi → çevrimiçi arkadaşlarına sessiz sinyal
    onRoomChange(me) {
      setTimeout(() => {
        if (!players.has(me.id) || !isVenueRoom(me.room)) return
        const where = VENUE_BY_ID[venueIdOf(me.room)]?.name
        if (!where) return
        const now = Date.now()
        for (const p of players.values()) {
          if (p === me || p.key === me.key || p.dnd || !isFriends(me.key, p.key) || mod().blockedPair(me, p)) continue
          const gk = `${p.key}>${me.key}`
          if (now - (signaled.get(gk) ?? 0) < SIGNAL_GAP_MS) continue
          signaled.set(gk, now)
          if (signaled.size > 5000) for (const [k, t] of signaled) if (now - t > SIGNAL_GAP_MS) signaled.delete(k)
          send(p.ws, { t: 'friend_active', key: me.key, name: me.name, where })
        }
      }, 400)
    },

    handlers: {
      parcel_get(me) {
        send(me.ws, { t: 'parcels', list: listOf(me.key) })
      },

      parcel_send(me, msg) {
        const now = Date.now()
        if (now - (me.lastParcel ?? 0) < 2000) return
        me.lastParcel = now
        const fail = (text) => send(me.ws, { t: 'parcel_sent', ok: false, text })
        const key = typeof msg.key === 'string' ? msg.key.slice(0, 40) : ''
        const gift = typeof msg.kind === 'string' ? GIFT_BY_ID[msg.kind] : null
        if (!gift || !key || key === me.key || !hasUser(key)) return fail('Bu hediye gönderilemedi.')
        if (!isFriends(me.key, key)) return fail('Paket yalnızca arkadaşlarına bırakılabilir.')
        const target = online(key)
        if (user(key).blocks?.[me.key] || user(me.key).blocks?.[key] || (target && mod().blockedPair(me, target))) return fail('Bu kişiye hediye bırakamazsın.')
        const u = user(me.key)
        u.stats ??= {}
        const day = new Date().toISOString().slice(0, 10)
        const pd = (u.stats.parcelDay = u.stats.parcelDay?.d === day ? u.stats.parcelDay : { d: day, n: 0 })
        if (pd.n >= PER_DAY) return fail(`Günde en çok ${PER_DAY} paket bırakabilirsin.`)
        const tu = user(key)
        tu.parcels ??= []
        if (tu.parcels.length >= PENDING_MAX) return fail('Kutusu dolu, biraz sonra dene.')
        if (tu.parcels.filter((p) => p.fromKey === me.key).length >= PENDING_PER_SENDER) return fail('Önceki paketlerini henüz açmamış.')
        if (!ctx.spendCoins?.(me, PRICE, 'parcel')) return fail(`Paket için ${PRICE} 🪙 gerekir.`)
        const note = mod().censor(ctx.clean(String(msg.note ?? '').slice(0, 200), 80))
        pd.n++
        tu.parcels.push({ id: crypto.randomUUID().slice(0, 8), fromKey: me.key, name: me.name, kind: gift.id, note, ts: now })
        save()
        send(me.ws, { t: 'parcel_sent', ok: true, text: `📦 ${gift.emoji} ${gift.name} ${tu.name ?? 'arkadaşın'} için bırakıldı.` })
        if (target) {
          if (!target.dnd) send(target.ws, { t: 'parcel_new', from: me.name, kind: gift.id })
          push(key)
        }
      },

      parcel_open(me, msg) {
        const u = user(me.key)
        const i = (u.parcels ??= []).findIndex((p) => p.id === msg.id)
        if (i < 0) return
        if ((u.gifts ??= []).length >= GIFTS_MAX) return info(me, '🎁 Hediye kutun dolu. Önce birkaç hediyeyi evine yerleştir.')
        const [p] = u.parcels.splice(i, 1)
        u.gifts.push({ uid: `g${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`, kind: p.kind, from: p.name, ts: Date.now() })
        save()
        const g = GIFT_BY_ID[p.kind]
        send(me.ws, { t: 'gifts', list: u.gifts.map((x) => ({ uid: x.uid, kind: x.kind, from: x.from, ts: x.ts })) })
        send(me.ws, { t: 'parcels', list: listOf(me.key) })
        info(me, `🎁 ${g?.emoji ?? ''} ${g?.name ?? 'Hediye'} envanterine eklendi (${p.name}).`)
        ctx.emitEvent?.(me, 'gift_open', 1, p.fromKey)
        const s = online(p.fromKey)
        if (s) info(s, `🥰 ${me.name} bıraktığın hediyeyi açtı: ${g?.emoji ?? ''}`)
      },
    },
  }
}
