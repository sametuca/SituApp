// Kullanım:
//   npm run assets                 -> manifest'te olmayan tüm asset'leri üretir
//   npm run assets -- --only cafe-table,park-tree
//   npm run assets -- --location cafe
//   npm run assets -- --dry-run    -> sadece listeler, kredi harcamaz
//   npm run assets -- --force      -> var olanları yeniden üretir
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { ASSET_SPECS } from '../server/assetSpecs.js'
import { importAsset, readManifest } from '../server/assets.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', 'server', '.env') })

const KEY = process.env.MESHY_API_KEY
const BASE = 'https://api.meshy.ai/openapi/v2/text-to-3d'

const args = process.argv.slice(2)
const flag = (n) => args.includes(`--${n}`)
const opt = (n) => {
  const i = args.indexOf(`--${n}`)
  return i >= 0 ? args[i + 1] : null
}

async function meshy(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Meshy ${res.status}: ${data.message || JSON.stringify(data)}`)
  return data
}

async function waitFor(id, label) {
  const start = Date.now()
  let last = -1
  while (Date.now() - start < 10 * 60 * 1000) {
    const t = await meshy('GET', `${BASE}/${id}`)
    if (t.progress !== last) {
      last = t.progress
      process.stdout.write(`\r  ${label} %${t.progress ?? 0}   `)
    }
    if (t.status === 'SUCCEEDED') {
      process.stdout.write('\n')
      return t
    }
    if (t.status === 'FAILED' || t.status === 'CANCELED') {
      throw new Error(`${label} ${t.status}: ${t.task_error?.message || ''}`)
    }
    await new Promise((r) => setTimeout(r, 4000))
  }
  throw new Error(`${label} zaman aşımı`)
}

async function generate(spec) {
  const preview = await meshy('POST', BASE, {
    mode: 'preview',
    prompt: spec.prompt,
    art_style: 'realistic',
    negative_prompt: 'realistic, photorealistic, dark, grungy, worn, dirty, blurry, multiple objects, text, watermark, thin parts, ground, scenery',
    topology: 'quad',
    target_polycount: 8000,
  })
  await waitFor(preview.result, 'taslak')
  const refine = await meshy('POST', BASE, { mode: 'refine', preview_task_id: preview.result })
  return waitFor(refine.result, 'doku  ')
}

const only = opt('only')?.split(',')
const loc = opt('location')
const existing = new Set((await readManifest()).map((a) => a.id))

const todo = ASSET_SPECS.filter(
  (s) => (!only || only.includes(s.id)) && (!loc || s.location === loc) && (flag('force') || !existing.has(s.id)),
)

console.log(`${todo.length} asset üretilecek (~30 kredi/asset: 20 taslak + 10 doku):`)
todo.forEach((s) => console.log(`  - ${s.id}  [${s.location}]  ${s.name}`))
if (flag('dry-run') || todo.length === 0) process.exit(0)

if (!KEY || KEY === 'your_meshy_api_key') {
  console.error('\nMESHY_API_KEY yok. server/.env dosyasına ekle (bkz. server/.env.example).')
  process.exit(1)
}

let failed = 0
for (const spec of todo) {
  console.log(`\n▶ ${spec.id}`)
  try {
    const task = await generate(spec)
    const entry = await importAsset({
      ...spec,
      glbUrl: task.model_urls.glb,
      thumbnailUrl: task.thumbnail_url,
    })
    console.log(`  ✓ ${entry.url}`)
  } catch (err) {
    failed++
    console.error(`  ✗ ${err.message}`)
  }
}
console.log(failed ? `\n${failed} asset başarısız.` : '\nTamamlandı.')
process.exit(failed ? 1 : 0)
