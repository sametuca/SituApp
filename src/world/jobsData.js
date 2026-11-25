// Meslekler: ortak veri (istemci + sunucu aynı dosyayı okur; saf JS, tarayıcı/Node bağımsız).
// Üç meslek: Bahçıvan (ev bahçesinde ek-biç-sat), Balıkçı (kıyıda olta), Postacı (Posta Merkezi → mekânlara kargo).
import { CROPS } from './homeGarden.js'

export const JOB_IDS = ['gardener', 'fisher', 'postman']
export const MAX_JOB_LEVEL = 10
export const SWITCH_COST = 100 // meslek değiştirme ücreti (ilk seçim ücretsiz)
export const SWITCH_COOLDOWN_MS = 6 * 3600 * 1000
export const BAG_MAX = 99 // her üründen çantada en çok

/** Seviye için gereken toplam XP: 25·(L-1)². */
export const xpForLevel = (l) => 25 * (l - 1) ** 2
export function jobLevel(xp = 0) {
  let level = 1
  while (level < MAX_JOB_LEVEL && xp >= xpForLevel(level + 1)) level++
  const base = xpForLevel(level)
  const next = level >= MAX_JOB_LEVEL ? null : xpForLevel(level + 1)
  return { level, xp, base, next, into: xp - base, need: next == null ? 0 : next - base, max: level >= MAX_JOB_LEVEL }
}

export const JOBS = {
  gardener: {
    id: 'gardener',
    name: 'Bahçıvan',
    emoji: '🌱',
    color: '#8fd9a0',
    deep: '#2f7a55',
    tag: 'Ek, biç, sat',
    desc: 'Evindeki bahçeye tohum ek, sula, olgunlaşınca hasat et ve ürünlerini pazara sat. Bahçıvan olmadan tohum ekilemez.',
    perks: ['Satış fiyatı her seviyede +%6', 'Hasatta çifte ürün şansı (seviye başına +%5)', 'Günlük bahçe görevleri'],
  },
  fisher: {
    id: 'fisher',
    name: 'Balıkçı',
    emoji: '🎣',
    color: '#8fc9f2',
    deep: '#2a6a9c',
    tag: 'Olta at, sabırla bekle',
    desc: 'Adanın güney kıyısındaki balıkçı iskelelerinden olta at. Balık vurunca zamanında çek, nadir balıkları yakala ve pazara sat.',
    perks: ['Balık daha çabuk vurur (her seviyede)', 'Çekme süresi uzar, nadir balık şansı artar', 'Satış fiyatı her seviyede +%6'],
  },
  postman: {
    id: 'postman',
    name: 'Postacı',
    emoji: '📮',
    color: '#ffc98f',
    deep: '#a35a14',
    tag: 'Kargo al, kapıya götür',
    desc: 'Parktaki Posta Merkezi’nden kargo al, mekânlara teslim et. Ekspres teslimat ekstra kazandırır, bisikletle daha da hızlısın.',
    perks: ['Aynı anda taşınan kargo sayısı artar', 'Teslimat kazancı her seviyede +%6', 'Bisikletle teslimatta +%20 bonus'],
  },
}

/** Seviye etkileri (sunucu ve istemci aynı tabloyu kullanır). */
export const PERK = {
  sell: (l) => 1 + 0.06 * (l - 1),
  double: (l) => 0.05 * (l - 1), // hasatta çifte ürün olasılığı
  wait: (l) => 1 - 0.05 * (l - 1), // balık bekleme süresi çarpanı
  window: (l) => 1500 + 80 * (l - 1), // ms
  luck: (l) => 1 + 0.18 * (l - 1), // nadir balık ağırlık çarpanı
  cap: (l) => 2 + Math.ceil(l / 3), // taşınan kargo
  pay: (l) => 1 + 0.06 * (l - 1),
}

