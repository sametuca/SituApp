// Mekân ışık rolleri: atmosfer (Lights), odak (FocalLights), dekoratif (FocalPools/StringLights), kulüp ışık gösterisi (ClubLights).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, CanvasTexture, Color, Object3D } from 'three'
import { skyLive } from './Sky'
import { playerPos } from './cull'
import { venueStore } from './features/venueStore'
import { hd, hw, wallH } from './venueParts'
export function ClubLights() {
  const a = useRef()
  const b = useRef()
  const c = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const boost = venueStore.singing ? 1.5 : 1
    if (a.current) {
      a.current.position.set(-1.2 + Math.sin(t * 0.9) * 3, 2.6, 1.3 + Math.cos(t * 0.7) * 2)
      a.current.color.setHSL((t * 0.12) % 1, 0.9, 0.6)
      a.current.intensity = 14 * boost
    }
    if (b.current) {
      b.current.position.set(Math.cos(t * 0.6) * 4, 2.6, Math.sin(t * 0.8) * 3)
      b.current.color.setHSL((t * 0.12 + 0.5) % 1, 0.9, 0.6)
      b.current.intensity = 12 * boost
    }
    if (c.current) c.current.intensity = venueStore.singing ? 30 : 6
  })
  return (
    <>
      <pointLight ref={a} distance={9} />
      <pointLight ref={b} distance={9} />
      <pointLight ref={c} position={[4.4, 3.2, -2.4]} distance={7} color="#ffebd6" />
    </>
  )
}

// ---------- ışık rolleri ----------
// 1) atmosfer: Lights() (güneş benzeri tek yönlü ışık + hafif sıcak merkez + soğuk leylak kenar ışığı + sıcak dolgu: avatarlar gölgede kaybolmaz)
// 2) odak: FocalLights → yalnızca 2 gerçek ışık, oyuncuya en yakın masa/tezgâh/sahne noktasına kayar, yaklaştıkça güçlenir (sıcak kehribar ~2400K)
// 3) dekor: FocalPools (zemine yansıyan sahte ışık havuzları) + StringLights (emissive ampul zinciri) gerçek ışık harcamaz;
//    yoğunluğu gün batımı ilerledikçe (skyLive.lit) 0'dan yükselir, loş mekânlarda (bar/arcade/club) baştan tamdır
export const AMBER = '#ffb25e'
export const smooth01 = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
export const warmthOf = (th) => (th.dim ?? 0) >= 0.5 ? 1 : 0.4 + 0.6 * smooth01(0.05, 0.5, skyLive.lit ?? 0)
export function focalPoints(L) {
  const pts = []
  for (const it of L.items) {
    if (it.t === 'glb' && it.m === 'table') pts.push({ x: it.x, z: it.z, r: 2.4 })
    else if (it.t === 'counter') pts.push({ x: it.x, z: it.z + 0.2, r: 3.4 })
    else if (it.t === 'stage') pts.push({ x: it.x, z: it.z, r: 4.2 })
  }
  if (L.dj?.spot) pts.push({ x: L.dj.spot.x, z: L.dj.spot.z, r: 3.4 })
  if (L.photo) pts.push({ x: L.photo.x, z: L.photo.z, r: 3 })
  return pts.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.z)).slice(0, 40)
}
export let poolTex = null
export const poolTexture = () => {
  if (poolTex) return poolTex
  const cv = document.createElement('canvas')
  cv.width = cv.height = 64
  const g = cv.getContext('2d')
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  gr.addColorStop(0, 'rgba(255,255,255,1)')
  gr.addColorStop(0.45, 'rgba(255,255,255,0.4)')
  gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 64, 64)
  poolTex = new CanvasTexture(cv)
  return poolTex
}

