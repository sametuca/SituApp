// Ev deposu: her evin mobilya listesi ve "herkese açık" ayarı, server/data/homes.json dosyasında tutulur.
// Basit dosya tabanlı depolama; ileride Supabase'e geçilirse yalnızca bu dosya değişir
// (getHome / saveItems / setOpen / homeExists arayüzü aynı kalsın).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FURNITURE_BY_ID } from '../src/world/furniture.js'
import { HOME_ROOM } from '../src/world/layout.js'
import { GIFT_BY_ID, sanitizeDecor } from '../src/world/cosmeticsData.js'

const DIR = process.env.SITUAPP_DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), 'data')
const FILE = path.join(DIR, 'homes.json')
export const MAX_ITEMS = 40

let homes = {}
try {
  homes = JSON.parse(fs.readFileSync(FILE, 'utf8'))
} catch {
  /* ilk çalıştırma ya da bozuk dosya: boş başla */
}

let timer = null
function persist() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    try {
      fs.mkdirSync(DIR, { recursive: true })
      const tmp = `${FILE}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(homes))
      fs.renameSync(tmp, FILE) // yarım yazılmış dosya kalmasın
    } catch (e) {
      console.error('Ev kaydı yazılamadı:', e.message)
    }
  }, 500)
}

const num = (v, lim) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(-lim, Math.min(lim, n)) : 0
}

/** İstemciden gelen listeyi temizler: bilinmeyen eşya atılır, konumlar oda içinde tutulur, dönüş 90°'nin katı olur. */
// Hediye eşyaları (gift-*) ayrı katalogdan doğrulanır ve yalnızca sahibinin envanterindeyse kabul edilir.
// Çözümleyici features/cosmetics.js tarafından kaydedilir: (evAnahtarı, uid, id) → { from } | null
let giftResolver = null
export const setGiftResolver = (fn) => {
  giftResolver = fn
}

export function sanitizeItems(list, key) {
  if (!Array.isArray(list)) return []
  const seen = new Set()
  const out = []
  for (const i of list.slice(0, MAX_ITEMS)) {
    if (!i || !(FURNITURE_BY_ID[i.id] || GIFT_BY_ID[i.id])) continue
    const uid = String(i.uid ?? '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16) || `f${out.length}${Date.now().toString(36)}`
    if (seen.has(uid)) continue
    seen.add(uid)
    const gift = GIFT_BY_ID[i.id] ? giftResolver?.(key, uid, i.id) : null
    if (GIFT_BY_ID[i.id] && !gift) continue
    const quarter = Math.round(num(i.ry, 20) / (Math.PI / 2))
    out.push({
      uid,
      id: i.id,
      x: +num(i.x, HOME_ROOM.hw).toFixed(2),
      z: +num(i.z, HOME_ROOM.hd).toFixed(2),
      ry: ((quarter % 4) + 4) % 4 * (Math.PI / 2),
      ...(gift ? { from: gift.from } : {}),
    })
  }
  return out
}

export const homeExists = (key) => Boolean(homes[key])
export const getHome = (key) => homes[key] ?? null

export function saveItems(key, ownerName, items) {
  homes[key] = { ...homes[key], owner: ownerName, items: sanitizeItems(items, key), open: homes[key]?.open ?? false }
  persist()
  return homes[key].items
}

export function setOpen(key, ownerName, open) {
  homes[key] = { items: [], ...homes[key], owner: ownerName, open: Boolean(open) }
  persist()
}

// ---- ev dekoru (duvar rengi/deseni, zemin, romantik ışık); features/cosmetics.js kullanır ----
export const getDecor = (key) => homes[key]?.decor ?? null

export function setDecor(key, ownerName, decor) {
  homes[key] = { items: [], open: false, ...homes[key], owner: ownerName, decor: sanitizeDecor(decor) }
  persist()
  return homes[key].decor
}
