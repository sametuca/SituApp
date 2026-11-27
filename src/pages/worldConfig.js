// Dünya sayfası sabitleri: başlangıç mekânı, avatar listesi, rehber ipuçları, geçiş mesajları ve kayıtlı avatar okuyucu.
export const NO_ITEMS = []
export const START_VENUE = 'havalimani'
export const AVATARS = ['zeynep', 'deniz', 'elif', 'kaan', 'mira', 'ege']
export const GUIDE_TIPS = [
  'Selam! Ben Rehber. Nasıl oynanır penceresi için bana tıkla ya da E / H tuşuna bas.',
  'Soldaki Gardırop düğmesiyle saç, aksesuar ve dostunu dilediğin gibi değiştirebilirsin.',
  'Sağ üstteki yuvarlak haritaya basarak Kafe, Kulüp, Park ve Plaj’a tek tıkla ışınlan.',
  'Lobinin güneybatısındaki Evim kapısından (veya /ev yazarak) evine girip döşeyebilirsin.',
  'Enter’a basıp yazarsan mesajın başının üstünde balon olur.',
  'Alttaki 1–4 tuşlarıyla selam, dans, kalp ve kutlama tepkilerini kullanabilirsin.',
]
export const TRAVEL_LOADING_MESSAGES = [
  'Hop, yeni bir köşeye geçiyoruz…',
  'Yeni mekân, yeni hikâyeler…',
  'Manzara değişiyor, keyif aynı!',
  'Bir kapıdan kocaman bir maceraya…',
  'Yeni yer hazırlanıyor, az kaldı…',
  'Yol kısacık, merak uzun…',
]
export function readAvatar() {
  try {
    return JSON.parse(localStorage.getItem('situapp_avatar'))
  } catch {
    return null
  }
}
