// Mini oyun arenaları ortak yardımcısı: tohumlu rastgele sayı üretici.

export function makeRng(seed) {
  let s = (seed >>> 0) || 424242
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}
