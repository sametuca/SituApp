// İlerleme (istemci): günlük görevler, rozetler, günün önerisi ve sezon etkinliği. Sunucu: server/features/progress.js.
import { useCallback, useEffect, useRef, useState } from 'react'
import { ToyButton } from '../../components/ui'
import { Modal } from '../Hud'
import EventFx from './EventFx'

const FX_KEY = 'situapp_fx'
const readFx = () => {
  try {
    return localStorage.getItem(FX_KEY) !== '0'
  } catch {
    return true
  }
}

// ---------------------------------------------------------------- küçük parçalar
function Bar({ value, max, tone = '#fdb252' }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#f1e6ff]">
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.round((Math.min(value, max) / max) * 100)}%`, background: tone }} />
    </div>
  )
}

const PIECES = Array.from({ length: 26 }, (_, i) => ({
  dx: Math.round(Math.cos((i / 26) * Math.PI * 2) * (90 + (i % 3) * 40)),
  dy: Math.round(Math.sin((i / 26) * Math.PI * 2) * (70 + (i % 4) * 30) - 30),
  rot: (i * 47) % 360,
  color: ['#fdb252', '#a9ddf5', '#ffe48f', '#b9ebcf', '#d6c7ff'][i % 5],
  delay: (i % 5) * 0.03,
}))

/** Görev/rozet kutlaması: ortada kart + konfeti patlaması. */
function Celebration({ toast }) {
  const quest = toast.kind === 'quest'
  return (
    <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center" role="status" aria-live="polite">
      <div className="relative animate-pop">
        {PIECES.map((p, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute left-1/2 top-1/2 h-2.5 w-2 rounded-sm"
            style={{ background: p.color, '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--rot': `${p.rot}deg`, animation: `confetti-burst 1.4s ${p.delay}s ease-out forwards`, opacity: 0 }}
          />
        ))}
        <div className="flex w-[min(86vw,19rem)] flex-col items-center gap-1.5 rounded-[2rem] border-2 border-white bg-white/95 px-6 py-5 text-center shadow-toy">
          <p className="text-xs font-extrabold uppercase tracking-wide text-[#fdb252]">{quest ? 'Görev tamamlandı!' : 'Yeni rozet!'}</p>
          <p className="text-lg font-black text-[#4a3b5c]">{quest ? toast.title : toast.name}</p>
          <p className="text-sm font-bold text-[#8a7a9c]">{quest ? `+${toast.stars} Yıldız kazandın` : toast.desc}</p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- görev & rozet paneli
function QuestPanel({ prog, onClose }) {
  const [tab, setTab] = useState('quests')
  const badges = prog?.badges ?? []
  const earned = badges.filter((b) => b.earned).length
  return (
    <Modal onClose={onClose} label="Görevler ve rozetler">
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 flex-1 text-2xl font-black text-[#4a3b5c]">{tab === 'quests' ? 'Günlük görevler' : 'Rozetlerim'}</h2>
        <span className="rounded-full bg-[#ffe48f] px-3 py-1 text-sm font-black text-[#7a5b00]">{prog?.stars ?? 0} yıldız</span>
      </div>
      <div className="mt-3 flex gap-2" role="tablist">
        {[
          ['quests', 'Görevler'],
          ['badges', `Rozetler ${earned}/${badges.length || 12}`],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex-1 rounded-2xl px-2 py-2.5 text-sm font-extrabold transition active:scale-95 ${tab === id ? 'bg-[#fdb252] text-white shadow-soft' : 'bg-[#f6f0ff] text-[#4a3b5c]'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {!prog ? (
        <p className="mt-6 text-center text-sm font-semibold text-[#8a7a9c]">Yükleniyor… (çevrimdışıysan görevler görünmez)</p>
      ) : tab === 'quests' ? (
        <>
          {prog.streak > 0 && <p className="mt-3 text-sm font-extrabold text-[#e8952c]">{prog.streak} günlük seri</p>}
          <ul className="mt-3 flex flex-col gap-2.5">
            {prog.quests.map((q) => (
              <li key={q.id} className={`rounded-2xl border-2 px-3 py-2.5 ${q.done ? 'border-[#b9ebcf] bg-[#effcf4]' : 'border-white bg-[#fbf7ff]'} shadow-soft`}>
                <div className="flex items-center gap-2">
                  <p className={`min-w-0 flex-1 text-sm font-extrabold ${q.done ? 'text-[#2f7a55]' : 'text-[#4a3b5c]'}`}>{q.title}</p>
                  <span className="shrink-0 rounded-full bg-[#fff3c4] px-2 py-0.5 text-xs font-black text-[#7a5b00]">+{q.stars} yıldız</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Bar value={q.progress} max={q.goal} tone={q.done ? '#7ed6a4' : '#fdb252'} />
                  <span className="shrink-0 text-xs font-extrabold tabular-nums text-[#8a7a9c]">
                    {q.progress}/{q.goal}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs font-semibold text-[#8a7a9c]">Yeni görevler her gece yarısı (Türkiye saati) gelir.</p>
        </>
      ) : (
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {badges.map((b) => (
            <li
              key={b.id}
              title={b.desc}
              className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-1.5 py-2.5 text-center ${b.earned ? 'border-[#ffe48f] bg-[#fffbea] shadow-soft' : 'border-white bg-[#f3eef9] opacity-55 grayscale'}`}
            >
              <span className="text-[0.6875rem] font-black leading-tight text-[#4a3b5c]">{b.name}</span>
              <span className="text-[0.625rem] font-semibold leading-tight text-[#8a7a9c]">{b.desc}</span>
              {!b.earned && b.goal > 1 && (
                <span className="mt-0.5 w-full">
                  <Bar value={b.have} max={b.goal} />
                  <span className="text-[0.625rem] font-extrabold tabular-nums text-[#8a7a9c]">
                    {b.have}/{b.goal}
                  </span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <ToyButton onClick={onClose} className="mt-5 !py-3 !text-base">
        Tamam
      </ToyButton>
    </Modal>
  )
}

