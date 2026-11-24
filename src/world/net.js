import { useCallback, useEffect, useRef, useState } from 'react'
import { authService } from '../lib/auth'
import { photoStore } from './photoStore'

const ANIMS = ['idle', 'walk', 'run', 'ride'] // ride: bisiklette (sunucudaki ANIMS ile aynı sıra)
const SEND_INTERVAL_MS = 100
const BUBBLE_MS = 6000
const REACT_MS = 2600
const WHISPER_MS = 3500
const TYPING_MS = 3500
const FEED_MAX = 100

const wsUrl = () =>
  import.meta.env.VITE_WS_URL ?? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`

/**
 * Çok oyunculu bağlantı.
 * Konumlar React state'inde değil ref'lerde tutulur (10 Hz güncelleme render'ı boğmasın):
 *   remotes: Map<id, { id, name, avatar, x, z, ry, anim, tx, tz, tr }>
 *   bubbles: Map<id, { text, until }>   (konuşma balonları)
 * roster (id listesi) yalnızca biri girip çıkınca değişir.
 */
export function useMultiplayer({ name, avatar, onChat, onDenied, onInfo, onInvited, onRoom, onGesture, onMatch, startRoom = null }) {
  const [status, setStatus] = useState('connecting') // connecting | online | offline | kicked (aynı hesap başka yerde açıldı) | auth (oturum geçersiz)
  const [online, setOnline] = useState(1)
  const [roster, setRoster] = useState([])
  const [spawn, setSpawn] = useState(null)
  const [room, setRoom] = useState('city') // 'city' | 'home:<sahip anahtarı>'
  const [homeKey, setHomeKey] = useState(null) // kendi evimin anahtarı (sunucu verir)
  const [blocked, setBlocked] = useState([]) // engellediklerim: [{ key, name }]
  const [dnd, setDndState] = useState(false) // rahatsız etme modum
  const blockedKeys = useRef(new Set())
  const listeners = useRef(new Map()) // özellik modülleri için: mesaj tipi → Set<fn>
  const [visit, setVisit] = useState(null) // başkasının evindeyken: { owner, ownerName, items, tier }
  const [homeTier, setHomeTier] = useState(null) // kendi evimin kademesi (homeTiers.js); sunucu welcome/home_tier ile verir
  const [homeSync, setHomeSync] = useState(null) // bağlanınca sunucudaki kendi evim: { items | null, open, n }
  const roomRef = useRef('city')
  const wantRoom = useRef(startRoom) // yeniden bağlanınca (ve ilk bağlantıda: havalimanında başla) gidilecek oda isteği, örn. { to: 'venue', id }
  const remotes = useRef(new Map())
  const bubbles = useRef(new Map())
  const reactions = useRef(new Map()) // id → { e, key, until }: kafanın üstünde uçan emoji
  const whispering = useRef(new Map()) // id → until: yakında fısıldayan 🤫
  const typing = useRef(new Map()) // id → until: özel sohbette yazıyor
  const selfId = useRef(null)
  const wsRef = useRef(null)
  const lastSent = useRef({ t: 0, anim: '', x: 0, z: 0 })
  const onChatRef = useRef(onChat)
  const onDeniedRef = useRef(onDenied)
  const onInfoRef = useRef(onInfo)
  const onInvitedRef = useRef(onInvited)
  const onRoomRef = useRef(onRoom)
  const onGestureRef = useRef(onGesture)
  const onMatchRef = useRef(onMatch)
  const homeKeyRef = useRef(null)
  useEffect(() => {
    onChatRef.current = onChat
    onDeniedRef.current = onDenied
    onInfoRef.current = onInfo
    onInvitedRef.current = onInvited
    onRoomRef.current = onRoom
    onGestureRef.current = onGesture
    onMatchRef.current = onMatch
  }, [onChat, onDenied, onInfo, onInvited, onRoom, onGesture, onMatch])

  useEffect(() => {
    let stopped = false
    let retry = 0
    let timer = null

    const syncRoster = () => setRoster([...remotes.current.values()].map((p) => ({ id: p.id, key: p.key, name: p.name, avatar: p.avatar, dnd: Boolean(p.dnd) })))
    const addRemote = (p) => {
      if (blockedKeys.current.has(p.key)) return // engellediklerim görünmez
      remotes.current.set(p.id, { ...p, anim: ANIMS[p.anim] ?? 'idle', tx: p.x, tz: p.z, tr: p.ry })
    }

    const connect = () => {
      if (stopped) return
      setStatus('connecting')
      const ws = new WebSocket(wsUrl())
      wsRef.current = ws

      // Supabase modunda access_token gider; sunucu adı token'dan türetir (name yalnızca demo/misafir içindir)
      ws.onopen = async () => {
        let token = null
        try {
          token = await authService.getToken()
        } catch {
          /* oturum yok: sunucu auth_required der */
        }
        if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'join', name, avatar, ...(token ? { token } : {}) }))
      }

      ws.onmessage = (ev) => {
        let m
        try {
          m = JSON.parse(ev.data)
        } catch {
          return
        }
        listeners.current.get(m.t)?.forEach((fn) => fn(m))
        switch (m.t) {
          case 'auth_required':
          case 'kicked':
            stopped = true // yeniden bağlanma: oturum geçersiz ya da hesap başka yerde açık
            setStatus(m.t === 'kicked' ? 'kicked' : 'auth')
            break
          case 'photo':
            photoStore.set(m.key, m.url)
            break
          case 'profile':
            photoStore.set(remotes.current.get(m.id)?.key, m.photo ?? null)
            break
          case 'friends':
            for (const f of m.list ?? []) photoStore.set(f.key, f.photo ?? null)
            break
          case 'welcome':
            photoStore.reset(m.photos)
            for (const f of m.friendsInit?.list ?? []) photoStore.set(f.key, f.photo ?? null)
            retry = 0
            selfId.current = m.id
            blockedKeys.current = new Set((m.blocked ?? []).map((b) => b.key))
            setBlocked(m.blocked ?? [])
            setDndState(Boolean(m.dnd))
            remotes.current.clear()
            m.players.forEach(addRemote)
            setHomeKey(m.home)
            setHomeTier(m.homeTier ?? 1)
            homeKeyRef.current = m.home
            setHomeSync((h) => ({ items: m.homeItems, open: m.homeOpen, n: (h?.n ?? 0) + 1 }))
            setSpawn({ x: m.x, z: m.z })
            setOnline(m.online)
            setStatus('online')
            roomRef.current = 'city'
            setRoom('city')
            syncRoster()
            // bağlantı koptuysa ve bir evdeysek sunucuya aynı odaya dönmeyi söyle
            if (wantRoom.current && wantRoom.current !== 'city') ws.send(JSON.stringify({ t: 'room', ...wantRoom.current }))
            break
          case 'room':
            roomRef.current = m.room
            setRoom(m.room)
            setVisit(m.owner && m.owner !== homeKeyRef.current ? { owner: m.owner, ownerName: m.ownerName, items: m.items ?? [], tier: m.tier ?? 1 } : null)
            remotes.current.clear()
            bubbles.current.clear()
            reactions.current.clear()
            whispering.current.clear()
            typing.current.clear()
            m.players.forEach(addRemote)
            syncRoster()
            onRoomRef.current?.(m)
            break
          case 'home_items':
            // bulunduğum evin sahibi düzeni değiştirdi
            setVisit((v) => (v && v.owner === m.owner ? { ...v, items: m.items } : v))
            break
          case 'home_tier':
            if (m.owner === homeKeyRef.current) setHomeTier(m.tier)
            setVisit((v) => (v && v.owner === m.owner ? { ...v, tier: m.tier } : v))
            break
          case 'invited':
            onInvitedRef.current?.(m)
            break
          case 'blocks':
            blockedKeys.current = new Set(m.list.map((b) => b.key))
            setBlocked(m.list)
            for (const [id, r] of remotes.current) if (blockedKeys.current.has(r.key)) remotes.current.delete(id)
            syncRoster()
            break
          case 'dnd': {
            if (m.id === selfId.current) setDndState(m.on)
            const r = remotes.current.get(m.id)
            if (r) {
              r.dnd = m.on
              syncRoster()
            }
            break
          }
          case 'react':
            reactions.current.set(m.id, { e: m.e, key: `${m.id}-${Date.now()}-${Math.random()}`, until: Date.now() + REACT_MS })
            break
          case 'whisper':
            onChatRef.current?.({ id: m.id, name: m.name, text: m.text, ts: m.ts, to: m.to, toName: m.toName, whisper: true, self: m.id === selfId.current })
            break
          case 'whispering':
            whispering.current.set(m.id, Date.now() + WHISPER_MS)
            break
          case 'gesture':
            onGestureRef.current?.(m)
            break
          case 'match':
            onMatchRef.current?.(m)
            break
          case 'typing':
            typing.current.set(m.id, Date.now() + TYPING_MS)
            break
          case 'info':
            onInfoRef.current?.(m.text)
            break
          case 'denied':
            wantRoom.current = null
            onDeniedRef.current?.(m.reason)
            break
          case 'join':
            addRemote(m.p)
            syncRoster()
            break
          case 'leave':
            remotes.current.delete(m.id)
            bubbles.current.delete(m.id)
            syncRoster()
            break
          case 'online':
            setOnline(m.n)
            break
          case 'state':
            for (const [id, x, z, ry, a] of m.p) {
              const r = remotes.current.get(id)
              if (!r) continue
              r.tx = x
              r.tz = z
              r.tr = ry
              r.anim = ANIMS[a] ?? 'idle'
            }
            break
          case 'chat':
            // özel mesajlar kafanın üstünde balon olarak görünmez
            if (!m.dm) bubbles.current.set(m.id, { text: m.text, until: Date.now() + BUBBLE_MS })
            onChatRef.current?.({ id: m.id, name: m.name, text: m.text, ts: m.ts, to: m.to, dm: Boolean(m.dm), self: m.id === selfId.current })
            break
          case 'full':
            stopped = true
            break
        }
      }

      ws.onclose = () => {
        // Eski soket (React StrictMode'un çift bağlanması veya yeniden bağlanma) yeni bağlantının
        // referansını ve oyuncu listesini silmesin.
        if (wsRef.current !== ws) return
        wsRef.current = null
        remotes.current.clear()
        syncRoster()
        if (stopped) return // (kicked/auth: durum zaten ayarlandı)
        setStatus('offline')
        setOnline(1)
        retry += 1
        timer = setTimeout(connect, Math.min(1000 * 2 ** (retry - 1), 10000))
      }
      ws.onerror = () => ws.close()
    }

    connect()
    return () => {
      stopped = true
      clearTimeout(timer)
      wsRef.current?.close()
    }
  }, [name, avatar])

  const sendMove = useCallback((x, z, ry, anim) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== 1) return
    const now = performance.now()
    const last = lastSent.current
    const changed = anim !== last.anim
    if (!changed && now - last.t < SEND_INTERVAL_MS) return
    if (!changed && Math.abs(x - last.x) < 0.01 && Math.abs(z - last.z) < 0.01) return
    lastSent.current = { t: now, anim, x, z }
    ws.send(JSON.stringify({ t: 'move', x: +x.toFixed(2), z: +z.toFixed(2), ry: +ry.toFixed(2), anim }))
  }, [])

  /** to verilirse özel mesaj (yalnızca o oyuncuya). */
  const sendChat = useCallback((text, to) => {
    const ws = wsRef.current
    if (ws?.readyState === 1) ws.send(JSON.stringify({ t: 'chat', text, ...(to ? { to } : {}) }))
    return ws?.readyState === 1
  }, [])

  /** Odaya geç. target: 'city' | { owner? } (ev; owner yoksa kendi evin) | { venue: id } (girilebilir mekân). */
  const enterRoom = useCallback((target) => {
    const msg = target === 'city' ? { to: 'city' } : target.venue ? { to: 'venue', id: target.venue } : { to: 'home', ...(target.owner ? { owner: target.owner } : {}) }
    wantRoom.current = target === 'city' ? null : msg
    const ws = wsRef.current
    if (ws?.readyState === 1) ws.send(JSON.stringify({ t: 'room', ...msg }))
    return ws?.readyState === 1
  }, [])

  const send = useCallback((msg) => {
    const ws = wsRef.current
    if (ws?.readyState === 1) ws.send(JSON.stringify(msg))
    return ws?.readyState === 1
  }, [])
  const sendReact = useCallback((e) => send({ t: 'react', e }), [send])
  const sendWhisper = useCallback((text, to) => send({ t: 'whisper', text, to }), [send])
  const sendGesture = useCallback((to, kind) => send({ t: 'gesture', to, kind }), [send])
  const lastTyping = useRef(0)
  /** Özel sohbette yazarken çağır; en fazla ~1,2 sn'de bir yollar. */
  const sendTyping = useCallback(
    (to) => {
      const now = performance.now()
      if (now - lastTyping.current < 1200) return
      lastTyping.current = now
      send({ t: 'typing', to })
    },
    [send],
  )
  /** Özellik modülleri için: belirli bir mesaj tipine abone ol. Döndürdüğü işlev aboneliği kaldırır. */
  const on = useCallback((type, fn) => {
    if (!listeners.current.has(type)) listeners.current.set(type, new Set())
    listeners.current.get(type).add(fn)
    return () => listeners.current.get(type)?.delete(fn)
  }, [])
  const block = useCallback((id) => send({ t: 'block', id }), [send])
  const unblock = useCallback((key) => send({ t: 'unblock', key }), [send])
  const report = useCallback((id, reason) => send({ t: 'report', id, reason }), [send])
  const setDnd = useCallback((on) => send({ t: 'dnd', on }), [send])
  const saveHome = useCallback((items) => send({ t: 'home_save', items }), [send])
  const setHomeOpen = useCallback((open) => send({ t: 'home_open', open }), [send])
  /** Bir oyuncuyu evine davet et: { to: id } ya da { name }. */
  const invite = useCallback((who) => send({ t: 'invite', ...who }), [send])

  return { on, send, blocked, dnd, block, unblock, report, setDnd, status, online, roster, spawn, room, homeKey, homeTier, visit, homeSync, saveHome, setHomeOpen, invite, sendReact, sendWhisper, sendGesture, sendTyping, remotes, bubbles, reactions, whispering, typing, selfId, sendMove, sendChat, enterRoom, feedMax: FEED_MAX }
}
