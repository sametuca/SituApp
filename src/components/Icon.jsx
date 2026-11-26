// Arayüz (HUD & kartlar) ikonları: tamamı Microsoft Fluent Emoji 3D seti (public/icons/fluent/*.webp) üzerinden çizilir.
import { Em } from './emoji'

const ICONS = {
  back: '🚪',
  settings: '⚙️',
  help: '❓',
  friends: '💗',
  quests: '⭐',
  trophy: '🏆',
  pvp: '⚔️',
  soundOn: '🔊',
  soundOff: '🔇',
  collection: '🧺',
  bike: '🚲',
  walk: '🚶',
  coins: '🪙',
  smile: '😊',
  chat: '💬',
  sofa: '🛋️',
  home: '🏠',
  shop: '🛍️',
  day: '☀️',
  dusk: '🌇',
  night: '🌙',
  gift: '🎁',
  game: '🎮',
  feedback: '💌',
  hand: '👋',
  wardrobe: '👕',
  map: '🗺️',
  compass: '🧭',
  sparkles: '✨',
  cake: '🎂',
  pin: '📍',
  instagram: '📸',
  x: '🐦',
  lock: '🔒',
  ice: '❄️',
  afk: '🌙',
  flower: '🌸',
  user: '👤',
  fish: '🐟',
  parcel: '📦',
  close: '✖️',
  add: '➕',
  rotate: '🌀',
  reset: '🎨',
  play: '🎵',
  stop: '🛑',
  check: '✔️',
  prev: '👈',
  next: '👉',
  down: '👇',
}

const TAG_ICONS = {
  kahve: '☕',
  muzik: '🎵',
  kitap: '📚',
  film: '🎬',
  plaj: '🏖️',
  doga: '🌳',
  oyun: '🎮',
  dans: '🪩',
  yemek: '🍕',
  seyahat: '✈️',
  hayvanlar: '🐾',
  sanat: '🎨',
  spor: '🏋️',
  karaoke: '🎤',
  fotograf: '📷',
  yoga: '🪷',
  gece: '🍷',
  'gece hayati': '🍷',
  gecekusu: '🌙',
  'gece kusu': '🌙',
  erken: '☀️',
  'erken kalkan': '☀️',
  tatli: '🍰',
  podcast: '🎧',
  bulmaca: '🧩',
  bisiklet: '🚲',
  bahce: '🌸',
}

const norm = (s) =>
  String(s ?? '')
    .replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/gu, '')
    .trim()
    .toLowerCase()
    .replaceAll('ı', 'i')
    .replaceAll('ş', 's')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')

export const cleanLabel = (s) => String(s ?? '').replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/gu, '').trim()

export function Ico({ name, size = 22, className = '' }) {
  const e = ICONS[name] ?? ICONS.help
  return <Em e={e} size={size} className={`inline-block shrink-0 ${className}`} />
}

export function TagIcon({ id, label, size = 16, className = '' }) {
  const e = TAG_ICONS[id] ?? TAG_ICONS[norm(label ?? id)] ?? '✨'
  return <Em e={e} size={size} className={`inline-block shrink-0 ${className}`} />
}

export const hasIco = (name) => Boolean(ICONS[name])
