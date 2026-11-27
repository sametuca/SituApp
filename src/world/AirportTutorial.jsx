// Havalimanı başlangıç eğitimi sahnesi: zemin okları, işaret ışıkları, hedef yıldızı.
import { Suspense, useMemo, useRef, useState } from 'react'
import { TopDock } from '../components/Dock'
import { useFrame } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import { Shape } from 'three'
import { screenK } from './screenK'
import { DoorPrompt } from './Social'

const TUT_STAR = { x: 1.4, z: 1.5 }
const TUT_DOOR = { x: -7.0, z: -0.4 }
const TUT_EXIT = { x: 0, z: 4.1 }

const TARGET_FOR = {
  collect: { ...TUT_STAR, color: '#fdb252' },
  door: { ...TUT_DOOR, color: '#6fd1a6' },
  exit: { ...TUT_EXIT, color: '#fdb252' },
}

const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  dx: Math.round(Math.cos((i / 18) * Math.PI * 2) * (65 + (i % 3) * 28)),
  dy: Math.round(Math.sin((i / 18) * Math.PI * 2) * (50 + (i % 3) * 24) - 20),
  rot: (i * 53) % 360,
  color: ['#fdb252', '#a88bff', '#8fd0ff', '#8fe3c0', '#ffe48f'][i % 5],
  delay: (i % 4) * 0.03,
}))

const STEPS = [
  { id: 'collect', emoji: '⭐', title: 'Önündeki yıldızı al', hint: 'Okları takip edip yaklaş, E tuşuna bas.' },
  { id: 'inventory', emoji: '🎒', title: 'Çantanı aç', hint: 'Aldığın hediye soldaki çantanda.' },
  { id: 'door', emoji: '🚪', title: 'Mekân kapısını dene', hint: 'Kapının önüne yürüyüp E tuşuna bas.' },
  { id: 'wardrobe', emoji: '👗', title: 'Tarzını ayarla', hint: 'Soldaki gardıroptan görünümünü kaydet.' },
  { id: 'exit', emoji: '🏖️', title: 'Kasabaya çık', hint: 'Güneydeki çıkış kapısından plaja in.' },
]

/** Oyuncunun ayağından aktif hedefe uzanan, sırayla parlayan 3D yer okları. */
function FloorArrows({ focusRef, target }) {
  const grpRef = useRef()
  const meshes = useRef([])
  const chevron = useMemo(() => {
    // XY düzleminde ucu -Y'de: rotation.x = -PI/2 ile ucu yerel +Z'ye (hedefe) bakar
    const sh = new Shape()
    sh.moveTo(0, -0.34)
    sh.lineTo(0.32, 0.14)
    sh.lineTo(0.18, 0.24)
    sh.lineTo(0, -0.04)
    sh.lineTo(-0.18, 0.24)
    sh.lineTo(-0.32, 0.14)
    sh.closePath()
    return sh
  }, [])

  useFrame(({ clock }) => {
    const g = grpRef.current
    if (!g) return
    if (!target) {
      g.visible = false
      return
    }
    const f = focusRef.current
    const dx = target.x - f.x
    const dz = target.z - f.z
    const dist = Math.hypot(dx, dz)
    if (dist < 1.6) {
      g.visible = false
      return
    }
    g.visible = true
    g.position.set(f.x, 0.07, f.z)
    g.rotation.y = Math.atan2(dx, dz)

    const count = 5
    const startOff = 0.95
    const usable = Math.max(0.4, dist - 1.9)
    const t = clock.elapsedTime * 3.4
    for (let i = 0; i < count; i++) {
      const m = meshes.current[i]
      if (!m) continue
      const frac = (i + 0.5) / count
      const zPos = startOff + frac * usable
      if (zPos > dist - 0.85) {
        m.visible = false
        continue
      }
      m.visible = true
      m.position.set(0, 0, zPos)
      const wave = 0.5 + 0.5 * Math.sin(t - i * 0.9)
      const sc = 0.78 + wave * 0.22
      m.scale.set(sc, sc, 1)
      m.material.opacity = 0.35 + wave * 0.6
    }
  })

  return (
    <group ref={grpRef} visible={false}>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh
          key={i}
          ref={(el) => (meshes.current[i] = el)}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <shapeGeometry args={[chevron]} />
          <meshBasicMaterial color={target?.color ?? '#fdb252'} transparent opacity={0.85} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

function Beacon({ x, z, color, label, children }) {
  const ring = useRef()
  const arrow = useRef()
  const pillar = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (ring.current) {
      const s = 1 + Math.sin(t * 3.5) * 0.1
      ring.current.scale.set(s, s, 1)
    }
    if (arrow.current) {
      arrow.current.position.y = 2.35 + Math.abs(Math.sin(t * 3)) * 0.32
      arrow.current.rotation.y = t * 1.6
    }
    if (pillar.current) pillar.current.material.opacity = 0.16 + Math.sin(t * 2.4) * 0.05
  })
  return (
    <group position={[x, 0, z]}>
      <mesh ref={ring} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.52, 0.72, 36]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.65} transparent opacity={0.88} />
      </mesh>
      {children}
      {/* uzaktan görünen ışık sütunu + zıplayan ok */}
      <mesh ref={pillar} position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.46, 0.7, 3.2, 20, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} depthWrite={false} side={2} />
      </mesh>
      <mesh ref={arrow} position={[0, 2.4, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.2, 0.42, 4]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} roughness={0.5} />
      </mesh>
      <Html position={[0, 1.45, 0]} center distanceFactor={9 * screenK()} zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
        <div className="venue-pin inline-flex w-max min-w-max items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-white bg-white/95 px-5 py-1.5 text-sm font-black leading-none text-[#4a3b5c] shadow-soft">
          {label}
        </div>
      </Html>
    </group>
  )
}

