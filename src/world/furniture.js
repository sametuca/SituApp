// Ev mobilyası kataloğu. GLB'ler public/models/furniture/<id>.glb (scripts/generate-furniture.mjs ile Meshy'den üretilir).
// size: modelin en büyük boyutunun odadaki hedef uzunluğu (metre; çoğunlukla yükseklik ya da uzunluk). Odanın içi 10 × 9 m, avatar 1,3 m.
// prompt: Meshy görsel isteği (ortak stil eki script'te eklenir).
export const FURNITURE = [
  { id: 'bed', name: 'Yatak', emoji: '🛏️', size: 2.5, prompt: 'cute pastel pink single bed with fluffy white blanket and colorful pillows' },
  { id: 'sofa', name: 'Koltuk', emoji: '🛋️', size: 2.4, prompt: 'cute pastel lilac two-seat sofa with soft round cushions' },
  { id: 'armchair', name: 'Berjer', emoji: '💺', size: 1.3, prompt: 'cute pastel blue round armchair with a small cushion' },
  { id: 'beanbag', name: 'Puf', emoji: '🫧', size: 1.2, prompt: 'cute pastel yellow bean bag pouf with a smiley stitch' },
  { id: 'coffee-table', name: 'Sehpa', emoji: '☕', size: 1.0, prompt: 'cute round pastel mint coffee table with a small flower vase' },
  { id: 'desk', name: 'Çalışma masası', emoji: '🖥️', size: 1.8, prompt: 'cute pastel peach desk with a laptop and a pencil cup' },
  { id: 'bookshelf', name: 'Kitaplık', emoji: '📚', size: 2.4, prompt: 'cute pastel white bookshelf with colorful books and small toys' },
  { id: 'wardrobe', name: 'Gardırop', emoji: '🚪', size: 2.4, prompt: 'cute pastel pink wardrobe with two round doors and heart handles' },
  { id: 'nightstand', name: 'Komodin', emoji: '🕯️', size: 1.0, prompt: 'cute pastel blue nightstand with a small lamp on top' },
  { id: 'floor-lamp', name: 'Ayaklı lamba', emoji: '💡', size: 2.4, prompt: 'cute pastel floor lamp with a round glowing yellow shade' },
  { id: 'tv-stand', name: 'TV ünitesi', emoji: '📺', size: 1.7, prompt: 'cute pastel lilac tv stand with a flat screen tv and a small plant' },
]
export const FURNITURE_BY_ID = Object.fromEntries(FURNITURE.map((f) => [f.id, f]))
export const furnitureUrl = (id) => `/models/furniture/${id}.glb`
