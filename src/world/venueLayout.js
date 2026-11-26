// Mekân iç mekânlarının VERİSİ (çizim: Venue.jsx). Saf veri: hem istemci hem sunucu okur (sunucu koltukları buradan bilir).
// Koordinatlar oda içi: orijin = oda merkezi, giriş kapısı güney duvarında (+z), kuzey (-z) arka duvar. Ölçü: VENUE_ROOM (venues.js).
// NPC alanına (npc.x ± 1.1, npc.z ± 1.1) hiçbir eşya girmez (başka ajan NPC koyuyor); tezgâh NPC'nin önünde (npc.z + 1.6).
import { VENUE_ROOM, VENUE_BY_ID } from './venues.js'
import { VENUE_DOORS } from './venueDoors.js'
import { PLAYER_RADIUS } from './layout.js'

const { hw, hd } = VENUE_ROOM

// ---------- renk yardımcıları ----------
const toRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const toHex = (r) => `#${r.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`
export const mix = (a, b, t) => {
  const A = toRgb(a)
  const B = toRgb(b)
  return toHex(A.map((v, i) => v + (B[i] - v) * t))
}

// tür şablonları: zemin (dama), karanlık oda mı, sahne arka planı
const TYPE_THEME = {
  cafe: { floor: ['#f7e4cb', '#efd3b0'] },
  tea: { floor: ['#f3dec4', '#e8c9a4'] },
  bakery: { floor: ['#fbead2', '#f4d9b4'] },
  dessert: { floor: ['#fff6ea', '#ffeed9'] },
  icecream: { floor: ['#eafaff', '#d4f1fb'] },
  fastfood: { floor: ['#fff1c9', '#ffe29a'] },
  books: { floor: ['#ead7bd', '#dfc5a3'] },
  bar: { floor: ['#6a4a70', '#59405f'], dark: '#2a1c3a', dim: 0.55 },
  club: { floor: ['#2b2146', '#241c3d'], dark: '#1c1433', dim: 0.85 },
  arcade: { floor: ['#3a2d63', '#32265a'], dark: '#241a4a', dim: 0.6 },
  salon: { floor: ['#fef3e5', '#fbe9d1'] },
  studio: { floor: ['#f1ecf8', '#e6def2'] },
  shop: { floor: ['#fdf0cf', '#f8e2a8'] },
  guide: { floor: ['#e7f1ff', '#d6e6fb'] },
  airport: { floor: ['#eef2f8', '#dfe6f1'] },
  gym: { floor: ['#e5f5ef', '#d4ece4'] },
  teknel: { floor: ['#e8f3ff', '#d6e9ff'] },
}

/** Mekânın renk teması (bina renklerinden türer). */
export function venueTheme(id) {
  const v = VENUE_BY_ID[id]
  const bd = VENUE_DOORS[id]?.building ?? { color: '#ffeed9', roof: '#fec172' }
  const t = TYPE_THEME[v?.type] ?? TYPE_THEME.cafe
  const dark = Boolean(t.dark)
  const wall = dark ? mix(bd.color, t.dark, 0.72) : mix(bd.color, '#ffffff', 0.3)
  const bg = dark ? mix(t.dark, '#000000', 0.25) : mix(bd.color, '#ffffff', 0.55)
  return {
    dark,
    dim: t.dim ?? 0,
    wall,
    wall2: dark ? mix(wall, '#000000', 0.15) : mix(wall, '#ffffff', 0.25),
    band: dark ? mix(bd.roof, t.dark, 0.5) : bd.roof, // duvar alt şeridi
    trim: dark ? mix(bd.roof, t.dark, 0.35) : mix(bd.roof, '#ffffff', 0.4),
    accent: bd.roof,
    pastel: bd.color,
    floor: t.floor,
    bg,
    counter: dark ? mix(bd.roof, t.dark, 0.45) : mix(bd.color, '#ffffff', 0.55),
    top: dark ? '#3b2a55' : '#fffaf2',
  }
}

// ---------- oda içi çarpışma ----------
/** Duvarlardan ve eşya kutularından ({ x, z, hw, hd, ry }) çıkar. HomeRoom'daki resolveRoom'un mekân sürümü. */
export function resolveVenueRoom(x, z, colliders = []) {
  const m = PLAYER_RADIUS + 0.15
  x = Math.max(-hw + m, Math.min(hw - m, x))
  z = Math.max(-hd + m, Math.min(hd - 0.35, z))
  for (const c of colliders) {
    if (!Number.isFinite(c.hw) || !Number.isFinite(c.hd)) continue // bozuk kutu oyuncunun konumunu NaN yapmasın
    const ry = c.ry ?? 0
    const cos = Math.cos(ry)
    const sin = Math.sin(ry)
    const dx = x - c.x
    const dz = z - c.z
    const lx = dx * cos - dz * sin
    const lz = dx * sin + dz * cos
    const nx = Math.max(-c.hw, Math.min(lx, c.hw))
    const nz = Math.max(-c.hd, Math.min(lz, c.hd))
    let ox = lx - nx
    let oz = lz - nz
    const d2 = ox * ox + oz * oz
    if (d2 >= PLAYER_RADIUS * PLAYER_RADIUS) continue
    let px
    let pz
    if (d2 === 0) {
      const gaps = [c.hw - lx, lx + c.hw, c.hd - lz, lz + c.hd]
      const k = gaps.indexOf(Math.min(...gaps))
      px = k === 0 ? c.hw + PLAYER_RADIUS : k === 1 ? -c.hw - PLAYER_RADIUS : lx
      pz = k === 2 ? c.hd + PLAYER_RADIUS : k === 3 ? -c.hd - PLAYER_RADIUS : lz
    } else {
      const d = Math.sqrt(d2)
      ox /= d
      oz /= d
      px = nx + ox * PLAYER_RADIUS
      pz = nz + oz * PLAYER_RADIUS
    }
    x = c.x + px * cos + pz * sin
    z = c.z - px * sin + pz * cos
  }
  return [x, z]
}

