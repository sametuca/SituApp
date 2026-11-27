// Sahil Partisi (Beach Party): plajda doğan oyuncuları ilk anda karşılayan müzikli, ışıklı, danslı sahil sahnesi.
// Öne çıkan 3D objeler mevcut Meshy GLB modelleridir (dj-stand, club-speaker, club-ball, surfboard-a/b).
import { Suspense, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox, useGLTF } from '@react-three/drei'
import { Box3, Color, Vector3 } from 'three'
import { BEACH_PARTY } from './layout'
import { screenK } from './screenK'

const TILE_COLORS = ['#fdb252', '#ff8fb8', '#7fcdf3', '#8fdcb4', '#b79cff', '#ffd35e']
const BULB_COLORS = ['#ffd35e', '#ff8fb8', '#7fcdf3', '#8fdcb4', '#fdb252', '#b79cff']

function GlbProp({ url, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1, spin = 0, pulse = false }) {
  const { scene } = useGLTF(url)
  const ref = useRef()
  const { obj, baseScale } = useMemo(() => {
    const clone = scene.clone(true)
    const box = new Box3().setFromObject(clone)
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    clone.position.set(-center.x, -box.min.y, -center.z)
    clone.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    return { obj: clone, baseScale: scale / maxDim }
  }, [scene, scale])

  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const t = clock.elapsedTime
    if (spin) g.rotation.y = rotation[1] + t * spin
    if (pulse) {
      const beat = 1 + Math.pow(Math.max(0, Math.sin(t * 6.4)), 4) * 0.06
      g.scale.set(baseScale * beat, baseScale * beat, baseScale * beat)
    }
  })

  return (
    <group ref={ref} position={position} rotation={rotation} scale={baseScale}>
      <primitive object={obj} />
    </group>
  )
}

function DanceFloor() {
  const mats = useRef([])
  const tiles = useMemo(() => {
    const out = []
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        out.push({
          x: (c - 1.5) * 1.05,
          z: (r - 1) * 1.05,
          idx: r * 4 + c,
          color: TILE_COLORS[(r * 4 + c) % TILE_COLORS.length],
        })
      }
    }
    return out
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 2.8
    for (let i = 0; i < tiles.length; i++) {
      const m = mats.current[i]
      if (!m) continue
      const wave = 0.5 + 0.5 * Math.sin(t + i * 0.75)
      m.emissiveIntensity = 0.25 + wave * 0.55
    }
  })

  return (
    <group position={[0, 0.06, 2.55]}>
      {/* Ahşap sahil pisti tabanı */}
      <RoundedBox args={[4.6, 0.1, 3.5]} radius={0.04} smoothness={2} receiveShadow>
        <meshStandardMaterial color="#f5dec0" roughness={0.75} />
      </RoundedBox>
      {/* Işıklı pastel dans karoları */}
      {tiles.map((tl, i) => (
        <mesh key={tl.idx} position={[tl.x, 0.056, tl.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.92, 0.92]} />
          <meshStandardMaterial
            ref={(el) => (mats.current[i] = el)}
            color={tl.color}
            emissive={tl.color}
            emissiveIntensity={0.45}
            roughness={0.35}
          />
        </mesh>
      ))}
    </group>
  )
}

function PartyConfetti() {
  const refs = useRef([])
  const bits = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        x: ((i * 1.37) % 4.6) - 2.3,
        z: 0.6 + ((i * 1.91) % 3.6),
        y0: 1.0 + (i % 4) * 0.45,
        sp: 0.45 + (i % 5) * 0.14,
        ph: i * 0.85,
        c: TILE_COLORS[i % TILE_COLORS.length],
      })),
    [],
  )

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    for (let i = 0; i < bits.length; i++) {
      const m = refs.current[i]
      if (!m) continue
      const b = bits[i]
      const cyc = ((t * b.sp + b.ph) % 2.4) / 2.4
      m.position.set(b.x + Math.sin(t * 2 + b.ph) * 0.18, b.y0 + cyc * 2.1, b.z + Math.cos(t * 1.6 + b.ph) * 0.15)
      m.rotation.set(t * 2 + b.ph, t * 1.5, 0)
      const fade = cyc < 0.2 ? cyc / 0.2 : cyc > 0.8 ? (1 - cyc) / 0.2 : 1
      m.scale.setScalar(0.08 * fade)
    }
  })

  return (
    <group>
      {bits.map((b, i) => (
        <mesh key={i} ref={(el) => (refs.current[i] = el)}>
          <boxGeometry args={[1, 1, 0.25]} />
          <meshStandardMaterial color={b.c} emissive={b.c} emissiveIntensity={0.5} roughness={0.35} />
        </mesh>
      ))}
    </group>
  )
}

