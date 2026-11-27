// Yük testi: N sahte oyuncu bağlanıp şehirde rastgele yürür. Kullanım:
//   PORT=3101 SITUAPP_DATA_DIR=/tmp/lt SITUAPP_PROFILE=1 node server/index.js      (ayrı terminalde)
//   node scripts/loadtest.mjs 500 30 3101        (oyuncu sayısı, süre sn, port)
//   LOADTEST_CROWD=1 node scripts/loadtest.mjs 500 30 3101 (en yoğun nokta testi)
import WebSocket from 'ws'
const N = +process.argv[2] || 200
const SECS = +process.argv[3] || 20
const PORT = +process.argv[4] || 3101
const CROWD = process.env.LOADTEST_CROWD === '1'
let joined = 0, failed = 0, msgs = 0, bytes = 0, states = 0
const clients = []
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
function spawn(i) {
  return new Promise((res) => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`)
    const c = {
      ws,
      x: 0,
      z: 0,
      tx: null,
      tz: null,
      ry: 0,
      stateSeen: new Set(),
    }
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(deadline)
      res()
    }
    const deadline = setTimeout(() => {
      failed++
      ws.terminate()
      finish()
    }, 15000)
    ws.on('open', () => ws.send(JSON.stringify({ t: 'join', name: `Yuk${i}`, avatar: 'kaan' })))
    ws.on('message', (d) => {
      msgs++
      bytes += d.length
      const m = JSON.parse(d)
      if (m.t === 'state') {
        states++
        for (const [id] of m.p ?? []) c.stateSeen.add(id)
      }
      if (m.t === 'welcome') {
        c.x = m.x
        c.z = m.z
        setTarget(c)
        joined++
        clients.push(c)
        finish()
      }
      if (m.t === 'full') { failed++; finish() }
    })
    ws.on('error', () => { if (!settled) failed++; finish() })
    ws.on('close', () => { if (!settled) failed++; finish() })
  })
}
function setTarget(c) {
  const radius = CROWD ? 4 : 80
  c.tx = CROWD ? c.x + (Math.random() - 0.5) * radius : -80 + Math.random() * 160
  c.tz = CROWD ? c.z + (Math.random() - 0.5) * radius : -95 + Math.random() * 140
}
for (let i = 0; i < N; i += 25) {
  await Promise.all(Array.from({ length: Math.min(25, N - i) }, (_, k) => spawn(i + k)))
  await wait(60)
}
console.log(`bağlanan=${joined} başarısız=${failed}`)
const t0 = Date.now()
msgs = bytes = states = 0
for (const c of clients) c.stateSeen.clear()
const iv = setInterval(() => {
  for (const c of clients) {
    const dx = c.tx - c.x
    const dz = c.tz - c.z
    const distance = Math.hypot(dx, dz)
    if (distance < 0.5) {
      setTarget(c)
    } else {
      const step = Math.min(distance, CROWD ? 0.25 : 0.35)
      c.x += (dx / distance) * step
      c.z += (dz / distance) * step
    }
    if (c.ws.readyState === 1) c.ws.send(JSON.stringify({ t: 'move', x: +c.x.toFixed(2), z: +c.z.toFixed(2), ry: 0, anim: 'walk' }))
    if (Math.random() < 0.002 && c.ws.readyState === 1) c.ws.send(JSON.stringify({ t: 'chat', text: 'selam' }))
  }
}, 100)
await wait(SECS * 1000)
clearInterval(iv)
const dt = (Date.now() - t0) / 1000
console.log(`süre=${dt.toFixed(0)}s alınan mesaj/sn=${(msgs / dt).toFixed(0)} state/sn=${(states / dt).toFixed(0)} veri=${(bytes / dt / 1024).toFixed(0)} KB/sn (toplam, oyuncu başı ${(bytes / dt / 1024 / Math.max(1, joined)).toFixed(1)} KB/sn)`)
const coverage = clients.map((c) => c.stateSeen.size)
if (coverage.length) {
  const total = coverage.reduce((sum, n) => sum + n, 0)
  console.log(`güncellenen akran/istemci min-ort-maks=${Math.min(...coverage)}-${(total / coverage.length).toFixed(0)}-${Math.max(...coverage)}`)
  if (CROWD && Math.min(...coverage) < Math.max(0, joined - 1)) {
    console.error('Yoğun alan testinde bazı akranların konum güncellemesi alınmadı.')
    process.exitCode = 1
  }
}
if (joined !== N || failed > 0) process.exitCode = 1
clients.forEach((c) => c.ws.close())
