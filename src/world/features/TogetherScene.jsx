// "Birlikte yapılan şeyler"in 3D parçaları (Canvas içinde): dans efektleri, fotoğraf noktası işareti ve kare alma.
import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { PHOTO_SPOT } from '../layout'
import { together } from './togetherStore'

/** Canvas'tan kare alır: aynı olay turunda yeniden çizip okuduğu için preserveDrawingBuffer gerekmez. */
function Capturer() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    together.capture = () => {
      gl.render(scene, camera)
      return { url: gl.domElement.toDataURL('image/png'), w: gl.domElement.width, h: gl.domElement.height }
    }
    return () => {
      together.capture = null
    }
  }, [gl, scene, camera])
  return null
}

const FLOAT_EMOJIS = ['💗', '✨', '💞', '⭐', '🌸', '💖']

/** Dans eden çiftlerin çevresinde süzülen emojiler (en çok 14 adet). */
function Floaters() {
  const [items, setItems] = useState([])
  const clock = useRef(0)
  const seq = useRef(0)

  useFrame((_, dt) => {
    clock.current += dt
    if (clock.current < 0.45) return
    clock.current = 0
    const spawn = []
    const add = (x, z, spread = 0.7) => {
      const k = seq.current++
      spawn.push({ k, x: x + (Math.random() - 0.5) * spread * 2, z: z + (Math.random() - 0.5) * spread * 2, y: 1.0 + Math.random() * 0.8, e: FLOAT_EMOJIS[k % FLOAT_EMOJIS.length], born: performance.now() })
    }
    // dans: her çiftten tek kez (davet eden tarafı) — kendi dansım dahil
    const s = together.self.current
    if (s?.kind === 'dance' && s.lead) add(s.cx, s.cz, 0.9)
    for (const p of together.poses.values()) if (p.kind === 'dance' && p.lead) add(p.cx, p.cz, 0.9)
    if (!spawn.length) {
      setItems((l) => (l.length ? l.filter((i) => performance.now() - i.born < 2600) : l))
      return
    }
    const now = performance.now()
    setItems((l) => [...l.filter((i) => now - i.born < 2600), ...spawn].slice(-14))
  })
  return items.map((i) => (
    <Html key={i.k} position={[i.x, i.y, i.z]} center zIndexRange={[7, 0]} style={{ pointerEvents: 'none' }}>
      <span className="block text-2xl [animation:together-rise_2.5s_ease-out_forwards]">{i.e}</span>
    </Html>
  ))
}

/** Fotoğraf Stüdyosu'nun önündeki işaret. */
function PhotoSpotMark() {
  const ring = useRef()
  // drei <Html> ilk çizim turunda bağlanırsa React 19 "synchronously unmount a root" uyarısı veriyor: etiketi kısa gecikmeyle bağla
  const [label, setLabel] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setLabel(true), 1200)
    return () => clearTimeout(t)
  }, [])
  useFrame(({ clock }) => {
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 2.2) * 0.06)
  })
  return (
    <group position={[PHOTO_SPOT.x, 0, PHOTO_SPOT.z]}>
      <mesh ref={ring} position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.05, 1.35, 40]} />
        <meshStandardMaterial color="#fec172" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.115, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.05, 40]} />
        <meshStandardMaterial color="#fff8f0" roughness={0.9} />
      </mesh>
      {label && (
        <Html position={[0, 1.75, 0]} center distanceFactor={14} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <div className="inline-flex w-max items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-white bg-white/95 px-3 py-1 text-xs font-extrabold text-[#4a3b5c] shadow-md">
            <span>📸</span>
            <span>Fotoğraf noktası</span>
          </div>
        </Html>
      )}
    </group>
  )
}

export default function TogetherScene({ home }) {
  return (
    <>
      <Capturer />
      {!home && <PhotoSpotMark />}
      <Floaters />
    </>
  )
}
