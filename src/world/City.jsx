import { useEffect, useMemo, useRef, useState } from 'react'
import { screenK } from './screenK'
import { useFrame, useLoader } from '@react-three/fiber'
import { CanvasTexture, Color, DataTexture, MeshStandardMaterial, Object3D, ExtrudeGeometry, Shape, LinearFilter, RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three'
import { Html, RoundedBox } from '@react-three/drei'
import { BEACH, BLANKETS, BUILDINGS, GAZEBO, ISLAND, PIER, PLAY_BOUNDS, PLAZA_R, PROPS, RIM, RING, ROAD_END, ROAD_HALF, ROAD_START, TOWELS } from './layout'
import { CULL_R, playerPos, useCull } from './cull'
import Facade from './Facade'
import { facadeOf } from './facadeData'
import Prop, { InstancedPropGroup } from './Prop'
import Plants from './Plants'
import { Em } from '../components/emoji'
import { SKY_MATS, skyLive } from './Sky'
import { worldClock } from './worldClock'
import { getPuffyPaverPair, getPuffySandPair, getPuffyShinglePair, getWallPair } from './pastelTex'

const FACING = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }

// katman yükseklikleri (z-fighting olmasın)
const Y = { floor: 0.02, sidewalk: 0.04, road: 0.06, plaza: 0.08, mark: 0.1 }

// Doku önbelleği: aynı (doku, tekrar, kaydırma) için tek Texture nesnesi (her bina/parça için ayrı klon GPU'ya ayrı yüklenir; 70 bina × 4 yüz = yüzlerce yükleme).
const texCache = new Map()
function sharedTexture(base, key, setup) {
  const k = `${base.uuid}|${key}`
  let t = texCache.get(k)
  if (!t) {
    t = base.clone()
    t.wrapS = t.wrapT = RepeatWrapping
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 4
    setup(t)
    t.needsUpdate = true
    texCache.set(k, t)
  }
  return t
}
const matCache = new Map()
function stdMat(color, roughness = 0.6) {
  const k = `${color}|${roughness}`
  let m = matCache.get(k)
  if (!m) {
    m = new MeshStandardMaterial({ color, roughness })
    matCache.set(k, m)
  }
  return m
}
const q = (v, s = 0.25) => Math.max(s, Math.round(v / s) * s) // tekrar sayısını yuvarla (önbellek isabeti)

// Yer dokuları (Meshy ile üretilen üstten bakış desenler, scripts/make-tileable.py ile döşenebilir yapıldı): public/textures/<ad>.webp
export const GROUND_TEX = { grass: 4.5, asphalt: 4.8, cobble: 3.2, sand: 4 } // doku adı → bir kiremitin kapladığı metre
export const GROUND_URLS = Object.keys(GROUND_TEX).map((n) => `/textures/${n}.webp`)

// Zenginleştirilmiş asfalt dokusu + kabartma haritası (düz leylak şerit yerine tanecikli, güneşle tepki veren pastel asfalt)
let asphaltPair = null
function getAsphaltPair() {
  if (asphaltPair) return asphaltPair
  const N = 512
  const cv = document.createElement('canvas')
  cv.width = cv.height = N
  const g = cv.getContext('2d')
  const bcv = document.createElement('canvas')
  bcv.width = bcv.height = N
  const bg = bcv.getContext('2d')

  // temel ton: sıcak pastel arduvaz-leylak (binalar ve kaldırımlarla uyumlu, belirgin kontrast)
  g.fillStyle = '#8b8399'
  g.fillRect(0, 0, N, N)
  bg.fillStyle = '#808080'
  bg.fillRect(0, 0, N, N)

  let seed = 4219
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  const wrapDot = (ctx, x, y, r, fill) => {
    ctx.fillStyle = fill
    for (const ox of [-N, 0, N]) {
      if (x + ox + r < 0 || x + ox - r > N) continue
      for (const oy of [-N, 0, N]) {
        if (y + oy + r < 0 || y + oy - r > N) continue
        ctx.beginPath()
        ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  // yumuşak organik asfalt ton geçişleri
  for (let i = 0; i < 42; i++) {
    const x = rand() * N
    const y = rand() * N
    const r = 28 + rand() * 58
    const dark = rand() > 0.45
    wrapDot(g, x, y, r, dark ? 'rgba(92,84,110,0.12)' : 'rgba(182,175,198,0.10)')
  }

  // ince agrega / çakıl tanecikleri (hem renk hem kabartma haritası)
  for (let i = 0; i < 4800; i++) {
    const x = rand() * N
    const y = rand() * N
    const sz = 1 + rand() * 2.2
    const v = rand()
    if (v < 0.48) {
      g.fillStyle = 'rgba(72,66,86,0.34)'
      bg.fillStyle = 'rgba(60,60,60,0.45)'
    } else if (v < 0.86) {
      g.fillStyle = 'rgba(218,212,230,0.30)'
      bg.fillStyle = 'rgba(205,205,205,0.42)'
    } else {
      g.fillStyle = 'rgba(246,238,228,0.38)'
      bg.fillStyle = 'rgba(240,240,240,0.5)'
    }
    g.fillRect(x, y, sz, sz)
    bg.fillRect(x, y, sz, sz)
  }

  // çok ince kılcal yüzey dokusu çizgileri
  g.strokeStyle = 'rgba(72,66,88,0.14)'
  g.lineWidth = 1.2
  for (let i = 0; i < 6; i++) {
    let x = rand() * N
    let y = rand() * N
    g.beginPath()
    g.moveTo(x, y)
    for (let s = 0; s < 5; s++) {
      x += (rand() - 0.5) * 44
      y += (rand() - 0.5) * 44
      g.lineTo(x, y)
    }
    g.stroke()
  }

  const map = new CanvasTexture(cv)
  map.wrapS = map.wrapT = RepeatWrapping
  map.colorSpace = SRGBColorSpace
  map.anisotropy = 4
  const bump = new CanvasTexture(bcv)
  bump.wrapS = bump.wrapT = RepeatWrapping
  bump.anisotropy = 4
  asphaltPair = { map, bump }
  return asphaltPair
}

let manholeTex = null
function getManholeTex() {
  if (manholeTex) return manholeTex
  const cv = document.createElement('canvas')
  cv.width = cv.height = 128
  const g = cv.getContext('2d')
  g.fillStyle = '#6c657c'
  g.fillRect(0, 0, 128, 128)
  g.strokeStyle = '#534c63'
  g.lineWidth = 5
  g.beginPath()
  g.arc(64, 64, 56, 0, Math.PI * 2)
  g.stroke()
  g.lineWidth = 2.5
  g.strokeStyle = '#8d869e'
  g.beginPath()
  g.arc(64, 64, 42, 0, Math.PI * 2)
  g.stroke()
  g.beginPath()
  g.arc(64, 64, 20, 0, Math.PI * 2)
  g.stroke()
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    g.beginPath()
    g.moveTo(64 + Math.cos(a) * 20, 64 + Math.sin(a) * 20)
    g.lineTo(64 + Math.cos(a) * 52, 64 + Math.sin(a) * 52)
    g.stroke()
  }
  const t = new CanvasTexture(cv)
  t.colorSpace = SRGBColorSpace
  manholeTex = t
  return t
}

// Yumuşak kenar: alt zeminle karışsın diye alfa haritası (kenara `feather` m kala saydamlaşır). Keskin geçişler "2006 oyunu" gibi duruyordu.
const featherCache = new Map()
function featherTexture(w, d, f, round) {
  const key = `${round ? `r${round}` : `${w}x${d}`}|${f}`
  let t = featherCache.get(key)
  if (t) return t
  const N = 96
  const data = new Uint8Array(N * N * 4)
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N
      const v = (j + 0.5) / N
      let edge
      if (round) edge = (1 - Math.hypot(u - 0.5, v - 0.5) * 2) * round // dairesel: merkezden uzaklık
      else edge = Math.min(u * w, (1 - u) * w, v * d, (1 - v) * d)
      const x = Math.max(0, Math.min(1, edge / f))
      const a = Math.round(255 * x * x * (3 - 2 * x))
      const k = (j * N + i) * 4
      data[k] = data[k + 1] = data[k + 2] = a
      data[k + 3] = 255
    }
  }
  t = new DataTexture(data, N, N)
  t.minFilter = t.magFilter = LinearFilter
  t.needsUpdate = true
  featherCache.set(key, t)
  return t
}

