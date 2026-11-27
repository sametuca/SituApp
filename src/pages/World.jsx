// Dünya sayfası orkestratörü: Canvas, ağ, HUD, özellik modülleri, odalar (şehir/ev/mekân).
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DockSlot, TopDockSlot } from '../components/Dock'
import { Navigate, useNavigate } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { NeutralToneMapping, PCFSoftShadowMap } from 'three'
import { useAuth } from '../lib/AuthContext'
import City from '../world/City'
import HomeRoom from '../world/HomeRoom'
import Venue from '../world/Venue'
import { VENUE_BY_ID, VENUE_ROOM } from '../world/venues'
import { venueDoor } from '../world/venueDoors'
import { resolveVenueRoom, venueLayout, venueTheme } from '../world/venueLayout'
import { together } from '../world/features/togetherStore'
import { EditToggle, FurnitureLayer, FurnitureSheet } from '../world/HomeEditor'
import { FURNITURE_BY_ID } from '../world/furniture'
import { useFeatures } from '../world/features'
import { preloadCritical, preloadLater } from '../world/preload'
import TogetherScene from '../world/features/TogetherScene'
import Sky from '../world/Sky'
import { AirportTutorialHud, AirportTutorialScene } from '../world/AirportTutorial'
import { IntroCutsceneCamera, IntroCutsceneOverlay } from '../world/IntroCutscene'
import { GIFT_BY_ID } from '../world/cosmeticsData'
import { furnitureColliders } from '../world/homeLayout'
import { useHomeFurniture } from './useHomeFurniture'
import { useAirportTutorial } from './useAirportTutorial'
import { useSkills } from './useSkills'
import LocalPlayer, { ClickToMoveGround } from '../world/LocalPlayer'
import RemotePlayers, { GuideNpc, SelfTag } from '../world/RemotePlayers'
import { NearbyPicker, VenueChannelPill } from '../world/CrowdHud'
import WhisperInbox from '../world/WhisperInbox'
import { useMultiplayer } from '../world/net'
import { HelpModal, StartGuide, TopBar } from '../world/Hud'
import { ChatPanel } from '../world/HudChat'
import { Minimap } from '../world/HudMap'
import { ChatFab, ChatSheet, DoorPrompt, GestureChip, IncomingChip, InteractSheet, InviteChip, Joystick, LookJoystick, MatchOverlay, SkillBar } from '../world/Social'
import { GESTURE_BY_KIND, GESTURE_RANGE, REACTIONS } from '../world/interact'
import SkillEditor from '../components/SkillEditor'
import { useIsTouch } from '../world/useIsTouch'
import { HOME_TIERS, applyHomeTier } from '../world/homeTiers'
import { BEACH_START, HOME_DOOR, HOME_ROOM, HOME_ZONE, SPAWN, resolveCollisions, resolveRoom, zoneAt } from '../world/layout'
import { getGraphicsProfile } from '../world/performanceProfile'
import GraphicsEffects from '../world/GraphicsEffects'
import { DoorWatcher, LoadingOverlay, SceneReady, VenueDoorWatcher, WorldErrorBoundary, ZoneWatcher } from './WorldLoading'
import { randomLoadingMessage } from './loadingMessages'
import { runWorldCommand } from './worldCommands'
import { ConnectionOverlays, TransitionOverlay } from './WorldOverlays'
import { AVATARS, GUIDE_TIPS, NO_ITEMS, START_VENUE, TRAVEL_LOADING_MESSAGES, readAvatar } from './worldConfig'

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
  const lookJoystickRef = useRef({ x: 0, y: 0 })
  const moveTargetRef = useRef(null)
  const touch = useIsTouch()
  const graphics = useMemo(() => getGraphicsProfile(), [])
  const [chatTarget, setChatTarget] = useState(null) // null = kapalı, 'public' = herkese açık, aksi halde oyuncu id'si
  const chatTargetRef = useRef(null)
  const [incoming, setIncoming] = useState(null)
  const [inboxOpen, setInboxOpen] = useState(false)
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
  const [transitionLine, setTransitionLine] = useState(() => randomLoadingMessage(TRAVEL_LOADING_MESSAGES))
  const beginTransition = useCallback(() => {
    setTransitionLine(randomLoadingMessage(TRAVEL_LOADING_MESSAGES))
    setFade(true)
  }, [])
  const [sceneReady, setSceneReady] = useState(false) // ilk yükleme bitti mi (yükleme ekranı için)
  const onSceneReady = useCallback(() => setSceneReady(true), [])
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
  // sunucu konumu düzelttiyse (hız/sınır denetimi) oyuncuyu son geçerli konuma geri al
  useEffect(() => {
    const on = (e) => (focusRef.current.teleport = [e.detail.x, e.detail.z])
    window.addEventListener('situapp:snap', on)
    return () => window.removeEventListener('situapp:snap', on)
  }, [])
  useMemo(() => preloadCritical(slug), [slug]) // şehir + avatar modellerini sahne çizilmeden paralel indir (şelale yüklemeyi önler)
  useEffect(() => {
    if (sceneReady) preloadLater()
  }, [sceneReady])
  // ev düzeni: kendi evin sunucuda kalıcıdır, tarayıcıdaki kopya yalnızca önbellektir
  const homeOwner = user?.id ?? `guest-${name}`
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState(null)
  const [invite, setInvite] = useState(null) // { owner, ownerName }: biri seni evine çağırdı
  const [gestureIn, setGestureIn] = useState(null) // biri sana jest yaptı: { id, name, kind, emoji, avatar }
  const [match, setMatch] = useState(null) // karşılıklı kalp: { id, name, avatar }
  const [interactId, setInteractId] = useState(null) // etkileşim menüsü açık olan oyuncu
  const [, setTick] = useState(0)
  const [panel, setPanel] = useState(null) // açık panel: 'settings' | özellik panelleri
  const [help, setHelp] = useState(false)
  const [nearGuide, setNearGuide] = useState(false)
  const nearGuideRef = useRef(false)
  const tipsKey = `situapp_tips_seen_${user?.id ?? 'guest'}`
  const [showTips, setShowTips] = useState(() => !localStorage.getItem(tipsKey))
  const [feed, setFeed] = useState([])
  const [whisperInbox, setWhisperInbox] = useState([])
  const [whisperUnread, setWhisperUnread] = useState(0)

  const addFeed = useCallback((m) => {
    if (m.whisper) {
      const uid = `${m.ts}-${m.id}-${Math.random().toString(36).slice(2, 6)}`
      setWhisperInbox((prev) =>
        [{ uid, fromId: m.id, fromName: m.name, toId: m.to, toName: m.toName, text: m.text, ts: m.ts, self: Boolean(m.self) }, ...prev].slice(0, 30),
      )
      if (!m.self) setWhisperUnread((n) => n + 1)
      return
    }
    setFeed((f) => [...f, { kind: 'chat', ...m }].slice(-100))
    // başkasından özel mesaj geldi ve o sohbet açık değilse bildirim göster
    if (m.dm && !m.self && chatTargetRef.current !== m.id) setIncoming({ id: m.id, name: m.name, text: m.text, whisper: false })
  }, [])
  const say = useCallback((text) => setFeed((f) => [...f, { kind: 'system', ts: Date.now(), text }].slice(-100)), [])
  // Şehir ↔ ev geçişi: ekran kısa süre kararır, sonra oyuncu yeni yere ışınlanır.
  const swapScene = useCallback((target) => {
    moveTargetRef.current = null
    beginTransition()
    setEditing(false)
    setSelected(null)
    setTimeout(() => {
      setNearDoor(false)
      setVenue(null)
      venueRef.current = null
      if (target === 'city') {
        setHome(null)
        // Konut Mahallesi kapısından girildiyse o kapının önüne, aksi halde lobideki Evim kapısına dön
        focusRef.current.teleport = [HOME_DOOR.x, HOME_DOOR.z, 0] // evden çıkınca sahile dönük Evim kapısına dön
      } else {
        setHome(target)
        if (target?.isOwn) setEditing(true)
        focusRef.current.teleport = [HOME_ROOM.spawn[0], HOME_ROOM.spawn[1], Math.PI]
      }
      setTimeout(() => setFade(false), 120)
    }, 220)
  }, [beginTransition])

  // Şehir ↔ mekân geçişi (ev geçişinin paralelidir). Girerken kamera güneye sıfırlanır (oyuncak evi kesiti).
  const swapVenue = useCallback((target, serverSpawn = null) => {
    moveTargetRef.current = null
    const from = venueRef.current
    beginTransition()
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
        const spawn =
          Array.isArray(serverSpawn) && serverSpawn.length === 2 && serverSpawn.every(Number.isFinite)
            ? serverSpawn
            : VENUE_ROOM.spawn
        const [sx, sz] = spawn
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
  }, [beginTransition, seenKey])

  // Başkasının evine girerken sahne, sunucu izin verince ('room' mesajı) değişir; reddedilirse olduğun yerde kalırsın.
  // Mekân girişinde/salon değişiminde sunucunun verdiği dağılımlı kapı konumu uygulanır (üst üste binmeyi önler).
  const visitPending = useRef(false)
  const onRoom = useCallback(
    (m) => {
      if (m.venue && Array.isArray(m.spawn) && m.spawn.length === 2) {
        if (venueRef.current !== m.venue) {
          swapVenue(m.venue, m.spawn)
        } else {
          const [sx, sz] = m.spawn
          focusRef.current.teleport = [sx, sz, Math.PI]
          setTimeout(() => {
            const c = controlsRef.current
            if (!c) return
            c.object.position.set(sx, 6.4, sz + 9.4)
            c.target.set(sx, 0.8, sz)
            c.update()
          }, 60)
        }
      }
      if (!visitPending.current || !m.owner) return
      visitPending.current = false
      swapScene({ owner: m.owner, ownerName: m.ownerName })
    },
    [swapScene, swapVenue],
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

  // Sohbeti sade tutmak için otomatik katılma bildirimleri sohbet akışına basılmaz.

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
      net.enterRoom({ venue: id })
    },
    [net],
  )
  const switchVenueChannel = useCallback(
    (ch) => {
      if (!venue || ch === net.venueChannel) return
      beginTransition()
      setInteractId(null)
      net.enterRoom({ venue, ch })
      setTimeout(() => setFade(false), 260)
    },
    [beginTransition, venue, net],
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
  const { furn, setFurn, addFurn, rotateFurn, removeFurn, stopEditing } = useHomeFurniture({ homeOwner, net, say, maxItems, editing, selected, setEditing, setSelected })
  const shownItems = !home ? NO_ITEMS : isOwnHome ? furn : (net.visit?.items ?? NO_ITEMS)
  const furnColliders = useMemo(() => furnitureColliders(shownItems), [shownItems])

  const openChat = useCallback((target) => {
    chatTargetRef.current = target
    setChatTarget(target)
    setIncoming(null)
  }, [])
  const closeChat = useCallback(() => openChat(null), [openChat])
  const peerOf = (id) => net.roster.find((p) => p.id === id)
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
    () => (venueTh ? { bg: venueTh.bg, fog: [venueTh.bg, 36, 76] } : home ? { bg: '#faeee2', fog: ['#faeee2', 36, 76] } : { bg: '#bce4ff', fog: ['#bce4ff', 78, 210] }),
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
  const { reactRef, slots, skillEdit, setSkillEdit, skillList, skillListRef, changeSlots, skillCd, triggerSkill, skillRef } = useSkills({ net, focusRef })

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

  const { tutStep, setTutStep, tutNear, setTutNear, tutCelebrate, inTutorial, onTutCollect, onTutDoor } = useAirportTutorial({ venue, panel, fade, setFade, beginTransition })

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

  const runCommand = (text) =>
    runWorldCommand(text, { say, net, focusRef, home, venue, goTo, ownHome, leaveVenue, visit, setHelp, setPanel, setIntroActive })

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
        shadows={graphics.shadows ? PCFSoftShadowMap : false}
        dpr={graphics.lowPower ? graphics.dpr : (touch ? [1, 1.25] : graphics.dpr)}
        gl={{ powerPreference: graphics.lowPower ? 'default' : 'high-performance', antialias: graphics.antialias, toneMapping: NeutralToneMapping, toneMappingExposure: 1.02 }}
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
        {/* Tek karede üretilen hafif PBR ışık haritası (IBL): tüm kil/plastik/cam/su yüzeylerine modern yansıma ve derinlik katar */}
        {!graphics.lowPower && (
          <Environment resolution={128} frames={1} environmentIntensity={home || venue ? 0.36 : 0.42}>
            <Lightformer form="ring" intensity={1.8} color="#fff6e0" position={[10, 14, 8]} scale={14} target={[0, 0, 0]} />
            <Lightformer form="rect" intensity={1.4} color="#bfe8ff" position={[0, 12, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[26, 26, 1]} />
            <Lightformer form="rect" intensity={0.9} color="#ffe0c2" position={[-12, 4, -8]} scale={[14, 8, 1]} target={[0, 0, 0]} />
            <Lightformer form="rect" intensity={0.75} color="#ffe8d6" position={[0, -6, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[24, 24, 1]} />
          </Environment>
        )}
        <Sky home={Boolean(home)} interior={venueTh ? { bg: venueTh.bg, fog: sceneBase.fog, dim: venueDim } : null} focusRef={focusRef} />

        <TogetherScene home={Boolean(home || venue)} />
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
          <ClickToMoveGround moveTargetRef={moveTargetRef} disabled={introActive} />
          <LocalPlayer
            slug={slug}
            start={start}
            focusRef={focusRef}
            controlsRef={controlsRef}
            joystickRef={joystickRef}
            lookJoystickRef={lookJoystickRef}
            moveTargetRef={moveTargetRef}
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
          <RemotePlayers roster={net.roster} remotes={net.remotes} bubbles={net.bubbles} reactions={net.reactions} whispering={net.whispering} touch={touch} onPick={(id) => { setChatTarget(null); chatTargetRef.current = null; setInteractId(id) }} />
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
        <GraphicsEffects ao={graphics.ao} bloom={graphics.bloom} />
      </Canvas>
      </WorldErrorBoundary>

      <ConnectionOverlays status={net.status} signOut={signOut} />
      {!introActive && (
        <TopBar
          zone={zone}
          online={net.online}
          status={net.status}
          dnd={net.dnd}
          onSettings={() => setPanel('settings')}
          extraButtons={
            inTutorial
              ? tutStep === 'inventory'
                ? feat.extraButtons.filter((b) => b.key === 'inventory').map((b) => ({ ...b, highlight: true, hint: 'Buraya tıkla 🎒' }))
                : tutStep === 'wardrobe'
                  ? feat.extraButtons.filter((b) => b.key === 'wardrobe').map((b) => ({ ...b, highlight: true, hint: 'Buraya tıkla 👗' }))
                  : []
              : [
                  ...feat.extraButtons,
                  {
                    key: 'inbox',
                    icon: 'feedback',
                    label: 'Fısıltı Sohbetleri',
                    badge: whisperUnread > 0 ? whisperUnread : 0,
                    highlight: whisperUnread > 0,
                    onClick: () => setInboxOpen((o) => !o),
                  },
                ]
          }
          extraNodes={inTutorial ? null : feat.extraNodes}
          menuNodes={feat.menuNodes}
          menuBadge={inTutorial ? 0 : feat.menuBadge}
          onExit={async () => {
            await signOut()
            navigate('/', { replace: true })
          }}
          onHelp={() => setHelp(true)}
        />
      )}
      {!introActive && !inTutorial && venue && net.status === 'online' && (
        <VenueChannelPill
          venueName={VENUE_BY_ID[venue]?.name ?? 'Mekân'}
          channel={net.venueChannel}
          channels={net.venueChannels}
          inRoomCount={net.roster.length + 1}
          onSwitch={switchVenueChannel}
          onRefresh={() => net.send({ t: 'venue_channels', id: venue })}
        />
      )}
      {!introActive && !inTutorial && !editing && !chatTarget && !interactPeer && (
        <WhisperInbox
          open={inboxOpen}
          onClose={() => setInboxOpen(false)}
          items={whisperInbox}
          touch={touch}
          onReadAll={() => setWhisperUnread(0)}
          onClear={() => {
            setWhisperInbox([])
            setWhisperUnread(0)
          }}
          onReply={(toId, txt) => {
            if (!peerOf(toId)) {
              say('Bu oyuncu artık burada değil.')
              return false
            }
            if (!net.sendWhisper(txt, toId)) {
              say('Şu an çevrimdışısın.')
              return false
            }
            return true
          }}
          onInspect={(id) => {
            if (peerOf(id)) {
              setChatTarget(null)
              chatTargetRef.current = null
              setInteractId(id)
            } else say('Bu oyuncu artık burada değil.')
          }}
        />
      )}
      {!introActive && !inTutorial && !editing && !chatTarget && !interactPeer && (
        <NearbyPicker
          remotes={net.remotes}
          roster={net.roster}
          focusRef={focusRef}
          touch={touch}
          onPick={(id) => {
            setChatTarget(null)
            chatTargetRef.current = null
            setInteractId(id)
          }}
        />
      )}
      {!introActive && !home && !venue && <Minimap focusRef={focusRef} remotes={net.remotes} compact={touch} />}
      {!introActive && (touch ? (
        <>
          <Joystick inputRef={joystickRef} />
          <LookJoystick inputRef={lookJoystickRef} />
          {!inTutorial && !chatTarget && !editing && <ChatFab onClick={() => openChat('public')} />}
        </>
      ) : (
        <>
          {!inTutorial && chatTarget !== 'public' && !sheetPeer && !editing && (
            <ChatPanel
              feed={feed}
              onSend={onSend}
              status={net.status}
              onAddFriend={(p) => {
                if (!net.send({ t: 'friend_request', id: p.id })) say('Arkadaş eklemek için çevrimiçi olmalısın.')
              }}
              onOpenDm={(id) => {
                if (peerOf(id)) openChat(id)
                else say('Bu oyuncu şu an burada değil.')
              }}
              onInspect={(id) => {
                if (peerOf(id)) {
                  setChatTarget(null)
                  chatTargetRef.current = null
                  setInteractId(id)
                } else say('Bu oyuncu şu an burada değil.')
              }}
            />
          )}
        </>
      ))}
      <DockSlot />
      {skillEdit && <SkillEditor slots={slots} onChange={changeSlots} onClose={() => setSkillEdit(false)} />}
      <TopDockSlot />
      {!introActive && !inTutorial && !editing && !chatTarget && !interactPeer && (
        <>
          <SkillBar xp={feat.xp} cooldowns={skillCd} slots={skillList} onEdit={() => setSkillEdit(true)} onSkill={triggerSkill} onOpenExp={() => setPanel('collection')} touch={touch} />
        </>
      )}
      {interactPeer && !chatTarget && (
        <InteractSheet
          peer={interactPeer}
          near={distTo(interactPeer.id) <= GESTURE_RANGE - 0.2}
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
        <DoorPrompt emoji={home || venue ? '🚪' : '🏠'} label={home || venue ? 'Dışarı çık' : 'Evine gir'} action={home || venue ? 'Çık' : 'Gir'} touch={touch} raised={Boolean(editing)} onGo={doorGo} />
      )}
      {!home && !venue && !nearDoor && nearVenue && !chatTarget && !fade && !editing && (
        <DoorPrompt label={VENUE_BY_ID[nearVenue].name} action="Gir" touch={touch} onGo={() => enterVenue(nearVenue)} />
      )}
      {!home && !venue && !nearDoor && !nearVenue && nearGuide && !help && !chatTarget && !fade && !editing && (
        <DoorPrompt label="Rehber · Nasıl Oynanır" action="Aç" touch={touch} onGo={() => setHelp(true)} />
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
          onOpenInventory={() => setPanel('inventory')}
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
      {showTips && !inTutorial && !help && !introActive && (
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
      <TransitionOverlay fade={fade} line={transitionLine} />
      <LoadingOverlay ready={sceneReady} />
    </div>
  )
}
