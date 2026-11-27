// Karakter görünümü (saç / göz / kıyafet rengi) — istemci ve sunucu ortak. Seçim = palet indeksi (-1 / null = orijinal renk).
// Sunucu yalnızca geçerli indeksleri kabul eder (sanitizeLook). Pastel/oyuncak paleti; pembe yok (unisex).
export const HAIR_COLORS = [
  '#3a2a22', '#6b4a35', '#9a6f47', '#d2a860', '#ecd08a', '#e3835a',
  '#9aa4af', '#eee9e0', '#6f8ed0', '#6cc3b6', '#a98be0', '#e0b85f',
  '#b85c48', '#e6d0b3', '#5c4a78', '#c89d7c',
]
export const EYE_COLORS = [
  '#5a3a26', '#9a6a3a', '#6fae5a', '#4f95d0', '#8fb6d4', '#8a8f98',
  '#a98be0', '#e0b85f', '#3a7d7c', '#6c6be0',
]
export const OUTFIT_COLORS = [
  '#f6b98a', '#f2998a', '#f3d98b', '#a9d9a4', '#8fd3c8', '#9ccdf0',
  '#8aa6e6', '#b79be6', '#cdbdf0', '#f4efe6', '#8b90a0', '#4c5160',
  '#e69686', '#e8c8a0', '#b7d89c', '#5c578c', '#f5d0c5',
]
export const HAIR_NAMES = [
  'Siyah', 'Koyu kahve', 'Kahve', 'Bal', 'Sarı', 'Kızıl',
  'Gri', 'Beyaz', 'Mavi', 'Turkuaz', 'Mor', 'Altın',
  'Kestane Kızıl', 'Platin Kumral', 'Gece Moru', 'Karamel',
]
export const EYE_NAMES = [
  'Kahve', 'Ela', 'Yeşil', 'Mavi', 'Buz mavisi', 'Gri',
  'Mor', 'Amber', 'Zümrüt', 'Çivit',
]
export const OUTFIT_NAMES = [
  'Turuncu', 'Mercan', 'Sarı', 'Yeşil', 'Turkuaz', 'Gök',
  'Lacivert', 'Mor', 'Leylak', 'Krem', 'Gri', 'Siyah',
  'Gül Kurusu', 'Şampanya', 'Adaçayı', 'Gece Moru', 'Pudra',
]

export const HAIR_LEVELS = [1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 4, 4]
export const EYE_LEVELS = [1, 1, 1, 1, 1, 2, 2, 3, 3, 4]
export const OUTFIT_LEVELS = [1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 4, 4]

export const emptyLook = () => ({ h: -1, e: -1, o: -1 })
const idx = (v, n, levels, lv) => (Number.isInteger(v) && v >= 0 && v < n && (levels?.[v] ?? 1) <= lv ? v : -1)
export function sanitizeLook(l, lv = Infinity) {
  return {
    h: idx(l?.h, HAIR_COLORS.length, HAIR_LEVELS, lv),
    e: idx(l?.e, EYE_COLORS.length, EYE_LEVELS, lv),
    o: idx(l?.o, OUTFIT_COLORS.length, OUTFIT_LEVELS, lv),
  }
}
export const sameLook = (a, b) => (a?.h ?? -1) === (b?.h ?? -1) && (a?.e ?? -1) === (b?.e ?? -1) && (a?.o ?? -1) === (b?.o ?? -1)
export const AVATAR_SLUGS = ['zeynep', 'deniz', 'elif', 'kaan', 'mira', 'ege']

/** Gardırop için hazır stil kombinleri (saç + göz + kıyafet + aksesuar çifti). */
export const OUTFIT_PRESETS = [
  { id: 'lofi', name: 'Şehir & Lofi', emoji: '🎧', desc: 'Kulaklık ve rahat sokak stili', lv: 1, look: { h: 0, e: 0, o: 6 }, acc: { id: 'headphones', color: 'blue' }, acc2: { id: 'scarf', color: 'peach' } },
  { id: 'tatil', name: 'Sahil Esintisi', emoji: '☀️', desc: 'Hasır şapka ve güneş gözlüğü', lv: 1, look: { h: 3, e: 3, o: 4 }, acc: { id: 'hat', color: 'yellow' }, acc2: { id: 'round_glasses', color: 'blue' } },
  { id: 'seker', name: 'Tatlı Fiyonk', emoji: '🎀', desc: 'Bal ve şeftali kombini', lv: 1, look: { h: 3, e: 0, o: 0 }, acc: { id: 'bow', color: 'peach' }, acc2: { id: 'scarf', color: 'mint' } },
  { id: 'bahar', name: 'Bahar Rüyası', emoji: '🌸', desc: 'Çiçek tacı ve nane tonları', lv: 1, look: { h: 3, e: 2, o: 4 }, acc: { id: 'flowers', color: 'mint' }, acc2: { id: 'scarf', color: 'yellow' } },
  { id: 'paris', name: 'Paris Şıklığı', emoji: '🥐', desc: 'Fransız bere ve krem uyum', lv: 2, look: { h: 1, e: 1, o: 9 }, acc: { id: 'beret', color: 'coral' }, acc2: { id: 'bag', color: 'peach' } },
  { id: 'kedi', name: 'Kedi Şirinliği', emoji: '🐱', desc: 'Kedi kulağı ve mercan tonu', lv: 2, look: { h: 5, e: 2, o: 1 }, acc: { id: 'cat_ears', color: 'coral' }, acc2: { id: 'round_glasses', color: 'pearl' } },
  { id: 'prenses', name: 'Yıldız Prensesi', emoji: '👸', desc: 'İncili taç ve leylak ışıltı', lv: 4, look: { h: 13, e: 6, o: 8 }, acc: { id: 'tiara', color: 'lilac' }, acc2: { id: 'wings', color: 'lavender' } },
  { id: 'gece', name: 'Gece Parıltısı', emoji: '🌙', desc: 'Işıltı halesi ve gece stili', lv: 5, look: { h: 14, e: 9, o: 15 }, acc: { id: 'halo', color: 'gold' }, acc2: { id: 'earrings', color: 'pearl' } },
]
