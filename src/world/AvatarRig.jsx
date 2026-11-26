import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import { AnimationMixer } from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { applyPose, applyUprightIdle, makeRig } from './avatarPose'
import { HeadAccessory } from './Accessories'
import { cosStore } from './cosStore'
import { applyLook, trimBase } from './avatarLook'
import { screenK } from './screenK'
import WorkProp from './WorkProp'

export const AVATAR_HEIGHT = 1.3
const FEET_LIFT = 0.085 // en yüksek yer zemini (meydan taşı) 0,08
const RIG_HEIGHT = 1.2 // meshy_rig çağrısındaki height_meters

/** Satın alınan sokak ürünü (dondurma, çiçek, balon, gazete): yeme/keyif animasyonu sırasında avatarın önünde görünür. */
function HandProp({ item, t0 }) {
  const ref = useRef()
  const scoopRef = useRef()
  useFrame(() => {
    const g = ref.current
    if (!g) return
    const t = Math.max(0, performance.now() / 1000 - t0)
    const u = Math.min(1, t / 2.4)
    if (item.style === 'hold') {
      g.position.set(-0.22, 1.05 + Math.sin(t * 3.5) * 0.04, 0.22)
      g.rotation.set(0, 0, Math.sin(t * 3) * 0.1)
    } else if (item.style === 'read') {
      g.position.set(0, 0.72, 0.34)
      g.rotation.set(-0.35, 0, 0)
    } else if (item.style === 'smell') {
      const sway = Math.sin(t * 3.2)
      g.position.set(-0.1 + sway * 0.03, 0.78 + sway * 0.03, 0.28)
      g.rotation.set(-0.25, 0, 0.2)
    } else {
      const bite = Math.sin(t * 7.2)
      g.position.set(-0.11 + bite * 0.025, 0.78 + bite * 0.04, 0.29 + bite * 0.02)
      g.rotation.set(-0.25 + bite * 0.14, 0, 0.18)
      if (scoopRef.current) scoopRef.current.scale.setScalar(Math.max(0.25, 1 - u * 0.72))
    }
  })

  if (item.style === 'hold') {
    return (
      <group ref={ref} position={[-0.22, 1.05, 0.22]}>
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.005, 0.005, 0.36, 4]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 0.44, 0]} scale={[1, 1.12, 1]}>
          <sphereGeometry args={[0.16, 14, 12]} />
          <meshStandardMaterial color={item.color ?? '#ff9ec7'} roughness={0.35} />
        </mesh>
      </group>
    )
  }
  if (item.style === 'read') {
    return (
      <group ref={ref} position={[0, 0.72, 0.34]} rotation={[-0.35, 0, 0]}>
        <mesh position={[-0.1, 0, 0]} rotation={[0, 0.22, 0]}>
          <boxGeometry args={[0.2, 0.26, 0.012]} />
          <meshStandardMaterial color="#fffaf2" roughness={0.9} />
        </mesh>
        <mesh position={[0.1, 0, 0]} rotation={[0, -0.22, 0]}>
          <boxGeometry args={[0.2, 0.26, 0.012]} />
          <meshStandardMaterial color="#f5efe4" roughness={0.9} />
        </mesh>
      </group>
    )
  }
  if (item.style === 'smell') {
    return (
      <group ref={ref} position={[-0.1, 0.78, 0.28]}>
        <mesh position={[0, -0.05, 0]}>
          <cylinderGeometry args={[0.012, 0.014, 0.24, 6]} />
          <meshStandardMaterial color="#67c587" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.09, 0]}>
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshStandardMaterial color={item.color ?? '#ff8fb8'} roughness={0.5} />
        </mesh>
        <mesh position={[0.05, 0.07, 0.02]}>
          <sphereGeometry args={[0.055, 10, 8]} />
          <meshStandardMaterial color="#ffd35e" roughness={0.5} />
        </mesh>
      </group>
    )
  }
  return (
    <group ref={ref} position={[-0.11, 0.78, 0.29]}>
      {/* külah */}
      <mesh position={[0, -0.06, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.065, 0.19, 12]} />
        <meshStandardMaterial color="#e8b36d" roughness={0.75} />
      </mesh>
      {/* yendikçe küçülen dondurma topları */}
      <group ref={scoopRef} position={[0, 0.04, 0]}>
        <mesh position={[0, 0.01, 0]}>
          <sphereGeometry args={[0.072, 12, 10]} />
          <meshStandardMaterial color={item.color ?? '#ff9ec7'} roughness={0.45} />
        </mesh>
        <mesh position={[0.015, 0.085, 0.01]}>
          <sphereGeometry args={[0.056, 12, 10]} />
          <meshStandardMaterial color={item.color2 ?? '#fff3c8'} roughness={0.45} />
        </mesh>
      </group>
    </group>
  )
}

/**
 * Rig'li avatar modeli; anim ('idle' | 'walk' | 'run') değişince yumuşak geçiş yapar.
 * cosId verilirse aksesuarı (cosStore) kafa kemiğine takar.
 * AnimationMixer doğrudan klonlanmış modele bağlanır (drei useAnimations ilk açılışta T-pose'da kalabiliyordu).
 */
