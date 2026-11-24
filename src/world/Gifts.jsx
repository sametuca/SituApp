import { Suspense, useMemo } from 'react'
import { Html, useGLTF } from '@react-three/drei'
import Prop from './Prop'
import { Shape } from 'three'

// Hediye eşyaları (Meshy GLB) + paylaşılan kalp biçimi (ev dekoru).
const M = ({ color, ...p }) => <meshStandardMaterial color={color} roughness={0.6} {...p} />

/** Kalp biçimi (ExtrudeGeometry için); yaklaşık 1 birim genişlik. */
export function makeHeartShape() {
  const s = new Shape()
  s.moveTo(0, -0.5)
  s.bezierCurveTo(-0.15, -0.35, -0.5, -0.1, -0.5, 0.15)
  s.bezierCurveTo(-0.5, 0.42, -0.2, 0.5, 0, 0.28)
  s.bezierCurveTo(0.2, 0.5, 0.5, 0.42, 0.5, 0.15)
  s.bezierCurveTo(0.5, -0.1, 0.15, -0.35, 0, -0.5)
  return s
}

export function Heart({ size = 1, color = '#ff7eb3', depth = 0.25, glow = false, ...p }) {
  const shape = useMemo(() => makeHeartShape(), [])
  return (
    <mesh scale={size} {...p}>
      <extrudeGeometry args={[shape, { depth, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.06, bevelSegments: 3, curveSegments: 14 }]} />
      <M color={color} emissive={glow ? color : '#000000'} emissiveIntensity={glow ? 0.9 : 0} />
    </mesh>
  )
}

// Meshy GLB'ler (public/models/gifts/); Prop en büyük boyutu 1'e normalleyip `size` ile çarpar. Ayak izi: cosmeticsData GIFTS (fw/fd).
const GIFT_MODEL = {
  'gift-bear': { url: '/models/gifts/gift-bear.glb', size: 0.8 },
  'gift-heartbox': { url: '/models/gifts/gift-heartbox.glb', size: 0.6 },
  'gift-roses': { url: '/models/gifts/gift-roses.glb', size: 0.7 },
  'gift-choco': { url: '/models/gifts/gift-choco.glb', size: 0.6 },
}
Object.values(GIFT_MODEL).forEach((m) => useGLTF.preload(m.url))

/** Hediye modeli (yerde; orijin = tabanın ortası). */
export function GiftModel({ id }) {
  const m = GIFT_MODEL[id]
  return m ? (
    <Suspense fallback={null}>
      <Prop model={m.url} x={0} z={0} scale={m.size} />
    </Suspense>
  ) : null
}

/** Odaya yerleştirilmiş hediye: model + "🎁 Ad’dan" etiketi. */
export function PlacedGift({ id, x, z, ry, from }) {
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      <GiftModel id={id} />
      {from && (
        <Html position={[0, id === 'gift-bear' ? 0.95 : 0.85, 0]} center distanceFactor={9} zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-full border-2 border-white bg-white/90 px-2 py-0.5 text-[11px] font-extrabold text-[#4a3b5c] shadow">🎁 {from}</div>
        </Html>
      )}
    </group>
  )
}
