// Dokunmatik joystick'ler: yarı saydam (transparent), eşit boyutlu hareket (Joystick) ve kamera (LookJoystick).
// Dikey (portrait) ekranda sağdaki beceri çubuğuyla çakışmamak için kamera joystick'i sağda beceri çubuğunun üstünde durur.
import { useEffect, useRef, useState } from 'react'

export const BASE = 88
export const KNOB = 38
export const MAX = (BASE - KNOB) / 2 + 6
export const LOOK_BASE = BASE
export const LOOK_KNOB = KNOB
export const LOOK_MAX = MAX

const padCls = 'border border-white/35 bg-white/14 backdrop-blur-[2px] shadow-[0_4px_14px_rgba(35,24,61,0.12)]'

function useNarrowViewport() {
  const [narrow, setNarrow] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 560 : false))
  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 560)
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])
  return narrow
}

export function Joystick({ inputRef }) {
  const base = useRef(null)
  const pointer = useRef(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const [running, setRunning] = useState(false)
  const [dragging, setDragging] = useState(false)

  const apply = (e) => {
    const r = base.current.getBoundingClientRect()
    let dx = e.clientX - (r.left + r.width / 2)
    let dy = e.clientY - (r.top + r.height / 2)
    const d = Math.hypot(dx, dy)
    if (d > MAX) {
      dx = (dx / d) * MAX
      dy = (dy / d) * MAX
    }
    setKnob({ x: dx, y: dy })
    inputRef.current.x = dx / MAX
    inputRef.current.y = dy / MAX
    setRunning(Math.hypot(dx, dy) / MAX > 0.85)
  }
  const release = (e) => {
    if (pointer.current !== e.pointerId) return
    pointer.current = null
    inputRef.current.x = 0
    inputRef.current.y = 0
    setKnob({ x: 0, y: 0 })
    setRunning(false)
    setDragging(false)
  }

  return (
    <div
      ref={base}
      data-tour="move-joy"
      role="application"
      aria-label="Hareket joystick'i"
      className={`absolute z-10 touch-none select-none rounded-full transition-opacity ${padCls} ${
        dragging ? 'opacity-95 ring-2 ring-white/50' : 'opacity-65'
      } ${running ? 'ring-2 ring-[#7fcdf3]/80' : ''}`}
      style={{
        width: BASE,
        height: BASE,
        left: 'max(0.75rem, env(safe-area-inset-left))',
        bottom: 'max(0.8rem, env(safe-area-inset-bottom))',
      }}
      onPointerDown={(e) => {
        if (pointer.current !== null) return
        e.preventDefault()
        pointer.current = e.pointerId
        setDragging(true)
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        apply(e)
      }}
      onPointerMove={(e) => pointer.current === e.pointerId && apply(e)}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <div
        className={`absolute rounded-full border border-white/70 shadow-sm ${
          running ? 'bg-[#5fc0ea]/75' : dragging ? 'bg-[#fdb252]/75' : 'bg-[#fdb252]/45'
        }`}
        style={{
          width: KNOB,
          height: KNOB,
          left: (BASE - KNOB) / 2,
          top: (BASE - KNOB) / 2,
          transform: `translate(${knob.x}px, ${knob.y}px)`,
          transition: dragging ? 'none' : 'transform 120ms ease-out',
        }}
      />
      <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center text-base text-white/55">
        ✥
      </span>
    </div>
  )
}

export function LookJoystick({ inputRef }) {
  const base = useRef(null)
  const pointer = useRef(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const narrow = useNarrowViewport()

  const apply = (e) => {
    const r = base.current.getBoundingClientRect()
    let dx = e.clientX - (r.left + r.width / 2)
    let dy = e.clientY - (r.top + r.height / 2)
    const d = Math.hypot(dx, dy)
    if (d > LOOK_MAX) {
      dx = (dx / d) * LOOK_MAX
      dy = (dy / d) * LOOK_MAX
    }
    setKnob({ x: dx, y: dy })
    inputRef.current.x = dx / LOOK_MAX
    inputRef.current.y = dy / LOOK_MAX
  }
  const release = (e) => {
    if (pointer.current !== e.pointerId) return
    pointer.current = null
    inputRef.current.x = 0
    inputRef.current.y = 0
    setKnob({ x: 0, y: 0 })
    setDragging(false)
  }

  return (
    <div
      ref={base}
      data-tour="look-joy"
      role="application"
      aria-label="Görünüm joystick'i"
      className={`absolute z-10 touch-none select-none rounded-full transition-opacity ${padCls} ${
        dragging ? 'opacity-95 ring-2 ring-[#d6c7ff]/70' : 'opacity-65'
      }`}
      style={
        narrow
          ? {
              width: LOOK_BASE,
              height: LOOK_BASE,
              right: 'max(0.75rem, env(safe-area-inset-right))',
              bottom: 'calc(max(0.8rem, env(safe-area-inset-bottom)) + 5.75rem)',
            }
          : {
              width: LOOK_BASE,
              height: LOOK_BASE,
              left: `calc(max(0.75rem, env(safe-area-inset-left)) + ${BASE + 10}px)`,
              bottom: 'max(0.8rem, env(safe-area-inset-bottom))',
            }
      }
      onPointerDown={(e) => {
        if (pointer.current !== null) return
        e.preventDefault()
        pointer.current = e.pointerId
        setDragging(true)
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        apply(e)
      }}
      onPointerMove={(e) => pointer.current === e.pointerId && apply(e)}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <div
        className={`absolute rounded-full border border-white/70 shadow-sm ${dragging ? 'bg-[#a88bff]/75' : 'bg-[#a88bff]/45'}`}
        style={{
          width: LOOK_KNOB,
          height: LOOK_KNOB,
          left: (LOOK_BASE - LOOK_KNOB) / 2,
          top: (LOOK_BASE - LOOK_KNOB) / 2,
          transform: `translate(${knob.x}px, ${knob.y}px)`,
          transition: dragging ? 'none' : 'transform 120ms ease-out',
        }}
      />
      <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center text-base font-black text-white/65">
        ⟳
      </span>
    </div>
  )
}