/** tex: GROUND_TEX adı. Doku dünya ölçüsünde döşenir (kiremit boyu metre), renk tonu `color` ile çarpılır (pastel ton). feather: kenar yumuşatma (m). */
function Flat({ x = 0, z = 0, w, d, y, color = '#ffffff', round, tex, feather = 0 }) {
  const loaded = useLoader(TextureLoader, `/textures/${tex ?? 'grass'}.webp`)
  const isAsphalt = tex === 'asphalt'
  const isSand = tex === 'sand'
  const isCobble = tex === 'cobble'
  const pair = isAsphalt ? getAsphaltPair() : isSand ? getPuffySandPair() : isCobble ? getPuffyPaverPair() : null
  const base = pair ? pair.map : loaded
  const { map, bumpMap } = useMemo(() => {
    if (!tex) return { map: null, bumpMap: null }
    const m = GROUND_TEX[tex]
    const rx = Math.round(((round ? round * 2 : w) / m) * 20) / 20
    const ry = Math.round(((round ? round * 2 : d) / m) * 20) / 20
    const ox = Math.round((((x / m) % 1) + 1) * 20) / 20 % 1
    const oy = Math.round((((-z / m) % 1) + 1) * 20) / 20 % 1
    const key = `f${rx}|${ry}|${ox}|${oy}`
    const setup = (t) => {
      t.repeat.set(rx, ry)
      t.offset.set(ox, oy) // komşu parçalarda desen aynı hizadan devam etsin
    }
    return {
      map: sharedTexture(base, key, setup),
      bumpMap: pair ? sharedTexture(pair.bump, `b${key}`, setup) : null,
    }
  }, [base, pair, tex, w, d, round, x, z])
  const alpha = useMemo(() => (feather > 0 ? featherTexture(round ? round * 2 : w, round ? round * 2 : d, feather, round ? round * 2 : 0) : null), [feather, w, d, round])
  return (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow renderOrder={alpha ? 1 : 0}>
      {round ? <circleGeometry args={[round, 64]} /> : <planeGeometry args={[w, d]} />}
      <meshStandardMaterial color={color} map={map} bumpMap={bumpMap} bumpScale={isAsphalt ? 0.032 : isSand ? 0.025 : isCobble ? 0.02 : 0} alphaMap={alpha} transparent={Boolean(alpha)} depthWrite={!alpha} roughness={isAsphalt ? 0.84 : isSand ? 0.78 : isCobble ? 0.85 : 0.92} />
    </mesh>
  )
}

/** Dokulu halka (dönel kavşak asfaltı / kaldırımı): ringGeometry UV'si tüm halkaya tek kez sarılır → tekrar sayısı çapa göre. */
function TexRing({ r0, r1, y, tex, color = '#ffffff' }) {
  const loaded = useLoader(TextureLoader, `/textures/${tex}.webp`)
  const isAsphalt = tex === 'asphalt'
  const isCobble = tex === 'cobble'
  const pair = isAsphalt ? getAsphaltPair() : isCobble ? getPuffyPaverPair() : null
  const base = pair ? pair.map : loaded
  const { map, bumpMap } = useMemo(() => {
    const m = GROUND_TEX[tex]
    const rep = Math.round(((r1 * 2) / m) * 10) / 10
    const setup = (t) => t.repeat.set(rep, rep)
    return {
      map: sharedTexture(base, `ring${rep}`, setup),
      bumpMap: pair ? sharedTexture(pair.bump, `bring${rep}`, setup) : null,
    }
  }, [base, pair, tex, r1])
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <ringGeometry args={[r0, r1, 96]} />
      <meshStandardMaterial color={color} map={map} bumpMap={bumpMap} bumpScale={isAsphalt ? 0.032 : isCobble ? 0.02 : 0} roughness={isAsphalt ? 0.84 : isCobble ? 0.85 : 0.95} />
    </mesh>
  )
}

function Ring({ r0, r1, y, color }) {
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[r0, r1, 64]} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  )
}

const LABEL_RANGE = 34 // m: bundan uzaktaki bina pinleri gizlenir
const LABEL_NAME_RANGE = 15 // m: bundan yakında pinin adı da açılır

// "🍰 Tatlı Dükkanı" → { icon: '🍰', name: 'Tatlı Dükkanı' }
function splitLabel(text) {
  const m = /^(\p{Extended_Pictographic}\uFE0F?)\s*(.*)$/u.exec(text)
  return m ? { icon: m[1], name: m[2] } : { icon: '📍', name: text }
}

// Modern harita pini: renkli halkalı yuvarlak rozet + 3D ikon + sivri uç; yakında ad etiketi açılır.
function Label({ text, y, x, z, zOff = 0, focusRef, accent = '#fdbb63' }) {
  const [mode, setMode] = useState(2) // 0 gizli, 1 yalnız rozet, 2 rozet + ad
  const modeRef = useRef(2)
  const clock = useRef(0)
  useFrame(({ camera }, dt) => {
    clock.current += dt
    if (clock.current < 0.4) return
    clock.current = 0
    const f = focusRef.current
    const dist = Math.hypot(f.x - x, f.z - z)
    // kameraya çok yakın pin (distanceFactor yüzünden) dev boyuna çıkmasın
    const camDist = Math.hypot(camera.position.x - x, camera.position.y - y, camera.position.z - z)
    const next = dist > LABEL_RANGE || camDist < 15 ? 0 : dist > LABEL_NAME_RANGE ? 1 : 2
    if (next !== modeRef.current) {
      modeRef.current = next
      setMode(next)
    }
  })
  if (mode === 0) return null
  const { icon, name } = splitLabel(text)
  return (
    <Html position={[0, y, zOff]} center distanceFactor={18 * screenK()} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <div className="venue-pin flex flex-col items-center" style={{ '--pin': accent }}>
        {mode === 2 && (
          <div className="mb-1 whitespace-nowrap rounded-full bg-[#3d2f4f]/85 px-3 py-[3px] text-[13px] font-extrabold tracking-wide text-white shadow-lg backdrop-blur-sm">
            {name}
          </div>
        )}
        <div
          className="grid h-[46px] w-[46px] place-items-center rounded-full bg-white shadow-[0_6px_14px_rgba(60,40,80,0.35)]"
          style={{ border: '4px solid var(--pin)' }}
        >
          <Em e={icon} size={28} />
        </div>
        <div
          className="-mt-[5px] h-3 w-3 rotate-45 rounded-[2px]"
          style={{ background: 'var(--pin)', boxShadow: '0 4px 6px rgba(60,40,80,0.25)' }}
        />
      </div>
    </Html>
  )
}

// ---------- bina çeşitliliği ----------
// Her bina, sırasına göre bir stil alır (komşu binalar farklı olur): cephe dokusu (Meshy), çatı biçimi, pencere türü ve süsler.
const WALL_TEX = { brick: 2.4, siding: 2.0, stucco: 3.2, plaster: 4, shingle: 2.0 } // doku adı → bir kiremitin metre boyu
const STYLES = [
  { wall: 'brick', roofType: 'gable', win: 'arch', shutters: true, chimney: true, door: '#bf8942' },
  { wall: 'siding', roofType: 'flat', win: 'round', flowerbox: true, door: '#cc7914' },
  { wall: 'stucco', roofType: 'hip', win: 'wide', door: '#e8873a' },
  { wall: 'plaster', roofType: 'flat', win: 'rect', balcony: true, door: '#8a6bd1' },
  { wall: 'brick', roofType: 'hip', win: 'rect', shutters: true, chimney: true, door: '#5b86d6' },
  { wall: 'siding', roofType: 'gable', win: 'wide', flowerbox: true, door: '#d58f2b' },
]
const lighten = (hex, t) => `#${new Color(hex).lerp(new Color('#ffffff'), t).getHexString()}`

