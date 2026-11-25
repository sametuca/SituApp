// Plaj etkinlikleri: (1) Gün batımı buluşması, (2) voleybol (2 kişilik zamanlama), (3) kum kalesi yarışı. Sunucu otoriter.
// (1) Her CYCLE_MS'de bir (tam saat ve :30), ANNOUNCE_MS öncesinden duyurulur, ACTIVE_MS sürer. Plajda (BEACH yarıçapı) bulunanlar
//     her 30 sn'de +2 🪙, bitişte ≥ 120 sn kalanlar +10 🪙. Test: SITUAPP_MEETUP_CYCLE_MS=120000 ile 2 dk'lık döngü.
//     sunucu → istemci: { t:'meetup', phase:'idle'|'soon'|'on', start, end, n }  (welcome.meetup da)   { t:'meetup_end', coins, secs }
// (2) { t:'vb_join' } (net yakınında ≤ 5 m) / { t:'vb_leave' } / { t:'vb_hit' }; sunucu → { t:'vb', ... } durum.
//     Top sırayla oyunculara "gelir"; arrive zamanından ±HIT_WINDOW içinde vb_hit gelmezse rakip puan alır. 5 puana ilk ulaşan kazanır (+15 🪙, kaybeden +3).
// (3) { t:'sc_start' } → 12 sn { t:'sc_tap' } (≤ 12/sn); sonuç { t:'sc_end', taps, coins, top[] }. Bekleme 90 sn, ödül ≤ 8 🪙.
import { BEACH } from '../../src/world/layout.js'

const CYCLE_MS = Number(process.env.SITUAPP_MEETUP_CYCLE_MS) || 30 * 60 * 1000
const ANNOUNCE_MS = Math.min(3 * 60 * 1000, CYCLE_MS / 3)
const ACTIVE_MS = Math.min(3 * 60 * 1000, CYCLE_MS / 4)
const NET = { x: 14.5, z: 42, r: 5 } // voleybol filesi (layout.js volleyball prop'u)
const CASTLES = [
  { x: -7.8, z: 44.6, r: 4.5 },
  { x: 8.4, z: 45.2, r: 4.5 },
]
const nearCastle = (p) => p.room === 'city' && CASTLES.some((c) => Math.hypot(p.x - c.x, p.z - c.z) <= c.r)
const WIN_SCORE = 5
const HIT_WINDOW = 420 // ms
const TURN_MS = [1700, 1500, 1350, 1200, 1100]
const SC_MS = 12000

