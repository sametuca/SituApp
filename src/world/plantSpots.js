// Süs bitkisi yerleri (saf JS, deterministik): çalı ve çim öbekleri yalnızca ÇİMLİ boş alanlara serpiştirilir —
// yol/kaldırım/meydan/kum/binalar/süs nesneleri/çardak/battaniyeler hariç (layout.js ile aynı geometriye bakar).
import { BLANKETS, BUILDINGS, GAZEBO, PROPS, ROAD_HALF } from './layout.js'

const ISLAND = 50
let seed = 20240607
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)

const RH = ROAD_HALF + 1.6 // yol + kaldırım payı

function grassFree(x, z, pad) {
  if (Math.abs(x) > ISLAND - 0.8 || Math.abs(z) > ISLAND - 0.8) return false
  if (Math.hypot(x, z) < 13) return false // lobi meydanı
  if (Math.abs(x) < RH + pad) return false // kuzey-güney yol
  if (x > -12 && Math.abs(z) < RH + pad) return false // doğu-batı yol (batısı park)
  if (x <= -12 && x >= -27 && Math.abs(z) < 2.4 + pad) return false // park patikası
  if (x > -14.5 && x < 14.5 && z < -11) return false // kafe sokağı kaldırım taşı zemini
  if (x > 11.5 && x < 48.5 && Math.abs(z) < 14.5) return false // kulüp bölgesi zemini
  if (x > -14.5 && x < 14.5 && z > 29) return false // plaj kumu
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

function scatter(count, minDist, pad, tries = 6000) {
  const out = []
  for (let i = 0; i < tries && out.length < count; i++) {
    const x = (rnd() * 2 - 1) * (ISLAND - 1)
    const z = (rnd() * 2 - 1) * (ISLAND - 1)
    if (!grassFree(x, z, pad)) continue
    if (out.some((o) => (o.x - x) ** 2 + (o.z - z) ** 2 < minDist * minDist)) continue
    out.push({ x, z, ry: rnd() * Math.PI * 2, s: 0.85 + rnd() * 0.4 })
  }
  return out
}

/** Çalılar seyrek (≥ 4 m arayla), çim öbekleri biraz daha sık; ikisi de pastel ve düşük yoğunlukta. */
export const BUSHES = scatter(34, 4.2, 0.6)
export const TUFTS = scatter(190, 1.9, 0.2)
