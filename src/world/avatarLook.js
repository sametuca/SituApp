// Avatar renklendirme: GLB dokuları düz renkli yamalardan oluşur. Saç ve kıyafet = (kemik bölgesi: baş / gövde) + (dokudaki orijinal renge yakınlık),
// göz = beyaz göz akı köşelerinden bulunan göz merkezleri çevresindeki koyu yamalar. Renk, orijinal gölge/ışık değişimini koruyarak değişir.
// Kullanım: applyLook(modelClone, slug, look) — look { h, e, o } (lookData.js). Yalnızca klonlanmış malzemeye dokunur.
import { Color, Float32BufferAttribute, Vector3 } from 'three'
import { HAIR_COLORS, EYE_COLORS, OUTFIT_COLORS } from './lookData'

const HAIR_N = 5
const OUT_N = 4

const analysis = new Map() // slug → { eyes: [[x,y,z],...], r }
if (import.meta.env?.DEV) window.__lookAnalysis = analysis
const pixels = new WeakMap() // texture görüntüsü → {px,w,h}
function readPixels(img) {
  let e = pixels.get(img)
  if (e) return e
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const cx = c.getContext('2d', { willReadFrequently: true })
  cx.drawImage(img, 0, 0)
  e = { px: cx.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height }
  pixels.set(img, e)
  return e
}

/** Kemik bölgesi ağırlıklarını öznitelik olarak ekler: aHead (baş), aHand (eller = ten kaynağı), aFoot (ayakkabı: kıyafetten sayılmaz). */
function ensureHead(mesh) {
  const g = mesh.geometry
  if (g.userData.headDone) return
  g.userData.headDone = true
  const n = g.attributes.position.count
  const head = new Float32Array(n)
  const hand = new Float32Array(n)
  const foot = new Float32Array(n)
  if (mesh.skeleton && g.attributes.skinIndex) {
    const names = mesh.skeleton.bones.map((b) => b.name)
    const kind = names.map((nm) => (/head/i.test(nm) && !/end/i.test(nm) ? 1 : /hand|thumb|index|middle|ring|pinky/i.test(nm) ? 2 : /foot|toe/i.test(nm) ? 3 : 0))
    const si = g.attributes.skinIndex
    const sw = g.attributes.skinWeight
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k)
        const t = kind[si.getComponent(i, k)]
        if (t === 1) head[i] += w
        else if (t === 2) hand[i] += w
        else if (t === 3) foot[i] += w
      }
    }
  }
  g.setAttribute('aHead', new Float32BufferAttribute(head, 1))
  g.setAttribute('aHand', new Float32BufferAttribute(hand, 1))
  g.setAttribute('aFoot', new Float32BufferAttribute(foot, 1))
}

const toSrgb = (c) => c / 255

/** Dokudan bölge renklerini çıkarır: ten (eller), saç (baştaki ten dışı baskın renkler), kıyafet (gövdedeki ten dışı baskın renkler). */
function findRefs(slug, mesh, px, w, h) {
  const key = `${slug}:refs`
  if (analysis.has(key)) return analysis.get(key)
  const g = mesh.geometry
  const uv = g.attributes.uv
  const A = (n) => g.attributes[n]
  const sample = (i) => {
    const x = Math.min(w - 1, Math.max(0, Math.floor(uv.getX(i) * w)))
    const y = Math.min(h - 1, Math.max(0, Math.floor(uv.getY(i) * h)))
    const o = (y * w + x) * 4
    return [px[o], px[o + 1], px[o + 2]]
  }
  const q = (c) => c.map((v) => Math.round(v / 24) * 24)
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / 255
  const cluster = (cols, max, minShare, exclude = []) => {
    const m = new Map()
    for (const c of cols) {
      if (c[0] + c[1] + c[2] < 60) continue // siyah boşluk/kenar
      if (exclude.some((e) => dist(e, c) < 0.16)) continue
      const k = q(c).join(',')
      const e = m.get(k) ?? { n: 0, s: [0, 0, 0] }
      e.n++
      for (let j = 0; j < 3; j++) e.s[j] += c[j]
      m.set(k, e)
    }
    return [...m.values()]
      .sort((a, b) => b.n - a.n)
      .filter((e) => e.n >= cols.length * minShare)
      .slice(0, max)
      .map((e) => e.s.map((v) => v / e.n))
  }
  const hands = [], heads = [], bodies = []
  for (let i = 0; i < uv.count; i++) {
    const hd = A('aHead').getX(i), hn = A('aHand').getX(i), ft = A('aFoot').getX(i)
    const c = sample(i)
    if (hn > 0.7) hands.push(c)
    else if (hd > 0.9) heads.push(c)
    else if (hd < 0.1 && hn < 0.2 && ft < 0.3) bodies.push(c)
  }
  const skin = cluster(hands, 3, 0.05)
  const nearWhite = (c) => Math.min(c[0], c[1], c[2]) > 200
  const greyish = (c) => Math.max(...c) - Math.min(...c) < 30 && Math.max(...c) > 150 // gri/beyaz: saç değil (göz akı, yaka)
  const hair = cluster(heads.filter((c) => !nearWhite(c)), 6, 0.025, skin).filter((c) => !greyish(c)).slice(0, HAIR_N)
  const out = {
    skin,
    hair,
    outfit: cluster(bodies, 5, 0.04, [...skin, ...hair]).slice(0, 4), // saç telleri omuzda gövde kemiğine bağlıysa kıyafet sayılmaz
  }
  analysis.set(key, out)
  return out
}

