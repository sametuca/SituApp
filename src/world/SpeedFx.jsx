// Hız halkasından geçince geçici hız efekti (yalnızca benim avatarımın yanında): arkaya akan rüzgâr çizgileri, ayakta yayılan halka, "HIZ!" yazısı (kartsız).
// Süre bikeStore.speedBoost.until'den okunur (cityLife.jsx halkaya girince ayarlar).
import { memo, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { AdditiveBlending } from 'three'
import { speedBoost } from './bikeStore'
import { screenK } from './screenK'

const N = 9
const STREAKS = Array.from({ length: N }, (_, i) => ({
  x: Math.sin(i * 2.4) * 0.5,
  y: 0.25 + ((i * 0.37) % 1) * 1.0,
  len: 0.9 + ((i * 0.53) % 1) * 0.9,
  ph: (i * 0.618) % 1,
  sp: 3.4 + ((i * 0.29) % 1) * 1.6,
}))

export default memo(function SpeedFx() {
  const lines = useRef([])
  const ring = useRef()
  const startRef = useRef(0)
  const lastUntil = useRef(0)
  const [tag, setTag] = useState(0) // her yeni etkinleşmede artar → etiket yeniden belirir
  const mat = useMemo(() => ({ transparent: true, depthWrite: false, blending: AdditiveBlending, color: '#fff6c2' }), [])

  useFrame(({ clock }) => {
    const now = Date.now()
    const active = now < speedBoost.until
    if (speedBoost.until !== lastUntil.current) {
      lastUntil.current = speedBoost.until
      if (active) {
        startRef.current = performance.now()
        setTag((k) => k + 1)
      }
    }
    const left = Math.max(0, speedBoost.until - now) / 1000
    const fade = active ? Math.min(1, left / 0.6, (performance.now() - startRef.current) / 150) : 0 // girişte hızlı açılır, bitişte 0,6 sn'de söner
    const t = clock.elapsedTime
    lines.current.forEach((m, i) => {
      if (!m) return
      m.visible = fade > 0.02
      if (!m.visible) return
      const s = STREAKS[i]
      const ph = (t * s.sp * 0.35 + s.ph) % 1
      m.position.set(s.x, s.y, -0.5 - ph * 2.6) // avatarın arkasına doğru akar (avatar +z'ye bakar)
      m.scale.set(1, s.len, 1)
      m.material.opacity = fade * Math.sin(ph * Math.PI) * 0.7
    })
    if (ring.current) {
      const k = Math.min(1, (performance.now() - startRef.current) / 450)
      ring.current.visible = active && k < 1
      ring.current.scale.setScalar(0.5 + k * 1.8)
      ring.current.material.opacity = (1 - k) * 0.7
    }
  })

  return (
    <group>
      {STREAKS.map((_, i) => (
        <mesh key={i} ref={(m) => (lines.current[i] = m)} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.035, 1]} />
          <meshBasicMaterial {...mat} opacity={0} side={2} />
        </mesh>
      ))}
      <mesh ref={ring} visible={false} position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.85, 1, 40]} />
        <meshBasicMaterial {...mat} color="#ffd35e" opacity={0} />
      </mesh>
      {tag > 0 && (
        <Html key={tag} position={[0.55, 1.45, 0]} center distanceFactor={9 * screenK()} zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap text-lg font-black italic tracking-wider text-white [text-shadow:0_2px_0_#e8952c,0_0_10px_rgba(255,176,64,0.9)] [animation:speed-tag_1.6s_ease-out_forwards]">HIZ!</div>
        </Html>
      )}
    </group>
  )
})
