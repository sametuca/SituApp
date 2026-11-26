// Serbest meslekler (istemci): meslek seçme yok — herkes istediği zaman sahil iskelesinde/gölette balık tutabilir veya lobiden posta dağıtabilir.
import { TopDock } from '../../components/Dock'
import { Dock } from '../../components/Dock'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { DoorPrompt } from '../Social'
import { Ico } from '../../components/Icon'
import { VENUE_BY_ID } from '../venues'
import { VENUE_DOORS } from '../venueDoors'
import { FISH_BY_ID as MODEL_FISH } from '../jobsData'
import { mkPose, work } from './jobStore'
import { GAP, ISLAND, PIER } from '../layout'

const FISH_SPOTS = [
  { id: 'pier', label: 'Sahil İskelesi · Balık Tut', x: PIER.x, z: PIER.z0 + 1.8, wx: PIER.x, wz: PIER.z1, r: 6.5 },
  { id: 'pond', label: 'Park Göleti · Balık Tut', x: -30 - GAP, z: 23.0 + GAP, wx: -30 - GAP, wz: 28.2 + GAP, r: 5.5 },
]
const SHORE_SPOT = { id: 'shore', label: 'Deniz Kenarı · Balık Tut', wx: PIER.x, wz: PIER.z1 }
function fishSpotAt(x, z) {
  const fixed = FISH_SPOTS.find((s) => Math.hypot(x - s.x, z - s.z) < s.r)
  if (fixed) return fixed
  if (z >= ISLAND.z1 - 1.5 && Math.abs(x) <= 34) return SHORE_SPOT
  return null
}
const MAILBOX = { x: 6.6, z: -6.2, r: 3.0 }
const POST_VENUES = ['kafe', 'kitapkafe', 'firin', 'cayevi', 'tatli', 'kuafor', 'foto', 'dondurma', 'plajbar'].filter((id) => VENUE_DOORS[id])
const FISH_CATALOG = [
  { id: 'sardalya', name: 'Sardalya', rarity: 'Yaygın', coins: 6, speed: 1.15, zone: 0.32, w: 30, body: '#8ecae6', fin: '#5b9bd5', belly: '#e8f6ff', badge: 'bg-[#e8f6ff] text-[#2b6b94]' },
  { id: 'istavrit', name: 'İstavrit', rarity: 'Yaygın', coins: 8, speed: 1.32, zone: 0.27, w: 24, body: '#8fdcb4', fin: '#4fa87b', belly: '#effcf4', badge: 'bg-[#e6f9ef] text-[#2b7a52]' },
  { id: 'cipura', name: 'Çipura', rarity: 'Orta', coins: 11, speed: 1.58, zone: 0.22, w: 18, body: '#c7b8f5', fin: '#8d74d6', belly: '#f4f0ff', stripe: '#ffe48f', badge: 'bg-[#f1ebff] text-[#5e42a8]' },
  { id: 'palyaco', name: 'Palyaço Balığı', rarity: 'Nadir', coins: 15, speed: 1.88, zone: 0.17, w: 12, body: '#ff8a4c', fin: '#e85d24', belly: '#fff8f0', stripe: '#ffffff', badge: 'bg-[#fff0e2] text-[#b84c14]' },
  { id: 'kalamar', name: 'Kalamar', rarity: 'Nadir', coins: 18, speed: 2.08, zone: 0.15, w: 9, body: '#f4a2c4', fin: '#d96b96', belly: '#fff0f6', kind: 'squid', badge: 'bg-[#ffe8f2] text-[#a83868]' },
  { id: 'altin', name: 'Altın Balık', rarity: 'Efsanevi', coins: 28, speed: 2.38, zone: 0.12, w: 4, body: '#ffd35e', fin: '#f59e0b', belly: '#fffbe6', crown: true, badge: 'bg-[#fff3c4] text-[#8a5a00]' },
  { id: 'ahtapot', name: 'Kral Ahtapot', rarity: 'Efsanevi', coins: 32, speed: 2.58, zone: 0.11, w: 3, body: '#a87ce8', fin: '#7649bd', belly: '#f3e8ff', kind: 'octo', crown: true, badge: 'bg-[#efe6ff] text-[#5b2fa8]' },
]
const FISH_BY_ID = Object.fromEntries(FISH_CATALOG.map((f) => [f.id, f]))
const FISH_TOTAL_W = FISH_CATALOG.reduce((s, f) => s + f.w, 0)
function pickFish() {
  let r = Math.random() * FISH_TOTAL_W
  for (const f of FISH_CATALOG) {
    r -= f.w
    if (r <= 0) return f
  }
  return FISH_CATALOG[0]
}
const glass = 'border-2 border-white bg-white/92 shadow-toy backdrop-blur-md'

