// Akşam ışıkları ve canlı efektler: sokak lambaları (sırayla yanar), kapı ışıkları, polen, feston ışık zincirleri, ateşböcekleri, ıslak zemin.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, LatheGeometry, Object3D, Vector2, Vector3 } from 'three'
import { BEACH, GAP, PIER, PROPS, ROAD_HALF } from './layout'
import { VENUE_DOORS } from './venueDoors'
import { C, SOFT, glowTexture, mulberry, skyLive } from './skyState'
// ---------------------------------------------------------------- sokak lambaları (yumuşak radyal yer ışığı + yakın gerçek ışıklar)
export const LAMP_MODEL = '/models/park/park-lamp.glb'
export const LAMPS = PROPS.filter((p) => p.model === LAMP_MODEL).map((p) => ({ x: p.x, z: p.z }))
export const LAMP_TOP = 2.75
export const REAL_LIGHTS = 2

// lambalar sıra sıra yanar: her birinin kendi eşiği var (0..1 hash), ışık çoğaldıkça birer birer devreye girer
export const lampRamp = (i, lit) => {
  const h = (i * 0.618034) % 1
  const a = 0.02 + h * 0.3
  return Math.min(1, Math.max(0, (lit - a) / 0.12))
}

export function Lamps({ focusRef }) {
  const glow = useRef()
  const pool = useRef()
  const lights = useRef([])
  const t = useRef(0)
  const tex = useMemo(() => glowTexture(SOFT), [])
  useEffect(() => () => tex.dispose(), [tex])
  const dummy = useMemo(() => new Object3D(), [])
  const camera = useThree((s) => s.camera)
  const lastLit = useRef(-1)

  useFrame((_, dt) => {
    const lit = skyLive.lit
    const on = lit > 0.02
    if (glow.current) glow.current.visible = on
    if (pool.current) pool.current.visible = on
    if (on && glow.current) {
      const m = glow.current
      for (let i = 0; i < LAMPS.length; i++) {
        const r = lampRamp(i, lit)
        dummy.position.set(LAMPS[i].x, LAMP_TOP, LAMPS[i].z)
        dummy.quaternion.copy(camera.quaternion)
        dummy.scale.set(3.4 * r + 0.001, 3.4 * r + 0.001, 1)
        dummy.updateMatrix()
        m.setMatrixAt(i, dummy.matrix)
      }
      m.instanceMatrix.needsUpdate = true
      if (Math.abs(lit - lastLit.current) > 0.003) {
        lastLit.current = lit
        const pm = pool.current
        for (let i = 0; i < LAMPS.length; i++) {
          const r = lampRamp(i, lit)
          dummy.position.set(LAMPS[i].x, 0.13, LAMPS[i].z)
          dummy.rotation.set(-Math.PI / 2, 0, 0)
          dummy.quaternion.setFromEuler(dummy.rotation)
          dummy.scale.set(9.5 * r + 0.001, 9.5 * r + 0.001, 1)
          dummy.updateMatrix()
          pm.setMatrixAt(i, dummy.matrix)
        }
        pm.instanceMatrix.needsUpdate = true
      }
      m.material.opacity = lit * 0.92
      pool.current.material.opacity = lit * 0.42
    }
    // en yakın lambalara gerçek ışık ata (yarım saniyede bir)
    t.current += dt
    if (t.current > 0.4) {
      t.current = 0
      const f = focusRef.current
      const near = LAMPS.map((l) => ({ l, d: Math.hypot(l.x - f.x, l.z - f.z) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, REAL_LIGHTS)
      near.forEach((n, i) => lights.current[i]?.position.set(n.l.x, LAMP_TOP - 0.15, n.l.z))
    }
    lights.current.forEach((l) => l && (l.intensity = on ? lit * 9.5 : 0))
  })

  return (
    <>
      <instancedMesh ref={glow} args={[null, null, LAMPS.length]} frustumCulled={false} renderOrder={4}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={tex} color="#ffd788" transparent depthWrite={false} blending={AdditiveBlending} fog={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={pool} args={[null, null, LAMPS.length]} frustumCulled={false} renderOrder={3}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={tex} color="#ffc978" transparent depthWrite={false} blending={AdditiveBlending} fog={false} toneMapped={false} />
      </instancedMesh>
      {Array.from({ length: REAL_LIGHTS }, (_, i) => (
        <pointLight key={i} ref={(l) => (lights.current[i] = l)} color="#ffca7a" intensity={0} distance={15} decay={2} position={[0, LAMP_TOP, 0]} />
      ))}
    </>
  )
}

// mekân kapılarının önüne sıcak, yumuşak zemin aydınlatması (kafe/dükkân içinden taşan ışık); lambalardan biraz geç yanar
export const DOOR_LIST = Object.values(VENUE_DOORS)
export function DoorGlow() {
  const ref = useRef()
  const tex = useMemo(() => glowTexture(SOFT), [])
  useEffect(() => () => tex.dispose(), [tex])
  const dummy = useMemo(() => new Object3D(), [])
  const last = useRef(-1)
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const lit = skyLive.lit
    m.visible = lit > 0.08
    if (!m.visible || Math.abs(lit - last.current) < 0.003) return
    last.current = lit
    DOOR_LIST.forEach((d, i) => {
      const r = Math.min(1, Math.max(0, (lit - 0.1 - ((i * 0.37) % 1) * 0.25) / 0.12))
      dummy.position.set(d.x, 0.12, d.z)
      dummy.rotation.set(-Math.PI / 2, 0, 0)
      dummy.quaternion.setFromEuler(dummy.rotation)
      dummy.scale.set(7 * r + 0.001, 7 * r + 0.001, 1)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    m.material.opacity = 0.3
  })
  return (
    <instancedMesh ref={ref} args={[null, null, DOOR_LIST.length]} frustumCulled={false} renderOrder={3}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={tex} color="#ffb766" transparent opacity={0.3} depthWrite={false} blending={AdditiveBlending} fog={false} toneMapped={false} />
    </instancedMesh>
  )
}

// oyuncunun çevresinde çok seyrek, yavaş süzülen sıcak toz/polen zerrecikleri (rüzgârla +x yönünde akar)
export const MOTE_N = 44
export const MOTE_BOX = 26
export function Motes({ focusRef }) {
  const ref = useRef()
  const tex = useMemo(() => glowTexture(SOFT), [])
  useEffect(() => () => tex.dispose(), [tex])
  const st = useMemo(() => {
    const r = mulberry(5)
    return Array.from({ length: MOTE_N }, () => ({ x: r() * MOTE_BOX, y: 0.5 + r() * 4.5, z: r() * MOTE_BOX, sp: 0.15 + r() * 0.25, ph: r() * 6.28 }))
  }, [])
  const geo = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(new Float32Array(MOTE_N * 3), 3))
    return g
  }, [])
  useEffect(() => () => geo.dispose(), [geo])
  const acc = useRef(0)
  useFrame(({ clock }, dt) => {
    const p = ref.current
    if (!p) return
    const k = Math.max(skyLive.lit * 0.9, 0.35 + (1 - skyLive.night) * 0.25)
    p.visible = true
    p.material.opacity = 0.34 * k
    acc.current += dt
    if (acc.current < 0.033) return
    const step = acc.current
    acc.current = 0
    const f = focusRef.current
    const t = clock.elapsedTime
    const arr = geo.attributes.position.array
    for (let i = 0; i < MOTE_N; i++) {
      const m = st[i]
      m.x = (m.x + m.sp * step * 1.6) % MOTE_BOX
      arr[i * 3] = f.x - MOTE_BOX / 2 + m.x
      arr[i * 3 + 1] = m.y + Math.sin(t * 0.5 + m.ph) * 0.35
      arr[i * 3 + 2] = f.z - MOTE_BOX / 2 + m.z + Math.sin(t * 0.3 + m.ph) * 0.6
    }
    geo.attributes.position.needsUpdate = true
  })
  return (
    <points ref={ref} geometry={geo} frustumCulled={false} renderOrder={5}>
      <pointsMaterial map={tex} size={0.16} color="#ffe2b0" transparent opacity={0.3} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
    </points>
  )
}

