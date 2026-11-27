// Boks arenası 3B: boksörler, yumruk & slash izleri, vuruş kıvılcımları ve şok halkası.
import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { RoundedBox, useGLTF } from '@react-three/drei'
import { Box3, DoubleSide, Vector3 } from 'three'
import { fixPropMaterialSeams } from '../avatarTextureFix'

const SLASH_COLORS = {
  jab: '#7fcdf3',
  hook: '#ffd35e',
  upper: '#ff8a7a',
  block: '#b79cff',
}

function BoxerModel({ model, height = 1.65 }) {
  const { scene } = useGLTF(model)
  const { obj, sc } = useMemo(() => {
    const clone = scene.clone(true)
    const box = new Box3().setFromObject(clone)
    const size = box.getSize(new Vector3())
    const c = box.getCenter(new Vector3())
    clone.position.set(-c.x, -box.min.y, -c.z)
    clone.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = o.receiveShadow = true
        fixPropMaterialSeams(o.material)
      }
    })
    const k = size.y > 0.001 ? height / size.y : 1
    return { obj: clone, sc: k }
  }, [scene, height])
  return (
    <group scale={sc}>
      <primitive object={obj} />
    </group>
  )
}

function FallbackBoxer({ bodyCol, gloveCol }) {
  return (
    <group>
      <RoundedBox args={[0.58, 0.72, 0.4]} radius={0.14} smoothness={2} position={[0, 0.78, 0]} castShadow>
        <meshStandardMaterial color={bodyCol} roughness={0.55} />
      </RoundedBox>
      <mesh position={[0, 1.38, 0]} castShadow>
        <sphereGeometry args={[0.28, 14, 12]} />
        <meshStandardMaterial color="#ffe0c2" roughness={0.58} />
      </mesh>
      {[-0.28, 0.28].map((gx, i) => (
        <mesh key={i} position={[gx, 1.12, 0.36]} castShadow>
          <sphereGeometry args={[0.15, 12, 10]} />
          <meshStandardMaterial color={gloveCol} roughness={0.38} />
        </mesh>
      ))}
    </group>
  )
}

function Boxer3D({ x, facing, model, bodyCol, gloveCol, stateRef, isSelf }) {
  const root = useRef()
  const body = useRef()
  const shield = useRef()
  const slashRef = useRef()
  const slashMatRef = useRef()
  const fistRef = useRef()
  const fistMatRef = useRef()

  useFrame(({ clock }) => {
    const s = stateRef.current
    const now = Date.now()
    const punch = isSelf ? s.youPunch : s.oppPunch
    const pType = isSelf ? s.youType : s.oppType
    const hit = isSelf ? s.oppPunch : s.youPunch
    const hitLanded = isSelf ? s.oppHit : s.youHit
    const shielded = isSelf ? s.shieldUntil > now : s.oppShieldUntil > now
    const t = clock.elapsedTime + (isSelf ? 0 : 1.7)
    const bob = Math.sin(t * 5.2) * 0.055

    // Keskin yaylanma: hızlı ileri atılış + akıcı geri çekilme
    const snap = punch > 0 ? Math.pow(Math.sin(punch * Math.PI), 0.65) : 0
    const gotHit = hit > 0.22 && hitLanded ? Math.sin(((hit - 0.22) / 0.78) * Math.PI) : 0

    if (root.current) {
      const lunge = pType === 'block' ? -snap * 0.14 * facing : snap * 0.78 * facing
      const recoil = -gotHit * 0.38 * facing
      const hopY = pType === 'upper' && punch > 0 ? snap * 0.28 : Math.abs(bob) * 0.55
      root.current.position.set(x + lunge + recoil, 0.22 + hopY, 0)
      root.current.rotation.y = facing > 0 ? Math.PI / 2 : -Math.PI / 2
    }

    if (body.current) {
      const punchLean =
        pType === 'upper'
          ? -snap * 0.32
          : pType === 'block'
            ? -snap * 0.12
            : snap * 0.42
      body.current.rotation.x = punchLean - gotHit * 0.34
      body.current.rotation.y =
        pType === 'hook'
          ? Math.sin(punch * Math.PI * 1.15) * 0.78
          : pType === 'jab'
            ? -snap * 0.34
            : Math.sin(t * 2.5) * 0.07
      body.current.rotation.z = gotHit * 0.18
      body.current.scale.set(1 + snap * 0.08, 1 - snap * 0.05 + (pType === 'upper' ? snap * 0.12 : 0), 1 + snap * 0.1)
    }

    // Savurma (Slash) kavisi ve parlak yumruk izi
    const showSlash = punch > 0.08 && pType !== 'block'
    if (slashRef.current) {
      slashRef.current.visible = showSlash
      if (showSlash) {
        const col = SLASH_COLORS[pType] || '#ffd35e'
        if (slashMatRef.current) {
          slashMatRef.current.color.set(col)
          slashMatRef.current.opacity = Math.min(0.92, punch * 1.15)
        }
        const sweep = (1 - punch) * 2.4 - 0.9
        if (pType === 'upper') {
          slashRef.current.position.set(0, 1.05 + snap * 0.45, 0.62 + snap * 0.35)
          slashRef.current.rotation.set(sweep, Math.PI / 2, 0)
        } else if (pType === 'hook') {
          slashRef.current.position.set(0, 1.12, 0.58 + snap * 0.32)
          slashRef.current.rotation.set(Math.PI / 2, 0, sweep)
        } else {
          slashRef.current.position.set(0, 1.14, 0.65 + snap * 0.5)
          slashRef.current.rotation.set(Math.PI / 2 + 0.35, 0.25, sweep * 0.8)
        }
        slashRef.current.scale.setScalar(0.85 + snap * 0.48)
      }
    }

    if (fistRef.current) {
      fistRef.current.visible = showSlash
      if (showSlash) {
        if (fistMatRef.current) {
          fistMatRef.current.color.set(gloveCol)
          fistMatRef.current.emissive.set(SLASH_COLORS[pType] || '#ffd35e')
        }
        const sideX = pType === 'hook' ? Math.cos((1 - punch) * Math.PI) * 0.45 : pType === 'jab' ? -0.15 : 0.12
        const upY = pType === 'upper' ? 0.85 + snap * 0.72 : 1.12
        fistRef.current.position.set(sideX, upY, 0.52 + snap * 0.78)
        fistRef.current.scale.setScalar(0.85 + snap * 0.55)
      }
    }

    if (shield.current) {
      shield.current.visible = shielded
      if (shielded) shield.current.rotation.y = t * 1.8
    }
  })

  return (
    <group ref={root} position={[x, 0.22, 0]}>
      <group ref={body}>
        <Suspense fallback={<FallbackBoxer bodyCol={bodyCol} gloveCol={gloveCol} />}>
          <BoxerModel model={model} />
        </Suspense>
      </group>
      {/* 3B Slash Kavis İzi */}
      <mesh ref={slashRef} visible={false}>
        <torusGeometry args={[0.68, 0.065, 8, 22, Math.PI * 0.88]} />
        <meshBasicMaterial ref={slashMatRef} color="#ffd35e" transparent opacity={0.85} side={DoubleSide} />
      </mesh>
      {/* Atılan Yumruk Eldiven Parlaması */}
      <mesh ref={fistRef} visible={false}>
        <sphereGeometry args={[0.2, 12, 10]} />
        <meshStandardMaterial ref={fistMatRef} color={gloveCol} emissive="#ffd35e" emissiveIntensity={0.65} roughness={0.25} />
      </mesh>
      {/* Blok kalkanı */}
      <mesh ref={shield} position={[0, 1.0, 0.25]} visible={false}>
        <sphereGeometry args={[0.92, 18, 14]} />
        <meshStandardMaterial color="#b79cff" emissive="#9b7be8" emissiveIntensity={0.65} transparent opacity={0.28} wireframe />
      </mesh>
    </group>
  )
}

