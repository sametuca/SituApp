import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { AnimationMixer } from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'

export const AVATAR_HEIGHT = 1.3
const RIG_HEIGHT = 1.2 // meshy_rig çağrısındaki height_meters

/**
 * Rig'li avatar modeli; anim ('idle' | 'walk' | 'run') değişince yumuşak geçiş yapar.
 * AnimationMixer doğrudan klonlanmış modele bağlanır (drei useAnimations ilk açılışta T-pose'da kalabiliyordu).
 */
export default function AvatarRig({ slug, anim = 'idle' }) {
  const { scene, animations } = useGLTF(`/models/avatars/${slug}.glb`)
  const current = useRef(null)

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
    return clone
  }, [scene])

  const mixer = useMemo(() => new AnimationMixer(model), [model])
  const actions = useMemo(() => Object.fromEntries(animations.map((clip) => [clip.name, mixer.clipAction(clip)])), [animations, mixer])

  useEffect(() => {
    current.current = null // model/mixer değişirse klip yeniden başlasın
    return () => mixer.stopAllAction()
  }, [mixer])

  useFrame((_, dt) => {
    const next = actions[anim] ?? actions.idle
    if (next && current.current !== next) {
      const prev = current.current
      prev?.fadeOut(0.2)
      next.reset()
      if (prev) next.fadeIn(0.2)
      next.play()
      current.current = next
    }
    mixer.update(dt)
  })

  return <primitive object={model} />
}
