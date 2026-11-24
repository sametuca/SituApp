import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { CanvasTexture, Color, RepeatWrapping, Shape, SRGBColorSpace } from 'three'
import { HOME_ROOM } from './layout'
import { useFloorTexture } from './floorTex'
import { Heart } from './Gifts'
import { WALL_COLORS } from './cosmeticsData'


// ---------- doku yardımcıları (canvas, önbellekli) ----------
const baseCache = new Map()
const cloneCache = new Map()

const mix = (hex, amt) => `#${new Color(hex).lerp(new Color(amt > 0 ? '#ffffff' : '#7a5a8c'), Math.abs(amt)).getHexString()}`

function canvasTexture(key, w, h, draw) {
  if (baseCache.has(key)) return baseCache.get(key)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.wrapS = t.wrapT = RepeatWrapping
  t.anisotropy = 4
  baseCache.set(key, t)
  return t
}

/** Tekrar sayılarına göre bir doku kopyası (görüntüyü paylaşır). */
function repeated(base, key, rx, ry) {
  const k = `${key}|${rx.toFixed(2)}|${ry.toFixed(2)}`
  if (!cloneCache.has(k)) {
    const t = base.clone()
    t.repeat.set(rx, ry)
    t.needsUpdate = true
    cloneCache.set(k, t)
  }
  return cloneCache.get(k)
}

/** Duvar deseni dokusu (düz için null). 1 m'lik desen aralığı. */
export function wallTexture(pattern, hex, w, h) {
  if (pattern === 'stripes') {
    const base = canvasTexture(`stripes${hex}`, 64, 64, (g, W, H) => {
      g.fillStyle = hex
      g.fillRect(0, 0, W, H)
      g.fillStyle = mix(hex, -0.09)
      g.fillRect(0, 0, W / 2, H)
    })
    return repeated(base, `stripes${hex}`, w / 0.5, 1)
  }
  if (pattern === 'dots') {
    const base = canvasTexture(`dots${hex}`, 128, 128, (g, W, H) => {
      g.fillStyle = hex
      g.fillRect(0, 0, W, H)
      g.fillStyle = 'rgba(255,255,255,0.8)'
      for (const [x, y] of [[32, 32], [96, 96]]) {
        g.beginPath()
        g.arc(x, y, 13, 0, Math.PI * 2)
        g.fill()
      }
    })
    return repeated(base, `dots${hex}`, w / 0.8, h / 0.8)
  }
  return null
}

export const wallHex = (id) => WALL_COLORS.find((c) => c.id === id)?.hex ?? WALL_COLORS[0].hex

/** Odanın zemini: ahşap (tahta) / halı / fayans. floor tanımsızsa eski düz zemin. Dairesel halı yalnızca ahşap/eski zeminde. */
export function DecorFloor({ floor }) {
  const { hw, hd } = HOME_ROOM
  const meshyName = floor === 'wood' || floor === 'tile' ? floor : 'wood'
  const meshyTex = useFloorTexture(meshyName, hw * 2, hd * 2) // hook koşulsuz; yalnızca ahşap/fayansta kullanılır
  const tex = useMemo(() => {
    if (floor === 'wood' || floor === 'tile') return meshyTex
    if (floor === 'wood-old') {
      const base = canvasTexture('wood', 256, 256, (g, W, H) => {
        const tones = ['#ffe9c9', '#ffdfb8', '#fff0d8', '#ffe3c0']
        const rows = 4
        for (let i = 0; i < rows; i++) {
          g.fillStyle = tones[i]
          g.fillRect(0, (i * H) / rows, W, H / rows)
          g.fillStyle = 'rgba(160,110,80,0.35)'
          g.fillRect(0, (i * H) / rows, W, 3)
          g.fillRect(((i * 97) % W) + 20, (i * H) / rows, 3, H / rows)
        }
      })
      return repeated(base, 'wood', (hw * 2) / 3, (hd * 2) / 1.5)
    }
    if (floor === 'rug') {
      return canvasTexture('rugfloor', 512, 460, (g, W, H) => {
        g.fillStyle = '#f2d9ff'
        g.fillRect(0, 0, W, H)
        g.strokeStyle = '#ffb6d3'
        g.lineWidth = 14
        g.strokeRect(26, 26, W - 52, H - 52)
        g.strokeStyle = '#ffffff'
        g.lineWidth = 5
        g.setLineDash([14, 14])
        g.strokeRect(48, 48, W - 96, H - 96)
        g.setLineDash([])
        g.fillStyle = 'rgba(255,255,255,0.55)'
        for (let y = 90; y < H - 70; y += 44) for (let x = 90 + ((y / 44) % 2) * 22; x < W - 70; x += 44) {
          g.beginPath()
          g.arc(x, y, 5, 0, Math.PI * 2)
          g.fill()
        }
      })
    }
    if (floor === 'tile-old') {
      const base = canvasTexture('tile', 128, 128, (g, W, H) => {
        g.fillStyle = '#d6f5e6'
        g.fillRect(0, 0, W, H)
        g.fillStyle = '#fffaf2'
        g.fillRect(0, 0, W / 2, H / 2)
        g.fillRect(W / 2, H / 2, W / 2, H / 2)
        g.strokeStyle = 'rgba(150,170,190,0.45)'
        g.lineWidth = 3
        g.strokeRect(0, 0, W, H)
        g.beginPath()
        g.moveTo(W / 2, 0)
        g.lineTo(W / 2, H)
        g.moveTo(0, H / 2)
        g.lineTo(W, H / 2)
        g.stroke()
      })
      return repeated(base, 'tile', hw * 2, hd * 2)
    }
    return null
  }, [floor, meshyTex])

  return (
    <>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[hw * 2, hd * 2]} />
        <meshStandardMaterial color={tex ? '#ffffff' : '#fff1d9'} map={tex} roughness={floor === 'tile' ? 0.45 : 0.85} />
      </mesh>
      {(floor === undefined || floor === 'wood') && (
        <>
          <mesh position={[0, 0.02, 0.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[2.4, 48]} />
            <meshStandardMaterial color="#dccfff" roughness={1} />
          </mesh>
          <mesh position={[0, 0.025, 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.7, 1.95, 48]} />
            <meshStandardMaterial color="#ffc2dc" roughness={1} />
          </mesh>
        </>
      )}
    </>
  )
}

