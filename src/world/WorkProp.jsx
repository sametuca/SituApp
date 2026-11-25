// Mesleklerde avatarın elindeki eşyalar: olta (+ misina, şamandıra, sıçrama, yakalanan balık), kargo paketi, bahçe tozu.
// AvatarRig içinde, avatarın yanına (aynı dönüş çerçevesinde) çizilir; yerel (+z) avatarın baktığı yöndür. Hem benim hem uzak oyuncular için çalışır.
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, MathUtils, Quaternion, Vector3 } from 'three'
import { fishArm } from './avatarPose'
import FishModel from './FishModel'
import { FISH_CAST_DIST, PARCEL_KINDS } from './jobsData'

const HAND = new Vector3(-0.05, 0.8, 0.26) // iki elin ortası (avatar yerel)
const ROD_LEN = 1.55
const UP = new Vector3(0, 1, 0)
const WATER_Y = -0.05
const ease = (x) => x * x * (3 - 2 * x)

/** İki nokta arasına ince silindir (misina) yerleştirir. */
function setLine(mesh, a, b) {
  const d = new Vector3().subVectors(b, a)
  const len = d.length() || 0.0001
  mesh.position.copy(a).addScaledVector(d, 0.5)
  mesh.scale.set(1, len, 1)
  mesh.quaternion.copy(new Quaternion().setFromUnitVectors(UP, d.multiplyScalar(1 / len)))
}

export function Parcel({ kind }) {
  const k = PARCEL_KINDS.find((x) => x.id === kind) ?? PARCEL_KINDS[1]
  const ribbon = k.id === 'gift' ? '#ff9ad5' : k.id === 'flower' ? '#7bcf8e' : '#d97b3c'
  if (k.id === 'letter')
    return (
      <group>
        <mesh>
          <boxGeometry args={[0.34, 0.03, 0.24]} />
          <meshStandardMaterial color="#fff6e0" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.02, 0.02]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.1, 0.012, 0.08]} />
          <meshStandardMaterial color="#ff8a5c" roughness={0.6} />
        </mesh>
      </group>
    )
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.32, 0.24, 0.28]} />
        <meshStandardMaterial color={k.color} roughness={0.65} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.07, 0.25, 0.29]} />
        <meshStandardMaterial color={ribbon} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.125, 0]} scale={[1.1, 0.5, 1.1]}>
        <boxGeometry args={[0.32, 0.04, 0.29]} />
        <meshStandardMaterial color={k.color} roughness={0.65} />
      </mesh>
      {(k.id === 'gift' || k.id === 'flower') && (
        <>
          <mesh position={[0.05, 0.17, 0]} rotation={[0, 0, 0.7]}>
            <torusGeometry args={[0.05, 0.016, 6, 10]} />
            <meshStandardMaterial color={ribbon} roughness={0.5} />
          </mesh>
          <mesh position={[-0.05, 0.17, 0]} rotation={[0, 0, -0.7]}>
            <torusGeometry args={[0.05, 0.016, 6, 10]} />
            <meshStandardMaterial color={ribbon} roughness={0.5} />
          </mesh>
        </>
      )}
    </group>
  )
}