// ---------- ürünler ve balıklar ----------
export const CROP_PRICE = Object.fromEntries(CROPS.map((c) => [c.id, c.coins]))
export const RARITY = {
  common: { name: 'Yaygın', color: '#8a7a9c' },
  uncommon: { name: 'Nadir değil', color: '#2f9a6a' },
  rare: { name: 'Nadir', color: '#3b7fd9' },
  epic: { name: 'Çok nadir', color: '#8d5fe0' },
  legend: { name: 'Efsane', color: '#e8952c' },
}
// w: seçilme ağırlığı, lv: gereken seviye, size: 3B boyutu (m), body/fin: modelin rengi
export const FISH = [
  { id: 'hamsi', name: 'Hamsi', emoji: '🐟', rar: 'common', w: 40, lv: 1, price: 6, xp: 3, size: 0.26, body: '#a9d2ff', fin: '#7fb2ee' },
  { id: 'sardalya', name: 'Sardalya', emoji: '🐟', rar: 'common', w: 34, lv: 1, price: 7, xp: 3, size: 0.3, body: '#b9c8e6', fin: '#8da3cf' },
  { id: 'istavrit', name: 'İstavrit', emoji: '🐟', rar: 'common', w: 28, lv: 1, price: 9, xp: 4, size: 0.34, body: '#9fe0c9', fin: '#6fc6a6' },
  { id: 'cipura', name: 'Çipura', emoji: '🐠', rar: 'uncommon', w: 18, lv: 1, price: 15, xp: 6, size: 0.4, body: '#ffd7a0', fin: '#f3b36a' },
  { id: 'levrek', name: 'Levrek', emoji: '🐟', rar: 'uncommon', w: 14, lv: 1, price: 18, xp: 7, size: 0.46, body: '#d6dcf0', fin: '#a9b3dd' },
  { id: 'palamut', name: 'Palamut', emoji: '🐟', rar: 'uncommon', w: 10, lv: 2, price: 22, xp: 9, size: 0.5, body: '#9cc4f5', fin: '#6d9fe0' },
  { id: 'lufer', name: 'Lüfer', emoji: '🐟', rar: 'rare', w: 8, lv: 3, price: 28, xp: 12, size: 0.54, body: '#a6d6e8', fin: '#72b6d4' },
  { id: 'balon', name: 'Balon Balığı', emoji: '🐡', rar: 'rare', w: 6, lv: 3, price: 34, xp: 14, size: 0.4, body: '#ffe48f', fin: '#f0c95a' },
  { id: 'ahtapot', name: 'Ahtapot', emoji: '🐙', rar: 'epic', w: 3, lv: 4, price: 55, xp: 22, size: 0.46, body: '#d7b8ff', fin: '#b48cf0' },
  { id: 'kilic', name: 'Kılıç Balığı', emoji: '🐟', rar: 'epic', w: 2, lv: 5, price: 70, xp: 28, size: 0.7, body: '#b5c9ff', fin: '#8fa6f0' },
  { id: 'altin', name: 'Altın Balık', emoji: '🐠', rar: 'legend', w: 0.7, lv: 6, price: 160, xp: 40, size: 0.5, body: '#ffd34d', fin: '#ffae2b' },
  { id: 'inci', name: 'İnci Kabuk', emoji: '🐚', rar: 'rare', w: 1.2, lv: 3, price: 40, xp: 16, size: 0.3, body: '#ffe9ef', fin: '#f6c9d8', junk: true },
  { id: 'cizme', name: 'Eski Çizme', emoji: '🥾', rar: 'common', w: 9, lv: 1, price: 2, xp: 1, size: 0.34, body: '#c9a27a', fin: '#a07d58', junk: true },
  { id: 'yosun', name: 'Yosun Demeti', emoji: '🌿', rar: 'common', w: 8, lv: 1, price: 2, xp: 1, size: 0.34, body: '#8fd9a0', fin: '#5fb878', junk: true },
]
export const FISH_BY_ID = Object.fromEntries(FISH.map((f) => [f.id, f]))
export const CROP_META = Object.fromEntries(CROPS.map((c) => [c.id, c]))

