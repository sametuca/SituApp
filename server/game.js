// Çok oyunculu dünya sunucusu (WebSocket, yol: /ws).
//
// Protokol (JSON):
//   istemci → sunucu
//     { t: 'join', name, avatar }            bir kez, bağlanınca
//     { t: 'move', x, z, ry, anim }          ~10 Hz
//     { t: 'chat', text, to? }               to verilirse özel mesaj (yalnızca alıcı + gönderen)
//   sunucu → istemci
//     { t: 'welcome', id, x, z, players: [...], online }
//     { t: 'join', p } / { t: 'leave', id }
//     { t: 'state', p: [[id, x, z, ry, animIdx], ...] }   ~10 Hz, yalnızca değişenler
//     { t: 'chat', id, name, text, ts, to?, dm? }
//     { t: 'online', n }
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

const num = (v, lim) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(-lim, Math.min(lim, n)) : 0
}

export function attachGameServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws', maxPayload: MAX_PAYLOAD })
  const players = new Map() // id → oyuncu

  const publicInfo = (p) => ({ id: p.id, name: p.name, avatar: p.avatar, x: p.x, z: p.z, ry: p.ry, anim: ANIMS.indexOf(p.anim) })
  const send = (ws, msg) => ws.readyState === 1 && ws.send(JSON.stringify(msg))
  const broadcast = (msg, exceptId) => {
    const data = JSON.stringify(msg)
    for (const p of players.values()) if (p.id !== exceptId && p.ws.readyState === 1) p.ws.send(data)
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
        }
        players.set(me.id, me)
        send(ws, {
          t: 'welcome',
          id: me.id,
          x: me.x,
          z: me.z,
          players: [...players.values()].filter((p) => p.id !== me.id).map(publicInfo),
          online: players.size,
        })
        broadcast({ t: 'join', p: publicInfo(me) }, me.id)
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
      } else if (msg.t === 'chat') {
        const now = Date.now()
        const text = clean(msg.text, CHAT_MAX)
        if (!text || now - me.lastChat < CHAT_COOLDOWN_MS) return
        me.lastChat = now
        const target = typeof msg.to === 'string' ? players.get(msg.to) : null
        if (msg.to && !target) return // hedef çıkmış; mesajı herkese sızdırma
        if (target) {
          // özel mesaj (DM): yalnızca alıcıya ve göndericiye
          const dm = { t: 'chat', id: me.id, name: me.name, text, ts: now, to: target.id, dm: true }
          send(target.ws, dm)
          send(ws, dm)
        } else {
          broadcast({ t: 'chat', id: me.id, name: me.name, text, ts: now })
        }
      }
    })

    ws.on('close', () => {
      if (!me) return
      players.delete(me.id)
      broadcast({ t: 'leave', id: me.id })
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
      changed.push([p.id, +p.x.toFixed(2), +p.z.toFixed(2), +p.ry.toFixed(2), ANIMS.indexOf(p.anim)])
    }
    if (!changed.length) return
    for (const p of players.values()) {
      const others = changed.filter((c) => c[0] !== p.id)
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
