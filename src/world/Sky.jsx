// Gökyüzü, ışık ve gece görünümü (Canvas içi): güneş/ay yönü, ambient/hemisphere, arka plan + sis, yıldızlar, ay, güneş diski,
// sokak lambası parıltıları, ıslak zemin parıltısı. Saat/hava: worldClock (features/sky.jsx yayımlar).
// Ev içi (home) gün-geceden etkilenmez; yalnızca pencere gökyüzü rengi (skyLive.window) dışarıyı yansıtır.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  LatheGeometry,
  MeshStandardMaterial,
  Object3D,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from 'three'
import { BEACH, GAP, PIER, PROPS, ROAD_HALF } from './layout'
import { playerPos } from './cull'
import { nightAt, smooth, sunsetAt, worldClock } from './worldClock'
import { together } from './features/togetherStore'

const HOME_BG = '#faeee2'
const HOME_FOG = [HOME_BG, 30, 60]

/** TogetherScene.SkyTint'e verilen canlı "taban" renkleri (bu modül her karede günceller). */
export const skyBase = { bg: new Color('#bce4ff'), fog: [new Color('#bce4ff'), 78, 210] }

/** Diğer bileşenlerin okuduğu canlı gökyüzü durumu. */
export const skyLive = {
  dir: new Vector3(0.5, 0.8, 0.35), // ışık (güneş/ay) yönü
  color: new Color('#ffffff'),
  intensity: 1.6,
  window: new Color('#cfeaff'), // ev penceresinden görünen gökyüzü
  lit: 0, // 0..1 yapay ışıkların yanma düzeyi (lamba, pencere, neon)
  wet: 0, // 0..1 yağmurdan ıslaklık
  night: 0,
  over: 0,
  hour: 12,
}

/** Şehir binalarının/çeşmenin paylaşılan malzemeleri (City.jsx kullanır; Sky gece parlatır). */
export const SKY_MATS = {
  window: new MeshStandardMaterial({ color: '#fff4c4', emissive: '#ffc966', emissiveIntensity: 0.4, roughness: 0.08, metalness: 0.35, envMapIntensity: 1.6 }),
  neonPink: new MeshStandardMaterial({ color: '#fdb15e', emissive: '#fd9c33', emissiveIntensity: 1.4 }),
  neonBlue: new MeshStandardMaterial({ color: '#8fd8ff', emissive: '#4fc3ff', emissiveIntensity: 1.4 }),
  water: new MeshStandardMaterial({ color: '#9fdcff', roughness: 0.06, metalness: 0.25, envMapIntensity: 1.5, emissive: '#6cc7f5', emissiveIntensity: 0.25 }),
  fountainTop: new MeshStandardMaterial({ color: '#a9ddf5', roughness: 0.14, metalness: 0.2, envMapIntensity: 1.4, emissive: '#6cc7f5', emissiveIntensity: 0.3 }),
}

// ---------------------------------------------------------------- anahtar kareler (saat → renkler)
const C = (s) => new Color(s)
const KEYS = {
  night: { bg: C('#1f2659'), fog: C('#2c356e'), sun: C('#ffe6b8'), sunI: 0.68, amb: C('#9aaaf5'), ambI: 0.44, hs: C('#8ea3ff'), hg: C('#7a5d7e'), hI: 0.58, fn: 64, ff: 185 },
  dawn: { bg: C('#ffd9b0'), fog: C('#ffe6c8'), sun: C('#ffba85'), sunI: 1.08, amb: C('#ffeedb'), ambI: 0.38, hs: C('#ffe4c4'), hg: C('#f5d4b0'), hI: 0.68, fn: 72, ff: 195 },
  day: { bg: C('#a9dcff'), fog: C('#c2e7ff'), sun: C('#ffffff'), sunI: 1.65, amb: C('#ffffff'), ambI: 0.48, hs: C('#f2f9ff'), hg: C('#ffe9d6'), hI: 0.85, fn: 78, ff: 210 },
  dusk: { bg: C('#ff9f78'), fog: C('#ffbca0'), sun: C('#ff945e'), sunI: 1.18, amb: C('#ffd0ba'), ambI: 0.42, hs: C('#ffc4a8'), hg: C('#cfa0e6'), hI: 0.66, fn: 70, ff: 190 },
  dusk2: { bg: C('#5f4396'), fog: C('#785aa8'), sun: C('#ffd4a3'), sunI: 0.84, amb: C('#bfa8f2'), ambI: 0.44, hs: C('#b096eb'), hg: C('#8a629c'), hI: 0.58, fn: 66, ff: 185 },
}
const FRAMES = [
  [0, 'night'],
  [4.6, 'night'],
  [6.3, 'dawn'],
  [8.2, 'day'],
  [16.8, 'day'],
  [18.6, 'dusk'],
  [20, 'dusk2'],
  [21.6, 'night'],
  [24, 'night'],
]
const COLOR_KEYS = ['bg', 'fog', 'sun', 'amb', 'hs', 'hg']
const NUM_KEYS = ['sunI', 'ambI', 'hI', 'fn', 'ff']
const cur = Object.fromEntries([...COLOR_KEYS.map((k) => [k, new Color()]), ...NUM_KEYS.map((k) => [k, 0])])

