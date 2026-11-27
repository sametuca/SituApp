import { Component, useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import { ENTERABLE, venueDoor } from '../world/venueDoors'
import { zoneAt } from '../world/layout'
import { randomLoadingMessage, WORLD_LOADING_MESSAGES } from './loadingMessages'

/** 3B sahne çökerse boş ekran yerine kurtarma kartı gösterir. */
export class WorldErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-gradient-to-br from-[#fff2e3] via-[#f1e6ff] to-[#dff3ff] p-5">
        <div className="w-full max-w-sm rounded-[2rem] border-2 border-white bg-white/95 p-6 text-center shadow-toy">
          <div className="text-5xl">🛠️</div>
          <h2 className="mt-2 text-xl font-black text-[#4a3b5c]">Sahne yüklenirken bir sorun oluştu</h2>
          <p className="mt-1 text-sm font-semibold text-[#8a7a9c]">Sayfayı yenileyerek kaldığın yerden devam edebilirsin.</p>
          <button type="button" onClick={() => location.reload()} className="mt-4 rounded-2xl border-b-4 border-[#e8952c] bg-[#fdb252] px-5 py-2.5 text-sm font-extrabold text-white active:translate-y-[2px] active:border-b-2">
            Sayfayı yenile
          </button>
        </div>
      </div>
    )
  }
}

/** Ana sahne (şehir/oda + oyuncu) çizime hazır olunca onReady çağrılır; yalnızca ilk yüklemede kullanılır. */
export function SceneReady({ onReady }) {
  useEffect(() => {
    onReady()
  }, [onReady])
  return null
}

export function LoadingOverlay({ ready }) {
  const { progress } = useProgress()
  const [hidden, setHidden] = useState(false)
  const [message, setMessage] = useState(() => randomLoadingMessage(WORLD_LOADING_MESSAGES))
  const messageRef = useRef(message)
  useEffect(() => {
    const t = setTimeout(() => setHidden(true), ready ? 250 : 60000)
    return () => clearTimeout(t)
  }, [ready])
  useEffect(() => {
    if (ready || hidden) return undefined
    const timer = setInterval(() => {
      const next = randomLoadingMessage(WORLD_LOADING_MESSAGES, messageRef.current)
      messageRef.current = next
      setMessage(next)
    }, 2200)
    return () => clearInterval(timer)
  }, [ready, hidden])
  if (hidden) return null
  const pct = Math.min(100, Math.max(0, Math.round(progress)))
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#fff2e3] via-[#f1e6ff] to-[#dff3ff] p-6">
      <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-[#ffd7e8]/45 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-16 h-72 w-72 rounded-full bg-[#cce9ff]/50 blur-3xl" />
      <div className="relative flex w-full max-w-xs flex-col items-center gap-4 rounded-[2rem] border-2 border-white bg-white/80 px-7 py-6 shadow-[0_18px_44px_rgba(104,79,145,0.16)] backdrop-blur-md">
        <img src="/logo.png" alt="Rastla" draggable={false} className="h-20 w-auto select-none drop-shadow-[0_8px_18px_rgba(74,59,92,0.16)]" />
        <div className="w-full">
          <div className="mb-1.5 flex items-center justify-between text-xs font-extrabold text-[#6b5a80]">
            <span className="transition-opacity duration-300">{message}</span>
            <span className="tabular-nums text-[#8b6be6]">%{pct}</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full border border-white bg-[#efe6ff] p-0.5 shadow-inner">
            <div className="h-full rounded-full bg-gradient-to-r from-[#ff9ec7] via-[#b79cff] to-[#7fcdf3] transition-[width] duration-200" style={{ width: `${Math.max(8, pct)}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}

export function ZoneWatcher({ focusRef, onChange, fixed }) {
  const last = useRef(null)
  useFrame(() => {
    const z = fixed ?? zoneAt(focusRef.current.x, focusRef.current.z)
    if (z.id !== last.current) {
      last.current = z.id
      onChange(z)
    }
  })
  return null
}

export function DoorWatcher({ focusRef, door, onChange }) {
  const last = useRef(false)
  useFrame(() => {
    const f = focusRef.current
    const near = Math.hypot(f.x - door.x, f.z - door.z) < door.radius
    if (near !== last.current) {
      last.current = near
      onChange(near)
    }
  })
  return null
}

export function VenueDoorWatcher({ focusRef, onChange }) {
  const last = useRef(null)
  useFrame(() => {
    const f = focusRef.current
    let best = null
    let bestD = Infinity
    for (const v of ENTERABLE) {
      const d = venueDoor(v.id)
      const dist = Math.hypot(f.x - d.x, f.z - d.z)
      if (dist < d.radius && dist < bestD) {
        best = v.id
        bestD = dist
      }
    }
    if (best !== last.current) {
      last.current = best
      onChange(best)
    }
  })
  return null
}
