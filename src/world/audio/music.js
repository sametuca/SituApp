// Üretken (generative) arka plan müziği; tamamen procedural. Bölgeye göre sahne (scene) seçilir, sahneler arasında crossfade yapılır.
// Zamanlama: AudioContext saatine göre ileriye plan (lookahead) — setInterval yalnızca planlayıcıyı uyandırır, nota zamanı ses saatindedir.
//
// Sahne: { bpm, step(c), ambience?(ac, out, t) → stop }.  step her 16'lık adımda çağrılır:
//   c = { ac, out, t, i, s (0-15), bar, st (sahneye özel durum), night (0..1), spb (adım süresi, sn) }
// Sahne kimlikleri: lobby, jazz, lounge, park, beach, house, home, arcade, pop
import { bass, bell, brush, clap, hat, kick, keys, mallet, mtof, musicBox, noise, noiseLayer, pad, pick, pluck, rnd, tone } from './synth'

const N = mtof
const chance = (p) => Math.random() < p
const walk = (st, key, len, maxStep = 2) => {
  st[key] = Math.max(0, Math.min(len - 1, (st[key] ?? Math.floor(len / 2)) + Math.round(rnd(-maxStep, maxStep))))
  return st[key]
}

// ---------------------------------------------------------------- sahneler

const LOBBY = [
  [48, 52, 55, 59],
  [45, 48, 52, 55],
  [41, 45, 48, 52],
  [43, 47, 50, 52],
]
const lobby = {
  bpm: 84,
  step({ ac, out, t, s, bar, spb, st }) {
    const ch = LOBBY[bar % 4]
    if (s === 0) pad(ac, out, t, ch, spb * 16, 0.034, 800)
    if (s === 0 || s === 8) bass(ac, out, t, N(ch[0] - 12), 0.15, 0.7)
    if (s % 2 === 0 && chance(0.68)) {
      const k = walk(st, 'arp', 4, 2)
      bell(ac, out, t, N(ch[k] + 24), 0.045, 1.6)
    }
  },
}

// caz: ii-V-I-VI (do majör), fırça davul + yürüyen bas + piyano akorları
const JAZZ = [
  { root: 38, comp: [53, 57, 60, 64], walk: [0, 7, 4, 5] },
  { root: 43, comp: [53, 59, 62, 64], walk: [0, 4, 7, 9] },
  { root: 36, comp: [52, 55, 59, 62], walk: [0, 4, 7, 4] },
  { root: 45, comp: [55, 61, 64, 65], walk: [0, 3, 7, 5] },
]
const LOUNGE = [
  { root: 33, comp: [55, 59, 60, 64], walk: [0, 7, 3, 5] },
  { root: 38, comp: [53, 57, 60, 64], walk: [0, 7, 5, 3] },
  { root: 31, comp: [53, 59, 62, 64], walk: [0, 4, 7, 5] },
  { root: 36, comp: [52, 55, 59, 62], walk: [0, 4, 7, 11] },
]
const SCALE_C = [72, 74, 76, 79, 81, 84]
function makeJazz({ bpm, prog, melody, padOn = false, density = 1 }) {
  return {
    bpm,
    step({ ac, out, t, s, bar, spb, st }) {
      const c = prog[bar % 4]
      if (s === 0 && padOn) pad(ac, out, t, c.comp, spb * 16, 0.022, 700)
      if (s % 4 === 0) {
        const beat = s / 4
        bass(ac, out, t, N(c.root + c.walk[beat] + (beat === 3 ? 0 : 12)), 0.2 * (beat === 0 ? 1 : 0.8), 0.45)
        brush(ac, out, t, beat % 2 === 0 ? 0.05 : 0.04)
      }
      if ((s === 4 || s === 12) && density > 0.5) brush(ac, out, t + spb * (8 / 3), 0.03, 0.08) // swing
      if ((s === 4 || s === 12) && chance(0.5 * density)) noise(ac, out, t, { type: 'bandpass', f: 1900, q: 0.8, a: 0.004, d: 0.08, g: 0.035 })
      if ((s === 0 && chance(0.85)) || (s === 10 && chance(0.5 * density))) {
        c.comp.forEach((m, k) => keys(ac, out, t + k * 0.014, N(m), s === 0 ? 0.04 : 0.032, s === 0 ? 1.4 : 0.7))
      }
      if (s % 2 === 0 && chance(0.2 * density)) {
        const k = walk(st, 'mel', melody.length, 2)
        keys(ac, out, t + (s % 4 === 2 ? spb * 0.5 : 0), N(melody[k]), 0.045, 0.9)
      }
    },
  }
}
const jazz = makeJazz({ bpm: 96, prog: JAZZ, melody: SCALE_C })
const lounge = makeJazz({ bpm: 74, prog: LOUNGE, melody: [69, 72, 74, 76, 79, 81], padOn: true, density: 0.6 })

