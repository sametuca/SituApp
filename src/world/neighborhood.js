// Konut Mahallesi verisi (saf JS: sunucu da okur). Birim metre, orijin = lobi merkezi.
// İki blok: kuzeybatı (z -47..-15) ve güneybatı (z 15..47); ortadan x = -31'de bir sokak geçer, parkla birleşir.
// Her parsel 10 (sokak boyunca) × 14 (derinlik) m; yerel eksen: +z = sokağa bakan ön, x = sokak boyunca.

export const STREET_X = -31
export const STREET_HALF = 2
export const PLOT_W = 10
export const PLOT_D = 14
export const WELCOME_MAX = 40

// parsel yerel çizimi (hem istemci hem çarpışma kullanır)
export const LOCAL = {
  houseFront: 0.6, // evin ön yüzü (yerel z)
  houseHalf: 3.2, // ev yarı genişliği (x)
  houseBack: -6.4,
  fenceFront: 6.5, // ön çit çizgisi
  fenceBack: -6.9,
  fenceSide: 4.9,
  gate: 1.35, // kapı boşluğunun yarısı
  doorSpot: { x: 0, z: 2.8 }, // "Gir" noktası (kapının önü)
  doorRadius: 2.5,
}

const FACE = { e: Math.PI / 2, w: -Math.PI / 2 }

function makePlot(n, cx, cz, facing) {
  const ry = FACE[facing]
  const c = Math.cos(ry)
  const s = Math.sin(ry)
  const toWorld = (lx, lz) => [cx + lx * c + lz * s, cz - lx * s + lz * c]
  const [dx, dz] = toWorld(LOCAL.doorSpot.x, LOCAL.doorSpot.z)
  const [ex, ez] = toWorld(0, LOCAL.doorSpot.z + 0.2)
  return { n, id: `p${n}`, x: cx, z: cz, facing, ry, toWorld, door: { x: dx, z: dz, radius: LOCAL.doorRadius, exit: [ex, ez, ry] } }
}

// lobiye yakından uzağa numaralanır: ilk gelen en yakın parseli alır
const RAW = []
for (const z of [-21, -31, -41, 21, 31, 41]) {
  RAW.push([-40, z, 'e'], [-22, z, 'w'])
}
RAW.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]) || a[1] - b[1] || a[0] - b[0])
export const PLOTS = RAW.map(([x, z, f], i) => makePlot(i + 1, x, z, f))
export const PLOT_BY_ID = Object.fromEntries(PLOTS.map((p) => [p.id, p]))

/** Mahalle bölgeleri (ZONES için): sokakla birlikte iki blok. */
export const RESIDENTIAL_RECTS = [
  { x0: -48, x1: -14.01, z0: -48, z1: -14 },
  { x0: -48, x1: -14.01, z0: 14.01, z1: 48 },
]

// ---------- katalog ----------
export const HOUSES = [
  { id: 'cottage', name: 'Pastel kulübe', emoji: '🏡' },
  { id: 'tower', name: 'Kuleli ev', emoji: '🏰' },
  { id: 'bungalow', name: 'Tek katlı ev', emoji: '🏠' },
  { id: 'heart', name: 'Kalpli ev', emoji: '💗' },
]
export const FENCES = [
  { id: 'picket', name: 'Beyaz çit', emoji: '🪵' },
  { id: 'hedge', name: 'Çalı çit', emoji: '🌿' },
  { id: 'rope', name: 'Halat çit', emoji: '🪢' },
]
export const GARDEN_ITEMS = [
  { id: 'flowers', name: 'Çiçek tarhı', emoji: '🌷' },
  { id: 'lantern', name: 'Fener', emoji: '🏮' },
  { id: 'mailbox', name: 'Posta kutusu', emoji: '📮' },
  { id: 'bench', name: 'Bank', emoji: '🪑' },
  { id: 'tree', name: 'Ağaç', emoji: '🌳' },
]
export const DOOR_COLORS = [
  { id: 'pink', name: 'Pembe', hex: '#8ce4e4' },
  { id: 'blue', name: 'Mavi', hex: '#7fcdf3' },
  { id: 'mint', name: 'Nane', hex: '#8fdcb4' },
  { id: 'yellow', name: 'Sarı', hex: '#ffd35e' },
  { id: 'lilac', name: 'Lila', hex: '#b79cff' },
  { id: 'peach', name: 'Şeftali', hex: '#ffb48c' },
]
export const DOOR_HEX = Object.fromEntries(DOOR_COLORS.map((d) => [d.id, d.hex]))
export const houseUrl = (id) => `/models/neighborhood/house-${id}.glb`

