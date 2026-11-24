// Arkadaşlık, varlık (çevrimiçi/nerede/son görülme), çevrimdışı mesaj kutusu ve okundu bilgisi.
//
// Protokol:
//   istemci → sunucu
//     { t: 'friend_request', id }          oyuncuya arkadaşlık isteği (aynı odada, çevrimiçi)
//     { t: 'friend_answer', key, accept }  bana gelen isteği kabul et / reddet
//     { t: 'friend_remove', key }          arkadaşlıktan çıkar (iki taraftan)
//     { t: 'friend_goto', key }            arkadaşın yanına git (şehirdeyse konum döner)
//     { t: 'friends_get' }                 arkadaş/varlık özetini iste
//     { t: 'mail_send', key, text }        mesaj kutusuna mesaj bırak (≤ 140; arkadaş değilse günde 3)
//     { t: 'mail_get' } / { t: 'mail_read', id | all } / { t: 'mail_delete', id | all }
//     { t: 'read', to }                    özel sohbeti (DM) görüyorum: gönderene "okundu" iletilir
//   sunucu → istemci
//     { t: 'friends', list: [{ key, name, avatar, online, where, dnd, lastSeen }], requests: [{ key, name, ts }], unread }
//        (welcome mesajında `friendsInit` olarak da gelir)
//     { t: 'friend_request', key, name, avatar }   canlı istek kartı (hedef DND ise gönderilmez)
//     { t: 'friend_added', key, name } / { t: 'friend_online', key, name }
//     { t: 'goto', x, z, name }                    yanına ışınlan
//     { t: 'inbox', list: [{ id, key, name, text, ts, read }] }   mesaj kutusu
//     { t: 'mail_new', from, unread }              yeni mesaj bildirimi
//     { t: 'read', id, ts }                        id'li oyuncu özel sohbetini okudu
//
// Kalıcı veri: store.user(key).friends / .inbox / .lastSeen; yardımcı alanlar user.stats.friends içinde.
import crypto from 'node:crypto'
import { hasUser, save, user } from '../store.js'
import { ZONES } from '../../src/world/layout.js'
import { VENUE_BY_ID, isVenueRoom, venueIdOf } from '../../src/world/venues.js'

const MAX_FRIENDS = 100
const INBOX_MAX = 50
const REQUESTS_MAX = 20
const MAIL_MAX = 140
const MAIL_PER_SENDER = 10 // bir gönderenin bir kutuda bekleyebilecek mesajı
const STRANGER_MAIL_PER_DAY = 3
const REJECT_COOLDOWN_MS = 24 * 3600 * 1000
const ONLINE_NOTE_GAP_MS = 60 * 1000 // aynı kişi için "çevrimiçi oldu" bildirimi en sık dakikada bir

const inZone = (zn, x, z) => (zn.shape === 'circle' ? Math.hypot(x - zn.x, z - zn.z) <= zn.r : x >= zn.x0 && x <= zn.x1 && z >= zn.z0 && z <= zn.z1)
// layout.js'teki zoneAt ile aynı mantık (sunucu istemci düzenini paylaşıyor)
const whereIs = (p) => {
  if (isVenueRoom(p.room)) return VENUE_BY_ID[venueIdOf(p.room)]?.name ?? 'Mekânda'
  if (p.room !== 'city') return 'Evde'
  return ZONES.find((zn) => inZone(zn, p.x, p.z))?.name ?? 'Şehirde'
}
const dayKey = () => new Date().toISOString().slice(0, 10)
const shortId = () => crypto.randomUUID().slice(0, 8)
const keyOf = (v) => (typeof v === 'string' ? v.slice(0, 40) : '')

/** Yardımcı alanlar: user.stats.friends = { rejected: {anahtar: ts}, mailDay: {d, n}, avatar } */
const aux = (u) => {
  u.stats ??= {}
  u.stats.friends ??= { rejected: {}, mailDay: { d: '', n: 0 }, avatar: '' }
  return u.stats.friends
}

