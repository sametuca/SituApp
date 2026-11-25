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
        <Mat color="#fdb252" />
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
            <Mat color="#ffebd3" />
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

function Tiara({ color }) {
  return (
    <group position={[0, 0.86, 0.06]} rotation={[0.14, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.46, 0.028, 10, 32, Math.PI]} />
        <Mat color="#f4c55c" roughness={0.3} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.11, 0.42]}>
        <octahedronGeometry args={[0.085, 0]} />
        <Mat color={color} emissive={color} emissiveIntensity={0.25} roughness={0.25} />
      </mesh>
      {[-0.22, -0.11, 0.11, 0.22].map((x, i) => (
        <mesh key={i} position={[x, 0.06 + (1 - Math.abs(x) * 3) * 0.02, 0.44 - Math.abs(x) * 0.26]}>
          <sphereGeometry args={[i === 1 || i === 2 ? 0.05 : 0.038, 12, 12]} />
          <Mat color="#fffaf2" emissive="#fff3c4" emissiveIntensity={0.3} roughness={0.25} />
        </mesh>
      ))}
    </group>
  )
}

function Beret({ color }) {
  const dark = shade(color, -0.1)
  return (
    <group position={[0.08, 0.92, -0.02]} rotation={[0.08, 0, -0.22]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.44, 0.04, 10, 32]} />
        <Mat color={dark} />
      </mesh>
      <mesh position={[0, 0.1, 0]} scale={[1.18, 0.42, 1.18]}>
        <sphereGeometry args={[0.48, 28, 16]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0, 0.31, 0]} rotation={[0.15, 0, -0.1]}>
        <cylinderGeometry args={[0.025, 0.03, 0.1, 8]} />
        <Mat color={dark} />
      </mesh>
    </group>
  )
}

function CatEars({ color }) {
  return (
    <group position={[0, 0.56, 0.02]}>
      <mesh>
        <torusGeometry args={[0.51, 0.032, 10, 32, Math.PI]} />
        <Mat color={color} />
      </mesh>
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.34, 0.45, 0.02]} rotation={[0.08, 0, -s * 0.32]}>
          <mesh scale={[1, 1, 0.55]}>
            <coneGeometry args={[0.16, 0.32, 16]} />
            <Mat color={color} />
          </mesh>
          <mesh position={[0, -0.02, 0.038]} scale={[0.62, 0.68, 0.42]}>
            <coneGeometry args={[0.14, 0.28, 14]} />
            <Mat color="#ffebd3" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Hairpins({ color }) {
  return (
    <group>
      {[0, 1].map((i) => (
        <group key={i} position={[0.43, 0.72 - i * 0.09, 0.31]} rotation={[0.15, 0.75, -0.18]}>
          <mesh>
            <boxGeometry args={[0.18, 0.042, 0.03]} />
            <Mat color={i === 0 ? color : '#fffaf2'} />
          </mesh>
          <mesh position={[0.06, 0, 0.02]}>
            <sphereGeometry args={[0.038, 12, 12]} />
            <Mat color={i === 0 ? '#ffe58a' : color} emissive="#fff3c4" emissiveIntensity={0.25} />
          </mesh>
        </group>
      ))}
      <group position={[-0.43, 0.73, 0.3]} rotation={[0.15, -0.75, 0.18]}>
        <mesh>
          <boxGeometry args={[0.17, 0.042, 0.03]} />
          <Mat color={color} />
        </mesh>
        <mesh position={[-0.06, 0, 0.02]}>
          <sphereGeometry args={[0.038, 12, 12]} />
          <Mat color="#fffaf2" emissive="#fff3c4" emissiveIntensity={0.3} />
        </mesh>
      </group>
    </group>
  )
}

