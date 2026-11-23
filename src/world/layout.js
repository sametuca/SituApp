// Şehir haritası verisi: yollar, mahalleler, binalar, süs nesneleri ve çarpışma alanları.
// Birim: metre. Orijin (0,0) = lobi meydanının merkezi. +x doğu, -z kuzey, +z güney.
// Sunucudaki WORLD_HALF (server/game.js) ile aynı olmalı.

export const WORLD_HALF = 60
export const PLAY_LIMIT = 46 // oyuncunun yürüyebildiği sınır
export const ROAD_HALF = 3 // yolların yarı genişliği

export const PALETTE = {
  pink: '#ffc2dc',
  blue: '#b9e3ff',
  yellow: '#ffe9a8',
  mint: '#c4f0d8',
  lilac: '#dccfff',
  peach: '#ffd5bf',
}
const ROOF = { pink: '#ff9fc6', blue: '#7fcdf3', yellow: '#ffd35e', mint: '#8fdcb4', lilac: '#b79cff', peach: '#ffb48c' }

// ---------- mahalleler ----------
export const ZONES = [
  { id: 'lobby', name: 'Lobi Meydanı', emoji: '⛲', desc: 'Herkesin buluşma noktası. Yollar buradan her yöne açılır.', shape: 'circle', x: 0, z: 0, r: 12, spawn: [0, 7] },
  { id: 'cafe', name: 'Kafe Sokağı', emoji: '☕', desc: 'Sakin, samimi sohbetler için.', shape: 'rect', x0: -14, x1: 14, z0: -48, z1: -12, spawn: [0, -22] },
  { id: 'club', name: 'Gece Kulübü', emoji: '🪩', desc: 'Müzik, dans ve enerji.', shape: 'rect', x0: 12, x1: 48, z0: -14, z1: 14, spawn: [24, 0] },
  { id: 'park', name: 'Park', emoji: '🌳', desc: 'Açık havada yürüyüş ve sohbet.', shape: 'rect', x0: -48, x1: -12, z0: -14, z1: 14, spawn: [-24, 0] },
  { id: 'beach', name: 'Plaj', emoji: '🏖️', desc: 'Gün batımı, deniz ve rahat sohbetler.', shape: 'rect', x0: -14, x1: 14, z0: 12, z1: 48, spawn: [0, 36] },
]
const FALLBACK_ZONE = { id: 'city', name: 'Şehir', emoji: '🏙️', desc: 'Sokaklarda dolaşıyorsun.' }

export function zoneAt(x, z) {
  for (const zn of ZONES) {
    if (zn.shape === 'circle' ? Math.hypot(x - zn.x, z - zn.z) <= zn.r : x >= zn.x0 && x <= zn.x1 && z >= zn.z0 && z <= zn.z1) return zn
  }
  return FALLBACK_ZONE
}

// /ışınlan komutu için kısa adlar
export const TELEPORTS = {
  lobi: 'lobby', lobby: 'lobby',
  kafe: 'cafe', cafe: 'cafe',
  kulup: 'club', 'kulüp': 'club', club: 'club',
  park: 'park',
  plaj: 'beach', beach: 'beach',
}

export const SPAWN = { x: 0, z: 7 }

// ---------- binalar ----------
// facing: kapının baktığı yön ('n' = -z, 's' = +z, 'e' = +x, 'w' = -x)
const b = (x, z, w, d, h, color, facing, label, extra = {}) => ({ x, z, w, d, h, color: PALETTE[color], roof: ROOF[color], facing, label, ...extra })

