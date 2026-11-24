// Küçük iş: Gece Kulübü'nde DJ olma. Sunucu otoriter vardiya kuyruğu, bağlantı doğrulama (yalnızca YouTube/Spotify),
// kazanç (dinleyici başına altın + 🔥 bahşişi). Ham bağlantı saklanmaz/yayılmaz; yalnızca doğrulanmış { p, kind, id } gider.
//
// İstemci → sunucu (yalnızca Gece Kulübü odasında)
//   { t: 'dj_get' }              durumu iste (odaya girince)
//   { t: 'dj_join' }             DJ sırasına gir
//   { t: 'dj_leave' }            sıradan çık / vardiyayı bitir
//   { t: 'dj_play', url }        (DJ) bir YouTube/Spotify bağlantısı çal
//   { t: 'dj_stop' }             (DJ) çalmayı durdur
//   { t: 'dj_fire' }             (dinleyici) 🔥 bahşiş: DJ'e +1 altın
// Sunucu → istemci
//   { t: 'dj', ts, queue: [{ id, name }], now: { id, name, left, dur, track: { p, kind, id, at } | null, fire, tracks } | null }
//   { t: 'dj_turn', x, z, ry, dur }     sıran geldi: DJ noktasına ışınlan
//   { t: 'dj_fire', n }                 vardiyadaki 🔥 sayısı (≤ 2 Hz)
//   { t: 'dj_end', earned, fire, tracks, why }   (yalnızca DJ'e) vardiya özeti
// Olaylar (ctx.emitEvent): dj_shift (DJ), dj_track (DJ), dj_fire (bahşiş verene; karşı = DJ)
// Altın: ctx.addCoins (features/economy.js): 30 sn'de bir dinleyiciye göre (≤ 4), 🔥 başına 1, vardiya tamamlanınca +5.
import { parseTrack } from '../../src/world/djLinks.js'
import { venueLayout } from '../../src/world/venueLayout.js'
import { venueRoom } from '../../src/world/venues.js'

const VENUE = 'kulup'
const ROOM = venueRoom(VENUE)
const SHIFT_MS = 10 * 60 * 1000
const QUEUE_MAX = 4
const GAP_MS = 2000
const PLAY_GAP_MS = 4000
const TRACKS_MAX = 25
const WALK_AWAY = 4 // m: DJ noktasından bu kadar uzaklaşırsan vardiya biter
const GRACE_MS = 2200
const TICK_MS = 30000
const LISTENER_COIN_CAP = 4
const FIRE_COOLDOWN_MS = 3000
const FIRE_MAX = 120
const SHIFT_BONUS = 5