/** Balonsu pasterize cephe/duvar paneli: renk + yumuşak kabartma haritasıyla pofuduk kil görünümü. */
function Panel({ tex, w, h, color, position, rotation, repeat }) {
  const pair = useMemo(() => getWallPair(tex), [tex])
  const { map, bumpMap } = useMemo(() => {
    const m = WALL_TEX[tex] ?? 2.4
    const rx = q(repeat?.[0] ?? w / m)
    const ry = q(repeat?.[1] ?? h / m)
    const setup = (t) => t.repeat.set(rx, ry)
    return {
      map: sharedTexture(pair.map, `${tex}|${rx}|${ry}`, setup),
      bumpMap: sharedTexture(pair.bump, `b${tex}|${rx}|${ry}`, setup),
    }
  }, [pair, tex, w, h, repeat])
  return (
    <mesh position={position} rotation={rotation} receiveShadow>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial color={color} map={map} bumpMap={bumpMap} bumpScale={0.042} roughness={0.56} />
    </mesh>
  )
}

/** Beşik çatı: üçgen kesit (taban duvar üstünde), sırtı bina genişliği boyunca. */
function GableRoof({ w, d, h, mat }) {
  const geo = useMemo(() => {
    const dd = d + 0.9
    const sh = new Shape()
    sh.moveTo(-dd / 2, 0)
    sh.lineTo(dd / 2, 0)
    sh.lineTo(0, Math.min(2.6, dd * 0.36))
    sh.closePath()
    const g = new ExtrudeGeometry(sh, { depth: w + 0.9, bevelEnabled: false })
    g.translate(0, 0, -(w + 0.9) / 2)
    return g
  }, [w, d])
  return (
    <mesh geometry={geo} position={[0, h - 0.05, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
      {mat}
    </mesh>
  )
}

function Roof({ w, d, h, color, type }) {
  const tint = lighten(color, 0.35)
  const shingle = useMemo(() => getPuffyShinglePair(), [])
  const { map, bumpMap } = useMemo(() => {
    const setup = (t) => t.repeat.set(3, 2)
    return {
      map: sharedTexture(shingle.map, 'roof_puffy', setup),
      bumpMap: sharedTexture(shingle.bump, 'broof_puffy', setup),
    }
  }, [shingle])
  const mat = <meshStandardMaterial color={color} map={map} bumpMap={bumpMap} bumpScale={0.055} roughness={0.48} />
  if (type === 'gable') {
    return <GableRoof w={w} d={d} h={h} mat={mat} />
  }
  if (type === 'hip') {
    // koni tabanı duvar üstünde (h - 0,05): çatı havada durmaz
    return (
      <mesh position={[0, h - 0.05 + 1.1, 0]} rotation={[0, Math.PI / 4, 0]} scale={[(w + 0.9) / 1.414, 1, (d + 0.9) / 1.414]} castShadow>
        <coneGeometry args={[1, 2.2, 4]} />
        {mat}
      </mesh>
    )
  }
  return (
    <RoundedBox args={[w + 0.7, 0.7, d + 0.7]} radius={0.3} smoothness={3} position={[0, h + 0.15, 0]} castShadow>
      <meshStandardMaterial color={tint} roughness={0.5} />
    </RoundedBox>
  )
}

function Window({ kind, x, y, z, w, accent, shutters, flowerbox }) {
  const glass = <primitive object={SKY_MATS.window} attach="material" />
  const trim = <primitive object={stdMat('#fffaf2', 0.5)} attach="material" />
  const accentMat = <primitive object={stdMat(accent, 0.6)} attach="material" />
  return (
    <group position={[x, y, z]}>
      {kind === 'round' ? (
        <>
          <mesh>
            <circleGeometry args={[0.62, 20]} />
            {glass}
          </mesh>
          <mesh position={[0, 0, -0.01]}>
            <circleGeometry args={[0.78, 20]} />
            {trim}
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, 0, 0.0]}>
            <boxGeometry args={[w, 1.1, 0.12]} />
            {glass}
          </mesh>
          {kind === 'arch' && (
            <mesh position={[0, 0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[w / 2, w / 2, 0.12, 16]} />
              {glass}
            </mesh>
          )}
          {kind === 'wide' && (
            <>
              <mesh position={[0, 0, 0.07]}>
                <boxGeometry args={[0.07, 1.1, 0.04]} />
                {trim}
              </mesh>
              <mesh position={[0, 0, 0.07]}>
                <boxGeometry args={[w, 0.07, 0.04]} />
                {trim}
              </mesh>
            </>
          )}
        </>
      )}
      {shutters && kind !== 'round' &&
        [-1, 1].map((sd) => (
          <mesh key={sd} position={[sd * (w / 2 + 0.28), 0.1, 0.02]}>
            <boxGeometry args={[0.4, 1.3, 0.08]} />
            {accentMat}
          </mesh>
        ))}
      {flowerbox && (
        <group position={[0, -0.78, 0.2]}>
          <mesh>
            <boxGeometry args={[w + 0.3, 0.25, 0.34]} />
            {accentMat}
          </mesh>
          {[-0.4, 0, 0.4].map((fx) => (
            <mesh key={fx} position={[fx * (w / 1.6), 0.24, 0]}>
              <sphereGeometry args={[0.17, 8, 6]} />
              <primitive object={stdMat(fx === 0 ? '#ffd35e' : '#fdb252', 0.6)} attach="material" />
            </mesh>
          ))}
        </group>
      )}
    </group>
  )
}

function Building({ b, i, focusRef }) {
  const { w, d, h, color, roof, facing, label, shop, neon } = b
  const grp = useRef()
  useCull(grp, b.x, b.z, CULL_R, 30)
  const st = neon ? { ...STYLES[3], balcony: false } : STYLES[(i * 5 + (i >> 2)) % STYLES.length]
  const roofType = h > 8 || neon ? 'flat' : st.roofType
  const count = Math.max(1, Math.floor(w / 3))
  const winY = Math.min(3.4, h - 0.9)
  const rows = h > 8 ? [winY, winY + 2.6, winY + 5.2].filter((y) => y < h - 0.8) : [winY]
  const wallColor = lighten(color, st.wall === 'brick' ? 0.62 : 0.45)
  const fac = facadeOf(b)
  const doorShift = ((i * 7) % 3 - 1) * 0.12 * w // sıradan binalarda kapı biraz kayık (hepsi aynı görünmesin)
  const ww = Math.min(1.5, w / count - 0.8)
  return (
    <group ref={grp} position={[b.x, 0, b.z]} rotation={[0, FACING[facing], 0]}>
      <Flat x={0} z={d / 2 + 1.6} w={w + 1.4} d={3.4} y={0.038} tex="cobble" color="#f6efe6" />
      <RoundedBox args={[w, h, d]} radius={0.35} smoothness={2} position={[0, h / 2, 0]} castShadow receiveShadow>
        <primitive object={stdMat(color, 0.55)} attach="material" />
      </RoundedBox>
      {/* Meshy cephe dokusu: dört yüzeyde ince paneller (köşeler yuvarlak ve düz renkli kalır) */}
      <Panel tex={st.wall} w={w - 0.5} h={h - 0.4} color={wallColor} position={[0, h / 2, d / 2 + 0.012]} />
      <Panel tex={st.wall} w={w - 0.5} h={h - 0.4} color={wallColor} position={[0, h / 2, -d / 2 - 0.012]} rotation={[0, Math.PI, 0]} />
      <Panel tex={st.wall} w={d - 0.5} h={h - 0.4} color={wallColor} position={[w / 2 + 0.012, h / 2, 0]} rotation={[0, Math.PI / 2, 0]} />
      <Panel tex={st.wall} w={d - 0.5} h={h - 0.4} color={wallColor} position={[-w / 2 - 0.012, h / 2, 0]} rotation={[0, -Math.PI / 2, 0]} />
      <Roof w={w} d={d} h={h} color={roof} type={roofType} />
      {st.chimney && roofType !== 'flat' && (
        <RoundedBox args={[0.8, 1.8, 0.8]} radius={0.1} smoothness={2} position={[w * 0.28, h + 2.2, -d * 0.15]} castShadow>
          <meshStandardMaterial color={lighten(roof, 0.1)} roughness={0.6} />
        </RoundedBox>
      )}

      {fac ? (
        <>
          <Facade F={fac} w={w} h={h} roof={roof} z={d / 2} label={label} venueId={b.venue ?? (b.homeDoor ? 'evim' : null)} />
          {!fac.noUpper && h >= 5.5 &&
            Array.from({ length: Math.max(1, Math.floor(w / 3.2)) }, (_, ci) => (
              <Window key={ci} kind={st.win === 'round' ? 'rect' : st.win} x={(ci - (Math.max(1, Math.floor(w / 3.2)) - 1) / 2) * (w / Math.max(1, Math.floor(w / 3.2)))} y={Math.min(h - 1.2, 4.9)} z={d / 2 + 0.06} w={ww} accent={roof} />
            ))}
        </>
      ) : (
        <>
          {/* kapı: yumuşak yuvarlatılmış balonsu kapı */}
          <RoundedBox args={[1.48, 2.38, 0.18]} radius={0.09} smoothness={2} position={[doorShift, 1.19, d / 2 + 0.04]}>
            <primitive object={stdMat('#fffaf2', 0.45)} attach="material" />
          </RoundedBox>
          <RoundedBox args={[1.22, 2.16, 0.08]} radius={0.05} smoothness={2} position={[doorShift, 1.12, d / 2 + 0.13]}>
            <primitive object={stdMat(st.door, 0.38)} attach="material" />
          </RoundedBox>
          <mesh position={[doorShift + 0.4, 1.1, d / 2 + 0.18]}>
            <sphereGeometry args={[0.075, 10, 8]} />
            <primitive object={stdMat('#ffd35e', 0.25)} attach="material" />
          </mesh>
          {/* pencereler */}
          {rows.map((y, ri) =>
            Array.from({ length: count }, (_, ci) => (
              <Window key={`${y}-${ci}`} kind={st.win} x={(ci - (count - 1) / 2) * (w / count)} y={y} z={d / 2 + 0.06} w={st.win === 'wide' ? Math.min(2.0, w / count - 0.6) : ww} accent={roof} shutters={st.shutters && ri === 0} flowerbox={st.flowerbox && ri === 0} />
            )),
          )}
        </>
      )}

      {/* balkon (yalnızca bazı stillerde, ikinci katın altında) */}
      {st.balcony && !shop && h > 5 && (
        <group position={[w * 0.25, 3.0, d / 2 + 0.55]}>
          <mesh castShadow>
            <boxGeometry args={[1.9, 0.14, 1.0]} />
            <meshStandardMaterial color="#fffaf2" roughness={0.5} />
          </mesh>
          {[-0.9, -0.3, 0.3, 0.9].map((bx) => (
            <mesh key={bx} position={[bx, 0.38, 0.45]}>
              <boxGeometry args={[0.07, 0.62, 0.07]} />
              <meshStandardMaterial color={roof} />
            </mesh>
          ))}
          <mesh position={[0, 0.7, 0.45]}>
            <boxGeometry args={[1.9, 0.07, 0.07]} />
            <meshStandardMaterial color={roof} />
          </mesh>
        </group>
      )}

      {/* dükkan tentesi */}
      {shop && !fac && (
        <mesh position={[0, 2.95, d / 2 + 0.75]} rotation={[0.3, 0, 0]} castShadow>
          <boxGeometry args={[Math.min(w - 0.6, 4.4), 0.18, 1.6]} />
          <meshStandardMaterial color={roof} roughness={0.6} />
        </mesh>
      )}
      {neon && (
        <>
          <mesh position={[0, h - 0.6, d / 2 + 0.12]}>
            <boxGeometry args={[w * 0.85, 0.28, 0.1]} />
            <primitive object={SKY_MATS.neonPink} attach="material" />
          </mesh>
          <mesh position={[0, 0.5, d / 2 + 0.12]}>
            <boxGeometry args={[w * 0.85, 0.2, 0.1]} />
            <primitive object={SKY_MATS.neonBlue} attach="material" />
          </mesh>
        </>
      )}
      {label && <Label text={label} y={Math.min(h, 3.6) + 1.2} zOff={d / 2 + 0.6} x={b.x} z={b.z} focusRef={focusRef} accent={roof} />}
    </group>
  )
}

/** Balonsu pasterize park çardağı: yuvarlak yastıksı taban, şişkin sütun başlıkları, pofuduk kiremit kubbe ve saçak halkası. */
function Gazebo() {
  const posts = Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2)
  const shingle = useMemo(() => getPuffyShinglePair(), [])
  const { map, bumpMap } = useMemo(() => {
    const setup = (t) => t.repeat.set(5, 2.5)
    return {
      map: sharedTexture(shingle.map, 'gazebo_roof', setup),
      bumpMap: sharedTexture(shingle.bump, 'bgazebo_roof', setup),
    }
  }, [shingle])
  return (
    <group position={[GAZEBO.x, 0, GAZEBO.z]}>
      <mesh position={[0, 0.14, 0]} receiveShadow>
        <cylinderGeometry args={[3.35, 3.55, 0.28, 32]} />
        <primitive object={stdMat('#fff2e3', 0.55)} attach="material" />
      </mesh>
      <mesh position={[0, 0.29, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.28, 0.09, 10, 32]} />
        <primitive object={stdMat('#f4d8bc', 0.5)} attach="material" />
      </mesh>
      {posts.map((a, i) => {
        const px = Math.cos(a) * 2.7
        const pz = Math.sin(a) * 2.7
        return (
          <group key={i} position={[px, 0, pz]}>
            <mesh position={[0, 0.34, 0]}>
              <cylinderGeometry args={[0.25, 0.29, 0.22, 14]} />
              <primitive object={stdMat('#f7e8dc', 0.45)} attach="material" />
            </mesh>
            <mesh position={[0, 1.85, 0]} castShadow>
              <cylinderGeometry args={[0.17, 0.2, 3.0, 14]} />
              <primitive object={stdMat('#fffaf4', 0.42)} attach="material" />
            </mesh>
            <mesh position={[0, 3.35, 0]}>
              <sphereGeometry args={[0.24, 12, 10]} />
              <primitive object={stdMat('#ffe3c6', 0.42)} attach="material" />
            </mesh>
          </group>
        )
      })}
      {/* pofuduk kubbemsi kiremit çatı + yumuşak saçak halkası + tepe topuzu */}
      <mesh position={[0, 3.45, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[3.55, 0.2, 12, 36]} />
        <primitive object={stdMat('#d8c4ff', 0.45)} attach="material" />
      </mesh>
      <mesh position={[0, 4.35, 0]} castShadow>
        <coneGeometry args={[3.72, 1.95, 24]} />
        <meshStandardMaterial color="#bfa4ff" map={map} bumpMap={bumpMap} bumpScale={0.06} roughness={0.46} />
      </mesh>
      <mesh position={[0, 5.4, 0]} castShadow>
        <sphereGeometry args={[0.28, 14, 12]} />
        <primitive object={stdMat('#ffd35e', 0.3)} attach="material" />
      </mesh>
    </group>
  )
}

const towelTexCache = new Map()
function getTowelTex(baseHex) {
  if (towelTexCache.has(baseHex)) return towelTexCache.get(baseHex)
  const cv = document.createElement('canvas')
  cv.width = 128
  cv.height = 256
  const ctx = cv.getContext('2d')
  ctx.fillStyle = baseHex
  ctx.fillRect(0, 0, 128, 256)
  // pastel beyaz/krem çizgiler ve kenar bordürü
  ctx.fillStyle = 'rgba(255, 250, 242, 0.55)'
  for (let y = 18; y < 240; y += 28) ctx.fillRect(0, y, 128, 10)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)'
  ctx.fillRect(0, 0, 128, 10)
  ctx.fillRect(0, 246, 128, 10)
  ctx.fillRect(0, 0, 6, 256)
  ctx.fillRect(122, 0, 6, 256)
  // hafif havlu dokusu
  ctx.fillStyle = 'rgba(74, 59, 92, 0.04)'
  for (let y = 0; y < 256; y += 4) for (let x = (y % 8 === 0 ? 0 : 2); x < 128; x += 4) ctx.fillRect(x, y, 2, 2)
  const tex = new CanvasTexture(cv)
  tex.colorSpace = SRGBColorSpace
  towelTexCache.set(baseHex, tex)
  return tex
}