export const BUILDINGS = [
  // lobi meydanındaki dört önemli yapı
  b(17, -17, 8, 8, 6, 'blue', 'w', '🧭 Rehber Merkezi'),
  b(-17, -17, 8, 8, 6, 'pink', 'e', '💇 Kuaför & Stil'),
  b(17, 17, 8, 8, 6, 'lilac', 'w', '📸 Fotoğraf Stüdyosu'),
  b(-17, 17, 8, 8, 6, 'peach', 'e', '🍰 Tatlı Dükkanı'),

  // Kafe Sokağı (kuzey)
  b(-9.7, -18, 6, 7, 5, 'yellow', 'e', '☕ Kafe', { shop: true }),
  b(9.7, -18, 6, 7, 5, 'mint', 'w', '📚 Kitap Kafe', { shop: true }),
  b(-9.7, -27, 6, 8, 6, 'pink', 'e', '🥐 Fırın', { shop: true }),
  b(9.7, -27, 6, 8, 5, 'blue', 'w', '🍵 Çay Evi', { shop: true }),
  b(-9.7, -36, 6, 8, 7, 'lilac', 'e'),
  b(9.7, -36, 6, 8, 6, 'peach', 'w'),
  b(-9.7, -44, 6, 7, 5, 'mint', 'e'),
  b(9.7, -44, 6, 7, 7, 'yellow', 'w'),

  // Gece Kulübü (doğu)
  b(26, -9.7, 14, 8, 7, 'lilac', 's', '🪩 Gece Kulübü', { neon: true }),
  b(40, -9.7, 7, 8, 6, 'pink', 's', '🍹 Bar', { shop: true }),
  b(19, 9.7, 7, 6, 5, 'blue', 'n', '🎮 Oyun Salonu', { shop: true }),
  b(30, 9.7, 8, 6, 6, 'yellow', 'n', '🍔 Fast Food', { shop: true }),
  b(41, 9.7, 7, 6, 5, 'mint', 'n'),

  // Plaj Yolu (güney)
  b(-9.7, 19, 6, 7, 5, 'blue', 'e', '🍦 Dondurmacı', { shop: true }),
  b(9.7, 19, 6, 7, 5, 'pink', 'w', '🏄 Sörf Dükkanı', { shop: true }),
  b(-9.7, 27, 6, 7, 4, 'yellow', 'e', '🥤 Bar'),
  b(9.7, 27, 6, 7, 4, 'mint', 'w'),

  // Kuzeydoğu mahallesi
  b(28, -26, 10, 10, 11, 'pink', 's'),
  b(41, -26, 8, 10, 9, 'blue', 's'),
  b(28, -41, 10, 8, 8, 'mint', 'w'),
  b(41, -41, 8, 8, 12, 'lilac', 'w'),
  // Kuzeybatı mahallesi
  b(-28, -26, 10, 10, 9, 'yellow', 'e'),
  b(-41, -26, 8, 10, 11, 'peach', 'e'),
  b(-28, -41, 10, 8, 12, 'blue', 's'),
  b(-41, -41, 8, 8, 8, 'pink', 's'),
  // Güneydoğu mahallesi
  b(28, 26, 10, 10, 8, 'lilac', 'n'),
  b(41, 26, 8, 10, 10, 'mint', 'n'),
  b(28, 41, 10, 8, 11, 'peach', 'n'),
  b(41, 41, 8, 8, 9, 'yellow', 'n'),
  // Güneybatı mahallesi
  b(-28, 26, 10, 10, 10, 'mint', 'n'),
  b(-41, 26, 8, 10, 8, 'blue', 'n'),
  b(-28, 41, 10, 8, 9, 'pink', 'n'),
  b(-41, 41, 8, 8, 12, 'lilac', 'n'),

  // Herkesin kendi evine girdiği kapı (lobi meydanının güneybatısı)
  b(-9, 10, 5, 5, 4.6, 'mint', 'e', '🏠 Evim', { homeDoor: true }),

  // Park çardağı
  { x: -30, z: 0, gazebo: true },
]
export const GAZEBO = { x: -30, z: 0, r: 3.2 }

// ---------- süs nesneleri (GLB) ----------
// model: public/models altındaki dosya; scale: 1 birimlik normalize edilmiş boyuta çarpan; r: çarpışma yarıçapı (0 = yok)
const M = {
  table: '/models/cafe/cafe-table.glb',
  chair: '/models/cafe/cafe-chair.glb',
  plant: '/models/cafe/cafe-plant.glb',
  bench: '/models/park/park-bench.glb',
  tree: '/models/park/park-tree.glb',
  lamp: '/models/park/park-lamp.glb',
  ball: '/models/club/club-ball.glb',
  speaker: '/models/club/club-speaker.glb',
  booth: '/models/club/club-booth.glb',
  umbrella: '/models/beach/beach-umbrella.glb',
  lounger: '/models/beach/beach-lounger.glb',
  palm: '/models/beach/beach-palm.glb',
}
const p = (model, x, z, scale, r = 0, ry = 0) => ({ model: M[model], x, z, scale, r, ry })

