// Toplanabilirler katmanı (Canvas içi): şehirdeki ya da mekândaki toplanabilirleri tek katmanda çizer.
// Kullanım: <CollectiblesLayer where="city" | "venue:<id>" focusRef store onNear(id|null) onPick(id) pops />
//   store.current = { until: { id: yerelZaman(ms) }, leaving: { id: ts } }  (features/collect.jsx doldurur)
// Performans: DRAW_RADIUS (34 m) dışındakiler hiç çizilmez; görünür küme 4 Hz hesaplanır, yalnızca değişince React güncellenir.
// Işıltı: tek InstancedMesh (yakındaki toplanabilirlerin çevresinde dönen parıltılar); gizli sandıkta ipucu olarak ≤ 6 m'de.
import { memo, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import { Box3, Color, MathUtils, Object3D, Vector3 } from 'three'
import { COLLECT_PROMPT, DRAW_RADIUS, GLINT_RADIUS, HIDDEN_GLINT, HIDDEN_SHOW, KINDS, collectiblesIn } from './collectibles'

const LEAVE_MS = 480
const MAX_GLINTS = 220

/** GLB'yi en büyük boyutu `size` olacak şekilde ölçekler; ground ise tabanı y=0'a, değilse merkezi y=0'a koyar. */
function useFitted(url, size, ground) {
  const { scene } = useGLTF(url)
  return useMemo(() => {
    const clone = scene.clone(true)
    const box = new Box3().setFromObject(clone)
    const sz = box.getSize(new Vector3())
    clone.scale.multiplyScalar(size / (Math.max(sz.x, sz.y, sz.z) || 1))
    const fit = new Box3().setFromObject(clone)
    const c = fit.getCenter(new Vector3())
    clone.position.set(-c.x, ground ? -fit.min.y : -c.y, -c.z)
    return clone
  }, [scene, size, ground])
}

const Item = memo(function Item({ col, phase, store, onPick }) {
  const k = KINDS[col.kind]
  const obj = useFitted(k.model, k.size, k.ground)
  const g = useRef()
  useFrame(({ clock }) => {
    const grp = g.current
    if (!grp) return
    const t = clock.elapsedTime + phase
    const left = store.current.leaving[col.id]
    let s = 1
    let lift = 0
    let spin = 0
    if (left) {
      const u = Math.min(1, (performance.now() - left) / LEAVE_MS)
      s = u < 0.35 ? 1 + u * 1.2 : Math.max(0, (1 - u) * 1.9)
      lift = u * 0.9
      spin = u * 9
    }
    if (k.ground) {
      grp.position.y = lift
      grp.rotation.y = (col.kind === 'flower' ? Math.sin(t * 0.8) * 0.25 : 0) + spin
      grp.rotation.z = col.kind === 'flower' ? Math.sin(t * 1.3) * 0.07 : 0
    } else {
      grp.position.y = k.y + Math.sin(t * 1.7) * 0.1 + lift
      grp.rotation.y = t * 0.9 + spin
      grp.rotation.z = col.kind === 'balloon' ? Math.sin(t * 1.1) * 0.1 : 0
    }
    grp.scale.setScalar(s)
  })
  return (
    <group position={[col.x, 0, col.z]}>
      <group ref={g}>
        <primitive object={obj} />
      </group>
      {/* dokunması kolay görünmez alan */}
      <mesh
        position={[0, 0.8, 0]}
        onClick={(e) => {
          e.stopPropagation()
          onPick?.(col.id)
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <sphereGeometry args={[1.0, 8, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
})

/** "+1 ⭐" yükselen metin (yalnızca toplama olunca bağlanır; ilk çizimde değil). */
function Pop({ pop }) {
  return (
    <Html position={[pop.x, 1.5, pop.z]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div className="whitespace-nowrap rounded-full border-2 border-white bg-[#fff3c4] px-3 py-1 text-base font-black text-[#7a5b00] shadow-lg [animation:collect-rise_1.3s_ease-out_forwards]">
        {pop.text}
      </div>
    </Html>
  )
}

const dummy = new Object3D()
const tmpColor = new Color()

function Glints({ visRef, focusRef }) {
  const mesh = useRef()
  useFrame(({ clock }) => {
    const m = mesh.current
    if (!m) return
    const f = focusRef.current
    const t = clock.elapsedTime
    let n = 0
    for (const col of visRef.current) {
      if (n >= MAX_GLINTS - 8) break
      const k = KINDS[col.kind]
      const d = Math.hypot(f.x - col.x, f.z - col.z)
      if (d > (col.hidden ? HIDDEN_GLINT : GLINT_RADIUS)) continue
      const count = col.hidden ? 7 : 3
      const base = k.ground ? 0.5 : k.y
      const fade = col.hidden ? 1 : MathUtils.clamp((GLINT_RADIUS - d) / 3, 0.35, 1)
      for (let i = 0; i < count; i++) {
        const a = t * (0.8 + (i % 3) * 0.25) + i * (Math.PI * 2 / count) + col.x
        const r = 0.55 + (i % 3) * 0.18
        const tw = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7 + col.z)
        dummy.position.set(col.x + Math.cos(a) * r, base + 0.25 + Math.sin(t * 1.4 + i * 2.1) * 0.35 + (i % 2) * 0.2, col.z + Math.sin(a) * r)
        dummy.rotation.set(t + i, t * 1.3, 0)
        dummy.scale.setScalar((col.hidden ? 0.085 : 0.06) * (0.4 + tw) * fade)
        dummy.updateMatrix()
        m.setMatrixAt(n, dummy.matrix)
        m.setColorAt(n, tmpColor.set(i % 2 ? '#ffffff' : k.glow))
        n++
      }
    }
    m.count = n
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX_GLINTS]} frustumCulled={false}>
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial transparent opacity={0.9} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  )
}

export default function CollectiblesLayer({ where, focusRef, store, onNear, onPick, pops }) {
  const list = useMemo(() => (where ? collectiblesIn(where) : []), [where])
  const [vis, setVis] = useState([])
  const visRef = useRef([])
  const keyRef = useRef('')
  const nearRef = useRef(null)
  const acc = useRef(0)

  useFrame((_, dt) => {
    acc.current += dt
    if (acc.current < 0.25) return
    acc.current = 0
    const f = focusRef.current
    const now = Date.now()
    const perf = performance.now()
    const out = []
    let near = null
    let nd = COLLECT_PROMPT
    for (const col of list) {
      const until = store.current.until[col.id]
      const left = store.current.leaving[col.id]
      const gone = until && until > now
      if (gone && !(left && perf - left < LEAVE_MS + 80)) continue
      const d = Math.hypot(f.x - col.x, f.z - col.z)
      if (d > (col.hidden ? HIDDEN_SHOW : DRAW_RADIUS)) continue
      out.push(col)
      if (!gone && d < nd) {
        nd = d
        near = col.id
      }
    }
    visRef.current = out
    const key = out.map((c) => c.id).join(',')
    if (key !== keyRef.current) {
      keyRef.current = key
      setVis(out)
    }
    if (near !== nearRef.current) {
      nearRef.current = near
      onNear?.(near)
    }
  })
  useEffect(() => () => onNear?.(null), [where]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!where) return null
  return (
    <group>
      {vis.map((c, i) => (
        <Suspense key={c.id} fallback={null}>
          <Item col={c} phase={(c.x * 0.37 + c.z * 0.51) % 6.28 + i * 0} store={store} onPick={onPick} />
        </Suspense>
      ))}
      <Glints visRef={visRef} focusRef={focusRef} />
      {pops.map((p) => (
        <Pop key={p.key} pop={p} />
      ))}
    </group>
  )
}
