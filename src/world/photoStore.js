// Profil fotoğrafı adresleri: oyuncu anahtarı → url. Sunucu her izleyici için izne göre hesaplar
// ({ t:'photo', key, url|null }, welcome.photos, friends listesi); burada yalnızca saklanır.
import { useSyncExternalStore } from 'react'

let map = new Map()
const subs = new Set()
let version = 0
const emit = () => {
  version += 1
  subs.forEach((f) => f())
}

export const photoStore = {
  get: (key) => (key ? (map.get(key) ?? null) : null),
  set(key, url) {
    if (!key || (map.get(key) ?? null) === (url ?? null)) return
    if (url) map.set(key, url)
    else map.delete(key)
    emit()
  },
  reset(obj = {}) {
    map = new Map(Object.entries(obj))
    emit()
  },
}

/** Anahtarın fotoğraf adresi (yoksa null); değişince yeniden çizer. */
export function usePhoto(key) {
  useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => version,
  )
  return photoStore.get(key)
}
