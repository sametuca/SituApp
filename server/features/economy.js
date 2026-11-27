// Altın ekonomisi (küçük işlerden kazanılır; mağaza/harcama sonraki adım). Kalıcı: store.user(key).stats.coins.
// Diğer modüller: ctx.addCoins?.(oyuncu, n, sebep) → yeni bakiye. Oyuncu bağlıysa { t:'coins', n, d, why } gönderilir.
//   istemci → sunucu: { t: 'coins_get' }     sunucu → istemci: { t: 'coins', n: bakiye, d: değişim, why } ; welcome.coins
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { save, user } from '../store.js'
import { istanbul } from './progress.js'
import { coinBonusPct } from '../../src/world/boxing.js'

// Altın hilesine karşı: (1) yalnızca sunucu verir; (2) neden başına ve toplam GÜNLÜK kazanç sınırı; (3) her işlem coins.log defterine yazılır;
// (4) aynı IP'deki hesaplar birbirine voleybol ödülü kazandıramaz, aynı çift günde ≤ 3 ödül alır.
const LOG = path.join(process.env.SITUAPP_DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data'), 'coins.log')
const DAILY_CAP = { dj: 400, meetup: 60, voley: 90, kale: 50, hosgeldin: 100, fish: 260, post: 260, surf: 300, minigame: 350, boxing: 280, workout: 120, job_crop: 260, job_fish: 260, job_post: 280, job_quest: 160 }
const DAILY_TOTAL = 1000

const MAX_COINS = 1_000_000

export default function economy(ctx) {
  const { players, send } = ctx

  const coinsOf = (key) => (key ? (user(key).stats.coins ?? 0) : 0)

  ctx.coinsOf = coinsOf
  const ledger = (who, d, why, bal) => {
    try {
      fs.mkdirSync(path.dirname(LOG), { recursive: true })
      fs.appendFileSync(LOG, `${new Date().toISOString()} ${who.key} ${who.name ?? ''} ${d > 0 ? '+' : ''}${d} ${why} =${bal}\n`)
    } catch {
      /* defter yazılamazsa oyun durmaz */
    }
  }
  /** Bugün bu nedenle kazanılabilecek kalan altın (neden sınırı ve toplam sınırın küçüğü). */
  ctx.earnLeft = (who, why = '') => {
    if (!who?.key) return 0
    const u = user(who.key)
    const day = istanbul().day
    const e = u.stats.earned?.day === day ? u.stats.earned : { total: 0, by: {} }
    return Math.max(0, Math.min((DAILY_CAP[why] ?? 120) - (e.by[why] ?? 0), DAILY_TOTAL - e.total))
  }
  ctx.addCoins = (who, amount, why = '') => {
    let d = Math.trunc(amount)
    if (!who?.key || !Number.isFinite(d) || d === 0) return coinsOf(who?.key)
    const u = user(who.key)
    if (d > 0) {
      // Karizma statı pozitif altın kazançlarına bonus ekler (hoşgeldin hariç)
      if (why && why !== 'hosgeldin') {
        const pct = coinBonusPct(ctx.attrOf?.(who.key)?.cha ?? 0)
        if (pct > 0) d = Math.max(d, Math.round(d * (1 + pct / 100)))
      }
      // günlük kazanç sınırları (harcama etkilenmez)
      const day = istanbul().day
      const e = (u.stats.earned = u.stats.earned?.day === day ? u.stats.earned : { day, total: 0, by: {} })
      const capWhy = DAILY_CAP[why] ?? 120
      if ((e.by[why] ?? 0) + d > capWhy || e.total + d > DAILY_TOTAL) {
        const p0 = who.ws ? who : [...players.values()].find((o) => o.key === who.key)
        if (p0 && !p0.capTold) {
          p0.capTold = true
          send(p0.ws, { t: 'info', text: '₺ Bugünkü TL kazanç sınırına ulaştın, yarın devam!' })
        }
        ledger(who, 0, `${why}:SINIR`, coinsOf(who.key))
        return coinsOf(who.key)
      }
      e.by[why] = (e.by[why] ?? 0) + d
      e.total += d
    }
    u.stats.coins = Math.min(MAX_COINS, Math.max(0, (u.stats.coins ?? 0) + d))
    save()
    ledger(who, d, why, u.stats.coins)
    const p = who.ws ? who : [...players.values()].find((o) => o.key === who.key)
    if (p) send(p.ws, { t: 'coins', n: u.stats.coins, d, why })
    return u.stats.coins
  }

  // iki oyunculu ödül uygun mu? (aynı IP = aynı kişi sayılır; aynı çift günde ≤ 3 ödüllü maç)
  const pairs = new Map()
  ctx.pairReward = (a, b, kind) => {
    if (!a?.key || !b?.key || a.key === b.key) return false
    if (a.ip && a.ip === b.ip && a.ip !== '127.0.0.1') return false
    const day = istanbul().day
    const k = `${day}|${kind}|${[a.key, b.key].sort().join('|')}`
    const n = pairs.get(k) ?? 0
    if (n >= 3) return false
    pairs.set(k, n + 1)
    if (pairs.size > 20000) for (const kk of pairs.keys()) if (!kk.startsWith(day)) pairs.delete(kk)
    return true
  }

  /** Altın harcar; yetmezse false döner (bakiye değişmez). */
  ctx.spendCoins = (who, amount, why = '') => {
    const n = Math.trunc(amount)
    if (!who?.key || !Number.isFinite(n) || n < 0) return false
    if (coinsOf(who.key) < n) return false
    if (n > 0) ctx.addCoins(who, -n, why)
    return true
  }

  return {
    welcome: (me) => ({ coins: coinsOf(me.key) }),
    handlers: {
      coins_get(me) {
        send(me.ws, { t: 'coins', n: coinsOf(me.key), d: 0, why: '' })
      },
    },
  }
}
