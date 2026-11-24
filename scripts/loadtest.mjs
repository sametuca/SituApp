// Yük testi: N sahte oyuncu bağlanıp şehirde rastgele yürür. Kullanım:
//   PORT=3101 SITUAPP_DATA_DIR=/tmp/lt SITUAPP_PROFILE=1 node server/index.js      (ayrı terminalde)
//   node scripts/loadtest.mjs 500 30 3101        (oyuncu sayısı, süre sn, port)
import WebSocket from 'ws'
const N = +process.argv[2] || 200
const SECS = +process.argv[3] || 20
const PORT = +process.argv[4] || 3101
let joined = 0, failed = 0, msgs = 0, bytes = 0, states = 0
const clients = []
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
function spawn(i) {
  return new Promise((res) => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`)
    const c = { ws, x: -60 + Math.random() * 120, z: -60 + Math.random() * 100, ry: 0, vx: 0, vz: 0 }
    ws.on('open', () => ws.send(JSON.stringify({ t: 'join', name: `Yuk${i}`, avatar: 'kaan' })))
    ws.on('message', (d) => {
      msgs++
      bytes += d.length
      const m = JSON.parse(d)
      if (m.t === 'state') states++
      if (m.t === 'welcome') { joined++; clients.push(c); res() }
      if (m.t === 'full') { failed++; res() }
    })
    ws.on('error', () => { failed++; res() })
    ws.on('close', () => res())
  })
}
for (let i = 0; i < N; i += 25) {
  await Promise.all(Array.from({ length: Math.min(25, N - i) }, (_, k) => spawn(i + k)))
  await wait(60)
}
console.log(`bağlanan=${joined} başarısız=${failed}`)
const t0 = Date.now()
msgs = bytes = states = 0
const iv = setInterval(() => {
  for (const c of clients) {
    if (Math.random() < 0.08) { const a = Math.random() * 6.28; c.vx = Math.cos(a) * 0.5; c.vz = Math.sin(a) * 0.5 }
    c.x = Math.max(-95, Math.min(95, c.x + c.vx)); c.z = Math.max(-95, Math.min(45, c.z + c.vz))
    if (c.ws.readyState === 1) c.ws.send(JSON.stringify({ t: 'move', x: +c.x.toFixed(2), z: +c.z.toFixed(2), ry: 0, anim: 'walk' }))
    if (Math.random() < 0.002 && c.ws.readyState === 1) c.ws.send(JSON.stringify({ t: 'chat', text: 'selam' }))
  }
}, 100)
await wait(SECS * 1000)
clearInterval(iv)
const dt = (Date.now() - t0) / 1000
console.log(`süre=${dt.toFixed(0)}s alınan mesaj/sn=${(msgs / dt).toFixed(0)} state/sn=${(states / dt).toFixed(0)} veri=${(bytes / dt / 1024).toFixed(0)} KB/sn (toplam, oyuncu başı ${(bytes / dt / 1024 / Math.max(1, joined)).toFixed(1)} KB/sn)`)
clients.forEach((c) => c.ws.close())
process.exit(0)
