import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { AnimationMixer } from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { applyPose, applyUprightIdle, makeRig } from './avatarPose'
import { HeadAccessory } from './Accessories'
import { cosStore } from './cosStore'
import { applyLook, trimBase } from './avatarLook'
import WorkProp from './WorkProp'

export const AVATAR_HEIGHT = 1.3
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
export default function AvatarRig({ slug, anim = 'idle', pose, cosId }) {
  const { scene, animations } = useGLTF(`/models/avatars/${slug}.glb`)
  const current = useRef(null)
  const [handProp, setHandProp] = useState(null)
  const handKeyRef = useRef('')
  const look = useSyncExternalStore(cosStore.subscribe, () => cosStore.get(cosId)?.look ?? null)
  const lookKey = look ? `${look.h}.${look.e}.${look.o}` : ''

  const model = useMemo(() => {
    const clone = cloneSkinned(scene)
    // Skinned mesh'in Box3'ü kemik birimleri yüzünden yanıltıcı; rig 1.2 m, sabit ölçek uygula.
    clone.scale.multiplyScalar(AVATAR_HEIGHT / RIG_HEIGHT)
    clone.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        o.frustumCulled = false
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
    const activePose = pose?.current ?? null
    const hpKey = activePose?.kind === 'eat' && activePose.item ? `${activePose.item.id}|${activePose.t0}` : ''
    if (hpKey !== handKeyRef.current) {
      handKeyRef.current = hpKey
      setHandProp(hpKey ? { item: activePose.item, t0: activePose.t0 } : null)
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
        if (activePose || rig.blend > 0.001) applyPose(rig, activePose, dt)
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
    mixer.update(dt)
    if (pose) applyPose(rig, activePose, dt)
  })

  return (
    <>
      <primitive object={model} />
      {pose && <WorkProp pose={pose} />}
      {cosId && <HeadAccessory model={model} cosId={cosId} />}
      {handProp && <HandProp item={handProp.item} t0={handProp.t0} />}
    </>
  )
}
