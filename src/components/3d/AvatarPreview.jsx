import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF, useAnimations } from '@react-three/drei'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'

const TARGET_Y = 0.6

function Model({ slug }) {
  const { scene, animations } = useGLTF(`/models/avatars/${slug}.glb`)
  const group = useRef()
  const model = useMemo(() => {
    const clone = cloneSkinned(scene)
    clone.traverse((o) => {
      if (o.isMesh) o.frustumCulled = false // skinned mesh'in sınır kutusu yanıltıcı
    })
    return clone
  }, [scene])
  const { actions } = useAnimations(animations, group)
  useEffect(() => {
    actions.idle?.reset().play()
  }, [actions])
  return (
    <group ref={group}>
      <primitive object={model} />
    </group>
  )
}

/** Avatarın bastığı yuvarlak pastel platform. */
function Pedestal({ color }) {
  return (
    <group position={[0, -0.06, 0]}>
      <mesh>
        <cylinderGeometry args={[0.62, 0.68, 0.12, 48]} />
        <meshStandardMaterial color={color} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.062, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.46, 0.5, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
      </mesh>
    </group>
  )
}

/**
 * Şeffaf arka planlı, bekleme animasyonu oynayan avatar önizlemesi.
 * rotatable: fareyle/parmakla sürükleyerek yatay döndürme (yakınlaştırma/kaydırma kapalı).
 * pedestal: platform rengi (verilmezse platform çizilmez).
 */
export default function AvatarPreview({ slug = 'zeynep', className = '', rotatable = false, pedestal }) {
  return (
    <div className={className}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0.65, 2.9], fov: 32 }}
        gl={{ alpha: true }}
        onCreated={({ camera }) => camera.lookAt(0, TARGET_Y, 0)}
      >
        <hemisphereLight args={['#ffffff', '#def7f6', 1.6]} />
        <directionalLight position={[2, 3, 3]} intensity={1.6} />
        <Suspense fallback={null}>
          <Model key={slug} slug={slug} />
          {pedestal && <Pedestal color={pedestal} />}
        </Suspense>
        {rotatable && (
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            target={[0, TARGET_Y, 0]}
            minPolarAngle={Math.PI / 2.2}
            maxPolarAngle={Math.PI / 2.2}
          />
        )}
      </Canvas>
    </div>
  )
}
