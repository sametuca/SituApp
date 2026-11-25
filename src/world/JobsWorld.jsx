// Mesleklerin şehirdeki sahneleri: balıkçı iskeleleri (güney kıyısı), Posta Merkezi (park) ve teslimat kapısı ışıkları.
// Hepsi pastel/oyuncak tarzı, küçük ilkellerden kurulu (Meshy GLB üretildiğinde Pier/PostCenter içi değiştirilebilir).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { CanvasTexture, Color, DoubleSide, Object3D, SRGBColorSpace } from 'three'
import { FISH_CAST_DIST, FISH_SPOTS, POST_CENTER } from './jobsData'
import { VENUE_DOORS } from './venueDoors'
import { Parcel } from './WorkProp'
import { work } from './features/jobStore'

function signTexture(text, bg, fg, emoji) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const g = c.getContext('2d')
  g.fillStyle = bg
  g.fillRect(0, 0, 512, 256)
  g.strokeStyle = 'rgba(255,255,255,0.85)'
  g.lineWidth = 14
  g.strokeRect(14, 14, 484, 228)
  g.fillStyle = fg
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '900 96px Nunito, system-ui, sans-serif'
  g.fillText(text, 290, 138)
  g.font = '110px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif'
  g.fillText(emoji, 98, 132)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

// ---------- balıkçı iskeleleri ----------
const PLANKS = 12
function Piers() {
  const planks = useRef()
  const posts = useRef()
  const dummy = useMemo(() => new Object3D(), [])
  const tex = useMemo(() => signTexture('BALIK', '#7fb9e8', '#ffffff', '🎣'), [])
  const rings = useRef([])
  useEffect(() => () => tex.dispose(), [tex])
  useLayoutEffect(() => {
    let i = 0
    for (const s of FISH_SPOTS) {
      for (let k = 0; k < PLANKS; k++) {
        dummy.position.set(s.x, -0.01, s.z - 1.2 + k * 0.45)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        planks.current.setMatrixAt(i++, dummy.matrix)
      }
    }
    planks.current.instanceMatrix.needsUpdate = true
    i = 0
    for (const s of FISH_SPOTS) {
      for (const sx of [-0.95, 0.95]) {
        for (const dz of [-1.1, 1.4, 3.7]) {
          dummy.position.set(s.x + sx, 0.38, s.z + dz)
          dummy.updateMatrix()
          posts.current.setMatrixAt(i++, dummy.matrix)
        }
      }
    }
    posts.current.instanceMatrix.needsUpdate = true
  }, [dummy])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    rings.current.forEach((m, i) => {
      if (!m) return
      const ph = (t * 0.45 + (i % 3) / 3 + Math.floor(i / 3) * 0.17) % 1
      m.scale.setScalar(0.25 + ph * 0.8)
      m.material.opacity = (1 - ph) * 0.35
    })
  })

  return (
    <group>
      <instancedMesh ref={planks} args={[null, null, FISH_SPOTS.length * PLANKS]} castShadow receiveShadow>
        <boxGeometry args={[1.9, 0.12, 0.4]} />
        <meshStandardMaterial color="#e2b98a" roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={posts} args={[null, null, FISH_SPOTS.length * 6]} castShadow>
        <cylinderGeometry args={[0.075, 0.09, 0.8, 8]} />
        <meshStandardMaterial color="#b98a5e" roughness={0.85} />
      </instancedMesh>
      {FISH_SPOTS.map((s, si) => (
        <group key={s.id} position={[s.x, 0, s.z]}>
          {/* iskele sonundaki fener direği */}
          <mesh position={[0.95, 1.05, 3.7]}>
            <sphereGeometry args={[0.13, 12, 10]} />
            <meshStandardMaterial color="#ffe9b0" emissive="#ffd27a" emissiveIntensity={0.9} roughness={0.4} />
          </mesh>
          <mesh position={[0.95, 0.85, 3.7]}>
            <cylinderGeometry args={[0.035, 0.035, 0.6, 6]} />
            <meshStandardMaterial color="#b98a5e" roughness={0.8} />
          </mesh>
          {/* tabela */}
          <group position={[1.55, 0, -1.4]} rotation={[0, -0.25, 0]}>
            <mesh position={[0, 0.7, 0]}>
              <cylinderGeometry args={[0.05, 0.06, 1.4, 6]} />
              <meshStandardMaterial color="#b98a5e" roughness={0.85} />
            </mesh>
            <mesh position={[0, 1.35, 0.06]} castShadow>
              <boxGeometry args={[0.95, 0.5, 0.06]} />
              <meshStandardMaterial map={tex} roughness={0.6} />
            </mesh>
          </group>
          {/* balık olduğunu fısıldayan dalgacıklar (denizde hedef noktada) */}
          {[0, 1, 2].map((k) => (
            <mesh key={k} ref={(m) => (rings.current[si * 3 + k] = m)} position={[0, -0.03, FISH_CAST_DIST]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.85, 1, 28]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.3} depthWrite={false} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

// ---------- Posta Merkezi ----------
function PostCenter() {
  const tex = useMemo(() => signTexture('POSTA', '#ff9f43', '#ffffff', '📮'), [])
  const arrow = useRef()
  const flag = useRef()
  useEffect(() => () => tex.dispose(), [tex])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (arrow.current) {
      arrow.current.position.y = 4.9 + Math.sin(t * 2.4) * 0.18
      arrow.current.rotation.y = t * 1.4
    }
    if (flag.current) flag.current.rotation.z = Math.sin(t * 4) * 0.12
  })
  return (
    <group position={[POST_CENTER.x, 0, POST_CENTER.z]} rotation={[0, POST_CENTER.ry, 0]}>
      {/* gövde */}
      <RoundedBox args={[3.4, 2.2, 2.6]} radius={0.18} smoothness={3} position={[0, 1.1, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#fff1da" roughness={0.75} />
      </RoundedBox>
      {/* çatı */}
      <mesh position={[0, 2.75, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1.05, 1, 0.82]} castShadow>
        <coneGeometry args={[2.35, 1.2, 4]} />
        <meshStandardMaterial color="#ff9f43" roughness={0.65} />
      </mesh>
      {/* ön tezgâh penceresi */}
      <mesh position={[0, 1.15, 1.32]}>
        <boxGeometry args={[1.9, 0.95, 0.06]} />
        <meshStandardMaterial color="#4a6b8a" roughness={0.3} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.66, 1.5]} castShadow>
        <boxGeometry args={[2.2, 0.16, 0.5]} />
        <meshStandardMaterial color="#e2b98a" roughness={0.8} />
      </mesh>
      {/* çizgili tente */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[-1.1 + i * 0.44, 1.92, 1.58]} rotation={[0.5, 0, 0]} castShadow>
          <boxGeometry args={[0.44, 0.06, 0.8]} />
          <meshStandardMaterial color={i % 2 ? '#fff6e8' : '#ff9f43'} roughness={0.7} />
        </mesh>
      ))}
      {/* tabela */}
      <mesh position={[0, 2.38, 1.34]}>
        <boxGeometry args={[1.7, 0.55, 0.07]} />
        <meshStandardMaterial map={tex} roughness={0.6} />
      </mesh>
      {/* posta kutusu */}
      <group position={[2.35, 0, 0.9]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <cylinderGeometry args={[0.36, 0.38, 1.1, 14]} />
          <meshStandardMaterial color="#6fb3e6" roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.1, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.36, 0.36, 0.76, 14, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color="#6fb3e6" roughness={0.5} side={DoubleSide} />
        </mesh>
        <mesh position={[0, 0.9, 0.37]}>
          <boxGeometry args={[0.34, 0.06, 0.03]} />
          <meshStandardMaterial color="#1f3550" />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.4, 0.4, 0.14, 14]} />
          <meshStandardMaterial color="#4f93c9" roughness={0.5} />
        </mesh>
      </group>
      {/* paket yığını */}
      <group position={[-2.3, 0, 0.8]}>
        <mesh position={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[0.7, 0.4, 0.6]} />
          <meshStandardMaterial color="#e8c99a" roughness={0.7} />
        </mesh>
        <mesh position={[0.05, 0.55, 0.02]} rotation={[0, 0.3, 0]} castShadow>
          <boxGeometry args={[0.5, 0.3, 0.45]} />
          <meshStandardMaterial color="#cdbbff" roughness={0.7} />
        </mesh>
        <mesh position={[-0.9, 0.17, 0.3]} rotation={[0, -0.4, 0]} castShadow>
          <boxGeometry args={[0.45, 0.34, 0.4]} />
          <meshStandardMaterial color="#ffd0e0" roughness={0.7} />
        </mesh>
      </group>
      {/* bayrak */}
      <group position={[-1.55, 3.3, -0.9]}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 1.3, 6]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh ref={flag} position={[0.28, 0.95, 0]}>
          <boxGeometry args={[0.5, 0.3, 0.02]} />
          <meshStandardMaterial color="#ff6f61" roughness={0.6} />
        </mesh>
      </group>
      {/* uzaktan görünen işaret oku */}
      <mesh ref={arrow} position={[0, 4.9, 0.4]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.32, 0.6, 4]} />
        <meshStandardMaterial color="#ff9f43" emissive="#ff9f43" emissiveIntensity={0.5} roughness={0.5} />
      </mesh>
    </group>
  )
}