export const PROPS = []
// sokak lambaları: ana yolların iki yanında
for (const t of [-40, -30, -20, 20, 30, 40]) {
  PROPS.push(p('lamp', 4.2, t, 3, 0.35), p('lamp', -4.2, t, 3, 0.35)) // kuzey-güney yol
  PROPS.push(p('lamp', t, 4.2, 3, 0.35), p('lamp', t, -4.2, 3, 0.35)) // doğu-batı yol
}
// lobi: çeşmenin çevresinde banklar ve ağaçlar
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2 + Math.PI / 6
  PROPS.push(p('bench', Math.cos(a) * 7.2, Math.sin(a) * 7.2, 1.7, 0, -a + Math.PI / 2))
}
PROPS.push(p('tree', 9, 9, 3.4, 0.7), p('tree', 9, -9, 3.4, 0.7), p('tree', -9, -9, 3.4, 0.7))
// kafe sokağı: dışarıda masalar ve bitkiler
for (const [x, z] of [[-6.2, -20], [-6.2, -24], [6.2, -20], [6.2, -24], [-6.2, -31], [6.2, -31]]) {
  PROPS.push(p('table', x, z, 1.3, 0.55), p('chair', x + (x < 0 ? -1.1 : 1.1), z, 1, 0.3, x < 0 ? -Math.PI / 2 : Math.PI / 2))
}
for (const [x, z] of [[-6.5, -15], [6.5, -15], [-6.5, -38], [6.5, -38]]) PROPS.push(p('plant', x, z, 1.4, 0.4))
// gece kulübü: girişin önünde hoparlörler, DJ standı
PROPS.push(p('booth', 26, -4.6, 2.6, 1.2), p('speaker', 20.5, -4.6, 2, 0.6), p('speaker', 31.5, -4.6, 2, 0.6))
PROPS.push(p('speaker', 38, 4.6, 1.8, 0.5), p('lamp', 44, 4.6, 3, 0.35))
// park: ağaçlar, banklar
for (const [x, z] of [[-18, -9], [-24, -10], [-36, -10], [-44, -8], [-20, 9], [-26, 10], [-37, 9], [-44, 6], [-42, -1], [-18, 1]]) PROPS.push(p('tree', x, z, 3.6, 0.7))
PROPS.push(p('bench', -22, -5, 1.7, 0, 0), p('bench', -22, 5, 1.7, 0, Math.PI), p('bench', -36, -5, 1.7, 0, 0), p('bench', -36, 5, 1.7, 0, Math.PI))
for (const x of [-16, -26, -34, -44]) PROPS.push(p('lamp', x, 3.8, 3, 0.35))
// plaj: şemsiyeler, şezlonglar, palmiyeler
for (const [x, z] of [[-8, 33], [-1, 36], [7, 34], [-6, 41], [5, 42]]) {
  PROPS.push(p('umbrella', x, z, 2.6, 0.3), p('lounger', x + 1.6, z + 1.4, 1.7, 0, 0.6))
}
for (const [x, z] of [[-12, 31], [12, 31], [-11, 44], [11, 44]]) PROPS.push(p('palm', x, z, 4.6, 0.5))
// mahalle köşelerinde ağaçlar
for (const [x, z] of [[17, -33], [-17, -33], [17, 33], [-17, 33], [47 - 2, 14], [-47 + 2, -16]]) PROPS.push(p('tree', x, z, 3.6, 0.7))

// ---------- çarpışma alanları ----------
export const COLLIDERS = [
  { type: 'circle', x: 0, z: 0, r: 2.6 }, // çeşme
  { type: 'circle', x: GAZEBO.x, z: GAZEBO.z, r: GAZEBO.r }, // çardak
  { type: 'circle', x: -36, z: 12.5, r: 0.01 },
  ...BUILDINGS.filter((bd) => !bd.gazebo).map((bd) => ({ type: 'box', x: bd.x, z: bd.z, hw: bd.w / 2 + 0.15, hd: bd.d / 2 + 0.15 })),
  ...PROPS.filter((pr) => pr.r > 0).map((pr) => ({ type: 'circle', x: pr.x, z: pr.z, r: pr.r })),
]

