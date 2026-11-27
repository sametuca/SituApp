// Şehir zemini yardımcıları: paylaşımlı doku önbelleği, malzeme ve tekrar yuvarlama.
import { CanvasTexture, DataTexture, LinearFilter, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three'

const texCache = new Map()
export function sharedTexture(base, key, setup) {
  const k = `${base.uuid}|${key}`
  let t = texCache.get(k)
  if (!t) {
    t = base.clone()
    t.wrapS = t.wrapT = RepeatWrapping
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 8
    setup(t)
    t.needsUpdate = true
    texCache.set(k, t)
  }
  return t
}
const matCache = new Map()
export function stdMat(color, roughness = 0.6) {
  const k = `${color}|${roughness}`
  let m = matCache.get(k)
  if (!m) {
    m = new MeshStandardMaterial({ color, roughness })
    matCache.set(k, m)
  }
  return m
}
export const q = (v, s = 0.25) => Math.max(s, Math.round(v / s) * s) // tekrar sayısını yuvarla (önbellek isabeti)

// Yer dokuları (Meshy ile üretilen üstten bakış desenler, scripts/make-tileable.py ile döşenebilir yapıldı): public/textures/<ad>.webp
export const GROUND_TEX = { grass: 4.5, asphalt: 4.8, cobble: 3.2, sand: 4 } // doku adı → bir kiremitin kapladığı metre
export const GROUND_URLS = Object.keys(GROUND_TEX).map((n) => `/textures/${n}.webp`)

// Zenginleştirilmiş asfalt dokusu + kabartma haritası (düz leylak şerit yerine tanecikli, güneşle tepki veren pastel asfalt)
let asphaltPair = null
export function getAsphaltPair() {
  if (asphaltPair) return asphaltPair
  const N = 512
  const cv = document.createElement('canvas')
  cv.width = cv.height = N
  const g = cv.getContext('2d')
  const bcv = document.createElement('canvas')
  bcv.width = bcv.height = N
  const bg = bcv.getContext('2d')

  // temel ton: sıcak pastel arduvaz-leylak (binalar ve kaldırımlarla uyumlu, belirgin kontrast)
  g.fillStyle = '#8b8399'
  g.fillRect(0, 0, N, N)
  bg.fillStyle = '#808080'
  bg.fillRect(0, 0, N, N)

  let seed = 4219
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  const wrapDot = (ctx, x, y, r, fill) => {
    ctx.fillStyle = fill
    for (const ox of [-N, 0, N]) {
      if (x + ox + r < 0 || x + ox - r > N) continue
      for (const oy of [-N, 0, N]) {
        if (y + oy + r < 0 || y + oy - r > N) continue
        ctx.beginPath()
        ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  // yumuşak organik asfalt ton geçişleri
  for (let i = 0; i < 42; i++) {
    const x = rand() * N
    const y = rand() * N
    const r = 28 + rand() * 58
    const dark = rand() > 0.45
    wrapDot(g, x, y, r, dark ? 'rgba(92,84,110,0.12)' : 'rgba(182,175,198,0.10)')
  }

  // ince agrega / çakıl tanecikleri (hem renk hem kabartma haritası)
  for (let i = 0; i < 4800; i++) {
    const x = rand() * N
    const y = rand() * N
    const sz = 1 + rand() * 2.2
    const v = rand()
    if (v < 0.48) {
      g.fillStyle = 'rgba(72,66,86,0.34)'
      bg.fillStyle = 'rgba(60,60,60,0.45)'
    } else if (v < 0.86) {
      g.fillStyle = 'rgba(218,212,230,0.30)'
      bg.fillStyle = 'rgba(205,205,205,0.42)'
    } else {
      g.fillStyle = 'rgba(246,238,228,0.38)'
      bg.fillStyle = 'rgba(240,240,240,0.5)'
    }
    g.fillRect(x, y, sz, sz)
    bg.fillRect(x, y, sz, sz)
  }

  // çok ince kılcal yüzey dokusu çizgileri
  g.strokeStyle = 'rgba(72,66,88,0.14)'
  g.lineWidth = 1.2
  for (let i = 0; i < 6; i++) {
    let x = rand() * N
    let y = rand() * N
    g.beginPath()
    g.moveTo(x, y)
    for (let s = 0; s < 5; s++) {
      x += (rand() - 0.5) * 44
      y += (rand() - 0.5) * 44
      g.lineTo(x, y)
    }
    g.stroke()
  }

  const map = new CanvasTexture(cv)
  map.wrapS = map.wrapT = RepeatWrapping
  map.colorSpace = SRGBColorSpace
  map.anisotropy = 4
  const bump = new CanvasTexture(bcv)
  bump.wrapS = bump.wrapT = RepeatWrapping
  bump.anisotropy = 4
  asphaltPair = { map, bump }
  return asphaltPair
}

// Yumuşak kenar: alt zeminle karışsın diye alfa haritası (kenara `feather` m kala saydamlaşır). Keskin geçişler "2006 oyunu" gibi duruyordu.
const featherCache = new Map()
export function featherTexture(w, d, f, round) {
  const key = `${round ? `r${round}` : `${w}x${d}`}|${f}`
  let t = featherCache.get(key)
  if (t) return t
  const N = 96
  const data = new Uint8Array(N * N * 4)
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N
      const v = (j + 0.5) / N
      let edge
      if (round) edge = (1 - Math.hypot(u - 0.5, v - 0.5) * 2) * round // dairesel: merkezden uzaklık
      else edge = Math.min(u * w, (1 - u) * w, v * d, (1 - v) * d)
      const x = Math.max(0, Math.min(1, edge / f))
      const a = Math.round(255 * x * x * (3 - 2 * x))
      const k = (j * N + i) * 4
      data[k] = data[k + 1] = data[k + 2] = a
      data[k + 3] = 255
    }
  }
  t = new DataTexture(data, N, N)
  t.minFilter = t.magFilter = LinearFilter
  t.needsUpdate = true
  featherCache.set(key, t)
  return t
}
