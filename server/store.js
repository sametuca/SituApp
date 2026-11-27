// Sosyal veriler için kalıcı depo: kullanıcı başına engeller, ayarlar, profil, arkadaşlar,
// mesaj kutusu, rozetler, görevler + şikâyet kayıtları. Arayüz SENKRON (user / save / hasUser / allUsers / addReport).
// - Supabase ortamı varsa (server/supa.js): açılışta `user_data` tamamen belleğe yüklenir (`await initStore()`),
//   değişenler write-behind ile yazılır (800 ms), şikâyetler `reports` tablosuna eklenir. Anahtar = auth uid.
// - Yoksa (demo): server/data/social.json dosyası; anahtar oyuncu adından türer.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import * as supa from './supa.js'

const DIR = process.env.SITUAPP_DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), 'data')
const FILE = path.join(DIR, 'social.json')

let db = { users: {}, reports: [] }
try {
  db = { users: {}, reports: [], ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }
} catch {
  /* ilk çalıştırma */
}

let mirror = null
/** Supabase modunda kullanıcı kayıtlarını yükler; dosya modunda bir şey yapmaz. sunucu listen etmeden önce çağır. */
export async function initStore() {
  if (!supa.enabled) return
  const rows = await supa.select('user_data', 'select=uid,data')
  db = { users: {}, reports: [] }
  for (const r of rows) db.users[r.uid] = r.data ?? {}
  mirror = supa.createMirror({ table: 'user_data', getAll: () => db.users, toRow: (uid, data) => ({ uid, data }), label: 'Kullanıcı verisi' })
  mirror.prime(rows, (r) => r.uid, (r) => r.data ?? {})
  console.log(`Supabase: ${rows.length} kullanıcı kaydı yüklendi.`)
}

let timer = null
export function save() {
  if (supa.enabled) return mirror?.touch()
  if (timer) return // kısıtlama: yoğun aktivitede de en geç 4 sn'de bir yazılır
  timer = setTimeout(() => {
    timer = null
    try {
      fs.mkdirSync(DIR, { recursive: true })
      const tmp = `${FILE}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(db))
      fs.renameSync(tmp, FILE)
    } catch (e) {
      console.error('Sosyal veri yazılamadı:', e.message)
    }
  }, 4000)
}

const defaults = () => ({
  name: '',
  blocks: {}, // anahtar → ad
  dnd: false, // rahatsız etme
  profile: null, // { bio, age, city, tags: [] }
  friends: {}, // anahtar → ad
  inbox: [], // çevrimdışıyken gelen mesajlar
  badges: [],
  stats: {},
  quests: null,
  cosmetics: { accessory: null, pet: null },
  gifts: [], // kabul edilen hediyeler: [{ uid, kind, from, ts }]
  lastSeen: 0,
})

/** Kullanıcı kaydını (yoksa varsayılanlarla) döndürür. Dönen nesneyi değiştirip save() çağır. */
export function user(key) {
  if (!db.users[key]) db.users[key] = defaults()
  else for (const [k, v] of Object.entries(defaults())) if (db.users[key][k] === undefined) db.users[key][k] = v
  return db.users[key]
}
export const hasUser = (key) => Boolean(db.users[key])
export const allUsers = () => db.users

export function addReport(r) {
  if (supa.enabled) {
    const uuid = (k) => (supa.UUID_RE.test(k ?? '') ? k : null)
    const { ts, from, fromName, target, targetName, reason, ...rest } = r
    supa
      .insert('reports', [{ reporter: uuid(from), target: uuid(target), reason, data: { ts, fromName, targetName, from, target, ...rest } }])
      .catch((e) => console.error('Şikâyet yazılamadı:', e.message))
    return
  }
  db.reports.push({ ...r, id: r.id ?? crypto.randomUUID() })
  if (db.reports.length > 500) db.reports.splice(0, db.reports.length - 500)
  save()
}

// dosya modunda (Supabase yok) kapanırken bekleyen yazmayı hemen yap (kısıtlama yüzünden son 4 sn kaybolmasın)
function writeNow() {
  try {
    fs.mkdirSync(DIR, { recursive: true })
    fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(db))
    fs.renameSync(`${FILE}.tmp`, FILE)
  } catch {
    /* kapanırken sessiz */
  }
}
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (!supa.enabled) writeNow() // çıkışı supa.hookShutdown() yapar (index.js)
  })
}

/** Yönetici paneli: tüm şikâyetler (yeniden eskiye). id: dosya modunda sıra no, Supabase'de satır id'si. */
export async function allReports() {
  if (supa.enabled) {
    const rows = await supa.select('reports', 'select=*&order=created_at.desc&limit=300').catch(() => supa.select('reports', 'select=*'))
    return rows.slice(0, 300).map((r) => ({ id: String(r.id), reason: r.reason, resolved: Boolean(r.data?.resolved), ...r.data, reporter: r.reporter, target: r.target }))
  }
  return db.reports.map((r, i) => ({ ...r, id: String(r.id ?? i), resolved: Boolean(r.resolved) })).reverse()
}
export async function resolveReport(id) {
  if (supa.enabled) {
    const rows = await supa.select('reports', `select=id,data&id=eq.${encodeURIComponent(id)}`)
    if (!rows[0]) return
    return supa.patch('reports', `id=eq.${encodeURIComponent(id)}`, { data: { ...rows[0].data, resolved: true } })
  }
  const r = db.reports.find((report, i) => String(report.id ?? i) === String(id))
  if (r) {
    r.resolved = true
    save()
  }
}
