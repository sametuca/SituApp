// Hava durumu: sunucu belirler, herkes aynı havayı görür. Mevsime ve saate göre yumuşak rastgele program (20-40 dk'lık bloklar).
//
// Sunucu → istemci
//   welcome.weather = 'clear' | 'rain' | 'snow' | 'leaves' | 'petals' | 'fog'
//   { t: 'weather', w }     hava değişti (tüm odalara)
// SITUAPP_WEATHER=rain (vb.) ile hava sabitlenir (test).
import { istanbul } from './progress.js'

export const WEATHERS = ['clear', 'snow', 'leaves', 'petals', 'fog']
const BLOCK_MIN = 20 * 60000
const BLOCK_MAX = 40 * 60000

/** Mevsim ve saate göre ağırlıklar (yağmur iptal edildi — açık güneşli/geceli gökyüzü öncelikli). */
export function weights(month, hour) {
  let w
  if (month === 12 || month <= 2) w = { clear: 56, snow: 32, fog: 12 } // kış
  else if (month <= 5) w = { clear: 68, petals: 24, fog: 8 } // ilkbahar
  else if (month <= 8) w = { clear: 92, petals: 5, fog: 3 } // yaz
  else w = { clear: 62, leaves: 30, fog: 8 } // sonbahar
  if (hour >= 5 && hour < 9 && w.fog) w.fog *= 2.0 // hafif sabah sisi
  return w
}
/** avoid: bu hava hariç seç (arka arkaya aynı hava gelmesin; açık hava bloğu sık olsun diye 'clear' sonrası da serbest). */
export function pick(month, hour, avoid, rnd = Math.random) {
  const w = weights(month, hour)
  const entries = Object.entries(w).filter(([k]) => k !== avoid)
  const total = entries.reduce((a, [, v]) => a + v, 0)
  let r = rnd() * total
  for (const [k, v] of entries) if ((r -= v) < 0) return k
  return entries[0][0]
}

export default function weather(ctx) {
  const { broadcast } = ctx
  const forced = WEATHERS.includes(process.env.SITUAPP_WEATHER) ? process.env.SITUAPP_WEATHER : null
  let current = forced ?? 'clear'
  let until = 0

  const roll = (now = Date.now()) => {
    const t = istanbul(now)
    const first = until === 0
    const next = forced ?? pick(t.m, t.hour, first ? null : current)
    until = now + BLOCK_MIN + Math.random() * (BLOCK_MAX - BLOCK_MIN)
    if (next !== current) {
      current = next
      if (!first) broadcast({ t: 'weather', w: current })
    }
  }
  roll()
  const timer = setInterval(() => {
    if (!forced && Date.now() >= until) roll()
  }, 20000)
  timer.unref?.()

  return {
    api: { weather: () => current },
    welcome: () => ({ weather: current }),
  }
}
