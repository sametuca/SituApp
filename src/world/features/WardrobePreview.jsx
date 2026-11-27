// Gardırop canlı 3B önizlemesi: kamera, sahne, evcil hayvan.
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import AvatarRig from '../AvatarRig'
import { PetModel } from '../Pet'
import { cosStore } from '../cosStore'
// ---------- gardırop önizlemesi ----------
export function PreviewCam({ zoomMode, controlsRef }) {
  const { camera } = useThree()
  useEffect(() => {
    if (import.meta.env.DEV && window.__previewCam) return
    const close = zoomMode === 'close'
    camera.position.set(0, close ? 1.18 : 1.02, close ? 1.48 : 2.75)
    if (controlsRef.current) {
      controlsRef.current.target.set(close ? -0.22 : 0, close ? 0.98 : 0.74, 0)
      controlsRef.current.update()
    } else {
      camera.lookAt(close ? -0.22 : 0, close ? 0.98 : 0.74, 0)
    }
  }, [zoomMode, camera, controlsRef])
  return null
}

export function PreviewStage({ slug, poseMode, zoomMode }) {
  const pet = useRef()
  const controls = useRef()
  const t = useRef(0)
  const dancePose = useMemo(() => ({ current: poseMode === 'dance' ? { kind: 'dance', lead: true, t0: 0 } : null }), [poseMode])

  useFrame((_, dt) => {
    t.current += dt
    if (pet.current) pet.current.position.y = Math.max(0, Math.sin(t.current * 2.2)) ** 6 * 0.1
  })
  return (
    <>
      <PreviewCam zoomMode={zoomMode} controlsRef={controls} />
      <ambientLight intensity={0.95} />
      <hemisphereLight args={['#ffffff', '#ffedd6', 1.25]} />
      <directionalLight position={[2, 4, 3]} intensity={1.45} />
      {/* stüdyo podyumu */}
      <group position={[-0.22, -0.05, 0]}>
        <mesh>
          <cylinderGeometry args={[0.58, 0.64, 0.1, 40]} />
          <meshStandardMaterial color="#f5e6ff" roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.052, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.45, 0.5, 40]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
        </mesh>
      </group>
      <group position={[-0.22, 0, 0]} rotation={[0, import.meta.env.DEV && window.__previewAngle !== undefined ? window.__previewAngle : 0, 0]}>
        <Suspense fallback={null}>
          <AvatarRig slug={slug} anim={poseMode === 'walk' ? 'walk' : 'idle'} pose={poseMode === 'dance' ? dancePose : undefined} cosId="preview" />
        </Suspense>
      </group>
      <group position={[0.72, 0, 0.2]} rotation={[0, -0.45, 0]}>
        <group ref={pet}>
          <PreviewPet />
        </group>
      </group>
      <OrbitControls
        ref={controls}
        enablePan={false}
        minDistance={1.1}
        maxDistance={3.6}
        minPolarAngle={0.6}
        maxPolarAngle={Math.PI / 1.95}
      />
    </>
  )
}

/** Geliştirme: window.__previewCam = [x, y, z, hedefY] ile önizleme kamerasını yaklaştır (aksesuar ayarı için). */
export function DevCam() {
  useFrame(({ camera }) => {
    const c = window.__previewCam
    if (!c) return
    camera.position.set(c[0], c[1], c[2])
    camera.lookAt(0, c[3], 0)
  })
  return null
}

export function PreviewPet() {
  const [kind, setKind] = useState(() => cosStore.get('preview')?.pet ?? null)
  useEffect(() => {
    setKind(cosStore.get('preview')?.pet ?? null)
    return cosStore.subscribe(() => setKind(cosStore.get('preview')?.pet ?? null))
  }, [])
  return kind ? <PetModel kind={kind} /> : null
}

/** İlk giriş: 1 haftalık ücretsiz evcil hayvan seçimi (kedi ya da köpek). */
