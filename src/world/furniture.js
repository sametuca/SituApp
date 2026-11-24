// Ev mobilyası kataloğu. GLB'ler public/models/furniture/<id>.glb (scripts/generate-furniture.mjs ile Meshy'den üretilir).
// size: modelin en büyük boyutunun odadaki hedef uzunluğu (metre; çoğunlukla yükseklik ya da uzunluk). Odanın içi 10 × 9 m, avatar 1,3 m.
// prompt: Meshy görsel isteği (ortak stil eki script'te eklenir).
const BASE = [
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
// Tema setleri (Döşe çekmecesinde süzgeç sekmeleri): 'classic' = ilk 11 eşya
const THEMED = [
  // Romantik
  { id: 'heart-bed', set: 'romantic', name: 'Kalp yatak', emoji: '🛏️', size: 2.6, prompt: 'cute pastel red-pink double bed with a big heart-shaped headboard, white fluffy blanket and rose petals' },
  { id: 'candle-stand', set: 'romantic', name: 'Mum standı', emoji: '🕯️', size: 1.8, prompt: 'cute pastel rose-gold floor candelabra with three glowing white candles and tiny hearts' },
  { id: 'rose-vase', set: 'romantic', name: 'Gül vazosu', emoji: '🌹', size: 1.0, prompt: 'cute pastel white floor vase filled with a bouquet of red and pink roses' },
  { id: 'velvet-armchair', set: 'romantic', name: 'Kadife koltuk', emoji: '💺', size: 1.4, prompt: 'cute pastel burgundy-pink velvet armchair with a high rounded back and gold feet' },
  { id: 'fireplace', set: 'romantic', name: 'Şömine', emoji: '🔥', size: 2.2, prompt: 'cute pastel pink brick fireplace with a warm fire, white mantel and two little candles on top' },
  { id: 'heart-mirror', set: 'romantic', name: 'Kalpli ayna', emoji: '🪞', size: 2.0, prompt: 'cute pastel standing floor mirror with a big heart-shaped frame in pink and gold' },
  // Bahar
  { id: 'flower-shelf', set: 'spring', name: 'Çiçekli raf', emoji: '🌸', size: 1.8, prompt: 'cute pastel white floor shelf unit covered with pots of colorful spring flowers' },
  { id: 'plant-stand', set: 'spring', name: 'Bitki standı', emoji: '🪴', size: 1.6, prompt: 'cute pastel light green tiered plant stand with three leafy potted plants' },
  { id: 'flower-table', set: 'spring', name: 'Çiçekli sehpa', emoji: '🌼', size: 0.9, prompt: 'cute round pastel yellow coffee table with a vase of daisies in the center' },
  { id: 'hammock', set: 'spring', name: 'Hamak', emoji: '🛌', size: 2.6, prompt: 'cute pastel striped hammock hanging on a small wooden stand frame, light blue and white' },
  { id: 'picnic-basket', set: 'spring', name: 'Piknik sepeti', emoji: '🧺', size: 0.8, prompt: 'cute pastel wicker picnic basket with a gingham checkered cloth and a few fruits' },
  { id: 'bunny-lamp', set: 'spring', name: 'Tavşanlı lamba', emoji: '🐰', size: 1.6, prompt: 'cute pastel pink bunny shaped floor lamp with a glowing round lampshade belly' },
  // Retro
  { id: 'jukebox', set: 'retro', name: 'Jukebox', emoji: '🎶', size: 1.8, prompt: 'cute retro pastel teal jukebox with rounded top, glowing yellow arch and colorful buttons' },
  { id: 'record-player', set: 'retro', name: 'Plak çalar', emoji: '📀', size: 1.0, prompt: 'cute retro pastel cream record player cabinet with a vinyl record on the turntable and wooden legs' },
  { id: 'retro-tv', set: 'retro', name: 'Retro TV', emoji: '📺', size: 1.2, prompt: 'cute retro pastel mint green television set with rounded screen and a tiny antenna on wooden legs' },
  { id: 'bubble-lamp', set: 'retro', name: 'Balon lamba', emoji: '🔮', size: 1.9, prompt: 'cute retro pastel orange floor lamp with a big glowing bubble globe shade on a tripod' },
  { id: 'retro-armchair', set: 'retro', name: 'Retro koltuk', emoji: '🛋️', size: 1.3, prompt: 'cute retro pastel orange armchair with round cushions and thin wooden legs' },
  { id: 'pinball', set: 'retro', name: 'Flipper', emoji: '🕹️', size: 1.9, prompt: 'cute retro pastel pinball machine with a colorful glowing playfield and little legs' },
]
export const FURNITURE_SETS = [
  { id: 'classic', name: 'Klasik', emoji: '🛋️' },
  { id: 'romantic', name: 'Romantik', emoji: '💗' },
  { id: 'spring', name: 'Bahar', emoji: '🌸' },
  { id: 'retro', name: 'Retro', emoji: '📻' },
]
export const FURNITURE = [...BASE.map((f) => ({ set: 'classic', ...f })), ...THEMED]
export const FURNITURE_BY_ID = Object.fromEntries(FURNITURE.map((f) => [f.id, f]))
export const furnitureUrl = (id) => `/models/furniture/${id}.glb`
