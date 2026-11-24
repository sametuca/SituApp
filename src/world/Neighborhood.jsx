// Konut Mahallesi çizimi (City.jsx içinden): sokak, parseller, evler, çitler, bahçe öğeleri, tabelalar.
// Ev, bahçe öğeleri ve ağaç/bank Meshy GLB'dir; çit çıtaları, kapı, tabela düzlemi ve zemin şeritleri küçük yardımcı şekillerdir.
// Veri: features/neighborhoodStore.js (sunucudan: stil, ad, kilit, hoş geldin mesajı).
import { useEffect, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox, useGLTF } from '@react-three/drei'
import { BoxGeometry, BufferAttribute, CanvasTexture, Color, ConeGeometry, Box3, Euler, Matrix4, Quaternion, SRGBColorSpace, SphereGeometry, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import Prop from './Prop'
import { DEFAULT_EXTERIOR, DOOR_HEX, LOCAL, PLOTS, STREET_HALF, STREET_X, houseUrl } from './neighborhood'
import { plotStore, usePlotVersion } from './features/neighborhoodStore'

const LAMP = '/models/park/park-lamp.glb'
const BENCH = '/models/park/park-bench.glb'
const TREE = '/models/park/park-tree.glb'
const GARDEN = { flowers: '/models/neighborhood/garden-flowerbed.glb', lantern: '/models/neighborhood/garden-lantern.glb', mailbox: '/models/neighborhood/garden-mailbox.glb' }

// ---------- yardımcı: düz zemin ----------
function Flat({ x = 0, z = 0, w, d, y, color }) {
  return (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  )
}

// ---------- tabela dokusu (canvas) ----------
const signCache = new Map()
function roundRect(c, x, y, w, h, r) {
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
}
function fitText(c, text, max, size, weight) {
  let s = size
  do {
    c.font = `${weight} ${s}px Nunito, system-ui, sans-serif`
    s -= 2
  } while (c.measureText(text).width > max && s > 14)
}
function drawSign(tex, { title, sub, accent }) {
  const cv = tex.image
  const c = cv.getContext('2d')
  c.clearRect(0, 0, cv.width, cv.height)
  roundRect(c, 6, 6, cv.width - 12, cv.height - 12, 36)
  c.fillStyle = '#fffaf2'
  c.fill()
  c.lineWidth = 10
  c.strokeStyle = accent
  c.stroke()
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillStyle = '#4a3b5c'
  fitText(c, title, cv.width - 70, 62, 900)
  c.fillText(title, cv.width / 2, sub ? cv.height * 0.38 : cv.height / 2)
  if (sub) {
    c.fillStyle = '#8a7a9c'
    fitText(c, sub, cv.width - 70, 38, 700)
    c.fillText(sub, cv.width / 2, cv.height * 0.72)
  }
  tex.needsUpdate = true
}
/** Aynı metinli tabelalar tek dokuyu paylaşır. */
function signTexture(opts) {
  const key = `${opts.title}|${opts.sub}|${opts.accent}`
  let tex = signCache.get(key)
  if (!tex) {
    const cv = document.createElement('canvas')
    cv.width = 512
    cv.height = 192
    tex = new CanvasTexture(cv)
    tex.colorSpace = SRGBColorSpace
    tex.anisotropy = 4
    drawSign(tex, opts)
    document.fonts?.ready.then(() => drawSign(tex, opts)).catch(() => {}) // Nunito yüklenince yeniden çiz
    signCache.set(key, tex)
  }
  return tex
}
function Sign({ position, w = 2.7, opts }) {
  const tex = useMemo(() => signTexture(opts), [opts.title, opts.sub, opts.accent]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <mesh position={position}>
      <planeGeometry args={[w, w * (192 / 512)]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  )
}

// ---------- çitler (birleştirilmiş geometri, köşe renkli) ----------
const _m = new Matrix4()
function piece(geo, color, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone()
  _m.compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(0, ry, 0)), new Vector3(sx, sy, sz))
  g.applyMatrix4(_m)
  const col = new Color(color)
  const n = g.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) arr.set([col.r, col.g, col.b], i * 3)
  g.setAttribute('color', new BufferAttribute(arr, 3))
  g.deleteAttribute('uv')
  return g
}
const BOX = new BoxGeometry(1, 1, 1)
const TIP = new ConeGeometry(0.1, 0.16, 4)
const BALL = new SphereGeometry(0.5, 8, 6)
const { fenceFront: FF, fenceBack: FB, fenceSide: FS, gate: GT } = LOCAL
// çit çizgileri (yerel): [x0, z0, x1, z1]
const RUNS = [
  [-FS, FF, -GT, FF],
  [GT, FF, FS, FF],
  [-FS, FB, -FS, FF],
  [FS, FB, FS, FF],
  [-FS, FB, FS, FB],
]
const fenceCache = {}
function fenceGeometry(style) {
  if (fenceCache[style]) return fenceCache[style]
  const parts = []
  for (const [x0, z0, x1, z1] of RUNS) {
    const len = Math.hypot(x1 - x0, z1 - z0)
    const dx = (x1 - x0) / len
    const dz = (z1 - z0) / len
    const ry = Math.atan2(-dz, dx)
    const mx = (x0 + x1) / 2
    const mz = (z0 + z1) / 2
    const at = (t) => [x0 + dx * t, z0 + dz * t]
    if (style === 'picket') {
      const n = Math.round(len / 0.4)
      for (let i = 0; i <= n; i++) {
        const [x, z] = at((i / n) * len)
        parts.push(piece(BOX, '#fffaf2', x, 0.48, z, ry, 0.14, 0.96, 0.06), piece(TIP, '#fffaf2', x, 1.04, z, ry + Math.PI / 4))
      }
      parts.push(piece(BOX, '#ffd3e6', mx, 0.32, mz, ry, len, 0.07, 0.05), piece(BOX, '#ffd3e6', mx, 0.7, mz, ry, len, 0.07, 0.05))
    } else if (style === 'hedge') {
      const n = Math.max(2, Math.round(len / 0.48))
      for (let i = 0; i <= n; i++) {
        const [x, z] = at((i / n) * len)
        parts.push(piece(BALL, i % 2 ? '#8fdcb4' : '#a9e8c6', x, 0.4, z, 0, 0.85, 0.8, 0.75))
        if (i % 3 === 1) parts.push(piece(BALL, i % 2 ? '#ff9fc6' : '#fff0a8', x + dz * 0.3, 0.78, z - dx * 0.3, 0, 0.2, 0.2, 0.2))
      }
    } else {
      const n = Math.max(1, Math.round(len / 1.7))
      for (let i = 0; i <= n; i++) {
        const [x, z] = at((i / n) * len)
        parts.push(piece(BOX, '#b79cff', x, 0.5, z, 0, 0.14, 1.0, 0.14), piece(BALL, '#ffd35e', x, 1.05, z, 0, 0.26, 0.26, 0.26))
      }
      parts.push(piece(BOX, '#ffe9a8', mx, 0.45, mz, ry, len, 0.05, 0.05), piece(BOX, '#ffe9a8', mx, 0.82, mz, ry, len, 0.05, 0.05))
    }
  }
  // kapı direkleri
  for (const sx of [-GT, GT]) parts.push(piece(BOX, '#ff9fc6', sx, 0.65, FF, 0, 0.2, 1.3, 0.2), piece(BALL, '#ffd35e', sx, 1.4, FF, 0, 0.3, 0.3, 0.3))
  const geo = mergeGeometries(parts)
  fenceCache[style] = geo
  return geo
}
function Fence({ style }) {
  const geo = useMemo(() => fenceGeometry(style), [style])
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.7} />
    </mesh>
  )
}

