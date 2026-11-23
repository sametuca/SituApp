import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useProgress } from '@react-three/drei'
import { useAuth } from '../lib/AuthContext'
import City from '../world/City'
import HomeRoom from '../world/HomeRoom'
import LocalPlayer from '../world/LocalPlayer'
import RemotePlayers, { GuideNpc, SelfTag } from '../world/RemotePlayers'
import { useMultiplayer } from '../world/net'
import { ChatPanel, HelpModal, HintBar, Minimap, TipStack, TopBar, ZoneToast } from '../world/Hud'
import { ChatFab, ChatSheet, DoorPrompt, IncomingChip, Joystick, NearbyCard } from '../world/Social'
import { useIsTouch } from '../world/useIsTouch'
import { HOME_DOOR, HOME_ROOM, HOME_ZONE, SPAWN, TELEPORTS, ZONES, resolveCollisions, resolveRoom, zoneAt } from '../world/layout'

const NEAR_ENTER = 4.5 // m: bu mesafeye girince "sohbet et" kartı çıkar
const NEAR_LEAVE = 6.5 // m: bu mesafeyi aşınca kart kaybolur (titremesin diye ikisi farklı)

const AVATARS = ['zeynep', 'deniz', 'elif', 'kaan', 'mira', 'ege']
const GUIDE_TIPS = [
  'Selam! Ben Rehber 🧭 Takıldığın yer olursa sağ üstteki ? düğmesine bas.',
  'Enter’a basıp yazarsan mesajın başının üstünde balon olur 💬',
  'Shift’e basılı tutarsan koşarsın 🏃',
  'Yollar lobiden dört yöne açılır: ☕ kuzey, 🪩 doğu, 🏖️ güney, 🌳 batı.',
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

function LoadingOverlay() {
  const { progress } = useProgress()
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    if (progress < 100) return
    const t = setTimeout(() => setHidden(true), 250)
    return () => clearTimeout(t)
  }, [progress])
  if (hidden) return null
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-[#ffe3f0] via-[#f1e6ff] to-[#dff3ff]">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-candy-pink/50 border-t-candy-pink-deep" />
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
  const { user } = useAuth()
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
  const [start] = useState(() => ({ x: SPAWN.x + (Math.random() - 0.5) * 6, z: SPAWN.z + Math.random() * 2 }))
  const [zone, setZone] = useState(zoneAt(SPAWN.x, SPAWN.z))
  const [home, setHome] = useState(null) // null = şehir; { owner, ownerName } = bir evin içindeyiz
  const [nearDoor, setNearDoor] = useState(false)
  const [fade, setFade] = useState(false)
  const [help, setHelp] = useState(false)
  const tipsKey = `situapp_tips_seen_${user?.id ?? 'guest'}`
  const [showTips, setShowTips] = useState(() => !localStorage.getItem(tipsKey))
  const [feed, setFeed] = useState(() => [
    { kind: 'system', ts: 0, text: `Hoş geldin ${name}! Yardım için /yardım yaz ya da sağ üstteki ? düğmesine bas.` },
  ])

  const addFeed = useCallback((m) => {
    setFeed((f) => [...f, { kind: 'chat', ...m }].slice(-100))
    // başkasından özel mesaj geldi ve o sohbet açık değilse bildirim göster
    if (m.dm && !m.self && chatTargetRef.current !== m.id) setIncoming({ id: m.id, name: m.name, text: m.text })
  }, [])
  const say = useCallback((text) => setFeed((f) => [...f, { kind: 'system', ts: Date.now(), text }].slice(-100)), [])
  const net = useMultiplayer({ name, avatar: slug, onChat: addFeed, onDenied: say })

  // Şehir ↔ ev geçişi: ekran kısa süre kararır, sonra oyuncu yeni yere ışınlanır.
  const goTo = useCallback(
    (target) => {
      setFade(true)
      setTimeout(() => {
        setNearDoor(false)
        if (target === 'city') {
          setHome(null)
          focusRef.current.teleport = [HOME_DOOR.x, HOME_DOOR.z, Math.PI / 2]
        } else {
          setHome(target)
          focusRef.current.teleport = [HOME_ROOM.spawn[0], HOME_ROOM.spawn[1], Math.PI]
        }
        net.enterRoom(target === 'city' ? 'city' : { owner: target.owner })
        setTimeout(() => setFade(false), 120)
      }, 220)
    },
    [net],
  )
  const ownHome = useCallback(() => ({ owner: net.homeKey ?? undefined, ownerName: name }), [net.homeKey, name])
  const doorGo = useCallback(() => goTo(home ? 'city' : ownHome()), [goTo, home, ownHome])

  const openChat = useCallback((target) => {
    chatTargetRef.current = target
    setChatTarget(target)
    setIncoming(null)
  }, [])
  const closeChat = useCallback(() => openChat(null), [openChat])
  const peerOf = (id) => net.roster.find((p) => p.id === id)
  const nearPeer = nearId && nearId !== dismissedId && chatTarget !== nearId ? peerOf(nearId) : null
  const sheetPeer = chatTarget && chatTarget !== 'public' ? peerOf(chatTarget) : null

  // sohbet ettiğin oyuncu ayrılırsa çekmeceyi kapat
  useEffect(() => {
    if (chatTarget && chatTarget !== 'public' && !net.roster.some((p) => p.id === chatTarget)) openChat(null)
  }, [chatTarget, net.roster, openChat])

  // geliştirme: konsoldan oyuncu konumunu okuyabilmek için
  useEffect(() => {
    if (!import.meta.env.DEV) return
    window.__focus = focusRef
    return () => delete window.__focus
  }, [])

  const nearDoorRef = useRef(false)
  const doorGoRef = useRef(() => {})
  useEffect(() => {
    nearDoorRef.current = nearDoor && !fade
    doorGoRef.current = doorGo
  }, [nearDoor, fade, doorGo])

  // H tuşu: yardım (E: kapı)
  useEffect(() => {
    const onKey = (e) => {
      const typing = e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)
      if (e.code === 'KeyH' && !typing) setHelp((h) => !h)
      if (e.code === 'KeyE' && !typing && nearDoorRef.current) doorGoRef.current()
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
      goTo(ownHome())
      return say('🏠 Evine girdin.')
    }
    if (['disari', 'cik', 'sehir'].includes(cmd)) {
      if (!home) return say('Zaten dışarıdasın 🌳')
      goTo('city')
      return say('Şehre döndün.')
    }
    if (['isinlan', 'tp', 'git'].includes(cmd)) {
      if (home) return say('Işınlanmak için önce evden çık: /dışarı')
      const id = TELEPORTS[normalize(args[0] ?? '')] ?? TELEPORTS[(args[0] ?? '').toLowerCase()]
      const z = ZONES.find((zn) => zn.id === id)
      if (!z) return say('Nereye? Örnek: /ışınlan kafe — lobi, kafe, kulüp, park, plaj')
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
    <div className="fixed inset-0 overflow-hidden bg-[#cfeaff]">
      <Canvas shadows camera={{ fov: 55, near: 0.3, far: 300, position: [start.x, 4.2, start.z + 8] }}>
        <color attach="background" args={[home ? '#f9e3f1' : '#cfeaff']} />
        <fog attach="fog" args={home ? ['#f9e3f1', 30, 60] : ['#e8f6ff', 50, 140]} />
        <ambientLight intensity={0.7} />
        <hemisphereLight args={['#ffffff', '#ffd6ea', 1.1]} />

        <Suspense fallback={null}>
          {home ? <HomeRoom ownerName={home.ownerName} /> : <City focusRef={focusRef} />}
          <LocalPlayer
            slug={slug}
            start={start}
            focusRef={focusRef}
            controlsRef={controlsRef}
            joystickRef={joystickRef}
            onMove={net.sendMove}
            collide={home ? resolveRoom : resolveCollisions}
          >
            <SelfTag name={name} bubbles={net.bubbles} selfId={net.selfId} />
          </LocalPlayer>
          <RemotePlayers roster={net.roster} remotes={net.remotes} bubbles={net.bubbles} />
          {!home && <GuideNpc focusRef={focusRef} tips={GUIDE_TIPS} />}
        </Suspense>

        <ZoneWatcher key={home ? 'home' : 'city'} focusRef={focusRef} onChange={setZone} fixed={home ? HOME_ZONE : undefined} />
        <DoorWatcher key={`door-${home ? 'home' : 'city'}`} focusRef={focusRef} door={home ? HOME_ROOM.exit : HOME_DOOR} onChange={setNearDoor} />
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
          enablePan={false}
          target={[start.x, 0.8, start.z]}
          minDistance={3.5}
          maxDistance={home ? 10 : 16}
          minPolarAngle={0.35}
          maxPolarAngle={Math.PI / 2.15}
        />
      </Canvas>

      <TopBar zone={zone} online={net.online} status={net.status} onExit={() => navigate('/avatar')} onHelp={() => setHelp(true)} />
      <ZoneToast zone={zone} />
      {!home && <Minimap focusRef={focusRef} remotes={net.remotes} compact={touch} />}
      {touch ? (
        <>
          <Joystick inputRef={joystickRef} />
          {!chatTarget && <ChatFab onClick={() => openChat('public')} />}
        </>
      ) : (
        <>
          {chatTarget !== 'public' && !sheetPeer && <ChatPanel feed={feed} onSend={onSend} status={net.status} />}
          <HintBar />
        </>
      )}
      {nearPeer && !chatTarget && (
        <NearbyCard peer={nearPeer} touch={touch} onChat={() => openChat(nearPeer.id)} onDismiss={() => setDismissedId(nearPeer.id)} />
      )}
      {nearDoor && !chatTarget && !fade && (
        <DoorPrompt emoji={home ? '🚪' : '🏠'} label={home ? 'Dışarı çık' : 'Evine gir'} action={home ? 'Çık' : 'Gir'} touch={touch} raised={Boolean(nearPeer)} onGo={doorGo} />
      )}
      {incoming && !chatTarget && peerOf(incoming.id) && (
        <IncomingChip from={incoming} onOpen={() => openChat(incoming.id)} onClose={() => setIncoming(null)} />
      )}
      {chatTarget && (chatTarget === 'public' || sheetPeer) && (
        <ChatSheet peer={sheetPeer} feed={feed} onSend={onSheetSend} onClose={closeChat} touch={touch} />
      )}
      {help && <HelpModal onClose={() => setHelp(false)} />}
      {showTips && !help && <TipStack onDone={closeTips} />}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 z-30 bg-gradient-to-br from-[#ffe3f0] via-[#f1e6ff] to-[#dff3ff] transition-opacity duration-200 ${fade ? 'opacity-100' : 'opacity-0'}`}
      />
      <LoadingOverlay />
    </div>
  )
}
