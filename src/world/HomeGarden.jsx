// Evin doğu tarafındaki pastel bahçe: çimen alan, beyaz çit, Meshy bahçe süsleri, pergola ve ekilebilir tarhlar.
import { useEffect, useState } from 'react'
import { Html, RoundedBox } from '@react-three/drei'
import { HOME_ROOM } from './layout'
import Prop from './Prop'
import { CROP_BY_ID, LAND_TIERS, MAX_LAND_TIER, clampLandTier, cropProgress, gardenPlots } from './homeGarden'

function CropHead({ id, color, ready }) {
  const emissive = ready ? color : '#000000'
  const ei = ready ? 0.3 : 0
  if (id === 'sunflower') {
    return (
      <group position={[0, 0.4, 0]}>
        <mesh rotation={[0.25, 0, 0]} castShadow>
          <cylinderGeometry args={[0.17, 0.17, 0.05, 12]} />
          <meshStandardMaterial color="#ffd34d" emissive={emissive} emissiveIntensity={ei} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.02, 0.03]}>
          <sphereGeometry args={[0.09, 10, 8]} />
          <meshStandardMaterial color="#7a4e2d" roughness={0.7} />
        </mesh>
      </group>
    )
  }
  if (id === 'tulip') {
    return (
      <mesh position={[0, 0.39, 0]} castShadow>
        <coneGeometry args={[0.14, 0.22, 8, 1, false]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={ei} roughness={0.35} />
      </mesh>
    )
  }
  if (id === 'lavender') {
    return (
      <group position={[0, 0.34, 0]}>
        {[-0.06, 0, 0.06].map((dx, i) => (
          <mesh key={i} position={[dx, i === 1 ? 0.12 : 0.06, 0]} castShadow>
            <capsuleGeometry args={[0.045, 0.16, 4, 8]} />
            <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={ei} roughness={0.45} />
          </mesh>
        ))}
      </group>
    )
  }
  if (id === 'carrot') {
    return (
      <mesh position={[0, 0.24, 0]} rotation={[Math.PI, 0, 0]} castShadow>
        <coneGeometry args={[0.11, 0.24, 10]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={ei} roughness={0.4} />
      </mesh>
    )
  }
  if (id === 'strawberry' || id === 'tomato') {
    return (
      <group position={[0, 0.34, 0]}>
        {[
          [-0.08, 0.04, 0.06],
          [0.09, 0.02, -0.05],
          [0, 0.1, -0.02],
        ].map(([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]} castShadow>
            <sphereGeometry args={[ready ? 0.095 : 0.065, 10, 8]} />
            <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={ei} roughness={0.3} />
          </mesh>
        ))}
      </group>
    )
  }
  return (
    <mesh position={[0, 0.38, 0]} castShadow>
      <sphereGeometry args={[ready ? 0.2 : 0.13, 12, 10]} />
      <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={ei} roughness={0.35} />
    </mesh>
  )
}