// ---------- yerleşim üreticisi ----------
const cache = new Map()
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

/**
 * Mekânın yerleşimi: { id, type, theme, items[], colliders[], seats[], stage?, photo?, karaoke?, dj? }
 * items: Venue.jsx'in çizdiği tanımlar ({ t, ... }); seats: oturma noktaları (layout.js SEATS ile aynı biçim + group/style).
 */
export function venueLayout(id) {
  if (cache.has(id)) return cache.get(id)
  const v = VENUE_BY_ID[id]
  if (!v) return null
  const L = build(v)
  cache.set(id, L)
  return L
}

/** Oturma noktaları (sunucu da kullanır). */
export const venueSeats = (id) => venueLayout(id)?.seats ?? []

function build(v) {
  const th = venueTheme(v.id)
  const npc = v.npc
  const L = { id: v.id, type: v.type, theme: th, items: [], colliders: [], seats: [], npcRect: { x0: npc.x - 1.1, x1: npc.x + 1.1, z0: npc.z - 1.1, z1: npc.z + 1.1 } }
  const add = (it, col) => {
    L.items.push(it)
    if (col) L.colliders.push(col === true ? { x: it.x, z: it.z, hw: it.w / 2, hd: it.d / 2, ry: it.ry ?? 0 } : col)
    return it
  }
  const block = (x, z, hwid, hdep, ry = 0) => L.colliders.push({ x, z, hw: hwid, hd: hdep, ry })
  let seatN = 0
  const seat = (name, kind, style, x, z, ry, slots, group) => L.seats.push({ id: `${v.id}/${name ?? `s${seatN++}`}`, kind, style, x, z, ry, slots: slots ?? [{ x, z }], ...(group ? { group: `${v.id}/${group}` } : {}) })

  // --- ortak parçalar ---
  const counterZ = npc.z + 1.6
  const counter = (x, w, extra = {}) => {
    x = clamp(x, -hw + 0.6 + w / 2, hw - 0.6 - w / 2)
    add({ t: 'counter', x, z: counterZ, w, d: 0.8, h: 1.0, c: th.counter, top: th.top, ...extra }, true)
    return x
  }
  const plant = (x, z, s = 1.4) => {
    add({ t: 'glb', m: 'plant', x, z, s }, { x, z, hw: 0.3, hd: 0.3, ry: 0 })
  }
  const corners = () => {
    plant(-hw + 0.7, -4.2)
    plant(hw - 0.7, -4.2)
    plant(-hw + 0.7, 4.1)
    plant(hw - 0.7, 4.1)
  }
  const sign = () => add({ t: 'board', x: 0, y: 3.05, z: -hd + 0.04, ry: 0, w: 3.4, h: 0.6, lines: [`${v.emoji} ${v.name}`], bg: th.accent, fg: '#ffffff', big: true })
  const windows = (zs = [-0.6, 2.4]) => zs.forEach((z) => { add({ t: 'window', wall: 'w', z }); add({ t: 'window', wall: 'e', z }) })
  const chairAt = (name, x, z, ry, kind, group, c) => {
    add({ t: 'chair', x, z, ry, c: c ?? th.accent })
    block(x, z, 0.24, 0.24, ry)
    seat(name, kind, 'chair', x, z, ry, undefined, group)
  }
  /** Yuvarlak masa + karşılıklı iki sandalye (2 kişilik masa). axis 'x': sandalyeler sol-sağda. */
  const tableSet = (n, x, z, axis = 'x') => {
    add({ t: 'glb', m: 'table', x, z, s: 1.25 }, { x, z, hw: 0.58, hd: 0.58, ry: 0 })
    if (axis === 'x') {
      chairAt(`t${n}a`, x - 0.98, z, Math.PI / 2, 'table', `t${n}`)
      chairAt(`t${n}b`, x + 0.98, z, -Math.PI / 2, 'table', `t${n}`)
    } else {
      chairAt(`t${n}a`, x, z - 0.98, 0, 'table', `t${n}`)
      chairAt(`t${n}b`, x, z + 0.98, Math.PI, 'table', `t${n}`)
    }
  }
  const sofaAt = (name, x, z, ry, w = 2.0, c) => {
    add({ t: 'sofa', x, z, ry, w, c: c ?? th.accent })
    const ax = [Math.cos(ry), -Math.sin(ry)]
    block(x, z, w / 2, 0.42, ry)
    seat(name, 'sofa', 'bench', x, z, ry, [-0.4, 0.4].map((o) => ({ x: +(x + ax[0] * o).toFixed(2), z: +(z + ax[1] * o).toFixed(2) })))
  }
  const stoolAt = (name, x, z, ry, group) => {
    add({ t: 'stool', x, z })
    block(x, z, 0.24, 0.24)
    seat(name, 'stool', 'chair', x, z, ry, undefined, group)
  }
  const shelfRow = (mode, xs, extra = {}) => xs.forEach((x) => add({ t: 'shelf', x, z: -hd + 0.26, ry: 0, w: 1.6, rows: 3, mode, c: th.dark ? th.trim : '#fffaf2', ...extra }))
  const frame = (x, y, z, ry, w, h, c) => add({ t: 'frame', x, y, z, ry, w, h, c })
  const menu = (lines, x, y = 2.1) => add({ t: 'board', x, y, z: -hd + 0.04, ry: 0, w: 1.7, h: 1.15, lines, bg: '#fffaf2', fg: '#4a3b5c', frame: th.accent })
  const nx = clamp(npc.x, -2.4, 2.4)
  const sideMenus = (a, b) => {
    menu(a, clamp(nx - 3.4, -4.6, -2.4))
    menu(b, clamp(nx + 3.4, 2.4, 4.6))
  }

  switch (v.type) {
    // ================= kafe benzeri =================
    case 'cafe': {
      sign()
      counter(nx, 4.8)
      add({ t: 'display', x: nx - 1.4, z: counterZ, y: 1.0, w: 1.5, mode: 'cakes' })
      add({ t: 'machine', x: nx + 1.3, z: counterZ, y: 1.0 })
      shelfRow('cups', [-4.2, -2.4, 2.4, 4.2])
      sideMenus(['☕ Menü', 'Sütlü kahve', 'Çilekli latte', 'Bal & badem', 'Kurabiye 🍪'], ['🥐 Yanında', 'Sıcak çikolata', 'Limonlu kek', 'Bitki çayı', 'Tiramisu 🍰'])
      ;[[-3.9, 0.7], [3.9, 0.7], [-3.9, 3.0], [3.9, 3.0]].forEach(([x, z], i) => tableSet(i, x, z))
      add({ t: 'rug', x: 0, z: 1.4, w: 2.4, d: 3.0, c: mix(th.pastel, '#ffffff', 0.35), round: false })
      windows()
      corners()
      break
    }
    case 'tea': {
      sign()
      counter(nx, 4.8)
      add({ t: 'samovar', x: nx - 1.2, z: counterZ, y: 1.0 })
      add({ t: 'display', x: nx + 1.3, z: counterZ, y: 1.0, w: 1.4, mode: 'tea' })
      shelfRow('cups', [-4.2, -2.4, 0, 2.4])
      sideMenus(['🍵 Çay Evi', 'Demli çay', 'Açık çay', 'Elma çayı', 'Simit 🥯'], ['🎲 Oyunlar', 'Tavla', 'Okey', 'Domino', 'Çay bedava*'])
      ;[[-3.9, 0.5], [3.9, 0.9], [-3.9, 2.9], [3.9, 3.0]].forEach(([x, z], i) => tableSet(i, x, z))
      add({ t: 'rug', x: -3.9, z: 1.7, w: 3.2, d: 3.4, c: mix(th.accent, '#ffffff', 0.55), round: false })
      windows()
      corners()
      break
    }
    case 'bakery': {
      sign()
      counter(nx, 5.0)
      add({ t: 'display', x: nx - 1.5, z: counterZ, y: 1.0, w: 1.7, mode: 'bread' })
      add({ t: 'display', x: nx + 1.5, z: counterZ, y: 1.0, w: 1.7, mode: 'bread' })
      shelfRow('bread', [-2.5, 2.5])
      add({ t: 'oven', x: -4.5, z: -hd + 0.6 })
      add({ t: 'oven', x: 4.5, z: -hd + 0.6 })
      sideMenus(['🥐 Fırın', 'Simit', 'Poğaça', 'Açma', 'Börek'], ['☀️ Sabah', 'Kruvasan', 'Ekmek', 'Reçelli tost', 'Süt 🥛'])
      ;[[-3.9, 1.0], [3.9, 1.0], [0, 0.7]].forEach(([x, z], i) => tableSet(i, x, z, i === 2 ? 'z' : 'x'))
      windows()
      plant(-hw + 0.7, 4.1)
      plant((hw - 0.7), 4.1)
      break
    }
    case 'dessert': {
      sign()
      counter(nx, 5.0)
      add({ t: 'display', x: nx - 1.5, z: counterZ, y: 1.0, w: 1.8, mode: 'cakes' })
      add({ t: 'display', x: nx + 1.5, z: counterZ, y: 1.0, w: 1.8, mode: 'cakes' })
      shelfRow('cakes', [-4.2, -2.4, 2.4, 4.2])
      sideMenus(['🍰 Tatlılar', 'Çilekli rüya', 'Profiterol', 'Sütlaç', 'Cheesecake'], ['💗 İkili', 'Tatlı paylaş', 'İki kaşık', 'Bir de çay', 'Şeker bol!'])
      ;[[-3.9, 0.8], [3.9, 0.8], [-3.9, 3.0], [3.9, 3.0]].forEach(([x, z], i) => tableSet(i, x, z))
      add({ t: 'rug', x: 0, z: 1.6, w: 2.6, d: 2.6, c: mix(th.accent, '#ffffff', 0.55), round: true })
      windows()
      corners()
      break
    }
    case 'icecream': {
      sign()
      add({ t: 'freezer', x: nx, z: counterZ, w: 4.6, d: 0.9 }, true)
      shelfRow('cones', [-4.2, -2.4, 2.4, 4.2])
      sideMenus(['🍦 Dondurma', 'Çilek', 'Vanilya', 'Çikolata', 'Fıstık'], ['🍨 Boyut', 'Tek top', 'Çift top', 'Üç top!', 'Külah / kase'])
      ;[[-3.9, 1.0], [3.9, 1.0], [0, 0.7]].forEach(([x, z], i) => tableSet(i, x, z, i === 2 ? 'z' : 'x'))
      windows()
      corners()
      break
    }
    case 'fastfood': {
      sign()
      counter(nx, 5.4)
      add({ t: 'register', x: nx - 1.6, z: counterZ, y: 1.0 })
      add({ t: 'register', x: nx + 1.0, z: counterZ, y: 1.0 })
      menu(['🍔 Menü', 'Burger', 'Patates 🍟', 'Nugget', 'Soda'], clamp(nx - 3.5, -4.6, -2.6), 2.2)
      menu(['⭐ Menü 2', 'Çifte burger', 'Soğan halkası', 'Milkshake', 'Tatlı'], clamp(nx + 3.5, 2.6, 4.6), 2.2)
      menu(['😉 İkili menü', 'İki kişi, bir patates!'], nx, 2.2)
      ;[[-3.9, 0.8], [3.9, 0.8], [-3.9, 3.0], [3.9, 3.0]].forEach(([x, z], i) => tableSet(i, x, z))
      windows()
      corners()
      break
    }
    case 'books': {
      sign()
      counter(npc.x, 3.2)
      add({ t: 'frame', x: -hw + 0.04, y: 2.2, z: -2.6, ry: Math.PI / 2, w: 1.0, h: 0.8, c: th.accent })
      // kuzey ve doğu duvarında kitap rafları (NPC solda)
      shelfRow('books', [-0.4, 1.2, 2.8, 4.4])
      for (const z of [-2.8, -1.0, 0.8]) add({ t: 'shelf', x: hw - 0.26, z, ry: -Math.PI / 2, w: 1.6, rows: 3, mode: 'books', c: '#fffaf2' })
      add({ t: 'shelf', x: -hw + 0.26, z: -2.4, ry: Math.PI / 2, w: 1.6, rows: 3, mode: 'books', c: '#fffaf2' })
      // okuma köşesi: iki kanepe karşı karşıya + sehpa
      add({ t: 'rug', x: 3.6, z: 2.4, w: 3.6, d: 3.4, c: mix(th.accent, '#ffffff', 0.5), round: false })
      sofaAt('sofaA', 3.6, 1.1, 0, 2.2)
      sofaAt('sofaB', 3.6, 3.7, Math.PI, 2.2)
      add({ t: 'box', x: 3.6, z: 2.4, w: 1.0, d: 0.7, h: 0.4, c: '#fffaf2' }, true)
      add({ t: 'book', x: 3.6, z: 2.4, y: 0.4 })
      ;[[-3.9, 1.0], [-3.9, 3.2]].forEach(([x, z], i) => tableSet(i, x, z))
      add({ t: 'glb', m: 'plant', x: -hw + 0.7, z: 4.1, s: 1.4 }, { x: -hw + 0.7, z: 4.1, hw: 0.3, hd: 0.3, ry: 0 })
      add({ t: 'glb', m: 'plant', x: hw - 0.7, z: -4.3, s: 1.4 }, { x: hw - 0.7, z: -4.3, hw: 0.3, hd: 0.3, ry: 0 })
      windows([-0.2])
      break
    }
    // ================= bar =================
    case 'bar': {
      sign()
      const bw = 6.4
      counter(v.id === 'bar' ? -1.2 : 0, bw, { top: '#3b2a55' })
      const bcx = v.id === 'bar' ? -1.2 : 0
      add({ t: 'bottles', x: bcx - 1.6, z: -hd + 0.25, w: 2.8 })
      add({ t: 'bottles', x: bcx + 1.6, z: -hd + 0.25, w: 2.8 })
      add({ t: 'neon', x: -4.6, y: 2.4, z: -hd + 0.05, w: 1.5, c: '#fdb15e' })
      add({ t: 'neon', x: 4.6, y: 2.4, z: -hd + 0.05, w: 1.5, c: '#8fd8ff' })
      const sx = v.id === 'bar' ? [-3.9, -2.8, -1.7, -0.6, 0.5, 1.6] : [-2.9, -1.8, -0.7, 0.4, 1.5, 2.6]
      sx.forEach((x, i) => stoolAt(`st${i}`, x, -0.7, Math.PI, `p${Math.floor(i / 2)}`))
      ;[[-4.3, 2.0], [4.3, 2.0]].forEach(([x, z], i) => tableSet(i, x, z, 'z'))
      add({ t: 'glb', m: 'plant', x: hw - 0.7, z: -4.2, s: 1.4 }, { x: hw - 0.7, z: -4.2, hw: 0.3, hd: 0.3, ry: 0 })
      add({ t: 'glb', m: 'plant', x: -hw + 0.7, z: 4.1, s: 1.4 }, { x: -hw + 0.7, z: 4.1, hw: 0.3, hd: 0.3, ry: 0 })
      add({ t: 'lamp', x: -4.3, z: 2.0, y: 1.2 })
      add({ t: 'lamp', x: 4.3, z: 2.0, y: 1.2 })
      break
    }
    // ================= kulüp =================
    case 'club': {
      add({ t: 'board', x: -2.8, y: 3.0, z: -hd + 0.04, ry: 0, w: 3.4, h: 0.6, lines: [`${v.emoji} ${v.name}`], bg: '#7a3fd1', fg: '#ffffff', big: true })
      add({ t: 'djgear', x: 0, z: counterZ, w: 3.4, d: 0.9 }, true)
      add({ t: 'dancefloor', x: -1.2, z: 1.3, cols: 5, rows: 4, size: 0.95 })
      add({ t: 'discoball', x: -1.2, z: 1.3, y: 3.0 })
      add({ t: 'laser', x: -1.2, z: 1.3, y: 3.0 })
      // karaoke sahnesi (doğu): 1 kişi sırayla
      const st = { x: 4.4, z: -3.0, w: 2.6, d: 3.0 }
      L.stage = { ...st, spot: { x: 4.4, z: -2.55, ry: 0 } }
      add({ t: 'stage', ...st })
      add({ t: 'board', x: 4.4, y: 2.25, z: -hd + 0.04, ry: 0, w: 2.6, h: 1.1, lines: ['🎤 KARAOKE', '♪ sırada sen varsın ♪'], bg: '#33205e', fg: '#fec286', frame: '#fdb15e', big: true })
      add({ t: 'glb', m: 'speaker', x: 3.45, z: -4.25, s: 1.9 }, { x: 3.45, z: -4.25, hw: 0.4, hd: 0.4, ry: 0 })
      add({ t: 'glb', m: 'speaker', x: hw - 0.65, z: -4.25, s: 1.9 }, { x: hw - 0.65, z: -4.25, hw: 0.4, hd: 0.4, ry: 0 })
      add({ t: 'glb', m: 'speaker', x: -2.7, z: -4.3, s: 2.0 }, { x: -2.7, z: -4.3, hw: 0.45, hd: 0.45, ry: 0 })
      add({ t: 'glb', m: 'speaker', x: -hw + 0.7, z: -4.2, s: 2.0 }, { x: -hw + 0.7, z: -4.2, hw: 0.45, hd: 0.45, ry: 0 })
      add({ t: 'mic', x: 4.4, z: -2.1 })
      // yan koltuklar (batı duvarı)
      sofaAt('sofaA', -hw + 0.7, -1.3, Math.PI / 2, 2.0, '#b79cff')
      sofaAt('sofaB', -hw + 0.7, 0.9, Math.PI / 2, 2.0, '#fdb15e')
      sofaAt('sofaC', hw - 0.7, 1.4, -Math.PI / 2, 2.0, '#7fcdf3')
      add({ t: 'neon', x: -hw + 0.05, y: 2.3, z: 0, w: 4, c: '#fdb15e', ry: Math.PI / 2 })
      add({ t: 'neon', x: hw - 0.05, y: 2.3, z: 0, w: 4, c: '#8fd8ff', ry: -Math.PI / 2 })
      L.karaoke = { stage: st, spot: L.stage.spot }
      // DJ vardiyası: tezgâhın arkasında, NPC alanının solunda (features/dj.js)
      L.dj = { spot: { x: -1.6, z: -3.0, ry: 0 } }
      break
    }
    // ================= oyun salonu =================
    case 'arcade': {
      sign()
      counter(npc.x, 3.6, { top: '#4a3f7a' })
      add({ t: 'register', x: npc.x, z: counterZ, y: 1.0 })
      const cols = [th.accent, '#7fcdf3', '#ffd35e', '#8fdcb4', '#fdb15e', '#b79cff']
      ;[-5.2, -3.9, -2.6, -1.3, 0.0, 1.3].forEach((x, i) => add({ t: 'cabinet', x, z: -hd + 0.65, ry: 0, w: 0.85, d: 0.8, c: cols[i % cols.length] }, true))
      // orta ada: gerçekten sırt sırta iki kabin sırası (ekranlar dışa bakar, joystick'ler çarpışmaz)
      ;[-4.4, -3.0, -1.6].forEach((x, i) => {
        add({ t: 'cabinet', x, z: 0.25, ry: Math.PI, w: 0.85, d: 0.8, c: cols[(i + 2) % cols.length] }, true)
        add({ t: 'cabinet', x, z: 1.35, ry: 0, w: 0.85, d: 0.8, c: cols[(i + 4) % cols.length] }, true)
      })
      add({ t: 'cabinet', x: 2.55, z: 2.4, ry: -Math.PI / 2 }, { x: 2.55, z: 2.4, hw: 0.5, hd: 0.45, ry: 0 })
      add({ t: 'cabinet', x: 3.65, z: 2.4, ry: Math.PI / 2 }, { x: 3.65, z: 2.4, hw: 0.5, hd: 0.45, ry: 0 })
      add({ t: 'claw', x: 5.2, z: -0.4, ry: -Math.PI / 2 }, { x: 5.2, z: -0.4, hw: 0.45, hd: 0.45, ry: 0 })
      sofaAt('sofaA', -hw + 0.7, 3.2, Math.PI / 2, 2.0, th.accent)
      add({ t: 'rug', x: 0, z: 1.2, w: 11, d: 0.5, c: '#5a4aa0', round: false })
      add({ t: 'neon', x: 3.2, y: 2.6, z: -hd + 0.05, w: 2.6, c: '#8fd8ff' })
      break
    }
    // ================= kuaför =================
    case 'salon': {
      sign()
      counter(npc.x, 3.4)
      add({ t: 'register', x: npc.x, z: counterZ, y: 1.0 })
      ;[-4.4, -2.7, -1.0].forEach((x, i) => {
        add({ t: 'mirror', x, z: -hd + 0.05, w: 1.25, h: 1.9 })
        add({ t: 'box', x: x + 0.0, z: -hd + 0.45, w: 1.2, d: 0.4, h: 0.85, c: '#fffaf2' })
        // stilist koltuğu aynaya bakar
        add({ t: 'salonchair', x, z: -3.4, ry: Math.PI, c: th.accent })
        block(x, -3.4, 0.35, 0.35)
        seat(`ch${i}`, 'chair', 'chair', x, -3.4, Math.PI)
      })
      add({ t: 'box', x: -hw + 0.7, z: 1.0, w: 0.8, d: 1.4, h: 0.9, c: '#fffaf2' }, true) // yıkama lavabosu
      add({ t: 'cyl', x: -hw + 0.7, z: 1.0, r: 0.3, h: 0.1, y: 0.9, c: '#cfeaff' })
      sofaAt('sofaA', hw - 0.7, 1.6, -Math.PI / 2, 2.0, th.accent)
      add({ t: 'rug', x: 0, z: 1.6, w: 3, d: 3, c: mix(th.accent, '#ffffff', 0.55), round: true })
      add({ t: 'mirror', x: hw - 0.05, z: -0.6, w: 1.3, h: 1.8, ry: -Math.PI / 2 })
      plant(-hw + 0.7, 4.1)
      plant((hw - 0.7), -4.2)
      windows([2.4])
      break
    }
    // ================= stüdyo =================
    case 'studio': {
      sign()
      counter(npc.x, 3.0)
      add({ t: 'camera', x: npc.x - 0.9, z: counterZ, y: 1.0 })
      const bx = 3.1
      add({ t: 'backdrop', x: bx, z: -hd + 0.03, w: 4.6, h: 3.0, c: mix(th.accent, '#ffffff', 0.45), c2: mix(th.pastel, '#ffffff', 0.5) })
      add({ t: 'softbox', x: bx - 2.7, z: -1.0, ry: 0.5 }, { x: bx - 2.7, z: -1.0, hw: 0.35, hd: 0.35, ry: 0 })
      add({ t: 'softbox', x: bx + 2.5, z: -1.0, ry: -0.5 }, { x: bx + 2.5, z: -1.0, hw: 0.35, hd: 0.35, ry: 0 })
      sofaAt('sofaA', bx, -3.6, 0, 2.2, '#fec172')
      add({ t: 'box', x: bx + 2.0, z: -3.6, w: 0.7, d: 0.7, h: 0.5, c: '#fffaf2' }, true)
      add({ t: 'ball', x: bx + 2.0, y: 0.8, z: -3.6, r: 0.3, c: th.accent })
      L.photo = { x: bx, z: -1.0, radius: 2.2 }
      add({ t: 'rug', x: bx, z: -1.4, w: 3.4, d: 3.6, c: mix(th.accent, '#ffffff', 0.7), round: true })
      ;[-5.0, -3.9, -2.8].forEach((x, i) => frame(x, 2.3 - (i % 2) * 0.35, -hd + 0.03, 0, 0.8, 1.0, [th.accent, '#7fcdf3', '#ffd35e'][i]))
      frame(-hw + 0.03, 2.1, 1.4, Math.PI / 2, 1.0, 1.3, '#b79cff')
      frame(-hw + 0.03, 2.0, 3.0, Math.PI / 2, 0.8, 1.0, '#8fdcb4')
      plant(-hw + 0.7, 4.1)
      plant((hw - 0.7), 4.1)
      break
    }
    // ================= sörf dükkanı =================
    case 'shop': {
      sign()
      counter(npc.x, 3.4)
      add({ t: 'register', x: npc.x + 1.0, z: counterZ, y: 1.0 })
      const bcols = [['#fec172', '#fff8f0'], ['#7fcdf3', '#ffffff'], ['#ffd35e', '#fff7dc'], ['#8fdcb4', '#ffffff'], ['#b79cff', '#fff8f0'], ['#ffb48c', '#ffffff']]
      ;[4.5, 3.4, 2.3, 1.2].forEach((x, i) => add({ t: 'surf', x, z: -hd + 0.5, ry: 0, c: bcols[i][0], c2: bcols[i][1], len: 2.0 }))
      ;[-0.5, 0.3].forEach((z, i) => add({ t: 'surf', x: hw - 0.45, z: z + 0.5, ry: -Math.PI / 2, c: bcols[4 + i][0], c2: bcols[4 + i][1], len: 2.0 }))
      ;[-1.0, 0.0, 1.0].forEach((z, i) => add({ t: 'surf', x: -hw + 0.45, z: z + 0.5, ry: Math.PI / 2, c: bcols[i][0], c2: bcols[i][1], len: 2.0 }))
      add({ t: 'rack', x: -3.4, z: 2.0 }, { x: -3.4, z: 2.0, hw: 1.0, hd: 0.3, ry: 0 })
      add({ t: 'rack', x: 3.6, z: 2.2 }, { x: 3.6, z: 2.2, hw: 1.0, hd: 0.3, ry: 0 })
      add({ t: 'glb', m: 'palm', x: -5.2, z: -4.1, s: 3.0 }, { x: -5.2, z: -4.1, hw: 0.4, hd: 0.4, ry: 0 })
      add({ t: 'glb', m: 'palm', x: hw - 0.7, z: 4.0, s: 3.0 }, { x: 5.3, z: 4.0, hw: 0.4, hd: 0.4, ry: 0 })
      add({ t: 'rug', x: 0, z: 0.8, w: 3.2, d: 2.2, c: '#9fd8f5', round: true })
      windows([2.6])
      break
    }
    // ================= rehber =================
    case 'guide': {
      sign()
      counter(0, 3.4)
      add({ t: 'board', x: -3.8, y: 2.0, z: -hd + 0.04, ry: 0, w: 2.6, h: 1.9, lines: ['map'], bg: '#fffaf2', fg: '#4a3b5c', frame: th.accent, map: true })
      add({ t: 'board', x: 3.8, y: 2.1, z: -hd + 0.04, ry: 0, w: 2.2, h: 1.5, lines: ['🧭 İpuçları', 'E: kapı / otur', '💗: jest & fısıltı', '😊: emoji tepkisi', 'Enter: sohbet'], bg: '#fffaf2', fg: '#4a3b5c', frame: th.accent })
      plant(-hw + 1.0, 0.6)
      sofaAt('sofaA', -3.9, 2.8, 0, 2.2, th.accent)
      sofaAt('sofaB', 3.9, 2.8, 0, 2.2, '#7fcdf3')
      add({ t: 'rug', x: 0, z: 1.2, w: 3.4, d: 3.4, c: mix(th.accent, '#ffffff', 0.55), round: true })
      add({ t: 'globe', x: 4.6, z: -0.6 }, { x: 4.6, z: -0.6, hw: 0.45, hd: 0.45, ry: 0 })
      plant(-hw + 0.7, -4.2)
      plant((hw - 0.7), -4.2)
      windows([0.4])
      break
    }
    // ================= havalimanı çıkış salonu (başlangıç odası) =================
    case 'airport': {
      sign()
      // bagaj bandı (batı arka): bant + valizler (küçük, fark edilmeyen parçalar)
      add({ t: 'box', x: -3.9, y: 0.22, z: -3.3, w: 3.4, h: 0.44, d: 1.0, c: '#b8c4d8' }, { x: -3.9, z: -3.3, hw: 1.7, hd: 0.5, ry: 0 })
      add({ t: 'box', x: -3.9, y: 0.47, z: -3.3, w: 3.2, h: 0.06, d: 0.8, c: '#6f7d96', shadow: false })
      add({ t: 'board', x: -3.9, y: 2.4, z: -hd + 0.04, ry: 0, w: 2.6, h: 0.5, lines: ['🧳 Bagaj Teslim'], bg: '#fffaf2', fg: '#4a3b5c', frame: th.accent })
      // varış panosu (orta, duvarda)
      add({ t: 'board', x: -0.4, y: 2.1, z: -hd + 0.04, ry: 0, w: 2.6, h: 1.6, lines: ['✈️ Varışlar', 'İstanbul · İndi', 'Ankara · İndi', 'İzmir · Bekleniyor'], bg: '#1f2a44', fg: '#ffe58a', frame: th.accent })
      // danışma tezgâhı (kuzeydoğu)
      counter(3.3, 3.2)
      add({ t: 'board', x: 3.3, y: 2.6, z: -hd + 0.04, ry: 0, w: 2.2, h: 0.5, lines: ['✈️ Danışma'], bg: '#fffaf2', fg: '#4a3b5c', frame: th.accent })
      // havalimanı süsleri (Meshy): uçak maketi, bagaj arabası, valiz yığını
      add({ t: 'glb', m: 'plane', x: -0.5, z: 0.1, s: 2.0, ry: 0.5 }, { x: -0.5, z: 0.1, hw: 0.95, hd: 0.95, ry: 0 })
      add({ t: 'glb', m: 'cart', x: -2.9, z: 4.1, s: 1.4, ry: 0.2 }, { x: -2.9, z: 4.1, hw: 0.5, hd: 0.4, ry: 0 })
      add({ t: 'glb', m: 'suitcases', x: -6.4, z: -2.4, s: 1.1, ry: 0.4 }, { x: -6.4, z: -2.4, hw: 0.45, hd: 0.45, ry: 0 })
      // eğitim holü örnek mekân kapısı (batı duvarı)
      add({ t: 'demodoor', x: -hw + 0.04, z: -0.4 })
      // bekleme koltukları ve bitkiler
      sofaAt('sofaA', -4.0, 1.4, 0, 2.2, '#7fcdf3')
      sofaAt('sofaB', -4.0, 3.0, 0, 2.2, th.accent)
      add({ t: 'rug', x: 0.3, z: 2.4, w: 3.0, d: 3.0, c: mix(th.accent, '#ffffff', 0.6), round: true })
      plant(-hw + 0.7, -4.4)
      plant(2.2, 4.3)
      // doğu bekleme köşesi: oda tek yana yığılmış görünmesin
      sofaAt('sofaC', hw - 1.1, -0.9, -Math.PI / 2, 2.2, '#ffc98f')
      sofaAt('sofaD', hw - 1.1, 1.6, -Math.PI / 2, 2.2, '#8fd0ff')
      plant(hw - 0.7, -4.4)
      plant(hw - 0.7, 4.2)
      add({ t: 'rug', x: hw - 2.6, z: 0.4, w: 2.2, d: 4.2, c: mix(th.accent, '#ffffff', 0.62) })
      windows([-0.6, 2.4])
      break
    }
    // ================= fitness kulübü (MakFit) =================
    case 'gym': {
      sign()
      // Boks ringi (sol/orta ana alan)
      add({ t: 'ring', x: -3.2, z: -0.6, w: 4.4, d: 4.4 }, { x: -3.2, z: -0.6, hw: 2.25, hd: 2.25, ry: 0 })
      // Kum torbası (ringin sağ arkası)
      add({ t: 'punchbag', x: 1.9, z: -3.6 }, { x: 1.9, z: -3.6, hw: 0.45, hd: 0.45, ry: 0 })
      // Ağırlık çalışma istasyonu: bench press + dambıl rafı (sağ kuzey)
      add({ t: 'benchpress', x: 4.5, z: -2.4, ry: -Math.PI / 2 }, { x: 4.5, z: -2.4, hw: 1.0, hd: 0.75, ry: 0 })
      add({ t: 'dumbbells', x: 6.7, z: -2.4, ry: -Math.PI / 2 }, { x: 6.7, z: -2.4, hw: 0.45, hd: 1.15, ry: 0 })
      // Koşu bantları (sağ güney)
      add({ t: 'treadmill', x: 4.4, z: 1.5, ry: Math.PI }, { x: 4.4, z: 1.5, hw: 0.55, hd: 0.95, ry: 0 })
      add({ t: 'treadmill', x: 6.1, z: 1.5, ry: Math.PI }, { x: 6.1, z: 1.5, hw: 0.55, hd: 0.95, ry: 0 })
      // Duvar panoları & aynalar
      add({ t: 'board', x: -3.2, y: 2.15, z: -hd + 0.04, ry: 0, w: 2.5, h: 1.15, lines: ['🥊 BOKS RİNGİ', '← Jab · → Kroşe', '↑ Aparkat · ↓ Blok', 'Haftalık Şampiyon: 🏆'], bg: '#fffaf2', fg: '#4a3b5c', frame: '#ff8a7a' })
      add({ t: 'board', x: 4.5, y: 2.15, z: -hd + 0.04, ry: 0, w: 2.3, h: 1.1, lines: ['💪 ANTRENMAN', 'Ağırlık → +Güç', 'Koşu → +Kondisyon', 'Enerji her gün yenilenir'], bg: '#fffaf2', fg: '#4a3b5c', frame: '#7fcdf3' })
      add({ t: 'mirror', x: hw - 0.05, z: -0.4, w: 2.2, h: 1.9, ry: -Math.PI / 2 })
      add({ t: 'rug', x: 5.2, z: -0.4, w: 3.8, d: 5.4, c: '#c8eadf', round: false })
      sofaAt('sofaA', -5.4, 3.2, 0, 2.0, '#7fcdf3')
      plant(-hw + 0.7, -4.2)
      plant(-hw + 0.7, 4.1)
      plant(hw - 0.7, 4.1)
      windows([2.4])
      L.gym = {
        ring: { x: -3.2, z: -0.6 },
        weights: { x: 4.5, z: -2.4 },
        cardio: { x: 5.2, z: 1.5 },
      }
      break
    }
    // ================= Teknel (mavi logolu tekel & şarküteri) =================
    case 'teknel': {
      add({ t: 'board', x: 0, y: 3.05, z: -hd + 0.04, ry: 0, w: 3.6, h: 0.65, lines: ['🍾 TEKNEL · ŞARKÜTERİ'], bg: '#1d74d8', fg: '#ffffff', big: true })
      counter(0, 4.6, { c: '#d6e9ff', top: '#1d74d8' })
      add({ t: 'register', x: 1.3, z: counterZ, y: 1.0 })
      add({ t: 'display', x: -1.3, z: counterZ, y: 1.0, w: 1.6, mode: 'cakes' })
      // soğuk içecek dolapları ve şarküteri rafları
      add({ t: 'bottles', x: -3.6, z: -hd + 0.28, w: 2.6 })
      add({ t: 'bottles', x: 3.6, z: -hd + 0.28, w: 2.6 })
      add({ t: 'neon', x: -4.8, y: 2.45, z: -hd + 0.05, w: 1.6, c: '#38bdf8' })
      add({ t: 'neon', x: 4.8, y: 2.45, z: -hd + 0.05, w: 1.6, c: '#38bdf8' })
      add({ t: 'board', x: -4.2, y: 2.0, z: -hd + 0.04, ry: 0, w: 1.8, h: 1.15, lines: ['❄️ SOĞUK DOLAP', '🍺 Bira · 🍷 Şarap', '🥃 Rakı · 🥤 Gazoz', '🧀 Peynir Tabağı'], bg: '#eef7ff', fg: '#1e3a5f', frame: '#1d74d8' })
      // 2 küçük samimi şarküteri masası
      ;[[-3.6, 1.4], [3.6, 1.4]].forEach(([x, z], i) => tableSet(i, x, z))
      add({ t: 'rug', x: 0, z: 1.4, w: 2.4, d: 2.6, c: '#cfe6ff', round: false })
      windows()
      corners()
      break
    }
    default:
      sign()
      counter(npc.x, 4)
      corners()
  }
  // --- geniş oda: yan duvar boşluklarını doldur (mekânlar büyütüldü: içeride çok oyuncu olabilir) ---
  const hit = (x, z, rw, rd) => L.colliders.some((c) => Math.abs(c.x - x) < c.hw + rw + 0.1 && Math.abs(c.z - z) < c.hd + rd + 0.1)
  const inNpc = (x, z) => x > L.npcRect.x0 - 0.6 && x < L.npcRect.x1 + 0.6 && z > L.npcRect.z0 - 0.6 && z < L.npcRect.z1 + 0.6
  const CAFE_LIKE = ['cafe', 'tea', 'bakery', 'dessert', 'books', 'fastfood', 'icecream']
  let fi = 0
  for (const sx of [-1, 1]) {
    for (const z of [-0.6, 2.4]) {
      const x = sx * (hw - 1.7)
      if (CAFE_LIKE.includes(v.type)) {
        if (!hit(x, z, 1.5, 0.7) && !inNpc(x, z)) tableSet(`fx${fi++}`, x, z, 'x')
      } else if (v.type !== 'airport' && v.type !== 'gym') {
        if (!hit(sx * (hw - 1.0), z, 0.5, 1.1) && !inNpc(x, z)) sofaAt(`fs${fi++}`, sx * (hw - 1.0), z, sx < 0 ? Math.PI / 2 : -Math.PI / 2, 2.0, th.accent)
      }
    }
  }
  return L
}

/** Oturma noktaları: sunucuda koltuk kimliğinden bakmak için. */
export function venueSeatMap(id) {
  const m = new Map()
  for (const s of venueSeats(id)) m.set(s.id, s)
  return m
}
