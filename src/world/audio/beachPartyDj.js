// Sahil Partisi (Beach Party) 3B Uzamsal (Spatial) DJ Setlist & Crossfade Ses Sistemi:
// - DJ kabini ve kulüp hoparlörlerinden (BEACH_PARTY) yayılan çok parçalı, otomatik crossfade geçişli canlı DJ seti.
// - Kamera bakış açısına göre sol/sağ/ön/arka konumlandırma (HRTF + Stereo Pan): DJ sağındaysa sağdan, solundaysa soldan gelir.
// - Açık hava sahil atmosferi: mesafeye bağlı tiz yumuşaması (low-pass), bas sıcaklığı, açık alan eko yansıması ve sahne arkası boğukluğu.
// - Duvar saatine göre senkron DJ setlist: sahildeki oyuncular aynı şarkının aynı anını birlikte duyar; mobil RAM koruması için aynı anda tek aktif tampon tutulur.
import { BEACH_PARTY } from '../layout'
import { onReady } from './engine'

const PLAYLIST = [
  { url: '/audio/beach-party.mp3', dur: 201.85 },
  { url: '/audio/beach-party-2a.mp3', dur: 177.05 },
  { url: '/audio/beach-party-2b.mp3', dur: 219.72 },
]
const CROSSFADE = 2.6 // Şarkılar arası yumuşak DJ geçiş süresi (sn)
const PRELOAD_LEAD = 12.0 // Sonraki parçayı geçişten 12 sn önce sessizce hazırla
const SET_SLOTS = (() => {
  let acc = 0
  return PLAYLIST.map((t, idx) => {
    const eff = Math.max(10, t.dur - CROSSFADE)
    const slot = { idx, url: t.url, dur: t.dur, start: acc, eff }
    acc += eff
    return slot
  })
})()
const TOTAL_SET_DUR = SET_SLOTS[SET_SLOTS.length - 1].start + SET_SLOTS[SET_SLOTS.length - 1].eff

const STAGE_Y = 1.65 // Kulüp hoparlörlerinin yerden yüksekliği
const STAGE_FWD_X = Math.sin(BEACH_PARTY.ry)
const STAGE_FWD_Z = Math.cos(BEACH_PARTY.ry)
const FULL_DIST = 4.5 // Dans pisti içi tam enerji yarıçapı
const MAX_DIST = 58.0 // Şehir meydanına çıkarken tamamen sönümlenme mesafesi

let acRef = null
let graph = null
let activeScene = false
let starting = false
let sessionGen = 0
const activeDecks = new Set()
const timers = new Set()
// Mobil RAM dostu tek-komşu önbellek (en fazla 2 parça bellekte tutulur: çalan + sıradaki)
const bufCache = new Map()
const inFlight = new Map()
const freqBins = new Uint8Array(32)

function scheduleTimer(fn, ms) {
  const id = setTimeout(() => {
    timers.delete(id)
    fn()
  }, ms)
  timers.add(id)
  return id
}

function clearAllTimers() {
  timers.forEach((id) => clearTimeout(id))
  timers.clear()
}

function trimCache(keepIdxA, keepIdxB) {
  const keepA = PLAYLIST[keepIdxA]?.url
  const keepB = PLAYLIST[keepIdxB]?.url
  for (const k of bufCache.keys()) {
    if (k !== keepA && k !== keepB) bufCache.delete(k)
  }
}

function loadTrackBuffer(ac, idx) {
  const item = PLAYLIST[idx]
  if (!item) return Promise.resolve(null)
  if (bufCache.has(item.url)) return Promise.resolve(bufCache.get(item.url))
  if (inFlight.has(item.url)) return inFlight.get(item.url)

  const p = fetch(item.url)
    .then((r) => {
      if (!r.ok) throw new Error('beach track fetch failed')
      return r.arrayBuffer()
    })
    .then((arr) => ac.decodeAudioData(arr))
    .then((buf) => {
      inFlight.delete(item.url)
      bufCache.set(item.url, buf)
      return buf
    })
    .catch(() => {
      inFlight.delete(item.url)
      return null
    })

  inFlight.set(item.url, p)
  return p
}

