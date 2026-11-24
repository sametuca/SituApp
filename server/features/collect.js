// Toplanabilirler ve gizli noktalar. Konumlar: src/world/collectibles.js (istemciyle ortak). Sunucu otoriterdir:
// toplama aynı odada, oyuncunun SUNUCUDAKİ konumuna ≤ COLLECT_RADIUS m yakınken ve yeniden doğma süresi dolmuşsa geçerlidir.
//
// İstemci → sunucu
//   { t: 'collect', id }      bir toplanabilirı topla
//   { t: 'collect_get' }      koleksiyon durumunu iste (panel açılınca)
// Sunucu → istemci
//   { t: 'collect_xp', xp, bonus, kind, hidden }   toplamadan sonra toplam ⭐ (istemci seviye atlamayı buradan anlar)
//   { t: 'collected', id, kind, stars, ttl, chest? }   toplandı (ttl = yeniden doğmaya kalan ms)
//   { t: 'collect_state', c: { id: ttl }, s: { total, kinds, chests: [id], left: { tür: n }, series: [..] } }   welcome'da `collect` alanı olarak da gelir
//   Reddedilirse { t: 'info', text } (yarış/uzak/bekleme) – sessizce yok sayılan durumlar: bilinmeyen id, hız sınırı.
// Kalıcı: user.stats.collect = { id: sonToplamaZamanı(ms) }; ayrıca stats.collected / collectKinds / chests / collectSeries (progress.js sayaçları).
// Olaylar (ctx.emitEvent): collect (karşı = tür), collect_star (yalnızca yıldız), treasure (karşı = sandık id; "gizli hazine bul" görevi, Hazine Avcısı rozeti).
import { save, user } from '../store.js'
import { COLLECT_RADIUS, COLLECTIBLE_BY_ID, HALF_DAY_MS, HIDDEN_ALL_BONUS, HIDDEN_CHESTS, KINDS, KIND_ORDER } from '../../src/world/collectibles.js'
import { istanbul } from './progress.js'

const COOLDOWN_MS = 250 // iki toplama isteği arası (hız sınırı)
const ISTANBUL_OFFSET = '+03:00' // Türkiye yıl boyu UTC+3

/** Toplanabilirin bu kullanıcı için yeniden doğmasına kalan ms (0 = şu an alınabilir). */
function remaining(col, last, now = Date.now()) {
  if (!last) return 0
  const k = KINDS[col.kind]
  if (k.respawn === 'half') return Math.max(0, last + HALF_DAY_MS - now)
  const day = istanbul(last).day
  if (istanbul(now).day !== day) return 0
  const next = Date.parse(`${day}T00:00:00${ISTANBUL_OFFSET}`) + 86400000
  return Math.max(0, next - now)
}

export default function collect(ctx) {
  const { send } = ctx

  const ttlMap = (u, now = Date.now()) => {
    const out = {}
    for (const [id, last] of Object.entries(u.stats.collect ?? {})) {
      const col = COLLECTIBLE_BY_ID[id]
      if (!col) continue
      const r = remaining(col, last, now)
      if (r > 0) out[id] = r
    }
    return out
  }

  function stateOf(u) {
    const s = u.stats
    const now = Date.now()
    const c = ttlMap(u, now)
    const kinds = s.collectKinds ?? {}
    const left = {}
    for (const k of KIND_ORDER) left[k] = 0
    for (const col of Object.values(COLLECTIBLE_BY_ID)) if (!c[col.id]) left[col.kind]++
    return {
      c,
      s: {
        total: s.collected ?? 0,
        xp: s.stars ?? 0,
        kinds: Object.fromEntries(KIND_ORDER.map((k) => [k, kinds[k] ?? 0])),
        chests: Object.keys(s.chests ?? {}).filter((id) => COLLECTIBLE_BY_ID[id]),
        left,
        series: Object.keys(s.collectSeries ?? {}),
      },
    }
  }

  return {
    api: { collectState: (key) => stateOf(user(key)) },
    welcome: (me) => ({ collect: stateOf(user(me.key)) }),
    handlers: {
      collect_get(me) {
        const now = Date.now()
        if (now - (me.lastCollectGet ?? 0) < 800) return
        me.lastCollectGet = now
        send(me.ws, { t: 'collect_state', ...stateOf(user(me.key)) })
      },
      collect(me, msg) {
        const now = Date.now()
        if (now - (me.lastCollect ?? 0) < COOLDOWN_MS) return
        me.lastCollect = now
        const id = typeof msg.id === 'string' ? msg.id.slice(0, 40) : ''
        const col = COLLECTIBLE_BY_ID[id]
        if (!col || col.room !== me.room) return
        if (Math.hypot(me.x - col.x, me.z - col.z) > COLLECT_RADIUS) {
          ctx.strike?.(me, 'uzaktan toplama', 0.6)
          return send(me.ws, { t: 'info', text: 'Biraz daha yaklaş 🚶' })
        }
        const u = user(me.key)
        const s = u.stats
        const coll = (s.collect = s.collect ?? {})
        if (remaining(col, coll[id], now) > 0) return send(me.ws, { t: 'collect_state', ...stateOf(u) }) // zaten toplanmış: istemciyi eşitle
        coll[id] = now
        const k = KINDS[col.kind]
        s.stars = (s.stars ?? 0) + k.stars
        send(me.ws, { t: 'collected', id, kind: col.kind, stars: k.stars, ttl: remaining(col, now, now) })
        // sayaçlar, görevler, rozetler (progress modülü)
        ctx.emitEvent?.(me, 'collect', 1, col.kind)
        if (col.kind === 'star') ctx.emitEvent?.(me, 'collect_star')
        if (col.hidden) ctx.emitEvent?.(me, 'treasure', 1, id)
        // seri ödülleri (bir kerelik bonus ⭐)
        const series = (s.collectSeries = s.collectSeries ?? {})
        let bonus = 0
        const award = (sid, amount, label) => {
          if (series[sid]) return
          series[sid] = 1
          bonus += amount
          s.stars = (s.stars ?? 0) + amount
          send(me.ws, { t: 'info', text: `🏆 Seri tamamlandı: ${label} (+${amount} ⭐)` })
          send(me.ws, { t: 'collect_state', ...stateOf(u) })
        }
        const kindCount = s.collectKinds?.[col.kind] ?? 0
        if (kindCount >= k.series.goal) award(col.kind, k.series.bonus, k.series.name)
        if (col.hidden && HIDDEN_CHESTS.every((h) => s.chests?.[h.id])) award('hidden_all', HIDDEN_ALL_BONUS, 'Tüm gizli hazineler')
        send(me.ws, { t: 'collect_xp', xp: s.stars ?? 0, bonus, kind: col.kind, hidden: Boolean(col.hidden) }) // seviye/kutlama için toplam ⭐
        save()
        if (bonus) ctx.pushProgress?.(me.key) // bonus ⭐ progress durumuna da yansısın
      },
    },
  }
}
