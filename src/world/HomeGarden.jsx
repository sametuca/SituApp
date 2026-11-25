// Evin doğu tarafındaki pastel bahçe: çiçekli çimen dokusu, ahşap kazıklı çit, peri ışıklı pergola,
// 3B karıklı toprak tarhlar, kelebekler, sulama kabı ve genişletilebilir arazi.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import { CanvasTexture, Object3D, RepeatWrapping, SRGBColorSpace } from 'three'
import { HOME_ROOM, SURFACES } from './layout'
import Prop from './Prop'
import { CROP_BY_ID, LAND_TIERS, MAX_LAND_TIER, clampLandTier, cropProgress, gardenPlots } from './homeGarden'

/** Yumuşak pastel çimen dokusu: yaprak tonları, minik yonca ve kır çiçekleri (tek sefer üretilir). */
let lawnTexCache = null
function getLawnTex() {
  if (lawnTexCache) return lawnTexCache
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')
  g.fillStyle = '#c4eeb4'
  g.fillRect(0, 0, 256, 256)
  // Yumuşak çayır benekleri
  let seed = 1337
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
  for (let i = 0; i < 120; i++) {
    g.fillStyle = i % 2 === 0 ? 'rgba(155, 224, 138, 0.42)' : 'rgba(222, 250, 200, 0.38)'
    g.beginPath()
    g.ellipse(rnd() * 256, rnd() * 256, 6 + rnd() * 14, 4 + rnd() * 10, rnd() * Math.PI, 0, Math.PI * 2)
    g.fill()
  }
  // Minik çim tutamları
  g.strokeStyle = 'rgba(104, 184, 96, 0.45)'
  g.lineWidth = 2
  for (let i = 0; i < 65; i++) {
    const x = rnd() * 256
    const y = rnd() * 256
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x - 3, y - 7)
    g.moveTo(x, y)
    g.lineTo(x + 3, y - 6)
    g.stroke()
  }
  // Minik pastel papatyalar
  const cols = ['#fffdf4', '#ffd6e8', '#ffe88a']
  for (let i = 0; i < 22; i++) {
    const x = rnd() * 256
    const y = rnd() * 256
    g.fillStyle = cols[i % cols.length]
    g.beginPath()
    g.arc(x, y, 2.8, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#ffd35e'
    g.beginPath()
    g.arc(x, y, 1.1, 0, Math.PI * 2)
    g.fill()
  }
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.repeat.set(3.5, 4.5)
  lawnTexCache = tex
  return tex
}

