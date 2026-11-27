// Şehir süsleri ve canlı efektler: çardak, havlular, güneş ışığı, bulutlar, çeşme, balon, hız halkaları.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, DoubleSide, ExtrudeGeometry, ShaderMaterial, Shape, SRGBColorSpace } from 'three'
import { RoundedBox } from '@react-three/drei'
import { GAZEBO, SPEED_RING_POS } from './layout'
import { skyLive } from './Sky'
import { sharedTexture, stdMat } from './CityGroundUtils'
import { getPuffyShinglePair } from './pastelTex'
export function Gazebo() {
  const posts = Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2)
  const shingle = useMemo(() => getPuffyShinglePair(), [])
  const { map, bumpMap } = useMemo(() => {
    const setup = (t) => t.repeat.set(5, 2.5)
    return {
      map: sharedTexture(shingle.map, 'gazebo_roof', setup),
      bumpMap: sharedTexture(shingle.bump, 'bgazebo_roof', setup),
    }
  }, [shingle])
  return (
    <group position={[GAZEBO.x, 0, GAZEBO.z]}>
      <mesh position={[0, 0.14, 0]} receiveShadow>
        <cylinderGeometry args={[3.35, 3.55, 0.28, 32]} />
        <primitive object={stdMat('#fff2e3', 0.55)} attach="material" />
      </mesh>
      <mesh position={[0, 0.29, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.28, 0.09, 10, 32]} />
        <primitive object={stdMat('#f4d8bc', 0.5)} attach="material" />
      </mesh>
      {posts.map((a, i) => {
        const px = Math.cos(a) * 2.7
        const pz = Math.sin(a) * 2.7
        return (
          <group key={i} position={[px, 0, pz]}>
            <mesh position={[0, 0.34, 0]}>
              <cylinderGeometry args={[0.25, 0.29, 0.22, 14]} />
              <primitive object={stdMat('#f7e8dc', 0.45)} attach="material" />
            </mesh>
            <mesh position={[0, 1.85, 0]} castShadow>
              <cylinderGeometry args={[0.17, 0.2, 3.0, 14]} />
              <primitive object={stdMat('#fffaf4', 0.42)} attach="material" />
            </mesh>
            <mesh position={[0, 3.35, 0]}>
              <sphereGeometry args={[0.24, 12, 10]} />
              <primitive object={stdMat('#ffe3c6', 0.42)} attach="material" />
            </mesh>
          </group>
        )
      })}
      {/* İçeride yuvarlak pastel masa, saksı çiçekler ve sarkan sıcak fener */}
      <mesh position={[0, 0.56, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.14, 0.22, 0.58, 12]} />
        <primitive object={stdMat('#f4d8bc', 0.55)} attach="material" />
      </mesh>
      <mesh position={[0, 0.88, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.78, 0.72, 0.12, 24]} />
        <primitive object={stdMat('#fffaf2', 0.45)} attach="material" />
      </mesh>
      <mesh position={[0, 0.99, 0]}>
        <cylinderGeometry args={[0.16, 0.12, 0.14, 10]} />
        <primitive object={stdMat('#ff9ec7', 0.5)} attach="material" />
      </mesh>
      <mesh position={[0, 1.12, 0]}>
        <dodecahedronGeometry args={[0.16, 0]} />
        <primitive object={stdMat('#8fdcb4', 0.55)} attach="material" />
      </mesh>
      {/* Tavan feneri */}
      <mesh position={[0, 3.12, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.65, 8]} />
        <primitive object={stdMat('#8a7a9c', 0.5)} attach="material" />
      </mesh>
      <mesh position={[0, 2.74, 0]}>
        <sphereGeometry args={[0.2, 14, 12]} />
        <meshStandardMaterial color="#fff3c4" emissive="#ffc86b" emissiveIntensity={1.4} roughness={0.25} />
      </mesh>
      {/* Sütun aralarında yarım korkuluk ve pastel çiçeklikler (doğu girişi açık) */}
      {posts.slice(1).map((a, i) => {
        const mx = Math.cos(a - Math.PI / 6) * 2.7
        const mz = Math.sin(a - Math.PI / 6) * 2.7
        return (
          <group key={i} position={[mx, 0.42, mz]} rotation={[0, -(a - Math.PI / 6) + Math.PI / 2, 0]}>
            <RoundedBox args={[2.1, 0.16, 0.22]} radius={0.06} smoothness={2} castShadow>
              <meshStandardMaterial color="#ffe3c6" roughness={0.55} />
            </RoundedBox>
            <mesh position={[0, 0.14, 0]}>
              <sphereGeometry args={[0.16, 10, 8]} />
              <meshStandardMaterial color={i % 2 ? '#ff9ec7' : '#ffd35e'} roughness={0.5} />
            </mesh>
          </group>
        )
      })}
      {/* pofuduk kubbemsi kiremit çatı + yumuşak saçak halkası + tepe topuzu */}
      <mesh position={[0, 3.45, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[3.55, 0.2, 12, 36]} />
        <primitive object={stdMat('#d8c4ff', 0.45)} attach="material" />
      </mesh>
      <mesh position={[0, 4.35, 0]} castShadow>
        <coneGeometry args={[3.72, 1.95, 24]} />
        <meshStandardMaterial color="#bfa4ff" map={map} bumpMap={bumpMap} bumpScale={0.06} roughness={0.46} />
      </mesh>
      <mesh position={[0, 5.4, 0]} castShadow>
        <sphereGeometry args={[0.28, 14, 12]} />
        <primitive object={stdMat('#ffd35e', 0.3)} attach="material" />
      </mesh>
    </group>
  )
}