function CropMesh({ slot, now }) {
  const c = CROP_BY_ID[slot.crop]
  if (!c) return null
  const { progress, ready, watered } = cropProgress(slot, now)
  const scale = 0.35 + progress * 0.65
  return (
    <group position={[0, 0.14, 0]} scale={scale}>
      {/* gövde / yapraklar */}
      <mesh position={[0, 0.16, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 0.32, 8]} />
        <meshStandardMaterial color="#6cd47e" roughness={0.7} />
      </mesh>
      <mesh position={[-0.1, 0.22, 0]} rotation={[0, 0, 0.6]}>
        <sphereGeometry args={[0.09, 8, 6]} />
        <meshStandardMaterial color="#7ce08c" roughness={0.7} />
      </mesh>
      <mesh position={[0.1, 0.22, 0]} rotation={[0, 0, -0.6]}>
        <sphereGeometry args={[0.09, 8, 6]} />
        <meshStandardMaterial color="#7ce08c" roughness={0.7} />
      </mesh>
      {/* türe özel meyve / çiçek başı */}
      {progress >= 0.35 && <CropHead id={c.id} color={c.color} ready={ready} />}
      {ready && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.26, 0.38, 16]} />
          <meshBasicMaterial color="#ffe478" transparent opacity={0.65} depthWrite={false} />
        </mesh>
      )}
      {!ready && !watered && (
        <Html position={[0, 0.65, 0]} center distanceFactor={10} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <span className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-white bg-white/95 px-2 py-0.5 text-[11px] font-black text-[#2563eb] shadow">💧</span>
        </Html>
      )}
      {ready && (
        <Html position={[0, 0.72, 0]} center distanceFactor={10} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border-2 border-white bg-[#fff3c4] px-2.5 py-0.5 text-[11px] font-black text-[#8a5a00] shadow">
            <span>{c.emoji}</span>
            <span>Topla!</span>
          </span>
        </Html>
      )}
    </group>
  )
}

