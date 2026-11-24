// PvP: eşleşme + bekleyenler listesi + üç düello (refleks, taş-kâğıt-makas, kartopu savaşı).
// Sunucu OTORİTERdir (zamanlama, hamle, sonuç, Elo, ödül). Ödül/Elo yalnızca farklı IP'li, günde aynı çiftle ≤ 3 maçta işler (economy pairReward).
//
// Protokol
//   istemci → sunucu
//     { t: 'pvp_list' }                      bekleyenler listesi + profilim
//     { t: 'pvp_queue', game }               game: reflex | rps | snow | any — eşleş ya da sıraya gir
//     { t: 'pvp_join', id }                  bekleyen birine katıl
//     { t: 'pvp_cancel' }                    sıradan çık
//     { t: 'pvp_act', ... }                  hamle (reflex: {a:'tap'} | rps: {a:'pick', v:'r|p|s'} | snow: {a:'pick', v:'throw|dodge|pack'})
//     { t: 'pvp_leave' }                     maçtan çekil (yenilgi)
//   sunucu → istemci
//     { t: 'pvp_lobby', list: [{id,name,game,wait,elo}], me: {elo,w,l,streak}, top: [{name,elo}], queued }
//     { t: 'pvp_state', mid, game, opp: {id,name,avatar,elo}, s }   maçın görünümü
//     { t: 'pvp_end', mid, res: 'win'|'lose'|'draw', why, coins, d }   d = Elo değişimi
import crypto from 'node:crypto'
import { save, user, allUsers } from '../store.js'

export const PVP_GAMES = ['reflex', 'rps', 'snow']
const ACT_CD = 80
const QUEUE_CD = 1000
const QUEUE_TTL = 120_000
const PICK_MS = 12_000
const WIN_COINS = 12
const LOSE_COINS = 2

