// Uzak oyuncular + NPC çizimi, yumuşatma ve çizim bütçesi.
import { memo, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { screenK } from './screenK'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { MathUtils } from 'three'
import AvatarRig, { AVATAR_HEIGHT } from './AvatarRig'
import { Em } from '../components/emoji'
import { GUIDE, groundY } from './layout'
import { NpcTag } from './NpcLayer'
import { together } from './features/togetherStore'
import { work } from './features/jobStore'
import { BIKE_POSE } from './bikeStore'
import { playerPos } from './cull'

const NEAR_DRAW = 42 // m: bu mesafeden uzaktaki oyuncular çizilmez
const MAX_DRAW_DESKTOP = 25 // masaüstünde aynı anda tam çizilen en yakın oyuncu bütçesi
const MAX_DRAW_TOUCH = 14 // mobil/dokunmatikte aynı anda tam çizilen en yakın oyuncu bütçesi
const MAX_SHADOWS = 8 // gölge düşüren en yakın oyuncu sayısı (50 kişilik mekânda GPU'yu korur)
const BUBBLE_RANGE_SQ = 8 * 8 // 8 m: konuşma balonu yalnızca yakındakilerde çıkar (uzaktakiler sohbet kutusundan okunur)
const HALF_RATE_SQ = 10 * 10 // >10 m: animasyon güncellemesi 30 Hz'e düşer
const SHADOW_RANGE_SQ = 24 * 24
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

/** Karakterin üstünde tıklanınca görünen oyuncu adı, konuşma balonu, emoji tepkisi ve fısıltı göstergesi. */
function Tag({ name, bubble: rawBubble, reaction, whisper, showName = false, onTapName = null }) {
  // bubble: metin ya da { text, big } (çıkartmalar büyük gösterilir)
  const bubble = typeof rawBubble === 'string' ? { text: rawBubble } : rawBubble
  const reacts = Array.isArray(reaction) ? reaction : reaction ? [reaction] : []
  if (!showName && !bubble && !reacts.length && !whisper) return null
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
          <div className={`relative break-words rounded-2xl border-2 border-white bg-gradient-to-b from-white via-[#fffdf8] to-[#efe6ff] text-center font-extrabold text-[#4a3b5c] shadow-[0_10px_22px_rgba(35,23,63,0.28),0_4px_0_#cbb7ef,inset_0_2px_0_rgba(255,255,255,0.95)] ring-1 ring-[#a88bff]/30 ${bubble.big ? 'px-4 py-1.5 text-6xl leading-tight' : 'w-max min-w-[120px] max-w-[340px] px-4 py-2 text-sm leading-snug'}`}>
            {bubble.text}
            <span aria-hidden className="absolute -bottom-[7px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 rounded-br-[3px] border-b-2 border-r-2 border-[#cbb7ef] bg-[#efe6ff]" />
          </div>
        )}
        {whisper && !bubble && (
          <div className="animate-pop rounded-full border-2 border-white bg-[#e9ddff] px-2.5 py-0.5 text-xs font-extrabold text-[#6b4fc0] shadow">🤫 fısıldıyor…</div>
        )}
        {showName && name && (
          onTapName ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onTapName()
              }}
              style={{ pointerEvents: 'auto' }}
              className="whitespace-nowrap rounded-full border-2 border-white bg-gradient-to-r from-[#f3e8ff] via-[#ede9fe] to-[#fce7f3] px-4 py-1 text-xs font-black tracking-wide text-[#5b4678] shadow-[0_4px_14px_rgba(168,139,255,0.5)] active:scale-95"
            >
              {name}
            </button>
          ) : (
            <div className="whitespace-nowrap rounded-full border-2 border-white bg-gradient-to-r from-[#f3e8ff] via-[#ede9fe] to-[#fce7f3] px-3.5 py-0.5 text-[11px] font-black tracking-wide text-[#5b4678] shadow-[0_4px_14px_rgba(168,139,255,0.45)]">
              {name}
            </div>
          )
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
  const elapsed = useRef(0)
  useFrame((_, dt) => {
    elapsed.current += dt
    if (elapsed.current < 0.1) return
    elapsed.current %= 0.1
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

const RemoteAvatar = memo(function RemoteAvatar({ id, name, avatar, remotes, bubbles, reactions, whispering, budgetRef, onPick, touch = false }) {
  const group = useRef()
  const [anim, setAnim] = useState('idle')
  const [bubble, setBubble] = useState(null)
  const animRef = useRef('idle')
  const bubbleRef = useRef(null)
  const [near, setNear] = useState(true) // çizim bütçesi dışındaki oyuncular çizilmez
  const nearRef = useRef(true)
  const [closeBy, setCloseBy] = useState(false)
  const closeByRef = useRef(false)
  const [halfRate, setHalfRate] = useState(false) // >10 m: 30 Hz animasyon
  const halfRateRef = useRef(false)
  const [nameRevealed, setNameRevealed] = useState(false)
  const nameTimerRef = useRef(null)
  const tapStartRef = useRef(null)
  const lastPickAtRef = useRef(0)
  const shadowRef = useRef(null)
  const shadowCheckRef = useRef(0)
  const [afk, setAfk] = useState(false)
  const idleRef = useRef({ since: Date.now(), x: 0, z: 0, afk: false })
  useEffect(() => () => clearTimeout(nameTimerRef.current), [])
  const revealName = () => {
    setNameRevealed(true)
    clearTimeout(nameTimerRef.current)
    nameTimerRef.current = setTimeout(() => setNameRevealed(false), 2500)
  }
  const triggerPick = () => {
    const now = Date.now()
    if (now - lastPickAtRef.current < 260) return
    lastPickAtRef.current = now
    revealName()
    onPick?.(id)
  }
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
        return work.poses.get(id) ?? null
      },
    }),
    [id, remotes],
  )

  useFrame((_, dt) => {
    const r = remotes.current.get(id)
    const g = group.current
    if (!r || !g) return
    // Konumlar ortak RemotePlayers döngüsünde yumuşatılır; burada yalnızca çizilen avatarı güncelle.
    const k = 1 - Math.exp(-dt * 12)
    g.position.set(r.x, groundY(r.x, r.z), r.z)

    const budget = budgetRef?.current
    const d2 = (r.x - playerPos.x) ** 2 + (r.z - playerPos.z) ** 2
    const nn = budget?.ready ? budget.draw.has(id) : d2 < NEAR_DRAW * NEAR_DRAW
    if (nn !== nearRef.current) {
      nearRef.current = nn
      setNear(nn)
    }

    // Gölge değişince hemen uygula; model ağacını oyuncu yakındayken 4 Hz tara.
    shadowCheckRef.current += dt
    const sh = nn && (budget?.ready ? budget.shadow.has(id) : d2 < SHADOW_RANGE_SQ)
    const shadowChanged = sh !== shadowRef.current
    if (shadowChanged || (nn && shadowCheckRef.current >= 0.25)) {
      if (nn || shadowChanged) g.traverse((o) => { if (o.isMesh) o.castShadow = sh })
      shadowRef.current = sh
      shadowCheckRef.current = 0
    }

    const cb = nn && d2 <= 13 * 13
    if (cb !== closeByRef.current) {
      closeByRef.current = cb
      setCloseBy(cb)
    }

    const hr = nn && (budget?.ready ? budget.halfRate.has(id) : d2 > HALF_RATE_SQ)
    if (hr !== halfRateRef.current) {
      halfRateRef.current = hr
      setHalfRate(hr)
    }

    const diff = MathUtils.euclideanModulo(r.tr - g.rotation.y + Math.PI, Math.PI * 2) - Math.PI
    g.rotation.y += diff * k

    if (r.anim !== animRef.current) {
      animRef.current = r.anim
      setAnim(r.anim)
    }
    const allowBubble = nn && (budget?.ready ? budget.bubble.has(id) : d2 <= BUBBLE_RANGE_SQ)
    const b = allowBubble ? bubbles.current.get(id) : null
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
      onPointerDown={(e) => {
        tapStartRef.current = { x: e.clientX, y: e.clientY, t: Date.now() }
      }}
      onPointerUp={(e) => {
        const st = tapStartRef.current
        tapStartRef.current = null
        if (!st) return
        if (Math.hypot(e.clientX - st.x, e.clientY - st.y) <= 22 && Date.now() - st.t <= 550) {
          e.stopPropagation()
          triggerPick()
        }
      }}
      onClick={(e) => {
        e.stopPropagation()
        triggerPick()
      }}
      onPointerOver={() => {
        if (onPick) document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = ''
      }}
    >
      {/* Dokunmatikte ve farede oyuncuyu kolayca seçmek için görünmez geniş dokunma silindiri */}
      {near && (
        <mesh position={[0, touch ? 1.15 : 1.0, 0]}>
          <cylinderGeometry args={[touch ? 0.88 : 0.5, touch ? 0.88 : 0.5, touch ? 2.35 : 2.0, 10]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      {near && <AvatarRig slug={avatar} anim={anim === 'ride' ? 'idle' : anim} pose={pose} cosId={id} halfRate={halfRate} />}
      {near && anim === 'ride' && (
        <Suspense fallback={null}>
          <BikeModel />
        </Suspense>
      )}
      {near && (
        <Tag
          name={name}
          bubble={bubble}
          reaction={reaction}
          whisper={whisper}
          showName={nameRevealed || (touch && closeBy)}
          onTapName={touch ? triggerPick : null}
          afk={afk}
        />
      )}
    </group>
  )
})

export default function RemotePlayers({ roster, remotes, bubbles, reactions, whispering, onPick, touch = false }) {
  const budgetRef = useRef({ draw: new Set(), shadow: new Set(), halfRate: new Set(), bubble: new Set(), ready: false, count: -1 })
  const timerRef = useRef(0)
  const drawIdsRef = useRef([])
  const [drawIds, setDrawIds] = useState([])
  const rosterById = useMemo(() => new Map(roster.map((p) => [p.id, p])), [roster])

  // Konumları tek döngüde yumuşat; yalnızca çizim bütçesindeki oyuncular için ayrı R3F bileşeni tut.
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 12)
    for (const r of remotes.current.values()) {
      r.x = MathUtils.lerp(r.x, r.tx, k)
      r.z = MathUtils.lerp(r.z, r.tz, k)
    }

    // Saniyede 4 kez mesafeye göre çizim/gölge/balon/30Hz bütçesi hesaplanır.
    timerRef.current += dt
    const size = remotes.current.size
    if (budgetRef.current.ready && timerRef.current < 0.25 && size === budgetRef.current.count) return
    timerRef.current = 0
    const nearLimSq = NEAR_DRAW * NEAR_DRAW
    const list = []
    for (const r of remotes.current.values()) {
      const d2 = (r.x - playerPos.x) ** 2 + (r.z - playerPos.z) ** 2
      if (d2 <= nearLimSq) list.push([r.id, d2])
    }
    list.sort((a, b) => a[1] - b[1])
    const maxDraw = touch ? MAX_DRAW_TOUCH : MAX_DRAW_DESKTOP
    const draw = new Set()
    const shadow = new Set()
    const halfRate = new Set()
    const bubble = new Set()
    for (let i = 0; i < list.length && i < maxDraw; i++) {
      const [pid, d2] = list[i]
      draw.add(pid)
      if (shadow.size < MAX_SHADOWS && d2 <= SHADOW_RANGE_SQ) shadow.add(pid)
      if (d2 > HALF_RATE_SQ) halfRate.add(pid)
      if (d2 <= BUBBLE_RANGE_SQ) bubble.add(pid)
    }
    budgetRef.current = { draw, shadow, halfRate, bubble, ready: true, count: size }
    const ids = list.slice(0, maxDraw).map(([id]) => id).sort()
    const prev = drawIdsRef.current
    if (ids.length !== prev.length || ids.some((id, i) => id !== prev[i])) {
      drawIdsRef.current = ids
      setDrawIds(ids)
    }
  })

  return drawIds.map((id) => {
    const p = rosterById.get(id)
    if (!p) return null
    const { key: _playerKey, ...peer } = p
    return <RemoteAvatar key={id} {...peer} remotes={remotes} bubbles={bubbles} reactions={reactions} whispering={whispering} budgetRef={budgetRef} onPick={onPick} touch={touch} />
  })
}

/** Yerel oyuncunun konuşma balonu ve tepkileri (LocalPlayer'ın çocuğu olarak çizilir). */
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
  const [nameRevealed, setNameRevealed] = useState(false)
  const nameTimerRef = useRef(null)
  const state = useRef({ near: false, i: 0, t: 0 })
  useEffect(() => () => clearTimeout(nameTimerRef.current), [])
  const revealName = () => {
    setNameRevealed(true)
    clearTimeout(nameTimerRef.current)
    nameTimerRef.current = setTimeout(() => setNameRevealed(false), 2500)
  }

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
        revealName()
        onOpen?.()
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <AvatarRig slug={GUIDE.avatar} anim="idle" />
      {(nameRevealed || bubble) && <NpcTag name="Kasaba Rehberi Mira" bubble={bubble} showName={nameRevealed} />}
    </group>
  )
}