// ---------- ev ----------
const HOUSE_WIDTH = LOCAL.houseHalf * 2
const HOUSE_DEPTH_MAX = LOCAL.houseFront - LOCAL.houseBack + 0.2
// Evin ön yüzünden kapı panelinin ne kadar içeri/dışarı duracağı (modele göre ince ayar)
const DOOR_INSET = { cottage: 0.1, tower: 0.1, bungalow: 0.1, heart: 0.1 }

function Door({ z, hex }) {
  return (
    <group position={[0, 0, z]}>
      <RoundedBox args={[1.5, 2.4, 0.14]} radius={0.05} smoothness={2} position={[0, 1.2, 0]}>
        <meshStandardMaterial color="#fffaf2" roughness={0.5} />
      </RoundedBox>
      <RoundedBox args={[1.1, 2.1, 0.12]} radius={0.04} smoothness={2} position={[0, 1.1, 0.08]}>
        <meshStandardMaterial color={hex} roughness={0.4} />
      </RoundedBox>
      <mesh position={[0.35, 1.05, 0.17]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color="#ffd35e" roughness={0.3} />
      </mesh>
      <RoundedBox args={[1.9, 0.14, 0.7]} radius={0.05} position={[0, 0.07, 0.35]} receiveShadow>
        <meshStandardMaterial color="#ffeadb" roughness={0.8} />
      </RoundedBox>
    </group>
  )
}

function House({ ext, name, open }) {
  const { scene } = useGLTF(houseUrl(ext.house))
  const fit = useMemo(() => {
    const obj = scene.clone(true)
    const size = new Box3().setFromObject(obj).getSize(new Vector3())
    const s = Math.min(HOUSE_WIDTH / (size.x || 1), HOUSE_DEPTH_MAX / (size.z || 1))
    obj.scale.multiplyScalar(s)
    const b = new Box3().setFromObject(obj)
    const c = b.getCenter(new Vector3())
    obj.position.set(-c.x, -b.min.y, LOCAL.houseFront - b.max.z)
    obj.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true
    })
    return { obj, height: b.max.y - b.min.y }
  }, [scene])
  const accent = DOOR_HEX[ext.door] ?? DOOR_HEX.pink
  const sign = useMemo(() => ({ title: `${open ? '🔓' : '🔒'} ${name}`, sub: ext.welcome, accent }), [open, name, ext.welcome, accent])
  const front = LOCAL.houseFront + (DOOR_INSET[ext.house] ?? 0.1)
  return (
    <group>
      <primitive object={fit.obj} />
      <Door z={front} hex={accent} />
      <Sign position={[0, Math.min(2.95, fit.height - 0.5), front + 0.12]} opts={sign} />
    </group>
  )
}

