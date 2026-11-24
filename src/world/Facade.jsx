// Mekân ön cepheleri: her mekânın kapısı, camları, tentesi ve süsleri farklıdır (veri: facadeData.js). Bina yerel çerçevesi: cephe z = d/2, x genişlik.
import { RoundedBox } from '@react-three/drei'
import { SKY_MATS } from './Sky'
import Prop from './Prop'

const cream = '#fffaf2'
const Glass = () => <primitive object={SKY_MATS.window} attach="material" />
const Mat = ({ c, r = 0.5, e, ei }) => <meshStandardMaterial color={c} roughness={r} emissive={e} emissiveIntensity={ei} />

function Door({ w, h, c, arch, style, open, z }) {
  if (open) {
    // açık giriş (plaj barı): içeri açılan sıcak bir boşluk
    return (
      <group position={[0, 0, z]}>
        <mesh position={[0, h / 2, 0.02]}>
          <boxGeometry args={[w, h, 0.05]} />
          <Mat c="#6b4a2e" r={0.9} />
        </mesh>
        <mesh position={[0, h + 0.06, 0.1]}>
          <boxGeometry args={[w + 0.3, 0.14, 0.2]} />
          <Mat c={cream} />
        </mesh>
      </group>
    )
  }
  return (
    <group position={[0, 0, z]}>
      <RoundedBox args={[w + 0.24, h + 0.14, 0.14]} radius={0.05} position={[0, (h + 0.14) / 2, 0.03]}>
        <Mat c={cream} />
      </RoundedBox>
      {arch && (
        <mesh position={[0, h + 0.07, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[(w + 0.24) / 2, (w + 0.24) / 2, 0.14, 20, 1, false, 0, Math.PI]} />
          <Mat c={cream} />
        </mesh>
      )}
      <mesh position={[0, h / 2, 0.11]}>
        <boxGeometry args={[w, h, 0.05]} />
        <Mat c={c} r={0.4} />
      </mesh>
      {arch && (
        <mesh position={[0, h, 0.11]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[w / 2, w / 2, 0.05, 20, 1, false, 0, Math.PI]} />
          <Mat c={c} r={0.4} />
        </mesh>
      )}
      {style === 'double' && (
        <mesh position={[0, h / 2, 0.145]}>
          <boxGeometry args={[0.04, h, 0.02]} />
          <Mat c={cream} />
        </mesh>
      )}
      <mesh position={[style === 'double' ? 0.2 : w * 0.32, h * 0.5, 0.15]}>
        <circleGeometry args={[0.06, 12]} />
        <Mat c="#ffd35e" r={0.3} />
      </mesh>
    </group>
  )
}

function GlassPane({ k, x, w, W, z }) {
  const px = x * W
  const gw = (w ?? 0.4) * W
  if (k === 'round')
    return (
      <group position={[px, 1.75, z]}>
        <mesh position={[0, 0, 0.01]}>
          <circleGeometry args={[0.48, 24]} />
          <Glass />
        </mesh>
        <mesh>
          <ringGeometry args={[0.48, 0.62, 24]} />
          <Mat c={cream} />
        </mesh>
      </group>
    )
  if (k === 'tall')
    return (
      <group position={[px, 1.5, z]}>
        <mesh position={[0, 0, 0.01]}>
          <boxGeometry args={[0.7, 2.0, 0.08]} />
          <Glass />
        </mesh>
        <mesh position={[0, 0, 0.06]}>
          <boxGeometry args={[0.76, 0.06, 0.03]} />
          <Mat c={cream} />
        </mesh>
      </group>
    )
  if (k === 'strip')
    return (
      <group position={[px, 2.35, z]}>
        {[-1.5, -0.5, 0.5, 1.5].map((i) => (
          <mesh key={i} position={[(i * gw) / 4.4, 0, 0.01]}>
            <boxGeometry args={[gw / 4.8, 0.8, 0.08]} />
            <Glass />
          </mesh>
        ))}
      </group>
    )
  if (k === 'screen')
    return (
      <group position={[px, 1.7, z]}>
        <mesh position={[0, 0, 0.01]}>
          <boxGeometry args={[gw, 1.5, 0.08]} />
          <Mat c="#bfe9ff" e="#7fcdf3" ei={0.9} />
        </mesh>
        <mesh position={[0, 0, 0.07]}>
          <boxGeometry args={[gw + 0.14, 1.64, 0.04]} />
          <Mat c="#3a2d63" />
        </mesh>
      </group>
    )
  // big / lattice
  return (
    <group position={[px, 1.6, z]}>
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[gw, 1.5, 0.08]} />
        <Glass />
      </mesh>
      <mesh position={[0, -0.82, 0.07]}>
        <boxGeometry args={[gw + 0.2, 0.14, 0.14]} />
        <Mat c={cream} />
      </mesh>
      {k === 'lattice' && (
        <>
          <mesh position={[0, 0, 0.06]}>
            <boxGeometry args={[0.05, 1.5, 0.03]} />
            <Mat c={cream} />
          </mesh>
          <mesh position={[0, 0, 0.06]}>
            <boxGeometry args={[gw, 0.05, 0.03]} />
            <Mat c={cream} />
          </mesh>
        </>
      )}
    </group>
  )
}

