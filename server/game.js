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
//     { t: 'invite', to? | name? }                 bir oyuncuyu evine davet et (id ya da ad)
//     { t: 'react', e }                            kafanın üstünde emoji tepkisi (odadaki herkes görür)
//     { t: 'whisper', to, text }                   fısıltı: yalnızca yakındaki (≤ 7 m) hedefe gider, çevre "fısıldıyor" görür
//     { t: 'gesture', to, kind }                   birine jest: heart | flower | wink | wave | kiss | dance (≤ 8 m)
//     { t: 'typing', to }                          özel sohbette "yazıyor…" göstergesi
//     { t: 'block', id } / { t: 'unblock', key }   engelle / engeli kaldır
//     { t: 'report', id, reason }                  şikâyet (taciz | spam | uygunsuz | sahte | foto | diger)
//     { t: 'dnd', on }                             rahatsız etme modu
//     { t: 'sit', seat, slot } / { t: 'pose_end' } / { t: 'poses' }      oturma (features/together.js; ayrıntı orada)
//     { t: 'dance_invite', to } / { t: 'dance_reply', id, accept }       çift dans
//     { t: 'cos_set', acc?, pet? }                 aksesuar {id,color}|null / evcil hayvan id|null seç (features/cosmetics)
//     { t: 'decor_set', decor } / { t: 'decor_get', owner }   ev dekoru (yalnızca sahibi yazar; bulunduğun evi okursun)
//     { t: 'gift_send', to, kind } / { t: 'gift_reply', offer, accept }   hediye gönder / gelen hediyeye cevap (≤ 8 m)
//     { t: 'voice', to, mime, dur, data } / { t: 'sticker', id, to? }   sesli mesaj, çıkartma (features/media.js)
//     { t: 'kar_get' | 'kar_join' | 'kar_leave' | 'kar_clap' }   Gece Kulübü karaokesi: durum / sıraya gir / çık / alkışla (features/venues.js)
//     { t: 'progress_get' } / { t: 'suggest_get' | 'suggest_hi' | 'suggest_close' }   görev/rozet durumu, günün önerisi (features/progress.js)
//     { t: 'collect', id } / { t: 'collect_get' }   toplanabilir topla (≤ 1,8 m, aynı oda) / koleksiyon durumu (features/collect.js)
//   sunucu → istemci
//     { t: 'welcome', id, home, homeItems, homeOpen, x, z, players: [...], online }   home = kendi evinin anahtarı
//     { t: 'room', room, owner, ownerName, venue, items, players: [...] }   oda değişti (room: 'city' | 'home:<anahtar>' | 'venue:<id>'; venue = mekân kimliği | null)
//     { t: 'home_items', owner, items }                bulunduğun evin düzeni değişti
//     { t: 'invited', owner, ownerName }               biri seni evine davet etti
//     { t: 'react', id, e }                            birinin emoji tepkisi
//     { t: 'whisper', id, name, to, toName, text, ts } sana (ya da senden) fısıltı;  { t: 'whispering', id }: yakında biri fısıldıyor
//     { t: 'gesture', id, name, avatar, kind, emoji }  biri sana jest yaptı;  { t: 'match', id, name, avatar }: karşılıklı kalp!
//     { t: 'typing', id }                              karşıdaki yazıyor
//     { t: 'pose', id, pose } / { t: 'poses', list } / { t: 'dance_offer' | 'dance_cancel' | 'sit_pair' }   bkz. features/together.js
//     { t: 'blocks', list: [{key,name}] }              engel listen;  { t: 'dnd', id, on }: birinin rahatsız etme durumu
// Özellik modülleri (engel, profil, arkadaş, oyun…) server/features/ altındadır; bkz. features/index.js.
//     { t: 'cos', id, cos } (+ join/room oyuncularında `cos`)    birinin aksesuarı/evcil hayvanı;  welcome: cos, gifts, decor
//     { t: 'decor', owner, decor }  { t: 'gifts', list }  { t: 'gift_offer', offer, from, fromName, kind }
//     profil (features/profile.js): { t:'profile_save', profile:{bio,age,city,tags} } → { t:'profile_saved', profile } ;
//       { t:'profile', id } → { t:'profile', id, profile|null } ; welcome'a profile + profileTags (katalog) eklenir
//     buz kırıcı: { t:'icebreaker', to } → alıcıya { t:'icebreaker', id, name, qid, q, a, b } ;
//       { t:'icebreaker_answer', to, qid, pick:'a'|'b' } → gönderene { t:'icebreaker_answer', id, name, a, b, choice }
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
import { getHome, homeExists, saveItems, setOpen } from './homes.js'
import { moderate } from './profanity.js'
import { FEATURE_FACTORIES } from './features/index.js'
import * as supa from './supa.js'
import { loadProfile, saveAvatar, setName, uidByName } from './auth.js'
import { VENUE_BY_ID, isVenueRoom, venueIdOf, venueRoom } from '../src/world/venues.js'