/** Duvar saatine göre şu an setlist'te hangi parçanın kaçıncı saniyesinde olduğumuzu hesaplar. */
function pickWallClockSlot() {
  const pos = (((Date.now() / 1000) % TOTAL_SET_DUR) + TOTAL_SET_DUR) % TOTAL_SET_DUR
  for (let i = 0; i < SET_SLOTS.length; i++) {
    const sl = SET_SLOTS[i]
    if (pos < sl.start + sl.eff) {
      const offset = pos - sl.start
      // Parçanın bitmesine 5 sn'den az kaldıysa boşuna indirip hemen geçmek yerine doğrudan sıradaki parçadan başla
      if (sl.eff - offset < 5) {
        return { idx: (i + 1) % PLAYLIST.length, offset: 0 }
      }
      return { idx: i, offset }
    }
  }
  return { idx: 0, offset: 0 }
}

function buildGraph(ac, musicBus) {
  const analyser = ac.createAnalyser()
  analyser.fftSize = 64
  analyser.smoothingTimeConstant = 0.72

  // Kulüp subwoofer bas sıcaklığı
  const bassShelf = ac.createBiquadFilter()
  bassShelf.type = 'lowshelf'
  bassShelf.frequency.value = 95
  bassShelf.gain.value = 3.2

  // Mesafe + bakış yönü + sahne arkası hava sönümlemesi (low-pass)
  const airFilter = ac.createBiquadFilter()
  airFilter.type = 'lowpass'
  airFilter.frequency.value = 16000
  airFilter.Q.value = 0.55

  // Açık hava sahil sahnesi hafif stereo slapback / atmosfer yansıması
  const delayL = ac.createDelay(0.5)
  delayL.delayTime.value = 0.118
  const delayR = ac.createDelay(0.5)
  delayR.delayTime.value = 0.172
  const slapMerger = ac.createChannelMerger(2)
  const slapBand = ac.createBiquadFilter()
  slapBand.type = 'bandpass'
  slapBand.frequency.value = 1150
  slapBand.Q.value = 0.65
  const slapWet = ac.createGain()
  slapWet.gain.value = 0.0001

  // Dans pistinin tam içindeyken (< 5.5m) iki kulüp hoparlörünün geniş stereo sahnesini koruyan yakın alan kolu
  const nearStereoGain = ac.createGain()
  nearStereoGain.gain.value = 0.0001

  // 3B Binaural HRTF konumlandırıcı (dinleyiciye göre yerel koordinatlarda)
  let panner3d = null
  try {
    panner3d = ac.createPanner()
    panner3d.panningModel = 'HRTF'
    panner3d.distanceModel = 'linear'
    panner3d.refDistance = 1
    panner3d.maxDistance = 10000
    panner3d.rolloffFactor = 0
  } catch {
    panner3d = null
  }

  // Telefon / dizüstü hoparlörlerinde de net sağ-sol ayrımı için stereo pan desteği
  const stereoPan = typeof ac.createStereoPanner === 'function' ? ac.createStereoPanner() : null

  const dirGain = ac.createGain()
  dirGain.gain.value = 1
  const distGain = ac.createGain()
  distGain.gain.value = 0.0001

  // Bağlantı zinciri:
  analyser.connect(bassShelf)
  bassShelf.connect(airFilter)

  let dirTail = airFilter
  if (panner3d) {
    dirTail.connect(panner3d)
    dirTail = panner3d
  }
  if (stereoPan) {
    dirTail.connect(stereoPan)
    dirTail = stereoPan
  }
  dirTail.connect(dirGain)
  dirGain.connect(distGain)

  airFilter.connect(nearStereoGain)
  nearStereoGain.connect(distGain)

  airFilter.connect(delayL)
  airFilter.connect(delayR)
  delayL.connect(slapMerger, 0, 0)
  delayR.connect(slapMerger, 0, 1)
  slapMerger.connect(slapBand)
  slapBand.connect(slapWet)
  slapWet.connect(distGain)

  distGain.connect(musicBus)

  return { analyser, bassShelf, airFilter, slapWet, nearStereoGain, dirGain, panner3d, stereoPan, distGain }
}

