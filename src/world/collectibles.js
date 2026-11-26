// Toplanabilirler: şehre ve mekân içlerine dağılmış küçük pastel objeler + gizli hazine sandıkları.
// Saf veri: hem istemci (CollectiblesLayer.jsx, features/collect.jsx) hem sunucu (server/features/collect.js) okur.
// Konumlar: şehirde layout.js koordinatları, mekân içinde oda içi koordinatlar (orijin = oda merkezi, giriş +z).
// `room`: 'city' | 'venue:<id>' (ev odalarında toplanabilir yok).
// Her toplanabilir OYUNCU BAŞINA bağımsızdır: toplayınca o oyuncu için yeniden doğma süresi kadar kaybolur (`respawn`: 'half' = 12 sa, 'day' = ertesi Türkiye günü).
import { VENUES } from './venues.js'
import { BEACH, G, resolveCollisions } from './layout.js'
import { resolveVenueRoom, venueLayout } from './venueLayout.js'

export const COLLECT_RADIUS = 1.8 // m: sunucu denetimi (oyuncunun sunucudaki konumuna göre)
export const COLLECT_PROMPT = 1.55 // m: "Topla" istemi
export const GLINT_RADIUS = 8 // m: ışıltı parçacıkları
export const HIDDEN_GLINT = 6 // m: gizli sandık ipucu ışıltısı
export const HIDDEN_SHOW = 8 // m: gizli sandık ancak bu kadar yakındayken çizilir
export const DRAW_RADIUS = 34 // m: bundan uzaktakiler çizilmez
export const HALF_DAY_MS = 12 * 3600 * 1000

// model: public/models/collectibles/<id>.glb (en büyük boyut `size` metreye ölçeklenir), y: yerden yükseklik (süzülme ortası); ground: tabanı yere oturur, süzülmez
export const KINDS = {
  star: { id: 'star', emoji: '⭐', name: 'Yıldız Parçası', plural: 'Yıldız Parçaları', model: '/models/collectibles/star.glb', size: 0.62, y: 0.85, stars: 1, respawn: 'half', glow: '#ffe48f', series: { goal: 25, bonus: 5, name: 'Yıldız Avcısı' } },
  heart: { id: 'heart', emoji: '💗', name: 'Kalp Taşı', plural: 'Kalp Taşları', model: '/models/collectibles/heartstone.glb', size: 0.6, y: 0.8, stars: 2, respawn: 'day', glow: '#fec172', series: { goal: 10, bonus: 6, name: 'Kalp Koleksiyoncusu' } },
  flower: { id: 'flower', emoji: '🌸', name: 'Çiçek', plural: 'Çiçekler', model: '/models/collectibles/flower.glb', size: 0.7, y: 0, ground: true, stars: 1, respawn: 'half', glow: '#fed095', series: { goal: 30, bonus: 6, name: 'Çiçek Bahçıvanı' } },
  balloon: { id: 'balloon', emoji: '🎈', name: 'Balon', plural: 'Balonlar', model: '/models/collectibles/balloon.glb', size: 0.95, y: 1.45, stars: 1, respawn: 'half', glow: '#a9ddf5', series: { goal: 10, bonus: 5, name: 'Balon Ustası' } },
  shell: { id: 'shell', emoji: '🐚', name: 'Deniz Kabuğu', plural: 'Deniz Kabukları', model: '/models/collectibles/shell.glb', size: 0.5, y: 0.5, stars: 1, respawn: 'half', glow: '#ffd5bf', series: { goal: 10, bonus: 5, name: 'Kabuk Toplayıcı' } },
  chest: { id: 'chest', emoji: '🧰', name: 'Hazine Sandığı', plural: 'Hazine Sandıkları', model: '/models/collectibles/chest.glb', size: 0.9, y: 0, ground: true, stars: 5, respawn: 'day', glow: '#ffe48f', series: { goal: 5, bonus: 10, name: 'Hazine Avcısı' } },
}
export const KIND_ORDER = ['star', 'heart', 'flower', 'balloon', 'shell', 'chest']
export const HIDDEN_ALL_BONUS = 15 // tüm gizli sandıklar bulununca bir kerelik ⭐