/** Her balık türüne özel sevimli pastel vektör çizimi. */
function FishArt({ fish, silhouette = false, size = 86 }) {
  if (!fish) return null
  const body = silhouette ? '#c6bcd8' : fish.body
  const fin = silhouette ? '#aba0c0' : fish.fin
  const belly = silhouette ? '#d8d0e6' : fish.belly
  if (fish.kind === 'octo') {
    return (
      <svg width={size} height={size * 0.78} viewBox="0 0 120 94" className="mx-auto drop-shadow-sm" aria-hidden>
        {[24, 42, 60, 78, 96].map((x, i) => (
          <path key={i} d={`M${x} 54 Q${x + (i - 2) * 5} 78 ${x + (i % 2 ? 7 : -7)} 84`} stroke={fin} strokeWidth="9" strokeLinecap="round" fill="none" />
        ))}
        <ellipse cx="60" cy="40" rx="30" ry="26" fill={body} />
        <ellipse cx="60" cy="46" rx="20" ry="13" fill={belly} opacity="0.55" />
        {!silhouette && (
          <>
            <circle cx="49" cy="39" r="4.5" fill="#3a2d4c" />
            <circle cx="71" cy="39" r="4.5" fill="#3a2d4c" />
            <circle cx="47.5" cy="37.5" r="1.6" fill="#fff" />
            <circle cx="69.5" cy="37.5" r="1.6" fill="#fff" />
            <path d="M54 49 Q60 54 66 49" stroke="#3a2d4c" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            {fish.crown && <path d="M47 16 L51 6 L60 12 L69 6 L73 16 Z" fill="#ffd35e" stroke="#e8952c" strokeWidth="2" />}
          </>
        )}
      </svg>
    )
  }
  if (fish.kind === 'squid') {
    return (
      <svg width={size} height={size * 0.78} viewBox="0 0 120 94" className="mx-auto drop-shadow-sm" aria-hidden>
        {[40, 52, 68, 80].map((x, i) => (
          <path key={i} d={`M${x} 58 Q${x + (i < 2 ? -6 : 6)} 76 ${x + (i < 2 ? -2 : 2)} 85`} stroke={fin} strokeWidth="7" strokeLinecap="round" fill="none" />
        ))}
        <path d="M36 28 L60 8 L84 28 Z" fill={fin} />
        <rect x="38" y="24" width="44" height="40" rx="20" fill={body} />
        <ellipse cx="60" cy="44" rx="14" ry="11" fill={belly} opacity="0.55" />
        {!silhouette && (
          <>
            <circle cx="50" cy="44" r="4.2" fill="#3a2d4c" />
            <circle cx="70" cy="44" r="4.2" fill="#3a2d4c" />
            <circle cx="48.6" cy="42.6" r="1.5" fill="#fff" />
            <circle cx="68.6" cy="42.6" r="1.5" fill="#fff" />
          </>
        )}
      </svg>
    )
  }
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 120 86" className="mx-auto drop-shadow-sm" aria-hidden>
      {/* kuyruk */}
      <path d="M28 43 L6 23 Q13 43 6 63 Z" fill={fin} />
      {/* sırt ve alt yüzgeç */}
      <path d="M54 20 Q68 6 82 22 Z" fill={fin} />
      <path d="M56 64 Q66 76 76 64 Z" fill={fin} />
      {/* gövde */}
      <ellipse cx="68" cy="43" rx="38" ry="24" fill={body} />
      <ellipse cx="70" cy="52" rx="26" ry="10" fill={belly} opacity="0.65" />
      {!silhouette && fish.stripe && (
        <>
          <rect x="52" y="21" width="9" height="44" rx="4.5" fill={fish.stripe} opacity="0.92" />
          <rect x="72" y="20" width="8" height="46" rx="4" fill={fish.stripe} opacity="0.92" />
        </>
      )}
      {!silhouette && (
        <>
          <circle cx="88" cy="38" r="5" fill="#ffffff" />
          <circle cx="89.5" cy="38" r="3" fill="#3a2d4c" />
          <circle cx="88.5" cy="36.8" r="1.1" fill="#ffffff" />
          <path d="M97 47 Q102 49 104 46" stroke="#3a2d4c" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          {fish.crown && <path d="M62 19 L65 10 L72 15 L79 10 L82 19 Z" fill="#fff3c4" stroke="#e8952c" strokeWidth="2" />}
        </>
      )}
    </svg>
  )
}

