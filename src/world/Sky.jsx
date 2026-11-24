// Gökyüzü, ışık ve gece görünümü (Canvas içi): güneş/ay yönü, ambient/hemisphere, arka plan + sis, yıldızlar, ay, güneş diski,
// sokak lambası parıltıları, ıslak zemin parıltısı. Saat/hava: worldClock (features/sky.jsx yayımlar).
// Ev içi (home) gün-geceden etkilenmez; yalnızca pencere gökyüzü rengi (skyLive.window) dışarıyı yansıtır.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  MeshStandardMaterial,
  Object3D,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { PROPS } from './layout'
import { nightAt, smooth, sunsetAt, worldClock } from './worldClock'
import { together } from './features/togetherStore'

const HOME_BG = '#f9e3f1'
const HOME_FOG = [HOME_BG, 30, 60]

/** TogetherScene.SkyTint'e verilen canlı "taban" renkleri (bu modül her karede günceller). */
export const skyBase = { bg: new Color('#cfeaff'), fog: [new Color('#e8f6ff'), 50, 140] }

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
  window: new MeshStandardMaterial({ color: '#fff6cf', emissive: '#ffe49a', emissiveIntensity: 0.35, roughness: 0.3 }),
  neonPink: new MeshStandardMaterial({ color: '#ff8ad8', emissive: '#ff5fcf', emissiveIntensity: 1.4 }),
  neonBlue: new MeshStandardMaterial({ color: '#8fd8ff', emissive: '#4fc3ff', emissiveIntensity: 1.4 }),
  water: new MeshStandardMaterial({ color: '#9fdcff', roughness: 0.1, metalness: 0.1, emissive: '#6cc7f5', emissiveIntensity: 0.25 }),
  fountainTop: new MeshStandardMaterial({ color: '#a9ddf5', roughness: 0.2, emissive: '#6cc7f5', emissiveIntensity: 0.3 }),
}

