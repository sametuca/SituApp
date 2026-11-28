// Sahil Partisi (Beach Party) 3B Uzamsal (Spatial) DJ Ses Sistemi:
// - DJ kabini ve kulüp hoparlörlerinden (BEACH_PARTY) yayılan gerçek zamanlı 3B yönlü müzik.
// - Kamera bakış açısına göre sol/sağ/ön/arka konumlandırma (HRTF + Stereo Pan): DJ sağındaysa sağdan, solundaysa soldan gelir.
// - Açık hava sahil atmosferi: mesafeye bağlı tiz yumuşaması (low-pass), bas sıcaklığı, açık alan eko yansıması ve sahne arkası boğukluğu.
// - Duvar saatine göre senkron başlangıç: sahildeki oyuncular şarkının aynı anını birlikte duyar.
import { BEACH_PARTY } from '../layout'
import { onReady } from './engine'

const TRACK_URL = '/audio/beach-party.mp3'
const STAGE_Y = 1.65 // Kulüp hoparlörlerinin yerden yüksekliği
const STAGE_FWD_X = Math.sin(BEACH_PARTY.ry)
const STAGE_FWD_Z = Math.cos(BEACH_PARTY.ry)
const FULL_DIST = 4.5 // Dans pisti içi tam enerji yarıçapı
const MAX_DIST = 58.0 // Şehir meydanına çıkarken tamamen sönümlenme mesafesi

let acRef = null
let graph = null
let decodedBuf = null
let loadingPromise = null
let sourceNode = null
let activeScene = false
const freqBins = new Uint8Array(32)

function loadBuffer(ac) {
  if (decodedBuf) return Promise.resolve(decodedBuf)
  if (loadingPromise) return loadingPromise
  loadingPromise = fetch(TRACK_URL)
    .then((r) => {
      if (!r.ok) throw new Error('beach track fetch failed')
      return r.arrayBuffer()
    })
    .then((arr) => ac.decodeAudioData(arr))
    .then((buf) => {
      decodedBuf = buf
      return buf
    })
    .catch(() => {
      loadingPromise = null
      return null
    })
  return loadingPromise
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

  // Açık hava sahil sahnesi hafif stereo slapback / atmosfer yansıması (yönlü kaynağın etrafında doğal açık alan derinliği)
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

  // Dans pistinin tam içindeyken (< 6m) iki kulüp hoparlörünün geniş stereo sahnesini koruyan yakın alan kolu
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
  // 1) Ortak bas + mesafe/yön hava filtresi
  analyser.connect(bassShelf)
  bassShelf.connect(airFilter)

  // 2) Yönlü 3B DJ kaynağı (HRTF + StereoPan → dirGain → distGain)
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

  // 3) Yakın alan geniş stereo sahne (dans pistinde iki hoparlör arası sarılma hissi)
  airFilter.connect(nearStereoGain)
  nearStereoGain.connect(distGain)

  // 4) Açık hava sahil yansıması (hafif stereo eko → distGain)
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

function ensurePlaying() {
  if (!acRef || !graph || !activeScene) return
  if (acRef.state !== 'running') return
  if (sourceNode) return

  loadBuffer(acRef).then((buf) => {
    if (!buf || !acRef || !graph || !activeScene || sourceNode || acRef.state !== 'running') return
    try {
      const src = acRef.createBufferSource()
      src.buffer = buf
      src.loop = true
      const offset = ((Date.now() / 1000) % buf.duration + buf.duration) % buf.duration
      src.connect(graph.analyser)
      src.start(0, offset)
      src.onended = () => {
        if (sourceNode === src) sourceNode = null
      }
      sourceNode = src
    } catch {
      sourceNode = null
    }
  })
}

function stopSource() {
  if (!sourceNode) return
  const s = sourceNode
  sourceNode = null
  try {
    s.stop()
    s.disconnect()
  } catch {
    /* yut */
  }
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
  if (acRef.state === 'running' && !sourceNode) ensurePlaying()
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
  if (!acRef || !graph) return
  const now = acRef.currentTime
  graph.distGain.gain.setTargetAtTime(0.0001, now, 0.22)
  setTimeout(() => {
    if (!activeScene) stopSource()
  }, 600)
}

/** Hoparlör konileri ve dans pisti ışıkları için canlı bas vuruşu enerjisi (0..1). */
export function getBeachPartyBeat() {
  if (!graph || !sourceNode || !acRef || acRef.state !== 'running') return 0
  graph.analyser.getByteFrequencyData(freqBins)
  // İlk 5 bin (~0–340 Hz kick & bas bölgesi)
  const bassSum = freqBins[0] + freqBins[1] + freqBins[2] + freqBins[3] + freqBins[4]
  return Math.min(1, Math.max(0, (bassSum / (5 * 255) - 0.32) * 1.9))
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    activeScene = false
    stopSource()
  })
}
