import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { importAsset, readManifest } from './assets.js'
import { attachGameServer } from './game.js'
import { initStore } from './store.js'
import { initHomes } from './homes.js'
import { initNames } from './auth.js'
import * as supa from './supa.js'
import { assertSealed } from './guard.js'
assertSealed() // hile koruması çalışmıyorsa sunucu hiç açılmaz

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env') })
const DATA_DIR = path.join(__dirname, 'data')
const CHARACTERS_FILE = path.join(DATA_DIR, 'characters.json')

const app = express()
app.use(cors())
app.use(express.json({ limit: '32kb' }))

const MESHY_API_KEY = process.env.MESHY_API_KEY
const MESHY_BASE = 'https://api.meshy.ai'

async function readCharacters() {
  if (!existsSync(CHARACTERS_FILE)) return []
  const raw = await readFile(CHARACTERS_FILE, 'utf-8')
  return JSON.parse(raw)
}

async function writeCharacters(list) {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(CHARACTERS_FILE, JSON.stringify(list, null, 2))
}

function requireKey(res) {
  if (!MESHY_API_KEY || MESHY_API_KEY === 'your_meshy_api_key') {
    res.status(500).json({ error: 'MESHY_API_KEY not configured in server/.env' })
    return false
  }
  return true
}

// Start a text-to-3d preview task
app.post('/api/meshy/text-to-3d', async (req, res) => {
  if (!requireKey(res)) return
  const { prompt, artStyle = 'realistic', negativePrompt, topology = 'quad', targetPolycount = 10000 } = req.body
  try {
    const response = await fetch(`${MESHY_BASE}/openapi/v2/text-to-3d`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MESHY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'preview',
        prompt,
        art_style: artStyle,
        negative_prompt: negativePrompt,
        topology,
        target_polycount: targetPolycount,
      }),
    })
    const data = await response.json()
    if (!response.ok) return res.status(response.status).json(data)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Refine a previously generated preview task into a textured model
app.post('/api/meshy/text-to-3d/:id/refine', async (req, res) => {
  if (!requireKey(res)) return
  try {
    const response = await fetch(`${MESHY_BASE}/openapi/v2/text-to-3d`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MESHY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mode: 'refine', preview_task_id: req.params.id }),
    })
    const data = await response.json()
    if (!response.ok) return res.status(response.status).json(data)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Poll task status (works for both preview and refine task ids)
app.get('/api/meshy/text-to-3d/:id', async (req, res) => {
  if (!requireKey(res)) return
  try {
    const response = await fetch(`${MESHY_BASE}/openapi/v2/text-to-3d/${req.params.id}`, {
      headers: { Authorization: `Bearer ${MESHY_API_KEY}` },
    })
    const data = await response.json()
    if (!response.ok) return res.status(response.status).json(data)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/characters', async (_req, res) => {
  res.json(await readCharacters())
})

app.post('/api/characters', async (req, res) => {
  const { name, prompt, artStyle, modelUrls, thumbnailUrl } = req.body
  const list = await readCharacters()
  const entry = {
    id: Date.now().toString(36),
    name,
    prompt,
    artStyle,
    modelUrls,
    thumbnailUrl,
    createdAt: new Date().toISOString(),
  }
  list.push(entry)
  await writeCharacters(list)
  res.json(entry)
})

app.delete('/api/characters/:id', async (req, res) => {
  const list = await readCharacters()
  const next = list.filter((c) => c.id !== req.params.id)
  await writeCharacters(next)
  res.json({ ok: true })
})

// Oyun asset'leri (public/models/manifest.json)
app.get('/api/assets', async (_req, res) => {
  res.json(await readManifest())
})

// Meshy çıktısını indirip oyuna ekle
app.post('/api/assets/import', async (req, res) => {
  try {
    res.json(await importAsset(req.body))
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

import { feedbackHandler } from './feedback.js'
app.post('/api/feedback', feedbackHandler)
import { consentHandler } from './consent.js'
app.post('/api/consent', consentHandler)
import { adminBan, adminHidePhoto, adminOverview, adminResolve } from './admin.js'
app.get('/api/admin/overview', adminOverview)
app.post('/api/admin/resolve', adminResolve)
app.post('/api/admin/hide-photo', adminHidePhoto)
app.post('/api/admin/ban', adminBan)

let game = null
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    meshyConfigured: Boolean(MESHY_API_KEY) && MESHY_API_KEY !== 'your_meshy_api_key',
    online: game?.online() ?? 0,
    guard: true,
  })
})

// Üretim: derlenmiş ön yüzü (dist/) aynı sunucudan ver → tek servis = oyun + API + WebSocket aynı adreste (CORS/VITE_WS_URL gerekmez).
const DIST = path.join(__dirname, '..', 'dist')
if (existsSync(path.join(DIST, 'index.html'))) {
  app.use(express.static(DIST, { maxAge: '1h', setHeaders: (res, f) => f.endsWith('index.html') && res.setHeader('Cache-Control', 'no-cache') }))
  app.get(/^\/(?!api\/|ws).*/, (_req, res) => res.sendFile(path.join(DIST, 'index.html'))) // SPA yönlendirmesi (/avatar, /world, /admin)
  console.log('Ön yüz dist/ klasöründen sunuluyor.')
}

const PORT = Number(process.env.PORT) || 3001
// Supabase ortamı varsa kalıcı veri belleğe yüklenmeden dinlemeye başlama
await Promise.all([initStore(), initHomes(), initNames()])
supa.hookShutdown()
const server = app.listen(PORT, () => console.log(`SituApp sunucusu: http://localhost:${PORT} (WebSocket: /ws) — ${supa.enabled ? 'Supabase modu' + (supa.allowGuest ? ' (misafirlere açık)' : '') : 'demo/dosya modu'}`))
game = attachGameServer(server)
