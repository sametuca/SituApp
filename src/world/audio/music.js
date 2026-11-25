// Üretken (generative) arka plan müziği; tamamen procedural. Bölgeye göre sahne (scene) seçilir, sahneler arasında crossfade yapılır.
// Zamanlama: AudioContext saatine göre ileriye plan (lookahead) — setInterval yalnızca planlayıcıyı uyandırır, nota zamanı ses saatindedir.
//
// Sahne: { bpm, step(c), ambience?(ac, out, t) → stop }.  step her 16'lık adımda çağrılır:
//   c = { ac, out, t, i, s (0-15), bar, st (sahneye özel durum), night (0..1), spb (adım süresi, sn) }
// Sahne kimlikleri: lobby, jazz, lounge, park, beach, house, home, arcade, pop
import { bass, bell, clap, hat, kick, keys, mallet, mtof, musicBox, noise, noiseLayer, pad, pluck, rnd, tone } from './synth'

const N = mtof
const chance = (p) => Math.random() < p
const walk = (st, key, len, maxStep = 2) => {
  st[key] = Math.max(0, Math.min(len - 1, (st[key] ?? Math.floor(len / 2)) + Math.round(rnd(-maxStep, maxStep))))
  return st[key]
}

// ---------------------------------------------------------------- remix sahneler (%100 özgün, telifsiz Web Audio)

// Ortak remix ritim & bas motoru: dört vuruşlu kick, senkoplu bas, çıtır hi-hat/clap ve 8 ölçülük akılda kalıcı melodi döngüsü.
function makeRemix({ bpm, prog, hookA, hookB, lead = 'mallet', padVol = 0.024, kickVol = 0.28, energy = 1, ambience }) {
  const CHORD_STEPS = new Set([0, 3, 6, 10, 14])
  const BASS_STEPS = new Set([0, 3, 6, 8, 11, 14])
  return {
    bpm,
    step({ ac, out, t, s, bar, spb }) {
      const b4 = bar % 4
      const b8 = bar % 8
      const ch = prog[b4]
      const root = ch[0]
      const isBreak = b8 === 7 && s >= 12 // 8. ölçü sonunda mini remix geçişi

      // Sıcak pad tabanı
      if (s === 0) pad(ac, out, t, ch, spb * 16, padVol, 1150)

      // Davul: dört vuruşlu kick + 2 & 4 clap + offbeat hat + 16'lık shaker
      if (s % 4 === 0 && !isBreak) kick(ac, out, t, kickVol)
      if (b4 === 3 && s === 14 && energy >= 0.8) kick(ac, out, t, kickVol * 0.72)
      if (s === 4 || s === 12) clap(ac, out, t, 0.075 * energy)
      if (isBreak && (s === 13 || s === 14 || s === 15)) clap(ac, out, t, 0.055 * energy)
      if (s % 4 === 2) hat(ac, out, t, 0.036 * energy, 0.07)
      else if (s % 2 === 1) hat(ac, out, t, 0.014 * energy, 0.022)

      // Senkoplu modern bas hattı (oktav sıçramalı)
      if (BASS_STEPS.has(s) && !isBreak) {
        const oct = s === 6 || s === 14 ? 0 : -12
        bass(ac, out, t, N(root + oct), 0.16 * (s === 0 ? 1.05 : 0.82), s === 0 || s === 8 ? 0.36 : 0.22)
      }

      // Senkoplu tropical-house / nu-disco akor vuruşları
      if (CHORD_STEPS.has(s)) {
        ch.forEach((m, k) => keys(ac, out, t + k * 0.008, N(m + 12), s === 0 ? 0.034 : 0.026, 0.28))
      }

      // Akılda kalıcı 8 ölçülük remix melodisi (ilk 4 ölçü ana tema, sonraki 4 ölçü parlak oktav varyasyonu)
      const seq = b8 < 4 ? hookA[b4] : hookB[b4]
      const note = seq?.[s]
      if (note) {
        if (lead === 'pluck') pluck(ac, out, t, N(note), 0.072, 0.45)
        else if (lead === 'synth') tone(ac, out, t, { f: N(note), type: 'triangle', a: 0.006, d: 0.26, g: 0.058, lp: 2800, lp2: 1100 })
        else mallet(ac, out, t, N(note), 0.068, 0.42)
        if (b8 >= 4 && s % 4 === 0) bell(ac, out, t, N(note + 12), 0.022, 0.65)
      }
    },
    ...(ambience ? { ambience } : {}),
  }
}