/** Bahçede bitkilerin üstünde süzülen pastel kelebekler. */
function GardenButterflies({ cx, gw, gd }) {
  const refs = useRef([])
  const seeds = useMemo(
    () => [
      { ox: -gw * 0.2, oz: -gd * 0.22, r: 0.7, sp: 1.1, ph: 0, c: '#ff9ec7' },
      { ox: gw * 0.18, oz: gd * 0.16, r: 0.85, sp: 0.9, ph: 2.1, c: '#ffe066' },
      { ox: -gw * 0.12, oz: gd * 0.25, r: 0.65, sp: 1.25, ph: 4.2, c: '#a8d8ff' },
      { ox: gw * 0.22, oz: -gd * 0.18, r: 0.75, sp: 1.0, ph: 5.3, c: '#d6b6ff' },
    ],
    [gw, gd],
  )
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    refs.current.forEach((g, i) => {
      if (!g) return
      const s = seeds[i]
      const a = t * s.sp + s.ph
      g.position.set(cx + s.ox + Math.cos(a) * s.r, 0.85 + Math.sin(t * 2.8 + s.ph) * 0.22, s.oz + Math.sin(a * 0.85) * s.r)
      g.rotation.y = -a + Math.PI / 2
      const flap = Math.abs(Math.sin(t * 14 + s.ph)) * 0.75 + 0.15
      if (g.children[0]) g.children[0].rotation.z = flap
      if (g.children[1]) g.children[1].rotation.z = -flap
    })
  })
  return (
    <group>
      {seeds.map((s, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)}>
          <mesh position={[0.04, 0, 0]}>
            <circleGeometry args={[0.065, 8]} />
            <meshBasicMaterial color={s.c} side={2} />
          </mesh>
          <mesh position={[-0.04, 0, 0]}>
            <circleGeometry args={[0.065, 8]} />
            <meshBasicMaterial color={s.c} side={2} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Gerçek kazıklı beyaz ahşap bahçe çiti (tek InstancedMesh ile 45+ çıta 1 draw-call). */
function PicketFence({ x0, x1, z0, z1 }) {
  const lenX = x1 - x0
  const lenZ = z1 - z0
  const countX = Math.max(4, Math.floor(lenX / 0.42))
  const countZ = Math.max(6, Math.floor(lenZ / 0.42))
  const totalPickets = countX * 2 + countZ
  const picketsRef = useRef()

  useEffect(() => {
    const mesh = picketsRef.current
    if (!mesh) return
    const dummy = new Object3D()
    let idx = 0
    for (const z of [z0, z1]) {
      for (let i = 0; i < countX; i++) {
        const px = x0 + 0.22 + (i / (countX - 1)) * (lenX - 0.44)
        dummy.position.set(px, 0.34, z)
        dummy.rotation.set(0, 0, 0)
        dummy.updateMatrix()
        mesh.setMatrixAt(idx++, dummy.matrix)
      }
    }
    for (let i = 0; i < countZ; i++) {
      const pz = z0 + 0.22 + (i / (countZ - 1)) * (lenZ - 0.44)
      dummy.position.set(x1, 0.34, pz)
      dummy.rotation.set(0, Math.PI / 2, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(idx++, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [x0, x1, z0, z1, lenX, lenZ, countX, countZ])

  return (
    <group>
      {/* Kuzey ve güney çit rayları */}
      {[z0, z1].map((z) => (
        <group key={z}>
          <mesh position={[(x0 + x1) / 2, 0.24, z]} castShadow>
            <boxGeometry args={[lenX, 0.06, 0.06]} />
            <meshStandardMaterial color="#fff6ea" roughness={0.6} />
          </mesh>
          <mesh position={[(x0 + x1) / 2, 0.5, z]} castShadow>
            <boxGeometry args={[lenX, 0.06, 0.06]} />
            <meshStandardMaterial color="#fff6ea" roughness={0.6} />
          </mesh>
        </group>
      ))}
      {/* Doğu çit rayları */}
      <mesh position={[x1, 0.24, 0]} castShadow>
        <boxGeometry args={[0.06, 0.06, lenZ]} />
        <meshStandardMaterial color="#fff6ea" roughness={0.6} />
      </mesh>
      <mesh position={[x1, 0.5, 0]} castShadow>
        <boxGeometry args={[0.06, 0.06, lenZ]} />
        <meshStandardMaterial color="#fff6ea" roughness={0.6} />
      </mesh>
      {/* Tüm çit çıtaları tek InstancedMesh'te */}
      <instancedMesh ref={picketsRef} args={[null, null, totalPickets]} castShadow>
        <boxGeometry args={[0.14, 0.66, 0.05]} />
        <meshStandardMaterial color="#fffaf2" roughness={0.55} />
      </instancedMesh>
      {/* Köşe direkleri + altın topuz */}
      {[
        [x0, z0],
        [x0, z1],
        [x1, z0],
        [x1, z1],
      ].map(([px, pz], i) => (
        <group key={i} position={[px, 0, pz]}>
          <RoundedBox args={[0.2, 0.82, 0.2]} radius={0.04} smoothness={2} position={[0, 0.41, 0]} castShadow>
            <meshStandardMaterial color="#f5cfa0" roughness={0.6} />
          </RoundedBox>
          <mesh position={[0, 0.88, 0]} castShadow>
            <sphereGeometry args={[0.09, 12, 10]} />
            <meshStandardMaterial color="#ffd35e" roughness={0.35} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Şirin pastel sulama kabı süsü. */
function WateringCan({ x, z }) {
  return (
    <group position={[x, 0, z]} rotation={[0, 0.6, 0]}>
      <mesh position={[0, 0.17, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.17, 0.32, 14]} />
        <meshStandardMaterial color="#7fcdf3" roughness={0.35} />
      </mesh>
      <mesh position={[0.2, 0.22, 0]} rotation={[0, 0, -0.75]} castShadow>
        <cylinderGeometry args={[0.025, 0.045, 0.28, 8]} />
        <meshStandardMaterial color="#7fcdf3" roughness={0.35} />
      </mesh>
      <mesh position={[0.31, 0.32, 0]} rotation={[0, 0, -0.75]}>
        <cylinderGeometry args={[0.06, 0.03, 0.06, 10]} />
        <meshStandardMaterial color="#ffd35e" roughness={0.35} />
      </mesh>
      <mesh position={[-0.14, 0.2, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.11, 0.024, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#fff8ee" roughness={0.4} />
      </mesh>
    </group>
  )
}

function CropHead({ id, color, ready }) {
  const emissive = ready ? color : '#000000'
  const ei = ready ? 0.32 : 0
  if (id === 'sunflower') {
    return (
      <group position={[0, 0.42, 0]}>
        <mesh rotation={[0.25, 0, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.18, 0.05, 14]} />
          <meshStandardMaterial color="#ffd34d" emissive={emissive} emissiveIntensity={ei} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.02, 0.03]}>
          <sphereGeometry args={[0.095, 10, 8]} />
          <meshStandardMaterial color="#7a4e2d" roughness={0.7} />
        </mesh>
      </group>
    )
  }
  if (id === 'tulip') {
    return (
      <mesh position={[0, 0.4, 0]} castShadow>
        <coneGeometry args={[0.14, 0.24, 10, 1, false]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={ei} roughness={0.35} />
      </mesh>
    )
  }
  if (id === 'lavender') {
    return (
      <group position={[0, 0.35, 0]}>
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
      <mesh position={[0, 0.25, 0]} rotation={[Math.PI, 0, 0]} castShadow>
        <coneGeometry args={[0.11, 0.24, 10]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={ei} roughness={0.4} />
      </mesh>
    )
  }
  if (id === 'strawberry' || id === 'tomato') {
    return (
      <group position={[0, 0.35, 0]}>
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
  const scale = 0.38 + progress * 0.65
  return (
    <group position={[0, 0.17, 0]} scale={scale}>
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
      {progress >= 0.35 && <CropHead id={c.id} color={c.color} ready={ready} />}
      {ready && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.28, 0.42, 20]} />
          <meshBasicMaterial color="#ffe478" transparent opacity={0.72} depthWrite={false} />
        </mesh>
      )}
      {!ready && !watered && (
        <Html position={[0, 0.66, 0]} center distanceFactor={10} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <span className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-white bg-white/95 px-2 py-0.5 text-[11px] font-black text-[#2563eb] shadow">💧</span>
        </Html>
      )}
      {ready && (
        <Html position={[0, 0.74, 0]} center distanceFactor={10} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
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
  const [hoverIdx, setHoverIdx] = useState(null)
  const lawnTex = useMemo(() => getLawnTex(), [])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const lt = clampLandTier(landTier)
  const curLand = LAND_TIERS[lt]
  const nextLand = lt < MAX_LAND_TIER ? LAND_TIERS[lt + 1] : null
  const coords = useMemo(() => gardenPlots(lt), [lt, HOME_ROOM.hw]) // eslint-disable-line react-hooks/exhaustive-deps
  // tarhların (1,58 m, 0,18 m yüksek) üstüne basılır: avatar içine gömülmesin
  useEffect(() => {
    const beds = coords.map((pt) => ({ x: pt.x, z: pt.z, hw: 0.82, hd: 0.82, top: 0.2 }))
    SURFACES.push(...beds)
    return () => {
      for (const b of beds) SURFACES.splice(SURFACES.indexOf(b), 1)
    }
  }, [coords])
  const gw = curLand.width
  const gd = hd * 2 + 0.6
  const gx = hw + 0.3 + gw / 2
  const fenceX0 = hw + 0.36
  const fenceX1 = hw + 0.3 + gw - 0.16
  // Arazi büyüt tabelası tarhların dışında, temiz kuzeydoğu köşesinde
  const signX = fenceX1 + 0.45
  const signZ = -hd + 0.9

  return (
    <group>
      {/* çiçekli pastel çimen zemin + sıcak taş bordür */}
      <RoundedBox args={[gw, 0.2, gd]} radius={0.08} position={[gx, -0.1, 0]} receiveShadow>
        <meshStandardMaterial map={lawnTex} roughness={0.92} />
      </RoundedBox>

      {/* kapıdan bahçe ortasına yuvarlak taş patika */}
      {[0.65, 1.3, 1.95, 2.6].map((dx, i) => (
        <mesh key={dx} position={[hw + dx, 0.012, (i % 2 === 0 ? -0.1 : 0.1)]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[i === 0 ? 0.34 : 0.26, 16]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#fff5e4' : '#ffe9cf'} roughness={0.85} />
        </mesh>
      ))}

      {/* kazıklı beyaz ahşap çit */}
      <PicketFence x0={fenceX0} x1={fenceX1} z0={-hd - 0.15} z1={hd + 0.15} />

      {/* kapı önünde çiçekli ve peri ışıklı pastel pergola */}
      <group position={[hw + 0.9, 0, 0]}>
        {[-1.2, 1.2].map((z) => (
          <group key={z}>
            <mesh position={[0, 1.3, z]} castShadow>
              <cylinderGeometry args={[0.065, 0.08, 2.6, 10]} />
              <meshStandardMaterial color="#fffaf2" roughness={0.5} />
            </mesh>
            {/* sarmaşık yaprak ve çiçek kümeleri */}
            {[0.8, 1.5, 2.1].map((y, vi) => (
              <mesh key={vi} position={[0.04, y, z + (vi % 2 ? 0.06 : -0.06)]}>
                <sphereGeometry args={[0.11, 8, 6]} />
                <meshStandardMaterial color={vi === 1 ? '#ff9ec7' : '#7fd89b'} roughness={0.65} />
              </mesh>
            ))}
          </group>
        ))}
        {/* üst ahşap kirişler + pastel tente */}
        <RoundedBox args={[0.55, 0.14, 2.7]} radius={0.05} position={[0, 2.62, 0]} castShadow>
          <meshStandardMaterial color="#fecb89" roughness={0.48} />
        </RoundedBox>
        {[-0.95, -0.45, 0.05, 0.55, 1.0].map((z, bi) => (
          <mesh key={z} position={[0, 2.48, z]}>
            <sphereGeometry args={[0.085, 10, 8]} />
            <meshStandardMaterial
              color="#fff6d6"
              emissive={bi % 2 === 0 ? '#ffd970' : '#ffb3d9'}
              emissiveIntensity={0.95}
            />
          </mesh>
        ))}
      </group>

      {/* kelebekler */}
      <GardenButterflies cx={gx} gw={gw} gd={gd} />

      {/* bahçe köşelerinde fener, çiçeklik, sulama kabı */}
      <Prop model="/models/neighborhood/garden-lantern.glb" x={fenceX1 - 0.55} z={hd - 0.6} scale={1.7} />
      <Prop model="/models/neighborhood/garden-flowerbed.glb" x={hw + 1.2} z={-hd + 0.72} scale={1.45} />
      <WateringCan x={hw + 2.25} z={-hd + 0.65} />

      {/* arazi genişletme tabelası (çitin hemen dışında, tarhlarla çakışmaz) */}
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

      {/* 3B karıklı yükseltilmiş ahşap bahçe tarhları */}
      {coords.map((pt, i) => {
        const slot = plots[i] ?? null
        const hovered = hoverIdx === i
        const soilColor = slot?.wateredAt ? '#63412a' : '#8a5f40'
        return (
          <group
            key={i}
            position={[pt.x, 0, pt.z]}
            onClick={(e) => {
              e.stopPropagation()
              onPlotClick?.(i)
            }}
            onPointerOver={() => {
              if (onPlotClick) {
                document.body.style.cursor = 'pointer'
                setHoverIdx(i)
              }
            }}
            onPointerOut={() => {
              document.body.style.cursor = ''
              setHoverIdx((h) => (h === i ? null : h))
            }}
          >
            {/* yuvarlatılmış sedir ahşap çerçeve + köşe direkleri */}
            <RoundedBox args={[1.58, 0.18, 1.58]} radius={0.06} smoothness={2} position={[0, 0.09, 0]} castShadow receiveShadow>
              <meshStandardMaterial color={hovered ? '#e8b67d' : '#d8a26e'} roughness={0.72} />
            </RoundedBox>
            {[-0.72, 0.72].map((cx) =>
              [-0.72, 0.72].map((cz) => (
                <mesh key={`${cx}|${cz}`} position={[cx, 0.12, cz]} castShadow>
                  <cylinderGeometry args={[0.07, 0.075, 0.24, 8]} />
                  <meshStandardMaterial color="#c48a54" roughness={0.7} />
                </mesh>
              )),
            )}
            {/* toprak tabanı + 4 adet 3B toprak karığı */}
            <mesh position={[0, 0.155, 0]} receiveShadow>
              <boxGeometry args={[1.34, 0.05, 1.34]} />
              <meshStandardMaterial color={soilColor} roughness={slot?.wateredAt ? 0.65 : 0.95} />
            </mesh>
            {[-0.42, -0.14, 0.14, 0.42].map((rz) => (
              <RoundedBox key={rz} args={[1.22, 0.07, 0.18]} radius={0.03} smoothness={2} position={[0, 0.185, rz]} receiveShadow>
                <meshStandardMaterial color={soilColor} roughness={slot?.wateredAt ? 0.6 : 0.92} />
              </RoundedBox>
            ))}
            {slot && <CropMesh slot={slot} now={now} />}
          </group>
        )
      })}
    </group>
  )
}
