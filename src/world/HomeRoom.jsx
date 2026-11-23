import { Html, RoundedBox } from '@react-three/drei'
import { HOME_ROOM } from './layout'
import Prop from './Prop'

const { hw, hd, wallH } = HOME_ROOM

// Duvarlar yalnızca içe bakan yüzü çizer (FrontSide): kamera dışarıdan bakınca duvar "şeffaf" olur, oyuncak ev gibi görünür.
function Wall({ position, rotation, w, h = wallH, color }) {
  return (
    <mesh position={position} rotation={rotation} receiveShadow>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  )
}

/** Duvarın alt süpürgeliği ve üst pervazı (dışarıdan da görünen kalın kenar). */
function Trim({ position, args, color }) {
  return (
    <RoundedBox args={args} radius={0.06} smoothness={2} position={position} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.6} />
    </RoundedBox>
  )
}

/** Odanın güney duvarındaki kapı: duvar gibi yalnızca içe bakar (kamera dışarıdan bakınca görüş kapanmaz). */
function ExitDoor() {
  return (
    <group position={[0, 0, hd]} rotation={[0, Math.PI, 0]}>
      <mesh position={[0, 1.3, 0.02]}>
        <planeGeometry args={[2, 2.6]} />
        <meshStandardMaterial color="#fffaf2" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.25, 0.04]}>
        <planeGeometry args={[1.55, 2.2]} />
        <meshStandardMaterial color="#8a6bd1" roughness={0.4} />
      </mesh>
      <mesh position={[0.5, 1.2, 0.06]}>
        <circleGeometry args={[0.07, 16]} />
        <meshStandardMaterial color="#ffd35e" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.03, 0.9]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 0.75, 40]} />
        <meshStandardMaterial color="#ffd35e" emissive="#ffd35e" emissiveIntensity={0.6} transparent opacity={0.85} />
      </mesh>
    </group>
  )
}

function Window({ x }) {
  return (
    <group position={[x, 1.9, -hd + 0.02]}>
      <RoundedBox args={[2.1, 1.6, 0.14]} radius={0.06} castShadow>
        <meshStandardMaterial color="#fffaf2" roughness={0.5} />
      </RoundedBox>
      <mesh position={[0, 0, 0.08]}>
        <planeGeometry args={[1.8, 1.3]} />
        <meshStandardMaterial color="#cfeaff" emissive="#bfe3ff" emissiveIntensity={0.7} />
      </mesh>
      <mesh position={[0, 0, 0.09]}>
        <boxGeometry args={[0.07, 1.3, 0.02]} />
        <meshStandardMaterial color="#fffaf2" />
      </mesh>
      <mesh position={[0, 0, 0.09]}>
        <boxGeometry args={[1.8, 0.07, 0.02]} />
        <meshStandardMaterial color="#fffaf2" />
      </mesh>
    </group>
  )
}

/** Işık: odayı doldurur, yumuşak gölge verir. */
function RoomLights() {
  return (
    <>
      <directionalLight
        castShadow
        position={[3.5, 9, 6]}
        intensity={1.3}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-bias={-0.0005}
      />
      <pointLight position={[0, 3, 0]} intensity={14} distance={12} color="#fff0d9" />
    </>
  )
}

/**
 * Evin iç mekânı: pastel, oyuncak gibi tek odalı ev.
 * children: odanın içine çizilecek ek nesneler (mobilya vb.).
 */
export default function HomeRoom({ ownerName, children }) {
  return (
    <group>
      <RoomLights />

      {/* dış zemin ve oda zemini */}
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#f7e7ff" roughness={1} />
      </mesh>
      <RoundedBox args={[hw * 2 + 0.6, 0.2, hd * 2 + 0.6]} radius={0.08} position={[0, -0.1, 0]} receiveShadow>
        <meshStandardMaterial color="#ffd6e8" roughness={0.7} />
      </RoundedBox>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[hw * 2, hd * 2]} />
        <meshStandardMaterial color="#fff1d9" roughness={0.85} />
      </mesh>
      {/* halı */}
      <mesh position={[0, 0.02, 0.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[2.4, 48]} />
        <meshStandardMaterial color="#dccfff" roughness={1} />
      </mesh>
      <mesh position={[0, 0.025, 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.7, 1.95, 48]} />
        <meshStandardMaterial color="#ffc2dc" roughness={1} />
      </mesh>

      {/* duvarlar (içe bakar) */}
      <Wall position={[0, wallH / 2, -hd]} rotation={[0, 0, 0]} w={hw * 2} color="#ffd9ea" />
      <Wall position={[-hw, wallH / 2, 0]} rotation={[0, Math.PI / 2, 0]} w={hd * 2} color="#ffe5f1" />
      <Wall position={[hw, wallH / 2, 0]} rotation={[0, -Math.PI / 2, 0]} w={hd * 2} color="#ffe5f1" />
      <Wall position={[0, wallH / 2, hd]} rotation={[0, Math.PI, 0]} w={hw * 2} color="#ffd9ea" />

      {/* kalın duvar kenarları (dışarıdan da görünür) */}
      <Trim position={[0, wallH + 0.08, -hd]} args={[hw * 2 + 0.3, 0.18, 0.3]} color="#ffb6d3" />
      <Trim position={[-hw, wallH + 0.08, 0]} args={[0.3, 0.18, hd * 2 + 0.3]} color="#ffb6d3" />
      <Trim position={[hw, wallH + 0.08, 0]} args={[0.3, 0.18, hd * 2 + 0.3]} color="#ffb6d3" />
      <Trim position={[0, 0.16, -hd + 0.06]} args={[hw * 2, 0.32, 0.12]} color="#fffaf2" />
      <Trim position={[-hw + 0.06, 0.16, 0]} args={[0.12, 0.32, hd * 2]} color="#fffaf2" />
      <Trim position={[hw - 0.06, 0.16, 0]} args={[0.12, 0.32, hd * 2]} color="#fffaf2" />

      <Window x={-2.6} />
      <Window x={2.6} />
      <ExitDoor />

      {/* sahibin adı: arka duvarda tabela */}
      <Html position={[0, 3.0, -hd + 0.15]} center distanceFactor={9} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="whitespace-nowrap rounded-full border-2 border-white bg-white/90 px-3 py-1 text-sm font-extrabold text-[#4a3b5c] shadow-md">
          🏠 {ownerName} evi
        </div>
      </Html>

      <Prop model="/models/cafe/cafe-plant.glb" x={-hw + 0.9} z={hd - 1} scale={1.5} />
      <Prop model="/models/cafe/cafe-plant.glb" x={hw - 0.9} z={-hd + 0.9} scale={1.4} />

      {children}
    </group>
  )
}
