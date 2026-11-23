import { useMemo } from 'react'
import { Html, RoundedBox } from '@react-three/drei'
import { Shape } from 'three'

// Hediye eşyaları (procedural, pastel/oyuncak). Tüm modeller yerde durur, yaklaşık 0,5-0,8 m.
const M = ({ color, ...p }) => <meshStandardMaterial color={color} roughness={0.6} {...p} />

/** Kalp biçimi (ExtrudeGeometry için); yaklaşık 1 birim genişlik. */
export function makeHeartShape() {
  const s = new Shape()
  s.moveTo(0, -0.5)
  s.bezierCurveTo(-0.15, -0.35, -0.5, -0.1, -0.5, 0.15)
  s.bezierCurveTo(-0.5, 0.42, -0.2, 0.5, 0, 0.28)
  s.bezierCurveTo(0.2, 0.5, 0.5, 0.42, 0.5, 0.15)
  s.bezierCurveTo(0.5, -0.1, 0.15, -0.35, 0, -0.5)
  return s
}

export function Heart({ size = 1, color = '#ff7eb3', depth = 0.25, glow = false, ...p }) {
  const shape = useMemo(() => makeHeartShape(), [])
  return (
    <mesh scale={size} {...p}>
      <extrudeGeometry args={[shape, { depth, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.06, bevelSegments: 3, curveSegments: 14 }]} />
      <M color={color} emissive={glow ? color : '#000000'} emissiveIntensity={glow ? 0.9 : 0} />
    </mesh>
  )
}

function Bear() {
  const fur = '#e9c7a3'
  const light = '#fbe8d3'
  return (
    <group>
      <mesh position={[0, 0.22, 0]} scale={[1, 1.05, 0.95]} castShadow>
        <sphereGeometry args={[0.21, 22, 18]} />
        <M color={fur} />
      </mesh>
      <mesh position={[0, 0.2, 0.15]} scale={[1, 1.1, 0.5]}>
        <sphereGeometry args={[0.13, 16, 14]} />
        <M color={light} />
      </mesh>
      <mesh position={[0, 0.5, 0.02]} castShadow>
        <sphereGeometry args={[0.17, 22, 18]} />
        <M color={fur} />
      </mesh>
      {[1, -1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.13, 0.64, 0]}>
            <sphereGeometry args={[0.06, 12, 12]} />
            <M color={fur} />
          </mesh>
          <mesh position={[s * 0.13, 0.64, 0.025]} scale={[1, 1, 0.5]}>
            <sphereGeometry args={[0.035, 10, 10]} />
            <M color="#ffc4dc" />
          </mesh>
          <mesh position={[s * 0.27, 0.27, 0.05]} rotation={[0, 0, -s * 0.9]}>
            <capsuleGeometry args={[0.055, 0.1, 6, 10]} />
            <M color={fur} />
          </mesh>
          <mesh position={[s * 0.13, 0.05, 0.1]}>
            <sphereGeometry args={[0.075, 12, 12]} />
            <M color={fur} />
          </mesh>
          <mesh position={[s * 0.065, 0.53, 0.165]}>
            <sphereGeometry args={[0.022, 10, 10]} />
            <M color="#4a3b5c" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.47, 0.15]} scale={[1.1, 0.8, 0.8]}>
        <sphereGeometry args={[0.065, 14, 12]} />
        <M color={light} />
      </mesh>
      <mesh position={[0, 0.485, 0.205]}>
        <sphereGeometry args={[0.02, 10, 10]} />
        <M color="#7a5a4a" />
      </mesh>
      {/* papyon */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * 0.05, 0.35, 0.11]} rotation={[0, 0, (-s * Math.PI) / 2]}>
          <coneGeometry args={[0.04, 0.07, 10]} />
          <M color="#ff8fbd" />
        </mesh>
      ))}
      <mesh position={[0, 0.35, 0.115]}>
        <sphereGeometry args={[0.022, 10, 10]} />
        <M color="#ff6aa6" />
      </mesh>
    </group>
  )
}

function HeartBox() {
  return (
    <group>
      <RoundedBox args={[0.5, 0.26, 0.5]} radius={0.04} smoothness={3} position={[0, 0.13, 0]} castShadow>
        <M color="#ffc2dc" />
      </RoundedBox>
      <RoundedBox args={[0.54, 0.09, 0.54]} radius={0.03} smoothness={3} position={[0, 0.3, 0]} castShadow>
        <M color="#ff9ec8" />
      </RoundedBox>
      {/* kurdele */}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.07, 0.1, 0.56]} />
        <M color="#fffaf2" />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.56, 0.1, 0.07]} />
        <M color="#fffaf2" />
      </mesh>
      <Heart size={0.26} color="#ff6aa6" depth={0.2} position={[0, 0.5, 0]} rotation={[0, 0, 0]} />
    </group>
  )
}

