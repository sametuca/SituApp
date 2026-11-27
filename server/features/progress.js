// İlerleme: olay veriyolu (ctx.emitEvent), günlük görevler, rozetler, günün önerisi ve sezon etkinlikleri.
//
// Diğer modüller/çekirdek olay bildirir:  ctx.emitEvent?.(me, tip, n = 1, karşı?)
//   karşı = oyuncu nesnesi ya da kişi anahtarı (farklı kişi sayımı ve "farklı X" görevleri için).
//   me yalnızca { key } de olabilir (çevrimdışı ev sahibi gibi); bildirim çevrimiçiyse iletilir.
// Bilinen olay tipleri: chat, whisper, gesture, gesture_<kind> (wave, heart…), match, react, zone (karşı = mekan id),
//   home_visit, guest (evime biri geldi; karşı = ziyaretçi), invite, furnish (n = eşya sayısı), night,
//   game_played, npc_talk (karşı = NPC kimliği), collect (karşı = tür), collect_star, treasure (karşı = sandık id), photo (başka modüller gönderir). Bilinmeyen tipler stats[tip] sayacına eklenir.
// Sayaçlar store.user(key).stats'ta; kişi/mekan kümeleri (peers, zones, guests) { anahtar: 1 } nesneleridir.
// Günler Europe/Istanbul saatine göre değişir.
import { save, user } from '../store.js'
import { zoneAt } from '../../src/world/layout.js'

// ---------------------------------------------------------------- zaman
const FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Istanbul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
})
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export function istanbul(now = Date.now()) {
  const p = Object.fromEntries(FMT.formatToParts(now).map((x) => [x.type, x.value]))
  return { day: `${p.year}-${p.month}-${p.day}`, y: +p.year, m: +p.month, d: +p.day, hour: +p.hour, wd: WEEKDAYS.indexOf(p.weekday) }
}
const shiftDay = (day, delta) => new Date(Date.parse(`${day}T12:00:00Z`) + delta * 86400000).toISOString().slice(0, 10)

// ---------------------------------------------------------------- etkinlikler
const EVENTS = {
  valentine: { id: 'valentine', emoji: '💘', name: 'Sevgililer Günü Haftası', fx: 'hearts', desc: 'Şehir kalp balonlarıyla süslendi! Bu hafta birine kalp göndermek için en güzel zaman 💗' },
  newyear: { id: 'newyear', emoji: '🎄', name: 'Yılbaşı Haftası', fx: 'snow', desc: 'Kar yağıyor, şehir yılbaşına hazırlanıyor. Yeni yıla birlikte girelim! ❄️' },
  mothers: { id: 'mothers', emoji: '💐', name: 'Anneler Günü Haftası', fx: 'flowers', desc: 'Bu hafta çiçekler açıyor. Sevdiklerine bir çiçek gönder 🌸' },
  party: { id: 'party', emoji: '🪩', name: 'Cuma Gecesi Kulüp Partisi', fx: 'confetti', desc: 'Her Cuma 21:00-24:00 arası konfetiler havada! Gece Kulübü’nde dans zamanı 💃🎉' },
}

/** Verilen ana göre aktif etkinlik (ya da null). SITUAPP_EVENT=valentine|newyear|mothers|party ile zorlanabilir. */
export function activeEvent(now = Date.now()) {
  const forced = process.env.SITUAPP_EVENT
  if (forced) return EVENTS[forced] ?? null
  const t = istanbul(now)
  if (t.m === 2 && t.d >= 8 && t.d <= 14) return EVENTS.valentine
  if ((t.m === 12 && t.d >= 27) || (t.m === 1 && t.d <= 2)) return EVENTS.newyear
  if (t.m === 5) {
    const dow = new Date(Date.UTC(t.y, 4, 1)).getUTCDay()
    const secondSunday = 1 + ((7 - dow) % 7) + 7
    if (t.d >= secondSunday - 6 && t.d <= secondSunday) return EVENTS.mothers
  }
  if (t.wd === 5 && t.hour >= 21) return EVENTS.party
  return null
}

