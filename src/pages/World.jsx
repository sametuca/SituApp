// Dünya sayfası orkestratörü: Canvas, ağ, HUD, özellik modülleri, odalar (şehir/ev/mekân).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DockSlot, TopDockSlot } from '../components/Dock'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { VENUE_BY_ID, VENUE_ROOM } from '../world/venues'
import { resolveVenueRoom, venueLayout, venueTheme } from '../world/venueLayout'
import { EditToggle, FurnitureSheet } from '../world/HomeEditor'
import { FURNITURE_BY_ID } from '../world/furniture'
import { useFeatures } from '../world/features'
import { preloadCritical, preloadLater } from '../world/preload'
import { AirportTutorialHud } from '../world/AirportTutorial'
import { IntroCutsceneOverlay } from '../world/IntroCutscene'
import { GIFT_BY_ID } from '../world/cosmeticsData'
import { furnitureColliders } from '../world/homeLayout'
import { useHomeFurniture } from './useHomeFurniture'
import { useWorldKeys } from './useWorldKeys'
import { useRoomNav } from './useRoomNav'
import { useSceneSwap } from './useSceneSwap'
import { useAirportTutorial } from './useAirportTutorial'
import WorldCanvas from './WorldCanvas'
import { useSkills } from './useSkills'
import { NearbyPicker, VenueChannelPill } from '../world/CrowdHud'
import WhisperInbox from '../world/WhisperInbox'
import { useMultiplayer } from '../world/net'
import { HelpModal, StartGuide, TopBar } from '../world/Hud'
import { ChatPanel } from '../world/HudChat'
import { Minimap } from '../world/HudMap'
import { ChatFab, ChatSheet, DoorPrompt, GestureChip, IncomingChip, InteractSheet, InviteChip, Joystick, LookJoystick, MatchOverlay, SkillBar } from '../world/Social'
import { GESTURE_BY_KIND, GESTURE_RANGE } from '../world/interact'
import SkillEditor from '../components/SkillEditor'
import { useIsTouch } from '../world/useIsTouch'
import { HOME_TIERS, applyHomeTier } from '../world/homeTiers'
import { HOME_ROOM, SPAWN, zoneAt } from '../world/layout'
import { getGraphicsProfile } from '../world/performanceProfile'
import { LoadingOverlay } from './WorldLoading'
import { randomLoadingMessage } from './loadingMessages'
import { runWorldCommand } from './worldCommands'
import { ConnectionOverlays, TransitionOverlay } from './WorldOverlays'
import { AVATARS, NO_ITEMS, START_VENUE, TRAVEL_LOADING_MESSAGES, readAvatar } from './worldConfig'

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
  useEffect(() => {
    preloadCritical(slug)
  }, [slug])
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
  const { onRoom, swapScene, swapVenue, visitPending } = useSceneSwap({ beginTransition, controlsRef, focusRef, moveTargetRef, seenKey, setEditing, setFade, setHome, setIntroActive, setNearDoor, setNearVenue, setSelected, setVenue, venueRef })

  const onDenied = useCallback(
    (text) => {
      visitPending.current = false
      say(text)
    },
    [say, visitPending],
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
  const { roster: playersInRoom, sendGesture: sendNetGesture } = net

  useEffect(() => {
    const on = (e) => net.send({ t: 'tp', zone: e.detail })
    window.addEventListener('situapp:tp', on)
    return () => window.removeEventListener('situapp:tp', on)
  }, [net])

  // Sohbeti sade tutmak için otomatik katılma bildirimleri sohbet akışına basılmaz.

  const { doorGo, enterVenue, goTo, leaveVenue, ownHome, switchVenueChannel, visit } = useRoomNav({ beginTransition, home, name, net, say, setFade, setInteractId, setInvite, swapScene, swapVenue, venue, venueRef, visitPending })

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

  useWorldKeys({ doorGo, editing, enterVenue, fade, home, inTutorial, nearDoor, nearGuide, nearGuideRef, nearVenue, onTutCollect, onTutDoor, reactRef, removeFurn, rotateFurn, selected, setHelp, setInteractId, setPanel, skillListRef, skillRef, tutNear, tutStep, venue })

  const closeTips = useCallback(() => {
    localStorage.setItem(tipsKey, '1')
    setShowTips(false)
  }, [tipsKey])

  const greetPeer = useCallback((id) => {
    const peer = playersInRoom.find((p) => p.id === id)
    if (!peer) return
    if (!sendNetGesture(id, 'wave')) {
      say('Selam göndermek için çevrimiçi olmalısın.')
      return
    }
    window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'wave' }))
    setInteractId(id)
    closeTips()
  }, [closeTips, playersInRoom, sendNetGesture, say])

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
      <WorldCanvas chatTargetRef={chatTargetRef} controlsRef={controlsRef} editing={editing} feat={feat} finishIntro={finishIntro} focusRef={focusRef} furnColliders={furnColliders} graphics={graphics} home={home} inTutorial={inTutorial} introActive={introActive} isOwnHome={isOwnHome} joystickRef={joystickRef} lookJoystickRef={lookJoystickRef} moveTargetRef={moveTargetRef} name={name} net={net} onSceneReady={onSceneReady} roomTier={roomTier} say={say} sceneBase={sceneBase} sceneReady={sceneReady} selected={selected} setChatTarget={setChatTarget} setFurn={setFurn} setHelp={setHelp} setInteractId={setInteractId} setNearDoor={setNearDoor} setNearGuide={setNearGuide} setNearVenue={setNearVenue} setPanel={setPanel} setSelected={setSelected} setTutNear={setTutNear} setZone={setZone} shownItems={shownItems} slug={slug} start={start} touch={touch} tutStep={tutStep} venue={venue} venueCollide={venueCollide} venueDim={venueDim} venueTh={venueTh} venueZone={venueZone} />

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
          focusRef={focusRef}
          roster={net.roster}
          remotes={net.remotes}
          peerRange={GESTURE_RANGE - 0.2}
          onGreet={greetPeer}
          blocked={Boolean(panel || chatTarget || interactPeer)}
          onDone={closeTips}
        />
      )}
      <IntroCutsceneOverlay active={introActive} onSkip={finishIntro} />
      <TransitionOverlay fade={fade} line={transitionLine} />
      <LoadingOverlay ready={sceneReady} />
    </div>
  )
}
