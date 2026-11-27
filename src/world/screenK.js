// Ekran boyutuna göre 3D etiket (drei <Html distanceFactor>) ölçeği: küçük mobil ekranlarda tabela ve etiketler orantılı küçülür.
export const screenK = () =>
  typeof window === 'undefined' ? 1 : Math.max(0.62, Math.min(2.2, Math.min(window.innerWidth, window.innerHeight) / 760))
