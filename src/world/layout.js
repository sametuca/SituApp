// Şehir haritası verisi: yollar, mahalleler, binalar, süs nesneleri ve çarpışma alanları.
// Birim: metre. Orijin (0,0) = lobi meydanının merkezi. +x doğu, -z kuzey, +z güney.
// Sunucudaki WORLD_HALF (server/game.js) ile aynı olmalı.

import { VENUE_BY_LABEL } from './venues.js'

export const WORLD_HALF = 110
// Ada sınırları (m): çim bölgesi. Güneyde plaj + deniz kaldığı için ada kuzeye ve doğu/batıya uzar (dikdörtgen).
export const ISLAND = { x0: -100, x1: 100, z0: -100, z1: 50 }
export const RIM = 3.5 // kıyı kum şeridi genişliği
export const PLAY_BOUNDS = { x0: ISLAND.x0 - RIM + 1, x1: ISLAND.x1 + RIM - 1, z0: ISLAND.z0 - RIM + 1, z1: ISLAND.z1 + RIM - 1 }
export const PLAY_LIMIT = 102 // (eski ad) kabaca en uzak kenar
export const PIER = { x: 0, z0: 49.4, z1: 58.6, hw: 1.55, top: 0.37 }
// Üzerine çıkılabilen yükseltilmiş yüzeyler (ev bahçesi tarhları vb.; HomeGarden kayıt eder): { x, z, hw, hd, top }
export const SURFACES = []
export const groundY = (x, z) => {
  if (Math.abs(x - PIER.x) <= PIER.hw && z >= PIER.z0 && z <= PIER.z1) return PIER.top
  for (let i = 0; i < SURFACES.length; i++) {
    const s = SURFACES[i]
    if (Math.abs(x - s.x) <= s.hw && Math.abs(z - s.z) <= s.hd) return s.top
  }
  return 0
}
export const ROAD_HALF = 4.3 // yolların yarı genişliği (8,6 m asfalt + her yanda 1,4 m kaldırım)
// Meydan çevresinde dönel kavşak: çeşmeli meydan (PLAZA_R) → iç kaldırım → asfalt halka (RING.r0…r1) → dış kaldırım. Ana yollar halkaya bağlanır.
export const PLAZA_R = 8.4
export const RING = { r0: 9.2, r1: 15.2, side: 0.9 }
export const ROAD_START = 12 // ana yolların halkayla birleştiği uzaklık (halka şeridinin ortası)
export const ROAD_END = { north: -96, south: 28, east: 96 } // ana yolların uçları (batı: park patikası)

export const PALETTE = {
  pink: '#fed095',
  blue: '#b9e3ff',
  yellow: '#ffe9a8',
  mint: '#c4f0d8',
  lilac: '#dccfff',
  peach: '#ffd5bf',
}
const ROOF = { pink: '#fec172', blue: '#7fcdf3', yellow: '#ffd35e', mint: '#8fdcb4', lilac: '#b79cff', peach: '#ffb48c' }

