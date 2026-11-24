// Girilebilen mekânların iç mekânı: ev odası gibi oyuncak evi kesiti (duvarlar yalnızca içe bakar, kamera güneyden).
// Veri: venueLayout.js (öğeler, çarpışma, koltuklar). Öne çıkan eşyalar Meshy GLB (public/models/venues), küçük süsler procedural.
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox, useGLTF } from '@react-three/drei'
import { AdditiveBlending, Box3, CanvasTexture, Color, DoubleSide, NearestFilter, RepeatWrapping, SRGBColorSpace, Vector3 } from 'three'
import { VENUE_ROOM } from './venues'
import { mix, venueLayout } from './venueLayout'
import { useFloorTexture } from './floorTex'
import Prop from './Prop'
import { venueStore } from './features/venueStore'

const { hw, hd, wallH } = VENUE_ROOM
const CHAIR_FLIP = 0 // cafe-chair GLB'nin önü ters çıkarsa Math.PI yap
const V = (n) => `/models/venues/${n}.glb`
const OLD = { table: '/models/cafe/cafe-table.glb', plant: '/models/cafe/cafe-plant.glb', palm: '/models/beach/beach-palm.glb', speaker: '/models/club/club-speaker.glb', ball: '/models/club/club-ball.glb', bike: '/models/bike/bike.glb', car: '/models/airport/car.glb', suitcases: '/models/airport/suitcases.glb', cart: '/models/airport/luggage-cart.glb', plane: '/models/airport/toy-plane.glb' }

// ---------- GLB (en-boy-yükseklik hedefiyle ölçeklenir) ----------
/** h/w/d verilirse kutuya sığacak biçimde (hepsi → esnetir), yalnızca biri → orantılı. Taban y=0'a oturur. */
function Glb({ model, x = 0, y = 0, z = 0, ry = 0, h, w, d, tilt = 0 }) {
  const { scene } = useGLTF(model)
  const { obj, scale } = useMemo(() => {
    const clone = scene.clone(true)
    const box = new Box3().setFromObject(clone)
    const size = box.getSize(new Vector3())
    const c = box.getCenter(new Vector3())
    clone.position.set(-c.x, -box.min.y, -c.z)
    clone.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true
    })
    let sc
    if (h && w && d) sc = [w / size.x, h / size.y, d / size.z]
    else {
      const k = h ? h / size.y : w ? w / size.x : d / size.z
      sc = [k, k, k]
    }
    return { obj: clone, scale: sc }
  }, [scene, h, w, d])
  return (
    <group position={[x, y, z]} rotation={[tilt, ry, 0]} scale={scale}>
      <primitive object={obj} />
    </group>
  )
}

// ---------- küçük yardımcılar ----------
function Mat({ c, r = 0.7, em, ei = 0, o }) {
  return <meshStandardMaterial color={c} roughness={r} emissive={em ?? '#000000'} emissiveIntensity={ei} transparent={o !== undefined} opacity={o ?? 1} />
}
function Box({ x = 0, y = 0, z = 0, w, h, d, c, ry = 0, rad = 0.05, em, ei, shadow = true, o }) {
  return (
    <RoundedBox args={[w, h, d]} radius={Math.min(rad, w / 2.05, h / 2.05, d / 2.05)} smoothness={2} position={[x, y + h / 2, z]} rotation={[0, ry, 0]} castShadow={shadow} receiveShadow>
      <Mat c={c} em={em} ei={ei} o={o} />
    </RoundedBox>
  )
}
function Cyl({ x = 0, y = 0, z = 0, r, h, c, em, ei, rt }) {
  return (
    <mesh position={[x, y + h / 2, z]} castShadow>
      <cylinderGeometry args={[rt ?? r, r, h, 16]} />
      <Mat c={c} em={em} ei={ei} />
    </mesh>
  )
}

