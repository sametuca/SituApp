// Karakter görünümü (saç / göz / kıyafet rengi) — istemci ve sunucu ortak. Seçim = palet indeksi (-1 / null = orijinal renk).
// Sunucu yalnızca geçerli indeksleri kabul eder (sanitizeLook). Pastel/oyuncak paleti; pembe yok (unisex).
export const HAIR_COLORS = ['#2b1a12', '#5a3420', '#8a5a34', '#c9954f', '#e8c46a', '#d9582b', '#7a8591', '#e9e4dc', '#2f4f9a', '#3aa79b', '#8a5bd0', '#d9a441']
export const EYE_COLORS = ['#3a2416', '#7a4a22', '#4f8a3a', '#2f7fc2', '#7aa6c9', '#6b6f78', '#8a5bd0', '#d9a441']
export const OUTFIT_COLORS = ['#f4a24e', '#e5654a', '#e8c46a', '#7bc67e', '#3aa79b', '#6bb7e8', '#3f6fd0', '#8a5bd0', '#b8a1e8', '#f1ede4', '#5b5f6b', '#2f3440']
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