// ---------- mahalleler ----------
export const ZONES = [
  { id: 'lobby', name: 'Lobi Meydanı', emoji: '⛲', desc: 'Herkesin buluşma noktası. Yollar buradan her yöne açılır.', shape: 'circle', x: 0, z: 0, r: 12, spawn: [0, 7] },
  { id: 'cafe', name: 'Kafe Sokağı', emoji: '☕', desc: 'Sakin, samimi sohbetler için.', shape: 'rect', x0: -14, x1: 14, z0: -48, z1: -12, spawn: [0, -22] },
  { id: 'club', name: 'Gece Kulübü', emoji: '🪩', desc: 'Müzik, dans ve enerji.', shape: 'rect', x0: 12, x1: 48, z0: -14, z1: 14, spawn: [24, 0] },
  { id: 'park', name: 'Park', emoji: '🌳', desc: 'Açık havada yürüyüş ve sohbet.', shape: 'rect', x0: -48, x1: -12, z0: -14, z1: 14, spawn: [-24, 0] },
  { id: 'beach', name: 'Plaj', emoji: '🏖️', desc: 'Gün batımı, deniz ve rahat sohbetler.', shape: 'rect', x0: -20, x1: 20, z0: 29, z1: 54, spawn: [0, 36] },
  // dış mahalleler (ada büyüdü): ana yolların uzantısı + geniş yeşil alanlar
  { id: 'north', name: 'Kuzey Caddesi', emoji: '🏙️', desc: 'Kafe Sokağı’nın devamı: sakin, geniş bir cadde.', shape: 'rect', x0: -14, x1: 14, z0: -100, z1: -48, spawn: [0, -72] },
  { id: 'eastend', name: 'Doğu Bulvarı', emoji: '🌆', desc: 'Kulüp caddesinin uzantısı.', shape: 'rect', x0: 48, x1: 100, z0: -14, z1: 14, spawn: [72, 0] },
  { id: 'meadow', name: 'Çiçek Bahçesi', emoji: '🌷', desc: 'Sonsuz çiçek tarlası: piknik ve sakin yürüyüş.', shape: 'rect', x0: -48, x1: -14, z0: -100, z1: -14, spawn: [-30, -58] },
  { id: 'forest', name: 'Orman Parkı', emoji: '🌲', desc: 'Yüksek ağaçlar, gölge ve patikalar.', shape: 'rect', x0: -100, x1: -48, z0: -100, z1: 50, spawn: [-72, -10] },
  { id: 'pond', name: 'Gölet', emoji: '🦆', desc: 'Küçük bir göletin kenarı.', shape: 'rect', x0: -48, x1: -14, z0: 14, z1: 50, spawn: [-30, 24] },
  { id: 'hills', name: 'Kuzeydoğu Mahallesi', emoji: '🏘️', desc: 'Sessiz sokaklar ve renkli evler.', shape: 'rect', x0: 14, x1: 100, z0: -100, z1: -14, spawn: [60, -56] },
  { id: 'harbor', name: 'Liman', emoji: '⚓', desc: 'Deniz kenarında yürüyüş yolu ve dükkânlar.', shape: 'rect', x0: 14, x1: 100, z0: 14, z1: 50, spawn: [60, 36] },
]
const FALLBACK_ZONE = { id: 'city', name: 'Şehir', emoji: '🏙️', desc: '' }