// ---------------------------------------------------------------- görevler
const QUESTS = [
  { id: 'greet3', ev: 'gesture_wave', distinct: true, goal: 3, stars: 2, emoji: '👋', title: '3 kişiye selam ver' },
  { id: 'whisper1', ev: 'whisper', goal: 1, stars: 1, emoji: '🤫', title: '1 fısıltı gönder' },
  { id: 'zones2', ev: 'zone', distinct: true, goal: 2, stars: 2, emoji: '🧭', title: '2 farklı mekanı gez' },
  { id: 'visit1', ev: 'home_visit', goal: 1, stars: 2, emoji: '🏠', title: 'Bir eve misafir ol' },
  { id: 'react5', ev: 'react', goal: 5, stars: 1, emoji: '😊', title: '5 emoji tepkisi gönder' },
  { id: 'npc2', ev: 'npc_talk', distinct: true, goal: 2, stars: 2, emoji: '🗣️', title: '2 farklı karakterle konuş' },
  { id: 'heart1', ev: 'gesture_heart', goal: 1, stars: 1, emoji: '💗', title: 'Birine kalp gönder' },
  { id: 'collect5', ev: 'collect_star', goal: 5, stars: 2, emoji: '⭐', title: '5 yıldız parçası topla' },
  { id: 'treasure1', ev: 'treasure', goal: 1, stars: 3, emoji: '🧰', title: 'Bir gizli hazine bul' },
]
const QUEST_BY_ID = Object.fromEntries(QUESTS.map((q) => [q.id, q]))
const DAILY_COUNT = 3

// ---------------------------------------------------------------- rozetler
const size = (o) => Object.keys(o ?? {}).length
const BADGES = [
  { id: 'first_match', emoji: '💞', name: 'İlk Eşleşme', desc: 'Biriyle karşılıklı kalp gönderdin.', goal: 1, value: (s) => s.matches ?? 0 },
  { id: 'gestures50', emoji: '🎁', name: '50 Jest', desc: '50 jest gönder (kalp, çiçek, selam…).', goal: 50, value: (s) => s.gestures ?? 0 },
  { id: 'msgs100', emoji: '💬', name: '100 Mesaj', desc: '100 mesaj yaz (sohbet, fısıltı, çıkartma, sesli).', goal: 100, value: (s) => s.chat ?? 0 },
  { id: 'homeowner', emoji: '🛋️', name: 'Ev Sahibi', desc: 'Evine ilk mobilyayı yerleştir.', goal: 1, value: (s) => s.furnish ?? 0 },
  { id: 'butterfly', emoji: '🦋', name: 'Sosyal Kelebek', desc: '20 farklı kişiyle etkileşime gir.', goal: 20, value: (s) => size(s.peers) },
  { id: 'nightowl', emoji: '🦉', name: 'Gece Kuşu', desc: 'Gece 00:00-05:00 arasında oyuna gir.', goal: 1, value: (s) => s.night ?? 0 },
  { id: 'whisper_master', emoji: '🤫', name: 'Fısıltı Ustası', desc: '25 fısıltı gönder.', goal: 25, value: (s) => s.whispers ?? 0 },
  { id: 'explorer', emoji: '🧭', name: 'Gezgin', desc: '5 farklı mekanı gez.', goal: 5, value: (s) => size(s.zones) },
  { id: 'host', emoji: '🏡', name: 'Misafirperver', desc: '3 farklı kişiyi evinde ağırla.', goal: 3, value: (s) => size(s.guests) },
  { id: 'player', emoji: '🎮', name: 'Oyuncu', desc: 'Bir mini oyun oyna.', goal: 1, value: (s) => s.games ?? 0 },
  { id: 'photographer', emoji: '📸', name: 'Fotoğrafçı', desc: 'İlk fotoğrafını çek.', goal: 1, value: (s) => s.photos ?? 0 },
  { id: 'chatty', emoji: '🗣️', name: 'Sohbetçi', desc: '10 farklı karakterle (NPC) konuş.', goal: 10, value: (s) => size(s.npcs) },
  { id: 'collector', emoji: '🧺', name: 'Koleksiyoncu', desc: '100 toplanabilir topla (yıldız, kalp taşı, çiçek…).', goal: 100, value: (s) => s.collected ?? 0 },
  { id: 'treasure_hunter', emoji: '🧰', name: 'Hazine Avcısı', desc: '5 farklı gizli hazine sandığı bul.', goal: 5, value: (s) => size(s.chests) },
  { id: 'gardener', emoji: '🌸', name: 'Çiçek Bahçıvanı', desc: '30 çiçek topla.', goal: 30, value: (s) => s.collectKinds?.flower ?? 0 },
  { id: 'streak', emoji: '🔥', name: 'Günlük Seri', desc: '3 gün üst üste en az bir günlük görev tamamla.', goal: 3, value: (s) => s.streak ?? 0 },
]

