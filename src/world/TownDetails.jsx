// Kasaba detayları: çeşitli meyve/kiraz/çam ağaçları, pastel çalılıklar, çöp kutuları,
// plaj çeşitliliği, yemlenen martı/kuşlar ve fiziksel kocaman plaj topu.
import { Suspense, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { BEACH, G } from './layout'
import { getClayPlasterPair } from './pastelTex'
import { skyLive } from './Sky'
import { playerPos } from './cull'
import Prop from './Prop'

// Tüm prosedürel kasaba objelerinde GLB modellerle uyumlu yumuşak kil-oyuncak kabartma malzemesi
function ClayMat({ color, roughness = 0.62, bumpScale = 0.018 }) {
  const clay = useMemo(() => getClayPlasterPair(), [])
  return <meshStandardMaterial color={color} bumpMap={clay.bump} bumpScale={bumpScale} roughness={roughness} metalness={0} />
}

// ---------- 1. ÇEŞİTLİ AĞAÇLAR (Portakal, Elma, Kiraz Çiçeği, Çam) ----------
const TREE_SPOTS = [
  // Meydan köşeleri
  { x: 10, z: -10, kind: 'blossom', s: 1.05 },
  { x: -10, z: 10, kind: 'orange', s: 1.0 },
  // Park (eski ağaçların yerine çeşitli meyve & kiraz & çam ağaçları)
  { x: G(-24, -10)[0], z: -10, kind: 'orange', s: 1.05 },
  { x: G(-44, -8)[0], z: -8, kind: 'apple', s: 1.1 },
  { x: G(-26, 10)[0], z: 10, kind: 'blossom', s: 1.05 },
  { x: G(-44, 6)[0], z: 6, kind: 'pine', s: 1.15 },
  { x: G(-15.8, 4.2)[0], z: 4.2, kind: 'apple', s: 0.95 },
  { x: G(-32, -12)[0], z: -12, kind: 'blossom', s: 1.1 },
  { x: G(-32, 12)[0], z: 12, kind: 'orange', s: 1.0 },
  { x: G(-48, 0)[0], z: 0, kind: 'pine', s: 1.2 },
  // Cadde ve mahalle kenarları
  { x: 17, z: -26, kind: 'blossom', s: 1.0 },
  { x: 17, z: 26, kind: 'orange', s: 1.0 },
  { x: -17, z: 28, kind: 'apple', s: 0.98 },
  { x: 24, z: 19, kind: 'pine', s: 1.1 },
  { x: -24, z: -26, kind: 'blossom', s: 1.05 },
  { x: 48, z: -18, kind: 'orange', s: 1.05 },
  { x: 48, z: 18, kind: 'apple', s: 1.0 },
]

function DiverseTrees() {
  return (
    <group>
      {TREE_SPOTS.map((t, i) => {
        if (t.kind === 'pine') {
          return (
            <group key={i} position={[t.x, 0, t.z]} scale={t.s}>
              <mesh position={[0, 0.75, 0]} castShadow>
                <cylinderGeometry args={[0.18, 0.28, 1.5, 12]} />
                <ClayMat color="#b4835a" roughness={0.78} />
              </mesh>
              {[1.7, 2.55, 3.25].map((y, j) => (
                <mesh key={j} position={[0, y, 0]} castShadow>
                  <coneGeometry args={[1.35 - j * 0.3, 1.45 - j * 0.15, 16]} />
                  <ClayMat color={j === 2 ? '#7ad4a5' : '#63be92'} roughness={0.68} />
                </mesh>
              ))}
            </group>
          )
        }
        const leaf = t.kind === 'blossom' ? '#ffb7d5' : t.kind === 'orange' ? '#7dd48e' : '#8ae09c'
        const leaf2 = t.kind === 'blossom' ? '#ffd4e6' : '#9be8a8'
        const fruit = t.kind === 'orange' ? '#ff9f43' : t.kind === 'apple' ? '#ff5964' : '#fff5f8'
        return (
          <group key={i} position={[t.x, 0, t.z]} scale={t.s}>
            <mesh position={[0, 0.9, 0]} castShadow>
              <cylinderGeometry args={[0.2, 0.3, 1.8, 12]} />
              <ClayMat color="#b9865c" roughness={0.78} />
            </mesh>
            <mesh position={[0, 2.3, 0]} castShadow>
              <sphereGeometry args={[1.18, 14, 12]} />
              <ClayMat color={leaf} roughness={0.66} />
            </mesh>
            <mesh position={[0.55, 2.6, 0.3]}>
              <sphereGeometry args={[0.75, 12, 10]} />
              <ClayMat color={leaf2} roughness={0.66} />
            </mesh>
            <mesh position={[-0.52, 2.45, -0.35]}>
              <sphereGeometry args={[0.72, 12, 10]} />
              <ClayMat color={leaf2} roughness={0.66} />
            </mesh>
            {/* Meyveler / çiçekler */}
            {[
              [0.72, 2.05, 0.65],
              [-0.68, 2.1, 0.62],
              [0.18, 1.85, 0.95],
              [-0.2, 2.75, 0.85],
              [0.85, 2.35, -0.4],
              [-0.78, 2.2, -0.52],
            ].map(([fx, fy, fz], j) => (
              <mesh key={j} position={[fx, fy, fz]}>
                <sphereGeometry args={[0.13, 8, 8]} />
                <meshStandardMaterial color={fruit} roughness={0.4} />
              </mesh>
            ))}
          </group>
        )
      })}
    </group>
  )
}

// ---------- 2. PASTEL ÇALILIKLAR ----------
const BUSH_SPOTS = [
  [-13.5, -13.5], [13.5, -13.5], [-13.5, 13.5], [13.5, 13.5],
  [-21, -7.5], [-29, -8.5], [-39, -6.5], [-21, 7.5], [-33, 8.2],
  [21, -13.8], [34, -13.8], [24, 13.8], [36, 13.8],
  [-13.5, -24], [13.5, -24], [-13.5, -34], [13.5, -34],
  [-13.5, 24], [13.5, 24], [-13.5, 33], [13.5, 33],
]

function TownBushes() {
  const flowerCols = ['#ff9ec7', '#ffd35e', '#b79cff', '#fffaf2']
  return (
    <group>
      {BUSH_SPOTS.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.36, 0]}>
            <sphereGeometry args={[0.48, 9, 7]} />
            <meshStandardMaterial color={i % 2 === 0 ? '#7fd69a' : '#8ee0a8'} roughness={0.8} />
          </mesh>
          <mesh position={[0.32, 0.28, 0.14]}>
            <sphereGeometry args={[0.34, 9, 7]} />
            <meshStandardMaterial color="#9ae8b4" roughness={0.8} />
          </mesh>
          <mesh position={[-0.28, 0.26, -0.12]}>
            <sphereGeometry args={[0.32, 9, 7]} />
            <meshStandardMaterial color="#72cc8e" roughness={0.8} />
          </mesh>
          {[
            [0.14, 0.68, 0.24],
            [-0.22, 0.56, 0.28],
            [0.36, 0.45, 0.2],
          ].map(([fx, fy, fz], j) => (
            <mesh key={j} position={[fx, fy, fz]}>
              <sphereGeometry args={[0.07, 6, 6]} />
              <meshStandardMaterial color={flowerCols[(i + j) % flowerCols.length]} roughness={0.5} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

// ---------- 3. SOKAK ÇÖP KUTULARI (bina araları ve kaldırım kenarları) ----------
const BIN_SPOTS = [
  [-5.4, -14.2], [5.4, -14.2], [-5.4, -23.4], [5.4, -23.4], [-5.4, -31.8], [5.4, -31.8],
  [18.8, -5.3], [33.8, -5.3], [24.2, 5.3], [35.8, 5.3],
  [-5.4, 15.2], [5.4, 15.2], [-5.4, 23.4], [5.4, 23.4],
  [-11.8, 6.2], [11.8, -6.2],
  [-15, BEACH.z - 12], [15, BEACH.z - 12],
]

function TrashBins() {
  const cols = ['#7fcdf3', '#8fdcb4', '#ffb48c']
  return (
    <group>
      {BIN_SPOTS.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.36, 0]} castShadow>
            <cylinderGeometry args={[0.25, 0.21, 0.72, 16]} />
            <ClayMat color={cols[i % cols.length]} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.73, 0]} castShadow>
            <sphereGeometry args={[0.26, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <ClayMat color="#594a6e" roughness={0.48} />
          </mesh>
          <mesh position={[0, 0.89, 0]}>
            <torusGeometry args={[0.065, 0.02, 8, 14, Math.PI]} />
            <ClayMat color="#fffaf2" roughness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---------- 4. PLAJ ÇEŞİTLİLİĞİ (sörf rafı, plaj duşu, soğutucu, can simidi, deniz yıldızları) ----------
function BeachExtras() {
  const surfCols = ['#ff8a7a', '#ffd35e', '#7fcdf3', '#8fdcb4']
  return (
    <group>
      {/* Sörf tahtası rafı */}
      <group position={[18.5, 0, BEACH.z - 8]} rotation={[0, -0.5, 0]}>
        <RoundedBox args={[2.4, 0.14, 0.7]} radius={0.04} position={[0, 0.07, 0]} castShadow>
          <meshStandardMaterial color="#e5ba8a" roughness={0.75} />
        </RoundedBox>
        {surfCols.map((c, i) => (
          <mesh key={i} position={[-0.78 + i * 0.52, 1.05, 0]} rotation={[0.12, 0, 0]} scale={[0.42, 1.9, 0.12]} castShadow>
            <sphereGeometry args={[0.55, 12, 10]} />
            <meshStandardMaterial color={c} roughness={0.35} />
          </mesh>
        ))}
      </group>

      {/* Pastel plaj duşu */}
      <group position={[-17.5, 0, BEACH.z - 10]}>
        <RoundedBox args={[1.1, 0.08, 1.1]} radius={0.03} position={[0, 0.04, 0]} receiveShadow>
          <meshStandardMaterial color="#d8a878" roughness={0.8} />
        </RoundedBox>
        <mesh position={[0, 1.2, -0.35]} castShadow>
          <cylinderGeometry args={[0.05, 0.06, 2.4, 10]} />
          <meshStandardMaterial color="#7fcdf3" roughness={0.35} />
        </mesh>
        <mesh position={[0, 2.35, -0.08]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.55, 10]} />
          <meshStandardMaterial color="#7fcdf3" roughness={0.35} />
        </mesh>
        <mesh position={[0, 2.24, 0.18]}>
          <coneGeometry args={[0.16, 0.14, 12]} />
          <meshStandardMaterial color="#ffd35e" roughness={0.35} />
        </mesh>
      </group>

      {/* Soğutucu çantalar (cooler) + can simidi */}
      {[
        [10.5, BEACH.z + 11, '#7fcdf3', 0.4],
        [-11.5, BEACH.z + 14, '#ff8a7a', -0.6],
        [20, BEACH.z + 14, '#8fdcb4', 0.2],
      ].map(([x, z, c, ry], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, ry, 0]}>
          <RoundedBox args={[0.72, 0.46, 0.46]} radius={0.07} position={[0, 0.23, 0]} castShadow>
            <meshStandardMaterial color={c} roughness={0.4} />
          </RoundedBox>
          <RoundedBox args={[0.76, 0.1, 0.5]} radius={0.04} position={[0, 0.48, 0]} castShadow>
            <meshStandardMaterial color="#fffaf2" roughness={0.4} />
          </RoundedBox>
        </group>
      ))}

      {/* Deniz yıldızları ve kabuklar */}
      {[
        [-4.5, BEACH.z + 25, '#ff8a7a'],
        [6.8, BEACH.z + 27, '#ffd35e'],
        [16.2, BEACH.z + 23, '#ff9ec7'],
        [-16.4, BEACH.z + 26, '#ffb48c'],
        [2.4, BEACH.z + 30, '#ff8a7a'],
      ].map(([x, z, c], i) => (
        <mesh key={i} position={[x, 0.04, z]} rotation={[-Math.PI / 2, 0, i * 0.9]}>
          <circleGeometry args={[0.24, 5]} />
          <meshStandardMaterial color={c} roughness={0.55} />
        </mesh>
      ))}
    </group>
  )
}

// ---------- 4B. YAZ AKŞAMI SAHİL ATEŞİ VE BAMBU FENERLER ----------
const BONFIRE_POS = [4.8, 67.2]
const TIKI_SPOTS = [
  [-2.8, 97.6],
  [2.8, 97.6],
  [-6.2, 34.8],
  [6.2, 34.8],
]

function BeachEveningDecor() {
  const fireLight = useRef()
  const embersRef = useRef([])
  const innerRef = useRef()
  const torchFlames = useRef([])
  const [lightOn, setLightOn] = useState(false)
  const lightOnRef = useRef(false)
  const embers = useMemo(
    () => Array.from({ length: 8 }, (_, i) => ({ phase: i / 8, rad: 0.14 + (i % 3) * 0.08, spd: 0.48 + (i % 4) * 0.09 })),
    [],
  )

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const lit = skyLive.lit
    const near = Math.hypot(playerPos.x - BONFIRE_POS[0], playerPos.z - BONFIRE_POS[1]) < 24
    const wantLight = lit > 0.05 && near
    if (wantLight !== lightOnRef.current) {
      lightOnRef.current = wantLight
      setLightOn(wantLight)
    }
    if (innerRef.current) {
      const p = 0.92 + Math.sin(t * 10) * 0.08 + Math.cos(t * 17) * 0.04
      innerRef.current.scale.set(p, 0.95 + Math.sin(t * 13) * 0.14, p)
      innerRef.current.rotation.y = t * 1.2
    }
    embersRef.current.forEach((m, i) => {
      if (!m) return
      const e = embers[i]
      const k = (t * e.spd + e.phase) % 1
      const a = e.phase * Math.PI * 2 + t * 1.8
      m.position.set(
        BONFIRE_POS[0] + Math.cos(a) * e.rad * (0.4 + k * 0.9),
        0.38 + k * 1.05,
        BONFIRE_POS[1] + Math.sin(a) * e.rad * (0.4 + k * 0.9),
      )
      const s = Math.sin(k * Math.PI) * (0.7 + lit * 0.4)
      m.scale.setScalar(Math.max(0.01, s))
    })
    if (fireLight.current) {
      fireLight.current.intensity = lit * (6.2 + Math.sin(t * 11) * 0.85 + Math.cos(t * 17) * 0.5)
      fireLight.current.position.set(
        BONFIRE_POS[0] + Math.sin(t * 13) * 0.05,
        0.95 + Math.cos(t * 9) * 0.04,
        BONFIRE_POS[1] + Math.cos(t * 11) * 0.05,
      )
    }
    torchFlames.current.forEach((m, i) => {
      if (!m) return
      m.visible = lit > 0.02
      const pulse = 0.85 + Math.sin(t * 10 + i * 2.1) * 0.18
      m.scale.set(pulse, (0.7 + lit * 0.5) * pulse, pulse)
    })
  })

  return (
    <group>
      {/* Sahil yaz akşamı şenlik ateşi (Meshy GLB + hareketli köz/kıvılcım + titreyen ışık) */}
      <Suspense fallback={null}>
        <Prop model="/models/beach/campfire.glb" x={BONFIRE_POS[0]} z={BONFIRE_POS[1]} scale={1.75} />
      </Suspense>
      <group ref={innerRef} position={[BONFIRE_POS[0], 0.48, BONFIRE_POS[1]]}>
        <mesh>
          <sphereGeometry args={[0.16, 10, 8]} />
          <meshBasicMaterial color="#ff9d47" transparent opacity={0.45} depthWrite={false} />
        </mesh>
      </group>
      {embers.map((_, i) => (
        <mesh key={i} ref={(m) => (embersRef.current[i] = m)}>
          <octahedronGeometry args={[0.045, 0]} />
          <meshBasicMaterial color={i % 2 === 0 ? '#ffd35e' : '#ff8c42'} />
        </mesh>
      ))}
      {lightOn && <pointLight ref={fireLight} position={[BONFIRE_POS[0], 0.95, BONFIRE_POS[1]]} color="#ff9f45" intensity={0} distance={14} decay={2} />}

      {/* Bambu sahil fenerleri */}
      {TIKI_SPOTS.map(([tx, tz], i) => (
        <group key={i} position={[tx, 0, tz]}>
          <mesh position={[0, 0.9, 0]} castShadow>
            <cylinderGeometry args={[0.055, 0.075, 1.8, 8]} />
            <ClayMat color="#cfa06e" roughness={0.78} />
          </mesh>
          <mesh position={[0, 1.82, 0]} castShadow>
            <cylinderGeometry args={[0.17, 0.11, 0.24, 10]} />
            <ClayMat color="#7d5336" roughness={0.7} />
          </mesh>
          <mesh ref={(el) => (torchFlames.current[i] = el)} position={[0, 2.04, 0]} visible={false}>
            <coneGeometry args={[0.1, 0.26, 7]} />
            <meshStandardMaterial color="#ffbf5e" emissive="#ff8d2e" emissiveIntensity={2.1} roughness={0.25} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---------- 5. YEMLENEN MARTILAR VE KUŞLAR (etkileşimsiz atmosfer hayvanları) ----------
const BIRDS = [
  // Sahildeki martılar
  { x: -7, z: BEACH.z + 24, r: 2.2, sp: 0.7, ph: 0.2, kind: 'gull' },
  { x: 9, z: BEACH.z + 26, r: 2.5, sp: 0.65, ph: 1.5, kind: 'gull' },
  { x: 18, z: BEACH.z + 18, r: 1.9, sp: 0.8, ph: 2.8, kind: 'gull' },
  { x: -18, z: BEACH.z + 19, r: 2.3, sp: 0.75, ph: 4.1, kind: 'gull' },
  { x: 1.5, z: BEACH.z + 29, r: 2.0, sp: 0.6, ph: 5.0, kind: 'gull' },
  // Meydan & park kuşları
  { x: 4.5, z: 3.5, r: 1.6, sp: 0.9, ph: 0.7, kind: 'pigeon' },
  { x: -5.2, z: -2.5, r: 1.8, sp: 0.85, ph: 2.2, kind: 'pigeon' },
  { x: -25, z: -3.2, r: 2.0, sp: 0.8, ph: 3.6, kind: 'pigeon' },
]

function TownBirds() {
  const refs = useRef([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    BIRDS.forEach((b, i) => {
      const g = refs.current[i]
      if (!g) return
      const a = t * b.sp + b.ph
      // Doğal dairesel yürüyüş + pürüzsüz yemlenme eğilmesi
      const peckWave = Math.max(0, Math.sin(t * 1.4 + b.ph * 1.7))
      const peck = peckWave * peckWave * 0.42
      const hop = Math.abs(Math.sin(t * 4.2 + b.ph)) * 0.045 * (1 - peckWave)
      const nx = b.x + Math.cos(a) * b.r
      const nz = b.z + Math.sin(a) * b.r
      const vx = -Math.sin(a)
      const vz = Math.cos(a)
      g.position.set(nx, 0.14 + hop, nz)
      g.rotation.y = Math.atan2(vx, vz)
      g.rotation.x = peck
    })
  })
  return (
    <group>
      {BIRDS.map((b, i) => {
        const isGull = b.kind === 'gull'
        return (
          <group key={i} ref={(el) => (refs.current[i] = el)} position={[b.x, 0.14, b.z]} scale={isGull ? 1.15 : 0.85}>
            <mesh castShadow>
              <sphereGeometry args={[0.16, 10, 8]} />
              <meshStandardMaterial color={isGull ? '#ffffff' : '#b8c0d8'} roughness={0.65} />
            </mesh>
            <mesh position={[0, 0.14, 0.12]}>
              <sphereGeometry args={[0.1, 10, 8]} />
              <meshStandardMaterial color={isGull ? '#ffffff' : '#9ca6c4'} roughness={0.65} />
            </mesh>
            {/* Gaga */}
            <mesh position={[0, 0.13, 0.24]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.035, 0.12, 6]} />
              <meshStandardMaterial color={isGull ? '#ffb703' : '#f59e0b'} roughness={0.5} />
            </mesh>
            {/* Kanatlar */}
            {[-0.14, 0.14].map((wx) => (
              <mesh key={wx} position={[wx, 0.02, -0.02]} scale={[0.35, 0.6, 1.15]}>
                <sphereGeometry args={[0.14, 8, 6]} />
                <meshStandardMaterial color={isGull ? '#d8e4f0' : '#7a84a3'} roughness={0.7} />
              </mesh>
            ))}
          </group>
        )
      })}
    </group>
  )
}

// ---------- 6. SAHİLDE KOCAMAN FİZİKSEL PLAJ TOPU (şut çekince fırlar, sahilden çıkamaz) ----------
const BALL_R = 1.15
const BALL_MAX_R = BEACH.r - 3.2

function GiantBeachBall({ focusRef }) {
  const ref = useRef()
  const st = useRef({
    x: BEACH.x + 6.5,
    z: BEACH.z + 5.5,
    y: BALL_R,
    vx: 0,
    vz: 0,
    vy: 0,
    kickCd: 0,
  })

  const panels = useMemo(
    () => [
      { rot: 0, c: '#ff7e70' },
      { rot: (Math.PI * 2) / 6, c: '#fffaf2' },
      { rot: (Math.PI * 4) / 6, c: '#7fcdf3' },
      { rot: (Math.PI * 6) / 6, c: '#fffaf2' },
      { rot: (Math.PI * 8) / 6, c: '#ffd35e' },
      { rot: (Math.PI * 10) / 6, c: '#8fdcb4' },
    ],
    [],
  )

  useFrame((_, rawDt) => {
    const g = ref.current
    if (!g) return
    const dt = Math.min(rawDt, 0.05)
    const b = st.current
    b.kickCd = Math.max(0, b.kickCd - dt)

    // Oyuncu çarpışması → sert şut!
    const f = focusRef?.current
    if (f) {
      const dx = b.x - f.x
      const dz = b.z - f.z
      const dist = Math.hypot(dx, dz)
      const hitDist = BALL_R + 0.55
      if (dist < hitDist && dist > 0.001) {
        const nx = dx / dist
        const nz = dz / dist
        b.x = f.x + nx * hitDist
        b.z = f.z + nz * hitDist
        if (b.kickCd <= 0) {
          // Şut çekmişçesine hızlı fırlama + zıplama
          const power = 14.5 + Math.random() * 4
          b.vx = nx * power + (Math.random() - 0.5) * 2.2
          b.vz = nz * power + (Math.random() - 0.5) * 2.2
          b.vy = 5.4 + Math.random() * 1.8
          b.kickCd = 0.22
          window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
        }
      }
    }

    // Yerçekimi ve zıplama
    b.vy -= 18 * dt
    b.y += b.vy * dt
    if (b.y < BALL_R) {
      b.y = BALL_R
      if (b.vy < -1.6) b.vy = -b.vy * 0.62
      else b.vy = 0
    }

    // Yatay hareket ve kum sürtünmesi
    b.x += b.vx * dt
    b.z += b.vz * dt
    const drag = Math.exp(-dt * (b.y > BALL_R + 0.05 ? 0.55 : 1.75))
    b.vx *= drag
    b.vz *= drag
    if (Math.hypot(b.vx, b.vz) < 0.04) {
      b.vx = 0
      b.vz = 0
    }

    // Sahil sınırında elastik sekme (asla sahil dışına çıkamaz)
    const bx = b.x - BEACH.x
    const bz = b.z - BEACH.z
    const r = Math.hypot(bx, bz)
    if (r > BALL_MAX_R) {
      const nx = bx / r
      const nz = bz / r
      b.x = BEACH.x + nx * BALL_MAX_R
      b.z = BEACH.z + nz * BALL_MAX_R
      const dot = b.vx * nx + b.vz * nz
      if (dot > 0) {
        b.vx -= 1.8 * dot * nx
        b.vz -= 1.8 * dot * nz
      }
    }

    g.position.set(b.x, b.y, b.z)
    // Hıza göre yuvarlanma dönüşü
    g.rotation.z -= (b.vx * dt) / BALL_R
    g.rotation.x += (b.vz * dt) / BALL_R
  })

  return (
    <group ref={ref} position={[BEACH.x + 6.5, BALL_R, BEACH.z + 5.5]}>
      {panels.map((p, i) => (
        <mesh key={i} rotation={[0, p.rot, 0]} castShadow receiveShadow>
          <sphereGeometry args={[BALL_R, 12, 16, 0, (Math.PI * 2) / 6]} />
          <meshStandardMaterial color={p.c} roughness={0.28} />
        </mesh>
      ))}
      <mesh position={[0, BALL_R - 0.02, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.08, 16]} />
        <meshStandardMaterial color="#fffaf2" roughness={0.3} />
      </mesh>
      <mesh position={[0, -BALL_R + 0.02, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.08, 16]} />
        <meshStandardMaterial color="#fffaf2" roughness={0.3} />
      </mesh>
    </group>
  )
}

export default function TownDetails({ focusRef }) {
  return (
    <group>
      <DiverseTrees />
      <TownBushes />
      <TrashBins />
      <BeachExtras />
      <BeachEveningDecor />
      <TownBirds />
      <GiantBeachBall focusRef={focusRef} />
    </group>
  )
}