export default function friends(ctx) {
  const { players, send, clean } = ctx
  const mod = () => ctx.features[0].api
  const onlineOf = (key) => [...players.values()].find((p) => p.key === key)
  const notedAt = new Map() // "<alıcı>><arkadaş>" → ts

  const requestsOf = (u) => u.inbox.filter((i) => i.kind === 'request')
  const mailsOf = (u) => u.inbox.filter((i) => i.kind === 'mail')

  function snapshot(me) {
    const u = user(me.key)
    const list = Object.entries(u.friends).map(([key, name]) => {
      const o = onlineOf(key)
      const visible = o && !mod().blockedPair(me, o)
      const fu = hasUser(key) ? user(key) : null
      return {
        key,
        name: fu?.name || name,
        avatar: (o?.avatar ?? (fu ? aux(fu).avatar : '')) || 'zeynep',
        online: Boolean(visible),
        where: visible ? whereIs(o) : null,
        dnd: visible ? Boolean(o.dnd) : false,
        lastSeen: visible ? 0 : (fu?.lastSeen ?? 0),
      }
    })
    return {
      list,
      requests: requestsOf(u).map((r) => ({ key: r.key, name: r.name, ts: r.ts })),
      unread: mailsOf(u).filter((m) => !m.read).length,
    }
  }
  const push = (p) => p && send(p.ws, { t: 'friends', ...snapshot(p) })
  /** Bu anahtarın arkadaşı olan çevrimiçi herkese özeti yenile (varlık değişince). */
  const pushToFriendsOf = (key) => {
    for (const k of Object.keys(user(key).friends)) for (const p of players.values()) if (p.key === k) push(p)
  }

  const inboxMsg = (u) => ({ t: 'inbox', list: mailsOf(u).map(({ id, key, name, text, ts, read }) => ({ id, key, name, text, ts, read })) })
  const trimInbox = (u) => {
    while (u.inbox.length > INBOX_MAX) {
      const i = u.inbox.findIndex((m) => m.kind === 'mail')
      u.inbox.splice(i >= 0 ? i : 0, 1)
    }
  }

  function befriend(a, b) {
    const ua = user(a.key)
    const ub = user(b.key)
    ua.friends[b.key] = b.name
    ub.friends[a.key] = a.name
    ua.inbox = ua.inbox.filter((i) => !(i.kind === 'request' && i.key === b.key))
    ub.inbox = ub.inbox.filter((i) => !(i.kind === 'request' && i.key === a.key))
    save()
  }
  const blockedEither = (ka, kb) => Boolean(user(ka).blocks[kb] || user(kb).blocks[ka])

  return {
    api: { isFriend: (a, b) => Boolean(user(a.key).friends[b.key]) },

    onJoin(me) {
      const u = user(me.key)
      u.name = me.name
      u.lastSeen = Date.now()
      aux(u).avatar = me.avatar
      save()
      if ([...players.values()].some((p) => p !== me && p.key === me.key)) return // başka sekmeden zaten çevrimiçi
      const now = Date.now()
      for (const k of Object.keys(u.friends)) {
        for (const p of players.values()) {
          if (p.key !== k || p === me) continue
          if (mod().blockedPair(me, p) || !user(k).friends[me.key]) continue
          push(p)
          const gk = `${p.key}>${me.key}`
          if (!p.dnd && now - (notedAt.get(gk) ?? 0) > ONLINE_NOTE_GAP_MS) {
            notedAt.set(gk, now)
            send(p.ws, { t: 'friend_online', key: me.key, name: me.name })
          }
        }
      }
    },

    onLeave(me) {
      if ([...players.values()].some((p) => p.key === me.key)) return
      user(me.key).lastSeen = Date.now()
      save()
      pushToFriendsOf(me.key)
    },

    welcome: (me) => ({ friendsInit: snapshot(me) }),

    handlers: {
      friends_get(me) {
        const now = Date.now()
        if (now - (me.lastFriendsGet ?? 0) < 400) return
        me.lastFriendsGet = now
        push(me)
      },

      friend_request(me, msg) {
        const now = Date.now()
        if (now - (me.lastFriendReq ?? 0) < 2000) return
        me.lastFriendReq = now
        me.friendReqLog = (me.friendReqLog ?? []).filter((t) => now - t < 10 * 60 * 1000)
        if (me.friendReqLog.length >= 8) return send(me.ws, { t: 'info', text: 'Çok fazla istek gönderdin, biraz sonra tekrar dene.' })
        const target = typeof msg.id === 'string' ? players.get(msg.id) : null
        if (!target || target.id === me.id || target.room !== me.room) return send(me.ws, { t: 'info', text: 'Bu kişi artık burada değil.' })
        if (target.key === me.key) return
        const mu = user(me.key)
        const tu = user(target.key)
        if (mu.friends[target.key]) return send(me.ws, { t: 'info', text: `💗 ${target.name} zaten arkadaşın.` })
        // engel denetimi; DND'yi burada atlıyoruz (DND hedefe istek sessizce kutuya düşer)
        const why = mod().reach(me, target, 'chat')
        if (why) return why.text ? send(me.ws, { t: 'info', text: why.text }) : undefined
        if (Object.keys(mu.friends).length >= MAX_FRIENDS) return send(me.ws, { t: 'info', text: 'Arkadaş listen dolu.' })
        // karşı taraf zaten bana istek atmışsa: karşılıklı → doğrudan arkadaş
        if (requestsOf(mu).some((r) => r.key === target.key)) {
          if (Object.keys(tu.friends).length >= MAX_FRIENDS) return send(me.ws, { t: 'info', text: `${target.name} kişisinin arkadaş listesi dolu.` })
          me.friendReqLog.push(now)
          befriend(me, target)
          send(me.ws, { t: 'info', text: `💗 ${target.name} ile artık arkadaşsınız!` })
          send(target.ws, { t: 'info', text: `💗 ${me.name} ile artık arkadaşsınız!` })
          send(target.ws, { t: 'friend_added', key: me.key, name: me.name })
          push(me)
          push(target)
          return
        }
        if (requestsOf(tu).some((r) => r.key === me.key)) return send(me.ws, { t: 'info', text: `⏳ ${target.name} henüz cevap vermedi.` })
        me.friendReqLog.push(now)
        const rejectedAt = aux(tu).rejected[me.key]
        const ok = `💗 ${target.name} kişisine arkadaşlık isteği gönderildi.`
        if (rejectedAt && now - rejectedAt < REJECT_COOLDOWN_MS) return send(me.ws, { t: 'info', text: ok }) // sessizce yut
        if (requestsOf(tu).length >= REQUESTS_MAX) return send(me.ws, { t: 'info', text: ok })
        tu.inbox.push({ id: shortId(), kind: 'request', key: me.key, name: me.name, text: '', ts: now, read: false })
        trimInbox(tu)
        save()
        send(me.ws, { t: 'info', text: ok })
        if (!target.dnd) {
          send(target.ws, { t: 'friend_request', key: me.key, name: me.name, avatar: me.avatar })
          push(target)
        }
      },

      friend_answer(me, msg) {
        const key = keyOf(msg.key)
        const u = user(me.key)
        const req = requestsOf(u).find((r) => r.key === key)
        if (!req) return
        u.inbox = u.inbox.filter((i) => i !== req)
        const other = onlineOf(key)
        if (!msg.accept) {
          aux(u).rejected[key] = Date.now()
          save()
          return push(me)
        }
        if (blockedEither(me.key, key)) {
          save()
          return push(me)
        }
        if (Object.keys(u.friends).length >= MAX_FRIENDS || (hasUser(key) && Object.keys(user(key).friends).length >= MAX_FRIENDS)) {
          save()
          send(me.ws, { t: 'info', text: 'Arkadaş listesi dolu.' })
          return push(me)
        }
        befriend(me, { key, name: req.name })
        send(me.ws, { t: 'info', text: `💗 ${req.name} ile artık arkadaşsınız!` })
        push(me)
        if (other) {
          send(other.ws, { t: 'info', text: `💗 ${me.name} isteğini kabul etti!` })
          send(other.ws, { t: 'friend_added', key: me.key, name: me.name })
          push(other)
        }
      },

      friend_remove(me, msg) {
        const key = keyOf(msg.key)
        const u = user(me.key)
        if (!(key in u.friends)) return
        delete u.friends[key]
        if (hasUser(key)) delete user(key).friends[me.key]
        save()
        push(me)
        push(onlineOf(key))
      },

      friend_goto(me, msg) {
        const now = Date.now()
        if (now - (me.lastGoto ?? 0) < 1500) return
        me.lastGoto = now
        const key = keyOf(msg.key)
        if (!user(me.key).friends[key]) return
        const target = onlineOf(key)
        if (!target || mod().blockedPair(me, target)) return send(me.ws, { t: 'info', text: 'Arkadaşın şu an çevrimdışı.' })
        if (target.dnd) return send(me.ws, { t: 'info', text: `🌙 ${target.name} şu an rahatsız edilmek istemiyor.` })
        if (me.room !== 'city') return send(me.ws, { t: 'info', text: 'Önce dışarı çık, sonra arkadaşının yanına gidebilirsin.' })
        if (isVenueRoom(target.room)) return send(me.ws, { t: 'info', text: `${VENUE_BY_ID[venueIdOf(target.room)]?.emoji ?? '📍'} ${target.name} şu an ${whereIs(target)} içinde. Kapıdan girip yanına gidebilirsin.` })
        if (target.room !== 'city') return send(me.ws, { t: 'info', text: `🏠 ${target.name} evde. Davet isteyebilirsin.` })
        send(me.ws, { t: 'goto', x: target.x + 1.2, z: target.z + 1.2, name: target.name })
      },

      mail_send(me, msg) {
        const now = Date.now()
        if (now - (me.lastMail ?? 0) < 3000) return send(me.ws, { t: 'info', text: 'Biraz bekle, az önce mesaj bıraktın.' })
        const key = keyOf(msg.key)
        if (!key || key === me.key || !hasUser(key)) return send(me.ws, { t: 'info', text: 'Böyle bir kullanıcı bulunamadı.' })
        const raw = clean(msg.text, MAIL_MAX)
        const text = mod().censor(raw)
        if (!text) return
        const mu = user(me.key)
        const isFriend = key in mu.friends
        const a = aux(mu)
        if (!isFriend) {
          if (a.mailDay.d !== dayKey()) a.mailDay = { d: dayKey(), n: 0 }
          if (a.mailDay.n >= STRANGER_MAIL_PER_DAY) return send(me.ws, { t: 'info', text: `Arkadaş olmadığın kişilere günde en fazla ${STRANGER_MAIL_PER_DAY} mesaj bırakabilirsin.` })
        }
        const tu = user(key)
        const ghost = { key, name: tu.name || key, blocks: new Set(Object.keys(tu.blocks)), dnd: false }
        const why = mod().reach(me, ghost, 'chat')
        me.lastMail = now
        // engellediğim kişiye: sebebi söyle; beni engelleyene: sezdirmeden "bırakıldı" de
        if (why) return send(me.ws, { t: 'info', text: why.text ?? '💌 Mesaj bırakıldı.' })
        if (mailsOf(tu).filter((m) => m.key === me.key).length >= MAIL_PER_SENDER) return send(me.ws, { t: 'info', text: 'Bu kişinin kutusunda zaten çok mesajın bekliyor.' })
        mod().remember(me, 'mesaj kutusu', raw)
        if (!isFriend) a.mailDay.n += 1
        tu.inbox.push({ id: shortId(), kind: 'mail', key: me.key, name: me.name, text, ts: now, read: false })
        trimInbox(tu)
        save()
        send(me.ws, { t: 'info', text: `💌 ${ghost.name} için mesaj bırakıldı.` })
        const o = onlineOf(key)
        if (o && !o.dnd) {
          send(o.ws, { t: 'mail_new', from: me.name, unread: mailsOf(tu).filter((m) => !m.read).length })
          push(o)
        }
      },

      mail_get(me) {
        send(me.ws, inboxMsg(user(me.key)))
      },

      mail_read(me, msg) {
        const u = user(me.key)
        let changed = false
        for (const m of mailsOf(u)) {
          if (!m.read && (msg.all || m.id === msg.id)) {
            m.read = true
            changed = true
          }
        }
        if (!changed) return
        save()
        send(me.ws, inboxMsg(u))
        push(me)
      },

      mail_delete(me, msg) {
        const u = user(me.key)
        const before = u.inbox.length
        u.inbox = u.inbox.filter((i) => i.kind !== 'mail' || !(msg.all || i.id === msg.id))
        if (u.inbox.length === before) return
        save()
        send(me.ws, inboxMsg(u))
        push(me)
      },

      read(me, msg) {
        const target = typeof msg.to === 'string' ? players.get(msg.to) : null
        if (!target || target.id === me.id || target.room !== me.room) return
        const now = Date.now()
        me.readSent ??= new Map()
        if (now - (me.readSent.get(target.id) ?? 0) < 800) return
        me.readSent.set(target.id, now)
        if (mod().blockedPair(me, target)) return
        send(target.ws, { t: 'read', id: me.id, ts: now })
      },
    },
  }
}
