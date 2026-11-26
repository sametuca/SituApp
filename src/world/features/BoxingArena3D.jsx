import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'

function Boxer3D({ x, facing, bodyCol, gloveCol, stateRef, isSelf }) {
  const root = useRef()
  const body = useRef()
  const head = useRef()
  const lGlove = useRef()
  const rGlove = useRef()
  const shield = useRef()

  useFrame(({ clock }) => {
    const s = stateRef.current
    const now = Date.now()
    const punch = isSelf ? s.youPunch : s.oppPunch
    const pType = isSelf ? s.youType : s.oppType
    const hit = isSelf ? s.oppPunch : s.youPunch
    const shielded = isSelf ? s.shieldUntil > now : s.oppShieldUntil > now
    const t = clock.elapsedTime + (isSelf ? 0 : 1.7)
    const bob = Math.sin(t * 4.5) * 0.05

    if (root.current) {
      const lunge = punch > 0 ? Math.sin(punch * Math.PI) * 0.52 * facing : 0
      const recoil = hit > 0.25 ? -Math.sin(((hit - 0.25) / 0.75) * Math.PI) * 0.28 * facing : 0
      root.current.position.set(x + lunge + recoil, 0.22 + Math.abs(bob) * 0.4, 0)
      root.current.rotation.y = facing > 0 ? Math.PI / 2 : -Math.PI / 2
    }
    if (body.current) {
      body.current.rotation.x = punch * 0.22 - (hit > 0.25 ? 0.2 : 0)
      body.current.rotation.y = pType === 'hook' ? punch * 0.42 : 0
    }
    if (head.current) {
      head.current.rotation.x = hit > 0.25 ? -0.35 * hit : Math.sin(t * 2.2) * 0.04
    }
    if (lGlove.current && rGlove.current) {
      const guardY = shielded ? 1.38 : 1.16 + bob * 0.5
      const guardZ = shielded ? 0.48 : 0.44
      // Sol el (Jab)
      const jabExt = pType === 'jab' ? Math.sin(punch * Math.PI) * 0.95 : 0
      lGlove.current.position.set(-0.3 + (shielded ? 0.14 : 0), guardY, guardZ + jabExt)
      // Sağ el (Kroşe / Aparkat)
      const hookX = pType === 'hook' ? Math.sin(punch * Math.PI) * -0.26 : 0
      const hookZ = pType === 'hook' ? Math.sin(punch * Math.PI) * 0.9 : pType === 'upper' ? Math.sin(punch * Math.PI) * 0.68 : 0
      const upperY = pType === 'upper' ? Math.sin(punch * Math.PI) * 0.52 : 0
      rGlove.current.position.set(0.3 - (shielded ? 0.14 : 0) + hookX, guardY + upperY, guardZ + hookZ)
    }
    if (shield.current) {
      shield.current.visible = shielded
      if (shielded) shield.current.rotation.y = t * 1.4
    }
  })

  return (
    <group ref={root} position={[x, 0.22, 0]}>
      <group ref={body}>
        {/* Boks şortu & gövde */}
        <RoundedBox args={[0.62, 0.72, 0.44]} radius={0.16} smoothness={3} position={[0, 0.78, 0]} castShadow>
          <meshStandardMaterial color={bodyCol} roughness={0.55} />
        </RoundedBox>
        <mesh position={[0, 0.62, 0]}>
          <boxGeometry args={[0.64, 0.14, 0.46]} />
          <meshStandardMaterial color="#fffaf2" roughness={0.5} />
        </mesh>
        {/* Bacaklar & boks ayakkabıları */}
        {[-0.17, 0.17].map((lx, i) => (
          <group key={i} position={[lx, 0.24, 0]}>
            <mesh castShadow>
              <capsuleGeometry args={[0.1, 0.28, 6, 10]} />
              <meshStandardMaterial color="#ffe0c2" roughness={0.62} />
            </mesh>
            <RoundedBox args={[0.2, 0.14, 0.3]} radius={0.05} position={[0, -0.2, 0.04]} castShadow>
              <meshStandardMaterial color={gloveCol} roughness={0.45} />
            </RoundedBox>
          </group>
        ))}
        {/* Kafa & saç bandı */}
        <group ref={head} position={[0, 1.42, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.3, 16, 14]} />
            <meshStandardMaterial color="#ffe0c2" roughness={0.58} />
          </mesh>
          <mesh position={[0, 0.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.295, 0.045, 8, 20]} />
            <meshStandardMaterial color={gloveCol} roughness={0.45} />
          </mesh>
          {[-0.1, 0.1].map((ex, i) => (
            <mesh key={i} position={[ex, 0.02, 0.27]}>
              <sphereGeometry args={[0.042, 8, 8]} />
              <meshStandardMaterial color="#2f2247" roughness={0.3} />
            </mesh>
          ))}
        </group>
      </group>
      {/* Sol ve sağ 3B boks eldivenleri */}
      <mesh ref={lGlove} position={[-0.3, 1.16, 0.44]} castShadow>
        <sphereGeometry args={[0.17, 14, 12]} />
        <meshStandardMaterial color={gloveCol} roughness={0.36} />
      </mesh>
      <mesh ref={rGlove} position={[0.3, 1.16, 0.44]} castShadow>
        <sphereGeometry args={[0.17, 14, 12]} />
        <meshStandardMaterial color={gloveCol} roughness={0.36} />
      </mesh>
      {/* Blok kalkanı */}
      <mesh ref={shield} position={[0, 1.0, 0.25]} visible={false}>
        <sphereGeometry args={[0.85, 18, 14]} />
        <meshStandardMaterial color="#b79cff" emissive="#9b7be8" emissiveIntensity={0.65} transparent opacity={0.28} wireframe />
      </mesh>
    </group>
  )
}