// ---------- romantik ışık ----------
const BULBS = ['#ffd0e4', '#ffeaa8', '#dcc8ff', '#c9efff']

function starShape() {
  const s = new Shape()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.2 : 0.5
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    else s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  s.closePath()
  return s
}

function Star({ size, color }) {
  const shape = useMemo(() => starShape(), [])
  return (
    <mesh scale={size}>
      <extrudeGeometry args={[shape, { depth: 0.2, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 }]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.1} roughness={0.5} />
    </mesh>
  )
}

/** İki uç arasında sarkan ışık zinciri: ampuller + (her n'inci ampulden) sarkan süs. */
function LightString({ from, to, sag = 0.32, count = 14, ornament }) {
  const pts = useMemo(
    () =>
      Array.from({ length: count + 1 }, (_, i) => {
        const t = i / count
        return [from[0] + (to[0] - from[0]) * t, from[1] - Math.sin(Math.PI * t) * sag, from[2] + (to[2] - from[2]) * t]
      }),
    [from, to, sag, count],
  )
  const refs = useRef([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    refs.current.forEach((m, i) => {
      if (m) m.scale.setScalar(0.85 + 0.25 * Math.sin(t * 2.4 + i * 1.3))
    })
  })
  return (
    <group>
      <Line points={pts} color="#ffc2dc" lineWidth={1.2} />
      {pts.map((p, i) => (
        <group key={i} position={p}>
          <mesh ref={(m) => (refs.current[i] = m)}>
            <sphereGeometry args={[0.055, 10, 10]} />
            <meshBasicMaterial color={BULBS[i % BULBS.length]} toneMapped={false} />
          </mesh>
          {ornament && i % 4 === 2 && (
            <group position={[0, -0.28, 0]}>
              <Line points={[[0, 0.28, 0], [0, 0.05, 0]]} color="#ffc2dc" lineWidth={1} />
              {ornament(i)}
            </group>
          )}
        </group>
      ))}
    </group>
  )
}

/** "💗 Romantik ışık modu": sıcak loş ışıklar, ışık zinciri, kalp ve yıldız süsleri. */
export function RomanticLights() {
  const { hw, hd } = HOME_ROOM
  const y = 3.15
  return (
    <group>
      <pointLight position={[0, 2.6, 0]} intensity={9} distance={11} color="#ff9ec8" />
      <pointLight position={[-3.2, 2.2, -2.6]} intensity={4} distance={7} color="#ffd2a0" />
      <pointLight position={[3.2, 2.2, -2.6]} intensity={4} distance={7} color="#e0c0ff" />
      <LightString from={[-hw + 0.3, y, -hd + 0.18]} to={[hw - 0.3, y, -hd + 0.18]} count={18} ornament={() => <Heart size={0.26} color="#ff6aa6" depth={0.12} glow />} />
      <LightString from={[-hw + 0.18, y, -hd + 0.3]} to={[-hw + 0.18, y, hd - 0.6]} count={16} sag={0.28} ornament={(i) => <Star size={0.24} color={i % 8 === 2 ? '#ffe58a' : '#ffd0e4'} />} />
      <LightString from={[hw - 0.18, y, -hd + 0.3]} to={[hw - 0.18, y, hd - 0.6]} count={16} sag={0.28} ornament={(i) => <Star size={0.24} color={i % 8 === 2 ? '#ffe58a' : '#dcc8ff'} />} />
      {/* duvarda parlayan kalpler */}
      {[[-0.75, 2.4, 0.5], [0.15, 2.85, 0.34], [0.95, 2.35, 0.42]].map(([x, yy, s], i) => (
        <Heart key={i} size={s} color="#ff7eb3" depth={0.1} glow position={[x, yy, -hd + 0.1]} />
      ))}
    </group>
  )
}
