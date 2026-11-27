// Dünya saati ve hava durumu için ortak durum. Gün-gece/hava modülü yazar (publishWorld), ses/müzik ve diğerleri okur.
// worldClock alanları (modül dışından yalnızca OKU):
//   hour      0-24 arası kesirli saat (dünyanın saati)
//   phase     'dawn' | 'day' | 'dusk' | 'night'
//   night     0..1 gece yoğunluğu (0 gündüz, 1 tam gece)
//   sunset    0..1 gün batımı yoğunluğu
//   weather   'clear' | 'rain' | 'snow' | 'leaves' | 'petals'
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

// ---------------------------------------------------------------- saat hesabı (gün-gece modülü kullanır)
export const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** 0..1 gece yoğunluğu: 05-07 arası şafakla azalır, 19-21 arası artar. */
export const nightAt = (h) => 1 - smooth(5, 7, h) + smooth(19, 21, h)
/** 0..1 gün batımı yoğunluğu (17:00 başlar, 18:45-19:20 en yoğun, 21:00'de biter). */
export const sunsetAt = (h) => smooth(17, 18.7, h) * (1 - smooth(19.3, 21, h))
export const phaseOf = (h) => {
  if (nightAt(h) >= 0.6) return 'night'
  if (h < 12) return h < 8 ? 'dawn' : 'day'
  return h >= 17.3 ? 'dusk' : 'day'
}

/** 10:00-16:00 local time maps to a 12-hour world day; the remaining 18 hours map to world night. */
export function longNightHour(h) {
  const elapsed = ((h - 10) % 24 + 24) % 24
  if (elapsed < 6) return 7 + elapsed * 2
  return (19 + (elapsed - 6) * (2 / 3)) % 24
}

const TR = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
/** Gerçek yerel saat (Europe/Istanbul), kesirli. */
export function realHour(now = Date.now()) {
  const p = Object.fromEntries(TR.formatToParts(now).map((x) => [x.type, x.value]))
  return +p.hour + +p.minute / 60 + +p.second / 3600
}

// Dünya saatinin kaynağı: null = gerçek saat. Hızlandırılmış "oyun saati" için setHourSource(() => saat) verilebilir.
let hourSource = null
export const setHourSource = (fn) => {
  hourSource = typeof fn === 'function' ? fn : null
}
export const currentHour = () => (hourSource ? ((hourSource() % 24) + 24) % 24 : realHour())

export const fmtHour = (h) => {
  const m = Math.floor((((h % 24) + 24) % 24) * 60)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