const list = []
// Şehir konumları eski (v1) koordinatla yazıldı: harita genişleyince layout.js G() ile yeni haritaya oturur; plaj öğeleri yeni plaja göre ayrıca yerleştirilir.
const add = (kind, room, pts, extra) => pts.forEach(([x0, z0], i) => { const [x, z] = room === 'city' && !extra?.raw ? G(x0, z0) : [x0, z0]; list.push({ id: `${kind}:${room === 'city' ? 'c' : room.slice(6)}${extra?.tag ?? ''}${i}`, kind, x, z, room }) })

// ---------------------------------------------------------------- şehir
add('star', 'city', [[0, 16], [-5.5, 33], [5.5, 30], [-3, 22], [8, 36], [-2, -10], [4, -12], [-5, -29], [4.6, -34], [-5, -42], [4, -46], [20, -4.5], [34, 3.6], [44, -2], [24, 5], [-18.5, -3], [-30, 8.5], [-44, 4], [-8, 4.6], [17, 4.6], [36, 14], [-20, 14.6], [-35, 14.5], [30, -15]])
add('heart', 'city', [[-15.5, -34], [15.5, 33], [-33, -8], [11.5, -9.5], [-4.5, 40], [38, 5]])
add('flower', 'city', [[-16, -6], [-21, -9], [-26, 3.5], [-32, -9], [-38.5, 2], [-41, -6.5], [-26, 9], [-34, 4.2], [-17.5, 8], [-45, -3], [-14.5, 0.5], [-30, -4.7], [-8, -9.5], [8.5, 8], [-8, -4.8]])
add('balloon', 'city', [[0, -17], [0, -35], [-12.5, -22], [12.5, -33], [21, -2], [32, 0], [0, 25], [-10, 14], [10, -14], [-24, 0]])
// deniz kabukları: büyük plajın güney kıyısı boyunca (yarım daire) + kum meydanında birkaç tane
add('shell', 'city', [...Array.from({ length: 14 }, (_, i) => { const a = 0.35 + (i / 13) * (Math.PI - 0.7); return [+(BEACH.x + Math.cos(a) * 29).toFixed(1), +(BEACH.z + Math.sin(a) * 29).toFixed(1)] }), [-8, BEACH.z - 6], [6, BEACH.z + 8], [0, BEACH.z - 14]], { raw: true })
// gizli hazine sandıkları: hint = panelde görünen ipucu (yeri vermez, yönlendirir)
const HIDDEN = [
  { x: -15.5, z: -45, area: 'Kafe Sokağı', name: 'Sokağın sonundaki arka bahçe', hint: 'Kafe Sokağı’nın en ucunda, binaların arkasında bir şey parlıyor 🧰' },
  { x: -45, z: 2.8, area: 'Park', name: 'Yalnız ağacın dibi', hint: 'Parkın uzak ucunda, bir ağacın dibinde parıldıyor 🌳' },
  { x: -30, z: -4.7, area: 'Park', name: 'Çardağın arkası', hint: 'Parktaki çardağın çevresinde saklanmış bir hazine var 🌸' },
  { x: -30, z: BEACH.z + 22, area: 'Plaj', name: 'Sahilin ucu', hint: 'Plajın en uç köşesinde, dalgaların yanında parlıyor 🌊' },
  { x: 22.3, z: 19.2, area: 'Lobi arkası', name: 'Stüdyonun yan sokağı', hint: 'Fotoğraf Stüdyosu’nun yan sokağına bak 📸' },
  { x: 26, z: -16.5, area: 'Gece Kulübü', name: 'Kulübün arka kapısı', hint: 'Kulüp Babil’in arkasında bir ışıltı seçiliyor 🪩' },
  { x: -22.5, z: -16, area: 'Lobi arkası', name: 'Kuaför’ün yan duvarı', hint: 'Toni & Güy’ün yanındaki daracık geçitte parlıyor 💇' },
  { x: -34, z: 34, area: 'Güneybatı', name: 'Güneybatı mahallesi aralığı', hint: 'Güneybatı mahallesinin iki binası arasında bir yerde parlıyor 🏘️' },
  { x: 45, z: -45, area: 'Kuzeydoğu', name: 'Şehrin köşesi', hint: 'Kuzeydoğu köşesinde, haritanın en ucunda bir sandık gizleniyor 🗺️' },
  { x: 29, z: BEACH.z + 19, area: 'Plaj', name: 'Palmiyenin dibi', hint: 'Plajın doğu köşesinde palmiyelerin arasında parıldıyor 🌴' },
]
HIDDEN.forEach((h, i) => list.push({ id: `chest:${i}`, kind: 'chest', x: h.area === 'Plaj' ? h.x : G(h.x, h.z)[0], z: h.area === 'Plaj' ? h.z : G(h.x, h.z)[1], room: 'city', hidden: true, area: h.area, name: h.name, hint: h.hint }))

