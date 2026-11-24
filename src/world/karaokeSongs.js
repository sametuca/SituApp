// Gece Kulübü karaokesi: özgün, tatlı/komik şarkı sözleri (hiçbiri bilinen bir şarkıdan alınmadı).
// Sunucu (server/features/venues.js) yalnızca kimlikleri ve süreleri kullanır; sözler istemcide akar.
export const KARAOKE_STAGE_MS = 30000 // sahnede kalma süresi
export const KARAOKE_QUEUE_MAX = 6 // bekleyen en fazla kişi
export const KARAOKE_VENUE = 'kulup'

export const KARAOKE_SONGS = [
  {
    id: 'simit',
    emoji: '🥯',
    title: 'Simit Aşkı',
    tag: 'Komik',
    lines: [
      'Sabah sabah fırına koştum',
      'Sıcacık simidi kapıp kaçtım',
      'Susamlar döküldü, kalbim döküldü',
      'Çayı demledim ama sen yoksun yanımda',
      'Ah simit, ah simit, yuvarlak sevgilim',
      'Bir ısırık al da bırak beni',
      'Poğaça kıskandı, açma sinirlendi',
      'Ben senden başkasına bakmam, yeminim',
      'Ah simit, ah simit, çayın yanında ol',
      'Seni yarım yemem, bütün yerim!',
    ],
  },
  {
    id: 'bulut',
    emoji: '☁️',
    title: 'Pembe Bulut',
    tag: 'Tatlı',
    lines: [
      'Gökyüzünde pembe bir bulut var',
      'Üstüne atladım, sana uçtum yar',
      'Rüzgâr şeker kokuyor bugün',
      'Sen gülünce çiçek açıyor her gün',
      'La la la, kalbim bir balon',
      'Bırak ipimi, sana doğru uçsun',
      'Yıldızlar göz kırpıyor bize',
      'Ay bile gülümsüyor dize dize',
      'Pembe bulut, al beni yanına',
      'Bir ömür gezelim, hiç inmeyelim yere',
    ],
  },
  {
    id: 'kedi',
    emoji: '🐱',
    title: 'Mırıl Mırıl',
    tag: 'Eğlenceli',
    lines: [
      'Mırıl mırıl, kalbim kedi gibi',
      'Seni görünce dolanırım ayaklarına',
      'Kuyruğum dik, bıyığım titrer',
      'Gözlerin süt gibi, tatlı mı tatlı',
      'Miyav miyav, bana bir kucak aç',
      'Sıcacık bir köşe, bir de sen yeter',
      'Gece çatıya çıkar, aya bakarız',
      'Sabah olunca mama kasesine koşarız',
      'Miyav miyav, sen benim kahramanım',
      'Yeter ki yanımda ol, gerisi mırıl mırıl',
    ],
  },
]
export const KARAOKE_SONG_BY_ID = Object.fromEntries(KARAOKE_SONGS.map((s) => [s.id, s]))
