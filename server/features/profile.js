// Profil, ilgi etiketleri ve buz kırıcı kartlar.
// Mesajlar: profile_save {profile} · profile {id} → profile {id, profile} · icebreaker {to} → icebreaker {id,name,qid,q,a,b}
//           icebreaker_answer {to, qid, pick:'a'|'b'} → gönderene icebreaker_answer {id,name,a,b,choice}
import { save, user } from '../store.js'

export const TAGS = [
  ['kahve', '☕', 'Kahve'],
  ['muzik', '🎵', 'Müzik'],
  ['kitap', '📚', 'Kitap'],
  ['film', '🎬', 'Film'],
  ['plaj', '🏖️', 'Plaj'],
  ['doga', '🌳', 'Doğa'],
  ['oyun', '🎮', 'Oyun'],
  ['dans', '💃', 'Dans'],
  ['yemek', '🍕', 'Yemek'],
  ['seyahat', '✈️', 'Seyahat'],
  ['hayvanlar', '🐶', 'Hayvanlar'],
  ['sanat', '🎨', 'Sanat'],
  ['spor', '🏋️', 'Spor'],
  ['karaoke', '🎤', 'Karaoke'],
  ['fotograf', '📸', 'Fotoğraf'],
  ['yoga', '🧘', 'Yoga'],
  ['gece', '🍷', 'Gece hayatı'],
  ['gecekusu', '🌙', 'Gece kuşu'],
  ['erken', '☀️', 'Erken kalkan'],
  ['tatli', '🍰', 'Tatlı'],
  ['podcast', '🎧', 'Podcast'],
  ['bulmaca', '🧩', 'Bulmaca'],
  ['bisiklet', '🚴', 'Bisiklet'],
  ['bahce', '🌸', 'Bahçe'],
].map(([id, emoji, label]) => ({ id, emoji, label }))
const TAG_IDS = new Set(TAGS.map((t) => t.id))

const QUESTIONS = [
  ['Plajda gün batımı mı?', 'Kulüpte gece mi?'],
  ['Sabah kahvesi mi?', 'Akşam çayı mı?'],
  ['Dağ evi mi?', 'Deniz kenarı mı?'],
  ['Film gecesi mi?', 'Dans gecesi mi?'],
  ['Sürpriz hediye mi?', 'El yazısı mektup mu?'],
  ['Pizza mı?', 'Tatlı mı?'],
  ['Yağmurda yürüyüş mü?', 'Yağmurda kitap mı?'],
  ['Kedi mi?', 'Köpek mi?'],
  ['Gün doğumu mu?', 'Gün batımı mı?'],
  ['Piknik mi?', 'Şık bir akşam yemeği mi?'],
  ['Karaoke mi?', 'Sessiz bir sohbet mi?'],
  ['Uzun bir sarılma mı?', 'Sıkı bir el tutuşma mı?'],
  ['Yaz mı?', 'Kış mı?'],
  ['Sabah kuşu mu?', 'Gece kuşu mu?'],
  ['Spontane kaçamak mı?', 'Planlı tatil mi?'],
  ['Çiçek mi?', 'Çikolata mı?'],
  ['Bisiklet turu mu?', 'Sahilde yürüyüş mü?'],
  ['Dondurma mı?', 'Sıcak çikolata mı?'],
  ['Eski şarkılar mı?', 'Yeni çıkanlar mı?'],
  ['Kitap mı?', 'Dizi mi?'],
  ['Kahkaha mı?', 'Gülümseme mi?'],
  ['Yıldızları izlemek mi?', 'Dalgaları dinlemek mi?'],
  ['Birlikte yemek yapmak mı?', 'Birlikte dışarıda yemek mi?'],
  ['Tatlı bir mesaj mı?', 'Sesli bir not mu?'],
  ['Ilık bir yaz yağmuru mu?', 'Karlı bir sabah mı?'],
  ['Çay bahçesi mi?', 'Kafe köşesi mi?'],
  ['Fotoğraf çekmek mi?', 'Fotoğrafta olmak mı?'],
  ['Oyun oynamak mı?', 'Yürüyüşe çıkmak mı?'],
  ['Hayvanat bahçesi mi?', 'Lunapark mı?'],
  ['İlk buluşmada kahve mi?', 'İlk buluşmada yürüyüş mü?'],
  ['Romantik komedi mi?', 'Macera filmi mi?'],
  ['Balonlu bir sürpriz mi?', 'Pastalı bir sürpriz mi?'],
  ['Tatlı bir takma ad mı?', 'Kendi adınla çağrılmak mı?'],
  ['Birlikte dans mı?', 'Birlikte şarkı söylemek mi?'],
]

const ICE_COOLDOWN_MS = 10_000
const ICE_TTL_MS = 5 * 60_000
const EMPTY = { bio: '', age: null, city: '', tags: [] }

