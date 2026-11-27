// Çok oyunculu dünya sunucusu (WebSocket, yol: /ws).
//
// Protokol (JSON):
//   istemci → sunucu
//     { t: 'join', name, avatar, token? }    bir kez, bağlanınca. Supabase modunda token (access_token) ZORUNLU: ad profiles'tan gelir,
//                                             istemcinin name'i yok sayılır; geçersizse { t:'auth_required' } + kapanır (ALLOW_GUEST=1: tokensiz misafir)
//     { t: 'move', x, z, ry, anim }          ~10 Hz
//     { t: 'chat', text, to? }               to verilirse özel mesaj (yalnızca alıcı + gönderen)
//     { t: 'room', to: 'city' | 'home' | 'venue', owner?, id? }   odaya geç; 'home' + owner yoksa kendi evin; 'venue' + id = girilebilir mekân (src/world/venues.js)
//     { t: 'home_save', items }                    kendi evinin düzenini kaydet (kalıcı) ve içindekilere yay
//     { t: 'home_open', open }                     evi herkese aç / yalnızca davetlilere kapat
//     { t: 'exterior_set', ext }                    evin dış görünümü (features/neighborhood.js); sunucu → { t:'plot', p } (welcome: plots, myExt)
//     { t: 'invite', to? | name? }                bir oyuncuyu evine davet et (id ya da ad)
//     { t: 'react', e }                            kafanın üstünde emoji tepkisi (odadaki herkes görür)
//     { t: 'whisper', to, text }                   fısıltı: aynı odadaki hedefe gider; yakındaki çevre "fısıldıyor" görür
//     { t: 'gesture', to, kind }                   birine jest: heart | flower | wink | wave | kiss | dance (≤ 8 m)
//     { t: 'typing', to }                          özel sohbette "yazıyor…" göstergesi
//     { t: 'block', id } / { t: 'unblock', key }   engelle / engeli kaldır
//     { t: 'report', id, reason }                  şikâyet (taciz | spam | uygunsuz | sahte | foto | diger)
//     { t: 'dj_get' | 'dj_join' | 'dj_leave' | 'dj_play', url | 'dj_stop' | 'dj_fire' }   Gece Kulübü DJ vardiyası (features/dj.js; ayrıntı orada)
//     { t: 'home_upgrade' }                        evi bir üst kademeye yükselt (features/housing.js; sunucu → { t:'home_tier', owner, tier }, welcome.homeTier, room.tier)
//     { t: 'pet_adopt', pet }                      ilk girişte 1 haftalık ücretsiz evcil hayvan (cat|dog; features/pets.js); { t:'pet_renew' } 80 🪙 ile +1 hafta; sunucu → { t:'pet_until', until }, welcome.petUntil/petOffer
//     { t: 'vb_join'|'vb_leave'|'vb_hit' } voleybol; { t:'sc_start'|'sc_tap' } kum kalesi; sunucu → meetup, meetup_end, vb, vb_wait, vb_gone, sc_go, sc_end (features/beach.js)
//     { t: 'coins_get' }                           altın bakiyesi (features/economy.js; sunucu → { t: 'coins', n, d, why }, welcome.coins)
//     { t: 'dnd', on }                             rahatsız etme modu
//     { t: 'sit', seat, slot } / { t: 'pose_end' } / { t: 'poses' }      oturma (features/together.js; ayrıntı orada)
//     { t: 'dance_invite', to } / { t: 'dance_reply', id, accept }       çift dans
//     { t: 'meetup_invite', to, activity } / { t: 'meetup_reply', id, accept }   buluşma daveti ve yanıtı (features/dating.js)
//     { t: 'look_set', look: {h,e,o} }             saç/göz/kıyafet rengi (palet indeksi, -1 = orijinal; features/cosmetics). join'e `look` ile ilk karakter oluşur
//     { t: 'cos_set', acc?, pet? }                 aksesuar {id,color}|null / evcil hayvan id|null seç (features/cosmetics)
//     { t: 'decor_set', decor } / { t: 'decor_get', owner }   ev dekoru (yalnızca sahibi yazar; bulunduğun evi okursun)
//     { t: 'gift_send', to, kind } / { t: 'gift_reply', offer, accept }   hediye gönder / gelen hediyeye cevap (≤ 8 m)
//     { t: 'voice', to, mime, dur, data } / { t: 'sticker', id, to? }   sesli mesaj, çıkartma (features/media.js)
//     { t: 'kar_get' | 'kar_join' | 'kar_leave' | 'kar_clap' }   Gece Kulübü karaokesi: durum / sıraya gir / çık / alkışla (features/venues.js)
//     { t: 'progress_get' } / { t: 'suggest_get' | 'suggest_hi' | 'suggest_close' }   görev/rozet durumu, günün önerisi (features/progress.js)
//     { t: 'collect', id } / { t: 'collect_get' }   toplanabilir topla (≤ 1,8 m, aynı oda) / koleksiyon durumu (features/collect.js)
//   sunucu → istemci
//     { t: 'welcome', id, char: {avatar, look}, home, homeItems, homeOpen, x, z, players: [...], online }   home = kendi evinin anahtarı
//     { t: 'room', room, owner, ownerName, venue, items, players: [...] }   oda değişti (room: 'city' | 'home:<anahtar>' | 'venue:<id>'; venue = mekân kimliği | null)
//     { t: 'home_items', owner, items }                bulunduğun evin düzeni değişti
//     { t: 'invited', owner, ownerName }               biri seni evine davet etti
//     { t: 'react', id, e }                            birinin emoji tepkisi
//     { t: 'whisper', id, name, to, toName, text, ts } sana (ya da senden) fısıltı;  { t: 'whispering', id }: yakında biri fısıldıyor
//     { t: 'gesture', id, name, avatar, kind, emoji }  biri sana jest yaptı;  { t: 'match', id, name, avatar }: karşılıklı kalp!
//     { t: 'typing', id }                              karşıdaki yazıyor
//     { t: 'pose', id, pose } / { t: 'poses', list } / { t: 'dance_offer' | 'dance_cancel' | 'sit_pair' }   bkz. features/together.js
//     { t: 'meetup_invite', id, activity, fromId, fromName } / { t: 'meetup_started', activity, venue, place }   buluşma daveti/başlangıcı (features/dating.js)
//     { t: 'blocks', list: [{key,name}] }              engel listen;  { t: 'dnd', id, on }: birinin rahatsız etme durumu
// Özellik modülleri (engel, profil, arkadaş, oyun…) server/features/ altındadır; bkz. features/index.js.
//     { t: 'cos', id, cos } (+ join/room oyuncularında `cos`)    birinin aksesuarı/evcil hayvanı;  welcome: cos, gifts, decor
//     { t: 'decor', owner, decor }  { t: 'gifts', list }  { t: 'gift_offer', offer, from, fromName, kind }
//     profil (features/profile.js): { t:'profile_save', profile:{bio,age,city,tags} } → { t:'profile_saved', profile } ;
//       { t:'profile', id } → { t:'profile', id, profile|null } ; welcome'a profile + profileTags (katalog) eklenir
//     { t: 'info', text } / { t: 'denied', reason }    kullanıcıya gösterilecek kısa mesaj
//     { t: 'join', p } / { t: 'leave', id }
//     { t: 'state', p: [[id, x, z, ry, animIdx], ...] }   ~10 Hz, yalnızca değişenler
//     { t: 'chat', id, name, text, ts, to?, dm? }
//     { t: 'online', n }
//     { t: 'auth_required' } / { t: 'kicked' }          token geçersiz/eksik · aynı hesap başka yerden bağlandı (bağlantı kapanır)
//     profil fotoğrafı (features/profile.js): { t:'profile_photo', path|null } · { t:'photo_privacy', who:'all'|'friends' } → { t:'photo', key, url|null } (kişi başına, izne göre)
//     { t: 'kar' | 'kar_turn' | 'kar_claps' | 'kar_end' }   karaoke durumu, sıra sende, alkış sayısı, tur sonucu (features/venues.js)
//     { t: 'collected', id, kind, stars, ttl } / { t: 'collect_state', c, s }   toplandı / koleksiyon durumu (welcome'da `collect`)   (features/collect.js)
//     { t: 'progress', p } / { t: 'quest_done', quest } / { t: 'badge', badge } / { t: 'event', event } / { t: 'suggest', s }   (features/progress.js)
//
// Odalar: herkes 'city' odasında başlar; evler 'home:<sahip anahtarı>' odalarıdır. Oyuncular, sohbet ve konum
// güncellemeleri yalnızca aynı odadakilere gider. Ev anahtarı oyuncu adından türetilir (kimlik doğrulama gelince
// kullanıcı id'sine geçilmeli).
//
// Kimlik: Supabase ortamı varsa (server/supa.js) me.uid = auth uid, me.key/homeKey = uid, ad = profiles.username.
// Aynı hesap ikinci kez bağlanınca eskisine { t:'kicked' } gider. Ortam yoksa isim istemciden gelir (demo, doğrulanmaz).
import { WebSocketServer } from 'ws'
import crypto from 'node:crypto'
import * as guardLib from './guard.js'
import { PIER, PLAY_BOUNDS, ZONES } from '../src/world/layout.js'
import { getHome, getTier, homeExists, saveItems, setOpen } from './homes.js'
import { moderate } from './profanity.js'
import { FEATURE_FACTORIES } from './features/index.js'
import * as supa from './supa.js'
import { user as storeUser, save as saveStore } from './store.js'
import { sanitizeLook } from '../src/world/lookData.js'
import { levelOf } from '../src/world/collectibles.js'
import { loadProfile, saveAvatar, setName, uidByName } from './auth.js'
import { VENUE_BY_ID, VENUE_HARD_CAP, VENUE_ROOM, VENUE_SOFT_CAP, isVenueRoom, venueChannelOf, venueIdOf, venueRoom } from '../src/world/venues.js'

