import { useRef, useSyncExternalStore } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils } from 'three'
import { cosStore } from './cosStore'

// Evcil hayvanlar: pastel, yuvarlak, procedural (three.js ilkelleri). Model +z'ye bakar, yaklaşık 0,45 m boyunda.
// Sunucu trafiği yok: konum, sahibin konumundan (yerel: focusRef, uzak: remotes) istemcide türetilir.

const Eye = ({ x, y, z, r = 0.025 }) => (
  <mesh position={[x, y, z]}>
    <sphereGeometry args={[r, 10, 10]} />
    <meshStandardMaterial color="#4a3b5c" roughness={0.3} />
  </mesh>
)
const Blush = ({ x, y, z }) => (
  <mesh position={[x, y, z]} scale={[1, 0.6, 0.4]}>
    <sphereGeometry args={[0.03, 10, 10]} />
    <meshStandardMaterial color="#ff9ec0" roughness={0.8} />
  </mesh>
)
const M = ({ color }) => <meshStandardMaterial color={color} roughness={0.7} />

function Cat() {
  const fur = '#ffd2a8'
  return (
    <group>
      <mesh position={[0, 0.2, -0.02]} scale={[1, 0.9, 1.15]} castShadow>
        <sphereGeometry args={[0.19, 20, 16]} />
        <M color={fur} />
      </mesh>
      <mesh position={[0, 0.38, 0.12]} castShadow>
        <sphereGeometry args={[0.16, 20, 16]} />
        <M color={fur} />
      </mesh>
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.1, 0.52, 0.1]} rotation={[0, 0, -s * 0.25]}>
          <mesh>
            <coneGeometry args={[0.06, 0.13, 4]} />
            <M color={fur} />
          </mesh>
          <mesh position={[0, -0.01, 0.02]} scale={[0.6, 0.7, 0.5]}>
            <coneGeometry args={[0.05, 0.12, 4]} />
            <M color="#ffb3cd" />
          </mesh>
        </group>
      ))}
      <Eye x={0.06} y={0.4} z={0.265} />
      <Eye x={-0.06} y={0.4} z={0.265} />
      <mesh position={[0, 0.355, 0.275]}>
        <sphereGeometry args={[0.018, 8, 8]} />
        <M color="#ff8fb5" />
      </mesh>
      <Blush x={0.1} y={0.355} z={0.24} />
      <Blush x={-0.1} y={0.355} z={0.24} />
      {/* kuyruk */}
      <mesh position={[0, 0.27, -0.22]} rotation={[0.3, 0, 0]}>
        <torusGeometry args={[0.09, 0.03, 8, 16, Math.PI * 1.2]} />
        <M color="#ffb98c" />
      </mesh>
      {[0.08, -0.08].map((x) => (
        <mesh key={x} position={[x, 0.04, 0.08]}>
          <sphereGeometry args={[0.055, 10, 10]} />
          <M color={fur} />
        </mesh>
      ))}
    </group>
  )
}

function Bunny() {
  const fur = '#fffaf5'
  return (
    <group>
      <mesh position={[0, 0.19, -0.02]} scale={[1, 0.95, 1.1]} castShadow>
        <sphereGeometry args={[0.18, 20, 16]} />
        <M color={fur} />
      </mesh>
      <mesh position={[0, 0.37, 0.1]} castShadow>
        <sphereGeometry args={[0.15, 20, 16]} />
        <M color={fur} />
      </mesh>
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.07, 0.56, 0.06]} rotation={[-0.15, 0, -s * 0.12]}>
          <mesh>
            <capsuleGeometry args={[0.04, 0.17, 6, 12]} />
            <M color={fur} />
          </mesh>
          <mesh position={[0, 0, 0.025]} scale={[0.55, 1, 0.4]}>
            <capsuleGeometry args={[0.035, 0.15, 6, 12]} />
            <M color="#ffc4dc" />
          </mesh>
        </group>
      ))}
      <Eye x={0.055} y={0.39} z={0.235} />
      <Eye x={-0.055} y={0.39} z={0.235} />
      <mesh position={[0, 0.35, 0.248]}>
        <sphereGeometry args={[0.016, 8, 8]} />
        <M color="#ff8fb5" />
      </mesh>
      <Blush x={0.09} y={0.35} z={0.22} />
      <Blush x={-0.09} y={0.35} z={0.22} />
      <mesh position={[0, 0.2, -0.2]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <M color="#ffe3ef" />
      </mesh>
      {[0.07, -0.07].map((x) => (
        <mesh key={x} position={[x, 0.04, 0.08]}>
          <sphereGeometry args={[0.05, 10, 10]} />
          <M color={fur} />
        </mesh>
      ))}
    </group>
  )
}