function SpinningStar() {
  const { scene } = useGLTF('/models/collectibles/star.glb')
  const ref = useRef()
  const [clone] = useState(() => scene.clone(true))
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    ref.current.rotation.y = t * 1.9
    ref.current.position.y = 0.55 + Math.sin(t * 2.8) * 0.14
  })
  return (
    <group ref={ref} scale={0.65}>
      <primitive object={clone} />
    </group>
  )
}

/** Havalimanı eğitim holündeki 3D etkileşim noktaları + mesafe takibi. */
export function AirportTutorialScene({ step, focusRef, onNear }) {
  const lastNear = useRef(null)
  useFrame(() => {
    const f = focusRef.current
    let next = null
    if (step === 'collect' && Math.hypot(f.x - TUT_STAR.x, f.z - TUT_STAR.z) < 2.0) next = 'collect'
    else if (step === 'door' && Math.hypot(f.x - TUT_DOOR.x, f.z - TUT_DOOR.z) < 2.2) next = 'door'
    if (next !== lastNear.current) {
      lastNear.current = next
      onNear(next)
    }
  })

  const target = TARGET_FOR[step] ?? null

  return (
    <>
      <FloorArrows focusRef={focusRef} target={target} />
      {step === 'collect' && (
        <Beacon x={TUT_STAR.x} z={TUT_STAR.z} color="#ffd35e" label="⭐ Topla (E)">
          <Suspense fallback={null}>
            <SpinningStar />
          </Suspense>
        </Beacon>
      )}
      {step === 'door' && <Beacon x={TUT_DOOR.x} z={TUT_DOOR.z} color="#8fe3c0" label="🚪 Mekân Kapısı (E)" />}
      {step === 'exit' && <Beacon x={TUT_EXIT.x} z={TUT_EXIT.z} color="#fdb252" label="🏖️ Şehre Çık (E)" />}
    </>
  )
}

/** Sade, kalabalık yaratmayan üst görev kartı, konfeti kutlaması ve yakın istemi. */
export function AirportTutorialHud({ step, near, touch, celebrate, onCollect, onDoor, onOpenInventory, onOpenWardrobe, onSkip }) {
  const idx = STEPS.findIndex((s) => s.id === step)
  const cur = STEPS[idx]
  if (!cur) return null

  return (
    <>
      <TopDock><div className="relative pointer-events-auto w-[min(92vw,24rem)] animate-pop rounded-3xl border-2 border-white bg-white/94 px-4 py-3 shadow-toy backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#fff3c8] px-2.5 py-0.5 text-[11px] font-black text-[#8a5a00]">
              {idx + 1}/{STEPS.length}
            </span>
            <div className="flex items-center gap-1" aria-hidden>
              {STEPS.map((s, i) => (
                <span
                  key={s.id}
                  className={`h-1.5 rounded-full transition-all ${
                    i < idx ? 'w-1.5 bg-[#7fd8a8]' : i === idx ? 'w-4 bg-[#fdb252]' : 'w-1.5 bg-[#e8dff8]'
                  }`}
                />
              ))}
            </div>
          </div>
          <button onClick={onSkip} className="rounded-full px-2 py-0.5 text-[11px] font-extrabold text-[#8a7a9c] transition hover:bg-[#f6f0ff]">
            Atla 👉
          </button>
        </div>

        <div className="mt-2 flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#fff7eb] text-xl">{cur.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black leading-snug text-[#4a3b5c] sm:text-base">{cur.title}</p>
            <p className="mt-0.5 text-[11px] font-semibold leading-snug text-[#8a7a9c] sm:text-xs">{cur.hint}</p>
          </div>
          {step === 'inventory' ? (
            <button onClick={onOpenInventory} className="shrink-0 rounded-2xl border-b-4 border-[#d98a1c] bg-[#fdb252] px-3.5 py-1.5 text-xs font-black text-white shadow-soft active:translate-y-[2px] active:border-b-2">
              🎒 Aç
            </button>
          ) : step === 'wardrobe' ? (
            <button onClick={onOpenWardrobe} className="shrink-0 rounded-2xl border-b-4 border-[#7a5fd0] bg-[#a88bff] px-3.5 py-1.5 text-xs font-black text-white shadow-soft active:translate-y-[2px] active:border-b-2">
              👗 Aç
            </button>
          ) : null}
        </div>
      </div></TopDock>

      {/* adım tamamlanınca mini konfeti kutlaması */}
      {celebrate && (
        <div className="pointer-events-none absolute inset-x-0 top-[13.5rem] z-20 grid place-items-center" role="status">
          <div className="relative animate-pop">
            {CONFETTI.map((p, i) => (
              <span
                key={i}
                aria-hidden
                className="absolute left-1/2 top-1/2 h-2.5 w-2 rounded-sm"
                style={{ background: p.color, '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--rot': `${p.rot}deg`, animation: `confetti-burst 1.2s ${p.delay}s ease-out forwards`, opacity: 0 }}
              />
            ))}
            <div className="rounded-full border-2 border-white bg-gradient-to-r from-[#fff3c8] via-[#ffffff] to-[#efe6ff] px-5 py-2 text-sm font-black text-[#4a3b5c] shadow-toy">
              {celebrate}
            </div>
          </div>
        </div>
      )}

      {/* E tuşu / dokunma istemi */}
      {near === 'collect' && step === 'collect' && (
        <DoorPrompt emoji="⭐" label="Hoş Geldin Yıldızı" action="Topla" touch={touch} onGo={onCollect} />
      )}
      {near === 'door' && step === 'door' && (
        <DoorPrompt emoji="🚪" label="Örnek Mekân Kapısı" action="Gir" touch={touch} onGo={onDoor} />
      )}
    </>
  )
}
