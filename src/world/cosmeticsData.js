// Kişiselleştirme kataloğu: aksesuar, evcil hayvan, ev dekoru, hediye. Hem sunucu (doğrulama) hem istemci (çizim) kullanır;
// bu yüzden yalnızca düz veri ve doğrulayıcılar içerir (React/three yok).

/** Pastel renkler (aksesuar rengi). */
export const PASTELS = [
  { id: 'pink', name: 'Bal', hex: '#fec071', lv: 1 },
  { id: 'lilac', name: 'Mor', hex: '#bba0ff', lv: 1 },
  { id: 'blue', name: 'Mavi', hex: '#8fd0ff', lv: 1 },
  { id: 'mint', name: 'Nane', hex: '#8fe3c0', lv: 1 },
  { id: 'yellow', name: 'Sarı', hex: '#ffd96b', lv: 1 },
  { id: 'peach', name: 'Şeftali', hex: '#ffb18f', lv: 1 },
  { id: 'coral', name: 'Mercan', hex: '#ff9382', lv: 2 },
  { id: 'pearl', name: 'İnci', hex: '#fff5ea', lv: 2 },
  { id: 'lavender', name: 'Lavanta', hex: '#d8c4ff', lv: 2 },
  { id: 'gold', name: 'Altın', hex: '#f4c55c', lv: 3 },
  { id: 'sage', name: 'Adaçayı', hex: '#9ed6b4', lv: 3 },
  { id: 'noir', name: 'Gece', hex: '#4a415c', lv: 3 },
]
export const PASTEL_BY_ID = Object.fromEntries(PASTELS.map((c) => [c.id, c]))

/** Slot 1 (acc): Baş & saç aksesuarları. */
export const ACCESSORIES = [
  { id: 'headphones', name: 'Kulaklık', emoji: '🎧', lv: 1 },
  { id: 'shades', name: 'Güneş gözlüğü', emoji: '🕶️', lv: 1 },
  { id: 'hat', name: 'Şapka', emoji: '👒', lv: 1 },
  { id: 'bow', name: 'Fiyonk', emoji: '🎀', lv: 1 },
  { id: 'flowers', name: 'Çiçek tacı', emoji: '🌸', lv: 1 },
  { id: 'beret', name: 'Fransız Bere', emoji: '🎨', lv: 2 },
  { id: 'hairpins', name: 'Yıldız toka', emoji: '⭐', lv: 2 },
  { id: 'cat_ears', name: 'Kedi kulağı', emoji: '🐱', lv: 2 },
  { id: 'bunny', name: 'Tavşan kulağı', emoji: '🐰', lv: 3 },
  { id: 'tiara', name: 'İncili Taç', emoji: '👸', lv: 4 },
  { id: 'crown', name: 'Taç', emoji: '👑', lv: 4 },
  { id: 'halo', name: 'Işıltı halesi', emoji: '😇', lv: 5 },
]
export const ACCESSORY_BY_ID = Object.fromEntries(ACCESSORIES.map((a) => [a.id, a]))

/** Slot 2 (acc2): Yüz, kulak, sırt & çanta aksesuarları (baş aksesuarıyla birlikte takılabilir). */
export const STYLE_ACCESSORIES = [
  { id: 'scarf', name: 'Fular', emoji: '🧣', lv: 1 },
  { id: 'round_glasses', name: 'Retro gözlük', emoji: '🤓', lv: 1 },
  { id: 'bag', name: 'Mini çanta', emoji: '👜', lv: 2 },
  { id: 'heart_shades', name: 'Kalp gözlük', emoji: '🕶️', lv: 3 },
  { id: 'earrings', name: 'İnci küpe', emoji: '💎', lv: 3 },
  { id: 'wings', name: 'Peri kanadı', emoji: '🧚', lv: 4 },
]
export const STYLE_ACC_BY_ID = Object.fromEntries(STYLE_ACCESSORIES.map((a) => [a.id, a]))

export const PETS = [
  { id: 'cat', name: 'Kedi', emoji: '🐱' },
  { id: 'bunny', name: 'Tavşan', emoji: '🐰' },
  { id: 'chick', name: 'Civciv', emoji: '🐥' },
  { id: 'dog', name: 'Köpek', emoji: '🐶' },
]
export const PET_WEEK_MS = 7 * 24 * 3600 * 1000 // evcil hayvan süresi (ilk hafta ücretsiz)
export const PET_RENEW_PRICE = 80 // ₺ / hafta
export const PET_BY_ID = Object.fromEntries(PETS.map((p) => [p.id, p]))