function useCanvasTexture(draw, w, h, deps) {
  return useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    draw(cv.getContext('2d'), w, h)
    const t = new CanvasTexture(cv)
    t.colorSpace = SRGBColorSpace
    return t
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

function Board({ x, y, z, ry = 0, w, h, lines, bg, fg, frame, big, map }) {
  const px = 512
  const tex = useCanvasTexture(
    (g, W, H) => {
      g.fillStyle = bg
      g.fillRect(0, 0, W, H)
      if (map) {
        // basit şehir haritası
        const zones = [['#ffe3ef', 0.04, 0.04, 0.44, 0.44], ['#e6dcff', 0.52, 0.04, 0.44, 0.44], ['#bdeccb', 0.04, 0.52, 0.44, 0.44], ['#ffe9b8', 0.52, 0.52, 0.44, 0.44]]
        for (const [c, a, b, cw, ch] of zones) {
          g.fillStyle = c
          g.beginPath()
          g.roundRect(a * W, b * H, cw * W, ch * H, 18)
          g.fill()
        }
        g.fillStyle = '#d9cdee'
        g.fillRect(W * 0.46, 0, W * 0.08, H)
        g.fillRect(0, H * 0.46, W, H * 0.08)
        g.fillStyle = '#ffb6d3'
        g.beginPath()
        g.arc(W / 2, H / 2, W * 0.07, 0, 7)
        g.fill()
        g.font = `800 ${W * 0.07}px Nunito, sans-serif`
        g.textAlign = 'center'
        g.fillStyle = '#4a3b5c'
        g.fillText('☕', W * 0.26, H * 0.3)
        g.fillText('🪩', W * 0.74, H * 0.3)
        g.fillText('🌳', W * 0.26, H * 0.78)
        g.fillText('🏖️', W * 0.74, H * 0.78)
        g.fillText('⛲', W / 2, H / 2 + W * 0.025)
        return
      }
      g.fillStyle = fg
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      if (big || lines.length === 1) {
        g.font = `900 ${Math.min(H * 0.34, W * 0.1)}px Nunito, sans-serif`
        lines.forEach((l, i) => g.fillText(l, W / 2, (H / (lines.length + 1)) * (i + 1), W * 0.94))
      } else {
        const step = H / (lines.length + 0.6)
        lines.forEach((l, i) => {
          g.font = `${i === 0 ? 900 : 700} ${i === 0 ? step * 0.62 : step * 0.5}px Nunito, sans-serif`
          g.fillText(l, W / 2, step * (i + 0.8), W * 0.9)
        })
      }
    },
    px,
    Math.round(px * (h / w)),
    [bg, fg, lines.join('|'), map],
  )
  return (
    <group position={[x, y, z]} rotation={[0, ry, 0]}>
      {frame && (
        <mesh position={[0, 0, -0.012]}>
          <boxGeometry args={[w + 0.12, h + 0.12, 0.03]} />
          <Mat c={frame} />
        </mesh>
      )}
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={tex} roughness={0.8} emissive="#ffffff" emissiveMap={tex} emissiveIntensity={0.25} />
      </mesh>
    </group>
  )
}

// ---------- küçük süs parçaları (procedural) ----------
// sandalye: cafe-chair GLB (modelin önü = +z; oturan avatar ry yönüne bakar)
function Chair({ x, z, ry }) {
  return <Glb model="/models/cafe/cafe-chair.glb" x={x} z={z} ry={ry + CHAIR_FLIP} h={0.95} />
}

function Sofa({ x, z, ry, w, c }) {
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      <Box y={0.08} w={w} h={0.34} d={0.8} c={c} rad={0.1} />
      <Box y={0.35} z={-0.3} w={w} h={0.5} d={0.22} c={c} rad={0.1} />
      <Box y={0.08} x={-w / 2 + 0.1} w={0.2} h={0.55} d={0.8} c={c} rad={0.08} />
      <Box y={0.08} x={w / 2 - 0.1} w={0.2} h={0.55} d={0.8} c={c} rad={0.08} />
      <Box y={0.4} z={0.05} w={w - 0.5} h={0.1} d={0.55} c="#fffaf2" rad={0.05} shadow={false} />
    </group>
  )
}

function Window({ wall, z }) {
  return (
    <group position={[wall === 'w' ? -hw + 0.02 : hw - 0.02, 1.9, z]} rotation={[0, wall === 'w' ? Math.PI / 2 : -Math.PI / 2, 0]}>
      <RoundedBox args={[1.7, 1.3, 0.12]} radius={0.05}>
        <Mat c="#fffaf2" r={0.5} />
      </RoundedBox>
      <mesh position={[0, 0, 0.07]}>
        <planeGeometry args={[1.45, 1.05]} />
        <meshStandardMaterial color="#cfeaff" emissive="#bfe3ff" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.08]}>
        <boxGeometry args={[0.06, 1.05, 0.02]} />
        <Mat c="#fffaf2" />
      </mesh>
    </group>
  )
}

function Shelf({ x, z, ry, w, mode }) {
  // kitaplık/raf: GLB; kitap kafede dolu raf, diğerlerinde aynı raf (süs eşyasız)
  return <Glb model="/models/furniture/bookshelf.glb" x={x} z={z} ry={ry} h={mode === 'books' ? 2.0 : 1.7} w={w} />
}

function Frame({ x, y, z, ry, w, h, c }) {
  return (
    <group position={[x, y, z]} rotation={[0, ry, 0]}>
      <Box w={w + 0.1} h={h + 0.1} d={0.04} c="#fffaf2" y={-(h + 0.1) / 2} shadow={false} />
      <mesh position={[0, 0, 0.025]}>
        <planeGeometry args={[w, h]} />
        <Mat c={c} r={0.6} />
      </mesh>
    </group>
  )
}