/** Balıkçı noktaları: güney kıyısındaki iskeleler (oyuncu +z yönünde denize bakar). */
export const FISH_SPOTS = [-60, -45, -31, 31, 46, 60].map((x, i) => ({ id: `fs${i}`, x, z: 51.4, ry: 0, radius: 2.6 }))
export const FISH_CAST_DIST = 5.2 // can şamandırası oyuncunun +z yönünde bu kadar uzağa düşer

/** Posta Merkezi (parkın şehir tarafında) ve kargo türleri. */
export const POST_CENTER = { x: -25, z: 14, ry: Math.PI / 2, radius: 4.4 }
export const PARCEL_KINDS = [
  { id: 'letter', emoji: '✉️', name: 'Mektup', pay: 0, color: '#fff6e0' },
  { id: 'box', emoji: '📦', name: 'Paket', pay: 4, color: '#e8c99a' },
  { id: 'flower', emoji: '💐', name: 'Çiçek', pay: 6, color: '#ffd0e0' },
  { id: 'gift', emoji: '🎁', name: 'Hediye', pay: 8, color: '#cdbbff' },
]
export const PARCEL_FROM = ['Ayşe', 'Mehmet', 'Defne', 'Can', 'Selin', 'Kerem', 'Ece', 'Burak', 'Naz', 'Tuna', 'Pınar', 'Arda']
export const PARCEL_DELIVER_R = 3.8 // teslim için kapı noktasına en çok uzaklık (m)
export const SPEED_LIMIT = 13 // m/sn: bundan hızlı teslimat imkânsız (sunucu kontrolü)

/** Ürün/balık günlük pazar çarpanı: 0.85…1.35 (gün + kimlikten deterministik). */
export function marketMult(day, id) {
  let h = 2166136261
  for (const c of `${day}|${id}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return Math.round((0.85 + ((h >>> 0) % 1000) / 2000) * 20) / 20
}

// ---------- günlük meslek görevleri ----------
// ev: sunucunun yolladığı olay; goal aralığı gün+kimlikten seçilir
export const QUEST_TEMPLATES = {
  gardener: [
    { id: 'plant', ev: 'plant', text: (n) => `${n} tohum ek`, min: 3, max: 6, coins: 14, xp: 8 },
    { id: 'water', ev: 'water', text: (n) => `${n} tarhı sula`, min: 3, max: 6, coins: 12, xp: 8 },
    { id: 'harvest', ev: 'harvest', text: (n) => `${n} ürün hasat et`, min: 4, max: 8, coins: 20, xp: 14 },
    { id: 'sell', ev: 'sell', text: (n) => `${n} ürün sat`, min: 4, max: 8, coins: 16, xp: 10 },
  ],
  fisher: [
    { id: 'catch', ev: 'catch', text: (n) => `${n} balık yakala`, min: 3, max: 6, coins: 18, xp: 10 },
    { id: 'rare', ev: 'catch_rare', text: (n) => `${n} nadir balık yakala`, min: 1, max: 2, coins: 28, xp: 18 },
    { id: 'sellf', ev: 'sell', text: (n) => `${n} balık sat`, min: 4, max: 8, coins: 16, xp: 10 },
    { id: 'quick', ev: 'catch_quick', text: (n) => `${n} balığı çabucak çek`, min: 2, max: 3, coins: 16, xp: 10 },
  ],
  postman: [
    { id: 'deliver', ev: 'deliver', text: (n) => `${n} kargo teslim et`, min: 3, max: 6, coins: 20, xp: 12 },
    { id: 'express', ev: 'express', text: (n) => `${n} ekspres teslimat yap`, min: 1, max: 3, coins: 26, xp: 16 },
    { id: 'venues', ev: 'deliver_unique', text: (n) => `${n} farklı mekâna teslimat yap`, min: 2, max: 4, coins: 22, xp: 14 },
    { id: 'gift', ev: 'deliver_gift', text: (n) => `${n} hediye/çiçek teslim et`, min: 1, max: 3, coins: 18, xp: 12 },
  ],
}
