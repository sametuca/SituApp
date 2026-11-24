// Süs bitkisi yerleri (saf JS, deterministik): çalı ve çim öbekleri yalnızca ÇİMLİ boş alanlara serpiştirilir —
// yol/kaldırım/meydan/kum/binalar/süs nesneleri/çardak/battaniyeler hariç (layout.js ile aynı geometriye bakar).
import { BEACH, BLANKETS, BUILDINGS, GAZEBO, ISLAND, PROPS, ROAD_HALF } from './layout.js'

let seed = 20240607
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)

const RH = ROAD_HALF + 1.6 // yol + kaldırım payı (dar şerit: bitki kaldırıma taşmasın)

function grassFree(x, z, pad) {
  if (x < ISLAND.x0 + 1 || x > ISLAND.x1 - 1 || z < ISLAND.z0 + 1 || z > ISLAND.z1 - 1) return false
  if (Math.hypot(x, z) < 18 + pad) return false // lobi meydanı + dönel kavşak
  if (Math.abs(x) < RH + pad && z < 49) return false // kuzey-güney yol
  if (x > -12 && Math.abs(z) < RH + pad) return false // doğu-batı yol (batısı park)
  if (Math.hypot(x + 30, z - 30) < 9 + pad) return false // gölet
  if (x <= -12 && x >= -27 && Math.abs(z) < 2.4 + pad) return false // park patikası
  if (x > -14.5 && x < 14.5 && z < -11) return false // kafe sokağı kaldırım taşı zemini
  if (x > 11.5 && x < 48.5 && Math.abs(z) < 14.5) return false // kulüp bölgesi zemini
  if (Math.hypot(x - BEACH.x, z - BEACH.z) < BEACH.r + 5) return false // yuvarlak plaj
  if (Math.hypot(x - GAZEBO.x, z - GAZEBO.z) < GAZEBO.r + 2 + pad) return false
  if (Math.hypot(x + 33, z + 6) < 4.6) return false // park gölcüğü
  for (const b of BUILDINGS) {
    if (b.gazebo) continue
    const side = b.facing === 'e' || b.facing === 'w'
    const hw = (side ? b.d : b.w) / 2 + 1.6 + pad
    const hd = (side ? b.w : b.d) / 2 + 1.6 + pad
    if (Math.abs(x - b.x) < hw && Math.abs(z - b.z) < hd) return false
  }
  for (const p of PROPS) if (Math.hypot(x - p.x, z - p.z) < Math.max(1.2, p.r + 0.9) + pad) return false
  for (const b of BLANKETS) if (Math.hypot(x - b.x, z - b.z) < 2.4 + pad) return false
  return true
}

function scatter(count, minDist, pad, tries = 20000) {
  const out = []
  for (let i = 0; i < tries && out.length < count; i++) {
    const x = ISLAND.x0 + rnd() * (ISLAND.x1 - ISLAND.x0)
    const z = ISLAND.z0 + rnd() * (ISLAND.z1 - ISLAND.z0)
    if (!grassFree(x, z, pad)) continue
    if (out.some((o) => (o.x - x) ** 2 + (o.z - z) ** 2 < minDist * minDist)) continue
    out.push({ x, z, ry: rnd() * Math.PI * 2, s: 0.85 + rnd() * 0.4 })
  }
  return out
}

/** Çalılar seyrek (≥ 4 m arayla), çim öbekleri biraz daha sık; ikisi de pastel ve düşük yoğunlukta. */
export const BUSHES = scatter(90, 5.5, 0.6)
export const TUFTS = scatter(300, 3.2, 0.2)
