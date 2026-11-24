// Yer dokuları için Meshy text-to-image (nano-banana-2): üstten bakış, döşenebilir desen. Çıktı ham PNG; kiremit hâline getirmek için
// scripts/make-tileable.py çalıştırılır (kenarları yumuşatır, 512 px WebP yapar).
// Kullanım: NODE_USE_ENV_PROXY=1 node scripts/meshy-textures.mjs <spec.json> <çıktı klasörü> [--dry-run]   (spec: [{id, prompt}])
import path from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', 'server', '.env') })
const KEY = process.env.MESHY_API_KEY
const API = 'https://api.meshy.ai/openapi/v1'
const STYLE =
  'perfectly flat straight top-down orthographic view, seamless tileable texture pattern filling the entire square frame edge to edge, no border, no objects, no perspective, no shadows from outside, cute toy-like pastel candy colors, soft glossy plastic look, evenly lit'
const [specFile, outDir, ...rest] = process.argv.slice(2)
const dry = rest.includes('--dry-run')
const meshy = async (method, url, body) => {
  const res = await fetch(url, { method, headers: { ...(KEY ? { Authorization: `Bearer ${KEY}` } : {}), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Meshy ${res.status}: ${data.message || JSON.stringify(data)}`)
  return data
}
const waitFor = async (url) => {
  for (let i = 0; i < 150; i++) {
    const t = await meshy('GET', url)
    if (t.status === 'SUCCEEDED') return t
    if (t.status === 'FAILED' || t.status === 'CANCELED') throw new Error(`${t.status}: ${t.task_error?.message || ''}`)
    await new Promise((r) => setTimeout(r, 4000))
  }
  throw new Error('zaman aşımı')
}
const specs = JSON.parse(await readFile(specFile, 'utf8')).filter((s) => !existsSync(path.join(outDir, `${s.id}.png`)))
console.log(`${specs.length} doku üretilecek: ${specs.map((s) => s.id).join(', ') || '—'}`)
if (dry || !specs.length) process.exit(0)
await mkdir(outDir, { recursive: true })
await Promise.all(
  specs.map(async (s) => {
    try {
      const t = await meshy('POST', `${API}/text-to-image`, { ai_model: 'nano-banana-2', prompt: `${s.prompt}, ${STYLE}` })
      const done = await waitFor(`${API}/text-to-image/${t.result}`)
      const res = await fetch(done.image_urls[0])
      await writeFile(path.join(outDir, `${s.id}.png`), Buffer.from(await res.arrayBuffer()))
      console.log(`[${s.id}] ✓`)
    } catch (e) {
      console.error(`[${s.id}] HATA: ${e.message}`)
    }
  }),
)