/** Göz akı (beyaz) yamalarından iki göz merkezi bulur (bind pozu, mesh yerel koordinatı). */
function findEyes(slug, mesh) {
  if (analysis.has(slug)) return analysis.get(slug)
  const res = { eyes: [], r: 0.02 }
  analysis.set(slug, res)
  const img = mesh.material.map?.image
  if (!img) return res
  const { px, w, h } = readPixels(img)
  const g = mesh.geometry
  const pos = g.attributes.position
  const uv = g.attributes.uv
  const head = g.attributes.aHead
  let cx = 0, cz = 0, n = 0
  for (let i = 0; i < pos.count; i++) if (head.getX(i) > 0.9) (cx += pos.getX(i), (cz += pos.getZ(i)), n++)
  if (!n) return res
  cx /= n
  cz /= n
  const pts = []
  for (let i = 0; i < pos.count; i++) {
    if (head.getX(i) < 0.9 || pos.getZ(i) < cz || Math.abs(pos.getX(i) - cx) < 0.05) continue // yüzün önü, orta hattan uzak
    const x = Math.min(w - 1, Math.max(0, Math.floor(uv.getX(i) * w)))
    const y = Math.min(h - 1, Math.max(0, Math.floor(uv.getY(i) * h)))
    const o = (y * w + x) * 4
    if (Math.min(px[o], px[o + 1], px[o + 2]) > 190) pts.push([pos.getX(i), pos.getY(i), pos.getZ(i)])
  }
  res.pts = pts.length
  if (pts.length < 4) return res
  const mean = (arr) => [0, 1, 2].map((k) => arr.reduce((s, p) => s + p[k], 0) / arr.length)
  const L = pts.filter((p) => p[0] < cx)
  const R = pts.filter((p) => p[0] >= cx)
  if (!L.length || !R.length) return res
  // her yanda en yüksek beyaz nokta grubu (ağız/diş daha aşağıdadır)
  const top = (arr) => {
    const ys = arr.map((p) => p[1]).sort((a, b) => b - a)
    const cut = ys[Math.min(ys.length - 1, Math.floor(ys.length * 0.5))]
    return arr.filter((p) => p[1] >= cut)
  }
  res.eyes = [mean(top(L)), mean(top(R))]
  res.r = Math.max(0.012, Math.abs(res.eyes[0][0] - res.eyes[1][0]) * 0.22)
  return res
}

