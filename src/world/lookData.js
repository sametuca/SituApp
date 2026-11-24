// Karakter görünümü (saç / göz / kıyafet rengi) — istemci ve sunucu ortak. Seçim = palet indeksi (-1 / null = orijinal renk).
// Sunucu yalnızca geçerli indeksleri kabul eder (sanitizeLook). Pastel/oyuncak paleti; pembe yok (unisex).
export const HAIR_COLORS = ['#3a2a22', '#6b4a35', '#9a6f47', '#d2a860', '#ecd08a', '#e3835a', '#9aa4af', '#eee9e0', '#6f8ed0', '#6cc3b6', '#a98be0', '#e0b85f']
export const EYE_COLORS = ['#5a3a26', '#9a6a3a', '#6fae5a', '#4f95d0', '#8fb6d4', '#8a8f98', '#a98be0', '#e0b85f']
export const OUTFIT_COLORS = ['#f6b98a', '#f2998a', '#f3d98b', '#a9d9a4', '#8fd3c8', '#9ccdf0', '#8aa6e6', '#b79be6', '#cdbdf0', '#f4efe6', '#8b90a0', '#4c5160']
export const HAIR_NAMES = ['Siyah', 'Koyu kahve', 'Kahve', 'Bal', 'Sarı', 'Kızıl', 'Gri', 'Beyaz', 'Mavi', 'Turkuaz', 'Mor', 'Altın']
export const EYE_NAMES = ['Kahve', 'Ela', 'Yeşil', 'Mavi', 'Buz mavisi', 'Gri', 'Mor', 'Amber']
export const OUTFIT_NAMES = ['Turuncu', 'Mercan', 'Sarı', 'Yeşil', 'Turkuaz', 'Gök', 'Lacivert', 'Mor', 'Leylak', 'Krem', 'Gri', 'Siyah']

export const emptyLook = () => ({ h: -1, e: -1, o: -1 })
const idx = (v, n) => (Number.isInteger(v) && v >= 0 && v < n ? v : -1)
export function sanitizeLook(l) {
  return { h: idx(l?.h, HAIR_COLORS.length), e: idx(l?.e, EYE_COLORS.length), o: idx(l?.o, OUTFIT_COLORS.length) }
}
export const sameLook = (a, b) => a.h === b.h && a.e === b.e && a.o === b.o
export const AVATAR_SLUGS = ['zeynep', 'deniz', 'elif', 'kaan', 'mira', 'ege']
