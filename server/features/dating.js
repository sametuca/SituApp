// Flört & Sosyal Motoru: Mod (Vibe), Canlı Sıcak Nokta, 3 Dakikalık Hızlı Randevu Masası,
// Uyum Seviyesi (Bond 1–5), Tek Tık Buz Kırıcılar, Zamanlı Kasaba Etkinlikleri ve Fısıltı Gizliliği.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { save, user } from '../store.js'
import { ICEBREAKERS, SPEED_QUESTIONS, VIBE_BY_ID, VIBES, bondLevelOf, townEventStatus } from '../../src/world/datingData.js'

const DATA_DIR = process.env.SITUAPP_DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data')
const BONDS_FILE = path.join(DATA_DIR, 'dating-bonds.json')
const SD_DURATION_MS = 180_000

const loadBonds = () => {
  try {
    const raw = JSON.parse(fs.readFileSync(BONDS_FILE, 'utf8'))
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

const saveBonds = (data) => {
  try {
    fs.mkdirSync(path.dirname(BONDS_FILE), { recursive: true })
    fs.writeFileSync(BONDS_FILE, JSON.stringify(data, null, 2))
  } catch {
    /* ignore */
  }
}

const pairKey = (k1, k2) => [String(k1), String(k2)].sort().join('|')

export default function dating(ctx) {
  const { players, send } = ctx
  const bonds = loadBonds() // pairKey → { xp, matched, names: { [key]: name } }

  const getBond = (k1, k2) => {
    if (!k1 || !k2 || k1 === k2) return null
    return bonds[pairKey(k1, k2)] ?? null
  }

  const bondsFor = (key) => {
    const out = []
    for (const [pk, b] of Object.entries(bonds)) {
      if (!pk.includes(key)) continue
      const [a, c] = pk.split('|')
      if (a !== key && c !== key) continue
      const otherKey = a === key ? c : a
      out.push({ key: otherKey, name: b.names?.[otherKey] ?? 'Oyuncu', matched: Boolean(b.matched), ...bondLevelOf(b.xp ?? 0) })
    }
    return out.sort((x, y) => y.xp - x.xp).slice(0, 20)
  }

  const pushBonds = (who) => {
    const p = who?.ws ? who : [...players.values()].find((o) => o.key === who?.key)
    if (p && p.ws.readyState === 1) send(p.ws, { t: 'bonds_state', list: bondsFor(p.key) })
  }

  const addBond = (a, b, xp = 5, matched = false) => {
    const ka = typeof a === 'string' ? a : a?.key
    const kb = typeof b === 'string' ? b : b?.key
    if (!ka || !kb || ka === kb) return null
    const pk = pairKey(ka, kb)
    const cur = (bonds[pk] ??= { xp: 0, matched: false, names: {} })
    const prevLv = bondLevelOf(cur.xp).lv
    cur.xp = Math.min(9999, (cur.xp ?? 0) + xp)
    if (matched) cur.matched = true
    if (a?.name) cur.names[ka] = a.name
    if (b?.name) cur.names[kb] = b.name
    saveBonds(bonds)
    const nextLv = bondLevelOf(cur.xp).lv
    pushBonds(a)
    pushBonds(b)
    if (nextLv > prevLv) {
      const info = bondLevelOf(cur.xp)
      for (const who of [a, b]) {
        const p = who?.ws ? who : [...players.values()].find((o) => o.key === (typeof who === 'string' ? who : who?.key))
        if (p && p.ws.readyState === 1) {
          send(p.ws, { t: 'info', text: `${info.emoji} Uyum Seviyesi ${nextLv} (${info.title}) açıldı! ${info.perk}` })
        }
      }
    }
    return cur
  }

  ctx.addBond = addBond
  ctx.canWhisper = (from, to) => {
    if (!from?.key || !to?.key || from.key === to.key) return true
    const priv = user(to.key).stats.whisperPrivacy ?? 'all'
    if (priv !== 'matched') return true
    const b = getBond(from.key, to.key)
    if (b && (b.matched || (b.xp ?? 0) >= 40)) return true
    const friends = user(to.key).friends ?? []
    return Array.isArray(friends) && friends.includes(from.key)
  }

  // ---------- Canlı Sıcak Nokta & Mod Sayıları ----------
  const computePulse = () => {
    const zoneCounts = {}
    const vibeCounts = Object.fromEntries(VIBES.map((v) => [v.id, 0]))
    for (const p of players.values()) {
      const z = p.zoneId || 'beach'
      zoneCounts[z] = (zoneCounts[z] ?? 0) + 1
      const vb = user(p.key).stats.vibe
      if (vb && vibeCounts[vb] !== undefined) vibeCounts[vb] += 1
    }
    const ev = townEventStatus()
    let hotZone = ev.active ? ev.event.zone : 'beach'
    let hotCount = 0
    for (const [z, c] of Object.entries(zoneCounts)) {
      if (c > hotCount) {
        hotCount = c
        hotZone = z
      }
    }
    return { t: 'dating_pulse', hotZone, hotCount, vibeCounts, event: ev, sdQueue: sdQueue.length }
  }

  // ---------- 3 Dakikalık Hızlı Randevu Masası ----------
  const sdQueue = []
  const sdMatches = new Map() // sid → session
  const sdOf = new Map() // playerId → sid

  const pickQuestions = () => {
    const copy = [...SPEED_QUESTIONS]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1)
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy.slice(0, 5)
  }

  const syncSd = (s) => {
    for (const p of s.pair) {
      const opp = s.pair.find((x) => x.id !== p.id)
      const pl = players.get(p.id)
      if (!pl || pl.ws.readyState !== 1) continue
      const myVotes = s.votes[p.id]
      const opVotes = s.votes[opp.id]
      let same = 0
      let both = 0
      for (let i = 0; i < s.qs.length; i++) {
        if (myVotes[i] && opVotes[i]) {
          both += 1
          if (myVotes[i] === opVotes[i]) same += 1
        }
      }
      send(pl.ws, {
        t: 'sd_state',
        sid: s.id,
        endsAt: s.endsAt,
        opp: { id: opp.id, name: opp.name, avatar: opp.avatar },
        qs: s.qs,
        myVotes,
        opVotes: opVotes.map((v, i) => (myVotes[i] ? v : v ? '?' : null)),
        compat: both > 0 ? Math.round((same / both) * 100) : null,
        myDec: s.dec[p.id],
        opDecDone: s.dec[opp.id] !== null,
      })
    }
  }

  const finishSd = (s, reason = 'done') => {
    if (!sdMatches.delete(s.id)) return
    clearTimeout(s.timer)
    for (const p of s.pair) sdOf.delete(p.id)
    const [A, B] = s.pair
    const matched = s.dec[A.id] === 'like' && s.dec[B.id] === 'like'
    const pa = players.get(A.id)
    const pb = players.get(B.id)
    if (matched) {
      const ev = townEventStatus()
      const xp = ev.active && ev.event.id === 'cafe_date' ? 80 : 40
      addBond(pa ?? A, pb ?? B, xp, true)
      if (pa) {
        ctx.addCoins?.(pa, 15, 'meetup')
        ctx.bumpStat?.(pa, 'cha', 2)
      }
      if (pb) {
        ctx.addCoins?.(pb, 15, 'meetup')
        ctx.bumpStat?.(pb, 'cha', 2)
      }
    }
    for (const p of s.pair) {
      const opp = s.pair.find((x) => x.id !== p.id)
      const pl = players.get(p.id)
      if (pl && pl.ws.readyState === 1) send(pl.ws, { t: 'sd_end', sid: s.id, matched, reason, oppName: opp.name })
    }
  }

  const startSd = (a, b) => {
    const sid = `sd_${crypto.randomUUID().slice(0, 8)}`
    const s = {
      id: sid,
      pair: [
        { id: a.id, key: a.key, name: a.name, avatar: a.avatar },
        { id: b.id, key: b.key, name: b.name, avatar: b.avatar },
      ],
      qs: pickQuestions(),
      votes: { [a.id]: Array(5).fill(null), [b.id]: Array(5).fill(null) },
      dec: { [a.id]: null, [b.id]: null },
      endsAt: Date.now() + SD_DURATION_MS,
      timer: null,
    }
    sdMatches.set(sid, s)
    sdOf.set(a.id, sid)
    sdOf.set(b.id, sid)
    syncSd(s)
    s.timer = setTimeout(() => finishSd(s, 'time'), SD_DURATION_MS + 500)
    s.timer.unref?.()
  }

  const leaveSdQueue = (p) => {
    const i = sdQueue.indexOf(p)
    if (i >= 0) sdQueue.splice(i, 1)
  }

  // Periyodik canlı nabız (25 sn)
  let lastEvKey = ''
  setInterval(() => {
    const pulse = computePulse()
    const evKey = pulse.event.active ? `${pulse.event.event.id}|${Math.floor(Date.now() / (20 * 60_000))}` : ''
    const announced = Boolean(evKey && evKey !== lastEvKey)
    if (announced) lastEvKey = evKey
    for (const p of players.values()) {
      if (p.ws.readyState !== 1) continue
      send(p.ws, pulse)
      if (announced) send(p.ws, { t: 'info', text: `${pulse.event.event.emoji} ${pulse.event.event.title} başladı! ${pulse.event.event.desc}` })
    }
  }, 25_000).unref?.()

  return {
    welcome: (me) => {
      const st = user(me.key).stats
      return {
        dating: {
          vibe: st.vibe ?? null,
          whisperPrivacy: st.whisperPrivacy ?? 'all',
          bonds: bondsFor(me.key),
          pulse: computePulse(),
        },
      }
    },
    onLeave(me) {
      leaveSdQueue(me)
      const sid = sdOf.get(me.id)
      if (sid) {
        const s = sdMatches.get(sid)
        if (s) finishSd(s, 'left')
      }
    },
    handlers: {
      dating_info(me) {
        send(me.ws, computePulse())
        pushBonds(me)
      },
      vibe_set(me, msg) {
        const v = VIBE_BY_ID[msg.vibe] ? msg.vibe : null
        user(me.key).stats.vibe = v
        save()
        send(me.ws, { t: 'vibe_state', vibe: v })
        send(me.ws, computePulse())
      },
      privacy_set(me, msg) {
        const mode = msg.whisperPrivacy === 'matched' ? 'matched' : 'all'
        user(me.key).stats.whisperPrivacy = mode
        save()
        send(me.ws, { t: 'privacy_state', whisperPrivacy: mode })
      },
      icebreaker(me, msg) {
        const target = players.get(msg.toId)
        const ib = ICEBREAKERS.find((x) => x.id === msg.id) ?? ICEBREAKERS[0]
        if (!target || target.id === me.id) return
        if (!ctx.canWhisper(me, target)) return send(me.ws, { t: 'info', text: `🛡️ ${target.name} yalnızca arkadaşlar ve eşleşmelerden mesaj kabul ediyor.` })
        const now = Date.now()
        if (now - (me.lastIb ?? 0) < 3000) return
        me.lastIb = now
        addBond(me, target, 10, false)
        ctx.bumpStat?.(me, 'cha', 1)
        send(target.ws, { t: 'icebreaker_rx', fromId: me.id, fromName: me.name, emoji: ib.emoji, text: ib.text })
        send(me.ws, { t: 'info', text: `${ib.emoji} ${target.name} kişisine buz kırıcı gönderdin! (+10 Uyum XP)` })
      },
      sd_join(me) {
        if (sdOf.has(me.id) || sdQueue.includes(me)) return
        sdQueue.push(me)
        if (sdQueue.length >= 2) {
          const a = sdQueue.shift()
          const b = sdQueue.shift()
          if (players.has(a.id) && players.has(b.id)) startSd(a, b)
        } else {
          send(me.ws, { t: 'sd_queued', count: sdQueue.length })
        }
      },
      sd_leave(me) {
        leaveSdQueue(me)
        const sid = sdOf.get(me.id)
        if (sid) {
          const s = sdMatches.get(sid)
          if (s) finishSd(s, 'left')
        }
        send(me.ws, { t: 'sd_left' })
      },
      sd_vote(me, msg) {
        const s = sdMatches.get(sdOf.get(me.id))
        if (!s) return
        const qi = Math.trunc(Number(msg.qi))
        if (qi < 0 || qi >= s.qs.length) return
        const choice = msg.choice === 'a' ? 'a' : msg.choice === 'b' ? 'b' : null
        if (!choice) return
        s.votes[me.id][qi] = choice
        syncSd(s)
      },
      sd_chat(me, msg) {
        const s = sdMatches.get(sdOf.get(me.id))
        if (!s) return
        const text = String(msg.text ?? '').trim().slice(0, 140)
        if (!text) return
        for (const p of s.pair) {
          const pl = players.get(p.id)
          if (pl && pl.ws.readyState === 1) send(pl.ws, { t: 'sd_chat', sid: s.id, fromId: me.id, fromName: me.name, text })
        }
      },
      sd_decide(me, msg) {
        const s = sdMatches.get(sdOf.get(me.id))
        if (!s) return
        s.dec[me.id] = msg.like ? 'like' : 'pass'
        const [A, B] = s.pair
        if (s.dec[A.id] && s.dec[B.id]) finishSd(s, 'decided')
        else syncSd(s)
      },
    },
  }
}
