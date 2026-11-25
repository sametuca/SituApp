// Çalılar ve çim öbekleri: Meshy GLB'leri (public/models/plants/), yerleri plantSpots.js'ten; her model tek InstancedMesh seti (ucuz).
// Mesafe ayıklamalı: yalnızca oyuncunun yakınındaki çalılar (≤ 56 m) ve çim öbekleri (≤ 38 m) GPU'ya gönderilir.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Box3, Matrix4, Quaternion, Vector3 } from 'three'
import { BUSHES, TUFTS } from './plantSpots'
import { playerPos } from './cull'

export const PLANT_URLS = ['/models/plants/bush.glb', '/models/plants/tuft.glb']

/** size: modelin en büyük boyutu (m). cullR: görünürlük yarıçapı (m). */
function InstancedPlant({ url, spots, size, cullR }) {
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

  const baked = useMemo(() => {
    const q = new Quaternion()
    const up = new Vector3(0, 1, 0)
    const pos = new Vector3()
    const sc = new Vector3()
    return parts.map((p) =>
      spots.map((s) => {
        q.setFromAxisAngle(up, s.ry)
        pos.set(s.x, 0, s.z)
        sc.set(s.s, s.s, s.s)
        return { x: s.x, z: s.z, mat: new Matrix4().compose(pos, q, sc).multiply(p.local) }
      }),
    )
  }, [parts, spots])

  const refs = useRef([])
  const last = useRef({ x: 1e9, z: 1e9, t: 0 })

  const refresh = () => {
    const px = playerPos.x
    const pz = playerPos.z
    const r2 = cullR * cullR
    for (let pi = 0; pi < baked.length; pi++) {
      const im = refs.current[pi]
      if (!im) continue
      const list = baked[pi]
      let n = 0
      for (let i = 0; i < list.length; i++) {
        const entry = list[i]
        const dx = px - entry.x
        const dz = pz - entry.z
        if (dx * dx + dz * dz <= r2) im.setMatrixAt(n++, entry.mat)
      }
      im.count = n
      im.visible = n > 0
      if (n > 0) im.instanceMatrix.needsUpdate = true
    }
  }

  useEffect(() => {
    last.current.x = 1e9
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baked])

  useFrame((_, dt) => {
    last.current.t += dt
    if (last.current.t < 0.25) return
    last.current.t = 0
    const dx = playerPos.x - last.current.x
    const dz = playerPos.z - last.current.z
    if (dx * dx + dz * dz < 4) return
    last.current.x = playerPos.x
    last.current.z = playerPos.z
    refresh()
  })

  return parts.map((p, i) => (
    <instancedMesh key={i} ref={(r) => (refs.current[i] = r)} args={[p.geo, p.mat, spots.length]} receiveShadow frustumCulled={false} />
  ))
}

export default function Plants() {
  return (
    <group>
      <InstancedPlant url={PLANT_URLS[0]} spots={BUSHES} size={1.3} cullR={56} />
      <InstancedPlant url={PLANT_URLS[1]} spots={TUFTS} size={0.62} cullR={38} />
    </group>
  )
}