function Inner({ pose }) {
  const rod = useRef()
  const lineA = useRef() // elden şamandıraya misina
  const bobber = useRef()
  const rings = useRef([])
  const drops = useRef([])
  const fishG = useRef()
  const box = useRef()
  const dust = useRef([])
  const [fishId, setFishId] = useState(null)
  const [parcelKind, setParcelKind] = useState('box')
  const tip = useMemo(() => new Vector3(), [])
  const tgt = useMemo(() => new Vector3(0, WATER_Y, FISH_CAST_DIST), [])
  const tmp = useMemo(() => new Vector3(), [])
  const splashAt = useRef(-9)
  const lastPhase = useRef(null)

  useFrame((state) => {
    const p = pose?.current
    const on = p?.kind === 'work'
    const style = on ? p.style : null
    const now = performance.now() / 1000
    const fishing = style === 'fish'
    if (rod.current) rod.current.visible = fishing
    if (bobber.current) bobber.current.visible = fishing
    if (lineA.current) lineA.current.visible = fishing
    if (box.current) box.current.visible = style === 'carry'
    for (const d of dust.current) if (d) d.visible = style === 'tend'
    if (!fishing) {
      for (const r of rings.current) if (r) r.visible = false
      for (const d of drops.current) if (d) d.visible = false
      if (fishG.current) fishG.current.visible = false
      lastPhase.current = null
    }
    if (style === 'carry' && p.pk && p.pk !== parcelKind) setParcelKind(p.pk)
    if (style === 'carry' && box.current) {
      box.current.position.set(0, 0.8 + Math.sin(now * 7) * 0.012, 0.34)
      box.current.rotation.y = Math.sin(now * 3.5) * 0.04
    }
    if (style === 'tend') {
      const t = now - p.t0
      dust.current.forEach((d, i) => {
        if (!d) return
        const ph = (t * 1.4 + i * 0.33) % 1
        d.position.set(Math.sin(i * 2.1) * 0.18, 0.15 + ph * 0.5, 0.5 + Math.cos(i * 1.7) * 0.12)
        d.scale.setScalar(0.5 + (1 - ph) * 0.5)
        d.material.opacity = (1 - ph) * 0.8
      })
    }
    if (!fishing) return

    const t = now - p.t0
    const phase = p.phase ?? 'wait'
    if (p.fish !== fishId) setFishId(p.fish ?? null)
    if (phase !== lastPhase.current) {
      lastPhase.current = phase
      if (phase === 'cast') splashAt.current = -9
      if (phase === 'bite') splashAt.current = now
    }
    const { a } = fishArm(phase, t, now)
    const rx = 0.85 + (a + 1.15) * 0.9
    rod.current.position.copy(HAND)
    rod.current.rotation.set(rx, 0, 0)
    tip.set(HAND.x, HAND.y + Math.cos(rx) * ROD_LEN, HAND.z + Math.sin(rx) * ROD_LEN)

    // şamandıra konumu
    const b = bobber.current
    let showFish = false
    if (phase === 'cast') {
      if (t < 0.4) b.position.copy(tip).add(tmp.set(0, -0.35, 0))
      else {
        const k = MathUtils.clamp((t - 0.4) / 0.55, 0, 1)
        b.position.lerpVectors(tip, tgt, ease(k))
        b.position.y += Math.sin(k * Math.PI) * 1.2
        if (k >= 1 && splashAt.current < 0) splashAt.current = now
      }
    } else if (phase === 'wait') {
      b.position.set(tgt.x, WATER_Y + 0.03 + Math.sin(now * 2.2) * 0.012, tgt.z)
    } else if (phase === 'bite') {
      b.position.set(tgt.x + Math.sin(now * 18) * 0.015, WATER_Y - 0.02 - Math.abs(Math.sin(now * 13)) * 0.09, tgt.z)
    } else if (phase === 'reel') {
      const k = MathUtils.clamp(t / 0.7, 0, 1)
      b.position.lerpVectors(tgt, tip, ease(k))
      b.position.y += Math.sin(k * Math.PI) * 0.9
      showFish = Boolean(p.fish)
      if (showFish && fishG.current) {
        // yakalanan balık sudan yay çizerek kafanın üstüne gelir, orada dönerek durur
        const fk = MathUtils.clamp(t / 0.9, 0, 1)
        const hover = tmp.set(0, 1.78 + Math.sin(now * 3) * 0.04, 0.1)
        fishG.current.position.lerpVectors(tgt, hover, ease(fk))
        if (fk < 1) fishG.current.position.y += Math.sin(fk * Math.PI) * 1.2
        fishG.current.rotation.set(0, fk < 1 ? fk * 7 : now * 2.4, Math.sin(now * 9) * 0.25 * (1 - fk))
        fishG.current.scale.setScalar(0.9 + 0.25 * Math.sin(Math.min(1, fk) * Math.PI))
      }
    }
    if (fishG.current) fishG.current.visible = showFish
    setLine(lineA.current, tip, b.position)

    // halkalar (dalgacık): beklerken yavaş, vurunca hızlı
    const water = phase === 'wait' || phase === 'bite' || (phase === 'cast' && t > 0.9)
    const rate = phase === 'bite' ? 2.6 : 0.8
    rings.current.forEach((r, i) => {
      if (!r) return
      r.visible = water
      if (!water) return
      const ph = (now * rate + i / 3) % 1
      r.position.set(tgt.x, WATER_Y + 0.012, tgt.z)
      r.scale.setScalar(0.1 + ph * (phase === 'bite' ? 0.9 : 0.6))
      r.material.opacity = (1 - ph) * (phase === 'bite' ? 0.7 : 0.4)
    })
    // sıçrayan damlalar: atış inişinde ve vurunca
    const age = now - splashAt.current
    drops.current.forEach((d, i) => {
      if (!d) return
      const live = age >= 0 && age < 0.7
      d.visible = live
      if (!live) return
      const ang = i * 1.05
      const sp = 0.35 + (i % 3) * 0.12
      d.position.set(tgt.x + Math.cos(ang) * sp * age * 1.4, WATER_Y + sp * 2.4 * age - 3.4 * age * age, tgt.z + Math.sin(ang) * sp * age * 1.4)
      d.scale.setScalar(1 - age / 0.7)
    })
    void state
  })

  const ringGeo = useMemo(() => [0, 1, 2], [])
  const waterCol = useMemo(() => new Color('#ffffff'), [])
  useEffect(() => () => void 0, [])

  return (
    <>
      {/* olta */}
      <group ref={rod} visible={false}>
        <mesh position={[0, ROD_LEN / 2, 0]}>
          <cylinderGeometry args={[0.008, 0.017, ROD_LEN, 8]} />
          <meshStandardMaterial color="#c99a63" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.05, 0.03]}>
          <cylinderGeometry args={[0.04, 0.04, 0.05, 10]} />
          <meshStandardMaterial color="#6fb3e6" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.0, 0]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial color="#8d5fe0" roughness={0.5} />
        </mesh>
      </group>
      {/* misina */}
      <mesh ref={lineA} visible={false}>
        <cylinderGeometry args={[0.004, 0.004, 1, 4]} />
        <meshBasicMaterial color="#fffaf0" transparent opacity={0.9} />
      </mesh>
      {/* şamandıra */}
      <group ref={bobber} visible={false}>
        <mesh position={[0, 0.03, 0]}>
          <sphereGeometry args={[0.065, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#ff6f61" roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.03, 0]} rotation={[Math.PI, 0, 0]}>
          <sphereGeometry args={[0.065, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#ffffff" roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.12, 6]} />
          <meshStandardMaterial color="#ffd34d" roughness={0.5} />
        </mesh>
      </group>
      {ringGeo.map((i) => (
        <mesh key={i} ref={(m) => (rings.current[i] = m)} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <ringGeometry args={[0.8, 1, 32]} />
          <meshBasicMaterial color={waterCol} transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} ref={(m) => (drops.current[i] = m)} visible={false}>
          <sphereGeometry args={[0.035, 6, 6]} />
          <meshBasicMaterial color="#e8f6ff" transparent opacity={0.9} />
        </mesh>
      ))}
      <group ref={fishG} visible={false}>{fishId && <FishModel id={fishId} />}</group>
      {/* kargo */}
      <group ref={box} visible={false}>
        <Parcel kind={parcelKind} />
      </group>
      {/* bahçe işi: yükselen yaprak/toz topakları */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} ref={(m) => (dust.current[i] = m)} visible={false}>
          <sphereGeometry args={[0.06, 8, 6]} />
          <meshBasicMaterial color={i % 2 ? '#8fd9a0' : '#c9a27a'} transparent opacity={0.8} depthWrite={false} />
        </mesh>
      ))}
    </>
  )
}

/** Yalnızca bir kez gerçekten çalışma duruşu görülünce içi yüklenir (kalabalıkta 100 avatara boşuna mesh eklenmesin). */
export default memo(function WorkProp({ pose }) {
  const [need, setNeed] = useState(false)
  useFrame(() => {
    if (!need && pose?.current?.kind === 'work') setNeed(true)
  })
  return need ? <Inner pose={pose} /> : null
})