export default function beach(ctx) {
  const { players, send, broadcast } = ctx
  const onBeach = (p, r = BEACH.r) => p.room === 'city' && Math.hypot(p.x - BEACH.x, p.z - BEACH.z) <= r
  const near = (p, o) => p.room === 'city' && Math.hypot(p.x - o.x, p.z - o.z) <= o.r

  // ---------------- (1) gün batımı buluşması ----------------
  const windowOf = (now) => {
    const base = Math.floor(now / CYCLE_MS) * CYCLE_MS
    const nextStart = now - base < ACTIVE_MS ? base : base + CYCLE_MS // aktif pencere içindeysek bu döngünün başlangıcı
    const start = now - base < ACTIVE_MS ? base : nextStart
    const phase = now >= start && now < start + ACTIVE_MS ? 'on' : start - now <= ANNOUNCE_MS ? 'soon' : 'idle'
    return { phase, start, end: start + ACTIVE_MS }
  }
  let cur = { phase: 'idle', start: 0, end: 0, n: 0 }
  const present = new Map() // oyuncu id → saniye
  const state = () => ({ t: 'meetup', phase: cur.phase, start: cur.start, end: cur.end, n: cur.n })

  const tick = setInterval(() => {
    const now = Date.now()
    const w = windowOf(now)
    let n = 0
    if (w.phase === 'on') {
      for (const p of players.values()) {
        if (!onBeach(p, BEACH.r + 4)) continue
        n++
        present.set(p.id, (present.get(p.id) ?? 0) + 1)
        const s = present.get(p.id)
        if (s % 30 === 0) ctx.addCoins?.(p, 2, 'meetup')
      }
    }
    const changed = w.phase !== cur.phase || w.start !== cur.start
    const ended = cur.phase === 'on' && w.phase !== 'on'
    if (ended) {
      for (const [id, s] of present) {
        const p = players.get(id)
        if (!p) continue
        const bonus = s >= 120
        if (bonus) ctx.addCoins?.(p, 10, 'meetup')
        send(p.ws, { t: 'meetup_end', secs: s, bonus })
        ctx.emitEvent?.(p, 'meetup', 1)
      }
      present.clear()
    }
    const countChanged = w.phase === 'on' && n !== cur.n && now % 5000 < 1000
    cur = { ...w, n }
    if (changed || countChanged) broadcast(state(), undefined, 'city')
  }, 1000)
  tick.unref?.()

  // ---------------- (2) voleybol ----------------
  const queue = []
  const matches = new Map() // oyuncu id → maç
  const vbState = (m) => ({ t: 'vb', a: { id: m.a.id, name: m.a.name }, b: { id: m.b.id, name: m.b.name }, sa: m.sa, sb: m.sb, turn: m.turn?.id ?? null, arrive: m.arrive, in: Math.max(0, m.arrive - Date.now()), over: m.over ?? null })
  const vbSend = (m) => {
    for (const p of [m.a, m.b]) if (p.ws.readyState === 1) send(p.ws, vbState(m))
  }
  const vbServe = (m, to) => {
    m.turn = to
    m.rally = 0
    m.arrive = Date.now() + 1900
    armMiss(m)
    vbSend(m)
  }
  const armMiss = (m) => {
    clearTimeout(m.timer)
    m.timer = setTimeout(() => point(m, m.turn === m.a ? m.b : m.a), Math.max(0, m.arrive - Date.now()) + HIT_WINDOW)
  }
  const endMatch = (m, winner) => {
    clearTimeout(m.timer)
    const loser = winner === m.a ? m.b : m.a
    m.over = { winner: winner.id }
    if (ctx.pairReward?.(winner, loser, 'voley')) {
      ctx.addCoins?.(winner, 15, 'voley')
      ctx.addCoins?.(loser, 3, 'voley')
    }
    ctx.emitEvent?.(winner, 'beach_win', 1, loser)
    vbSend(m)
    matches.delete(m.a.id)
    matches.delete(m.b.id)
  }
  const point = (m, scorer) => {
    if (m.over) return
    if (scorer === m.a) m.sa++
    else m.sb++
    if (m.sa >= WIN_SCORE || m.sb >= WIN_SCORE) return endMatch(m, scorer)
    vbServe(m, scorer === m.a ? m.b : m.a) // puanı kaybeden servis alır... basitçe diğeri
  }
  const leave = (p) => {
    const qi = queue.indexOf(p)
    if (qi >= 0) queue.splice(qi, 1)
    const m = matches.get(p.id)
    if (m && !m.over) endMatch(m, m.a === p ? m.b : m.a)
  }
  const pair = () => {
    while (queue.length >= 2) {
      const a = queue.shift()
      const b = queue.shift()
      if (!near(a, NET) || !near(b, NET)) continue
      const m = { a, b, sa: 0, sb: 0, turn: null, arrive: 0, rally: 0, timer: null }
      matches.set(a.id, m)
      matches.set(b.id, m)
      vbServe(m, a)
    }
  }
  const vbWatch = setInterval(() => {
    for (const m of new Set(matches.values())) if (!near(m.a, NET) || !near(m.b, NET)) leave(m.a)
    for (const p of [...queue]) if (!near(p, NET)) leave(p)
  }, 1500)
  vbWatch.unref?.()

  // ---------------- (3) kum kalesi ----------------
  const castles = new Map() // oyuncu id → { start, taps, last }
  const board = [] // günün en iyileri { name, taps }
  const lastBuild = new Map() // key → ts
  const finishCastle = (p) => {
    const c = castles.get(p.id)
    if (!c) return
    castles.delete(p.id)
    const coins = Math.min(8, Math.floor(c.taps / 12))
    if (coins) ctx.addCoins?.(p, coins, 'kale')
    board.push({ name: p.name, taps: c.taps })
    board.sort((x, y) => y.taps - x.taps)
    board.length = Math.min(board.length, 5)
    send(p.ws, { t: 'sc_end', taps: c.taps, coins, top: board })
    ctx.emitEvent?.(p, 'beach_castle', 1)
  }

  return {
    welcome: () => ({ meetup: state() }),
    onLeave(me) {
      leave(me)
      castles.delete(me.id)
      present.delete(me.id)
    },
    onRoomChange(me) {
      leave(me)
      castles.delete(me.id)
    },
    handlers: {
      vb_join(me) {
        if (!near(me, NET) || matches.has(me.id) || queue.includes(me)) return
        queue.push(me)
        send(me.ws, { t: 'vb_wait' })
        pair()
      },
      vb_leave(me) {
        leave(me)
        send(me.ws, { t: 'vb_gone' })
      },
      vb_hit(me) {
        const m = matches.get(me.id)
        if (!m || m.over || m.turn !== me) return
        const d = Date.now() - m.arrive
        if (Math.abs(d) > HIT_WINDOW) {
          // erken/geç vuruş = ıskalama
          return point(m, me === m.a ? m.b : m.a)
        }
        m.rally++
        m.turn = me === m.a ? m.b : m.a
        m.arrive = Date.now() + TURN_MS[Math.min(m.rally, TURN_MS.length - 1)]
        armMiss(m)
        vbSend(m)
      },
      sc_start(me) {
        if (!nearCastle(me) || castles.has(me.id)) return
        const last = lastBuild.get(me.key) ?? 0
        if (Date.now() - last < 90_000) return send(me.ws, { t: 'info', text: '🏰 Biraz dinlen, kum kalesi için 90 sn beklemelisin.' })
        lastBuild.set(me.key, Date.now())
        castles.set(me.id, { start: Date.now(), taps: 0, last: 0 })
        send(me.ws, { t: 'sc_go', ms: SC_MS })
        setTimeout(() => finishCastle(me), SC_MS + 300)
      },
      sc_tap(me) {
        const c = castles.get(me.id)
        if (!c || Date.now() - c.start > SC_MS + 200) return
        const now = Date.now()
        if (now - c.last < 80) return // ≤ 12/sn
        c.last = now
        c.taps++
      },
    },
  }
}
