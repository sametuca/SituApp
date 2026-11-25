// Meslekler: Bahçıvan (ev bahçesi → çanta → pazar), Balıkçı (kıyı iskeleleri), Postacı (Posta Merkezi → mekân kapıları).
// Sunucu OTORİTERdir: meslek, XP, çanta, balık zamanlaması/seçimi, kargo teslim kontrolü, fiyatlar ve günlük kazanç sınırları buradadır.
//
// Kalıcı: store.user(key).stats.job {id, xp:{gardener,fisher,postman}, sw}, stats.inv {crop:{}, fish:{}}, stats.jobq {day, job, list:[…]}
//
// Protokol
//   istemci → sunucu
//     { t: 'job_get' }                         durumu iste
//     { t: 'job_choose', id }                  meslek seç (ilk seçim ücretsiz; değiştirme SWITCH_COST altın + 6 sa bekleme)
//     { t: 'job_sell', kind: 'crop'|'fish', id | 'all' }   çantadan pazara sat
//     { t: 'fish_cast', spot }                 olta at (iskeleye ≤ radius+1)
//     { t: 'fish_reel' }                       oltayı çek (yalnızca "vurdu" penceresinde geçerli)
//     { t: 'fish_cancel' }                     vazgeç
//     { t: 'post_pickup' }                     Posta Merkezi'nde kargo yükle (kapasiteye kadar)
//     { t: 'post_deliver', id }                kapıya vardın, kargoyu teslim et
//     { t: 'post_drop' }                       tüm kargoları geri ver (ücretsiz)
//     { t: 'work_pose', style: 'tend'|null }   bahçe işi duruşu (kısa, yalnızca görsel)
//     { t: 'work_get' }                        odadaki çalışma duruşlarını iste
//   sunucu → istemci
//     { t: 'job_state', job, xp, inv, quests, market:{crop:{},fish:{}}, canSwitchAt, cap, parcels, spots? }
//     { t: 'job_level', job, level }           seviye atladın
//     { t: 'fish_state', phase: 'cast'|'wait'|'bite'|'miss'|'end', spot, win? }   olta durumu (yalnızca bana)
//     { t: 'fish_caught', fish, quick, xp, rare }
//     { t: 'post_state', parcels }             taşıdığım kargolar
//     { t: 'post_done', id, coins, express, bike, xp }
//     { t: 'work', id, style: 'fish'|'carry'|'tend'|null, phase? }   birinin çalışma duruşu (odaya)
//     { t: 'works', list: [{ id, style, phase }] }
import crypto from 'node:crypto'
import { CROP_BY_ID } from '../../src/world/homeGarden.js'
import { save, user } from '../store.js'
import { istanbul } from './progress.js'
import { VENUE_DOORS } from '../../src/world/venueDoors.js'
import { VENUES } from '../../src/world/venues.js'
import {
  BAG_MAX, CROP_PRICE, FISH, FISH_BY_ID, FISH_CAST_DIST, FISH_SPOTS, JOB_IDS, JOBS, MAX_JOB_LEVEL, PARCEL_DELIVER_R, PARCEL_FROM, PARCEL_KINDS, PERK,
  POST_CENTER, QUEST_TEMPLATES, SPEED_LIMIT, SWITCH_COOLDOWN_MS, SWITCH_COST, jobLevel, marketMult,
} from '../../src/world/jobsData.js'