// ---------- bahçe ----------
function Garden({ g }) {
  return (
    <group>
      {g.flowers && (
        <>
          <Prop model={GARDEN.flowers} x={-3.0} z={4.2} scale={1.7} />
          <Prop model={GARDEN.flowers} x={3.0} z={4.4} scale={1.7} ry={0.4} />
        </>
      )}
      {g.lantern && (
        <>
          <Prop model={GARDEN.lantern} x={-1.7} z={1.6} scale={1.6} />
          <Prop model={GARDEN.lantern} x={1.7} z={1.6} scale={1.6} />
        </>
      )}
      {g.mailbox && <Prop model={GARDEN.mailbox} x={2.3} z={5.9} scale={1.5} ry={0.2} />}
      {g.bench && <Prop model={BENCH} x={-3.3} z={1.8} scale={1.7} />}
      {g.tree && <Prop model={TREE} x={3.8} z={1.9} scale={3.2} />}
    </group>
  )
}

// ---------- parsel ----------
function OwnedPlot({ data }) {
  const ext = data.ext ?? DEFAULT_EXTERIOR
  return (
    <>
      <Flat w={9.8} d={13.8} y={0.03} color="#b9ebc7" />
      <Flat x={0} z={(LOCAL.fenceFront + 1.2) / 2} w={1.5} d={LOCAL.fenceFront - 1.2} y={0.05} color="#ffeadb" />
      <Fence style={ext.fence} />
      <House ext={ext} name={data.name} open={data.open} />
      <Garden g={ext.garden} />
    </>
  )
}

function EmptyPlot({ plot }) {
  const opts = useMemo(() => ({ title: '🏷️ Satılık', sub: `${plot.n}. parsel · evini döşe, burası senin olsun`, accent: '#c9b6f5' }), [plot.n])
  return (
    <>
      <Flat w={9.8} d={13.8} y={0.03} color="#e3deea" />
      <Flat w={7} d={9} y={0.045} color="#ece8f3" />
      {[[-4.6, -6.6], [4.6, -6.6], [-4.6, 6.4], [4.6, 6.4]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.4, z]}>
          <boxGeometry args={[0.14, 0.8, 0.14]} />
          <meshStandardMaterial color="#ffd35e" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 0.7, 5.6]}>
        <boxGeometry args={[0.12, 1.4, 0.12]} />
        <meshStandardMaterial color="#b79cff" roughness={0.6} />
      </mesh>
      <Sign position={[0, 1.65, 5.68]} w={2.4} opts={opts} />
    </>
  )
}

function Plot({ plot, data }) {
  return (
    <group position={[plot.x, 0, plot.z]} rotation={[0, plot.ry, 0]}>
      {data ? <OwnedPlot data={data} /> : <EmptyPlot plot={plot} />}
    </group>
  )
}

// ---------- sokak ----------
function StreetLabel({ x, z, text, focusRef }) {
  const [ready, setReady] = useState(false) // drei <Html> ilk çizimde koşulsuz bağlanmaz
  const [show, setShow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 800)
    return () => clearTimeout(t)
  }, [])
  useFrame(() => {
    const f = focusRef.current
    const near = Math.hypot(f.x - x, f.z - z) < 34
    if (near !== show) setShow(near)
  })
  if (!ready || !show) return null
  return (
    <Html position={[x, 4.4, z]} center distanceFactor={16} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <div className="whitespace-nowrap rounded-full border-2 border-white bg-white/90 px-3 py-1 text-sm font-extrabold text-[#4a3b5c] shadow-md">{text}</div>
    </Html>
  )
}

const LAMP_Z = [-44, -35, -26, -17.5, 17.5, 26, 35, 44]

export default function Neighborhood({ focusRef }) {
  usePlotVersion()
  return (
    <group>
      {/* mahalle çimleri ve sokak */}
      {[[-31, -31], [-31, 31]].map(([x, z]) => (
        <group key={z}>
          <Flat x={x} z={z} w={34} d={34} y={0.02} color="#c6f0d3" />
          <Flat x={STREET_X} z={z} w={STREET_HALF * 2 + 1.2} d={34} y={0.04} color="#f7f0fb" />
          <Flat x={STREET_X} z={z} w={STREET_HALF * 2} d={34} y={0.06} color="#ece3f6" />
        </group>
      ))}
      {PLOTS.map((p) => (
        <Plot key={p.id} plot={p} data={plotStore.plots.get(p.id)} />
      ))}
      {LAMP_Z.flatMap((z) => [-1, 1].map((s) => <Prop key={`${z}${s}`} model={LAMP} x={STREET_X + s * (STREET_HALF + 0.5)} z={z} scale={2.4} />))}
      <StreetLabel x={STREET_X} z={-15} text="🏘️ Konut Mahallesi" focusRef={focusRef} />
      <StreetLabel x={STREET_X} z={15} text="🏘️ Konut Mahallesi" focusRef={focusRef} />
    </group>
  )
}