// Lobi: 116 BPM Pastel Nu-Disco Remix (Cmaj7 → Am9 → Fmaj7 → G13)
const lobby = makeRemix({
  bpm: 116,
  prog: [
    [48, 52, 55, 59],
    [45, 48, 52, 55],
    [41, 45, 48, 52],
    [43, 47, 50, 55],
  ],
  hookA: [
    [76, 0, 79, 0, 0, 76, 74, 0, 72, 0, 74, 0, 76, 0, 79, 0],
    [81, 0, 79, 0, 0, 76, 72, 0, 74, 0, 76, 0, 72, 0, 0, 0],
    [77, 0, 76, 0, 0, 72, 74, 0, 76, 0, 79, 0, 81, 0, 79, 0],
    [79, 0, 76, 0, 74, 0, 72, 0, 74, 0, 0, 76, 79, 0, 0, 0],
  ],
  hookB: [
    [84, 0, 79, 0, 81, 0, 76, 0, 79, 0, 76, 74, 72, 0, 76, 0],
    [81, 0, 84, 0, 79, 0, 76, 0, 72, 0, 74, 0, 76, 0, 79, 0],
    [81, 0, 79, 0, 77, 0, 76, 0, 74, 0, 76, 0, 79, 0, 84, 0],
    [83, 0, 79, 0, 76, 0, 74, 0, 79, 0, 81, 0, 83, 0, 0, 0],
  ],
  lead: 'mallet',
  kickVol: 0.25,
  energy: 0.9,
})

// Kafe & Fırın: 102 BPM Lo-Fi Chillhop Remix (sıcak elektrik piyano + yumuşak beat)
const jazz = makeRemix({
  bpm: 102,
  prog: [
    [50, 53, 57, 60],
    [43, 47, 50, 53],
    [48, 52, 55, 59],
    [45, 48, 52, 55],
  ],
  hookA: [
    [72, 0, 0, 74, 0, 0, 76, 0, 74, 0, 72, 0, 69, 0, 0, 0],
    [71, 0, 0, 74, 0, 0, 79, 0, 76, 0, 74, 0, 71, 0, 0, 0],
    [72, 0, 76, 0, 79, 0, 76, 0, 74, 0, 72, 0, 0, 0, 76, 0],
    [72, 0, 0, 71, 0, 0, 69, 0, 72, 0, 74, 0, 76, 0, 0, 0],
  ],
  hookB: [
    [77, 0, 76, 0, 74, 0, 72, 0, 74, 0, 76, 0, 72, 0, 0, 0],
    [79, 0, 76, 0, 74, 0, 71, 0, 74, 0, 76, 0, 79, 0, 0, 0],
    [84, 0, 79, 0, 76, 0, 74, 0, 72, 0, 74, 0, 76, 0, 0, 0],
    [76, 0, 74, 0, 72, 0, 69, 0, 72, 0, 76, 0, 0, 0, 0, 0],
  ],
  lead: 'pluck',
  padVol: 0.022,
  kickVol: 0.2,
  energy: 0.65,
})

const lounge = makeRemix({
  bpm: 96,
  prog: [
    [45, 48, 52, 55],
    [50, 53, 57, 60],
    [43, 47, 50, 55],
    [48, 52, 55, 59],
  ],
  hookA: [
    [72, 0, 0, 76, 0, 0, 79, 0, 76, 0, 72, 0, 0, 0, 0, 0],
    [74, 0, 0, 77, 0, 0, 81, 0, 77, 0, 74, 0, 0, 0, 0, 0],
    [71, 0, 0, 74, 0, 0, 79, 0, 74, 0, 71, 0, 0, 0, 0, 0],
    [72, 0, 74, 0, 76, 0, 79, 0, 76, 0, 0, 0, 0, 0, 0, 0],
  ],
  hookB: [
    [76, 0, 79, 0, 81, 0, 79, 0, 76, 0, 72, 0, 0, 0, 0, 0],
    [77, 0, 81, 0, 84, 0, 81, 0, 77, 0, 74, 0, 0, 0, 0, 0],
    [79, 0, 76, 0, 74, 0, 71, 0, 74, 0, 76, 0, 0, 0, 0, 0],
    [79, 0, 76, 0, 72, 0, 74, 0, 76, 0, 0, 0, 0, 0, 0, 0],
  ],
  lead: 'synth',
  padVol: 0.025,
  kickVol: 0.18,
  energy: 0.55,
})

