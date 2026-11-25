// Karakter görünümü (saç / göz / kıyafet rengi) — istemci ve sunucu ortak. Seçim = palet indeksi (-1 / null = orijinal renk).
// Sunucu yalnızca geçerli indeksleri kabul eder (sanitizeLook). Pastel/oyuncak paleti; pembe yok (unisex).
export const HAIR_COLORS = [
  '#3a2a22', '#6b4a35', '#9a6f47', '#d2a860', '#ecd08a', '#e3835a',
  '#9aa4af', '#eee9e0', '#6f8ed0', '#6cc3b6', '#a98be0', '#e0b85f',
  '#b85c48', '#e6d0b3', '#5c4a78', '#c89d7c',
]
export const EYE_COLORS = [
  '#5a3a26', '#9a6a3a', '#6fae5a', '#4f95d0', '#8fb6d4', '#8a8f98',
  '#a98be0', '#e0b85f', '#3a7d7c', '#7c5a8f',
]
export const OUTFIT_COLORS = [
  '#f6b98a', '#f2998a', '#f3d98b', '#a9d9a4', '#8fd3c8', '#9ccdf0',
  '#8aa6e6', '#b79be6', '#cdbdf0', '#f4efe6', '#8b90a0', '#4c5160',
  '#e69686', '#e8c8a0', '#b7d89c', '#6e5278', '#f5d0c5',
]
export const HAIR_NAMES = [
  'Siyah', 'Koyu kahve', 'Kahve', 'Bal', 'Sarı', 'Kızıl',
  'Gri', 'Beyaz', 'Mavi', 'Turkuaz', 'Mor', 'Altın',
  'Kestane Kızıl', 'Platin Kumral', 'Gece Moru', 'Karamel',
]
export const EYE_NAMES = [
  'Kahve', 'Ela', 'Yeşil', 'Mavi', 'Buz mavisi', 'Gri',
  'Mor', 'Amber', 'Zümrüt', 'Ametist',
]
export const OUTFIT_NAMES = [
  'Turuncu', 'Mercan', 'Sarı', 'Yeşil', 'Turkuaz', 'Gök',
  'Lacivert', 'Mor', 'Leylak', 'Krem', 'Gri', 'Siyah',
  'Gül Kurusu', 'Şampanya', 'Adaçayı', 'Mürdüm', 'Pudra',
]

export const emptyLook = () => ({ h: -1, e: -1, o: -1 })
const idx = (v, n) => (Number.isInteger(v) && v >= 0 && v < n ? v : -1)
export function sanitizeLook(l) {
  return { h: idx(l?.h, HAIR_COLORS.length), e: idx(l?.e, EYE_COLORS.length), o: idx(l?.o, OUTFIT_COLORS.length) }
}
export const sameLook = (a, b) => (a?.h ?? -1) === (b?.h ?? -1) && (a?.e ?? -1) === (b?.e ?? -1) && (a?.o ?? -1) === (b?.o ?? -1)
export const AVATAR_SLUGS = ['zeynep', 'deniz', 'elif', 'kaan', 'mira', 'ege']

/** Gardırop için hazır stil kombinleri (saç + göz + kıyafet + aksesuar çifti). */
export const OUTFIT_PRESETS = [
  { id: 'bahar', name: 'Bahar Rüyası', emoji: '🌸', desc: 'Çiçek tacı ve adaçayı tonları', look: { h: 3, e: 2, o: 14 }, acc: { id: 'flowers', color: 'mint' }, acc2: { id: 'wings', color: 'pearl' } },
  { id: 'paris', name: 'Paris Şıklığı', emoji: '🥐', desc: 'Fransız bere ve krem uyum', look: { h: 1, e: 1, o: 9 }, acc: { id: 'beret', color: 'coral' }, acc2: { id: 'earrings', color: 'gold' } },
  { id: 'prenses', name: 'Yıldız Prensesi', emoji: '👸', desc: 'İncili taç ve leylak ışıltı', look: { h: 13, e: 6, o: 8 }, acc: { id: 'tiara', color: 'lilac' }, acc2: { id: 'wings', color: 'lavender' } },
  { id: 'tatil', name: 'Sahil Esintisi', emoji: '☀️', desc: 'Hasır şapka ve güneş gözlüğü', look: { h: 11, e: 4, o: 4 }, acc: { id: 'hat', color: 'yellow' }, acc2: { id: 'heart_shades', color: 'coral' } },
  { id: 'seker', name: 'Tatlı Fiyonk', emoji: '🎀', desc: 'Şampanya ve şeftali kombini', look: { h: 15, e: 0, o: 13 }, acc: { id: 'bow', color: 'peach' }, acc2: { id: 'bag', color: 'gold' } },
  { id: 'kedi', name: 'Kedi Şirinliği', emoji: '🐱', desc: 'Kedi kulağı ve pudra tonu', look: { h: 12, e: 8, o: 16 }, acc: { id: 'cat_ears', color: 'coral' }, acc2: { id: 'round_glasses', color: 'gold' } },
  { id: 'lofi', name: 'Şehir & Lofi', emoji: '🎧', desc: 'Kulaklık ve rahat sokak stili', look: { h: 0, e: 5, o: 6 }, acc: { id: 'headphones', color: 'blue' }, acc2: { id: 'bag', color: 'peach' } },
  { id: 'gece', name: 'Gece Parıltısı', emoji: '🌙', desc: 'Işıltı halesi ve mürdüm stil', look: { h: 14, e: 9, o: 15 }, acc: { id: 'halo', color: 'gold' }, acc2: { id: 'earrings', color: 'pearl' } },
]
