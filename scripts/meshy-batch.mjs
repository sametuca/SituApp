// Genel Meshy toplu asset üretimi (CLAUDE.md hattı: image_to_image (çapa referanslı) → image_to_3d → gltf-transform sıkıştırma).
// Kullanım:
//   NODE_USE_ENV_PROXY=1 node scripts/meshy-batch.mjs <spec.json> <çıktı klasörü> [--only a,b] [--dry-run]
// spec.json: [{ "id": "coffee-machine", "prompt": "cute pastel espresso machine with two cups" }, ...]
// Çıktı: <çıktı klasörü>/<id>.glb (sıkıştırılmış) + <id>.png (üretilen görsel; küçültüp WebP'ye çevirmek sana kalmış).
// Mevcut <id>.glb varsa atlanır. 3'erli paralel çalışır. Anahtar: server/.env MESHY_API_KEY ya da ağ proxy'si ekler.
// Model boyutunu Prop.jsx normalize eder (en büyük boyut 1 × scale); ölçü gerekiyorsa measure-furniture.mjs'e bak.
import path from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', 'server', '.env') })
const KEY = process.env.MESHY_API_KEY
const API = 'https://api.meshy.ai/openapi/v1'
const ANCHOR_TASK = '01a20888-a21f-712f-8551-9aa5803d2d27' // pembe kafe masası (stil çapası)
const STYLE =
  'same cute toy-like style as the reference image, chunky rounded shapes, smooth glossy plastic, bright candy pastel colors, soft shading, no realistic detail, single object, centered, isometric three-quarter view, plain white background'

const [specFile, outDir, ...rest] = process.argv.slice(2)
if (!specFile || !outDir) {
  console.error('Kullanım: node scripts/meshy-batch.mjs <spec.json> <çıktı klasörü> [--only a,b] [--dry-run]')
  process.exit(1)
}
const only = rest.includes('--only') ? rest[rest.indexOf('--only') + 1].split(',') : null
const dry = rest.includes('--dry-run')

async function meshy(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { ...(KEY ? { Authorization: `Bearer ${KEY}` } : {}), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Meshy ${res.status}: ${data.message || JSON.stringify(data)}`)
  return data
}
async function waitFor(url, label) {
  const start = Date.now()
  while (Date.now() - start < 12 * 60 * 1000) {
    const t = await meshy('GET', url)
    if (t.status === 'SUCCEEDED') return t
    if (t.status === 'FAILED' || t.status === 'CANCELED') throw new Error(`${label} ${t.status}: ${t.task_error?.message || ''}`)
    await new Promise((r) => setTimeout(r, 5000))
  }
  throw new Error(`${label} zaman aşımı`)
}
async function save(url, file) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`İndirme başarısız (${res.status})`)
  await writeFile(file, Buffer.from(await res.arrayBuffer()))
}

async function make(item, anchorUrl) {
  const tag = `[${item.id}]`
  const img = await meshy('POST', `${API}/image-to-image`, { ai_model: 'nano-banana-2', prompt: `${item.prompt}, ${STYLE}`, reference_image_urls: [anchorUrl] })
  const imgTask = await waitFor(`${API}/image-to-image/${img.result}`, `${tag} görsel`)
  const imageUrl = imgTask.image_urls[0]
  await save(imageUrl, path.join(outDir, `${item.id}.png`))
  const m = await meshy('POST', `${API}/image-to-3d`, {
    image_url: imageUrl,
    ai_model: 'meshy-t2',
    should_texture: true,
    model_type: 'smart-topology',
    target_polycount: item.polycount ?? 4000,
    texture_model: 'meshy-n1',
    enable_pbr: false,
    symmetry_mode: 'auto',
  })
  const task = await waitFor(`${API}/image-to-3d/${m.result}`, `${tag} 3D`)
  const glb = path.join(outDir, `${item.id}.glb`)
  await save(task.model_urls.glb, glb)
  try {
    execFileSync('npx', ['--yes', '@gltf-transform/cli', 'optimize', glb, glb, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', '1024'], { stdio: 'ignore' })
  } catch {
    console.warn(`${tag} sıkıştırma başarısız, ham GLB bırakıldı`)
  }
  console.log(`${tag} ✓ ${glb}`)
}

const specs = JSON.parse(await readFile(specFile, 'utf8'))
const list = specs.filter((s) => (!only || only.includes(s.id)) && !existsSync(path.join(outDir, `${s.id}.glb`)))
console.log(`${list.length} model üretilecek (~${list.length * 25} kredi): ${list.map((s) => s.id).join(', ') || '—'}`)
if (dry || !list.length) process.exit(0)
await mkdir(outDir, { recursive: true })
const anchorUrl = (await meshy('GET', `${API}/text-to-image/${ANCHOR_TASK}`)).image_urls[0]
const queue = [...list]
const worker = async () => {
  while (queue.length) {
    const it = queue.shift()
    try {
      await make(it, anchorUrl)
    } catch (e) {
      console.error(`[${it.id}] HATA: ${e.message}`)
    }
  }
}
await Promise.all([worker(), worker(), worker()])
