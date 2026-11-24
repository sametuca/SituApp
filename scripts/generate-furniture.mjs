// Ev mobilyalarını Meshy ile üretir (CLAUDE.md'deki hat: image_to_image → image_to_3d).
//   npm run furniture                  -> eksik tüm mobilyaları üretir
//   npm run furniture -- --only bed,sofa
//   npm run furniture -- --dry-run     -> sadece listeler, kredi harcamaz
// Çıktı: public/models/furniture/<id>.glb ve <id>.png (önizleme; 256 px WebP'ye çevrilip PNG silinir). Sonra sıkıştır (bkz. CLAUDE.md).
// Meshy anahtarı: server/.env içinde MESHY_API_KEY (ya da ağ proxy'si ekliyorsa gerekmez).
import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { FURNITURE } from '../src/world/furniture.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', 'server', '.env') })
const OUT = path.join(__dirname, '..', 'public', 'models', 'furniture')
const KEY = process.env.MESHY_API_KEY
const API = 'https://api.meshy.ai/openapi/v1'
const ANCHOR_TASK = '01a20888-a21f-712f-8551-9aa5803d2d27' // pembe kafe masası (stil çapası)
const STYLE = 'same cute toy-like style as the reference image, chunky rounded shapes, smooth glossy plastic, bright candy pastel colors, soft shading, no realistic detail, single object, centered, isometric three-quarter view, plain white background'

const args = process.argv.slice(2)
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null
const dry = args.includes('--dry-run')

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
  const img = await meshy('POST', `${API}/image-to-image`, {
    ai_model: 'nano-banana-2',
    prompt: `${item.prompt}, ${STYLE}`,
    reference_image_urls: [anchorUrl],
  })
  const imgTask = await waitFor(`${API}/image-to-image/${img.result}`, `${tag} görsel`)
  const imageUrl = imgTask.image_urls[0]
  console.log(`${tag} görsel hazır`)
  await save(imageUrl, path.join(OUT, `${item.id}.png`))

  const m = await meshy('POST', `${API}/image-to-3d`, {
    image_url: imageUrl,
    ai_model: 'meshy-t2',
    should_texture: true,
    model_type: 'smart-topology',
    target_polycount: 4000,
    texture_model: 'meshy-n1',
    enable_pbr: false,
    symmetry_mode: 'auto',
  })
  const task = await waitFor(`${API}/image-to-3d/${m.result}`, `${tag} 3D`)
  await save(task.model_urls.glb, path.join(OUT, `${item.id}.glb`))
  console.log(`${tag} ✓ GLB indirildi (task ${m.result})`)
}

async function main() {
  const list = FURNITURE.filter((f) => (!only || only.includes(f.id)) && !existsSync(path.join(OUT, `${f.id}.glb`)))
  console.log(`${list.length} mobilya üretilecek: ${list.map((f) => f.id).join(', ') || '—'}`)
  if (dry || !list.length) return
  await mkdir(OUT, { recursive: true })
  const anchor = await meshy('GET', `${API}/text-to-image/${ANCHOR_TASK}`)
  const anchorUrl = anchor.image_urls[0]
  // 3'erli paralel
  const queue = [...list]
  const worker = async () => {
    while (queue.length) {
      const item = queue.shift()
      try {
        await make(item, anchorUrl)
      } catch (e) {
        console.error(`[${item.id}] HATA: ${e.message}`)
      }
    }
  }
  await Promise.all([worker(), worker(), worker()])
}
main()
