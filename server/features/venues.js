// Mekân etkinlikleri: Gece Kulübü karaokesi (sunucu otoriter kuyruk, sahne süresi, alkış sayacı).
// (Mekânlara girme: game.js `room`; mekân içi oturma: features/together.js; iç mekân verisi: src/world/venueLayout.js.)
//
// İstemci → sunucu (yalnızca Gece Kulübü odasında geçerli)
//   { t: 'kar_get' }                      durumu iste (odaya girince)
//   { t: 'kar_join', song }               sıraya gir (song: karaokeSongs.js kimliği)
//   { t: 'kar_leave' }                    sıradan çık / sahneden in
//   { t: 'kar_clap' }                     şarkıcıyı alkışla (👏)
// Sunucu → istemci
//   { t: 'kar', queue: [{ id, name, song }], now: { id, name, song, left, dur, claps } | null }   durum (alıcıya göre engelliler süzülür)
//   { t: 'kar_turn', x, z, ry, song, dur }                          sıran geldi: sahneye ışınlan
//   { t: 'kar_claps', n }                                            şarkıcının alkış sayısı (≤ 2 Hz)
//   { t: 'kar_end', name, song, claps }                              tur bitti (sonuç kartı)
// Olaylar (ctx.emitEvent): karaoke (şarkıcıya, sıra geldiğinde), applause (alkışlayana; karşı = şarkıcı)
import { KARAOKE_QUEUE_MAX, KARAOKE_SONG_BY_ID, KARAOKE_STAGE_MS, KARAOKE_VENUE } from '../../src/world/karaokeSongs.js'
import { venueIdOf } from '../../src/world/venues.js'
import { venueLayout } from '../../src/world/venueLayout.js'

const isKarVenue = (p) => Boolean(p && venueIdOf(p.room) === KARAOKE_VENUE)
const GAP_MS = 2500 // iki tur arası
const CLAP_COOLDOWN_MS = 350
const CLAP_MAX = 400 // tur başına üst sınır
const WALK_AWAY = 3.5 // m: sahneden bu kadar uzaklaşırsan tur biter
const GRACE_MS = 2200 // ışınlanma sonrası eski konumlu paketler yok sayılır