function Awning({ w, d, c, stripe, z }) {
  const n = Math.max(4, Math.round(w / 1.1))
  const sw = (w * 0.9) / n
  return (
    <group position={[0, 2.85, z + 0.7]} rotation={[0.32, 0, 0]}>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} position={[(i - (n - 1) / 2) * sw, 0, 0]} castShadow>
          <boxGeometry args={[sw, 0.1, 1.5]} />
          <Mat c={stripe && i % 2 ? stripe : c} r={0.6} />
        </mesh>
      ))}
    </group>
  )
}

function Extra({ kind, W, h, z, doorX, accent }) {
  const dx = doorX
  switch (kind) {
    case 'pole':
      return (
        <group position={[dx - 1.25, 0, z + 0.3]}>
          {Array.from({ length: 8 }, (_, i) => (
            <mesh key={i} position={[0, 0.25 + i * 0.22, 0]}>
              <cylinderGeometry args={[0.13, 0.13, 0.22, 10]} />
              <Mat c={['#ffffff', '#ff9f43', '#ffffff', '#5fc0ea'][i % 4]} />
            </mesh>
          ))}
          <mesh position={[0, 2.1, 0]}>
            <sphereGeometry args={[0.15, 10, 8]} />
            <Mat c="#ffd35e" />
          </mesh>
        </group>
      )
    case 'cone':
      return (
        <group position={[0, h + 0.9, z - 0.2]} rotation={[0, 0, Math.PI]}>
          <mesh>
            <coneGeometry args={[0.55, 1.4, 14]} />
            <Mat c="#f0c48a" />
          </mesh>
          <mesh position={[0, -0.85, 0]}>
            <sphereGeometry args={[0.55, 14, 12]} />
            <Mat c="#ffc2dc" />
          </mesh>
          <mesh position={[0, -1.35, 0]}>
            <sphereGeometry args={[0.42, 14, 12]} />
            <Mat c="#fff3c8" />
          </mesh>
        </group>
      )
    case 'cupcake':
      return (
        <group position={[0, h + 0.55, z - 0.3]}>
          <mesh>
            <cylinderGeometry args={[0.5, 0.36, 0.5, 14]} />
            <Mat c="#f0c48a" />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <sphereGeometry args={[0.52, 14, 12]} />
            <Mat c="#ffc2dc" />
          </mesh>
          <mesh position={[0, 0.98, 0]}>
            <sphereGeometry args={[0.13, 10, 8]} />
            <Mat c="#e8952c" />
          </mesh>
        </group>
      )
    case 'boards':
      return [-1, 1].map((s) => (
        <group key={s} position={[dx + s * 1.5, 0, z + 0.5]} rotation={[-0.12, 0, s * 0.1]}>
          <Prop model={s < 0 ? '/models/venues/surfboard-a.glb' : '/models/venues/surfboard-b.glb'} x={0} z={0} scale={2.3} />
        </group>
      ))
    case 'planters':
      return [-1, 1].map((s) => (
        <group key={s} position={[dx + s * 1.1, 0, z + 0.55]}>
          <Prop model="/models/cafe/cafe-plant.glb" x={0} z={0} scale={0.95} />
        </group>
      ))
    case 'lantern':
      return (
        <group position={[dx + 0.95, 2.35, z + 0.2]}>
          <mesh>
            <boxGeometry args={[0.22, 0.34, 0.22]} />
            <Mat c="#ffe48f" e="#ffd35e" ei={0.7} />
          </mesh>
          <mesh position={[0, 0.25, 0]}>
            <coneGeometry args={[0.2, 0.16, 4]} />
            <Mat c="#8a5a2b" />
          </mesh>
        </group>
      )
    case 'marquee':
      {
        const n = Math.max(6, Math.round(W / 0.9))
      return (
        <group position={[0, 3.0, z + 0.08]}>
          {Array.from({ length: n }, (_, i) => (
            <mesh key={i} position={[(i - (n - 1) / 2) * ((W * 0.8) / n), 0, 0]}>
              <sphereGeometry args={[0.1, 8, 6]} />
              <Mat c="#fff3c8" e="#ffd35e" ei={1.2} />
            </mesh>
          ))}
        </group>
      )
      }
    case 'neonframe':
      return (
        <group position={[dx, 1.2, z + 0.2]}>
          <mesh position={[-1.15, 0, 0]}>
            <boxGeometry args={[0.07, 2.7, 0.06]} />
            <primitive object={SKY_MATS.neonBlue} attach="material" />
          </mesh>
          <mesh position={[1.15, 0, 0]}>
            <boxGeometry args={[0.07, 2.7, 0.06]} />
            <primitive object={SKY_MATS.neonBlue} attach="material" />
          </mesh>
          <mesh position={[0, 1.38, 0]}>
            <boxGeometry args={[2.37, 0.07, 0.06]} />
            <primitive object={SKY_MATS.neonPink} attach="material" />
          </mesh>
        </group>
      )
    case 'neonsign':
      return (
        <mesh position={[dx + 1.7, 2.1, z + 0.1]}>
          <boxGeometry args={[1.1, 0.4, 0.06]} />
          <primitive object={SKY_MATS.neonPink} attach="material" />
        </mesh>
      )
    case 'flag':
      return (
        <group position={[W / 2 - 0.5, h, z - 0.4]}>
          <mesh position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 2.4, 6]} />
            <Mat c="#d9d2e6" />
          </mesh>
          <mesh position={[0.4, 2.05, 0]}>
            <boxGeometry args={[0.8, 0.5, 0.03]} />
            <Mat c={accent} />
          </mesh>
        </group>
      )
    case 'chalk':
      return (
        <mesh position={[dx + 1.15, 0.55, z + 0.7]} rotation={[-0.12, 0, 0]}>
          <boxGeometry args={[0.7, 1.0, 0.06]} />
          <Mat c="#3b3446" />
        </mesh>
      )
    case 'palmthatch':
      return (
        <mesh position={[0, 2.95, z + 0.9]} rotation={[0.35, 0, 0]}>
          <boxGeometry args={[W * 0.95, 0.16, 2.0]} />
          <Mat c="#d9b36a" r={0.95} />
        </mesh>
      )
    case 'flowers':
      return [-1, 1].map((s) => (
        <mesh key={s} position={[dx + s * 1.0, 0.25, z + 0.4]}>
          <boxGeometry args={[0.7, 0.4, 0.4]} />
          <Mat c="#a0723a" />
        </mesh>
      ))
    default:
      return null
  }
}

/** Mekânın ön cephesi (kapı + camlar + tente + süsler). z = cephenin ön yüzü (d/2). */
export default function Facade({ F, w, h, roof, z }) {
  const doorX = F.door.x * w
  return (
    <group>
      <group position={[doorX, 0, 0]}>
        <Door {...F.door} z={z} />
      </group>
      {F.glass.map((g, i) => (
        <GlassPane key={i} {...g} W={w} z={z} />
      ))}
      {F.awning && <Awning w={w} c={F.awning.c} stripe={F.awning.stripe} z={z} />}
      {F.extra.map((k) => (
        <Extra key={k} kind={k} W={w} h={h} z={z} doorX={doorX} accent={roof} />
      ))}
    </group>
  )
}
