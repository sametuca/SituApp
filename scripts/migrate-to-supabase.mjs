// Eski dosya verisini (server/data/social.json + homes.json) Supabase'e taşır.
// Ad tabanlı anahtarlar (örn. "elif"), kullanıcı adı eşleşen profile'ın uid'sine çevrilir; eşleşmeyenler atlanır ve raporlanır.
//
// Kullanım (sunucu env'i gerekir: server/.env ya da ortam değişkenleri):
//   node scripts/migrate-to-supabase.mjs --dry-run      yalnızca ne olacağını yazar
//   node scripts/migrate-to-supabase.mjs                gerçekten yazar (var olan satırların ÜSTÜNE yazar)
//   SITUAPP_DATA_DIR=/yol/data node scripts/migrate-to-supabase.mjs   farklı veri klasörü
// Gerekli: SUPABASE_URL, SUPABASE_SERVICE_KEY. (Ağ proxy'si olan ortamda: NODE_USE_ENV_PROXY=1)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as supa from '../server/supa.js'

const dry = process.argv.includes('--dry-run')
const DIR = process.env.SITUAPP_DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server', 'data')
const readJson = (f, fb) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
  } catch {
    return fb
  }
}
if (!supa.enabled) {
  console.error('SUPABASE_URL ve SUPABASE_SERVICE_KEY tanımlı değil.')
  process.exit(1)
}

// server/game.js'teki legacyKey ile aynı türetme
const legacyKey = (name) =>
  String(name ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16)
    .toLowerCase()
    .replace(/[^a-z0-9ğüşıöç_-]/g, '') || 'misafir'

const profiles = await supa.select('profiles', 'select=id,username')
const byLegacy = new Map() // eski anahtar → uid
for (const p of profiles) byLegacy.set(legacyKey(p.username), p.id)

const social = readJson('social.json', { users: {}, reports: [] })
const homes = readJson('homes.json', {})
const skipped = new Set()
const map = (k) => {
  if (supa.UUID_RE.test(k)) return k
  const uid = byLegacy.get(k)
  if (!uid) skipped.add(k)
  return uid ?? null
}
const remapKeys = (obj) => Object.fromEntries(Object.entries(obj ?? {}).flatMap(([k, v]) => (map(k) ? [[map(k), v]] : [])))

const users = []
for (const [oldKey, u] of Object.entries(social.users ?? {})) {
  const uid = map(oldKey)
  if (!uid) continue
  const d = structuredClone(u)
  d.blocks = remapKeys(d.blocks)
  d.friends = remapKeys(d.friends)
  d.inbox = (d.inbox ?? []).flatMap((i) => (i.key && map(i.key) ? [{ ...i, key: map(i.key) }] : i.key ? [] : [i]))
  if (d.stats) {
    for (const f of ['peers', 'guests']) if (d.stats[f]) d.stats[f] = remapKeys(d.stats[f])
    if (d.stats.friends?.rejected) d.stats.friends.rejected = remapKeys(d.stats.friends.rejected)
  }
  if (d.quests?.list) for (const q of d.quests.list) if (q.seen) q.seen = remapKeys(q.seen)
  if (d.quests?.suggest?.key) {
    const m = map(d.quests.suggest.key)
    d.quests.suggest = m ? { ...d.quests.suggest, key: m } : null
  }
  users.push({ uid, data: d })
}
const homeRows = Object.entries(homes).flatMap(([k, h]) => (map(k) ? [{ uid: map(k), data: h }] : []))
const reports = (social.reports ?? []).map((r) => ({
  reporter: map(r.from) ?? null,
  target: map(r.target) ?? null,
  reason: r.reason,
  data: r,
}))

console.log(`${dry ? '[kuru çalıştırma] ' : ''}kullanıcı: ${users.length}/${Object.keys(social.users ?? {}).length}, ev: ${homeRows.length}/${Object.keys(homes).length}, şikâyet: ${reports.length}`)
if (skipped.size) console.log(`Profili olmadığı için atlanan anahtarlar (${skipped.size}): ${[...skipped].join(', ')}`)
if (dry) process.exit(0)

for (let i = 0; i < users.length; i += 200) await supa.upsert('user_data', users.slice(i, i + 200), 'uid')
for (let i = 0; i < homeRows.length; i += 200) await supa.upsert('homes', homeRows.slice(i, i + 200), 'uid')
if (reports.length) await supa.insert('reports', reports)
console.log('Taşıma tamamlandı.')