export function zoneAt(x, z) {
  for (const zn of ZONES) {
    if (zn.shape === 'circle' ? Math.hypot(x - zn.x, z - zn.z) <= zn.r : zn.shape === 'rects' ? zn.rects.some((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) : x >= zn.x0 && x <= zn.x1 && z >= zn.z0 && z <= zn.z1) return zn
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
  kuzey: 'north', north: 'north', dogu: 'eastend', 'doğu': 'eastend', cicek: 'meadow', 'çiçek': 'meadow', orman: 'forest', forest: 'forest',
  golet: 'pond', 'gölet': 'pond', mahalle: 'hills', hills: 'hills', liman: 'harbor', harbor: 'harbor',
}

export const SPAWN = { x: 0, z: 37 } // tüm oyuncular sahilde (plaj meydanında) başlar
export const BEACH = { x: 0, z: 37, r: 17 } // yuvarlak, sıcak plaj meydanı (adanın güneyinde; yol buraya açılır)
export const BEACH_START = { x: 0, z: 37, ry: Math.PI } // yeni hesap havalimanından çıkınca plajın tam ortasında doğar, kuzeye (şehre) bakar // yeni hesap havalimanından çıkınca kumsalda doğar, kuzeye (şehre) bakar

// ---------- binalar ----------
// facing: kapının baktığı yön ('n' = -z, 's' = +z, 'e' = +x, 'w' = -x)
// venue: girilebilen mekân kimliği (venues.js; etiket birebir eşleşir). Kapı konumu: venueDoors.js
const b = (x, z, w, d, h, color, facing, label, extra = {}) => ({ x, z, w, d, h, color: PALETTE[color], roof: ROOF[color], facing, label, venue: VENUE_BY_LABEL[label]?.id, ...extra })

export const BUILDINGS = [
  // lobi meydanındaki dört önemli yapı
  b(17.4, -18, 7.6, 8, 6, 'blue', 's', '🧭 Tripadvisör'),
  b(-17, -17, 8, 8, 6, 'pink', 's', '💇 Toni & Güy'),
  b(17, 17, 8, 8, 6, 'lilac', 's', '📸 Kodakk Foto'),
  b(-17, 17, 8, 8, 6, 'peach', 'n', '🍰 Hafız Mustafam'),

  // Kafe Sokağı (kuzey)
  b(-9.7, -18, 6, 7, 5, 'yellow', 'e', '☕ Starbucket', { shop: true }),
  b(9.7, -18, 6, 7, 5, 'mint', 'w', '📚 D&Rüya', { shop: true }),
  b(-9.7, -27, 6, 8, 6, 'pink', 'e', '🥐 Simit Sarayım', { shop: true }),
  b(9.7, -27, 6, 8, 5, 'blue', 'w', '🍵 Çaykurt', { shop: true }),
  b(-9.7, -36, 6, 8, 7, 'lilac', 'e'),
  b(9.7, -36, 6, 8, 6, 'peach', 'w'),
  b(-9.7, -44, 6, 7, 5, 'mint', 'e'),
  b(9.7, -44, 6, 7, 7, 'yellow', 'w'),

  // Gece Kulübü (doğu)
  b(26, -9.7, 14, 8, 7, 'lilac', 's', '🪩 Kulüp Babil', { neon: true }),
  b(41.5, -9.7, 7, 8, 6, 'pink', 's', '🍹 Hard Rök', { shop: true }),
  b(19, 9.7, 7, 6, 5, 'blue', 'n', '🎮 Playstasyon', { shop: true }),
  b(30, 9.7, 8, 6, 6, 'yellow', 'n', '🍔 Burger Kral', { shop: true }),
  b(41, 9.7, 7, 6, 5, 'mint', 'n'),

  // Plaj Yolu (güney)
  b(-9.7, 19, 6, 7, 5, 'blue', 'e', '🍦 Baskın Robin', { shop: true }),
  b(9.7, 19, 6, 7, 5, 'pink', 'w', '🏄 Quicksörf', { shop: true }),
  b(-9.7, 27, 6, 7, 4, 'yellow', 'e', '🥤 Kokabana'),
  b(9.7, 27, 6, 7, 4, 'mint', 'w'),

  // Kuzeydoğu mahallesi
  b(28, -26, 10, 10, 11, 'pink', 's'),
  b(41, -26, 8, 10, 9, 'blue', 's'),
  b(28, -41, 10, 8, 8, 'mint', 'w'),
  b(41, -41, 8, 8, 12, 'lilac', 'w'),
  // Kuzeybatı/güneybatı bloklar boş: evler şehirde değil, herkesin kendi bağımsız odasında (homeTiers.js). Konut Mahallesi modülü kapalı.
  // Güneydoğu mahallesi
  b(28, 26, 10, 10, 8, 'lilac', 'n'),
  b(41, 26, 8, 10, 10, 'mint', 'n'),
  b(28, 41, 10, 8, 11, 'peach', 'n'),
  b(41, 41, 8, 8, 9, 'yellow', 'n'),

  // Herkesin kendi evine girdiği kapı (lobi meydanının güneybatısı)
  b(-9, 10, 5, 5, 4.6, 'mint', 'e', '🏠 Evim', { homeDoor: true }),

  // Park çardağı
  { x: -30, z: 0, gazebo: true },
]
// ---------- dış mahalleler: seçilmiş tohumla (sunucu ve istemci aynı sonucu görür) üretilen binalar ----------
let seed = 1987654
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
const rpick = (a) => a[Math.floor(rnd() * a.length)]
const COLORS = ['pink', 'blue', 'yellow', 'mint', 'lilac', 'peach']
// Kuzey Caddesi (Kafe Sokağı'nın devamı)
for (let i = 0; i < 5; i++) {
  const z = -56 - i * 9
  BUILDINGS.push(b(-9.7, z, 6, 6 + Math.floor(rnd() * 3), 5 + Math.floor(rnd() * 4), rpick(COLORS), 'e'), b(9.7, z, 6, 6 + Math.floor(rnd() * 3), 5 + Math.floor(rnd() * 4), rpick(COLORS), 'w'))
}
// Doğu Bulvarı (kulüp caddesinin devamı)
for (let i = 0; i < 5; i++) {
  const x = 56 + i * 9
  BUILDINGS.push(b(x, -9.7, 7, 8, 5 + Math.floor(rnd() * 3), rpick(COLORS), 's'), b(x, 9.7, 7, 6 + Math.floor(rnd() * 2), 5 + Math.floor(rnd() * 3), rpick(COLORS), 'n'))
}
// Kuzeydoğu Mahallesi: ev sıraları
for (const z of [-30, -44, -58, -72, -86]) for (const x of [62, 76, 90]) BUILDINGS.push(b(x, z, 7 + Math.floor(rnd() * 3), 7, 5 + Math.floor(rnd() * 5), rpick(COLORS), 's'))
// Liman: kıyı dükkânları
for (const x of [60, 72, 84, 96 - 2]) BUILDINGS.push(b(x, 24, 8, 6, 5 + Math.floor(rnd() * 3), rpick(COLORS), 'n', undefined, { shop: true }))

export const GAZEBO = { x: -30, z: 0, r: 3.2 }

// ---------- süs nesneleri (GLB) ----------
// model: public/models altındaki dosya; scale: 1 birimlik normalize edilmiş boyuta çarpan; r: çarpışma yarıçapı (0 = yok)
const M = {
  table: '/models/cafe/cafe-table.glb',
  chair: '/models/cafe/cafe-chair.glb',
  plant: '/models/cafe/cafe-plant.glb',
  bench: '/models/park/park-bench.glb',
  fountain: '/models/lobby/fountain.glb',
  tree: '/models/park/park-tree.glb',
  lamp: '/models/park/park-lamp.glb',
  ball: '/models/club/club-ball.glb',
  speaker: '/models/club/club-speaker.glb',
  booth: '/models/club/club-booth.glb',
  umbrella: '/models/beach/beach-umbrella.glb',
  lounger: '/models/beach/beach-lounger.glb',
  palm: '/models/beach/beach-palm.glb',
  lifeguard: '/models/beach/lifeguard.glb',
  volleyball: '/models/beach/volleyball.glb',
  sandcastle: '/models/beach/sandcastle.glb',
  plane: '/models/airport/toy-plane.glb',
  flowerbed: '/models/neighborhood/garden-flowerbed.glb',
  cafetable: '/models/cafe/cafe-table.glb',
  cafechair: '/models/cafe/cafe-chair.glb',
}
const p = (model, x, z, scale, r = 0, ry = 0) => ({ model: M[model], x, z, scale, r, ry })

export const PROPS = []
// sokak lambaları: ana yolların kaldırım şeridinde (ROAD_HALF + 0,75), çiftler karşılıklı simetrik, 10 m arayla
const LAMP = ROAD_HALF + 0.75
// mekan kapılarının tam önüne gelen lambaları kapıdan uzağa kaydır (bar, fastfood, dondurma, surf)
for (let t = 20; t <= 90; t += 10) {
  PROPS.push(p('lamp', LAMP, -t, 3, 0.35), p('lamp', -LAMP, -t, 3, 0.35)) // kuzey uzantısı
  const eSouth = t === 30 ? 25.5 : t // Burger Kral kapısından (x=31.6) uzak
  const eNorth = t === 40 ? 35.5 : t // Hard Rök kapısından (x=40.45) uzak
  PROPS.push(p('lamp', eSouth, LAMP, 3, 0.35), p('lamp', eNorth, -LAMP, 3, 0.35)) // doğu uzantısı
  if (t <= 20) PROPS.push(p('lamp', LAMP, 23.2, 3, 0.35), p('lamp', -LAMP, 23.2, 3, 0.35)) // güney: Baskın Robin & Quicksörf kapılarından uzak
}
// dönel kavşak lambaları: halkanın dış kaldırımında, yol bağlantılarından ve Evim binasından uzakta
for (const a of [Math.PI / 4, (3 * Math.PI) / 4 + 0.38, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) PROPS.push(p('lamp', Math.cos(a) * 15.8, Math.sin(a) * 15.8, 3, 0.35))
// lobi: çeşmenin çevresinde banklar ve ağaçlar
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2 + Math.PI / 6
  PROPS.push(p('bench', Math.cos(a) * 7.2, Math.sin(a) * 7.2, 1.7, 0, -a - Math.PI / 2))
}
PROPS.push(p('fountain', 0, 0, 5.4))
for (const [fx, fz] of [[3.5, 3.5], [-3.5, 3.5], [3.5, -3.5], [-3.5, -3.5]]) PROPS.push(p('flowerbed', fx, fz, 1.5))
PROPS.push(p('tree', 5.2, 5.2, 3.0, 0.7), p('tree', 5.2, -5.2, 3.0, 0.7), p('tree', -5.2, -5.2, 3.0, 0.7))
// kafe sokağı: kaldırımda bitkiler ve açık hava kafe masaları (mekân kapılarından ve lambalardan uzak, bina aralarında)
for (const side of [-1, 1]) {
  for (const z of [-13.4, -31.2, -41.5]) PROPS.push(p('plant', side * 5.05, z, 1.4, 0.4))
  PROPS.push(p('cafetable', side * 5.1, -22.2, 1.1, 0.45), p('cafechair', side * 5.1, -21.3, 1.0, 0, Math.PI))
  PROPS.push(p('cafetable', side * 5.1, -33.2, 1.1, 0.45), p('cafechair', side * 5.1, -32.3, 1.0, 0, Math.PI))
}
// gece kulübü: girişin önünde hoparlörler (sokak lambalarından uzak; DJ standı içeride)
PROPS.push(p('speaker', 21.8, -5.1, 2, 0.6), p('speaker', 31.6, -5.1, 2, 0.6))
PROPS.push(p('speaker', 38, 5.3, 1.8, 0.5))
// park: ağaçlar, banklar
for (const [x, z] of [[-18, -9], [-24, -10], [-36, -10], [-44, -8], [-20, 9], [-26, 10], [-37, 9], [-44, 6], [-42, -1], [-16, 7]]) PROPS.push(p('tree', x, z, 3.6, 0.7))
PROPS.push(p('bench', -22, -5, 1.7, 0, 0), p('bench', -22, 5, 1.7, 0, Math.PI), p('bench', -36, -5, 1.7, 0, 0), p('bench', -36, 5, 1.7, 0, Math.PI))
// park patikası (x -15…-26, z ±1,6): lambalar patikanın iki yanında, aynı hizada
for (const x of [-19.5, -24.5]) PROPS.push(p('lamp', x, 2.6, 3, 0.35), p('lamp', x, -2.6, 3, 0.35))
// plaj meydanı (yuvarlak): şemsiyeli şezlong çiftleri halka hâlinde merkeze bakar; ortada serbest meydan, kıyıda palmiyeler
{
  const R = 11.5
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    const px = BEACH.x + Math.cos(a) * R
    const pz = BEACH.z + Math.sin(a) * R
    if (pz < 30.5 && Math.abs(px) < 6) continue // yol girişi açık kalsın
    const ry = Math.atan2(BEACH.x - px, BEACH.z - pz) // merkeze bak
    const nx = Math.cos(ry)
    const nz = -Math.sin(ry) // yan yana duran iki şezlong için yan eksen
    PROPS.push(p('umbrella', px + Math.sin(ry) * -1.6, pz + Math.cos(ry) * -1.6, 2.6, 0.3))
    PROPS.push(p('lounger', px + nx * 0.8, pz + nz * 0.8, 1.7, 0, ry), p('lounger', px - nx * 0.8, pz - nz * 0.8, 1.7, 0, ry))
  }
  for (const a of [-2.75, -0.4, 0.72, 2.22, 2.52]) PROPS.push(p('palm', BEACH.x + Math.cos(a) * 16.2, BEACH.z + Math.sin(a) * 13.5, 4.6, 0.5))
}
// plaj ortamı (yeni oyuncuların doğduğu yer): cankurtaran kulesi, voleybol, kum kaleleri, havalimanı terminali + park etmiş uçak
PROPS.push(p('lifeguard', -15.2, 44, 3.4, 1.0, 0.5), p('volleyball', 5.5, 37, 4.6, 0, Math.PI / 2), p('sandcastle', -7.8, 44.6, 1.5, 0.5), p('sandcastle', 8.4, 45.2, 1.2, 0.4, 0.8))
BUILDINGS.push(b(-23, 44, 10, 7, 6, 'blue', 's', '🛬 Terminal'))
PROPS.push(p('plane', -23, 49.4, 4.4, 1.4, 0.3))
// plaj havluları (yere serili küçük renkli dikdörtgenler; City.jsx çizer)
export const TOWELS = [
  { x: -3.2, z: 35.4, ry: 0.2, c: '#ffd35e' }, { x: -8.8, z: 35.2, ry: -0.3, c: '#7fcdf3' }, { x: -1, z: 40.6, ry: 0.1, c: '#b79cff' },
  { x: -3.8, z: 43.2, ry: 0.4, c: '#8fdcb4' }, { x: -6, z: 39.5, ry: -0.5, c: '#ffb48c' },
]
// mahalle köşelerinde ağaçlar
for (const [x, z] of [[17, -33], [17, 33], [47 - 2, 14]]) PROPS.push(p('tree', x, z, 3.6, 0.7))

// dış alanlar: orman, çiçek bahçesi, gölet kıyısı, liman (tohumlu, yollardan ve binalardan uzak)
const nearRoad = (x, z) => Math.abs(x) < ROAD_HALF + 2.5 || (x > -12 && Math.abs(z) < ROAD_HALF + 2.5) || (x <= -12 && x >= -28 && Math.abs(z) < 4)
const hitsBuilding = (x, z, pad = 2.2) => BUILDINGS.some((bd) => {
  if (bd.gazebo) return Math.hypot(x - bd.x, z - bd.z) < 6
  const side = bd.facing === 'e' || bd.facing === 'w'
  return Math.abs(x - bd.x) < (side ? bd.d : bd.w) / 2 + pad && Math.abs(z - bd.z) < (side ? bd.w : bd.d) / 2 + pad
})
const free = (x, z, list, minD) => !nearRoad(x, z) && !hitsBuilding(x, z) && !list.some((q) => Math.hypot(q.x - x, q.z - z) < minD)
function scatterProps(model, rect, n, scale, r, minD) {
  const placed = []
  for (let i = 0; i < n * 40 && placed.length < n; i++) {
    const x = rect.x0 + rnd() * (rect.x1 - rect.x0)
    const z = rect.z0 + rnd() * (rect.z1 - rect.z0)
    if (!free(x, z, [...placed, ...PROPS], minD)) continue
    placed.push({ x, z })
    PROPS.push(p(model, x, z, scale * (0.85 + rnd() * 0.35), r, rnd() * 6.28))
  }
}
// dış alan bankları ağaç dağıtımından önce eklenir ki ağaçlar bankların üstüne düşmesin
for (const [x, z] of [[-30, -40], [-26, -70], [-40, -84], [-72, 0], [-80, -30], [-64, 20], [66, 34], [86, 36], [-24, 28], [-36, 26]]) PROPS.push(p('bench', x, z, 1.7, 0, (x * 7) % 6))
scatterProps('tree', { x0: -98, x1: -50, z0: -98, z1: 48 }, 70, 3.6, 0.7, 5) // Orman Parkı
scatterProps('tree', { x0: -46, x1: -16, z0: -98, z1: -16 }, 26, 3.5, 0.7, 7) // Çiçek Bahçesi
scatterProps('tree', { x0: -46, x1: -16, z0: 16, z1: 48 }, 12, 3.5, 0.7, 7) // Gölet çevresi
scatterProps('tree', { x0: 16, x1: 98, z0: -98, z1: -16 }, 22, 3.5, 0.7, 8) // Kuzeydoğu
scatterProps('palm', { x0: 16, x1: 98, z0: 36, z1: 48 }, 10, 4.6, 0.5, 8) // Liman palmiyeleri

// ---------- oturma noktaları (birlikte yapılan şeyler: server/features/together.js de okur) ----------
// Banklar 2, şezlonglar ve sandalyeler 1 kişilik. face: oturanın bakışı = prop.ry + face (modelin önü).
// along: oturma yerlerinin dizildiği eksen (prop yerel X ya da Z), gap: iki kişi arası.
const SEAT_DEFS = {
  [M.bench]: { kind: 'bench', cap: 2, gap: 0.46, face: 0, along: 'x' },
  [M.lounger]: { kind: 'lounger', cap: 1, gap: 0, face: 0, along: 'z' },
  [M.chair]: { kind: 'chair', cap: 1, gap: 0, face: 0, along: 'x' },
}
// Park piknik battaniyeleri (procedural, City.jsx çizer): 2 kişilik, yere oturulur (style 'floor').
export const BLANKETS = [
  { x: -21, z: -7.5, ry: 0.2, c: '#fec172', c2: '#fff8f0' },
  { x: -40, z: -4.5, ry: -0.5, c: '#7fcdf3', c2: '#fff8f0' },
  { x: -33, z: 7.6, ry: 0.4, c: '#ffd35e', c2: '#fff7dc' },
  { x: -28, z: -7.6, ry: -0.2, c: '#8fdcb4', c2: '#f3fff8' },
]
const slotsOf = (x, z, ry, d) => {
  const ax = d.along === 'x' ? [Math.cos(ry), -Math.sin(ry)] : [Math.sin(ry), Math.cos(ry)]
  return Array.from({ length: d.cap }, (_, k) => {
    const o = (k - (d.cap - 1) / 2) * d.gap
    return { x: +(x + ax[0] * o).toFixed(2), z: +(z + ax[1] * o).toFixed(2) }
  })
}
const SEATS_PROPS = PROPS.flatMap((pr, i) => {
  const d = SEAT_DEFS[pr.model]
  if (!d) return []
  return [{ id: `s${i}`, kind: d.kind, x: pr.x, z: pr.z, ry: pr.ry + d.face, slots: slotsOf(pr.x, pr.z, pr.ry, d) }]
})
const SEATS_BLANKET = BLANKETS.map((bl, i) => ({ id: `bl${i}`, kind: 'blanket', style: 'floor', x: bl.x, z: bl.z, ry: bl.ry, slots: slotsOf(bl.x, bl.z, bl.ry, { cap: 2, gap: 1.2, along: 'x' }) }))
const SEATS_TOWEL = TOWELS.map((tw, i) => ({ id: `tw${i}`, kind: 'towel', style: 'lounger', x: tw.x, z: tw.z, ry: tw.ry, slots: [{ x: tw.x, z: tw.z }] }))
// yan yana şezlonglar tek "grup": biri diğerinin yanına uzanınca sohbet kısayolu çıkar (sunucu da bunu okur)
const loungers = SEATS_PROPS.filter((s) => s.kind === 'lounger')
loungers.forEach((a, i) => {
  loungers.slice(i + 1).forEach((c) => {
    if (Math.hypot(a.x - c.x, a.z - c.z) < 3.2) a.group = c.group = a.group ?? c.group ?? `lg${i}`
  })
})
export const SEATS = [...SEATS_PROPS, ...SEATS_BLANKET, ...SEATS_TOWEL]
export const SEAT_LABEL = { bench: 'Banka otur', lounger: 'Şezlonga uzan', towel: 'Havluya uzan', chair: 'Sandalyeye otur', blanket: 'Battaniyeye otur', table: 'Masaya otur', stool: 'Taburede otur', sofa: 'Kanepeye otur' }

// Fotoğraf Stüdyosu'nun (lobi, güneydoğu; kapısı güneye bakar) kapı önü: "Fotoğraf çek" istemi burada çıkar.
export const PHOTO_SPOT = { x: 17, z: 27.4, radius: 2.7 }

// ---------- çarpışma alanları ----------
export const COLLIDERS = [
  { type: 'circle', x: 0, z: 0, r: 2.6 }, // çeşme
  { type: 'circle', x: GAZEBO.x, z: GAZEBO.z, r: GAZEBO.r }, // çardak
  { type: 'circle', x: -36, z: 12.5, r: 0.01 },
  // e/w yönüne bakan binalar 90° döner: genişlik z, derinlik x ekseninde
  ...BUILDINGS.filter((bd) => !bd.gazebo).map((bd) => {
    const side = bd.facing === 'e' || bd.facing === 'w'
    return { type: 'box', x: bd.x, z: bd.z, hw: (side ? bd.d : bd.w) / 2 + 0.15, hd: (side ? bd.w : bd.d) / 2 + 0.15 }
  }),
  ...PROPS.filter((pr) => pr.r > 0).map((pr) => ({ type: 'circle', x: pr.x, z: pr.z, r: pr.r })),
  { type: 'box', x: -25, z: 14, hw: 1.5, hd: 1.85 }, // Posta Merkezi (jobsData.js POST_CENTER; doğuya bakar)
]

export const PLAYER_RADIUS = 0.4

/** (x,z) konumunu çarpışmalardan ve dünya sınırından çıkarır (iskele uzantısı dahil). */
export function resolveCollisions(x, z) {
  x = Math.max(PLAY_BOUNDS.x0, Math.min(PLAY_BOUNDS.x1, x))
  const inPierLane = Math.abs(x - PIER.x) <= PIER.hw - 0.2 && z > PLAY_BOUNDS.z1 - 0.8
  if (inPierLane) {
    x = Math.max(PIER.x - PIER.hw + 0.3, Math.min(PIER.x + PIER.hw - 0.3, x))
    z = Math.max(PLAY_BOUNDS.z0, Math.min(PIER.z1 - 0.3, z))
  } else {
    z = Math.max(PLAY_BOUNDS.z0, Math.min(PLAY_BOUNDS.z1, z))
  }
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

// Rehber NPC: plajdan ana sokağa girişte (sokağın başında, oyuncuyu karşılar)
export const GUIDE = { x: -3.8, z: 30.2, ry: 0.3, avatar: 'mira', name: 'Rehber', radius: 5 }

// ---------- ev kapısı ve iç mekan ----------
// Kapının önündeki nokta (şehirde): buraya gelince "Eve gir" çıkar, dışarı çıkınca buraya dönülür.
export const HOME_DOOR = { x: -5.4, z: 10, radius: 2.6 }

// Ev odası: orijin = oda merkezi; giriş kapısı güney duvarında (+z). Şehir çizilmez, aynı koordinat sistemi.
export const HOME_ROOM = {
  hw: 5, // yarı genişlik (x)
  hd: 4.5, // yarı derinlik (z)
  wallH: 3.4,
  gardenW: 6.9, // bahçe genişliği (arazi kademesine göre büyür)
  spawn: [0, 3.0], // girince doğduğun nokta
  exit: { x: 0, z: 3.7, radius: 1.6 }, // kapının önü: "Dışarı çık"
}
export const HOME_ZONE = { id: 'home', name: 'Evim', emoji: '🏠', desc: 'Kendi küçük dünyan.' }

/** Odada duvarlardan ve mobilyalardan (dönmüş kutular: { x, z, hw, hd, ry }) çıkar. */
export function resolveRoom(x, z, colliders = []) {
  const m = PLAYER_RADIUS + 0.15
  const prevX = x
  const maxX = HOME_ROOM.hw + (HOME_ROOM.gardenW ?? 6.9) - 0.35
  x = Math.max(-HOME_ROOM.hw + m, Math.min(maxX, x))
  z = Math.max(-HOME_ROOM.hd + m, Math.min(HOME_ROOM.hd - 0.35, z))
  // doğu duvarı (x = hw): bahçe kapısı (|z| < 1.1) dışındaki bölümlerde çarpışma
  if (Math.abs(z) >= 1.1 && Math.abs(x - HOME_ROOM.hw) < m) {
    x = prevX <= HOME_ROOM.hw ? HOME_ROOM.hw - m : HOME_ROOM.hw + m
  }
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
