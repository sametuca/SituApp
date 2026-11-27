// Mekân iç mekânı birleştirici: eşya haritası (Item), duvar/zemin/kapı ve ışık katmanlarının yerleşimi.
import { Suspense, useEffect, useMemo } from 'react'
import { RoundedBox } from '@react-three/drei'
import { DoubleSide } from 'three'
import { mix, venueLayout } from './venueLayout'
import { useFloorTexture } from './floorTex'
import { getWallPair } from './pastelTex'
import Prop from './Prop'
import { Backdrop, Board, Box, Chair, Cyl, Glb, Mat, Neon, OLD, Shelf, Sofa, Stage, V, Window, hd, hw, wallH } from './venueParts'
import { BenchPress, BoxingRing, DanceFloor, DiscoBall, DumbbellRack, GlassCase, Lasers, PunchingBag, Treadmill } from './VenueSpecial'
import { ClubLights, FocalLights, FocalPools, Lights, StringLights, focalPoints } from './VenueLighting'
function Item({ it }) {
  switch (it.t) {
    case 'box':
      return <Box {...it} />
    case 'cyl':
      return <Cyl {...it} />
    case 'ball':
      return (
        <mesh position={[it.x, it.y, it.z]} castShadow>
          <sphereGeometry args={[it.r, 16, 12]} />
          <Mat c={it.c} />
        </mesh>
      )
    case 'glass':
      return <GlassCase {...it} />
    case 'glb':
      return <Prop model={OLD[it.m]} x={it.x} z={it.z} scale={it.s} ry={it.ry ?? 0} />
    case 'counter':
      return <Glb model={V('counter')} x={it.x} z={it.z} w={it.w} d={it.d} h={it.h} />
    case 'display':
      return <Glb model={V('cake-display')} x={it.x} z={it.z} y={it.y} w={it.w} />
    case 'machine':
      return <Glb model={V('coffee-machine')} x={it.x} z={it.z} y={it.y} h={0.55} />
    case 'samovar':
      return <Glb model={V('samovar')} x={it.x} z={it.z} y={it.y} h={0.7} />
    case 'register':
      return <Glb model={V('cash-register')} x={it.x} z={it.z} y={it.y} h={0.45} />
    case 'freezer':
      return <Glb model={V('icecream-freezer')} x={it.x} z={it.z} w={it.w} d={0.9} h={1.2} />
    case 'oven':
      return <Glb model={V('bakery-oven')} x={it.x} z={it.z} h={1.7} />
    case 'djgear':
      return <Glb model={V('dj-stand')} x={it.x} z={it.z} w={it.w} d={0.9} h={1.3} />
    case 'camera':
      return <Glb model={V('camera-tripod')} x={it.x} z={it.z} y={it.y} h={0.7} />
    case 'softbox':
      return <Glb model={V('softbox-light')} x={it.x} z={it.z} ry={it.ry} h={2.0} />
    case 'cabinet':
      return <Glb model={V('arcade-cabinet')} x={it.x} z={it.z} ry={it.ry} h={1.35} />
    case 'claw':
      return <Glb model={V('claw-machine')} x={it.x} z={it.z} ry={it.ry} h={1.7} />
    case 'mirror':
      return <Glb model={V('salon-mirror')} x={it.x} z={it.z} ry={it.ry ?? 0} h={it.h ?? 1.35} />
    case 'salonchair':
      return <Glb model={V('salon-chair')} x={it.x} z={it.z} ry={it.ry} h={1.05} />
    case 'surf':
      return <Glb model={V(it.c === '#fec172' || it.c === '#ffd35e' || it.c === '#b79cff' ? 'surfboard-a' : 'surfboard-b')} x={it.x} z={it.z} ry={it.ry} h={it.len} tilt={-0.1} />
    case 'rack':
      return <Glb model={V('clothes-rack')} x={it.x} z={it.z} h={1.7} />
    case 'globe':
      return <Glb model={V('world-globe')} x={it.x} z={it.z} h={1.0} />
    case 'bottles':
      return <Glb model={V('bottle-shelf')} x={it.x} z={it.z} y={1.15} w={it.w} />
    case 'mic':
      return <Glb model={V('karaoke-mic')} x={it.x} z={it.z} h={1.5} />
    case 'stool':
      return <Glb model={V('bar-stool')} x={it.x} z={it.z} h={0.8} />
    case 'chair':
      return <Chair {...it} />
    case 'sofa':
      return <Sofa {...it} />
    case 'shelf':
      return <Shelf {...it} />
    case 'board':
      return <Board {...it} />
    case 'window':
      return <Window {...it} />
    case 'neon':
      return <Neon {...it} />
    case 'rug':
      return (
        <mesh position={[it.x, 0.02, it.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          {it.round ? <circleGeometry args={[it.w / 2, 40]} /> : <planeGeometry args={[it.w, it.d]} />}
          <Mat c={it.c} r={0.95} />
        </mesh>
      )
    case 'book':
      return <Box x={it.x} z={it.z} y={it.y} w={0.3} h={0.04} d={0.22} c="#fec172" shadow={false} />
    case 'lamp':
      return (
        <group position={[it.x, it.y, it.z]}>
          <Cyl r={0.08} h={0.04} c="#fffaf2" />
          <mesh position={[0, 0.2, 0]}>
            <coneGeometry args={[0.16, 0.22, 12, 1, true]} />
            <meshStandardMaterial color="#ffd8a8" emissive="#ffb86b" emissiveIntensity={0.9} side={DoubleSide} />
          </mesh>
        </group>
      )
    case 'dancefloor':
      return <DanceFloor {...it} />
    case 'discoball':
      return <DiscoBall {...it} />
    case 'laser':
      return <Lasers {...it} />
    case 'stage':
      return <Stage {...it} />
    case 'backdrop':
      return <Backdrop {...it} />
    case 'ring':
      return <BoxingRing {...it} />
    case 'benchpress':
      return <BenchPress {...it} />
    case 'dumbbells':
      return <DumbbellRack {...it} />
    case 'treadmill':
      return <Treadmill {...it} />
    case 'punchbag':
      return <PunchingBag {...it} />
    case 'demodoor':
      return (
        <group position={[it.x, 0, it.z]} rotation={[0, Math.PI / 2, 0]}>
          <mesh position={[0, 1.3, 0.02]}>
            <planeGeometry args={[1.9, 2.55]} />
            <Mat c="#fffaf2" r={0.5} />
          </mesh>
          <mesh position={[0, 1.25, 0.04]}>
            <planeGeometry args={[1.45, 2.15]} />
            <Mat c="#7fd3b8" r={0.4} />
          </mesh>
          <mesh position={[0.48, 1.18, 0.06]}>
            <circleGeometry args={[0.07, 16]} />
            <Mat c="#ffd35e" r={0.3} />
          </mesh>
          <mesh position={[0, 2.15, 0.06]}>
            <planeGeometry args={[1.05, 0.34]} />
            <Mat c="#fffaf2" r={0.4} />
          </mesh>
        </group>
      )
    case 'decor':
      return <Glb model={it.model} x={it.x} y={it.y ?? 0} z={it.z} ry={it.ry ?? 0} h={it.h ?? 1.4} />
    default:
      return null
  }
}

const WALL_KIND = {
  cafe: 'brick', bar: 'brick', fastfood: 'brick', club: 'brick', bakery: 'brick',
  shop: 'siding', tea: 'siding', books: 'siding', teknel: 'siding',
  dessert: 'plaster', icecream: 'plaster', salon: 'plaster', studio: 'plaster', gym: 'plaster', guide: 'plaster', airport: 'plaster', arcade: 'plaster',
}

// ---------- oda kabuğu (PBR kabartmalı duvar + lambri çıtası) ----------
function Wall({ position, rotation, w, color, band, bandColor, kind = 'plaster' }) {
  const { map, bumpMap } = useMemo(() => {
    const pair = getWallPair(kind)
    const m = pair.map.clone()
    const b = pair.bump.clone()
    m.repeat.set(Math.max(2, w / 2.6), wallH / 2.6)
    b.repeat.set(Math.max(2, w / 2.6), wallH / 2.6)
    m.needsUpdate = b.needsUpdate = true
    return { map: m, bumpMap: b }
  }, [kind, w])
  useEffect(() => () => { map.dispose(); bumpMap.dispose() }, [map, bumpMap])

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, wallH / 2, 0]} receiveShadow>
        <planeGeometry args={[w, wallH]} />
        <meshStandardMaterial color={color} map={map} bumpMap={bumpMap} bumpScale={0.036} roughness={0.72} />
      </mesh>
      <mesh position={[0, band / 2, 0.012]} receiveShadow>
        <planeGeometry args={[w, band]} />
        <meshStandardMaterial color={bandColor} map={map} bumpMap={bumpMap} bumpScale={0.024} roughness={0.68} />
      </mesh>
      {/* 3B ahşap/pastel lambri çıtası */}
      <mesh position={[0, band + 0.02, 0.032]} castShadow>
        <boxGeometry args={[w, 0.075, 0.06]} />
        <Mat c="#fffaf2" r={0.5} />
      </mesh>
    </group>
  )
}

