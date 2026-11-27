// Yükleme ekranı mesajları ve rastgele seçici.
export const WORLD_LOADING_MESSAGES = [
  'Sahil partisinde müzik açılıyor, masalar hazırlanıyor…',
  'Kumsal ısınıyor, şezlonglar ve kokteyller diziliyor…',
  'Dalgalar kıyıya vuruyor, sahil ateşi yakılıyor…',
  'Önce sahilde kaynaşıyoruz, şehrin ışıkları ileride bekliyor…',
  'Pofuduk bulutlar ve palmiyeler son rötuşta…',
  'Çantana soğuk bir sahil içeceği ekleniyor…',
]

export const randomLoadingMessage = (messages, previous = '') => {
  const choices = messages.filter((message) => message !== previous)
  return choices[Math.floor(Math.random() * choices.length)] ?? messages[0]
}
