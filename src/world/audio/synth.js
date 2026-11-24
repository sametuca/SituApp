// Ortak sentez parçaları (Web Audio). Hepsi (ac, out, t, ...) biçimindedir; ac gerçek AudioContext ya da OfflineAudioContext olabilir.
// Dış ses dosyası yok: her ses osilatör + gürültü + filtre + zarftan üretilir.

const noiseCache = new WeakMap()
/** Bağlam başına tek paylaşılan beyaz gürültü tamponu (2 sn, döngülenebilir). */
export function noiseBuf(ac) {
  let b = noiseCache.get(ac)
  if (!b) {
    b = ac.createBuffer(1, Math.floor(ac.sampleRate * 2), ac.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    noiseCache.set(ac, b)
  }
  return b
}

export const mtof = (m) => 440 * 2 ** ((m - 69) / 12)
export const rnd = (a, b) => a + Math.random() * (b - a)
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

function envGain(ac, out, t, a, d, g) {
  const gn = ac.createGain()
  gn.gain.setValueAtTime(0.0001, t)
  gn.gain.linearRampToValueAtTime(g, t + a)
  gn.gain.exponentialRampToValueAtTime(0.0001, t + a + d)
  gn.connect(out)
  return gn
}

/** Tek osilatör notası. o: { f, f2?, type, a, d, g, det, lp?, lp2?, q? } (f2: bitiş frekansı, lp/lp2: alçak geçiren başlangıç/bitiş). */
export function tone(ac, out, t, o) {
  const { f, f2, type = 'sine', a = 0.005, d = 0.3, g = 0.2, det = 0, lp, lp2, q = 0.7 } = o
  const osc = ac.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(f, t)
  if (f2) osc.frequency.exponentialRampToValueAtTime(f2, t + a + d)
  if (det) osc.detune.value = det
  const gn = envGain(ac, out, t, a, d, g)
  if (lp) {
    const fl = ac.createBiquadFilter()
    fl.type = 'lowpass'
    fl.Q.value = q
    fl.frequency.setValueAtTime(lp, t)
    if (lp2) fl.frequency.exponentialRampToValueAtTime(lp2, t + a + d)
    osc.connect(fl).connect(gn)
  } else osc.connect(gn)
  osc.start(t)
  osc.stop(t + a + d + 0.05)
}

/** Süzülmüş gürültü patlaması. o: { type, f, f2?, q, a, d, g } */
export function noise(ac, out, t, o) {
  const { type = 'bandpass', f = 2000, f2, q = 1, a = 0.002, d = 0.1, g = 0.2 } = o
  const src = ac.createBufferSource()
  src.buffer = noiseBuf(ac)
  const fl = ac.createBiquadFilter()
  fl.type = type
  fl.Q.value = q
  fl.frequency.setValueAtTime(f, t)
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + a + d)
  const gn = envGain(ac, out, t, a, d, g)
  src.connect(fl).connect(gn)
  src.start(t, Math.random() * 1.5)
  src.stop(t + a + d + 0.05)
}

/** Çan: inharmonik üst sesler, uzun sönüm. */
export function bell(ac, out, t, f, g = 0.15, d = 1.2) {
  tone(ac, out, t, { f, a: 0.003, d, g })
  tone(ac, out, t, { f: f * 2.76, a: 0.002, d: d * 0.55, g: g * 0.35 })
  tone(ac, out, t, { f: f * 5.4, a: 0.002, d: d * 0.25, g: g * 0.15 })
}

/** Marimba / ksilofon vuruşu: kısa, ahşap tınılı. */
export function mallet(ac, out, t, f, g = 0.18, d = 0.4) {
  tone(ac, out, t, { f, a: 0.002, d, g })
  tone(ac, out, t, { f: f * 4, a: 0.001, d: 0.07, g: g * 0.3 })
}

/** Müzik kutusu: ince, parlak, orta uzunlukta sönüm. */
export function musicBox(ac, out, t, f, g = 0.12, d = 1.0) {
  tone(ac, out, t, { f, a: 0.002, d, g })
  tone(ac, out, t, { f: f * 3.01, a: 0.001, d: d * 0.35, g: g * 0.3 })
  tone(ac, out, t, { f: f * 6.2, a: 0.001, d: 0.08, g: g * 0.12 })
}

