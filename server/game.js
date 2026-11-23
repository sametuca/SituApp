// Çok oyunculu dünya sunucusu (WebSocket, yol: /ws).
//
// Protokol (JSON):
//   istemci → sunucu
//     { t: 'join', name, avatar }            bir kez, bağlanınca
//     { t: 'move', x, z, ry, anim }          ~10 Hz
//     { t: 'chat', text, to? }               to verilirse özel mesaj (yalnızca alıcı + gönderen)
//     { t: 'room', to: 'city' | 'home', owner? }   odaya geç; 'home' + owner yoksa kendi evin
//   sunucu → istemci
//     { t: 'welcome', id, home, x, z, players: [...], online }   home = kendi evinin anahtarı
//     { t: 'room', room, owner, players: [...] }      oda değişti (room: 'city' | 'home:<anahtar>')
//     { t: 'denied', reason }                          odaya girilemedi
//     { t: 'join', p } / { t: 'leave', id }
//     { t: 'state', p: [[id, x, z, ry, animIdx], ...] }   ~10 Hz, yalnızca değişenler
//     { t: 'chat', id, name, text, ts, to?, dm? }
//     { t: 'online', n }
//
// Odalar: herkes 'city' odasında başlar; evler 'home:<sahip anahtarı>' odalarıdır. Oyuncular, sohbet ve konum
// güncellemeleri yalnızca aynı odadakilere gider. Ev anahtarı oyuncu adından türetilir (kimlik doğrulama gelince
// kullanıcı id'sine geçilmeli).
//
// NOT: Kimlik doğrulama henüz yok; isim istemciden gelir ve doğrulanmaz.
// Gerçek hesaplara geçilince join mesajına oturum token'ı eklenip burada doğrulanmalı.
import { WebSocketServer } from 'ws'
import crypto from 'node:crypto'

const WORLD_HALF = 60 // dünya sınırı (±m); istemci haritasıyla aynı olmalı
const MAX_PLAYERS = 100
const TICK_MS = 100
const MAX_PAYLOAD = 2048
const CHAT_COOLDOWN_MS = 700
const CHAT_MAX = 140

const AVATARS = new Set(['zeynep', 'deniz', 'elif', 'kaan', 'mira', 'ege'])
const ANIMS = ['idle', 'walk', 'run']

// kontrol karakterlerini ve HTML'e yarayacak < > işaretlerini at, kırp
const clean = (s, max) =>
  String(s ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)

// ev sahibi anahtarı: küçük harf, yalnızca harf/rakam/_/- (Türkçe harfler dahil)
const homeKey = (name) => clean(name, 16).toLowerCase().replace(/[^a-z0-9ğüşıöç_-]/g, '') || 'misafir'

const num = (v, lim) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(-lim, Math.min(lim, n)) : 0
}

