// Sezon efekti: oyuncunun çevresinde hafif parçacıklar (tek InstancedMesh, ≤ 36 örnek).
// fx: 'hearts' (kalp balonları, yükselir) | 'flowers' (çiçek yaprakları) | 'snow' (kar) | 'confetti' (konfeti)
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, Color, DynamicDrawUsage, Object3D, SRGBColorSpace } from 'three'

const COUNT = 36
const SPREAD = 18 // oyuncunun etrafındaki yarıçap (m)
const HEIGHT = 12
const CONFETTI = ['#ff7eb3', '#a9ddf5', '#ffe48f', '#b9ebcf', '#d6c7ff', '#ffc2dc']

function makeTexture(fx) {
  if (fx === 'confetti') return null
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  if (fx === 'snow') {
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.55, 'rgba(255,255,255,0.85)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
  } else {
    g.font = '48px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(fx === 'flowers' ? '🌸' : '💗', 32, 36)
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

export default function EventFx({ fx, focusRef }) {
  const mesh = useRef(null)
  const tex = useMemo(() => makeTexture(fx), [fx])
  const dummy = useMemo(() => new Object3D(), [])
  const [seeds] = useState(() =>
      Array.from({ length: COUNT }, (_, i) => ({
        ox: (Math.random() * 2 - 1) * SPREAD,
        oz: (Math.random() * 2 - 1) * SPREAD,
        y: Math.random() * HEIGHT,
        sp: 0.6 + Math.random() * 0.9,
        ph: Math.random() * Math.PI * 2,
        sz: 0.6 + Math.random() * 0.6,
        color: CONFETTI[i % CONFETTI.length],
      })),
  )
  useEffect(() => () => tex?.dispose(), [tex])
  useEffect(() => {
    const m = mesh.current
    if (!m) return
    const c = new Color()
    seeds.forEach((s, i) => m.setColorAt(i, c.set(fx === 'confetti' ? s.color : '#ffffff')))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.instanceMatrix.setUsage(DynamicDrawUsage)
  }, [fx, seeds])

  useFrame((state, dt) => {
    const m = mesh.current
    if (!m) return
    const f = focusRef.current
    const t = state.clock.elapsedTime
    const rise = fx === 'hearts'
    const step = Math.min(dt, 0.1)
    for (let i = 0; i < COUNT; i++) {
      const s = seeds[i]
      s.y += (rise ? 1 : -1) * s.sp * step * (fx === 'snow' ? 0.9 : 1.3)
      if (s.y > HEIGHT) s.y = 0
      else if (s.y < 0) s.y = HEIGHT
      dummy.position.set(f.x + s.ox + Math.sin(t * 0.7 + s.ph) * 0.9, s.y, f.z + s.oz + Math.cos(t * 0.6 + s.ph) * 0.9)
      dummy.quaternion.copy(state.camera.quaternion)
      if (fx === 'confetti') dummy.rotateZ(t * s.sp * 2 + s.ph)
      const k = fx === 'snow' ? 0.35 : fx === 'confetti' ? 0.3 : 0.7
      dummy.scale.set(k * s.sz, k * s.sz * (fx === 'confetti' ? 1.6 : 1), 1)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[null, null, COUNT]} frustumCulled={false} renderOrder={5}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial key={fx} map={tex} transparent depthWrite={false} toneMapped={false} fog={false} />
    </instancedMesh>
  )
}
