import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useProgress } from '@react-three/drei'
import { useAuth } from '../lib/AuthContext'
import City from '../world/City'
import HomeRoom from '../world/HomeRoom'
import { EditToggle, FurnitureLayer, FurnitureSheet } from '../world/HomeEditor'
import { FURNITURE_BY_ID } from '../world/furniture'
import { useFeatures } from '../world/features'
import { MAX_ITEMS, findFreeSpot, furnitureColliders, isValid, loadHome, newUid, saveHome } from '../world/homeLayout'
import LocalPlayer from '../world/LocalPlayer'
import RemotePlayers, { GuideNpc, SelfTag } from '../world/RemotePlayers'
import { useMultiplayer } from '../world/net'
import { ChatPanel, HelpModal, HintBar, Minimap, TipStack, TopBar, ZoneToast } from '../world/Hud'
import { ChatFab, ChatSheet, DoorPrompt, GestureChip, IncomingChip, InteractSheet, InviteChip, Joystick, MatchOverlay, NearbyCard, ReactionBar } from '../world/Social'
import { GESTURE_BY_KIND, REACTIONS, WHISPER_RANGE } from '../world/interact'
import { useIsTouch } from '../world/useIsTouch'
import { HOME_DOOR, HOME_ROOM, HOME_ZONE, SPAWN, TELEPORTS, ZONES, resolveCollisions, resolveRoom, zoneAt } from '../world/layout'

const NO_ITEMS = []
const NEAR_ENTER = 4.5 // m: bu mesafeye girince "sohbet et" kartı çıkar
const NEAR_LEAVE = 6.5 // m: bu mesafeyi aşınca kart kaybolur (titremesin diye ikisi farklı)

