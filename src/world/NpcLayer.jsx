// NPC'ler: rig'li avatarlar, isim etiketi, selam balonu, oyuncuya dönme, gezen NPC'ler (paylaşılan saatten deterministik konum).
// Kullanım (Canvas içinde): <NpcLayer where="city" | mekânId focusRef onTalk(npc) onNear(npcId|null) />
// where = null → hiçbir şey çizmez (ev içi).
import { memo, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { screenK } from './screenK'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import { MathUtils } from 'three'
import AvatarRig, { AVATAR_HEIGHT } from './AvatarRig'
import { PetModel } from './Pet'
import { AFK_BOTS, CLICK_RADIUS, GREET_RADIUS, NPC_SCALE, TALK_RADIUS, displayName, npcAccessory, npcsFor, posAt } from './npcs'
import { cosStore } from './cosStore'

const ACTIVE_ON = 34 // m: bu kadar yakındaysa model yüklenir/çizilir
const ACTIVE_OFF = 40
const TAG_DIST = 18 // m: etiket (Html) bu kadar yakındaysa

// pastel yardımcı malzeme
const M = ({ color }) => <meshStandardMaterial color={color} roughness={0.85} />

function Balloons() {
  const cols = ['#fec172', '#7fcdf3', '#ffd35e', '#b79cff']
  return (
    <group position={[0.42, 1.0, 0.12]}>
      {cols.map((c, i) => (
        <group key={c} position={[(i - 1.5) * 0.14, 0.5 + (i % 2) * 0.12, (i % 2) * 0.08]}>
          <mesh position={[0, 0.3, 0]} castShadow>
            <sphereGeometry args={[0.17, 14, 12]} />
            <M color={c} />
          </mesh>
          <mesh position={[0, -0.04, 0]}>
            <cylinderGeometry args={[0.004, 0.004, 0.68, 4]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Stool() {
  return (
    <group position={[0, 0, -0.05]}>
      {/* ahşap tabure gövdesi + üst pofuduk minder (y = 0..0.37) */}
      <mesh position={[0, 0.16, 0]} castShadow>
        <cylinderGeometry args={[0.21, 0.24, 0.32, 16]} />
        <M color="#d89b67" />
      </mesh>
      <mesh position={[0, 0.34, 0]} castShadow>
        <cylinderGeometry args={[0.23, 0.22, 0.07, 16]} />
        <M color="#b79cff" />
      </mesh>
      {/* taburenin yanında yaslı mini akustik gitar */}
      <group position={[0.38, 0.22, 0.04]} rotation={[0.12, -0.4, -0.28]}>
        <mesh position={[0, -0.05, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.13, 0.06, 14]} />
          <M color="#f0b26b" />
        </mesh>
        <mesh position={[0, 0.06, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.1, 0.06, 14]} />
          <M color="#f0b26b" />
        </mesh>
        <mesh position={[0, 0.28, 0]}>
          <boxGeometry args={[0.04, 0.36, 0.03]} />
          <M color="#7c4d2e" />
        </mesh>
      </group>
    </group>
  )
}

function Flowers() {
  const cols = ['#fec172', '#ffd35e', '#ffffff', '#b79cff', '#fdb252']
  return (
    <group position={[0.65, 0, 0.25]}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.18, 0.4, 12]} />
        <M color="#c4f0d8" />
      </mesh>
      {cols.map((c, i) => (
        <mesh key={i} position={[Math.cos(i * 1.3) * 0.13, 0.5 + (i % 3) * 0.05, Math.sin(i * 1.3) * 0.13]} castShadow>
          <sphereGeometry args={[0.09, 10, 8]} />
          <M color={c} />
        </mesh>
      ))}
    </group>
  )
}

/** Balonsu pasterize dondurma arabası: Zeynep'in tam önünde (+Z), itme kolu, 4 teker, soğutucu kapak, 3B külah süsü ve çizgili şemsiye. */
function IceCart() {
  const stripes = 8
  return (
    <group position={[0, 0, 0.92]}>
      {/* pofuduk yuvarlatılmış araba gövdesi */}
      <RoundedBox args={[0.78, 0.56, 0.94]} radius={0.09} smoothness={2} position={[0, 0.48, 0]} castShadow>
        <meshStandardMaterial color="#fff1dc" roughness={0.45} />
      </RoundedBox>
      {/* çilek pembesi alt kuşak */}
      <RoundedBox args={[0.8, 0.18, 0.96]} radius={0.05} smoothness={2} position={[0, 0.34, 0]}>
        <meshStandardMaterial color="#ffb4cc" roughness={0.45} />
      </RoundedBox>
      {/* krem soğutucu üst kapak + iki kulplu bölme */}
      <RoundedBox args={[0.84, 0.09, 1.0]} radius={0.04} smoothness={2} position={[0, 0.79, 0]} castShadow>
        <meshStandardMaterial color="#ffffff" roughness={0.35} />
      </RoundedBox>
      {[-0.18, 0.18].map((x) => (
        <RoundedBox key={x} args={[0.28, 0.04, 0.56]} radius={0.015} smoothness={2} position={[x, 0.85, 0.04]}>
          <meshStandardMaterial color="#dff3ff" roughness={0.25} />
        </RoundedBox>
      ))}
      {/* arka itme kolu (Zeynep'in ellerine uzanır) */}
      {[-0.28, 0.28].map((x) => (
        <mesh key={x} position={[x, 0.77, -0.56]} rotation={[0.35, 0, 0]}>
          <cylinderGeometry args={[0.022, 0.022, 0.28, 8]} />
          <meshStandardMaterial color="#e8952c" roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 0.82, -0.64]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.028, 0.028, 0.62, 10]} />
        <meshStandardMaterial color="#ffd35e" roughness={0.35} />
      </mesh>
      {/* 4 yuvarlak tekerlek (iki yanda, krem göbekli) */}
      {[-0.41, 0.41].map((x) =>
        [-0.28, 0.28].map((z) => (
          <group key={`${x}|${z}`} position={[x, 0.16, z]} rotation={[0, 0, Math.PI / 2]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.16, 0.16, 0.07, 16]} />
              <meshStandardMaterial color="#6e5a85" roughness={0.55} />
            </mesh>
            <mesh>
              <cylinderGeometry args={[0.08, 0.08, 0.08, 12]} />
              <meshStandardMaterial color="#fff6ea" roughness={0.4} />
            </mesh>
          </group>
        )),
      )}
      {/* ön köşede 3B dondurma külahı süsü */}
      <group position={[0.26, 0.98, 0.36]} rotation={[0, 0, -0.1]}>
        <mesh position={[0, -0.05, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.075, 0.2, 12]} />
          <meshStandardMaterial color="#e8b36d" roughness={0.65} />
        </mesh>
        <mesh position={[0, 0.07, 0]}>
          <sphereGeometry args={[0.085, 12, 10]} />
          <meshStandardMaterial color="#ff9ec7" roughness={0.4} />
        </mesh>
        <mesh position={[0.02, 0.16, 0.01]}>
          <sphereGeometry args={[0.065, 12, 10]} />
          <meshStandardMaterial color="#fff3c8" roughness={0.4} />
        </mesh>
      </group>
      {/* şemsiye direği + çizgili pofuduk şemsiye kubbesi + altın topuz */}
      <mesh position={[0, 1.32, 0.06]}>
        <cylinderGeometry args={[0.028, 0.032, 1.08, 10]} />
        <meshStandardMaterial color="#fffaf2" roughness={0.4} />
      </mesh>
      <group position={[0, 1.82, 0.06]}>
        {Array.from({ length: stripes }, (_, i) => {
          const a = (i / stripes) * Math.PI * 2
          return (
            <mesh key={i} rotation={[0, a, 0]} castShadow>
              <coneGeometry args={[0.88, 0.34, 4, 1, false, 0, (Math.PI * 2) / stripes]} />
              <meshStandardMaterial color={i % 2 === 0 ? '#ffa3c4' : '#fff8ee'} roughness={0.45} />
            </mesh>
          )
        })}
        <mesh position={[0, -0.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.84, 0.045, 8, 24]} />
          <meshStandardMaterial color="#ffd35e" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <sphereGeometry args={[0.08, 12, 10]} />
          <meshStandardMaterial color="#ffd35e" roughness={0.3} />
        </mesh>
      </group>
    </group>
  )
}

const PROPS = { balloons: Balloons, stool: Stool, flowers: Flowers, icecart: IceCart }

/** Köpek / kedi: gerçek Meshy GLB evcil hayvanı, sahibinin yaklaşık 1 sn gerisinden izler. */
function Companion({ npc }) {
  const ref = useRef()
  useFrame(() => {
    const g = ref.current
    if (!g) return
    if (!npc.route) {
      g.position.set(npc.x + 0.7, 0, npc.z + 0.5)
      g.rotation.y = 0.8
      return
    }
    const p = posAt(npc, Date.now() - 1200)
    g.position.set(p.x - Math.sin(p.ry) * 0.2 + Math.cos(p.ry) * 0.35, Math.abs(Math.sin(Date.now() / 140)) * (p.moving ? 0.05 : 0), p.z - Math.cos(p.ry) * 0.2 - Math.sin(p.ry) * 0.35)
    g.rotation.y = p.ry
  })
  return (
    <group ref={ref}>
      <PetModel kind={npc.companion} />
    </group>
  )
}

/** "Cankurtaran Ege" → { role: "Cankurtaran", person: "Ege" } */
function splitNpcName(full) {
  const parts = String(full ?? '').trim().split(/\s+/)
  if (parts.length < 2) return { role: '', person: full }
  return { role: parts.slice(0, -1).join(' '), person: parts[parts.length - 1] }
}

export function NpcTag({ name, bubble, nearTalk, isVendor }) {
  const { role, person } = splitNpcName(name)
  return (
    <Html position={[0, AVATAR_HEIGHT + 0.5, 0]} center distanceFactor={9 * screenK()} zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
      <div className="relative flex flex-col items-center gap-1.5">
        {nearTalk && !bubble && (
          <div className="w-max min-w-max whitespace-nowrap rounded-full border border-[#ffd35e]/80 bg-[#fff8e6]/95 px-3 py-0.5 text-[10px] font-black tracking-wide text-[#7a4b00] shadow-md">
            {isVendor ? 'E · Göz At' : 'E · Konuş'}
          </div>
        )}
        {bubble && (
          <div className="w-max min-w-[160px] max-w-[340px] break-words rounded-2xl rounded-bl-md border-2 border-white bg-white/95 px-3.5 py-1.5 text-center text-sm font-bold leading-snug text-[#4a3b5c] shadow-lg">{bubble}</div>
        )}
        {/* Fantastik, ikonsuz ve tüm NPC'lerde tek tip isim kartı */}
        <div className="inline-flex w-max min-w-max flex-col items-center whitespace-nowrap rounded-2xl border-2 border-[#fff7e6] bg-gradient-to-b from-[#3d2b63]/95 via-[#2e204f]/95 to-[#23173f]/95 px-3.5 py-1.5 text-center shadow-[0_6px_18px_rgba(35,23,63,0.42),0_0_12px_rgba(255,211,94,0.24)] ring-1 ring-[#ffd35e]/55">
          {role && (
            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ffd35e]">
              {role}
            </span>
          )}
          <span className="text-[13px] font-black leading-tight tracking-wide text-white">{person}</span>
        </div>
      </div>
    </Html>
  )
}

const NpcView = memo(function NpcView({ npc, focusRef, onTalk }) {
  const group = useRef()
  const ringRef = useRef()
  const orbRef = useRef()
  const st = useRef({ active: false, near: false, nearTalk: false, i: npc.id.length, until: 0, anim: 'idle', tag: false, bubble: null, ry: npc.ry ?? 0 })
  const [active, setActive] = useState(false)
  const [anim, setAnim] = useState('idle')
  const [tag, setTag] = useState(false)
  const [nearTalk, setNearTalk] = useState(false)
  const [bubble, setBubble] = useState(null)
  const [ready, setReady] = useState(false)
  const pose = useMemo(() => (npc.pose ? { current: npc.pose } : undefined), [npc.pose])
  const Prop = npc.prop && PROPS[npc.prop]

  // NPC aksesuarı ve özel kıyafet görünümü (cosStore: oda değişiminde silinirse yeniden yazılır)
  useEffect(() => {
    const id = `npc:${npc.id}`
    const put = () => !cosStore.get(id) && cosStore.set(id, { acc: npcAccessory(npc), pet: null, look: npc.look ?? null })
    put()
    return cosStore.subscribe(put)
  }, [npc])

  // konuşma balonu: yalnızca bu NPC ile konuşulurken (diyalog çekmecesi 'situapp:npc-say' yollar)
  useEffect(() => {
    const on = (e) => {
      if (e.detail?.id === npc.id) setBubble(e.detail.text ?? null)
    }
    window.addEventListener('situapp:npc-say', on)
    return () => window.removeEventListener('situapp:npc-say', on)
  }, [npc.id])

  // drei <Html> ilk çizim turunda bağlanmasın
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 700)
    return () => clearTimeout(t)
  }, [])

  useFrame(({ clock }, dt) => {
    const g = group.current
    if (!g) return
    const s = st.current
    const p = posAt(npc)
    const f = focusRef.current
    const dx = f.x - p.x
    const dz = f.z - p.z
    const d = Math.hypot(dx, dz)
    g.position.set(p.x, 0, p.z)

    // yaklaşınca oyuncuya dön (yürümüyorsa), değilse yürüyüş yönüne
    const want = !p.moving && d < GREET_RADIUS ? Math.atan2(dx, dz) : p.ry
    const diff = MathUtils.euclideanModulo(want - s.ry + Math.PI, Math.PI * 2) - Math.PI
    s.ry += diff * (1 - Math.exp(-dt * 6))
    g.rotation.y = s.ry

    const t = clock.elapsedTime
    if (ringRef.current) {
      const pulse = 1 + Math.sin(t * 2.6 + s.i) * 0.05
      ringRef.current.scale.setScalar(pulse)
    }
    if (orbRef.current) {
      orbRef.current.position.y = AVATAR_HEIGHT + 0.88 + Math.sin(t * 3 + s.i) * 0.06
      orbRef.current.rotation.y = t * 1.4
    }

    const act = s.active ? d < ACTIVE_OFF : d < ACTIVE_ON
    if (act !== s.active) {
      s.active = act
      setActive(act)
    }
    const a = p.moving ? 'walk' : 'idle'
    if (a !== s.anim) {
      s.anim = a
      setAnim(a)
    }
    const showTag = d < TAG_DIST
    if (showTag !== s.tag) {
      s.tag = showTag
      setTag(showTag)
    }
    const nt = d < TALK_RADIUS + 1.4
    if (nt !== s.nearTalk) {
      s.nearTalk = nt
      setNearTalk(nt)
    }
  })

  return (
    <>
      <group
        ref={group}
        position={[npc.x, 0, npc.z]}
        onClick={(e) => {
          e.stopPropagation()
          onTalk?.(npc)
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        {active && (
          <Suspense fallback={null}>
            <group scale={npc.scale ?? NPC_SCALE}>
              <AvatarRig slug={npc.avatar} anim={anim} pose={pose} cosId={`npc:${npc.id}`} />
            </group>
            {/* yumuşak, zeminle çakışmayan (y=0.085) etkileşim halesi — satıcılar altın, şehir sakinleri lavanta */}
            <group ref={ringRef}>
              <mesh position={[0, 0.088, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.56, 0.68, 28]} />
                <meshBasicMaterial color={npc.shop?.length ? '#fdb252' : '#b79cff'} transparent opacity={0.78} depthWrite={false} />
              </mesh>
              <mesh position={[0, 0.084, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.38, 0.56, 28]} />
                <meshBasicMaterial color={npc.shop?.length ? '#fff3c4' : '#efe6ff'} transparent opacity={0.35} depthWrite={false} />
              </mesh>
            </group>
            {npc.shop?.length > 0 && (
              <mesh ref={orbRef} position={[0, AVATAR_HEIGHT + 0.92, 0]}>
                <octahedronGeometry args={[0.09, 0]} />
                <meshStandardMaterial color="#ffe066" emissive="#fdb252" emissiveIntensity={0.55} roughness={0.25} />
              </mesh>
            )}
            {Prop && <Prop />}
          </Suspense>
        )}
        {/* dokunması kolay görünmez alan */}
        <mesh position={[0, 0.9, 0]}>
          <cylinderGeometry args={[0.55, 0.55, 1.8, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {active && tag && ready && <NpcTag name={displayName(npc)} bubble={bubble} nearTalk={nearTalk} isVendor={Boolean(npc.shop?.length)} />}
      </group>
      {active && npc.companion && (
        <Suspense fallback={null}>
          <Companion npc={npc} />
        </Suspense>
      )}
    </>
  )
})

/** AFK bot: hareketsiz, gerçek oyuncu etiketiyle (mavi hap + 💤). Yakındaysa model yüklenir. */
const AfkView = memo(function AfkView({ bot, focusRef }) {
  const [active, setActive] = useState(false)
  const [showTag, setShowTag] = useState(false)
  const [ready, setReady] = useState(false)
  const act = useRef(false)
  const tagRef = useRef(false)
  const clock = useRef(0)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 900)
    return () => clearTimeout(t)
  }, [])
  useFrame((_, dt) => {
    clock.current += dt
    if (clock.current < 0.4) return
    clock.current = 0
    const f = focusRef.current
    const d = Math.hypot(f.x - bot.x, f.z - bot.z)
    const on = act.current ? d < ACTIVE_OFF : d < ACTIVE_ON
    if (on !== act.current) {
      act.current = on
      setActive(on)
    }
    const tg = d < TAG_DIST
    if (tg !== tagRef.current) {
      tagRef.current = tg
      setShowTag(tg)
    }
  })
  if (!active) return null
  return (
    <group
      position={[bot.x, 0, bot.z]}
      rotation={[0, bot.ry, 0]}
      onClick={(e) => {
        e.stopPropagation()
        window.dispatchEvent(new CustomEvent('situapp:bot-click', { detail: bot }))
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <Suspense fallback={null}>
        <AvatarRig slug={bot.avatar} anim="idle" />
      </Suspense>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 1.8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {ready && showTag && (
        <Html position={[0, AVATAR_HEIGHT + 0.45, 0]} center distanceFactor={9 * screenK()} zIndexRange={[7, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-full border-2 border-white bg-gradient-to-r from-[#f3e8ff] via-[#ede9fe] to-[#fce7f3] px-3.5 py-0.5 text-[11px] font-black tracking-wide text-[#5b4678] shadow-[0_4px_14px_rgba(168,139,255,0.45)]">
            {bot.name}
          </div>
        </Html>
      )}
    </group>
  )
})

/** Bulunduğun yerin (şehir ya da mekân) NPC'lerini çizer; en yakın konuşulabilir NPC'yi onNear ile bildirir. */
export default function NpcLayer({ where, focusRef, onTalk, onNear }) {
  const list = useMemo(() => (where ? npcsFor(where) : []), [where])
  const last = useRef(null)
  useFrame(() => {
    if (!onNear) return
    const f = focusRef.current
    let best = null
    let bd = TALK_RADIUS
    for (const n of list) {
      const p = posAt(n)
      const d = Math.hypot(f.x - p.x, f.z - p.z)
      if (d < bd) {
        bd = d
        best = n.id
      }
    }
    if (best !== last.current) {
      last.current = best
      onNear(best)
    }
  })
  useEffect(() => () => onNear?.(null), [where]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!where) return null
  return (
    <group>
      {list.map((n) => (
        <NpcView key={n.id} npc={n} focusRef={focusRef} onTalk={onTalk} />
      ))}
      {where === 'city' && AFK_BOTS.map((b) => <AfkView key={b.id} bot={b} focusRef={focusRef} />)}
    </group>
  )
}

export { CLICK_RADIUS }