export default function HomeGarden({ plots = [], landTier = 0, isOwnHome = false, onPlotClick, onOpenLand }) {
  const { hw, hd } = HOME_ROOM
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const lt = clampLandTier(landTier)
  const curLand = LAND_TIERS[lt]
  const nextLand = lt < MAX_LAND_TIER ? LAND_TIERS[lt + 1] : null
  const coords = gardenPlots(lt)
  const gw = curLand.width
  const gd = hd * 2 + 0.6
  const gx = hw + 0.3 + gw / 2
  const signX = hw + 0.3 + gw - 0.85
  const signZ = -hd + 1.05

  return (
    <group>
      {/* çimen zemin (ev tabanıyla bitişik) */}
      <RoundedBox args={[gw, 0.2, gd]} radius={0.08} position={[gx, -0.1, 0]} receiveShadow>
        <meshStandardMaterial color="#c8f2b8" roughness={0.95} />
      </RoundedBox>
      {/* kapıdan bahçeye taş patika */}
      {[0.7, 1.35].map((dx) => (
        <mesh key={dx} position={[hw + dx, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[0.28, 12]} />
          <meshStandardMaterial color="#fff3e0" roughness={0.85} />
        </mesh>
      ))}
      {/* beyaz ahşap bahçe çiti + köşe direkleri */}
      {[-hd - 0.15, hd + 0.15].map((z) => (
        <mesh key={z} position={[gx, 0.32, z]} castShadow>
          <boxGeometry args={[gw - 0.2, 0.55, 0.1]} />
          <meshStandardMaterial color="#fffaf2" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[hw + 0.3 + gw - 0.15, 0.32, 0]} castShadow>
        <boxGeometry args={[0.1, 0.55, gd - 0.2]} />
        <meshStandardMaterial color="#fffaf2" roughness={0.6} />
      </mesh>
      {[
        [hw + 0.4, -hd - 0.15],
        [hw + 0.4, hd + 0.15],
        [hw + 0.3 + gw - 0.15, -hd - 0.15],
        [hw + 0.3 + gw - 0.15, hd + 0.15],
      ].map(([px, pz], i) => (
        <mesh key={i} position={[px, 0.42, pz]} castShadow>
          <boxGeometry args={[0.18, 0.78, 0.18]} />
          <meshStandardMaterial color="#ffe4b8" roughness={0.6} />
        </mesh>
      ))}
      {/* kapı önünde pastel bahçe kemeri */}
      <group position={[hw + 0.85, 0, 0]}>
        {[-1.15, 1.15].map((z) => (
          <mesh key={z} position={[0, 1.25, z]} castShadow>
            <cylinderGeometry args={[0.06, 0.07, 2.5, 8]} />
            <meshStandardMaterial color="#fffaf2" roughness={0.5} />
          </mesh>
        ))}
        <RoundedBox args={[0.24, 0.14, 2.55]} radius={0.05} position={[0, 2.52, 0]} castShadow>
          <meshStandardMaterial color="#fecb89" roughness={0.5} />
        </RoundedBox>
        {[-0.8, 0, 0.8].map((z, bi) => (
          <mesh key={z} position={[0, 2.42, z]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshStandardMaterial color="#fff3c4" emissive={bi === 1 ? '#ffb3d9' : '#ffd970'} emissiveIntensity={0.85} />
          </mesh>
        ))}
      </group>
      {/* bahçe köşelerinde Meshy fener, çiçeklik ve dinlenme bankı */}
      <Prop model="/models/neighborhood/garden-lantern.glb" x={hw + 0.3 + gw - 0.65} z={hd - 0.65} scale={1.7} />
      <Prop model="/models/neighborhood/garden-flowerbed.glb" x={hw + 1.15} z={-hd + 0.7} scale={1.45} />
      <Prop model="/models/park/park-bench.glb" x={hw + 1.25} z={hd - 0.75} scale={1.5} ry={Math.PI} />

      {/* yerde arazi genişletme işareti */}
      {isOwnHome && nextLand && (
        <group
          position={[signX, 0, signZ]}
          onClick={(e) => {
            e.stopPropagation()
            onOpenLand?.()
          }}
          onPointerOver={() => onOpenLand && (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = '')}
        >
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.45, 0.62, 24]} />
            <meshBasicMaterial color="#9be7a8" transparent opacity={0.85} />
          </mesh>
          <mesh position={[0, 0.42, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.06, 0.84, 8]} />
            <meshStandardMaterial color="#e8b882" roughness={0.7} />
          </mesh>
          <RoundedBox args={[0.9, 0.48, 0.08]} radius={0.04} position={[0, 0.88, 0]} castShadow>
            <meshStandardMaterial color="#fff3c4" roughness={0.5} />
          </RoundedBox>
          <Html position={[0, 1.38, 0]} center distanceFactor={12} zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
            <div className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-white bg-[#e4f9e8] px-2.5 py-0.5 text-[11px] font-black text-[#256b3d] shadow-md">
              <span>{nextLand.emoji} Arazi Büyüt</span>
              <span className="rounded-full bg-[#fff3c4] px-1.5 py-[1px] text-[#8a5a00]">🪙 {nextLand.price}</span>
            </div>
          </Html>
        </group>
      )}

      {/* sonraki arazi genişlemesi için yerde pastel önizleme alanı */}
      {isOwnHome && nextLand && (
        <mesh position={[hw + 0.3 + gw + 1.25, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.3, gd - 0.6]} />
          <meshBasicMaterial color="#d8f5d0" transparent opacity={0.35} depthWrite={false} />
        </mesh>
      )}

      {/* 6 ekilebilir tarla */}
      {coords.map((pt, i) => {
        const slot = plots[i] ?? null
        return (
          <group
            key={i}
            position={[pt.x, 0, pt.z]}
            onClick={(e) => {
              e.stopPropagation()
              onPlotClick?.(i)
            }}
            onPointerOver={() => onPlotClick && (document.body.style.cursor = 'pointer')}
            onPointerOut={() => (document.body.style.cursor = '')}
          >
            {/* ahşap çerçeve */}
            <RoundedBox args={[1.55, 0.16, 1.55]} radius={0.05} position={[0, 0.08, 0]} castShadow receiveShadow>
              <meshStandardMaterial color="#d8a26e" roughness={0.75} />
            </RoundedBox>
            {/* toprak */}
            <mesh position={[0, 0.145, 0]} receiveShadow>
              <boxGeometry args={[1.34, 0.05, 1.34]} />
              <meshStandardMaterial color={slot?.wateredAt ? '#6e4930' : '#8c6142'} roughness={0.95} />
            </mesh>
            {slot && <CropMesh slot={slot} now={now} />}
          </group>
        )
      })}
    </group>
  )
}