function Halo({ color }) {
  return (
    <group position={[0, 1.18, -0.02]} rotation={[0.06, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.44, 0.038, 12, 40]} />
        <Mat color={color} emissive={color} emissiveIntensity={0.45} roughness={0.25} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        return (
          <mesh key={i} position={[Math.cos(a) * 0.44, 0, Math.sin(a) * 0.44]}>
            <octahedronGeometry args={[0.045, 0]} />
            <Mat color="#fffaf2" emissive="#ffe58a" emissiveIntensity={0.5} />
          </mesh>
        )
      })}
    </group>
  )
}

function Earrings({ color }) {
  return (
    <group>
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.51, 0.25, 0.05]}>
          <mesh>
            <sphereGeometry args={[0.038, 12, 12]} />
            <Mat color="#f4c55c" roughness={0.25} metalness={0.2} />
          </mesh>
          <mesh position={[0, -0.075, 0]}>
            <sphereGeometry args={[0.052, 14, 14]} />
            <Mat color={color} emissive={color} emissiveIntensity={0.18} roughness={0.25} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function HeartShades({ color }) {
  return (
    <group position={[0, 0.38, 0.5]}>
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.2, 0, 0]} rotation={[0, 0, -s * 0.14]}>
          <mesh scale={[1.15, 0.92, 0.45]}>
            <sphereGeometry args={[0.17, 20, 16]} />
            <Mat color="#3f3352" roughness={0.15} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1.16, 1, 0.92]}>
            <torusGeometry args={[0.165, 0.032, 10, 28]} />
            <Mat color={color} />
          </mesh>
          <mesh position={[s * 0.13, 0.11, 0.06]}>
            <sphereGeometry args={[0.036, 10, 10]} />
            <Mat color="#fffaf2" emissive="#fff3c4" emissiveIntensity={0.35} />
          </mesh>
        </group>
      ))}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.022, 0.022, 0.12, 8]} />
        <Mat color={color} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * 0.41, 0.02, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.42, 8]} />
          <Mat color={color} />
        </mesh>
      ))}
    </group>
  )
}

function RoundGlasses({ color }) {
  return (
    <group position={[0, 0.38, 0.5]}>
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.2, 0, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.02, 24]} />
            <meshStandardMaterial color="#dff3ff" transparent opacity={0.28} roughness={0.1} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.165, 0.02, 10, 28]} />
            <Mat color={color} roughness={0.3} metalness={0.2} />
          </mesh>
        </group>
      ))}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.016, 0.016, 0.1, 8]} />
        <Mat color={color} roughness={0.3} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * 0.39, 0, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.42, 8]} />
          <Mat color={color} roughness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

function Scarf({ color }) {
  const light = shade(color, 0.08)
  return (
    <group position={[0, 0.03, 0.04]}>
      <mesh rotation={[Math.PI / 2 + 0.08, 0, 0]} scale={[1.05, 1, 0.9]}>
        <torusGeometry args={[0.36, 0.095, 12, 30]} />
        <Mat color={color} roughness={0.85} />
      </mesh>
      <group position={[0.16, -0.18, 0.3]} rotation={[-0.18, 0.12, -0.1]}>
        <mesh>
          <boxGeometry args={[0.16, 0.36, 0.06]} />
          <Mat color={color} roughness={0.85} />
        </mesh>
        <mesh position={[0, -0.13, 0.005]}>
          <boxGeometry args={[0.165, 0.055, 0.065]} />
          <Mat color={light} roughness={0.85} />
        </mesh>
      </group>
    </group>
  )
}

