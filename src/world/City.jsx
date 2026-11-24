import { useMemo, useRef, useState } from 'react'
import { screenK } from './screenK'
import { useFrame, useLoader } from '@react-three/fiber'
import { CanvasTexture, Color, DataTexture, ExtrudeGeometry, Shape, LinearFilter, RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three'
import { Html, RoundedBox } from '@react-three/drei'
import { BLANKETS, BUILDINGS, GAZEBO, ISLAND, PROPS, RIM, ROAD_END, ROAD_HALF } from './layout'
import { useCull } from './cull'
import Facade from './Facade'
import { facadeOf } from './facadeData'
import Prop from './Prop'
import Plants from './Plants'
import { Em } from '../components/emoji'
import { SKY_MATS, skyLive } from './Sky'
import { worldClock } from './worldClock'

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
    t.anisotropy = 8
    setup(t)
    t.needsUpdate = true
    texCache.set(k, t)
  }
  return t
}
const q = (v, s = 0.25) => Math.max(s, Math.round(v / s) * s) // tekrar sayısını yuvarla (önbellek isabeti)

// Yer dokuları (Meshy ile üretilen üstten bakış desenler, scripts/make-tileable.py ile döşenebilir yapıldı): public/textures/<ad>.webp
export const GROUND_TEX = { grass: 4.5, asphalt: 5, cobble: 3.2, sand: 4 } // doku adı → bir kiremitin kapladığı metre
export const GROUND_URLS = Object.keys(GROUND_TEX).map((n) => `/textures/${n}.webp`)

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
  const base = useLoader(TextureLoader, `/textures/${tex ?? 'grass'}.webp`)
  const map = useMemo(() => {
    if (!tex) return null
    const m = GROUND_TEX[tex]
    const rx = Math.round(((round ? round * 2 : w) / m) * 20) / 20
    const ry = Math.round(((round ? round * 2 : d) / m) * 20) / 20
    const ox = Math.round((((x / m) % 1) + 1) * 20) / 20 % 1
    const oy = Math.round((((-z / m) % 1) + 1) * 20) / 20 % 1
    return sharedTexture(base, `f${rx}|${ry}|${ox}|${oy}`, (t) => {
      t.repeat.set(rx, ry)
      t.offset.set(ox, oy) // komşu parçalarda desen aynı hizadan devam etsin
    })
  }, [base, tex, w, d, round, x, z])
  const alpha = useMemo(() => (feather > 0 ? featherTexture(round ? round * 2 : w, round ? round * 2 : d, feather, round ? round * 2 : 0) : null), [feather, w, d, round])
  return (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow renderOrder={alpha ? 1 : 0}>
      {round ? <circleGeometry args={[round, 64]} /> : <planeGeometry args={[w, d]} />}
      <meshStandardMaterial color={color} map={map} alphaMap={alpha} transparent={Boolean(alpha)} depthWrite={!alpha} roughness={0.95} />
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
  const clock = useRef(0)
  useFrame(({ camera }, dt) => {
    clock.current += dt
    if (clock.current < 0.4) return
    clock.current = 0
    const f = focusRef.current
    const dist = Math.hypot(f.x - x, f.z - z)
    // kameraya çok yakın pin (distanceFactor yüzünden) dev boyuna çıkmasın
    const camDist = Math.hypot(camera.position.x - x, camera.position.y - y, camera.position.z - z)
    setMode(dist > LABEL_RANGE || camDist < 15 ? 0 : dist > LABEL_NAME_RANGE ? 1 : 2)
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
const WALL_TEX = { brick: 2.4, siding: 2.0, mosaic: 2.6, plaster: 4, shingle: 2.0 } // doku adı → bir kiremitin metre boyu
const STYLES = [
  { wall: 'brick', roofType: 'gable', win: 'arch', shutters: true, chimney: true, door: '#bf8942' },
  { wall: 'siding', roofType: 'flat', win: 'round', flowerbox: true, door: '#cc7914' },
  { wall: 'mosaic', roofType: 'hip', win: 'wide', door: '#e8873a' },
  { wall: 'plaster', roofType: 'flat', win: 'rect', balcony: true, door: '#8a6bd1' },
  { wall: 'brick', roofType: 'hip', win: 'rect', shutters: true, chimney: true, door: '#5b86d6' },
  { wall: 'siding', roofType: 'gable', win: 'wide', flowerbox: true, door: '#d58f2b' },
]
const lighten = (hex, t) => `#${new Color(hex).lerp(new Color('#ffffff'), t).getHexString()}`

/** Dokulu düz yüzey (duvar/çatı paneli): doku dünya ölçüsünde döşenir, renk tonu çarpılır. */
function Panel({ tex, w, h, color, position, rotation, repeat }) {
  const base = useLoader(TextureLoader, `/textures/${tex}.webp`)
  const map = useMemo(() => {
    const m = WALL_TEX[tex] ?? 2.4
    const rx = q(repeat?.[0] ?? w / m)
    const ry = q(repeat?.[1] ?? h / m)
    return sharedTexture(base, `${rx}|${ry}`, (t) => t.repeat.set(rx, ry))
  }, [base, tex, w, h, repeat])
  return (
    <mesh position={position} rotation={rotation} receiveShadow>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial color={color} map={map} roughness={0.7} />
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
  const shingle = useLoader(TextureLoader, '/textures/shingle.webp')
  const map = useMemo(() => sharedTexture(shingle, 'roof', (t) => t.repeat.set(3, 2)), [shingle])
  const mat = <meshStandardMaterial color={color} map={map} roughness={0.55} />
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
  const trim = <meshStandardMaterial color="#fffaf2" roughness={0.5} />
  return (
    <group position={[x, y, z]}>
      {kind === 'round' ? (
        <>
          <mesh>
            <circleGeometry args={[0.62, 24]} />
            {glass}
          </mesh>
          <mesh position={[0, 0, -0.01]}>
            <circleGeometry args={[0.78, 24]} />
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
              <cylinderGeometry args={[w / 2, w / 2, 0.12, 20]} />
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
            <meshStandardMaterial color={accent} roughness={0.6} />
          </mesh>
        ))}
      {flowerbox && (
        <group position={[0, -0.78, 0.2]}>
          <mesh>
            <boxGeometry args={[w + 0.3, 0.25, 0.34]} />
            <meshStandardMaterial color={accent} roughness={0.6} />
          </mesh>
          {[-0.4, 0, 0.4].map((fx) => (
            <mesh key={fx} position={[fx * (w / 1.6), 0.24, 0]}>
              <sphereGeometry args={[0.17, 10, 8]} />
              <meshStandardMaterial color={fx === 0 ? '#ffd35e' : '#fdb252'} roughness={0.6} />
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
  useCull(grp, b.x, b.z)
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
      <RoundedBox args={[w, h, d]} radius={0.35} smoothness={3} position={[0, h / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.55} />
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
          <Facade F={fac} w={w} h={h} roof={roof} z={d / 2} />
          {!fac.noUpper && h >= 5.5 &&
            Array.from({ length: Math.max(1, Math.floor(w / 3.2)) }, (_, ci) => (
              <Window key={ci} kind={st.win === 'round' ? 'rect' : st.win} x={(ci - (Math.max(1, Math.floor(w / 3.2)) - 1) / 2) * (w / Math.max(1, Math.floor(w / 3.2)))} y={Math.min(h - 1.2, 4.2)} z={d / 2 + 0.06} w={ww} accent={roof} />
            ))}
        </>
      ) : (
        <>
          {/* kapı: normal boy (1,2 × 2,2 m), cephede ortada ya da kayık */}
          <RoundedBox args={[1.45, 2.35, 0.16]} radius={0.06} position={[doorShift, 1.17, d / 2 + 0.04]}>
            <meshStandardMaterial color="#fffaf2" roughness={0.5} />
          </RoundedBox>
          <mesh position={[doorShift, 1.12, d / 2 + 0.13]}>
            <boxGeometry args={[1.2, 2.15, 0.05]} />
            <meshStandardMaterial color={st.door} roughness={0.4} />
          </mesh>
          <mesh position={[doorShift + 0.4, 1.1, d / 2 + 0.17]}>
            <circleGeometry args={[0.06, 12]} />
            <meshStandardMaterial color="#ffd35e" roughness={0.3} />
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

/** Cephe önü: bina girişinin önünde taş döşeme (çimen değil). Kaldırımın altında kalır, yola taşan kısım gizlenir. */
function Apron({ b }) {
  const side = b.facing === 'e' || b.facing === 'w'
  const A = 3.4
  const sgn = b.facing === 's' || b.facing === 'e' ? 1 : -1
  const half = (side ? b.w : b.d) / 2 // cepheye dik yarı boyut: e/w'de x ekseni = d
  const depthHalf = side ? b.d / 2 : b.d / 2
  const wide = (side ? b.w : b.w) + 1.4
  const cx = side ? b.x + sgn * (depthHalf + A / 2 - 0.1) : b.x
  const cz = side ? b.z : b.z + sgn * (depthHalf + A / 2 - 0.1)
  void half
  return <Flat x={cx} z={cz} w={side ? A : wide} d={side ? wide : A} y={0.038} tex="cobble" color="#f6efe6" />
}

function Gazebo() {
  const posts = Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2)
  return (
    <group position={[GAZEBO.x, 0, GAZEBO.z]}>
      <mesh position={[0, 0.15, 0]} receiveShadow>
        <cylinderGeometry args={[3.2, 3.3, 0.3, 32]} />
        <meshStandardMaterial color="#fff2e3" roughness={0.6} />
      </mesh>
      {posts.map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 2.7, 1.8, Math.sin(a) * 2.7]} castShadow>
          <cylinderGeometry args={[0.18, 0.18, 3.2, 12]} />
          <meshStandardMaterial color="#ffffff" roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 4.2, 0]} castShadow>
        <coneGeometry args={[3.8, 1.8, 6]} />
        <meshStandardMaterial color="#b79cff" roughness={0.5} />
      </mesh>
    </group>
  )
}

/** Park piknik battaniyeleri: Meshy GLB (sepetli, pastel kareli), 2 kişilik (oturma noktaları layout.js SEATS'te). */
function Blanket({ b }) {
  return <Prop model="/models/venues/picnic-blanket.glb" x={b.x} z={b.z} scale={2.0} ry={b.ry} />
}

/** Gölge kamerası oyuncuyu takip eden güneş. */
function Sun({ focusRef }) {
  const light = useRef()
  useFrame(() => {
    const l = light.current
    if (!l) return
    const f = focusRef.current
    // güneş/ay yönü ve rengi gün-gece döngüsünden (Sky.jsx)
    l.position.set(f.x + skyLive.dir.x * 28, skyLive.dir.y * 28, f.z + skyLive.dir.z * 28)
    l.color.copy(skyLive.color)
    l.intensity = skyLive.intensity
    l.target.position.set(f.x, 0, f.z)
    l.target.updateMatrixWorld()
  })
  return (
    <directionalLight
      ref={light}
      castShadow
      intensity={1.6}
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-26}
      shadow-camera-right={26}
      shadow-camera-top={26}
      shadow-camera-bottom={-26}
      shadow-camera-near={1}
      shadow-camera-far={70}
      shadow-bias={-0.0004}
    />
  )
}

// ---------- deniz: adanın dört yanı (Meshy dokulu, animasyonlu) ----------
const WATER_COLOR = new Color('#feda9d')
const WATER_NIGHT = new Color('#3f5a9c')

function Sea() {
  const water = useLoader(TextureLoader, '/textures/water.webp')
  const foam = useLoader(TextureLoader, '/textures/foam.webp')
  const [deep, swell, ring] = useMemo(() => {
    const mk = (src, m, size) => {
      const t = src.clone()
      t.wrapS = t.wrapT = RepeatWrapping
      t.colorSpace = SRGBColorSpace
      t.anisotropy = 8
      t.repeat.set(size / m, size / m)
      t.needsUpdate = true
      return t
    }
    return [mk(water, 14, 700), mk(foam, 9, 700), mk(foam, 7, 120)]
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
        <planeGeometry args={[700, 700]} />
        <meshStandardMaterial ref={mat} map={deep} roughness={0.25} metalness={0.05} emissive="#3aa9c9" emissiveIntensity={0.06} />
      </mesh>
      <mesh position={[0, -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[700, 700]} />
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

const DASHES = Array.from({ length: 49 }, (_, i) => -96 + i * 4).filter((t) => Math.abs(t) > 12.5 && t <= 96)
const PARK_X = -12 // batıya doğru asfalt biter; parkta patika başlar

/** Gölet: Meshy su dokusu + kum kıyısı (Gölet bölgesi). */
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
    </group>
  )
}

export default function City({ focusRef }) {
  const road = ROAD_HALF * 2
  const W = ISLAND.x1 - ISLAND.x0
  const D = ISLAND.z1 - ISLAND.z0
  const cx = (ISLAND.x0 + ISLAND.x1) / 2
  const cz = (ISLAND.z0 + ISLAND.z1) / 2
  const swW = road + 2.8
  const nsLen = ROAD_END.south - ROAD_END.north // kuzey-güney yol uzunluğu
  const nsCz = (ROAD_END.south + ROAD_END.north) / 2
  const ewLen = ROAD_END.east - PARK_X // doğu-batı yol uzunluğu (batıda park patikası)
  const ewCx = (ROAD_END.east + PARK_X) / 2
  return (
    <group>
      <Sun focusRef={focusRef} />

      {/* zemin ve mahalle zeminleri */}
      <Sea />
      <Flat x={cx} z={cz} w={W} d={D} y={0} tex="grass" /> {/* ada */}
      {/* kıyı kumu: adanın dört kenarında */}
      <Flat x={cx} z={ISLAND.z0 - RIM / 2} w={W + RIM * 2} d={RIM} y={Y.floor} tex="sand" />
      <Flat x={cx} z={ISLAND.z1 + RIM / 2} w={W + RIM * 2} d={RIM} y={Y.floor} tex="sand" />
      <Flat x={ISLAND.x0 - RIM / 2} z={cz} w={RIM} d={D} y={Y.floor} tex="sand" />
      <Flat x={ISLAND.x1 + RIM / 2} z={cz} w={RIM} d={D} y={Y.floor} tex="sand" />
      <Pond x={-30} z={30} r={7} />
      <Flat x={0} z={-30} w={28} d={36} y={Y.floor} tex="cobble" color="#fff3ea" feather={3} /> {/* kafe: sıcak kaldırım taşı */}
      <Flat x={30} z={0} w={36} d={28} y={Y.floor} tex="cobble" color="#e3d6ff" feather={3} /> {/* kulüp */}
      <Flat x={0} z={39} w={34} d={22} y={Y.floor} tex="sand" feather={4} />
      <Flat x={0} z={47} w={90} d={8} y={Y.floor} tex="sand" feather={3} /> {/* plaj kumu */}
      
      <mesh position={[-33, 0.04, -6]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.6, 40]} />
        <meshStandardMaterial color="#a9ddf5" roughness={0.15} />
      </mesh>

      {/* kaldırım + yollar */}
      <Flat x={0} z={nsCz} w={swW} d={nsLen} y={Y.sidewalk} tex="cobble" color="#fdf6ff" />
      <Flat x={ewCx} z={0} w={ewLen} d={swW} y={Y.sidewalk} tex="cobble" color="#fdf6ff" />
      <Flat x={-19} z={0} w={14} d={3.4} y={Y.sidewalk} tex="cobble" color="#fff8f0" /> {/* park patikası: lobiden çardağa */}
      <Flat x={0} z={nsCz} w={road} d={nsLen} y={Y.road} tex="asphalt" />
      <Flat x={ewCx} z={0} w={ewLen} d={road} y={Y.road} tex="asphalt" />
      {DASHES.map((t) => (
        <group key={t}>
          {t <= ROAD_END.south && t >= ROAD_END.north && <Flat x={0} z={t} w={0.28} d={1.8} y={Y.mark} color="#ffffff" />}
          {t > PARK_X && t <= ROAD_END.east && <Flat x={t} z={0} w={1.8} d={0.28} y={Y.mark} color="#ffffff" />}
        </group>
      ))}

      {/* lobi meydanı */}
      <Flat round={12} y={Y.plaza} tex="cobble" color="#fff7ee" />
      <Ring r0={6.6} r1={7.1} y={Y.mark} color="#ffebd3" />
      <Ring r0={9.6} r1={10.2} y={Y.mark} color="#cfeaff" />
      <Flat round={3.4} y={Y.mark} color="#ffebd3" />
      <Gazebo />

      {BUILDINGS.filter((b) => !b.gazebo).map((b, i) => (
        <Apron key={`ap${i}`} b={b} />
      ))}
      {BUILDINGS.filter((b) => !b.gazebo).map((b, i) => (
        <Building key={i} b={b} i={i} focusRef={focusRef} />
      ))}
      {PROPS.map((p, i) => (
        <Prop key={i} {...p} />
      ))}
      <Plants />
      {BLANKETS.map((b, i) => (
        <Blanket key={i} b={b} />
      ))}
    </group>
  )
}