/** Plaj havlusu: yumuşak yuvarlatılmış yastıksı pastel havlu. */
function Towel({ t }) {
  const map = useMemo(() => getTowelTex(t.c), [t.c])
  return (
    <RoundedBox args={[0.98, 0.055, 1.92]} radius={0.024} smoothness={2} position={[t.x, 0.06, t.z]} rotation={[0, t.ry, 0]} receiveShadow>
      <meshStandardMaterial map={map} roughness={0.78} />
    </RoundedBox>
  )
}

/** Gece kulübünden dışarıya doğru yükselen sol anahtarı / nota animasyonu (WebGL sprite — DOM yükü yok). */
function ClubMusicNotes() {
  const notes = useMemo(() => {
    const syms = ['🎼', '🎵', '🎶']
    const texs = syms.map((sym) => {
      const cv = document.createElement('canvas')
      cv.width = 64
      cv.height = 64
      const ctx = cv.getContext('2d')
      ctx.font = '48px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(sym, 32, 34)
      const tex = new CanvasTexture(cv)
      tex.colorSpace = SRGBColorSpace
      return tex
    })
    return [
      { tex: texs[0], dx: -1.4, dz: 0.4, phase: 0 },
      { tex: texs[1], dx: 0.2, dz: -0.3, phase: 0.33 },
      { tex: texs[2], dx: 1.5, dz: 0.2, phase: 0.66 },
    ]
  }, [])
  useEffect(() => () => notes.forEach((n) => n.tex.dispose()), [notes])
  const refs = useRef([])
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    notes.forEach((n, i) => {
      const sp = refs.current[i]
      if (!sp) return
      const p = (t * 0.28 + n.phase) % 1
      sp.position.set(26 + n.dx + Math.sin(t * 1.8 + i * 2) * 0.45, 7.6 + p * 4.2, -9.2 + n.dz)
      const s = Math.sin(p * Math.PI)
      sp.scale.setScalar(0.55 + s * 0.5)
      if (sp.material) sp.material.opacity = s
    })
  })
  return (
    <group>
      {notes.map((n, i) => (
        <sprite key={i} ref={(el) => (refs.current[i] = el)} position={[26 + n.dx, 7.6, -9.2 + n.dz]}>
          <spriteMaterial map={n.tex} transparent depthWrite={false} />
        </sprite>
      ))}
    </group>
  )
}

