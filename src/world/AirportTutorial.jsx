import { Suspense, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import { screenK } from './screenK'
import { DoorPrompt } from './Social'

const TUT_STAR = { x: 1.4, z: 1.5 }
const TUT_DOOR = { x: -7.0, z: -0.4 }
const TUT_EXIT = { x: 0, z: 4.1 }

const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  dx: Math.round(Math.cos((i / 18) * Math.PI * 2) * (65 + (i % 3) * 28)),
  dy: Math.round(Math.sin((i / 18) * Math.PI * 2) * (50 + (i % 3) * 24) - 20),
  rot: (i * 53) % 360,
  color: ['#fdb252', '#a88bff', '#8fd0ff', '#8fe3c0', '#ffe48f'][i % 5],
  delay: (i % 4) * 0.03,
}))

const STEPS = [
  { id: 'collect', short: 'Eşya', emoji: '⭐', title: 'Önündeki parlayan yıldızı topla!', hint: 'Yıldıza yaklaş ve E tuşuna bas (ya da dokun).' },
  { id: 'door', short: 'Kapı', emoji: '🚪', title: 'Soldaki örnek mekân kapısını dene!', hint: 'Kapıya yaklaş ve E ile içeri gir.' },
  { id: 'wardrobe', short: 'Stil', emoji: '👗', title: 'Gardıroptan tarzını seç!', hint: 'Soldaki parlayan 👗 düğmesine bas ve görünümünü kaydet.' },
  { id: 'exit', short: 'Çıkış', emoji: '🏖️', title: 'Hazırsın! Şehre çıkış yap.', hint: 'Güneydeki çıkış kapısından E ile plaja çık.' },
]

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

  return (
    <>
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

/** Üst görev takip kartı, konfeti kutlaması ve yakın istemi. */
export function AirportTutorialHud({ step, near, touch, celebrate, onCollect, onDoor, onOpenWardrobe, onSkip }) {
  const idx = STEPS.findIndex((s) => s.id === step)
  const cur = STEPS[idx]
  if (!cur) return null

  return (
    <>
      {/* üst görev kartı */}
      <div className="pointer-events-auto absolute left-1/2 top-[5.25rem] z-10 w-[min(94vw,35rem)] -translate-x-1/2 animate-pop rounded-[2rem] border-2 border-white bg-white/95 px-6 py-5 shadow-toy backdrop-blur-md sm:top-[6.25rem]">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-[#fff3c8] px-3.5 py-1.5 text-sm font-black text-[#8a5a00]">
            🎓 Görev {idx + 1}/{STEPS.length}
          </span>
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                title={s.short}
                className={`grid h-10 w-10 place-items-center rounded-full text-base font-black transition ${
                  i < idx ? 'bg-[#b9ebcf] text-[#1f6b47]' : i === idx ? 'bg-[#a88bff] text-white ring-2 ring-[#d6c7ff]' : 'bg-[#f6f0ff] text-[#8a7a9c]'
                }`}
              >
                {i < idx ? '✓' : s.emoji}
              </span>
            ))}
          </div>
          <button onClick={onSkip} className="rounded-full px-3.5 py-1.5 text-sm font-extrabold text-[#8a7a9c] hover:bg-[#ffedd6]/70">
            Atla ›
          </button>
        </div>
        <div className="mt-3.5 h-2.5 overflow-hidden rounded-full bg-[#f1e6ff]">
          <div className="h-full rounded-full bg-gradient-to-r from-[#fdb252] to-[#a88bff] transition-[width] duration-500" style={{ width: `${(idx / STEPS.length) * 100 + 8}%` }} />
        </div>

        <div className="mt-4 flex items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[#f6f0ff] text-4xl">{cur.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-black leading-snug text-[#4a3b5c]">{cur.title}</p>
            <p className="mt-1 text-base font-semibold text-[#8a7a9c]">{cur.hint}</p>
          </div>
          {step === 'wardrobe' ? (
            <button onClick={onOpenWardrobe} className="shrink-0 rounded-2xl border-b-4 border-[#7a5fd0] bg-[#a88bff] px-5 py-3 text-base font-black text-white shadow-soft active:translate-y-[2px] active:border-b-2">
              👗 Aç
            </button>
          ) : null}
        </div>
      </div>

      {/* adım tamamlanınca mini konfeti kutlaması */}
      {celebrate && (
        <div className="pointer-events-none absolute inset-x-0 top-[17.5rem] z-20 grid place-items-center" role="status">
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
