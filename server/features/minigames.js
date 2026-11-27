// Çok oyunculu mini oyun merkezi (2–10 kişi + kalıcı liderlik tabloları):
//   rhythm (Kulüp Babil), tiles (Playstasyon), barista (Kafe/Tatlı), bike (Park), balloon (Lobi)
// İstemci → sunucu:
//   { t: 'mg_board', game }
//   { t: 'mg_join', game }
//   { t: 'mg_leave', game }
//   { t: 'mg_score', game, score, ms }     maç/tur bittiğinde skor bildir (sunucu sıralar & ödül verir)
// Sunucu → istemci:
//   { t: 'mg_board', game, top, lobbyCount }
//   { t: 'mg_lobby', game, players, min, max, startsAt }
//   { t: 'mg_start', game, matchId, seed, startAt, players }
//   { t: 'mg_end', game, winner, standings, top }
import { allUsers, save, user } from '../store.js'

const GAMES = ['rhythm', 'tiles', 'barista', 'bike', 'balloon']
const MIN_P = 2
const MAX_P = 10
const COUNTDOWN_MS = 10_000
const MATCH_TIMEOUT_MS = 95_000

// Liderlik tabloları kullanıcı verisinde (store.user(key).stats.minigames) tutulur → Supabase write-behind ile kalıcı.
const mgOf = (key) => (user(key).stats.minigames ??= {})

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0))

export default function minigames(ctx) {
  const { players, send } = ctx

  const topOf = (game) =>
    Object.entries(allUsers())
      .map(([key, u]) => (u.stats?.minigames?.[game] ? { key, ...u.stats.minigames[game] } : null))
      .filter(Boolean)
      .sort((a, b) => b.points - a.points || b.wins - a.wins || b.best - a.best)
      .slice(0, 15)

  const record = (game, p, rank, score, total) => {
    const key = p.key || p.id
    const mine = mgOf(key)
    const cur = (mine[game] ??= { name: '', avatar: '', points: 0, wins: 0, games: 0, best: 0 })
    const pts = rank === 1 ? 100 : rank === 2 ? 60 : rank === 3 ? 35 : 15
    const coins = rank === 1 ? 25 : rank === 2 ? 15 : rank === 3 ? 8 : 4
    cur.name = p.name
    cur.avatar = p.avatar
    cur.points += pts
    cur.games += 1
    if (rank === 1 && total >= 2) cur.wins += 1
    cur.best = Math.max(cur.best, score)
    save()
    ctx.addCoins?.(p, coins, 'minigame')
    return { pts, coins }
  }

  const lobbies = Object.fromEntries(GAMES.map((g) => [g, { list: [], timer: null, startsAt: 0 }]))
  const matchOf = new Map() // player.id → match
  let seq = 1

  const lobbyMsg = (g) => ({
    t: 'mg_lobby',
    game: g,
    min: MIN_P,
    max: MAX_P,
    startsAt: lobbies[g].startsAt,
    players: lobbies[g].list.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar })),
  })

  const broadcastLobby = (g) => {
    const msg = lobbyMsg(g)
    for (const p of lobbies[g].list) if (p.ws.readyState === 1) send(p.ws, msg)
  }

  const cancelTimer = (g) => {
    clearTimeout(lobbies[g].timer)
    lobbies[g].timer = null
    lobbies[g].startsAt = 0
  }

  const finishMatch = (m) => {
    if (m.ended) return
    m.ended = true
    clearTimeout(m.timer)
    const rows = [...m.slots.values()].sort((a, b) => b.score - a.score || b.ms - a.ms)
    const standings = rows.map((r, i) => {
      const rank = i + 1
      const rew = record(m.game, r.p, rank, r.score, rows.length)
      return { rank, id: r.p.id, name: r.p.name, score: r.score, ms: r.ms, pts: rew.pts, coins: rew.coins }
    })
    const top = topOf(m.game)
    const winner = standings[0] ?? null
    for (const r of m.slots.values()) {
      matchOf.delete(r.p.id)
      if (r.p.ws.readyState === 1) send(r.p.ws, { t: 'mg_end', game: m.game, winner, standings, top })
    }
  }

  const startMatch = (g) => {
    cancelTimer(g)
    const roster = lobbies[g].list.splice(0, MAX_P).filter((p) => players.has(p.id))
    if (roster.length < MIN_P) {
      for (const p of roster) lobbies[g].list.push(p)
      return broadcastLobby(g)
    }
    const m = {
      id: `mg_${g}_${seq++}`,
      game: g,
      seed: Math.floor(Math.random() * 1_000_000_000),
      startAt: Date.now() + 2400,
      ended: false,
      slots: new Map(),
      timer: null,
    }
    roster.forEach((p) => {
      m.slots.set(p.id, { p, done: false, score: 0, ms: 0 })
      matchOf.set(p.id, m)
    })
    const init = roster.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar }))
    for (const p of roster) {
      if (p.ws.readyState === 1) send(p.ws, { t: 'mg_start', game: g, matchId: m.id, seed: m.seed, startAt: m.startAt, players: init })
    }
    m.timer = setTimeout(() => finishMatch(m), MATCH_TIMEOUT_MS)
    m.timer.unref?.()
  }

  const leaveAllLobbies = (p) => {
    for (const g of GAMES) {
      const i = lobbies[g].list.indexOf(p)
      if (i >= 0) {
        lobbies[g].list.splice(i, 1)
        if (lobbies[g].list.length < MIN_P) cancelTimer(g)
        broadcastLobby(g)
      }
    }
  }

  const leaveMatch = (p) => {
    const m = matchOf.get(p.id)
    if (!m) return
    matchOf.delete(p.id)
    const r = m.slots.get(p.id)
    if (r) r.done = true
    if ([...m.slots.values()].every((x) => x.done)) finishMatch(m)
  }

  return {
    onLeave(me) {
      leaveAllLobbies(me)
      leaveMatch(me)
    },
    handlers: {
      mg_board(me, msg) {
        const g = GAMES.includes(msg.game) ? msg.game : 'rhythm'
        send(me.ws, { t: 'mg_board', game: g, top: topOf(g), lobbyCount: lobbies[g].list.length })
      },
      mg_join(me, msg) {
        const g = GAMES.includes(msg.game) ? msg.game : null
        if (!g) return
        if (matchOf.has(me.id)) return
        leaveAllLobbies(me)
        const lb = lobbies[g]
        if (lb.list.length >= MAX_P) return send(me.ws, { t: 'info', text: 'Lobi şu an dolu (10/10), birazdan tekrar dene!' })
        lb.list.push(me)
        if (lb.list.length >= MAX_P) return startMatch(g)
        if (lb.list.length >= MIN_P && !lb.timer) {
          lb.startsAt = Date.now() + COUNTDOWN_MS
          lb.timer = setTimeout(() => startMatch(g), COUNTDOWN_MS)
          lb.timer.unref?.()
        }
        broadcastLobby(g)
      },
      mg_leave(me) {
        leaveAllLobbies(me)
        leaveMatch(me)
        send(me.ws, { t: 'mg_left' })
      },
      mg_score(me, msg) {
        const m = matchOf.get(me.id)
        if (!m || m.ended) return
        const r = m.slots.get(me.id)
        if (!r || r.done) return
        r.done = true
        r.score = clamp(msg.score, 0, 50_000)
        r.ms = clamp(msg.ms, 0, MATCH_TIMEOUT_MS)
        if ([...m.slots.values()].every((x) => x.done)) finishMatch(m)
      },
    },
  }
}
