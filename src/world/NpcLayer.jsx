// NPC'ler: rig'li avatarlar, isim etiketi, selam balonu, oyuncuya dönme, gezen NPC'ler (paylaşılan saatten deterministik konum).
// Kullanım (Canvas içinde): <NpcLayer where="city" | mekânId focusRef onTalk(npc) onNear(npcId|null) />
// where = null → hiçbir şey çizmez (ev içi).
import { memo, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Em } from '../components/emoji'
import { MathUtils } from 'three'
import AvatarRig, { AVATAR_HEIGHT } from './AvatarRig'
import { AFK_BOTS, CLICK_RADIUS, GREET_RADIUS, TALK_RADIUS, displayName, npcsFor, posAt } from './npcs'

const ACTIVE_ON = 34 // m: bu kadar yakındaysa model yüklenir/çizilir
const ACTIVE_OFF = 40
const TAG_DIST = 18 // m: etiket (Html) bu kadar yakındaysa

// pastel yardımcı malzeme
const M = ({ color }) => <meshStandardMaterial color={color} roughness={0.85} />

function Balloons() {
  const cols = ['#ff9fc6', '#7fcdf3', '#ffd35e', '#b79cff']
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
  const cols = ['#ff9fc6', '#ffd35e', '#ffffff', '#b79cff', '#ff7eb3']
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
        <M color="#ffc2dc" />
      </mesh>
      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[0.74, 0.06, 1.04]} />
        <M color="#ffffff" />
      </mesh>
      <mesh position={[0, 1.45, 0]} castShadow>
        <coneGeometry args={[0.85, 0.35, 8]} />
        <M color="#ff9fc6" />
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

/** Köpek / kedi: sahibinin yaklaşık 1 sn gerisinden aynı rotayı izler. */
function Companion({ npc }) {
  const ref = useRef()
  const dog = npc.companion === 'dog'
  const fur = dog ? '#f2c493' : '#cfc7d9'
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
  const s = dog ? 1 : 0.8
  return (
    <group ref={ref} scale={s}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <capsuleGeometry args={[0.15, 0.3, 6, 12]} />
        <M color={fur} />
      </mesh>
      <mesh position={[0, 0.5, 0.3]} rotation={[0, 0, 0]} castShadow>
        <sphereGeometry args={[0.16, 14, 12]} />
        <M color={fur} />
      </mesh>
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} position={[x, dog ? 0.62 : 0.68, 0.28]} rotation={[0.1, 0, x * 3]}>
          {dog ? <sphereGeometry args={[0.07, 8, 8]} /> : <coneGeometry args={[0.06, 0.14, 4]} />}
          <M color={dog ? '#d9a06b' : '#b7aec5'} />
        </mesh>
      ))}
      <mesh position={[0, 0.5, 0.45]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <M color="#4a3b5c" />
      </mesh>
      <mesh position={[0, 0.42, -0.34]} rotation={[0.9, 0, 0]}>
        <capsuleGeometry args={[0.035, 0.22, 4, 8]} />
        <M color={fur} />
      </mesh>
      {[-0.1, 0.1].flatMap((x) => [-0.18, 0.18].map((z) => (
        <mesh key={`${x}${z}`} position={[x, 0.07, z]}>
          <cylinderGeometry args={[0.045, 0.045, 0.14, 6]} />
          <M color={fur} />
        </mesh>
      )))}
    </group>
  )
}

function NpcTag({ name, bubble }) {
  const m = /^(\p{Extended_Pictographic}\uFE0F?)\s*(.*)$/u.exec(name)
  const icon = m ? m[1] : '💬'
  const label = m ? m[2] : name
  return (
    <Html position={[0, AVATAR_HEIGHT + 0.45, 0]} center distanceFactor={9} zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
      <div className="relative flex flex-col items-center gap-1">
        {bubble && (
          <div className="max-w-[220px] break-words rounded-2xl rounded-bl-md border-2 border-white bg-white px-3 py-1.5 text-center text-sm font-bold text-[#4a3b5c] shadow-lg">{bubble}</div>
        )}
        <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/95 py-[3px] pl-[3px] pr-3 shadow-[0_4px_10px_rgba(60,40,80,0.28)] ring-2 ring-[#ffb48c]">
          <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-[#fff0e4]">
            <Em e={icon} size={15} />
          </span>
          <span className="text-[13px] font-extrabold leading-none tracking-wide text-[#4a3b5c]">{label}</span>
        </div>
      </div>
    </Html>
  )
}

const NpcView = memo(function NpcView({ npc, focusRef, onTalk }) {
  const group = useRef()
  const st = useRef({ active: false, near: false, i: npc.id.length, until: 0, anim: 'idle', tag: false, bubble: null, ry: npc.ry ?? 0 })
  const [active, setActive] = useState(false)
  const [anim, setAnim] = useState('idle')
  const [tag, setTag] = useState(false)
  const [bubble, setBubble] = useState(null)
  const [ready, setReady] = useState(false)
  const pose = useMemo(() => (npc.pose ? { current: npc.pose } : undefined), [npc.pose])
  const Prop = npc.prop && PROPS[npc.prop]

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

  useFrame((_, dt) => {
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
            <AvatarRig slug={npc.avatar} anim={anim} pose={pose} />
            {Prop && <Prop />}
          </Suspense>
        )}
        {/* dokunması kolay görünmez alan */}
        <mesh position={[0, 0.9, 0]}>
          <cylinderGeometry args={[0.55, 0.55, 1.8, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {active && tag && ready && <NpcTag name={displayName(npc)} bubble={bubble} />}
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
  const [ready, setReady] = useState(false)
  const act = useRef(false)
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
  })
  if (!active) return null
  return (
    <group position={[bot.x, 0, bot.z]} rotation={[0, bot.ry, 0]}>
      <Suspense fallback={null}>
        <AvatarRig slug={bot.avatar} anim="idle" />
      </Suspense>
      {ready && (
        <Html position={[0, AVATAR_HEIGHT + 0.45, 0]} center distanceFactor={9} zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-full border-2 border-white bg-[#6ec3f0] px-2.5 py-0.5 text-xs font-extrabold text-white shadow">
            {bot.name} <span className="opacity-90">💤</span>
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
