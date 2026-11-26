// Avatar GLB'lerinde yalnızca idle/walk/run klipleri var. Oturma ve dans, klibin ÜSTÜNE kemiklere eklenen
// procedural bir katmandır (mixer.update'ten sonra uygulanır, bu yüzden birikmez).
// Duruş verisi: src/world/features/togetherStore.js
import { MathUtils, Quaternion, Vector3 } from 'three'

const AX = new Vector3(1, 0, 0)
const AY = new Vector3(0, 1, 0)
const AZ = new Vector3(0, 0, 1)
const NAMES = {
  hips: 'Hips', spine: 'Spine01', head: 'Head',
  lUp: 'LeftUpLeg', lLeg: 'LeftLeg', rUp: 'RightUpLeg', rLeg: 'RightLeg',
  lArm: 'LeftArm', rArm: 'RightArm', lForeArm: 'LeftForeArm', rForeArm: 'RightForeArm',
}

// Oturan avatar ayakta olduğu yüksekliğin bu kadar altına iner (m); negatif değer koltuk/sele üstüne çıkarır.
const TOWEL_DROP = 0.38
export const SIT_DROP = { bench: -0.08, chair: -0.05, stool: 0.14, lounger: 0.06, floor: 0.42, bike: -0.27 }

const q1 = new Quaternion()
const q2 = new Quaternion()
const q3 = new Quaternion()
const q4 = new Quaternion()

/** model: klonlanmış, ölçeklenmiş avatar sahnesi. */
export function makeRig(model) {
  const bones = {}
  const rest = []
  const want = new Map(Object.entries(NAMES).map(([k, n]) => [n, k]))
  model.traverse((o) => {
    if (o.isBone) {
      rest.push([o, o.quaternion.clone(), o.position.clone()])
      const k = want.get(o.name)
      if (k && !bones[k]) bones[k] = o
    }
  })
  return { model, bones, rest, blend: 0, kind: null, style: 'bench', lead: false, moving: false, pedal: 0, dirty: false }
}

/** Kemiği, model eksenlerinde verilen eksen/açıyla döndürür (üst kemiğin dönüşü ne olursa olsun). */
function turn(rig, bone, axis, angle) {
  if (!bone || !angle) return
  bone.parent.getWorldQuaternion(q1)
  rig.model.getWorldQuaternion(q2)
  q2.invert().multiply(q1) // rel: model çerçevesi → üst kemik çerçevesi
  q3.setFromAxisAngle(axis, angle) // model çerçevesinde fark
  q4.copy(q2).invert().multiply(q3).multiply(q2) // üst kemik çerçevesine çevir
  bone.quaternion.premultiply(q4)
  bone.updateMatrixWorld(true) // çocuk kemikler (diz) güncel dönüşü görsün
}

const ease = (x) => x * x * (3 - 2 * x)

/** Meshy idle klibi yerine dik, sakin ayakta duruş (başlangıç pozu + kollar yanda; kemik ölçeği korunur). */
export function applyUprightIdle(rig) {
  const { model, bones, rest } = rig
  for (let i = 0; i < rest.length; i++) {
    const [b, q, p] = rest[i]
    b.quaternion.copy(q)
    b.position.copy(p)
  }
  model.updateWorldMatrix(true, true)
  turn(rig, bones.lArm, AZ, -1.25)
  turn(rig, bones.rArm, AZ, 1.25)
}

/** Olta tutuşu: kol açısı (AX, negatif = öne/yukarı) ve gövde eğimi. phase: cast | wait | bite | reel; t: fazın başından beri sn; now: saat sn. */
export function fishArm(phase, t, now) {
  let a = -1.15
  let lean = 0
  if (phase === 'cast') {
    const k = MathUtils.clamp(t / 0.8, 0, 1)
    a = -1.15 - 1.15 * Math.sin(k * Math.PI) * (k < 0.55 ? 1 : 0.55)
    lean = -0.12 * Math.sin(k * Math.PI) + 0.1 * ease(Math.max(0, (k - 0.5) * 2))
  } else if (phase === 'bite') {
    a = -1.15 - 0.28 * Math.abs(Math.sin(now * 14))
    lean = 0.05 * Math.sin(now * 14)
  } else if (phase === 'reel') {
    const k = MathUtils.clamp(t / 0.5, 0, 1)
    a = -1.15 - 0.75 * Math.sin(k * Math.PI)
    lean = -0.1 * Math.sin(k * Math.PI)
  } else a = -1.15 + Math.sin(now * 1.6) * 0.035
  return { a, lean }
}

