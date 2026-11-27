// Günlük Ortak Görevler (Duo): tek başına yapılamaz, başka bir oyuncuyla birlikte tamamlanır.
// Her oyuncuya günde 3 ortak görev düşer (Europe/Istanbul günü, kimlikten deterministik). İlerleme ctx.emitEvent'i
// dinleyerek (peer = karşıdaki oyuncu) çift bazında izlenir; tamamlanan görev ve ödül kalıcıdır (user.stats.duo).
// İstemci → sunucu: { t: 'duo_get' }   Sunucu → istemci: { t: 'duo', list, left } · { t: 'duo_done', id, partner, coins }
import { save, user } from '../store.js'
import { istanbul } from './progress.js'

const REWARD = 20
const MSG_GAP = 20_000 // aynı kişiden sayılan iki mesaj arası en az
const TALK_SPAN = 5 * 60_000
const TALK_EACH = 3

export const DUO_QUESTS = [
  { id: 'talk', emoji: '☕', title: 'Birlikte 5 dk sohbet edin', desc: 'Aynı kişiyle özel mesaj ya da fısıltıyla yazışın: ikiniz de en az 3 mesaj atın ve sohbet 5 dakika sürsün.' },
  { id: 'dance', emoji: '💃', title: 'Çift dans edin', desc: 'Yakındaki biriyle dansa davet edin; ikiniz birlikte dans pistine çıkın.' },
  { id: 'match', emoji: '💞', title: 'Karşılıklı kalp gönderin', desc: 'Birine kalp jesti yapın, o da size yapsın: eşleşme!' },
  { id: 'gesture', emoji: '🌸', title: 'Birbirinize jest yollayın', desc: 'Aynı kişiyle ikiniz de birbirinize bir jest (selam, çiçek, göz kırpma…) yapın.' },
]
const BY_ID = Object.fromEntries(DUO_QUESTS.map((q) => [q.id, q]))

const hash = (s) => {
  let h = 2166136261
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}
/** Bugünün 3 görevi (4 görevden kimliğe göre biri dışarıda kalır). */
export function picksOf(day, key) {
  const skip = hash(`${day}|${key}`) % DUO_QUESTS.length
  return DUO_QUESTS.filter((_, i) => i !== skip).map((q) => q.id)
}

export default function duo(ctx) {
  const { players, send } = ctx
  const pairs = new Map() // `${gün}|${a}|${b}` → { sent:{key:n}, last:{key:ts}, gest:{key:n}, first, lastAt }
  const online = (key) => [...players.values()].find((p) => p.key === key)

  const mine = (key) => {
    const u = user(key)
    const day = istanbul().day
    if (u.stats.duo?.day !== day) u.stats.duo = { day, done: {} }
    return u.stats.duo
  }
  const view = (key) => {
    const d = mine(key)
    const day = d.day
    const list = picksOf(day, key).map((id) => ({ id, emoji: BY_ID[id].emoji, title: BY_ID[id].title, desc: BY_ID[id].desc, reward: REWARD, done: d.done[id] ?? null }))
    return { list, left: list.filter((x) => !x.done).length }
  }
  const push = (key) => {
    const p = online(key)
    if (p) send(p.ws, { t: 'duo', ...view(key) })
  }

  function complete(a, b, qid) {
    // a, b: { key }; ödül yalnızca uygun çifte (aynı IP değil, günde ≤ 3 çift ödülü) verilir
    const pa = online(a.key)
    const pb = online(b.key)
    const day = istanbul().day
    let paid = null
    for (const [me, , po, pOther] of [[a, b, pa, pb], [b, a, pb, pa]]) {
      if (!picksOf(day, me.key).includes(qid)) continue
      const d = mine(me.key)
      if (d.done[qid]) continue
      if (paid === null) paid = !!(pa && pb && ctx.pairReward?.(pa, pb, 'duo'))
      d.done[qid] = pOther?.name ?? 'Bir oyuncu'
      const coins = paid ? REWARD : 0
      if (coins) ctx.addCoins?.(po ?? me, coins, 'duo')
      save()
      if (po) {
        send(po.ws, { t: 'duo_done', id: qid, partner: d.done[qid], coins })
        send(po.ws, { t: 'info', text: `🤝 Ortak görev tamamlandı: ${BY_ID[qid].title} (${d.done[qid]})${coins ? ` · +${coins} 🪙` : ''}` })
        push(me.key)
      }
    }
  }

  const pairOf = (a, b) => {
    const day = istanbul().day
    const k = `${day}|${[a, b].sort().join('|')}`
    let s = pairs.get(k)
    if (!s) {
      if (pairs.size > 20000) for (const kk of pairs.keys()) if (!kk.startsWith(day)) pairs.delete(kk)
      s = { sent: {}, last: {}, gest: {}, first: 0, lastAt: 0 }
      pairs.set(k, s)
    }
    return s
  }

  // olay veriyolunu dinle (progress modülü ctx.emitEvent'i daha önce tanımlar)
  const orig = ctx.emitEvent
  ctx.emitEvent = (me, type, n = 1, peer) => {
    orig?.(me, type, n, peer)
    try {
      const pk = typeof peer === 'string' ? peer : peer?.key
      if (!me?.key || !pk || pk === me.key || !user(pk)) return
      const now = Date.now()
      if (type === 'dance') return complete(me, { key: pk }, 'dance')
      if (type === 'match') return complete(me, { key: pk }, 'match')
      if (type === 'chat' || type === 'whisper') {
        const s = pairOf(me.key, pk)
        if (now - (s.last[me.key] ?? 0) < MSG_GAP) return
        s.last[me.key] = now
        s.sent[me.key] = (s.sent[me.key] ?? 0) + 1
        s.first ||= now
        s.lastAt = now
        if (s.sent[me.key] >= TALK_EACH && (s.sent[pk] ?? 0) >= TALK_EACH && s.lastAt - s.first >= TALK_SPAN) complete(me, { key: pk }, 'talk')
      } else if (type === 'gesture') {
        const s = pairOf(me.key, pk)
        s.gest[me.key] = 1
        if (s.gest[pk]) complete(me, { key: pk }, 'gesture')
      }
    } catch {
      /* görev izleme asla oyunu bozmasın */
    }
  }

  return {
    welcome: (me) => ({ duo: view(me.key) }),
    handlers: {
      duo_get(me) {
        const now = Date.now()
        if (now - (me.lastDuoGet ?? 0) < 500) return
        me.lastDuoGet = now
        send(me.ws, { t: 'duo', ...view(me.key) })
      },
    },
  }
}
