import { Suspense, useRef, useSyncExternalStore } from 'react'
import { Billboard, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, MathUtils, Shape, ShapeGeometry } from 'three'
import { cosStore } from './cosStore'
import Prop from './Prop'
import { bike } from './bikeStore'
import { together } from './features/togetherStore'
import { work } from './features/jobStore'
import { petting } from './pettingStore'

// Evcil hayvanlar: Meshy GLB (statik), hareket procedural (zıplama, nefes, sağa sola bakma). Yaklaşık 0,5 m boyunda.
// Sunucu trafiği yok: konum, sahibin konumundan (yerel: focusRef, uzak: remotes) istemcide türetilir.

const PET_URL = { cat: '/models/pets/pet-cat.glb', bunny: '/models/pets/pet-bunny.glb', chick: '/models/pets/pet-chick.glb', dog: '/models/pets/pet-dog.glb' }
const PET_SIZE = 0.5 // en büyük boyut (m); avatar 1,3 m
const PET_DURATION = 3.6
const HEART_SHAPE = new Shape()
HEART_SHAPE.moveTo(0, -0.45)
HEART_SHAPE.bezierCurveTo(-0.55, -0.08, -0.55, 0.3, -0.26, 0.37)
HEART_SHAPE.bezierCurveTo(-0.12, 0.4, -0.04, 0.31, 0, 0.24)
HEART_SHAPE.bezierCurveTo(0.04, 0.31, 0.12, 0.4, 0.26, 0.37)
HEART_SHAPE.bezierCurveTo(0.55, 0.3, 0.55, -0.08, 0, -0.45)
const HEART_GEOMETRY = new ShapeGeometry(HEART_SHAPE, 16)
Object.values(PET_URL).forEach((u) => useGLTF.preload(u))

/** Evcil hayvan modeli (Meshy GLB; orijin = tabanın ortası, +z'ye bakar). Hareket PetFollower'da procedural. */
export function PetModel({ kind, onClick }) {
  const url = PET_URL[kind]
  return url ? (
    <Suspense fallback={null}>
      <group onClick={onClick}>
        <Prop model={url} x={0} z={0} scale={PET_SIZE} />
      </group>
    </Suspense>
  ) : null
}

function PetHearts({ startedAt }) {
  const hearts = useRef([])

  useFrame(() => {
    const now = performance.now() / 1000
    const start = startedAt.current
    hearts.current.forEach((heart, i) => {
      if (!heart) return
      const age = now - start - i * 0.66
      const visible = start > 0 && age >= 0 && age < 0.96
      heart.visible = visible
      if (!visible) return
      const progress = age / 0.96
      heart.position.set((i - 2) * 0.12 + Math.sin(age * 4 + i) * 0.025, 0.58 + progress * 0.42, 0.08)
      heart.rotation.z = Math.sin(age * 3 + i) * 0.16
      heart.scale.setScalar(0.09 + Math.sin(progress * Math.PI) * 0.08)
      heart.material.opacity = 0.95 * (1 - progress)
    })
  })

  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <Billboard key={i}>
          <mesh
            ref={(node) => {
              hearts.current[i] = node
            }}
            geometry={HEART_GEOMETRY}
            visible={false}
          >
            <meshBasicMaterial color="#ff7195" transparent opacity={0.95} depthWrite={false} side={DoubleSide} toneMapped={false} />
          </mesh>
        </Billboard>
      ))}
    </>
  )
}

const STOP_DIST = 0.95 // sahibine bu kadar yaklaşınca durur
const GO_DIST = 1.7 // sahibi bu kadar uzaklaşınca peşinden gider
const SNAP_DIST = 9 // çok uzakta kalırsa (ışınlanma, oda değişimi) sahibinin yanına atlar

