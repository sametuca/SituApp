// Avatar renklendirme: GLB dokuları düz renkli yamalardan oluşur. Saç ve kıyafet = (kemik bölgesi: baş / gövde) + (dokudaki orijinal renge yakınlık),
// göz = beyaz göz akı köşelerinden bulunan göz merkezleri çevresindeki koyu yamalar. Renk, orijinal gölge/ışık değişimini koruyarak değişir.
// Kullanım: applyLook(modelClone, slug, look) — look { h, e, o } (lookData.js). Yalnızca klonlanmış malzemeye dokunur.
import { Color, Float32BufferAttribute, Vector2, Vector3 } from 'three'
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
  const lum = (c) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255
  const dirDist = (a, b) => {
    const la = Math.hypot(a[0] + 8, a[1] + 8, a[2] + 8)
    const lb = Math.hypot(b[0] + 8, b[1] + 8, b[2] + 8)
    return Math.hypot((a[0] + 8) / la - (b[0] + 8) / lb, (a[1] + 8) / la - (b[1] + 8) / lb, (a[2] + 8) / la - (b[2] + 8) / lb)
  }
  const isSkinTone = (c, skins, shadeRatio = 0.58) =>
    skins.some((s) => dist(s, c) < 0.17 || (dirDist(s, c) < 0.105 && lum(c) > lum(s) * shadeRatio && lum(c) < lum(s) * 1.5))
  const cluster = (cols, max, minShare, exclude = [], skinFilter = null) => {
    const m = new Map()
    for (const c of cols) {
      if (c[0] + c[1] + c[2] < 60) continue // siyah boşluk/kenar
      if (exclude.some((e) => dist(e, c) < 0.16)) continue
      if (skinFilter && isSkinTone(c, skinFilter.skins, skinFilter.ratio)) continue
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
  // Koyu tenli avatarlarda (örn. Elif) yüzdeki gölgeli ten saç sanılmasın: aynı renk yönündeki ten tonlarını dışla
  const hair = cluster(heads.filter((c) => !nearWhite(c)), 6, 0.025, skin, { skins: skin, ratio: 0.62 }).filter((c) => !greyish(c)).slice(0, HAIR_N)
  const out = {
    skin,
    hair,
    outfit: cluster(bodies, 5, 0.04, [...skin, ...hair], { skins: skin, ratio: 0.55 }).slice(0, 4), // gölgeli kol/bacak teni kıyafet sayılmaz
  }
  analysis.set(key, out)
  return out
}

/** Göz akı (nötr beyaz) yamalarından iki göz merkezi bulur (bind pozu, mesh yerel koordinatı). */
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
  let cx = 0, cz = 0, n = 0, minY = Infinity, maxY = -Infinity
  for (let i = 0; i < pos.count; i++) {
    if (head.getX(i) > 0.9) {
      const y = pos.getY(i)
      cx += pos.getX(i)
      cz += pos.getZ(i)
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      n++
    }
  }
  if (!n) return res
  cx /= n
  cz /= n
  const headH = maxY - minY
  const eyeY0 = minY + headH * 0.34
  const eyeY1 = minY + headH * 0.72
  const pts = []
  for (let i = 0; i < pos.count; i++) {
    const py = pos.getY(i)
    if (head.getX(i) < 0.9 || pos.getZ(i) < cz || Math.abs(pos.getX(i) - cx) < 0.05 || py < eyeY0 || py > eyeY1) continue // yüzün önü, göz bandı
    const x = Math.min(w - 1, Math.max(0, Math.floor(uv.getX(i) * w)))
    const y = Math.min(h - 1, Math.max(0, Math.floor(uv.getY(i) * h)))
    const o = (y * w + x) * 4
    const r = px[o], gr = px[o + 1], b = px[o + 2]
    const mn = Math.min(r, gr, b), mx = Math.max(r, gr, b)
    if (mn > 185 && mx - mn < 32) pts.push([pos.getX(i), py, pos.getZ(i)]) // yalnızca nötr beyaz göz akı (sarı saç/ten hariç)
  }
  res.pts = pts.length
  if (pts.length < 4) return res
  const mean = (arr) => [0, 1, 2].map((k) => arr.reduce((s, p) => s + p[k], 0) / arr.length)
  const L = pts.filter((p) => p[0] < cx)
  const R = pts.filter((p) => p[0] >= cx)
  if (!L.length || !R.length) return res
  res.eyes = [mean(L), mean(R)]
  res.r = Math.max(0.015, Math.abs(res.eyes[0][0] - res.eyes[1][0]) * 0.21)
  return res
}