export default function venues(ctx) {
  const { players, send, broadcast } = ctx
  const mod = () => ctx.features[0].api
  const spot = venueLayout(KARAOKE_VENUE).karaoke.spot

  const queue = [] // oyuncu id'leri
  const songOf = new Map() // oyuncu id → şarkı kimliği
  let now = null // { id, song, start, claps, sent, timer }
  let gapTimer = null
  let clapTimer = null

  const inRoom = () => [...players.values()].filter((p) => isKarVenue(p))

  const stateFor = (viewer) => {
    const ok = (p) => p && !mod().blockedPair(viewer, p)
    const q = queue.map((id) => players.get(id)).filter(ok).map((p) => ({ id: p.id, name: p.name, song: songOf.get(p.id) }))
    const s = now && ok(players.get(now.id)) ? now : null
    return {
      t: 'kar',
      queue: q,
      now: s ? { id: s.id, name: players.get(s.id).name, song: s.song, left: Math.max(0, KARAOKE_STAGE_MS - (Date.now() - s.start)), dur: KARAOKE_STAGE_MS, claps: s.claps } : null,
    }
  }
  const pushState = (only) => {
    for (const p of only ? [only] : inRoom()) send(p.ws, stateFor(p))
  }

  const finish = (why) => {
    if (!now) return
    const cur = now
    now = null
    clearTimeout(cur.timer)
    const singer = players.get(cur.id)
    const name = singer?.name ?? ''
    for (const p of inRoom()) if (!singer || !mod().blockedPair(p, singer)) send(p.ws, { t: 'kar_end', name, song: cur.song, claps: cur.claps, why })
    pushState()
    clearTimeout(gapTimer)
    gapTimer = setTimeout(startNext, GAP_MS)
  }

  function startNext() {
    gapTimer = null
    if (now) return
    while (queue.length) {
      const id = queue.shift()
      const p = players.get(id)
      const song = songOf.get(id)
      songOf.delete(id)
      if (!isKarVenue(p)) continue
      // oturuyorsa kaldır (together modülü koltuğu bırakır)
      if (p.pose) {
        p.lastPoseEnd = 0
        ctx.features.find((f) => f.handlers?.pose_end)?.handlers.pose_end(p)
      }
      p.x = spot.x
      p.z = spot.z
      p.ry = spot.ry
      p.anim = 'idle'
      p.dirty = true
      p.karUntil = Date.now() + GRACE_MS
      now = { id, song, start: Date.now(), claps: 0, sent: 0, timer: setTimeout(() => finish('time'), KARAOKE_STAGE_MS) }
      ctx.grace?.(p, 4000)
      send(p.ws, { t: 'kar_turn', x: spot.x, z: spot.z, ry: spot.ry, song, dur: KARAOKE_STAGE_MS })
      broadcast({ t: 'react', id, e: '🎤' }, undefined, p.room, p)
      ctx.emitEvent?.(p, 'karaoke', 1)
      pushState()
      return
    }
    pushState()
  }

  const drop = (me) => {
    const i = queue.indexOf(me.id)
    if (i >= 0) queue.splice(i, 1)
    songOf.delete(me.id)
    if (now?.id === me.id) finish('left')
    else if (i >= 0) pushState()
  }

  const handlers = {
    kar_get(me) {
      if (!isKarVenue(me)) return
      const t = Date.now()
      if (t - (me.lastKarGet ?? 0) < 500) return
      me.lastKarGet = t
      pushState(me)
    },
    kar_join(me, msg) {
      if (!isKarVenue(me)) return
      const t = Date.now()
      if (t - (me.lastKarJoin ?? 0) < 1000) return
      me.lastKarJoin = t
      const song = typeof msg.song === 'string' && Object.hasOwn(KARAOKE_SONG_BY_ID, msg.song) ? msg.song : null
      if (!song) return
      if (now?.id === me.id || queue.includes(me.id)) return send(me.ws, { t: 'info', text: '🎤 Zaten sıradasın.' })
      if (queue.length >= KARAOKE_QUEUE_MAX) return send(me.ws, { t: 'info', text: '🎤 Sıra dolu, biraz sonra tekrar dene.' })
      queue.push(me.id)
      songOf.set(me.id, song)
      send(me.ws, { t: 'info', text: `🎤 Karaoke sırasına girdin (${queue.length}. sıra).` })
      if (!now && !gapTimer) startNext()
      else pushState()
    },
    kar_leave(me) {
      if (!isKarVenue(me)) return
      drop(me)
    },
    kar_clap(me) {
      if (!isKarVenue(me) || !now || now.id === me.id) return
      const t = Date.now()
      if (t - (me.lastClap ?? 0) < CLAP_COOLDOWN_MS) return
      const singer = players.get(now.id)
      if (!singer || mod().blockedPair(me, singer) || singer.dnd) return // engel / rahatsız etme: sessizce yok say
      me.lastClap = t
      if (now.claps >= CLAP_MAX) return
      now.claps += 1
      broadcast({ t: 'react', id: me.id, e: '👏' }, undefined, me.room, me)
      ctx.emitEvent?.(me, 'applause', 1, singer)
      if (!clapTimer) {
        clapTimer = setTimeout(() => {
          clapTimer = null
          if (!now || now.claps === now.sent) return
          now.sent = now.claps
          for (const p of inRoom()) if (!mod().blockedPair(p, players.get(now.id) ?? p)) send(p.ws, { t: 'kar_claps', n: now.claps })
        }, 500)
      }
    },
  }

  return {
    handlers,
    /** Konum güncellemesi: şarkıcı sahneden uzaklaşırsa tur biter. */
    onMove(me) {
      if (now?.id !== me.id || Date.now() < (me.karUntil ?? 0)) return
      if (Math.hypot(me.x - spot.x, me.z - spot.z) > WALK_AWAY) finish('away')
    },
    onRoomChange: drop,
    onLeave: drop,
  }
}