const hash = (s) => {
  let h = 2166136261
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const RARE = new Set(['rare', 'epic', 'legend'])
const DEST = Object.values(VENUE_DOORS).filter((d) => d.id !== 'havalimani' && VENUES.some((v) => v.id === d.id))
const venueName = (id) => VENUES.find((v) => v.id === id)?.name ?? id

export default function jobs(ctx) {
  const { players, send, broadcast } = ctx

  // ---------- kalıcı durum ----------
  const st = (key) => {
    const s = user(key).stats
    s.job ??= { id: null, xp: { gardener: 0, fisher: 0, postman: 0 }, sw: 0 }
    s.job.xp ??= { gardener: 0, fisher: 0, postman: 0 }
    s.inv ??= { crop: {}, fish: {} }
    s.inv.crop ??= {}
    s.inv.fish ??= {}
    return s
  }
  const levelOf = (key, job) => jobLevel(st(key).job.xp[job] ?? 0).level
  const jobOf = (me) => st(me.key).job.id
  ctx.jobOf = jobOf

  function quests(me) {
    const s = st(me.key)
    const day = istanbul().day
    const id = s.job.id
    if (!id) return null
    if (s.jobq?.day !== day || s.jobq?.job !== id) {
      const tpls = [...QUEST_TEMPLATES[id]].sort((a, b) => hash(`${day}${me.key}${a.id}`) - hash(`${day}${me.key}${b.id}`)).slice(0, 3)
      s.jobq = {
        day,
        job: id,
        list: tpls.map((t) => ({ id: t.id, goal: t.min + (hash(`${day}${me.key}g${t.id}`) % (t.max - t.min + 1)), n: 0, done: false, u: [] })),
      }
      save()
    }
    return s.jobq
  }

  const parcelsOf = (me) => (me.parcels ??= [])
  const pubParcels = (me) => parcelsOf(me).map((p) => ({ id: p.id, to: p.to, name: venueName(p.to), kind: p.kind, from: p.from, exp: p.exp, pay: p.pay }))

  function marketFor() {
    const day = istanbul().day
    return { crop: Object.fromEntries(Object.keys(CROP_BY_ID).map((id) => [id, marketMult(day, id)])), fish: Object.fromEntries(FISH.map((f) => [f.id, marketMult(day, f.id)])) }
  }

  function push(me) {
    const s = st(me.key)
    const q = quests(me)
    send(me.ws, {
      t: 'job_state',
      job: s.job.id,
      xp: s.job.xp,
      inv: s.inv,
      quests: q ? q.list.map((x) => ({ id: x.id, goal: x.goal, n: x.n, done: x.done })) : [],
      market: marketFor(),
      canSwitchAt: (s.job.sw ?? 0) + SWITCH_COOLDOWN_MS,
      switchCost: SWITCH_COST,
      cap: PERK.cap(levelOf(me.key, 'postman')),
      parcels: pubParcels(me),
      coins: ctx.coinsOf?.(me.key) ?? 0,
    })
  }

  // ---------- çalışma duruşu (odaya yayılır) ----------
  function setWork(me, style, phase = null, extra = {}) {
    const prev = me.work
    if (!style && !prev) return
    if (prev && prev.style === style && prev.phase === phase && prev.fish === extra.fish && prev.pk === extra.pk) return
    me.work = style ? { style, phase, ...extra } : null
    broadcast({ t: 'work', id: me.id, style: style ?? null, phase, ...extra }, undefined, me.room, me)
  }
  const restWork = (me) => {
    const first = parcelsOf(me)[0]
    setWork(me, first && me.anim !== 'ride' ? 'carry' : null, null, first ? { pk: first.kind } : {})
  }

  // ---------- XP ve görevler ----------
  function addXp(me, n) {
    const s = st(me.key)
    const id = s.job.id
    if (!id || !(n > 0)) return
    const before = jobLevel(s.job.xp[id] ?? 0).level
    s.job.xp[id] = (s.job.xp[id] ?? 0) + Math.round(n)
    const after = jobLevel(s.job.xp[id]).level
    if (after > before) {
      send(me.ws, { t: 'job_level', job: id, level: after })
      send(me.ws, { t: 'info', text: `${JOBS[id].emoji} ${JOBS[id].name} seviye ${after} oldu!` })
    }
    save()
  }

  function questEvent(me, ev, n = 1, uniq = null) {
    const q = quests(me)
    if (!q) return
    const tpls = QUEST_TEMPLATES[q.job]
    let changed = false
    for (const item of q.list) {
      const t = tpls.find((x) => x.id === item.id)
      if (!t || t.ev !== ev || item.done) continue
      if (uniq != null) {
        if (item.u.includes(uniq)) continue
        item.u.push(uniq)
      }
      item.n = Math.min(item.goal, item.n + n)
      changed = true
      if (item.n >= item.goal) {
        item.done = true
        ctx.addCoins?.(me, t.coins, 'job_quest')
        addXp(me, t.xp)
        send(me.ws, { t: 'info', text: `✅ Meslek görevi tamamlandı: ${t.text(item.goal)} · +${t.coins} 🪙` })
        sfxTo(me, 'quest')
      }
    }
    if (changed) {
      save()
      push(me)
    }
  }
  const sfxTo = (me, name) => send(me.ws, { t: 'sfx', n: name })

  // dış modüller (bahçe) için
  ctx.jobEvent = (me, ev, n = 1) => {
    if (me) questEvent(me, ev, n)
  }
  ctx.jobGain = (me, xp) => addXp(me, xp)
  ctx.workTend = (me) => {
    if (!me || me.fish) return
    clearTimeout(me.tendTimer)
    setWork(me, 'tend')
    me.tendTimer = setTimeout(() => restWork(me), 1300)
  }
  ctx.bagAdd = (me, kind, id, n = 1) => {
    const inv = st(me.key).inv[kind]
    inv[id] = Math.min(BAG_MAX, (inv[id] ?? 0) + n)
    save()
  }

  // ---------- balıkçılık ----------
  const near = (me, p, r) => Math.hypot(me.x - p.x, me.z - p.z) <= r
  function endFish(me, tell = true, phase = 'end') {
    const f = me.fish
    if (!f) return
    clearTimeout(f.timer)
    me.fish = null
    if (tell) send(me.ws, { t: 'fish_state', phase, spot: f.spot })
    restWork(me)
  }
  function rollFish(me) {
    const lv = levelOf(me.key, 'fisher')
    const luck = PERK.luck(lv)
    const pool = FISH.filter((f) => f.lv <= lv)
    const w = pool.map((f) => f.w * (f.rar === 'rare' || f.rar === 'epic' || f.rar === 'legend' ? luck : f.rar === 'uncommon' ? 1 + (luck - 1) * 0.4 : 1))
    let r = Math.random() * w.reduce((a, b) => a + b, 0)
    for (let i = 0; i < pool.length; i++) {
      r -= w[i]
      if (r <= 0) return pool[i]
    }
    return pool[0]
  }

  // ---------- satış ----------
  function sell(me, kind, id) {
    const s = st(me.key)
    const inv = s.inv[kind]
    const ids = id === 'all' ? Object.keys(inv) : [id]
    const why = kind === 'crop' ? 'job_crop' : 'job_fish'
    let total = 0
    let count = 0
    const day = istanbul().day
    let capped = false
    for (const it of ids) {
      const have = inv[it] ?? 0
      if (!have) continue
      const base = kind === 'crop' ? CROP_PRICE[it] : FISH_BY_ID[it]?.price
      if (!base) continue
      const lv = levelOf(me.key, kind === 'crop' ? 'gardener' : 'fisher')
      const unit = Math.max(1, Math.round(base * marketMult(day, it) * PERK.sell(lv)))
      const left = ctx.earnLeft?.(me, why) ?? 0
      const can = Math.min(have, Math.floor(left / unit))
      if (can < have) capped = true
      if (can <= 0) continue
      inv[it] = have - can
      if (inv[it] <= 0) delete inv[it]
      total += unit * can
      count += can
    }
    if (count > 0) {
      ctx.addCoins?.(me, total, why)
      if (st(me.key).job.id === (kind === 'crop' ? 'gardener' : 'fisher')) questEvent(me, 'sell', count)
      save()
      send(me.ws, { t: 'info', text: `🪙 ${count} ürün pazara satıldı: +${total} altın` })
      sfxTo(me, 'quest')
    } else {
      send(me.ws, { t: 'info', text: capped ? '🪙 Bugünkü satış kazancı sınırına ulaştın, kalanı yarın sat!' : 'Satılacak ürün yok.' })
    }
    if (count > 0 && capped) send(me.ws, { t: 'info', text: '🪙 Günlük satış sınırı doldu; kalan ürünler çantanda bekliyor.' })
    push(me)
  }

  return {
    api: { levelOf, jobOf },
    welcome: (me) => {
      const s = st(me.key)
      return { job: s.job.id }
    },
    onJoin: (me) => {
      me.parcels = []
      me.work = null
    },
    onLeave: (me) => {
      if (me.fish) clearTimeout(me.fish.timer)
      me.fish = null
      if (me.work) broadcast({ t: 'work', id: me.id, style: null }, me.id, me.room, me)
    },
    onRoomChange: (me) => {
      if (me.fish) endFish(me, true)
      if (me.work?.style === 'fish') setWork(me, null)
      restWork(me)
    },
    handlers: {
      job_get(me) {
        push(me)
      },
      job_choose(me, msg) {
        const id = String(msg.id ?? '')
        if (!JOB_IDS.includes(id)) return
        const s = st(me.key)
        if (s.job.id === id) return
        const now = Date.now()
        if (me.lastJobSwitch && now - me.lastJobSwitch < 1500) return
        me.lastJobSwitch = now
        if (s.job.id) {
          if (now < (s.job.sw ?? 0) + SWITCH_COOLDOWN_MS) return send(me.ws, { t: 'info', text: '⏳ Mesleği çok sık değiştiremezsin, biraz bekle.' })
          if (!ctx.spendCoins?.(me, SWITCH_COST, 'meslek')) return send(me.ws, { t: 'info', text: `🪙 Meslek değiştirmek ${SWITCH_COST} altın.` })
        }
        s.job.id = id
        s.job.sw = now
        if (me.fish) endFish(me, true)
        save()
        send(me.ws, { t: 'info', text: `${JOBS[id].emoji} Artık ${JOBS[id].name}sın! Görevlerine panelden bak.` })
        sfxTo(me, 'badge')
        push(me)
      },
      job_sell(me, msg) {
        const kind = msg.kind === 'fish' ? 'fish' : msg.kind === 'crop' ? 'crop' : null
        if (!kind) return
        const now = Date.now()
        if (now - (me.lastSell ?? 0) < 350) return
        me.lastSell = now
        sell(me, kind, msg.id === 'all' ? 'all' : String(msg.id ?? ''))
      },

      // ----- balıkçılık -----
      fish_cast(me, msg) {
        const now = Date.now()
        if (now - (me.lastCast ?? 0) < 900) return
        me.lastCast = now
        if (me.room !== 'city') return
        if (jobOf(me) !== 'fisher') return send(me.ws, { t: 'info', text: '🎣 Balık tutmak için Balıkçı mesleğini seç (soldaki 💼 düğmesi).' })
        const spot = FISH_SPOTS.find((s) => s.id === msg.spot)
        if (!spot || !near(me, spot, spot.radius + 1.2)) return ctx.strike?.(me, 'uzak iskele', 0.5)
        if (me.fish) return
        if (me.anim === 'ride') return send(me.ws, { t: 'info', text: '🚲 Önce bisikletten in.' })
        const lv = levelOf(me.key, 'fisher')
        const waitMs = (2200 + Math.random() * 5200) * PERK.wait(lv)
        const f = (me.fish = { spot: spot.id, state: 'wait', biteAt: 0, win: PERK.window(lv), timer: null, t0: now })
        ctx.grace?.(me, 800)
        setWork(me, 'fish', 'cast')
        send(me.ws, { t: 'fish_state', phase: 'cast', spot: spot.id })
        f.timer = setTimeout(() => {
          if (me.fish !== f) return
          if (!near(me, spot, spot.radius + 2.5)) return endFish(me, true)
          f.state = 'bite'
          f.biteAt = Date.now()
          setWork(me, 'fish', 'bite')
          send(me.ws, { t: 'fish_state', phase: 'bite', spot: spot.id, win: f.win })
          f.timer = setTimeout(() => {
            if (me.fish !== f) return
            me.fish = null
            send(me.ws, { t: 'fish_state', phase: 'miss', spot: spot.id })
            restWork(me)
          }, f.win)
        }, waitMs + 700) // 700 ms: atış animasyonu
      },
      fish_reel(me) {
        const f = me.fish
        if (!f) return
        const spot = FISH_SPOTS.find((s) => s.id === f.spot)
        if (!spot || !near(me, spot, spot.radius + 2.5)) return endFish(me, true)
        const now = Date.now()
        if (f.state !== 'bite') {
          if (now - f.t0 < 700) return // atış sürerken
          endFish(me, true, 'early') // erken çektin: yem kaçtı
          return
        }
        const rt = now - f.biteAt
        if (rt < 110) return // insan dışı: yok say
        if (rt < 160) {
          me.fastReels = (me.fastReels ?? 0) + 1
          if (me.fastReels >= 6) ctx.strike?.(me, 'balık<160ms', 3)
        }
        clearTimeout(f.timer)
        me.fish = null
        const fish = rollFish(me)
        ctx.bagAdd(me, 'fish', fish.id, 1)
        const quick = rt < f.win * 0.45
        const gain = fish.xp + (quick ? 2 : 0)
        addXp(me, gain)
        questEvent(me, 'catch', 1)
        if (RARE.has(fish.rar)) questEvent(me, 'catch_rare', 1)
        if (quick) questEvent(me, 'catch_quick', 1)
        ctx.emitEvent?.(me, 'fish', 1, fish.id)
        send(me.ws, { t: 'fish_state', phase: 'end', spot: f.spot })
        send(me.ws, { t: 'fish_caught', fish: fish.id, quick, xp: gain, rare: RARE.has(fish.rar) })
        setWork(me, 'fish', 'reel', { fish: fish.id })
        setTimeout(() => {
          if (!me.fish) restWork(me)
        }, 1500)
        push(me)
      },
      fish_cancel(me) {
        if (me.fish) endFish(me, true)
      },

      // ----- postacılık -----
      post_pickup(me) {
        const now = Date.now()
        if (now - (me.lastPickup ?? 0) < 1500) return
        me.lastPickup = now
        if (me.room !== 'city') return
        if (jobOf(me) !== 'postman') return send(me.ws, { t: 'info', text: '📮 Kargo almak için Postacı mesleğini seç (soldaki 💼 düğmesi).' })
        if (!near(me, POST_CENTER, POST_CENTER.radius + 1.2)) return ctx.strike?.(me, 'uzak posta merkezi', 0.5)
        const list = parcelsOf(me)
        const cap = PERK.cap(levelOf(me.key, 'postman'))
        if (list.length >= cap) return send(me.ws, { t: 'info', text: `📦 Zaten en fazla ${cap} kargo taşıyabilirsin.` })
        const taken = new Set(list.map((p) => p.to))
        const options = DEST.filter((d) => !taken.has(d.id)).sort(() => Math.random() - 0.5)
        while (list.length < cap && options.length) {
          const d = options.pop()
          const kind = pick(PARCEL_KINDS)
          const dist = Math.hypot(d.x - POST_CENTER.x, d.z - POST_CENTER.z)
          list.push({
            id: crypto.randomBytes(4).toString('hex'),
            to: d.id,
            kind: kind.id,
            from: pick(PARCEL_FROM),
            dist,
            at: now,
            exp: now + Math.round((dist / 6.5 + 35) * 1000), // ekspres süresi
            pay: Math.round(9 + dist * 0.22 + kind.pay),
          })
        }
        restWork(me)
        sfxTo(me, 'mail')
        push(me)
      },
      post_deliver(me, msg) {
        const now = Date.now()
        if (now - (me.lastDeliver ?? 0) < 500) return
        me.lastDeliver = now
        const list = parcelsOf(me)
        const i = list.findIndex((p) => p.id === msg.id)
        if (i < 0) return
        const p = list[i]
        const door = VENUE_DOORS[p.to]
        if (!door || me.room !== 'city' || Math.hypot(me.x - door.x, me.z - door.z) > PARCEL_DELIVER_R + 1) return send(me.ws, { t: 'info', text: '📮 Kapıya biraz daha yaklaş.' })
        // imkânsız hız: Posta Merkezi'nden kapıya bu sürede gidilemez (ışınlanma/hile)
        if (now - p.at < (p.dist / SPEED_LIMIT) * 1000 - 800) {
          ctx.strike?.(me, 'imkânsız teslimat', 2)
          return
        }
        list.splice(i, 1)
        const lv = levelOf(me.key, 'postman')
        const express = now <= p.exp
        const bike = me.anim === 'ride'
        let pay = p.pay * PERK.pay(lv) * (express ? 1.5 : 1) * (bike ? 1.2 : 1)
        pay = Math.round(pay)
        const kind = PARCEL_KINDS.find((k) => k.id === p.kind)
        ctx.addCoins?.(me, pay, 'job_post')
        const xp = 8 + Math.round(p.dist / 12) + (express ? 6 : 0)
        addXp(me, xp)
        questEvent(me, 'deliver', 1)
        if (express) questEvent(me, 'express', 1)
        questEvent(me, 'deliver_unique', 1, p.to)
        if (kind && (kind.id === 'gift' || kind.id === 'flower')) questEvent(me, 'deliver_gift', 1)
        ctx.emitEvent?.(me, 'deliver', 1, p.to)
        send(me.ws, { t: 'post_done', id: p.id, to: p.to, coins: pay, express, bike, xp })
        restWork(me)
        push(me)
      },
      post_drop(me) {
        if (!parcelsOf(me).length) return
        me.parcels = []
        restWork(me)
        push(me)
      },

      // ----- görsel duruş -----
      work_pose(me, msg) {
        const now = Date.now()
        if (now - (me.lastWorkPose ?? 0) < 400) return
        me.lastWorkPose = now
        if (me.fish || me.pose) return
        clearTimeout(me.tendTimer)
        if (msg.style === 'tend') {
          setWork(me, 'tend')
          me.tendTimer = setTimeout(() => restWork(me), 1300)
        } else restWork(me)
      },
      work_get(me) {
        const list = []
        for (const o of players.values()) if (o.room === me.room && o.work && o.id !== me.id) list.push({ id: o.id, ...o.work })
        send(me.ws, { t: 'works', list })
        if (me.work) send(me.ws, { t: 'work', id: me.id, ...me.work })
      },
    },
  }
}
