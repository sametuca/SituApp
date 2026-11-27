// Uyumluluk göstergeleri: müzik zevki, ruh hali ve burç (ortak veri; sunucu ve istemci aynı dosyayı okur).
export const MUSIC = [
  ['pop', '🎤', 'Pop'],
  ['rock', '🎸', 'Rock'],
  ['rap', '🎧', 'Rap'],
  ['elektronik', '🪩', 'Elektronik'],
  ['caz', '🎷', 'Caz'],
  ['klasik', '🎻', 'Klasik'],
  ['indie', '🌿', 'Indie'],
  ['turkce', '🪕', 'Türkçe pop/halk'],
  ['arabesk', '🌙', 'Arabesk'],
  ['lofi', '☕', 'Lo-fi'],
].map(([id, emoji, label]) => ({ id, emoji, label }))

export const MOODS = [
  ['sohbet', '💬', 'Sohbete açığım'],
  ['eglence', '🎉', 'Eğlenmek istiyorum'],
  ['sakin', '😌', 'Sakin takılıyorum'],
  ['romantik', '💗', 'Romantik havadayım'],
  ['kesif', '🧭', 'Keşifteyim'],
  ['dinlenme', '🌙', 'Dinleniyorum'],
].map(([id, emoji, label]) => ({ id, emoji, label }))

export const MOOD_TTL = 6 * 3600 * 1000 // ruh hali 6 saat sonra kendiliğinden silinir
export const MUSIC_IDS = new Set(MUSIC.map((m) => m.id))
export const MOOD_IDS = new Set(MOODS.map((m) => m.id))

// [bitiş ay, bitiş gün, id, emoji, ad, element]
const SIGNS = [
  [1, 19, 'oglak', '♑', 'Oğlak', 'earth'],
  [2, 18, 'kova', '♒', 'Kova', 'air'],
  [3, 20, 'balik', '♓', 'Balık', 'water'],
  [4, 19, 'koc', '♈', 'Koç', 'fire'],
  [5, 20, 'boga', '♉', 'Boğa', 'earth'],
  [6, 20, 'ikizler', '♊', 'İkizler', 'air'],
  [7, 22, 'yengec', '♋', 'Yengeç', 'water'],
  [8, 22, 'aslan', '♌', 'Aslan', 'fire'],
  [9, 22, 'basak', '♍', 'Başak', 'earth'],
  [10, 22, 'terazi', '♎', 'Terazi', 'air'],
  [11, 21, 'akrep', '♏', 'Akrep', 'water'],
  [12, 21, 'yay', '♐', 'Yay', 'fire'],
]
const ELEMENT_NAME = { fire: 'ateş', earth: 'toprak', air: 'hava', water: 'su' }

/** 'YYYY-MM-DD' → { id, emoji, label, element } ya da null. */
export function zodiacOf(birthDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthDate ?? ''))
  if (!m) return null
  const mo = +m[2]
  const d = +m[3]
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const s = d <= SIGNS[mo - 1][1] ? SIGNS[mo - 1] : SIGNS[mo % 12]
  return { id: s[2], emoji: s[3], label: s[4], element: s[5] }
}

/** İki burcun uyumu: aynı elementte olanlar ya da ateş-hava / toprak-su çiftleri uyumlu sayılır (eğlence amaçlı). */
export function zodiacMatch(a, b) {
  if (!a || !b) return null
  const ok = a.element === b.element || (a.element === 'fire' && b.element === 'air') || (a.element === 'air' && b.element === 'fire') || (a.element === 'earth' && b.element === 'water') || (a.element === 'water' && b.element === 'earth')
  if (!ok) return null
  return a.element === b.element ? `İkiniz de ${ELEMENT_NAME[a.element]} burcusunuz` : `${a.label} ve ${b.label} uyumlu görünüyor`
}