function Wings({ color }) {
  const light = shade(color, 0.1)
  return (
    <group position={[0, 0.1, -0.32]}>
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.14, 0, 0]} rotation={[0.12, s * 0.38, 0]}>
          <mesh position={[s * 0.34, 0.24, -0.06]} rotation={[0, 0, s * 0.34]} scale={[1.35, 0.72, 0.14]}>
            <sphereGeometry args={[0.32, 18, 14]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.22} transparent opacity={0.76} roughness={0.22} />
          </mesh>
          <mesh position={[s * 0.26, -0.18, -0.04]} rotation={[0, 0, -s * 0.42]} scale={[1.05, 0.56, 0.12]}>
            <sphereGeometry args={[0.26, 16, 12]} />
            <meshStandardMaterial color={light} emissive={light} emissiveIntensity={0.18} transparent opacity={0.72} roughness={0.22} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Bag({ color }) {
  const dark = shade(color, -0.08)
  return (
    <group position={[0, -0.02, -0.34]}>
      <mesh>
        <boxGeometry args={[0.42, 0.46, 0.22]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0, 0.12, -0.02]} scale={[1, 0.65, 1]}>
        <boxGeometry args={[0.44, 0.24, 0.24]} />
        <Mat color={dark} />
      </mesh>
      <mesh position={[0, 0.06, -0.14]}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <Mat color="#f4c55c" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.27, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.075, 0.022, 8, 20, Math.PI]} />
        <Mat color={dark} />
      </mesh>
    </group>
  )
}

const HEAD_PARTS = {
  crown: Crown,
  tiara: Tiara,
  bow: Bow,
  beret: Beret,
  shades: Shades,
  headphones: Headphones,
  bunny: BunnyEars,
  cat_ears: CatEars,
  hairpins: Hairpins,
  halo: Halo,
  flowers: FlowerCrown,
  hat: Hat,
  earrings: Earrings,
  heart_shades: HeartShades,
  round_glasses: RoundGlasses,
  scarf: Scarf,
}
const SPINE_PARTS = { wings: Wings, bag: Bag }

/** Tek bir aksesuar parçası (önizleme veya sahne için). */
export function AccessoryMesh({ id, color }) {
  const Part = HEAD_PARTS[id] ?? SPINE_PARTS[id]
  const hex = typeof color === 'string' && color.startsWith('#') ? color : (PASTEL_BY_ID[color]?.hex ?? '#fec071')
  return Part ? <Part color={hex} /> : null
}

/** Klonlanmış skinned modelde kafa (Head) ve gövde (Spine02) kemiklerini bulur. */
function findRigBones(model) {
  let head = null
  let end = null
  let spine = null
  model.traverse((o) => {
    if (!o.isBone) return
    if (!head && o.name === 'Head') head = o
    if (!end && o.name === 'head_end') end = o
    if (!spine && o.name === 'Spine02') spine = o
  })
  if (!head) return null
  model.updateMatrixWorld(true)
  const ws = head.getWorldScale(new Vector3()).x || 0.01
  const h = (end ? end.position.length() : 35) * ws // kafa yüksekliği (m)
  const sws = spine ? spine.getWorldScale(new Vector3()).x || ws : ws
  return { head, ws, h, spine, sws }
}

/** Kozmetik deposundaki (cosStore) seçime göre baş ve sırt aksesuarlarını takar. AvatarRig içinden çizilir. */
export function HeadAccessory({ model, cosId }) {
  const cos = useSyncExternalStore(cosStore.subscribe, () => cosStore.get(cosId))
  const rig = useMemo(() => findRigBones(model), [model])
  if (!rig || (!cos?.acc && !cos?.acc2)) return null
  const headScale = rig.h / rig.ws
  const spineScale = rig.h / rig.sws
  const items = [cos.acc, cos.acc2].filter(Boolean)
  const headItems = items.filter((it) => HEAD_PARTS[it.id])
  const spineItems = items.filter((it) => SPINE_PARTS[it.id])

  return (
    <>
      {headItems.length > 0 &&
        createPortal(
          <group scale={headScale}>
            {headItems.map((it, i) => (
              <AccessoryMesh key={`${it.id}-${i}`} id={it.id} color={it.color} />
            ))}
          </group>,
          rig.head,
        )}
      {spineItems.length > 0 &&
        rig.spine &&
        createPortal(
          <group scale={spineScale}>
            {spineItems.map((it, i) => (
              <AccessoryMesh key={`${it.id}-${i}`} id={it.id} color={it.color} />
            ))}
          </group>,
          rig.spine,
        )}
    </>
  )
}
