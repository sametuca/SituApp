// Mekânların şehirdeki kapıları. Bina (layout.js BUILDINGS) `venue` kimliğiyle bağlanır; kapı bina yerel +z yüzünde, `facing` yönündedir.
import { BUILDINGS } from './layout.js'
import { VENUES } from './venues.js'

const DIR = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] }

/** Şehirde girilebilir mekân kapıları: id → { id, x, z, ry, exit: [x, z, ry], radius, building } */
export const VENUE_DOORS = Object.fromEntries(
  BUILDINGS.filter((b) => b.venue).map((b) => {
    const [fx, fz] = DIR[b.facing]
    const half = b.d / 2
    const ry = Math.atan2(fx, fz) // kapının dışa baktığı yön (avatarın dönüşü)
    const x = b.x + fx * (half + 1) // kapının önündeki "Gir" noktası
    const z = b.z + fz * (half + 1)
    return [b.venue, { id: b.venue, x, z, ry, radius: 2.3, exit: [b.x + fx * (half + 1.7), b.z + fz * (half + 1.7), ry], building: b }]
  }),
)

/** Mekânın şehirdeki kapı önü (dışarı çıkınca doğduğun nokta `exit`). */
export const venueDoor = (id) => VENUE_DOORS[id] ?? null

export const ENTERABLE = VENUES.filter((v) => VENUE_DOORS[v.id])
