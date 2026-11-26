// Fitness Kulübü (MakFit): 4 karakter statı, günlük antrenman enerjisi, ağırlık/koşu antrenmanı,
// sunucu otoriter 1v1 ritim-zamanlama boksu ve haftalık şampiyon kemeri.
// Haftalık boks puan tablosu kullanıcı verisinde (store.user(key).stats.boxing) tutulur; hafta değişince
// satır kendiliğinden sıfırlanır ve Supabase `user_data` write-behind'i ile kalıcı olur.
import { allUsers, save, user } from '../store.js'
import { istanbul } from './progress.js'
import { BLOCK_MS, BOX, STAT_KEYS, STAT_MAX, STAT_START, boxCues, energyMax, gradeWindow, hitDamage, matchDuration } from '../../src/world/boxing.js'

const isoWeek = (now = Date.now()) => {
  const d = new Date(now + 3 * 3600_000) // İstanbul UTC+3
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7))
  const w1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const w = 1 + Math.round(((d - w1) / 86400_000 - 3 + ((w1.getUTCDay() + 6) % 7)) / 7)
  return `${d.getUTCFullYear()}-W${String(w).padStart(2, '0')}`
}

const emptyRow = () => ({ week: isoWeek(), name: '', avatar: '', points: 0, wins: 0, ko: 0, games: 0 })

