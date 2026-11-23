// "Birlikte yapılan şeyler" için paylaşılan istemci durumu (React dışı, ref gibi okunur).
// 3D tarafı (LocalPlayer, RemotePlayers, AvatarRig, TogetherScene) bunu her karede okur; yazan: features/together.jsx.
// Duruş (pose): { kind: 'sit', style: 'bench'|'lounger'|'chair', seat, slot, x, z, ry, t0 }
//             | { kind: 'dance', mate, lead, x, z, ry, cx, cz, dur, t0 }      (t0: performance.now() saniye cinsinden)
export const together = {
  /** Benim duruşum: { current } */
  self: { current: null },
  /** Başkalarının duruşları: id → pose */
  poses: new Map(),
  /** Gökyüzü tonu (gün batımı anı): t gerçek değer (0..1), target hedef; TogetherScene yumuşakça yaklaştırır */
  sky: { t: 0, target: 0 },
  /** Canvas'tan kare alır (TogetherScene kaydeder): () => dataURL */
  capture: null,
  /** Oyuncu duruşundayken hareket girdisi verirse LocalPlayer çağırır: kalk / dansı bırak */
  onBreak: null,
  _refs: new Map(),
  /** AvatarRig'e verilecek { current } nesnesi (id başına tek örnek) */
  ref(id) {
    let r = this._refs.get(id)
    if (!r) {
      const poses = this.poses
      r = {
        get current() {
          return poses.get(id) ?? null
        },
      }
      this._refs.set(id, r)
    }
    return r
  },
  /** Odadaki dolu koltuklar: 'seat:slot' → oyuncu id */
  takenSeats(selfId) {
    const m = new Map()
    for (const [id, p] of this.poses) if (p.kind === 'sit') m.set(`${p.seat}:${p.slot}`, id)
    const s = this.self.current
    if (s?.kind === 'sit') m.set(`${s.seat}:${s.slot}`, selfId ?? 'self')
    return m
  },
}
