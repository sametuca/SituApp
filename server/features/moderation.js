// Güvenlik: engelleme, şikâyet, rahatsız etme (DND) ve mesaj denetimi.
// Çekirdek (game.js) bu modülün `api`sini her kişiye yönelik eylemden önce çağırır.
import { addReport, save, user } from '../store.js'
import { moderate } from '../profanity.js'

const REASONS = new Set(['taciz', 'spam', 'uygunsuz', 'sahte', 'diger'])
const RECENT_MAX = 12 // şikâyet bağlamı için tutulan son mesaj sayısı

export default function moderation(ctx) {
  const { players, send, broadcast } = ctx

  const api = {
    /** İki oyuncudan biri diğerini engellediyse true. */
    blockedPair: (a, b) => Boolean(a.blocks?.has(b.key) || b.blocks?.has(a.key)),

    /**
     * from → target bir eylem (dm | whisper | gesture | invite | chat) yapabilir mi?
     * Uygunsa null; değilse { text } (gönderene gösterilir) ya da { silent: true } (engellenen kişiye sezdirme).
     */
    reach(from, target, kind) {
      if (api.blockedPair(from, target)) return from.blocks.has(target.key) ? { text: `${target.name} engellenmiş.` } : { silent: true }
      if (target.dnd && kind !== 'chat') return { text: `🌙 ${target.name} şu an rahatsız edilmek istemiyor.` }
      return null
    },

    /** Küfür ve iletişim bilgisini maskeler. */
    censor: (text, opts) => moderate(text, opts).text,

    /** Şikâyet bağlamı için son mesajı kaydet. */
    remember(p, kind, text) {
      p.recent.push({ ts: Date.now(), kind, text })
      if (p.recent.length > RECENT_MAX) p.recent.shift()
    },
  }

  const blockList = (p) => Object.entries(user(p.key).blocks).map(([key, name]) => ({ key, name }))

  return {
    api,
    onJoin(me) {
      const u = user(me.key)
      u.name = me.name
      me.blocks = new Set(Object.keys(u.blocks))
      me.dnd = Boolean(u.dnd)
      me.recent = []
      save()
    },
    welcome: (me) => ({ blocked: blockList(me), dnd: me.dnd }),
    handlers: {
      block(me, msg) {
        const target = typeof msg.id === 'string' ? players.get(msg.id) : null
        if (!target || target.id === me.id) return
        const u = user(me.key)
        u.blocks[target.key] = target.name
        me.blocks.add(target.key)
        save()
        send(me.ws, { t: 'blocks', list: blockList(me) })
        send(me.ws, { t: 'info', text: `🚫 ${target.name} engellendi. Seni göremez ve sana ulaşamaz.` })
      },
      unblock(me, msg) {
        const key = typeof msg.key === 'string' ? msg.key : null
        const u = user(me.key)
        if (!key || !(key in u.blocks)) return
        delete u.blocks[key]
        me.blocks.delete(key)
        save()
        send(me.ws, { t: 'blocks', list: blockList(me) })
      },
      report(me, msg) {
        const now = Date.now()
        if (now - (me.lastReport ?? 0) < 5000) return send(me.ws, { t: 'info', text: 'Biraz bekle, az önce şikâyet gönderdin.' })
        const target = typeof msg.id === 'string' ? players.get(msg.id) : null
        if (!target || target.id === me.id) return
        me.lastReport = now
        const reason = REASONS.has(msg.reason) ? msg.reason : 'diger'
        addReport({ ts: now, from: me.key, fromName: me.name, target: target.key, targetName: target.name, reason, context: target.recent.slice(-RECENT_MAX) })
        send(me.ws, { t: 'info', text: '⚠️ Şikâyetin alındı, teşekkürler. İstersen kişiyi engelleyebilirsin.' })
      },
      dnd(me, msg) {
        me.dnd = Boolean(msg.on)
        user(me.key).dnd = me.dnd
        save()
        broadcast({ t: 'dnd', id: me.id, on: me.dnd }, undefined, me.room)
      },
    },
  }
}
