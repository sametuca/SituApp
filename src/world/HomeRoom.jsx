import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import { HOME_ROOM } from './layout'
import { HOME_TIERS, MAX_TIER } from './homeTiers'
import { skyLive } from './Sky'
import Prop from './Prop'
import HomeGarden from './HomeGarden.jsx'
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

const NEIGHBOR_HOUSES = [
  '/models/neighborhood/house-cottage.glb',
  '/models/neighborhood/house-heart.glb',
  '/models/neighborhood/house-bungalow.glb',
  '/models/neighborhood/house-tower.glb',
]

/** Evin çevresindeki gerçek Meshy GLB komşu evler, sokak, lambalar ve ağaçlar (mahalle atmosferi). */
function NeighborHouse({ x, z, ry = 0, kind = 0, gardenColor = '#d2f4c6' }) {
  const model = NEIGHBOR_HOUSES[kind % NEIGHBOR_HOUSES.length]
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      <RoundedBox args={[8.4, 0.12, 8.2]} radius={0.05} position={[0, -0.02, 0]} receiveShadow>
        <meshStandardMaterial color={gardenColor} roughness={0.95} />
      </RoundedBox>
      <Prop model={model} x={0} z={-0.6} scale={6.2} />
      <Prop model="/models/neighborhood/garden-flowerbed.glb" x={-2.5} z={2.8} scale={1.5} />
      <Prop model="/models/neighborhood/garden-mailbox.glb" x={2.6} z={3.0} scale={1.4} ry={-0.2} />
    </group>
  )
}

