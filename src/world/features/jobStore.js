// Meslekler için paylaşılan istemci durumu (React dışı; 3B katmanlar her karede okur). Yazan: features/jobs.jsx.
// Çalışma duruşu (pose): { kind: 'work', style: 'fish'|'carry'|'tend', phase, t0 (sn, performance.now()/1000), fish? }
export const work = {
  /** Benim duruşum: { current } */
  self: { current: null },
  /** Başkalarının duruşları: id → pose */
  poses: new Map(),
  /** Taşıdığım kargolar (kapı ışığı + elde paket için): [{ id, to, kind, name, exp }] */
  parcels: [],
  /** Mesleğim (seçildiyse 'gardener' | 'fisher' | 'postman') */
  job: null,
  /** Bildirim aboneleri (React bileşenleri parcels değişince yeniden çizsin diye) */
  _subs: new Set(),
  subscribe(fn) {
    work._subs.add(fn)
    return () => work._subs.delete(fn)
  },
  emit() {
    work._subs.forEach((f) => f())
  },
}
export const mkPose = (style, phase = null, extra = {}) => ({ kind: 'work', style, phase, t0: performance.now() / 1000, ...extra })
