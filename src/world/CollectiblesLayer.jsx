// Toplanabilirler katmanı (Canvas içi): şehirdeki ya da mekândaki toplanabilirleri tek katmanda çizer.
// Kullanım: <CollectiblesLayer where="city" | "venue:<id>" focusRef store onNear(id|null) onPick(id) pops />
//   store.current = { until: { id: yerelZaman(ms) }, leaving: { id: ts } }  (features/collect.jsx doldurur)
// Performans: DRAW_RADIUS (34 m) dışındakiler hiç çizilmez; görünür küme 4 Hz hesaplanır, yalnızca değişince React güncellenir.
// Işıltı: tek InstancedMesh (yakındaki toplanabilirlerin çevresinde dönen parıltılar); gizli sandıkta ipucu olarak ≤ 6 m'de.
import { memo, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import { AdditiveBlending, Box3, CanvasTexture, CircleGeometry, Color, CylinderGeometry, DoubleSide, MathUtils, Object3D, RingGeometry, SphereGeometry, Vector3 } from 'three'
import { COLLECT_PROMPT, DRAW_RADIUS, GLINT_RADIUS, HIDDEN_GLINT, HIDDEN_SHOW, KINDS, collectiblesIn } from './collectibles'
import { fixPropMaterialSeams } from './avatarTextureFix'

const LEAVE_MS = 480
const MAX_GLINTS = 360

const SHARED_GEO = {
  aura: new CircleGeometry(0.78, 24),
  pulse: new RingGeometry(0.38, 0.45, 24),
  ripple: new RingGeometry(0.36, 0.44, 24),
  beam: new CylinderGeometry(0.46, 0.34, 1.32, 16, 1, true),
  hit: new SphereGeometry(1.0, 8, 6),
}

const fittedMatCache = new WeakMap()

let cachedTex = null
/** Aura, ışık sütunu ve 4 köşeli ışıltı yıldızı için tek seferlik prosedürel dokular. */
function getEffectTextures() {
  if (cachedTex) return cachedTex
  const mk = (w, h, draw) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    draw(c.getContext('2d'), w, h)
    const tex = new CanvasTexture(c)
    tex.needsUpdate = true
    return tex
  }
  const glow = mk(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    g.addColorStop(0, 'rgba(255,255,255,0.95)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.45)')
    g.addColorStop(0.7, 'rgba(255,255,255,0.12)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
  const beam = mk(64, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, h, 0, 0)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.18, 'rgba(255,255,255,0.85)')
    g.addColorStop(0.55, 'rgba(255,255,255,0.28)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
  const spark = mk(128, 128, (ctx, w, h) => {
    const cx = w / 2
    const cy = h / 2
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.45)
    halo.addColorStop(0, 'rgba(255,255,255,0.95)')
    halo.addColorStop(0.28, 'rgba(255,255,255,0.38)')
    halo.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = halo
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    const outer = w * 0.46
    const inner = w * 0.085
    for (let i = 0; i < 4; i++) {
      const a0 = (i * Math.PI) / 2
      const a1 = a0 + Math.PI / 4
      const px = cx + Math.cos(a0) * outer
      const py = cy + Math.sin(a0) * outer
      const ix = cx + Math.cos(a1) * inner
      const iy = cy + Math.sin(a1) * inner
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
      ctx.quadraticCurveTo(cx, cy, ix, iy)
    }
    ctx.closePath()
    ctx.fill()
  })
  cachedTex = { glow, beam, spark }
  return cachedTex
}

/** GLB'yi en büyük boyutu `size` olacak şekilde ölçekler; parlak/ışıldayan malzeme uygular. */
function useFitted(url, size, ground, glow) {
  const { scene } = useGLTF(url)
  return useMemo(() => {
    const clone = scene.clone(true)
    const box = new Box3().setFromObject(clone)
    const sz = box.getSize(new Vector3())
    clone.scale.multiplyScalar(size / (Math.max(sz.x, sz.y, sz.z) || 1))
    const fit = new Box3().setFromObject(clone)
    const c = fit.getCenter(new Vector3())
    clone.position.set(-c.x, ground ? -fit.min.y : -c.y, -c.z)
    clone.traverse((o) => {
      if (!o.isMesh || !o.material) return
      let byGlow = fittedMatCache.get(o.material)
      if (!byGlow) {
        byGlow = new Map()
        fittedMatCache.set(o.material, byGlow)
      }
      let m = byGlow.get(glow)
      if (!m) {
        m = o.material.clone()
        fixPropMaterialSeams(m)
        if (m.emissive) {
          m.emissive.set(glow)
          m.emissiveIntensity = 0.28
        }
        if (typeof m.roughness === 'number') m.roughness = Math.min(m.roughness, 0.32)
        if (typeof m.metalness === 'number') m.metalness = Math.max(m.metalness, 0.14)
        byGlow.set(glow, m)
      }
      o.material = m
    })
    return clone
  }, [scene, size, ground, glow])
}

const Item = memo(function Item({ col, phase, store, onPick }) {
  const k = KINDS[col.kind]
  const obj = useFitted(k.model, k.size, k.ground, k.glow)
  const tex = useMemo(() => getEffectTextures(), [])
  const g = useRef()
  const glowMat = useRef()
  const pulseRef = useRef()
  const pulseMat = useRef()
  const rippleRef = useRef()
  const rippleMat = useRef()
  const beamRef = useRef()
  const beamMat = useRef()

  useFrame(({ clock }) => {
    const grp = g.current
    if (!grp) return
    const t = clock.elapsedTime + phase
    const left = store.current.leaving[col.id]
    let s = 1
    let lift = 0
    let spin = 0
    let leaveU = 0
    if (left) {
      leaveU = Math.min(1, (performance.now() - left) / LEAVE_MS)
      s = leaveU < 0.35 ? 1 + leaveU * 1.2 : Math.max(0, (1 - leaveU) * 1.9)
      lift = leaveU * 0.9
      spin = leaveU * 9
    }
    if (k.ground) {
      grp.position.y = lift
      grp.rotation.y = (col.kind === 'flower' ? Math.sin(t * 0.8) * 0.25 : 0) + spin
      grp.rotation.z = col.kind === 'flower' ? Math.sin(t * 1.3) * 0.07 : 0
    } else {
      grp.position.y = k.y + Math.sin(t * 1.7) * 0.11 + lift
      grp.rotation.y = t * 0.95 + spin
      grp.rotation.z = col.kind === 'balloon' ? Math.sin(t * 1.1) * 0.1 : 0
    }
    grp.scale.setScalar(s)

    const fade = left ? Math.max(0, 1 - leaveU * 1.8) : 1
    const breath = 0.5 + 0.5 * Math.sin(t * 2.4)
    if (glowMat.current) glowMat.current.opacity = (0.34 + breath * 0.18) * fade
    if (pulseRef.current && pulseMat.current) {
      pulseRef.current.scale.setScalar(0.95 + breath * 0.14)
      pulseMat.current.opacity = (0.45 + breath * 0.25) * fade
    }
    if (rippleRef.current && rippleMat.current) {
      if (left) {
        rippleRef.current.scale.setScalar(1 + leaveU * 1.9)
        rippleMat.current.opacity = (1 - leaveU) * 0.85
      } else {
        const w = (t * 0.55) % 1
        rippleRef.current.scale.setScalar(0.9 + w * 1.05)
        rippleMat.current.opacity = (1 - w) * (1 - w) * 0.52
      }
    }
    if (beamRef.current && beamMat.current) {
      beamRef.current.rotation.y = t * 0.45
      beamRef.current.scale.set(0.95 + breath * 0.08, 1, 0.95 + breath * 0.08)
      beamMat.current.opacity = (0.16 + breath * 0.08) * fade
    }
  })

  return (
    <group position={[col.x, 0, col.z]}>
      <group ref={g}>
        <primitive object={obj} />
      </group>
      {/* zeminde yumuşak radyal aura */}
      <mesh geometry={SHARED_GEO.aura} position={[0, 0.028, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial ref={glowMat} map={tex.glow} color={k.glow} transparent opacity={0.42} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* nefes alan ince iç halka */}
      <mesh ref={pulseRef} geometry={SHARED_GEO.pulse} position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial ref={pulseMat} color={k.glow} transparent opacity={0.55} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* dışa yayılan zarif dalga halkası (toplarken patlama dalgasına dönüşür) */}
      <mesh ref={rippleRef} geometry={SHARED_GEO.ripple} position={[0, 0.032, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial ref={rippleMat} color="#ffffff" transparent opacity={0.4} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* ince yükselen ışık tülü */}
      <mesh ref={beamRef} geometry={SHARED_GEO.beam} position={[0, 0.68, 0]}>
        <meshBasicMaterial ref={beamMat} map={tex.beam} color={k.glow} transparent opacity={0.2} side={DoubleSide} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* dokunması kolay görünmez alan */}
      <mesh
        geometry={SHARED_GEO.hit}
        position={[0, 0.8, 0]}
        onClick={(e) => {
          e.stopPropagation()
          onPick?.(col.id)
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
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
  const starMesh = useRef()
  const dustMesh = useRef()
  const tex = useMemo(() => getEffectTextures(), [])

  useFrame(({ clock, camera }) => {
    const sm = starMesh.current
    const dm = dustMesh.current
    if (!sm || !dm) return
    const f = focusRef.current
    const t = clock.elapsedTime
    let ns = 0
    let nd = 0
    for (const col of visRef.current) {
      if (ns >= MAX_GLINTS - 10 || nd >= MAX_GLINTS - 12) break
      const k = KINDS[col.kind]
      const d = Math.hypot(f.x - col.x, f.z - col.z)
      if (d > (col.hidden ? HIDDEN_GLINT : GLINT_RADIUS)) continue
      const starCount = col.hidden ? 8 : 5
      const dustCount = col.hidden ? 10 : 6
      const base = k.ground ? 0.45 : k.y
      const fade = col.hidden ? 1 : MathUtils.clamp((GLINT_RADIUS - d) / 3, 0.35, 1)

      // kameraya dönük 4 köşeli ışıltı yıldızları (✦)
      for (let i = 0; i < starCount; i++) {
        const a = t * (0.7 + (i % 3) * 0.2) + i * ((Math.PI * 2) / starCount) + col.x * 0.7
        const r = 0.52 + (i % 3) * 0.16
        const tw = Math.pow(0.5 + 0.5 * Math.sin(t * 3.6 + i * 2.1 + col.z), 2)
        dummy.position.set(col.x + Math.cos(a) * r, base + 0.15 + Math.sin(t * 1.5 + i * 1.9) * 0.36 + (i % 2) * 0.18, col.z + Math.sin(a) * r)
        dummy.quaternion.copy(camera.quaternion)
        dummy.rotateZ(t * 0.6 + i)
        dummy.scale.setScalar((col.hidden ? 0.26 : 0.22) * (0.25 + tw * 0.95) * fade)
        dummy.updateMatrix()
        sm.setMatrixAt(ns, dummy.matrix)
        sm.setColorAt(ns, tmpColor.set(i % 2 ? '#ffffff' : k.glow))
        ns++
      }

      // sarmal şeklinde yükselen ince peri tozu tanecikleri
      for (let i = 0; i < dustCount; i++) {
        const u = ((t * 0.42 + i / dustCount + (Math.abs(col.x + col.z) * 0.07)) % 1 + 1) % 1
        const a = u * Math.PI * 2.6 + i * ((Math.PI * 2) / dustCount) + col.z * 0.5
        const r = 0.28 + Math.sin(u * Math.PI) * 0.24
        const life = Math.sin(u * Math.PI)
        dummy.position.set(col.x + Math.cos(a) * r, 0.08 + u * (base + 0.85), col.z + Math.sin(a) * r)
        dummy.quaternion.set(0, 0, 0, 1)
        dummy.scale.setScalar((col.hidden ? 0.036 : 0.028) * life * fade)
        dummy.updateMatrix()
        dm.setMatrixAt(nd, dummy.matrix)
        dm.setColorAt(nd, tmpColor.set(i % 3 === 0 ? '#ffffff' : k.glow))
        nd++
      }
    }
    sm.count = ns
    sm.instanceMatrix.needsUpdate = true
    if (sm.instanceColor) sm.instanceColor.needsUpdate = true
    dm.count = nd
    dm.instanceMatrix.needsUpdate = true
    if (dm.instanceColor) dm.instanceColor.needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={starMesh} args={[undefined, undefined, MAX_GLINTS]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={tex.spark} transparent opacity={0.95} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={dustMesh} args={[undefined, undefined, MAX_GLINTS]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial transparent opacity={0.85} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </>
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
      {vis.map((c) => (
        <Suspense key={c.id} fallback={null}>
          <Item col={c} phase={(c.x * 0.37 + c.z * 0.51) % 6.28} store={store} onPick={onPick} />
        </Suspense>
      ))}
      <Glints visRef={visRef} focusRef={focusRef} />
      {pops.map((p) => (
        <Pop key={p.key} pop={p} />
      ))}
    </group>
  )
}