export const PLAYER_RADIUS = 0.4

/** (x,z) konumunu çarpışmalardan ve dünya sınırından çıkarır. */
export function resolveCollisions(x, z) {
  x = Math.max(-PLAY_LIMIT, Math.min(PLAY_LIMIT, x))
  z = Math.max(-PLAY_LIMIT, Math.min(PLAY_LIMIT, z))
  for (const c of COLLIDERS) {
    if (c.type === 'circle') {
      const dx = x - c.x
      const dz = z - c.z
      const min = c.r + PLAYER_RADIUS
      const d2 = dx * dx + dz * dz
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 0.0001
        x = c.x + (dx / d) * min
        z = c.z + (dz / d) * min
      }
    } else {
      // dikdörtgen: en yakın noktaya göre dışarı it
      const nx = Math.max(c.x - c.hw, Math.min(x, c.x + c.hw))
      const nz = Math.max(c.z - c.hd, Math.min(z, c.z + c.hd))
      const dx = x - nx
      const dz = z - nz
      const d2 = dx * dx + dz * dz
      if (d2 < PLAYER_RADIUS * PLAYER_RADIUS) {
        if (d2 === 0) {
          // tam içindeyse en yakın kenara çık
          const left = x - (c.x - c.hw)
          const right = c.x + c.hw - x
          const top = z - (c.z - c.hd)
          const bottom = c.z + c.hd - z
          const m = Math.min(left, right, top, bottom)
          if (m === left) x = c.x - c.hw - PLAYER_RADIUS
          else if (m === right) x = c.x + c.hw + PLAYER_RADIUS
          else if (m === top) z = c.z - c.hd - PLAYER_RADIUS
          else z = c.z + c.hd + PLAYER_RADIUS
        } else {
          const d = Math.sqrt(d2)
          x = nx + (dx / d) * PLAYER_RADIUS
          z = nz + (dz / d) * PLAYER_RADIUS
        }
      }
    }
  }
  return [x, z]
}

// Rehber NPC: lobi meydanında, Rehber Merkezi'nin önünde
export const GUIDE = { x: 10.5, z: -8, ry: -2.3, avatar: 'mira', name: 'Rehber', radius: 5 }

// ---------- ev kapısı ve iç mekan ----------
// Kapının önündeki nokta (şehirde): buraya gelince "Eve gir" çıkar, dışarı çıkınca buraya dönülür.
export const HOME_DOOR = { x: -5.4, z: 10, radius: 2.6 }

// Ev odası: orijin = oda merkezi; giriş kapısı güney duvarında (+z). Şehir çizilmez, aynı koordinat sistemi.
export const HOME_ROOM = {
  hw: 5, // yarı genişlik (x)
  hd: 4.5, // yarı derinlik (z)
  wallH: 3.4,
  spawn: [0, 3.0], // girince doğduğun nokta
  exit: { x: 0, z: 3.7, radius: 1.6 }, // kapının önü: "Dışarı çık"
}
export const HOME_ZONE = { id: 'home', name: 'Ev', emoji: '🏠', desc: 'Kendi küçük dünyan.' }

/** Odada duvarlardan ve mobilyalardan (dönmüş kutular: { x, z, hw, hd, ry }) çıkar. */
export function resolveRoom(x, z, colliders = []) {
  const m = PLAYER_RADIUS + 0.15
  x = Math.max(-HOME_ROOM.hw + m, Math.min(HOME_ROOM.hw - m, x))
  z = Math.max(-HOME_ROOM.hd + m, Math.min(HOME_ROOM.hd - 0.35, z))
  for (const c of colliders) {
    // noktayı kutunun yerel eksenine çevir, en yakın noktaya göre dışarı it, geri çevir
    const cos = Math.cos(c.ry)
    const sin = Math.sin(c.ry)
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
      // tam içindeyse en yakın kenara çık
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
