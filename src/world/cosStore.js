// Oyuncuların kozmetik seçimleri (aksesuar + evcil hayvan) için küçük bir dış depo.
// Anahtar: oyuncu id'si; 'self' = kendim, 'preview' = gardırop önizlemesi. Sunucu mesajlarından features/cosmetics.jsx besler;
// AvatarRig (aksesuar) ve PetLayer (evcil hayvan) useSyncExternalStore ile okur, böylece çekirdek dosyalar state taşımaz.
const map = new Map() // id → { acc: {id,color}|null, acc2: {id,color}|null, pet: id|null, look }
const listeners = new Set()
let version = 0

const emit = () => {
  version++
  listeners.forEach((fn) => fn())
}

const same = (a, b) =>
  (a?.acc?.id ?? null) === (b?.acc?.id ?? null) &&
  (a?.acc?.color ?? null) === (b?.acc?.color ?? null) &&
  (a?.acc2?.id ?? null) === (b?.acc2?.id ?? null) &&
  (a?.acc2?.color ?? null) === (b?.acc2?.color ?? null) &&
  (a?.pet ?? null) === (b?.pet ?? null) &&
  JSON.stringify(a?.look ?? null) === JSON.stringify(b?.look ?? null)

export const cosStore = {
  subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  get: (id) => map.get(id) ?? null,
  /** Anahtarlar (self/preview hariç oyuncu id'leri). */
  ids: () => [...map.keys()].filter((k) => k !== 'self' && k !== 'preview'),
  version: () => version,
  set(id, cos) {
    if (!cos || (!cos.acc && !cos.acc2 && !cos.pet && !cos.look)) {
      if (map.delete(id)) emit()
      return
    }
    if (same(map.get(id), cos)) return
    map.set(id, { acc: cos.acc ?? null, acc2: cos.acc2 ?? null, pet: cos.pet ?? null, look: cos.look ?? null })
    emit()
  },
  /** Başkalarının kayıtlarını sil (oda değişince); self ve preview kalır. */
  clearOthers() {
    let changed = false
    for (const k of [...map.keys()]) if (k !== 'self' && k !== 'preview') changed = map.delete(k) || changed
    if (changed) emit()
  },
  remove(id) {
    if (map.delete(id)) emit()
  },
}