export function FocalLights({ pts }) {
  const lights = useRef([])
  const st = useRef([
    { x: 0, z: 0, i: 0 },
    { x: 0, z: 0, i: 0 },
  ])
  const acc = useRef(0)
  const want = useRef([null, null])
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    acc.current += dt
    if (acc.current > 0.3) {
      acc.current = 0
      const near = pts.map((p) => ({ p, d: Math.hypot(p.x - playerPos.x, p.z - playerPos.z) })).sort((a, b) => a.d - b.d).slice(0, 2)
      want.current = [near[0] ?? null, near[1] ?? null]
    }
    const w = warmthOf({ dim: 0 })
    for (let i = 0; i < 2; i++) {
      const l = lights.current[i]
      const s = st.current[i]
      const t = want.current[i]
      if (!l) continue
      const k = 1 - Math.exp(-dt * 3)
      if (t) {
        if (s.i < 0.05) {
          s.x = t.p.x
          s.z = t.p.z
        } else {
          s.x += (t.p.x - s.x) * k
          s.z += (t.p.z - s.z) * k
        }
      }
      const goal = t ? (0.35 + 0.65 * smooth01(8, 1.5, t.d)) * 9 * w : 0
      s.i += (goal - s.i) * k
      l.position.set(s.x, 2.1, s.z)
      l.intensity = s.i
    }
  })
  return (
    <>
      {[0, 1].map((i) => (
        <pointLight key={i} ref={(l) => (lights.current[i] = l)} color={AMBER} intensity={0} distance={6.5} decay={2} />
      ))}
    </>
  )
}

export function FocalPools({ pts, th }) {
  const ref = useRef()
  const dummy = useMemo(() => new Object3D(), [])
  const tex = useMemo(() => poolTexture(), [])
  useEffect(() => {
    const m = ref.current
    if (!m) return
    pts.forEach((p, i) => {
      dummy.position.set(p.x, 0.035, p.z)
      dummy.rotation.set(-Math.PI / 2, 0, 0)
      dummy.scale.set(p.r * 2, p.r * 2, 1)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  }, [pts, dummy])
  useFrame(() => {
    if (ref.current) ref.current.material.opacity = 0.42 * warmthOf(th) * (th.dim >= 0.5 ? 0.8 : 1)
  })
  if (!pts.length) return null
  return (
    <instancedMesh ref={ref} args={[null, null, pts.length]} frustumCulled={false} renderOrder={2}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={tex} color="#ffb766" transparent opacity={0.3} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
    </instancedMesh>
  )
}

export function StringLights({ th }) {
  const ref = useRef()
  const dummy = useMemo(() => new Object3D(), [])
  const spots = useMemo(() => {
    const out = []
    const y0 = wallH - 0.32
    const run = (ax, az, bx, bz, n) => {
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n
        out.push([ax + (bx - ax) * u, y0 - 0.38 * (1 - (2 * u - 1) ** 2), az + (bz - az) * u])
      }
    }
    run(-hw + 0.3, -hd + 0.35, hw - 0.3, -hd + 0.35, 24)
    run(-hw + 0.35, -hd + 0.5, -hw + 0.35, hd - 0.6, 14)
    run(hw - 0.35, -hd + 0.5, hw - 0.35, hd - 0.6, 14)
    return out
  }, [])
  useEffect(() => {
    const m = ref.current
    if (!m) return
    spots.forEach((s, i) => {
      dummy.position.set(s[0], s[1], s[2])
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  }, [spots, dummy])
  const col = useMemo(() => new Color(), [])
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    // emissive ampuller (bloom eşiğinin üstüne çıkar); gün batımıyla yavaşça yanar, hafif titrer
    const k = warmthOf(th) * (0.92 + Math.sin(clock.elapsedTime * 2.3) * 0.08)
    m.material.color.copy(col.set('#ffd9a0')).multiplyScalar(0.25 + k * 2.1)
  })
  return (
    <instancedMesh ref={ref} args={[null, null, spots.length]} frustumCulled={false}>
      <sphereGeometry args={[0.07, 8, 6]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

export function Lights({ th }) {
  const dim = th.dim
  return (
    <>
      <directionalLight
        castShadow
        position={[3.5, 9, 6]}
        intensity={1.3 * (1 - dim * 0.75)}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-bias={-0.0005}
      />
      <pointLight position={[0, 3, 0]} intensity={14 * (1 - dim * 0.6)} distance={13} color={dim > 0.5 ? '#fec586' : '#fff0d9'} />
      {/* karakter okunabilirliği: soğuk leylak kenar ışığı (arkadan) + sıcak yumuşak dolgu (önden), gölge yok */}
      <directionalLight position={[-4, 6, -8]} intensity={0.42 * (1 - dim * 0.4)} color="#cdbbff" />
      <directionalLight position={[0, 5, 9]} intensity={0.34} color="#ffe3c0" />
    </>
  )
}

/** Mekânın iç mekânı. id: venues.js kimliği. */
