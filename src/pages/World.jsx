import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DockSlot, TopDockSlot } from '../components/Dock'
import { Navigate, useNavigate } from 'react-router-dom'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useProgress } from '@react-three/drei'
import { PCFShadowMap } from 'three'
import { useAuth } from '../lib/AuthContext'
import City from '../world/City'
import HomeRoom from '../world/HomeRoom'
import Venue from '../world/Venue'
import { VENUE_BY_ID, VENUE_ROOM } from '../world/venues'
import { ENTERABLE, venueDoor } from '../world/venueDoors'
import { resolveVenueRoom, venueLayout, venueTheme } from '../world/venueLayout'
import { together } from '../world/features/togetherStore'
import { EditToggle, FurnitureLayer, FurnitureSheet } from '../world/HomeEditor'
import { FURNITURE_BY_ID } from '../world/furniture'
import { useFeatures } from '../world/features'
import { preloadCritical, preloadLater } from '../world/preload'
import TogetherScene from '../world/features/TogetherScene'
import Sky, { skyBase } from '../world/Sky'
import { AirportTutorialHud, AirportTutorialScene } from '../world/AirportTutorial'
import { IntroCutsceneCamera, IntroCutsceneOverlay } from '../world/IntroCutscene'
import { GIFT_BY_ID } from '../world/cosmeticsData'
import { findFreeSpot, furnitureColliders, isValid, loadHome, newUid, saveHome } from '../world/homeLayout'
import LocalPlayer from '../world/LocalPlayer'
import RemotePlayers, { GuideNpc, SelfTag } from '../world/RemotePlayers'
import { useMultiplayer } from '../world/net'
import { ChatPanel, HelpModal, Minimap, StartGuide, TopBar } from '../world/Hud'
import { ChatFab, ChatSheet, DoorPrompt, GestureChip, IncomingChip, InteractSheet, InviteChip, Joystick, MatchOverlay, NearbyCard, SkillBar } from '../world/Social'
import { GESTURE_BY_KIND, REACTIONS, SKILL_COOLDOWN_MS, WHISPER_RANGE, loadSlots, saveSlots, skillFor } from '../world/interact'
import SkillEditor from '../components/SkillEditor'
import { useIsTouch } from '../world/useIsTouch'
import { HOME_TIERS, applyHomeTier } from '../world/homeTiers'
import { bike } from '../world/bikeStore'
import { BEACH_START, HOME_DOOR, HOME_ROOM, HOME_ZONE, SPAWN, TELEPORTS, ZONES, resolveCollisions, resolveRoom, zoneAt } from '../world/layout'

const NO_ITEMS = []
const START_VENUE = 'havalimani'
const NEAR_ENTER = 4.5 // m: bu mesafeye girince "sohbet et" kartı çıkar
const NEAR_LEAVE = 6.5 // m: bu mesafeyi aşınca kart kaybolur (titremesin diye ikisi farklı)

const AVATARS = ['zeynep', 'deniz', 'elif', 'kaan', 'mira', 'ege']
const GUIDE_TIPS = [
  'Selam! Ben Rehber. Nasıl oynanır penceresi için bana tıkla ya da E / H tuşuna bas.',
  'Soldaki Gardırop düğmesiyle saç, aksesuar ve dostunu dilediğin gibi değiştirebilirsin.',
  'Sağ üstteki yuvarlak haritaya basarak Kafe, Kulüp, Park ve Plaj’a tek tıkla ışınlan.',
  'Lobinin güneybatısındaki Evim kapısından (veya /ev yazarak) evine girip döşeyebilirsin.',
  'Enter’a basıp yazarsan mesajın başının üstünde balon olur.',
  'Alttaki 1–4 tuşlarıyla selam, dans, kalp ve kutlama tepkilerini kullanabilirsin.',
]

function readAvatar() {
  try {
    return JSON.parse(localStorage.getItem('situapp_avatar'))
  } catch {
    return null
  }
}

// "Işınlan" gibi komutlardaki Türkçe karakterleri sadeleştir
const normalize = (s) => s.toLowerCase().replaceAll('ı', 'i').replaceAll('ş', 's').replaceAll('ğ', 'g').replaceAll('ü', 'u').replaceAll('ö', 'o').replaceAll('ç', 'c')

/** 3B sahne çökerse boş ekran yerine kurtarma kartı gösterir. */
class WorldErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-gradient-to-br from-[#fff2e3] via-[#f1e6ff] to-[#dff3ff] p-5">
        <div className="w-full max-w-sm rounded-[2rem] border-2 border-white bg-white/95 p-6 text-center shadow-toy">
          <div className="text-5xl">🛠️</div>
          <h2 className="mt-2 text-xl font-black text-[#4a3b5c]">Sahne yüklenirken bir sorun oluştu</h2>
          <p className="mt-1 text-sm font-semibold text-[#8a7a9c]">Sayfayı yenileyerek kaldığın yerden devam edebilirsin.</p>
          <button type="button" onClick={() => location.reload()} className="mt-4 rounded-2xl border-b-4 border-[#e8952c] bg-[#fdb252] px-5 py-2.5 text-sm font-extrabold text-white active:translate-y-[2px] active:border-b-2">
            Sayfayı yenile
          </button>
        </div>
      </div>
    )
  }
}

/** Ana sahne (şehir/oda + oyuncu) çizime hazır olunca onReady çağrılır; yalnızca ilk yüklemede kullanılır. */
function SceneReady({ onReady }) {
  useEffect(() => {
    onReady()
  }, [onReady])
  return null
}

function LoadingOverlay({ ready }) {
  const { progress } = useProgress()
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    // sahne hazır olunca (ya da 60 sn sonra, takılma olursa) kapat
    const t = setTimeout(() => setHidden(true), ready ? 250 : 60000)
    return () => clearTimeout(t)
  }, [ready])
  if (hidden) return null
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-[#fff2e3] via-[#f1e6ff] to-[#dff3ff]">
      <img
        src="/logo.png"
        alt="SituApp"
        draggable={false}
        className="h-20 w-auto select-none drop-shadow-[0_8px_18px_rgba(74,59,92,0.18)] sm:h-24"
      />
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-candy-pink/50 border-t-candy-pink-deep" />
      <p className="text-sm font-extrabold text-ink-soft">Şehir yükleniyor… %{Math.round(progress)}</p>
    </div>
  )
}

/** Oyuncunun hangi mahallede olduğunu izler; değişince bildirir. */
function ZoneWatcher({ focusRef, onChange, fixed }) {
  const last = useRef(null)
  useFrame(() => {
    const z = fixed ?? zoneAt(focusRef.current.x, focusRef.current.z)
    if (z.id !== last.current) {
      last.current = z.id
      onChange(z)
    }
  })
  return null
}