function playDeck(idx, offset, fadeInSec, gen) {
  if (!acRef || !graph || !activeScene || gen !== sessionGen || acRef.state !== 'running') {
    starting = false
    return
  }
  const nextIdx = (idx + 1) % PLAYLIST.length
  trimCache(idx, nextIdx)

  loadTrackBuffer(acRef, idx).then((buf) => {
    starting = false
    if (!buf || !acRef || !graph || !activeScene || gen !== sessionGen || acRef.state !== 'running') return

    const safeOffset = Math.max(0, Math.min(buf.duration - 2, offset))
    const remain = buf.duration - safeOffset
    const fadeOutDur = Math.min(CROSSFADE, remain * 0.4)
    const xfadeDelaySec = Math.max(0.5, remain - fadeOutDur)
    const preloadDelaySec = Math.max(0.1, xfadeDelaySec - PRELOAD_LEAD)

    try {
      const now = acRef.currentTime
      const deckGain = acRef.createGain()
      if (fadeInSec > 0.05) {
        deckGain.gain.setValueAtTime(0.0001, now)
        deckGain.gain.linearRampToValueAtTime(1, now + fadeInSec)
      } else {
        deckGain.gain.setValueAtTime(1, now)
      }

      const src = acRef.createBufferSource()
      src.buffer = buf
      src.loop = false
      src.connect(deckGain)
      deckGain.connect(graph.analyser)
      src.start(now, safeOffset)

      const deck = { src, deckGain }
      activeDecks.add(deck)

      src.onended = () => {
        activeDecks.delete(deck)
        try {
          src.disconnect()
          deckGain.disconnect()
        } catch {
          /* yut */
        }
      }

      // Sıradaki DJ parçasını geçişten önce belleğe hazırla
      scheduleTimer(() => {
        if (gen !== sessionGen || !activeScene || !acRef) return
        loadTrackBuffer(acRef, nextIdx)
      }, preloadDelaySec * 1000)

      // Crossfade anında bu parçayı yumuşakça kıs, sıradaki parçayı yumuşakça yükselt
      scheduleTimer(() => {
        if (gen !== sessionGen || !activeScene || !acRef) return
        const tNow = acRef.currentTime
        try {
          deckGain.gain.cancelScheduledValues(tNow)
          deckGain.gain.setValueAtTime(Math.max(0.0001, deckGain.gain.value), tNow)
          deckGain.gain.linearRampToValueAtTime(0.0001, tNow + fadeOutDur)
          src.stop(tNow + fadeOutDur + 0.1)
        } catch {
          /* yut */
        }
        playDeck(nextIdx, 0, fadeOutDur, gen)
      }, xfadeDelaySec * 1000)
    } catch {
      /* yut */
    }
  })
}

function ensurePlaying() {
  if (!acRef || !graph || !activeScene || acRef.state !== 'running') return
  if (activeDecks.size > 0 || starting) return
  starting = true
  const { idx, offset } = pickWallClockSlot()
  playDeck(idx, offset, 0.8, sessionGen)
}

function stopAllDecks() {
  starting = false
  clearAllTimers()
  activeDecks.forEach((d) => {
    try {
      d.src.stop()
      d.src.disconnect()
      d.deckGain.disconnect()
    } catch {
      /* yut */
    }
  })
  activeDecks.clear()
}

// Engine hazır olduğunda ses zincirini bir kez kur
onReady((ac, buses) => {
  acRef = ac
  graph = buildGraph(ac, buses.music)
  ac.addEventListener('statechange', () => {
    if (ac.state === 'running' && activeScene) ensurePlaying()
  })
  if (activeScene) ensurePlaying()
})

function setPannerPos(panner, x, y, z, now) {
  if (!panner) return
  if (panner.positionX) {
    panner.positionX.setTargetAtTime(x, now, 0.05)
    panner.positionY.setTargetAtTime(y, now, 0.05)
    panner.positionZ.setTargetAtTime(z, now, 0.05)
  } else if (panner.setPosition) {
    panner.setPosition(x, y, z)
  }
}

/**
 * Her karede (City/BeachParty aktifken) oyuncu konumu ve kamera yönüne göre
 * 3B sağ/sol/ön/arka yönlendirmeyi ve açık hava atmosferini günceller.
 */
