// Gökyüzü modülleri arası paylaşılan durum: skyLive (canlı ışık/saat), SKY_MATS (pencere/neon malzemeleri), saat→renk anahtar kareleri, güneş/ay yönü.
import { CanvasTexture, Color, MeshStandardMaterial, SRGBColorSpace, Vector3 } from 'three'
import { smooth } from './worldClock'
export const skyLive = {
  dir: new Vector3(0.5, 0.8, 0.35), // ışık (güneş/ay) yönü
  color: new Color('#ffffff'),
  intensity: 1.6,
  window: new Color('#cfeaff'), // ev penceresinden görünen gökyüzü
  lit: 0, // 0..1 yapay ışıkların yanma düzeyi (lamba, pencere, neon)
  wet: 0, // 0..1 yağmurdan ıslaklık
  night: 0,
  over: 0,
  hour: 12,
}

/** Şehir binalarının/çeşmenin paylaşılan malzemeleri (City.jsx kullanır; Sky gece parlatır). */
export const SKY_MATS = {
  window: new MeshStandardMaterial({ color: '#fff4c4', emissive: '#ffc966', emissiveIntensity: 0.4, roughness: 0.08, metalness: 0.35, envMapIntensity: 1.6 }),
  neonPink: new MeshStandardMaterial({ color: '#fdb15e', emissive: '#fd9c33', emissiveIntensity: 1.4 }),
  neonBlue: new MeshStandardMaterial({ color: '#8fd8ff', emissive: '#4fc3ff', emissiveIntensity: 1.4 }),
  water: new MeshStandardMaterial({ color: '#9fdcff', roughness: 0.06, metalness: 0.25, envMapIntensity: 1.5, emissive: '#6cc7f5', emissiveIntensity: 0.25 }),
  fountainTop: new MeshStandardMaterial({ color: '#a9ddf5', roughness: 0.14, metalness: 0.2, envMapIntensity: 1.4, emissive: '#6cc7f5', emissiveIntensity: 0.3 }),
}

// ---------------------------------------------------------------- anahtar kareler (saat → renkler)
export const C = (s) => new Color(s)
export const KEYS = {
  night: { bg: C('#1f2659'), fog: C('#2c356e'), sun: C('#ffe6b8'), sunI: 0.68, amb: C('#9aaaf5'), ambI: 0.44, hs: C('#8ea3ff'), hg: C('#7a5d7e'), hI: 0.58, fn: 64, ff: 185 },
  dawn: { bg: C('#ffd9b0'), fog: C('#ffe6c8'), sun: C('#ffba85'), sunI: 1.08, amb: C('#ffeedb'), ambI: 0.38, hs: C('#ffe4c4'), hg: C('#f5d4b0'), hI: 0.68, fn: 72, ff: 195 },
  day: { bg: C('#a9dcff'), fog: C('#c2e7ff'), sun: C('#ffffff'), sunI: 1.65, amb: C('#ffffff'), ambI: 0.48, hs: C('#f2f9ff'), hg: C('#ffe9d6'), hI: 0.85, fn: 78, ff: 210 },
  dusk: { bg: C('#ffb08a'), fog: C('#ffcaa2'), sun: C('#ff945e'), sunI: 1.18, amb: C('#ffd0ba'), ambI: 0.42, hs: C('#ffc4a8'), hg: C('#cfa0e6'), hI: 0.66, fn: 70, ff: 190 },
  dusk2: { bg: C('#5f4396'), fog: C('#785aa8'), sun: C('#ffd4a3'), sunI: 0.84, amb: C('#bfa8f2'), ambI: 0.44, hs: C('#b096eb'), hg: C('#8a629c'), hI: 0.58, fn: 66, ff: 185 },
}
export const FRAMES = [
  [0, 'night'],
  [4.6, 'night'],
  [6.3, 'dawn'],
  [8.2, 'day'],
  [16.8, 'day'],
  [18.6, 'dusk'],
  [20, 'dusk2'],
  [21.6, 'night'],
  [24, 'night'],
]
export const COLOR_KEYS = ['bg', 'fog', 'sun', 'amb', 'hs', 'hg']
export const NUM_KEYS = ['sunI', 'ambI', 'hI', 'fn', 'ff']
export const cur = Object.fromEntries([...COLOR_KEYS.map((k) => [k, new Color()]), ...NUM_KEYS.map((k) => [k, 0])])

export function frameAt(h) {
  let i = 0
  while (i < FRAMES.length - 2 && h >= FRAMES[i + 1][0]) i++
  const [h0, k0] = FRAMES[i]
  const [h1, k1] = FRAMES[i + 1]
  const t = smooth(0, 1, (h - h0) / (h1 - h0))
  const a = KEYS[k0]
  const b = KEYS[k1]
  for (const k of COLOR_KEYS) cur[k].copy(a[k]).lerp(b[k], t)
  for (const k of NUM_KEYS) cur[k] = a[k] + (b[k] - a[k]) * t
  return cur
}

export const GRAY = C('#b9c4d8')
export const tmp = new Color()
export const SUN_DIR = new Vector3()
export const MOON_DIR = new Vector3(0.45, 0.8, 0.4).normalize()
export function sunDirAt(h, out) {
  const p = Math.min(1, Math.max(0, (h - 6) / 13))
  const el = 0.35 + 0.95 * Math.sin(p * Math.PI)
  const a = -1.2 + 2.4 * p
  return out.set(Math.cos(el) * Math.sin(a), Math.sin(el), Math.cos(el) * Math.cos(a))
}

// ---------------------------------------------------------------- küçük dokular
export function glowTexture(stops) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  for (const [o, col] of stops) grad.addColorStop(o, col)
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}
export const SOFT = [
  [0, 'rgba(255,255,255,1)'],
  [0.35, 'rgba(255,255,255,0.55)'],
  [1, 'rgba(255,255,255,0)'],
]

// ---------------------------------------------------------------- gökcisimleri
export function mulberry(a) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

