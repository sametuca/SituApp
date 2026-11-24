// Konut Mahallesi (istemci): parsel verisi ağdan, kapıya yaklaşınca "Gir" istemi, Döşe → 🏡 Dış görünüm sekmesi.
// Sunucu: server/features/neighborhood.js. Çizim: src/world/Neighborhood.jsx. Veri: neighborhoodStore.js.
import { useEffect, useRef, useState } from 'react'
import { DoorPrompt } from '../Social'
import { DEFAULT_EXTERIOR, DOOR_COLORS, FENCES, GARDEN_ITEMS, HOUSES, PLOTS, WELCOME_MAX, sanitizeExterior } from '../neighborhood'
import { together } from './togetherStore'
import { plotNav, plotOfKey, plotStore, setAllPlots, setPlot } from './neighborhoodStore'

const pillBase = 'shrink-0 rounded-full border-2 border-white px-3 py-1.5 text-xs font-extrabold shadow-soft transition active:scale-95'

function Row({ label, children }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs font-black text-[#4a3b5c]">{label}</span>
      <div className="flex gap-1.5 overflow-x-auto py-1">{children}</div>
    </div>
  )
}

function ExteriorTab({ ext, onChange, plotN }) {
  const [msg, setMsg] = useState(ext.welcome)
  const msgTimer = useRef(null)
  useEffect(() => () => clearTimeout(msgTimer.current), [])
  const pick = (cls, on) => `${pillBase} ${on ? 'bg-[#a88bff] text-white' : 'bg-white/80 text-[#4a3b5c]'} ${cls}`
  return (
    <div className="flex max-h-[38svh] flex-col gap-1 overflow-y-auto pb-1">
      <p className="rounded-2xl bg-white/60 px-3 py-1.5 text-[11px] font-bold text-[#8a7a9c]">
        {plotN ? `🏘️ Konut Mahallesi · ${plotN}. parsel — değişiklikler herkese görünür.` : '🏘️ İlk değişikliğinde Konut Mahallesi’nde sana bir parsel verilir.'}
      </p>
      <Row label="Ev stili">
        {HOUSES.map((h) => (
          <button key={h.id} aria-pressed={ext.house === h.id} onClick={() => onChange({ house: h.id })} className={pick('', ext.house === h.id)}>
            {h.emoji} {h.name}
          </button>
        ))}
      </Row>
      <Row label="Çit">
        {FENCES.map((f) => (
          <button key={f.id} aria-pressed={ext.fence === f.id} onClick={() => onChange({ fence: f.id })} className={pick('', ext.fence === f.id)}>
            {f.emoji} {f.name}
          </button>
        ))}
      </Row>
      <Row label="Bahçe">
        {GARDEN_ITEMS.map((g) => (
          <button key={g.id} role="switch" aria-checked={ext.garden[g.id]} onClick={() => onChange({ garden: { ...ext.garden, [g.id]: !ext.garden[g.id] } })} className={pick('', ext.garden[g.id])}>
            {g.emoji} {g.name}
          </button>
        ))}
      </Row>
      <Row label="Kapı">
        {DOOR_COLORS.map((c) => (
          <button
            key={c.id}
            aria-label={c.name}
            aria-pressed={ext.door === c.id}
            onClick={() => onChange({ door: c.id })}
            style={{ background: c.hex }}
            className={`h-9 w-9 shrink-0 rounded-full border-4 shadow-soft transition active:scale-90 ${ext.door === c.id ? 'border-[#4a3b5c]' : 'border-white'}`}
          />
        ))}
      </Row>
      <label className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-xs font-black text-[#4a3b5c]">Mesaj</span>
        <input
          value={msg}
          maxLength={WELCOME_MAX}
          placeholder="Kapı tabelasında görünen hoş geldin mesajı"
          onChange={(e) => {
            const v = e.target.value.slice(0, WELCOME_MAX)
            setMsg(v)
            clearTimeout(msgTimer.current)
            msgTimer.current = setTimeout(() => onChange({ welcome: v }), 500)
          }}
          className="min-w-0 flex-1 rounded-2xl border-2 border-white bg-white/85 px-3 py-2 text-sm font-bold text-[#4a3b5c] outline-none placeholder:text-[#b9aecb] focus:border-[#c9b6f5]"
        />
        <span className="w-9 shrink-0 text-right text-[10px] font-black text-[#8a7a9c]">
          {msg.length}/{WELCOME_MAX}
        </span>
      </label>
    </div>
  )
}

export function useNeighborhood(ctx) {
  const { net, home, venue, focusRef, enterHome } = ctx
  const { on, send, homeKey } = net
  const [ownExt, setOwnExt] = useState(null) // sunucudan gelen kendi dış görünümüm
  const [plotN, setPlotN] = useState(null)
  const [nearId, setNearId] = useState(null) // yaklaştığım parselin kimliği
  const [busy, setBusy] = useState(false)
  const timer = useRef(null)
  const homeKeyRef = useRef(homeKey)
  useEffect(() => {
    homeKeyRef.current = homeKey
  }, [homeKey])

  // ağ: toplu parsel listesi (welcome) ve tek parsel güncellemesi (plot)
  useEffect(() => {
    const offs = [
      on('welcome', (m) => {
        setAllPlots(m.plots)
        setOwnExt(m.myExt ? sanitizeExterior(m.myExt) : null)
        const mine = (m.plots ?? []).find((p) => p.key === m.home)
        setPlotN(mine ? Number(mine.id.slice(1)) : null)
      }),
      on('plot', (m) => {
        setPlot(m.p)
        if (m.p.key === homeKeyRef.current) {
          setOwnExt(sanitizeExterior(m.p.ext))
          setPlotN(Number(m.p.id.slice(1)))
        }
      }),
      on('denied', () => {
        plotNav.exit = null // girişim reddedildi: çıkış noktasını unutma
        setBusy(false)
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [on])
  useEffect(() => () => clearTimeout(timer.current), [])

  // kapıya yaklaşma (6 Hz)
  useEffect(() => {
    if (home || venue) {
      setNearId(null)
      return
    }
    const t = setInterval(() => {
      const f = focusRef.current
      let best = null
      let bestD = Infinity
      for (const p of PLOTS) {
        if (!plotStore.plots.has(p.id)) continue
        const d = Math.hypot(f.x - p.door.x, f.z - p.door.z)
        if (d < p.door.radius && d < bestD) {
          best = p.id
          bestD = d
        }
      }
      setNearId((cur) => (cur === best ? cur : best))
    }, 160)
    return () => clearInterval(t)
  }, [home, venue, focusRef])

  const near = nearId ? plotStore.plots.get(nearId) : null
  const nearPlot = near ? PLOTS.find((p) => p.id === nearId) : null
  const mine = Boolean(near) && near.key === homeKey

  const go = () => {
    if (!near || !nearPlot || busy || together.self.current) return
    setBusy(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setBusy(false), 900)
    plotNav.exit = nearPlot.door.exit
    enterHome?.(near.key)
  }
  const goRef = useRef(go)
  useEffect(() => {
    goRef.current = go
  })
  useEffect(() => {
    const onKey = (e) => {
      const typing = e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)
      if (e.code === 'KeyE' && !typing) goRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Döşe → Dış görünüm
  const sendTimer = useRef(null)
  useEffect(() => () => clearTimeout(sendTimer.current), [])
  const ext = ownExt ?? DEFAULT_EXTERIOR
  const extRef = useRef(ext)
  useEffect(() => {
    extRef.current = ext
  })
  const change = (patch) => {
    const next = sanitizeExterior({ ...extRef.current, ...patch }, (s) => s)
    extRef.current = next
    setOwnExt(next) // hemen göster; sunucu doğrulayıp yayınlar
    clearTimeout(sendTimer.current)
    sendTimer.current = setTimeout(() => send({ t: 'exterior_set', ext: extRef.current }), 250)
  }
  const editorTabs = [{ key: 'exterior', label: '🏡 Dış görünüm', render: () => <ExteriorTab ext={ext} onChange={change} plotN={plotN} /> }]

  const overlays =
    near && !home && !venue && !busy ? (
      <DoorPrompt
        emoji={near.open || mine ? '🔓' : '🔒'}
        label={mine ? 'Evine gir' : `${near.name} evi${near.open ? ' · herkese açık' : ' · kapalı (davet gerekir)'}`}
        action="Gir"
        touch={ctx.touch}
        raised={false}
        onGo={go}
      />
    ) : null

  return { overlays, editorTabs, plotOfKey }
}