function HomeNeighborhood({ hw, hd }) {
  const roadZ = hd + 4.4
  return (
    <group>
      {/* evin önünden geçen pastel mahalle sokağı ve kaldırım */}
      <mesh position={[4, -0.03, roadZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[62, 4.4]} />
        <meshStandardMaterial color="#d8d2e6" roughness={0.95} />
      </mesh>
      <mesh position={[4, -0.025, roadZ - 2.6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[62, 1.1]} />
        <meshStandardMaterial color="#fff3ea" roughness={0.9} />
      </mesh>
      {/* yol kesik çizgileri */}
      {[-16, -10, -4, 2, 8, 14, 20, 26].map((dx) => (
        <mesh key={dx} position={[dx, -0.02, roadZ]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.4, 0.18]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
      {/* kaldırım lambaları ve bank */}
      {[-10, -2.8, 9.5, 18].map((lx) => (
        <Prop key={lx} model="/models/park/park-lamp.glb" x={lx} z={roadZ - 2.5} scale={3.2} />
      ))}
      <Prop model="/models/park/park-bench.glb" x={3.2} z={roadZ - 2.6} scale={1.7} ry={Math.PI} />
      {/* Meshy komşu evler */}
      <NeighborHouse x={-hw - 8.4} z={-0.8} ry={0} kind={0} gardenColor="#d2f4c6" />
      <NeighborHouse x={-hw - 4.5} z={roadZ + 7.2} ry={Math.PI} kind={1} gardenColor="#daf5d2" />
      <NeighborHouse x={8.2} z={roadZ + 7.2} ry={Math.PI} kind={2} gardenColor="#ccefc0" />
      <NeighborHouse x={-hw - 5.8} z={-hd - 8.4} ry={0} kind={3} gardenColor="#d2f4c6" />
      <NeighborHouse x={9.8} z={-hd - 8.4} ry={0} kind={0} gardenColor="#daf5d2" />
      {/* mahalle ağaçları ve çalılar (Meshy GLB) */}
      <Prop model="/models/park/park-tree.glb" x={-hw - 2.6} z={-hd + 1.2} scale={3.4} />
      <Prop model="/models/park/park-tree.glb" x={-hw - 2.4} z={hd - 0.8} scale={3.1} ry={1.2} />
      <Prop model="/models/park/park-tree.glb" x={1.6} z={roadZ + 6.4} scale={3.5} ry={0.7} />
      <Prop model="/models/park/park-tree.glb" x={15.2} z={roadZ + 6.2} scale={3.2} ry={2.1} />
      <Prop model="/models/park/park-tree.glb" x={2.0} z={-hd - 5.8} scale={3.3} ry={1.6} />
      <Prop model="/models/plants/bush.glb" x={-hw - 1.2} z={hd + 1.6} scale={1.1} />
      <Prop model="/models/plants/bush.glb" x={hw + 0.5} z={hd + 1.4} scale={1.0} ry={0.8} />
    </group>
  )
}

/**
 * Evin iç mekânı: pastel, oyuncak gibi tek odalı ev.
 * children: odanın içine çizilecek ek nesneler (mobilya vb.).
 * decor: { wall, pattern, floor, romantic } (features/cosmetics); yoksa varsayılan pembe oda.
 */
export default function HomeRoom({ ownerName, decor, tier = 1, garden, landTier = 0, isOwnHome = false, onPlotClick, onOpenHomeUpgrade, onOpenLand, children }) {
  const { hw, hd, wallH } = HOME_ROOM
  const [signReady, setSignReady] = useState(false) // drei <Html> ilk çizim turunda bağlanmasın (React 19 root uyarısı)
  useEffect(() => {
    const t = setTimeout(() => setSignReady(true), 900)
    return () => clearTimeout(t)
  }, [])
  const front = decor ? wallHex(decor.wall) : '#ffeed9'
  const side = decor ? wallHex(decor.wall) : '#fff4e5'
  const pattern = decor?.pattern
  return (
    <group>
      <RoomLights dim={decor?.romantic} />
      {decor?.romantic && <RomanticLights />}

      {/* dış zemin ve oda zemini */}
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[70, 70]} />
        <meshStandardMaterial color="#e6f6df" roughness={1} />
      </mesh>
      <HomeNeighborhood hw={hw} hd={hd} />
      <RoundedBox args={[hw * 2 + 0.6, 0.2, hd * 2 + 0.6]} radius={0.08} position={[0, -0.1, 0]} receiveShadow>
        <meshStandardMaterial color="#ffedd6" roughness={0.7} />
      </RoundedBox>
      <DecorFloor floor={decor?.floor} />

      {/* duvarlar (kuzey/batı/güney içe bakar; doğu duvarında sağlam çerçeveli bahçe kapısı) */}
      <Wall position={[0, wallH / 2, -hd]} rotation={[0, 0, 0]} w={hw * 2} color={front} pattern={pattern} />
      <Wall position={[-hw, wallH / 2, 0]} rotation={[0, Math.PI / 2, 0]} w={hd * 2} color={side} pattern={pattern} />
      <Wall position={[0, wallH / 2, hd]} rotation={[0, Math.PI, 0]} w={hw * 2} color={front} pattern={pattern} />

      {/* doğu duvarı (x = hw): iki yandan da görünen ince 3D duvar + kapı üstü lento + açık kapı kanadı */}
      <mesh position={[hw, wallH / 2, -(hd + 1.2) / 2]} castShadow receiveShadow>
        <boxGeometry args={[0.16, wallH, hd - 1.2]} />
        <meshStandardMaterial color={side} roughness={0.85} />
      </mesh>
      <mesh position={[hw, wallH / 2, (hd + 1.2) / 2]} castShadow receiveShadow>
        <boxGeometry args={[0.16, wallH, hd - 1.2]} />
        <meshStandardMaterial color={side} roughness={0.85} />
      </mesh>
      <mesh position={[hw, (wallH + 2.4) / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.16, wallH - 2.4, 2.4]} />
        <meshStandardMaterial color={side} roughness={0.85} />
      </mesh>
      {/* bahçe kapısı beyaz çerçeve + eşik + açık kanat */}
      <Trim position={[hw, 1.2, -1.2]} args={[0.24, 2.4, 0.14]} color="#fffaf2" />
      <Trim position={[hw, 1.2, 1.2]} args={[0.24, 2.4, 0.14]} color="#fffaf2" />
      <Trim position={[hw, 2.42, 0]} args={[0.26, 0.16, 2.54]} color="#fffaf2" />
      <mesh position={[hw + 0.16, 0.04, 0]} receiveShadow>
        <boxGeometry args={[0.38, 0.08, 2.3]} />
        <meshStandardMaterial color="#e8b882" roughness={0.75} />
      </mesh>
      <group position={[hw + 0.06, 0, -1.12]} rotation={[0, 0.85, 0]}>
        <mesh position={[0.45, 1.15, 0]} castShadow>
          <boxGeometry args={[0.9, 2.25, 0.08]} />
          <meshStandardMaterial color="#b79cff" roughness={0.5} />
        </mesh>
        <mesh position={[0.75, 1.1, 0.06]}>
          <sphereGeometry args={[0.05, 10, 8]} />
          <meshStandardMaterial color="#ffd35e" roughness={0.3} />
        </mesh>
      </group>
      <HomeGarden plots={garden} landTier={landTier} isOwnHome={isOwnHome} onPlotClick={onPlotClick} onOpenLand={onOpenLand} />

      {/* ev içinde yerde ev büyütme işareti */}
      {isOwnHome && tier < MAX_TIER && (
        <group
          position={[-hw + 1.3, 0, hd - 1.2]}
          onClick={(e) => {
            e.stopPropagation()
            onOpenHomeUpgrade?.()
          }}
          onPointerOver={() => onOpenHomeUpgrade && (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = '')}
        >
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.45, 0.62, 24]} />
            <meshBasicMaterial color="#c9b6ff" transparent opacity={0.85} />
          </mesh>
          <Html position={[0, 0.55, 0]} center distanceFactor={12} zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
            <div className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-white bg-[#f3e8ff] px-2.5 py-0.5 text-[11px] font-black text-[#5b4678] shadow-md">
              <span>{HOME_TIERS[tier + 1].emoji} Ev Büyüt</span>
              <span className="rounded-full bg-[#fff3c4] px-1.5 py-[1px] text-[#8a5a00]">🪙 {HOME_TIERS[tier + 1].price}</span>
            </div>
          </Html>
        </group>
      )}

      {/* kalın duvar kenarları (dışarıdan da görünür) */}
      <Trim position={[0, wallH + 0.08, -hd]} args={[hw * 2 + 0.3, 0.18, 0.3]} color="#fecb89" />
      <Trim position={[-hw, wallH + 0.08, 0]} args={[0.3, 0.18, hd * 2 + 0.3]} color="#fecb89" />
      <Trim position={[hw, wallH + 0.08, 0]} args={[0.3, 0.18, hd * 2 + 0.3]} color="#fecb89" />
      <Trim position={[0, 0.16, -hd + 0.06]} args={[hw * 2, 0.32, 0.12]} color="#fffaf2" />
      <Trim position={[-hw + 0.06, 0.16, 0]} args={[0.12, 0.32, hd * 2]} color="#fffaf2" />
      <Trim position={[hw - 0.06, 0.16, -(hd + 1.2) / 2]} args={[0.12, 0.32, hd - 1.2]} color="#fffaf2" />
      <Trim position={[hw - 0.06, 0.16, (hd + 1.2) / 2]} args={[0.12, 0.32, hd - 1.2]} color="#fffaf2" />

      {tier > 0 && <Window x={-Math.min(2.6, hw - 1.6)} />}
      {tier > 0 && <Window x={Math.min(2.6, hw - 1.6)} />}
      {tier === 0 ? <GarageDoor /> : <ExitDoor />}


      {/* sahibin adı: arka duvarda tabela */}
      {signReady && (
      <Html position={[0, 3.2, -hd + 0.15]} center distanceFactor={14} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="whitespace-nowrap rounded-full border-2 border-white bg-white/90 px-3 py-1 text-sm font-extrabold text-[#4a3b5c] shadow-md">
          🏠 {ownerName} evi
        </div>
      </Html>
      )}

      <Prop model="/models/cafe/cafe-plant.glb" x={-hw + 0.9} z={hd - 1} scale={1.5} />
      <Prop model="/models/cafe/cafe-plant.glb" x={hw - 0.9} z={-hd + 0.9} scale={1.4} />
      <Prop model="/models/neighborhood/garden-mailbox.glb" x={-2.0} z={hd + 1.2} scale={1.35} />
      {/* hoş geldin paspası */}
      <RoundedBox args={[1.6, 0.03, 0.95]} radius={0.02} position={[0, 0.02, hd - 0.85]}>
        <meshStandardMaterial color="#ffd6e4" roughness={0.9} />
      </RoundedBox>

      {children}
    </group>
  )
}
