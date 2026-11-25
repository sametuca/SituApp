// NPC'ler: rig'li avatarlar, isim etiketi, selam balonu, oyuncuya dönme, gezen NPC'ler (paylaşılan saatten deterministik konum).
// Kullanım (Canvas içinde): <NpcLayer where="city" | mekânId focusRef onTalk(npc) onNear(npcId|null) />
// where = null → hiçbir şey çizmez (ev içi).
import { memo, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { screenK } from './screenK'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
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
    <mesh position={[0, 0.2, -0.12]} castShadow>
      <cylinderGeometry args={[0.24, 0.2, 0.4, 14]} />
      <M color="#ffd5bf" />
    </mesh>
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

function IceCart() {
  return (
    <group position={[0.95, 0, 0.1]}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.7, 0.55, 1.0]} />
        <M color="#fed095" />
      </mesh>
      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[0.74, 0.06, 1.04]} />
        <M color="#ffffff" />
      </mesh>
      <mesh position={[0, 1.45, 0]} castShadow>
        <coneGeometry args={[0.85, 0.35, 8]} />
        <M color="#fec172" />
      </mesh>
      <mesh position={[0, 1.07, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.75, 6]} />
        <M color="#ffffff" />
      </mesh>
      {[-0.32, 0.32].map((z) => (
        <mesh key={z} position={[0.4, 0.14, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.14, 0.14, 0.06, 12]} />
          <M color="#8a7a9c" />
        </mesh>
      ))}
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

function NpcTag({ name, bubble, nearTalk }) {
  const label = name
  return (
    <Html position={[0, AVATAR_HEIGHT + 0.45, 0]} center distanceFactor={9 * screenK()} zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
      <div className="relative flex flex-col items-center gap-1">
        {nearTalk && !bubble && (
          <div className="rounded-full border border-white bg-[#fff3c4] px-2 py-0.5 text-[10px] font-black text-[#8a5a00] shadow">
            💬 Konuş
          </div>
        )}
        {bubble && (
          <div className="w-max min-w-[160px] max-w-[340px] break-words rounded-2xl rounded-bl-md border-2 border-white bg-white px-3.5 py-1.5 text-center text-sm font-bold leading-snug text-[#4a3b5c] shadow-lg">{bubble}</div>
        )}
        <div className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#fffaf2] px-2.5 py-[3px] shadow-[0_4px_12px_rgba(253,178,82,0.35)] ring-2 ring-[#fdb252]">
          <span className="rounded-full bg-[#fdb252] px-1.5 py-[1px] text-[9px] font-black tracking-wider text-white">NPC</span>
          <span className="text-[13px] font-extrabold leading-none tracking-wide text-[#4a3b5c]">{label}</span>
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

  // NPC aksesuarı (cosStore: oda değişiminde silinirse yeniden yazılır)
  useEffect(() => {
    const id = `npc:${npc.id}`
    const put = () => !cosStore.get(id) && cosStore.set(id, { acc: npcAccessory(npc), pet: null })
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
            <group scale={NPC_SCALE}>
              <AvatarRig slug={npc.avatar} anim={anim} pose={pose} cosId={`npc:${npc.id}`} />
            </group>
            {/* nefes alan çift katmanlı NPC etkileşim halkası + yüzen altın kristal */}
            <group ref={ringRef}>
              <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.58, 0.74, 28]} />
                <meshBasicMaterial color="#fdb252" transparent opacity={0.85} depthWrite={false} />
              </mesh>
              <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.42, 0.58, 28]} />
                <meshBasicMaterial color="#fff3c4" transparent opacity={0.45} depthWrite={false} />
              </mesh>
            </group>
            <mesh ref={orbRef} position={[0, AVATAR_HEIGHT + 0.88, 0]}>
              <octahedronGeometry args={[0.11, 0]} />
              <meshStandardMaterial color="#ffe066" emissive="#fdb252" emissiveIntensity={0.65} roughness={0.2} />
            </mesh>
            {Prop && <Prop />}
          </Suspense>
        )}
        {/* dokunması kolay görünmez alan */}
        <mesh position={[0, 0.9, 0]}>
          <cylinderGeometry args={[0.55, 0.55, 1.8, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {active && tag && ready && <NpcTag name={displayName(npc)} bubble={bubble} nearTalk={nearTalk} />}
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
          <div className="whitespace-nowrap rounded-full border-2 border-white bg-gradient-to-r from-[#f3e8ff] via-[#ede9fe] to-[#fce7f3] px-3.5 py-0.5 text-[11px] font-black tracking-[0.18em] text-[#5b4678] shadow-[0_4px_14px_rgba(168,139,255,0.45)]">
            AFK
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
