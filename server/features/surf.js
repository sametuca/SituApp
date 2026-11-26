// Sörf Yarışı (Dalgalardan Kaç!): minimum 2, maksimum 10 kişilik çok oyunculu dalgadan kaçma oyunu + kalıcı puan tablosu.
// Sunucu otoriterdir: lobi, geri sayım, deterministik dalga tohumu (seed), elenme sırası, kazanan, altın ödülü ve liderlik tablosu.
//   istemci → sunucu:
//     { t: 'surf_board' }                 genel puan tablosunu + lobi durumunu iste
//     { t: 'surf_join' }                  sörf lobisine katıl (2..10 kişi)
//     { t: 'surf_leave' }                 lobiden veya aktif maçtan çık
//     { t: 'surf_pos', x, tilt, jump }    sörfçü konumu (0..1 x ekseni, eğim, zıplama)
//     { t: 'surf_out', ms }               dalgaya yakalanıp elendi (hayatta kalma süresi ms)
//   sunucu → istemci:
//     { t: 'surf_board', top, mine }      puan tablosu
//     { t: 'surf_lobby', players, min, max, startsAt }
//     { t: 'surf_start', matchId, seed, startAt, players }
//     { t: 'surf_state', players }        diğer sörfçülerin anlık konum + hayatta kalma durumu
//     { t: 'surf_end', winner, standings, top }
import { allUsers, save, user } from '../store.js'

const MIN_PLAYERS = 2
const MAX_PLAYERS = 10
const COUNTDOWN_MS = 10_000
const TICK_MS = 80
const MAX_MATCH_MS = 180_000

// Puan tablosu kullanıcı verisinde (store.user(key).stats.surf) tutulur → Supabase write-behind ile kalıcı.
const surfOf = (key) => (user(key).stats.surf ??= { name: '', avatar: '', points: 0, wins: 0, games: 0, bestMs: 0 })

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(Number(v)) ? Number(v) : 0))

