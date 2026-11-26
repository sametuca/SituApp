// Meshy avatar GLB dokularındaki siyah UV boşluklarını (gutter) üçgen kenarlarından dışarı doğru boyar
// ve WebP sıkıştırmasının UV kenarlarına sızdırdığı 1-2 px koyu çatlak izlerini temizler.
// Aynı zamanda avatarlara yumuşak, pürüzsüz pastel kil/oyuncak tonlaması (çatlak ve çamurlu gölge olmadan) ekler.
import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from 'three'

const fixedCache = new WeakMap() // original ImageBitmap/HTMLImageElement → CanvasTexture
const seamFixedTex = new WeakSet()

/**
 * Prop/toplanabilir/mekân GLB dokularındaki UV kenar çatlaklarını (mipmap sızıntısı ve normal haritası gürültüsü)
 * sıfır CPU maliyetiyle giderir; yüzeyleri yumuşak pastel kil/oyuncak görünümüne yaklaştırır.
 */
export function fixPropMaterialSeams(mat) {
  if (!mat) return
  if (mat.normalMap) {
    mat.normalMap = null
    mat.needsUpdate = true
  }
  if (typeof mat.roughness === 'number') mat.roughness = Math.max(mat.roughness, 0.46)
  if (typeof mat.metalness === 'number') mat.metalness = Math.min(mat.metalness, 0.12)
  for (const key of ['map', 'emissiveMap', 'roughnessMap', 'metalnessMap']) {
    const tex = mat[key]
    if (!tex || seamFixedTex.has(tex)) continue
    seamFixedTex.add(tex)
    tex.generateMipmaps = false
    tex.minFilter = LinearFilter
    tex.magFilter = LinearFilter
    tex.needsUpdate = true
  }
}

/**
 * Mesh'in gerçek UV üçgen maskesini çıkarır, UV kenarındaki WebP siyah sızıntısını temizler
 * ve boşlukları komşu ada rengiyle 10 px doldurur. Göz bebeği/kaş gibi ada içi koyu detaylara dokunmaz.
 */
export function getCleanAvatarTexture(mesh, origTex) {
  const img = origTex?.image
  if (!img || !img.width || !img.height) return origTex
  const hit = fixedCache.get(img)
  if (hit) return hit

  const w = img.width
  const h = img.height
  const uv = mesh.geometry?.attributes?.uv
  if (!uv) return origTex

  // 1. Gerçek UV üçgenlerini maskeye çiz (sadece adaların İCİ beyaz = 255)
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = w
  maskCanvas.height = h
  const mctx = maskCanvas.getContext('2d', { willReadFrequently: true })
  mctx.fillStyle = '#000'
  mctx.fillRect(0, 0, w, h)
  mctx.fillStyle = '#fff'

  const idx = mesh.geometry.index
  const triCount = idx ? idx.count / 3 : uv.count / 3
  const flipV = Boolean(origTex.flipY)
  const uvX = (i) => (((uv.getX(i) % 1) + 1) % 1) * w
  const uvY = (i) => {
    const v = ((uv.getY(i) % 1) + 1) % 1
    return (flipV ? 1 - v : v) * h
  }
  mctx.beginPath()
  for (let t = 0; t < triCount; t++) {
    const a = idx ? idx.getX(t * 3) : t * 3
    const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1
    const c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2
    mctx.moveTo(uvX(a), uvY(a))
    mctx.lineTo(uvX(b), uvY(b))
    mctx.lineTo(uvX(c), uvY(c))
    mctx.closePath()
  }
  mctx.fill()
  const maskPx = mctx.getImageData(0, 0, w, h).data

  // 2. Orijinal dokuyu oku
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, w, h)
  const imgData = ctx.getImageData(0, 0, w, h)
  const px = imgData.data
  const total = w * h

  // inside[i] = 1: UV üçgeni içinde, 0: siyah UV boşluğu
  const inside = new Uint8Array(total)
  for (let i = 0; i < total; i++) {
    inside[i] = maskPx[i * 4] > 127 ? 1 : 0
  }

  // Yalnızca UV üçgenlerinin DIŞINDAKİ boşlukları (inside=0) doldur; koyu saç/kaş piksellerini asla silme
  const valid = inside

  // 3. 10 adımlı 8-komşulu genişletme (dilation): hem kenar artıkları hem UV boşlukları komşu ada rengiyle dolar
  let curValid = valid
  let nextValid = new Uint8Array(total)
  const nextPx = new Uint8ClampedArray(px)
  const DIRS = [-1, 1, -w, w, -w - 1, -w + 1, w - 1, w + 1]

  for (let pass = 0; pass < 10; pass++) {
    nextValid.set(curValid)
    let changed = false
    for (let y = 0; y < h; y++) {
      const row = y * w
      for (let x = 0; x < w; x++) {
        const i = row + x
        if (curValid[i]) continue
        let sr = 0
        let sg = 0
        let sb = 0
        let cnt = 0
        for (let d = 0; d < 8; d++) {
          const ni = i + DIRS[d]
          if (ni < 0 || ni >= total) continue
          const nx = ni % w
          if (Math.abs(nx - x) > 1) continue
          if (!curValid[ni]) continue
          const no = ni * 4
          sr += px[no]
          sg += px[no + 1]
          sb += px[no + 2]
          cnt++
        }
        if (cnt > 0) {
          const o = i * 4
          nextPx[o] = (sr / cnt) | 0
          nextPx[o + 1] = (sg / cnt) | 0
          nextPx[o + 2] = (sb / cnt) | 0
          nextPx[o + 3] = 255
          nextValid[i] = 1
          changed = true
        }
      }
    }
    px.set(nextPx)
    const tmp = curValid
    curValid = nextValid
    nextValid = tmp
    if (!changed) break
  }

  ctx.putImageData(imgData, 0, 0)

  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.flipY = origTex.flipY
  tex.wrapS = origTex.wrapS
  tex.wrapT = origTex.wrapT
  tex.magFilter = LinearFilter
  tex.minFilter = LinearFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true

  fixedCache.set(img, tex)
  return tex
}

/**
 * Avatar malzemesine canlı, pürüzsüz pastel kil/oyuncak tonlaması ekler:
 * gölge tarafında veya gecede ten/saç/kıyafet çamurlaşmaz, oyunun pastel diline uyum sağlar.
 * avatarLook.js ile tam uyumludur (renk değişimi sonrası çalışır).
 */
export function applyPastelShading(mat) {
  if (!mat || mat.userData.pastelDone) return
  mat.userData.pastelDone = true
  if (typeof mat.roughness === 'number') mat.roughness = Math.max(0.46, Math.min(mat.roughness, 0.78))
  if (typeof mat.metalness === 'number') mat.metalness = Math.min(mat.metalness, 0.05)
  const prev = mat.onBeforeCompile
  const prevKey = mat.customProgramCacheKey
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer)
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <alphamap_fragment>',
        `#include <alphamap_fragment>
        {
          float _pl = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          vec3 _sat = mix(vec3(_pl), diffuseColor.rgb, 1.12);
          diffuseColor.rgb = clamp(_sat * 1.04 + vec3(0.012, 0.008, 0.006), 0.0, 1.0);
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * 0.28;`,
      )
  }
  mat.customProgramCacheKey = () => `${prevKey ? prevKey.call(mat) : 'std'}-pastel`
  mat.needsUpdate = true
}
