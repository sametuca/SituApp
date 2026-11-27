// Asset Studio için basit GLB görüntüleyici.
import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { useGLTF, OrbitControls, Environment, ContactShadows, Center } from '@react-three/drei'

function GLTFModel({ url }) {
  const { scene } = useGLTF(url)
  return <Center><primitive object={scene} /></Center>
}

export default function ModelViewer({ url, className = 'w-full h-full' }) {
  if (!url) return null
  return (
    <div className={className}>
      <Canvas camera={{ position: [0, 1.2, 3], fov: 45 }} shadows>
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 5, 2]} intensity={1.2} castShadow />
        <Environment preset="studio" />
        <Suspense fallback={null}>
          <GLTFModel url={url} />
        </Suspense>
        <ContactShadows position={[0, -1, 0]} opacity={0.4} scale={6} blur={2} far={2} />
        <OrbitControls enablePan={false} minDistance={1.5} maxDistance={5} />
      </Canvas>
    </div>
  )
}
