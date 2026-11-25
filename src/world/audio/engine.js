// Ses motoru: tek AudioContext, master/müzik/efekt bus'ları, ayarlar (localStorage), sekme gizliyken sessizlik.
// Hata olursa sessizce devre dışı kalır; oyunu asla bozmaz.
import { SFX } from './sfx'

const KEY = 'situapp_audio_v1'
const DEFAULTS = { music: 60, sfx: 80, muted: false }
const MUSIC_BASE = 1.0
const SFX_BASE = 1.6

let settings = load()
let ac = null
let buses = null
let failed = false
let unlockInstalled = false
const settingSubs = new Set()
const readySubs = new Set()
const lastPlay = new Map()
let duckOn = false // false | true (kıs) | 'mute' (DJ oynatıcısı çalarken ortam müziği tamamen susar)

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    return { ...DEFAULTS, ...(s && typeof s === 'object' ? { music: clamp(s.music, DEFAULTS.music), sfx: clamp(s.sfx, DEFAULTS.sfx), muted: Boolean(s.muted) } : {}) }
  } catch {
    return { ...DEFAULTS }
  }
}
function clamp(v, d) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : d
}
const vol = (v) => (v / 100) ** 2

/**
 * Bus zinciri (gerçek ya da çevrimdışı bağlamda): music/sfx → master → sıkıştırıcı → hedef.
 * Test düzeneği de aynı zinciri kullanır.
 */
export function buildChain(c, dest) {
  const master = c.createGain()
  const comp = c.createDynamicsCompressor()
  comp.threshold.value = -12
  comp.knee.value = 8
  comp.ratio.value = 10
  comp.attack.value = 0.003
  comp.release.value = 0.2
  master.connect(comp).connect(dest)
  const music = c.createGain()
  const duck = c.createGain()
  const sfx = c.createGain()
  music.connect(duck).connect(master)
  sfx.connect(master)
  return { master, music, duck, sfx }
}

function applyGains() {
  if (!ac || !buses) return
  const now = ac.currentTime
  const hidden = typeof document !== 'undefined' && document.hidden
  buses.master.gain.setTargetAtTime(hidden || settings.muted ? 0 : 1, now, 0.05)
  buses.music.gain.setTargetAtTime(vol(settings.music) * MUSIC_BASE, now, 0.08)
  buses.sfx.gain.setTargetAtTime(vol(settings.sfx) * SFX_BASE, now, 0.05)
  buses.duck.gain.setTargetAtTime(duckOn === 'mute' ? 0.0001 : duckOn ? 0.3 : 1, now, 0.25)
}

function onVisibility() {
  if (!ac) return
  try {
    applyGains()
    if (document.hidden) setTimeout(() => document.hidden && ac.state === 'running' && ac.suspend().catch(() => {}), 400)
    else if (ac.state === 'suspended') ac.resume().catch(() => {})
  } catch {
    /* yut */
  }
}

/** Kullanıcı etkileşiminden sonra çağrılır (tarayıcı autoplay kuralı). Bağlam yoksa kurar, askıdaysa sürdürür. */
export function ensureStarted() {
  if (failed) return null
  try {
    if (!ac) {
      const Ctor = window.AudioContext || window.webkitAudioContext
      if (!Ctor) {
        failed = true
        return null
      }
      ac = new Ctor({ latencyHint: 'interactive' })
      buses = buildChain(ac, ac.destination)
      applyGains()
      document.addEventListener('visibilitychange', onVisibility)
      readySubs.forEach((fn) => {
        try {
          fn(ac, buses)
        } catch {
          /* yut */
        }
      })
    }
    if (ac.state === 'suspended' && !document.hidden) ac.resume().catch(() => {})
    return ac
  } catch {
    failed = true
    return null
  }
}

/** İlk dokunuş/tuşta ses bağlamını başlatır (bir kez kurulur). */
export function installUnlock() {
  if (unlockInstalled || typeof window === 'undefined') return
  unlockInstalled = true
  const go = () => {
    ensureStarted()
    if (ac && ac.state === 'running') {
      ;['pointerdown', 'keydown', 'touchend'].forEach((e) => window.removeEventListener(e, go, true))
      unlockInstalled = false
    }
  }
  ;['pointerdown', 'keydown', 'touchend'].forEach((e) => window.addEventListener(e, go, true))
}

/** Bağlam hazır olunca (ya da zaten hazırsa hemen) çağrılır. Döndürdüğü işlev aboneliği kaldırır. */
export function onReady(fn) {
  readySubs.add(fn)
  if (ac && buses) fn(ac, buses)
  return () => readySubs.delete(fn)
}

export const getSettings = () => settings
export function setSettings(patch) {
  settings = { ...settings, ...patch, music: clamp(patch.music ?? settings.music, settings.music), sfx: clamp(patch.sfx ?? settings.sfx, settings.sfx), muted: patch.muted ?? settings.muted }
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    /* yut */
  }
  applyGains()
  settingSubs.forEach((fn) => fn(settings))
}
export function subscribeSettings(fn) {
  settingSubs.add(fn)
  return () => settingSubs.delete(fn)
}

/** Sesli mesaj vb. çalarken müziği kıs. */
export function duck(on) {
  duckOn = on === 'mute' ? 'mute' : Boolean(on)
  applyGains()
}

const MIN_GAP = { step: 0, click: 30, pop: 30 }
/** Efekt çal. opt: { gain (0-1 ölçek), ...efekte özel (surface, run, final) }. */
export function play(name, opt) {
  const fn = SFX[name]
  if (!fn || failed || !ac || !buses || settings.muted || settings.sfx <= 0 || ac.state !== 'running') return
  try {
    const nowMs = performance.now()
    if (nowMs - (lastPlay.get(name) ?? -1e9) < (MIN_GAP[name] ?? 60)) return
    lastPlay.set(name, nowMs)
    const g = ac.createGain()
    g.gain.value = opt?.gain ?? 1
    g.connect(buses.sfx)
    const dur = fn(ac, g, ac.currentTime + 0.01, opt)
    setTimeout(() => {
      try {
        g.disconnect()
      } catch {
        /* yut */
      }
    }, (dur + 1.5) * 1000)
  } catch {
    /* efekt asla oyunu bozmasın */
  }
}

export const isAvailable = () => !failed

/** Geliştirme/test: canlı bağlam ve bus'lar. */
export const debug = () => ({ ac, buses })

// HMR: modül yeniden yüklenirken eski ses bağlamı kapanır (yoksa eski müzik çalmaya devam edip yenisiyle çakışır)
if (import.meta.hot) import.meta.hot.dispose(() => { try { ac?.close() } catch { /* yut */ } })