function Roses() {
  const rose = (x, y, z, c, s = 1) => (
    <group key={`${x}${z}`} position={[x, y, z]} scale={s}>
      <mesh>
        <sphereGeometry args={[0.085, 14, 12]} />
        <M color={c} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.055, 0.025, 8, 16]} />
        <M color="#ffffff" transparent opacity={0.25} />
      </mesh>
      <mesh position={[0, 0.045, 0]}>
        <sphereGeometry args={[0.04, 10, 10]} />
        <M color={c} />
      </mesh>
    </group>
  )
  return (
    <group>
      {/* sargı kâğıdı */}
      <mesh position={[0, 0.2, 0]} rotation={[Math.PI, 0, 0]} castShadow>
        <coneGeometry args={[0.2, 0.4, 16, 1, true]} />
        <M color="#fff4d6" side={2} />
      </mesh>
      <mesh position={[0, 0.1, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.1, 0.2, 16, 1, true]} />
        <M color="#ffc2dc" side={2} />
      </mesh>
      {[
        [0, 0.52, 0, '#ff7fa8', 1.15],
        [0.12, 0.46, 0.04, '#ff9ec8', 1],
        [-0.12, 0.46, 0.05, '#ffb3d1', 1],
        [0.04, 0.45, -0.12, '#ff8fb5', 1],
        [-0.05, 0.43, 0.13, '#ffc2dc', 0.95],
      ].map(([x, y, z, c, s]) => rose(x, y, z, c, s))}
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * 0.15, 0.4, -0.02]} rotation={[0, 0, -s * 0.9]} scale={[1, 1, 0.4]}>
          <sphereGeometry args={[0.07, 10, 8]} />
          <M color="#9fdcb4" />
        </mesh>
      ))}
      <mesh position={[0, 0.26, 0.19]}>
        <sphereGeometry args={[0.04, 10, 10]} />
        <M color="#ff6aa6" />
      </mesh>
    </group>
  )
}

function Choco() {
  const choc = ['#a9714f', '#c08a68', '#8a5a40']
  return (
    <group>
      <RoundedBox args={[0.64, 0.12, 0.46]} radius={0.03} smoothness={3} position={[0, 0.06, 0]} castShadow>
        <M color="#ffb6d3" />
      </RoundedBox>
      <RoundedBox args={[0.56, 0.05, 0.38]} radius={0.02} smoothness={3} position={[0, 0.125, 0]}>
        <M color="#fff1e0" />
      </RoundedBox>
      {Array.from({ length: 6 }, (_, i) => {
        const x = (i % 3) * 0.17 - 0.17
        const z = Math.floor(i / 3) * 0.17 - 0.085
        return i % 2 ? (
          <mesh key={i} position={[x, 0.17, z]}>
            <sphereGeometry args={[0.065, 14, 12]} />
            <M color={choc[i % 3]} />
          </mesh>
        ) : (
          <RoundedBox key={i} args={[0.12, 0.07, 0.12]} radius={0.02} smoothness={3} position={[x, 0.17, z]}>
            <M color={choc[i % 3]} />
          </RoundedBox>
        )
      })}
      {/* açık kapak, yana yaslı */}
      <RoundedBox args={[0.64, 0.04, 0.46]} radius={0.02} smoothness={3} position={[0, 0.3, -0.27]} rotation={[-1.25, 0, 0]}>
        <M color="#ff9ec8" />
      </RoundedBox>
    </group>
  )
}

const MODELS = { 'gift-bear': Bear, 'gift-heartbox': HeartBox, 'gift-roses': Roses, 'gift-choco': Choco }

/** Hediye modeli (yerde; orijin = tabanın ortası). */
export function GiftModel({ id }) {
  const Model = MODELS[id]
  return Model ? <Model /> : null
}

/** Odaya yerleştirilmiş hediye: model + "🎁 Ad’dan" etiketi. */
export function PlacedGift({ id, x, z, ry, from }) {
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      <GiftModel id={id} />
      {from && (
        <Html position={[0, id === 'gift-bear' ? 0.95 : 0.85, 0]} center distanceFactor={9} zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-full border-2 border-white bg-white/90 px-2 py-0.5 text-[11px] font-extrabold text-[#4a3b5c] shadow">🎁 {from}</div>
        </Html>
      )}
    </group>
  )
}
