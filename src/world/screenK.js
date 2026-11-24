// Ekran boyutuna göre 3D etiket (drei <Html distanceFactor>) ölçeği: piksel boyutlu etiketler büyük ekranda küçük kalmasın.
// Kullanım: distanceFactor={9 * screenK()}. Pencere yüksekliği 800 px'te 1, daha büyükte orantılı artar (en çok 2,2).
export const screenK = () => (typeof window === 'undefined' ? 1 : Math.max(1, Math.min(2.2, window.innerHeight / 800)))
