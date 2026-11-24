import { useEffect, useRef, useState } from 'react'
import { zoneAt } from '../layout'
import { VENUE_BY_ID, venueIdOf } from '../venues'
import { subscribeWorld, worldClock } from '../worldClock'
import { createMusic, OUTDOOR, VENUE_SCENE, ZONE_SCENE } from '../audio/music'
import { duck, ensureStarted, getSettings, installUnlock, onReady, play, setSettings, subscribeSettings } from '../audio/engine'

// Ses ve müzik (tamamen procedural, Web Audio; dış dosya yok). Motor: ../audio/engine.js, efektler: sfx.js, müzik: music.js.
// Başka modüller ses isteyebilir:
//   window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'quest' }))                       (ad listesi: audio/sfx.js başı)
//   window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: { name: 'beep', final: true, gain: 0.6 } }))
//   window.dispatchEvent(new CustomEvent('situapp:duck', { detail: true | false }))                 (sesli mesaj oynarken müziği kıs)
// Bölge: net.room + focusRef + layout.js zoneAt (+ venues.js type); hava/gece: worldClock (night, weather).

const STEP_WALK = 0.43
const STEP_RUN = 0.27
const GESTURE_SFX = { heart: 'heart', flower: 'flower', wink: 'wink', wave: 'wave', kiss: 'kiss', dance: 'dance' }

/** Bulunduğum yerin müzik sahnesi ve zemin türü. */
function whereAmI(room, f) {
  if (typeof room === 'string' && room.startsWith('home:')) return { scene: 'home', surface: 'wood', outdoor: false }
  const vid = venueIdOf(room)
  if (vid) {
    const type = VENUE_BY_ID[vid]?.type
    return { scene: VENUE_SCENE[type] ?? 'lobby', surface: 'wood', outdoor: false }
  }
  const z = zoneAt(f.x, f.z).id
  const scene = ZONE_SCENE[z] ?? 'lobby'
  return { scene, surface: z === 'park' ? 'grass' : z === 'beach' ? 'sand' : 'city', outdoor: OUTDOOR.has(scene) }
}

function Slider({ label, value, onChange, onRelease }) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-14 shrink-0 text-xs font-extrabold text-[#6b5a80]">{label}</span>
      <input
        type="range"
        min="0"
        max="100"
        step="5"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onRelease}
        onKeyUp={onRelease}
        aria-label={label}
        className="h-2 min-w-0 flex-1 cursor-pointer accent-[#ff7eb3]"
      />
      <span className="w-8 shrink-0 text-right text-xs font-bold tabular-nums text-[#8a7a9c]">{value}</span>
    </label>
  )
}