function frameAt(h) {
  let i = 0
  while (i < FRAMES.length - 2 && h >= FRAMES[i + 1][0]) i++
  const [h0, k0] = FRAMES[i]
  const [h1, k1] = FRAMES[i + 1]
  const t = smooth(0, 1, (h - h0) / (h1 - h0))
  const a = KEYS[k0]
  const b = KEYS[k1]
  for (const k of COLOR_KEYS) cur[k].copy(a[k]).lerp(b[k], t)
  for (const k of NUM_KEYS) cur[k] = a[k] + (b[k] - a[k]) * t
  return cur
}

const GRAY = C('#b9c4d8')
const tmp = new Color()
const SUN_DIR = new Vector3()
const MOON_DIR = new Vector3(0.45, 0.8, 0.4).normalize()
function sunDirAt(h, out) {
  const p = Math.min(1, Math.max(0, (h - 6) / 13))
  const el = 0.35 + 0.95 * Math.sin(p * Math.PI)
  const a = -1.2 + 2.4 * p
  return out.set(Math.cos(el) * Math.sin(a), Math.sin(el), Math.cos(el) * Math.cos(a))
}

// ---------------------------------------------------------------- küçük dokular
function glowTexture(stops) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  for (const [o, col] of stops) grad.addColorStop(o, col)
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}
const SOFT = [
  [0, 'rgba(255,255,255,1)'],
  [0.35, 'rgba(255,255,255,0.55)'],
  [1, 'rgba(255,255,255,0)'],
]

// ---------------------------------------------------------------- gökcisimleri
function mulberry(a) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function Heavens() {
  const group = useRef()
  const stars = useRef()
  const moon = useRef()
  const moonHalo = useRef()
  const sun = useRef()
  const sunHalo = useRef()
  const halo = useMemo(() => glowTexture(SOFT), [])
  useEffect(() => () => halo.dispose(), [halo])
  const geo = useMemo(() => {
    const r = mulberry(7)
    const N = 170
    const pos = []
    const col = []
    const pal = [C('#ffffff'), C('#fff3b8'), C('#ffe9d0'), C('#cfe6ff')]
    for (let i = 0; i < N; i++) {
      const az = r() * Math.PI * 2
      const el = 0.12 + Math.acos(1 - r() * 0.92) * 0.95 // üst yarım küre
      const R = 170
      pos.push(Math.cos(az) * Math.sin(el) * R, Math.cos(el) * R, Math.sin(az) * Math.sin(el) * R)
      const c = pal[Math.floor(r() * pal.length)]
      col.push(c.r, c.g, c.b)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new Float32BufferAttribute(col, 3))
    return g
  }, [])
  useEffect(() => () => geo.dispose(), [geo])

  const camera = useThree((s) => s.camera)
  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    g.position.copy(camera.position)
    const night = skyLive.night
    const over = skyLive.over ?? 0
    if (stars.current) {
      stars.current.visible = night > 0.05
      stars.current.material.opacity = Math.max(0, night - 0.1) * (0.8 + Math.sin(clock.elapsedTime * 1.3) * 0.15) * (1 - over * 0.9)
    }
    const h = skyLive.hour
    if (moon.current) {
      moon.current.visible = night > 0.05
      moon.current.position.copy(MOON_DIR).multiplyScalar(150)
      moon.current.material.opacity = Math.min(1, night * 1.3) * (1 - over * 0.85)
      moonHalo.current.position.copy(moon.current.position)
      moonHalo.current.material.opacity = Math.min(1, night) * 0.55 * (1 - over * 0.85)
    }
    if (sun.current) {
      const vis = (1 - night) * (1 - over * 0.85)
      sun.current.visible = vis > 0.03
      sunDirAt(h, SUN_DIR)
      sun.current.position.copy(SUN_DIR).multiplyScalar(150)
      sun.current.material.color.copy(cur.sun).lerp(tmp.set('#fff3b0'), 0.5)
      sun.current.material.opacity = vis
      sunHalo.current.position.copy(sun.current.position)
      sunHalo.current.material.color.copy(cur.sun)
      sunHalo.current.material.opacity = vis * 0.6
    }
  })

  return (
    <group ref={group}>
      <points ref={stars} geometry={geo} frustumCulled={false} renderOrder={-2}>
        <pointsMaterial size={2.4} sizeAttenuation={false} vertexColors transparent depthWrite={false} fog={false} toneMapped={false} />
      </points>
      <mesh ref={moon} frustumCulled={false}>
        <sphereGeometry args={[7, 20, 14]} />
        <meshBasicMaterial color="#fff6d6" transparent fog={false} toneMapped={false} />
      </mesh>
      <sprite ref={moonHalo} scale={[48, 48, 1]}>
        <spriteMaterial map={halo} color="#c9d4ff" transparent depthWrite={false} blending={AdditiveBlending} fog={false} toneMapped={false} />
      </sprite>
      <mesh ref={sun} frustumCulled={false}>
        <sphereGeometry args={[8, 20, 14]} />
        <meshBasicMaterial color="#fff3b0" transparent fog={false} toneMapped={false} />
      </mesh>
      <sprite ref={sunHalo} scale={[60, 60, 1]}>
        <spriteMaterial map={halo} color="#ffffff" transparent depthWrite={false} blending={AdditiveBlending} fog={false} toneMapped={false} />
      </sprite>
    </group>
  )
}