/** Şezlong veya havluya uzanınca yanında beliren tropikal kokteyl, tepede pastel şemsiye ve yüzen "zZ Dinleniyor" işareti. */
function LoungeRelaxProps() {
  const root = useRef()
  const scaleRef = useRef(0.01)
  useFrame((_, dt) => {
    if (!root.current) return
    scaleRef.current = Math.min(1, scaleRef.current + dt * 4.2)
    const s = 1 - Math.pow(1 - scaleRef.current, 3)
    root.current.scale.setScalar(s)
  })
  const stripes = 8
  return (
    <group ref={root}>
      {/* sağ yanda mini sehpa + tropikal kokteyl */}
      <group position={[0.58, 0, 0.14]}>
        <mesh position={[0, 0.12, 0]} castShadow>
          <cylinderGeometry args={[0.19, 0.15, 0.24, 16]} />
          <meshStandardMaterial color="#f7d6a8" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.03, 16]} />
          <meshStandardMaterial color="#fff8ee" roughness={0.45} />
        </mesh>
        {/* kokteyl bardağı + pembe içecek + limon dilimi + pipet + mini şemsiye */}
        <group position={[0, 0.27, 0]}>
          <mesh position={[0, 0.08, 0]} castShadow>
            <cylinderGeometry args={[0.068, 0.05, 0.16, 14]} />
            <meshStandardMaterial color="#fffaf5" transparent opacity={0.62} roughness={0.18} />
          </mesh>
          <mesh position={[0, 0.075, 0]}>
            <cylinderGeometry args={[0.058, 0.044, 0.125, 14]} />
            <meshStandardMaterial color="#ff8fb8" roughness={0.3} />
          </mesh>
          <mesh position={[0.048, 0.155, 0]} rotation={[0.3, 0, -0.5]}>
            <cylinderGeometry args={[0.036, 0.036, 0.012, 12]} />
            <meshStandardMaterial color="#ffe066" roughness={0.45} />
          </mesh>
          <mesh position={[-0.015, 0.17, 0]} rotation={[0, 0, 0.26]}>
            <cylinderGeometry args={[0.007, 0.007, 0.18, 6]} />
            <meshStandardMaterial color="#7fe0c3" roughness={0.4} />
          </mesh>
          <group position={[0.025, 0.21, 0.015]} rotation={[0.12, 0, -0.35]}>
            <mesh position={[0, -0.04, 0]}>
              <cylinderGeometry args={[0.004, 0.004, 0.11, 5]} />
              <meshStandardMaterial color="#f5e1c0" />
            </mesh>
            <mesh position={[0, 0.02, 0]}>
              <coneGeometry args={[0.055, 0.028, 8]} />
              <meshStandardMaterial color="#7fcdf3" roughness={0.45} />
            </mesh>
          </group>
        </group>
      </group>

      {/* tepede pastel çizgili pofuduk şemsiye */}
      <group position={[-0.56, 0, -0.34]} rotation={[0.08, 0, -0.14]}>
        <mesh position={[0, 0.96, 0]} castShadow>
          <cylinderGeometry args={[0.026, 0.032, 1.92, 10]} />
          <meshStandardMaterial color="#fff8ee" roughness={0.45} />
        </mesh>
        <group position={[0, 1.88, 0]}>
          {Array.from({ length: stripes }, (_, i) => (
            <mesh key={i} rotation={[0, (i / stripes) * Math.PI * 2, 0]} castShadow>
              <coneGeometry args={[1.08, 0.36, 4, 1, false, 0, (Math.PI * 2) / stripes]} />
              <meshStandardMaterial color={i % 2 === 0 ? '#ffa3c4' : '#fff8ee'} roughness={0.45} />
            </mesh>
          ))}
          <mesh position={[0, -0.16, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.04, 0.04, 8, 24]} />
            <meshStandardMaterial color="#ffd35e" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.21, 0]}>
            <sphereGeometry args={[0.075, 12, 10]} />
            <meshStandardMaterial color="#ffd35e" roughness={0.3} />
          </mesh>
        </group>
      </group>

      {/* tepede yüzen zZ Dinleniyor işareti */}
      <Html position={[0, 1.28, -0.15]} center distanceFactor={9 * screenK()} zIndexRange={[9, 0]} style={{ pointerEvents: 'none' }}>
        <div className="flex flex-col items-center">
          <div className="mb-0.5 flex items-end gap-0.5 font-black text-[#7a5fd0] drop-shadow-[0_2px_4px_rgba(255,255,255,0.95)]">
            <span className="animate-bounce text-xs" style={{ animationDelay: '0s' }}>z</span>
            <span className="animate-bounce text-sm" style={{ animationDelay: '0.18s' }}>Z</span>
            <span className="animate-bounce text-base" style={{ animationDelay: '0.36s' }}>z</span>
          </div>
          <div className="whitespace-nowrap rounded-full border-2 border-white bg-[#fffaf4]/95 px-3 py-0.5 text-xs font-black text-[#5b4678] shadow-[0_4px_12px_rgba(74,59,92,0.18)]">
            Dinleniyor
          </div>
        </div>
      </Html>
    </group>
  )
}