export default function fitness(ctx) {
  const { players, send } = ctx

  const attrOf = (key) => {
    const u = user(key)
    const a = (u.stats.attr ??= { str: STAT_START, sta: STAT_START, cha: STAT_START, ski: STAT_START })
    for (const k of STAT_KEYS) if (!Number.isFinite(a[k])) a[k] = STAT_START
    return a
  }

  const energyOf = (key) => {
    const u = user(key)
    const day = istanbul().day
    const max = energyMax(attrOf(key))
    if (u.stats.gymDay !== day) {
      u.stats.gymDay = day
      u.stats.gymUsed = 0
    }
    return { left: Math.max(0, max - (u.stats.gymUsed ?? 0)), max }
  }

  const topList = () =>
    Object.entries(allUsers())
      .map(([key, u]) => (u.stats?.boxing?.week === isoWeek() ? { key, ...u.stats.boxing } : null))
      .filter(Boolean)
      .sort((a, b) => b.points - a.points || b.wins - a.wins || b.ko - a.ko)
      .slice(0, 15)

  const champKey = () => topList()[0]?.key ?? null

  const statePayload = (key) => {
    const attr = attrOf(key)
    const en = energyOf(key)
    return { t: 'fitness_state', attr, energy: en.left, energyMax: en.max, champKey: champKey(), week: isoWeek() }
  }

  const pushState = (who) => {
    const p = who?.ws ? who : [...players.values()].find((o) => o.key === who?.key)
    if (p && p.ws.readyState === 1) send(p.ws, statePayload(p.key))
  }

  /** Diğer modüllerin (economy, progress) stat okuması ve pasif artış yapması için API. */
  ctx.attrOf = (key) => (key ? attrOf(key) : { str: STAT_START, sta: STAT_START, cha: STAT_START, ski: STAT_START })
  ctx.champKey = champKey
  ctx.bumpStat = (who, stat, amt = 1) => {
    if (!who?.key || !STAT_KEYS.includes(stat)) return
    const u = user(who.key)
    const a = attrOf(who.key)
    const prev = a[stat]
    if (prev >= STAT_MAX) return
    const next = Math.min(STAT_MAX, +(prev + amt).toFixed(2))
    a[stat] = next
    if (Math.floor(next) > Math.floor(prev)) {
      a[stat] = Math.floor(next)
      save()
      pushState(who)
    } else {
      u.stats.attr = a
    }
  }

  // ---------- 1v1 Ritim-Zamanlama Boksu ----------
  const queue = [] // players waiting
  const matches = new Map() // mid → match
  const inMatch = new Map() // playerId → mid
  let seq = 1

  const broadcastLobby = () => {
    const msg = { t: 'box_lobby', players: queue.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, str: Math.floor(attrOf(p.key).str) })) }
    for (const p of queue) if (p.ws.readyState === 1) send(p.ws, msg)
  }

  const recordBox = (p, win, ko, pts) => {
    const key = p.key || p.id
    const u = user(key)
    const cur = u.stats.boxing?.week === isoWeek() ? u.stats.boxing : emptyRow()
    cur.name = p.name
    cur.avatar = p.avatar
    cur.points += pts
    cur.games += 1
    if (win) cur.wins += 1
    if (ko) cur.ko += 1
    u.stats.boxing = cur
    save()
  }

  const syncMatch = (m, lastHit = null) => {
    for (const f of m.fighters) {
      const opp = m.fighters.find((x) => x.id !== f.id)
      const p = players.get(f.id)
      if (!p || p.ws.readyState !== 1) continue
      send(p.ws, {
        t: 'box_state',
        mid: m.id,
        you: { hp: f.hp, combo: f.combo, score: f.score, shield: f.shieldUntil > Date.now() },
        opp: { id: opp.id, name: opp.name, hp: opp.hp, combo: opp.combo, score: opp.score, shield: opp.shieldUntil > Date.now() },
        lastHit,
      })
    }
  }

  const endMatch = (m, winnerId, reason) => {
    if (!matches.delete(m.id)) return
    clearTimeout(m.timer)
    for (const f of m.fighters) inMatch.delete(f.id)
    const [A, B] = m.fighters
    const pa = players.get(A.id)
    const pb = players.get(B.id)
    const ko = reason === 'ko'
    const real = Boolean(pa && pb && ctx.pairReward?.(pa, pb, 'boxing'))

    for (const f of m.fighters) {
      const p = players.get(f.id)
      if (!p) continue
      const res = !winnerId ? 'draw' : winnerId === f.id ? 'win' : 'lose'
      const pts = res === 'win' ? (ko ? 120 : 90) : res === 'draw' ? 45 : 25
      const coins = real ? (res === 'win' ? 28 : res === 'draw' ? 12 : 8) : res === 'win' ? 10 : 4
      recordBox(p, res === 'win', res === 'win' && ko, pts)
      ctx.addCoins?.(p, coins, 'boxing')
      ctx.bumpStat(p, 'ski', res === 'win' ? 2 : 1)
      ctx.emitEvent?.(p, 'game_played', 1)
      if (p.ws.readyState === 1) {
        send(p.ws, { t: 'box_end', mid: m.id, res, reason, pts, coins, top: topList(), champKey: champKey() })
        send(p.ws, statePayload(p.key))
      }
    }
  }

  const startMatch = (a, b) => {
    const mid = `box_${seq++}`
    const seed = Math.floor(Math.random() * 1_000_000_000)
    const startAt = Date.now() + 1200
    const cues = boxCues(seed)
    const mk = (p) => {
      const at = attrOf(p.key)
      return {
        id: p.id,
        key: p.key,
        name: p.name,
        avatar: p.avatar,
        hp: BOX.hp,
        combo: 0,
        score: 0,
        shieldUntil: 0,
        seen: new Set(),
        str: Math.floor(at.str),
        sta: Math.floor(at.sta),
        ski: Math.floor(at.ski),
      }
    }
    const m = { id: mid, seed, startAt, cues, fighters: [mk(a), mk(b)], timer: null }
    matches.set(mid, m)
    inMatch.set(a.id, mid)
    inMatch.set(b.id, mid)
    for (const f of m.fighters) {
      const opp = m.fighters.find((x) => x.id !== f.id)
      const p = players.get(f.id)
      if (p && p.ws.readyState === 1) {
        send(p.ws, {
          t: 'box_start',
          mid,
          seed,
          startAt,
          you: { str: f.str, sta: f.sta, ski: f.ski },
          opp: { id: opp.id, name: opp.name, avatar: opp.avatar, str: opp.str, sta: opp.sta, ski: opp.ski },
        })
      }
    }
    m.timer = setTimeout(() => {
      const [A, B] = m.fighters
      const win = A.hp === B.hp ? (A.score === B.score ? null : A.score > B.score ? A.id : B.id) : A.hp > B.hp ? A.id : B.id
      endMatch(m, win, 'time')
    }, matchDuration() + 2600)
    m.timer.unref?.()
  }

  const removeQueue = (p) => {
    const i = queue.indexOf(p)
    if (i >= 0) {
      queue.splice(i, 1)
      broadcastLobby()
    }
  }

  return {
    welcome: (me) => {
      const en = energyOf(me.key)
      return { fitness: { attr: attrOf(me.key), energy: en.left, energyMax: en.max, champKey: champKey(), week: isoWeek() } }
    },
    onLeave(me) {
      removeQueue(me)
      const mid = inMatch.get(me.id)
      if (mid) {
        const m = matches.get(mid)
        if (m) {
          const opp = m.fighters.find((x) => x.id !== me.id)
          endMatch(m, opp?.id ?? null, 'forfeit')
        }
      }
    },
    handlers: {
      box_info(me) {
        const en = energyOf(me.key)
        send(me.ws, {
          t: 'box_info',
          attr: attrOf(me.key),
          energy: en.left,
          energyMax: en.max,
          top: topList(),
          champKey: champKey(),
          week: isoWeek(),
          lobby: queue.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar })),
        })
      },
      box_train(me, msg) {
        const kind = msg.kind === 'sta' ? 'sta' : 'str'
        const now = Date.now()
        if (now - (me.lastTrain ?? 0) < 4000) return
        const en = energyOf(me.key)
        if (en.left <= 0) return send(me.ws, { t: 'box_train_res', ok: false, reason: 'energy', energy: 0, energyMax: en.max })
        const reps = Math.max(0, Math.min(25, Math.round(Number(msg.reps) || 0)))
        const perfects = Math.max(0, Math.min(reps, Math.round(Number(msg.perfects) || 0)))
        if (reps < 1) return send(me.ws, { t: 'box_train_res', ok: false, reason: 'reps' })
        me.lastTrain = now
        const u = user(me.key)
        u.stats.gymUsed = (u.stats.gymUsed ?? 0) + 1
        const gain = reps >= 10 || perfects >= 5 ? 3 : reps >= 5 ? 2 : 1
        const a = attrOf(me.key)
        a[kind] = Math.min(STAT_MAX, Math.floor(a[kind]) + gain)
        const coins = 4 + Math.min(10, Math.floor(reps / 2))
        ctx.addCoins?.(me, coins, 'workout')
        ctx.emitEvent?.(me, 'game_played', 1)
        save()
        const nextEn = energyOf(me.key)
        send(me.ws, { t: 'box_train_res', ok: true, kind, gain, coins, attr: a, energy: nextEn.left, energyMax: nextEn.max })
        pushState(me)
      },
      box_queue(me) {
        if (inMatch.has(me.id) || queue.includes(me)) return
        queue.push(me)
        if (queue.length >= 2) {
          const a = queue.shift()
          const b = queue.shift()
          broadcastLobby()
          if (players.has(a.id) && players.has(b.id)) startMatch(a, b)
        } else {
          broadcastLobby()
        }
      },
      box_leave(me) {
        removeQueue(me)
        const mid = inMatch.get(me.id)
        if (mid) {
          const m = matches.get(mid)
          if (m) {
            const opp = m.fighters.find((x) => x.id !== me.id)
            endMatch(m, opp?.id ?? null, 'forfeit')
          }
        }
        send(me.ws, { t: 'box_left' })
      },
      box_hit(me, msg) {
        const mid = inMatch.get(me.id)
        if (!mid) return
        const m = matches.get(mid)
        if (!m) return
        const f = m.fighters.find((x) => x.id === me.id)
        const opp = m.fighters.find((x) => x.id !== me.id)
        if (!f || !opp) return
        const idx = Math.trunc(Number(msg.i))
        const cue = m.cues[idx]
        if (!cue || f.seen.has(idx)) return
        f.seen.add(idx)

        const elapsed = Date.now() - m.startAt
        // İstemci zaman sapmasını makul ağ gecikmesi (±260ms) dahilinde sunucu saatiyle doğrula
        const diff = Math.abs(elapsed - cue.t)
        const win = gradeWindow(f.ski)
        const wrong = msg.type !== cue.type
        if (wrong || diff > win.good + 220) {
          f.combo = 0
          syncMatch(m, { by: f.id, type: cue.type, grade: 'miss', dmg: 0 })
          return
        }
        const grade = diff <= win.perfect + 75 ? 'perfect' : 'good'
        f.combo += 1
        let dmg = 0
        if (cue.type === 'block') {
          f.shieldUntil = Date.now() + BLOCK_MS
          f.score += grade === 'perfect' ? 35 : 20
        } else {
          const shielded = opp.shieldUntil > Date.now()
          dmg = hitDamage(cue.type, grade, f.combo, f.str, opp.sta, shielded)
          opp.hp = Math.max(0, opp.hp - dmg)
          f.score += dmg * 10 + (grade === 'perfect' ? 30 : 15)
        }
        syncMatch(m, { by: f.id, type: cue.type, grade, dmg })
        if (opp.hp <= 0) endMatch(m, f.id, 'ko')
      },
    },
  }
}