export default function dj(ctx) {
  const { players, send, broadcast } = ctx
  const mod = () => ctx.features[0].api
  const spot = venueLayout(VENUE).dj.spot

  const queue = [] // oyuncu id'leri
  let now = null // { id, start, track, trackAt, tracks, fire, sentFire, earned, lastPlay, timer, tick, fireTimer }
  let gapTimer = null

  const inRoom = () => [...players.values()].filter((p) => p.room === ROOM)

  const stateFor = (viewer) => {
    const ok = (p) => p && !mod().blockedPair(viewer, p)
    const q = queue.map((id) => players.get(id)).filter(ok).map((p) => ({ id: p.id, name: p.name }))
    const d = now && ok(players.get(now.id)) ? players.get(now.id) : null
    return {
      t: 'dj',
      ts: Date.now(),
      queue: q,
      now: d
        ? { id: d.id, name: d.name, left: Math.max(0, SHIFT_MS - (Date.now() - now.start)), dur: SHIFT_MS, track: now.track ? { ...now.track, at: now.trackAt } : null, fire: now.fire, tracks: now.tracks }
        : null,
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
    clearInterval(cur.tick)
    clearTimeout(cur.fireTimer)
    const d = players.get(cur.id)
    if (d) {
      let bonus = 0
      if (why === 'time' && cur.tracks > 0) {
        bonus = SHIFT_BONUS
        ctx.addCoins?.(d, bonus, 'dj')
      }
      send(d.ws, { t: 'dj_end', earned: cur.earned + bonus, fire: cur.fire, tracks: cur.tracks, why })
    }
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
      if (!p || p.room !== ROOM) continue
      if (p.pose) {
        p.lastPoseEnd = 0
        ctx.features.find((f) => f.handlers?.pose_end)?.handlers.pose_end(p)
      }
      p.x = spot.x
      p.z = spot.z
      p.ry = spot.ry
      p.anim = 'idle'
      p.dirty = true
      p.djUntil = Date.now() + GRACE_MS
      const cur = { id, start: Date.now(), track: null, trackAt: 0, tracks: 0, fire: 0, sentFire: 0, earned: 0, lastPlay: 0, fireTimer: null }
      cur.timer = setTimeout(() => finish('time'), SHIFT_MS)
      cur.tick = setInterval(() => {
        if (now !== cur || !cur.track) return
        const dj = players.get(cur.id)
        if (!dj) return
        const listeners = inRoom().filter((o) => o.id !== dj.id && !mod().blockedPair(o, dj)).length
        if (!listeners) return
        const c = Math.min(LISTENER_COIN_CAP, Math.ceil(listeners / 2))
        cur.earned += c
        ctx.addCoins?.(dj, c, 'dj')
      }, TICK_MS)
      now = cur
      send(p.ws, { t: 'dj_turn', x: spot.x, z: spot.z, ry: spot.ry, dur: SHIFT_MS })
      broadcast({ t: 'react', id, e: '🎉' }, undefined, ROOM, p)
      ctx.emitEvent?.(p, 'dj_shift', 1)
      pushState()
      return
    }
    pushState()
  }

  const drop = (me) => {
    const i = queue.indexOf(me.id)
    if (i >= 0) queue.splice(i, 1)
    if (now?.id === me.id) finish('left')
    else if (i >= 0) pushState()
  }

  const handlers = {
    dj_get(me) {
      if (me.room !== ROOM) return
      const t = Date.now()
      if (t - (me.lastDjGet ?? 0) < 500) return
      me.lastDjGet = t
      pushState(me)
    },
    dj_join(me) {
      if (me.room !== ROOM) return
      const t = Date.now()
      if (t - (me.lastDjJoin ?? 0) < 1000) return
      me.lastDjJoin = t
      if (now?.id === me.id || queue.includes(me.id)) return send(me.ws, { t: 'info', text: '🎧 Zaten sıradasın.' })
      if (queue.length >= QUEUE_MAX) return send(me.ws, { t: 'info', text: '🎧 DJ sırası dolu, biraz sonra tekrar dene.' })
      queue.push(me.id)
      send(me.ws, { t: 'info', text: `🎧 DJ sırasına girdin (${queue.length}. sıra).` })
      if (!now && !gapTimer) startNext()
      else pushState()
    },
    dj_leave(me) {
      if (me.room !== ROOM) return
      drop(me)
    },
    dj_play(me, msg) {
      if (me.room !== ROOM || now?.id !== me.id) return
      const t = Date.now()
      if (t - now.lastPlay < PLAY_GAP_MS) return send(me.ws, { t: 'info', text: '🎧 Biraz yavaş, her şarkı arasında birkaç saniye bekle.' })
      if (now.tracks >= TRACKS_MAX) return send(me.ws, { t: 'info', text: '🎧 Bu vardiyadaki şarkı sınırına ulaştın.' })
      const track = parseTrack(msg.url)
      if (!track) return send(me.ws, { t: 'info', text: '🎧 Geçerli bir YouTube ya da Spotify bağlantısı yapıştır.' })
      now.lastPlay = t
      now.track = track
      now.trackAt = t
      now.tracks += 1
      mod().remember(me, 'dj', `${track.p}:${track.kind}:${track.id}`)
      ctx.emitEvent?.(me, 'dj_track', 1)
      pushState()
    },
    dj_stop(me) {
      if (me.room !== ROOM || now?.id !== me.id || !now.track) return
      now.track = null
      pushState()
    },
    dj_fire(me) {
      if (me.room !== ROOM || !now || now.id === me.id || !now.track) return
      const dj = players.get(now.id)
      if (!dj || mod().blockedPair(me, dj)) return // engel: sessizce yok say
      const t = Date.now()
      if (t - (me.lastFire ?? 0) < FIRE_COOLDOWN_MS) return
      me.lastFire = t
      if (now.fire >= FIRE_MAX) return
      now.fire += 1
      now.earned += 1
      ctx.addCoins?.(dj, 1, 'dj')
      broadcast({ t: 'react', id: me.id, e: '🔥' }, undefined, ROOM, me)
      ctx.emitEvent?.(me, 'dj_fire', 1, dj)
      if (!now.fireTimer) {
        const cur = now
        cur.fireTimer = setTimeout(() => {
          cur.fireTimer = null
          if (now !== cur || cur.fire === cur.sentFire) return
          cur.sentFire = cur.fire
          for (const p of inRoom()) if (!mod().blockedPair(p, players.get(cur.id) ?? p)) send(p.ws, { t: 'dj_fire', n: cur.fire })
        }, 500)
      }
    },
  }

  return {
    handlers,
    /** DJ noktasından uzaklaşırsa vardiya biter. */
    onMove(me) {
      if (now?.id !== me.id || Date.now() < (me.djUntil ?? 0)) return
      if (Math.hypot(me.x - spot.x, me.z - spot.z) > WALK_AWAY) finish('away')
    },
    onRoomChange: drop,
    onLeave: drop,
  }
}