// Park: 108 BPM Ferah Akustik Tropical Remix + hafif rüzgâr
const park = makeRemix({
  bpm: 108,
  prog: [
    [43, 47, 50, 55],
    [40, 43, 47, 52],
    [48, 52, 55, 60],
    [50, 54, 57, 62],
  ],
  hookA: [
    [79, 0, 76, 0, 74, 0, 71, 0, 74, 0, 76, 0, 79, 0, 0, 0],
    [76, 0, 74, 0, 71, 0, 67, 0, 71, 0, 74, 0, 76, 0, 0, 0],
    [79, 0, 76, 0, 72, 0, 74, 0, 76, 0, 79, 0, 81, 0, 0, 0],
    [78, 0, 74, 0, 71, 0, 74, 0, 78, 0, 79, 0, 0, 0, 0, 0],
  ],
  hookB: [
    [83, 0, 79, 0, 76, 0, 74, 0, 79, 0, 83, 0, 79, 0, 0, 0],
    [79, 0, 76, 0, 74, 0, 71, 0, 74, 0, 76, 0, 79, 0, 0, 0],
    [84, 0, 79, 0, 76, 0, 79, 0, 81, 0, 79, 0, 76, 0, 0, 0],
    [81, 0, 78, 0, 74, 0, 76, 0, 78, 0, 79, 0, 0, 0, 0, 0],
  ],
  lead: 'pluck',
  padVol: 0.02,
  kickVol: 0.2,
  energy: 0.72,
  ambience: (ac, out, t) => noiseLayer(ac, out, { type: 'bandpass', f: 500, q: 0.7, g: 0.016, lfo: { rate: 0.08, depth: 0.8 }, t, fade: 3 }),
})

// Plaj: 114 BPM Güneşli Tropical-House Remix (Fmaj7 → G6 → Em7 → Am7) + hafif okyanus esintisi
const beach = makeRemix({
  bpm: 114,
  prog: [
    [41, 45, 48, 52],
    [43, 47, 50, 55],
    [40, 43, 47, 50],
    [45, 48, 52, 55],
  ],
  hookA: [
    [81, 0, 79, 0, 76, 0, 72, 0, 76, 0, 79, 0, 81, 0, 79, 0],
    [79, 0, 76, 0, 74, 0, 71, 0, 74, 0, 76, 0, 79, 0, 0, 0],
    [79, 0, 76, 0, 74, 0, 71, 0, 76, 0, 74, 0, 72, 0, 0, 0],
    [76, 0, 72, 0, 74, 0, 76, 0, 79, 0, 81, 0, 79, 0, 0, 0],
  ],
  hookB: [
    [84, 0, 81, 0, 79, 0, 76, 0, 81, 0, 84, 0, 81, 0, 79, 0],
    [83, 0, 79, 0, 76, 0, 74, 0, 79, 0, 83, 0, 79, 0, 0, 0],
    [83, 0, 79, 0, 76, 0, 74, 0, 76, 0, 79, 0, 76, 0, 0, 0],
    [81, 0, 79, 0, 76, 0, 72, 0, 76, 0, 79, 0, 84, 0, 0, 0],
  ],
  lead: 'mallet',
  padVol: 0.024,
  kickVol: 0.26,
  energy: 0.95,
  ambience(ac, out, t) {
    const a = noiseLayer(ac, out, { type: 'lowpass', f: 850, q: 0.4, g: 0.065, lfo: { rate: 0.11, depth: 0.85 }, t, fade: 3 })
    const b = noiseLayer(ac, out, { type: 'highpass', f: 3500, q: 0.4, g: 0.008, lfo: { rate: 0.17, depth: 0.9 }, t, fade: 3 })
    return (at, f) => {
      a(at, f)
      b(at, f)
    }
  },
})