/** Gölge kamerası oyuncuyu takip eden güneş (0,5 m ızgaraya oturtulur: yürürken gölge titreşmez). */
function Sun({ focusRef }) {
  const light = useRef()
  useFrame(() => {
    const l = light.current
    if (!l) return
    const f = focusRef.current
    const sx = Math.round(f.x * 2) / 2
    const sz = Math.round(f.z * 2) / 2
    // güneş/ay yönü ve rengi gün-gece döngüsünden (Sky.jsx)
    l.position.set(sx + skyLive.dir.x * 28, skyLive.dir.y * 28, sz + skyLive.dir.z * 28)
    l.color.copy(skyLive.color)
    l.intensity = skyLive.intensity
    l.target.position.set(sx, 0, sz)
    l.target.updateMatrixWorld()
  })
  return (
    <directionalLight
      ref={light}
      castShadow
      intensity={1.6}
      shadow-mapSize={[1024, 1024]}
      shadow-camera-left={-20}
      shadow-camera-right={20}
      shadow-camera-top={20}
      shadow-camera-bottom={-20}
      shadow-camera-near={1}
      shadow-camera-far={55}
      shadow-bias={-0.0004}
    />
  )
}

// ---------- deniz: adanın dört yanı (Meshy dokulu, animasyonlu) ----------
const WATER_COLOR = new Color('#feda9d')
const WATER_NIGHT = new Color('#3f5a9c')

// ---------- dünya sınırı: şamandıra halatı (oyuncu bunun ötesine geçemez; tatlı bir "buraya kadar" çizgisi) ----------
const BUOY_OFF = 3.2 // oynanabilir sınırın ötesinde (m)
function Buoys() {
  const ref = useRef()
  const inited = useRef(false)
  const pts = useMemo(() => {
    const b = { x0: PLAY_BOUNDS.x0 - BUOY_OFF, x1: PLAY_BOUNDS.x1 + BUOY_OFF, z0: PLAY_BOUNDS.z0 - BUOY_OFF, z1: PLAY_BOUNDS.z1 + BUOY_OFF }
    const out = []
    const step = 7
    for (let x = b.x0; x <= b.x1; x += step) {
      out.push([x, b.z0])
      if (Math.abs(x - PIER.x) > PIER.hw + 1.8) out.push([x, b.z1]) // iskele üstünde şamandıra çıkmasın
    }
    for (let z = b.z0 + step; z < b.z1; z += step) out.push([b.x0, z], [b.x1, z])
    return { list: out, b }
  }, [])
  const colors = useMemo(() => pts.list.map((_, i) => (i % 2 ? '#ffffff' : '#ff9f43')), [pts])
  useEffect(() => {
    if (!ref.current) return
    colors.forEach((c, i) => ref.current.setColorAt(i, new Color(c)))
    ref.current.instanceColor.needsUpdate = true
  }, [colors])
  const dummy = useMemo(() => new Object3D(), [])
  useFrame(({ clock }) => {
    if (!ref.current) return
    if (inited.current && Math.abs(playerPos.x) < 52 && Math.abs(playerPos.z) < 42) return
    inited.current = true
    const t = clock.elapsedTime
    pts.list.forEach(([x, z], i) => {
      dummy.position.set(x, 0.18 + Math.sin(t * 1.3 + i * 0.9) * 0.08, z)
      dummy.rotation.set(Math.sin(t * 0.9 + i) * 0.1, 0, Math.cos(t * 1.1 + i) * 0.1)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  })
  const { b } = pts
  const W = b.x1 - b.x0
  const D = b.z1 - b.z0
  const rope = (cx, cz, w, d, k) => (
    <mesh key={k} position={[cx, 0.08, cz]}>
      <boxGeometry args={[w, 0.05, d]} />
      <primitive object={stdMat('#fff3e0', 0.9)} attach="material" />
    </mesh>
  )
  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, pts.list.length]} frustumCulled={false}>
        <sphereGeometry args={[0.42, 12, 8]} />
        <meshStandardMaterial roughness={0.5} />
      </instancedMesh>
      {rope((b.x0 + b.x1) / 2, b.z0, W, 0.06, 'n')}
      {rope((b.x0 + (PIER.x - PIER.hw - 0.4)) / 2, b.z1, (PIER.x - PIER.hw - 0.4) - b.x0, 0.06, 'sw')}
      {rope(((PIER.x + PIER.hw + 0.4) + b.x1) / 2, b.z1, b.x1 - (PIER.x + PIER.hw + 0.4), 0.06, 'se')}
      {rope(b.x0, (b.z0 + b.z1) / 2, 0.06, D, 'w')}
      {rope(b.x1, (b.z0 + b.z1) / 2, 0.06, D, 'e')}
    </group>
  )
}

