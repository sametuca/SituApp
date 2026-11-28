// Cihaza göre grafik profili ve arka plan ön yükleme izni.
export function getGraphicsProfile() {
  if (typeof navigator === 'undefined') {
    return { lowPower: false, dpr: [1, 1.5], antialias: true, shadows: true, ao: true, bloom: true }
  }

  const cores = Number(navigator.hardwareConcurrency) || 8
  const memory = Number(navigator.deviceMemory) || 8
  const coarsePointer = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  const lowPower = cores <= 4 || memory <= 4 || (coarsePointer && cores <= 6)

  return lowPower
    ? { lowPower: true, dpr: [0.75, 1], antialias: false, shadows: false, ao: false, bloom: false }
    : { lowPower: false, dpr: [1, 1.5], antialias: true, shadows: true, ao: !coarsePointer, bloom: true }
}

export function createAdaptiveDpr(initialDpr, maxDpr) {
  let dpr = initialDpr
  let elapsed = 0
  let frames = 0
  let slowFrames = 0
  let goodWindows = 0
  let referenceFps = 0
  let locked = false

  const reset = () => {
    elapsed = 0
    frames = 0
    slowFrames = 0
  }

  return (delta, visible) => {
    if (!visible || !Number.isFinite(delta) || delta <= 0 || delta > 1) {
      reset()
      goodWindows = 0
      return null
    }

    elapsed += delta
    frames++
    if (delta > 1 / 30) slowFrames++
    if (elapsed < 3) return null

    const fps = frames / elapsed
    const slowRatio = slowFrames / frames
    reset()

    if (dpr > initialDpr && (fps < 50 || fps < referenceFps * 0.9 || slowRatio > 0.05)) {
      dpr = Math.max(initialDpr, dpr - 0.125)
      locked = true
      goodWindows = 0
      return dpr
    }
    goodWindows = fps >= 55 && slowRatio <= 0.02 ? goodWindows + 1 : 0
    if (!locked && dpr < maxDpr && goodWindows >= 2) {
      referenceFps = fps
      dpr = Math.min(maxDpr, dpr + 0.125)
      goodWindows = 0
      return dpr
    }
    return null
  }
}

export function canUseBackgroundPreload() {
  if (typeof navigator === 'undefined') return true
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  if (!connection) return !(typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches)
  if (connection.saveData) return false
  return !['slow-2g', '2g', '3g'].includes(connection.effectiveType)
}