// Kulüp: 124 BPM Enerjik Festival House Remix (Am → F → C → G)
const house = makeRemix({
  bpm: 124,
  prog: [
    [45, 48, 52, 55],
    [41, 45, 48, 52],
    [48, 52, 55, 59],
    [43, 47, 50, 55],
  ],
  hookA: [
    [81, 0, 76, 81, 0, 79, 76, 0, 72, 0, 76, 0, 79, 0, 76, 0],
    [77, 0, 72, 77, 0, 76, 72, 0, 69, 0, 72, 0, 76, 0, 72, 0],
    [79, 0, 76, 79, 0, 84, 79, 0, 76, 0, 79, 0, 81, 0, 79, 0],
    [79, 0, 74, 79, 0, 76, 74, 0, 71, 0, 74, 0, 76, 0, 79, 0],
  ],
  hookB: [
    [84, 0, 81, 0, 79, 0, 76, 0, 81, 0, 84, 0, 88, 0, 84, 0],
    [81, 0, 77, 0, 76, 0, 72, 0, 77, 0, 81, 0, 84, 0, 81, 0],
    [84, 0, 79, 0, 76, 0, 79, 0, 84, 0, 88, 0, 84, 0, 79, 0],
    [83, 0, 79, 0, 76, 0, 74, 0, 79, 0, 83, 0, 86, 0, 83, 0],
  ],
  lead: 'synth',
  padVol: 0.022,
  kickVol: 0.36,
  energy: 1.15,
})

const SCALE_C = [72, 74, 76, 79, 81, 84]

// ev: müzik kutusu ninnisi
const HOME = [
  { root: 48, ch: [48, 52, 55] },
  { root: 43, ch: [43, 47, 50] },
  { root: 45, ch: [45, 48, 52] },
  { root: 41, ch: [41, 45, 48] },
]
const HOME_SCALE = [72, 74, 76, 79, 81, 84]
const home = {
  bpm: 68,
  step({ ac, out, t, s, bar, spb, st }) {
    const c = HOME[bar % 4]
    if (s === 0) {
      pad(ac, out, t, c.ch, spb * 16, 0.016, 600)
      musicBox(ac, out, t, N(c.root), 0.085, 1.6)
    }
    if (s === 8) musicBox(ac, out, t, N(c.ch[2]), 0.06, 1.2)
    if (s % 2 === 0 && chance(0.55)) {
      const k = walk(st, 'mel', HOME_SCALE.length, 2)
      musicBox(ac, out, t, N(HOME_SCALE[k]), 0.075, 1.3)
    }
  },
}

// oyun salonu: chiptune arpej
const ARCADE = [
  [60, 64, 67],
  [57, 60, 64],
  [53, 57, 60],
  [55, 59, 62],
]
const arcade = {
  bpm: 128,
  step({ ac, out, t, s, bar }) {
    const ch = ARCADE[bar % 4]
    const note = ch[[0, 1, 2, 1][s % 4]] + (s >= 8 ? 12 : 0)
    tone(ac, out, t, { f: N(note + 12), type: 'square', a: 0.002, d: 0.09, g: 0.03, lp: 3200 })
    if (s % 4 === 0) tone(ac, out, t, { f: N(ch[0] - 12), type: 'square', a: 0.003, d: 0.16, g: 0.04, lp: 900 })
    if (s % 2 === 1) hat(ac, out, t, 0.02, 0.025)
    if (s === 0 || s === 8) kick(ac, out, t, 0.18)
  },
}

// hafif pop (marimba + shaker): fast food, dükkan, kuaför, stüdyo, rehber
const POP = [
  [60, 64, 67],
  [55, 59, 62],
  [57, 60, 64],
  [53, 57, 60],
]
const pop = {
  bpm: 106,
  step({ ac, out, t, s, bar, st }) {
    const ch = POP[bar % 4]
    if (s % 2 === 0) mallet(ac, out, t, N(ch[(s / 2) % 3] + 12), s === 0 ? 0.075 : 0.05, 0.35)
    if (s % 2 === 0 && chance(0.3)) {
      const k = walk(st, 'mel', SCALE_C.length, 2)
      mallet(ac, out, t, N(SCALE_C[k] + 0), 0.05, 0.35)
    }
    if (s === 0 || s === 8) tone(ac, out, t, { f: 100, f2: 50, a: 0.003, d: 0.15, g: 0.16 })
    if (s === 0 || s === 6 || s === 10) bass(ac, out, t, N(ch[0] - 12), 0.14, 0.3)
    if (s % 2 === 0) noise(ac, out, t, { type: 'highpass', f: 6500, a: 0.004, d: 0.05, g: 0.022 })
  },
}