const GLSL = /* glsl */ `
uniform vec3 uHairRef[${HAIR_N}];
uniform vec3 uOutRef[${OUT_N}];
uniform vec3 uSkinRef[3];
uniform vec3 uHairTo; uniform vec3 uOutTo; uniform vec3 uEyeTo;
uniform float uUseHair; uniform float uUseOut; uniform float uUseEye;
uniform vec3 uEyeC0; uniform vec3 uEyeC1; uniform float uEyeR;
varying float vHead; varying float vHand; varying float vFoot; varying vec3 vBind;
uniform float uHairMinY;
uniform vec3 uBrow; uniform vec2 uBrowX; // uBrowX: yüz orta x, yarı genişlik // x: yüz bandı alt y, y: üst y, z: yüzün ön z eşiği
float lookLum(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }
float lookSkinMask(vec3 sc, vec3 skinRef[3], float minRatio){
  float bestD = 9.0; float bestDir = 9.0; float sl = 0.5;
  vec3 ns = normalize(sc + vec3(0.03));
  float scl = lookLum(sc);
  for (int i=0;i<3;i++){
    if (skinRef[i].r < 0.0) continue;
    float d = distance(sc, skinRef[i]);
    float dd = distance(ns, normalize(skinRef[i] + vec3(0.03)));
    float rl = lookLum(skinRef[i]);
    if (d < bestD){ bestD = d; }
    if (dd < bestDir && scl > rl * minRatio && scl < rl * 1.55){ bestDir = dd; sl = rl; }
  }
  float m1 = 1.0 - smoothstep(0.08, 0.16, bestD);
  float m2 = 1.0 - smoothstep(0.06, 0.115, bestDir);
  return max(m1, m2);
}
vec3 lookRecolor(vec3 col, vec3 ref, vec3 to, float w){
  float k = clamp(mix(1.0, lookLum(col)/max(lookLum(ref),0.04), 0.4), 0.72, 1.18); // gölgeyi koru, kontrastı yumuşat (pastel kalsın)
  vec3 t = clamp(to*k, 0.0, 1.0);
  return mix(col, t, w);
}
vec3 lookApply(vec3 col){
  vec3 res = col;
  float tol = 0.14;
  vec3 sc = pow(col, vec3(0.4545));
  float hairW = 0.0; vec3 hairRef = uHairRef[0];
  {
    float best = 9.0;
    for (int i=0;i<${HAIR_N};i++){ float d = distance(sc, uHairRef[i]); if (d<best){best=d;hairRef=uHairRef[i];} }
    float skinH = 9.0;
    for (int i=0;i<3;i++) skinH = min(skinH, distance(sc, uSkinRef[i]));
    float faceSkin = lookSkinMask(sc, uSkinRef, 0.60);
    // yüzde gölgeli ten saça dönmesin (hem öklid hem renk-yönü ten koruması); ense/tepede (yüzün gerisi) daha serbest
    hairW = (1.0 - smoothstep(tol*0.68, tol*1.2, best)) * mix(1.0, (1.0 - faceSkin) * smoothstep(-0.02, 0.03, skinH - best), step(uBrow.z, vBind.z));
  }
  // kaş / göz kapağı bandı saç sayılmaz (kaşlar ve kirpikler boyanmasın); sakal ve saç bu bandın dışında kalır
  float inBrow = step(uBrow.x, vBind.y) * step(vBind.y, uBrow.y) * step(uBrow.z, vBind.z) * step(abs(vBind.x - uBrowX.x), uBrowX.y) * step(0.9, vHead);
  hairW *= (1.0 - inBrow) * step(uHairMinY, vBind.y); // saç belden aşağıda olamaz (etek altı, pantolon)
  if (uUseHair > 0.5 && hairW > 0.0) res = lookRecolor(res, pow(hairRef, vec3(2.2)), uHairTo, hairW);
  if (uUseOut > 0.5 && vHead < 0.8 && vHand < 0.4) {
    // gövdede gölgeli ten dahil tüm ten alanları korunur; yalnızca gerçek kıyafet ve beyaz taban dışı kumaş boyanır
    float bodySkin = lookSkinMask(sc, uSkinRef, 0.52);
    float nonSkin = 1.0 - bodySkin;
    float notDark = smoothstep(0.05, 0.13, lookLum(sc));
    float whiteSole = step(0.25, vFoot) * smoothstep(0.68, 0.84, lookLum(sc)) * (1.0 - smoothstep(0.08, 0.16, max(sc.r,max(sc.g,sc.b)) - min(sc.r,min(sc.g,sc.b))));
    vec3 ref = vec3(0.0); float bd = 9.0;
    for (int i=0;i<${OUT_N};i++){ float d = distance(sc, uOutRef[i]); if (d<bd){bd=d;ref=uOutRef[i];} }
    float isKnownOut = 1.0 - smoothstep(0.14, 0.22, bd);
    float w = max(nonSkin, isKnownOut * (1.0 - bodySkin * 0.7)) * notDark * (1.0 - hairW) * (1.0 - whiteSole);
    if (bd > 0.3) ref = sc; // bilinmeyen yama: kendi parlaklığına göre
    res = lookRecolor(res, pow(ref, vec3(2.2)), uOutTo, w);
  }
  if (uUseEye > 0.5 && vHead > 0.9) {
    float d = min(distance(vBind, uEyeC0), distance(vBind, uEyeC1));
    float inEye = 1.0 - smoothstep(uEyeR*0.78, uEyeR, d);
    float ls = lookLum(sc); // algısal (sRGB) parlaklık: koyu irisler doğrusal uzayda 0.02'nin altına düşüp kaybolmasın
    float skinE = 9.0;
    for (int i=0;i<3;i++) skinE = min(skinE, distance(sc, uSkinRef[i]));
    float notSkinE = smoothstep(0.09, 0.17, skinE);
    float notWhite = 1.0 - smoothstep(0.46, 0.68, ls); // beyaz göz akı ve parlama noktası korunur
    float notPupil = smoothstep(0.03, 0.09, ls);       // tam siyah gözbebeği / kirpik korunur
    vec3 eyeCol = clamp(uEyeTo * (0.62 + ls * 1.15), 0.0, 1.0);
    res = mix(res, eyeCol, inEye * notWhite * notPupil * notSkinE);
  }
  return res;
}
`