const AVATARS = ['zeynep', 'deniz', 'elif', 'kaan', 'mira', 'ege']
const GUIDE_TIPS = [
  'Selam! Ben Rehber 🧭 Takıldığın yer olursa sağ üstteki ? düğmesine bas.',
  'Enter’a basıp yazarsan mesajın başının üstünde balon olur 💬',
  'Shift’e basılı tutarsan koşarsın 🏃',
  'Birinin yanına gidip 💗 düğmesine bas: kalp, çiçek gönder ya da kulağına fısılda 🤫',
  'Aşağıdaki 😊 ile (ya da 1-9 tuşlarıyla) kafanın üstünde emoji uçur!',
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
  const tipsKey = `situapp_tips_seen_${user?.id ?? 'guest'}`
  const [showTips, setShowTips] = useState(() => !localStorage.getItem(tipsKey))
  const [feed, setFeed] = useState(() => [
    { kind: 'system', ts: 0, text: `Hoş geldin ${name}! Yardım için /yardım yaz ya da sağ üstteki ? düğmesine bas.` },
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
      if (target === 'city') {
        setHome(null)
        focusRef.current.teleport = [HOME_DOOR.x, HOME_DOOR.z, Math.PI / 2]
      } else {
        setHome(target)
        focusRef.current.teleport = [HOME_ROOM.spawn[0], HOME_ROOM.spawn[1], Math.PI]
      }
      setTimeout(() => setFade(false), 120)
    }, 220)
  }, [])

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
  const net = useMultiplayer({ name, avatar: slug, onChat: addFeed, onDenied, onInfo: say, onInvited: setInvite, onRoom, onGesture, onMatch })

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
  const ownHome = useCallback(() => ({ owner: net.homeKey ?? undefined, ownerName: name }), [net.homeKey, name])
  const doorGo = useCallback(() => goTo(home ? 'city' : ownHome()), [goTo, home, ownHome])

  const isOwnHome = Boolean(home) && (!home.owner || home.owner === net.homeKey)
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

  const addFurn = (id) => {
    if (furn.length >= MAX_ITEMS) return say(`En fazla ${MAX_ITEMS} eşya koyabilirsin.`)
    const spot = findFreeSpot(furn, id)
    if (!spot) return say('Odada boş yer kalmadı 🛋️')
    const uid = newUid()
    setFurn((l) => [...l, { uid, id, x: spot.x, z: spot.z, ry: 0 }])
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
    say,
    touch,
    roster: net.roster,
    focusRef,
    home,
    panel,
    setPanel,
    openChat: (id) => openChat(id),
    closeInteract: () => setInteractId(null),
  })
  const sendGesture = (kind) => {
    if (!interactPeer) return
    if (!net.sendGesture(interactPeer.id, kind)) say('Şu an çevrimdışısın.')
  }
  const sendWhisper = (text) => {
    if (!interactPeer) return
    if (!net.sendWhisper(text, interactPeer.id)) say('Şu an çevrimdışısın.')
  }
  const react = useCallback((e) => net.sendReact(e), [net])
  const reactRef = useRef(react)
  useEffect(() => {
    reactRef.current = react
  }, [react])

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

  const editKeysRef = useRef({ on: false, rotate: () => {}, remove: () => {} })
  useEffect(() => {
    editKeysRef.current = { on: editing && Boolean(selected), rotate: rotateFurn, remove: removeFurn }
  })
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
      if (!typing && /^Digit[0-9]$/.test(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const n = Number(e.code.slice(5))
        const emoji = REACTIONS[(n + 9) % 10]
        if (emoji) reactRef.current(emoji)
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
      goTo(ownHome())
      return say('🏠 Evine girdin.')
    }
    if (['disari', 'cik', 'sehir'].includes(cmd)) {
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
          {home ? (
            <HomeRoom ownerName={home.ownerName}>
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
            collide={home ? (x, z) => resolveRoom(x, z, furnColliders) : resolveCollisions}
          >
            <SelfTag name={name} bubbles={net.bubbles} selfId={net.selfId} reactions={net.reactions} />
          </LocalPlayer>
          <RemotePlayers roster={net.roster} remotes={net.remotes} bubbles={net.bubbles} reactions={net.reactions} whispering={net.whispering} onPick={(id) => { setChatTarget(null); chatTargetRef.current = null; setInteractId(id) }} />
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

      <TopBar zone={zone} online={net.online} status={net.status} dnd={net.dnd} onSettings={() => setPanel('settings')} onExit={() => navigate('/avatar')} onHelp={() => setHelp(true)} />
      <ZoneToast zone={zone} />
      {!home && <Minimap focusRef={focusRef} remotes={net.remotes} compact={touch} />}
      {touch ? (
        <>
          <Joystick inputRef={joystickRef} />
          {!chatTarget && !editing && <ChatFab onClick={() => openChat('public')} />}
        </>
      ) : (
        <>
          {chatTarget !== 'public' && !sheetPeer && !editing && <ChatPanel feed={feed} onSend={onSend} status={net.status} />}
          <HintBar />
        </>
      )}
      {!editing && !chatTarget && !interactPeer && <ReactionBar onReact={react} touch={touch} />}
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
          max={MAX_ITEMS}
          selected={selected}
          selectedName={FURNITURE_BY_ID[furn.find((i) => i.uid === selected)?.id]?.name}
          onAdd={addFurn}
          onRotate={rotateFurn}
          onRemove={removeFurn}
          onClose={stopEditing}
        />
      )}
      {nearDoor && !chatTarget && !fade && !editing && (
        <DoorPrompt emoji={home ? '🚪' : '🏠'} label={home ? 'Dışarı çık' : 'Evine gir'} action={home ? 'Çık' : 'Gir'} touch={touch} raised={Boolean(nearPeer)} onGo={doorGo} />
      )}
      {invite && !chatTarget && !editing && <InviteChip from={invite} onGo={() => visit(invite.owner)} onClose={() => setInvite(null)} />}
      {incoming && !chatTarget && !interactPeer && !gestureIn && peerOf(incoming.id) && (
        <IncomingChip from={incoming} onOpen={() => openChat(incoming.id)} onClose={() => setIncoming(null)} />
      )}
      {chatTarget && (chatTarget === 'public' || sheetPeer) && (
        <ChatSheet peer={sheetPeer} feed={feed} onSend={onSheetSend} onClose={closeChat} touch={touch} typing={sheetPeer ? (net.typing.current.get(sheetPeer.id) ?? 0) > Date.now() : false} onTyping={net.sendTyping} />
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
