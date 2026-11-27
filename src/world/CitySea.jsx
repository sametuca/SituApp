// Deniz, güneş yolu parıltısı, kıyı dalgaları, sınır şamandıraları, gölet ve iskele.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { AdditiveBlending, CanvasTexture, Color, PlaneGeometry, Object3D, ShaderMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three'
import { RoundedBox } from '@react-three/drei'
import { ISLAND, PIER, PLAY_BOUNDS, RIM } from './layout'
import { playerPos } from './cull'
import { skyLive } from './Sky'
import { worldClock } from './worldClock'
import { stdMat } from './CityGroundUtils'
// ---------- deniz: adanın dört yanı (Meshy dokulu, animasyonlu) ----------
export const WATER_COLOR = new Color('#feda9d')
export const WATER_NIGHT = new Color('#294582')

// ---------- dünya sınırı: şamandıra halatı (oyuncu bunun ötesine geçemez; tatlı bir "buraya kadar" çizgisi) ----------
export const BUOY_OFF = 3.2 // oynanabilir sınırın ötesinde (m)
export function Buoys() {
  const ref = useRef()
  const inited = useRef(false)
  const pts = useMemo(() => {
    const b = { x0: PLAY_BOUNDS.x0 - BUOY_OFF, x1: PLAY_BOUNDS.x1 + BUOY_OFF, z0: PLAY_BOUNDS.z0 - BUOY_OFF, z1: PLAY_BOUNDS.z1 + BUOY_OFF }
    const out = []
    const step = 7
    for (let x = b.x0; x <= b.x1; x += step) {
      out.push([x, b.z0])
      if (Math.abs(x - PIER.x) > PIER.hw + 1.8) out.push([x, b.z1]) // iskele üstünde şamandıra çıkmasın
    }
    for (let z = b.z0 + step; z < b.z1; z += step) out.push([b.x0, z], [b.x1, z])
    return { list: out, b }
  }, [])
  const colors = useMemo(() => pts.list.map((_, i) => (i % 2 ? '#ffffff' : '#ff9f43')), [pts])
  useEffect(() => {
    if (!ref.current) return
    colors.forEach((c, i) => ref.current.setColorAt(i, new Color(c)))
    ref.current.instanceColor.needsUpdate = true
  }, [colors])
  const dummy = useMemo(() => new Object3D(), [])
  useFrame(({ clock }) => {
    if (!ref.current) return
    if (inited.current && Math.abs(playerPos.x) < 52 && Math.abs(playerPos.z) < 42) return
    inited.current = true
    const t = clock.elapsedTime
    pts.list.forEach(([x, z], i) => {
      dummy.position.set(x, 0.18 + Math.sin(t * 1.3 + i * 0.9) * 0.08, z)
      dummy.rotation.set(Math.sin(t * 0.9 + i) * 0.1, 0, Math.cos(t * 1.1 + i) * 0.1)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  })
  const { b } = pts
  const W = b.x1 - b.x0
  const D = b.z1 - b.z0
  const rope = (cx, cz, w, d, k) => (
    <mesh key={k} position={[cx, 0.08, cz]}>
      <boxGeometry args={[w, 0.05, d]} />
      <primitive object={stdMat('#fff3e0', 0.9)} attach="material" />
    </mesh>
  )
  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, pts.list.length]} frustumCulled={false}>
        <sphereGeometry args={[0.42, 12, 8]} />
        <meshStandardMaterial roughness={0.5} />
      </instancedMesh>
      {rope((b.x0 + b.x1) / 2, b.z0, W, 0.06, 'n')}
      {rope((b.x0 + (PIER.x - PIER.hw - 0.4)) / 2, b.z1, (PIER.x - PIER.hw - 0.4) - b.x0, 0.06, 'sw')}
      {rope(((PIER.x + PIER.hw + 0.4) + b.x1) / 2, b.z1, b.x1 - (PIER.x + PIER.hw + 0.4), 0.06, 'se')}
      {rope(b.x0, (b.z0 + b.z1) / 2, 0.06, D, 'w')}
      {rope(b.x1, (b.z0 + b.z1) / 2, 0.06, D, 'e')}
    </group>
  )
}