// ---------- kulüp: ışık gösterisi ----------
function DanceFloor({ x, z, cols, rows, size }) {
  const refs = useRef([])
  const tmp = useMemo(() => new Color(), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * (venueStore.singing ? 1.7 : 1)
    refs.current.forEach((m, i) => {
      if (!m) return
      const cx = i % cols
      const cz = Math.floor(i / cols)
      const hue = (t * 0.18 + (cx + cz) * 0.07) % 1
      const lit = (Math.sin(t * 3 + cx * 1.3 + cz * 0.9) + 1) / 2
      tmp.setHSL(hue, 0.85, 0.35 + lit * 0.25)
      m.color.copy(tmp)
      m.emissive.copy(tmp)
      m.emissiveIntensity = 0.35 + lit * 0.7
    })
  })
  return (
    <group position={[x, 0.025, z]}>
      {Array.from({ length: cols * rows }, (_, i) => (
        <mesh key={i} position={[((i % cols) - (cols - 1) / 2) * size, 0, (Math.floor(i / cols) - (rows - 1) / 2) * size]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[size * 0.93, size * 0.93]} />
          <meshStandardMaterial ref={(m) => (refs.current[i] = m)} color="#8844ff" roughness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

function DiscoBall({ x, z, y }) {
  const ball = useRef()
  useFrame((_, dt) => {
    if (ball.current) ball.current.rotation.y += dt * 0.8
  })
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 1.3, 6]} />
        <Mat c="#cccccc" />
      </mesh>
      <group ref={ball}>
        <Glb model={OLD.ball} y={-0.55} h={0.8} />
      </group>
    </group>
  )
}

function Lasers({ x, z, y }) {
  const g = useRef()
  const cols = ['#ff5fcf', '#4fc3ff', '#ffe45e', '#7dff9c', '#c28bff']
  useFrame(({ clock }, dt) => {
    if (!g.current) return
    const k = venueStore.singing ? 1.8 : 1
    g.current.rotation.y += dt * 0.6 * k
    g.current.children.forEach((c, i) => {
      c.rotation.z = 0.9 + Math.sin(clock.elapsedTime * 1.2 * k + i) * 0.35
    })
  })
  return (
    <group position={[x, y - 0.3, z]} ref={g}>
      {cols.map((c, i) => (
        <group key={c} rotation={[0, (i / cols.length) * Math.PI * 2, 0.9]}>
          <mesh position={[0, -2.6, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 5.2, 4]} />
            <meshBasicMaterial color={c} transparent opacity={0.55} blending={AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function ClubLights() {
  const a = useRef()
  const b = useRef()
  const c = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const boost = venueStore.singing ? 1.5 : 1
    if (a.current) {
      a.current.position.set(-1.2 + Math.sin(t * 0.9) * 3, 2.6, 1.3 + Math.cos(t * 0.7) * 2)
      a.current.color.setHSL((t * 0.12) % 1, 0.9, 0.6)
      a.current.intensity = 14 * boost
    }
    if (b.current) {
      b.current.position.set(Math.cos(t * 0.6) * 4, 2.6, Math.sin(t * 0.8) * 3)
      b.current.color.setHSL((t * 0.12 + 0.5) % 1, 0.9, 0.6)
      b.current.intensity = 12 * boost
    }
    if (c.current) c.current.intensity = venueStore.singing ? 30 : 6
  })
  return (
    <>
      <pointLight ref={a} distance={9} />
      <pointLight ref={b} distance={9} />
      <pointLight ref={c} position={[4.4, 3.2, -2.4]} distance={7} color="#ffd6f5" />
    </>
  )
}

function Stage({ x, z, w, d }) {
  return <Glb model={V('stage-podium')} x={x} z={z} w={w} d={d} h={0.5} />
}

function Neon({ x, y, z, w, c, ry = 0 }) {
  return (
    <mesh position={[x, y, z]} rotation={[0, ry, 0]}>
      <boxGeometry args={[w, 0.07, 0.05]} />
      <meshStandardMaterial color={c} emissive={c} emissiveIntensity={1.6} />
    </mesh>
  )
}

function Backdrop({ x, z, w, h, c, c2 }) {
  const tex = useCanvasTexture(
    (g, W, H) => {
      const gr = g.createLinearGradient(0, 0, 0, H)
      gr.addColorStop(0, c2)
      gr.addColorStop(1, c)
      g.fillStyle = gr
      g.fillRect(0, 0, W, H)
    },
    8,
    128,
    [c, c2],
  )
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={tex} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.02, 0.9]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, 1.8]} />
        <Mat c={c} r={0.9} />
      </mesh>
    </group>
  )
}

/** Cam vitrin: dört cam yüzey + ince çerçeve (içine girilmez; çarpışma yerleşimde). floor: içi zemin rengi (bahçe gibi). */
function GlassCase({ x, z, w, d, h = 2.4, floor }) {
  const pane = <meshStandardMaterial color="#cfeeff" transparent opacity={0.2} roughness={0.1} metalness={0.1} depthWrite={false} side={DoubleSide} />
  const frame = <meshStandardMaterial color="#fffaf2" roughness={0.5} />
  return (
    <group position={[x, 0, z]}>
      {floor && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color={floor} roughness={1} />
        </mesh>
      )}
      {[[0, d / 2, w, 0], [0, -d / 2, w, 0], [w / 2, 0, d, Math.PI / 2], [-w / 2, 0, d, Math.PI / 2]].map(([px, pz, len, ry], i) => (
        <mesh key={i} position={[px, h / 2, pz]} rotation={[0, ry, 0]}>
          <planeGeometry args={[len, h]} />
          {pane}
        </mesh>
      ))}
      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[(sx * w) / 2, h / 2, (sz * d) / 2]}>
          <boxGeometry args={[0.08, h, 0.08]} />
          {frame}
        </mesh>
      ))}
      {[[0, d / 2, w + 0.08, 0.06], [0, -d / 2, w + 0.08, 0.06], [w / 2, 0, 0.06, d + 0.08], [-w / 2, 0, 0.06, d + 0.08]].map(([rx, rz, rw, rd], i) => (
        <group key={i}>
          <mesh position={[rx, h, rz]}>
            <boxGeometry args={[rw, 0.06, rd]} />
            {frame}
          </mesh>
          <mesh position={[rx, 0.05, rz]}>
            <boxGeometry args={[rw, 0.1, rd]} />
            {frame}
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---------- öğe seçici ----------
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
      return <Glb model={V(it.c === '#ff9fc6' || it.c === '#ffd35e' || it.c === '#b79cff' ? 'surfboard-a' : 'surfboard-b')} x={it.x} z={it.z} ry={it.ry} h={it.len} tilt={-0.1} />
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
    case 'frame':
      return <Frame {...it} />
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
      return <Box x={it.x} z={it.z} y={it.y} w={0.3} h={0.04} d={0.22} c="#ff9fc6" shadow={false} />
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
    default:
      return null
  }
}

// ---------- oda kabuğu ----------
function Wall({ position, rotation, w, color, band, bandColor }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, wallH / 2, 0]} receiveShadow>
        <planeGeometry args={[w, wallH]} />
        <Mat c={color} r={0.9} />
      </mesh>
      <mesh position={[0, band / 2, 0.012]}>
        <planeGeometry args={[w, band]} />
        <Mat c={bandColor} r={0.8} />
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

