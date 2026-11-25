import { memo, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { screenK } from './screenK'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { MathUtils } from 'three'
import AvatarRig, { AVATAR_HEIGHT } from './AvatarRig'
import { GUIDE } from './layout'
import { together } from './features/togetherStore'
import { BIKE_POSE } from './bikeStore'
import { playerPos } from './cull'

const NEAR_DRAW = 42 // m: bu mesafeden uzaktaki oyuncular çizilmez
import BikeModel from './Bike'

/** Karakterin üstünde isim etiketi, konuşma balonu, uçan emoji tepkisi, AFK rozeti ve (fısıldıyorsa) 🤫. */
function Tag({ name, bubble: rawBubble, accent, reaction, whisper, afk = false, showName = false }) {
  // bubble: metin ya da { text, big } (çıkartmalar büyük gösterilir)
  const bubble = typeof rawBubble === 'string' ? { text: rawBubble } : rawBubble
  // oyuncuların kullanıcı adı ekranda yazmaz (kalabalık/okunaksız); isim, karaktere tıklayınca açılan profil penceresinde görünür.
  // Etiket yalnızca konuşma balonu, emoji tepkisi, AFK durumu ya da fısıltı varken çizilir. İsim göstermek gerekirse (Rehber NPC) `showName`.
  if (!showName && !bubble && !reaction && !whisper && !afk) return null
  return (
    <Html position={[0, AVATAR_HEIGHT + 0.45, 0]} center distanceFactor={9 * screenK()} zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
      <div className="relative flex flex-col items-center gap-1">
        {reaction && (
          <span key={reaction.key} aria-hidden className="pointer-events-none absolute -top-2 left-1/2 text-4xl drop-shadow-md [animation:react-float_2.6s_ease-out_forwards]">
            {reaction.e}
          </span>
        )}
        {bubble && (
          <div className={`break-words rounded-2xl rounded-bl-md border-2 border-white bg-white text-center font-bold text-[#4a3b5c] shadow-lg ${bubble.big ? 'px-4 py-1 text-6xl leading-tight' : 'w-max min-w-[120px] max-w-[340px] px-3.5 py-1.5 text-sm leading-snug'}`}>
            {bubble.text}
          </div>
        )}
        {whisper && !bubble && (
          <div className="animate-pop rounded-full border-2 border-white bg-[#e9ddff] px-2.5 py-0.5 text-xs font-extrabold text-[#6b4fc0] shadow">🤫 fısıldıyor…</div>
        )}
        {afk && !bubble && !whisper && (
          <div className="whitespace-nowrap rounded-full border-2 border-white bg-gradient-to-r from-[#f3e8ff] via-[#ede9fe] to-[#fce7f3] px-3.5 py-0.5 text-[11px] font-black tracking-[0.18em] text-[#5b4678] shadow-[0_4px_14px_rgba(168,139,255,0.45)]">
            AFK
          </div>
        )}
        {showName && (
          <div className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border-2 border-white px-3 py-0.5 text-xs font-extrabold text-white shadow ${accent ?? 'bg-[#a88bff]'}`}>
            {name}
          </div>
        )}
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
  const [near, setNear] = useState(true) // uzaktaki oyuncular çizilmez (500 oyuncuda FPS için)
  const nearRef = useRef(true)
  const shadowRef = useRef(true)
  const [afk, setAfk] = useState(false)
  const idleRef = useRef({ since: Date.now(), x: 0, z: 0, afk: false })
  const { reaction, whisper } = useLiveFlags(id, reactions, whispering)
  const pose = useMemo(
    () => ({
      get current() {
        const t = together.poses.get(id)
        if (t) return t
        const r = remotes.current.get(id)
        if (r?.anim === 'ride') {
          const moving = Math.hypot((r.tx ?? r.x) - r.x, (r.tz ?? r.z) - r.z) > 0.03
          return { ...BIKE_POSE, moving }
        }
        return null
      },
    }),
    [id, remotes],
  )

  useFrame((_, dt) => {
    const r = remotes.current.get(id)
    const g = group.current
    if (!r || !g) return
    // hedef konuma doğru yumuşak ilerle (ağ güncellemeleri ~10 Hz)
    const k = 1 - Math.exp(-dt * 12)
    r.x = MathUtils.lerp(r.x, r.tx, k)
    r.z = MathUtils.lerp(r.z, r.tz, k)
    g.position.set(r.x, 0, r.z)
    const d2 = (r.x - playerPos.x) ** 2 + (r.z - playerPos.z) ** 2
    // gölge kamerası ±20 m; uzaktaki oyuncular (frustumCulled=false) boşuna gölge geçişinde çizilmesin
    const sh = d2 < (shadowRef.current ? 26 * 26 : 22 * 22)
    if (sh !== shadowRef.current) {
      shadowRef.current = sh
      g.traverse((o) => { if (o.isMesh) o.castShadow = sh })
    }
    const nn = nearRef.current ? d2 < NEAR_DRAW * NEAR_DRAW * 1.15 : d2 < NEAR_DRAW * NEAR_DRAW
    if (nn !== nearRef.current) {
      nearRef.current = nn
      setNear(nn)
    }
    const diff = MathUtils.euclideanModulo(r.tr - g.rotation.y + Math.PI, Math.PI * 2) - Math.PI
    g.rotation.y += diff * k

    if (r.anim !== animRef.current) {
      animRef.current = r.anim
      setAnim(r.anim)
    }
    const b = bubbles.current.get(id)
    const live = b && b.until > Date.now() ? b : null
    if (live !== bubbleRef.current) {
      bubbleRef.current = live
      setBubble(live)
    }
    const now = Date.now()
    const idl = idleRef.current
    const moved = r.anim !== 'idle' || Math.hypot(r.tx - idl.x, r.tz - idl.z) > 0.05 || Boolean(live)
    if (moved) {
      idl.since = now
      idl.x = r.tx
      idl.z = r.tz
      if (idl.afk) {
        idl.afk = false
        setAfk(false)
      }
    } else if (!idl.afk && now - idl.since > 45000) {
      idl.afk = true
      setAfk(true)
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
      {near && <AvatarRig slug={avatar} anim={anim === 'ride' ? 'idle' : anim} pose={pose} cosId={id} />}
      {near && anim === 'ride' && (
        <Suspense fallback={null}>
          <BikeModel />
        </Suspense>
      )}
      {near && <Tag name={name} bubble={bubble} reaction={reaction} whisper={whisper} afk={afk} />}
    </group>
  )
})

export default function RemotePlayers({ roster, remotes, bubbles, reactions, whispering, onPick }) {
  return roster.map(({ key: _playerKey, ...p }) => <RemoteAvatar key={p.id} {...p} remotes={remotes} bubbles={bubbles} reactions={reactions} whispering={whispering} onPick={onPick} />)
}

/** Yerel oyuncunun isim etiketi ve kendi konuşma balonu (LocalPlayer'ın çocuğu olarak çizilir). */
export function SelfTag({ name, bubbles, selfId, reactions }) {
  const [bubble, setBubble] = useState(null)
  const ref = useRef(null)
  const [reaction, setReaction] = useState(null)
  const reactKey = useRef(null)
  const [ready, setReady] = useState(false) // drei <Html> ilk çizim turunda bağlanmasın (React 19 root uyarısı)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 800)
    return () => clearTimeout(t)
  }, [])
  useFrame(() => {
    const b = selfId.current ? bubbles.current.get(selfId.current) : null
    const liveBubble = b && b.until > Date.now() ? b : null
    if (liveBubble !== ref.current) {
      ref.current = liveBubble
      setBubble(liveBubble)
    }
    const rid = selfId.current ?? 'self'
    const r = reactions?.current.get(rid) ?? null
    const live = r && r.until > Date.now() ? r : null
    if ((live?.key ?? null) !== reactKey.current) {
      reactKey.current = live?.key ?? null
      setReaction(live)
    }
  })
  return ready ? <Tag name={name} bubble={bubble} accent="bg-[#5fc0ea]" reaction={reaction} /> : null
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
      <Tag name="Rehber" bubble={bubble} accent="bg-[#ffa94d]" showName />
    </group>
  )
}