function HitSparks({ stateRef }) {
  const group = useRef()
  const seeds = useMemo(() => Array.from({ length: 10 }, (_, i) => ({ a: (i / 10) * Math.PI * 2, y: (i % 3 - 1) * 0.25 })), [])
  useFrame(() => {
    const g = group.current
    if (!g) return
    const s = stateRef.current
    const power = Math.max(s.youPunch, s.oppPunch)
    const active = power > 0.35
    g.visible = active
    if (!active) return
    const k = (1 - power) * 1.4
    g.children.forEach((m, i) => {
      const sd = seeds[i]
      m.position.set(Math.cos(sd.a) * k * 0.4, 1.25 + sd.y + Math.sin(sd.a) * k * 0.35, Math.sin(sd.a) * k * 0.4)
      m.scale.setScalar(Math.max(0.1, power * 0.9))
    })
  })
  return (
    <group ref={group} visible={false}>
      {seeds.map((_, i) => (
        <mesh key={i}>
          <octahedronGeometry args={[0.09, 0]} />
          <meshBasicMaterial color={i % 2 ? '#ffd35e' : '#ffffff'} />
        </mesh>
      ))}
    </group>
  )
}

function ArenaCamera({ stateRef }) {
  useFrame(({ camera, clock }) => {
    const s = stateRef.current
    const t = clock.elapsedTime
    const sx = s.shake > 0 ? (Math.random() - 0.5) * 0.35 * s.shake : 0
    const sy = s.shake > 0 ? (Math.random() - 0.5) * 0.24 * s.shake : 0
    camera.position.set(Math.sin(t * 0.4) * 0.25 + sx, 2.55 + sy, 5.45)
    camera.lookAt(0, 1.15, 0)
  })
  return null
}

function RingStage() {
  const posts = [
    [-2.7, -2.2, '#ff8a7a'],
    [2.7, -2.2, '#7fcdf3'],
    [-2.7, 2.2, '#ff8a7a'],
    [2.7, 2.2, '#7fcdf3'],
  ]
  const ropes = [
    { y: 0.72, c: '#7fcdf3' },
    { y: 1.08, c: '#ffffff' },
    { y: 1.44, c: '#ff8a7a' },
  ]
  return (
    <group>
      {/* Ring platformu */}
      <RoundedBox args={[6.0, 0.44, 5.0]} radius={0.08} position={[0, 0, 0]} receiveShadow>
        <meshStandardMaterial color="#fff7ee" roughness={0.85} />
      </RoundedBox>
      <RoundedBox args={[6.3, 0.28, 5.3]} radius={0.06} position={[0, -0.22, 0]}>
        <meshStandardMaterial color="#3b285e" roughness={0.7} />
      </RoundedBox>
      {/* Ring köşe direkleri */}
      {posts.map(([px, pz, col], i) => (
        <group key={i} position={[px, 0.22, pz]}>
          <mesh position={[0, 0.72, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.11, 1.44, 12]} />
            <meshStandardMaterial color={col} roughness={0.4} />
          </mesh>
          <mesh position={[0, 1.48, 0]}>
            <sphereGeometry args={[0.13, 12, 10]} />
            <meshStandardMaterial color="#ffd35e" roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* Arka ve yan ring ipleri (ön kamera tarafı açık) */}
      {ropes.map((r, ri) => (
        <group key={ri}>
          <mesh position={[0, r.y, -2.2]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.032, 0.032, 5.4, 8]} />
            <meshStandardMaterial color={r.c} roughness={0.45} />
          </mesh>
          {[-2.7, 2.7].map((sx, si) => (
            <mesh key={si} position={[sx, r.y, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.032, 0.032, 4.4, 8]} />
              <meshStandardMaterial color={r.c} roughness={0.45} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

export default function BoxingArena3D({ stateRef }) {
  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ fov: 44, position: [0, 2.55, 5.45] }}>
      <color attach="background" args={['#24193d']} />
      <fog attach="fog" args={['#24193d', 8, 22]} />
      <ambientLight intensity={0.75} />
      <hemisphereLight args={['#ffdff5', '#3b285e', 0.9]} />
      <directionalLight position={[3.5, 6.5, 4.5]} intensity={1.7} castShadow shadow-mapSize={[512, 512]} />
      <pointLight position={[-2.2, 4.0, 1.5]} intensity={4} color="#ff9ec7" distance={12} />
      <pointLight position={[2.2, 4.0, 1.5]} intensity={4} color="#7fcdf3" distance={12} />
      <ArenaCamera stateRef={stateRef} />
      <RingStage />
      <Boxer3D x={-1.15} facing={1} bodyCol="#ff8a7a" gloveCol="#ff595e" stateRef={stateRef} isSelf />
      <Boxer3D x={1.15} facing={-1} bodyCol="#7fcdf3" gloveCol="#3b82f6" stateRef={stateRef} isSelf={false} />
      <HitSparks stateRef={stateRef} />
    </Canvas>
  )
}