export function attachGameServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws', maxPayload: MAX_PAYLOAD })
  const players = new Map() // id → oyuncu

  const publicInfo = (p) => ({ id: p.id, name: p.name, avatar: p.avatar, x: p.x, z: p.z, ry: p.ry, anim: ANIMS.indexOf(p.anim) })
  const send = (ws, msg) => ws.readyState === 1 && ws.send(JSON.stringify(msg))
  // room verilirse yalnızca o odadakilere gider
  const broadcast = (msg, exceptId, room) => {
    const data = JSON.stringify(msg)
    for (const p of players.values()) if (p.id !== exceptId && (!room || p.room === room) && p.ws.readyState === 1) p.ws.send(data)
  }
  const inRoom = (room, exceptId) => [...players.values()].filter((p) => p.room === room && p.id !== exceptId)

  // oyuncu odaya girebilir mi? (ev davetleri/kilit sonraki adımda buraya eklenir)
  const canEnter = (p, room) => room === 'city' || room === `home:${p.homeKey}`

  const changeRoom = (p, room) => {
    if (p.room === room) return
    broadcast({ t: 'leave', id: p.id }, p.id, p.room)
    p.room = room
    p.dirty = false
    send(p.ws, { t: 'room', room, owner: room.startsWith('home:') ? room.slice(5) : null, players: inRoom(room, p.id).map(publicInfo) })
    broadcast({ t: 'join', p: publicInfo(p) }, p.id, room)
  }

  wss.on('connection', (ws) => {
    let me = null
    ws.isAlive = true
    ws.on('pong', () => (ws.isAlive = true))

    ws.on('message', (raw) => {
      let msg
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }
      if (!msg || typeof msg.t !== 'string') return

      if (msg.t === 'join' && !me) {
        if (players.size >= MAX_PLAYERS) {
          send(ws, { t: 'full' })
          return ws.close()
        }
        const avatar = AVATARS.has(msg.avatar) ? msg.avatar : 'zeynep'
        me = {
          id: crypto.randomUUID().slice(0, 8),
          ws,
          name: clean(msg.name, 16) || 'Misafir',
          avatar,
          // lobi meydanında, çeşmenin güneyinde rastgele bir yere doğ
          x: (Math.random() - 0.5) * 6,
          z: 6 + Math.random() * 3,
          ry: Math.PI,
          anim: 'idle',
          dirty: false,
          lastChat: 0,
          room: 'city',
          homeKey: homeKey(msg.name),
        }
        players.set(me.id, me)
        send(ws, {
          t: 'welcome',
          id: me.id,
          home: me.homeKey,
          x: me.x,
          z: me.z,
          players: inRoom('city', me.id).map(publicInfo),
          online: players.size,
        })
        broadcast({ t: 'join', p: publicInfo(me) }, me.id, 'city')
        broadcast({ t: 'online', n: players.size })
        return
      }

      if (!me) return

      if (msg.t === 'move') {
        me.x = num(msg.x, WORLD_HALF)
        me.z = num(msg.z, WORLD_HALF)
        me.ry = num(msg.ry, 10)
        me.anim = ANIMS.includes(msg.anim) ? msg.anim : 'idle'
        me.dirty = true
      } else if (msg.t === 'room') {
        const room = msg.to === 'home' ? `home:${typeof msg.owner === 'string' ? homeKey(msg.owner) : me.homeKey}` : 'city'
        if (!canEnter(me, room)) return send(ws, { t: 'denied', reason: 'Bu eve girmek için davet gerekiyor.' })
        changeRoom(me, room)
      } else if (msg.t === 'chat') {
        const now = Date.now()
        const text = clean(msg.text, CHAT_MAX)
        if (!text || now - me.lastChat < CHAT_COOLDOWN_MS) return
        me.lastChat = now
        const target = typeof msg.to === 'string' ? players.get(msg.to) : null
        if (msg.to && (!target || target.room !== me.room)) return // hedef çıkmış/başka odada; mesajı herkese sızdırma
        if (target) {
          // özel mesaj (DM): yalnızca alıcıya ve göndericiye
          const dm = { t: 'chat', id: me.id, name: me.name, text, ts: now, to: target.id, dm: true }
          send(target.ws, dm)
          send(ws, dm)
        } else {
          broadcast({ t: 'chat', id: me.id, name: me.name, text, ts: now }, undefined, me.room)
        }
      }
    })

    ws.on('close', () => {
      if (!me) return
      players.delete(me.id)
      broadcast({ t: 'leave', id: me.id }, undefined, me.room)
      broadcast({ t: 'online', n: players.size })
    })
    ws.on('error', () => ws.terminate())
  })

  // değişen konumları toplu yayınla
  const tick = setInterval(() => {
    const changed = []
    for (const p of players.values()) {
      if (!p.dirty) continue
      p.dirty = false
      changed.push([p.room, p.id, +p.x.toFixed(2), +p.z.toFixed(2), +p.ry.toFixed(2), ANIMS.indexOf(p.anim)])
    }
    if (!changed.length) return
    for (const p of players.values()) {
      const others = changed.filter((c) => c[0] === p.room && c[1] !== p.id).map((c) => c.slice(1))
      if (others.length) send(p.ws, { t: 'state', p: others })
    }
  }, TICK_MS)

  // kopan bağlantıları temizle
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate()
        continue
      }
      ws.isAlive = false
      ws.ping()
    }
  }, 30000)

  wss.on('close', () => {
    clearInterval(tick)
    clearInterval(heartbeat)
  })

  return { online: () => players.size }
}
