import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { Box3, Vector3 } from 'three'

export const BIKE_URL = '/models/bike/bike.glb'
export const BIKE_LENGTH = 1.6 // m
export const BIKE_RY = Math.PI / 2 // Meshy bisikletinin önü -X'e bakıyor; +Z (avatarın baktığı yön) olması için

/** Meshy bisikleti: en uzun boyutu BIKE_LENGTH, tabanı y=0, ortalı; önü +Z (avatarın baktığı yön). */
export default function BikeModel({ x = 0, z = 0, ry = 0, scale = 1 }) {
  const { scene } = useGLTF(BIKE_URL)
  const object = useMemo(() => {
    const clone = scene.clone(true)
    const size = new Box3().setFromObject(clone).getSize(new Vector3())
    clone.scale.multiplyScalar(BIKE_LENGTH / (Math.max(size.x, size.y, size.z) || 1))
    const fit = new Box3().setFromObject(clone)
    const c = fit.getCenter(new Vector3())
    clone.position.set(-c.x, -fit.min.y, -c.z)
    clone.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true
    })
    return clone
  }, [scene])
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]} scale={scale}>
      <group rotation={[0, BIKE_RY, 0]}>
        <primitive object={object} />
      </group>
    </group>
  )
}