function Trim({ position, args, color }) {
  return (
    <RoundedBox args={args} radius={0.06} smoothness={2} position={position} castShadow receiveShadow>
      <Mat c={color} r={0.6} />
    </RoundedBox>
  )
}

function ExitDoor() {
  return (
    <group position={[0, 0, hd]} rotation={[0, Math.PI, 0]}>
      <mesh position={[0, 1.3, 0.02]}>
        <planeGeometry args={[2, 2.6]} />
        <Mat c="#fffaf2" r={0.5} />
      </mesh>
      <mesh position={[0, 1.25, 0.04]}>
        <planeGeometry args={[1.55, 2.2]} />
        <Mat c="#8a6bd1" r={0.4} />
      </mesh>
      <mesh position={[0.5, 1.2, 0.06]}>
        <circleGeometry args={[0.07, 16]} />
        <Mat c="#ffd35e" r={0.3} />
      </mesh>
      <mesh position={[0, 0.03, 0.9]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 0.75, 40]} />
        <meshStandardMaterial color="#ffd35e" emissive="#ffd35e" emissiveIntensity={0.6} transparent opacity={0.85} />
      </mesh>
    </group>
  )
}

const FLOOR_KIND = { cafe: 'wood', tea: 'wood', bakery: 'wood', books: 'wood', bar: 'wood', dessert: 'tile', icecream: 'tile', fastfood: 'tile', salon: 'tile', studio: 'tile', shop: 'tile', guide: 'tile', airport: 'tile', club: 'carpet', arcade: 'carpet', gym: 'tile', teknel: 'tile' }