export const towelTexCache = new Map()
export function getTowelTex(baseHex) {
  if (towelTexCache.has(baseHex)) return towelTexCache.get(baseHex)
  const cv = document.createElement('canvas')
  cv.width = 128
  cv.height = 256
  const ctx = cv.getContext('2d')
  ctx.fillStyle = baseHex
  ctx.fillRect(0, 0, 128, 256)
  // pastel beyaz/krem çizgiler ve kenar bordürü
  ctx.fillStyle = 'rgba(255, 250, 242, 0.55)'
  for (let y = 18; y < 240; y += 28) ctx.fillRect(0, y, 128, 10)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)'
  ctx.fillRect(0, 0, 128, 10)
  ctx.fillRect(0, 246, 128, 10)
  ctx.fillRect(0, 0, 6, 256)
  ctx.fillRect(122, 0, 6, 256)
  // hafif havlu dokusu
  ctx.fillStyle = 'rgba(74, 59, 92, 0.04)'
  for (let y = 0; y < 256; y += 4) for (let x = (y % 8 === 0 ? 0 : 2); x < 128; x += 4) ctx.fillRect(x, y, 2, 2)
  const tex = new CanvasTexture(cv)
  tex.colorSpace = SRGBColorSpace
  towelTexCache.set(baseHex, tex)
  return tex
}

/** Plaj havlusu: yumuşak yuvarlatılmış yastıksı pastel havlu. */
export function Towel({ t }) {
  const map = useMemo(() => getTowelTex(t.c), [t.c])
  return (
    <RoundedBox args={[0.98, 0.055, 1.92]} radius={0.024} smoothness={2} position={[t.x, 0.06, t.z]} rotation={[0, t.ry, 0]} receiveShadow>
      <meshStandardMaterial map={map} roughness={0.78} />
    </RoundedBox>
  )
}

