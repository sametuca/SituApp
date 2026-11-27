// Flört & sosyal akış verisi (istemci + sunucu ortak): modlar, buz kırıcılar, 3 dk hızlı randevu soruları, uyum seviyeleri ve zamanlı etkinlikler.

export const VIBES = [
  { id: 'cafe', emoji: '☕', label: 'Sakin Sohbet', desc: 'Kahve ve samimi muhabbet', zone: 'cafe', spawn: [0, -26] },
  { id: 'party', emoji: '🎵', label: 'Parti & Dans', desc: 'Müzik, pist ve yüksek enerji', zone: 'club', spawn: [28, 0] },
  { id: 'game', emoji: '🎮', label: 'Oyun & Rekabet', desc: 'Boks, sörf ve mini oyunlar', zone: 'club', spawn: [24, 2] },
  { id: 'chill', emoji: '🌴', label: 'Takılmaca', desc: 'Plaj, gün batımı ve rahat sohbet', zone: 'beach', spawn: [0, 56] },
]
export const VIBE_BY_ID = Object.fromEntries(VIBES.map((v) => [v.id, v]))

export const ICEBREAKERS = [
  { id: 'coffee', emoji: '☕', text: 'Kahve ısmarlayayım mı?', bubble: '☕ Kahve ısmarlayayım mı?' },
  { id: 'game', emoji: '🎮', text: 'Bir el oyun atalım mı?', bubble: '🎮 Bir el oyun atalım mı?' },
  { id: 'style', emoji: '✨', text: 'Tarzın çok iyi olmuş!', bubble: '✨ Tarzın çok iyi olmuş!' },
]

export const MEETUP_OPTIONS = [
  { id: 'coffee', emoji: '☕', label: 'Kahve içmeye', venue: 'kafe', place: 'Starbucket' },
  { id: 'dessert', emoji: '🍰', label: 'Tatlı yemeye', venue: 'tatli', place: 'Tatlı Kafası' },
  { id: 'tea', emoji: '🍵', label: 'Çay içmeye', venue: 'cayevi', place: 'Çaykurt' },
  { id: 'icecream', emoji: '🍦', label: 'Dondurma yemeye', venue: 'dondurma', place: 'Nevarlanda' },
  { id: 'dance', emoji: '💃', label: 'Dans etmeye', venue: 'kulup', place: 'Klüp' },
  { id: 'arcade', emoji: '🎮', label: 'Oyun oynamaya', venue: 'oyun', place: 'Playstasyon' },
]
export const MEETUP_BY_ID = Object.fromEntries(MEETUP_OPTIONS.map((x) => [x.id, x]))

export const SPEED_QUESTIONS = [
  { q: 'Tatil tercihin hangisi?', a: '🏖️ Deniz & kum', b: '🏔️ Doğa & kamp' },
  { q: 'İlk buluşmada 10 dk geç kalmak?', a: '😄 Olur öyle, sorun yok', b: '⏰ Dakiklik önemli' },
  { q: 'Gece kuşu musun sabahçı mı?', a: '🦉 Gece kuşu', b: '☀️ Sabahçı' },
  { q: 'Ananaslı pizza sence nasıl?', a: '🍍 Gayet güzel', b: '🚫 Kesinlikle hayır' },
  { q: 'Hafta sonu planı?', a: '🪩 Dışarıda kalabalık', b: '🏠 Evde film & kahve' },
  { q: 'İlk mesajı kim atmalı?', a: '⚡ Ben atarım, beklemem', b: '👀 Karşıdan gelmesi hoş' },
  { q: 'Müzik açtın, ilk ne çalar?', a: '🎸 Türkçe pop / rock', b: '🎧 Elektronik / chill' },
  { q: 'İçecek seçimin?', a: '☕ Sütlü kahve', b: '🍵 İnce belli çay' },
  { q: 'Spontane plan mı, planlı program mı?', a: '🎲 Anlık macera', b: '📅 Planlı rahatlık' },
  { q: 'Kedi mi köpek mi?', a: '🐈 Kedi insanıyım', b: '🐶 Köpek insanıyım' },
]

export const BOND_LEVELS = [
  { lv: 1, min: 0, title: 'Yeni Tanışma', emoji: '🌱', perk: 'Özel buz kırıcılar açık' },
  { lv: 2, min: 40, title: 'Isınan Sohbet', emoji: '💬', perk: 'Özel çift tepkileri & hızlı fısıltı' },
  { lv: 3, min: 110, title: 'Yakın Arkadaş', emoji: '🏡', perk: 'Tek tıkla eve misafir olma & bahçe yardımı' },
  { lv: 4, min: 220, title: 'Harika Uyum', emoji: '📸', perk: 'Ortak anı kartı & çift pozu' },
  { lv: 5, min: 380, title: 'Ruh İkizi', emoji: '💞', perk: 'Özel Ruh İkizi unvanı & altın kalp' },
]

export function bondLevelOf(xp = 0) {
  let cur = BOND_LEVELS[0]
  for (const b of BOND_LEVELS) if (xp >= b.min) cur = b
  const next = BOND_LEVELS.find((b) => b.lv === cur.lv + 1) ?? null
  return { ...cur, xp, nextMin: next?.min ?? cur.min }
}

// Her 20 dakikada 1 kez 5 dakika süren canlı kasaba etkinlikleri (tüm istemcilerde ve sunucuda aynı saatle senkron)
export const TOWN_EVENTS = [
  { id: 'sunset_beach', emoji: '🌅', title: 'Plajda Gün Batımı Partisi', desc: 'Plajda buluşma · 2x Karizma', zone: 'beach', spawn: [0, 56] },
  { id: 'club_dance', emoji: '🎵', title: 'Klüp’te Çift Dansı Saati', desc: 'Klüp pisti · 2x Karizma', zone: 'club', spawn: [28, 0] },
  { id: 'cafe_date', emoji: '☕', title: 'Kafe Sokağı Randevu Saati', desc: 'Hızlı randevuda 2x Uyum XP', zone: 'cafe', spawn: [0, -26] },
  { id: 'gym_show', emoji: '🏆', title: 'MakFit Gösteri Maçı', desc: 'Ringde 2x Beceri', zone: 'club', spawn: [41, 4] },
]

const CYCLE_MS = 20 * 60_000
const ACTIVE_MS = 5 * 60_000

/** Şu an aktif zamanlı etkinlik varsa { active: true, event, endsInMs }, yoksa { active: false, next, startsInMs }. */
export function townEventStatus(now = Date.now()) {
  const slot = Math.floor(now / CYCLE_MS)
  const into = now % CYCLE_MS
  const ev = TOWN_EVENTS[slot % TOWN_EVENTS.length]
  if (into < ACTIVE_MS) return { active: true, event: ev, endsInMs: ACTIVE_MS - into }
  const next = TOWN_EVENTS[(slot + 1) % TOWN_EVENTS.length]
  return { active: false, next, startsInMs: CYCLE_MS - into }
}