/** Her karede (mixer.update'ten sonra) çağır. pose: together pose ya da null. */
export function applyPose(rig, pose, dt) {
  const goal = pose ? 1 : 0
  if (pose) {
    rig.kind = pose.kind
    rig.style = pose.style ?? rig.style
    rig.lead = Boolean(pose.lead)
    rig.moving = Boolean(pose.moving)
    rig.t0 = pose.t0 ?? 0
    rig.phase = pose.phase ?? null
    rig.seat = pose.seat ?? null
  }
  rig.blend += Math.sign(goal - rig.blend) * Math.min(Math.abs(goal - rig.blend), dt * (pose ? 4 : 6))
  const { model, bones } = rig
  if (rig.blend <= 0.001) {
    if (rig.dirty) {
      model.position.y = 0
      model.position.z = 0
      model.rotation.y = 0
      rig.dirty = false
    }
    return
  }
  rig.dirty = true
  const b = ease(rig.blend)
  model.updateWorldMatrix(true, true) // mixer kemikleri değiştirdi; dünya matrislerini tazele

  if (rig.kind === 'sit') {
    // havlu (yerde düz) şezlongdan çok daha alçak: gövde havlunun üstüne yatar (id'ler layout.js SEATS_TOWEL `tw<n>`)
    const onTowel = rig.style === 'lounger' && String(rig.seat ?? '').startsWith('tw')
    model.position.y = -(onTowel ? TOWEL_DROP : SIT_DROP[rig.style]) * b
    // kanepe (seat kimliği 'sofa…', stil bench): oturak/ön panel yüzünden ayaklar kaybolmasın diye biraz yukarı ve ileri
    const onSofa = rig.style === 'bench' && /(^|\/)sofa/i.test(String(rig.seat ?? ''))
    if (onSofa) model.position.y += 0.07 * b
    model.position.z = rig.style === 'bike' ? -0.28 * b : onSofa ? 0.1 * b : 0
    if (rig.style === 'lounger') {
      // şezlong / havlu: keyifle arkaya uzan, baş hafif yukarıda, kollar yanlarda rahat
      // havlu yere düz serilir (neredeyse yatay); şezlongun arkalığı eğimlidir (≈55°): daha dik yaslan ki gövde arkalığa gömülmesin
      turn(rig, bones.hips, AX, (onTowel ? -1.25 : -0.98) * b)
      turn(rig, bones.head, AX, (onTowel ? 0.48 : 0.3) * b)
      turn(rig, bones.lArm, AX, -0.28 * b)
      turn(rig, bones.rArm, AX, -0.28 * b)
      turn(rig, bones.lArm, AZ, 0.22 * b)
      turn(rig, bones.rArm, AZ, -0.22 * b)
    } else if (rig.style === 'bike') {
      // bisiklet: sele üstüne otur, gövde öne eğilir, eller gidon elciklerine tam kavuşur
      model.position.z = -0.14 * b
      if (rig.moving) rig.pedal += Math.min(dt, 0.1) * 10
      const pL = rig.pedal
      const pR = rig.pedal + Math.PI
      if (rig.moving) model.position.y += Math.abs(Math.sin(rig.pedal)) * 0.015 * b
      turn(rig, bones.hips, AZ, (rig.moving ? Math.sin(rig.pedal) * 0.04 : 0) * b)
      turn(rig, bones.lUp, AX, (-0.95 + Math.sin(pL) * 0.38) * b)
      turn(rig, bones.rUp, AX, (-0.95 + Math.sin(pR) * 0.38) * b)
      turn(rig, bones.lLeg, AX, (1.15 - Math.cos(pL) * 0.34) * b)
      turn(rig, bones.rLeg, AX, (1.15 - Math.cos(pR) * 0.34) * b)
      turn(rig, bones.spine, AX, 0.34 * b)
      turn(rig, bones.lArm, AX, -1.72 * b)
      turn(rig, bones.rArm, AX, -1.72 * b)
      turn(rig, bones.lArm, AZ, 0.12 * b)
      turn(rig, bones.rArm, AZ, -0.12 * b)
      turn(rig, bones.lArm, AY, -0.08 * b)
      turn(rig, bones.rArm, AY, 0.08 * b)
      turn(rig, bones.lForeArm, AX, -0.18 * b)
      turn(rig, bones.rForeArm, AX, -0.18 * b)
    } else {
      turn(rig, bones.lUp, AX, -1.45 * b)
      turn(rig, bones.rUp, AX, -1.45 * b)
      turn(rig, bones.lLeg, AX, 1.5 * b)
      turn(rig, bones.rLeg, AX, 1.5 * b)
      turn(rig, bones.lArm, AX, -0.35 * b)
      turn(rig, bones.rArm, AX, -0.35 * b)
    }
  } else if (rig.kind === 'work') {
    const t = performance.now() / 1000 - rig.t0
    const now = performance.now() / 1000
    if (rig.style === 'fish') {
      // olta: iki elle tutulur; atış = geriye savurup öne bırak, bekleme = hafif sallanma, vurdu = sert çekiş, çekme = yukarı kaldır
      const { a, lean } = fishArm(rig.phase, t, now)
      turn(rig, bones.lArm, AX, (a + 0.12) * b)
      turn(rig, bones.rArm, AX, a * b)
      turn(rig, bones.spine, AX, lean * b)
      turn(rig, bones.head, AX, (rig.phase === 'bite' ? 0.14 : 0.05) * b)
    } else if (rig.style === 'carry') {
      // paketi göğüs hizasında iki kolla taşır; yürürken hafif yaylanır
      const bob = Math.sin(now * 7) * 0.025
      turn(rig, bones.lArm, AX, (-1.22 + bob) * b)
      turn(rig, bones.rArm, AX, (-1.22 + bob) * b)
      turn(rig, bones.lArm, AZ, -0.28 * b)
      turn(rig, bones.rArm, AZ, 0.28 * b)
      turn(rig, bones.spine, AX, -0.05 * b)
    } else if (rig.style === 'tend') {
      // bahçe işi: öne eğilip toprağa uzanır, küçük kürek/sulama hareketi
      const k = MathUtils.clamp(t / 0.35, 0, 1)
      const dig = Math.sin(now * 9) * 0.18
      turn(rig, bones.spine, AX, 0.62 * ease(k) * b)
      turn(rig, bones.hips, AX, 0.12 * ease(k) * b)
      turn(rig, bones.head, AX, -0.25 * b)
      turn(rig, bones.lArm, AX, (-1.35 + dig) * b)
      turn(rig, bones.rArm, AX, (-1.35 - dig) * b)
      model.position.y = -0.06 * ease(k) * b
    }
  } else if (rig.kind === 'dance') {
    model.position.z = 0
    const t = performance.now() / 1000 - rig.t0
    const beat = t * Math.PI * 2 * 1.8 // ~108 BPM
    if (rig.style === 'dj') {
      // DJ kabini performansı: sahne üstünde (+0.34m), sol el pikapta scratch, sağ el havada ritim tutar, baş sallar
      const bounce = Math.abs(Math.sin(beat))
      model.position.y = (0.34 + bounce * 0.04) * b
      model.rotation.y = Math.sin(beat * 0.25) * 0.14 * b
      turn(rig, bones.spine, AX, (0.14 + bounce * 0.06) * b)
      turn(rig, bones.spine, AY, Math.sin(beat * 0.5) * 0.16 * b)
      turn(rig, bones.head, AX, (0.08 + Math.sin(beat * 2) * 0.14) * b)
      turn(rig, bones.head, AZ, Math.sin(beat * 0.5) * 0.1 * b)
      // sol el pikap üstünde scratch hareketi
      turn(rig, bones.lArm, AX, (-1.15 + Math.sin(beat * 2) * 0.12) * b)
      turn(rig, bones.lArm, AY, (0.18 + Math.sin(beat * 3) * 0.16) * b)
      turn(rig, bones.lForeArm, AX, -0.55 * b)
      // sağ el havada kalabalığı coşturur
      turn(rig, bones.rArm, AX, (-2.35 + Math.sin(beat) * 0.32) * b)
      turn(rig, bones.rArm, AZ, -0.25 * b)
      turn(rig, bones.rForeArm, AX, (-0.35 + Math.sin(beat) * 0.2) * b)
    } else if (rig.style === 'handsup') {
      // Festival dansı: iki kol havada sağa-sola dalgalanır, kalça ve diz yaylanır
      const sway = Math.sin(beat * 0.5)
      const hop = Math.abs(Math.sin(beat))
      model.position.y = hop * 0.1 * b
      turn(rig, bones.hips, AZ, sway * 0.16 * b)
      turn(rig, bones.hips, AY, sway * 0.22 * b)
      turn(rig, bones.spine, AZ, -sway * 0.14 * b)
      turn(rig, bones.head, AZ, sway * 0.16 * b)
      turn(rig, bones.head, AX, -0.08 * b)
      // kollar baş üstünde yumuşak dalga
      turn(rig, bones.lArm, AX, (-2.35 + Math.sin(beat) * 0.18) * b)
      turn(rig, bones.rArm, AX, (-2.35 - Math.sin(beat) * 0.18) * b)
      turn(rig, bones.lArm, AZ, (0.3 + sway * 0.35) * b)
      turn(rig, bones.rArm, AZ, (-0.3 + sway * 0.35) * b)
      turn(rig, bones.lForeArm, AX, -0.45 * b)
      turn(rig, bones.rForeArm, AX, -0.45 * b)
      // hafif diz yaylanması
      const knee = (1 - hop) * 0.22
      turn(rig, bones.lUp, AX, -knee * b)
      turn(rig, bones.rUp, AX, -knee * b)
      turn(rig, bones.lLeg, AX, knee * 1.4 * b)
      turn(rig, bones.rLeg, AX, knee * 1.4 * b)
      model.rotation.y = Math.sin(beat * 0.25) * 0.28 * b
    } else if (rig.style === 'groove') {
      // Ritmik groove / adım dansı: dirsekler bükülü omuz-gövde salınımı + dönüşümlü adım
      const step = Math.sin(beat * 0.5)
      const bounce = Math.abs(Math.sin(beat))
      model.position.y = bounce * 0.08 * b
      turn(rig, bones.hips, AY, step * 0.32 * b)
      turn(rig, bones.spine, AY, -step * 0.2 * b)
      turn(rig, bones.spine, AX, (0.06 + bounce * 0.06) * b)
      turn(rig, bones.head, AX, Math.sin(beat * 2) * 0.12 * b)
      turn(rig, bones.head, AY, -step * 0.12 * b)
      // dirsekler bükülü dönüşümlü kol pompası
      turn(rig, bones.lArm, AX, (-0.95 + step * 0.55) * b)
      turn(rig, bones.rArm, AX, (-0.95 - step * 0.55) * b)
      turn(rig, bones.lArm, AZ, 0.18 * b)
      turn(rig, bones.rArm, AZ, -0.18 * b)
      turn(rig, bones.lForeArm, AX, (-0.85 - step * 0.25) * b)
      turn(rig, bones.rForeArm, AX, (-0.85 + step * 0.25) * b)
      // dönüşümlü bacak adımı
      turn(rig, bones.lUp, AX, Math.min(0, -step * 0.38) * b)
      turn(rig, bones.rUp, AX, Math.min(0, step * 0.38) * b)
      turn(rig, bones.lLeg, AX, Math.max(0, step * 0.45) * b)
      turn(rig, bones.rLeg, AX, Math.max(0, -step * 0.45) * b)
      model.rotation.y = Math.sin(beat * 0.25) * 0.2 * b
    } else {
      model.position.y = Math.abs(Math.sin(beat)) * 0.14 * b // zıplama
      turn(rig, bones.hips, AZ, Math.sin(beat / 2) * 0.2 * b) // sağa sola salınım
      turn(rig, bones.spine, AZ, -Math.sin(beat / 2) * 0.12 * b)
      turn(rig, bones.head, AZ, Math.sin(beat / 2) * 0.14 * b)
      turn(rig, bones.lArm, AX, (-1.45 + Math.sin(beat) * 0.35) * b)
      turn(rig, bones.rArm, AX, (-1.45 + Math.cos(beat) * 0.35) * b)
      turn(rig, bones.lArm, AZ, 0.35 * b)
      turn(rig, bones.rArm, AZ, -0.35 * b)
      turn(rig, bones.lForeArm, AX, -0.55 * b)
      turn(rig, bones.rForeArm, AX, -0.55 * b)
      // 6 sn'lik döngüde önce davet eden, sonra eşi bir tur döner
      const k = MathUtils.clamp(((t % 6) - (rig.lead ? 1.5 : 4.5)) / 1.1, 0, 1)
      model.rotation.y = ease(k) * Math.PI * 2 * b
    }
  } else if (rig.kind === 'eat') {
    model.position.z = 0
    const t = performance.now() / 1000 - rig.t0
    if (rig.style === 'hold') {
      // balon tutma: sağ el havada hafifçe sallanır
      model.position.y = Math.abs(Math.sin(t * 3.5)) * 0.04 * b
      turn(rig, bones.rArm, AX, -1.65 * b)
      turn(rig, bones.rArm, AZ, -0.35 * b)
      turn(rig, bones.head, AX, -0.18 * b)
      turn(rig, bones.head, AZ, Math.sin(t * 3) * 0.1 * b)
    } else if (rig.style === 'read') {
      // gazete okuma: iki kol önde, baş hafifçe eğik
      model.position.y = 0
      turn(rig, bones.lArm, AX, -0.95 * b)
      turn(rig, bones.rArm, AX, -0.95 * b)
      turn(rig, bones.lArm, AY, 0.28 * b)
      turn(rig, bones.rArm, AY, -0.28 * b)
      turn(rig, bones.head, AX, 0.26 * b)
    } else if (rig.style === 'smell') {
      // çiçek koklama: sağ el yüze yaklaşır, baş hafifçe eğilir
      const sway = Math.sin(t * 3.2)
      model.position.y = Math.max(0, sway) * 0.02 * b
      turn(rig, bones.rArm, AX, (-1.15 - sway * 0.12) * b)
      turn(rig, bones.rArm, AY, -0.38 * b)
      turn(rig, bones.rForeArm, AX, -0.55 * b)
      turn(rig, bones.head, AX, (0.14 + sway * 0.08) * b)
      turn(rig, bones.head, AZ, sway * 0.12 * b)
    } else {
      // dondurma yeme: sağ kol ağıza doğru ritmik yaklaşıp uzaklaşır, mutlu baş sallama
      const bite = Math.sin(t * 7.2)
      model.position.y = Math.abs(Math.sin(t * 3.6)) * 0.03 * b
      turn(rig, bones.rArm, AX, (-1.2 - bite * 0.18) * b)
      turn(rig, bones.rArm, AY, -0.42 * b)
      turn(rig, bones.rForeArm, AX, (-0.55 - bite * 0.22) * b)
      turn(rig, bones.lArm, AZ, -0.12 * b)
      turn(rig, bones.head, AX, (0.12 + bite * 0.12) * b)
      turn(rig, bones.head, AZ, Math.sin(t * 3.6) * 0.08 * b)
    }
  } else if (rig.kind === 'push') {
    // dondurma arabası itme: iki kol öne uzanıp itme kolunu tutar (yürürken bacak animasyonu devam eder)
    model.position.z = 0
    turn(rig, bones.spine, AX, 0.14 * b)
    turn(rig, bones.lArm, AX, -1.08 * b)
    turn(rig, bones.rArm, AX, -1.08 * b)
    turn(rig, bones.lArm, AY, 0.16 * b)
    turn(rig, bones.rArm, AY, -0.16 * b)
    turn(rig, bones.lForeArm, AX, -0.22 * b)
    turn(rig, bones.rForeArm, AX, -0.22 * b)
  } else if (rig.kind === 'guard') {
    // kulüp bodyguard duruşu: dik omuzlar, doğal yanlarda sabit kollar, hafif açık ayak duruşu
    model.position.z = 0
    turn(rig, bones.spine, AX, -0.04 * b)
    turn(rig, bones.lArm, AZ, 0.06 * b)
    turn(rig, bones.rArm, AZ, -0.06 * b)
    turn(rig, bones.lUp, AZ, -0.05 * b)
    turn(rig, bones.rUp, AZ, 0.05 * b)
  }
}