/** Su yüzeyinde hafif parlayan balık halkaları + ara sıra zıplayan minik balık. */
function FishSpotFx({ spot }) {
  const ring = useRef()
  const fish = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const p = (t * 0.55) % 1
    if (ring.current) {
      ring.current.scale.setScalar(0.5 + p * 1.4)
      ring.current.material.opacity = (1 - p) * 0.55
    }
    if (fish.current) {
      const jp = (t * 0.42) % 3.2
      const vis = jp < 0.75
      fish.current.visible = vis
      if (vis) {
        const u = jp / 0.75
        fish.current.position.set(spot.wx + (u - 0.5) * 0.9, 0.05 + Math.sin(u * Math.PI) * 0.65, spot.wz)
        fish.current.rotation.z = (0.5 - u) * 1.4
      }
    }
  })
  return (
    <group>
      <mesh ref={ring} position={[spot.wx, 0.08, spot.wz]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.45, 0.62, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <mesh ref={fish} position={[spot.wx, 0.1, spot.wz]} visible={false}>
        <capsuleGeometry args={[0.07, 0.16, 4, 8]} />
        <meshStandardMaterial color="#ffb48c" roughness={0.35} />
      </mesh>
    </group>
  )
}

/** Lobideki 3B pastel posta kutusu. */
function MailboxProp() {
  return (
    <group position={[MAILBOX.x, 0, MAILBOX.z]} rotation={[0, -Math.PI / 4, 0]}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.1, 1.0, 10]} />
        <meshStandardMaterial color="#8a7a9c" roughness={0.6} />
      </mesh>
      <RoundedBox args={[0.52, 0.42, 0.68]} radius={0.1} smoothness={2} position={[0, 1.12, 0]} castShadow>
        <meshStandardMaterial color="#f2746b" roughness={0.45} />
      </RoundedBox>
      <mesh position={[0, 1.18, 0.35]}>
        <boxGeometry args={[0.34, 0.06, 0.04]} />
        <meshStandardMaterial color="#fff8f0" roughness={0.5} />
      </mesh>
      {/* sarı posta bayrağı */}
      <mesh position={[0.28, 1.24, 0.08]}>
        <boxGeometry args={[0.04, 0.26, 0.14]} />
        <meshStandardMaterial color="#ffd35e" roughness={0.4} />
      </mesh>
    </group>
  )
}

/** Aktif posta teslimatında hedef mekânın önünde parlayan halka. */
function DeliveryBeacon({ target }) {
  const door = VENUE_DOORS[target]
  const ref = useRef()
  useFrame(({ clock }) => {
    if (!ref.current) return
    const p = (clock.elapsedTime * 0.9) % 1
    ref.current.scale.setScalar(0.85 + p * 0.65)
    ref.current.material.opacity = (1 - p) * 0.7
  })
  if (!door) return null
  return (
    <mesh ref={ref} position={[door.x, 0.14, door.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.85, 1.15, 28]} />
      <meshBasicMaterial color="#fdb252" transparent opacity={0.65} depthWrite={false} />
    </mesh>
  )
}

