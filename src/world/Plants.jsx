// Çalılar ve çim öbekleri: Meshy GLB'leri (public/models/plants/), yerleri plantSpots.js'ten; her model tek InstancedMesh seti (ucuz).
import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { Box3, Matrix4, Quaternion, Vector3 } from 'three'
import { BUSHES, TUFTS } from './plantSpots'

export const PLANT_URLS = ['/models/plants/bush.glb', '/models/plants/tuft.glb']

/** size: modelin en büyük boyutu (m). */
function InstancedPlant({ url, spots, size }) {
  const { scene } = useGLTF(url)
  const parts = useMemo(() => {
    scene.updateMatrixWorld(true)
    const box = new Box3().setFromObject(scene)
    const dim = box.getSize(new Vector3())
    const k = size / (Math.max(dim.x, dim.y, dim.z) || 1)
    const c = box.getCenter(new Vector3())
    const fit = new Matrix4().makeScale(k, k, k).multiply(new Matrix4().makeTranslation(-c.x, -box.min.y, -c.z))
    const list = []
    scene.traverse((o) => {
      if (o.isMesh) list.push({ geo: o.geometry, mat: o.material, local: fit.clone().multiply(o.matrixWorld) })
    })
    return list
  }, [scene, size])
  const refs = useRef([])
  useEffect(() => {
    const q = new Quaternion()
    const up = new Vector3(0, 1, 0)
    const m = new Matrix4()
    parts.forEach((p, pi) => {
      const im = refs.current[pi]
      if (!im) return
      spots.forEach((s, i) => {
        q.setFromAxisAngle(up, s.ry)
        m.compose(new Vector3(s.x, 0, s.z), q, new Vector3(s.s, s.s, s.s)).multiply(p.local)
        im.setMatrixAt(i, m)
      })
      im.instanceMatrix.needsUpdate = true
    })
  }, [parts, spots])
  return parts.map((p, i) => (
    <instancedMesh key={i} ref={(r) => (refs.current[i] = r)} args={[p.geo, p.mat, spots.length]} receiveShadow frustumCulled={false} />
  ))
}

export default function Plants() {
  return (
    <group>
      <InstancedPlant url={PLANT_URLS[0]} spots={BUSHES} size={1.3} />
      <InstancedPlant url={PLANT_URLS[1]} spots={TUFTS} size={0.62} />
    </group>
  )
}