export function updateBeachPartySpatial(player, camFwdX, camFwdZ) {
  activeScene = true
  if (!acRef || !graph) return
  if (acRef.state === 'running' && activeDecks.size === 0 && !starting) ensurePlaying()
  if (acRef.state !== 'running') return

  const px = player?.x ?? 0
  const pz = player?.z ?? 56
  const dx = BEACH_PARTY.x - px
  const dz = BEACH_PARTY.z - pz
  const dist = Math.hypot(dx, dz)
  const now = acRef.currentTime

  if (dist >= MAX_DIST) {
    graph.distGain.gain.setTargetAtTime(0.0001, now, 0.18)
    return
  }

  // Kamera yatay ileri ve sağ birim vektörleri (Three.js sağ-el koordinat sistemi: Right = Forward × Up = (-fz, 0, fx))
  const flen = Math.hypot(camFwdX, camFwdZ) || 1
  const fx = camFwdX / flen
  const fz = camFwdZ / flen
  const rx = -fz
  const rz = fx

  // Oyuncudan DJ kabinine birim yön vektörü
  const invD = dist > 0.05 ? 1 / dist : 0
  const ux = dx * invD
  const uz = dz * invD

  // Sağ/sol (-1 sol .. +1 sağ) ve ön/arka (+1 tam karşıda .. -1 arkamızda)
  const rightDot = dist > 0.05 ? ux * rx + uz * rz : 0
  const frontDot = dist > 0.05 ? ux * fx + uz * fz : 1

  // Dans pistinin tam içindeyken (< 5.5m) geniş stereo sarılma, uzaklaştıkça %100 noktasal sağ/sol DJ yönü
  const nearWide = dist < 5.5 ? Math.pow(1 - dist / 5.5, 1.5) * 0.48 : 0
  graph.nearStereoGain.gain.setTargetAtTime(nearWide, now, 0.08)
  graph.dirGain.gain.setTargetAtTime(1 - nearWide * 0.55, now, 0.08)

  const nearSpread = Math.min(1, Math.max(0.28, dist / 3.0))
  const panVal = Math.max(-0.95, Math.min(0.95, rightDot * nearSpread * 0.88))

  if (graph.stereoPan) {
    graph.stereoPan.pan.setTargetAtTime(panVal, now, 0.05)
  }
  setPannerPos(
    graph.panner3d,
    rightDot * nearSpread * 2.6,
    Math.max(-0.4, Math.min(0.8, (STAGE_Y - 1.35) / Math.max(1.5, dist * 0.35))),
    -frontDot * nearSpread * 2.6,
    now,
  )

  // Mesafeye bağlı ses seviyesi (doğal açık hava düşüş eğrisi)
  const norm = dist <= FULL_DIST ? 0 : Math.min(1, (dist - FULL_DIST) / (MAX_DIST - FULL_DIST))
  const gain = 0.88 * Math.pow(1 - norm, 1.85)
  graph.distGain.gain.setTargetAtTime(Math.max(0.0001, gain), now, 0.08)

  // Atmosferik tiz sönümlemesi:
  // 1) Uzaklaştıkça deniz melteminde tizler yumuşar, tatlı parti bası ve melodi taşınır (18.5 kHz → 580 Hz)
  const baseCutoff = 580 + 17920 * Math.pow(1 - norm, 2.25)
  // 2) Sırtımızı DJ'e döndüğümüzde hafif kulak kepçesi gölgelemesi
  const headShadow = 0.72 + 0.28 * ((frontDot + 1) * 0.5)
  // 3) Ahşap DJ kabininin tam arkasına geçildiğinde hoparlör kabini gölgelemesi
  const toPlayerDot = -(ux * STAGE_FWD_X + uz * STAGE_FWD_Z)
  const stageCone = dist > 2.2 ? 0.68 + 0.32 * ((toPlayerDot + 1) * 0.5) : 1
  const cutoff = Math.max(480, Math.min(19000, baseCutoff * headShadow * stageCone))
  graph.airFilter.frequency.setTargetAtTime(cutoff, now, 0.1)

  // Yakında tok kulüp bası, uzakta dengeli açık hava bası
  graph.bassShelf.gain.setTargetAtTime(1.4 + 2.4 * (1 - norm), now, 0.12)

  // Orta mesafede (kumsal masaları / voleybol / şezlonglar) açık hava sahil eko hissi biraz daha belirginleşir
  const midAir = Math.sin(Math.min(1, dist / 28) * Math.PI)
  graph.slapWet.gain.setTargetAtTime(0.07 + 0.13 * midAir, now, 0.14)
}

/** İç mekâna veya eve girildiğinde dış sahil müziğini yumuşakça kısar. */
export function suspendBeachPartySpatial() {
  activeScene = false
  sessionGen++
  const stopGen = sessionGen
  if (!acRef || !graph) {
    stopAllDecks()
    return
  }
  const now = acRef.currentTime
  graph.distGain.gain.setTargetAtTime(0.0001, now, 0.22)
  setTimeout(() => {
    if (!activeScene && sessionGen === stopGen) stopAllDecks()
  }, 600)
}

/** Hoparlör konileri ve dans pisti ışıkları için canlı bas vuruşu enerjisi (0..1). */
export function getBeachPartyBeat() {
  if (!graph || activeDecks.size === 0 || !acRef || acRef.state !== 'running') return 0
  graph.analyser.getByteFrequencyData(freqBins)
  const bassSum = freqBins[0] + freqBins[1] + freqBins[2] + freqBins[3] + freqBins[4]
  return Math.min(1, Math.max(0, (bassSum / (5 * 255) - 0.32) * 1.9))
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    activeScene = false
    sessionGen++
    stopAllDecks()
  })
}
