import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
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

/**
 * Rig'li avatar modeli; anim ('idle' | 'walk' | 'run') değişince yumuşak geçiş yapar.
 * cosId verilirse aksesuarı (cosStore) kafa kemiğine takar.
 * AnimationMixer doğrudan klonlanmış modele bağlanır (drei useAnimations ilk açılışta T-pose'da kalabiliyordu).
 */
export default function AvatarRig({ slug, anim = 'idle', pose, cosId }) {
  const { scene, animations } = useGLTF(`/models/avatars/${slug}.glb`)
  const current = useRef(null)
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
    const next = actions[anim] ?? actions.idle
    const isIdle = !next || next === actions.idle
    if (isIdle) {
      if (current.current !== 'upright') {
        mixer.stopAllAction()
        current.current = 'upright'
      }
      applyUprightIdle(rig)
      if (pose?.current) applyPose(rig, pose.current, dt)
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
    if (pose) applyPose(rig, pose.current, dt)
  })

  return (
    <>
      <primitive object={model} />
      {pose && <WorkProp pose={pose} />}
      {cosId && <HeadAccessory model={model} cosId={cosId} />}
    </>
  )
}