/** Kapıya yaklaşınca (şehirde ev kapısı, evde çıkış) haber verir. */
function DoorWatcher({ focusRef, door, onChange }) {
  const last = useRef(false)
  useFrame(() => {
    const f = focusRef.current
    const near = Math.hypot(f.x - door.x, f.z - door.z) < door.radius
    if (near !== last.current) {
      last.current = near
      onChange(near)
    }
  })
  return null
}

/** Şehirde bir mekânın kapısına yaklaşınca (kapı önü) o mekânın kimliğini bildirir; uzaklaşınca null. */
function VenueDoorWatcher({ focusRef, onChange }) {
  const last = useRef(null)
  useFrame(() => {
    const f = focusRef.current
    let best = null
    let bestD = Infinity
    for (const v of ENTERABLE) {
      const d = venueDoor(v.id)
      const dist = Math.hypot(f.x - d.x, f.z - d.z)
      if (dist < d.radius && dist < bestD) {
        best = v.id
        bestD = dist
      }
    }
    if (best !== last.current) {
      last.current = best
      onChange(best)
    }
  })
  return null
}

/** Yakındaki en yakın oyuncuyu izler (4 kez/sn); değişince bildirir. */
function ProximityWatcher({ focusRef, remotes, onChange }) {
  const last = useRef(null)
  const clock = useRef(0)
  useFrame((_, dt) => {
    clock.current += dt
    if (clock.current < 0.25) return
    clock.current = 0
    const f = focusRef.current
    const dist = (r) => Math.hypot(r.x - f.x, r.z - f.z)
    const kept = last.current && remotes.current.get(last.current)
    if (kept && dist(kept) < NEAR_LEAVE) return
    let best = null
    let bestD = NEAR_ENTER
    for (const r of remotes.current.values()) {
      const d = dist(r)
      if (d < bestD) {
        bestD = d
        best = r.id
      }
    }
    if (best !== last.current) {
      last.current = best
      onChange(best)
    }
  })
  return null
}

export default function World() {
  const avatar = readAvatar()
  if (!avatar?.name) return <Navigate to="/avatar" replace />
  return <WorldScene avatar={avatar} />
}