// ---------------------------------------------------------------- mekân içleri (her mekâna köşede 1 yıldız; bazılarına kalp taşı)
const VENUE_STAR = {
  rehber: [-5, 3.5], kuafor: [5, 3.6], foto: [-5, 3.6], tatli: [5, 3.7], kafe: [-5, 3.7], kitapkafe: [5, 3.7], firin: [-5, 3.6],
  cayevi: [-5.2, 3.6], kulup: [5.2, 3.6], bar: [5.2, 3.6], oyun: [-5.2, 3.7], fastfood: [5.2, 3.7], dondurma: [-5.2, 3.6], surf: [5.2, 3.6], plajbar: [5.2, 3.7],
}
for (const v of VENUES) if (VENUE_STAR[v.id]) add('star', `venue:${v.id}`, [VENUE_STAR[v.id]])
add('heart', 'venue:tatli', [[-5.2, 3.7]], { tag: 'h' })
add('heart', 'venue:kulup', [[-5.2, 3.7]], { tag: 'h' })
add('heart', 'venue:kitapkafe', [[-5.2, 3.7]], { tag: 'h' })
add('flower', 'venue:kafe', [[5.2, 3.7]], { tag: 'f' })
add('flower', 'venue:firin', [[5.2, 3.7]], { tag: 'f' })
add('shell', 'venue:surf', [[-5.2, 3.7]], { tag: 's' })

// konumları oyuncunun gerçekten durabileceği en yakın noktaya oturt (çarpışma/duvar payı)
for (const c of list) {
  const [x, z] = c.room === 'city' ? resolveCollisions(c.x, c.z) : resolveVenueRoom(c.x, c.z, venueLayout(c.room.slice(6)).colliders)
  c.x = +x.toFixed(2)
  c.z = +z.toFixed(2)
}
export const COLLECTIBLES = list
export const COLLECTIBLE_BY_ID = Object.fromEntries(list.map((c) => [c.id, c]))
export const HIDDEN_CHESTS = list.filter((c) => c.hidden)
const byRoom = {}
for (const c of list) (byRoom[c.room] ??= []).push(c)
export const collectiblesIn = (room) => byRoom[room] ?? []

/** Bu mekânın/şehrin odası için ipucu etiketi (panel). */
export const TOTAL_BY_KIND = Object.fromEntries(KIND_ORDER.map((k) => [k, list.filter((c) => c.kind === k).length]))

// ---- seviye (toplanan ⭐ toplamından): seviye L için gereken ⭐ = 3·(L-1)²  (2→3, 3→12, 4→27, 5→48 …)
export const xpForLevel = (l) => 3 * (l - 1) * (l - 1)
export function levelOf(xp) {
  const t = Math.max(0, xp | 0)
  const level = Math.floor(Math.sqrt(t / 3)) + 1
  const base = xpForLevel(level)
  const next = xpForLevel(level + 1)
  return { level, xp: t, base, next, into: t - base, span: next - base }
}
