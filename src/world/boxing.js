// Boks + karakter statları: istemci ve sunucunun ORTAK saf mantığı (aynı tohumla aynı vuruş dizisi, aynı hasar formülü).
// Statlar 0–100: str Güç (boks hasarı), sta Kondisyon (gelen hasarı azaltır + günlük antrenman hakkı),
// cha Karizma (altın kazancına bonus), ski Beceri (zamanlama penceresi genişler).

export const STAT_META = {
  str: { emoji: '💪', name: 'Güç', color: '#ff8a7a', desc: 'Boksta yumruk hasarını artırır.', how: 'MakFit’te ağırlık çalış.' },
  sta: { emoji: '🏃', name: 'Kondisyon', color: '#7fcdf3', desc: 'Boksta hasarı azaltır, enerji ve koşu hızını artırır.', how: 'MakFit’te koşu bandında çalış.' },
  cha: { emoji: '✨', name: 'Karizma', color: '#d6a8ff', desc: 'Kazandığın her altına bonus ekler.', how: 'Sohbet et, jest gönder, fotoğraf çek.' },
  ski: { emoji: '🧠', name: 'Beceri', color: '#8fdcb4', desc: 'Boks ve antrenmanda zamanlama penceresini genişletir.', how: 'Boks maçı ve mini oyunlar oyna.' },
}
export const STAT_KEYS = ['str', 'sta', 'cha', 'ski']
export const STAT_START = 5
export const STAT_MAX = 100
export const BASE_ENERGY = 6
export const energyMax = (attr) => BASE_ENERGY + Math.floor((attr?.sta ?? 0) / 25)
export const coinBonusPct = (cha) => Math.floor((cha ?? 0) / 5) // %: 100 karizmada +%20

// ---------- boks ----------
export const BOX = { rounds: 3, roundMs: 18_000, breakMs: 2_600, leadMs: 2_400, hp: 100 }
export const CUE_META = {
  jab: { key: '←', code: 'ArrowLeft', alt: 'KeyA', label: 'Jab', dmg: 8, color: '#7fcdf3' },
  hook: { key: '→', code: 'ArrowRight', alt: 'KeyD', label: 'Kroşe', dmg: 10, color: '#ffd35e' },
  upper: { key: '↑', code: 'ArrowUp', alt: 'KeyW', label: 'Aparkat', dmg: 13, color: '#ff8a7a' },
  block: { key: '↓', code: 'ArrowDown', alt: 'KeyS', label: 'Blok', dmg: 0, color: '#b79cff' },
}
export const CUE_TYPES = Object.keys(CUE_META)

export function makeRng(seed) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export const roundStart = (r) => BOX.leadMs + r * (BOX.roundMs + BOX.breakMs)
export const matchDuration = () => roundStart(BOX.rounds) - BOX.breakMs

/** Tohumdan vuruş dizisi: [{ i, t (maç başından ms), type, round }]. Sonraki raunt biraz daha hızlı. */
export function boxCues(seed) {
  const rng = makeRng(seed)
  const cues = []
  for (let r = 0; r < BOX.rounds; r++) {
    const start = roundStart(r)
    let t = start + 850
    const pace = 1 - r * 0.1
    while (t < start + BOX.roundMs - 450) {
      const x = rng()
      const type = x < 0.34 ? 'jab' : x < 0.6 ? 'hook' : x < 0.8 ? 'upper' : 'block'
      cues.push({ i: cues.length, t: Math.round(t), type, round: r })
      t += (680 + rng() * 440) * pace
    }
  }
  return cues
}

/** Zamanlama penceresi (ms, ± sapma): beceri arttıkça genişler. */
export const gradeWindow = (ski = 0) => ({ perfect: 75 + ski * 0.55, good: 165 + ski * 0.95 })

/** Bir vuruşun hasarı. combo: art arda isabet sayısı; shielded: rakip blok kalkanında. */
export function hitDamage(type, grade, combo, str = 0, defSta = 0, shielded = false) {
  const base = (CUE_META[type]?.dmg ?? 0) * (grade === 'perfect' ? 1.32 : 1)
  if (!base) return 0
  const mult = (1 + (str / 100) * 0.6) * (1 + Math.min(combo, 6) * 0.08) * (1 - (defSta / 100) * 0.3) * (shielded ? 0.42 : 1)
  return Math.max(1, Math.round(base * mult))
}

export const BLOCK_MS = 1500