// ---------------------------------------------------------------- sokak lambaları (yumuşak radyal yer ışığı + yakın gerçek ışıklar)
const LAMP_MODEL = '/models/park/park-lamp.glb'
const LAMPS = PROPS.filter((p) => p.model === LAMP_MODEL).map((p) => ({ x: p.x, z: p.z }))
const LAMP_TOP = 2.75
const REAL_LIGHTS = 2

function Lamps({ focusRef }) {
  const glow = useRef()
  const pool = useRef()
  const lights = useRef([])
  const t = useRef(0)
  const [lampLights, setLampLights] = useState(false)
  const lampLightsRef = useRef(false)
  const tex = useMemo(() => glowTexture(SOFT), [])
  useEffect(() => () => tex.dispose(), [tex])
  const dummy = useMemo(() => new Object3D(), [])
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    const m = pool.current
    if (!m) return
    LAMPS.forEach((l, i) => {
      dummy.position.set(l.x, 0.13, l.z)
      dummy.rotation.set(-Math.PI / 2, 0, 0)
      dummy.scale.set(9.5, 9.5, 1)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  }, [dummy])

  useFrame((_, dt) => {
    const lit = skyLive.lit
    const on = lit > 0.02
    // gündüz hiç ışık yok: gerçek nokta ışıkları sahnede bulunduğu sürece HER malzemenin gölgelendiricisine eklenir (boşuna maliyet)
    if (on !== lampLightsRef.current) {
      lampLightsRef.current = on
      setLampLights(on)
    }
    if (glow.current) glow.current.visible = on
    if (pool.current) pool.current.visible = on
    if (on && glow.current) {
      const m = glow.current
      for (let i = 0; i < LAMPS.length; i++) {
        dummy.position.set(LAMPS[i].x, LAMP_TOP, LAMPS[i].z)
        dummy.quaternion.copy(camera.quaternion)
        dummy.scale.set(3.4, 3.4, 1)
        dummy.updateMatrix()
        m.setMatrixAt(i, dummy.matrix)
      }
      m.instanceMatrix.needsUpdate = true
      m.material.opacity = lit * 0.92
      pool.current.material.opacity = lit * 0.42
    }
    // en yakın lambalara gerçek ışık ata (yarım saniyede bir)
    t.current += dt
    if (t.current > 0.4) {
      t.current = 0
      const f = focusRef.current
      const near = LAMPS.map((l) => ({ l, d: Math.hypot(l.x - f.x, l.z - f.z) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, REAL_LIGHTS)
      near.forEach((n, i) => lights.current[i]?.position.set(n.l.x, LAMP_TOP - 0.15, n.l.z))
    }
    lights.current.forEach((l) => l && (l.intensity = lit * 9.5))
  })

  return (
    <>
      <instancedMesh ref={glow} args={[null, null, LAMPS.length]} frustumCulled={false} renderOrder={4}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={tex} color="#ffd788" transparent depthWrite={false} blending={AdditiveBlending} fog={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={pool} args={[null, null, LAMPS.length]} frustumCulled={false} renderOrder={3}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={tex} color="#ffc978" transparent depthWrite={false} blending={AdditiveBlending} fog={false} toneMapped={false} />
      </instancedMesh>
      {lampLights && Array.from({ length: REAL_LIGHTS }, (_, i) => (
        <pointLight key={i} ref={(l) => (lights.current[i] = l)} color="#ffca7a" intensity={0} distance={15} decay={2} position={[0, LAMP_TOP, 0]} />
      ))}
    </>
  )
}

// ---------------------------------------------------------------- yaz akşamı feston ışık zincirleri + ateşböcekleri
const FESTOON_SPANS = (() => {
  const spans = []
  const edge = ROAD_HALF + 1.05
  // Kafe Sokağı & Plaj Yolu üstü sıcak ampul zincirleri
  for (const z of [-20.5, -26.5, -32.5, -38.5, 21.5, 28.5]) {
    spans.push({ ax: -edge, az: z - GAP * (z < 0 ? 1 : -1), bx: edge, bz: z - GAP * (z < 0 ? 1 : -1), y: 4.15, sag: 0.55, n: 7 })
  }
  // Gece Kulübü caddesi üstü sıcak + pastel zincirler
  for (const x of [22.5, 29.5, 36.5]) {
    spans.push({ ax: x + GAP, az: -edge, bx: x + GAP, bz: edge, y: 4.25, sag: 0.55, n: 7 })
  }
  // Plaj iskelesi iki yanı Edison fener dizisi
  spans.push(
    { ax: -1.35, az: PIER.z0 + 1.2, bx: -1.35, bz: PIER.z1 - 0.6, y: 1.55, sag: 0.25, n: 5 },
    { ax: 1.35, az: PIER.z0 + 1.2, bx: 1.35, bz: PIER.z1 - 0.6, y: 1.55, sag: 0.25, n: 5 },
  )
  return spans
})()

function SummerFestoons() {
  const bulbsRef = useRef()
  const socketsRef = useRef()
  const filamentsRef = useRef()
  const halosRef = useRef()
  const wiresRef = useRef()
  const tex = useMemo(() => glowTexture(SOFT), [])
  const bulbGeo = useMemo(() => {
    const pts = [
      new Vector2(0.0, -0.115),
      new Vector2(0.048, -0.105),
      new Vector2(0.088, -0.065),
      new Vector2(0.095, -0.015),
      new Vector2(0.068, 0.045),
      new Vector2(0.042, 0.09),
      new Vector2(0.036, 0.115),
      new Vector2(0.0, 0.115),
    ]
    return new LatheGeometry(pts, 16)
  }, [])
  useEffect(() => () => {
    tex.dispose()
    bulbGeo.dispose()
  }, [tex, bulbGeo])
  const camera = useThree((s) => s.camera)
  const dummy = useMemo(() => new Object3D(), [])

  const { bulbs, wires } = useMemo(() => {
    const bList = []
    const wList = []
    const cols = [C('#ffd980'), C('#ffbf69'), C('#ffe7a8'), C('#ffb09c')]
    FESTOON_SPANS.forEach((sp, si) => {
      const segs = sp.n - 1
      let prev = null
      for (let i = 0; i < sp.n; i++) {
        const u = i / segs
        const x = sp.ax + (sp.bx - sp.ax) * u
        const z = sp.az + (sp.bz - sp.az) * u
        const y = sp.y - Math.sin(u * Math.PI) * sp.sag
        if (prev) {
          const mx = (prev.x + x) / 2
          const my = (prev.y + y) / 2
          const mz = (prev.z + z) / 2
          const len = Math.hypot(x - prev.x, y - prev.y, z - prev.z)
          wList.push({ p: new Vector3(mx, my, mz), to: new Vector3(x, y, z), len })
        }
        // Duy telden aşağı sarkar, ampul duyun altında asılı durur
        bList.push({ x, wireY: y, y: y - 0.19, z, col: cols[(si + i) % cols.length], phase: si * 0.7 + i * 0.9 })
        prev = { x, y, z }
      }
    })
    return { bulbs: bList, wires: wList }
  }, [])

  useEffect(() => {
    const bm = bulbsRef.current
    const sm = socketsRef.current
    const fm = filamentsRef.current
    const wm = wiresRef.current
    if (bm) {
      bulbs.forEach((b, i) => {
        dummy.position.set(b.x, b.y, b.z)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        bm.setMatrixAt(i, dummy.matrix)
        bm.setColorAt(i, b.col)
      })
      bm.instanceMatrix.needsUpdate = true
      if (bm.instanceColor) bm.instanceColor.needsUpdate = true
    }
    if (sm) {
      bulbs.forEach((b, i) => {
        dummy.position.set(b.x, b.wireY - 0.05, b.z)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        sm.setMatrixAt(i, dummy.matrix)
      })
      sm.instanceMatrix.needsUpdate = true
    }
    if (fm) {
      bulbs.forEach((b, i) => {
        dummy.position.set(b.x, b.y - 0.015, b.z)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        fm.setMatrixAt(i, dummy.matrix)
      })
      fm.instanceMatrix.needsUpdate = true
    }
    if (wm) {
      wires.forEach((w, i) => {
        dummy.position.copy(w.p)
        dummy.lookAt(w.to)
        dummy.scale.set(1, 1, w.len)
        dummy.updateMatrix()
        wm.setMatrixAt(i, dummy.matrix)
      })
      wm.instanceMatrix.needsUpdate = true
    }
  }, [bulbs, wires, dummy])

  const acc = useRef(0)
  useFrame(({ clock }, dt) => {
    const lit = skyLive.lit
    const on = lit > 0.02
    if (bulbsRef.current?.material) {
      bulbsRef.current.material.emissiveIntensity = 0.08 + lit * 1.45
    }
    if (filamentsRef.current?.material) {
      filamentsRef.current.material.emissiveIntensity = 0.15 + lit * 3.2
    }
    const hm = halosRef.current
    if (!hm) return
    hm.visible = on
    if (!on) return
    acc.current += dt
    if (acc.current < 0.04) return
    acc.current = 0
    const t = clock.elapsedTime
    for (let i = 0; i < bulbs.length; i++) {
      const b = bulbs[i]
      const pulse = 0.85 + Math.sin(t * 2.2 + b.phase) * 0.15
      dummy.position.set(b.x, b.y - 0.02, b.z)
      dummy.quaternion.copy(camera.quaternion)
      dummy.scale.setScalar(1.25 * pulse)
      dummy.updateMatrix()
      hm.setMatrixAt(i, dummy.matrix)
    }
    hm.instanceMatrix.needsUpdate = true
    hm.material.opacity = lit * 0.72
  })

  return (
    <group>
      <instancedMesh ref={wiresRef} args={[undefined, undefined, wires.length]} frustumCulled={false}>
        <boxGeometry args={[0.026, 0.026, 1]} />
        <meshStandardMaterial color="#352b47" roughness={0.85} />
      </instancedMesh>
      {/* Siyah/antrasit duy ve kısa askı kordonu */}
      <instancedMesh ref={socketsRef} args={[undefined, undefined, bulbs.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.042, 0.048, 0.1, 10]} />
        <meshStandardMaterial color="#2b2338" roughness={0.55} metalness={0.25} />
      </instancedMesh>
      {/* İç filaman çekirdeği */}
      <instancedMesh ref={filamentsRef} args={[undefined, undefined, bulbs.length]} frustumCulled={false}>
        <capsuleGeometry args={[0.014, 0.045, 4, 8]} />
        <meshStandardMaterial color="#fff8d6" emissive="#ffe07d" emissiveIntensity={0.15} roughness={0.2} toneMapped={false} />
      </instancedMesh>
      {/* Damla formunda yarı saydam sıcak cam ampul */}
      <instancedMesh ref={bulbsRef} args={[bulbGeo, undefined, bulbs.length]} frustumCulled={false}>
        <meshStandardMaterial color="#fff6dc" emissive="#ffc46b" emissiveIntensity={0.08} roughness={0.18} metalness={0.05} transparent opacity={0.86} />
      </instancedMesh>
      <instancedMesh ref={halosRef} args={[undefined, undefined, bulbs.length]} frustumCulled={false} renderOrder={4}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={tex} color="#ffd588" transparent depthWrite={false} blending={AdditiveBlending} fog={false} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

function Fireflies() {
  const ref = useRef()
  const tex = useMemo(() => glowTexture(SOFT), [])
  useEffect(() => () => tex.dispose(), [tex])
  const count = 48
  const seeds = useMemo(() => {
    const r = mulberry(91)
    const anchors = [
      { x: -30, z: 0, rad: 18 }, // park
      { x: 0, z: 0, rad: 14 }, // meydan
      { x: 0, z: -32, rad: 12 }, // kafe sokağı
      { x: BEACH.x, z: BEACH.z + 4, rad: 28 }, // plaj palmiyeleri
    ]
    return Array.from({ length: count }, (_, i) => {
      const a = anchors[i % anchors.length]
      const ang = r() * Math.PI * 2
      const dist = Math.sqrt(r()) * a.rad
      return {
        bx: a.x + Math.cos(ang) * dist,
        by: 0.75 + r() * 2.1,
        bz: a.z + Math.sin(ang) * dist,
        sp: 0.6 + r() * 1.1,
        ph: r() * Math.PI * 2,
      }
    })
  }, [])
  const geo = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const pal = [C('#ffe796'), C('#ffd180'), C('#d8ff9e')]
    for (let i = 0; i < count; i++) {
      const c = pal[i % pal.length]
      col[i * 3] = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
      pos[i * 3] = seeds[i].bx
      pos[i * 3 + 1] = seeds[i].by
      pos[i * 3 + 2] = seeds[i].bz
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new Float32BufferAttribute(col, 3))
    return g
  }, [seeds])
  useEffect(() => () => geo.dispose(), [geo])

  const ffAcc = useRef(0)
  useFrame(({ clock }, dt) => {
    const p = ref.current
    if (!p) return
    const vis = skyLive.lit > 0.15
    p.visible = vis
    if (!vis) return
    ffAcc.current += dt
    if (ffAcc.current < 0.04) return
    ffAcc.current = 0
    const t = clock.elapsedTime
    const arr = geo.attributes.position.array
    for (let i = 0; i < count; i++) {
      const s = seeds[i]
      arr[i * 3] = s.bx + Math.sin(t * s.sp + s.ph) * 0.9
      arr[i * 3 + 1] = s.by + Math.sin(t * s.sp * 1.4 + s.ph) * 0.35
      arr[i * 3 + 2] = s.bz + Math.cos(t * s.sp * 0.85 + s.ph) * 0.9
    }
    geo.attributes.position.needsUpdate = true
    p.material.opacity = Math.min(0.9, (skyLive.lit - 0.15) * 1.1) * (0.78 + Math.sin(t * 2.5) * 0.18)
  })

  return (
    <points ref={ref} geometry={geo} frustumCulled={false} renderOrder={5}>
      <pointsMaterial map={tex} size={0.55} vertexColors transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
    </points>
  )
}

/** Yağmurda zemin üstüne ince yarı saydam parlak tabaka (ucuz ıslak zemin). */
function WetSheen({ focusRef }) {
  const mesh = useRef()
  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const w = skyLive.wet
    m.visible = w > 0.02
    if (!m.visible) return
    const f = focusRef.current
    m.position.set(f.x, 0.115, f.z)
    m.material.opacity = w * 0.12
  })
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <planeGeometry args={[80, 80]} />
      <meshStandardMaterial color="#dbe8ff" roughness={0.08} metalness={0.5} transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

// ---------------------------------------------------------------- ana bileşen
const EASE_WX = 3 // sn: hava geçişi
const MAX_HOUR_SPEED = 3.5 // saat/sn: mod değişiminde saatin akış hızı

// home: ev içi (sabit ışık). interior: mekân içi { bg, fog: [renk, near, far], dim } (gün-geceden bağımsız, temaya göre loş).
const ZENITH_DAY = new Color('#3694f5')
const MID_DAY = new Color('#86d2ff')
const ZENITH_NIGHT = new Color('#161b4f')
const MID_NIGHT = new Color('#2e3878')
const ZENITH_DUSK = new Color('#7e57c2')
const MID_DUSK = new Color('#ff9e7d')

/** Atmosferik 3 katmanlı gökyüzü + güneş saçılımı + rüzgârda süzülen yumuşak pastel bulutlar (tek shader, 0 doku). */
function SkyDome() {
  const meshRef = useRef()
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: new Color('#3694f5') },
          uMid: { value: new Color('#86d2ff') },
          uHorizon: { value: new Color('#dff2ff') },
          uSunDir: { value: new Vector3(0.5, 0.72, 0.35).normalize() },
          uSunCol: { value: new Color('#fff3cc') },
          uTime: { value: 0 },
          uNight: { value: 0 },
          uOver: { value: 0 },
        },
        vertexShader: `
          varying vec3 vDir;
          void main() {
            vDir = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uTop;
          uniform vec3 uMid;
          uniform vec3 uHorizon;
          uniform vec3 uSunDir;
          uniform vec3 uSunCol;
          uniform float uTime;
          uniform float uNight;
          uniform float uOver;
          varying vec3 vDir;

          float hash(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
          }
          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
              mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
              u.y
            );
          }
          float fbm(vec2 p) {
            float v = 0.0;
            float a = 0.52;
            mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
            for (int i = 0; i < 4; i++) {
              v += a * noise(p);
              p = rot * p * 2.03 + vec2(7.3, 3.1);
              a *= 0.5;
            }
            return v;
          }

          void main() {
            vec3 d = normalize(vDir);
            float h = clamp(d.y, 0.0, 1.0);

            // 3 katmanlı atmosferik gradyan (ufuk → orta gök → derin tepe)
            vec3 sky = mix(uHorizon, uMid, smoothstep(0.0, 0.32, h));
            sky = mix(sky, uTop, smoothstep(0.22, 0.88, h));

            // Ufukta sıcak güneşli pastel parlaklık
            float horizonBand = pow(1.0 - h, 5.5) * (1.0 - uNight * 0.8);
            sky = mix(sky, mix(uHorizon, vec3(1.0, 0.96, 0.88), 0.45), horizonBand * 0.55);

            // Güneş saçılımı (Mie halesi + yumuşak güneş diski)
            float sunDot = max(dot(d, normalize(uSunDir)), 0.0);
            float sunHalo = pow(sunDot, 10.0) * 0.34 + pow(sunDot, 64.0) * 0.45;
            float sunCore = smoothstep(0.9965, 0.9992, sunDot) * 0.85;
            sky += uSunCol * (sunHalo + sunCore) * (1.0 - uNight * 0.85) * (1.0 - uOver * 0.6);

            // Rüzgârda süzülen yumuşak ressam-stili bulutlar
            if (d.y > 0.02) {
              vec2 uv = d.xz / (d.y + 0.24) * 1.35;
              vec2 wind = vec2(uTime * 0.016, uTime * 0.007);
              float n1 = fbm(uv + wind);
              float n2 = fbm(uv * 1.9 - wind * 0.6 + 11.4);
              float c = n1 * 0.72 + n2 * 0.28;
              float cover = mix(0.49, 0.34, uOver);
              float cloud = smoothstep(cover, cover + 0.24, c);
              // Ufka yaklaştıkça bulutlar yumuşakça sise karışır
              cloud *= smoothstep(0.02, 0.22, h) * (1.0 - smoothstep(0.82, 0.98, h) * 0.35);

              // Bulut gölgeleme: üstü krem-beyaz, altı yumuşak pastel mavi-lila, güneş kenarı altın parlama
              float shade = smoothstep(cover, cover + 0.35, fbm(uv + wind + normalize(uSunDir).xz * 0.14));
              vec3 cLit = mix(vec3(1.0, 0.995, 0.97), uSunCol, 0.15 + pow(sunDot, 6.0) * 0.28);
              vec3 cShd = mix(vec3(0.76, 0.86, 0.97), uMid, 0.28);
              vec3 cCol = mix(cShd, cLit, 0.38 + shade * 0.62);
              cCol = mix(cCol, vec3(0.24, 0.28, 0.52), uNight * 0.85);
              sky = mix(sky, cCol, cloud * 0.88);
            }

            gl_FragColor = vec4(sky, 1.0);
          }
        `,
      }),
    [],
  )
  useEffect(() => () => mat.dispose(), [mat])
  const tmpZ = useMemo(() => new Color(), [])
  const tmpM = useMemo(() => new Color(), [])
  useFrame(({ scene, camera, clock }) => {
    if (meshRef.current) meshRef.current.position.copy(camera.position)
    if (scene.fog) mat.uniforms.uHorizon.value.copy(scene.fog.color)
    const night = Number.isFinite(skyLive.night) ? skyLive.night : 0
    const sun = sunsetAt(skyLive.hour)
    tmpZ.copy(ZENITH_DAY).lerp(ZENITH_DUSK, sun).lerp(ZENITH_NIGHT, night)
    tmpM.copy(MID_DAY).lerp(MID_DUSK, sun).lerp(MID_NIGHT, night)
    mat.uniforms.uTop.value.copy(tmpZ)
    mat.uniforms.uMid.value.copy(tmpM)
    mat.uniforms.uSunDir.value.copy(skyLive.dir)
    mat.uniforms.uTime.value = clock.elapsedTime
    mat.uniforms.uNight.value = night
    mat.uniforms.uOver.value = Number.isFinite(skyLive.over) ? skyLive.over : 0
  })
  return (
    <mesh ref={meshRef} material={mat} frustumCulled={false}>
      <sphereGeometry args={[210, 28, 18]} />
    </mesh>
  )
}

