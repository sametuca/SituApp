import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const MODELS_DIR = path.join(__dirname, '..', 'public', 'models')
const MANIFEST_FILE = path.join(MODELS_DIR, 'manifest.json')

export async function readManifest() {
  if (!existsSync(MANIFEST_FILE)) return []
  return JSON.parse(await readFile(MANIFEST_FILE, 'utf-8'))
}

async function writeManifest(list) {
  await mkdir(MODELS_DIR, { recursive: true })
  await writeFile(MANIFEST_FILE, JSON.stringify(list, null, 2))
}

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`İndirme başarısız (${res.status}): ${url}`)
  await writeFile(dest, Buffer.from(await res.arrayBuffer()))
}

const safe = (s) => String(s).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')

/**
 * Meshy GLB'sini public/models altına indirir ve manifest'e ekler/günceller.
 * Meshy URL'leri süreli olduğu için dosya yerel olarak saklanır.
 */
export async function importAsset({
  id,
  name,
  location,
  prompt,
  glbUrl,
  thumbnailUrl,
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
}) {
  if (!glbUrl) throw new Error('glbUrl gerekli')
  const assetId = safe(id || `${location}-${name}`)
  const locDir = safe(location)
  const dir = path.join(MODELS_DIR, locDir)
  await mkdir(dir, { recursive: true })

  await download(glbUrl, path.join(dir, `${assetId}.glb`))
  let thumb = null
  if (thumbnailUrl) {
    try {
      await download(thumbnailUrl, path.join(dir, `${assetId}.png`))
      thumb = `/models/${locDir}/${assetId}.png`
    } catch {
      /* küçük resim opsiyonel */
    }
  }

  const entry = {
    id: assetId,
    name,
    location: locDir,
    prompt,
    url: `/models/${locDir}/${assetId}.glb`,
    thumbnail: thumb,
    position,
    rotationY,
    scale,
    createdAt: new Date().toISOString(),
  }
  const list = (await readManifest()).filter((a) => a.id !== assetId)
  list.push(entry)
  await writeManifest(list)
  return entry
}