export function useAudio({ net, focusRef, home, panel }) {
  const [st, setSt] = useState(getSettings)
  const musicRef = useRef(null)
  const netRef = useRef(net)
  const roomRef = useRef('city')
  const homeRef = useRef(home)
  const prevPanel = useRef(panel)
  const prevRoom = useRef(null)

  useEffect(() => {
    netRef.current = net
    roomRef.current = net.room
    homeRef.current = home
  })
  useEffect(() => subscribeSettings(setSt), [])

  // motor + müzik denetçisi + dünya havası
  useEffect(() => {
    installUnlock()
    let music = null
    let offWorld = null
    let mood = { night: 0, rain: false }
    const sync = () => {
      if (!music) return
      const w = worldClock
      const night = Math.round((Number.isFinite(w.night) ? w.night : 0) * 20) / 20
      const rain = w.weather === 'rain'
      if (night !== mood.night || rain !== mood.rain) {
        mood = { night, rain }
        music.setMood(mood)
      }
      const here = whereAmI(homeRef.current ? 'home:me' : roomRef.current, focusRef.current)
      music.setScene(here.scene, { outdoor: here.outdoor })
    }
    const offReady = onReady((ac, buses) => {
      try {
        music = createMusic(ac, buses.music)
        musicRef.current = music
        if (import.meta.env.DEV) window.__audio = music // geliştirme: music.scene / mood
        music.start()
        offWorld = subscribeWorld(sync)
        sync()
      } catch {
        /* ses olmadan devam */
      }
    })
    const poll = setInterval(sync, 500)
    return () => {
      clearInterval(poll)
      offReady()
      offWorld?.()
      music?.stop()
      musicRef.current = null
    }
  }, [focusRef])

  // adımlar (~16 Hz yoklama; ritim yürüme/koşmaya göre)
  useEffect(() => {
    let last = 0
    const id = setInterval(() => {
      const f = focusRef.current
      const anim = f?.anim
      if (anim !== 'walk' && anim !== 'run') return
      const now = performance.now()
      if (now - last < (anim === 'run' ? STEP_RUN : STEP_WALK) * 1000) return
      last = now
      const here = whereAmI(homeRef.current ? 'home:me' : roomRef.current, f)
      play('step', { surface: here.surface, run: anim === 'run', gain: 0.8 })
    }, 60)
    return () => clearInterval(id)
  }, [focusRef])

  // kapı: oda değişince; panel: açılış/kapanış
  useEffect(() => {
    if (prevRoom.current !== null && prevRoom.current !== net.room) play('door')
    prevRoom.current = net.room
  }, [net.room])
  useEffect(() => {
    if (prevPanel.current !== panel) play(panel ? 'open' : 'close', { gain: 0.8 })
    prevPanel.current = panel
  }, [panel])

  // ağ olayları
  const { on } = net
  useEffect(() => {
    const self = () => netRef.current.selfId?.current
    const offs = [
      on('chat', (m) => m.id !== self() && play('msg', { gain: m.dm || m.to ? 1 : 0.4 })),
      on('whisper', (m) => m.id !== self() && play('whisper')),
      on('gesture', (m) => play(GESTURE_SFX[m.kind] ?? 'heart')),
      on('match', () => play('match')),
      on('react', (m) => play('pop', { gain: m.id === self() ? 0.7 : 0.35 })),
      on('friend_request', () => play('bell')),
      on('friend_added', () => play('bell', { gain: 0.8 })),
      on('dance_offer', () => play('bell', { gain: 0.8 })),
      on('game_offer', () => play('bell', { gain: 0.8 })),
      on('game_state', () => play('move')),
      on('gift_offer', () => play('gift')),
      on('mail_new', () => play('mail')),
      on('voice', (m) => m.id !== self() && play('msg')),
      on('sticker', (m) => m.id !== self() && play('msg', { gain: 0.6 })),
      on('quest_done', () => play('quest')),
      on('badge', () => play('badge')),
      on('pose', (m) => m.id === self() && m.pose && play('sit')),
      on('denied', () => play('error', { gain: 0.8 })),
    ]
    return () => offs.forEach((off) => off())
  }, [on])

  // pencere olayları (diğer modüller) + genel tıklama sesi
  useEffect(() => {
    const onSfx = (e) => {
      const d = e.detail
      if (typeof d === 'string') play(d)
      else if (d && typeof d.name === 'string') play(d.name, d)
    }
    const onDuck = (e) => duck(Boolean(e.detail))
    const onClick = (e) => {
      const el = e.target?.closest?.('button, a, [role="button"]')
      if (el && !el.closest('[data-nosfx]') && !el.disabled) play('click', { gain: 0.8 })
    }
    window.addEventListener('situapp:sfx', onSfx)
    window.addEventListener('situapp:duck', onDuck)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('situapp:sfx', onSfx)
      window.removeEventListener('situapp:duck', onDuck)
      document.removeEventListener('click', onClick, true)
    }
  }, [])

  const test = () => {
    const ac = ensureStarted()
    Promise.resolve(ac?.resume?.())
      .catch(() => {})
      .then(() => {
        play('pop')
        setTimeout(() => play('heart'), 220)
        setTimeout(() => play('quest'), 900)
      })
  }

  const extraButtons = [
    {
      key: 'audio',
      emoji: st.muted ? '🔇' : '🔊',
      label: st.muted ? 'Sesi aç' : 'Sesi kapat',
      onClick: () => {
        ensureStarted()
        setSettings({ muted: !st.muted })
      },
    },
  ]

  const settingsSections = [
    <section key="audio" data-testid="audio-settings">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-[#4a3b5c]">🔊 Ses</p>
          <p className="text-xs font-semibold text-[#8a7a9c]">Müzik ve efektler cihazında üretilir.</p>
        </div>
        <button
          role="switch"
          aria-checked={!st.muted}
          aria-label="Ses açık"
          onClick={() => {
            ensureStarted()
            setSettings({ muted: !st.muted })
          }}
          className={`relative h-7 w-12 shrink-0 rounded-full border-2 border-white shadow-soft transition ${st.muted ? 'bg-[#d8cfe6]' : 'bg-[#ff7eb3]'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${st.muted ? 'left-0.5' : 'left-[22px]'}`} />
        </button>
      </div>
      <div className={`mt-3 flex flex-col gap-2 transition-opacity ${st.muted ? 'opacity-50' : ''}`}>
        <Slider label="🎵 Müzik" value={st.music} onChange={(v) => setSettings({ music: v })} />
        <Slider label="✨ Efekt" value={st.sfx} onChange={(v) => setSettings({ sfx: v })} onRelease={() => play('pop')} />
        <button onClick={test} className="mt-1 w-fit rounded-2xl bg-[#a88bff] px-4 py-2 text-sm font-extrabold text-white shadow-soft active:scale-95">
          Sesi test et
        </button>
      </div>
    </section>,
  ]

  return { extraButtons, settingsSections }
}
