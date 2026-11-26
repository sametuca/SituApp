// Profil, ilgi etiketleri ve buz kırıcı kartlar.
// Mesajlar: profile_save {profile} · profile {id} → profile {id, profile} · icebreaker {to} → icebreaker {id,name,qid,q,a,b}
//           icebreaker_answer {to, qid, pick:'a'|'b'} → gönderene icebreaker_answer {id,name,a,b,choice}
// Profil fotoğrafı (yalnızca Supabase modu, hesaplı oyuncu): istemci Storage'a `<uid>/<ad>.jpg` yükler, sonra
//   profile_photo {path|null} (dakikada 3) → profile_photo {ok, url|null} ; photo_privacy {who:'all'|'friends'} → photo_privacy {who}
//   Sunucu her izleyici için ayrı url hesaplar ve { t:'photo', key, url|null } yollar (welcome.photos: toplu). photo_hidden (moderasyon) → hiçbir yerde gösterilmez.
import { save, user } from '../store.js'
import * as supa from '../supa.js'
import { savePhotoPath } from '../auth.js'

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
const EMPTY = { bio: '', age: null, birthDate: '', city: '', instagram: '', x: '', socialPrivacy: 'all', instagramLocked: false, xLocked: false, tags: [] }
const HANDLE_RE = /^[a-zA-Z0-9._]{1,30}$/
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function ageFromBirthDate(s) {
  const m = DATE_RE.exec(String(s ?? '').trim())
  if (!m) return null
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  const now = new Date()
  let age = now.getUTCFullYear() - y
  if (now.getUTCMonth() + 1 < mo || (now.getUTCMonth() + 1 === mo && now.getUTCDate() < d)) age--
  return age
}

function cleanHandle(v) {
  const s = String(v ?? '').trim().replace(/^@+/, '').slice(0, 30)
  return s && HANDLE_RE.test(s) ? s : ''
}