/** Teller (ukulele/gitar benzeri): testere dalgası + hızlı kapanan filtre. */
export function pluck(ac, out, t, f, g = 0.1, d = 0.5) {
  tone(ac, out, t, { f, type: 'sawtooth', a: 0.003, d, g, lp: 3600, lp2: 500 })
}

/** Elektrikli piyano benzeri: üçgen + 2. harmonik. */
export function keys(ac, out, t, f, g = 0.1, d = 0.9) {
  tone(ac, out, t, { f, type: 'triangle', a: 0.006, d, g })
  tone(ac, out, t, { f: f * 2, a: 0.004, d: d * 0.4, g: g * 0.3 })
}

export function kick(ac, out, t, g = 0.45) {
  tone(ac, out, t, { f: 140, f2: 42, a: 0.002, d: 0.2, g })
  noise(ac, out, t, { type: 'lowpass', f: 400, a: 0.001, d: 0.02, g: g * 0.25 })
}
export const hat = (ac, out, t, g = 0.06, d = 0.04) => noise(ac, out, t, { type: 'highpass', f: 7000, q: 0.5, a: 0.001, d, g })
export const clap = (ac, out, t, g = 0.14) => {
  noise(ac, out, t, { type: 'bandpass', f: 1500, q: 1.2, a: 0.001, d: 0.1, g })
  noise(ac, out, t + 0.012, { type: 'bandpass', f: 1500, q: 1.2, a: 0.001, d: 0.12, g: g * 0.7 })
}
export const brush = (ac, out, t, g = 0.05, d = 0.11) => noise(ac, out, t, { type: 'bandpass', f: 5200, q: 0.6, a: 0.012, d, g })
export const bass = (ac, out, t, f, g = 0.2, d = 0.4) => tone(ac, out, t, { f, type: 'triangle', a: 0.01, d, g, lp: 700 })

/** Yumuşak pedal: her nota için 2 hafif detune'lu testere, yavaş giriş/çıkış. */
export function pad(ac, out, t, notes, dur, g = 0.04, lp = 900) {
  const fl = ac.createBiquadFilter()
  fl.type = 'lowpass'
  fl.frequency.value = lp
  fl.Q.value = 0.5
  const gn = ac.createGain()
  const att = Math.min(dur * 0.4, 1.2)
  gn.gain.setValueAtTime(0.0001, t)
  gn.gain.linearRampToValueAtTime(g, t + att)
  gn.gain.setValueAtTime(g, t + Math.max(att, dur - att))
  gn.gain.linearRampToValueAtTime(0.0001, t + dur + 0.2)
  fl.connect(gn).connect(out)
  for (const m of notes)
    for (const det of [-8, 8]) {
      const o = ac.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = mtof(m)
      o.detune.value = det
      o.connect(fl)
      o.start(t)
      o.stop(t + dur + 0.3)
    }
}

/**
 * Sürekli gürültü katmanı (dalga, yağmur, rüzgâr). lfo: { rate, depth } gain salınımı.
 * Döndürdüğü stop(at, fade) işlevi katmanı yumuşakça kapatır.
 */
export function noiseLayer(ac, out, { type = 'lowpass', f = 800, q = 0.5, g = 0.1, lfo, t = ac.currentTime, fade = 1.5 }) {
  const src = ac.createBufferSource()
  src.buffer = noiseBuf(ac)
  src.loop = true
  const fl = ac.createBiquadFilter()
  fl.type = type
  fl.frequency.value = f
  fl.Q.value = q
  const gn = ac.createGain()
  gn.gain.setValueAtTime(0.0001, t)
  gn.gain.linearRampToValueAtTime(g, t + fade)
  const nodes = [src]
  src.connect(fl).connect(gn).connect(out)
  if (lfo) {
    const o = ac.createOscillator()
    o.frequency.value = lfo.rate
    const dg = ac.createGain()
    dg.gain.value = g * lfo.depth
    o.connect(dg).connect(gn.gain)
    o.start(t)
    nodes.push(o)
  }
  src.start(t)
  let stopped = false
  return (at = ac.currentTime, f2 = 1.5) => {
    if (stopped) return
    stopped = true
    try {
      gn.gain.cancelScheduledValues(at)
      gn.gain.setValueAtTime(Math.max(gn.gain.value, 0.0001), at)
      gn.gain.linearRampToValueAtTime(0.0001, at + f2)
      nodes.forEach((n) => n.stop(at + f2 + 0.1))
    } catch {
      /* zaten durmuş */
    }
  }
}
