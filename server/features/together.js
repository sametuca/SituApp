// Birlikte yapılan şeyler: oturma (banklar/şezlonglar/sandalyeler) ve çift dans.
// Sunucu otoriterdir: koltuk doluluğu, mesafe, engel/DND ve hız sınırı burada denetlenir.
// (Fotoğraf kabini ve gün batımı anı yalnızca istemcidedir: src/world/features/together.jsx.)
//
// İstemci → sunucu
//   { t: 'sit', seat, slot }          koltuğa otur (şehirde, ≤ 2.6 m)
//   { t: 'pose_end' }                 kalk / dansı bırak
//   { t: 'poses' }                    odadaki herkesin oturma/dans durumunu iste
//   { t: 'dance_invite', to }         dansa davet (≤ 6 m)
//   { t: 'dance_reply', id, accept }  gelen daveti yanıtla
// Sunucu → istemci
//   { t: 'pose', id, pose|null }      birinin duruşu değişti. pose: { kind: 'sit', style, seat, slot, x, z, ry }
//                                     | { kind: 'dance', mate, lead, x, z, ry, cx, cz, dur }
//   { t: 'poses', list: [{ id, pose }] }
//   { t: 'dance_offer', id, name, avatar, ttl } / { t: 'dance_cancel', id }
//   { t: 'sit_pair', id, name, avatar }   bankta yan yana oturdun
import { SEATS } from '../../src/world/layout.js'

const SEAT_BY_ID = new Map(SEATS.map((s) => [s.id, s]))
const SIT_RANGE = 2.6 // m: koltuğa bu kadar yakın olmalısın
const DANCE_RANGE = 6 // m
const DANCE_GAP = 0.55 // dansçıların orta noktadan uzaklığı
const OFFER_TTL = 20000
const DANCE_MS = 15000
const GRACE_MS = 900 // duruş başlayınca eski konumlu 'move' paketleri duruşu bozmasın
const LEAVE_DIST = 0.7 // duruş konumundan bu kadar uzaklaşan 'move' duruşu bitirir

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