function Sea() {
  const water = useLoader(TextureLoader, '/textures/water.webp')
  const foam = useLoader(TextureLoader, '/textures/foam.webp')
  const [deep, swell, ring] = useMemo(() => {
    const mk = (src, m, size) => {
      const t = src.clone()
      t.wrapS = t.wrapT = RepeatWrapping
      t.colorSpace = SRGBColorSpace
      t.anisotropy = 4
      t.repeat.set(size / m, size / m)
      t.needsUpdate = true
      return t
    }
    return [mk(water, 14, 2200), mk(foam, 9, 2200), mk(foam, 7, 120)]
  }, [water, foam])
  // köpük şeridi kenarları yumuşasın: ortası dolu, iki kenarı saydam bir alfa haritası
  const fade = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = 4
    cv.height = 64
    const g = cv.getContext('2d')
    const gr = g.createLinearGradient(0, 0, 0, 64)
    gr.addColorStop(0, '#000')
    gr.addColorStop(0.5, '#fff')
    gr.addColorStop(1, '#000')
    g.fillStyle = gr
    g.fillRect(0, 0, 4, 64)
    return new CanvasTexture(cv)
  }, [])
  const mat = useRef()
  const mat2 = useRef()
  const plane = useRef()
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    deep.offset.x += dt * 0.010
    deep.offset.y += dt * 0.006
    swell.offset.x -= dt * 0.012
    swell.offset.y += dt * 0.008
    ring.offset.x += dt * 0.02
    if (plane.current) plane.current.position.y = -0.05 + Math.sin(t * 0.7) * 0.025 // yavaş kabarma
    const night = Number.isFinite(worldClock.night) ? worldClock.night : 0
    if (mat.current) mat.current.color.copy(WATER_COLOR).lerp(WATER_NIGHT, night * 0.85)
    if (mat2.current) mat2.current.opacity = 0.16 + Math.sin(t * 0.9) * 0.05
  })
  // kıyıya vuran dalgalar: her kenarda 3 bant, aynı döngüde faz farklı; açıktan kıyıya yürür, kıyıda sönüp kaybolur
  const WAVES = 3
  const CYCLE = 6.5 // sn
  const TRAVEL = 6 // m
  const W = ISLAND.x1 - ISLAND.x0
  const D = ISLAND.z1 - ISLAND.z0
  const cx = (ISLAND.x0 + ISLAND.x1) / 2
  const cz = (ISLAND.z0 + ISLAND.z1) / 2
  // kenar: normal (açık denize), kıyı çizgisinin konumu, bant uzunluğu
  const sides = [
    { n: [0, -1], edge: ISLAND.z0 - RIM, len: W + RIM * 2 + 6 },
    { n: [0, 1], edge: ISLAND.z1 + RIM, len: W + RIM * 2 + 6 },
    { n: [-1, 0], edge: ISLAND.x0 - RIM, len: D + RIM * 2 + 6 },
    { n: [1, 0], edge: ISLAND.x1 + RIM, len: D + RIM * 2 + 6 },
  ]
  const bands = useRef([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    bands.current.forEach((m, i) => {
      if (!m) return
      const sd = sides[Math.floor(i / WAVES)]
      const k = i % WAVES
      const ph = (t / CYCLE + k / WAVES) % 1 // 0 = açıkta, 1 = kıyıda
      const dist = (1 - ph) * TRAVEL + 0.4
      m.position.set(sd.n[0] ? sd.edge + sd.n[0] * dist : cx, -0.025, sd.n[1] ? sd.edge + sd.n[1] * dist : cz)
      const env = Math.sin(ph * Math.PI) // belirir, kıyıda yok olur
      m.material.opacity = 0.5 * env * env + (ph > 0.85 ? 0.12 * (1 - (ph - 0.85) / 0.15) : 0)
    })
  })
  return (
    <group>
      <mesh ref={plane} position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2200, 2200]} />
        <meshStandardMaterial ref={mat} map={deep} roughness={0.22} metalness={0.05} emissive="#3aa9c9" emissiveIntensity={0.06} />
      </mesh>
      <mesh position={[0, -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2200, 2200]} />
        <meshBasicMaterial ref={mat2} map={swell} transparent opacity={0.18} depthWrite={false} />
      </mesh>
      {sides.flatMap((sd, si) =>
        Array.from({ length: WAVES }, (_, k) => {
          const i = si * WAVES + k
          return (
            <mesh key={i} ref={(m) => (bands.current[i] = m)} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={sd.n[0] ? [1.6, sd.len] : [sd.len, 1.6]} />
              <meshBasicMaterial map={ring} alphaMap={fade} transparent opacity={0} depthWrite={false} />
            </mesh>
          )
        }),
      )}
    </group>
  )
}

const DASHES = Array.from({ length: 49 }, (_, i) => -96 + i * 4).filter((t) => Math.abs(t) > RING.r1 + 1.5 && t <= 96)
const RING_DASHES = Array.from({ length: 36 }, (_, i) => (i / 36) * Math.PI * 2 + 0.087).filter((a) => [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].every((c) => Math.abs(Math.atan2(Math.sin(a - c), Math.cos(a - c))) > 0.3))
const PARK_X = -12 // batıya doğru asfalt biter; parkta patika başlar

