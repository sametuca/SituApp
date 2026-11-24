import { useMemo, useRef, useState } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { CanvasTexture, Color, RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three'
import { Html, RoundedBox } from '@react-three/drei'
import { BLANKETS, BUILDINGS, GAZEBO, PROPS, ROAD_HALF } from './layout'
import Prop from './Prop'
import Plants from './Plants'
import { Em } from '../components/emoji'
import { SKY_MATS, skyLive } from './Sky'
import { worldClock } from './worldClock'

const FACING = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }

// katman yükseklikleri (z-fighting olmasın)
const Y = { floor: 0.02, sidewalk: 0.04, road: 0.06, plaza: 0.08, mark: 0.1 }

// Yer dokuları (Meshy ile üretilen üstten bakış desenler, scripts/make-tileable.py ile döşenebilir yapıldı): public/textures/<ad>.webp
export const GROUND_TEX = { grass: 4.5, asphalt: 5, cobble: 3.2, sand: 4 } // doku adı → bir kiremitin kapladığı metre
export const GROUND_URLS = Object.keys(GROUND_TEX).map((n) => `/textures/${n}.webp`)

/** tex: GROUND_TEX adı. Doku dünya ölçüsünde döşenir (kiremit boyu metre), renk tonu `color` ile çarpılır (pastel ton verir). */
function Flat({ x = 0, z = 0, w, d, y, color = '#ffffff', round, tex }) {
  const base = useLoader(TextureLoader, `/textures/${tex ?? 'grass'}.webp`)
  const map = useMemo(() => {
    if (!tex) return null
    const t = base.clone()
    t.wrapS = t.wrapT = RepeatWrapping
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 8
    const m = GROUND_TEX[tex]
    t.repeat.set((round ? round * 2 : w) / m, (round ? round * 2 : d) / m)
    t.offset.set((x / m) % 1, (-z / m) % 1) // komşu parçalarda desen aynı hizadan devam etsin
    t.needsUpdate = true
    return t
  }, [base, tex, w, d, round, x, z])
  return (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      {round ? <circleGeometry args={[round, 64]} /> : <planeGeometry args={[w, d]} />}
      <meshStandardMaterial color={color} map={map} roughness={0.95} />
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
function Label({ text, y, x, z, zOff = 0, focusRef, accent = '#ff8fb8' }) {
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
    <Html position={[0, y, zOff]} center distanceFactor={18} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
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
  { wall: 'brick', roofType: 'gable', win: 'arch', shutters: true, chimney: true, door: '#c46b8e' },
  { wall: 'siding', roofType: 'flat', win: 'round', flowerbox: true, door: '#3aa6a0' },
  { wall: 'mosaic', roofType: 'hip', win: 'wide', door: '#e8873a' },
  { wall: 'plaster', roofType: 'flat', win: 'rect', balcony: true, door: '#8a6bd1' },
  { wall: 'brick', roofType: 'hip', win: 'rect', shutters: true, chimney: true, door: '#5b86d6' },
  { wall: 'siding', roofType: 'gable', win: 'wide', flowerbox: true, door: '#d6577a' },
]
const lighten = (hex, t) => `#${new Color(hex).lerp(new Color('#ffffff'), t).getHexString()}`

/** Dokulu düz yüzey (duvar/çatı paneli): doku dünya ölçüsünde döşenir, renk tonu çarpılır. */
function Panel({ tex, w, h, color, position, rotation, repeat }) {
  const base = useLoader(TextureLoader, `/textures/${tex}.webp`)
  const map = useMemo(() => {
    const t = base.clone()
    t.wrapS = t.wrapT = RepeatWrapping
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 8
    const m = WALL_TEX[tex] ?? 2.4
    t.repeat.set(repeat?.[0] ?? w / m, repeat?.[1] ?? h / m)
    t.needsUpdate = true
    return t
  }, [base, tex, w, h, repeat])
  return (
    <mesh position={position} rotation={rotation} receiveShadow>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial color={color} map={map} roughness={0.7} />
    </mesh>
  )
}

function Roof({ w, d, h, color, type }) {
  const tint = lighten(color, 0.35)
  const shingle = useLoader(TextureLoader, '/textures/shingle.webp')
  const map = useMemo(() => {
    const t = shingle.clone()
    t.wrapS = t.wrapT = RepeatWrapping
    t.colorSpace = SRGBColorSpace
    t.repeat.set(3, 2)
    t.needsUpdate = true
    return t
  }, [shingle])
  const mat = <meshStandardMaterial color={color} map={map} roughness={0.55} />
  if (type === 'gable') {
    const R = (d + 0.8) / 1.732
    return (
      <mesh position={[0, h + 0.5 + R * 0.2, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.4, 1, 1]} castShadow>
        <cylinderGeometry args={[R, R, w + 0.8, 3, 1, false, Math.PI / 2]} />
        {mat}
      </mesh>
    )
  }
  if (type === 'hip') {
    return (
      <mesh position={[0, h + 0.5 + 1.1, 0]} rotation={[0, Math.PI / 4, 0]} scale={[(w + 0.8) / 1.414, 1, (d + 0.8) / 1.414]} castShadow>
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
              <meshStandardMaterial color={fx === 0 ? '#ffd35e' : '#ff7eb3'} roughness={0.6} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  )
}

function Building({ b, i, focusRef }) {
  const { w, d, h, color, roof, facing, label, shop, neon } = b
  const st = neon ? { ...STYLES[3], balcony: false } : STYLES[(i * 5 + (i >> 2)) % STYLES.length]
  const roofType = h > 8 || neon ? 'flat' : st.roofType
  const count = Math.max(1, Math.floor(w / 3))
  const winY = Math.min(3.4, h - 0.9)
  const rows = h > 8 ? [winY, winY + 2.6, winY + 5.2].filter((y) => y < h - 0.8) : [winY]
  const wallColor = lighten(color, st.wall === 'brick' ? 0.62 : 0.45)
  const ww = Math.min(1.5, w / count - 0.8)
  return (
    <group position={[b.x, 0, b.z]} rotation={[0, FACING[facing], 0]}>
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

      {/* kapı */}
      <RoundedBox args={[1.9, 2.5, 0.2]} radius={0.08} position={[0, 1.25, d / 2 + 0.05]}>
        <meshStandardMaterial color="#fffaf2" roughness={0.5} />
      </RoundedBox>
      <mesh position={[0, 1.2, d / 2 + 0.17]}>
        <boxGeometry args={[1.5, 2.1, 0.05]} />
        <meshStandardMaterial color={st.door} roughness={0.4} />
      </mesh>
      <mesh position={[0.5, 1.15, d / 2 + 0.21]}>
        <circleGeometry args={[0.07, 12]} />
        <meshStandardMaterial color="#ffd35e" roughness={0.3} />
      </mesh>

      {/* pencereler */}
      {rows.map((y, ri) =>
        Array.from({ length: count }, (_, ci) => (
          <Window key={`${y}-${ci}`} kind={st.win} x={(ci - (count - 1) / 2) * (w / count)} y={y} z={d / 2 + 0.06} w={st.win === 'wide' ? Math.min(2.0, w / count - 0.6) : ww} accent={roof} shutters={st.shutters && ri === 0} flowerbox={st.flowerbox && ri === 0} />
        )),
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
      {shop && (
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

function Gazebo() {
  const posts = Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2)
  return (
    <group position={[GAZEBO.x, 0, GAZEBO.z]}>
      <mesh position={[0, 0.15, 0]} receiveShadow>
        <cylinderGeometry args={[3.2, 3.3, 0.3, 32]} />
        <meshStandardMaterial color="#ffe3ef" roughness={0.6} />
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
const ISLAND = 50 // çim yarıçapı; ardından RIM m'lik kum şeridi, sonra deniz
const RIM = 3.5
const WATER_COLOR = new Color('#a6e6f5')
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
  const edge = ISLAND + RIM
  // kıyıya vuran dalgalar: her kenarda 3 bant, aynı döngüde faz farklı; açıktan kıyıya yürür, kıyıda sönüp kaybolur
  const WAVES = 3
  const CYCLE = 6.5 // sn
  const TRAVEL = 6 // m
  const sides = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ] // kenar normalleri (açık denize doğru)
  const bands = useRef([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    bands.current.forEach((m, i) => {
      if (!m) return
      const side = sides[Math.floor(i / WAVES)]
      const k = i % WAVES
      const ph = ((t / CYCLE + k / WAVES) % 1) // 0 = açıkta, 1 = kıyıda
      const dist = (1 - ph) * TRAVEL + 0.4
      const len = edge * 2 + 4
      m.position.set(side[0] * (edge + dist) + (side[0] ? 0 : 0), -0.025, side[1] * (edge + dist))
      m.scale.set(side[0] ? 1 : 1, 1, 1)
      const env = Math.sin(ph * Math.PI) // belirir, kıyıda yok olur
      m.material.opacity = 0.5 * env * env + (ph > 0.85 ? 0.12 * (1 - (ph - 0.85) / 0.15) : 0)
      m.userData.len = len
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
      {sides.flatMap(([nx], si) =>
        Array.from({ length: WAVES }, (_, k) => {
          const i = si * WAVES + k
          return (
            <mesh key={i} ref={(m) => (bands.current[i] = m)} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={nx ? [1.6, edge * 2 + 4] : [edge * 2 + 4, 1.6]} />
              <meshBasicMaterial map={ring} alphaMap={fade} transparent opacity={0} depthWrite={false} />
            </mesh>
          )
        }),
      )}
    </group>
  )
}

const DASHES = Array.from({ length: 23 }, (_, i) => -44 + i * 4).filter((t) => Math.abs(t) > 12.5)
const PARK_X = -12 // batıya doğru asfalt biter; parkta patika başlar

export default function City({ focusRef }) {
  const road = ROAD_HALF * 2
  return (
    <group>
      <Sun focusRef={focusRef} />

      {/* zemin ve mahalle zeminleri */}
      <Sea />
      <Flat w={ISLAND * 2} d={ISLAND * 2} y={0} tex="grass" /> {/* ada */}
      {/* kıyı kumu: adanın dört kenarında */}
      <Flat x={0} z={-ISLAND - RIM / 2} w={ISLAND * 2 + RIM * 2} d={RIM} y={Y.floor} tex="sand" />
      <Flat x={0} z={ISLAND + RIM / 2} w={ISLAND * 2 + RIM * 2} d={RIM} y={Y.floor} tex="sand" />
      <Flat x={-ISLAND - RIM / 2} z={0} w={RIM} d={ISLAND * 2} y={Y.floor} tex="sand" />
      <Flat x={ISLAND + RIM / 2} z={0} w={RIM} d={ISLAND * 2} y={Y.floor} tex="sand" />
      <Flat x={0} z={-30} w={28} d={36} y={Y.floor} tex="cobble" color="#fff3ea" /> {/* kafe: sıcak kaldırım taşı */}
      <Flat x={30} z={0} w={36} d={28} y={Y.floor} tex="cobble" color="#e3d6ff" /> {/* kulüp */}
      <Flat x={-30} z={0} w={36} d={28} y={Y.floor} tex="grass" color="#f4fff6" /> {/* park çimi */}
      <Flat x={0} z={38.5} w={28} d={17} y={Y.floor} tex="sand" /> {/* plaj kumu */}
      <Flat x={0} z={48.5} w={100} d={3} y={Y.floor} tex="sand" />
      <mesh position={[-33, 0.04, -6]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.6, 40]} />
        <meshStandardMaterial color="#a9ddf5" roughness={0.15} />
      </mesh>

      {/* kaldırım + yollar */}
      <Flat x={0} w={road + 2.8} d={96} y={Y.sidewalk} tex="cobble" color="#fdf6ff" />
      <Flat x={(PARK_X + 48) / 2} z={0} w={48 - PARK_X} d={road + 2.8} y={Y.sidewalk} tex="cobble" color="#fdf6ff" />
      <Flat x={-19} z={0} w={14} d={3.4} y={Y.sidewalk} tex="cobble" color="#fff0f4" /> {/* park patikası: lobiden çardağa */}
      <Flat x={0} w={road} d={96} y={Y.road} tex="asphalt" />
      <Flat x={(PARK_X + 48) / 2} z={0} w={48 - PARK_X} d={road} y={Y.road} tex="asphalt" />
      {DASHES.map((t) => (
        <group key={t}>
          <Flat x={0} z={t} w={0.28} d={1.8} y={Y.mark} color="#ffffff" />
          {t > PARK_X && <Flat x={t} z={0} w={1.8} d={0.28} y={Y.mark} color="#ffffff" />}
        </group>
      ))}

      {/* lobi meydanı */}
      <Flat round={12} y={Y.plaza} tex="cobble" color="#ffeef6" />
      <Ring r0={6.6} r1={7.1} y={Y.mark} color="#ffd3e6" />
      <Ring r0={9.6} r1={10.2} y={Y.mark} color="#cfeaff" />
      <Flat round={3.4} y={Y.mark} color="#ffd3e6" />
      <Gazebo />

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
