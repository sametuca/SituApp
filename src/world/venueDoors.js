// Mekânların şehirdeki kapıları. Bina (layout.js BUILDINGS) `venue` kimliğiyle bağlanır; kapı bina yerel +z yüzünde, `facing` yönündedir.
import { BUILDINGS } from './layout.js'
import { VENUES } from './venues.js'
import { doorOffset } from './facadeData.js'

const DIR = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] }

/** Şehirde girilebilir mekân kapıları: id → { id, x, z, ry, exit: [x, z, ry], radius, building } */
export const VENUE_DOORS = Object.fromEntries(
  BUILDINGS.filter((b) => b.venue).map((b) => {
    const [fx, fz] = DIR[b.facing]
    const half = b.d / 2
    const ry = Math.atan2(fx, fz) // kapının dışa baktığı yön (avatarın dönüşü)
    // kapı cephe üzerinde kayık olabilir (facadeData.js): bina yerel x ekseni dünyada (cos θ, -sin θ), θ = cephe dönüşü
    const th = Math.atan2(fx, fz)
    const off = doorOffset(b)
    const tx = Math.cos(th) * off
    const tz = -Math.sin(th) * off
    const x = b.x + fx * (half + 1) + tx // kapının önündeki "Gir" noktası
    const z = b.z + fz * (half + 1) + tz
    return [b.venue, { id: b.venue, x, z, ry, radius: 2.3, exit: [b.x + fx * (half + 1.7) + tx, b.z + fz * (half + 1.7) + tz, ry], building: b }]
  }),
)

/** Mekânın şehirdeki kapı önü (dışarı çıkınca doğduğun nokta `exit`). */
export const venueDoor = (id) => VENUE_DOORS[id] ?? null

export const ENTERABLE = VENUES.filter((v) => VENUE_DOORS[v.id])
