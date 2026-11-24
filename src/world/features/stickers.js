// Pastel çıkartma setleri (4 set × 8). Kimlikler `<set>-<0..7>`; sunucudaki server/features/media.js ile aynı olmalı.
// art: büyük emoji kompozisyonu, label: kısa Türkçe etiket.
export const STICKER_SETS = [
  {
    id: 'ask',
    emoji: '💗',
    name: 'Aşk',
    bg: '#fff2e0',
    items: [
      { art: '💗🧸', label: 'Kalbim sende 💗' },
      { art: '🥺💞', label: 'Seni özledim 🥺' },
      { art: '😘💌', label: 'Öpücük yolda 😘' },
      { art: '🌹✨', label: 'Bir tanesin 🌹' },
      { art: '😍💕', label: 'Aşkım benim 😍' },
      { art: '🤗🧸', label: 'Sarıl bana 🤗' },
      { art: '💓🥰', label: 'Kalbim çarpıyor 💓' },
      { art: '🌸😊', label: 'Gülüşün çiçek 🌸' },
    ],
  },
  {
    id: 'gunluk',
    emoji: '☀️',
    name: 'Günlük',
    bg: '#fff1c9',
    items: [
      { art: '☀️🥐', label: 'Günaydın ☀️' },
      { art: '🌙😴', label: 'İyi geceler 🌙' },
      { art: '☕🍪', label: 'Kahve içelim mi? ☕' },
      { art: '🌈😊', label: 'Nasılsın? 🌈' },
      { art: '🙏💐', label: 'Teşekkürler 🙏' },
      { art: '👏🌟', label: 'Harikasın 👏' },
      { art: '🥹🌷', label: 'Özür dilerim 🥹' },
      { art: '📍🥳', label: 'Buluşalım mı? 📍' },
    ],
  },
  {
    id: 'parti',
    emoji: '🎉',
    name: 'Parti',
    bg: '#eadfff',
    items: [
      { art: '💃🕺', label: 'Dans edelim 💃' },
      { art: '🎉🪩', label: 'Parti zamanı 🎉' },
      { art: '🥂✨', label: 'Şerefe 🥂' },
      { art: '🎊🎈', label: 'Konfeti! 🎊' },
      { art: '🎧🎶', label: 'Müziği aç 🎶' },
      { art: '🌟😎', label: 'Yıldız gibisin 🌟' },
      { art: '😂🎈', label: 'Çok eğlenceli 😂' },
      { art: '🎂🕯️', label: 'Pasta var! 🎂' },
    ],
  },
  {
    id: 'tatli',
    emoji: '🧸',
    name: 'Tatlı',
    bg: '#d9f0ff',
    items: [
      { art: '🐻💙', label: 'Ayıcık sarılması 🐻' },
      { art: '🐱🐾', label: 'Miyav 🐱' },
      { art: '🐰🥕', label: 'Tavşan gibi tatlı 🐰' },
      { art: '☁️💤', label: 'Bulut gibi hafif ☁️' },
      { art: '🍦😋', label: 'Dondurma ister misin? 🍦' },
      { art: '🌈🦄', label: 'Sihirli bir gün 🦄' },
      { art: '🍭😍', label: 'Şeker gibisin 🍭' },
      { art: '🐸💚', label: 'Vak vak 🐸' },
    ],
  },
]

const BY_ID = new Map(STICKER_SETS.flatMap((s) => s.items.map((it, i) => [`${s.id}-${i}`, { ...it, id: `${s.id}-${i}`, bg: s.bg }])))
export const stickerById = (id) => BY_ID.get(id) ?? null
