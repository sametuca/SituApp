import { memo, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { screenK } from './screenK'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { MathUtils } from 'three'
import AvatarRig, { AVATAR_HEIGHT } from './AvatarRig'
import { Em } from '../components/emoji'
import { GUIDE, groundY } from './layout'
import { together } from './features/togetherStore'
import { BIKE_POSE } from './bikeStore'
import { playerPos } from './cull'

const NEAR_DRAW = 42 // m: bu mesafeden uzaktaki oyuncular çizilmez
import BikeModel from './Bike'

const REACT_BURSTS = {
  '❤️': ['❤️', '💗', '💖', '❤️', '💕'],
  '👋': ['👋', '✨', '👋', '😊', '✨'],
  '🎉': ['🎉', '✨', '🎊', '⭐', '🎉'],
  '💃': ['💃', '🎶', '✨', '🎵', '💃'],
  '🍦': ['🍦', '😋', '✨', '🍓', '🍦'],
  '🌷': ['🌷', '✨', '💐', '😊', '🌷'],
  '🎈': ['🎈', '✨', '🎉', '🎈', '✨'],
  '📰': ['📰', '✨', '☕', '📰', '✨'],
}
const BURST_SLOTS = [
  { rx: 0, rot: -6, size: 84, delay: 0 },
  { rx: -56, rot: -14, size: 60, delay: 0.08 },
  { rx: 56, rot: 14, size: 64, delay: 0.16 },
  { rx: -30, rot: 10, size: 52, delay: 0.25 },
  { rx: 34, rot: -10, size: 56, delay: 0.33 },
]

/** Karakterin üstünde isim etiketi, konuşma balonu, uçan emoji tepkisi, AFK rozeti ve (fısıldıyorsa) 🤫. */
function Tag({ name, bubble: rawBubble, accent, reaction, whisper, afk = false, showName = false }) {
  // bubble: metin ya da { text, big } (çıkartmalar büyük gösterilir)
  const bubble = typeof rawBubble === 'string' ? { text: rawBubble } : rawBubble
  const reacts = Array.isArray(reaction) ? reaction : reaction ? [reaction] : []
  // oyuncuların kullanıcı adı ekranda yazmaz (kalabalık/okunaksız); isim, karaktere tıklayınca açılan profil penceresinde görünür.
  // Etiket yalnızca konuşma balonu, emoji tepkisi, AFK durumu ya da fısıltı varken çizilir. İsim göstermek gerekirse (Rehber NPC) `showName`.
  if (!showName && !bubble && !reacts.length && !whisper && !afk) return null
  return (
    <Html position={[0, AVATAR_HEIGHT + 0.45, 0]} center distanceFactor={9 * screenK()} zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
      <div className="relative flex flex-col items-center gap-1">
        {reacts.map((r) => {
          const set = REACT_BURSTS[r.e] ?? [r.e, '✨', r.e]
          return BURST_SLOTS.slice(0, set.length).map((slot, j) => (
            <span
              key={`${r.key}-${j}`}
              aria-hidden
              style={{
                width: `${slot.size}px`,
                height: `${slot.size}px`,
                '--rx': `${slot.rx}px`,
                '--rot': `${slot.rot}deg`,
                animation: `react-float 2.3s ${slot.delay}s ease-out both`,
              }}
              className="pointer-events-none absolute -top-8 left-1/2 grid place-items-center drop-shadow-[0_6px_14px_rgba(74,59,92,0.35)]"
            >
              <Em e={set[j]} size={slot.size} className="!max-w-none shrink-0" />
            </span>
          ))
        })}
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
  const [reaction, setReaction] = useState([])
  const [whisper, setWhisper] = useState(false)
  const last = useRef({ key: '', whisper: false })
  useFrame(() => {
    const now = Date.now()
    const raw = reactions?.current.get(id)
    const live = Array.isArray(raw) ? raw.filter((r) => r.until > now) : raw && raw.until > now ? [raw] : []
    const sig = live.map((r) => r.key).join('|')
    if (sig !== last.current.key) {
      last.current.key = sig
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
    g.position.set(r.x, groundY(r.x, r.z), r.z)
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
  const [reaction, setReaction] = useState([])
  const reactKey = useRef('')
  const [ready, setReady] = useState(false) // drei <Html> ilk çizim turunda bağlanmasın (React 19 root uyarısı)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 800)
    return () => clearTimeout(t)
  }, [])
  useFrame(() => {
    const now = Date.now()
    const b = selfId.current ? bubbles.current.get(selfId.current) : null
    const liveBubble = b && b.until > now ? b : null
    if (liveBubble !== ref.current) {
      ref.current = liveBubble
      setBubble(liveBubble)
    }
    const rid = selfId.current ?? 'self'
    const raw = reactions?.current.get(rid)
    const live = Array.isArray(raw) ? raw.filter((r) => r.until > now) : raw && raw.until > now ? [raw] : []
    const sig = live.map((r) => r.key).join('|')
    if (sig !== reactKey.current) {
      reactKey.current = sig
      setReaction(live)
    }
  })
  return ready ? <Tag name={name} bubble={bubble} accent="bg-[#5fc0ea]" reaction={reaction} /> : null
}

/** Lobideki Rehber (NPC): yakına gelenlere ipucu balonu gösterir; tıklayınca "Nasıl Oynanır" penceresini açar. */
export function GuideNpc({ focusRef, tips, onOpen, onNear }) {
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
      onNear?.(true)
    } else if (!near && s.near) {
      s.near = false
      s.i += 1
      setBubble(null)
      onNear?.(false)
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
    <group
      position={[GUIDE.x, 0, GUIDE.z]}
      rotation={[0, GUIDE.ry, 0]}
      onClick={(e) => {
        e.stopPropagation()
        onOpen?.()
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <AvatarRig slug={GUIDE.avatar} anim="idle" />
      <Tag name="Rehber" bubble={bubble} accent="bg-[#ffa94d]" showName />
    </group>
  )
}
