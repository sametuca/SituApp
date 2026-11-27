// Gökyüzü kubbesi (katmanlı gradyan shader, bulutlar) ve gökcisimleri (yıldız, ay, güneş diski).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, BackSide, BufferGeometry, Color, Float32BufferAttribute, ShaderMaterial, Vector3 } from 'three'
import { sunsetAt } from './worldClock'
import { C, MOON_DIR, SOFT, SUN_DIR, cur, glowTexture, mulberry, skyLive, sunDirAt, tmp } from './skyState'
export function Heavens() {
  const group = useRef()
  const stars = useRef()
  const moon = useRef()
  const moonHalo = useRef()
  const sun = useRef()
  const sunHalo = useRef()
  const halo = useMemo(() => glowTexture(SOFT), [])
  useEffect(() => () => halo.dispose(), [halo])
  const geo = useMemo(() => {
    const r = mulberry(7)
    const N = 170
    const pos = []
    const col = []
    const pal = [C('#ffffff'), C('#fff3b8'), C('#ffe9d0'), C('#cfe6ff')]
    for (let i = 0; i < N; i++) {
      const az = r() * Math.PI * 2
      const el = 0.12 + Math.acos(1 - r() * 0.92) * 0.95 // üst yarım küre
      const R = 170
      pos.push(Math.cos(az) * Math.sin(el) * R, Math.cos(el) * R, Math.sin(az) * Math.sin(el) * R)
      const c = pal[Math.floor(r() * pal.length)]
      col.push(c.r, c.g, c.b)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new Float32BufferAttribute(col, 3))
    return g
  }, [])
  useEffect(() => () => geo.dispose(), [geo])

  const camera = useThree((s) => s.camera)
  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    g.position.copy(camera.position)
    const night = skyLive.night
    const over = skyLive.over ?? 0
    if (stars.current) {
      stars.current.visible = night > 0.05
      stars.current.material.opacity = Math.max(0, night - 0.1) * (0.8 + Math.sin(clock.elapsedTime * 1.3) * 0.15) * (1 - over * 0.9)
    }
    const h = skyLive.hour
    if (moon.current) {
      moon.current.visible = night > 0.05
      moon.current.position.copy(MOON_DIR).multiplyScalar(150)
      moon.current.material.opacity = Math.min(1, night * 1.3) * (1 - over * 0.85)
      moonHalo.current.position.copy(moon.current.position)
      moonHalo.current.material.opacity = Math.min(1, night) * 0.55 * (1 - over * 0.85)
    }
    if (sun.current) {
      const vis = (1 - night) * (1 - over * 0.85)
      sun.current.visible = vis > 0.03
      sunDirAt(h, SUN_DIR)
      sun.current.position.copy(SUN_DIR).multiplyScalar(150)
      sun.current.material.color.copy(cur.sun).lerp(tmp.set('#fff3b0'), 0.5)
      sun.current.material.opacity = vis
      sunHalo.current.position.copy(sun.current.position)
      sunHalo.current.material.color.copy(cur.sun)
      sunHalo.current.material.opacity = vis * 0.6
    }
  })

  return (
    <group ref={group}>
      <points ref={stars} geometry={geo} frustumCulled={false} renderOrder={-2}>
        <pointsMaterial size={2.4} sizeAttenuation={false} vertexColors transparent depthWrite={false} fog={false} toneMapped={false} />
      </points>
      <mesh ref={moon} frustumCulled={false}>
        <sphereGeometry args={[7, 20, 14]} />
        <meshBasicMaterial color="#fff6d6" transparent fog={false} toneMapped={false} />
      </mesh>
      <sprite ref={moonHalo} scale={[48, 48, 1]}>
        <spriteMaterial map={halo} color="#c9d4ff" transparent depthWrite={false} blending={AdditiveBlending} fog={false} toneMapped={false} />
      </sprite>
      <mesh ref={sun} frustumCulled={false}>
        <sphereGeometry args={[8, 20, 14]} />
        <meshBasicMaterial color="#fff3b0" transparent fog={false} toneMapped={false} />
      </mesh>
      <sprite ref={sunHalo} scale={[60, 60, 1]}>
        <spriteMaterial map={halo} color="#ffffff" transparent depthWrite={false} blending={AdditiveBlending} fog={false} toneMapped={false} />
      </sprite>
    </group>
  )
}