/** Gece kulübünden dışarıya doğru yükselen sol anahtarı / nota animasyonu (WebGL sprite — DOM yükü yok). */
export function ClubMusicNotes() {
  const notes = useMemo(() => {
    const syms = ['🎼', '🎵', '🎶']
    const texs = syms.map((sym) => {
      const cv = document.createElement('canvas')
      cv.width = 64
      cv.height = 64
      const ctx = cv.getContext('2d')
      ctx.font = '48px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(sym, 32, 34)
      const tex = new CanvasTexture(cv)
      tex.colorSpace = SRGBColorSpace
      return tex
    })
    return [
      { tex: texs[0], dx: -1.4, dz: 0.4, phase: 0 },
      { tex: texs[1], dx: 0.2, dz: -0.3, phase: 0.33 },
      { tex: texs[2], dx: 1.5, dz: 0.2, phase: 0.66 },
    ]
  }, [])
  useEffect(() => () => notes.forEach((n) => n.tex.dispose()), [notes])
  const refs = useRef([])
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    notes.forEach((n, i) => {
      const sp = refs.current[i]
      if (!sp) return
      const p = (t * 0.28 + n.phase) % 1
      sp.position.set(26 + n.dx + Math.sin(t * 1.8 + i * 2) * 0.45, 7.6 + p * 4.2, -9.2 + n.dz)
      const s = Math.sin(p * Math.PI)
      sp.scale.setScalar(0.55 + s * 0.5)
      if (sp.material) sp.material.opacity = s
    })
  })
  return (
    <group>
      {notes.map((n, i) => (
        <sprite key={i} ref={(el) => (refs.current[i] = el)} position={[26 + n.dx, 7.6, -9.2 + n.dz]}>
          <spriteMaterial map={n.tex} transparent depthWrite={false} />
        </sprite>
      ))}
    </group>
  )
}

/** Gölge kamerası oyuncuyu takip eden güneş (0,5 m ızgaraya oturtulur: yürürken gölge titreşmez). */
export function Sun({ focusRef }) {
  const light = useRef()
  useFrame(() => {
    const l = light.current
    if (!l) return
    const f = focusRef.current
    const sx = Math.round(f.x * 2) / 2
    const sz = Math.round(f.z * 2) / 2
    // güneş/ay yönü ve rengi gün-gece döngüsünden (Sky.jsx)
    l.position.set(sx + skyLive.dir.x * 28, skyLive.dir.y * 28, sz + skyLive.dir.z * 28)
    l.color.copy(skyLive.color)
    l.intensity = skyLive.intensity
    l.target.position.set(sx, 0, sz)
    l.target.updateMatrixWorld()
  })
  return (
    <directionalLight
      ref={light}
      castShadow
      intensity={1.6}
      shadow-mapSize={[1024, 1024]}
      shadow-camera-left={-20}
      shadow-camera-right={20}
      shadow-camera-top={20}
      shadow-camera-bottom={-20}
      shadow-camera-near={1}
      shadow-camera-far={56}
      shadow-bias={-0.0005}
      shadow-normalBias={0.032}
      shadow-radius={2}
    />
  )
}

