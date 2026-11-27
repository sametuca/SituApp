// Profil ve ilgi etiketleri.
// Mesajlar: profile_save {profile} · profile {id} → profile {id, profile}
// Profil fotoğrafı (yalnızca Supabase modu, hesaplı oyuncu): istemci Storage'a `<uid>/<ad>.jpg` yükler, sonra
//   profile_photo {path|null} (dakikada 3) → profile_photo {ok, url|null} ; photo_privacy {who:'all'|'friends'} → photo_privacy {who}
//   Sunucu her izleyici için ayrı url hesaplar ve { t:'photo', key, url|null } yollar (welcome.photos: toplu). photo_hidden (moderasyon) → hiçbir yerde gösterilmez.
import { save, user } from '../store.js'
import * as supa from '../supa.js'
import { savePhotoPath } from '../auth.js'
import { MUSIC_IDS, MOOD_IDS, MOOD_TTL } from '../../src/world/vibeData.js'

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

const EMPTY = { bio: '', age: null, birthDate: '', city: '', instagram: '', x: '', socialPrivacy: 'all', instagramLocked: false, xLocked: false, tags: [], music: '', mood: null }
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
  const moodOf = (k) => {
    const m = user(k).mood
    return m && MOOD_IDS.has(m.id) && Date.now() - m.at < MOOD_TTL ? m.id : null
  }

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
      music: MUSIC_IDS.has(p.music) ? p.music : '',
      mood: ownerKey ? moodOf(ownerKey) : null,
    }
  }

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
      return { profile: pub(stored(me.key), me.key, me.key), profileTags: TAGS, vibe: { mood: moodOf(me.key) }, photos, photoPrivacy: user(me.key).photoPrivacy ?? 'all', photoEnabled: Boolean(me.uid) }
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

      mood_set(me, msg) {
        const now = Date.now()
        if (now - (me.lastMood ?? 0) < 1500) return
        me.lastMood = now
        const id = msg?.id === null ? null : typeof msg?.id === 'string' && MOOD_IDS.has(msg.id) ? msg.id : undefined
        if (id === undefined) return
        user(me.key).mood = id ? { id, at: now } : null
        save()
        send(me.ws, { t: 'mood', key: me.key, mood: id, mine: true })
        ctx.broadcast({ t: 'mood', key: me.key, mood: id }, me.id, me.room, me)
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
            return info(me, '🔞 Rastla yalnızca 18 yaş ve üzeri içindir. Geçerli bir doğum tarihi seç.')
          }
          birthDate = birthRaw
        } else if (raw.age !== null && raw.age !== undefined && raw.age !== '') {
          age = Number(raw.age)
          if (!Number.isInteger(age) || age < 18 || age > 99) {
            send(me.ws, { t: 'profile_error', field: 'age' })
            return info(me, '🔞 Rastla yalnızca 18 yaş ve üzeri içindir. Yaşın 18–99 arasında olmalı.')
          }
        }
        me.lastProfileSave = now
        const tags = [...new Set(Array.isArray(raw.tags) ? raw.tags.filter((t) => typeof t === 'string' && TAG_IDS.has(t)) : [])].slice(0, 6)
        const bio = mod().censor(clean(String(raw.bio ?? '').slice(0, 400), 120))
        const city = mod().censor(clean(String(raw.city ?? '').slice(0, 100), 20))
        const instagram = cleanHandle(mod().censor(raw.instagram ?? ''))
        const x = cleanHandle(mod().censor(raw.x ?? ''))
        const socialPrivacy = raw.socialPrivacy === 'friends' ? 'friends' : 'all'
        const p = { bio: bio.slice(0, 120), age, birthDate, city: city.slice(0, 20), instagram, x, socialPrivacy, tags, music: MUSIC_IDS.has(raw.music) ? raw.music : '' }
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

    },
  }
}
