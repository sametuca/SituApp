// Arayüz (HUD) ikonları: tüm uygulama genelinde tek tip Microsoft Fluent Emoji 3D seti (emoji.jsx).
import { Em } from './emoji'

const ICONS = {
  back: '⬅️',
  settings: '⚙️',
  help: '❓',
  friends: '🧡',
  quests: '⭐',
  trophy: '🏆',
  pvp: '⚔️',
  job: '💼',
  soundOn: '🔊',
  soundOff: '🔇',
  collection: '🧺',
  bike: '🚲',
  walk: '🚶',
  coins: '🪙',
  smile: '😊',
  chat: '💬',
  sofa: '🪑',
  home: '🏠',
  shop: '🛍️',
  day: '☀️',
  dusk: '🌅',
  night: '🌙',
  gift: '🎁',
  game: '🎮',
  feedback: '📩',
  hand: '👋',
  wardrobe: '👗',
  map: '🗺️',
  compass: '🧭',
  sparkles: '✨',
}

export function Ico({ name, size = 22, className = '' }) {
  const e = ICONS[name] ?? ICONS.help
  return <Em e={e} size={size} className={className} />
}
export const hasIco = (name) => Boolean(ICONS[name])