const WORLD_HALF = 125 // dünya sınırı (±m); istemci layout.js WORLD_HALF ile aynı
const MAX_PLAYERS = 600
const TICK_MS = 100
const MAX_SPEED = 13 // m/sn (bisiklet 8,4; ağ gecikmesi payı dahil)
const AOI_R = 55 // m: konum yayını ilgi alanı (500+ oyuncu için)
const NEAR_R = 24 // m: bu mesafedekiler her tick güncellenir
const MAX_STATE_PER_PEER = 120
const MAX_STATE_BUFFERED = 512 * 1024
const CHAT_RANGE = 70 // m: şehirde herkese açık sohbet/emoji yalnızca bu mesafedekilere gider
const MAX_PAYLOAD = 144 * 1024 // yalnızca sesli mesaj (≤ 96 KB ses → ~128 KB base64) için; diğer mesajlar aşağıda 8 KB ile sınırlı
const MAX_TEXT_PAYLOAD = 8192 // ev kaydı (40 eşya) 2 KB'ı aşabilir
const BIG_TYPES = new Set(['voice'])
const CHAT_COOLDOWN_MS = 700
const CHAT_MAX = 140

// ---- etkileşim ----
const REACTIONS = new Set(['❤️', '😘', '😍', '🥰', '😂', '😳', '🔥', '👋', '😉', '🥺', '💃', '🎉'])
const GESTURES = { heart: '💗', flower: '🌸', wink: '😉', wave: '👋', kiss: '😘', dance: '💃' }
const WITNESS_RANGE = 12 // m: bu mesafedekiler "fısıldıyor 🤫" görür (metni görmez)
const GESTURE_RANGE = 8
const MATCH_WINDOW_MS = 10 * 60 * 1000 // karşılıklı kalp için süre

const AVATARS = new Set(['zeynep', 'deniz', 'elif', 'kaan', 'mira', 'ege'])
const ANIMS = ['idle', 'walk', 'run', 'ride'] // ride: bisiklette

// kontrol karakterlerini ve HTML'e yarayacak < > işaretlerini at, kırp
const clean = (s, max) =>
  String(s ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)

