// Gün-gece döngüsü + hava durumu (istemci). Sunucu: server/features/weather.js (hava). Görsel: world/Sky.jsx, world/WeatherFx.jsx.
//
// Dünya saati: varsayılan gerçek yerel saat (Europe/Istanbul). Ayarlar → "🌗 Zaman": Gerçek saat / Hep gündüz / Hep gün batımı / Hep gece (localStorage).
// Test/geliştirme URL parametreleri: ?hour=21 (saati sabitler), ?daylen=3 (bir günü 3 dk'da döndürür; ?hour başlangıç saati),
// ?weather=rain (sunucu havasını yok sayar).
// Her saniye worldClock'a yayımlanır (publishWorld): hour, phase, night, sunset, weather.
import { useEffect, useMemo, useState } from 'react'
import WeatherFx from '../WeatherFx'
import { currentHour, nightAt, phaseOf, publishWorld, realHour, setHourSource, sunsetAt } from '../worldClock'

const MODE_KEY = 'situapp_time_mode'
const FX_KEY = 'situapp_weather_fx'
const EVENT_FX_KEY = 'situapp_fx' // progress.jsx: etkinlik efektleri açık mı

const MODES = [
  { id: 'real', emoji: '🕒', label: 'Gerçek saat', hour: null },
  { id: 'day', emoji: '☀️', label: 'Hep gündüz', hour: 12.5 },
  { id: 'dusk', emoji: '🌇', label: 'Hep gün batımı', hour: 19.2 },
  { id: 'night', emoji: '🌙', label: 'Hep gece', hour: 23 },
]
const WEATHER_EMOJI = { clear: '', rain: '🌧️', snow: '❄️', leaves: '🍂', petals: '🌸', fog: '🌫️' }
const WEATHER_NAME = { clear: 'Açık', rain: 'Yağmurlu', snow: 'Karlı', leaves: 'Yaprak savruluyor', petals: 'Çiçek yaprakları', fog: 'Sisli' }
const WEATHERS = Object.keys(WEATHER_NAME)

const read = (key, fallback) => {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}
const write = (key, v) => {
  try {
    localStorage.setItem(key, v)
  } catch {
    /* depolama kapalı */
  }
}

const params = () => new URLSearchParams(typeof location === 'undefined' ? '' : location.search)

function Toggle({ on, onClick }) {
  return (
    <button role="switch" aria-checked={on} onClick={onClick} className={`relative h-8 w-14 shrink-0 rounded-full border-2 border-white transition ${on ? 'bg-[#a88bff]' : 'bg-[#d9d0e6]'}`}>
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-7' : 'left-0.5'}`} />
    </button>
  )
}

// Gece-gündüz döngüsü şimdilik kapalı: oyun hep gündüz (tatlı, aydınlık görünüm). Geri açmak için false yap. Test için ?hour= ve ?daylen= yine çalışır.
const DAY_ONLY = true

export function useSky({ net, touch, home, venue, focusRef }) {
  const { on } = net
  const q = useMemo(() => params(), [])
  const urlHour = q.get('hour') != null && Number.isFinite(+q.get('hour')) ? ((+q.get('hour') % 24) + 24) % 24 : null
  const dayLen = Number(q.get('daylen')) > 0 ? Number(q.get('daylen')) : null // dakika
  const urlWeather = WEATHERS.includes(q.get('weather')) ? q.get('weather') : null

  const [mode] = useState(() => (MODES.some((m) => m.id === read(MODE_KEY, 'real')) ? read(MODE_KEY, 'real') : 'real'))
  const [fxOn, setFxOn] = useState(() => read(FX_KEY, '1') !== '0')
  const [srvWeather, setSrvWeather] = useState('clear')
  const [eventOn, setEventOn] = useState(false)
  const weather = urlWeather ?? srvWeather

  // sunucudan hava + etkinlik bilgisi
  useEffect(() => {
    const offs = [
      on('welcome', (m) => {
        setSrvWeather(WEATHERS.includes(m.weather) ? m.weather : 'clear')
        setEventOn(Boolean(m.event))
      }),
      on('weather', (m) => WEATHERS.includes(m.w) && setSrvWeather(m.w)),
      on('event', (m) => setEventOn(Boolean(m.event))),
    ]
    return () => offs.forEach((off) => off())
  }, [on])

  // saat kaynağı: ?daylen ile hızlandırılmış gün
  useEffect(() => {
    if (!dayLen) return undefined
    const t0 = performance.now()
    const h0 = urlHour ?? realHour()
    setHourSource(() => h0 + ((performance.now() - t0) / (dayLen * 60000)) * 24)
    return () => setHourSource(null)
  }, [dayLen, urlHour])

  // her saniye dünya saatini yayımla (yalnızca worldClock'a yazar, gereksiz React yeniden çizimi yapmaz)
  useEffect(() => {
    const tick = () => {
      const m = MODES.find((x) => x.id === mode)
      const hour = urlHour != null && !dayLen ? urlHour : DAY_ONLY ? 12.5 : m?.hour != null ? m.hour : currentHour()
      const phase = phaseOf(hour)
      publishWorld({ hour, phase, night: nightAt(hour), sunset: sunsetAt(hour), weather })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [urlHour, dayLen, mode, weather])

  const toggleFx = () => {
    const v = !fxOn
    setFxOn(v)
    write(FX_KEY, v ? '1' : '0')
  }

  const settingsSections = [
    <section key="weather" className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-[#4a3b5c]">🌦️ Hava efektleri</p>
        <p className="text-xs font-semibold text-[#8a7a9c]">Yağmur, kar ve uçuşan yapraklar. Telefonun yavaşlarsa kapat.</p>
      </div>
      <Toggle on={fxOn} onClick={toggleFx} />
    </section>,
  ]

  const wEmoji = WEATHER_EMOJI[weather]
  // gece-gündüz kapalı olduğundan menüde saat satırı yok; yalnızca hava durumu açık değilse küçük bir satır
  const menuNodes = wEmoji && weather !== 'clear' ? (
    <div className="flex items-center gap-3 rounded-2xl bg-[#f3f0fa] px-3 py-2 text-sm font-extrabold text-[#4a3b5c]">
      <span className="flex-1">{WEATHER_NAME[weather]}</span>
      <span className="text-lg">{wEmoji}</span>
    </div>
  ) : null

  const reduced = eventOn && read(EVENT_FX_KEY, '1') !== '0'
  const worldEffects = fxOn && !home && !venue ? <WeatherFx focusRef={focusRef} touch={touch} reduced={reduced} /> : null
  return { settingsSections, menuNodes, worldEffects }
}