function Floor({ th, type }) {
  const kind = FLOOR_KIND[type] ?? 'wood'
  const tex = useFloorTexture(kind, hw * 2, hd * 2)
  const tint = mix(th.floor[0], '#ffffff', th.dark ? 0.4 : 0.6) // pastel ton: tema rengi açılıp dokuyla çarpılır
  return (
    <>
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <Mat c={th.bg} r={1} />
      </mesh>
      <RoundedBox args={[hw * 2 + 0.6, 0.2, hd * 2 + 0.6]} radius={0.08} position={[0, -0.1, 0]} receiveShadow>
        <Mat c={th.trim} r={0.7} />
      </RoundedBox>
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[hw * 2, hd * 2]} />
        <meshStandardMaterial map={tex} color={tint} roughness={0.8} />
      </mesh>
    </>
  )
}

export default function Venue({ id }) {
  const L = venueLayout(id)
  const th = L.theme
  const wKind = WALL_KIND[L.type] ?? 'plaster'
  const pts = useMemo(() => focalPoints(L), [L])
  return (
    <group>
      <Lights th={th} />
      {L.type === 'club' ? <ClubLights /> : <FocalLights pts={pts} />}
      {L.type !== 'club' && <FocalPools pts={pts} th={th} />}
      {L.type !== 'club' && <StringLights th={th} />}
      <Floor th={th} type={L.type} />
      <Wall position={[0, 0, -hd]} rotation={[0, 0, 0]} w={hw * 2} color={th.wall} band={1.0} bandColor={th.band} kind={wKind} />
      <Wall position={[-hw, 0, 0]} rotation={[0, Math.PI / 2, 0]} w={hd * 2} color={th.wall2} band={1.0} bandColor={th.band} kind={wKind} />
      <Wall position={[hw, 0, 0]} rotation={[0, -Math.PI / 2, 0]} w={hd * 2} color={th.wall2} band={1.0} bandColor={th.band} kind={wKind} />
      <Wall position={[0, 0, hd]} rotation={[0, Math.PI, 0]} w={hw * 2} color={th.wall} band={1.0} bandColor={th.band} kind={wKind} />
      <Trim position={[0, wallH + 0.08, -hd]} args={[hw * 2 + 0.3, 0.18, 0.3]} color={th.trim} />
      <Trim position={[-hw, wallH + 0.08, 0]} args={[0.3, 0.18, hd * 2 + 0.3]} color={th.trim} />
      <Trim position={[hw, wallH + 0.08, 0]} args={[0.3, 0.18, hd * 2 + 0.3]} color={th.trim} />
      <Trim position={[0, 0.16, -hd + 0.06]} args={[hw * 2, 0.32, 0.12]} color="#fffaf2" />
      <Trim position={[-hw + 0.06, 0.16, 0]} args={[0.12, 0.32, hd * 2]} color="#fffaf2" />
      <Trim position={[hw - 0.06, 0.16, 0]} args={[0.12, 0.32, hd * 2]} color="#fffaf2" />
      <ExitDoor />
      <Suspense fallback={null}>
        {L.items.map((it, i) => (
          <Item key={i} it={it} />
        ))}
      </Suspense>
    </group>
  )
}

