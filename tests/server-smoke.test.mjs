import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function unusedPort() {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address()
  server.close()
  await once(server, 'close')
  return port
}

function nextMessage(ws, predicate, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', onMessage)
      reject(new Error('WebSocket response timed out'))
    }, timeout)
    const onMessage = (data) => {
      let msg
      try {
        msg = JSON.parse(data.toString())
      } catch {
        return
      }
      if (!predicate(msg)) return
      clearTimeout(timer)
      ws.off('message', onMessage)
      resolve(msg)
    }
    ws.on('message', onMessage)
  })
}

async function waitForHealth(port, child, getOutput) {
  const deadline = Date.now() + 12000
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(`Server exited early:\n${getOutput()}`)
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`)
      if (response.ok && (await response.json()).ok) return
    } catch {
      // The server may not have bound its port yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Server did not become healthy:\n${getOutput()}`)
}

test('server accepts a player and supports venue and city transitions', { timeout: 30000 }, async () => {
  const port = await unusedPort()
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'situapp-smoke-'))
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      SITUAPP_DATA_DIR: dataDir,
      SUPABASE_URL: '',
      SUPABASE_SERVICE_KEY: '',
      SUPABASE_PUBLISHABLE_KEY: '',
      ADMIN_KEY: '',
      MESHY_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', (data) => { output += data.toString() })
  child.stderr.on('data', (data) => { output += data.toString() })
  let ws

  try {
    await waitForHealth(port, child, () => output)
    ws = new WebSocket(`ws://127.0.0.1:${port}/ws`)
    await new Promise((resolve, reject) => {
      ws.once('open', resolve)
      ws.once('error', reject)
    })

    const welcomeWait = nextMessage(ws, (msg) => msg.t === 'welcome')
    ws.send(JSON.stringify({ t: 'join', name: 'SmokeOyuncu', avatar: 'zeynep' }))
    const welcome = await welcomeWait
    assert.equal(welcome.char.avatar, 'zeynep')
    assert.equal(typeof welcome.gp, 'string')

    const venueWait = nextMessage(ws, (msg) => msg.t === 'room' && msg.room.startsWith('venue:kafe'))
    ws.send(JSON.stringify({ t: 'room', to: 'venue', id: 'kafe' }))
    await venueWait

    const cityWait = nextMessage(ws, (msg) => msg.t === 'room' && msg.room === 'city')
    ws.send(JSON.stringify({ t: 'room', to: 'city' }))
    await cityWait

    const health = await fetch(`http://127.0.0.1:${port}/api/health`).then((response) => response.json())
    assert.equal(health.online, 1)
  } finally {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const closed = once(ws, 'close')
      ws.close()
      await closed
    }
    if (child.exitCode == null) {
      const exited = once(child, 'exit')
      child.kill('SIGTERM')
      await exited
    }
    await rm(dataDir, { recursive: true, force: true })
  }
})
