// Meshy toplu mekân dekoru üretici (bağımsız, dotenv gerektirmez).
// Kullanım: node scripts/generate-venue-decor.mjs [--limit N] [--concurrency N]
import path from 'node:path'
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const SPEC_FILE = path.join(__dirname, 'venue-decor-spec.json')
const OUT_DIR = path.join(ROOT, 'public', 'models', 'venues')

const envText = await readFile(path.join(ROOT, 'server', '.env'), 'utf8')
const KEYS = (
  envText.match(/^MESHY_API_KEYS=(.+)$/m)?.[1] ||
  envText.match(/^MESHY_API_KEY=(.+)$/m)?.[1] ||
  ''
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
if (!KEYS.length) {
  console.error('server/.env içinde MESHY_API_KEY(S) bulunamadı')
  process.exit(1)
}
let activeKeyIdx = 0
const deadKeys = new Set()
const currentKey = () => KEYS[activeKeyIdx]

const API = 'https://api.meshy.ai/openapi/v1'
const STYLE =
  'cute toy-like 3D game prop, chunky rounded shapes, smooth glossy plastic clay finish, bright warm candy pastel colors, soft studio shading, no realistic grit, single isolated object, centered, isometric three-quarter view, plain white background'

const args = process.argv.slice(2)
const limitIdx = args.indexOf('--limit')
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity
const concIdx = args.indexOf('--concurrency')
const CONCURRENCY = concIdx >= 0 ? Number(args[concIdx + 1]) : 4

async function meshy(method, url, body, key = currentKey()) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(`Meshy ${res.status}: ${data.message || JSON.stringify(data)}`)
    err.status = res.status
    throw err
  }
  return data
}

async function getBalance(key = currentKey()) {
  const b = await meshy('GET', `${API}/balance`, undefined, key)
  return b.balance ?? 0
}

async function pickActiveKey() {
  for (let i = 0; i < KEYS.length; i++) {
    const idx = (activeKeyIdx + i) % KEYS.length
    if (deadKeys.has(idx)) continue
    const bal = await getBalance(KEYS[idx]).catch(() => 0)
    if (bal >= 21) {
      activeKeyIdx = idx
      return { key: KEYS[idx], bal, idx }
    }
    deadKeys.add(idx)
  }
  return null
}

async function waitFor(url, label, key) {
  const start = Date.now()
  while (Date.now() - start < 10 * 60 * 1000) {
    const t = await meshy('GET', url, undefined, key)
    if (t.status === 'SUCCEEDED') return t
    if (t.status === 'FAILED' || t.status === 'CANCELED') {
      throw new Error(`${label} ${t.status}: ${t.task_error?.message || ''}`)
    }
    await new Promise((r) => setTimeout(r, 5000))
  }
  throw new Error(`${label} zaman aşımı`)
}

async function save(url, file) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`İndirme başarısız (${res.status})`)
  await writeFile(file, Buffer.from(await res.arrayBuffer()))
}

async function make(item, key) {
  const tag = `[${item.id}]`
  const img = await meshy('POST', `${API}/text-to-image`, {
    ai_model: 'nano-banana-2',
    prompt: `${item.prompt}, ${STYLE}`,
    aspect_ratio: '1:1',
  }, key)
  const imgTask = await waitFor(`${API}/text-to-image/${img.result}`, `${tag} görsel`, key)
  const imageUrl = imgTask.image_urls[0]

  const m = await meshy('POST', `${API}/image-to-3d`, {
    image_url: imageUrl,
    ai_model: 'meshy-t2',
    should_texture: true,
    model_type: 'smart-topology',
    target_polycount: item.polycount ?? 4000,
    texture_model: 'meshy-n1',
    enable_pbr: false,
    symmetry_mode: 'auto',
  }, key)
  const task = await waitFor(`${API}/image-to-3d/${m.result}`, `${tag} 3D`, key)
  const glb = path.join(OUT_DIR, `${item.id}.glb`)
  await save(task.model_urls.glb, glb)
  try {
    execFileSync(
      'npx',
      ['--yes', '@gltf-transform/cli', 'optimize', glb, glb, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', '1024'],
      { stdio: 'ignore', shell: true, timeout: 120000 },
    )
  } catch {
    console.warn(`${tag} sıkıştırma atlandı, ham GLB kaydedildi`)
  }
  console.log(`${tag} OK`)
}

const rawSpecs = JSON.parse(await readFile(SPEC_FILE, 'utf8'))
// Önce her mekân türünden 1. dekor, sonra 2. dekorlar
const round1 = rawSpecs.filter((_, i) => i % 2 === 0)
const round2 = rawSpecs.filter((_, i) => i % 2 === 1)
const ordered = [...round1, ...round2]
const pending = ordered.filter((s) => !existsSync(path.join(OUT_DIR, `${s.id}.glb`))).slice(0, LIMIT)

await mkdir(OUT_DIR, { recursive: true })
const picked0 = await pickActiveKey()
console.log(`Toplam ${KEYS.length} anahtar | Aktif: #${picked0 ? picked0.idx + 1 : '-'} (${picked0?.bal ?? 0} kredi) | Bekleyen: ${pending.length} model`)
if (!pending.length || !picked0) process.exit(0)

let stopNoCredits = false
let done = 0
const queue = [...pending]

const worker = async () => {
  while (queue.length && !stopNoCredits) {
    const picked = await pickActiveKey()
    if (!picked) {
      console.log('Hiçbir anahtarda yeterli kredi kalmadı, durduruluyor.')
      stopNoCredits = true
      break
    }
    const it = queue.shift()
    if (!it) break
    try {
      await make(it, picked.key)
      done++
    } catch (e) {
      console.error(`[${it.id}] HATA: ${e.message}`)
      if (e.status === 402 || /credit|balance|insufficient|free plan/i.test(e.message)) {
        deadKeys.add(picked.idx)
        queue.unshift(it)
        const next = await pickActiveKey()
        if (!next) stopNoCredits = true
      }
    }
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, () => worker()))
const endBal = await getBalance().catch(() => '?')
console.log(`Tamamlandı: ${done} yeni model | Aktif anahtar kalan bakiye: ${endBal} kredi`)