/** Saçın inebileceği en düşük y: gövde boyunun yarısı (uzun saç kalçaya yetişmez; etek altı/pantolon saç sayılmaz). */
function hairMinY(mesh) {
  const g = mesh.geometry
  g.computeBoundingBox()
  const b = g.boundingBox
  return b.min.y + (b.max.y - b.min.y) * 0.5
}

/** Elif'in modelinde ayakların altında ayakla birlikte hareket eden beyaz disk (üretim artığı) var: ayakkabı izinin dışındaki taban üçgenlerini atar. Geometri klonlar arasında paylaşılır; bir kez uygulanır. */
export function trimBase(model, slug) {
  if (slug !== 'elif') return
  model.traverse((o) => {
    if (!o.isSkinnedMesh || o.geometry.userData.baseTrimmed) return
    const g = o.geometry, p = g.attributes.position, idx = g.index
    if (!idx) return
    const bad = (i) => {
      const x = Math.abs(p.getX(i)), y = p.getY(i), z = p.getZ(i)
      return y < -0.935 && (x > 0.215 || x < 0.025 || z < -0.125 || z > 0.235)
    }
    const out = []
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2)
      if (bad(a) || bad(b) || bad(c)) continue
      out.push(a, b, c)
    }
    g.setIndex(out)
    g.userData.baseTrimmed = true
  })
}

