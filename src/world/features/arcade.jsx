// Playstasyon makineleri: yakındaki kabine E ile "Oyna" → tam ekran retro oyun (src/arcade/games.js). Oyunlar tamamen istemcide çalışır;
// altın/puan/ilerleme VERMEZ (hile yolu olmasın), yalnızca bu tarayıcıda rekor tutulur.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DoorPrompt } from '../Social'
import { venueLayout } from '../venueLayout'
import { ARCADE_GAMES, H, W } from '../../arcade/games'

const ARCADE_VENUE = 'oyun'
const REACH = 1.6 // kabine bu kadar yaklaşınca "Oyna" çıkar (m)
const isTyping = (e) => e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)
const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'action', Enter: 'action' }

const bestKey = (id) => `situapp_arcade_best_${id}`
const readBest = (id) => {
  try {
    return Number(localStorage.getItem(bestKey(id))) || 0
  } catch {
    return 0
  }
}

function ArcadeScreen({ game, onClose }) {
  const canvas = useRef(null)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => readBest(game.id))
  const input = useMemo(() => {
    const held = new Set()
    return {
      held: (k) => held.has(k),
      hold: (k, on) => (on ? held.add(k) : held.delete(k)),
      press: (k) => input.onPress?.(k),
      onPress: null,
    }
  }, [])

  useEffect(() => {
    const api = {
      score: (n) => setScore(n),
      over: (n) => {
        if (n > readBest(game.id)) {
          try {
            localStorage.setItem(bestKey(game.id), String(n))
          } catch {
            /* önemli değil */
          }
          setBest(n)
        }
      },
    }
    const g = game.create(canvas.current, input, api)
    return () => g.destroy()
  }, [game, input])

  // klavye: oyun açıkken tuşlar dünyaya gitmesin (yürüme vb.)
  useEffect(() => {
    const down = (e) => {
      if (isTyping(e)) return
      if (e.code === 'Escape') {
        e.stopImmediatePropagation()
        return onClose()
      }
      const k = KEYS[e.code]
      if (!k) return
      e.preventDefault()
      e.stopImmediatePropagation()
      if (!e.repeat || k !== 'action') {
        input.hold(k, true)
        input.press(k)
      }
    }
    const up = (e) => {
      const k = KEYS[e.code]
      if (!k) return
      e.stopImmediatePropagation()
      input.hold(k, false)
    }
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
    }
  }, [input, onClose])

  const btn = (k, label, cls = '') => (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault()
        input.hold(k, true)
        input.press(k)
      }}
      onPointerUp={() => input.hold(k, false)}
      onPointerLeave={() => input.hold(k, false)}
      onPointerCancel={() => input.hold(k, false)}
      className={`select-none touch-none rounded-2xl border-b-4 border-[#4a3b7a] bg-[#7a5fd0] text-lg font-black text-white active:translate-y-[2px] active:border-b-2 ${cls}`}
    >
      {label}
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#120a26]/80 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={game.title}>
      <div className="w-full max-w-sm rounded-[2rem] border-4 border-[#b79cff] bg-gradient-to-b from-[#8d6fe6] to-[#5a3fb0] p-3 shadow-toy">
        <div className="flex items-center gap-2 px-1 pb-2">
          <div className="min-w-0 flex-1 rounded-xl bg-[#2a1b57] px-3 py-1.5 text-center text-sm font-black tracking-widest text-[#ffd35e]">{game.title}</div>
          <button type="button" onClick={onClose} aria-label="Kapat" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/90 text-sm font-black text-[#5a3fb0]">
            ✖️
          </button>
        </div>
        <div className="relative overflow-hidden rounded-2xl border-4 border-[#2a1b57] bg-black">
          <canvas ref={canvas} width={W} height={H} className="block w-full [image-rendering:pixelated]" style={{ aspectRatio: `${W} / ${H}` }} />
          {/* CRT tarama çizgileri */}
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-30" style={{ background: 'repeating-linear-gradient(to bottom, rgba(0,0,0,0.35) 0, rgba(0,0,0,0.35) 1px, transparent 1px, transparent 3px)' }} />
        </div>
        <div className="mt-2 flex items-center justify-between px-1 text-xs font-black text-white/90">
          <span>Skor {score}</span>
          <span>Rekor {best}</span>
        </div>
        <p className="px-1 text-center text-[0.7rem] font-bold text-white/70">{game.hint} · Esc: çık</p>
        <div className="mt-2 flex items-center justify-between gap-3 sm:hidden">
          <div className="grid grid-cols-3 grid-rows-2 gap-1.5">
            <span />
            {btn('up', '👆', 'h-11 w-11')}
            <span />
            {btn('left', '👈', 'h-11 w-11')}
            {btn('down', '👇', 'h-11 w-11')}
            {btn('right', '👉', 'h-11 w-11')}
          </div>
          {btn('action', 'A', 'h-16 w-16 rounded-full !text-2xl')}
        </div>
      </div>
    </div>
  )
}

export function useArcade({ venue, focusRef, touch, panel }) {
  const [near, setNear] = useState(null) // { i, game }
  const [playing, setPlaying] = useState(null)
  const cabinets = useMemo(() => (venue === ARCADE_VENUE ? (venueLayout(ARCADE_VENUE)?.items ?? []).filter((it) => it.t === 'cabinet') : []), [venue])

  useEffect(() => {
    if (!cabinets.length) {
      setNear(null)
      return undefined
    }
    const id = setInterval(() => {
      const f = focusRef.current
      let best = null
      let bd = REACH
      cabinets.forEach((c, i) => {
        const d = Math.hypot(f.x - c.x, f.z - c.z)
        if (d < bd) {
          bd = d
          best = i
        }
      })
      setNear((o) => (best == null ? (o ? null : o) : o?.i === best ? o : { i: best, game: ARCADE_GAMES[best % ARCADE_GAMES.length] }))
    }, 200)
    return () => clearInterval(id)
  }, [cabinets, focusRef])

  const play = useCallback(() => near && setPlaying(near.game), [near])
  useEffect(() => {
    if (!near || playing || panel) return undefined
    const onKey = (e) => {
      if ((e.code === 'KeyE' || e.key === 'e') && !isTyping(e) && !e.ctrlKey && !e.metaKey && !e.altKey) play()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [near, playing, panel, play])

  return {
    overlays: (
      <>
        {near && !playing && !panel && <DoorPrompt emoji="🕹️" label={`Retro makine · ${near.game.title}`} action="Oyna" touch={touch} raised onGo={play} />}
        {playing && <ArcadeScreen game={playing} onClose={() => setPlaying(null)} />}
      </>
    ),
  }
}