// home: ev içi (sabit ışık). interior: mekân içi { bg, fog: [renk, near, far], dim } (gün-geceden bağımsız, temaya göre loş).
export const ZENITH_DAY = new Color('#3694f5')
export const MID_DAY = new Color('#86d2ff')
export const ZENITH_NIGHT = new Color('#161b4f')
export const MID_NIGHT = new Color('#2e3878')
export const ZENITH_DUSK = new Color('#78b0f2') // gündüzden kalan açık mavi
export const MID_DUSK = new Color('#ffb59a') // şeftali-pembe
export const LILAC_DAY = new Color('#5aa9f8')
export const LILAC_DUSK = new Color('#c4a8ec') // yumuşak leylak
export const LILAC_NIGHT = new Color('#232a6e')

/** Atmosferik 3 katmanlı gökyüzü + güneş saçılımı + rüzgârda süzülen yumuşak pastel bulutlar (tek shader, 0 doku). */
export function SkyDome() {
  const meshRef = useRef()
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: new Color('#3694f5') },
          uMid: { value: new Color('#86d2ff') },
          uLilac: { value: new Color('#6fb4fb') },
          uSunset: { value: 0 },
          uHorizon: { value: new Color('#dff2ff') },
          uSunDir: { value: new Vector3(0.5, 0.72, 0.35).normalize() },
          uSunCol: { value: new Color('#fff3cc') },
          uTime: { value: 0 },
          uNight: { value: 0 },
          uOver: { value: 0 },
        },
        vertexShader: `
          varying vec3 vDir;
          void main() {
            vDir = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uTop;
          uniform vec3 uMid;
          uniform vec3 uLilac;
          uniform float uSunset;
          uniform vec3 uHorizon;
          uniform vec3 uSunDir;
          uniform vec3 uSunCol;
          uniform float uTime;
          uniform float uNight;
          uniform float uOver;
          varying vec3 vDir;

          float hash(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
          }
          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
              mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
              u.y
            );
          }
          float fbm(vec2 p) {
            float v = 0.0;
            float a = 0.52;
            mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
            for (int i = 0; i < 4; i++) {
              v += a * noise(p);
              p = rot * p * 2.03 + vec2(7.3, 3.1);
              a *= 0.5;
            }
            return v;
          }

          void main() {
            vec3 d = normalize(vDir);
            float h = clamp(d.y, 0.0, 1.0);

            // 3 katmanlı atmosferik gradyan (ufuk → orta gök → derin tepe)
            // yaz akşamı: ufukta şeftali/altın → şeftali-pembe → leylak → gündüzden kalan açık mavi/camgöbeği
            vec3 sky = mix(uHorizon, uMid, smoothstep(0.0, 0.2, h));
            sky = mix(sky, uLilac, smoothstep(0.1, 0.46, h));
            sky = mix(sky, uTop, smoothstep(0.34, 0.95, h));
            // güneşe bakan ufukta altın parlama (turuncuya boğmadan, yalnızca dar bir bantta)
            float sd0 = max(dot(normalize(vec3(d.x, 0.0, d.z) + vec3(1e-4)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + vec3(1e-4))), 0.0);
            sky = mix(sky, vec3(1.0, 0.82, 0.55), pow(1.0 - h, 7.0) * (0.25 + 0.55 * pow(sd0, 3.0)) * uSunset);

            // Ufukta sıcak güneşli pastel parlaklık
            float horizonBand = pow(1.0 - h, 5.5) * (1.0 - uNight * 0.8);
            sky = mix(sky, mix(uHorizon, vec3(1.0, 0.96, 0.88), 0.45), horizonBand * 0.55);

            // Güneş saçılımı (Mie halesi + yumuşak güneş diski)
            float sunDot = max(dot(d, normalize(uSunDir)), 0.0);
            float sunHalo = pow(sunDot, 10.0) * 0.34 + pow(sunDot, 64.0) * 0.45;
            float sunCore = smoothstep(0.9965, 0.9992, sunDot) * 0.85;
            sky += uSunCol * (sunHalo + sunCore) * (1.0 - uNight * 0.85) * (1.0 - uOver * 0.6);

            // Rüzgârda süzülen yumuşak ressam-stili bulutlar
            if (d.y > 0.02) {
              vec2 uv = d.xz / (d.y + 0.24) * 1.35;
              vec2 wind = vec2(uTime * 0.016, uTime * 0.007);
              float n1 = fbm(uv + wind);
              float n2 = fbm(uv * 1.9 - wind * 0.6 + 11.4);
              float c = n1 * 0.72 + n2 * 0.28;
              float cover = mix(0.49, 0.34, uOver);
              float cloud = smoothstep(cover, cover + 0.24, c);
              // Ufka yaklaştıkça bulutlar yumuşakça sise karışır
              cloud *= smoothstep(0.02, 0.22, h) * (1.0 - smoothstep(0.82, 0.98, h) * 0.35);

              // Bulut gölgeleme: üstü krem-beyaz, altı yumuşak pastel mavi-lila, güneş kenarı altın parlama
              float shade = smoothstep(cover, cover + 0.35, fbm(uv + wind + normalize(uSunDir).xz * 0.14));
              vec3 cLit = mix(vec3(1.0, 0.995, 0.97), uSunCol, 0.15 + pow(sunDot, 6.0) * 0.28);
              vec3 cShd = mix(vec3(0.76, 0.86, 0.97), uMid, 0.28);
              vec3 cCol = mix(cShd, cLit, 0.38 + shade * 0.62);
              cCol = mix(cCol, vec3(0.24, 0.28, 0.52), uNight * 0.85);
              sky = mix(sky, cCol, cloud * 0.88);
            }

            gl_FragColor = vec4(sky, 1.0);
          }
        `,
      }),
    [],
  )
  useEffect(() => () => mat.dispose(), [mat])
  const tmpZ = useMemo(() => new Color(), [])
  const tmpM = useMemo(() => new Color(), [])
  useFrame(({ scene, camera, clock }) => {
    if (meshRef.current) meshRef.current.position.copy(camera.position)
    if (scene.fog) mat.uniforms.uHorizon.value.copy(scene.fog.color)
    const night = Number.isFinite(skyLive.night) ? skyLive.night : 0
    const sun = sunsetAt(skyLive.hour)
    tmpZ.copy(ZENITH_DAY).lerp(ZENITH_DUSK, sun).lerp(ZENITH_NIGHT, night)
    tmpM.copy(MID_DAY).lerp(MID_DUSK, sun).lerp(MID_NIGHT, night)
    mat.uniforms.uLilac.value.copy(LILAC_DAY).lerp(LILAC_DUSK, sun).lerp(LILAC_NIGHT, night)
    mat.uniforms.uSunset.value = sun * (1 - night)
    mat.uniforms.uTop.value.copy(tmpZ)
    mat.uniforms.uMid.value.copy(tmpM)
    mat.uniforms.uSunDir.value.copy(skyLive.dir)
    mat.uniforms.uTime.value = clock.elapsedTime
    mat.uniforms.uNight.value = night
    mat.uniforms.uOver.value = Number.isFinite(skyLive.over) ? skyLive.over : 0
  })
  return (
    <mesh ref={meshRef} material={mat} frustumCulled={false}>
      <sphereGeometry args={[210, 28, 18]} />
    </mesh>
  )
}