// ---------------------------------------------------------------- yaz akşamı feston ışık zincirleri + ateşböcekleri
export const FESTOON_SPANS = (() => {
  const spans = []
  const edge = ROAD_HALF + 1.05
  // Kafe Sokağı & Plaj Yolu üstü sıcak ampul zincirleri
  for (const z of [-20.5, -26.5, -32.5, -38.5, 21.5, 28.5]) {
    spans.push({ ax: -edge, az: z - GAP * (z < 0 ? 1 : -1), bx: edge, bz: z - GAP * (z < 0 ? 1 : -1), y: 4.15, sag: 0.55, n: 7 })
  }
  // Gece Kulübü caddesi üstü sıcak + pastel zincirler
  for (const x of [22.5, 29.5, 36.5]) {
    spans.push({ ax: x + GAP, az: -edge, bx: x + GAP, bz: edge, y: 4.25, sag: 0.55, n: 7 })
  }
  // Plaj iskelesi iki yanı Edison fener dizisi
  spans.push(
    { ax: -1.35, az: PIER.z0 + 1.2, bx: -1.35, bz: PIER.z1 - 0.6, y: 1.55, sag: 0.25, n: 5 },
    { ax: 1.35, az: PIER.z0 + 1.2, bx: 1.35, bz: PIER.z1 - 0.6, y: 1.55, sag: 0.25, n: 5 },
  )
  return spans
})()