const GLSL = /* glsl */ `
uniform vec3 uHairRef[${HAIR_N}];
uniform vec3 uOutRef[${OUT_N}];
uniform vec3 uHairTo; uniform vec3 uOutTo; uniform vec3 uEyeTo;
uniform float uUseHair; uniform float uUseOut; uniform float uUseEye;
uniform vec3 uEyeC0; uniform vec3 uEyeC1; uniform float uEyeR;
varying float vHead; varying vec3 vBind;
float lookLum(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }
vec3 lookRecolor(vec3 col, vec3 ref, vec3 to, float w){
  float k = clamp(lookLum(col)/max(lookLum(ref),0.04), 0.0, 1.6);
  vec3 t = clamp(to*k, 0.0, 1.0);
  return mix(col, t, w);
}
vec3 lookApply(vec3 col){
  vec3 res = col;
  float tol = 0.12;
  if (uUseHair > 0.5) {
    float best = 9.0; vec3 bref = uHairRef[0];
    for (int i=0;i<${HAIR_N};i++){ float d = distance(pow(col, vec3(0.4545)), uHairRef[i]); if (d<best){best=d;bref=uHairRef[i];} }
    float w = (1.0 - smoothstep(tol*0.6, tol, best));
    res = lookRecolor(res, pow(bref, vec3(2.2)), uHairTo, w);
  }
  if (uUseOut > 0.5 && vHead < 0.8) {
    float best = 9.0; vec3 bref = uOutRef[0];
    for (int i=0;i<${OUT_N};i++){ float d = distance(pow(col, vec3(0.4545)), uOutRef[i]); if (d<best){best=d;bref=uOutRef[i];} }
    float w = (1.0 - smoothstep(tol*0.6, tol, best)) * (1.0 - smoothstep(0.4, 0.8, vHead));
    res = lookRecolor(res, pow(bref, vec3(2.2)), uOutTo, w);
  }
  if (uUseEye > 0.5 && vHead > 0.9) {
    float d = min(distance(vBind, uEyeC0), distance(vBind, uEyeC1));
    float inEye = 1.0 - smoothstep(uEyeR*0.8, uEyeR, d);
    float l = lookLum(col);
    float dark = (1.0 - smoothstep(0.30, 0.55, l)) * smoothstep(0.02, 0.08, l);   // beyaz göz akı ve ten hariç, koyu iris
    float sat = max(col.r,max(col.g,col.b)) - min(col.r,min(col.g,col.b));
    res = mix(res, clamp(uEyeTo * (0.55 + l*1.2), 0.0, 1.0), inEye * dark * (1.0 - smoothstep(0.35, 0.6, sat)));
  }
  return res;
}
`

/** Klonlanmış model üzerine renk uygular; look boşsa (hepsi -1) hiçbir şey yapmaz. */
export function applyLook(model, slug, look) {
  if (!look) return
  const useH = look.h >= 0, useE = look.e >= 0, useO = look.o >= 0
  model.traverse((o) => {
    if (!o.isSkinnedMesh || !o.material) return
    ensureHead(o)
    const eyes = useE ? findEyes(slug, o) : null
    const img = o.material.map?.image
    if (!img) return
    const { px, w, h } = readPixels(img)
    const refs = findRefs(slug, o, px, w, h)
    const toVec = (arr, n) => Array.from({ length: n }, (_, i) => new Vector3(...(arr[Math.min(i, arr.length - 1)] ?? [-9, -9, -9]).map((v) => v / 255)))
    const mat = o.material.clone() // paylaşılan GLB malzemesini bozma
    o.material = mat
    const lin = (hex) => new Color(hex).convertSRGBToLinear()
    const u = {
      uHairRef: { value: toVec(refs.hair, HAIR_N) },
      uOutRef: { value: toVec(refs.outfit, OUT_N) },
      uHairTo: { value: useH ? lin(HAIR_COLORS[look.h]) : new Color() },
      uOutTo: { value: useO ? lin(OUTFIT_COLORS[look.o]) : new Color() },
      uEyeTo: { value: useE ? lin(EYE_COLORS[look.e]) : new Color() },
      uUseHair: { value: useH ? 1 : 0 },
      uUseOut: { value: useO ? 1 : 0 },
      uUseEye: { value: useE && eyes?.eyes.length === 2 ? 1 : 0 },
      uEyeC0: { value: new Vector3(...(eyes?.eyes[0] ?? [0, 0, 0])) },
      uEyeC1: { value: new Vector3(...(eyes?.eyes[1] ?? [0, 0, 0])) },
      uEyeR: { value: eyes?.r ?? 0.02 },
    }
    const prev = mat.onBeforeCompile
    mat.onBeforeCompile = (shader, renderer) => {
      prev?.call(mat, shader, renderer)
      Object.assign(shader.uniforms, u)
      shader.vertexShader = 'attribute float aHead; varying float vHead; varying vec3 vBind;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vHead = aHead; vBind = position;')
      shader.fragmentShader = GLSL + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = lookApply(diffuseColor.rgb);')
    }
    mat.customProgramCacheKey = () => 'look'
    mat.needsUpdate = true
  })
}
