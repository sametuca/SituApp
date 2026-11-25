// Avatar GLB'lerinde yalnızca idle/walk/run klipleri var. Oturma ve dans, klibin ÜSTÜNE kemiklere eklenen
// procedural bir katmandır (mixer.update'ten sonra uygulanır, bu yüzden birikmez).
// Duruş verisi: src/world/features/togetherStore.js
import { MathUtils, Quaternion, Vector3 } from 'three'

const AX = new Vector3(1, 0, 0)
const AZ = new Vector3(0, 0, 1)
const NAMES = {
  hips: 'Hips', spine: 'Spine01', head: 'Head',
  lUp: 'LeftUpLeg', lLeg: 'LeftLeg', rUp: 'RightUpLeg', rLeg: 'RightLeg',
  lArm: 'LeftArm', rArm: 'RightArm',
}

// Oturan avatar ayakta olduğu yüksekliğin bu kadar altına iner (m); negatif değer koltuk minderine çıkarır.
export const SIT_DROP = { bench: -0.08, chair: -0.05, lounger: 0.12, floor: 0.42, bike: 0.05 }

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
  return { model, bones, rest, blend: 0, kind: null, style: 'bench', lead: false, dirty: false }
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
    rig.t0 = pose.t0 ?? 0
    rig.phase = pose.phase ?? null
  }
  rig.blend += Math.sign(goal - rig.blend) * Math.min(Math.abs(goal - rig.blend), dt * (pose ? 4 : 6))
  const { model, bones } = rig
  if (rig.blend <= 0.001) {
    if (rig.dirty) {
      model.position.y = 0
      model.rotation.y = 0
      rig.dirty = false
    }
    return
  }
  rig.dirty = true
  const b = ease(rig.blend)
  model.updateWorldMatrix(true, true) // mixer kemikleri değiştirdi; dünya matrislerini tazele

  if (rig.kind === 'sit') {
    model.position.y = -SIT_DROP[rig.style] * b
    if (rig.style === 'lounger') {
      // şezlong: arkaya yaslan, bacaklar ileri uzanır
      turn(rig, bones.hips, AX, -1.0 * b)
      turn(rig, bones.head, AX, 0.7 * b)
    } else if (rig.style === 'bike') {
      // bisiklet: hafif öne eğik, bacaklar pedala doğru yarı bükük, kollar gidonda
      turn(rig, bones.lUp, AX, -0.75 * b)
      turn(rig, bones.rUp, AX, -0.75 * b)
      turn(rig, bones.lLeg, AX, 0.85 * b)
      turn(rig, bones.rLeg, AX, 0.85 * b)
      turn(rig, bones.spine, AX, 0.18 * b)
      turn(rig, bones.lArm, AX, -0.9 * b)
      turn(rig, bones.rArm, AX, -0.9 * b)
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
    const t = performance.now() / 1000 - rig.t0
    const beat = t * Math.PI * 2 * 1.8 // ~108 BPM
    model.position.y = Math.abs(Math.sin(beat)) * 0.16 * b // zıplama
    turn(rig, bones.hips, AZ, Math.sin(beat / 2) * 0.22 * b) // sağa sola salınım
    turn(rig, bones.spine, AZ, -Math.sin(beat / 2) * 0.12 * b)
    turn(rig, bones.head, AZ, Math.sin(beat / 2) * 0.14 * b)
    turn(rig, bones.lArm, AZ, (0.9 + Math.sin(beat) * 0.35) * b)
    turn(rig, bones.rArm, AZ, -(0.9 + Math.cos(beat) * 0.35) * b)
    // 6 sn'lik döngüde önce davet eden, sonra eşi bir tur döner
    const k = MathUtils.clamp(((t % 6) - (rig.lead ? 1.5 : 4.5)) / 1.1, 0, 1)
    model.rotation.y = ease(k) * Math.PI * 2 * b
  }
}
