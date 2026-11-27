// Mekâna özel eşyalar: kulüp dans pisti/disko topu/lazerler, vitrin, boks ringi, spor aletleri.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, Color, DoubleSide } from 'three'
import { venueStore } from './features/venueStore'
import { Box, Cyl, Glb, Mat, OLD } from './venueParts'
// ---------- kulüp: ışık gösterisi ----------
export function DanceFloor({ x, z, cols, rows, size }) {
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

export function DiscoBall({ x, z, y }) {
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

export function Lasers({ x, z, y }) {
  const g = useRef()
  const cols = ['#fd9c33', '#4fc3ff', '#ffe45e', '#7dff9c', '#c28bff']
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

export function GlassCase({ x, z, w, d, h = 2.4, floor }) {
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
// ---------- Fitness Kulübü 3D ekipmanları (oyuncak-pastel stil) ----------
export function BoxingRing({ x, z, w = 4.4, d = 4.4 }) {
  const hwR = w / 2 - 0.16
  const hdR = d / 2 - 0.16
  const corners = [
    [-hwR, -hdR, '#ff8a7a'],
    [hwR, -hdR, '#7fcdf3'],
    [-hwR, hdR, '#7fcdf3'],
    [hwR, hdR, '#ff8a7a'],
  ]
  const ropeYs = [0.76, 1.08, 1.4]
  const ropeCols = ['#ff8a7a', '#fffaf2', '#7fcdf3']
  return (
    <group position={[x, 0, z]}>
      {/* Yükseltilmiş ring tabanı ve kenar etekliği */}
      <Box y={0} w={w} h={0.42} d={d} c="#4a3b5c" rad={0.08} />
      <Box y={0.42} w={w - 0.14} h={0.08} d={d - 0.14} c="#fff6ec" rad={0.04} />
      {/* Orta logo çemberi */}
      <mesh position={[0, 0.506, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[0.72, 0.92, 36]} />
        <Mat c="#ff8a7a" r={0.7} />
      </mesh>
      <mesh position={[0, 0.505, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.72, 36]} />
        <Mat c="#e5f5ef" r={0.85} />
      </mesh>
      {/* Ön merdiven (güney kenarı) */}
      <Box x={0} y={0} z={d / 2 + 0.18} w={0.95} h={0.22} d={0.34} c="#ffd35e" rad={0.04} />
      <Box x={0} y={0} z={d / 2 + 0.44} w={0.95} h={0.11} d={0.24} c="#ffdf85" rad={0.03} />
      {/* Köşe direkleri */}
      {corners.map(([cx, cz, col], i) => (
        <group key={i} position={[cx, 0.46, cz]}>
          <Cyl r={0.09} h={1.18} c={col} />
          <mesh position={[0, 1.22, 0]} castShadow>
            <sphereGeometry args={[0.12, 14, 12]} />
            <Mat c="#fffaf2" r={0.35} />
          </mesh>
        </group>
      ))}
      {/* 3 sıra yumuşak ring ipi */}
      {ropeYs.map((ry, i) => (
        <group key={i} position={[0, ry, 0]}>
          <Box x={0} y={0} z={-hdR} w={w - 0.34} h={0.055} d={0.055} c={ropeCols[i]} rad={0.025} />
          <Box x={0} y={0} z={hdR} w={w - 0.34} h={0.055} d={0.055} c={ropeCols[i]} rad={0.025} />
          <Box x={-hwR} y={0} z={0} w={0.055} h={0.055} d={d - 0.34} c={ropeCols[i]} rad={0.025} />
          <Box x={hwR} y={0} z={0} w={0.055} h={0.055} d={d - 0.34} c={ropeCols[i]} rad={0.025} />
        </group>
      ))}
    </group>
  )
}

export function BenchPress({ x, z, ry = 0 }) {
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      {/* Sehpa ayakları + minder */}
      <Box x={-0.55} y={0} z={0} w={0.14} h={0.42} d={0.46} c="#4a3b5c" rad={0.04} />
      <Box x={0.55} y={0} z={0} w={0.14} h={0.42} d={0.46} c="#4a3b5c" rad={0.04} />
      <Box x={0} y={0.4} z={0} w={1.38} h={0.14} d={0.44} c="#b79cff" rad={0.06} />
      {/* Halter dikmeleri */}
      <Box x={-0.46} y={0} z={-0.36} w={0.1} h={1.08} d={0.1} c="#7fcdf3" rad={0.03} />
      <Box x={-0.46} y={0} z={0.36} w={0.1} h={1.08} d={0.1} c="#7fcdf3" rad={0.03} />
      {/* Halter çubuğu ve pastel ağırlık plakaları */}
      <mesh position={[-0.46, 1.08, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.032, 0.032, 1.65, 14]} />
        <Mat c="#e6ebf5" r={0.25} />
      </mesh>
      {[-0.68, -0.58, 0.58, 0.68].map((pz, i) => (
        <mesh key={i} position={[-0.46, 1.08, pz]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[i === 0 || i === 3 ? 0.19 : 0.24, i === 0 || i === 3 ? 0.19 : 0.24, 0.065, 20]} />
          <Mat c={i === 0 || i === 3 ? '#ffd35e' : '#ff8a7a'} r={0.35} />
        </mesh>
      ))}
    </group>
  )
}

export function DumbbellRack({ x, z, ry = 0 }) {
  const cols = ['#ff8a7a', '#ffd35e', '#8fdcb4', '#7fcdf3', '#b79cff']
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      <Box x={-0.85} y={0} z={0} w={0.12} h={0.86} d={0.48} c="#4a3b5c" rad={0.04} />
      <Box x={0.85} y={0} z={0} w={0.12} h={0.86} d={0.48} c="#4a3b5c" rad={0.04} />
      <Box x={0} y={0.36} z={0} w={1.76} h={0.08} d={0.34} c="#fffaf2" rad={0.03} />
      <Box x={0} y={0.76} z={0} w={1.76} h={0.08} d={0.34} c="#fffaf2" rad={0.03} />
      {cols.map((c, i) => {
        const dx = -0.64 + i * 0.32
        return (
          <group key={i}>
            {[0.46, 0.86].map((dy, row) => (
              <group key={row} position={[dx, dy, 0]}>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.022, 0.022, 0.22, 10]} />
                  <Mat c="#d8deea" r={0.3} />
                </mesh>
                {[-0.1, 0.1].map((dz) => (
                  <mesh key={dz} position={[0, 0, dz]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                    <cylinderGeometry args={[0.075 - row * 0.012, 0.075 - row * 0.012, 0.055, 14]} />
                    <Mat c={c} r={0.35} />
                  </mesh>
                ))}
              </group>
            ))}
          </group>
        )
      })}
    </group>
  )
}

export function Treadmill({ x, z, ry = 0 }) {
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      {/* Taban ve koşu bandı */}
      <Box x={0} y={0} z={0} w={0.86} h={0.14} d={1.68} c="#7fcdf3" rad={0.06} />
      <Box x={0} y={0.13} z={0.06} w={0.64} h={0.04} d={1.36} c="#4a3b5c" rad={0.02} shadow={false} />
      {/* Ön gövde ve kolçaklar */}
      <Box x={-0.36} y={0.12} z={-0.66} w={0.09} h={1.06} d={0.12} c="#fffaf2" rad={0.04} />
      <Box x={0.36} y={0.12} z={-0.66} w={0.09} h={1.06} d={0.12} c="#fffaf2" rad={0.04} />
      <Box x={0} y={1.06} z={-0.62} w={0.82} h={0.28} d={0.22} c="#4a3b5c" rad={0.06} />
      {/* Parlak ekran */}
      <mesh position={[0, 1.2, -0.5]} rotation={[-0.25, 0, 0]}>
        <planeGeometry args={[0.56, 0.18]} />
        <Mat c="#8fdcb4" em="#8fdcb4" ei={0.45} r={0.3} />
      </mesh>
    </group>
  )
}

export function PunchingBag({ x, z }) {
  const bag = useRef()
  useFrame(({ clock }) => {
    if (bag.current) bag.current.rotation.z = Math.sin(clock.elapsedTime * 2.2) * 0.06
  })
  return (
    <group position={[x, 0, z]}>
      {/* Sehpa tabanı ve üst askı kolu */}
      <Cyl r={0.42} h={0.1} c="#4a3b5c" />
      <Cyl x={0} y={0.1} z={-0.28} r={0.055} h={2.25} c="#7fcdf3" />
      <Box x={0} y={2.28} z={-0.06} w={0.1} h={0.1} d={0.55} c="#7fcdf3" rad={0.03} />
      {/* Sallanan kırmızı-mercan kum torbası */}
      <group ref={bag} position={[0, 2.26, 0.16]}>
        <Cyl y={-0.26} r={0.02} h={0.26} c="#ffd35e" />
        <mesh position={[0, -0.82, 0]} castShadow>
          <capsuleGeometry args={[0.24, 0.72, 10, 18]} />
          <Mat c="#ff7e70" r={0.42} />
        </mesh>
        <mesh position={[0, -0.58, 0]}>
          <cylinderGeometry args={[0.248, 0.248, 0.12, 18]} />
          <Mat c="#fffaf2" r={0.45} />
        </mesh>
      </group>
    </group>
  )
}