export const SCENES = { lobby, jazz, lounge, park, beach, house, home, arcade, pop }
export const SCENE_IDS = Object.keys(SCENES)
/** Açık havada mı (cırcır böceği vb. için). */
export const OUTDOOR = new Set(['lobby', 'jazz', 'park', 'beach', 'house'])

/** Mekân türü (venues.js type) → sahne. */
export const VENUE_SCENE = {
  cafe: 'jazz', bakery: 'jazz', dessert: 'jazz', icecream: 'pop', tea: 'jazz', books: 'lounge',
  fastfood: 'pop', bar: 'lounge', club: 'house', arcade: 'arcade', salon: 'pop', studio: 'pop', shop: 'pop', guide: 'lobby', airport: 'lobby',
}
/** Dış bölge kimliği (layout.js zoneAt) → sahne. */
export const ZONE_SCENE = { lobby: 'lobby', cafe: 'jazz', club: 'house', park: 'park', beach: 'beach', residential: 'park', north: 'jazz', eastend: 'house', meadow: 'park', forest: 'park', pond: 'park', hills: 'lobby', harbor: 'beach', city: 'lobby' }

// ---------------------------------------------------------------- planlayıcı

const LOOKAHEAD = 0.4
const FADE = 2.4
const nightTempo = (night) => 1 + 0.18 * night

function advance(cur, ac, until, night) {
  let guard = 0
  const spb = 60 / cur.sc.bpm / 4
  while (cur.next < until && guard++ < 4096) {
    const i = cur.i
    cur.sc.step({ ac, out: cur.out, t: cur.next, i, s: i % 16, bar: Math.floor(i / 16), st: cur.st, night, spb })
    cur.i++
    cur.next += spb * nightTempo(night)
  }
}

/** Cırcır böceği: gece, açık havada. */
function crickets(ac, out, t, night) {
  const n = 3 + Math.floor(Math.random() * 3)
  const f = rnd(4300, 4800)
  for (let k = 0; k < n; k++) tone(ac, out, t + k * 0.055, { f, a: 0.004, d: 0.03, g: 0.022 * night })
}
function advanceCrickets(layer, ac, out, until, night) {
  while (layer.next < until) {
    if (night > 0.35) crickets(ac, out, layer.next, night)
    layer.next += rnd(0.7, 1.5)
  }
}

const rainBed = (ac, out, t) => {
  const a = noiseLayer(ac, out, { type: 'bandpass', f: 3200, q: 0.35, g: 0.07, t, fade: 2 })
  const b = noiseLayer(ac, out, { type: 'lowpass', f: 500, q: 0.4, g: 0.035, t, fade: 2 })
  return (at, f) => {
    a(at, f)
    b(at, f)
  }
}

/**
 * Canlı müzik denetçisi. out: müzik bus'ı. setScene(id, { outdoor }) ile bölge, setMood({ night, rain }) ile dünya havası.
 */
let activeMusic = null // aynı anda tek müzik denetçisi çalışır (StrictMode/HMR/çift kayıt eski zamanlayıcıyı canlı bırakıp iki müziği üst üste bindirmesin)
if (import.meta.hot) import.meta.hot.dispose(() => activeMusic?.stop())