/** Klonlanmış model üzerine renk uygular; look boşsa (hepsi -1) hiçbir şey yapmaz. */
const matCache = new Map()
export function applyLook(model, slug, look) {
  if (!look || (look.h < 0 && look.e < 0 && look.o < 0)) return // renk seçilmemiş: orijinal malzeme, ek maliyet yok
  const useH = look.h >= 0, useE = look.e >= 0, useO = look.o >= 0
  model.traverse((o) => {
    if (!o.isSkinnedMesh || !o.material) return
    const ck = `${slug}:${look.h}.${look.e}.${look.o}`
    if (o.material.userData.lookKey === ck) return
    const hit = matCache.get(ck + ':' + o.geometry.uuid)
    if (hit) {
      ensureHead(o)
      o.material = hit // aynı görünümdeki oyuncular tek malzemeyi paylaşır (daha az program/uniform yükü)
      return
    }
    ensureHead(o)
    const eyes = useE || useH ? findEyes(slug, o) : null
    const img = o.material.map?.image
    if (!img) return
    const { px, w, h } = readPixels(img)
    const refs = findRefs(slug, o, px, w, h)
    const toVec = (arr, n) => Array.from({ length: n }, (_, i) => new Vector3(...(arr[Math.min(i, arr.length - 1)] ?? [-9, -9, -9]).map((v) => v / 255)))
    const mat = o.material.clone() // paylaşılan GLB malzemesini bozma
    o.material = mat
    const lin = (hex) => new Color(hex) // ColorManagement zaten sRGB→doğrusal çevirir
    const u = {
      uHairRef: { value: toVec(refs.hair, HAIR_N) },
      uSkinRef: { value: toVec(refs.skin, 3) },
      uOutRef: { value: toVec(refs.outfit, OUT_N) },
      uHairTo: { value: useH ? lin(HAIR_COLORS[look.h]) : new Color() },
      uOutTo: { value: useO ? lin(OUTFIT_COLORS[look.o]) : new Color() },
      uEyeTo: { value: useE ? lin(EYE_COLORS[look.e]) : new Color() },
      uUseHair: { value: useH ? 1 : 0 },
      uUseOut: { value: useO ? 1 : 0 },
      uUseEye: { value: useE && eyes?.eyes.length === 2 ? 1 : 0 },
      uEyeC0: { value: new Vector3(...(eyes?.eyes[0] ?? [0, 0, 0])) },
      uEyeC1: { value: new Vector3(...(eyes?.eyes[1] ?? [0, 0, 0])) },
      uHairMinY: { value: hairMinY(o) },
      uBrow: { value: eyes?.eyes.length === 2 ? new Vector3(eyes.eyes[0][1] - 0.07, eyes.eyes[0][1] + 0.095, Math.min(eyes.eyes[0][2], eyes.eyes[1][2]) - 0.07) : new Vector3(9, -9, 9) },
      uBrowX: { value: eyes?.eyes.length === 2 ? new Vector2((eyes.eyes[0][0] + eyes.eyes[1][0]) / 2, Math.abs(eyes.eyes[0][0] - eyes.eyes[1][0]) / 2 + 0.055) : new Vector2(0, 0) },
      uEyeR: { value: eyes?.r ?? 0.02 },
    }
    const prev = mat.onBeforeCompile
    mat.onBeforeCompile = (shader, renderer) => {
      prev?.call(mat, shader, renderer)
      Object.assign(shader.uniforms, u)
      shader.vertexShader = 'attribute float aHead; attribute float aHand; attribute float aFoot; varying float vHead; varying float vHand; varying float vFoot; varying vec3 vBind;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vHead = aHead; vHand = aHand; vFoot = aFoot; vBind = position;')
      shader.fragmentShader = GLSL + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = lookApply(diffuseColor.rgb);')
    }
    mat.customProgramCacheKey = () => 'look'
    mat.userData.lookKey = ck
    matCache.set(ck + ':' + o.geometry.uuid, mat)
    mat.needsUpdate = true
  })
}
