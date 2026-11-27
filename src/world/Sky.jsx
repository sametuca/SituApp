// Gökyüzü ve ışık orkestratörü (Canvas içi): saat → anahtar kare renkleri, ambient/hemisphere, sis/arka plan; alt parçalar SkyDome/SkyLights.
import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { WIND } from './windSway'
import { nightAt, sunsetAt, worldClock } from './worldClock'
import { GRAY, MOON_DIR, SKY_MATS, SUN_DIR, frameAt, skyLive, sunDirAt, tmp } from './skyState'
import { Heavens, SkyDome } from './SkyDome'
import { DoorGlow, Fireflies, Lamps, Motes, SummerFestoons, WetSheen } from './SkyLights'
const HOME_BG = '#faeee2'
const HOME_FOG = [HOME_BG, 30, 60]

/** Diğer bileşenlerin okuduğu canlı gökyüzü durumu. */
// ---------------------------------------------------------------- ana bileşen
const EASE_WX = 3 // sn: hava geçişi
const MAX_HOUR_SPEED = 3.5 // saat/sn: mod değişiminde saatin akış hızı

export default function Sky({ home: homeProp, interior = null, focusRef }) {
  const home = Boolean(homeProp || interior)
  const scene = useThree((s) => s.scene)
  const amb = useRef()
  const hemi = useRef()
  const warmFill = useRef()
  const coolRim = useRef()
  const st = useRef({ dh: null, rain: 0, snow: 0, leaves: 0 })

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    WIND.time.value = (performance.now() / 1000) % 6000
    const s = st.current
    const target = worldClock.hour
    if (s.dh == null) s.dh = target
    let diff = ((target - s.dh + 36) % 24) - 12
    const step = MAX_HOUR_SPEED * dt
    diff = Math.max(-step, Math.min(step, diff))
    s.dh = (s.dh + diff + 24) % 24
    const h = s.dh

    // hava ağırlıkları yumuşakça hedefe
    const w = worldClock.weather
    for (const k of ['rain', 'snow', 'leaves']) {
      const goal = w === k ? 1 : 0
      const d = goal - s[k]
      s[k] += Math.sign(d) * Math.min(Math.abs(d), dt / EASE_WX)
    }
    const over = Math.min(1, s.rain + s.snow * 0.5 + s.leaves * 0.2)
    const night = nightAt(h)
    const sunset = sunsetAt(h)
    const k = frameAt(h)

    // pencere gökyüzü (hava durumu karışmadan önce hafif gri)
    skyLive.window.copy(k.bg).lerp(tmp.copy(GRAY).multiplyScalar(1 - 0.6 * night), over * 0.45)

    // hava etkisi
    const grey = tmp.copy(GRAY).multiplyScalar(1 - 0.6 * night)
    k.bg.lerp(grey, over * 0.55)
    k.fog.lerp(grey, over * 0.5)
    let fn = k.fn
    let ff = k.ff
    ff += (90 - ff) * s.rain * 0.5
    const sunI = k.sunI * (1 - 0.5 * over)

    skyLive.night = night
    skyLive.hour = h
    skyLive.over = over
    skyLive.wet = s.rain
    skyLive.lit = Math.min(1, night * 1.15 + sunset * 0.5)
    // ışık yönü: gündüz güneş, gece ay
    sunDirAt(h, SUN_DIR)
    skyLive.dir.copy(SUN_DIR).lerp(MOON_DIR, Math.min(1, night * 1.2)).normalize()
    skyLive.color.copy(k.sun)
    skyLive.intensity = sunI

    // paylaşılan malzemeler
    const lit = skyLive.lit
    SKY_MATS.window.emissiveIntensity = 0.35 + lit * 2.15
    SKY_MATS.window.emissive.set('#ffe49a').lerp(tmp.set('#ffbe55'), lit)
    SKY_MATS.neonPink.emissiveIntensity = 1.2 + lit * 2.3
    SKY_MATS.neonBlue.emissiveIntensity = 1.2 + lit * 2.3
    SKY_MATS.water.emissiveIntensity = 0.25 + night * 0.9
    SKY_MATS.fountainTop.emissiveIntensity = 0.3 + night * 1.1

    // ev içi: gün-geceden bağımsız sabit değerler
    const dimK = interior ? 1 - (interior.dim ?? 0) * 0.75 : 1
    if (warmFill.current) warmFill.current.intensity = (home ? 0.08 : 0.2) * (1 - over * 0.35) * (1 - night * 0.4) * dimK
    if (coolRim.current) coolRim.current.intensity = (home ? 0.06 : 0.24) * (1 - over * 0.45) * (1 - night * 0.55) * dimK
    const bg = interior ? tmp.set(interior.bg) : home ? tmp.set(HOME_BG) : k.bg
    const fogColor = home ? (interior ? interior.fog[0] : HOME_FOG[0]) : k.fog
    const fogNear = home ? (interior ? interior.fog[1] : HOME_FOG[1]) : fn
    const fogFar = home ? (interior ? interior.fog[2] : HOME_FOG[2]) : ff
    if (scene.background?.isColor) scene.background.copy(bg)
    if (scene.fog) {
      scene.fog.color.set(fogColor)
      scene.fog.near = fogNear
      scene.fog.far = fogFar
    }
    if (amb.current) {
      amb.current.color.copy(home ? tmp.set('#ffffff') : k.amb)
      amb.current.intensity = home ? 0.7 * dimK : k.ambI * (1 - 0.1 * over)
    }
    if (hemi.current) {
      hemi.current.color.copy(home ? tmp.set('#ffffff') : k.hs)
      hemi.current.groundColor.copy(home ? tmp.set('#ffedd6') : k.hg)
      hemi.current.intensity = home ? 1.1 * dimK : k.hI * (1 - 0.1 * over)
    }
  })

  return (
    <>
      <ambientLight ref={amb} intensity={0.7} />
      <hemisphereLight ref={hemi} args={['#ffffff', '#ffedd6', 1.1]} />
      <directionalLight ref={warmFill} position={[8, 12, 6]} color="#fff0dc" intensity={0.2} />
      <directionalLight ref={coolRim} position={[-8, 7, -8]} color="#c8e8ff" intensity={0.24} />
      {!home && (
        <>
          <SkyDome />
          <Heavens />
          <Lamps focusRef={focusRef} />
          <DoorGlow />
          <Motes focusRef={focusRef} />
          <SummerFestoons />
          <Fireflies />
          <WetSheen focusRef={focusRef} />
        </>
      )}
    </>
  )
}

export { skyLive, SKY_MATS } from './skyState'