// ev sahibi anahtarı (demo/misafir): küçük harf, yalnızca harf/rakam/_/- (Türkçe harfler dahil)
const legacyKey = (name) => clean(name, 16).toLowerCase().replace(/[^a-z0-9ğüşıöç_-]/g, '') || 'misafir'
// Supabase modunda anahtar = uid: UUID verilirse kendisi, ad verilirse kullanıcı adından uid; bilinmeyen ad → ad tabanlı (evi yok)
const homeKey = (v) => {
  const s = String(v ?? '').trim()
  if (supa.enabled) {
    if (supa.UUID_RE.test(s)) return s.toLowerCase()
    const uid = uidByName(s.slice(0, 16))
    if (uid) return uid
  }
  return legacyKey(s)
}

const num = (v, lim) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(-lim, Math.min(lim, n)) : 0
}

export function attachGameServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws', maxPayload: MAX_PAYLOAD })
  const players = new Map() // id → oyuncu

  const publicInfo = (p) => ({ id: p.id, key: p.key, name: p.name, avatar: p.avatar, x: p.x, z: p.z, ry: p.ry, anim: ANIMS.indexOf(p.anim), dnd: Boolean(p.dnd), cos: p.cos ?? null })
  const send = (ws, msg) => ws.readyState === 1 && ws.send(JSON.stringify(msg))
  // room verilirse yalnızca o odadakilere gider
  // from verilirse, gönderenle arasında engel olan alıcılara gitmez
  const broadcast = (msg, exceptId, room, from, near) => {
    const data = JSON.stringify(msg)
    for (const p of players.values()) {
      if (p.id === exceptId || (room && p.room !== room) || p.ws.readyState !== 1) continue
      if (near && Math.hypot(p.x - near.x, p.z - near.z) > near.r) continue // yakındakiler (büyük dünyada gürültüyü azaltır)
      if (from && mod.blockedPair(from, p)) continue
      p.ws.send(data)
    }
  }
  let onlineTimer = null
  const broadcastOnline = () => {
    if (onlineTimer) return
    onlineTimer = setTimeout(() => {
      onlineTimer = null
      broadcast({ t: 'online', n: players.size })
    }, 250)
  }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)
  const inRoom = (room, exceptId) => [...players.values()].filter((p) => p.room === room && p.id !== exceptId)

  // ---- özellik modülleri (server/features) ----
  const ctx = { players, send, broadcast: (...a) => broadcast(...a), dist, inRoom, clean, homeKey, publicInfo, grace: (p, ms = 2500) => { p.graceUntil = Date.now() + ms }, strike: (p, why, w = 1) => p?.guard?.strike(why, w, { key: p.key, name: p.name }) }
  const features = FEATURE_FACTORIES.map((make) => make(ctx))
  ctx.features = features
  const mod = features[0].api // moderation her zaman ilk modül
  const emitEvent = (...a) => ctx.emitEvent?.(...a) // ilerleme modülü (görev/rozet olayları)
  const handlers = Object.assign({}, ...features.map((f) => f.handlers ?? {}))
  const emit = (hook, me) => features.forEach((f) => f[hook]?.(me))
  // alıcıya ulaşabilir mi? Değilse gönderene sebebi söyler (engellenmişse sezdirmez). true = engellendi.
  const refuse = (me, target, kind) => {
    const why = mod.reach(me, target, kind)
    if (!why) return false
    if (why.text) send(me.ws, { t: 'info', text: why.text })
    return true
  }

  // ev anahtarı → davet edilen oyuncu id'leri (sunucu çalıştığı sürece; oyuncu çıkınca silinir)
  const invites = new Map()
  const invited = (key, id) => invites.get(key)?.has(id)

  // oyuncu odaya girebilir mi? Şehir serbest; ev: sahibi, davetli ya da ev herkese açıksa
  const canEnter = (p, room) => {
    if (room === 'city') return true
    if (isVenueRoom(room)) return Object.hasOwn(VENUE_BY_ID, venueIdOf(room)) // mekânlar herkese açık
    const key = room.slice(5)
    if (key === p.homeKey) return true
    if (!homeExists(key) && ![...players.values()].some((o) => o.homeKey === key)) return false
    return invited(key, p.id) || Boolean(getHome(key)?.open)
  }
  const ownerNameOf = (key) => getHome(key)?.owner ?? [...players.values()].find((o) => o.homeKey === key)?.name ?? key

  // Mekân salon (kanal) yönetimi: tek mekân 24 kişiyi geçince otomatik Salon 2/3 açılır; arkadaşlar ve eşleşmeler mümkünse aynı salonda kalır.
  const venueChannelsOf = (vid) => {
    const counts = new Map([[1, 0]])
    let maxCh = 1
    for (const o of players.values()) {
      if (venueIdOf(o.room) !== vid) continue
      const ch = venueChannelOf(o.room)
      counts.set(ch, (counts.get(ch) ?? 0) + 1)
      if (ch > maxCh) maxCh = ch
    }
    if ((counts.get(maxCh) ?? 0) >= VENUE_SOFT_CAP && maxCh < 20) counts.set(maxCh + 1, 0)
    return [...counts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([ch, count]) => ({ ch, count, cap: VENUE_SOFT_CAP }))
  }
  const broadcastVenueChannels = (vid, exceptId) => {
    if (!vid) return
    const payload = JSON.stringify({ t: 'venue_channels', venue: vid, channels: venueChannelsOf(vid) })
    for (const o of players.values()) {
      if (o.id === exceptId || venueIdOf(o.room) !== vid || o.ws.readyState !== 1) continue
      o.ws.send(payload)
    }
  }
  const pickVenueChannel = (p, vid, wantedCh) => {
    const counts = new Map()
    for (const o of players.values()) {
      if (o.id === p.id || venueIdOf(o.room) !== vid) continue
      const ch = venueChannelOf(o.room)
      counts.set(ch, (counts.get(ch) ?? 0) + 1)
    }
    const req = Number.isInteger(wantedCh) && wantedCh >= 1 && wantedCh <= 20 ? wantedCh : null
    if (req && (counts.get(req) ?? 0) < VENUE_HARD_CAP) return req
    // Arkadaşlar ve eşleşmeler aynı salondaysa (aşırı dolu değilse) oraya yönlendir
    const u = storeUser(p.key)
    const socialKeys = new Set([...Object.keys(u?.friends ?? {}), ...Object.keys(u?.dating?.bonds ?? {})])
    if (socialKeys.size) {
      let bestCh = null
      let bestCount = -1
      for (const o of players.values()) {
        if (o.id === p.id || venueIdOf(o.room) !== vid || !socialKeys.has(o.key)) continue
        const ch = venueChannelOf(o.room)
        const c = counts.get(ch) ?? 0
        if (c < VENUE_HARD_CAP - 4 && c > bestCount) {
          bestCh = ch
          bestCount = c
        }
      }
      if (bestCh) return bestCh
    }
    // En düşük numaralı uygun salon (soft cap altı)
    for (let ch = 1; ch <= 20; ch++) {
      if ((counts.get(ch) ?? 0) < VENUE_SOFT_CAP) return ch
    }
    return 1
  }

  const changeRoom = (p, room) => {
    if (p.room === room) return
    const prevVid = venueIdOf(p.room)
    const nextVid = venueIdOf(room)
    p.graceUntil = Date.now() + 3500 // oda değişiminde konum atlayışı serbest
    emit('onRoomChange', p) // özellik modülleri (oturma/dans) eski odadaki durumunu temizler
    broadcast({ t: 'leave', id: p.id }, p.id, p.room)
    p.room = room
    p.dirty = false
    let spawn = null
    if (nextVid) {
      // Giriş kapısında oyuncuların üst üste binmesini önleyen hafif dağılım
      const jx = +(VENUE_ROOM.spawn[0] + (Math.random() - 0.5) * 2.6).toFixed(2)
      const jz = +(VENUE_ROOM.spawn[1] + (Math.random() - 0.5) * 1.1).toFixed(2)
      p.x = jx
      p.z = jz
      p.ry = Math.PI
      p.vpos = { x: jx, z: jz, t: Date.now() }
      spawn = [jx, jz]
    }
    const key = room.startsWith('home:') ? room.slice(5) : null
    const channels = nextVid ? venueChannelsOf(nextVid) : null
    send(p.ws, {
      t: 'room',
      room,
      venue: nextVid,
      channel: nextVid ? venueChannelOf(room) : null,
      channels,
      spawn,
      owner: key,
      tier: key ? getTier(key) : null,
      ownerName: key ? ownerNameOf(key) : null,
      items: key ? (getHome(key)?.items ?? []) : [],
      players: inRoom(room, p.id).map(publicInfo),
    })
    broadcast({ t: 'join', p: publicInfo(p) }, p.id, room)
    if (prevVid && prevVid !== nextVid) broadcastVenueChannels(prevVid, p.id)
    if (nextVid) broadcastVenueChannels(nextVid, p.id)
  }

  ctx.moveGroupToVenue = (group, vid) => {
    if (!Array.isArray(group) || group.length !== 2 || !Object.hasOwn(VENUE_BY_ID, vid)) return false
    if (group.some((p) => !p || typeof p.id !== 'string')) return false
    if (new Set(group.map((p) => p?.id)).size !== group.length) return false
    if (group.some((p) => players.get(p.id) !== p || p.ws.readyState !== 1)) return false
    if (new Set(group.map((p) => p.room)).size !== 1) return false
    if (group.every((p) => venueIdOf(p.room) === vid)) return true

    const memberIds = new Set(group.map((p) => p.id))
    const counts = new Map()
    for (const p of players.values()) {
      if (memberIds.has(p.id) || venueIdOf(p.room) !== vid) continue
      const ch = venueChannelOf(p.room)
      counts.set(ch, (counts.get(ch) ?? 0) + 1)
    }

    let channel = null
    for (let ch = 1; ch <= 20; ch++) {
      if ((counts.get(ch) ?? 0) + group.length <= VENUE_SOFT_CAP) {
        channel = ch
        break
      }
    }
    if (channel === null) {
      for (let ch = 1; ch <= 20; ch++) {
        if ((counts.get(ch) ?? 0) + group.length <= VENUE_HARD_CAP) {
          channel = ch
          break
        }
      }
    }
    if (channel === null) return false

    const room = venueRoom(vid, channel)
    if (group.some((p) => !canEnter(p, room))) return false
    for (const p of group) changeRoom(p, room)
    return true
  }

  // Supabase modu: token doğrula, kullanıcı adı/avatarı profiles'tan al (istemcinin gönderdiği ad yok sayılır).
  // Dönüş: null (ad tabanlı demo/misafir akışı) | 'denied' | { uid, username, avatar, photo, photoHidden }
  const resolveIdentity = async (msg) => {
    if (!supa.enabled) return null
    if (!msg.token) return supa.allowGuest ? null : 'denied'
    const u = await supa.verifyToken(msg.token)
    if (!u) return 'denied'
    const prof = await loadProfile(u.id)
    if (!prof) return 'denied'
    setName(prof.username, u.id)
    const wanted = AVATARS.has(msg.avatar) ? msg.avatar : null
    const avatar = wanted ?? (AVATARS.has(prof.avatar) ? prof.avatar : 'zeynep')
    if (wanted && wanted !== prof.avatar && !storeUser(u.id).character) saveAvatar(u.id, wanted).catch(() => {}) // karakter kilitliyse profil avatarı değişmez
    return { uid: u.id, username: prof.username, avatar, photo: prof.photo_path ?? null, photoHidden: prof.photo_hidden === true }
  }

  const createPlayer = (msg, ident) => {
    const joinName = moderate(clean(msg.name, 16), { contact: false })
    let guestName = (joinName.flagged ? '' : joinName.text) || 'Misafir'
    if (supa.enabled && uidByName(guestName)) guestName = 'Misafir' // misafir gerçek bir kullanıcı adını taklit edemez
    const me = {
      id: crypto.randomUUID().slice(0, 8),
      ws: msg.__ws,
      name: ident ? ident.username : guestName,
      avatar: ident ? ident.avatar : AVATARS.has(msg.avatar) ? msg.avatar : 'zeynep',
      // tüm oyuncular sahilde (plaj meydanında, SPAWN { x: 0, z: 63 }) doğar
      x: (Math.random() - 0.5) * 6,
      z: 63 + Math.random() * 2,
      ry: Math.PI,
      anim: 'idle',
      dirty: false,
      stateCursor: 0,
      needsSync: false,
      lastChat: 0,
      room: 'city',
      uid: ident?.uid ?? null,
      photo: ident?.photo ?? null,
      photoHidden: ident?.photoHidden ?? false,
    }
    me.homeKey = ident ? ident.uid : legacyKey(guestName)
    me.ip = msg.__ip ?? null
    me.key = me.homeKey // kalıcı kimlik anahtarı (Supabase modunda auth uid; demo/misafirde addan türer)
    if (guardLib.isBanned(me.key, null)) {
      send(me.ws, { t: 'banned' })
      setTimeout(() => me.ws.close(4403, 'banned'), 100)
      return null // yasaklı hesap: dünyaya girmeden reddedilir
    }
    // TEK KARAKTER: hesapta karakter yoksa ilk girişteki seçim kalıcı olur; varsa istemcinin avatar/görünüm isteği yok sayılır.
    {
      const u = storeUser(me.key)
      if (!u.character) {
        u.character = { avatar: me.avatar, look: sanitizeLook(msg.look), at: Date.now() }
        saveStore()
      }
      me.avatar = AVATARS.has(u.character.avatar) ? u.character.avatar : me.avatar
    }
    players.set(me.id, me)
    emit('onJoin', me)
    send(me.ws, {
      ...Object.assign({}, ...features.map((f) => f.welcome?.(me) ?? {})),
      t: 'welcome',
      id: me.id,
      gp: guardLib.proof(me.id), // koruma kanıtı: istemci görmezse oyunu yüklemez
      char: { avatar: me.avatar, look: storeUser(me.key).character?.look ?? sanitizeLook(null) }, // hesabın tek karakteri (sunucu otoriter)
      name: me.name,
      home: me.homeKey,
      homeItems: getHome(me.homeKey)?.items ?? null,
      homeOpen: Boolean(getHome(me.homeKey)?.open),
      x: me.x,
      z: me.z,
      players: inRoom('city', me.id).map(publicInfo),
      online: players.size,
    })
    broadcast({ t: 'join', p: publicInfo(me) }, me.id, 'city')
    broadcastOnline()
    return me
  }

  guardLib.assertSealed() // koruma yoksa oyun sunucusu açılmaz
  const CORE = new Set(['join', 'move', 'room', 'venue_channels', 'home_save', 'home_open', 'invite', 'react', 'whisper', 'gesture', 'typing', 'chat', 'tp'])
  wss.on('connection', (ws, req) => {
    let me = null
    let joining = false
    ws.isAlive = true
    ws.on('pong', () => (ws.isAlive = true))
    const ip = guardLib.ipOf(req)
    if (!guardLib.active()) return ws.close(1013, 'guard') // koruma bozulduysa hiçbir bağlantı kabul edilmez
    if (guardLib.isBanned(null, ip)) {
      send(ws, { t: 'banned' })
      return ws.close(4403, 'banned')
    }
    if (!guardLib.connOpen(ip)) {
      send(ws, { t: 'full' })
      guardLib.connClose(ip)
      return ws.close(4429, 'too many')
    }
    ws.on('close', () => guardLib.connClose(ip))
    const guard = guardLib.createGuard({
      ip,
      onBan: () => {
        send(ws, { t: 'banned' })
        setTimeout(() => ws.close(4403, 'banned'), 100)
      },
    })
    const who = () => ({ key: me?.key, name: me?.name })

    ws.on('message', (raw) => {
      let msg
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }
      if (!msg || typeof msg.t !== 'string') return guard.strike('geçersiz mesaj', 0.5, who())
      if (guard.banned || !guard.rate(who())) return
      if (raw.length > MAX_TEXT_PAYLOAD && !BIG_TYPES.has(msg.t)) return guard.strike('aşırı büyük mesaj', 1, who())
      if (guardLib.HONEYPOT.has(msg.t)) return guard.strike(`tuzak mesaj: ${msg.t.slice(0, 20)}`, 12, who())

      if (msg.t === 'join' && !me && !joining) {
        if (players.size >= MAX_PLAYERS) {
          send(ws, { t: 'full' })
          return ws.close()
        }
        joining = true
        resolveIdentity(msg)
          .then((ident) => {
            if (ws.readyState !== 1) return
            if (ident === 'denied') {
              send(ws, { t: 'auth_required' })
              return ws.close(4401, 'auth')
            }
            // aynı hesap ikinci kez bağlanırsa eskisini at
            if (ident) for (const o of players.values()) if (o.uid === ident.uid) {
              send(o.ws, { t: 'kicked' })
              o.ws.close(4001, 'kicked')
            }
            const key0 = ident ? ident.uid : null
            if (key0 && guardLib.isBanned(key0, null)) {
              send(ws, { t: 'banned' })
              return ws.close(4403, 'banned')
            }
            me = createPlayer({ ...msg, __ws: ws, __ip: ip }, ident)
            if (!me) return
            me.ip = ip
            me.guard = guard
            if (guardLib.isBanned(me.key, null)) {
              send(ws, { t: 'banned' })
              players.delete(me.id)
              return ws.close(4403, 'banned')
            }
            me.graceUntil = Date.now() + 6000 // ilk konum atlayışı serbest (başlangıç noktası)
            me.vpos = null // ilk hareket konumu istemcinin başlangıç noktasıdır: serbest kabul edilir
          })
          .catch((e) => {
            console.error('Giriş hatası:', e.message)
            send(ws, { t: 'auth_required', retry: true })
            ws.close(4401, 'auth')
          })
        return
      }

      if (!me) return

      const handler = handlers[msg.t]
      if (!handler && !CORE.has(msg.t)) return guard.strike(`bilinmeyen mesaj: ${msg.t.slice(0, 20)}`, 1, who())
      if (handler) return handler(me, msg)
      if (msg.t === 'tp') {
        // ışınlanma yalnızca bilinen bölge noktalarına (harita düğmesi, /ışınlan); başka koordinat kabul edilmez
        const z = ZONES.find((zn) => zn.id === msg.zone)
        const now = Date.now()
        if (!z || me.room !== 'city' || now - (me.lastTp ?? 0) < 800) return guard.strike('geçersiz ışınlanma', 2, who())
        me.lastTp = now
        me.x = z.spawn[0]
        me.z = z.spawn[1]
        me.vpos = { x: me.x, z: me.z, t: now }
        me.graceUntil = now + 1500
        me.dirty = true
        return
      }

      if (msg.t === 'move') {
        const mx = num(msg.x, WORLD_HALF)
        const mz = num(msg.z, WORLD_HALF)
        if (features.some((f) => f.moveVeto?.(me, mx, mz))) return // oturuyor/dans ediyor: konum kilitli
        // hile denetimi: hız + dünya sınırı (şehirde). Oda geçişi/ışınlanma/sunucu kaynaklı atlayış sonrası kısa süre serbest.
        const nowMs = Date.now()
        const first = !me.vpos // katılımdan sonraki ilk hareket: başlangıç noktası
        const vp = me.vpos ?? { x: mx, z: mz, t: nowMs }
        const jump = Math.hypot(mx - vp.x, mz - vp.z)
        // mesafe bütçesi (token bucket): zamanla MAX_SPEED m/sn birikir (en çok 7 m); her hareket bütçeden düşer. Ortalama hız sınırı böyle zorlanır
        me.budget = Math.min(7, (me.budget ?? 7) + (MAX_SPEED * Math.min(3000, nowMs - vp.t)) / 1000)
        const free = nowMs < (me.graceUntil ?? 0)
        const onPier = Math.abs(mx - PIER.x) <= PIER.hw + 1.2 && mz >= PIER.z0 - 1 && mz <= PIER.z1 + 1.5
        const outside = me.room === 'city' && !onPier && (mx < PLAY_BOUNDS.x0 - 2 || mx > PLAY_BOUNDS.x1 + 2 || mz < PLAY_BOUNDS.z0 - 2 || mz > PLAY_BOUNDS.z1 + 2)
        if (free || first) me.budget = 7
        else if (jump > me.budget || outside) {
          guard.strike(outside ? 'sınır dışı konum' : `hız ihlali (${jump.toFixed(1)} m)`, 2, who())
          me.vpos = { ...vp, t: nowMs }
          send(ws, { t: 'snap', x: vp.x, z: vp.z }) // son geçerli konuma geri çek
          return
        } else me.budget -= jump
        me.vpos = { x: mx, z: mz, t: nowMs }
        const nry = num(msg.ry, 10)
        let nanim = ANIMS.includes(msg.anim) ? msg.anim : 'idle'
        if (nanim === 'ride' && isVenueRoom(me.room)) nanim = 'idle' // mekân içinde bisiklete binilmez
        // Yalnızca gerçek delta varsa dirty işaretle (duran/oturan oyuncularda gereksiz paket gönderme)
        if (Math.abs(mx - me.x) >= 0.015 || Math.abs(mz - me.z) >= 0.015 || Math.abs(nry - me.ry) >= 0.03 || nanim !== me.anim) {
          me.x = mx
          me.z = mz
          me.ry = nry
          me.anim = nanim
          me.dirty = true
        }
        emit('onMove', me)
      } else if (msg.t === 'venue_channels') {
        const vid = typeof msg.id === 'string' && Object.hasOwn(VENUE_BY_ID, msg.id) ? msg.id : venueIdOf(me.room)
        if (vid) send(ws, { t: 'venue_channels', venue: vid, channels: venueChannelsOf(vid) })
      } else if (msg.t === 'room') {
        let room = 'city'
        if (msg.to === 'venue' && typeof msg.id === 'string') {
          if (!Object.hasOwn(VENUE_BY_ID, msg.id)) return send(ws, { t: 'denied', reason: 'Bu mekân bulunamadı.' })
          const ch = pickVenueChannel(me, msg.id, Number.isInteger(msg.ch) ? msg.ch : null)
          room = venueRoom(msg.id, ch)
        } else if (msg.to === 'home') {
          room = `home:${typeof msg.owner === 'string' ? homeKey(msg.owner) : me.homeKey}`
        }
        if (!canEnter(me, room)) return send(ws, { t: 'denied', reason: isVenueRoom(room) ? 'Bu mekân bulunamadı.' : 'Bu eve girmek için davet gerekiyor ya da ev kapalı.' })
        changeRoom(me, room)
        if (isVenueRoom(room)) {
          emitEvent(me, 'venue_enter', 1, venueIdOf(room))
          emitEvent(me, 'zone', 1, `v-${venueIdOf(room)}`) // mekâna girmek "yeni mekân gezmek" sayılır
        } else if (room !== 'city' && room.slice(5) !== me.homeKey) {
          emitEvent(me, 'home_visit')
          emitEvent({ key: room.slice(5) }, 'guest', 1, me)
        }
      } else if (msg.t === 'home_save') {
        const now = Date.now()
        if (now - (me.lastSave ?? 0) < 200) return
        me.lastSave = now
        const items = saveItems(me.homeKey, me.name, msg.items)
        broadcast({ t: 'home_items', owner: me.homeKey, items }, me.id, `home:${me.homeKey}`)
        emitEvent(me, 'furnish', items.length)
        features.forEach((f) => f.onHomeChange?.(me, 'save')) // Konut Mahallesi: parsel ata/duyur
      } else if (msg.t === 'home_open') {
        setOpen(me.homeKey, me.name, msg.open)
        features.forEach((f) => f.onHomeChange?.(me, 'open')) // kapı kilidi göstergesi / parsel
        send(ws, { t: 'info', text: msg.open ? '🔓 Evin herkese açık. Arkadaşların /ziyaret ' + me.name + ' yazarak gelebilir.' : '🔒 Evin yalnızca davetlilere açık.' })
      } else if (msg.t === 'invite') {
        const now = Date.now()
        if (now - (me.lastInvite ?? 0) < 1000) return
        me.lastInvite = now
        const wanted = typeof msg.name === 'string' ? clean(msg.name, 16).toLowerCase() : null
        const target = typeof msg.to === 'string' ? players.get(msg.to) : [...players.values()].find((o) => o.name.toLowerCase() === wanted)
        if (!target || target.id === me.id) return send(ws, { t: 'info', text: 'Bu isimde çevrimiçi biri bulunamadı.' })
        if (refuse(me, target, 'invite')) return
        if (!invites.has(me.homeKey)) invites.set(me.homeKey, new Set())
        invites.get(me.homeKey).add(target.id)
        send(target.ws, { t: 'invited', owner: me.homeKey, ownerName: me.name })
        send(ws, { t: 'info', text: `🏠 ${target.name} evine davet edildi.` })
        emitEvent(me, 'invite', 1, target)
      } else if (msg.t === 'react') {
        const now = Date.now()
        if (!REACTIONS.has(msg.e) || now - (me.lastReact ?? 0) < 200) return
        me.lastReact = now
        broadcast({ t: 'react', id: me.id, e: msg.e }, undefined, me.room, me)
        emitEvent(me, 'react')
      } else if (msg.t === 'whisper') {
        const now = Date.now()
        const raw = clean(msg.text, CHAT_MAX)
        const text = mod.censor(raw)
        if (!text || now - (me.lastWhisper ?? 0) < CHAT_COOLDOWN_MS) return
        const target = typeof msg.to === 'string' ? players.get(msg.to) : null
        if (!target || target.id === me.id || target.room !== me.room) return send(ws, { t: 'info', text: 'Bu kişi artık burada değil.' })
        if (refuse(me, target, 'whisper')) return
        if (ctx.canWhisper && !ctx.canWhisper(me, target)) return send(ws, { t: 'info', text: `🛡️ ${target.name} yalnızca arkadaşlar ve eşleşmelerden fısıltı kabul ediyor.` })
        me.lastWhisper = now
        mod.remember(me, 'fısıltı', raw)
        const w = { t: 'whisper', id: me.id, name: me.name, to: target.id, toName: target.name, text, ts: now }
        send(target.ws, w)
        send(ws, w)
        emitEvent(me, 'whisper', 1, target)
        // yakındakiler yalnızca "fısıldıyor" görür, metni görmez
        for (const o of inRoom(me.room, me.id)) if (o.id !== target.id && dist(o, me) <= WITNESS_RANGE && !mod.blockedPair(me, o)) send(o.ws, { t: 'whispering', id: me.id })
      } else if (msg.t === 'gesture') {
        const now = Date.now()
        const emoji = GESTURES[msg.kind]
        if (!emoji || now - (me.lastGesture ?? 0) < 800) return
        const target = typeof msg.to === 'string' ? players.get(msg.to) : null
        if (!target || target.id === me.id || target.room !== me.room) return send(ws, { t: 'info', text: 'Bu kişi artık burada değil.' })
        if (dist(me, target) > GESTURE_RANGE) return send(ws, { t: 'info', text: `${target.name} çok uzakta, biraz yaklaş.` })
        if (refuse(me, target, 'gesture')) return
        me.lastGesture = now
        send(target.ws, { t: 'gesture', id: me.id, key: me.key, name: me.name, avatar: me.avatar, kind: msg.kind, emoji })
        broadcast({ t: 'react', id: me.id, e: emoji }, undefined, me.room, me)
        emitEvent(me, 'gesture', 1, target)
        emitEvent(me, `gesture_${msg.kind}`, 1, target)
        // karşılıklı kalp = eşleşme
        if (msg.kind === 'heart') {
          me.hearts = me.hearts ?? new Map()
          if (now - (target.hearts?.get(me.id) ?? 0) < MATCH_WINDOW_MS) {
            target.hearts.delete(me.id)
            me.hearts.delete(target.id)
            send(ws, { t: 'match', id: target.id, key: target.key, name: target.name, avatar: target.avatar })
            send(target.ws, { t: 'match', id: me.id, key: me.key, name: me.name, avatar: me.avatar })
            broadcast({ t: 'react', id: me.id, e: '💞' }, undefined, me.room)
            broadcast({ t: 'react', id: target.id, e: '💞' }, undefined, me.room)
            emitEvent(me, 'match', 1, target)
            emitEvent(target, 'match', 1, me)
          } else me.hearts.set(target.id, now)
        }
      } else if (msg.t === 'typing') {
        const now = Date.now()
        if (now - (me.lastTyping ?? 0) < 1000) return
        me.lastTyping = now
        const target = typeof msg.to === 'string' ? players.get(msg.to) : null
        if (target && target.room === me.room && !mod.blockedPair(me, target)) send(target.ws, { t: 'typing', id: me.id })
      } else if (msg.t === 'chat') {
        const now = Date.now()
        const raw = clean(msg.text, CHAT_MAX)
        const text = mod.censor(raw)
        if (!text || now - me.lastChat < CHAT_COOLDOWN_MS) return
        me.lastChat = now
        const target = typeof msg.to === 'string' ? players.get(msg.to) : null
        if (msg.to && (!target || target.room !== me.room)) return // hedef çıkmış/başka odada; mesajı herkese sızdırma
        mod.remember(me, target ? 'özel' : 'herkese', raw)
        if (target) {
          if (refuse(me, target, 'dm')) return
          // özel mesaj (DM): yalnızca alıcıya ve göndericiye
          const dm = { t: 'chat', id: me.id, name: me.name, text, ts: now, to: target.id, dm: true }
          send(target.ws, dm)
          send(ws, dm)
          emitEvent(me, 'chat', 1, target)
        } else {
          broadcast({ t: 'chat', id: me.id, name: me.name, text, ts: now }, undefined, me.room, me, me.room === 'city' ? { x: me.x, z: me.z, r: CHAT_RANGE } : undefined)
          emitEvent(me, 'chat')
        }
      }
    })

    ws.on('close', () => {
      if (!me) return
      const leftVid = venueIdOf(me.room)
      players.delete(me.id)
      emit('onLeave', me)
      for (const set of invites.values()) set.delete(me.id)
      for (const o of players.values()) o.hearts?.delete(me.id)
      broadcast({ t: 'leave', id: me.id }, undefined, me.room)
      if (leftVid) broadcastVenueChannels(leftVid)
      broadcastOnline()
    })
    ws.on('error', () => ws.terminate())
  })

  // Değişen konumlar 100 ms toplu delta olarak yayınlanır. 500+ oyuncu için ilgi alanı (AOI):
  // yalnızca hareket edenler/değişenler gider (≤ NEAR_R her tick, NEAR_R-AOI_R arası her 4. tick),
  // durağan/oturan oyuncular için her 5 sn'de bir hafif eşitleme yapılır.
  let tickNo = 0
  const profile = process.env.SITUAPP_PROFILE === '1'
  let tickMs = 0
  let tickMax = 0
  const tick = setInterval(() => {
    const t0 = profile ? performance.now() : 0
    tickNo++
    const full = tickNo % 50 === 0
    const far = tickNo % 4 === 0
    const byRoom = new Map()
    for (const p of players.values()) {
      p.moved = p.dirty
      p.dirty = false
      let r = byRoom.get(p.room)
      if (!r) byRoom.set(p.room, (r = { cells: new Map(), any: false }))
      const key = `${Math.floor(p.x / AOI_R)},${Math.floor(p.z / AOI_R)}`
      let c = r.cells.get(key)
      if (!c) r.cells.set(key, (c = []))
      c.push(p)
      if (p.moved || p.needsSync) r.any = true
    }
    for (const r of byRoom.values()) {
      if (!r.any && !full) continue
      for (const [key, list] of r.cells) {
        const [cx, cz] = key.split(',').map(Number)
        const around = []
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
          const c = r.cells.get(`${cx + dx},${cz + dz}`)
          if (c) around.push(...c)
        }
        for (const p of list) {
          if (p.ws.readyState !== 1) continue
          if (p.ws.bufferedAmount > MAX_STATE_BUFFERED) {
            p.needsSync = true
            continue
          }
          const forceSync = full || p.needsSync
          const out = []
          let cursor = around.length ? (p.stateCursor ?? 0) % around.length : 0
          let scanned = 0
          while (scanned < around.length && out.length < MAX_STATE_PER_PEER) {
            const q = around[cursor]
            cursor = (cursor + 1) % around.length
            scanned++
            if (q === p || (!q.moved && !forceSync)) continue
            const dx = q.x - p.x
            const dz = q.z - p.z
            const d2 = dx * dx + dz * dz
            if (d2 > AOI_R * AOI_R || (d2 > NEAR_R * NEAR_R && !far && !forceSync)) continue
            if (q.entryTick !== tickNo) {
              // her oyuncunun satırı tick başına bir kez metne çevrilir, alıcılar arasında paylaşılır
              q.entryTick = tickNo
              q.entry = `["${q.id}",${Math.round(q.x * 100) / 100},${Math.round(q.z * 100) / 100},${Math.round(q.ry * 100) / 100},${ANIMS.indexOf(q.anim)}]`
            }
            out.push(q.entry)
          }
          p.stateCursor = cursor
          if (p.needsSync && scanned >= around.length) p.needsSync = false
          if (out.length) p.ws.send(`{"t":"state","p":[${out.join(',')}]}`)
        }
      }
    }
    if (profile) {
      const d = performance.now() - t0
      tickMs += d
      tickMax = Math.max(tickMax, d)
      if (tickNo % 50 === 0) {
        console.log(`[profil] oyuncu=${players.size} tick ort=${(tickMs / 50).toFixed(2)}ms maks=${tickMax.toFixed(1)}ms rss=${Math.round(process.memoryUsage().rss / 1048576)}MB`)
        tickMs = 0
        tickMax = 0
      }
    }
  }, TICK_MS)

  // kopan bağlantıları temizle
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate()
        continue
      }
      ws.isAlive = false
      ws.ping()
    }
  }, 30000)

  wss.on('close', () => {
    clearInterval(tick)
    clearInterval(heartbeat)
  })

  return {
    online: () => players.size,
    listPlayers: () =>
      [...players.values()].map((p) => {
        const u = storeUser(p.key)
        const stars = u.stats?.stars ?? 0
        return {
          id: p.id,
          key: p.key,
          uid: p.uid ?? null,
          name: p.name,
          avatar: p.avatar,
          room: p.room,
          x: Math.round(p.x * 10) / 10,
          z: Math.round(p.z * 10) / 10,
          coins: u.coins ?? 0,
          stars,
          level: levelOf(stars).level,
          ip: p.ip ?? null,
        }
      }),
    kick(idOrKey, reason = 'Yönetici tarafından çıkarıldın.') {
      let n = 0
      for (const p of players.values()) {
        if (p.id === idOrKey || p.key === idOrKey) {
          send(p.ws, { t: 'info', text: `⛔ ${reason}` })
          setTimeout(() => p.ws.close(4403, 'kicked'), 80)
          n++
        }
      }
      return n
    },
    announce(text) {
      const msg = String(text ?? '').trim().slice(0, 240)
      if (!msg) return 0
      for (const p of players.values()) send(p.ws, { t: 'info', text: `📢 ${msg}` })
      return players.size
    },
    reward(key, { coins = 0, stars = 0 } = {}) {
      const u = storeUser(key)
      const cDelta = Math.trunc(Number(coins) || 0)
      const sDelta = Math.trunc(Number(stars) || 0)
      if (cDelta) u.coins = Math.max(0, (u.coins ?? 0) + cDelta)
      if (sDelta) {
        u.stats ??= {}
        u.stats.stars = Math.max(0, (u.stats.stars ?? 0) + sDelta)
      }
      saveStore()
      for (const p of players.values()) {
        if (p.key !== key) continue
        if (cDelta) send(p.ws, { t: 'coins', n: u.coins, d: cDelta, why: 'Yönetici ödülü' })
        if (sDelta) send(p.ws, { t: 'collect_xp', xp: u.stats.stars, bonus: sDelta, kind: 'star', hidden: false })
      }
      return { coins: u.coins ?? 0, stars: u.stats?.stars ?? 0 }
    },
  }
}