export function ToyClouds() {
  const clouds = useMemo(
    () => [
      { x: -45, y: 34, z: -38, s: 1.4, sp: 0.6 },
      { x: 18, y: 37, z: -55, s: 1.7, sp: 0.45 },
      { x: 58, y: 33, z: -12, s: 1.3, sp: 0.55 },
      { x: -32, y: 36, z: 32, s: 1.5, sp: 0.5 },
      { x: 35, y: 35, z: 42, s: 1.25, sp: 0.65 },
    ],
    [],
  )
  const refs = useRef([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    clouds.forEach((c, i) => {
      const g = refs.current[i]
      if (!g) return
      g.position.x = ((c.x + t * c.sp + 90) % 180) - 90
    })
  })
  return (
    <group>
      {clouds.map((c, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)} position={[c.x, c.y, c.z]} scale={c.s}>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[2.2, 10, 8]} />
            <meshStandardMaterial color="#ffffff" roughness={0.9} />
          </mesh>
          <mesh position={[-1.9, -0.35, 0.2]}>
            <sphereGeometry args={[1.55, 10, 8]} />
            <meshStandardMaterial color="#fff9f5" roughness={0.9} />
          </mesh>
          <mesh position={[1.9, -0.3, -0.2]}>
            <sphereGeometry args={[1.65, 10, 8]} />
            <meshStandardMaterial color="#fff9f5" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function FountainFx() {
  const ring = useRef()
  const top = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const p = (t * 0.7) % 1
    if (ring.current) {
      ring.current.scale.setScalar(0.5 + p * 1.4)
      ring.current.material.opacity = (1 - p) * 0.55
    }
    if (top.current) {
      top.current.position.y = 2.05 + Math.sin(t * 5) * 0.1
      top.current.scale.setScalar(0.9 + Math.sin(t * 7) * 0.12)
    }
  })
  return (
    <group position={[0, 0, 0]} scale={1.15}>
      <mesh ref={top} position={[0, 2.05, 0]}>
        <sphereGeometry args={[0.28, 10, 8]} />
        <meshStandardMaterial color="#d8f6ff" emissive="#9be4ff" emissiveIntensity={0.45} roughness={0.1} transparent opacity={0.85} />
      </mesh>
      <mesh ref={ring} position={[0, 0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.3, 1.5, 28]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** Şehir gökyüzünde yavaşça süzülen pastel sıcak hava balonu. */
export function SkyBalloon() {
  const ref = useRef()
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const t = clock.elapsedTime * 0.08
    g.position.set(Math.cos(t) * 28, 26 + Math.sin(clock.elapsedTime * 0.7) * 0.8, Math.sin(t) * 28)
    g.rotation.y = -t
  })
  return (
    <group ref={ref} position={[28, 26, 0]}>
      <mesh position={[0, 2.2, 0]}>
        <sphereGeometry args={[2.1, 16, 12]} />
        <meshStandardMaterial color="#ff9ec7" roughness={0.55} />
      </mesh>
      <mesh position={[0, 2.2, 0]} scale={[1.01, 0.45, 1.01]}>
        <sphereGeometry args={[2.1, 16, 8]} />
        <meshStandardMaterial color="#ffe478" roughness={0.55} />
      </mesh>
      <RoundedBox args={[0.9, 0.75, 0.9]} radius={0.08} position={[0, -0.45, 0]}>
        <meshStandardMaterial color="#e8b882" roughness={0.75} />
      </RoundedBox>
    </group>
  )
}

/** Şehir yollarında içinden geçince hız artışı veren fantastik enerji geçitleri (enerji girdabı, dönen rün halkaları, 3B şimşek tacı ve ışıklı zemin okları). */
export function SpeedRings() {
  const outerRefs = useRef([])
  const innerRefs = useRef([])
  const runeRefs = useRef([])
  const crestRefs = useRef([])

  // 3B şimşek rozeti geometrisi
  const boltGeo = useMemo(() => {
    const sh = new Shape()
    sh.moveTo(0.04, 0.36)
    sh.lineTo(-0.22, 0.02)
    sh.lineTo(-0.02, 0.02)
    sh.lineTo(-0.12, -0.36)
    sh.lineTo(0.24, 0.04)
    sh.lineTo(0.04, 0.04)
    sh.closePath()
    const g = new ExtrudeGeometry(sh, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 2 })
    g.center()
    return g
  }, [])

  // Kapı içi dönen enerji girdabı shader'ı
  const portalMat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        uniforms: { uTime: { value: 0 } },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv * 2.0 - 1.0;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            float r = length(vUv);
            if (r > 1.0) discard;
            float a = atan(vUv.y, vUv.x);
            float swirl = sin(a * 4.0 - r * 10.0 + uTime * 5.0) * 0.5 + 0.5;
            float rings = sin(r * 16.0 - uTime * 6.5) * 0.5 + 0.5;
            float edge = smoothstep(1.0, 0.65, r) * smoothstep(0.08, 0.42, r);
            float core = (1.0 - smoothstep(0.0, 0.35, r)) * 0.45;
            vec3 c1 = vec3(0.45, 0.94, 1.0);
            vec3 c2 = vec3(0.72, 0.58, 1.0);
            vec3 c3 = vec3(1.0, 0.84, 0.42);
            vec3 col = mix(c2, c1, swirl * 0.75 + rings * 0.25);
            col = mix(col, c3, pow(rings * swirl, 2.0) * 0.55);
            float alpha = clamp((edge * (0.28 + swirl * 0.28 + rings * 0.16) + core), 0.0, 0.72);
            gl_FragColor = vec4(col, alpha);
          }
        `,
      }),
    [],
  )

  // Asfalt üstü akan hız okları şeridi
  const padMat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 } },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            float x = abs(vUv.x - 0.5) * 2.0;
            float chev = fract(vUv.y * 3.0 - uTime * 2.2 - x * 0.65);
            float band = smoothstep(0.05, 0.18, chev) * (1.0 - smoothstep(0.28, 0.45, chev));
            float mask = smoothstep(1.0, 0.15, x) * sin(vUv.y * 3.14159);
            vec3 col = mix(vec3(0.32, 0.92, 0.98), vec3(1.0, 0.84, 0.38), band);
            gl_FragColor = vec4(col, band * mask * 0.85);
          }
        `,
      }),
    [],
  )

  useEffect(() => () => {
    boltGeo.dispose()
    portalMat.dispose()
    padMat.dispose()
  }, [boltGeo, portalMat, padMat])

  const orbAngles = useMemo(() => Array.from({ length: 8 }, (_, k) => (k / 8) * Math.PI * 2), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    portalMat.uniforms.uTime.value = t
    padMat.uniforms.uTime.value = t
    outerRefs.current.forEach((g, i) => {
      if (!g) return
      g.position.y = 1.98 + Math.sin(t * 2.5 + i * 1.1) * 0.12
    })
    innerRefs.current.forEach((m, i) => {
      if (!m) return
      m.rotation.z = t * (i % 2 === 0 ? 1.9 : -1.9)
      m.rotation.x = Math.sin(t * 1.5 + i) * 0.16
    })
    runeRefs.current.forEach((m, i) => {
      if (!m) return
      m.rotation.z = -t * 1.1
      m.rotation.y = Math.cos(t * 1.3 + i) * 0.18
    })
    crestRefs.current.forEach((m, i) => {
      if (!m) return
      m.rotation.y = t * 2.1 + i
      m.position.y = 1.84 + Math.sin(t * 3.4 + i) * 0.08
    })
  })

  return (
    <group>
      {SPEED_RING_POS.map(([x, z, ry], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, ry, 0]}>
          {/* Asfalt üstü ışıklı geçit tabanı + akan oklar */}
          <mesh position={[0, 0.105, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
            <planeGeometry args={[2.7, 2.2]} />
            <primitive object={padMat} attach="material" />
          </mesh>

          {/* Ana yüzen fantastik geçit */}
          <group ref={(el) => (outerRefs.current[i] = el)} position={[0, 1.98, 0]}>
            {/* Enerji girdabı yüzeyi */}
            <mesh renderOrder={3}>
              <circleGeometry args={[1.3, 36]} />
              <primitive object={portalMat} attach="material" />
            </mesh>

            {/* Altın çerçeve halkası + 8 adet parlayan taş */}
            <mesh>
              <torusGeometry args={[1.44, 0.11, 14, 36]} />
              <meshStandardMaterial color="#ffd35e" emissive="#ff9f1c" emissiveIntensity={0.85} roughness={0.22} metalness={0.2} />
            </mesh>
            {orbAngles.map((ang, oi) => (
              <mesh key={oi} position={[Math.cos(ang) * 1.44, Math.sin(ang) * 1.44, 0]} rotation={[0, 0, ang]}>
                <octahedronGeometry args={[0.11, 0]} />
                <meshStandardMaterial
                  color={oi % 2 === 0 ? '#7ef9ff' : '#ff9ec7'}
                  emissive={oi % 2 === 0 ? '#38bdf8' : '#ff70a6'}
                  emissiveIntensity={1.4}
                  roughness={0.18}
                />
              </mesh>
            ))}

            {/* Çift eksenli dönen rün/enerji halkaları */}
            <mesh ref={(el) => (innerRefs.current[i] = el)}>
              <torusGeometry args={[1.18, 0.055, 10, 32]} />
              <meshStandardMaterial color="#7ef9ff" emissive="#38bdf8" emissiveIntensity={1.2} roughness={0.18} />
            </mesh>
            <mesh ref={(el) => (runeRefs.current[i] = el)}>
              <torusGeometry args={[1.32, 0.032, 8, 6]} />
              <meshStandardMaterial color="#c9a8ff" emissive="#a88bff" emissiveIntensity={1.1} roughness={0.22} />
            </mesh>

            {/* Tepe noktası: dönen 3B altın şimşek arması */}
            <mesh ref={(el) => (crestRefs.current[i] = el)} geometry={boltGeo} position={[0, 1.84, 0]} castShadow>
              <meshStandardMaterial color="#ffe48f" emissive="#ffae2b" emissiveIntensity={1.15} roughness={0.22} metalness={0.18} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  )
}

