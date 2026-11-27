import { useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import { TextureLoader } from 'three'
import { getPuffyGrassPair, getPuffyPaverPair, getPuffySandPair } from './pastelTex'
import { GROUND_TEX, featherTexture, getAsphaltPair, sharedTexture } from './CityGroundUtils'

/** tex: GROUND_TEX adı. Doku dünya ölçüsünde döşenir (kiremit boyu metre), renk tonu `color` ile çarpılır (pastel ton). feather: kenar yumuşatma (m). */
export function Flat({ x = 0, z = 0, w, d, y, color = '#ffffff', round, tex, feather = 0 }) {
  const loaded = useLoader(TextureLoader, `/textures/${tex ?? 'grass'}.webp`)
  const isAsphalt = tex === 'asphalt'
  const isSand = tex === 'sand'
  const isCobble = tex === 'cobble'
  const isGrass = tex === 'grass'
  const pair = isAsphalt ? getAsphaltPair() : isSand ? getPuffySandPair() : isCobble ? getPuffyPaverPair() : isGrass ? getPuffyGrassPair() : null
  const base = pair ? pair.map : loaded
  const { map, bumpMap } = useMemo(() => {
    if (!tex) return { map: null, bumpMap: null }
    const m = GROUND_TEX[tex]
    const rx = Math.round(((round ? round * 2 : w) / m) * 20) / 20
    const ry = Math.round(((round ? round * 2 : d) / m) * 20) / 20
    const ox = Math.round((((x / m) % 1) + 1) * 20) / 20 % 1
    const oy = Math.round((((-z / m) % 1) + 1) * 20) / 20 % 1
    const key = `f${rx}|${ry}|${ox}|${oy}`
    const setup = (t) => {
      t.repeat.set(rx, ry)
      t.offset.set(ox, oy) // komşu parçalarda desen aynı hizadan devam etsin
    }
    return {
      map: sharedTexture(base, key, setup),
      bumpMap: pair ? sharedTexture(pair.bump, `b${key}`, setup) : null,
    }
  }, [base, pair, tex, w, d, round, x, z])
  const alpha = useMemo(() => (feather > 0 ? featherTexture(round ? round * 2 : w, round ? round * 2 : d, feather, round ? round * 2 : 0) : null), [feather, w, d, round])
  return (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow renderOrder={alpha ? 1 : 0}>
      {round ? <circleGeometry args={[round, 64]} /> : <planeGeometry args={[w, d]} />}
      <meshStandardMaterial color={color} map={map} bumpMap={bumpMap} bumpScale={isAsphalt ? 0.032 : isSand ? 0.028 : isGrass ? 0.026 : isCobble ? 0.024 : 0} alphaMap={alpha} transparent={Boolean(alpha)} depthWrite={!alpha} roughness={isAsphalt ? 0.82 : isSand ? 0.76 : isCobble ? 0.8 : 0.88} />
    </mesh>
  )
}

/** Dokulu halka (dönel kavşak asfaltı / kaldırımı): ringGeometry UV'si tüm halkaya tek kez sarılır → tekrar sayısı çapa göre. */
export function TexRing({ r0, r1, y, tex, color = '#ffffff' }) {
  const loaded = useLoader(TextureLoader, `/textures/${tex}.webp`)
  const isAsphalt = tex === 'asphalt'
  const isCobble = tex === 'cobble'
  const pair = isAsphalt ? getAsphaltPair() : isCobble ? getPuffyPaverPair() : null
  const base = pair ? pair.map : loaded
  const { map, bumpMap } = useMemo(() => {
    const m = GROUND_TEX[tex]
    const rep = Math.round(((r1 * 2) / m) * 10) / 10
    const setup = (t) => t.repeat.set(rep, rep)
    return {
      map: sharedTexture(base, `ring${rep}`, setup),
      bumpMap: pair ? sharedTexture(pair.bump, `bring${rep}`, setup) : null,
    }
  }, [base, pair, tex, r1])
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <ringGeometry args={[r0, r1, 96]} />
      <meshStandardMaterial color={color} map={map} bumpMap={bumpMap} bumpScale={isAsphalt ? 0.032 : isCobble ? 0.02 : 0} roughness={isAsphalt ? 0.84 : isCobble ? 0.85 : 0.95} />
    </mesh>
  )
}

export function Ring({ r0, r1, y, color }) {
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[r0, r1, 64]} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  )
}
