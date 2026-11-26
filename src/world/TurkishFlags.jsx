// Plaka82 genelinde rüzgârda dalgalanan Türk bayrakları.
// userData.keepHue = true ile unisex.js renk kaydırmasından korunur; gerçek kırmızı ve beyaz ay-yıldız çizilir.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, DoubleSide, PlaneGeometry, SRGBColorSpace } from 'three'

const FLAG_SPOTS = [
  { x: -7.2, z: -13.5, ry: 0.35, phase: 0 }, // Şehir Meydanı (kuzeybatı)
  { x: 7.2, z: -13.5, ry: -0.35, phase: 1.4 }, // Şehir Meydanı (kuzeydoğu)
]

let cachedFlagTex = null
function getTurkishFlagTexture() {
  if (cachedFlagTex) return cachedFlagTex
  const W = 512
  const H = 342 // 3:2 resmi oran
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const g = cv.getContext('2d')

  // Kırmızı zemin
  g.fillStyle = '#e30a17'
  g.fillRect(0, 0, W, H)

  const cy = H / 2
  // Hilal dış dairesi
  const ox = H * 0.5
  const or = H * 0.25
  g.fillStyle = '#ffffff'
  g.beginPath()
  g.arc(ox, cy, or, 0, Math.PI * 2)
  g.fill()

  // Hilal iç dairesi (kırmızı oyuk)
  const ix = ox + H * 0.0625
  const ir = H * 0.2
  g.fillStyle = '#e30a17'
  g.beginPath()
  g.arc(ix, cy, ir, 0, Math.PI * 2)
  g.fill()

  // 5 köşeli yıldız
  const sx = ix + H * 0.275
  const srOuter = H * 0.125
  const srInner = srOuter * 0.382
  g.fillStyle = '#ffffff'
  g.beginPath()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? srOuter : srInner
    const a = Math.PI + (i * Math.PI) / 5 // bir ucu hilale bakar
    const px = sx + Math.cos(a) * r
    const py = cy + Math.sin(a) * r
    if (i === 0) g.moveTo(px, py)
    else g.lineTo(px, py)
  }
  g.closePath()
  g.fill()

  const tex = new CanvasTexture(cv)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  cachedFlagTex = tex
  return tex
}

const FLAG_W = 1.95
const FLAG_H = 1.3
const POLE_H = 6.2

function WavingFlag({ x, z, ry = 0, phase = 0, tex }) {
  const geo = useMemo(() => {
    const g = new PlaneGeometry(FLAG_W, FLAG_H, 16, 6)
    g.translate(FLAG_W / 2, 0, 0) // x=0 direğe sabit, +FLAG_W serbest uç
    return g
  }, [])
  const basePos = useMemo(() => new Float32Array(geo.attributes.position.array), [geo])
  const meshRef = useRef()

  useFrame(({ clock }) => {
    const pos = geo.attributes.position
    const arr = pos.array
    const t = clock.elapsedTime
    for (let i = 0; i < pos.count; i++) {
      const bx = basePos[i * 3]
      const by = basePos[i * 3 + 1]
      const u = bx / FLAG_W // 0 direk dibinde → 1 serbest uçta
      const wave1 = Math.sin(u * 5.2 - t * 4.0 + phase) * 0.16 * u
      const wave2 = Math.sin(u * 9.5 - t * 6.2 + by * 1.4 + phase) * 0.04 * u * u
      arr[i * 3 + 2] = wave1 + wave2
      arr[i * 3 + 1] = by + Math.sin(u * 4.0 - t * 3.2 + phase) * 0.03 * u
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
  })

  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      {/* Yuvarlak kaide */}
      <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.28, 0.36, 0.36, 14]} />
        <meshStandardMaterial color="#f5ede4" roughness={0.6} />
      </mesh>
      {/* Direk */}
      <mesh position={[0, POLE_H / 2, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.075, POLE_H, 10]} />
        <meshStandardMaterial color="#f2f4f8" roughness={0.35} metalness={0.25} />
      </mesh>
      {/* Altın alem (tepe topuzu) */}
      <mesh position={[0, POLE_H + 0.12, 0]} castShadow>
        <sphereGeometry args={[0.13, 12, 10]} />
        <meshStandardMaterial color="#ffd35e" roughness={0.28} metalness={0.35} />
      </mesh>
      {/* Dalgalanan bayrak kumaşı */}
      <mesh ref={meshRef} geometry={geo} position={[0.05, POLE_H - FLAG_H / 2 - 0.08, 0]} castShadow>
        <meshStandardMaterial
          map={tex}
          side={DoubleSide}
          roughness={0.55}
          userData={{ keepHue: true }}
        />
      </mesh>
    </group>
  )
}

export default function TurkishFlags() {
  const tex = useMemo(() => getTurkishFlagTexture(), [])
  return (
    <group>
      {FLAG_SPOTS.map((f, i) => (
        <WavingFlag key={i} {...f} tex={tex} />
      ))}
    </group>
  )
}
