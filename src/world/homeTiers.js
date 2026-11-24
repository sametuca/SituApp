// Ev kademeleri (saf JS; sunucu da okur). Her ev ayrı bir "oda"dır (hideout): şehirden bağımsız, oyuncu sayısı ne olursa olsun
// şehirde yer kaplamaz. Yeni oyuncu en küçük kademede (Garaj Evi) başlar, altınla büyütür.
// Eski kayıtlar (tier alanı yok) Stüdyo sayılır: mevcut düzenleri yeni oda boyuna sığar.
import { HOME_ROOM } from './layout.js'

export const HOME_TIERS = [
  { id: 'garage', name: 'Garaj Evi', emoji: '🚲', desc: 'Küçük ama sana ait; ilk evin.', hw: 4, hd: 3.5, wallH: 3.2, max: 14, price: 0 },
  { id: 'studio', name: 'Stüdyo Daire', emoji: '🏠', desc: 'Daha geniş tek oda.', hw: 5, hd: 4.5, wallH: 3.4, max: 24, price: 400 },
  { id: 'house', name: 'Müstakil Ev', emoji: '🏡', desc: 'Bol yer: salon gibi bir oda.', hw: 6.5, hd: 5.5, wallH: 3.6, max: 32, price: 1200 },
  { id: 'villa', name: 'Villa', emoji: '🏰', desc: 'Dev oda, 40 eşya.', hw: 8, hd: 6.5, wallH: 3.8, max: 40, price: 3000 },
]
export const MAX_TIER = HOME_TIERS.length - 1
export const clampTier = (t) => (Number.isInteger(t) ? Math.max(0, Math.min(MAX_TIER, t)) : 1)

/** Ev odasının ölçülerini (layout.js HOME_ROOM tekilini) verilen kademeye göre ayarlar; çizim/çarpışma/yerleştirme bunu okur. */
export function applyHomeTier(tier) {
  const t = HOME_TIERS[clampTier(tier)]
  HOME_ROOM.hw = t.hw
  HOME_ROOM.hd = t.hd
  HOME_ROOM.wallH = t.wallH
  HOME_ROOM.spawn = [0, t.hd - 1.5]
  HOME_ROOM.exit = { x: 0, z: t.hd - 0.8, radius: 1.6 }
  return t
}
applyHomeTier(1)
