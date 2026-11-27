// Asset Studio: public/models manifesti okuma ve Meshy çıktısını içe aktarma (geliştirici aracı).
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

// SSRF koruması: yalnızca bilinen asset kaynaklarından ve yalnızca https indirilebilir.
// Yönlendirmeler sonrası nihai adres de doğrulanır (açık yönlendirme ile iç ağa sızmaya karşı).
const ALLOWED_HOSTS = [/(^|\.)meshy\.ai$/i, /(^|\.)meshyusercontent\.com$/i, /(^|\.)supabase\.co$/i, /(^|\.)supabase\.in$/i]
const MAX_BYTES = 60 * 1024 * 1024

function assertSafeUrl(raw, what = 'URL') {
  let u
  try {
    u = new URL(String(raw))
  } catch {
    throw new Error(`${what} geçersiz: ${raw}`)
  }
  if (u.protocol !== 'https:') throw new Error(`${what} yalnızca https olabilir.`)
  if (!ALLOWED_HOSTS.some((re) => re.test(u.hostname))) throw new Error(`${what} alan adına izin verilmiyor: ${u.hostname}`)
  return u
}

async function download(rawUrl, dest) {
  const u = assertSafeUrl(rawUrl, 'Dosya adresi')
  const res = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(120_000) })
  if (!res.ok) throw new Error(`İndirme başarısız (${res.status}): ${u.hostname}`)
  assertSafeUrl(res.url, 'Yönlendirilen adres')
  const declared = Number(res.headers.get('content-length') ?? 0)
  if (declared > MAX_BYTES) throw new Error('Dosya çok büyük (üst sınır 60 MB).')
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > MAX_BYTES) throw new Error('Dosya çok büyük (üst sınır 60 MB).')
  await writeFile(dest, buf)
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