export function SummerFestoons() {
  const bulbsRef = useRef()
  const socketsRef = useRef()
  const filamentsRef = useRef()
  const halosRef = useRef()
  const wiresRef = useRef()
  const tex = useMemo(() => glowTexture(SOFT), [])
  const bulbGeo = useMemo(() => {
    const pts = [
      new Vector2(0.0, -0.115),
      new Vector2(0.048, -0.105),
      new Vector2(0.088, -0.065),
      new Vector2(0.095, -0.015),
      new Vector2(0.068, 0.045),
      new Vector2(0.042, 0.09),
      new Vector2(0.036, 0.115),
      new Vector2(0.0, 0.115),
    ]
    return new LatheGeometry(pts, 16)
  }, [])
  useEffect(() => () => {
    tex.dispose()
    bulbGeo.dispose()
  }, [tex, bulbGeo])
  const camera = useThree((s) => s.camera)
  const dummy = useMemo(() => new Object3D(), [])

  const { bulbs, wires } = useMemo(() => {
    const bList = []
    const wList = []
    const cols = [C('#ffd980'), C('#ffbf69'), C('#ffe7a8'), C('#ffb09c')]
    FESTOON_SPANS.forEach((sp, si) => {
      const segs = sp.n - 1
      let prev = null
      for (let i = 0; i < sp.n; i++) {
        const u = i / segs
        const x = sp.ax + (sp.bx - sp.ax) * u
        const z = sp.az + (sp.bz - sp.az) * u
        const y = sp.y - Math.sin(u * Math.PI) * sp.sag
        if (prev) {
          const mx = (prev.x + x) / 2
          const my = (prev.y + y) / 2
          const mz = (prev.z + z) / 2
          const len = Math.hypot(x - prev.x, y - prev.y, z - prev.z)
          wList.push({ p: new Vector3(mx, my, mz), to: new Vector3(x, y, z), len })
        }
        // Duy telden aşağı sarkar, ampul duyun altında asılı durur
        bList.push({ x, wireY: y, y: y - 0.19, z, col: cols[(si + i) % cols.length], phase: si * 0.7 + i * 0.9 })
        prev = { x, y, z }
      }
    })
    return { bulbs: bList, wires: wList }
  }, [])

  useEffect(() => {
    const bm = bulbsRef.current
    const sm = socketsRef.current
    const fm = filamentsRef.current
    const wm = wiresRef.current
    if (bm) {
      bulbs.forEach((b, i) => {
        dummy.position.set(b.x, b.y, b.z)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        bm.setMatrixAt(i, dummy.matrix)
        bm.setColorAt(i, b.col)
      })
      bm.instanceMatrix.needsUpdate = true
      if (bm.instanceColor) bm.instanceColor.needsUpdate = true
    }
    if (sm) {
      bulbs.forEach((b, i) => {
        dummy.position.set(b.x, b.wireY - 0.05, b.z)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        sm.setMatrixAt(i, dummy.matrix)
      })
      sm.instanceMatrix.needsUpdate = true
    }
    if (fm) {
      bulbs.forEach((b, i) => {
        dummy.position.set(b.x, b.y - 0.015, b.z)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        fm.setMatrixAt(i, dummy.matrix)
      })
      fm.instanceMatrix.needsUpdate = true
    }
    if (wm) {
      wires.forEach((w, i) => {
        dummy.position.copy(w.p)
        dummy.lookAt(w.to)
        dummy.scale.set(1, 1, w.len)
        dummy.updateMatrix()
        wm.setMatrixAt(i, dummy.matrix)
      })
      wm.instanceMatrix.needsUpdate = true
    }
  }, [bulbs, wires, dummy])

  const acc = useRef(0)
  useFrame(({ clock }, dt) => {
    const lit = skyLive.lit
    const on = lit > 0.02
    if (bulbsRef.current?.material) {
      bulbsRef.current.material.emissiveIntensity = 0.08 + lit * 1.45
    }
    if (filamentsRef.current?.material) {
      filamentsRef.current.material.emissiveIntensity = 0.15 + lit * 3.2
    }
    const hm = halosRef.current
    if (!hm) return
    hm.visible = on
    if (!on) return
    acc.current += dt
    if (acc.current < 0.04) return
    acc.current = 0
    const t = clock.elapsedTime
    for (let i = 0; i < bulbs.length; i++) {
      const b = bulbs[i]
      const pulse = 0.85 + Math.sin(t * 2.2 + b.phase) * 0.15
      dummy.position.set(b.x, b.y - 0.02, b.z)
      dummy.quaternion.copy(camera.quaternion)
      dummy.scale.setScalar(1.25 * pulse)
      dummy.updateMatrix()
      hm.setMatrixAt(i, dummy.matrix)
    }
    hm.instanceMatrix.needsUpdate = true
    hm.material.opacity = lit * 0.72
  })

  return (
    <group>
      <instancedMesh ref={wiresRef} args={[undefined, undefined, wires.length]} frustumCulled={false}>
        <boxGeometry args={[0.026, 0.026, 1]} />
        <meshStandardMaterial color="#352b47" roughness={0.85} />
      </instancedMesh>
      {/* Siyah/antrasit duy ve kısa askı kordonu */}
      <instancedMesh ref={socketsRef} args={[undefined, undefined, bulbs.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.042, 0.048, 0.1, 10]} />
        <meshStandardMaterial color="#2b2338" roughness={0.55} metalness={0.25} />
      </instancedMesh>
      {/* İç filaman çekirdeği */}
      <instancedMesh ref={filamentsRef} args={[undefined, undefined, bulbs.length]} frustumCulled={false}>
        <capsuleGeometry args={[0.014, 0.045, 4, 8]} />
        <meshStandardMaterial color="#fff8d6" emissive="#ffe07d" emissiveIntensity={0.15} roughness={0.2} toneMapped={false} />
      </instancedMesh>
      {/* Damla formunda yarı saydam sıcak cam ampul */}
      <instancedMesh ref={bulbsRef} args={[bulbGeo, undefined, bulbs.length]} frustumCulled={false}>
        <meshStandardMaterial color="#fff6dc" emissive="#ffc46b" emissiveIntensity={0.08} roughness={0.18} metalness={0.05} transparent opacity={0.86} />
      </instancedMesh>
      <instancedMesh ref={halosRef} args={[undefined, undefined, bulbs.length]} frustumCulled={false} renderOrder={4}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={tex} color="#ffd588" transparent depthWrite={false} blending={AdditiveBlending} fog={false} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

export function Fireflies() {
  const ref = useRef()
  const tex = useMemo(() => glowTexture(SOFT), [])
  useEffect(() => () => tex.dispose(), [tex])
  const count = 48
  const seeds = useMemo(() => {
    const r = mulberry(91)
    const anchors = [
      { x: -30, z: 0, rad: 18 }, // park
      { x: 0, z: 0, rad: 14 }, // meydan
      { x: 0, z: -32, rad: 12 }, // kafe sokağı
      { x: BEACH.x, z: BEACH.z + 4, rad: 28 }, // plaj palmiyeleri
    ]
    return Array.from({ length: count }, (_, i) => {
      const a = anchors[i % anchors.length]
      const ang = r() * Math.PI * 2
      const dist = Math.sqrt(r()) * a.rad
      return {
        bx: a.x + Math.cos(ang) * dist,
        by: 0.75 + r() * 2.1,
        bz: a.z + Math.sin(ang) * dist,
        sp: 0.6 + r() * 1.1,
        ph: r() * Math.PI * 2,
      }
    })
  }, [])
  const geo = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const pal = [C('#ffe796'), C('#ffd180'), C('#d8ff9e')]
    for (let i = 0; i < count; i++) {
      const c = pal[i % pal.length]
      col[i * 3] = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
      pos[i * 3] = seeds[i].bx
      pos[i * 3 + 1] = seeds[i].by
      pos[i * 3 + 2] = seeds[i].bz
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new Float32BufferAttribute(col, 3))
    return g
  }, [seeds])
  useEffect(() => () => geo.dispose(), [geo])

  const ffAcc = useRef(0)
  useFrame(({ clock }, dt) => {
    const p = ref.current
    if (!p) return
    const vis = skyLive.lit > 0.15
    p.visible = vis
    if (!vis) return
    ffAcc.current += dt
    if (ffAcc.current < 0.04) return
    ffAcc.current = 0
    const t = clock.elapsedTime
    const arr = geo.attributes.position.array
    for (let i = 0; i < count; i++) {
      const s = seeds[i]
      arr[i * 3] = s.bx + Math.sin(t * s.sp + s.ph) * 0.9
      arr[i * 3 + 1] = s.by + Math.sin(t * s.sp * 1.4 + s.ph) * 0.35
      arr[i * 3 + 2] = s.bz + Math.cos(t * s.sp * 0.85 + s.ph) * 0.9
    }
    geo.attributes.position.needsUpdate = true
    p.material.opacity = Math.min(0.9, (skyLive.lit - 0.15) * 1.1) * (0.78 + Math.sin(t * 2.5) * 0.18)
  })

  return (
    <points ref={ref} geometry={geo} frustumCulled={false} renderOrder={5}>
      <pointsMaterial map={tex} size={0.55} vertexColors transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
    </points>
  )
}

/** Yağmurda zemin üstüne ince yarı saydam parlak tabaka (ucuz ıslak zemin). */
export function WetSheen({ focusRef }) {
  const mesh = useRef()
  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const w = skyLive.wet
    m.visible = w > 0.02
    if (!m.visible) return
    const f = focusRef.current
    m.position.set(f.x, 0.115, f.z)
    m.material.opacity = w * 0.12
  })
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <planeGeometry args={[80, 80]} />
      <meshStandardMaterial color="#dbe8ff" roughness={0.08} metalness={0.5} transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

