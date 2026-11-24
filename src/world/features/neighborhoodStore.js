// Konut Mahallesi paylaşılan istemci durumu: parsel kimliği → { id, key, name, open, ext }.
// features/neighborhood.jsx ağdan doldurur; Neighborhood.jsx (Canvas) ve Hud haritası okur.
import { useSyncExternalStore } from 'react'
import { occupiedPlots } from '../neighborhood'

export const plotStore = { plots: new Map(), version: 0 }
const listeners = new Set()
const bump = () => {
  plotStore.version++
  listeners.forEach((l) => l())
}

export function setAllPlots(list) {
  plotStore.plots = new Map((list ?? []).map((p) => [p.id, p]))
  occupiedPlots.clear()
  plotStore.plots.forEach((_, id) => occupiedPlots.add(id))
  bump()
}
export function setPlot(p) {
  if (!p?.id) return
  plotStore.plots = new Map(plotStore.plots).set(p.id, p)
  occupiedPlots.add(p.id)
  bump()
}
export const plotOfKey = (key) => [...plotStore.plots.values()].find((p) => p.key === key) ?? null

/** Parsel verisi değişince yeniden çizdirir. */
export function usePlotVersion() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => plotStore.version,
  )
}

// Evden çıkınca doğulacak nokta: parsel kapısından girildiyse kapının önü [x, z, ry] (World.jsx swapScene okur)
export const plotNav = { exit: null }