/** Gölet: Meshy su dokusu + kum kıyısı + nilüfer yaprakları. */
function Pond({ x, z, r }) {
  const water = useLoader(TextureLoader, '/textures/water.webp')
  const map = useMemo(() => {
    const t = water.clone()
    t.wrapS = t.wrapT = RepeatWrapping
    t.colorSpace = SRGBColorSpace
    t.repeat.set((r * 2) / 6, (r * 2) / 6)
    t.needsUpdate = true
    return t
  }, [water, r])
  const pads = useMemo(
    () => [
      [-2.1, -1.6, 0.55, true],
      [2.3, -1.2, 0.48, false],
      [-1.4, 2.2, 0.52, true],
      [1.8, 2.0, 0.6, false],
      [0.3, -2.8, 0.45, true],
    ],
    [],
  )
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[r + 1.1, 48]} />
        <meshStandardMaterial color="#f6e3b0" roughness={1} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[r, 48]} />
        <meshStandardMaterial map={map} color="#bfeaf5" roughness={0.2} />
      </mesh>
      {pads.map(([px, pz, pr, bloom], i) => (
        <group key={i} position={[px, 0.07, pz]}>
          <mesh rotation={[-Math.PI / 2, 0, i]}>
            <circleGeometry args={[pr, 12, 0, Math.PI * 1.82]} />
            <meshStandardMaterial color="#7be090" roughness={0.7} />
          </mesh>
          {bloom && (
            <mesh position={[0, 0.08, 0]}>
              <dodecahedronGeometry args={[0.14, 0]} />
              <meshStandardMaterial color={i % 2 ? '#fff0f6' : '#ff9ec7'} roughness={0.4} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

/** Güney plajından denize uzanan pastel ahşap iskele. */
function BeachPier() {
  return (
    <group position={[0, 0, 54.2]}>
      <RoundedBox args={[3.2, 0.18, 9.6]} radius={0.05} position={[0, 0.28, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#f2cfa2" roughness={0.75} />
      </RoundedBox>
      {[-1.35, 1.35].map((px) =>
        [-3.6, 0, 3.8].map((pz) => (
          <group key={`${px}|${pz}`} position={[px, 0, pz]}>
            <mesh position={[0, 0.25, 0]} castShadow>
              <cylinderGeometry args={[0.12, 0.14, 1.1, 8]} />
              <meshStandardMaterial color="#cfa06e" roughness={0.8} />
            </mesh>
            {pz === 3.8 && (
              <mesh position={[0, 0.92, 0]}>
                <sphereGeometry args={[0.16, 10, 8]} />
                <meshStandardMaterial color="#fff3c4" emissive="#ffd970" emissiveIntensity={0.9} />
              </mesh>
            )}
          </group>
        )),
      )}
    </group>
  )
}

/** Gökyüzünde yavaşça süzülen pofuduk pastel bulutlar + çeşme su fıskiyesi. */
function ToyClouds() {
  const clouds = useMemo(
    () => [
      { x: -45, y: 34, z: -38, s: 1.4, sp: 0.6 },
      { x: 18, y: 37, z: -55, s: 1.7, sp: 0.45 },
      { x: 58, y: 33, z: -12, s: 1.3, sp: 0.55 },
      { x: -32, y: 36, z: 32, s: 1.5, sp: 0.5 },
      { x: 35, y: 35, z: 42, s: 1.25, sp: 0.65 },
    ],
    [],
  )
  const refs = useRef([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    clouds.forEach((c, i) => {
      const g = refs.current[i]
      if (!g) return
      g.position.x = ((c.x + t * c.sp + 90) % 180) - 90
    })
  })
  return (
    <group>
      {clouds.map((c, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)} position={[c.x, c.y, c.z]} scale={c.s}>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[2.2, 10, 8]} />
            <meshStandardMaterial color="#ffffff" roughness={0.9} />
          </mesh>
          <mesh position={[-1.9, -0.35, 0.2]}>
            <sphereGeometry args={[1.55, 10, 8]} />
            <meshStandardMaterial color="#fff9f5" roughness={0.9} />
          </mesh>
          <mesh position={[1.9, -0.3, -0.2]}>
            <sphereGeometry args={[1.65, 10, 8]} />
            <meshStandardMaterial color="#fff9f5" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function FountainFx() {
  const ring = useRef()
  const top = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const p = (t * 0.7) % 1
    if (ring.current) {
      ring.current.scale.setScalar(0.5 + p * 1.4)
      ring.current.material.opacity = (1 - p) * 0.55
    }
    if (top.current) {
      top.current.position.y = 2.05 + Math.sin(t * 5) * 0.1
      top.current.scale.setScalar(0.9 + Math.sin(t * 7) * 0.12)
    }
  })
  return (
    <group position={[0, 0, 0]}>
      <mesh ref={top} position={[0, 2.05, 0]}>
        <sphereGeometry args={[0.28, 10, 8]} />
        <meshStandardMaterial color="#d8f6ff" emissive="#9be4ff" emissiveIntensity={0.45} roughness={0.1} transparent opacity={0.85} />
      </mesh>
      <mesh ref={ring} position={[0, 0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.3, 1.5, 28]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** Şehir gökyüzünde yavaşça süzülen pastel sıcak hava balonu. */
function SkyBalloon() {
  const ref = useRef()
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const t = clock.elapsedTime * 0.08
    g.position.set(Math.cos(t) * 28, 26 + Math.sin(clock.elapsedTime * 0.7) * 0.8, Math.sin(t) * 28)
    g.rotation.y = -t
  })
  return (
    <group ref={ref} position={[28, 26, 0]}>
      <mesh position={[0, 2.2, 0]}>
        <sphereGeometry args={[2.1, 16, 12]} />
        <meshStandardMaterial color="#ff9ec7" roughness={0.55} />
      </mesh>
      <mesh position={[0, 2.2, 0]} scale={[1.01, 0.45, 1.01]}>
        <sphereGeometry args={[2.1, 16, 8]} />
        <meshStandardMaterial color="#ffe478" roughness={0.55} />
      </mesh>
      <RoundedBox args={[0.9, 0.75, 0.9]} radius={0.08} position={[0, -0.45, 0]}>
        <meshStandardMaterial color="#e8b882" roughness={0.75} />
      </RoundedBox>
    </group>
  )
}

const SPEED_RING_POS = [
  [0, 22, 0],
  [22, 0, Math.PI / 2],
  [-19, 0, Math.PI / 2],
]

/** Şehir yollarında içinden geçince hız artışı veren parlayan halkalar. */
function SpeedRings() {
  const refs = useRef([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    refs.current.forEach((m, i) => {
      if (!m) return
      m.position.y = 1.05 + Math.sin(t * 2.5 + i) * 0.1
    })
  })
  return (
    <group>
      {SPEED_RING_POS.map(([x, z, ry], i) => (
        <mesh key={i} ref={(el) => (refs.current[i] = el)} position={[x, 1.05, z]} rotation={[0, ry, 0]}>
          <torusGeometry args={[1.05, 0.09, 10, 24]} />
          <meshStandardMaterial color="#ffe066" emissive="#ffb703" emissiveIntensity={0.85} roughness={0.25} />
        </mesh>
      ))}
    </group>
  )
}

/** Tüm yol çizgileri (sıcak sarı orta kesikler, kenar şeritleri, dönel kavşak kesikleri ve yaya geçitleri) tek InstancedMesh'te. */
function RoadMarkings() {
  const ref = useRef()
  const items = useMemo(() => {
    const list = []
    const d = new Object3D()
    const push = (x, z, w, len, ry = 0, color = '#fffaf2') => {
      d.position.set(x, Y.mark, z)
      d.rotation.set(-Math.PI / 2, 0, ry)
      d.scale.set(w, len, 1)
      d.updateMatrix()
      list.push({ mat: d.matrix.clone(), color })
    }
    const YELLOW = '#ffe89e'
    const EDGE = '#f2edf9'
    const WHITE = '#fffdf8'
    for (const a of RING_DASHES) {
      const r = (RING.r0 + RING.r1) / 2
      push(Math.cos(a) * r, Math.sin(a) * r, 0.24, 1.45, -a - Math.PI / 2, YELLOW)
    }
    for (const t of DASHES) {
      if (t <= ROAD_END.south && t >= ROAD_END.north) push(0, t, 0.24, 1.85, 0, YELLOW)
      if (t > PARK_X && t <= ROAD_END.east) push(t, 0, 1.85, 0.24, 0, YELLOW)
    }
    // yol kenar çizgileri (kaldırım bordürünün 0,42 m içi)
    const edgeOff = ROAD_HALF - 0.42
    const nLen = -15.4 - ROAD_END.north
    const sLen = ROAD_END.south - 15.4
    const eLen = ROAD_END.east - 15.4
    for (const s of [-1, 1]) {
      push(s * edgeOff, (-15.4 + ROAD_END.north) / 2, 0.13, nLen, 0, EDGE)
      push(s * edgeOff, (15.4 + ROAD_END.south) / 2, 0.13, sLen, 0, EDGE)
      push((15.4 + ROAD_END.east) / 2, s * edgeOff, eLen, 0.13, 0, EDGE)
    }
    // yaya geçitleri
    for (const ox of [-1.8, -0.9, 0, 0.9, 1.8]) {
      push(ox, -17.2, 0.44, 2.25, 0, WHITE)
      push(ox, 17.2, 0.44, 2.25, 0, WHITE)
      push(ox, 26.4, 0.44, 2.25, 0, WHITE)
      push(17.2, ox, 2.25, 0.44, 0, WHITE)
    }
    return list
  }, [])
  useEffect(() => {
    const im = ref.current
    if (!im) return
    const c = new Color()
    for (let i = 0; i < items.length; i++) {
      im.setMatrixAt(i, items[i].mat)
      im.setColorAt(i, c.set(items[i].color))
    }
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
  }, [items])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} receiveShadow frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial roughness={0.85} />
    </instancedMesh>
  )
}

/** Kaldırım bordür taşları: asfalt ile kaldırım arasında yükseltilmiş 3B krem taş kenarlıklar (tek InstancedMesh). */
function RoadCurbs() {
  const ref = useRef()
  const blocks = useMemo(() => {
    const list = []
    const d = new Object3D()
    const push = (x, z, len, ry, idx) => {
      d.position.set(x, 0.068, z)
      d.rotation.set(0, ry, 0)
      d.scale.set(0.24, 0.135, len)
      d.updateMatrix()
      list.push({ mat: d.matrix.clone(), alt: idx % 2 === 0 })
    }
    const cx = ROAD_HALF + 0.12
    const step = 2.05
    let k = 0
    for (let z = -15.6; z >= ROAD_END.north + 0.5; z -= step) {
      push(-cx, z - step / 2, step - 0.08, 0, k++)
      push(cx, z - step / 2, step - 0.08, 0, k++)
    }
    for (let z = 15.6; z <= ROAD_END.south - 0.5; z += step) {
      push(-cx, z + step / 2, step - 0.08, 0, k++)
      push(cx, z + step / 2, step - 0.08, 0, k++)
    }
    for (let x = 15.6; x <= ROAD_END.east - 0.5; x += step) {
      push(x + step / 2, -cx, step - 0.08, Math.PI / 2, k++)
      push(x + step / 2, cx, step - 0.08, Math.PI / 2, k++)
    }
    // dönel kavşak iç ve dış bordürü
    const inN = 32
    for (let i = 0; i < inN; i++) {
      const a = (i / inN) * Math.PI * 2
      push(Math.cos(a) * (RING.r0 - 0.1), Math.sin(a) * (RING.r0 - 0.1), 1.72, -a, k++)
    }
    const outN = 48
    for (let i = 0; i < outN; i++) {
      const a = (i / outN) * Math.PI * 2
      const blocked = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].some((c) => Math.abs(Math.atan2(Math.sin(a - c), Math.cos(a - c))) < 0.31)
      if (blocked) continue
      push(Math.cos(a) * (RING.r1 + 0.1), Math.sin(a) * (RING.r1 + 0.1), 1.88, -a, k++)
    }
    return list
  }, [])
  useEffect(() => {
    const im = ref.current
    if (!im) return
    const c1 = new Color('#f6eee4')
    const c2 = new Color('#e8ddd0')
    for (let i = 0; i < blocks.length; i++) {
      im.setMatrixAt(i, blocks[i].mat)
      im.setColorAt(i, blocks[i].alt ? c1 : c2)
    }
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
  }, [blocks])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, blocks.length]} receiveShadow frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.78} />
    </instancedMesh>
  )
}

/** Yol detayları: pastel döküm rögar kapakları (tek InstancedMesh). */
function RoadDetails() {
  const ref = useRef()
  const tex = useMemo(() => getManholeTex(), [])
  const pts = useMemo(() => {
    const list = []
    for (let z = -22; z >= -86; z -= 18) list.push([z % 36 === 0 ? 2.1 : -2.1, z])
    list.push([2.0, 21.5])
    for (let x = 22; x <= 86; x += 18) list.push([x, x % 36 === 0 ? 2.1 : -2.1])
    return list
  }, [])
  useEffect(() => {
    const im = ref.current
    if (!im) return
    const d = new Object3D()
    pts.forEach(([x, z], i) => {
      d.position.set(x, Y.road + 0.012, z)
      d.rotation.set(0, i * 0.7, 0)
      d.scale.set(1, 1, 1)
      d.updateMatrix()
      im.setMatrixAt(i, d.matrix)
    })
    im.instanceMatrix.needsUpdate = true
  }, [pts])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, pts.length]} receiveShadow frustumCulled={false}>
      <cylinderGeometry args={[0.42, 0.44, 0.016, 16]} />
      <meshStandardMaterial map={tex} roughness={0.55} metalness={0.22} />
    </instancedMesh>
  )
}

