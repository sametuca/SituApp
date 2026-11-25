// Oyuncular arası etkileşim sabitleri (sunucudaki REACTIONS / GESTURES ile aynı olmalı: server/game.js).

/** Kafanın üstünde uçan emoji tepkileri; 1-9 ve 0 tuşları sırayla bunları gönderir. */
export const REACTIONS = ['❤️', '😘', '😍', '🥰', '😂', '😳', '🔥', '👋', '😉', '🥺', '💃', '🎉']

/** Alt beceri çubuğu (Skill 1-4): her biri 5 sn bekleme süreli hızlı ifade/eylem. */
export const SKILLS = [
  { id: 'wave', key: '1', emoji: '👋', label: 'Selam', sfx: 'pop' },
  { id: 'dance', key: '2', emoji: '💃', label: 'Dans', sfx: 'dance', pose: 'dance', dur: 2600 },
  { id: 'heart', key: '3', emoji: '❤️', label: 'Kalp', sfx: 'heart' },
  { id: 'party', key: '4', emoji: '🎉', label: 'Kutla', sfx: 'collect' },
]
export const SKILL_COOLDOWN_MS = 5000

/** Birine yönelik jestler. text: alıcıda "X ..." diye okunur. */
export const GESTURES = [
  { kind: 'heart', emoji: '💗', label: 'Kalp', text: 'sana kalp gönderdi' },
  { kind: 'flower', emoji: '🌸', label: 'Çiçek', text: 'sana çiçek verdi' },
  { kind: 'wink', emoji: '😉', label: 'Göz kırp', text: 'sana göz kırptı' },
  { kind: 'kiss', emoji: '😘', label: 'Öpücük', text: 'sana öpücük gönderdi' },
  { kind: 'wave', emoji: '👋', label: 'Selam', text: 'sana el salladı' },
  { kind: 'dance', emoji: '💃', label: 'Dans', text: 'seni dansa davet ediyor' },
]
export const GESTURE_BY_KIND = Object.fromEntries(GESTURES.map((g) => [g.kind, g]))

export const WHISPER_RANGE = 7 // m (sunucuyla aynı)
export const GESTURE_RANGE = 8 // m

/** Sohbet kutusundaki emoji seçici. */
export const CHAT_EMOJIS = ['😊', '😂', '🥰', '😍', '😘', '😉', '😳', '🥺', '😎', '🤗', '🔥', '💗', '💫', '🌸', '🍹', '🎶']

/** Hazır, flörtöz-tatlı cevaplar. */
export const QUICK_REPLIES = ['Merhaba 👋', 'Nasılsın?', 'Çok tatlısın 🥰', 'Gülüşün çok güzel 😊', 'Kahve içelim mi? ☕', 'Dans edelim mi? 💃', 'Yürüyüşe çıkalım mı? 🌙', 'Seninle tanışmak güzel 💫']
