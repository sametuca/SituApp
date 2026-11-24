import { useMemo, useRef } from 'react'
import { useCull } from './cull'
import { useGLTF } from '@react-three/drei'
import { Box3, Vector3 } from 'three'

/** GLB süs nesnesi: en büyük boyutu 1 birime normalleyip scale ile çarpar, tabanı y=0'a oturtur. */
export default function Prop({ model, x, z, scale = 1, ry = 0 }) {
  const { scene } = useGLTF(model)
  const object = useMemo(() => {
    const clone = scene.clone(true)
    const size = new Box3().setFromObject(clone).getSize(new Vector3())
    clone.scale.multiplyScalar(1 / (Math.max(size.x, size.y, size.z) || 1))
    const fit = new Box3().setFromObject(clone)
    const c = fit.getCenter(new Vector3())
    clone.position.set(-c.x, -fit.min.y, -c.z)
    clone.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true
    })
    return clone
  }, [scene])
  const g = useRef()
  useCull(g, x, z)
  return (
    <group ref={g} position={[x, 0, z]} rotation={[0, ry, 0]} scale={scale}>
      <primitive object={object} />
    </group>
  )
}