export const DEFAULT_EXTERIOR = {
  house: 'cottage',
  fence: 'picket',
  garden: { flowers: true, lantern: true, mailbox: true, bench: false, tree: true },
  welcome: '',
  door: 'pink',
}

const has = (list, id) => list.some((x) => x.id === id)

/** İstemciden gelen dış görünümü temizler. `text(s)` metni süzer (sunucuda clean + censor); verilmezse yalnızca kırpar. */
export function sanitizeExterior(raw, text = (s) => String(s ?? '').slice(0, WELCOME_MAX)) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const g = r.garden && typeof r.garden === 'object' ? r.garden : {}
  const d = DEFAULT_EXTERIOR
  return {
    house: has(HOUSES, r.house) ? r.house : d.house,
    fence: has(FENCES, r.fence) ? r.fence : d.fence,
    garden: Object.fromEntries(GARDEN_ITEMS.map((it) => [it.id, it.id in g ? Boolean(g[it.id]) : d.garden[it.id]])),
    welcome: typeof r.welcome === 'string' ? String(text(r.welcome) ?? '').slice(0, WELCOME_MAX) : d.welcome,
    door: has(DOOR_COLORS, r.door) ? r.door : d.door,
  }
}

// ---------- çarpışma ----------
/** Parsel yerel dikdörtgenini (lx0..lx1, lz0..lz1) dünya eksen hizalı kutusuna çevirir. */
function box(p, lx0, lx1, lz0, lz1) {
  const pts = [p.toWorld(lx0, lz0), p.toWorld(lx1, lz1)]
  const x0 = Math.min(pts[0][0], pts[1][0])
  const x1 = Math.max(pts[0][0], pts[1][0])
  const z0 = Math.min(pts[0][1], pts[1][1])
  const z1 = Math.max(pts[0][1], pts[1][1])
  return { type: 'box', plot: p.id, x: (x0 + x1) / 2, z: (z0 + z1) / 2, hw: (x1 - x0) / 2, hd: (z1 - z0) / 2 }
}
const T = 0.12
/** Yalnızca sahipli parsellerde geçerli (occupiedPlots); boş arsa serbest yürünür. */
export const PLOT_COLLIDERS = PLOTS.flatMap((p) => [
  box(p, -LOCAL.houseHalf, LOCAL.houseHalf, LOCAL.houseBack, LOCAL.houseFront),
  box(p, -LOCAL.fenceSide, -LOCAL.gate, LOCAL.fenceFront - T, LOCAL.fenceFront + T),
  box(p, LOCAL.gate, LOCAL.fenceSide, LOCAL.fenceFront - T, LOCAL.fenceFront + T),
  box(p, -LOCAL.fenceSide - T, -LOCAL.fenceSide + T, LOCAL.fenceBack, LOCAL.fenceFront),
  box(p, LOCAL.fenceSide - T, LOCAL.fenceSide + T, LOCAL.fenceBack, LOCAL.fenceFront),
  box(p, -LOCAL.fenceSide, LOCAL.fenceSide, LOCAL.fenceBack - T, LOCAL.fenceBack + T),
])
// sahipli parsel kimlikleri (istemci deposu günceller; layout.js resolveCollisions okur)
export const occupiedPlots = new Set()
