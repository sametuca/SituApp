// Mekân ön cephe tasarımları (saf veri; City.jsx Facade bileşeni çizer, venueDoors.js kapı konumunu buradan kaydırır).
// door.x: kapının cephe genişliğine oranı (-0,5…0,5; 0 = orta). Her mekânın girişi farklıdır: kapı konumu/biçimi, cam türü, tente, süsler.
// glass türleri: big (geniş vitrin) · round (gemi penceresi) · tall (dar uzun) · strip (küçük pencere sırası) · lattice (kafesli) · screen (parlayan ekran)
// extra: pole (berber direği) · cone (dondurma külahı) · boards (sörf tahtaları) · planters (saksılar) · lantern · marquee (ampul dizisi) · neonframe ·
//        neonsign · flag · cupcake · chalk (yazı tahtası) · palmthatch (hasır saçak) · flowers
export const FACADES = {
  rehber: { door: { x: -0.2, w: 1.5, h: 2.3, c: '#4a8fd6', style: 'double' }, glass: [{ k: 'big', x: 0.22, w: 0.38 }], awning: { c: '#7fcdf3' }, extra: ['flag', 'planters'] },
  kuafor: { door: { x: 0.22, w: 1.2, h: 2.2, c: '#e8952c' }, glass: [{ k: 'big', x: -0.18, w: 0.45 }], extra: ['pole', 'planters'] },
  foto: { door: { x: 0, w: 1.3, h: 2.2, c: '#7a5fd0' }, glass: [{ k: 'round', x: -0.3 }, { k: 'round', x: 0.3 }], extra: ['marquee'] },
  tatli: { door: { x: 0.2, w: 1.2, h: 2.2, c: '#e07a9f', arch: true }, glass: [{ k: 'strip', x: -0.2, w: 0.4 }], awning: { c: '#ffc2dc', stripe: '#ffffff' }, extra: ['cupcake'] },
  kafe: { door: { x: -0.22, w: 1.2, h: 2.2, c: '#8a5a2b' }, glass: [{ k: 'big', x: 0.2, w: 0.46 }], awning: { c: '#ff9f43', stripe: '#fff3c8' }, extra: ['planters', 'chalk'] },
  kitapkafe: { door: { x: 0.3, w: 1.2, h: 2.2, c: '#2f7a6a' }, glass: [{ k: 'tall', x: -0.34 }, { k: 'tall', x: -0.1 }], extra: ['lantern'] },
  firin: { door: { x: 0, w: 1.3, h: 2.3, c: '#c46b3a', arch: true }, glass: [{ k: 'round', x: -0.32 }, { k: 'round', x: 0.32 }], awning: { c: '#ffd35e', stripe: '#ffffff' }, extra: ['planters'] },
  cayevi: { door: { x: 0.22, w: 1.2, h: 2.2, c: '#a0522d' }, glass: [{ k: 'lattice', x: -0.2, w: 0.42 }], extra: ['lantern'] },
  kulup: { door: { x: 0, w: 1.9, h: 2.4, c: '#241c3d', style: 'double' }, glass: [], noUpper: true, extra: ['neonframe', 'marquee'] },
  bar: { door: { x: -0.15, w: 1.2, h: 2.2, c: '#3b2a55' }, glass: [{ k: 'round', x: 0.22 }, { k: 'round', x: 0.4 }], noUpper: true, extra: ['neonsign'] },
  oyun: { door: { x: 0.25, w: 1.3, h: 2.2, c: '#3a2d63' }, glass: [{ k: 'screen', x: -0.18, w: 0.42 }], extra: ['marquee'] },
  fastfood: { door: { x: -0.2, w: 1.4, h: 2.2, c: '#d9482b', style: 'double' }, glass: [{ k: 'big', x: 0.22, w: 0.4 }], awning: { c: '#e04a2a', stripe: '#ffd35e' }, extra: [] },
  dondurma: { door: { x: 0.15, w: 1.2, h: 2.2, c: '#5fc0ea' }, glass: [{ k: 'big', x: -0.2, w: 0.4 }], awning: { c: '#ffc2dc', stripe: '#ffffff' }, extra: ['cone'] },
  surf: { door: { x: 0, w: 1.6, h: 2.3, c: '#2aa6b8', style: 'double' }, glass: [], extra: ['boards'] },
  plajbar: { door: { x: 0, w: 2.2, h: 2.2, c: null, open: true }, glass: [], awning: { c: '#e8c37a', stripe: '#b88a3a' }, extra: ['palmthatch'] },
  evim: { door: { x: 0, w: 1.2, h: 2.2, c: '#e8952c', arch: true }, glass: [{ k: 'tall', x: -0.3 }, { k: 'tall', x: 0.3 }], extra: ['flowers'] },
}
/** Binanın cephe tasarımı: mekân kimliği ya da 'evim'. */
export const facadeOf = (b) => FACADES[b.venue] ?? (b.homeDoor ? FACADES.evim : null)
/** Kapının cephe boyunca kayması (m, bina yerel x ekseni). */
export const doorOffset = (b) => (facadeOf(b)?.door.x ?? 0) * b.w