export default function Sky({ home: homeProp, interior = null, focusRef }) {
  const home = Boolean(homeProp || interior)
  const scene = useThree((s) => s.scene)
  const amb = useRef()
  const hemi = useRef()
  const warmFill = useRef()
  const coolRim = useRef()
  const st = useRef({ dh: null, rain: 0, snow: 0, leaves: 0 })

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const s = st.current
    const target = worldClock.hour
    if (s.dh == null) s.dh = target
    let diff = ((target - s.dh + 36) % 24) - 12
    const step = MAX_HOUR_SPEED * dt
    diff = Math.max(-step, Math.min(step, diff))
    s.dh = (s.dh + diff + 24) % 24
    const h = s.dh

    // hava ağırlıkları yumuşakça hedefe
    const w = worldClock.weather
    for (const k of ['rain', 'snow', 'leaves']) {
      const goal = w === k ? 1 : 0
      const d = goal - s[k]
      s[k] += Math.sign(d) * Math.min(Math.abs(d), dt / EASE_WX)
    }
    const over = Math.min(1, s.rain + s.snow * 0.5 + s.leaves * 0.2)
    const night = nightAt(h)
    const sunset = sunsetAt(h)
    const k = frameAt(h)

    // pencere gökyüzü (hava durumu karışmadan önce hafif gri)
    skyLive.window.copy(k.bg).lerp(tmp.copy(GRAY).multiplyScalar(1 - 0.6 * night), over * 0.45)

    // hava etkisi
    const grey = tmp.copy(GRAY).multiplyScalar(1 - 0.6 * night)
    k.bg.lerp(grey, over * 0.55)
    k.fog.lerp(grey, over * 0.5)
    let fn = k.fn
    let ff = k.ff
    ff += (90 - ff) * s.rain * 0.5
    const sunI = k.sunI * (1 - 0.5 * over)

    skyLive.night = night
    skyLive.hour = h
    skyLive.over = over
    skyLive.wet = s.rain
    skyLive.lit = Math.min(1, night * 1.15 + sunset * 0.5)
    // ışık yönü: gündüz güneş, gece ay
    sunDirAt(h, SUN_DIR)
    skyLive.dir.copy(SUN_DIR).lerp(MOON_DIR, Math.min(1, night * 1.2)).normalize()
    skyLive.color.copy(k.sun)
    skyLive.intensity = sunI

    // paylaşılan malzemeler
    const lit = skyLive.lit
    SKY_MATS.window.emissiveIntensity = 0.35 + lit * 2.15
    SKY_MATS.window.emissive.set('#ffe49a').lerp(tmp.set('#ffbe55'), lit)
    SKY_MATS.neonPink.emissiveIntensity = 1.2 + lit * 2.3
    SKY_MATS.neonBlue.emissiveIntensity = 1.2 + lit * 2.3
    SKY_MATS.water.emissiveIntensity = 0.25 + night * 0.9
    SKY_MATS.fountainTop.emissiveIntensity = 0.3 + night * 1.1

    // ev içi: gün-geceden bağımsız sabit değerler
    const dimK = interior ? 1 - (interior.dim ?? 0) * 0.75 : 1
    if (warmFill.current) warmFill.current.intensity = (home ? 0.08 : 0.2) * (1 - over * 0.35) * (1 - night * 0.4) * dimK
    if (coolRim.current) coolRim.current.intensity = (home ? 0.06 : 0.24) * (1 - over * 0.45) * (1 - night * 0.55) * dimK
    const bg = interior ? tmp.set(interior.bg) : home ? tmp.set(HOME_BG) : k.bg
    skyBase.bg.copy(bg)
    if (home) {
      const fg = interior ? interior.fog : HOME_FOG
      skyBase.fog[0].set(fg[0])
      skyBase.fog[1] = fg[1]
      skyBase.fog[2] = fg[2]
    } else {
      skyBase.fog[0].copy(k.fog)
      skyBase.fog[1] = fn
      skyBase.fog[2] = ff
    }
    if (together.sky.t === 0) {
      // gün batımı anı etkinken TogetherScene.SkyTint bu değerlerin üstüne biner
      if (scene.background?.isColor) scene.background.copy(skyBase.bg)
      if (scene.fog) {
        scene.fog.color.copy(skyBase.fog[0])
        scene.fog.near = skyBase.fog[1]
        scene.fog.far = skyBase.fog[2]
      }
    }
    if (amb.current) {
      amb.current.color.copy(home ? tmp.set('#ffffff') : k.amb)
      amb.current.intensity = home ? 0.7 * dimK : k.ambI * (1 - 0.1 * over)
    }
    if (hemi.current) {
      hemi.current.color.copy(home ? tmp.set('#ffffff') : k.hs)
      hemi.current.groundColor.copy(home ? tmp.set('#ffedd6') : k.hg)
      hemi.current.intensity = home ? 1.1 * dimK : k.hI * (1 - 0.1 * over)
    }
  })

  return (
    <>
      <ambientLight ref={amb} intensity={0.7} />
      <hemisphereLight ref={hemi} args={['#ffffff', '#ffedd6', 1.1]} />
      <directionalLight ref={warmFill} position={[8, 12, 6]} color="#fff0dc" intensity={0.2} />
      <directionalLight ref={coolRim} position={[-8, 7, -8]} color="#c8e8ff" intensity={0.24} />
      {!home && (
        <>
          <SkyDome />
          <Heavens />
          <Lamps focusRef={focusRef} />
          <SummerFestoons />
          <Fireflies />
          <WetSheen focusRef={focusRef} />
        </>
      )}
    </>
  )
}
