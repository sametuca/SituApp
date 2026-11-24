// Ev düzeni: mobilya listesi, ayak izi (footprint), çakışma ve kayıt.
// Öğe: { uid, id, x, z, ry }  (ry: Y ekseni dönüşü, 90°'nin katları; konumlar oda merkezine göre metre)
import dims from './furnitureDims.json'
import { FURNITURE_BY_ID } from './furniture'
import { GIFT_BY_ID } from './cosmeticsData'
import { HOME_ROOM } from './layout'

export const MAX_ITEMS = 40 // en büyük kademe; asıl sınır homeTiers.js max
export const GRID = 0.25
const SHRINK = 0.92 // yürünebilir ayak izi, modelin kutusundan biraz küçük (yuvarlak köşeler)
const WALL_GAP = 0.1
// Kapının önü her zaman boş kalır (içeri girince mobilyaya sıkışma olmasın)
const doorKeep = () => ({ x: 0, z: HOME_ROOM.hd - 0.9, hw: 1.5, hd: 1.0 })

/** Mobilyanın dönmemiş ayak izi (genişlik x derinlik, metre). */
export function footprint(id) {
  if (GIFT_BY_ID[id]) return { w: GIFT_BY_ID[id].fw, d: GIFT_BY_ID[id].fd } // hediyeler (cosmeticsData)
  const d = dims[id]
  const size = FURNITURE_BY_ID[id]?.size ?? 1
  if (!d) return { w: 1, d: 1 }
  return { w: Math.max(0.4, d[0] * size * SHRINK), d: Math.max(0.4, d[2] * size * SHRINK) }
}

const boxOf = (it) => {
  const f = footprint(it.id)
  return { x: it.x, z: it.z, hw: f.w / 2, hd: f.d / 2, ry: it.ry ?? 0 }
}
const R = (hw, hd, ry) => ({ hw, hd, ry })

/** Eksen hizalı olmayan iki dikdörtgenin çakışması (SAT). */
function overlap(a, b) {
  const axes = []
  for (const bx of [a, b]) {
    const c = Math.cos(bx.ry)
    const s = Math.sin(bx.ry)
    axes.push([c, -s], [s, c]) // yerel x ve z ekseninin dünyadaki yönü
  }
  const radius = (bx, ax) => {
    const c = Math.cos(bx.ry)
    const s = Math.sin(bx.ry)
    return bx.hw * Math.abs(ax[0] * c + ax[1] * -s) + bx.hd * Math.abs(ax[0] * s + ax[1] * c)
  }
  for (const ax of axes) {
    const dist = Math.abs((b.x - a.x) * ax[0] + (b.z - a.z) * ax[1])
    if (dist >= radius(a, ax) + radius(b, ax)) return false
  }
  return true
}

/** Öğe yerinde geçerli mi? (oda sınırı içinde, kapı önünü ve diğer mobilyaları kapatmıyor) */
export function isValid(items, uid) {
  const it = items.find((i) => i.uid === uid)
  if (!it) return false
  const b = boxOf(it)
  // oda sınırı: dönmüş kutunun köşeleri
  const c = Math.abs(Math.cos(b.ry))
  const s = Math.abs(Math.sin(b.ry))
  const ex = b.hw * c + b.hd * s
  const ez = b.hw * s + b.hd * c
  if (b.x - ex < -HOME_ROOM.hw + WALL_GAP || b.x + ex > HOME_ROOM.hw - WALL_GAP) return false
  if (b.z - ez < -HOME_ROOM.hd + WALL_GAP || b.z + ez > HOME_ROOM.hd - WALL_GAP) return false
  const dk = doorKeep()
  if (overlap(b, { ...R(dk.hw, dk.hd, 0), x: dk.x, z: dk.z })) return false
  return !items.some((o) => o.uid !== uid && overlap(b, boxOf(o)))
}

export const snap = (v) => Math.round(v / GRID) * GRID
export const clampToRoom = (x, z) => [Math.max(-HOME_ROOM.hw, Math.min(HOME_ROOM.hw, x)), Math.max(-HOME_ROOM.hd, Math.min(HOME_ROOM.hd, z))]

let counter = 0
export const newUid = () => `f${Date.now().toString(36)}${(counter++).toString(36)}`

/** Odada boş bir yer bulur (merkezden dışa doğru ara). Bulamazsa null. */
export function findFreeSpot(items, id) {
  const uid = '__probe__'
  for (let r = 0; r <= 4.5; r += 0.5) {
    for (let a = 0; a < Math.max(1, Math.round(r * 8)); a++) {
      const ang = (a / Math.max(1, Math.round(r * 8))) * Math.PI * 2
      const x = snap(Math.cos(ang) * r)
      const z = snap(Math.sin(ang) * r - 0.5)
      if (isValid([...items, { uid, id, x, z, ry: 0 }], uid)) return { x, z }
    }
  }
  return null
}

/** Oyuncunun çarpışması için döndürülmüş kutular. */
export const furnitureColliders = (items) => items.map(boxOf)

// ---------- kayıt (şimdilik tarayıcıda; sunucu kaydı davet adımında gelir) ----------
const key = (owner) => `situapp_home_v1_${owner}`

export function loadHome(owner) {
  try {
    const raw = JSON.parse(localStorage.getItem(key(owner)))
    if (!Array.isArray(raw)) return []
    return raw
      .filter((i) => (FURNITURE_BY_ID[i?.id] || GIFT_BY_ID[i?.id]) && Number.isFinite(i.x) && Number.isFinite(i.z))
      .slice(0, MAX_ITEMS)
      .map((i) => ({ uid: String(i.uid ?? newUid()), id: i.id, x: i.x, z: i.z, ry: Number.isFinite(i.ry) ? i.ry : 0, ...(GIFT_BY_ID[i.id] && i.from ? { from: String(i.from).slice(0, 16) } : {}) }))
  } catch {
    return []
  }
}

export function saveHome(owner, items) {
  try {
    localStorage.setItem(key(owner), JSON.stringify(items))
  } catch {
    /* depolama dolu/kapalı: sessizce geç */
  }
}