export default function AvatarRig({ slug, anim = 'idle', pose, cosId, halfRate = false }) {
  const { scene, animations } = useGLTF(`/models/avatars/${slug}.glb`)
  const current = useRef(null)
  const [handProp, setHandProp] = useState(null)
  const [lounging, setLounging] = useState(false)
  const handKeyRef = useRef('')
  const loungeRef = useRef(false)
  const liftRef = useRef(null)
  const halfRateRef = useRef(halfRate)
  const skipRef = useRef({ acc: 0, odd: false })
  useEffect(() => {
    halfRateRef.current = halfRate
  }, [halfRate])
  const look = useSyncExternalStore(cosStore.subscribe, () => cosStore.get(cosId)?.look ?? null)
  const lookKey = look ? `${look.h}.${look.e}.${look.o}` : ''

  const model = useMemo(() => {
    const clone = cloneSkinned(scene)
    // Skinned mesh'in Box3'ü kemik birimleri yüzünden yanıltıcı; rig 1.2 m, sabit ölçek uygula.
    clone.scale.multiplyScalar(AVATAR_HEIGHT / RIG_HEIGHT)
    clone.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = false
        o.frustumCulled = false
        if (o.material && !Array.isArray(o.material)) {
          o.material = o.material.clone()
          o.material.metalness = 0
          o.material.roughness = Math.max(o.material.roughness ?? 0.72, 0.72)
          o.material.envMapIntensity = 0.25
        }
      }
    })
    trimBase(clone, slug)
    if (look) applyLook(clone, slug, look)
    return clone
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, lookKey])

  const mixer = useMemo(() => new AnimationMixer(model), [model])
  const rig = useMemo(() => makeRig(model), [model]) // oturma/dans için procedural duruş katmanı (pose: { current })
  const actions = useMemo(() => Object.fromEntries(animations.map((clip) => [clip.name, mixer.clipAction(clip)])), [animations, mixer])

  useEffect(() => {
    current.current = null // model/mixer değişirse klip yeniden başlasın
    return () => mixer.stopAllAction()
  }, [mixer])

  useFrame((_, dt) => {
    // 10 m'den uzaktaki avatarlarda animasyon 30 Hz'e düşürülür (kalabalık mekânda CPU skinning yükünü yarılar)
    let stepDt = dt
    if (halfRateRef.current) {
      skipRef.current.acc += dt
      skipRef.current.odd = !skipRef.current.odd
      if (skipRef.current.odd) return
      stepDt = skipRef.current.acc
      skipRef.current.acc = 0
    } else if (skipRef.current.acc > 0) {
      stepDt += skipRef.current.acc
      skipRef.current.acc = 0
    }
    const activePose = pose?.current ?? null
    const hpKey = activePose?.kind === 'eat' && activePose.item ? `${activePose.item.id}|${activePose.t0}` : ''
    if (hpKey !== handKeyRef.current) {
      handKeyRef.current = hpKey
      setHandProp(hpKey ? { item: activePose.item, t0: activePose.t0 } : null)
    }
    const isLounge = activePose?.kind === 'sit' && activePose?.style === 'lounger'
    // oturma/yatma yükseklikleri (SIT_DROP) zemine göre ayarlı: oturanlarda taş payı verilmez
    if (liftRef.current) liftRef.current.position.y = activePose?.kind === 'sit' ? 0 : FEET_LIFT
    if (isLounge !== loungeRef.current) {
      loungeRef.current = isLounge
      setLounging(isLounge)
    }
    const next = actions[anim] ?? actions.idle
    const isIdle = !next || next === actions.idle
    if (isIdle) {
      const entering = current.current !== 'upright'
      if (entering) {
        mixer.stopAllAction()
        current.current = 'upright'
      }
      if (entering || activePose || rig.blend > 0.001) {
        applyUprightIdle(rig)
        if (activePose || rig.blend > 0.001) applyPose(rig, activePose, stepDt)
      }
      return
    }
    if (next && current.current !== next) {
      const prev = current.current
      if (prev && typeof prev === 'object') prev.fadeOut(0.2)
      next.reset()
      next.paused = false
      if (prev && typeof prev === 'object') next.fadeIn(0.2)
      next.play()
      current.current = next
    }
    mixer.update(stepDt)
    if (pose) applyPose(rig, activePose, stepDt)
  })

  // Taş meydan/kaldırım zeminleri y=0,04-0,08'de: ayakkabılar yere gömülüp kaybolmasın diye avatar topluca bu kadar yukarıda durur
  return (
    <group ref={liftRef} position={[0, FEET_LIFT, 0]}>
      <primitive object={model} />
      {pose && <WorkProp pose={pose} />}
      {cosId && <HeadAccessory model={model} cosId={cosId} />}
      {handProp && <HandProp item={handProp.item} t0={handProp.t0} />}
      {lounging && <LoungeRelaxProps />}
    </group>
  )
}
