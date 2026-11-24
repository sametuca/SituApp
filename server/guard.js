// Hile/bot koruması (sunucu otoriter). İstemci kodu kullanıcının elindedir (konsoldan enjekte edilebilir, bir yapay zekâya hile yazdırılabilir):
// bu yüzden güvenilen tek yer sunucudur. Burada: ban deposu (kalıcı, sınırsız), şüpheli davranış puanı (strike), mesaj taşması sınırı,
// hareket doğrulaması (hız/ışınlanma/sınır), tuzak mesajlar (honeypot) ve IP başına bağlantı sınırı.
//   Ban: hesap anahtarı (uid / ad) + IP; sunucu kapanıp açılsa da sürer (server/data/bans.json). Yönetici panelinden kaldırılır.
//   TRUST_PROXY=1 ise IP, x-forwarded-for'un ilk adresinden alınır (bir ters vekil arkasındaysan); aksi hâlde başlık sahtelenebileceği için yok sayılır.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = process.env.SITUAPP_DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), 'data')
const FILE = path.join(DIR, 'bans.json')
const LOG = path.join(DIR, 'guard.log')

let db = { keys: {}, ips: {} }
try {
  db = { keys: {}, ips: {}, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }
} catch {
  /* ilk çalıştırma */
}
const persist = () => {
  try {
    fs.mkdirSync(DIR, { recursive: true })
    fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(db))
    fs.renameSync(`${FILE}.tmp`, FILE)
  } catch (e) {
    console.error('Ban kaydı yazılamadı:', e.message)
  }
}
const log = (line) => {
  try {
    fs.mkdirSync(DIR, { recursive: true })
    fs.appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`)
  } catch {
    /* yok say */
  }
}

export const ipOf = (req) => {
  if (process.env.TRUST_PROXY === '1') {
    const f = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim()
    if (f) return f
  }
  return String(req.socket.remoteAddress ?? '').replace(/^::ffff:/, '')
}

export const isBanned = (key, ip) => Boolean((key && db.keys[key]) || (ip && db.ips[ip]))
export const banInfo = (key, ip) => db.keys[key] ?? db.ips[ip] ?? null
export function ban({ key, ip, reason, name }) {
  const rec = { at: Date.now(), reason: String(reason ?? 'hile şüphesi').slice(0, 120), name: name ?? null }
  if (key) db.keys[key] = { ...rec, ip: ip ?? null }
  if (ip && ip !== '127.0.0.1' && ip !== '::1') db.ips[ip] = { ...rec, key: key ?? null } // yerel geliştirme IP'si asla banlanmaz
  persist()
  log(`BAN key=${key} ip=${ip} name=${name} reason=${rec.reason}`)
}
export function unban({ key, ip }) {
  if (key) delete db.keys[key]
  if (ip) delete db.ips[ip]
  persist()
  log(`UNBAN key=${key} ip=${ip}`)
}
export const listBans = () => ({
  keys: Object.entries(db.keys).map(([key, v]) => ({ key, ...v })),
  ips: Object.entries(db.ips).map(([ip, v]) => ({ ip, ...v })),
})

// ---- bağlantı bazlı durum ----
const MAX_CONN_PER_IP = 6
const ipConns = new Map()
export const connOpen = (ip) => {
  const n = (ipConns.get(ip) ?? 0) + 1
  ipConns.set(ip, n)
  return n <= MAX_CONN_PER_IP || ip === '127.0.0.1' || ip === '::1'
}
export const connClose = (ip) => {
  const n = (ipConns.get(ip) ?? 1) - 1
  if (n <= 0) ipConns.delete(ip)
  else ipConns.set(ip, n)
}

const BAN_AT = 20 // puan
const DECAY_MS = 15000 // her 15 sn'de 1 puan düşer
/** Bağlantı koruyucusu: score(), rate(), onBan geri çağrısı. */
export function createGuard({ ip, onBan }) {
  const g = { score: 0, last: Date.now(), win: [], moves: 0, banned: false }
  g.strike = (why, w = 1, who = {}) => {
    if (g.banned) return
    const now = Date.now()
    g.score = Math.max(0, g.score - (now - g.last) / DECAY_MS) + w
    g.last = now
    log(`strike ${who.name ?? '?'} ip=${ip} ${why} +${w} =${g.score.toFixed(1)}`)
    if (g.score >= BAN_AT) {
      g.banned = true
      ban({ key: who.key, ip, reason: why, name: who.name })
      onBan?.(why)
    }
  }
  /** Saniyedeki mesaj sayısı sınırı. false = bu mesajı yok say. */
  g.rate = (who) => {
    const now = Date.now()
    g.win.push(now)
    while (g.win.length && now - g.win[0] > 1000) g.win.shift()
    if (g.win.length > 45) {
      if (g.win.length % 15 === 0) g.strike('mesaj taşması', 2, who)
      return false
    }
    return true
  }
  return g
}

// Tuzak mesajlar: gerçek istemci bunları ASLA göndermez; yazan, protokolü kurcalıyor demektir.
export const HONEYPOT = new Set(['admin', 'give_coins', 'set_coins', 'add_coins', 'coins_set', 'debug', 'cheat', 'teleport', 'set_pos', 'god', 'give_item', 'set_xp', 'rent_car_force', 'ban', 'unban', 'eval'])
