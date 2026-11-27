// GLB süs nesneleri: tekil Prop ve instanced PropGroup (mesafe kırpma, gölge yarıçapı, palmiye salınımı).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Box3, Matrix4, Quaternion, Vector3 } from 'three'
import { fixPropMaterialSeams } from './avatarTextureFix'
import { playerPos, useCull } from './cull'
import { applySway, isSwayModel } from './windSway'

const PROP_CULL_R = 72 // m: süs nesneleri bu mesafenin ötesinde çizilmez
const PROP_SHADOW_R = 26 // m: güneş gölge kamerası ±20 m; daha uzaktakiler gölge geçişine girmez

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
      if (o.isMesh) {
        o.castShadow = o.receiveShadow = true
        fixPropMaterialSeams(o.material)
        if (isSwayModel(model)) applySway(o.material, o.geometry)
      }
    })
    return clone
  }, [scene, model])
  const g = useRef()
  useCull(g, x, z, PROP_CULL_R, PROP_SHADOW_R)
  return (
    <group ref={g} position={[x, 0, z]} rotation={[0, ry, 0]} scale={scale}>
      <primitive object={object} />
    </group>
  )
}

/**
 * Aynı GLB modelini paylaşan çoklu süs nesnelerini (ağaçlar, lambalar, banklar, palmiyeler…) tek InstancedMesh çiftiyle çizer:
 * yakın (≤ 26 m) gölgeli, orta (26–72 m) gölgesiz; uzak (> 72 m) hiç gönderilmez.
 * Oyuncu 2 m'den fazla hareket ettiğinde (~4 Hz) güncellenir; yüzlerce çizim çağrısını tek çağrıya indirir.
 */
export function InstancedPropGroup({ model, items, cullR = PROP_CULL_R, shadowR = PROP_SHADOW_R }) {
  const { scene } = useGLTF(model)
  const parts = useMemo(() => {
    scene.updateMatrixWorld(true)
    const box = new Box3().setFromObject(scene)
    const dim = box.getSize(new Vector3())
    const k = 1 / (Math.max(dim.x, dim.y, dim.z) || 1)
    const c = box.getCenter(new Vector3())
    const fit = new Matrix4().makeScale(k, k, k).multiply(new Matrix4().makeTranslation(-c.x, -box.min.y, -c.z))
    const list = []
    scene.traverse((o) => {
      if (o.isMesh) {
        fixPropMaterialSeams(o.material)
        if (isSwayModel(model)) applySway(o.material, o.geometry)
        list.push({ geo: o.geometry, mat: o.material, local: fit.clone().multiply(o.matrixWorld) })
      }
    })
    return list
  }, [scene, model])

  const baked = useMemo(() => {
    const q = new Quaternion()
    const up = new Vector3(0, 1, 0)
    const pos = new Vector3()
    const sc = new Vector3()
    return parts.map((p) =>
      items.map((it) => {
        const s = it.scale ?? 1
        q.setFromAxisAngle(up, it.ry ?? 0)
        pos.set(it.x, 0, it.z)
        sc.set(s, s, s)
        const mat = new Matrix4().compose(pos, q, sc).multiply(p.local)
        return { x: it.x, z: it.z, mat }
      }),
    )
  }, [parts, items])

  const nearRefs = useRef([])
  const farRefs = useRef([])
  const last = useRef({ x: 1e9, z: 1e9, t: 0 })

  const refresh = () => {
    const px = playerPos.x
    const pz = playerPos.z
    const r2 = cullR * cullR
    const sr2 = shadowR * shadowR
    for (let pi = 0; pi < baked.length; pi++) {
      const nearIm = nearRefs.current[pi]
      const farIm = farRefs.current[pi]
      if (!nearIm || !farIm) continue
      const list = baked[pi]
      let nNear = 0
      let nFar = 0
      for (let i = 0; i < list.length; i++) {
        const entry = list[i]
        const dx = px - entry.x
        const dz = pz - entry.z
        const d2 = dx * dx + dz * dz
        if (d2 > r2) continue
        if (d2 <= sr2) {
          nearIm.setMatrixAt(nNear++, entry.mat)
        } else {
          farIm.setMatrixAt(nFar++, entry.mat)
        }
      }
      nearIm.count = nNear
      nearIm.visible = nNear > 0
      if (nNear > 0) nearIm.instanceMatrix.needsUpdate = true
      farIm.count = nFar
      farIm.visible = nFar > 0
      if (nFar > 0) farIm.instanceMatrix.needsUpdate = true
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
    if (dx * dx + dz * dz < 4) return // 2 m hareket etmeden matris yeniden paketlenmez
    last.current.x = playerPos.x
    last.current.z = playerPos.z
    refresh()
  })

  return parts.map((p, i) => (
    <group key={i}>
      <instancedMesh ref={(r) => (nearRefs.current[i] = r)} args={[p.geo, p.mat, items.length]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={(r) => (farRefs.current[i] = r)} args={[p.geo, p.mat, items.length]} receiveShadow frustumCulled={false} />
    </group>
  ))
}