// PROPS ve BLANKETS'i model adına göre grupla (≥ 2 örnek → InstancedPropGroup, tekil → Prop)
const { INSTANCED_PROPS, SINGLE_PROPS } = (() => {
  const byModel = new Map()
  const all = [
    ...PROPS,
    ...BLANKETS.map((b) => ({ model: '/models/venues/picnic-blanket.glb', x: b.x, z: b.z, scale: 2.0, ry: b.ry })),
  ]
  for (const p of all) {
    let arr = byModel.get(p.model)
    if (!arr) {
      arr = []
      byModel.set(p.model, arr)
    }
    arr.push(p)
  }
  const inst = []
  const single = []
  for (const [model, items] of byModel) {
    if (items.length >= 2) inst.push({ model, items })
    else single.push(items[0])
  }
  return { INSTANCED_PROPS: inst, SINGLE_PROPS: single }
})()

export default function City({ focusRef }) {
  const road = ROAD_HALF * 2
  const W = ISLAND.x1 - ISLAND.x0
  const D = ISLAND.z1 - ISLAND.z0
  const cx = (ISLAND.x0 + ISLAND.x1) / 2
  const cz = (ISLAND.z0 + ISLAND.z1) / 2
  const swW = road + 2.8
  const nsN = { len: -ROAD_START - ROAD_END.north, cz: (-ROAD_START + ROAD_END.north) / 2 } // kuzey kolu
  const nsS = { len: ROAD_END.south - ROAD_START, cz: (ROAD_END.south + ROAD_START) / 2 } // güney kolu (plaja)
  const ewE = { len: ROAD_END.east - ROAD_START, cx: (ROAD_END.east + ROAD_START) / 2 } // doğu kolu
  return (
    <group>
      <Sun focusRef={focusRef} />
      <ClubMusicNotes />
      <ToyClouds />
      <FountainFx />
      <SkyBalloon />
      <SpeedRings />
      <BeachPier />

      {/* zemin ve mahalle zeminleri */}
      <Sea />
      <Buoys />
      <Flat x={cx} z={cz} w={W} d={D} y={0} tex="grass" /> {/* ada */}
      {/* kıyı kumu: adanın dört kenarında */}
      <Flat x={cx} z={ISLAND.z0 - RIM / 2} w={W + RIM * 2} d={RIM} y={Y.floor} tex="sand" />
      <Flat x={cx} z={ISLAND.z1 + RIM / 2} w={W + RIM * 2} d={RIM} y={Y.floor} tex="sand" />
      <Flat x={ISLAND.x0 - RIM / 2} z={cz} w={RIM} d={D} y={Y.floor} tex="sand" />
      <Flat x={ISLAND.x1 + RIM / 2} z={cz} w={RIM} d={D} y={Y.floor} tex="sand" />
      <Pond x={-30} z={30} r={7} />
      <Flat x={0} z={-30} w={28} d={36} y={Y.floor} tex="cobble" color="#fff3ea" feather={3} /> {/* kafe: sıcak kaldırım taşı */}
      <Flat x={30} z={0} w={36} d={28} y={Y.floor} tex="cobble" color="#e3d6ff" feather={3} /> {/* kulüp */}
      <Flat x={BEACH.x} z={BEACH.z} round={BEACH.r + 4} y={Y.floor} tex="sand" feather={6} /> {/* yuvarlak plaj: yumuşak kenarlı */}
      <Flat x={BEACH.x} z={BEACH.z} round={BEACH.r - 2} y={Y.floor + 0.004} tex="sand" color="#fff6dc" feather={5} />
      
      <mesh position={[-33, 0.04, -6]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.6, 40]} />
        <meshStandardMaterial color="#a9ddf5" roughness={0.15} />
      </mesh>

      {/* kaldırım + yollar */}
      <Flat x={0} z={nsN.cz} w={swW} d={nsN.len} y={Y.sidewalk} tex="cobble" color="#fdf6ff" />
      <Flat x={0} z={nsS.cz} w={swW} d={nsS.len} y={Y.sidewalk} tex="cobble" color="#fdf6ff" />
      <Flat x={ewE.cx} z={0} w={ewE.len} d={swW} y={Y.sidewalk} tex="cobble" color="#fdf6ff" />
      <TexRing r0={PLAZA_R - 0.8} r1={RING.r0} y={Y.sidewalk + 0.004} tex="cobble" color="#fdf6ff" />
      <TexRing r0={RING.r1} r1={RING.r1 + RING.side} y={Y.sidewalk + 0.004} tex="cobble" color="#fdf6ff" />
      <Flat x={-19} z={0} w={14} d={3.4} y={Y.sidewalk} tex="cobble" color="#fff8f0" /> {/* park patikası: lobiden çardağa */}
      <Flat x={0} z={nsN.cz} w={road} d={nsN.len} y={Y.road} tex="asphalt" />
      <Flat x={0} z={nsS.cz} w={road} d={nsS.len} y={Y.road} tex="asphalt" />
      <Flat x={ewE.cx} z={0} w={ewE.len} d={road} y={Y.road} tex="asphalt" />
      <TexRing r0={RING.r0} r1={RING.r1} y={Y.road + 0.006} tex="asphalt" />
      <RoadMarkings />
      <RoadCurbs />
      <RoadDetails />

      {/* lobi meydanı */}
      <Flat round={PLAZA_R} y={Y.plaza} tex="cobble" color="#fff7ee" />
      <Ring r0={6.6} r1={7.1} y={Y.mark} color="#ffebd3" />
      <Flat round={3.4} y={Y.mark} color="#ffebd3" />
      <Gazebo />

      {BUILDINGS.filter((b) => !b.gazebo).map((b, i) => (
        <Building key={i} b={b} i={i} focusRef={focusRef} />
      ))}
      {INSTANCED_PROPS.map((g) => (
        <InstancedPropGroup key={g.model} model={g.model} items={g.items} />
      ))}
      {SINGLE_PROPS.map((p, i) => (
        <Prop key={i} {...p} />
      ))}
      <Plants />
      {TOWELS.map((t, i) => (
        <Towel key={i} t={t} />
      ))}
    </group>
  )
}
