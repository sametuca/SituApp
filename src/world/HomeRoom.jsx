import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import { HOME_ROOM } from './layout'
import { skyLive } from './Sky'
import Prop from './Prop'
import { DecorFloor, RomanticLights, wallHex, wallTexture } from './HomeDecor'


// Duvarlar yalnızca içe bakan yüzü çizer (FrontSide): kamera dışarıdan bakınca duvar "şeffaf" olur, oyuncak ev gibi görünür.
function Wall({ position, rotation, w, h = HOME_ROOM.wallH, color, pattern }) {
  const map = pattern && pattern !== 'plain' ? wallTexture(pattern, color, w, h) : null
  return (
    <mesh position={position} rotation={rotation} receiveShadow>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial color={map ? '#ffffff' : color} map={map} roughness={0.9} />
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
  const { hd } = HOME_ROOM
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

/** Garaj evi: güney duvarında yukarı kayan panelli garaj kapısı (şehre çıkış). */
function GarageDoor() {
  const { hd } = HOME_ROOM
  const panels = [0, 1, 2, 3, 4]
  return (
    <group position={[0, 0, hd]} rotation={[0, Math.PI, 0]}>
      <mesh position={[0, 1.3, 0.02]}>
        <planeGeometry args={[3.4, 2.7]} />
        <meshStandardMaterial color="#fffaf2" roughness={0.5} />
      </mesh>
      {panels.map((i) => (
        <mesh key={i} position={[0, 0.3 + i * 0.5, 0.05]}>
          <planeGeometry args={[3.1, 0.44]} />
          <meshStandardMaterial color={i % 2 ? '#c9b6ff' : '#b9a2f5'} roughness={0.45} />
        </mesh>
      ))}
      <mesh position={[0, 2.62, 0.06]}>
        <planeGeometry args={[3.1, 0.12]} />
        <meshStandardMaterial color="#ffd35e" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.03, 0.9]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 0.75, 40]} />
        <meshStandardMaterial color="#ffd35e" emissive="#ffd35e" emissiveIntensity={0.6} transparent opacity={0.85} />
      </mesh>
    </group>
  )
}

/** Pencere camı: dışarıdaki gökyüzü rengini (gün-gece, hava) yansıtır. */
function WindowPane() {
  const mat = useRef()
  useFrame(() => {
    if (!mat.current) return
    mat.current.color.copy(skyLive.window)
    mat.current.emissive.copy(skyLive.window)
  })
  return (
    <mesh position={[0, 0, 0.08]}>
      <planeGeometry args={[1.8, 1.3]} />
      <meshStandardMaterial ref={mat} color="#cfeaff" emissive="#bfe3ff" emissiveIntensity={0.7} />
    </mesh>
  )
}

function Window({ x }) {
  const { hd } = HOME_ROOM
  return (
    <group position={[x, 1.9, -hd + 0.02]}>
      <RoundedBox args={[2.1, 1.6, 0.14]} radius={0.06} castShadow>
        <meshStandardMaterial color="#fffaf2" roughness={0.5} />
      </RoundedBox>
      <WindowPane />
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
function RoomLights({ dim }) {
  return (
    <>
      <directionalLight
        castShadow
        position={[3.5, 9, 6]}
        intensity={dim ? 0.45 : 1.3}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-bias={-0.0005}
      />
      <pointLight position={[0, 3, 0]} intensity={dim ? 4 : 14} distance={12} color="#fff0d9" />
    </>
  )
}

/**
 * Evin iç mekânı: pastel, oyuncak gibi tek odalı ev.
 * children: odanın içine çizilecek ek nesneler (mobilya vb.).
 * decor: { wall, pattern, floor, romantic } (features/cosmetics); yoksa varsayılan pembe oda.
 */
export default function HomeRoom({ ownerName, decor, tier = 1, children }) {
  const { hw, hd, wallH } = HOME_ROOM
  const [signReady, setSignReady] = useState(false) // drei <Html> ilk çizim turunda bağlanmasın (React 19 root uyarısı)
  useEffect(() => {
    const t = setTimeout(() => setSignReady(true), 900)
    return () => clearTimeout(t)
  }, [])
  const front = decor ? wallHex(decor.wall) : '#ffd9ea'
  const side = decor ? wallHex(decor.wall) : '#ffe5f1'
  const pattern = decor?.pattern
  return (
    <group>
      <RoomLights dim={decor?.romantic} />
      {decor?.romantic && <RomanticLights />}

      {/* dış zemin ve oda zemini */}
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#f7e7ff" roughness={1} />
      </mesh>
      <RoundedBox args={[hw * 2 + 0.6, 0.2, hd * 2 + 0.6]} radius={0.08} position={[0, -0.1, 0]} receiveShadow>
        <meshStandardMaterial color="#ffd6e8" roughness={0.7} />
      </RoundedBox>
      <DecorFloor floor={decor?.floor} />

      {/* duvarlar (içe bakar) */}
      <Wall position={[0, wallH / 2, -hd]} rotation={[0, 0, 0]} w={hw * 2} color={front} pattern={pattern} />
      <Wall position={[-hw, wallH / 2, 0]} rotation={[0, Math.PI / 2, 0]} w={hd * 2} color={side} pattern={pattern} />
      <Wall position={[hw, wallH / 2, 0]} rotation={[0, -Math.PI / 2, 0]} w={hd * 2} color={side} pattern={pattern} />
      <Wall position={[0, wallH / 2, hd]} rotation={[0, Math.PI, 0]} w={hw * 2} color={front} pattern={pattern} />

      {/* kalın duvar kenarları (dışarıdan da görünür) */}
      <Trim position={[0, wallH + 0.08, -hd]} args={[hw * 2 + 0.3, 0.18, 0.3]} color="#ffb6d3" />
      <Trim position={[-hw, wallH + 0.08, 0]} args={[0.3, 0.18, hd * 2 + 0.3]} color="#ffb6d3" />
      <Trim position={[hw, wallH + 0.08, 0]} args={[0.3, 0.18, hd * 2 + 0.3]} color="#ffb6d3" />
      <Trim position={[0, 0.16, -hd + 0.06]} args={[hw * 2, 0.32, 0.12]} color="#fffaf2" />
      <Trim position={[-hw + 0.06, 0.16, 0]} args={[0.12, 0.32, hd * 2]} color="#fffaf2" />
      <Trim position={[hw - 0.06, 0.16, 0]} args={[0.12, 0.32, hd * 2]} color="#fffaf2" />

      {tier > 0 && <Window x={-Math.min(2.6, hw - 1.6)} />}
      {tier > 0 && <Window x={Math.min(2.6, hw - 1.6)} />}
      {tier === 0 ? <GarageDoor /> : <ExitDoor />}


      {/* sahibin adı: arka duvarda tabela */}
      {signReady && (
      <Html position={[0, 3.0, -hd + 0.15]} center distanceFactor={9} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="whitespace-nowrap rounded-full border-2 border-white bg-white/90 px-3 py-1 text-sm font-extrabold text-[#4a3b5c] shadow-md">
          🏠 {ownerName} evi
        </div>
      </Html>
      )}

      <Prop model="/models/cafe/cafe-plant.glb" x={-hw + 0.9} z={hd - 1} scale={1.5} />
      <Prop model="/models/cafe/cafe-plant.glb" x={hw - 0.9} z={-hd + 0.9} scale={1.4} />

      {children}
    </group>
  )
}