function WorldScene({ avatar }) {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const slug = AVATARS.includes(String(avatar.name).toLowerCase()) ? String(avatar.name).toLowerCase() : 'zeynep'
  const name = user?.username ?? avatar.name

  const focusRef = useRef({ x: SPAWN.x, z: SPAWN.z, ry: Math.PI, anim: 'idle', teleport: null })
  const controlsRef = useRef(null)
  const joystickRef = useRef({ x: 0, y: 0 })
  const touch = useIsTouch()
  const [nearId, setNearId] = useState(null)
  const [dismissedId, setDismissedId] = useState(null)
  const [chatTarget, setChatTarget] = useState(null) // null = kapalı, 'public' = herkese açık, aksi halde oyuncu id'si
  const chatTargetRef = useRef(null)
  const [incoming, setIncoming] = useState(null)
  // Herkes kendi evinin garajında başlar (ev = şehirden bağımsız oda). Kademe sunucudan gelene dek önbellekten.
  const tierKey = `situapp_home_tier_${user?.id ?? 'guest'}`
  const [cachedTier] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem(tierKey), 10)
      return Number.isFinite(v) ? v : 0
    } catch {
      return 0
    }
  })
  // Havalimanı çıkış salonu YALNIZCA hesap yeni açıldığında bir kez görülür (geri dönüş yok). Sunucu welcome.first ile doğrular;
  // istemci hızlı başlamak için yerel işarete bakar. Diğer herkes doğrudan parkta başlar. Ev ise ayrı bir oda (lobideki Evim kapısı).
  const seenKey = `situapp_airport_seen_${user?.id ?? name}`
  const [startAirport] = useState(() => {
    try {
      return !localStorage.getItem(seenKey)
    } catch {
      return false
    }
  })
  const [start] = useState(() => (startAirport ? { x: VENUE_ROOM.spawn[0], z: VENUE_ROOM.spawn[1] } : { x: SPAWN.x + (Math.random() - 0.5) * 4, z: SPAWN.z + Math.random() * 2 }))
  const [zone, setZone] = useState(() => (startAirport ? { id: `venue:${START_VENUE}`, name: VENUE_BY_ID[START_VENUE].name, emoji: VENUE_BY_ID[START_VENUE].emoji, desc: VENUE_BY_ID[START_VENUE].desc } : zoneAt(SPAWN.x, SPAWN.z)))
  const [home, setHome] = useState(null) // null = şehir/mekân; { owner, ownerName } = bir evin içindeyiz
  const [nearDoor, setNearDoor] = useState(false)
  const [venue, setVenue] = useState(startAirport ? START_VENUE : null) // null = şehir/ev; mekân kimliği = o mekânın içindeyiz (venues.js); yeni hesapta başlangıç: havalimanı
  const [nearVenue, setNearVenue] = useState(null) // şehirde kapısına yaklaştığımız mekân
  const venueRef = useRef(startAirport ? START_VENUE : null)
  const [fade, setFade] = useState(false)
  const [sceneReady, setSceneReady] = useState(false) // ilk yükleme bitti mi (yükleme ekranı için)
  const onSceneReady = useCallback(() => setSceneReady(true), [])
  // Havalimanı başlangıç eğitim holü: yıldız topla → örnek kapı dene → gardırop → çıkış
  const [tutStep, setTutStep] = useState('collect') // collect | door | wardrobe | exit | done
  const [tutNear, setTutNear] = useState(null)
  const [tutCelebrate, setTutCelebrate] = useState(null)
  const [introActive, setIntroActive] = useState(false)
  const finishIntro = useCallback(() => {
    setIntroActive(false)
    const c = controlsRef.current
    const f = focusRef.current
    if (c) {
      c.object.position.set(f.x, 6.4, f.z + 9.4)
      c.target.set(f.x, 0.8, f.z)
      c.update()
    }
  }, [])
  const tutOpenedWardrobe = useRef(false)
  const tutCelebTimer = useRef(null)
  const flashTutCelebrate = useCallback((msg) => {
    setTutCelebrate(msg)
    clearTimeout(tutCelebTimer.current)
    tutCelebTimer.current = setTimeout(() => setTutCelebrate(null), 2600)
  }, [])
  // sunucu konumu düzelttiyse (hız/sınır denetimi) oyuncuyu son geçerli konuma geri al
  useEffect(() => {
    const on = (e) => (focusRef.current.teleport = [e.detail.x, e.detail.z])
    window.addEventListener('situapp:snap', on)
    return () => window.removeEventListener('situapp:snap', on)
  }, [])
  useEffect(() => () => clearTimeout(tutCelebTimer.current), [])
  useMemo(() => preloadCritical(slug), [slug]) // şehir + avatar modellerini sahne çizilmeden paralel indir (şelale yüklemeyi önler)
  useEffect(() => {
    if (sceneReady) preloadLater()
  }, [sceneReady])
  // ev düzeni: kendi evin sunucuda kalıcıdır, tarayıcıdaki kopya yalnızca önbellektir
  const homeOwner = user?.id ?? `guest-${name}`
  const [furn, setFurn] = useState(() => loadHome(homeOwner))
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState(null)
  const [invite, setInvite] = useState(null) // { owner, ownerName }: biri seni evine çağırdı
  const [gestureIn, setGestureIn] = useState(null) // biri sana jest yaptı: { id, name, kind, emoji, avatar }
  const [match, setMatch] = useState(null) // karşılıklı kalp: { id, name, avatar }
  const [interactId, setInteractId] = useState(null) // etkileşim menüsü açık olan oyuncu
  const [, setTick] = useState(0)
  const [panel, setPanel] = useState(null) // açık panel: 'settings' | özellik panelleri
  const synced = useRef(null) // sunucuyla en son eşleşen düzen (JSON); değişmediyse tekrar yollama
  const [help, setHelp] = useState(false)
  const [nearGuide, setNearGuide] = useState(false)
  const nearGuideRef = useRef(false)
  const tipsKey = `situapp_tips_seen_${user?.id ?? 'guest'}`
  const [showTips, setShowTips] = useState(() => !localStorage.getItem(tipsKey))
  const [feed, setFeed] = useState(() => [
    { kind: 'system', ts: 0, text: `Hoş geldin ${name}! 🌳` },
  ])

  const addFeed = useCallback((m) => {
    setFeed((f) => [...f, { kind: 'chat', ...m }].slice(-100))
    // başkasından özel mesaj geldi ve o sohbet açık değilse bildirim göster
    if ((m.dm || m.whisper) && !m.self && chatTargetRef.current !== m.id) setIncoming({ id: m.id, name: m.name, text: m.text, whisper: Boolean(m.whisper) })
  }, [])
  const say = useCallback((text) => setFeed((f) => [...f, { kind: 'system', ts: Date.now(), text }].slice(-100)), [])
  // Şehir ↔ ev geçişi: ekran kısa süre kararır, sonra oyuncu yeni yere ışınlanır.
  const swapScene = useCallback((target) => {
    setFade(true)
    setEditing(false)
    setSelected(null)
    setTimeout(() => {
      setNearDoor(false)
      setVenue(null)
      venueRef.current = null
      if (target === 'city') {
        setHome(null)
        // Konut Mahallesi kapısından girildiyse o kapının önüne, aksi halde lobideki Evim kapısına dön
        focusRef.current.teleport = [HOME_DOOR.x, HOME_DOOR.z, Math.PI / 2] // evden çıkınca lobideki Evim kapısına dön
      } else {
        setHome(target)
        if (target?.isOwn) setEditing(true)
        focusRef.current.teleport = [HOME_ROOM.spawn[0], HOME_ROOM.spawn[1], Math.PI]
      }
      setTimeout(() => setFade(false), 120)
    }, 220)
  }, [])

  // Şehir ↔ mekân geçişi (ev geçişinin paralelidir). Girerken kamera güneye sıfırlanır (oyuncak evi kesiti).
  const swapVenue = useCallback((target) => {
    const from = venueRef.current
    setFade(true)
    setEditing(false)
    setSelected(null)
    setTimeout(() => {
      setNearDoor(false)
      setNearVenue(null)
      if (target === 'city') {
        venueRef.current = null
        setVenue(null)
        if (from === START_VENUE) {
          try {
            localStorage.setItem(seenKey, '1')
          } catch {
            /* önemli değil */
          }
          setIntroActive(true)
        }
        const d = from && venueDoor(from)
        focusRef.current.teleport = d ? d.exit : from === START_VENUE ? [BEACH_START.x, BEACH_START.z, BEACH_START.ry] : [SPAWN.x, SPAWN.z, Math.PI] // havalimanından çıkış: kumsal
      } else {
        venueRef.current = target
        setHome(null)
        setVenue(target)
        const [sx, sz] = VENUE_ROOM.spawn
        focusRef.current.teleport = [sx, sz, Math.PI]
        setTimeout(() => {
          const c = controlsRef.current
          if (!c) return
          c.object.position.set(sx, 6.4, sz + 9.4)
          c.target.set(sx, 0.8, sz)
          c.update()
        }, 60)
      }
      setTimeout(() => setFade(false), 160)
    }, 220)
  }, [seenKey])

  // Başkasının evine girerken sahne, sunucu izin verince ('room' mesajı) değişir; reddedilirse olduğun yerde kalırsın.
  const visitPending = useRef(false)
  const onRoom = useCallback(
    (m) => {
      if (!visitPending.current || !m.owner) return
      visitPending.current = false
      swapScene({ owner: m.owner, ownerName: m.ownerName })
    },
    [swapScene],
  )
  const onDenied = useCallback(
    (text) => {
      visitPending.current = false
      say(text)
    },
    [say],
  )
  const onGesture = useCallback(
    (m) => {
      setGestureIn(m)
      const g = GESTURE_BY_KIND[m.kind]
      say(`${m.emoji} ${m.name} ${g?.text ?? 'sana bir jest yaptı'}.`)
    },
    [say],
  )
  const onMatch = useCallback(
    (m) => {
      setMatch(m)
      setGestureIn(null)
      say(`💞 ${m.name} ile eşleştiniz!`)
    },
    [say],
  )
  const net = useMultiplayer({ name, avatar: slug, onChat: addFeed, onDenied, onInfo: say, onInvited: setInvite, onRoom, onGesture, onMatch, startRoom: startAirport ? { to: 'venue', id: START_VENUE } : null })

  useEffect(() => {
    const on = (e) => net.send({ t: 'tp', zone: e.detail })
    window.addEventListener('situapp:tp', on)
    return () => window.removeEventListener('situapp:tp', on)
  }, [net])

  const goTo = useCallback(
    (target) => {
      swapScene(target)
      net.enterRoom(target === 'city' ? 'city' : { owner: target.owner })
    },
    [net, swapScene],
  )
  const visit = useCallback(
    (owner) => {
      setInvite(null)
      visitPending.current = true
      if (!net.enterRoom({ owner })) {
        visitPending.current = false
        say('Şu an çevrimdışısın, ziyaret edemezsin.')
      }
    },
    [net, say],
  )
  const enterVenue = useCallback(
    (id) => {
      if (!VENUE_BY_ID[id]) return
      swapVenue(id)
      net.enterRoom({ venue: id })
    },
    [net, swapVenue],
  )
  const leaveVenue = useCallback(() => {
    swapVenue('city')
    net.enterRoom('city')
  }, [net, swapVenue])
  // sunucu hesabın yeni olup olmadığını söyler (welcome.first): havalimanı yalnızca yeni hesapta
  const airportChecked = useRef(false)
  useEffect(
    () =>
      net.on('welcome', (m) => {
        if (airportChecked.current) return
        airportChecked.current = true
        if (m.first && !venueRef.current) enterVenue(START_VENUE)
        else if (!m.first && venueRef.current === START_VENUE) leaveVenue()
      }),
    [net, enterVenue, leaveVenue],
  )
  const ownHome = useCallback(() => ({ owner: net.homeKey ?? undefined, ownerName: name, isOwn: true }), [net.homeKey, name])
  const doorGo = useCallback(() => (venue ? leaveVenue() : goTo(home ? 'city' : ownHome())), [goTo, home, ownHome, venue, leaveVenue])

  const isOwnHome = Boolean(home) && (!home.owner || home.owner === net.homeKey)
  // ev odasının ölçüsü kademeye göre (kendi evim: sunucudan; ziyaretteyken sahibinin kademesi)
  const roomTier = home ? (isOwnHome ? (net.homeTier ?? cachedTier) : (net.visit?.tier ?? 1)) : null
  if (home) applyHomeTier(roomTier)
  const gotTier = useRef(false)
  useEffect(() => {
    if (net.homeTier == null) return
    try {
      localStorage.setItem(tierKey, String(net.homeTier))
    } catch {
      /* önbellek yazılamazsa sorun değil */
    }
    if (gotTier.current) return
    gotTier.current = true
    if (net.homeTier !== cachedTier) focusRef.current.teleport = [HOME_ROOM.spawn[0], HOME_ROOM.spawn[1], Math.PI] // önbellek yanlıştıysa doğru kapı önüne
  }, [net.homeTier, tierKey, cachedTier])
  const maxItems = HOME_TIERS[Math.max(0, Math.min(HOME_TIERS.length - 1, net.homeTier ?? cachedTier))].max
  const shownItems = !home ? NO_ITEMS : isOwnHome ? furn : (net.visit?.items ?? NO_ITEMS)
  const furnColliders = useMemo(() => furnitureColliders(shownItems), [shownItems])

  // sunucudaki evim: bağlanınca (ve yeniden bağlanınca) onu al; sunucuda yoksa buradakini yükle
  const editingRef = useRef(false)
  useEffect(() => {
    editingRef.current = editing
  }, [editing])
  const sync = net.homeSync
  useEffect(() => {
    if (!sync || editingRef.current) return
    if (sync.items) {
      synced.current = JSON.stringify(sync.items)
      setFurn(sync.items)
    } else if (furn.length && net.saveHome(furn)) synced.current = JSON.stringify(furn)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync?.n])
  // düzen değişince: önbelleğe yaz, kısa beklemeyle sunucuya yolla (sunucudakiyle aynıysa yollama)
  useEffect(() => {
    saveHome(homeOwner, furn)
    const json = JSON.stringify(furn)
    if (synced.current === null) synced.current = json // ilk açılış: henüz sunucuyla eşleşmedik, yollama
    if (json === synced.current) return
    const t = setTimeout(() => {
      if (net.saveHome(furn)) synced.current = json
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeOwner, furn])

  // extra: hediye yerleştirirken { uid, from } (hediyeler envanterden gelir, features/cosmetics)
  const addFurn = (id, extra) => {
    if (furn.length >= maxItems) return say(`Bu evde en fazla ${maxItems} eşya olur. Evini büyütürsen daha fazla koyabilirsin 🏡`)
    if (extra?.uid && furn.some((i) => i.uid === extra.uid)) return say('Bu hediye zaten odada.')
    const spot = findFreeSpot(furn, id)
    if (!spot) return say('Odada boş yer kalmadı 🛋️')
    const uid = extra?.uid ?? newUid()
    setFurn((l) => [...l, { uid, id, x: spot.x, z: spot.z, ry: 0, ...(extra?.from ? { from: extra.from } : {}) }])
    setSelected(uid)
  }
  const rotateFurn = () => {
    const next = furn.map((i) => (i.uid === selected ? { ...i, ry: (i.ry + Math.PI / 2) % (Math.PI * 2) } : i))
    if (!isValid(next, selected)) return say('Burada dönmeye yer yok.')
    setFurn(next)
  }
  const removeFurn = () => {
    setFurn((l) => l.filter((i) => i.uid !== selected))
    setSelected(null)
  }
  const stopEditing = () => {
    setEditing(false)
    setSelected(null)
  }

  const openChat = useCallback((target) => {
    chatTargetRef.current = target
    setChatTarget(target)
    setIncoming(null)
  }, [])
  const closeChat = useCallback(() => openChat(null), [openChat])
  const peerOf = (id) => net.roster.find((p) => p.id === id)
  const nearPeer = nearId && nearId !== dismissedId && chatTarget !== nearId ? peerOf(nearId) : null
  const sheetPeer = chatTarget && chatTarget !== 'public' ? peerOf(chatTarget) : null

  // ---- etkileşim: jest, fısıltı, tepki ----
  const interactPeer = interactId ? peerOf(interactId) : null
  const distTo = (id) => {
    const r = net.remotes.current.get(id)
    return r ? Math.hypot(r.x - focusRef.current.x, r.z - focusRef.current.z) : Infinity
  }
  // menü ya da özel sohbet açıkken "yakında mı / yazıyor mu" bilgisi için yarım saniyede bir yenile
  const liveUi = Boolean(interactPeer || sheetPeer)
  useEffect(() => {
    if (!liveUi) return
    const t = setInterval(() => setTick((n) => n + 1), 500)
    return () => clearInterval(t)
  }, [liveUi])
  useEffect(() => {
    if (interactId && !net.roster.some((p) => p.id === interactId)) setInteractId(null) // karşı taraf ayrıldı/oda değişti
  }, [interactId, net.roster])
  const feat = useFeatures({
    net,
    name,
    say,
    touch,
    roster: net.roster,
    focusRef,
    home,
    homeItems: isOwnHome ? furn : null,
    venue,
    atDoor: Boolean(nearDoor || (!home && !venue && nearVenue)),
    panel,
    setPanel,
    chatTarget,
    openChat: (id) => openChat(id),
    closeInteract: () => setInteractId(null),
    slug,
    pushFeed: addFeed,
    enterHome: (owner) => (owner === net.homeKey ? goTo(ownHome()) : visit(owner)), // Konut Mahallesi kapıları
  })
  useEffect(() => {
    const onVisit = (e) => { if (e.detail) visit(e.detail) }
    window.addEventListener('situapp:visit-home', onVisit)
    return () => window.removeEventListener('situapp:visit-home', onVisit)
  }, [visit])
  const venueTh = useMemo(() => (venue ? venueTheme(venue) : null), [venue])
  const venueDim = venueTh?.dim ?? 0
  const sceneBase = useMemo(
    () => (venueTh ? { bg: venueTh.bg, fog: [venueTh.bg, 30, 60] } : home ? { bg: '#faeee2', fog: ['#faeee2', 30, 60] } : { bg: '#dcf0ff', fog: ['#dcf0ff', 45, 122] }),
    [venueTh, home],
  )
  const venueCollide = useMemo(() => (venue ? (x, z) => resolveVenueRoom(x, z, venueLayout(venue).colliders) : null), [venue])
  const venueZone = useMemo(() => (venue ? { id: `venue:${venue}`, name: VENUE_BY_ID[venue].name, emoji: VENUE_BY_ID[venue].emoji, desc: VENUE_BY_ID[venue].desc } : undefined), [venue])
  const sendGesture = (kind) => {
    if (!interactPeer) return
    if (!net.sendGesture(interactPeer.id, kind)) say('Şu an çevrimdışısın.')
    else window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: kind }))
  }
  const sendWhisper = (text) => {
    if (!interactPeer) return
    if (!net.sendWhisper(text, interactPeer.id)) say('Şu an çevrimdışısın.')
  }
  const react = useCallback((e) => net.sendReact(e), [net])
  const reactRef = useRef(react)
  const [slots, setSlots] = useState(loadSlots) // beceri çubuğu 4 yuvası (ifadeler; sürükle-bırakla değişir)
  const [skillEdit, setSkillEdit] = useState(false)
  const skillList = useMemo(() => slots.map((e, i) => skillFor(e, i)), [slots])
  const skillListRef = useRef(skillList)
  skillListRef.current = skillList
  const changeSlots = useCallback((next) => {
    setSlots(next)
    saveSlots(next)
  }, [])
  const [skillCd, setSkillCd] = useState({})
  const skillCdRef = useRef({})
  const soloDanceTimer = useRef(null)
  useEffect(() => () => clearTimeout(soloDanceTimer.current), [])
  const triggerSkill = useCallback(
    (sk) => {
      const now = Date.now()
      if ((skillCdRef.current[sk.id] ?? 0) > now) return
      const next = { ...skillCdRef.current, [sk.id]: now + SKILL_COOLDOWN_MS }
      skillCdRef.current = next
      setSkillCd(next)
      react(sk.emoji)
      window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: sk.sfx }))
      if (sk.pose && !bike.on && (!together.self.current || together.self.current.solo)) {
        together.self.current = { kind: sk.pose, lead: true, ry: focusRef.current.ry, t0: performance.now() / 1000, solo: true }
        clearTimeout(soloDanceTimer.current)
        soloDanceTimer.current = setTimeout(() => {
          if (together.self.current?.solo) together.self.current = null
        }, sk.dur ?? 2400)
      }
    },
    [react],
  )
  const skillRef = useRef(triggerSkill)
  useEffect(() => {
    reactRef.current = react
    skillRef.current = triggerSkill
  }, [react, triggerSkill])

  // sohbet ettiğin oyuncu ayrılırsa çekmeceyi kapat
  useEffect(() => {
    if (chatTarget && chatTarget !== 'public' && !net.roster.some((p) => p.id === chatTarget)) openChat(null)
  }, [chatTarget, net.roster, openChat])

  // geliştirme: konsoldan oyuncu konumunu okuyabilmek için
  useEffect(() => {
    if (!import.meta.env.DEV) return
    if (import.meta.env.DEV) window.__focus = focusRef // yalnızca geliştirmede (üretimde konsoldan erişim yok)
    return () => {
      if (import.meta.env.DEV) delete window.__focus
    }
  }, [])

  const inTutorial = venue === START_VENUE && tutStep !== 'done'
  const onTutCollect = useCallback(() => {
    if (tutStep !== 'collect') return
    setTutNear(null)
    window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'collect' }))
    flashTutCelebrate('⭐ Süper! Eşyaları hep E ile toplarsın (1/4)')
    setTutStep('door')
  }, [tutStep, flashTutCelebrate])
  const onTutDoor = useCallback(() => {
    if (tutStep !== 'door' || fade) return
    setTutNear(null)
    setFade(true)
    window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'quest' }))
    setTimeout(() => {
      setFade(false)
      setTutStep('wardrobe')
      flashTutCelebrate('🚪 Harika! Soldaki 👗 Gardırop açıldı! (2/4)')
    }, 420)
  }, [tutStep, fade, flashTutCelebrate])
  useEffect(() => {
    if (!inTutorial || tutStep !== 'wardrobe') return
    if (panel === 'wardrobe') {
      tutOpenedWardrobe.current = true
    } else if (panel === null && tutOpenedWardrobe.current) {
      tutOpenedWardrobe.current = false
      window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'quest' }))
      flashTutCelebrate('👗 Çok şık! Şimdi çıkış kapısından şehre çık (3/4)')
      setTutStep('exit')
    }
  }, [inTutorial, tutStep, panel, flashTutCelebrate])

  const editKeysRef = useRef({ on: false, rotate: () => {}, remove: () => {} })
  useEffect(() => {
    editKeysRef.current = { on: editing && Boolean(selected), rotate: rotateFurn, remove: removeFurn }
  })
  const nearDoorRef = useRef(false)
  const doorGoRef = useRef(() => {})
  const nearVenueRef = useRef(null)
  const enterVenueRef = useRef(() => {})
  const tutActionRef = useRef(null)
  useEffect(() => {
    nearDoorRef.current = nearDoor && !fade && !(inTutorial && tutStep !== 'exit') // eğitim bitmeden havalimanından çıkılmaz
    doorGoRef.current = doorGo
    nearVenueRef.current = !fade && !home && !venue && !nearDoor ? nearVenue : null
    enterVenueRef.current = enterVenue
    nearGuideRef.current = !fade && !home && !venue && !nearDoor && !nearVenue && nearGuide
    tutActionRef.current = inTutorial && !fade ? (tutNear === 'collect' && tutStep === 'collect' ? onTutCollect : tutNear === 'door' && tutStep === 'door' ? onTutDoor : null) : null
  }, [nearDoor, fade, doorGo, nearVenue, home, venue, enterVenue, nearGuide, inTutorial, tutNear, tutStep, onTutCollect, onTutDoor])

  // H tuşu: yardım, M tuşu: harita, Esc: açık pencereyi kapat, E: kapı / eğitim etkileşimi
  useEffect(() => {
    const onKey = (e) => {
      const typing = e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)
      if (e.code === 'Escape' && !typing) {
        setHelp(false)
        setPanel(null)
        setInteractId(null)
        return
      }
      if (e.code === 'KeyH' && !typing) setHelp((h) => !h)
      if (e.code === 'KeyM' && !typing) window.dispatchEvent(new CustomEvent('situapp:toggle-map'))
      if (e.code === 'KeyE' && !typing && tutActionRef.current) tutActionRef.current()
      else if (e.code === 'KeyE' && !typing && nearDoorRef.current) doorGoRef.current()
      else if (e.code === 'KeyE' && !typing && nearVenueRef.current && !together.self.current) enterVenueRef.current(nearVenueRef.current)
      else if (e.code === 'KeyE' && !typing && nearGuideRef.current) setHelp(true)
      if (!typing && /^Digit[0-9]$/.test(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const n = Number(e.code.slice(5))
        if (n >= 1 && n <= 4) {
          skillRef.current(skillListRef.current[n - 1])
        } else {
          const emoji = REACTIONS[(n + 9) % 10]
          if (emoji) reactRef.current(emoji)
        }
      }
      if (typing || !editKeysRef.current.on) return
      if (e.code === 'KeyR') editKeysRef.current.rotate()
      if (e.code === 'Delete' || e.code === 'Backspace') editKeysRef.current.remove()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const closeTips = useCallback(() => {
    localStorage.setItem(tipsKey, '1')
    setShowTips(false)
  }, [tipsKey])

  const runCommand = (text) => {
    const [raw, ...args] = text.slice(1).trim().split(/\s+/)
    const cmd = normalize(raw ?? '')
    if (['yardim', 'help', 'h'].includes(cmd)) return setHelp(true)
    if (cmd === 'mekanlar') {
      ZONES.forEach((z) => say(`${z.emoji} ${z.name} — ${z.desc}`))
      return
    }
    if (cmd === 'yakindakiler') {
      const f = focusRef.current
      const near = [...net.remotes.current.values()]
        .map((r) => ({ name: r.name, d: Math.hypot(r.x - f.x, r.z - f.z) }))
        .filter((r) => r.d < 15)
        .sort((a, b) => a.d - b.d)
      say(near.length ? `Yakınındakiler: ${near.map((r) => `${r.name} (${Math.round(r.d)} m)`).join(', ')}` : 'Yakınında kimse yok. Kafe veya Kulüp’e uğrayabilirsin!')
      return
    }
    if (['ev', 'eve'].includes(cmd)) {
      if (home) return say('Zaten evdesin 🏠')
      if (venue) return say('Önce dışarı çık: /dışarı')
      goTo(ownHome())
      return say('🏠 Evine girdin.')
    }
    if (['disari', 'cik', 'sehir'].includes(cmd)) {
      if (venue) {
        leaveVenue()
        return say('Şehre döndün.')
      }
      if (!home) return say('Zaten dışarıdasın 🌳')
      goTo('city')
      return say('Şehre döndün.')
    }
    if (['f', 'fisilda', 'fisilti'].includes(cmd)) {
      const [who, ...rest] = args
      const msg = rest.join(' ').trim()
      if (!who || !msg) return say('Örnek: /f Elif Bugün çok güzelsin 🤫')
      const peer = net.roster.find((p) => normalize(p.name) === normalize(who)) ?? net.roster.find((p) => normalize(p.name).startsWith(normalize(who)))
      if (!peer) return say(`“${who}” burada yok. Fısıldamak için aynı yerde ve yakın olmalısınız.`)
      if (distTo(peer.id) > WHISPER_RANGE) return say(`🤫 ${peer.name} çok uzakta. Fısıldamak için biraz yaklaş.`)
      if (!net.sendWhisper(msg, peer.id)) say('Şu an çevrimdışısın.')
      return
    }
    if (['ayarlar', 'ayar'].includes(cmd)) return setPanel('settings')
    if (['gardirop', 'kiyafet'].includes(cmd)) return setPanel('wardrobe')
    if (cmd === 'engelle') {
      const who = args.join(' ')
      const peer = net.roster.find((p) => normalize(p.name) === normalize(who))
      if (!who) return say('Kimi? Örnek: /engelle Elif (yakınındakiler için). Listeyi Ayarlar’dan yönet.')
      if (!peer) return say(`“${who}” burada yok. Karakterine tıklayıp menüden de engelleyebilirsin.`)
      net.block(peer.id)
      return
    }
    if (cmd === 'davet') {
      const who = args.join(' ')
      if (!who) return say('Kimi? Örnek: /davet Elif')
      net.invite({ name: who })
      return
    }
    if (['ziyaret', 'misafir'].includes(cmd)) {
      const who = args.join(' ')
      if (!who) return say('Kimin evine? Örnek: /ziyaret Elif')
      visit(who)
      return
    }
    if (cmd === 'kapi') {
      const open = ['ac', 'acik'].includes(normalize(args[0] ?? ''))
      const close = ['kapat', 'kapali'].includes(normalize(args[0] ?? ''))
      if (!open && !close) return say('Örnek: /kapı aç (herkes gelebilir) ya da /kapı kapat (yalnızca davetliler)')
      net.setHomeOpen(open)
      return
    }
    if (['intro', 'arasahne'].includes(cmd)) {
      if (home || venue) return say('Ara sahneyi izlemek için önce şehirde olmalısın: /dışarı')
      focusRef.current.teleport = [BEACH_START.x, BEACH_START.z, BEACH_START.ry]
      setIntroActive(true)
      return
    }
    if (['isinlan', 'tp', 'git'].includes(cmd)) {
      if (home || venue) return say('Işınlanmak için önce dışarı çık: /dışarı')
      const id = TELEPORTS[normalize(args[0] ?? '')] ?? TELEPORTS[(args[0] ?? '').toLowerCase()]
      const z = ZONES.find((zn) => zn.id === id)
      if (!z) return say('Nereye? Örnek: /ışınlan kafe — lobi, kafe, kulüp, park, plaj')
      window.dispatchEvent(new CustomEvent('situapp:tp', { detail: z.id }))
      focusRef.current.teleport = z.spawn
      return say(`${z.emoji} ${z.name}’a ışınlandın.`)
    }
    say('Bilinmeyen komut. /yardım yazarak komutları görebilirsin.')
  }

  const onSheetSend = (text) => {
    if (!sheetPeer) return onSend(text)
    if (!net.sendChat(text, sheetPeer.id)) say('Şu an çevrimdışısın, mesaj gönderilemedi.')
  }

  const onSend = (text) => {
    if (text.startsWith('/')) return runCommand(text)
    if (!net.sendChat(text)) say('Şu an çevrimdışısın, mesaj gönderilemedi.')
  }

  return (
    <div className="fixed inset-0 touch-none select-none overflow-hidden bg-[#cfeaff]">
      <WorldErrorBoundary>
      <Canvas
        shadows={PCFShadowMap}
        dpr={[1, 1.15]}
        gl={{ powerPreference: 'high-performance' }}
        camera={{ fov: 55, near: 0.3, far: 300, position: [start.x, 6.4, start.z + 9.4] }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault()
            say('⚠️ Grafik bağlantısı kesildi, sahne toparlanıyor…')
          })
        }}
      >
        <color attach="background" args={[sceneBase.bg]} />
        <fog attach="fog" args={sceneBase.fog} />
        <Sky home={Boolean(home)} interior={venueTh ? { bg: venueTh.bg, fog: sceneBase.fog, dim: venueDim } : null} focusRef={focusRef} />

        <TogetherScene focusRef={focusRef} home={Boolean(home || venue)} base={skyBase} />
        <Suspense fallback={null}>
          {venue ? (
            <Venue id={venue} />
          ) : home ? (
            <HomeRoom
              key={`room-${roomTier}`}
              tier={roomTier}
              ownerName={home.ownerName}
              decor={feat.homeDecor}
              garden={feat.garden}
              landTier={feat.landTier}
              isOwnHome={isOwnHome}
              onPlotClick={feat.onPlotClick}
              onOpenHomeUpgrade={() => setPanel('housing')}
              onOpenLand={feat.onOpenLand}
            >
              <FurnitureLayer items={shownItems} setItems={setFurn} editing={editing && isOwnHome} selected={selected} setSelected={setSelected} controlsRef={controlsRef} />
            </HomeRoom>
          ) : (
            <City focusRef={focusRef} />
          )}
          <LocalPlayer
            slug={slug}
            start={start}
            focusRef={focusRef}
            controlsRef={controlsRef}
            joystickRef={joystickRef}
            onMove={net.sendMove}
            camOffset={[6.4, 9.4]}
            locked={introActive}
            collide={venue ? venueCollide : home ? (x, z) => resolveRoom(x, z, furnColliders) : resolveCollisions}
          >
            <SelfTag name={name} bubbles={net.bubbles} selfId={net.selfId} reactions={net.reactions} />
          </LocalPlayer>
          <SceneReady onReady={onSceneReady} />
        </Suspense>
        {/* Geri kalan her katman kendi yükleme bölgesinde: model gelmeyi beklerken şehir/oyuncu çizilmeye devam eder */}
        <Suspense fallback={null}>
          <RemotePlayers roster={net.roster} remotes={net.remotes} bubbles={net.bubbles} reactions={net.reactions} whispering={net.whispering} onPick={(id) => { setChatTarget(null); chatTargetRef.current = null; setInteractId(id) }} />
        </Suspense>
        {!home && !venue && (
          <Suspense fallback={null}>
            <GuideNpc focusRef={focusRef} tips={GUIDE_TIPS} onOpen={() => setHelp(true)} onNear={setNearGuide} />
          </Suspense>
        )}
        {feat.sceneNodes}
        {feat.worldEffects}
        {inTutorial && <AirportTutorialScene step={tutStep} focusRef={focusRef} onNear={setTutNear} />}
        <IntroCutsceneCamera active={introActive} focusRef={focusRef} controlsRef={controlsRef} camOffset={[6.4, 9.4]} onDone={finishIntro} />

        <ZoneWatcher key={home ? 'home' : venue ? `v-${venue}` : 'city'} focusRef={focusRef} onChange={setZone} fixed={home ? HOME_ZONE : venueZone} />
        <DoorWatcher key={`door-${home ? `home${roomTier}` : venue ? 'venue' : 'city'}`} focusRef={focusRef} door={home ? HOME_ROOM.exit : venue ? VENUE_ROOM.exit : HOME_DOOR} onChange={setNearDoor} />
        {!home && !venue && <VenueDoorWatcher focusRef={focusRef} onChange={setNearVenue} />}
        <ProximityWatcher
          focusRef={focusRef}
          remotes={net.remotes}
          onChange={(id) => {
            setNearId(id)
            if (!id) setDismissedId(null) // uzaklaşınca bir sonraki yaklaşmada kart yine çıksın
          }}
        />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enabled={!introActive}
          enablePan={false}
          enableDamping
          dampingFactor={0.12}
          rotateSpeed={touch ? 0.85 : 1}
          target={[start.x, 0.8, start.z]}
          minDistance={3.5}
          maxDistance={home ? 10 : 11}
          minPolarAngle={0.35}
          maxPolarAngle={Math.PI / 2.15}
        />
      </Canvas>
      </WorldErrorBoundary>

      {(net.status === 'noguard') && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-white px-5" role="alertdialog">
          <div className="w-full max-w-sm rounded-[2rem] border-2 border-white bg-white p-6 text-center shadow-toy">
            <div className="text-5xl">🛡️</div>
            <h2 className="mt-2 text-xl font-black text-ink">Güvenlik doğrulanamadı</h2>
            <p className="mt-1 text-sm font-semibold text-ink-soft">Sunucunun hile koruması doğrulanamadığı için oyun yüklenmedi. Biraz sonra tekrar dene.</p>
          </div>
        </div>
      )}

      {(net.status === 'kicked' || net.status === 'auth' || net.status === 'banned') && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-white/70 px-5 backdrop-blur-sm" role="alertdialog">
          <div className="w-full max-w-sm rounded-[2rem] border-2 border-white bg-white p-6 text-center shadow-toy">
            <div className="text-5xl">{net.status === 'kicked' ? '🔌' : net.status === 'banned' ? '⛔' : '🔑'}</div>
            <h2 className="mt-2 text-xl font-black text-ink">{net.status === 'kicked' ? 'Hesabın başka yerde açıldı' : net.status === 'banned' ? 'Hesabın yasaklandı' : 'Oturumun geçersiz'}</h2>
            <p className="mt-1 text-sm font-semibold text-ink-soft">
              {net.status === 'kicked' ? 'Aynı hesapla yalnızca tek yerden oynanabilir. Burada devam etmek için sayfayı yenile.' : net.status === 'banned' ? 'Oyunun kurallarına aykırı davranış (hile/otomasyon) algılandı. İtirazın için geri bildirim gönderebilirsin.' : 'Devam etmek için yeniden giriş yapmalısın.'}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              {net.status === 'kicked' && (
                <button type="button" onClick={() => location.reload()} className="rounded-2xl bg-candy-pink px-4 py-2 text-sm font-extrabold text-ink shadow-soft">
                  Yeniden bağlan
                </button>
              )}
              <button type="button" onClick={() => signOut()} className="rounded-2xl bg-candy-lilac/60 px-4 py-2 text-sm font-extrabold text-ink shadow-soft">
                Çıkış yap
              </button>
            </div>
          </div>
        </div>
      )}
      {!introActive && (
        <TopBar
          zone={zone}
          online={net.online}
          status={net.status}
          dnd={net.dnd}
          onSettings={() => setPanel('settings')}
          extraButtons={
            inTutorial
              ? tutStep === 'wardrobe' || tutStep === 'exit'
                ? feat.extraButtons.filter((b) => b.key === 'wardrobe').map((b) => ({ ...b, highlight: tutStep === 'wardrobe' }))
                : []
              : feat.extraButtons
          }
          extraNodes={feat.extraNodes}
          menuNodes={feat.menuNodes}
          menuBadge={feat.menuBadge}
          onExit={() => navigate('/avatar')}
          onHelp={() => setHelp(true)}
        />
      )}
      {!introActive && !home && !venue && <Minimap focusRef={focusRef} remotes={net.remotes} compact={touch} />}
      {!introActive && (touch ? (
        <>
          <Joystick inputRef={joystickRef} />
          {!chatTarget && !editing && <ChatFab onClick={() => openChat('public')} />}
        </>
      ) : (
        <>
          {chatTarget !== 'public' && !sheetPeer && !editing && <ChatPanel feed={feed} onSend={onSend} status={net.status} />}
        </>
      ))}
      <DockSlot />
      {skillEdit && <SkillEditor slots={slots} onChange={changeSlots} onClose={() => setSkillEdit(false)} />}
      <TopDockSlot />
      {!introActive && !editing && !chatTarget && !interactPeer && (
        <>
          <SkillBar xp={feat.xp} cooldowns={skillCd} slots={skillList} onEdit={() => setSkillEdit(true)} onSkill={triggerSkill} onOpenExp={() => setPanel('collection')} touch={touch} />
        </>
      )}
      {nearPeer && !chatTarget && !interactPeer && (
        <NearbyCard peer={nearPeer} touch={touch} onChat={() => openChat(nearPeer.id)} onInteract={() => setInteractId(nearPeer.id)} onDismiss={() => setDismissedId(nearPeer.id)} />
      )}
      {interactPeer && !chatTarget && (
        <InteractSheet
          peer={interactPeer}
          near={distTo(interactPeer.id) <= WHISPER_RANGE - 0.2}
          canInvite={!home}
          touch={touch}
          extras={feat.peerActions(interactPeer)}
          header={feat.peerHeader(interactPeer)}
          onClose={() => setInteractId(null)}
          onChat={() => {
            setInteractId(null)
            openChat(interactPeer.id)
          }}
          onGesture={sendGesture}
          onWhisper={sendWhisper}
          onInvite={() => net.invite({ to: interactPeer.id })}
        />
      )}
      {gestureIn && !match && !chatTarget && !interactPeer && peerOf(gestureIn.id) && (
        <GestureChip
          from={gestureIn}
          onBack={() => {
            net.sendGesture(gestureIn.id, gestureIn.kind)
            setGestureIn(null)
          }}
          onChat={() => {
            const id = gestureIn.id
            setGestureIn(null)
            openChat(id)
          }}
          onClose={() => setGestureIn(null)}
        />
      )}
      {home && isOwnHome && !editing && !chatTarget && <EditToggle touch={touch} onClick={() => setEditing(true)} />}
      {home && isOwnHome && editing && (
        <FurnitureSheet
          count={furn.length}
          max={maxItems}
          selected={selected}
          selectedName={(FURNITURE_BY_ID[furn.find((i) => i.uid === selected)?.id] ?? GIFT_BY_ID[furn.find((i) => i.uid === selected)?.id])?.name}
          onAdd={addFurn}
          tabs={feat.editorTabs}
          tabApi={{ furn, place: addFurn }}
          onRotate={rotateFurn}
          onRemove={removeFurn}
          onClose={stopEditing}
        />
      )}
      {nearDoor && !(inTutorial && tutStep !== 'exit') && !chatTarget && !fade && (
        <DoorPrompt emoji={home || venue ? '🚪' : '🏠'} label={home || venue ? 'Dışarı çık' : 'Evine gir'} action={home || venue ? 'Çık' : 'Gir'} touch={touch} raised={Boolean(nearPeer || editing)} onGo={doorGo} />
      )}
      {!home && !venue && !nearDoor && nearVenue && !chatTarget && !fade && !editing && (
        <DoorPrompt emoji={VENUE_BY_ID[nearVenue].emoji} label={VENUE_BY_ID[nearVenue].name} action="Gir" touch={touch} raised={Boolean(nearPeer)} onGo={() => enterVenue(nearVenue)} />
      )}
      {!home && !venue && !nearDoor && !nearVenue && nearGuide && !help && !chatTarget && !fade && !editing && (
        <DoorPrompt label="Rehber · Nasıl Oynanır" action="Aç" touch={touch} raised={Boolean(nearPeer)} onGo={() => setHelp(true)} />
      )}
      {invite && !chatTarget && !editing && <InviteChip from={invite} onGo={() => visit(invite.owner)} onClose={() => setInvite(null)} />}
      {incoming && !chatTarget && !interactPeer && !gestureIn && peerOf(incoming.id) && (
        <IncomingChip from={incoming} onOpen={() => openChat(incoming.id)} onClose={() => setIncoming(null)} />
      )}
      {chatTarget && (chatTarget === 'public' || sheetPeer) && (
        <ChatSheet
          peer={sheetPeer}
          feed={feed}
          onSend={onSheetSend}
          onClose={closeChat}
          touch={touch}
          typing={sheetPeer ? (net.typing.current.get(sheetPeer.id) ?? 0) > Date.now() : false}
          onTyping={net.sendTyping}
          readUpTo={sheetPeer ? (feat.readAt[sheetPeer.id] ?? 0) : 0}
          onSticker={(id) => net.send({ t: 'sticker', id, ...(sheetPeer ? { to: sheetPeer.id } : {}) })}
          onVoice={sheetPeer ? (v) => net.send({ t: 'voice', to: sheetPeer.id, ...v }) : undefined}
        />
      )}
      {match && (
        <MatchOverlay
          peer={match}
          onClose={() => setMatch(null)}
          onChat={() => {
            const id = match.id
            setMatch(null)
            if (peerOf(id)) openChat(id)
          }}
        />
      )}
      {feat.overlays}
      {inTutorial && !panel && !help && (
        <AirportTutorialHud
          step={tutStep}
          near={tutNear}
          touch={touch}
          celebrate={tutCelebrate}
          onCollect={onTutCollect}
          onDoor={onTutDoor}
          onOpenWardrobe={() => setPanel('wardrobe')}
          onSkip={() => setTutStep('done')}
        />
      )}
      {help && (
        <HelpModal
          inCity={!home && !venue}
          onClose={() => setHelp(false)}
          onOpenWardrobe={() => { setHelp(false); setPanel('wardrobe') }}
          onGoHome={() => { setHelp(false); if (!home && !venue) goTo(ownHome()) }}
          onOpenMap={() => { setHelp(false); window.dispatchEvent(new CustomEvent('situapp:open-map')) }}
        />
      )}
      {showTips && !help && !introActive && (
        <StartGuide
          touch={touch}
          ready={sceneReady}
          inCity={!home && !venue}
          inAirport={venue === START_VENUE}
          onDone={closeTips}
          onOpenWardrobe={() => setPanel('wardrobe')}
          onOpenMap={() => window.dispatchEvent(new CustomEvent('situapp:open-map'))}
        />
      )}
      <IntroCutsceneOverlay active={introActive} onSkip={finishIntro} />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 z-30 bg-gradient-to-br from-[#fff2e3] via-[#f1e6ff] to-[#dff3ff] transition-opacity duration-200 ${fade ? 'opacity-100' : 'opacity-0'}`}
      />
      <LoadingOverlay ready={sceneReady} />
    </div>
  )
}
