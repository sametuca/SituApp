// Sosyal veriler için kalıcı depo (server/data/social.json): kullanıcı başına engeller, ayarlar, profil, arkadaşlar,
// mesaj kutusu, rozetler, görevler + şikâyet kayıtları. Kimlik anahtarı şimdilik oyuncu adından türer (homeKey);
// gerçek hesaplara geçilince anahtar kullanıcı id'si olmalı. Arayüz (user / save / addReport) aynı kalırsa
// depolama Supabase'e taşınabilir.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = process.env.SITUAPP_DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), 'data')
const FILE = path.join(DIR, 'social.json')

let db = { users: {}, reports: [] }
try {
  db = { users: {}, reports: [], ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }
} catch {
  /* ilk çalıştırma */
}

let timer = null
export function save() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    try {
      fs.mkdirSync(DIR, { recursive: true })
      const tmp = `${FILE}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(db))
      fs.renameSync(tmp, FILE)
    } catch (e) {
      console.error('Sosyal veri yazılamadı:', e.message)
    }
  }, 500)
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
  db.reports.push(r)
  if (db.reports.length > 500) db.reports.splice(0, db.reports.length - 500)
  save()
}