function EventCard({ event, fxOn, onToggleFx, onClose }) {
  return (
    <Modal onClose={onClose} label={event.name}>
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="text-6xl">{event.emoji}</span>
        <h2 className="text-2xl font-black text-[#4a3b5c]">{event.name}</h2>
        <p className="text-sm font-semibold text-[#8a7a9c]">{event.desc}</p>
        <button onClick={onToggleFx} className="mt-1 rounded-full bg-[#f6f0ff] px-4 py-2 text-xs font-extrabold text-[#7a5fd0] active:scale-95">
          ✨ Efektler: {fxOn ? 'açık' : 'kapalı'}
        </button>
      </div>
      <ToyButton onClick={onClose} className="mt-5 !py-3 !text-base">
        Süper!
      </ToyButton>
    </Modal>
  )
}

function SuggestCard({ s, onHi, onClose }) {
  const tags = s.common?.length ? s.common.join(' ') : ''
  return (
    <div className="absolute left-[4.5rem] right-32 top-24 z-20 flex max-w-[22rem] animate-pop items-center gap-3 rounded-3xl border-2 border-white bg-white/90 p-3 shadow-toy backdrop-blur-md">
      <img src={`/avatars/${s.avatar}.png`} alt="" width="44" height="44" className="h-11 w-11 shrink-0 rounded-full border-2 border-white bg-white/60 object-cover object-top" />
      <div className="min-w-0 flex-1">
        <p className="text-[0.6875rem] font-extrabold uppercase tracking-wide text-[#fdb252]">Bugünün önerisi</p>
        <p className="line-clamp-2 text-sm font-black text-[#4a3b5c]">
          {s.name} {tags ? <>{tags} <span className="font-bold text-[#8a7a9c]">ortak ilgi</span></> : <span className="font-bold text-[#8a7a9c]">✨ tanışmaya ne dersin?</span>}
        </p>
        <button onClick={onHi} className="mt-1.5 rounded-xl border-b-4 border-[#e8952c] bg-[#fdb252] px-3 py-1.5 text-sm font-extrabold text-white active:translate-y-[2px] active:border-b-2">
          👋 Merhaba de
        </button>
      </div>
      <button onClick={onClose} aria-label="Öneriyi kapat" className="grid h-9 w-9 shrink-0 place-items-center self-start rounded-full text-sm font-black text-[#8a7a9c] hover:bg-[#ffedd6]/70">
        ✖️
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- hook
export function useProgress({ net, say, focusRef, home, venue, panel, setPanel, roster }) {
  const { on, send, status } = net
  const [prog, setProg] = useState(null)
  const [event, setEvent] = useState(null)
  const [suggest, setSuggest] = useState(null)
  const [toasts, setToasts] = useState([])
  const [fxOn, setFxOn] = useState(readFx)
  const askDone = useRef(false)

  const toggleFx = useCallback(() => {
    setFxOn((v) => {
      try {
        localStorage.setItem(FX_KEY, v ? '0' : '1')
      } catch {
        /* sorun değil */
      }
      return !v
    })
  }, [])

  useEffect(() => {
    const offs = [
      on('welcome', (m) => {
        setProg(m.progress ?? null)
        setEvent(m.event ?? null)
        askDone.current = false
      }),
      on('progress', (m) => setProg(m.p)),
      on('quest_done', (m) => {
        setToasts((t) => [...t, { key: Math.random(), kind: 'quest', ...m.quest }])
      }),
      on('badge', (m) => {
        // aynı rozet bu tarayıcıda bir kez gösterilir (sunucu verisi sıfırlansa/yeniden bağlansa tekrar tekrar çıkmasın)
        try {
          const k = `situapp_badge_seen:${net.homeKey ?? ''}`
          const seen = JSON.parse(localStorage.getItem(k) || '[]')
          if (seen.includes(m.badge.id)) return
          localStorage.setItem(k, JSON.stringify([...seen, m.badge.id]))
        } catch {
          /* depolama yoksa yine göster */
        }
        setToasts((t) => [...t, { key: Math.random(), kind: 'badge', ...m.badge }])
      }),
      on('event', (m) => {
        setEvent(m.event ?? null)
      }),
      on('suggest', (m) => {
        setSuggest(m.s ?? null)
        if (!m.wait) askDone.current = true
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [on])

  // günün önerisi: bağlanınca biraz bekle, kimse yoksa ara sıra yeniden sor
  useEffect(() => {
    if (status !== 'online') return
    const ask = () => !askDone.current && send({ t: 'suggest_get' })
    const first = setTimeout(ask, 7000)
    const again = setInterval(ask, 75000)
    return () => {
      clearTimeout(first)
      clearInterval(again)
    }
  }, [status, send])

  // kutlamaları sırayla göster
  const current = toasts[0]
  useEffect(() => {
    if (!current) return
    const t = setTimeout(() => setToasts((l) => l.slice(1)), 3800)
    return () => clearTimeout(t)
  }, [current])

  // panel açılınca güncel durumu iste
  useEffect(() => {
    if (panel === 'quests') send({ t: 'progress_get' })
  }, [panel, send])

  const remaining = prog ? prog.quests.filter((q) => !q.done).length : 0
  const menuNodes = (
    <>
      <button onClick={() => setPanel('quests')} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-extrabold text-[#4a3b5c] transition hover:bg-[#fff8f0]">
        <span className="text-lg">⭐</span>
        <span className="flex-1">Görevler ve Rozetler</span>
        {remaining > 0 && <span className="rounded-full bg-[#fdb252] px-2 py-0.5 text-[11px] font-black text-white">{remaining}</span>}
      </button>
      {event && (
        <button onClick={() => setPanel('event')} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-extrabold text-[#4a3b5c] transition hover:bg-[#fff8f0]">
          <span className="text-lg">{event.emoji}</span>
          <span className="flex-1">{event.name}</span>
        </button>
      )}
    </>
  )

  const settingsSections = [
    <section key="fx" className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-[#4a3b5c]">Etkinlik efektleri</p>
        <p className="text-xs font-semibold text-[#8a7a9c]">Sezon etkinliklerinde havada uçuşan kalp, kar ve konfeti. Telefonun yavaşlarsa kapat.</p>
      </div>
      <button
        role="switch"
        aria-checked={fxOn}
        onClick={toggleFx}
        className={`relative h-8 w-14 shrink-0 rounded-full border-2 border-white transition ${fxOn ? 'bg-[#a88bff]' : 'bg-[#d9d0e6]'}`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${fxOn ? 'left-7' : 'left-0.5'}`} />
      </button>
    </section>,
  ]

  const closeSuggest = () => {
    send({ t: 'suggest_close' })
    setSuggest(null)
  }
  const showSuggest = suggest && roster.some((p) => p.id === suggest.id)

  const overlays = (
    <>
      {panel === 'quests' && <QuestPanel prog={prog} onClose={() => setPanel(null)} />}
      {panel === 'event' && event && <EventCard event={event} fxOn={fxOn} onToggleFx={toggleFx} onClose={() => setPanel(null)} />}
      {showSuggest && !panel && (
        <SuggestCard
          s={suggest}
          onHi={() => {
            send({ t: 'suggest_hi' })
            setSuggest(null)
          }}
          onClose={closeSuggest}
        />
      )}
      {current && <Celebration key={current.key} toast={current} />}
    </>
  )

  const worldEffects = event && fxOn && !home && !venue ? <EventFx fx={event.fx} focusRef={focusRef} /> : null
  return { menuNodes, menuBadge: remaining, settingsSections, overlays, worldEffects }
}
