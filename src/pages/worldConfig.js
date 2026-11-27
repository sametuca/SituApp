// Dünya sayfası sabitleri: başlangıç mekânı, avatar listesi, rehber ipuçları, geçiş mesajları ve kayıtlı avatar okuyucu.
export const NO_ITEMS = []
export const START_VENUE = 'havalimani'
export const AVATARS = ['zeynep', 'deniz', 'elif', 'kaan', 'mira', 'ege']
export const GUIDE_TIPS = [
  'Selam! Herkes yolculuğa burada, Rastla Sahili’nde başlar. Rehber için bana dokun veya yanındaki Aç düğmesine bas.',
  'Hemen yanımızdaki Beach Party masalarında en fazla 2 kişi karşılıklı oturup baş başa sohbet edebilir!',
  'Sahilde birileriyle kaynaştıktan sonra kuzey yolundan Şehir Meydanı’na, Kafe Sokağı’na ve Kulüp’e birlikte akabilirsiniz.',
  'Şezlonglarda ve kumsaldaki renkli havlularda tek başına uzanıp gün batımını izleyebilirsin.',
  'Menüdeki Gardırop ile stilini seçebilir, Evim kapısından kendi evini döşeyip sahilde tanıştıklarını davet edebilirsin.',
  'Alttaki 1–4 beceri tuşlarıyla el salla, dans et ve kalp gönder; karşılıklı kalp atarsanız eşleşirsiniz!',
]
export const TRAVEL_LOADING_MESSAGES = [
  'Sahilden yeni bir köşeye geçiyoruz…',
  'Yeni mekân, yeni sohbetler…',
  'Kumsaldan şehrin ışıklarına doğru…',
  'Manzara değişiyor, muhabbet devam ediyor!',
  'Yeni yer hazırlanıyor, az kaldı…',
  'Birlikte keşfedilecek daha çok sokak var…',
]
export function readAvatar() {
  try {
    return JSON.parse(localStorage.getItem('situapp_avatar'))
  } catch {
    return null
  }
}
