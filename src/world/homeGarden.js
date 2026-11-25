// Ev bahçesi veri modeli, arazi kademeleri, büyüme hesapları ve yerel kalıcılık.
import { HOME_ROOM } from './layout.js'

export const CROPS = [
  { id: 'carrot', name: 'Havuç', emoji: '🥕', ms: 30000, coins: 10, stars: 1, color: '#ff9248' },
  { id: 'tulip', name: 'Lale', emoji: '🌷', ms: 35000, coins: 12, stars: 1, color: '#ff7eb6' },
  { id: 'strawberry', name: 'Çilek', emoji: '🍓', ms: 40000, coins: 15, stars: 2, color: '#ff5d7d' },
  { id: 'lavender', name: 'Lavanta', emoji: '🪻', ms: 45000, coins: 16, stars: 2, color: '#a88bff' },
  { id: 'sunflower', name: 'Ayçiçeği', emoji: '🌻', ms: 50000, coins: 18, stars: 2, color: '#ffd34d' },
  { id: 'tomato', name: 'Domates', emoji: '🍅', ms: 55000, coins: 20, stars: 3, color: '#ff6b57' },
]
export const CROP_BY_ID = Object.fromEntries(CROPS.map((c) => [c.id, c]))

export const LAND_TIERS = [
  { id: 'small', name: 'Küçük Bahçe', emoji: '🌱', cols: 2, width: 6.9, price: 0, desc: '6 tarhlık şirin başlangıç bahçesi.' },
  { id: 'medium', name: 'Geniş Bahçe', emoji: '🌿', cols: 3, width: 9.4, price: 150, desc: '9 tarhlık ferah bahçe.' },
  { id: 'farm', name: 'Çiftlik Bahçesi', emoji: '🌻', cols: 4, width: 11.9, price: 350, desc: '12 tarhlık büyük pastel bahçe!' },
]
export const MAX_LAND_TIER = LAND_TIERS.length - 1
export const clampLandTier = (t) => (Number.isInteger(t) ? Math.max(0, Math.min(MAX_LAND_TIER, t)) : 0)

export const GARDEN_PLOT_COUNT = 12

export function applyLandTier(tier) {
  const lt = LAND_TIERS[clampLandTier(tier)]
  HOME_ROOM.gardenW = lt.width
  return lt
}

/** Verilen arazi kademesine göre aktif tarh koordinatları (cols × 3 sıra). */
export function gardenPlots(landTier = 0) {
  const cols = LAND_TIERS[clampLandTier(landTier)].cols
  const zs = [-2.2, 0, 2.2]
  const out = []
  for (let c = 0; c < cols; c++) {
    const x = HOME_ROOM.hw + 2.55 + c * 2.4
    for (const z of zs) out.push({ x, z })
  }
  return out
}

export function cropProgress(slot, now = Date.now()) {
  if (!slot) return { progress: 0, ready: false, watered: false, leftMs: 0 }
  const c = CROP_BY_ID[slot.crop]
  if (!c) return { progress: 0, ready: false, watered: false, leftMs: 0 }
  const dur = slot.wateredAt ? c.ms * 0.5 : c.ms
  const elapsed = Math.max(0, now - slot.plantedAt)
  const progress = Math.min(1, elapsed / dur)
  return {
    progress,
    ready: progress >= 1,
    watered: Boolean(slot.wateredAt),
    leftMs: Math.max(0, dur - elapsed),
  }
}

export function loadGarden(ownerKey) {
  try {
    const raw = localStorage.getItem(`situapp_garden:${ownerKey || 'local'}`)
    if (!raw) return Array(GARDEN_PLOT_COUNT).fill(null)
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return Array(GARDEN_PLOT_COUNT).fill(null)
    return Array.from({ length: GARDEN_PLOT_COUNT }, (_, i) => arr[i] ?? null)
  } catch {
    return Array(GARDEN_PLOT_COUNT).fill(null)
  }
}

export function saveGarden(ownerKey, plots) {
  try {
    localStorage.setItem(`situapp_garden:${ownerKey || 'local'}`, JSON.stringify(plots))
  } catch {
    /* ignore */
  }
}

export function loadLandTier(ownerKey) {
  try {
    return clampLandTier(Number(localStorage.getItem(`situapp_land:${ownerKey || 'local'}`)))
  } catch {
    return 0
  }
}

export function saveLandTier(ownerKey, tier) {
  try {
    localStorage.setItem(`situapp_land:${ownerKey || 'local'}`, String(clampLandTier(tier)))
  } catch {
    /* ignore */
  }
}