const FLOOR_KIND = { cafe: 'wood', tea: 'wood', bakery: 'wood', books: 'wood', bar: 'wood', dessert: 'tile', icecream: 'tile', fastfood: 'tile', salon: 'tile', studio: 'tile', shop: 'tile', guide: 'tile', airport: 'tile', club: 'carpet', arcade: 'carpet' }

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

function Lights({ th }) {
  const dim = th.dim
  return (
    <>
      <directionalLight
        castShadow
        position={[3.5, 9, 6]}
        intensity={1.3 * (1 - dim * 0.75)}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-bias={-0.0005}
      />
      <pointLight position={[0, 3, 0]} intensity={14 * (1 - dim * 0.6)} distance={13} color={dim > 0.5 ? '#ffb3e6' : '#fff0d9'} />
    </>
  )
}

/** Mekânın iç mekânı. id: venues.js kimliği. */
export default function Venue({ id }) {
  const L = venueLayout(id)
  const th = L.theme
  return (
    <group>
      <Lights th={th} />
      {L.type === 'club' && <ClubLights />}
      <Floor th={th} type={L.type} />
      <Wall position={[0, 0, -hd]} rotation={[0, 0, 0]} w={hw * 2} color={th.wall} band={1.0} bandColor={th.band} />
      <Wall position={[-hw, 0, 0]} rotation={[0, Math.PI / 2, 0]} w={hd * 2} color={th.wall2} band={1.0} bandColor={th.band} />
      <Wall position={[hw, 0, 0]} rotation={[0, -Math.PI / 2, 0]} w={hd * 2} color={th.wall2} band={1.0} bandColor={th.band} />
      <Wall position={[0, 0, hd]} rotation={[0, Math.PI, 0]} w={hw * 2} color={th.wall} band={1.0} bandColor={th.band} />
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
