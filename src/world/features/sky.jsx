// Gün batımı/gece görünümü (istemci). Görsel: world/Sky.jsx.
//
// Dünya saati varsayılan olarak gün batımında başlar; Ayarlar'dan geceye alınabilir.
// Test/geliştirme URL parametreleri: ?hour=21 (saati sabitler), ?daylen=3 (bir günü 3 dk'da döndürür; ?hour başlangıç saati).
// Her saniye worldClock'a yayımlanır (publishWorld): hour, phase, night, sunset.
import { useEffect, useMemo, useState } from 'react'
import { currentHour, nightAt, phaseOf, publishWorld, realHour, setHourSource, sunsetAt } from '../worldClock'

const MODE_KEY = 'situapp_time_mode'

const MODES = [
  { id: 'dusk', emoji: '🌇', label: 'Hep gün batımı', hour: 19.2 },
  { id: 'night', emoji: '🌙', label: 'Hep gece', hour: 23 },
]
const DEFAULT_MODE = 'dusk'

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

export function useSky() {
  const q = useMemo(() => params(), [])
  const urlHour = q.get('hour') != null && Number.isFinite(+q.get('hour')) ? ((+q.get('hour') % 24) + 24) % 24 : null
  const dayLen = Number(q.get('daylen')) > 0 ? Number(q.get('daylen')) : null // dakika

  const [mode, setMode] = useState(() => {
    const savedMode = read(MODE_KEY, DEFAULT_MODE)
    return MODES.some((m) => m.id === savedMode) ? savedMode : DEFAULT_MODE
  })

  // Saat kaynağı: ?daylen ile hızlandırılmış test günü.
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
      const current = currentHour()
      const hour =
        urlHour != null && !dayLen
          ? urlHour
          : dayLen
            ? current
            : m?.hour ?? current
      const phase = phaseOf(hour)
      publishWorld({ hour, phase, night: nightAt(hour), sunset: sunsetAt(hour), weather: 'clear' })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [urlHour, dayLen, mode])

  const pickMode = (id) => {
    setMode(id)
    write(MODE_KEY, id)
  }

  const settingsSections = [
    <section key="time" className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-black text-[#4a3b5c]">🌗 Gün / Gece Döngüsü</p>
        <p className="text-xs font-semibold text-[#8a7a9c]">Gün batımı veya gece görünümünü seç.</p>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => pickMode(m.id)}
            className={`rounded-xl px-2.5 py-2 text-xs font-black transition ${mode === m.id ? 'bg-[#a88bff] text-white shadow-sm' : 'bg-[#f6f0ff] text-[#5b4678]'}`}
          >
            {m.emoji} {m.label}
          </button>
        ))}
      </div>
    </section>,
  ]

  return { settingsSections }
}
