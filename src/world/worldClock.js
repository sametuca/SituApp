// Dünya saati ve hava durumu için ortak durum. Gün-gece/hava modülü yazar (publishWorld), ses/müzik ve diğerleri okur.
// worldClock alanları (modül dışından yalnızca OKU):
//   hour      0-24 arası kesirli saat (dünyanın saati)
//   phase     'dawn' | 'day' | 'dusk' | 'night'
//   night     0..1 gece yoğunluğu (0 gündüz, 1 tam gece)
//   sunset    0..1 gün batımı yoğunluğu
//   weather   'clear' | 'rain' | 'snow' | 'leaves' | 'petals' | 'fog'
export const worldClock = { hour: 12, phase: 'day', night: 0, sunset: 0, weather: 'clear' }

const subs = new Set()
export const subscribeWorld = (fn) => {
  subs.add(fn)
  return () => subs.delete(fn)
}
export const publishWorld = (patch) => {
  Object.assign(worldClock, patch)
  subs.forEach((fn) => fn(worldClock))
}
