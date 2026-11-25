import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'

const DURATION = 5.2 // sn: yüksek plaj/şehir açısından karaktere süzülme süresi
const SKIP_LOCK_MS = 900 // çıkış tuşunun yanlışlıkla sahneyi hemen atlamasını önle

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

const tmpPos = new Vector3()
const tmpTarget = new Vector3()

/**
 * Havalimanından plaja ilk çıkışta çalışan sinematik kamera inişi.
 * Yüksek sahil/şehir açısından yumuşak bir yay çizerek karakterin oyun kamerasına oturur.
 */
export function IntroCutsceneCamera({ active, focusRef, controlsRef, camOffset = [6.4, 9.4], onDone }) {
  const camera = useThree((s) => s.camera)
  const startedAt = useRef(null)
  const finished = useRef(false)

  useEffect(() => {
    if (!active) {
      startedAt.current = null
      finished.current = false
      return
    }
    startedAt.current = performance.now()
    finished.current = false
  }, [active])

  useFrame(() => {
    if (!active || finished.current || startedAt.current === null) return
    const f = focusRef.current
    const tx = f.teleport ? f.teleport[0] : f.x
    const tz = f.teleport ? f.teleport[1] : f.z
    const elapsed = (performance.now() - startedAt.current) / 1000
    const raw = Math.min(1, Math.max(0, elapsed / DURATION))
    const e = easeInOutCubic(raw)

    // Başlangıç: palmiyelerin ve sahilin üstünde, hafif sağdan şehre bakan geniş açı
    const sx = tx + 10.5
    const sy = 22.0
    const sz = tz + 21.5
    // Bitiş: karakterin arkasındaki standart üçüncü şahıs kamera konumu
    const ex = tx
    const ey = camOffset[0]
    const ez = tz + camOffset[1]

    // Hafif sinematik yay (düz çizgi yerine yumuşak kavis)
    const arcX = Math.sin(e * Math.PI) * 2.4
    tmpPos.set(sx + (ex - sx) * e + arcX, sy + (ey - sy) * e, sz + (ez - sz) * e)
    tmpTarget.set(tx, 3.0 + (0.8 - 3.0) * e, tz - 11.0 * (1 - e))

    camera.position.copy(tmpPos)
    if (controlsRef.current) {
      controlsRef.current.target.copy(tmpTarget)
      controlsRef.current.update()
    } else {
      camera.lookAt(tmpTarget)
    }

    if (raw >= 1) {
      finished.current = true
      onDone?.()
    }
  })

  return null
}

/**
 * Ara sahne sinematik şeritleri, "Haziran sabahı" yazısı ve geçme düğmesi.
 */
export function IntroCutsceneOverlay({ active, onSkip }) {
  const startedAt = useRef(0)

  useEffect(() => {
    if (!active) return
    startedAt.current = performance.now()
    const onKey = (e) => {
      if (performance.now() - startedAt.current < SKIP_LOCK_MS) return
      if (['Space', 'Enter', 'Escape', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        onSkip?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, onSkip])

  if (!active) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between">
      {/* üst sinematik şerit */}
      <div className="h-12 w-full bg-gradient-to-b from-[#2b1f3a]/60 via-[#2b1f3a]/25 to-transparent sm:h-16" />

      {/* alt sinematik şerit + şiirsel açılış sözü */}
      <div className="relative flex w-full flex-col items-center bg-gradient-to-t from-[#2b1f3a]/75 via-[#2b1f3a]/35 to-transparent px-5 pb-7 pt-14 text-center sm:pb-10">
        <div className="animate-pop flex max-w-xl flex-col items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/15 px-3 py-0.5 text-[11px] font-black tracking-[0.2em] text-[#ffe8a3] backdrop-blur-sm">
            ☀️ HAZİRAN SABAHI
          </span>
          <p className="text-lg font-black leading-snug text-white drop-shadow-[0_2px_12px_rgba(32,20,50,0.65)] sm:text-2xl">
            “Bir Haziran sabahı… Belki de yeni insanlarla tanışmalısın.”
          </p>
          <p className="text-xs font-bold text-white/80 drop-shadow sm:text-sm">
            Sahil ve şehir seni bekliyor ✨
          </p>
        </div>

        <button
          type="button"
          onClick={onSkip}
          className="pointer-events-auto absolute bottom-4 right-4 rounded-full border border-white/40 bg-white/20 px-4 py-1.5 text-xs font-extrabold text-white backdrop-blur-md transition hover:bg-white/30 active:scale-95 sm:bottom-6 sm:right-6"
        >
          Geç ⏭
        </button>
      </div>
    </div>
  )
}