export default function surf(ctx) {
  const { players, send } = ctx

  const topList = () =>
    Object.entries(allUsers())
      .map(([key, u]) => (u.stats?.surf ? { key, ...u.stats.surf } : null))
      .filter(Boolean)
      .sort((a, b) => b.points - a.points || b.wins - a.wins || a.bestMs - b.bestMs)
      .slice(0, 15)

  const recordResult = (p, rank, survivedMs, totalPlayers) => {
    const key = p.key || p.id
    const cur = surfOf(key)
    const pts = rank === 1 ? 100 : rank === 2 ? 60 : rank === 3 ? 35 : 15
    const coins = rank === 1 ? 30 : rank === 2 ? 18 : rank === 3 ? 10 : 5
    cur.name = p.name
    cur.avatar = p.avatar
    cur.points += pts
    cur.games += 1
    if (rank === 1 && totalPlayers >= 2) cur.wins += 1
    cur.bestMs = Math.max(cur.bestMs, Math.round(survivedMs))
    save()
    ctx.addCoins?.(p, coins, 'surf')
    return { pts, coins }
  }

  // ---- Lobi ----
  const lobby = [] // oyuncu nesneleri
  let lobbyTimer = null
  let startsAt = 0

  const lobbyPayload = () => ({
    t: 'surf_lobby',
    min: MIN_PLAYERS,
    max: MAX_PLAYERS,
    startsAt,
    players: lobby.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar })),
  })

  const broadcastLobby = () => {
    const msg = lobbyPayload()
    for (const p of lobby) if (p.ws.readyState === 1) send(p.ws, msg)
  }

  const cancelLobbyTimer = () => {
    clearTimeout(lobbyTimer)
    lobbyTimer = null
    startsAt = 0
  }

  // ---- Aktif maçlar ----
  let matchSeq = 1
  const matchOf = new Map() // player.id → match

  const startMatch = () => {
    cancelLobbyTimer()
    const roster = lobby.splice(0, MAX_PLAYERS).filter((p) => players.has(p.id))
    if (roster.length < MIN_PLAYERS) {
      for (const p of roster) lobby.push(p)
      return broadcastLobby()
    }
    const id = `surf_${matchSeq++}`
    const seed = Math.floor(Math.random() * 1_000_000_000)
    const startAt = Date.now() + 2500
    const m = {
      id,
      seed,
      startAt,
      ended: false,
      slots: new Map(), // player.id → { p, x, tilt, jump, alive, outAt, survivedMs }
      outOrder: [],
      tick: null,
      hardStop: null,
    }
    roster.forEach((p, i) => {
      const startX = roster.length === 1 ? 0.5 : 0.18 + (i / (roster.length - 1)) * 0.64
      m.slots.set(p.id, { p, x: startX, tilt: 0, jump: 0, alive: true, outAt: 0, survivedMs: 0 })
      matchOf.set(p.id, m)
    })
    const initPlayers = [...m.slots.values()].map((s) => ({
      id: s.p.id,
      name: s.p.name,
      avatar: s.p.avatar,
      x: s.x,
      tilt: 0,
      jump: 0,
      alive: true,
    }))
    for (const s of m.slots.values()) {
      if (s.p.ws.readyState === 1) send(s.p.ws, { t: 'surf_start', matchId: m.id, seed: m.seed, startAt: m.startAt, players: initPlayers })
    }
    m.tick = setInterval(() => {
      if (m.ended) return
      const snap = [...m.slots.values()].map((s) => ({
        id: s.p.id,
        x: +s.x.toFixed(3),
        tilt: +s.tilt.toFixed(2),
        jump: +s.jump.toFixed(2),
        alive: s.alive,
      }))
      for (const s of m.slots.values()) {
        if (s.p.ws.readyState === 1) send(s.p.ws, { t: 'surf_state', players: snap })
      }
    }, TICK_MS)
    m.tick.unref?.()
    m.hardStop = setTimeout(() => finishMatch(m), MAX_MATCH_MS + 3000)
    m.hardStop.unref?.()
  }

  const finishMatch = (m) => {
    if (m.ended) return
    m.ended = true
    clearInterval(m.tick)
    clearTimeout(m.hardStop)
    const now = Date.now()
    const elapsed = Math.max(0, now - m.startAt)
    const alive = [...m.slots.values()].filter((s) => s.alive)
    for (const s of alive) s.survivedMs = elapsed
    // Sıralama: hayatta kalanlar en üstte, sonra en geç elenenler
    const ordered = [...alive, ...[...m.outOrder].reverse()]
    const standings = ordered.map((s, idx) => {
      const rank = idx + 1
      const rew = recordResult(s.p, rank, s.survivedMs, ordered.length)
      return {
        rank,
        id: s.p.id,
        name: s.p.name,
        avatar: s.p.avatar,
        ms: Math.round(s.survivedMs),
        pts: rew.pts,
        coins: rew.coins,
      }
    })
    const winner = standings[0] ?? null
    const top = topList()
    for (const s of m.slots.values()) {
      matchOf.delete(s.p.id)
      if (s.p.ws.readyState === 1) send(s.p.ws, { t: 'surf_end', winner, standings, top })
    }
  }

  const checkFinish = (m) => {
    if (m.ended) return
    const aliveCount = [...m.slots.values()].filter((s) => s.alive).length
    if (aliveCount <= 1) finishMatch(m)
  }

  const removeFromLobby = (p) => {
    const i = lobby.indexOf(p)
    if (i < 0) return false
    lobby.splice(i, 1)
    if (lobby.length < MIN_PLAYERS) cancelLobbyTimer()
    broadcastLobby()
    return true
  }

  const leaveMatch = (p) => {
    const m = matchOf.get(p.id)
    if (!m) return
    matchOf.delete(p.id)
    const s = m.slots.get(p.id)
    if (s && s.alive) {
      s.alive = false
      s.outAt = Date.now()
      s.survivedMs = Math.max(0, s.outAt - m.startAt)
      m.outOrder.push(s)
      checkFinish(m)
    }
  }

  return {
    onLeave(me) {
      removeFromLobby(me)
      leaveMatch(me)
    },
    handlers: {
      surf_board(me) {
        const key = me.key || me.id
        send(me.ws, {
          t: 'surf_board',
          top: topList(),
          mine: user(key).stats.surf ?? null,
          lobbyCount: lobby.length,
        })
      },
      surf_join(me) {
        if (matchOf.has(me.id) || lobby.includes(me)) return send(me.ws, lobbyPayload())
        if (lobby.length >= MAX_PLAYERS) return send(me.ws, { t: 'info', text: '🏄 Sörf lobisi şu an dolu (10/10), birazdan tekrar dene!' })
        lobby.push(me)
        if (lobby.length >= MAX_PLAYERS) {
          startMatch()
          return
        }
        if (lobby.length >= MIN_PLAYERS && !lobbyTimer) {
          startsAt = Date.now() + COUNTDOWN_MS
          lobbyTimer = setTimeout(startMatch, COUNTDOWN_MS)
          lobbyTimer.unref?.()
        }
        broadcastLobby()
      },
      surf_leave(me) {
        removeFromLobby(me)
        leaveMatch(me)
        send(me.ws, { t: 'surf_left' })
      },
      surf_pos(me, msg) {
        const m = matchOf.get(me.id)
        if (!m || m.ended) return
        const s = m.slots.get(me.id)
        if (!s || !s.alive) return
        s.x = clamp(msg.x, 0.05, 0.95)
        s.tilt = clamp(msg.tilt, -1, 1)
        s.jump = clamp(msg.jump, 0, 1)
      },
      surf_out(me, msg) {
        const m = matchOf.get(me.id)
        if (!m || m.ended) return
        const s = m.slots.get(me.id)
        if (!s || !s.alive) return
        s.alive = false
        s.outAt = Date.now()
        const maxMs = Math.max(0, s.outAt - m.startAt + 500)
        s.survivedMs = clamp(msg.ms, 0, maxMs)
        m.outOrder.push(s)
        checkFinish(m)
      },
    },
  }
}
