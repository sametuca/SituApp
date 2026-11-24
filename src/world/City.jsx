import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import { BLANKETS, BUILDINGS, GAZEBO, PROPS, ROAD_HALF } from './layout'
import Prop from './Prop'
import { Em } from '../components/emoji'
import { SKY_MATS, skyLive } from './Sky'

const FACING = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }

// katman yükseklikleri (z-fighting olmasın)
const Y = { floor: 0.02, sidewalk: 0.04, road: 0.06, plaza: 0.08, mark: 0.1 }

function Flat({ x = 0, z = 0, w, d, y, color, round }) {
  return (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      {round ? <circleGeometry args={[round, 64]} /> : <planeGeometry args={[w, d]} />}
      <meshStandardMaterial color={color} roughness={0.95} />
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
    setMode(dist > LABEL_RANGE || camDist < 12 ? 0 : dist > LABEL_NAME_RANGE ? 1 : 2)
  })
  if (mode === 0) return null
  const { icon, name } = splitLabel(text)
  return (
    <Html position={[0, y, zOff]} center distanceFactor={22} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
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

function Building({ b, focusRef }) {
  const { w, d, h, color, roof, facing, label, shop, neon } = b
  const count = Math.max(1, Math.floor(w / 3))
  const winY = Math.min(3.4, h - 0.9)
  const rows = h > 8 ? [winY, winY + 2.6, winY + 5.2].filter((y) => y < h - 0.8) : [winY]
  return (
    <group position={[b.x, 0, b.z]} rotation={[0, FACING[facing], 0]}>
      <RoundedBox args={[w, h, d]} radius={0.35} smoothness={3} position={[0, h / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.55} />
      </RoundedBox>
      <RoundedBox args={[w + 0.7, 0.7, d + 0.7]} radius={0.3} smoothness={3} position={[0, h + 0.15, 0]} castShadow>
        <meshStandardMaterial color={roof} roughness={0.5} />
      </RoundedBox>

      {/* kapı */}
      <RoundedBox args={[1.9, 2.5, 0.2]} radius={0.08} position={[0, 1.25, d / 2 + 0.05]}>
        <meshStandardMaterial color="#fffaf2" roughness={0.5} />
      </RoundedBox>
      <mesh position={[0, 1.2, d / 2 + 0.17]}>
        <boxGeometry args={[1.5, 2.1, 0.05]} />
        <meshStandardMaterial color="#8a6bd1" roughness={0.4} />
      </mesh>

      {/* pencereler */}
      {rows.map((y) =>
        Array.from({ length: count }, (_, i) => {
          const x = (i - (count - 1) / 2) * (w / count)
          return (
            <mesh key={`${y}-${i}`} position={[x, y, d / 2 + 0.06]}>
              <boxGeometry args={[Math.min(1.5, w / count - 0.8), 1.1, 0.12]} />
              <primitive object={SKY_MATS.window} attach="material" />
            </mesh>
          )
        }),
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
  return <Prop model="/models/venues/picnic-blanket.glb" x={b.x} z={b.z} scale={2.7} ry={b.ry} />
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

const DASHES = Array.from({ length: 23 }, (_, i) => -44 + i * 4).filter((t) => Math.abs(t) > 12.5)

export default function City({ focusRef }) {
  const road = ROAD_HALF * 2
  return (
    <group>
      <Sun focusRef={focusRef} />

      {/* zemin ve mahalle zeminleri */}
      <Flat w={180} d={180} y={0} color="#d4f3dc" />
      <Flat x={0} z={-30} w={28} d={36} y={Y.floor} color="#ffeadb" /> {/* kafe: sıcak kaldırım taşı */}
      <Flat x={30} z={0} w={36} d={28} y={Y.floor} color="#e6dcff" /> {/* kulüp */}
      <Flat x={-30} z={0} w={36} d={28} y={Y.floor} color="#bdeccb" /> {/* park çimi */}
      <Flat x={0} z={38.5} w={28} d={17} y={Y.floor} color="#ffe9b8" /> {/* plaj kumu */}
      <Flat x={0} z={46} w={92} d={3} y={Y.floor} color="#ffe9b8" />
      <Flat x={0} z={70} w={200} d={48} y={0.03} color="#9fd8f5" /> {/* deniz */}
      <Flat x={0} z={46.4} w={200} d={0.8} y={0.035} color="#e8f7ff" /> {/* köpük */}
      <mesh position={[-33, 0.04, -6]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.6, 40]} />
        <meshStandardMaterial color="#a9ddf5" roughness={0.15} />
      </mesh>

      {/* kaldırım + yollar */}
      <Flat x={0} w={road + 2.8} d={96} y={Y.sidewalk} color="#f7f0fb" />
      <Flat z={0} w={96} d={road + 2.8} y={Y.sidewalk} color="#f7f0fb" />
      <Flat x={0} w={road} d={96} y={Y.road} color="#e4d9f2" />
      <Flat z={0} w={96} d={road} y={Y.road} color="#e4d9f2" />
      {DASHES.map((t) => (
        <group key={t}>
          <Flat x={0} z={t} w={0.28} d={1.8} y={Y.mark} color="#ffffff" />
          <Flat x={t} z={0} w={1.8} d={0.28} y={Y.mark} color="#ffffff" />
        </group>
      ))}

      {/* lobi meydanı */}
      <Flat round={12} y={Y.plaza} color="#fff3f8" />
      <Ring r0={6.6} r1={7.1} y={Y.mark} color="#ffd3e6" />
      <Ring r0={9.6} r1={10.2} y={Y.mark} color="#cfeaff" />
      <Flat round={3.4} y={Y.mark} color="#ffd3e6" />
      <Gazebo />

      {BUILDINGS.filter((b) => !b.gazebo).map((b, i) => (
        <Building key={i} b={b} focusRef={focusRef} />
      ))}
      {PROPS.map((p, i) => (
        <Prop key={i} {...p} />
      ))}
      {BLANKETS.map((b, i) => (
        <Blanket key={i} b={b} />
      ))}
    </group>
  )
}
