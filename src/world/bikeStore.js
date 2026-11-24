// Bisiklet durumu (React dışı paylaşılan depo): LocalPlayer hız/duruşu okur, BikeModel görünür, düğme/tuş değiştirir.
// Sunucuya yalnızca hareket mesajındaki anim='ride' ile bildirilir; diğer oyuncular bisikleti buna göre çizer.
import { useSyncExternalStore } from 'react'

let on = false
let until = 0 // kiralama bitiş zamanı (ms); sunucu welcome.bikeUntil / rental ile verir
const subs = new Set()
const emit = () => subs.forEach((f) => f())

export const bike = {
  get on() {
    return on
  },
  set(v) {
    v = Boolean(v)
    if (v === on) return
    on = v
    window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: v ? 'pop' : 'tick' }))
    emit()
  },
  /** Kiralama süresi (ms zaman damgası). Süre bitince binmek yasak, biniyorsa iner. */
  get until() {
    return until
  },
  setUntil(t) {
    until = Number(t) || 0
    if (!this.rented) this.set(false)
    emit()
  },
  get rented() {
    return until > Date.now()
  },
  toggle() {
    if (!on && !this.rented) return false // kiralanmamış
    this.set(!on)
    return true
  },
}

export const useRiding = () => useSyncExternalStore((cb) => (subs.add(cb), () => subs.delete(cb)), () => on)

export const BIKE_SPEED = 8.4 // m/sn (yürüyüş 3,2 / koşu 6,5)
export const BIKE_POSE = { kind: 'sit', style: 'bike' } // avatarPose.js: bisiklet selesinde oturuş