/** Balık tutma mini oyunu: balığın nadirliğine göre hızı artar ve yakalama alanı daralır. */
function FishingCard({ spot, onCatch, onClose, onPhase, result, touch }) {
  const [phase, setPhase] = useState('wait') // wait | bite | done
  const [hooked, setHooked] = useState(null)
  const [zoneStart, setZoneStart] = useState(0.35)
  const [pos, setPos] = useState(0.1)
  const [missed, setMissed] = useState(false)
  const dir = useRef(1)
  const posRef = useRef(0.1)

  useEffect(() => {
    if (phase !== 'wait') return undefined
    const ms = 10000 + Math.random() * 5000 // iki balık arası bekleme 10-15 sn
    const t = setTimeout(() => {
      const f = pickFish()
      const maxStart = Math.max(0.12, 0.88 - f.zone)
      const start = 0.12 + Math.random() * (maxStart - 0.12)
      setHooked(f)
      setZoneStart(start)
      posRef.current = 0.05
      dir.current = 1
      setPos(0.05)
      window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
      setPhase('bite')
    }, ms)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'bite' || !hooked) return undefined
    let raf
    let last = performance.now()
    const spd = hooked.speed
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      let next = posRef.current + dir.current * dt * spd
      if (next >= 1) {
        next = 1
        dir.current = -1
      } else if (next <= 0) {
        next = 0
        dir.current = 1
      }
      posRef.current = next
      setPos(next)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [phase, hooked])

  const pull = useCallback(() => {
    if (phase !== 'bite' || !hooked) return
    const ok = posRef.current >= zoneStart && posRef.current <= zoneStart + hooked.zone
    setPhase('done')
    if (ok) {
      setMissed(false)
      onCatch(spot.id, hooked)
    } else {
      setMissed(true)
      window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
    }
  }, [phase, hooked, zoneStart, onCatch, spot.id])

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' && phase === 'bite') {
        e.preventDefault()
        pull()
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, pull, onClose])

  const retry = () => {
    setMissed(false)
    setHooked(null)
    posRef.current = 0.05
    dir.current = 1
    setPhase('wait')
  }

  useEffect(() => {
    onPhase?.(phase, hooked, missed)
  }, [phase, hooked, missed, onPhase])

  const shownFish = result ? (FISH_BY_ID[result.id] ?? hooked ?? result) : hooked

  return (
    <TopDock><div className={`relative pointer-events-auto w-[min(92vw,22.5rem)] animate-pop rounded-[2rem] p-4 text-center ${glass}`} role="dialog" aria-label="Balık Tutma">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-sm font-black text-[#4a3b5c]">
          <Ico name="fish" size={18} /> Balıkçılık
        </span>
        <button type="button" onClick={onClose} aria-label="Kapat" className="grid h-7 w-7 place-items-center rounded-full bg-[#f6f0ff] text-xs font-black text-[#8a7a9c]">
          ✕
        </button>
      </div>

      {phase === 'wait' && (
        <div className="mt-3 py-3">
          <div className="mx-auto grid h-10 w-10 animate-bounce place-items-center rounded-full bg-[#dff3ff]">
            <Ico name="fish" size={22} />
          </div>
          <p className="mt-2 text-sm font-extrabold text-[#4a3b5c]">Olta suda, balık bekleniyor…</p>
          <p className="text-xs font-semibold text-[#8a7a9c]">Nadir balıklar daha hızlı gelir!</p>
        </div>
      )}

      {phase === 'bite' && hooked && (
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${hooked.badge}`}>{hooked.rarity}</span>
            <p className="text-sm font-black text-[#e8952c]">Balık vurdu! Şimdi çek!</p>
          </div>
          <FishArt fish={hooked} silhouette size={68} />
          <div className="relative mt-2 h-7 overflow-hidden rounded-full bg-[#eef4ff] ring-2 ring-white">
            <div
              className="absolute inset-y-0 rounded-full bg-[#ffd35e]/85"
              style={{ left: `${zoneStart * 100}%`, width: `${hooked.zone * 100}%` }}
            />
            <div className="absolute top-1/2 h-5 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#4a3b5c] shadow" style={{ left: `${pos * 100}%` }} />
          </div>
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault()
              pull()
            }}
            className="mt-3 w-full select-none rounded-2xl border-b-4 border-[#d98a1c] bg-[#fdb252] py-3.5 text-base font-black text-white active:translate-y-[2px] active:border-b-2"
          >
            Çek! {touch ? '' : '(Boşluk)'}
          </button>
        </div>
      )}

      {phase === 'done' && (
        <div className="mt-2">
          {missed ? (
            <>
              <FishArt fish={hooked} silhouette size={72} />
              <p className="mt-1 text-base font-black text-[#8a7a9c]">{hooked?.rarity === 'Efsanevi' ? 'Efsanevi balık kaçtı!' : 'Kaçtı! Sarı alanda yakala.'}</p>
            </>
          ) : result ? (
            <>
              <FishArt fish={shownFish} size={96} />
              <div className="mt-1 flex items-center justify-center gap-1.5">
                {shownFish?.badge && <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${shownFish.badge}`}>{shownFish.rarity}</span>}
                <p className="text-lg font-black text-[#4a3b5c]">{result.name}!</p>
              </div>
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#fff3c4] px-3 py-0.5 text-xs font-black text-[#8a5a00]">
                <Ico name="coins" size={14} /> +{result.coins} TL
              </p>
            </>
          ) : (
            <p className="py-4 text-sm font-bold text-[#8a7a9c]">Çekiliyor…</p>
          )}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={retry} className="flex-1 rounded-2xl border-b-4 border-[#3282b8] bg-[#5fc0ea] py-2 text-xs font-extrabold text-white active:translate-y-[2px]">
              Tekrar At
            </button>
            <button type="button" onClick={onClose} className="flex-1 rounded-2xl border-b-4 border-[#c9bde6] bg-[#ece4ff] py-2 text-xs font-extrabold text-[#6b4fc0] active:translate-y-[2px]">
              Bitir
            </button>
          </div>
        </div>
      )}
    </div></TopDock>
  )
}