// Güneş yolu: güneşin tam karşı yönünde, oyuncudan ufka uzanan, denizde titreşen altın parıltı şeridi (alçak güneşte güçlü, geceleyin ay yakamozuna devreder)
export const GLITTER_L = 420
export const glitterMat = () =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
    uniforms: { uT: { value: 0 }, uK: { value: 0 }, uCol: { value: new Color('#ffd27a') } },
    vertexShader: 'varying vec2 vUv; varying vec2 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `
      varying vec2 vUv; varying vec2 vW; uniform float uT; uniform float uK; uniform vec3 uCol;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        float d = vUv.y * ${GLITTER_L.toFixed(1)};
        float hw = 9.0 + d * 0.22;
        float u = (vUv.x - 0.5) * 240.0 / hw;
        u += sin(vW.y * 0.17 + uT * 0.8) * 0.10 + sin(vW.x * 0.11 - uT * 0.6) * 0.06;
        float band = exp(-u * u * 2.4);
        float along = smoothstep(0.0, 0.07, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
        vec2 cell = floor(vW * 0.55);
        float ph = h(cell) * 6.2831;
        float tw = 0.5 + 0.5 * sin(uT * (1.6 + h(cell + 3.0) * 2.4) + ph);
        float spark = smoothstep(0.62, 1.0, h(cell + 7.0)) * tw;
        float a = (band * 0.16 + band * band * spark * 0.95) * along * uK;
        gl_FragColor = vec4(uCol * a, a);
      }`,
  })

export function SunGlitter() {
  const grp = useRef()
  const mat = useMemo(glitterMat, [])
  const geo = useMemo(() => {
    const g = new PlaneGeometry(240, GLITTER_L)
    g.translate(0, GLITTER_L / 2, 0)
    return g
  }, [])
  useEffect(() => () => (mat.dispose(), geo.dispose()), [mat, geo])
  useFrame(({ clock }) => {
    const g = grp.current
    if (!g) return
    const dx = skyLive.dir.x
    const dz = skyLive.dir.z
    const night = Number.isFinite(worldClock.night) ? worldClock.night : 0
    const sunset = Number.isFinite(worldClock.sunset) ? worldClock.sunset : 0
    const low = 1 - Math.min(1, Math.max(0, (skyLive.dir.y - 0.25) / 0.7)) // güneş alçaldıkça güçlenir
    const k = (1 - night) * (0.35 + 0.65 * Math.max(low, sunset)) * (1 - 0.7 * (skyLive.over ?? 0))
    g.visible = k > 0.02 && Math.hypot(dx, dz) > 0.05
    if (!g.visible) return
    g.position.set(playerPos.x, -0.012, playerPos.z)
    g.rotation.y = Math.atan2(-dx, -dz)
    mat.uniforms.uT.value = clock.elapsedTime
    mat.uniforms.uK.value = k
  })
  return (
    <group ref={grp} visible={false}>
      <mesh geometry={geo} material={mat} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2} frustumCulled={false} />
    </group>
  )
}

export function Sea() {
  const water = useLoader(TextureLoader, '/textures/water.webp')
  const foam = useLoader(TextureLoader, '/textures/foam.webp')
  const [deep, swell, ring] = useMemo(() => {
    const mk = (src, m, size) => {
      const t = src.clone()
      t.wrapS = t.wrapT = RepeatWrapping
      t.colorSpace = SRGBColorSpace
      t.anisotropy = 8
      t.repeat.set(size / m, size / m)
      t.needsUpdate = true
      return t
    }
    return [mk(water, 14, 2200), mk(foam, 9, 2200), mk(foam, 7, 120)]
  }, [water, foam])
  // köpük şeridi kenarları yumuşasın: ortası dolu, iki kenarı saydam bir alfa haritası
  const fade = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = 4
    cv.height = 64
    const g = cv.getContext('2d')
    const gr = g.createLinearGradient(0, 0, 0, 64)
    gr.addColorStop(0, '#000')
    gr.addColorStop(0.5, '#fff')
    gr.addColorStop(1, '#000')
    g.fillStyle = gr
    g.fillRect(0, 0, 4, 64)
    return new CanvasTexture(cv)
  }, [])
  const mat = useRef()
  const mat2 = useRef()
  const moonPath = useRef()
  const plane = useRef()
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    deep.offset.x += dt * 0.010
    deep.offset.y += dt * 0.006
    swell.offset.x -= dt * 0.012
    swell.offset.y += dt * 0.008
    ring.offset.x += dt * 0.02
    if (plane.current) plane.current.position.y = -0.05 + Math.sin(t * 0.7) * 0.025 // yavaş kabarma
    const night = Number.isFinite(worldClock.night) ? worldClock.night : 0
    if (mat.current) mat.current.color.copy(WATER_COLOR).lerp(WATER_NIGHT, night * 0.88)
    if (mat2.current) mat2.current.opacity = 0.16 + Math.sin(t * 0.9) * 0.05
    if (moonPath.current) {
      const mVis = night > 0.1
      moonPath.current.visible = mVis
      if (mVis) {
        moonPath.current.material.opacity = (night - 0.1) * 0.24 * (0.85 + Math.sin(t * 2.1) * 0.15)
        moonPath.current.scale.x = 1 + Math.sin(t * 1.4) * 0.08
      }
    }
  })
  // kıyıya vuran dalgalar: her kenarda 3 bant, aynı döngüde faz farklı; açıktan kıyıya yürür, kıyıda sönüp kaybolur
  const WAVES = 3
  const CYCLE = 6.5 // sn
  const TRAVEL = 6 // m
  const W = ISLAND.x1 - ISLAND.x0
  const D = ISLAND.z1 - ISLAND.z0
  const cx = (ISLAND.x0 + ISLAND.x1) / 2
  const cz = (ISLAND.z0 + ISLAND.z1) / 2
  // kenar: normal (açık denize), kıyı çizgisinin konumu, bant uzunluğu
  const sides = [
    { n: [0, -1], edge: ISLAND.z0 - RIM, len: W + RIM * 2 + 6 },
    { n: [0, 1], edge: ISLAND.z1 + RIM, len: W + RIM * 2 + 6 },
    { n: [-1, 0], edge: ISLAND.x0 - RIM, len: D + RIM * 2 + 6 },
    { n: [1, 0], edge: ISLAND.x1 + RIM, len: D + RIM * 2 + 6 },
  ]
  const bands = useRef([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    bands.current.forEach((m, i) => {
      if (!m) return
      const sd = sides[Math.floor(i / WAVES)]
      const k = i % WAVES
      const ph = (t / CYCLE + k / WAVES) % 1 // 0 = açıkta, 1 = kıyıda
      const dist = (1 - ph) * TRAVEL + 0.4
      m.position.set(sd.n[0] ? sd.edge + sd.n[0] * dist : cx, -0.025, sd.n[1] ? sd.edge + sd.n[1] * dist : cz)
      const env = Math.sin(ph * Math.PI) // belirir, kıyıda yok olur
      m.material.opacity = 0.5 * env * env + (ph > 0.85 ? 0.12 * (1 - (ph - 0.85) / 0.15) : 0)
    })
  })
  return (
    <group>
      <mesh ref={plane} position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2200, 2200]} />
        <meshStandardMaterial ref={mat} map={deep} roughness={0.14} metalness={0.22} envMapIntensity={1.45} emissive="#3aa9c9" emissiveIntensity={0.07} />
      </mesh>
      <mesh position={[0, -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2200, 2200]} />
        <meshBasicMaterial ref={mat2} map={swell} transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <SunGlitter />
      {/* Yaz akşamı denizde ay ışığı yakamozu */}
      <mesh ref={moonPath} position={[14, -0.015, ISLAND.z1 + 58]} rotation={[-Math.PI / 2, 0, -0.22]} visible={false}>
        <planeGeometry args={[18, 95]} />
        <meshBasicMaterial map={fade} color="#ffe7a8" transparent opacity={0} depthWrite={false} />
      </mesh>
      {sides.flatMap((sd, si) =>
        Array.from({ length: WAVES }, (_, k) => {
          const i = si * WAVES + k
          return (
            <mesh key={i} ref={(m) => (bands.current[i] = m)} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={sd.n[0] ? [1.6, sd.len] : [sd.len, 1.6]} />
              <meshBasicMaterial map={ring} alphaMap={fade} transparent opacity={0} depthWrite={false} />
            </mesh>
          )
        }),
      )}
    </group>
  )
}

/** Gölet: Meshy su dokusu + kum kıyısı + nilüfer yaprakları. */
export function Pond({ x, z, r }) {
  const water = useLoader(TextureLoader, '/textures/water.webp')
  const map = useMemo(() => {
    const t = water.clone()
    t.wrapS = t.wrapT = RepeatWrapping
    t.colorSpace = SRGBColorSpace
    t.repeat.set((r * 2) / 6, (r * 2) / 6)
    t.needsUpdate = true
    return t
  }, [water, r])
  const pads = useMemo(
    () => [
      [-2.1, -1.6, 0.55, true],
      [2.3, -1.2, 0.48, false],
      [-1.4, 2.2, 0.52, true],
      [1.8, 2.0, 0.6, false],
      [0.3, -2.8, 0.45, true],
    ],
    [],
  )
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[r + 1.1, 48]} />
        <meshStandardMaterial color="#f6e3b0" roughness={1} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[r, 48]} />
        <meshStandardMaterial map={map} color="#bfeaf5" roughness={0.2} />
      </mesh>
      {pads.map(([px, pz, pr, bloom], i) => (
        <group key={i} position={[px, 0.07, pz]}>
          <mesh rotation={[-Math.PI / 2, 0, i]}>
            <circleGeometry args={[pr, 12, 0, Math.PI * 1.82]} />
            <meshStandardMaterial color="#7be090" roughness={0.7} />
          </mesh>
          {bloom && (
            <mesh position={[0, 0.08, 0]}>
              <dodecahedronGeometry args={[0.14, 0]} />
              <meshStandardMaterial color={i % 2 ? '#fff0f6' : '#ff9ec7'} roughness={0.4} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

/** Güney plajının deniz kenarından denize uzanan pastel ahşap iskele. */
export function BeachPier() {
  return (
    <group position={[PIER.x, 0, (PIER.z0 + PIER.z1) / 2]}>
      <RoundedBox args={[3.2, 0.18, 9.6]} radius={0.05} position={[0, 0.28, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#f2cfa2" roughness={0.75} />
      </RoundedBox>
      {[-1.35, 1.35].map((px) =>
        [-3.6, 0, 3.8].map((pz) => (
          <group key={`${px}|${pz}`} position={[px, 0, pz]}>
            <mesh position={[0, 0.25, 0]} castShadow>
              <cylinderGeometry args={[0.12, 0.14, 1.1, 8]} />
              <meshStandardMaterial color="#cfa06e" roughness={0.8} />
            </mesh>
            {pz === 3.8 && (
              <mesh position={[0, 0.92, 0]}>
                <sphereGeometry args={[0.16, 10, 8]} />
                <meshStandardMaterial color="#fff3c4" emissive="#ffd970" emissiveIntensity={0.9} />
              </mesh>
            )}
          </group>
        )),
      )}
    </group>
  )
}

/** Gökyüzünde yavaşça süzülen pofuduk pastel bulutlar + çeşme su fıskiyesi. */
