// Bisiklet durumu (React dışı paylaşılan depo): LocalPlayer hız/duruşu okur, BikeModel görünür, düğme/tuş değiştirir.
// Sunucuya yalnızca hareket mesajındaki anim='ride' ile bildirilir; diğer oyuncular bisikleti buna göre çizer.
import { useSyncExternalStore } from 'react'

let on = false
let until = 0 // isteğe bağlı kiralama zaman damgası (bisiklet artık herkese ücretsiz/açık)
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
  get until() {
    return until
  },
  setUntil(t) {
    until = Number(t) || 0
    emit()
  },
  get rented() {
    return true
  },
  toggle() {
    this.set(!on)
    return true
  },
}

export const useRiding = () => useSyncExternalStore((cb) => (subs.add(cb), () => subs.delete(cb)), () => on)

export const BIKE_SPEED = 5.2 // m/sn (yürüyüş 3,2 m/sn'den bir tık hızlı; Shift ile 7,2)
export const BIKE_POSE = { kind: 'sit', style: 'bike' } // avatarPose.js: bisiklet selesinde oturuş

/** Şehir hız halkalarından alınan geçici hız artışı (ms zaman damgası). */
export const speedBoost = { until: 0 }