export function createMusic(ac, out) {
  activeMusic?.stop()
  const moodFilter = ac.createBiquadFilter()
  moodFilter.type = 'lowpass'
  moodFilter.frequency.value = 12000
  const moodGain = ac.createGain()
  moodFilter.connect(moodGain).connect(out)
  const rainBus = ac.createGain()
  rainBus.connect(out)
  // kıyı dalgaları: adaya yaklaştıkça duyulur (setShore 0..1); iki gürültü katmanı yavaş kabarıp çekilir
  const shoreBus = ac.createGain()
  shoreBus.gain.value = 0
  shoreBus.connect(out)
  let shoreStop = null
  const mood = { night: 0, rain: false, outdoor: true }
  let cur = null
  let lastSwitch = -99
  let timer = null
  let rainStop = null
  const cr = { next: 0 }

  const applyMood = () => {
    const now = ac.currentTime
    moodFilter.frequency.setTargetAtTime(12000 - 9200 * mood.night * mood.night - (mood.rain ? 2500 : 0), now, 1.5)
    moodGain.gain.setTargetAtTime((mood.rain ? 0.72 : 1) * (1 - 0.25 * mood.night), now, 1.5)
    if (mood.rain && !rainStop) rainStop = rainBed(ac, rainBus, now)
    else if (!mood.rain && rainStop) {
      rainStop(now, 2.5)
      rainStop = null
    }
  }
  const startScene = (id) => {
    const sc = SCENES[id]
    if (!sc) return
    const now = ac.currentTime
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, now)
    g.gain.linearRampToValueAtTime(1, now + FADE)
    g.connect(moodFilter)
    cur = { id, sc, out: g, i: 0, next: now + 0.08, st: {}, stopAmb: sc.ambience?.(ac, g, now) ?? null }
  }
  const retire = (old) => {
    const now = ac.currentTime
    try {
      old.out.gain.cancelScheduledValues(now)
      old.out.gain.setValueAtTime(Math.max(old.out.gain.value, 0.0001), now)
      old.out.gain.linearRampToValueAtTime(0.0001, now + FADE)
      old.stopAmb?.(now, FADE)
    } catch {
      /* yut */
    }
    setTimeout(() => {
      try {
        old.out.disconnect()
      } catch {
        /* yut */
      }
    }, (FADE + 1) * 1000)
  }
  const tick = () => {
    try {
      if (!cur) return
      const now = ac.currentTime
      if (cur.next < now - 1) cur.next = now + 0.05 // uzun duraklamadan sonra toparlan
      advance(cur, ac, now + LOOKAHEAD, mood.night)
      if (mood.outdoor && mood.night > 0.35) {
        if (cr.next < now - 1) cr.next = now
        advanceCrickets(cr, ac, moodFilter, now + LOOKAHEAD, mood.night)
      } else cr.next = now
    } catch {
      /* müzik asla oyunu bozmasın */
    }
  }
  const api = {
    get scene() {
      return cur?.id ?? null
    },
    setScene(id, { outdoor } = {}) {
      if (outdoor !== undefined && outdoor !== mood.outdoor) mood.outdoor = outdoor
      if (cur?.id === id) return
      // bölge sınırında gidip gelirken sahneler üst üste binmesin: en az 6 sn aralık (sonraki yoklamada yeniden denenir)
      if (cur && ac.currentTime - lastSwitch < 6) return
      lastSwitch = ac.currentTime
      if (cur) retire(cur)
      startScene(id)
    },
    setMood(patch) {
      Object.assign(mood, patch)
      applyMood()
    },
    /** Kıyıya yakınlık 0..1 (0 = uzak/iç mekân). Dalga sesi bu seviyeyle açılıp kısılır. */
    setShore(level) {
      const now = ac.currentTime
      const l = Math.max(0, Math.min(1, level))
      if (l > 0.02 && !shoreStop) {
        const a = noiseLayer(ac, shoreBus, { type: 'lowpass', f: 850, q: 0.4, g: 0.16, lfo: { rate: 0.1, depth: 0.9 }, t: now, fade: 2 })
        const b = noiseLayer(ac, shoreBus, { type: 'highpass', f: 3200, q: 0.4, g: 0.02, lfo: { rate: 0.14, depth: 0.95 }, t: now, fade: 2 })
        shoreStop = (at, f) => (a(at, f), b(at, f))
      } else if (l <= 0.02 && shoreStop) {
        shoreStop(now + 1.5, 2)
        shoreStop = null
      }
      shoreBus.gain.setTargetAtTime(l, now, 0.6)
    },
    start() {
      if (!timer) timer = setInterval(tick, 100)
    },
    stop() {
      clearInterval(timer)
      timer = null
      if (cur) retire(cur)
      cur = null
      rainStop?.(ac.currentTime, 1)
      rainStop = null
      shoreStop?.(ac.currentTime, 1)
      shoreStop = null
    },
    mood,
  }
  activeMusic = api
  return api
}

/**
 * Çevrimdışı çizim (test): bir sahneyi 0..dur sn arası `out`a planlar. mood: { night, rain, outdoor }.
 */
export function renderScene(ac, out, id, dur, mood = {}) {
  const sc = SCENES[id]
  const cur = { id, sc, out, i: 0, next: 0, st: {}, stopAmb: sc.ambience?.(ac, out, 0) ?? null }
  const night = mood.night ?? 0
  advance(cur, ac, dur, night)
  if (mood.outdoor !== false && night > 0.35) advanceCrickets({ next: 0 }, ac, out, dur, night)
  if (mood.rain) rainBed(ac, out, 0)
}