/** Sahibini yumuşakça takip eden evcil hayvan. getOwner() → { x, z } | null */
function PetFollower({ kind, getOwner, interactive = false }) {
  const group = useRef()
  const body = useRef()
  const petStartedAt = useRef(0)
  const st = useRef({ init: false, x: 0, z: 0, ry: 0, moving: false, phase: 0, t: Math.random() * 10 })

  const pet = (e) => {
    e.stopPropagation()
    const owner = getOwner()
    if (!interactive || !owner || bike.on || together.self.current || work.self.current) return
    const now = performance.now() / 1000
    petStartedAt.current = now
    petting.self = {
      kind: 'pet',
      style: 'pet',
      t0: now,
      until: now + PET_DURATION,
      ry: Math.atan2(st.current.x - owner.x, st.current.z - owner.z),
    }
  }

  useFrame((_, dtRaw) => {
    const g = group.current
    const o = getOwner()
    if (!g) return
    if (!o) {
      g.visible = false
      st.current.init = false
      return
    }
    const dt = Math.min(dtRaw, 0.1)
    const s = st.current
    if (!s.init) {
      s.init = true
      s.x = o.x + 0.8
      s.z = o.z + 0.8
    }
    let dx = o.x - s.x
    let dz = o.z - s.z
    let d = Math.hypot(dx, dz)
    if (d > SNAP_DIST) {
      s.x = o.x + 0.8
      s.z = o.z + 0.8
      dx = o.x - s.x
      dz = o.z - s.z
      d = Math.hypot(dx, dz)
    }
    s.t += dt
    if (!s.moving && d > GO_DIST) s.moving = true
    if (s.moving && d < STOP_DIST) s.moving = false

    let want = Math.atan2(dx, dz)
    if (s.moving) {
      const speed = Math.min(7.5, 2 + d * 1.5)
      const step = Math.min(speed * dt, Math.max(0, d - STOP_DIST * 0.9))
      s.x += (dx / d) * step
      s.z += (dz / d) * step
      s.phase += dt * 13
    } else if (d < 0.3) {
      want = s.ry // sahibinin tam üstündeyse dönme
    }
    s.ry += (MathUtils.euclideanModulo(want - s.ry + Math.PI, Math.PI * 2) - Math.PI) * Math.min(1, dt * (s.moving ? 10 : 3))

    g.visible = true
    g.position.set(s.x, 0, s.z)
    g.rotation.y = s.ry
    const b = body.current
    if (b) {
      if (s.moving) {
        b.position.y = Math.abs(Math.sin(s.phase)) * 0.14
        b.rotation.x = Math.sin(s.phase) * 0.1
        b.rotation.y = 0
        b.rotation.z = Math.sin(s.phase * 0.5) * 0.08
        b.scale.set(1, 1, 1)
      } else {
        // dururken: nefes alır, hafifçe sallanır, ara sıra küçük bir zıplama yapar
        const hop = Math.max(0, Math.sin(s.t * 1.1)) ** 24 * 0.12
        b.position.y = hop
        b.rotation.x = 0
        b.rotation.z = Math.sin(s.t * 2.2) * 0.05
        // ara sıra sağa sola bakar
        b.rotation.y = Math.sin(s.t * 0.7) * Math.max(0, Math.sin(s.t * 0.23)) * 0.6
        const br = 1 + Math.sin(s.t * 3) * 0.02
        b.scale.set(1, br, 1)
      }
    }
  })

  return (
    <group ref={group} visible={false}>
      <group ref={body}>
        <PetModel kind={kind} onClick={interactive ? pet : undefined} />
      </group>
      {interactive && <PetHearts startedAt={petStartedAt} />}
      {/* yumuşak gölge lekesi */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.22, 20]} />
        <meshBasicMaterial color="#8a6bd1" transparent opacity={0.16} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** Odadaki herkesin (ve kendimin) evcil hayvanlarını çizer. Canvas içinde, bir kez render edilir. */
export function PetLayer({ focusRef, remotes }) {
  useSyncExternalStore(cosStore.subscribe, cosStore.version)
  const owners = ['self', ...cosStore.ids()].filter((id) => cosStore.get(id)?.pet)
  return owners.map((id) => (
    <PetFollower
      key={`${id}:${cosStore.get(id).pet}`}
      kind={cosStore.get(id).pet}
      interactive={id === 'self'}
      getOwner={id === 'self' ? () => focusRef.current : () => remotes.current.get(id)}
    />
  ))
}