const PEER_CAP = 300
const shuffle = (a) => {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

export default function progress(ctx) {
  const { players, send, broadcast } = ctx
  const mod = () => ctx.features[0].api
  const online = (key) => [...players.values()].find((p) => p.key === key)
  const push = (key, msg) => {
    const p = online(key)
    if (p) send(p.ws, msg)
  }

  let current = activeEvent()

  /** Kullanıcının bugünkü görevlerini hazırlar (gün değiştiyse yeniler). true = yenilendi. */
  function ensureQuests(u) {
    const today = istanbul().day
    if (u.quests?.day === today) return false
    const picked = shuffle(QUESTS).slice(0, DAILY_COUNT)
    u.quests = { day: today, list: picked.map((q) => ({ id: q.id, progress: 0, done: false, seen: {} })), suggest: null }
    return true
  }

  const streakNow = (s, today) => (s.lastQuestDay === today || s.lastQuestDay === shiftDay(today, -1) ? (s.streak ?? 0) : 0)

  function stateOf(u) {
    ensureQuests(u)
    const s = u.stats
    const today = u.quests.day
    return {
      day: today,
      stars: s.stars ?? 0,
      streak: streakNow(s, today),
      quests: u.quests.list.map((q) => {
        const d = QUEST_BY_ID[q.id]
        return { id: q.id, emoji: d.emoji, title: d.title, goal: d.goal, stars: d.stars, progress: q.progress, done: q.done }
      }),
      badges: BADGES.map((b) => ({ id: b.id, emoji: b.emoji, name: b.name, desc: b.desc, goal: b.goal, have: Math.min(b.goal, b.value(s)), earned: u.badges.includes(b.id) })),
    }
  }

  const pushState = (key) => {
    const p = online(key)
    if (p) send(p.ws, { t: 'progress', p: stateOf(user(key)) })
  }

  /** Olay bildir. me: oyuncu ya da { key }; peer: karşıdaki oyuncu / anahtar / mekan id'si. */
  function emitEvent(me, type, n = 1, peer) {
    if (!me?.key || typeof type !== 'string') return
    n = Number.isFinite(n) ? Math.max(0, Math.min(1000, n)) : 1
    const u = user(me.key)
    ensureQuests(u)
    const s = u.stats
    const pk = typeof peer === 'string' ? peer : peer?.key
    const addPeer = () => {
      if (!pk || pk === me.key || (s.peers && s.peers[pk])) return
      s.peers = s.peers ?? {}
      if (size(s.peers) < PEER_CAP) s.peers[pk] = 1
    }
    switch (type) {
      case 'chat':
        s.chat = (s.chat ?? 0) + n
        addPeer()
        break
      case 'whisper':
        s.whispers = (s.whispers ?? 0) + n
        s.chat = (s.chat ?? 0) + n
        addPeer()
        break
      case 'gesture':
        s.gestures = (s.gestures ?? 0) + n
        addPeer()
        break
      case 'match':
        s.matches = (s.matches ?? 0) + n
        addPeer()
        break
      case 'invite':
        s.invites = (s.invites ?? 0) + n
        addPeer()
        break
      case 'zone':
        if (pk) (s.zones = s.zones ?? {})[pk] = 1
        break
      case 'guest':
        if (pk && pk !== me.key) (s.guests = s.guests ?? {})[pk] = 1
        break
      case 'furnish':
        s.furnish = Math.max(s.furnish ?? 0, n)
        break
      case 'night':
        s.night = 1
        break
      case 'game_played':
        s.games = (s.games ?? 0) + n
        break
      case 'npc_talk':
        s.npcTalks = (s.npcTalks ?? 0) + n
        if (pk) (s.npcs = s.npcs ?? {})[pk] = 1
        break
      case 'photo':
        s.photos = (s.photos ?? 0) + n
        break
      case 'collect': // toplanabilir (karşı = tür); zaman damgaları s.collect'te (features/collect.js)
        s.collected = (s.collected ?? 0) + n
        if (pk) (s.collectKinds = s.collectKinds ?? {})[pk] = (s.collectKinds[pk] ?? 0) + n
        break
      case 'treasure': // gizli sandık bulundu (karşı = sandık id)
        if (pk) (s.chests = s.chests ?? {})[pk] = 1
        break
      default:
        if (/^[a-z_]{1,24}$/.test(type)) s[type] = (s[type] ?? 0) + n
    }

    const target = online(me.key)
    let changed = false
    // görevler
    for (const q of u.quests.list) {
      const d = QUEST_BY_ID[q.id]
      if (q.done || d.ev !== type) continue
      if (d.distinct) {
        if (!pk || pk === me.key || q.seen[pk]) continue
        q.seen[pk] = 1
        q.progress = size(q.seen)
      } else q.progress = Math.min(d.goal, q.progress + n)
      changed = true
      if (q.progress >= d.goal) {
        q.done = true
        s.stars = (s.stars ?? 0) + d.stars
        const today = u.quests.day
        if (s.lastQuestDay !== today) {
          s.streak = s.lastQuestDay === shiftDay(today, -1) ? (s.streak ?? 0) + 1 : 1
          s.lastQuestDay = today
        }
        if (target) send(target.ws, { t: 'quest_done', quest: { id: d.id, emoji: d.emoji, title: d.title, stars: d.stars }, stars: s.stars })
      }
    }
    // rozetler
    for (const b of BADGES) {
      if (u.badges.includes(b.id) || b.value(s) < b.goal) continue
      u.badges.push(b.id)
      changed = true
      if (target) send(target.ws, { t: 'badge', badge: { id: b.id, emoji: b.emoji, name: b.name, desc: b.desc } })
    }
    // Pasif stat artışı & Uyum XP: sohbet/jest/fotoğraf → Karizma + Bond, oyunlar → Beceri
    if (type === 'chat' || type === 'whisper') {
      ctx.bumpStat?.(me, 'cha', 0.15)
      if (peer && type === 'whisper') ctx.addBond?.(me, peer, 5, false)
    } else if (type === 'gesture' || type === 'photo' || type === 'match') {
      ctx.bumpStat?.(me, 'cha', 0.35)
      if (peer) ctx.addBond?.(me, peer, type === 'match' ? 30 : 8, type === 'match')
    } else if (type === 'game_played') ctx.bumpStat?.(me, 'ski', 0.5)

    save()
    if (changed) pushState(me.key)
  }
  ctx.emitEvent = emitEvent
  ctx.pushProgress = pushState

  // gün/etkinlik değişimlerini izle (dakikada bir kontrol)
  const timer = setInterval(() => {
    const ev = activeEvent()
    if ((ev?.id ?? null) !== (current?.id ?? null)) {
      current = ev
      broadcast({ t: 'event', event: current })
    }
    for (const p of players.values()) if (ensureQuests(user(p.key))) pushState(p.key)
  }, 30000)
  timer.unref?.()

  // ---- günün önerisi ----
  const tagsOf = (key) => {
    const t = user(key).profile?.tags
    return Array.isArray(t) ? t.filter((x) => typeof x === 'string').map((x) => x.slice(0, 24)) : []
  }
  const suggestionCard = (me, o) => {
    const mine = new Set(tagsOf(me.key))
    const common = tagsOf(o.key).filter((t) => mine.has(t)).slice(0, 3)
    return { id: o.id, name: o.name, avatar: o.avatar, common: common.map((t) => mod().censor(t)) }
  }
  const closeSuggest = (me) => {
    const u = user(me.key)
    ensureQuests(u)
    u.quests.suggest = { ...(u.quests.suggest ?? {}), closed: true }
    me.suggestTarget = null
    save()
  }

  return {
    api: { emitEvent, activeEvent: () => current },
    onJoin(me) {
      const u = user(me.key)
      ensureQuests(u)
      me.zoneId = zoneAt(me.x, me.z).id
      ;(u.stats.zones = u.stats.zones ?? {})[me.zoneId] = 1
      save()
      if (istanbul().hour < 5) setTimeout(() => players.has(me.id) && emitEvent(me, 'night'), 4000)
    },
    onMove(me) {
      if (me.room !== 'city') return
      const id = zoneAt(me.x, me.z).id
      if (id === me.zoneId || id === 'city') return
      me.zoneId = id
      emitEvent(me, 'zone', 1, id)
    },
    welcome: (me) => ({ progress: stateOf(user(me.key)), event: current }),
    handlers: {
      progress_get(me) {
        const now = Date.now()
        if (now - (me.lastProgressGet ?? 0) < 1000) return
        me.lastProgressGet = now
        send(me.ws, { t: 'progress', p: stateOf(user(me.key)) })
      },
      suggest_get(me) {
        const now = Date.now()
        if (now - (me.lastSuggestGet ?? 0) < 5000) return
        me.lastSuggestGet = now
        const u = user(me.key)
        ensureQuests(u)
        const sg = u.quests.suggest
        if (sg?.closed) return send(me.ws, { t: 'suggest', s: null })
        const ok = (o) => o.id !== me.id && o.key !== me.key && !o.dnd && !mod().blockedPair(me, o)
        const candidates = [...players.values()].filter(ok)
        let pick = sg?.key ? candidates.find((o) => o.key === sg.key) : null
        if (!pick && candidates.length) {
          const mine = new Set(tagsOf(me.key))
          const score = (o) => tagsOf(o.key).filter((t) => mine.has(t)).length * 10 + Math.random()
          pick = candidates.sort((a, b) => score(b) - score(a))[0]
          u.quests.suggest = { key: pick.key }
          save()
        }
        if (!pick) return send(me.ws, { t: 'suggest', s: null, wait: true })
        me.suggestTarget = pick.id
        send(me.ws, { t: 'suggest', s: suggestionCard(me, pick) })
      },
      suggest_close(me) {
        closeSuggest(me)
      },
      suggest_hi(me) {
        const target = me.suggestTarget ? players.get(me.suggestTarget) : null
        closeSuggest(me)
        const now = Date.now()
        if (!target || target.id === me.id || now - (me.lastGesture ?? 0) < 800) return send(me.ws, { t: 'info', text: 'Bu kişi artık çevrimiçi değil.' })
        const why = mod().reach(me, target, 'gesture')
        if (why) return why.text && send(me.ws, { t: 'info', text: why.text })
        me.lastGesture = now
        send(target.ws, { t: 'gesture', id: me.id, name: me.name, avatar: me.avatar, kind: 'wave', emoji: '👋' })
        send(me.ws, { t: 'info', text: `👋 ${target.name} kişisine selam gönderdin.` })
        emitEvent(me, 'gesture', 1, target)
        emitEvent(me, 'gesture_wave', 1, target)
      },
    },
  }
}