export function useJobs({ net, focusRef, home, venue, atDoor, touch, say, panel }) {
  const { on, send } = net
  const inCity = !home && !venue
  const [nearFish, setNearFish] = useState(null)
  const [nearMailbox, setNearMailbox] = useState(false)
  const [fishing, setFishing] = useState(null) // spot | null
  const [fishRes, setFishRes] = useState(null)
  const [postTarget, setPostTarget] = useState(null) // venueId | null
  const [postDist, setPostDist] = useState(0)
  const [nudge, setNudge] = useState(false)
  const nudgedOnce = useRef(false)
  const fishedOnce = useRef(false)

  // Nazik, zorlamayan sahil balıkçılık daveti (oturumda en fazla 1 kez)
  useEffect(() => {
    if (!inCity || nudgedOnce.current || fishedOnce.current) return undefined
    const t = setTimeout(() => {
      if (nudgedOnce.current || fishedOnce.current) return
      const f = focusRef.current
      if (f.z > 30) return // zaten plajda
      nudgedOnce.current = true
      setNudge(true)
    }, 22000)
    return () => clearTimeout(t)
  }, [inCity, focusRef])

  useEffect(() => {
    const offs = [
      on('job_fish_res', (m) => {
        if (!m.fish) return
        setFishRes(m.fish)
        window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: m.fish.coins >= 14 ? 'badge' : 'collect' }))
        say(`Balıkçılık: ${m.fish.name} yakaladın (+${m.fish.coins} altın)`)
      }),
      on('job_post_state', (m) => {
        if (!m.target) return
        setPostTarget(m.target)
        const v = VENUE_BY_ID[m.target]
        window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
        say(`Posta paketi alındı: ${v?.name ?? m.target} kapısına teslim et.`)
      }),
      on('job_post_done', (m) => {
        const v = VENUE_BY_ID[m.target]
        setPostTarget(null)
        window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'quest' }))
        say(`Posta teslim edildi (${v?.name ?? m.target}): +${m.coins ?? 12} TL!`)
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [on, say])

  useEffect(() => {
    if (!inCity) {
      setNearFish(null)
      setNearMailbox(false)
      setFishing(null)
      return undefined
    }
    const id = setInterval(() => {
      const f = focusRef.current
      const spot = fishSpotAt(f.x, f.z)
      setNearFish(spot)
      // sahilden/göletten uzaklaşınca balık tutma penceresini otomatik kapat
      if (!spot) {
        setFishing((cur) => {
          if (cur) say('Kıyıdan uzaklaştığın için olta toplandı.')
          return null
        })
      }
      setNearMailbox(Math.hypot(f.x - MAILBOX.x, f.z - MAILBOX.z) < MAILBOX.r)
      if (postTarget && VENUE_DOORS[postTarget]) {
        const d = VENUE_DOORS[postTarget]
        setPostDist(Math.round(Math.hypot(f.x - d.x, f.z - d.z)))
      }
    }, 250)
    return () => clearInterval(id)
  }, [inCity, focusRef, postTarget])

  // ----- çalışma duruşu: olta tutma / kargo taşıma (kendi avatarım hemen, diğerlerine sunucu yayar) -----
  const setPose = useCallback(
    (style, phase = null, fish = null, pk = null) => {
      work.self.current = style ? mkPose(style, phase, { fish, pk }) : null
      send({ t: 'work_pose', style, phase, fish, pk })
    },
    [send],
  )
  const reelTimer = useRef(null)
  const onFishPhase = useCallback(
    (phase, hooked, missed) => {
      clearTimeout(reelTimer.current)
      if (phase === 'bite') setPose('fish', 'bite')
      else if (phase === 'done' && !missed && hooked) {
        const mid = MODEL_FISH[hooked.id] ? hooked.id : hooked.id === 'kalamar' ? 'ahtapot' : 'cipura'
        setPose('fish', 'reel', mid)
        reelTimer.current = setTimeout(() => setPose('fish', 'wait'), 2200)
      } else setPose('fish', 'wait')
    },
    [setPose],
  )
  useEffect(() => {
    if (!fishing) return undefined
    setPose('fish', 'cast')
    const t = setTimeout(() => setPose('fish', 'wait'), 900)
    return () => {
      clearTimeout(t)
      clearTimeout(reelTimer.current)
      setPose(null)
    }
  }, [fishing, setPose])
  useEffect(() => {
    if (fishing || !postTarget) return undefined
    setPose('carry', null, null, 'box')
    return () => setPose(null)
  }, [postTarget, fishing, setPose])
  useEffect(() => {
    const myId = () => net.selfId?.current
    const offs = [
      on('welcome', () => {
        work.poses.clear()
        work.self.current = null
        send({ t: 'work_get' })
      }),
      on('room', () => {
        work.poses.clear()
        send({ t: 'work_get' })
      }),
      on('works', (m) => {
        work.poses.clear()
        for (const w of m.list ?? []) work.poses.set(w.id, mkPose(w.style, w.phase ?? null, { fish: w.fish, pk: w.pk }))
      }),
      on('work', (m) => {
        if (m.id === myId()) return // kendi duruşum yerelde zaten ayarlı
        const prev = work.poses.get(m.id)
        if (!m.style) return work.poses.delete(m.id)
        if (prev && prev.style === m.style && prev.phase === (m.phase ?? null) && prev.fish === m.fish) return
        work.poses.set(m.id, mkPose(m.style, m.phase ?? null, { fish: m.fish, pk: m.pk }))
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [on, send, net.selfId])

  const startFishing = useCallback((spot) => {
    if (!spot) return
    fishedOnce.current = true
    setNudge(false)
    setFishRes(null)
    setFishing(spot)
  }, [])

  const onCatch = useCallback(
    (spotId, hookedFish) => {
      if (!send({ t: 'job_fish', spot: spotId, fishId: hookedFish?.id })) {
        // çevrimdışı modda yerel balık ödülü
        const pick = hookedFish ?? pickFish()
        setFishRes(pick)
        window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: pick.coins >= 15 ? 'badge' : 'collect' }))
        say(`Balıkçılık: ${pick.name} yakaladın (+${pick.coins} altın)`)
      }
    },
    [send, say],
  )

  const startPost = useCallback(() => {
    if (!send({ t: 'job_post_start' })) {
      const target = POST_VENUES[Math.floor(Math.random() * POST_VENUES.length)]
      setPostTarget(target)
      const v = VENUE_BY_ID[target]
      window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
      say(`Posta paketi alındı: ${v?.name ?? target} kapısına teslim et.`)
    }
  }, [send, say])

  const deliverPost = useCallback(() => {
    if (!postTarget) return
    if (!send({ t: 'job_post_deliver' })) {
      const v = VENUE_BY_ID[postTarget]
      setPostTarget(null)
      window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'quest' }))
      say(`Posta teslim edildi (${v?.name ?? postTarget}): +12 TL!`)
    }
  }, [postTarget, send, say])

  const nearDeliver = Boolean(inCity && postTarget && VENUE_DOORS[postTarget] && postDist <= 4)

  const goPier = () => {
    setNudge(false)
    window.dispatchEvent(new CustomEvent('situapp:tp', { detail: 'beach' }))
    focusRef.current.teleport = [0, 52.5, 0]
  }

  // E tuşu: teslimat > balık tutma > posta kutusu (kapı önünde ve pencere açıkken devre dışı)
  const actRef = useRef(null)
  useEffect(() => {
    actRef.current = () => {
      if (!inCity || panel || fishing) return
      if (nearDeliver) return deliverPost()
      if (atDoor) return
      if (nearFish) return startFishing(nearFish)
      if (nearMailbox && !postTarget) return startPost()
    }
  })
  useEffect(() => {
    const onKey = (e) => {
      if ((e.code !== 'KeyE' && e.key !== 'e' && e.key !== 'E') || e.ctrlKey || e.metaKey || e.altKey) return
      const typing = e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)
      if (typing) return
      actRef.current?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const sceneNodes = inCity ? (
    <>
      {FISH_SPOTS.map((s) => (
        <FishSpotFx key={s.id} spot={s} />
      ))}
      <MailboxProp />
      {postTarget && <DeliveryBeacon target={postTarget} />}
    </>
  ) : null

  const targetVenue = postTarget ? VENUE_BY_ID[postTarget] : null

  const overlays = (
    <>
      {/* Aktif posta teslimatı göstergesi (istenirse tek tıkla bırakılır) */}
      {inCity && targetVenue && (
        <TopDock><div className={`relative pointer-events-auto flex items-center gap-2.5 rounded-full px-4 py-1.5 text-xs font-extrabold text-[#4a3b5c] ${glass}`}>
          <Ico name="parcel" size={16} />
          <span>Teslimat: <b>{targetVenue.name}</b> · {postDist} m</span>
          <button type="button" onClick={() => setPostTarget(null)} className="rounded-full bg-[#f6f0ff] px-2 py-0.5 text-[11px] font-black text-[#8a7a9c] hover:bg-[#ffedd6]">
            Bırak
          </button>
        </div></TopDock>
      )}

      {/* Nazik, zorlamayan sahil balıkçılık daveti — ortada, SkillBar'ın tam üstünde */}
      {inCity && nudge && !panel && !fishing && (
        <Dock><div className="pointer-events-auto relative flex w-[min(92vw,23rem)] animate-pop flex-col gap-2.5 rounded-3xl p-4 border-2 border-white bg-white/80 shadow-soft backdrop-blur-md" role="status">
          <div className="flex items-start gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#dff3ff]">
              <Ico name="fish" size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-[#4a3b5c]">Sahilde balıklar zıplıyor</p>
              <p className="text-[11px] font-semibold text-[#8a7a9c]">İstersen plaj iskelesine uğrayıp birkaç olta atabilirsin.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={goPier} className="flex-1 rounded-xl border-b-2 border-[#3282b8] bg-[#5fc0ea] py-1.5 text-xs font-extrabold text-white active:translate-y-[1px]">
              İskeleye Git
            </button>
            <button type="button" onClick={() => setNudge(false)} className="rounded-xl bg-[#f6f0ff] px-3 py-1.5 text-xs font-extrabold text-[#7c6d91]">
              Şimdi değil
            </button>
          </div>
        </div></Dock>
      )}

      {inCity && nearDeliver && !panel && !fishing && (
        <DoorPrompt label={`Paket Teslim · ${targetVenue?.name ?? ''}`} action="Teslim Et" touch={touch} raised onGo={deliverPost} />
      )}
      {inCity && !nearDeliver && !atDoor && nearFish && !panel && !fishing && (
        <DoorPrompt label={nearFish.label} action="Olta At" touch={touch} raised onGo={() => startFishing(nearFish)} />
      )}
      {inCity && !nearDeliver && !atDoor && !nearFish && nearMailbox && !postTarget && !panel && !fishing && (
        <DoorPrompt label="Lobi Posta Kutusu" action="Paket Al" touch={touch} raised onGo={startPost} />
      )}

      {fishing && <FishingCard spot={fishing} result={fishRes} touch={touch} onCatch={onCatch} onPhase={onFishPhase} onClose={() => setFishing(null)} />}
    </>
  )

  return { sceneNodes, overlays }
}
