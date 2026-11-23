import { useMemo, useSyncExternalStore } from 'react'
import { createPortal } from '@react-three/fiber'
import { Color, Vector3 } from 'three'
import { PASTEL_BY_ID } from './cosmeticsData'
import { cosStore } from './cosStore'

// Aksesuarlar procedural (three.js ilkelleri) ve pastel/oyuncak görünümlüdür. "Baş birimi" koordinatlarında çizilir:
// 1 birim = kafa yüksekliği (Head kemiği → head_end), orijin = kafa kemiği (boyun üstü), +y yukarı, +z yüzün baktığı yön.

const shade = (hex, amt) => `#${new Color(hex).offsetHSL(0, 0, amt).getHexString()}`

function Mat({ color, ...p }) {
  return <meshStandardMaterial color={color} roughness={0.55} metalness={0.02} {...p} />
}

function Crown({ color }) {
  const points = 5
  return (
    <group position={[0, 0.9, -0.02]}>
      <mesh>
        <cylinderGeometry args={[0.42, 0.46, 0.14, 28]} />
        <Mat color={color} />
      </mesh>
      {Array.from({ length: points }, (_, i) => {
        const a = (i / points) * Math.PI * 2
        return (
          <group key={i} position={[Math.sin(a) * 0.43, 0.07, Math.cos(a) * 0.43]}>
            <mesh position={[0, 0.1, 0]}>
              <coneGeometry args={[0.08, 0.24, 10]} />
              <Mat color={color} />
            </mesh>
            <mesh position={[0, 0.26, 0]}>
              <sphereGeometry args={[0.045, 12, 12]} />
              <Mat color="#fffaf2" emissive="#fff3c4" emissiveIntensity={0.4} />
            </mesh>
          </group>
        )
      })}
      <mesh position={[0, 0, 0.455]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <Mat color="#ff7eb3" />
      </mesh>
    </group>
  )
}

function Bow({ color }) {
  const dark = shade(color, -0.08)
  return (
    <group position={[0.36, 0.88, 0.3]} rotation={[0.2, 0.4, -0.45]} scale={1.7}>
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * 0.16, 0, 0]} rotation={[0, 0, (-s * Math.PI) / 2]}>
          <coneGeometry args={[0.13, 0.28, 16]} />
          <Mat color={color} />
        </mesh>
      ))}
      <mesh>
        <sphereGeometry args={[0.075, 14, 14]} />
        <Mat color={dark} />
      </mesh>
    </group>
  )
}

function Shades({ color }) {
  return (
    <group position={[0, 0.38, 0.5]}>
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.2, 0, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.17, 0.17, 0.05, 24]} />
            <Mat color="#4a3b5c" roughness={0.2} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.005]}>
            <torusGeometry args={[0.17, 0.03, 10, 28]} />
            <Mat color={color} />
          </mesh>
        </group>
      ))}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, 0.1, 8]} />
        <Mat color={color} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * 0.4, 0, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.42, 8]} />
          <Mat color={color} />
        </mesh>
      ))}
    </group>
  )
}

function Headphones({ color }) {
  return (
    <group position={[0, 0.5, -0.02]}>
      <mesh>
        <torusGeometry args={[0.56, 0.055, 12, 36, Math.PI]} />
        <Mat color="#fffaf2" />
      </mesh>
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.57, 0, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.18, 0.18, 0.12, 24]} />
            <Mat color={color} />
          </mesh>
          <mesh position={[s * 0.06, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.1, 0.1, 0.04, 20]} />
            <Mat color="#fffaf2" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function BunnyEars({ color }) {
  return (
    <group position={[0, 0.88, -0.04]}>
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.22, 0.22, 0]} rotation={[0, 0, -s * 0.22]}>
          <mesh>
            <capsuleGeometry args={[0.1, 0.42, 6, 14]} />
            <Mat color={color} />
          </mesh>
          <mesh position={[0, 0.0, 0.045]} scale={[0.55, 1, 0.5]}>
            <capsuleGeometry args={[0.085, 0.38, 6, 14]} />
            <Mat color="#ffd3e6" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function FlowerCrown({ color }) {
  const n = 8
  const light = shade(color, 0.08)
  return (
    <group position={[0, 0.86, -0.02]} rotation={[0.1, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.48, 0.03, 8, 36]} />
        <Mat color="#9fdcb4" />
      </mesh>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2
        const petal = i % 2 ? color : light
        return (
          <group key={i} position={[Math.sin(a) * 0.48, 0.02, Math.cos(a) * 0.48]} rotation={[0, a, 0]}>
            {Array.from({ length: 5 }, (_, k) => {
              const b = (k / 5) * Math.PI * 2
              return (
                <mesh key={k} position={[Math.cos(b) * 0.085, Math.sin(b) * 0.085, 0.03]}>
                  <sphereGeometry args={[0.065, 10, 10]} />
                  <Mat color={petal} />
                </mesh>
              )
            })}
            <mesh position={[0, 0, 0.07]}>
              <sphereGeometry args={[0.05, 10, 10]} />
              <Mat color="#ffe58a" />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function Hat({ color }) {
  return (
    <group position={[0, 0.9, 0]}>
      <mesh>
        <cylinderGeometry args={[0.62, 0.64, 0.04, 36]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.38, 0.42, 0.24, 28]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0, 0.24, 0]}>
        <sphereGeometry args={[0.38, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.43, 0.04, 10, 36]} />
        <Mat color="#fffaf2" />
      </mesh>
      <mesh position={[0.36, 0.06, 0.24]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <Mat color={shade(color, -0.1)} />
      </mesh>
    </group>
  )
}

const PARTS = { crown: Crown, bow: Bow, shades: Shades, headphones: Headphones, bunny: BunnyEars, flowers: FlowerCrown, hat: Hat }

/** Baş birimi koordinatlarında tek bir aksesuar. */
export function AccessoryMesh({ id, color }) {
  const Part = PARTS[id]
  const hex = PASTEL_BY_ID[color]?.hex ?? '#ff9ec8'
  return Part ? <Part color={hex} /> : null
}

/** Klonlanmış skinned modelde kafa kemiğini ve kafa yüksekliğini (metre, dünya ölçeğinde) bulur. */
function findHead(model) {
  let head = null
  let end = null
  model.traverse((o) => {
    if (!o.isBone) return
    if (!head && o.name === 'Head') head = o
    if (!end && o.name === 'head_end') end = o
  })
  if (!head) return null
  model.updateMatrixWorld(true)
  const ws = head.getWorldScale(new Vector3()).x || 0.01
  const h = (end ? end.position.length() : 35) * ws // kafa yüksekliği (m)
  return { head, ws, h }
}

/** Kozmetik deposundaki (cosStore) seçime göre kafa kemiğine bağlanan aksesuar. AvatarRig içinden çizilir. */
export function HeadAccessory({ model, cosId }) {
  const cos = useSyncExternalStore(cosStore.subscribe, () => cosStore.get(cosId))
  const rig = useMemo(() => findHead(model), [model])
  if (!rig || !cos?.acc) return null
  // grup: baş birimini kemik birimine çevirir (kemik ölçeği ~0.0108, kafa ~0.35 m)
  const s = rig.h / rig.ws
  return createPortal(
    <group scale={s}>
      <AccessoryMesh id={cos.acc.id} color={cos.acc.color} />
    </group>,
    rig.head,
  )
}
