// Yükleme ekranı mesajları ve rastgele seçici.
export const WORLD_LOADING_MESSAGES = [
  'Şehir hazırlanıyor, kaldırımlar son rötuşta…',
  'Pofuduk bulutlar kabartılıyor…',
  'Meydana biraz neşe serpiştiriliyor…',
  'Sokaklar toparlanıyor, az kaldı!',
  'Dükkânlar kapılarını açmaya hazırlanıyor…',
  'Macera çantana son atıştırmalıklar ekleniyor…',
]

export const randomLoadingMessage = (messages, previous = '') => {
  const choices = messages.filter((message) => message !== previous)
  return choices[Math.floor(Math.random() * choices.length)] ?? messages[0]
}
