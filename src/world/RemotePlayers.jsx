import { memo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { MathUtils } from 'three'
import AvatarRig, { AVATAR_HEIGHT } from './AvatarRig'
import { GUIDE } from './layout'

/** Karakterin üstünde isim etiketi, konuşma balonu, uçan emoji tepkisi ve (fısıldıyorsa) 🤫. */
function Tag({ name, bubble, accent, reaction, whisper }) {
  return (
    <Html position={[0, AVATAR_HEIGHT + 0.45, 0]} center distanceFactor={9} zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
      <div className="relative flex flex-col items-center gap-1">
        {reaction && (
          <span key={reaction.key} aria-hidden className="pointer-events-none absolute -top-2 left-1/2 text-4xl drop-shadow-md [animation:react-float_2.6s_ease-out_forwards]">
            {reaction.e}
          </span>
        )}
        {bubble && (
          <div className="max-w-[220px] break-words rounded-2xl rounded-bl-md border-2 border-white bg-white px-3 py-1.5 text-center text-sm font-bold text-[#4a3b5c] shadow-lg">
            {bubble}
          </div>
        )}
        {whisper && !bubble && (
          <div className="animate-pop rounded-full border-2 border-white bg-[#e9ddff] px-2.5 py-0.5 text-xs font-extrabold text-[#6b4fc0] shadow">🤫 fısıldıyor…</div>
        )}
        <div className={`whitespace-nowrap rounded-full border-2 border-white px-2.5 py-0.5 text-xs font-extrabold text-white shadow ${accent ?? 'bg-[#a88bff]'}`}>
          {name}
        </div>
      </div>
    </Html>
  )
}

/** Birinin tepki emojisini ve fısıldıyor durumunu ref'lerden okuyup state'e çevirir (render'ı yalnızca değişince tetikler). */
function useLiveFlags(id, reactions, whispering) {
  const [reaction, setReaction] = useState(null)
  const [whisper, setWhisper] = useState(false)
  const last = useRef({ key: null, whisper: false })
  useFrame(() => {
    const now = Date.now()
    const r = reactions?.current.get(id)
    const live = r && r.until > now ? r : null
    if ((live?.key ?? null) !== last.current.key) {
      last.current.key = live?.key ?? null
      setReaction(live)
    }
    const w = Boolean(whispering && (whispering.current.get(id) ?? 0) > now)
    if (w !== last.current.whisper) {
      last.current.whisper = w
      setWhisper(w)
    }
  })
  return { reaction, whisper }
}

const RemoteAvatar = memo(function RemoteAvatar({ id, name, avatar, remotes, bubbles, reactions, whispering, onPick }) {
  const group = useRef()
  const [anim, setAnim] = useState('idle')
  const [bubble, setBubble] = useState(null)
  const animRef = useRef('idle')
  const bubbleRef = useRef(null)
  const { reaction, whisper } = useLiveFlags(id, reactions, whispering)

  useFrame((_, dt) => {
    const r = remotes.current.get(id)
    const g = group.current
    if (!r || !g) return
    // hedef konuma doğru yumuşak ilerle (ağ güncellemeleri ~10 Hz)
    const k = 1 - Math.exp(-dt * 12)
    r.x = MathUtils.lerp(r.x, r.tx, k)
    r.z = MathUtils.lerp(r.z, r.tz, k)
    g.position.set(r.x, 0, r.z)
    const diff = MathUtils.euclideanModulo(r.tr - g.rotation.y + Math.PI, Math.PI * 2) - Math.PI
    g.rotation.y += diff * k

    if (r.anim !== animRef.current) {
      animRef.current = r.anim
      setAnim(r.anim)
    }
    const b = bubbles.current.get(id)
    const text = b && b.until > Date.now() ? b.text : null
    if (text !== bubbleRef.current) {
      bubbleRef.current = text
      setBubble(text)
    }
  })

  return (
    <group
      ref={group}
      onClick={(e) => {
        e.stopPropagation()
        onPick?.(id)
      }}
      onPointerOver={() => onPick && (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <AvatarRig slug={avatar} anim={anim} cosId={id} />
      <Tag name={name} bubble={bubble} reaction={reaction} whisper={whisper} />
    </group>
  )
})

export default function RemotePlayers({ roster, remotes, bubbles, reactions, whispering, onPick }) {
  return roster.map((p) => <RemoteAvatar key={p.id} {...p} remotes={remotes} bubbles={bubbles} reactions={reactions} whispering={whispering} onPick={onPick} />)
}

/** Yerel oyuncunun isim etiketi ve kendi konuşma balonu (LocalPlayer'ın çocuğu olarak çizilir). */
export function SelfTag({ name, bubbles, selfId, reactions }) {
  const [bubble, setBubble] = useState(null)
  const ref = useRef(null)
  const [reaction, setReaction] = useState(null)
  const reactKey = useRef(null)
  useFrame(() => {
    const b = selfId.current ? bubbles.current.get(selfId.current) : null
    const text = b && b.until > Date.now() ? b.text : null
    if (text !== ref.current) {
      ref.current = text
      setBubble(text)
    }
    const r = selfId.current ? reactions?.current.get(selfId.current) : null
    const live = r && r.until > Date.now() ? r : null
    if ((live?.key ?? null) !== reactKey.current) {
      reactKey.current = live?.key ?? null
      setReaction(live)
    }
  })
  return <Tag name={name} bubble={bubble} accent="bg-[#5fc0ea]" reaction={reaction} />
}

/** Lobideki Rehber (NPC): yakına gelenlere ipucu balonu gösterir. */
export function GuideNpc({ focusRef, tips }) {
  const [bubble, setBubble] = useState(null)
  const state = useRef({ near: false, i: 0, t: 0 })

  useFrame((_, dt) => {
    const f = focusRef.current
    const s = state.current
    const near = Math.hypot(f.x - GUIDE.x, f.z - GUIDE.z) < GUIDE.radius
    if (near && !s.near) {
      s.near = true
      s.t = 0
      setBubble(tips[s.i % tips.length])
    } else if (!near && s.near) {
      s.near = false
      s.i += 1
      setBubble(null)
    } else if (near) {
      // yakında kalırsan 7 saniyede bir sonraki ipucu
      s.t += dt
      if (s.t > 7) {
        s.t = 0
        s.i += 1
        setBubble(tips[s.i % tips.length])
      }
    }
  })

  return (
    <group position={[GUIDE.x, 0, GUIDE.z]} rotation={[0, GUIDE.ry, 0]}>
      <AvatarRig slug={GUIDE.avatar} anim="idle" />
      <Tag name="🧭 Rehber" bubble={bubble} accent="bg-[#ff7eb3]" />
    </group>
  )
}
