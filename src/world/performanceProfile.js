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

export function canUseBackgroundPreload() {
  if (typeof navigator === 'undefined') return true
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  if (!connection) return true
  if (connection.saveData) return false
  return !['slow-2g', '2g', '3g'].includes(connection.effectiveType)
}