// ---------- teslimat kapısı ışıkları ----------
function Beacon({ parcel }) {
  const door = VENUE_DOORS[parcel.to]
  const pillar = useRef()
  const ring = useRef()
  const float = useRef()
  const col = useMemo(() => new Color('#ffb04d'), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (pillar.current) pillar.current.material.opacity = 0.2 + Math.sin(t * 2.2) * 0.06
    if (ring.current) {
      const ph = (t * 0.9) % 1
      ring.current.scale.setScalar(0.6 + ph * 1.1)
      ring.current.material.opacity = (1 - ph) * 0.7
    }
    if (float.current) {
      float.current.position.y = 2.9 + Math.sin(t * 2.6) * 0.18
      float.current.rotation.y = t * 1.6
    }
  })
  if (!door) return null
  return (
    <group position={[door.x, 0, door.z]}>
      <mesh ref={pillar} position={[0, 7, 0]}>
        <cylinderGeometry args={[0.55, 0.9, 14, 20, 1, true]} />
        <meshBasicMaterial color={col} transparent opacity={0.22} depthWrite={false} side={DoubleSide} />
      </mesh>
      <mesh ref={ring} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.1, 36]} />
        <meshBasicMaterial color="#fff3c4" transparent opacity={0.6} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.05, 28]} />
        <meshBasicMaterial color="#ffb04d" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <group ref={float} position={[0, 2.9, 0]} scale={1.7}>
        <Parcel kind={parcel.kind} />
      </group>
    </group>
  )
}

function Beacons() {
  const [list, setList] = useState(work.parcels)
  useEffect(() => work.subscribe(() => setList([...work.parcels])), [])
  return list.map((p) => <Beacon key={p.id} parcel={p} />)
}

export default function JobsWorld({ where }) {
  if (where !== 'city') return null
  return (
    <>
      <Piers />
      <PostCenter />
      <Beacons />
    </>
  )
}