export default function profile(ctx) {
  const { players, send, clean } = ctx
  const mod = () => ctx.features[0].api
  const info = (me, text) => send(me.ws, { t: 'info', text })
  const stored = (k) => user(k).profile ?? null

  /** Herkese açık profil (yalnızca bilinen alanlar; arkadaşlara özel sosyal hesaplar gizlenir). */
  const pub = (p, viewerKey = null, ownerKey = null) => {
    if (!p) return null
    const priv = p.socialPrivacy === 'friends' ? 'friends' : 'all'
    const canSeeSocials = priv === 'all' || (viewerKey && ownerKey && (viewerKey === ownerKey || Boolean(user(ownerKey).friends?.[viewerKey])))
    const instagram = String(p.instagram ?? '')
    const x = String(p.x ?? '')
    return {
      bio: String(p.bio ?? ''),
      age: p.age ?? null,
      birthDate: String(p.birthDate ?? ''),
      city: String(p.city ?? ''),
      instagram: canSeeSocials ? instagram : '',
      x: canSeeSocials ? x : '',
      socialPrivacy: priv,
      instagramLocked: !canSeeSocials && Boolean(instagram),
      xLocked: !canSeeSocials && Boolean(x),
      tags: (p.tags ?? []).filter((t) => TAG_IDS.has(t)),
    }
  }

  // "gönderen>alıcı" → { qid, ts }: yanıt bekleyen buz kırıcılar
  const pending = new Map()
  const pkey = (from, to) => `${from}>${to}`

  // ---- profil fotoğrafı ----
  const PHOTO_PATH_RE = (uid) => new RegExp(`^${uid}/[A-Za-z0-9._-]{1,80}$`)
  const onlineByKey = (k) => [...players.values()].find((p) => p.key === k)
  /** İzleyici (anahtar) → sahibin fotoğraf adresi ya da null (yok / gizli / engelli / "yalnızca arkadaşlarım"). */
  const photoUrlFor = (viewerKey, ownerKey) => {
    const o = onlineByKey(ownerKey)
    const u = hasStored(ownerKey)
    const path = o ? o.photo : u?.photo
    const hidden = o ? o.photoHidden : u?.photoHidden
    if (!path || hidden) return null
    if (viewerKey === ownerKey) return supa.photoUrl(path)
    if (u?.blocks?.[viewerKey] || user(viewerKey).blocks?.[ownerKey]) return null
    if (u?.photoPrivacy === 'friends' && !u.friends?.[viewerKey]) return null
    return supa.photoUrl(path)
  }
  const hasStored = (k) => (k ? user(k) : null)
  const pushPhoto = (ownerKey) => {
    for (const v of players.values()) send(v.ws, { t: 'photo', key: ownerKey, url: photoUrlFor(v.key, ownerKey) })
  }
  ctx.photoUrlFor = photoUrlFor
  ctx.photoRefresh = pushPhoto
  // moderasyon: photo_hidden / photo_path değişikliklerini (başka yerden, örn. yönetici) 5 dakikada bir al
  const refresher = setInterval(async () => {
    const uids = [...players.values()].filter((p) => p.uid).map((p) => p.uid)
    if (!supa.enabled || !uids.length) return
    try {
      const rows = await supa.select('profiles', `select=id,photo_path,photo_hidden&id=in.(${uids.join(',')})`)
      for (const r of rows) {
        const p = onlineByKey(r.id)
        if (!p || (p.photo === (r.photo_path ?? null) && p.photoHidden === (r.photo_hidden === true))) continue
        p.photo = r.photo_path ?? null
        p.photoHidden = r.photo_hidden === true
        Object.assign(user(p.key), { photo: p.photo, photoHidden: p.photoHidden })
        pushPhoto(p.key)
      }
    } catch {
      /* bir sonraki turda tekrar */
    }
  }, 5 * 60_000)
  refresher.unref()

  return {
    api: { publicProfile: (p, viewer) => pub(stored(p.key), viewer?.key ?? null, p.key), photoUrlFor },
    onJoin(me) {
      if (!me.uid) return
      const u = user(me.key)
      u.photo = me.photo
      u.photoHidden = me.photoHidden
      save()
      pushPhoto(me.key)
    },
    welcome(me) {
      const photos = {}
      for (const p of players.values()) {
        const url = photoUrlFor(me.key, p.key)
        if (url) photos[p.key] = url
      }
      return { profile: pub(stored(me.key), me.key, me.key), profileTags: TAGS, photos, photoPrivacy: user(me.key).photoPrivacy ?? 'all', photoEnabled: Boolean(me.uid) }
    },
    onLeave(me) {
      for (const k of [...pending.keys()]) if (k.startsWith(`${me.id}>`) || k.endsWith(`>${me.id}`)) pending.delete(k)
    },
    handlers: {
      profile_photo(me, msg) {
        if (!me.uid) return info(me, '📷 Fotoğraf için hesap gerekli.')
        const now = Date.now()
        me.photoReqs = (me.photoReqs ?? []).filter((t) => now - t < 60_000)
        if (me.photoReqs.length >= 3) return info(me, '📷 Biraz yavaş, dakikada en fazla 3 kez değiştirebilirsin.')
        me.photoReqs.push(now)
        const path = msg.path === null ? null : typeof msg.path === 'string' ? msg.path : undefined
        if (path === undefined || (path !== null && !PHOTO_PATH_RE(me.uid).test(path))) return send(me.ws, { t: 'profile_photo', ok: false })
        const apply = async () => {
          if (path && !(await supa.objectExists(path))) return send(me.ws, { t: 'profile_photo', ok: false })
          await savePhotoPath(me.uid, path)
          me.photo = path
          user(me.key).photo = path
          save()
          send(me.ws, { t: 'profile_photo', ok: true, url: photoUrlFor(me.key, me.key) })
          pushPhoto(me.key)
        }
        apply().catch((e) => {
          console.error('Fotoğraf kaydedilemedi:', e.message)
          send(me.ws, { t: 'profile_photo', ok: false })
        })
      },

      photo_privacy(me, msg) {
        if (msg.who !== 'all' && msg.who !== 'friends') return
        user(me.key).photoPrivacy = msg.who
        save()
        send(me.ws, { t: 'photo_privacy', who: msg.who })
        pushPhoto(me.key)
      },

      profile_save(me, msg) {
        const now = Date.now()
        if (now - (me.lastProfileSave ?? 0) < 1000) return info(me, 'Biraz yavaş, profilini az önce kaydettin.')
        const raw = msg.profile && typeof msg.profile === 'object' ? msg.profile : {}
        const birthRaw = String(raw.birthDate ?? '').trim()
        let birthDate = ''
        let age = null
        if (birthRaw) {
          age = ageFromBirthDate(birthRaw)
          if (age === null || age < 18 || age > 99) {
            send(me.ws, { t: 'profile_error', field: 'birthDate' })
            return info(me, '🔞 Plaka82 yalnızca 18 yaş ve üzeri içindir. Geçerli bir doğum tarihi seç.')
          }
          birthDate = birthRaw
        } else if (raw.age !== null && raw.age !== undefined && raw.age !== '') {
          age = Number(raw.age)
          if (!Number.isInteger(age) || age < 18 || age > 99) {
            send(me.ws, { t: 'profile_error', field: 'age' })
            return info(me, '🔞 Plaka82 yalnızca 18 yaş ve üzeri içindir. Yaşın 18–99 arasında olmalı.')
          }
        }
        me.lastProfileSave = now
        const tags = [...new Set(Array.isArray(raw.tags) ? raw.tags.filter((t) => typeof t === 'string' && TAG_IDS.has(t)) : [])].slice(0, 6)
        const bio = mod().censor(clean(String(raw.bio ?? '').slice(0, 400), 120))
        const city = mod().censor(clean(String(raw.city ?? '').slice(0, 100), 20))
        const instagram = cleanHandle(mod().censor(raw.instagram ?? ''))
        const x = cleanHandle(mod().censor(raw.x ?? ''))
        const socialPrivacy = raw.socialPrivacy === 'friends' ? 'friends' : 'all'
        const p = { bio: bio.slice(0, 120), age, birthDate, city: city.slice(0, 20), instagram, x, socialPrivacy, tags }
        user(me.key).profile = p
        save()
        send(me.ws, { t: 'profile_saved', profile: pub(p, me.key, me.key) })
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
        send(me.ws, { t: 'profile', id, profile: pub(stored(target.key), me.key, target.key) ?? EMPTY, photo: photoUrlFor(me.key, target.key) })
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
