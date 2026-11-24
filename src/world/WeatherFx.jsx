// Hava parçacıkları: oyuncunun çevresinde takip eden küçük hacimde tek InstancedMesh (yağmur, kar, yaprak, taç yaprağı).
// Sis parçacık değil, Sky.jsx'te sis mesafesiyle yapılır. En çok MAX örnek; dokunmatikte ≤ 120; sezon etkinliği efekti varsa azalır.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, Color, DynamicDrawUsage, Object3D, SRGBColorSpace } from 'three'
import { worldClock } from './worldClock'

const MAX = 300
const TOUCH_MAX = 120
const R = 15 // oyuncu etrafındaki yarıçap (m)
const H = 14 // yükseklik (m)
const FADE = 1.2 // sn: tür değişiminde sönme/belirme

const KINDS = {
  rain: { n: 1, fall: 15, size: [0.11, 1.0], color: ['#d6ecff'], op: 0.85, sway: 0 },
  snow: { n: 0.8, fall: 1.3, size: [0.3, 0.3], color: ['#ffffff'], op: 0.95, sway: 0.9 },
  leaves: { n: 0.35, fall: 1.4, size: [0.42, 0.28], color: ['#ff9a4a', '#f0b54a', '#e0693b', '#c98a3a', '#f4c76a'], op: 1, sway: 1.6, spin: 2.2 },
  petals: { n: 0.45, fall: 1.0, size: [0.3, 0.2], color: ['#a8ebea', '#e0f8f8', '#9ae7e7', '#f3fcfc'], op: 1, sway: 1.4, spin: 2 },
}

function makeTextures() {
  const mk = (draw) => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    draw(c.getContext('2d'))
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    return t
  }
  return {
    rain: mk((g) => {
      const grad = g.createLinearGradient(0, 0, 0, 64)
      grad.addColorStop(0, 'rgba(255,255,255,0)')
      grad.addColorStop(0.5, 'rgba(255,255,255,1)')
      grad.addColorStop(1, 'rgba(255,255,255,0.2)')
      g.fillStyle = grad
      g.beginPath()
      g.ellipse(32, 32, 10, 30, 0, 0, Math.PI * 2)
      g.fill()
    }),
    snow: mk((g) => {
      const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30)
      grad.addColorStop(0, 'rgba(255,255,255,1)')
      grad.addColorStop(0.55, 'rgba(255,255,255,0.85)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, 64, 64)
    }),
    leaves: mk((g) => {
      g.fillStyle = '#fff'
      g.beginPath() // yaprak: sivri uçlu damla
      g.moveTo(4, 32)
      g.quadraticCurveTo(32, 2, 60, 32)
      g.quadraticCurveTo(32, 62, 4, 32)
      g.fill()
      g.strokeStyle = 'rgba(0,0,0,0.25)'
      g.lineWidth = 3
      g.beginPath()
      g.moveTo(8, 32)
      g.lineTo(54, 32)
      g.stroke()
    }),
    petals: mk((g) => {
      g.fillStyle = '#fff'
      g.beginPath() // taç yaprağı: yuvarlak damla
      g.ellipse(32, 32, 28, 17, 0, 0, Math.PI * 2)
      g.fill()
    }),
  }
}

export default function WeatherFx({ focusRef, touch = false, reduced = false }) {
  const mesh = useRef(null)
  const textures = useMemo(() => makeTextures(), [])
  const dummy = useMemo(() => new Object3D(), [])
  const col = useMemo(() => new Color(), [])
  const [seeds] = useState(() =>
      Array.from({ length: MAX }, () => ({
        ox: (Math.random() * 2 - 1) * R,
        oz: (Math.random() * 2 - 1) * R,
        y: Math.random() * H,
        sp: 0.75 + Math.random() * 0.5,
        ph: Math.random() * Math.PI * 2,
        sz: 0.75 + Math.random() * 0.5,
        ci: Math.floor(Math.random() * 8),
      })),
  )
  const st = useRef({ kind: null, alpha: 0, painted: null })
  useEffect(() => () => Object.values(textures).forEach((t) => t.dispose()), [textures])

  useFrame((state, dtRaw) => {
    const m = mesh.current
    if (!m) return
    const dt = Math.min(dtRaw, 0.1)
    const s = st.current
    const want = KINDS[worldClock.weather] ? worldClock.weather : null
    // tür değişiminde önce sön, sonra yeni türle belir
    if (s.kind !== want) {
      s.alpha = Math.max(0, s.alpha - dt / FADE)
      if (s.alpha === 0) s.kind = want
    } else if (s.kind) s.alpha = Math.min(1, s.alpha + dt / FADE)
    const K = s.kind && KINDS[s.kind]
    if (!K || s.alpha <= 0.01) {
      m.visible = false
      return
    }
    m.visible = true
    const cap = (touch ? TOUCH_MAX : MAX) * (reduced ? 0.4 : 1)
    const n = Math.max(8, Math.floor(cap * K.n))
    m.count = n
    m.material.opacity = K.op * s.alpha
    if (s.painted !== s.kind) {
      s.painted = s.kind
      m.material.map = textures[s.kind]
      m.material.needsUpdate = true
      for (let i = 0; i < MAX; i++) m.setColorAt(i, col.set(K.color[seeds[i].ci % K.color.length]))
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
    const f = focusRef.current
    const t = state.clock.elapsedTime
    const q = state.camera.quaternion
    for (let i = 0; i < n; i++) {
      const p = seeds[i]
      p.y -= K.fall * p.sp * dt
      if (p.y < 0) p.y += H
      const sw = K.sway ? Math.sin(t * 0.8 + p.ph) * K.sway : 0
      dummy.position.set(f.x + p.ox + sw, p.y, f.z + p.oz + (K.sway ? Math.cos(t * 0.7 + p.ph) * K.sway : 0))
      dummy.quaternion.copy(q)
      if (K.spin) dummy.rotateZ(t * K.spin * p.sp + p.ph)
      dummy.scale.set(K.size[0] * p.sz, K.size[1] * p.sz, 1)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={(m) => {
        mesh.current = m
        m?.instanceMatrix.setUsage(DynamicDrawUsage)
      }}
      args={[null, null, MAX]}
      frustumCulled={false}
      renderOrder={6}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={textures.snow} transparent depthWrite={false} toneMapped={false} fog={false} />
    </instancedMesh>
  )
}
