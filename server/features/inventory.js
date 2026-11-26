// Oyuncu envanteri (içecekler, hediyeler) ve hediye/ısmarlama kabul akışı.
import crypto from 'node:crypto'
import { save, user } from '../store.js'

const MAX_INV = 30
const OFFER_TTL = 45_000
const STARTER_DRINK = {
  id: 'starter_lemonade',
  label: 'Buzlu Limonata',
  emoji: '🍹',
  style: 'drink',
  color: '#ffd95e',
  alcohol: false,
  from: 'Hoş Geldin İkramı',
}

export default function inventory(ctx) {
  const { players, send } = ctx
  const pending = new Map() // offerId → { fromId, fromKey, fromName, toId, item, expires }

  const invOf = (key) => {
    const u = user(key)
    if (!Array.isArray(u.stats.inv)) u.stats.inv = []
    if (!u.stats.starterDrinkGiven) {
      u.stats.starterDrinkGiven = true
      if (u.stats.inv.length === 0) {
        u.stats.inv.push({ uid: crypto.randomUUID().slice(0, 8), ...STARTER_DRINK })
        save()
      }
    }
    return u.stats.inv
  }

  const pushInv = (who) => {
    const p = who?.ws ? who : [...players.values()].find((o) => o.key === who?.key)
    if (p && p.ws.readyState === 1) send(p.ws, { t: 'inv_state', items: invOf(p.key) })
  }

  const addItem = (who, item) => {
    if (!who?.key || !item) return null
    const list = invOf(who.key)
    if (list.length >= MAX_INV) list.shift()
    const entry = {
      uid: crypto.randomUUID().slice(0, 8),
      id: String(item.id ?? 'item'),
      label: String(item.label ?? 'Eşya').slice(0, 40),
      emoji: String(item.emoji ?? '🎁').slice(0, 8),
      style: item.style ? String(item.style).slice(0, 16) : null,
      color: item.color ? String(item.color).slice(0, 16) : null,
      alcohol: Boolean(item.alcohol),
      from: item.from ? String(item.from).slice(0, 30) : null,
    }
    list.push(entry)
    save()
    pushInv(who)
    return entry
  }

  ctx.addInventoryItem = addItem

  setInterval(() => {
    const now = Date.now()
    for (const [oid, off] of pending) {
      if (now > off.expires) {
        pending.delete(oid)
        // Süresi dolan teklifi gönderene geri iade et
        addItem({ key: off.fromKey }, off.item)
      }
    }
  }, 10_000).unref?.()

  return {
    welcome: (me) => ({ inv: invOf(me.key) }),
    handlers: {
      inv_get(me) {
        pushInv(me)
      },
      inv_use(me, msg) {
        const list = invOf(me.key)
        const i = list.findIndex((x) => x.uid === msg.uid)
        if (i < 0) return
        const [item] = list.splice(i, 1)
        save()
        pushInv(me)
        send(me.ws, { t: 'inv_used', item })
      },
      inv_gift(me, msg) {
        const target = players.get(msg.toId)
        if (!target || target.id === me.id) return send(me.ws, { t: 'info', text: 'Hedef oyuncu şu an çevrimiçi değil.' })
        const list = invOf(me.key)
        const i = list.findIndex((x) => x.uid === msg.uid)
        if (i < 0) return
        const [item] = list.splice(i, 1)
        save()
        pushInv(me)
        const offerId = crypto.randomUUID().slice(0, 8)
        pending.set(offerId, {
          fromId: me.id,
          fromKey: me.key,
          fromName: me.name,
          toId: target.id,
          item,
          expires: Date.now() + OFFER_TTL,
        })
        send(target.ws, { t: 'gift_offer', offerId, fromId: me.id, fromName: me.name, item })
        send(me.ws, { t: 'info', text: `🎁 ${target.name} kişisine ${item.emoji} ${item.label} gönderildi — onayı bekleniyor!` })
      },
      gift_reply(me, msg) {
        const off = pending.get(msg.offerId)
        if (!off || off.toId !== me.id) return
        pending.delete(msg.offerId)
        const sender = players.get(off.fromId)
        if (msg.accept) {
          addItem(me, { ...off.item, from: off.fromName })
          send(me.ws, { t: 'info', text: `🎒 ${off.item.emoji} ${off.item.label} envanterine eklendi!` })
          if (sender) send(sender.ws, { t: 'info', text: `💗 ${me.name} gönderdiğin ${off.item.emoji} ${off.item.label} hediyesini kabul etti!` })
          ctx.emitEvent?.(me, 'gesture', 1, sender ?? off.fromKey)
        } else {
          addItem({ key: off.fromKey }, off.item)
          if (sender) send(sender.ws, { t: 'info', text: `${me.name} gönderdiğin ${off.item.emoji} ${off.item.label} hediyesini geri çevirdi; çantana iade edildi.` })
        }
      },
    },
  }
}