function Chick() {
  const fur = '#ffe27a'
  return (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow>
        <sphereGeometry args={[0.2, 22, 18]} />
        <M color={fur} />
      </mesh>
      <mesh position={[0, 0.42, 0.04]} castShadow>
        <sphereGeometry args={[0.13, 20, 16]} />
        <M color={fur} />
      </mesh>
      <mesh position={[0, 0.405, 0.16]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.035, 0.07, 10]} />
        <M color="#ffab6b" />
      </mesh>
      <Eye x={0.055} y={0.44} z={0.14} r={0.022} />
      <Eye x={-0.055} y={0.44} z={0.14} r={0.022} />
      <Blush x={0.09} y={0.405} z={0.12} />
      <Blush x={-0.09} y={0.405} z={0.12} />
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * 0.19, 0.2, -0.02]} rotation={[0, 0, -s * 0.5]} scale={[0.5, 1, 0.8]}>
          <sphereGeometry args={[0.09, 12, 12]} />
          <M color="#ffd65c" />
        </mesh>
      ))}
      <mesh position={[0, 0.48, 0.02]}>
        <coneGeometry args={[0.03, 0.08, 6]} />
        <M color={fur} />
      </mesh>
      {[0.06, -0.06].map((x) => (
        <mesh key={x} position={[x, 0.015, 0.02]} scale={[1, 0.5, 1.4]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <M color="#ffab6b" />
        </mesh>
      ))}
    </group>
  )
}

const MODELS = { cat: Cat, bunny: Bunny, chick: Chick }

/** Hareketsiz/önizleme için evcil hayvan modeli. */
export function PetModel({ kind }) {
  const Model = MODELS[kind]
  return Model ? <Model /> : null
}

const STOP_DIST = 0.95 // sahibine bu kadar yaklaşınca durur
const GO_DIST = 1.7 // sahibi bu kadar uzaklaşınca peşinden gider
const SNAP_DIST = 9 // çok uzakta kalırsa (ışınlanma, oda değişimi) sahibinin yanına atlar

/** Sahibini yumuşakça takip eden evcil hayvan. getOwner() → { x, z } | null */
function PetFollower({ kind, getOwner }) {
  const group = useRef()
  const body = useRef()
  const st = useRef({ init: false, x: 0, z: 0, ry: 0, moving: false, phase: 0, t: Math.random() * 10 })

  useFrame((_, dtRaw) => {
    const g = group.current
    const o = getOwner()
    if (!g) return
    if (!o) {
      g.visible = false
      st.current.init = false
      return
    }
    const dt = Math.min(dtRaw, 0.1)
    const s = st.current
    if (!s.init) {
      s.init = true
      s.x = o.x + 0.8
      s.z = o.z + 0.8
    }
    let dx = o.x - s.x
    let dz = o.z - s.z
    let d = Math.hypot(dx, dz)
    if (d > SNAP_DIST) {
      s.x = o.x + 0.8
      s.z = o.z + 0.8
      dx = o.x - s.x
      dz = o.z - s.z
      d = Math.hypot(dx, dz)
    }
    s.t += dt
    if (!s.moving && d > GO_DIST) s.moving = true
    if (s.moving && d < STOP_DIST) s.moving = false

    let want = Math.atan2(dx, dz)
    if (s.moving) {
      const speed = Math.min(7.5, 2 + d * 1.5)
      const step = Math.min(speed * dt, Math.max(0, d - STOP_DIST * 0.9))
      s.x += (dx / d) * step
      s.z += (dz / d) * step
      s.phase += dt * 13
    } else if (d < 0.3) {
      want = s.ry // sahibinin tam üstündeyse dönme
    }
    s.ry += (MathUtils.euclideanModulo(want - s.ry + Math.PI, Math.PI * 2) - Math.PI) * Math.min(1, dt * (s.moving ? 10 : 3))

    g.visible = true
    g.position.set(s.x, 0, s.z)
    g.rotation.y = s.ry
    const b = body.current
    if (b) {
      if (s.moving) {
        b.position.y = Math.abs(Math.sin(s.phase)) * 0.14
        b.rotation.x = Math.sin(s.phase) * 0.1
        b.rotation.z = 0
        b.scale.set(1, 1, 1)
      } else {
        // dururken: nefes alır, hafifçe sallanır, ara sıra küçük bir zıplama yapar
        const hop = Math.max(0, Math.sin(s.t * 1.1)) ** 24 * 0.12
        b.position.y = hop
        b.rotation.x = 0
        b.rotation.z = Math.sin(s.t * 2.2) * 0.05
        const br = 1 + Math.sin(s.t * 3) * 0.02
        b.scale.set(1, br, 1)
      }
    }
  })

  return (
    <group ref={group} visible={false}>
      <group ref={body}>
        <PetModel kind={kind} />
      </group>
      {/* yumuşak gölge lekesi */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.22, 20]} />
        <meshBasicMaterial color="#8a6bd1" transparent opacity={0.16} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** Odadaki herkesin (ve kendimin) evcil hayvanlarını çizer. Canvas içinde, bir kez render edilir. */
export function PetLayer({ focusRef, remotes }) {
  useSyncExternalStore(cosStore.subscribe, cosStore.version)
  const owners = ['self', ...cosStore.ids()].filter((id) => cosStore.get(id)?.pet)
  return owners.map((id) => (
    <PetFollower
      key={`${id}:${cosStore.get(id).pet}`}
      kind={cosStore.get(id).pet}
      getOwner={id === 'self' ? () => focusRef.current : () => remotes.current.get(id)}
    />
  ))
}