const WORLD_HALF = 60 // dünya sınırı (±m); istemci haritasıyla aynı olmalı
const MAX_PLAYERS = 100
const TICK_MS = 100
const MAX_PAYLOAD = 144 * 1024 // yalnızca sesli mesaj (≤ 96 KB ses → ~128 KB base64) için; diğer mesajlar aşağıda 8 KB ile sınırlı
const MAX_TEXT_PAYLOAD = 8192 // ev kaydı (40 eşya) 2 KB'ı aşabilir
const BIG_TYPES = new Set(['voice'])
const CHAT_COOLDOWN_MS = 700
const CHAT_MAX = 140

// ---- etkileşim ----
const REACTIONS = new Set(['❤️', '😘', '😍', '🥰', '😂', '😳', '🔥', '👋', '😉', '🥺', '💃', '🎉'])
const GESTURES = { heart: '💗', flower: '🌸', wink: '😉', wave: '👋', kiss: '😘', dance: '💃' }
const WHISPER_RANGE = 7 // m: fısıldamak için bu kadar yakın olmalısın
const WITNESS_RANGE = 12 // m: bu mesafedekiler "fısıldıyor 🤫" görür (metni görmez)
const GESTURE_RANGE = 8
const MATCH_WINDOW_MS = 10 * 60 * 1000 // karşılıklı kalp için süre