export default function profile(ctx) {
  const { players, send, clean } = ctx
  const mod = () => ctx.features[0].api
  const info = (me, text) => send(me.ws, { t: 'info', text })
  const stored = (k) => user(k).profile ?? null

  /** Herkese açık profil (yalnızca bilinen alanlar). */
  const pub = (p) => (p ? { bio: String(p.bio ?? ''), age: p.age ?? null, city: String(p.city ?? ''), tags: (p.tags ?? []).filter((t) => TAG_IDS.has(t)) } : null)

  // "gönderen>alıcı" → { qid, ts }: yanıt bekleyen buz kırıcılar
  const pending = new Map()
  const pkey = (from, to) => `${from}>${to}`

  return {
    api: { publicProfile: (p) => pub(stored(p.key)) },
    welcome: (me) => ({ profile: pub(stored(me.key)), profileTags: TAGS }),
    onLeave(me) {
      for (const k of [...pending.keys()]) if (k.startsWith(`${me.id}>`) || k.endsWith(`>${me.id}`)) pending.delete(k)
    },
    handlers: {
      profile_save(me, msg) {
        const now = Date.now()
        if (now - (me.lastProfileSave ?? 0) < 1000) return info(me, 'Biraz yavaş, profilini az önce kaydettin.')
        const raw = msg.profile && typeof msg.profile === 'object' ? msg.profile : {}
        let age = null
        if (raw.age !== null && raw.age !== undefined && raw.age !== '') {
          age = Number(raw.age)
          if (!Number.isInteger(age) || age < 18 || age > 99) {
            send(me.ws, { t: 'profile_error', field: 'age' })
            return info(me, '🔞 SituApp yalnızca 18 yaş ve üzeri içindir. Yaşın 18–99 arasında olmalı.')
          }
        }
        me.lastProfileSave = now
        const tags = [...new Set(Array.isArray(raw.tags) ? raw.tags.filter((t) => typeof t === 'string' && TAG_IDS.has(t)) : [])].slice(0, 6)
        const bio = mod().censor(clean(String(raw.bio ?? '').slice(0, 400), 120))
        const city = mod().censor(clean(String(raw.city ?? '').slice(0, 100), 20))
        const p = { bio: bio.slice(0, 120), age, city: city.slice(0, 20), tags }
        user(me.key).profile = p
        save()
        send(me.ws, { t: 'profile_saved', profile: p })
      },

      profile(me, msg) {
        const now = Date.now()
        me.profileReqs = (me.profileReqs ?? []).filter((t) => now - t < 5000)
        if (me.profileReqs.length >= 10) return
        me.profileReqs.push(now)
        const id = typeof msg.id === 'string' ? msg.id.slice(0, 16) : ''
        const target = players.get(id)
        // engelli çift birbirinin profilini göremez (sezdirmeden boş döner)
        if (!target || (target.id !== me.id && mod().blockedPair(me, target))) return send(me.ws, { t: 'profile', id, profile: null })
        send(me.ws, { t: 'profile', id, profile: pub(stored(target.key)) ?? EMPTY })
      },

      icebreaker(me, msg) {
        const now = Date.now()
        if (now - (me.lastIce ?? 0) < ICE_COOLDOWN_MS) return info(me, '🧊 Biraz bekle, yeni bir buz kırıcı için birkaç saniye gerek.')
        const target = typeof msg.to === 'string' ? players.get(msg.to) : null
        if (!target || target.id === me.id || target.room !== me.room) return info(me, 'Bu kişi artık burada değil.')
        const why = mod().reach(me, target, 'icebreaker')
        if (why) return why.text && info(me, why.text)
        me.lastIce = now
        const qid = Math.floor(Math.random() * QUESTIONS.length)
        const [a, b] = QUESTIONS[qid]
        pending.set(pkey(me.id, target.id), { qid, ts: now })
        send(target.ws, { t: 'icebreaker', id: me.id, name: me.name, qid, q: 'Hangisi?', a, b })
        info(me, `🧊 ${target.name} kişisine buz kırıcı gönderildi.`)
      },

      icebreaker_answer(me, msg) {
        const sender = typeof msg.to === 'string' ? players.get(msg.to) : null
        const k = sender ? pkey(sender.id, me.id) : ''
        const pend = pending.get(k)
        if (!sender || !pend || pend.qid !== msg.qid || Date.now() - pend.ts > ICE_TTL_MS || (msg.pick !== 'a' && msg.pick !== 'b')) return
        pending.delete(k)
        if (sender.room !== me.room || mod().reach(me, sender, 'icebreaker')) return
        const [a, b] = QUESTIONS[pend.qid]
        send(sender.ws, { t: 'icebreaker_answer', id: me.id, name: me.name, a, b, choice: msg.pick === 'a' ? a : b })
      },
    },
  }
}
