// Dokunmatik joystick'ler: hareket (Joystick) ve kamera (LookJoystick).
import { useRef, useState } from 'react'
import { glass } from './socialShared'
// ---------- sanal joystick (dokunmatik cihazlar — her iki joystick birebir aynı boyuttadır) ----------
export const BASE = 104
export const KNOB = 44
export const MAX = (BASE - KNOB) / 2 + 6

/**
 * Sol altta sanal joystick. inputRef.current = { x, y } (-1..1; y aşağı = geri) değerini günceller.
 * Kenara kadar itersen (>%85) karakter koşar.
 */
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
      role="application"
      aria-label="Hareket joystick'i"
      className={`absolute z-10 touch-none select-none rounded-full ${glass} ${running ? 'ring-4 ring-[#a9ddf5]' : ''}`}
      style={{ width: BASE, height: BASE, left: 'max(0.85rem, env(safe-area-inset-left))', bottom: 'max(0.85rem, env(safe-area-inset-bottom))' }}
      onPointerDown={(e) => {
        if (pointer.current !== null) return
        e.preventDefault()
        pointer.current = e.pointerId
        setDragging(true)
        try {
          e.currentTarget.setPointerCapture(e.pointerId) // parmak joystick'ten kaysa bile takip et
        } catch {
          /* bazı tarayıcılarda yapay olaylarda desteklenmez */
        }
        apply(e)
      }}
      onPointerMove={(e) => pointer.current === e.pointerId && apply(e)}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <div
        className={`absolute rounded-full border-2 border-white shadow-md ${running ? 'bg-[#5fc0ea]' : 'bg-[#fdb252]'}`}
        style={{
          width: KNOB,
          height: KNOB,
          left: (BASE - KNOB) / 2,
          top: (BASE - KNOB) / 2,
          transform: `translate(${knob.x}px, ${knob.y}px)`,
          transition: dragging ? 'none' : 'transform 120ms ease-out',
        }}
      />
      <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center text-xl opacity-30">
        ✥
      </span>
    </div>
  )
}

export const LOOK_BASE = BASE
export const LOOK_KNOB = KNOB
export const LOOK_MAX = MAX

/**
 * Hareket joystick'inin hemen yanında kamera/görünüm joystick'i (dokunmatik cihazlar).
 * inputRef.current = { x, y } (-1..1; x = yatay dönüş, y = dikey açı).
 */
export function LookJoystick({ inputRef }) {
  const base = useRef(null)
  const pointer = useRef(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)

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
      role="application"
      aria-label="Görünüm joystick'i"
      className={`absolute z-10 touch-none select-none rounded-full ${glass} ${dragging ? 'ring-4 ring-[#d6c7ff]' : ''}`}
      style={{
        width: LOOK_BASE,
        height: LOOK_BASE,
        left: `calc(max(0.85rem, env(safe-area-inset-left)) + ${BASE + 12}px)`,
        bottom: 'max(0.85rem, env(safe-area-inset-bottom))',
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
        className="absolute rounded-full border-2 border-white bg-[#a88bff] shadow-md"
        style={{
          width: LOOK_KNOB,
          height: LOOK_KNOB,
          left: (LOOK_BASE - LOOK_KNOB) / 2,
          top: (LOOK_BASE - LOOK_KNOB) / 2,
          transform: `translate(${knob.x}px, ${knob.y}px)`,
          transition: dragging ? 'none' : 'transform 120ms ease-out',
        }}
      />
      <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center text-lg font-black text-white/90">
        ⟳
      </span>
    </div>
  )
}