const AVATARS = new Set(['zeynep', 'deniz', 'elif', 'kaan', 'mira', 'ege'])
const ANIMS = ['idle', 'walk', 'run']

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
  const broadcast = (msg, exceptId, room, from) => {
    const data = JSON.stringify(msg)
    for (const p of players.values()) {
      if (p.id === exceptId || (room && p.room !== room) || p.ws.readyState !== 1) continue
      if (from && mod.blockedPair(from, p)) continue
      p.ws.send(data)
    }
  }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)
  const inRoom = (room, exceptId) => [...players.values()].filter((p) => p.room === room && p.id !== exceptId)

  // ---- özellik modülleri (server/features) ----
  const ctx = { players, send, broadcast: (...a) => broadcast(...a), dist, inRoom, clean, homeKey, publicInfo }
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

  const changeRoom = (p, room) => {
    if (p.room === room) return
    emit('onRoomChange', p) // özellik modülleri (oturma/dans) eski odadaki durumunu temizler
    broadcast({ t: 'leave', id: p.id }, p.id, p.room)
    p.room = room
    p.dirty = false
    const key = room.startsWith('home:') ? room.slice(5) : null
    send(p.ws, {
      t: 'room',
      room,
      venue: venueIdOf(room),
      owner: key,
      ownerName: key ? ownerNameOf(key) : null,
      items: key ? (getHome(key)?.items ?? []) : [],
      players: inRoom(room, p.id).map(publicInfo),
    })
    broadcast({ t: 'join', p: publicInfo(p) }, p.id, room)
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
    if (wanted && wanted !== prof.avatar) saveAvatar(u.id, wanted).catch(() => {})
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
      // lobi meydanında, çeşmenin güneyinde rastgele bir yere doğ
      x: (Math.random() - 0.5) * 6,
      z: 6 + Math.random() * 3,
      ry: Math.PI,
      anim: 'idle',
      dirty: false,
      lastChat: 0,
      room: 'city',
      uid: ident?.uid ?? null,
      photo: ident?.photo ?? null,
      photoHidden: ident?.photoHidden ?? false,
    }
    me.homeKey = ident ? ident.uid : legacyKey(guestName)
    me.key = me.homeKey // kalıcı kimlik anahtarı (Supabase modunda auth uid; demo/misafirde addan türer)
    players.set(me.id, me)
    emit('onJoin', me)
    send(me.ws, {
      ...Object.assign({}, ...features.map((f) => f.welcome?.(me) ?? {})),
      t: 'welcome',
      id: me.id,
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
    broadcast({ t: 'online', n: players.size })
    return me
  }

  wss.on('connection', (ws) => {
    let me = null
    let joining = false
    ws.isAlive = true
    ws.on('pong', () => (ws.isAlive = true))

    ws.on('message', (raw) => {
      let msg
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }
      if (!msg || typeof msg.t !== 'string') return
      if (raw.length > MAX_TEXT_PAYLOAD && !BIG_TYPES.has(msg.t)) return

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
            me = createPlayer({ ...msg, __ws: ws }, ident)
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
      if (handler) return handler(me, msg)

      if (msg.t === 'move') {
        const mx = num(msg.x, WORLD_HALF)
        const mz = num(msg.z, WORLD_HALF)
        if (features.some((f) => f.moveVeto?.(me, mx, mz))) return // oturuyor/dans ediyor: konum kilitli
        me.x = mx
        me.z = mz
        me.ry = num(msg.ry, 10)
        me.anim = ANIMS.includes(msg.anim) ? msg.anim : 'idle'
        me.dirty = true
        emit('onMove', me)
      } else if (msg.t === 'room') {
        const room = msg.to === 'venue' ? (typeof msg.id === 'string' ? venueRoom(msg.id) : 'city') : msg.to === 'home' ? `home:${typeof msg.owner === 'string' ? homeKey(msg.owner) : me.homeKey}` : 'city'
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
      } else if (msg.t === 'home_open') {
        setOpen(me.homeKey, me.name, msg.open)
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
        if (!REACTIONS.has(msg.e) || now - (me.lastReact ?? 0) < 500) return
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
        if (dist(me, target) > WHISPER_RANGE) return send(ws, { t: 'info', text: `🤫 ${target.name} çok uzakta. Fısıldamak için biraz yaklaş.` })
        if (refuse(me, target, 'whisper')) return
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
          broadcast({ t: 'chat', id: me.id, name: me.name, text, ts: now }, undefined, me.room, me)
          emitEvent(me, 'chat')
        }
      }
    })

    ws.on('close', () => {
      if (!me) return
      players.delete(me.id)
      emit('onLeave', me)
      for (const set of invites.values()) set.delete(me.id)
      for (const o of players.values()) o.hearts?.delete(me.id)
      broadcast({ t: 'leave', id: me.id }, undefined, me.room)
      broadcast({ t: 'online', n: players.size })
    })
    ws.on('error', () => ws.terminate())
  })

  // değişen konumları toplu yayınla
  const tick = setInterval(() => {
    const changed = []
    for (const p of players.values()) {
      if (!p.dirty) continue
      p.dirty = false
      changed.push([p.room, p.id, +p.x.toFixed(2), +p.z.toFixed(2), +p.ry.toFixed(2), ANIMS.indexOf(p.anim)])
    }
    if (!changed.length) return
    for (const p of players.values()) {
      const others = changed.filter((c) => c[0] === p.room && c[1] !== p.id).map((c) => c.slice(1))
      if (others.length) send(p.ws, { t: 'state', p: others })
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

  return { online: () => players.size }
}