export default function together(ctx) {
  const { players, send, broadcast, dist } = ctx
  const mod = () => ctx.features[0].api
  const info = (p, text) => send(p.ws, { t: 'info', text })

  const taken = new Map() // 'seat:slot' → oyuncu id
  const offers = new Map() // hedef id → { from, timer }  (hedef başına tek bekleyen teklif)
  const offerOf = new Map() // gönderen id → hedef id    (gönderen başına tek açık teklif)

  const publicPose = (pose) => pose
  const announce = (p) => broadcast({ t: 'pose', id: p.id, pose: p.pose ? publicPose(p.pose) : null }, undefined, p.room, p)

  function endPose(p) {
    const pose = p.pose
    if (!pose) return
    p.pose = null
    clearTimeout(p.poseTimer)
    if (pose.kind === 'sit') taken.delete(`${pose.seat}:${pose.slot}`)
    if (pose.kind === 'dance') {
      const mate = players.get(pose.mate)
      if (mate?.pose?.kind === 'dance' && mate.pose.mate === p.id) endPose(mate)
    }
    announce(p)
    // koltuktan kalkınca yanındakinin "yan yana" durumu değişir; ek iş gerekmez
  }

  function clearOffers(id) {
    const incoming = offers.get(id)
    if (incoming) {
      clearTimeout(incoming.timer)
      offers.delete(id)
      offerOf.delete(incoming.from)
    }
    const to = offerOf.get(id)
    if (to) {
      const o = offers.get(to)
      if (o?.from === id) {
        clearTimeout(o.timer)
        offers.delete(to)
        const target = players.get(to)
        if (target) send(target.ws, { t: 'dance_cancel', id })
      }
      offerOf.delete(id)
    }
  }

  function startPose(p, pose) {
    p.pose = pose
    p.poseGrace = Date.now() + GRACE_MS
    p.x = pose.x
    p.z = pose.z
    p.ry = pose.ry
    p.anim = 'idle'
    p.dirty = true
  }

  const handlers = {
    sit(me, msg) {
      const now = Date.now()
      if (now - (me.lastSit ?? 0) < 500) return
      me.lastSit = now
      if (me.room !== 'city' || me.pose) return
      const seat = SEAT_BY_ID.get(String(msg.seat))
      const slotIdx = Number.isInteger(msg.slot) ? msg.slot : -1
      const slot = seat?.slots[slotIdx]
      if (!slot) return
      if (Math.hypot(me.x - slot.x, me.z - slot.z) > SIT_RANGE) return info(me, 'Biraz yaklaş, sonra otur 🪑')
      if (taken.has(`${seat.id}:${slotIdx}`)) return info(me, 'Bu yer dolu.')
      // yanındaki koltukta seni engelleyen/engellediğin biri varsa yer "dolu" görünür (sebep sezdirilmez)
      const neighbours = seat.slots.map((_, k) => players.get(taken.get(`${seat.id}:${k}`))).filter((o) => o && o.id !== me.id)
      if (neighbours.some((o) => mod().blockedPair(me, o))) return info(me, 'Bu yer dolu.')

      taken.set(`${seat.id}:${slotIdx}`, me.id)
      startPose(me, { kind: 'sit', style: seat.kind, seat: seat.id, slot: slotIdx, x: slot.x, z: slot.z, ry: +seat.ry.toFixed(3) })
      announce(me)

      // yan yana oturanlar: ikisine 💞 ve "Sohbet et" kısayolu (engel/DND varsa sessiz)
      for (const o of neighbours) {
        if (mod().reach(me, o, 'gesture') || mod().reach(o, me, 'gesture')) continue
        send(me.ws, { t: 'sit_pair', id: o.id, name: o.name, avatar: o.avatar })
        send(o.ws, { t: 'sit_pair', id: me.id, name: me.name, avatar: me.avatar })
        broadcast({ t: 'react', id: me.id, e: '💞' }, undefined, me.room, me)
        broadcast({ t: 'react', id: o.id, e: '💞' }, undefined, me.room, o)
      }
    },

    pose_end(me) {
      const now = Date.now()
      if (now - (me.lastPoseEnd ?? 0) < 150) return
      me.lastPoseEnd = now
      endPose(me)
    },

    poses(me) {
      const now = Date.now()
      if (now - (me.lastPoses ?? 0) < 400) return
      me.lastPoses = now
      const list = []
      for (const o of players.values()) if (o.room === me.room && o.pose && (o.id === me.id || !mod().blockedPair(me, o))) list.push({ id: o.id, pose: publicPose(o.pose) })
      send(me.ws, { t: 'poses', list })
    },

    dance_invite(me, msg) {
      const now = Date.now()
      if (now - (me.lastDanceInvite ?? 0) < 1500) return
      me.lastDanceInvite = now
      const target = typeof msg.to === 'string' ? players.get(msg.to) : null
      if (!target || target.id === me.id || target.room !== me.room) return info(me, 'Bu kişi artık burada değil.')
      if (dist(me, target) > DANCE_RANGE) return info(me, `💃 ${target.name} çok uzakta, dansa davet için biraz yaklaş.`)
      const why = mod().reach(me, target, 'gesture')
      if (why) return why.text && info(me, why.text)
      if (me.pose || target.pose) return info(me, me.pose ? 'Önce şu anki duruşunu bitir (hareket et).' : `${target.name} şu an başka bir şeyle meşgul.`)
      const pending = offers.get(target.id)
      if (pending && pending.from !== me.id) return info(me, `${target.name} şu an başka bir davetle meşgul.`)
      clearOffers(me.id) // önceki açık teklifim varsa iptal
      const timer = setTimeout(() => {
        if (offers.get(target.id)?.timer !== timer) return
        offers.delete(target.id)
        offerOf.delete(me.id)
        send(target.ws, { t: 'dance_cancel', id: me.id })
        if (players.has(me.id)) info(me, `💃 ${target.name} davete yanıt vermedi.`)
      }, OFFER_TTL)
      offers.set(target.id, { from: me.id, timer })
      offerOf.set(me.id, target.id)
      send(target.ws, { t: 'dance_offer', id: me.id, name: me.name, avatar: me.avatar, ttl: OFFER_TTL })
      info(me, `💃 ${target.name} dansa davet edildi.`)
    },

    dance_reply(me, msg) {
      const now = Date.now()
      if (now - (me.lastDanceReply ?? 0) < 300) return
      me.lastDanceReply = now
      const offer = offers.get(me.id)
      if (!offer || offer.from !== msg.id) return info(me, 'Davetin süresi dolmuş.')
      clearTimeout(offer.timer)
      offers.delete(me.id)
      offerOf.delete(offer.from)
      const from = players.get(offer.from)
      if (!from) return info(me, 'Davet eden artık burada değil.')
      if (!msg.accept) return send(from.ws, { t: 'info', text: `🌙 ${me.name} şimdilik dans edemiyor.` })
      // kabul anında her şeyi yeniden denetle
      if (from.room !== me.room) return info(me, 'Davet eden artık burada değil.')
      if (dist(from, me) > DANCE_RANGE) return info(me, `💃 ${from.name} çok uzakta kaldı.`)
      if (mod().reach(from, me, 'gesture') || mod().reach(me, from, 'gesture')) return
      if (from.pose || me.pose) return info(me, 'Şu an dans başlatılamadı.')

      // orta noktada karşılıklı dur
      const cx = (from.x + me.x) / 2
      const cz = (from.z + me.z) / 2
      let ux = me.x - from.x
      let uz = me.z - from.z
      const len = Math.hypot(ux, uz) || 1
      ux /= len
      uz /= len
      if (len < 0.01) ux = 1
      const mk = (p, sign, mate, lead) => ({
        kind: 'dance',
        mate,
        lead,
        x: +(cx - ux * DANCE_GAP * sign).toFixed(2),
        z: +(cz - uz * DANCE_GAP * sign).toFixed(2),
        ry: +Math.atan2(ux * sign, uz * sign).toFixed(3),
        cx: +cx.toFixed(2),
        cz: +cz.toFixed(2),
        dur: DANCE_MS,
      })
      startPose(from, mk(from, 1, me.id, true))
      startPose(me, mk(me, -1, from.id, false))
      from.poseTimer = setTimeout(() => endPose(from), DANCE_MS)
      announce(from)
      announce(me)
      broadcast({ t: 'react', id: from.id, e: '💃' }, undefined, from.room, from)
      broadcast({ t: 'react', id: me.id, e: '💃' }, undefined, me.room, me)
    },
  }

  return {
    handlers,
    /** Çekirdeğin 'move' dalı çağırır: true dönerse konum güncellemesi yok sayılır. */
    onMove(me, x, z) {
      const pose = me.pose
      if (!pose) return false
      if (Date.now() < (me.poseGrace ?? 0)) return true
      if (Math.hypot(num(x) - pose.x, num(z) - pose.z) > LEAVE_DIST) {
        endPose(me)
        return false
      }
      return true
    },
    /** Oda değişmeden hemen önce (çekirdek changeRoom). */
    onRoomChange(me) {
      endPose(me)
      clearOffers(me.id)
    },
    onLeave(me) {
      endPose(me)
      clearOffers(me.id)
    },
  }
}