function HitSparks({ stateRef }) {
  const group = useRef()
  const ringRef = useRef()
  const ringMatRef = useRef()
  const seeds = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ a: (i / 12) * Math.PI * 2, y: ((i % 3) - 1) * 0.26 })), [])
  useFrame(() => {
    const g = group.current
    if (!g) return
    const s = stateRef.current
    const youHitPow = s.youHit ? s.youPunch : 0
    const oppHitPow = s.oppHit ? s.oppPunch : 0
    const power = Math.max(youHitPow, oppHitPow)
    const active = power > 0.22
    g.visible = active
    if (!active) return
    const targetX = youHitPow >= oppHitPow ? 0.55 : -0.55
    g.position.set(targetX, 1.22, 0)
    const k = (1 - power) * 1.55
    g.children.forEach((m, i) => {
      if (m === ringRef.current) return
      const sd = seeds[i]
      if (!sd) return
      m.position.set(Math.cos(sd.a) * k * 0.48, sd.y + Math.sin(sd.a) * k * 0.42, Math.sin(sd.a) * k * 0.48)
      m.scale.setScalar(Math.max(0.12, power * 1.05))
    })
    if (ringRef.current && ringMatRef.current) {
      ringRef.current.scale.setScalar(0.35 + k * 0.95)
      ringMatRef.current.opacity = Math.max(0, power * 0.85)
    }
  })
  return (
    <group ref={group} visible={false}>
      {seeds.map((_, i) => (
        <mesh key={i}>
          <octahedronGeometry args={[0.095, 0]} />
          <meshBasicMaterial color={i % 3 === 0 ? '#ff8a7a' : i % 2 ? '#ffd35e' : '#ffffff'} />
        </mesh>
      ))}
      <mesh ref={ringRef} rotation={[0, Math.PI / 4, 0]}>
        <ringGeometry args={[0.42, 0.56, 24]} />
        <meshBasicMaterial ref={ringMatRef} color="#ffd35e" transparent opacity={0.8} side={DoubleSide} />
      </mesh>
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
      <Boxer3D x={-1.15} facing={1} model="/models/venues/boxer-red.glb" bodyCol="#ff8a7a" gloveCol="#ff595e" stateRef={stateRef} isSelf />
      <Boxer3D x={1.15} facing={-1} model="/models/venues/boxer-blue.glb" bodyCol="#7fcdf3" gloveCol="#3b82f6" stateRef={stateRef} isSelf={false} />
      <HitSparks stateRef={stateRef} />
    </Canvas>
  )
}