/** İstemciden gelen kozmetik seçimini doğrular. Dönüş: { acc?: {id,color}|null, acc2?: {id,color}|null, pet?: id|null } (verilmeyen alan yok). */
export function sanitizeCos(c, lv = Infinity) {
  const out = {}
  if (c && typeof c === 'object') {
    const okColor = (col) => PASTEL_BY_ID[col] && (PASTEL_BY_ID[col].lv ?? 1) <= lv
    if ('acc' in c) {
      const a = c.acc
      out.acc = a && ACCESSORY_BY_ID[a.id] && (ACCESSORY_BY_ID[a.id].lv ?? 1) <= lv && okColor(a.color) ? { id: a.id, color: a.color } : null
    }
    if ('acc2' in c) {
      const a2 = c.acc2
      out.acc2 = a2 && STYLE_ACC_BY_ID[a2.id] && (STYLE_ACC_BY_ID[a2.id].lv ?? 1) <= lv && okColor(a2.color) ? { id: a2.id, color: a2.color } : null
    }
    if ('pet' in c) out.pet = typeof c.pet === 'string' && PET_BY_ID[c.pet] ? c.pet : null
  }
  return out
}

// ---------- ev dekoru ----------
export const WALL_COLORS = [
  { id: 'pink', name: 'Şeftali Krem', hex: '#ffeed9' },
  { id: 'lilac', name: 'Lavanta', hex: '#e6dcff' },
  { id: 'blue', name: 'Buz Mavisi', hex: '#d4ebff' },
  { id: 'mint', name: 'Nane', hex: '#d3f5e4' },
  { id: 'yellow', name: 'Limon', hex: '#fff0c4' },
  { id: 'peach', name: 'Somon', hex: '#ffe0cf' },
  { id: 'rose', name: 'Gül Kurusu', hex: '#ffd6e4' },
  { id: 'sage', name: 'Adaçayı', hex: '#d6edd9' },
  { id: 'cream', name: 'Vanilya', hex: '#fff9ed' },
  { id: 'sky', name: 'Gökyüzü', hex: '#cde9ff' },
]
export const WALL_PATTERNS = [
  { id: 'plain', name: 'Düz', emoji: '▫️' },
  { id: 'stripes', name: 'Çizgili', emoji: '📏' },
  { id: 'dots', name: 'Puantiyeli', emoji: '⚪' },
  { id: 'hearts', name: 'Kalpli', emoji: '💗' },
  { id: 'stars', name: 'Yıldızlı', emoji: '⭐' },
]
export const FLOORS = [
  { id: 'wood', name: 'Ahşap', emoji: '🪵' },
  { id: 'rug', name: 'Halı', emoji: '🧶' },
  { id: 'tile', name: 'Fayans', emoji: '🔲' },
  { id: 'marble', name: 'Mermer', emoji: '🤍' },
]
export const DEFAULT_DECOR = { wall: 'pink', pattern: 'plain', floor: 'wood', romantic: false }

export function sanitizeDecor(d) {
  const o = d && typeof d === 'object' ? d : {}
  return {
    wall: WALL_COLORS.some((c) => c.id === o.wall) ? o.wall : DEFAULT_DECOR.wall,
    pattern: WALL_PATTERNS.some((c) => c.id === o.pattern) ? o.pattern : DEFAULT_DECOR.pattern,
    floor: FLOORS.some((c) => c.id === o.floor) ? o.floor : DEFAULT_DECOR.floor,
    romantic: Boolean(o.romantic),
  }
}

// ---------- hediyeler ----------
// Hediye kimlikleri mobilya kataloğundan (furniture.js) ayrıdır; ev düzenine 'gift-*' kimliğiyle girer.
// fw/fd: yerdeki ayak izi (m). Modeller Meshy GLB (public/models/gifts/, src/world/Gifts.jsx); ayak izi GLB ölçüsü × Gifts.jsx boyutu.
export const GIFTS = [
  { id: 'gift-bear', name: 'Peluş ayı', emoji: '🧸', fw: 0.8, fd: 0.7 },
  { id: 'gift-heartbox', name: 'Kalp kutusu', emoji: '💝', fw: 0.65, fd: 0.65 },
  { id: 'gift-roses', name: 'Gül buketi', emoji: '🌹', fw: 0.65, fd: 0.7 },
  { id: 'gift-choco', name: 'Çikolata kutusu', emoji: '🍫', fw: 0.65, fd: 0.55 },
]
export const GIFT_BY_ID = Object.fromEntries(GIFTS.map((g) => [g.id, g]))
export const GIFT_RANGE = 8 // m