function StringLights() {
  const bulbs = useMemo(() => {
    const out = []
    for (let i = 0; i < 9; i++) {
      const u = i / 8
      const x = (u - 0.5) * 4.8
      const sag = Math.sin(u * Math.PI) * 0.35
      out.push({ x, y: 3.45 - sag, c: BULB_COLORS[i % BULB_COLORS.length] })
    }
    return out
  }, [])
  return (
    <group position={[0, 0, 0.3]}>
      {bulbs.map((b, i) => (
        <mesh key={i} position={[b.x, b.y, 0]}>
          <sphereGeometry args={[0.11, 10, 8]} />
          <meshStandardMaterial color={b.c} emissive={b.c} emissiveIntensity={1.1} roughness={0.2} />
        </mesh>
      ))}
    </group>
  )
}

export default function BeachParty() {
  const spotRef = useRef()
  useFrame(({ clock }) => {
    if (!spotRef.current) return
    const h = (clock.elapsedTime * 0.08) % 1
    spotRef.current.color.setHSL(h, 0.75, 0.72)
  })

  return (
    <group position={[BEACH_PARTY.x, 0, BEACH_PARTY.z]} rotation={[0, BEACH_PARTY.ry, 0]}>
      {/* Yükseltilmiş pastel sahne platformu */}
      <RoundedBox args={[4.8, 0.36, 2.2]} radius={0.12} smoothness={2} position={[0, 0.18, -0.3]} castShadow receiveShadow>
        <meshStandardMaterial color="#fff3dc" roughness={0.65} />
      </RoundedBox>
      {/* Sahne ön ışık şeridi */}
      <mesh position={[0, 0.22, 0.81]}>
        <boxGeometry args={[4.4, 0.1, 0.04]} />
        <meshStandardMaterial color="#fdb252" emissive="#fdb252" emissiveIntensity={0.85} />
      </mesh>

      {/* Bambu / ahşap parti kemeri */}
      {[-2.3, 2.3].map((px) => (
        <mesh key={px} position={[px, 1.85, 0.3]} castShadow>
          <cylinderGeometry args={[0.11, 0.14, 3.7, 10]} />
          <meshStandardMaterial color="#e6b88a" roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 3.65, 0.3]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 4.85, 10]} />
        <meshStandardMaterial color="#e6b88a" roughness={0.7} />
      </mesh>
      <StringLights />

      {/* Meshy 3D Parti Objeleri */}
      <Suspense fallback={null}>
        <GlbProp url="/models/venues/dj-stand.glb" position={[0, 0.36, -0.15]} scale={2.1} />
        <GlbProp url="/models/club/club-speaker.glb" position={[-1.85, 0.36, 0.05]} rotation={[0, 0.25, 0]} scale={1.7} pulse />
        <GlbProp url="/models/club/club-speaker.glb" position={[1.85, 0.36, 0.05]} rotation={[0, -0.25, 0]} scale={1.7} pulse />
        <GlbProp url="/models/club/club-ball.glb" position={[0, 2.85, 1.4]} scale={0.95} spin={0.85} />
        <GlbProp url="/models/venues/surfboard-a.glb" position={[-2.65, 0, 0.2]} rotation={[0, 0.4, 0.12]} scale={2.1} />
        <GlbProp url="/models/venues/surfboard-b.glb" position={[2.65, 0, 0.2]} rotation={[0, -0.4, -0.12]} scale={2.1} />
      </Suspense>

      {/* Renkli dans pisti + yüzen konfeti + sahne ışığı */}
      <DanceFloor />
      <PartyConfetti />
      <pointLight ref={spotRef} position={[0, 3.2, 1.8]} color={new Color('#ffd35e')} intensity={4.5} distance={13} decay={2} />

      {/* Üst parti tabelası */}
      <Html position={[0, 4.15, 0.3]} center distanceFactor={14 * screenK()} zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
        <div className="inline-flex w-max items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-white bg-gradient-to-r from-[#fdb252] via-[#ff8fb8] to-[#a88bff] px-4 py-1 text-xs font-black tracking-wide text-white shadow-toy">
          🌴 BEACH PARTY 🪩
        </div>
      </Html>
    </group>
  )
}