export default function pvp(ctx) {
  const { players, send } = ctx
  const mod = () => ctx.features[0].api
  const waiting = new Map() // id → { id, game, since }
  const matches = new Map() // mid → match
  const inMatch = new Map() // playerId → mid

  const prof = (p) => {
    const st = user(p.key).stats
    const r = (st.pvp ??= { elo: 1000, w: 0, l: 0, streak: 0 })
    r.name = p.name
    return r
  }
  const pub = (p) => ({ id: p.id, name: p.name, avatar: p.avatar, elo: prof(p).elo })

  function lobby(to) {
    const now = Date.now()
    const list = [...waiting.values()]
      .map((w) => ({ w, p: players.get(w.id) }))
      .filter((x) => x.p && x.p.id !== to.id && !mod().blockedPair(x.p, to))
      .map(({ w, p }) => ({ id: p.id, name: p.name, avatar: p.avatar, game: w.game, wait: Math.round((now - w.since) / 1000), elo: prof(p).elo }))
      .sort((a, b) => a.wait - b.wait)
      .slice(0, 12)
    const top = Object.values(allUsers())
      .map((u) => u.stats?.pvp)
      .filter(Boolean)
      .length
      ? Object.entries(allUsers())
          .filter(([, u]) => u.stats?.pvp && u.stats.pvp.w + u.stats.pvp.l >= 3)
          .map(([, u]) => ({ name: u.stats.pvp.name ?? '?', elo: u.stats.pvp.elo }))
          .sort((a, b) => b.elo - a.elo)
          .slice(0, 5)
      : []
    send(to.ws, { t: 'pvp_lobby', list, me: prof(to), top, queued: waiting.get(to.id)?.game ?? null })
  }
  const broadcastLobby = () => {
    for (const w of waiting.values()) {
      /* bekleyenin kendi görünümü */
    }
    for (const p of players.values()) if (p.pvpWatch) lobby(p)
  }

  // ---------- oyun mantığı ----------
  const sync = (m) => {
    for (const p of m.p) {
      const o = m.p.find((x) => x.id !== p.id)
      send(players.get(p.id)?.ws, { t: 'pvp_state', mid: m.mid, game: m.game, opp: pub(players.get(o.id) ?? o), s: view(m, p.id) })
    }
  }
  function view(m, id) {
    const me = m.s[id]
    const oid = m.p.find((x) => x.id !== id).id
    const op = m.s[oid]
    if (m.game === 'reflex') return { phase: m.ph, round: m.round, you: me.score, opp: op.score, go: m.ph === 'go', last: m.last }
    if (m.game === 'rps') return { round: m.round, you: me.score, opp: op.score, picked: me.pick != null, last: m.last, deadline: m.deadline }
    return { round: m.round, hp: me.hp, ohp: op.hp, ammo: me.ammo, oammo: op.ammo, picked: me.pick != null, cantDodge: me.lastDodge, last: m.last, deadline: m.deadline }
  }

  function start(a, b, game) {
    waiting.delete(a.id)
    waiting.delete(b.id)
    if (game === 'any') game = PVP_GAMES[crypto.randomInt(PVP_GAMES.length)]
    const mid = crypto.randomUUID().slice(0, 8)
    const m = { mid, game, p: [{ id: a.id, key: a.key, ip: a.ip, name: a.name }, { id: b.id, key: b.key, ip: b.ip, name: b.name }], round: 1, s: {}, ph: 'wait', last: null, timers: [], t0: Date.now() }
    for (const p of m.p) m.s[p.id] = { score: 0, pick: null, hp: 3, ammo: 1, lastDodge: false }
    matches.set(mid, m)
    inMatch.set(a.id, mid)
    inMatch.set(b.id, mid)
    ctx.grace?.(a, 0)
    beginRound(m)
    broadcastLobby()
  }

  function later(m, ms, fn) {
    const t = setTimeout(() => matches.has(m.mid) && fn(), ms)
    m.timers.push(t)
  }

  function beginRound(m) {
    for (const p of m.p) m.s[p.id].pick = null
    m.deadline = null
    if (m.game === 'reflex') {
      m.ph = 'wait'
      m.goAt = null
      sync(m)
      later(m, 1500 + crypto.randomInt(2800), () => {
        m.ph = 'go'
        m.goAt = Date.now()
        sync(m)
        later(m, 3500, () => finishRound(m, null, 'zaman')) // kimse basmadı
      })
    } else {
      m.deadline = Date.now() + PICK_MS
      sync(m)
      later(m, PICK_MS, () => {
        for (const p of m.p) if (m.s[p.id].pick == null) m.s[p.id].pick = m.game === 'rps' ? 'rps'[crypto.randomInt(3)] : 'pack'
        resolvePick(m)
      })
    }
  }

  function finishRound(m, winnerId, why) {
    m.last = { win: winnerId, why }
    if (winnerId) m.s[winnerId].score++
    const w = winnerId && m.s[winnerId].score >= 2 ? winnerId : null
    if (w) return endMatch(m, w, 'bitti')
    m.round++
    m.ph = 'between'
    sync(m)
    later(m, 1400, () => beginRound(m))
  }

  const BEATS = { r: 's', s: 'p', p: 'r' }
  function resolvePick(m) {
    const [a, b] = m.p
    const A = m.s[a.id]
    const B = m.s[b.id]
    if (m.game === 'rps') {
      let win = null
      if (A.pick !== B.pick) win = BEATS[A.pick] === B.pick ? a.id : b.id
      m.last = { win, picks: { [a.id]: A.pick, [b.id]: B.pick } }
      if (win) A.score += win === a.id ? 1 : 0, (B.score += win === b.id ? 1 : 0)
      const w = A.score >= 2 ? a.id : B.score >= 2 ? b.id : null
      if (w) return endMatch(m, w, 'bitti')
      m.round++
      sync(m)
      later(m, 1500, () => beginRound(m))
      return
    }
    // kartopu: throw (mermi gerekir), dodge (üst üste yapılamaz), pack (+1 mermi)
    const act = (S, pick) => (pick === 'throw' && S.ammo < 1 ? 'pack' : pick === 'dodge' && S.lastDodge ? 'pack' : pick)
    const pa = act(A, A.pick)
    const pb = act(B, B.pick)
    if (pa === 'throw') A.ammo--
    if (pb === 'throw') B.ammo--
    if (pa === 'pack') A.ammo++
    if (pb === 'pack') B.ammo++
    if (pa === 'throw' && pb !== 'dodge') B.hp--
    if (pb === 'throw' && pa !== 'dodge') A.hp--
    A.lastDodge = pa === 'dodge'
    B.lastDodge = pb === 'dodge'
    m.last = { acts: { [a.id]: pa, [b.id]: pb } }
    const dead = (S) => S.hp <= 0
    if (dead(A) || dead(B) || m.round >= 20) {
      const w = A.hp === B.hp ? null : A.hp > B.hp ? a.id : b.id
      return endMatch(m, w, w ? 'bitti' : 'berabere')
    }
    m.round++
    sync(m)
    later(m, 1700, () => beginRound(m))
  }

  function endMatch(m, winnerId, why) {
    if (!matches.delete(m.mid)) return
    m.timers.forEach(clearTimeout)
    for (const p of m.p) inMatch.delete(p.id)
    const [a, b] = m.p
    const pa = players.get(a.id)
    const pb = players.get(b.id)
    const dur = Date.now() - m.t0
    // ödül/Elo yalnızca gerçek (farklı IP, makul süre, günlük çift sınırı) maçlarda
    const real = Boolean(winnerId && pa && pb && dur > 4000 && ctx.pairReward?.(pa, pb, 'pvp'))
    let d = 0
    if (real) {
      const wp = winnerId === a.id ? pa : pb
      const lp = winnerId === a.id ? pb : pa
      const W = prof(wp)
      const L = prof(lp)
      const exp = 1 / (1 + 10 ** ((L.elo - W.elo) / 400))
      d = Math.max(1, Math.round(24 * (1 - exp)))
      W.elo += d
      L.elo = Math.max(100, L.elo - d)
      W.w++
      L.l++
      W.streak++
      L.streak = 0
      ctx.addCoins?.(wp, WIN_COINS, 'pvp')
      ctx.addCoins?.(lp, LOSE_COINS, 'pvp')
      ctx.emitEvent?.(wp, 'pvp_win', 1, lp.key)
      ctx.emitEvent?.(lp, 'pvp_played', 1, wp.key)
      save()
    }
    for (const p of m.p) {
      const me = players.get(p.id)
      if (!me) continue
      const res = !winnerId ? 'draw' : winnerId === p.id ? 'win' : 'lose'
      send(me.ws, { t: 'pvp_end', mid: m.mid, res, why, d: res === 'win' ? d : res === 'lose' ? -d : 0, coins: real ? (res === 'win' ? WIN_COINS : LOSE_COINS) : 0, ranked: real })
    }
  }

  const matchOf = (me) => matches.get(inMatch.get(me.id))
  const canPair = (a, b) => a.id !== b.id && !mod().blockedPair(a, b) && !inMatch.has(b.id)

  setInterval(() => {
    const now = Date.now()
    let ch = false
    for (const [id, w] of waiting) if (now - w.since > QUEUE_TTL || !players.has(id)) (waiting.delete(id), (ch = true))
    if (ch) broadcastLobby()
  }, 15_000).unref()

  return {
    api: { inMatch: (id) => inMatch.has(id) },
    handlers: {
      pvp_list(me) {
        me.pvpWatch = true
        lobby(me)
      },
      pvp_queue(me, msg) {
        const now = Date.now()
        if (now - (me.pvpQ ?? 0) < QUEUE_CD) return
        me.pvpQ = now
        const game = String(msg.game)
        if (![...PVP_GAMES, 'any'].includes(game) || inMatch.has(me.id)) return
        // uyumlu bekleyen var mı?
        for (const w of waiting.values()) {
          const o = players.get(w.id)
          if (!o || !canPair(me, o)) continue
          if (w.game !== 'any' && game !== 'any' && w.game !== game) continue
          return start(o, me, w.game === 'any' ? game : w.game)
        }
        waiting.set(me.id, { id: me.id, game, since: now })
        lobby(me)
        broadcastLobby()
      },
      pvp_join(me, msg) {
        const now = Date.now()
        if (now - (me.pvpQ ?? 0) < QUEUE_CD || inMatch.has(me.id)) return
        me.pvpQ = now
        const w = waiting.get(Number(msg.id) || msg.id)
        const o = w && players.get(w.id)
        if (!o || !canPair(me, o)) return send(me.ws, { t: 'info', text: 'Rakip artık beklemiyor.' })
        start(o, me, w.game)
      },
      pvp_cancel(me) {
        if (waiting.delete(me.id)) {
          lobby(me)
          broadcastLobby()
        }
      },
      pvp_act(me, msg) {
        const m = matchOf(me)
        if (!m) return
        const now = Date.now()
        if (now - (me.pvpA ?? 0) < ACT_CD) return
        me.pvpA = now
        const S = m.s[me.id]
        if (m.game === 'reflex') {
          if (msg.a !== 'tap' || m.ph === 'between') return
          if (m.ph === 'wait') {
            // erken basma = turu kaybet
            m.timers.forEach(clearTimeout)
            m.timers = []
            const o = m.p.find((x) => x.id !== me.id).id
            m.ph = 'between'
            return finishRound(m, o, 'erken')
          }
          if (m.ph === 'go') {
            const rt = now - m.goAt
            m.timers.forEach(clearTimeout)
            m.timers = []
            m.ph = 'between'
            if (rt < 70) ctx.strike?.(me, 'refleks<70ms', 4) // insan dışı tepki: puan
            m.last = { rt }
            return finishRound(m, me.id, 'hızlı')
          }
          return
        }
        if (msg.a !== 'pick' || S.pick != null) return
        const ok = m.game === 'rps' ? ['r', 'p', 's'] : ['throw', 'dodge', 'pack']
        if (!ok.includes(msg.v)) return
        S.pick = msg.v
        if (m.p.every((p) => m.s[p.id].pick != null)) {
          m.timers.forEach(clearTimeout)
          m.timers = []
          resolvePick(m)
        } else sync(m)
      },
      pvp_leave(me) {
        const m = matchOf(me)
        if (m) endMatch(m, m.p.find((x) => x.id !== me.id).id, 'çekildi')
        else if (waiting.delete(me.id)) broadcastLobby()
        me.pvpWatch = false
      },
    },
    onLeave(me) {
      me.pvpWatch = false
      const m = matchOf(me)
      if (m) endMatch(m, m.p.find((x) => x.id !== me.id).id, 'ayrıldı')
      if (waiting.delete(me.id)) broadcastLobby()
    },
    welcome: () => ({}),
  }
}

// bekleme süresi dolanları temizlemek için dışarıdan çağrılır
export const QUEUE_TTL_MS = QUEUE_TTL