// park: akustik tını (gitar arpeji) + kuşlar + hafif rüzgâr
const PARK = [
  [43, 50, 55, 59, 62, 67],
  [40, 47, 52, 55, 59, 64],
  [48, 52, 55, 60, 64, 67],
  [50, 54, 57, 62, 66, 69],
]
const ARP = [0, 2, 3, 4, 3, 2, 4, 3]
const park = {
  bpm: 76,
  step({ ac, out, t, s, bar, night, st }) {
    const ch = PARK[bar % 4]
    if (s % 2 === 0) {
      const k = ARP[(s / 2) % 8]
      pluck(ac, out, t, N(ch[k]), s === 0 ? 0.075 : 0.05, 0.9)
      if (s === 0) pluck(ac, out, t, N(ch[0] - 12), 0.06, 1.2)
    }
    if (s % 2 === 1 && night < 0.55 && chance(0.07 * (1 - night))) {
      const n = 2 + Math.floor(Math.random() * 3)
      const f0 = rnd(2600, 4200)
      for (let k = 0; k < n; k++) tone(ac, out, t + k * 0.075, { f: f0 * (1 + 0.04 * k), f2: f0 * 1.3, a: 0.004, d: 0.05, g: 0.022 })
    }
    st.n = (st.n ?? 0) + 1
  },
  ambience: (ac, out, t) => noiseLayer(ac, out, { type: 'bandpass', f: 500, q: 0.7, g: 0.02, lfo: { rate: 0.08, depth: 0.8 }, t, fade: 3 }),
}

// plaj: ukulele çekimi + dalga gürültüsü
const UKE = [
  [67, 60, 64, 72],
  [69, 60, 65, 72],
  [67, 62, 71, 74],
  [67, 60, 64, 69],
]
const beach = {
  bpm: 96,
  step({ ac, out, t, s, bar }) {
    const ch = UKE[bar % 4]
    const down = s === 0 || s === 4 || s === 12
    const up = s === 6 || s === 10 || s === 14
    if (down || up) {
      const order = down ? ch : [...ch].reverse()
      order.forEach((m, k) => pluck(ac, out, t + k * 0.011, N(m), down ? 0.052 : 0.036, down ? 0.55 : 0.3))
    }
    if (s === 8 && chance(0.35)) mallet(ac, out, t, N(pick([79, 81, 84, 86])), 0.05, 0.6)
    if (s === 0) bass(ac, out, t, N(ch[1] - 24), 0.1, 0.5)
  },
  ambience(ac, out, t) {
    const a = noiseLayer(ac, out, { type: 'lowpass', f: 900, q: 0.4, g: 0.1, lfo: { rate: 0.11, depth: 0.85 }, t, fade: 3 })
    const b = noiseLayer(ac, out, { type: 'highpass', f: 3500, q: 0.4, g: 0.012, lfo: { rate: 0.17, depth: 0.9 }, t, fade: 3 })
    return (at, f) => {
      a(at, f)
      b(at, f)
    }
  },
}

// kulüp: house ~120 BPM (kick, hat, bas, pentatonik lead)
const HOUSE = [33, 29, 36, 31]
const PENT = [69, 72, 74, 76, 79, 81]
const house = {
  bpm: 120,
  step({ ac, out, t, s, bar, st }) {
    const root = HOUSE[bar % 4]
    if (s % 4 === 0) kick(ac, out, t, 0.4)
    if (s === 4 || s === 12) clap(ac, out, t, 0.1)
    if (s % 4 === 2) hat(ac, out, t, 0.045, 0.08)
    else if (s % 2 === 1 && chance(0.55)) hat(ac, out, t, 0.022, 0.025)
    if (s % 4 === 2) tone(ac, out, t, { f: N(root + (chance(0.2) ? 12 : 0)), type: 'sawtooth', a: 0.004, d: 0.14, g: 0.11, lp: 900, lp2: 250 })
    if (s === 0) pad(ac, out, t, [root + 24, root + 27, root + 31], 16 * (60 / 120 / 4), 0.018, 1200)
    if ((s === 3 || s === 11) && chance(0.6)) [0, 3, 7].forEach((m) => tone(ac, out, t, { f: N(root + 24 + m), type: 'sawtooth', a: 0.004, d: 0.14, g: 0.025, lp: 2200, lp2: 800 }))
    if (s % 2 === 0 && chance(bar % 4 === 3 ? 0.1 : 0.3)) {
      const k = walk(st, 'lead', PENT.length, 2)
      tone(ac, out, t, { f: N(PENT[k] + 12), type: 'square', a: 0.004, d: 0.2, g: 0.032, lp: 2600, lp2: 900 })
    }
  },
}

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
  fastfood: 'pop', bar: 'lounge', club: 'house', arcade: 'arcade', salon: 'pop', studio: 'pop', shop: 'pop', guide: 'lobby',
}
/** Dış bölge kimliği (layout.js zoneAt) → sahne. */
export const ZONE_SCENE = { lobby: 'lobby', cafe: 'jazz', club: 'house', park: 'park', beach: 'beach', city: 'lobby' }

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
export function createMusic(ac, out) {
  const moodFilter = ac.createBiquadFilter()
  moodFilter.type = 'lowpass'
  moodFilter.frequency.value = 12000
  const moodGain = ac.createGain()
  moodFilter.connect(moodGain).connect(out)
  const rainBus = ac.createGain()
  rainBus.connect(out)
  const mood = { night: 0, rain: false, outdoor: true }
  let cur = null
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
  return {
    get scene() {
      return cur?.id ?? null
    },
    setScene(id, { outdoor } = {}) {
      if (outdoor !== undefined && outdoor !== mood.outdoor) mood.outdoor = outdoor
      if (cur?.id === id) return
      if (cur) retire(cur)
      startScene(id)
    },
    setMood(patch) {
      Object.assign(mood, patch)
      applyMood()
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
    },
    mood,
  }
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