// ---------------------------------------------------------------- anahtar kareler (saat → renkler)
const C = (s) => new Color(s)
const KEYS = {
  night: { bg: C('#3b3f80'), fog: C('#4d4f93'), sun: C('#b4c0ff'), sunI: 0.55, amb: C('#9aa4ff'), ambI: 0.55, hs: C('#8e9cff'), hg: C('#6b5aa6'), hI: 0.65, fn: 40, ff: 125 },
  dawn: { bg: C('#ffd0da'), fog: C('#ffe1e6'), sun: C('#ffc6a0'), sunI: 1.0, amb: C('#fff0f4'), ambI: 0.55, hs: C('#ffe1ee'), hg: C('#ffd6ea'), hI: 0.85, fn: 45, ff: 130 },
  day: { bg: C('#cfeaff'), fog: C('#e8f6ff'), sun: C('#ffffff'), sunI: 1.6, amb: C('#ffffff'), ambI: 0.7, hs: C('#ffffff'), hg: C('#ffd6ea'), hI: 1.1, fn: 50, ff: 140 },
  dusk: { bg: C('#ffb494'), fog: C('#ffcdb9'), sun: C('#ff9f6b'), sunI: 1.1, amb: C('#ffd5c4'), ambI: 0.55, hs: C('#ffc7b0'), hg: C('#d9a7e8'), hI: 0.75, fn: 45, ff: 130 },
  dusk2: { bg: C('#8f6fb8'), fog: C('#a98bc4'), sun: C('#c99aff'), sunI: 0.8, amb: C('#cdb0ff'), ambI: 0.5, hs: C('#b79be8'), hg: C('#8a63b0'), hI: 0.65, fn: 42, ff: 128 },
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
const FOG_WHITE = C('#ebe7f5')
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
    const pal = [C('#ffffff'), C('#fff3b8'), C('#ffd0ea'), C('#cfe6ff')]
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

// ---------------------------------------------------------------- sokak lambaları (sahte parıltı + birkaç gerçek ışık)
const LAMP_MODEL = '/models/park/park-lamp.glb'
const LAMPS = PROPS.filter((p) => p.model === LAMP_MODEL).map((p) => ({ x: p.x, z: p.z }))
const LAMP_TOP = 2.75
const REAL_LIGHTS = 3

function Lamps({ focusRef }) {
  const glow = useRef()
  const pool = useRef()
  const lights = useRef([])
  const t = useRef(0)
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
      dummy.scale.set(7, 7, 1)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  }, [dummy])

  useFrame((_, dt) => {
    const lit = skyLive.lit
    const on = lit > 0.02
    if (glow.current) glow.current.visible = on
    if (pool.current) pool.current.visible = on
    if (on && glow.current) {
      const m = glow.current
      for (let i = 0; i < LAMPS.length; i++) {
        dummy.position.set(LAMPS[i].x, LAMP_TOP, LAMPS[i].z)
        dummy.quaternion.copy(camera.quaternion)
        dummy.scale.set(2.6, 2.6, 1)
        dummy.updateMatrix()
        m.setMatrixAt(i, dummy.matrix)
      }
      m.instanceMatrix.needsUpdate = true
      m.material.opacity = lit * 0.95
      pool.current.material.opacity = lit * 0.38
    }
    // en yakın lambalara gerçek ışık ata (yarım saniyede bir)
    t.current += dt
    if (t.current > 0.4) {
      t.current = 0
      const f = focusRef.current
      const near = LAMPS.map((l) => ({ l, d: Math.hypot(l.x - f.x, l.z - f.z) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, REAL_LIGHTS)
      near.forEach((n, i) => lights.current[i]?.position.set(n.l.x, LAMP_TOP - 0.2, n.l.z))
    }
    lights.current.forEach((l) => l && (l.intensity = lit * 7))
  })

  return (
    <>
      <instancedMesh ref={glow} args={[null, null, LAMPS.length]} frustumCulled={false} renderOrder={4}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={tex} color="#ffd98a" transparent depthWrite={false} blending={AdditiveBlending} fog={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={pool} args={[null, null, LAMPS.length]} frustumCulled={false} renderOrder={3}>
        <circleGeometry args={[0.5, 24]} />
        <meshBasicMaterial color="#ffd98a" transparent depthWrite={false} blending={AdditiveBlending} fog={false} toneMapped={false} />
      </instancedMesh>
      {Array.from({ length: REAL_LIGHTS }, (_, i) => (
        <pointLight key={i} ref={(l) => (lights.current[i] = l)} color="#ffd391" intensity={0} distance={11} decay={2} position={[0, LAMP_TOP, 0]} />
      ))}
    </>
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
export default function Sky({ home: homeProp, interior = null, focusRef }) {
  const home = Boolean(homeProp || interior)
  const scene = useThree((s) => s.scene)
  const amb = useRef()
  const hemi = useRef()
  const st = useRef({ dh: null, rain: 0, snow: 0, fog: 0, leaves: 0 })

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
    for (const k of ['rain', 'snow', 'fog', 'leaves']) {
      const goal = w === k ? 1 : 0
      const d = goal - s[k]
      s[k] += Math.sign(d) * Math.min(Math.abs(d), dt / EASE_WX)
    }
    const over = Math.min(1, s.rain + s.snow * 0.5 + s.fog * 0.6 + s.leaves * 0.2)
    const night = nightAt(h)
    const sunset = sunsetAt(h)
    const k = frameAt(h)

    // pencere gökyüzü (hava durumu karışmadan önce hafif gri)
    skyLive.window.copy(k.bg).lerp(tmp.copy(GRAY).multiplyScalar(1 - 0.6 * night), over * 0.45)

    // hava etkisi
    const grey = tmp.copy(GRAY).multiplyScalar(1 - 0.6 * night)
    k.bg.lerp(grey, over * 0.55)
    k.fog.lerp(grey, over * 0.5)
    k.fog.lerp(tmp.copy(FOG_WHITE).multiplyScalar(1 - 0.65 * night), s.fog * 0.8)
    let fn = k.fn
    let ff = k.ff
    ff += (90 - ff) * s.rain * 0.5
    fn += (4 - fn) * s.fog * 0.9
    ff += (48 - ff) * s.fog * 0.85
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
    SKY_MATS.window.emissiveIntensity = 0.3 + lit * 1.5
    SKY_MATS.window.emissive.set('#ffe49a').lerp(tmp.set('#ffc65c'), lit)
    SKY_MATS.neonPink.emissiveIntensity = 1.2 + lit * 2.1
    SKY_MATS.neonBlue.emissiveIntensity = 1.2 + lit * 2.1
    SKY_MATS.water.emissiveIntensity = 0.25 + night * 0.9
    SKY_MATS.fountainTop.emissiveIntensity = 0.3 + night * 1.1

    // ev içi: gün-geceden bağımsız sabit değerler
    const dimK = interior ? 1 - (interior.dim ?? 0) * 0.75 : 1
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
      hemi.current.groundColor.copy(home ? tmp.set('#ffd6ea') : k.hg)
      hemi.current.intensity = home ? 1.1 * dimK : k.hI * (1 - 0.1 * over)
    }
  })

  return (
    <>
      <ambientLight ref={amb} intensity={0.7} />
      <hemisphereLight ref={hemi} args={['#ffffff', '#ffd6ea', 1.1]} />
      {!home && (
        <>
          <Heavens />
          <Lamps focusRef={focusRef} />
          <WetSheen focusRef={focusRef} />
        </>
      )}
    </>
  )
}
