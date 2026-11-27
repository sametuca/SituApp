import { useEffect, useMemo, useRef, useState } from 'react'
import { screenK } from './screenK'
import { useFrame, useLoader } from '@react-three/fiber'
import { AdditiveBlending, CanvasTexture, Color, DoubleSide, PlaneGeometry, Object3D, ExtrudeGeometry, ShaderMaterial, Shape, RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three'
import { Html, RoundedBox } from '@react-three/drei'
import { BEACH, BUILDINGS, GAP, GAZEBO, ISLAND, PIER, PLAY_BOUNDS, PLAZA_R, PROPS, RIM, RING, ROAD_END, ROAD_HALF, ROAD_START, SPEED_RING_POS, TOWELS } from './layout'
import { CULL_R, playerPos, useCull } from './cull'
import Facade from './Facade'
import { facadeOf } from './facadeData'
import Prop, { InstancedPropGroup } from './Prop'
import Plants from './Plants'
import TownDetails from './TownDetails'
import BeachParty from './BeachParty'
import TurkishFlags from './TurkishFlags'
import { RoadCurbs, RoadDetails, RoadMarkings } from './RoadInfrastructure'
import { Em } from '../components/emoji'
import { SKY_MATS, skyLive } from './Sky'
import { worldClock } from './worldClock'
import { Flat, Ring, TexRing } from './CityGround'
import { q, sharedTexture, stdMat } from './CityGroundUtils'
import { getPuffyShinglePair, getWallPair } from './pastelTex'

const FACING = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }

// katman yükseklikleri (z-fighting olmasın)
const Y = { floor: 0.02, sidewalk: 0.04, road: 0.06, plaza: 0.08, mark: 0.1 }

// Doku önbelleği: aynı (doku, tekrar, kaydırma) için tek Texture nesnesi (her bina/parça için ayrı klon GPU'ya ayrı yüklenir; 70 bina × 4 yüz = yüzlerce yükleme).
const LABEL_RANGE = 34 // m: bundan uzaktaki bina pinleri gizlenir
const LABEL_NAME_RANGE = 15 // m: bundan yakında pinin adı da açılır

// "🍰 Tatlı Dükkanı" → { icon: '🍰', name: 'Tatlı Dükkanı' }
function splitLabel(text) {
  const m = /^(\p{Extended_Pictographic}\uFE0F?)\s*(.*)$/u.exec(text)
  return m ? { icon: m[1], name: m[2] } : { icon: '📍', name: text }
}

// Modern harita pini: renkli halkalı yuvarlak rozet + 3D ikon + sivri uç; yakında ad etiketi açılır.
function Label({ text, y, x, z, zOff = 0, focusRef, accent = '#fdbb63' }) {
  const [mode, setMode] = useState(2) // 0 gizli, 1 yalnız rozet, 2 rozet + ad
  const modeRef = useRef(2)
  const clock = useRef(0)
  useFrame(({ camera }, dt) => {
    clock.current += dt
    if (clock.current < 0.4) return
    clock.current = 0
    const f = focusRef.current
    const dist = Math.hypot(f.x - x, f.z - z)
    // kameraya çok yakın pin (distanceFactor yüzünden) dev boyuna çıkmasın
    const camDist = Math.hypot(camera.position.x - x, camera.position.y - y, camera.position.z - z)
    const next = dist > LABEL_RANGE || camDist < 15 ? 0 : dist > LABEL_NAME_RANGE ? 1 : 2
    if (next !== modeRef.current) {
      modeRef.current = next
      setMode(next)
    }
  })
  if (mode === 0) return null
  const { icon, name } = splitLabel(text)
  return (
    <Html position={[0, y, zOff]} center distanceFactor={18 * screenK()} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <div className="venue-pin flex flex-col items-center" style={{ '--pin': accent }}>
        {mode === 2 && (
          <div className="mb-1 whitespace-nowrap rounded-full bg-[#3d2f4f]/92 px-3 py-[3px] text-[13px] font-extrabold tracking-wide text-white shadow-lg">
            {name}
          </div>
        )}
        <div
          className="grid h-[46px] w-[46px] place-items-center rounded-full bg-white shadow-[0_6px_14px_rgba(60,40,80,0.35)]"
          style={{ border: '4px solid var(--pin)' }}
        >
          <Em e={icon} size={28} />
        </div>
        <div
          className="-mt-[5px] h-3 w-3 rotate-45 rounded-[2px]"
          style={{ background: 'var(--pin)', boxShadow: '0 4px 6px rgba(60,40,80,0.25)' }}
        />
      </div>
    </Html>
  )
}

// ---------- bina çeşitliliği ----------
// Her bina, sırasına göre bir stil alır (komşu binalar farklı olur): cephe dokusu (Meshy), çatı biçimi, pencere türü ve süsler.
const WALL_TEX = { brick: 2.4, siding: 2.0, stucco: 3.2, plaster: 4, shingle: 2.0 } // doku adı → bir kiremitin metre boyu
const STYLES = [
  { wall: 'brick', roofType: 'gable', win: 'arch', shutters: true, chimney: true, door: '#bf8942' },
  { wall: 'siding', roofType: 'flat', win: 'round', flowerbox: true, door: '#cc7914' },
  { wall: 'stucco', roofType: 'hip', win: 'wide', door: '#e8873a' },
  { wall: 'plaster', roofType: 'flat', win: 'rect', balcony: true, door: '#8a6bd1' },
  { wall: 'brick', roofType: 'hip', win: 'rect', shutters: true, chimney: true, door: '#5b86d6' },
  { wall: 'siding', roofType: 'gable', win: 'wide', flowerbox: true, door: '#d58f2b' },
]
const lighten = (hex, t) => `#${new Color(hex).lerp(new Color('#ffffff'), t).getHexString()}`

/** Balonsu pasterize cephe/duvar paneli: renk + yumuşak kabartma haritasıyla pofuduk kil görünümü. */
function Panel({ tex, w, h, color, position, rotation, repeat, emissive, emissiveIntensity = 0 }) {
  const pair = useMemo(() => getWallPair(tex), [tex])
  const { map, bumpMap } = useMemo(() => {
    const m = WALL_TEX[tex] ?? 2.4
    const rx = q(repeat?.[0] ?? w / m)
    const ry = q(repeat?.[1] ?? h / m)
    const setup = (t) => t.repeat.set(rx, ry)
    return {
      map: sharedTexture(pair.map, `${tex}|${rx}|${ry}`, setup),
      bumpMap: sharedTexture(pair.bump, `b${tex}|${rx}|${ry}`, setup),
    }
  }, [pair, tex, w, h, repeat])
  return (
    <mesh position={position} rotation={rotation} receiveShadow>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial color={color} map={map} bumpMap={bumpMap} bumpScale={0.042} roughness={emissive ? 0.42 : 0.56} emissive={emissive ?? '#000000'} emissiveIntensity={emissiveIntensity} />
    </mesh>
  )
}

/** Beşik çatı: üçgen kesit (taban duvar üstünde), sırtı bina genişliği boyunca. */
function GableRoof({ w, d, h, mat }) {
  const geo = useMemo(() => {
    const dd = d + 0.9
    const sh = new Shape()
    sh.moveTo(-dd / 2, 0)
    sh.lineTo(dd / 2, 0)
    sh.lineTo(0, Math.min(2.6, dd * 0.36))
    sh.closePath()
    const g = new ExtrudeGeometry(sh, { depth: w + 0.9, bevelEnabled: false })
    g.translate(0, 0, -(w + 0.9) / 2)
    return g
  }, [w, d])
  return (
    <mesh geometry={geo} position={[0, h - 0.05, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
      {mat}
    </mesh>
  )
}

function Roof({ w, d, h, color, type, emissive, emissiveIntensity = 0 }) {
  const tint = lighten(color, 0.35)
  const shingle = useMemo(() => getPuffyShinglePair(), [])
  const { map, bumpMap } = useMemo(() => {
    const setup = (t) => t.repeat.set(3, 2)
    return {
      map: sharedTexture(shingle.map, 'roof_puffy', setup),
      bumpMap: sharedTexture(shingle.bump, 'broof_puffy', setup),
    }
  }, [shingle])
  const mat = <meshStandardMaterial color={color} map={map} bumpMap={bumpMap} bumpScale={0.055} roughness={emissive ? 0.36 : 0.48} emissive={emissive ?? '#000000'} emissiveIntensity={emissiveIntensity} />
  if (type === 'gable') {
    return <GableRoof w={w} d={d} h={h} mat={mat} />
  }
  if (type === 'hip') {
    // koni tabanı duvar üstünde (h - 0,05): çatı havada durmaz
    return (
      <mesh position={[0, h - 0.05 + 1.1, 0]} rotation={[0, Math.PI / 4, 0]} scale={[(w + 0.9) / 1.414, 1, (d + 0.9) / 1.414]} castShadow>
        <coneGeometry args={[1, 2.2, 4]} />
        {mat}
      </mesh>
    )
  }
  return (
    <RoundedBox args={[w + 0.7, 0.7, d + 0.7]} radius={0.3} smoothness={3} position={[0, h + 0.15, 0]} castShadow>
      <meshStandardMaterial color={tint} roughness={0.5} />
    </RoundedBox>
  )
}

function Window({ kind, x, y, z, w, accent, shutters, flowerbox }) {
  const glass = <primitive object={SKY_MATS.window} attach="material" />
  const trim = <primitive object={stdMat('#fffaf2', 0.5)} attach="material" />
  const accentMat = <primitive object={stdMat(accent, 0.6)} attach="material" />
  return (
    <group position={[x, y, z]}>
      {kind === 'round' ? (
        <>
          <mesh>
            <circleGeometry args={[0.62, 20]} />
            {glass}
          </mesh>
          <mesh position={[0, 0, -0.01]}>
            <circleGeometry args={[0.78, 20]} />
            {trim}
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, 0, 0.0]}>
            <boxGeometry args={[w, 1.1, 0.12]} />
            {glass}
          </mesh>
          {kind === 'arch' && (
            <mesh position={[0, 0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[w / 2, w / 2, 0.12, 16]} />
              {glass}
            </mesh>
          )}
          {kind === 'wide' && (
            <>
              <mesh position={[0, 0, 0.07]}>
                <boxGeometry args={[0.07, 1.1, 0.04]} />
                {trim}
              </mesh>
              <mesh position={[0, 0, 0.07]}>
                <boxGeometry args={[w, 0.07, 0.04]} />
                {trim}
              </mesh>
            </>
          )}
        </>
      )}
      {shutters && kind !== 'round' &&
        [-1, 1].map((sd) => (
          <mesh key={sd} position={[sd * (w / 2 + 0.28), 0.1, 0.02]}>
            <boxGeometry args={[0.4, 1.3, 0.08]} />
            {accentMat}
          </mesh>
        ))}
      {flowerbox && (
        <group position={[0, -0.78, 0.2]}>
          <mesh>
            <boxGeometry args={[w + 0.3, 0.25, 0.34]} />
            {accentMat}
          </mesh>
          {[-0.4, 0, 0.4].map((fx) => (
            <mesh key={fx} position={[fx * (w / 1.6), 0.24, 0]}>
              <sphereGeometry args={[0.17, 8, 6]} />
              <primitive object={stdMat(fx === 0 ? '#ffd35e' : '#fdb252', 0.6)} attach="material" />
            </mesh>
          ))}
        </group>
      )}
    </group>
  )
}

// Kullanılmayan binalar için esprili Kentsel Dönüşüm afiş dokuları (önbellekli)
const KENTSEL_LINES = [
  ['🚧 KENTSEL DÖNÜŞÜM', 'YAKINDA REZİDANS (BELKİ)'],
  ['📋 MÜTEAHHİT ARANIYOR', '%50 KAT KARŞILIĞI'],
  ['🧱 RİSKLİ YAPI', 'YIKIM BEKLİYOR · GİRİLMEZ'],
  ['🏗️ PROJE ALANI', '2029 TESLİM (İNŞALLAH)'],
]
const kentselTexCache = new Map()
function getKentselTex(idx) {
  const k = idx % KENTSEL_LINES.length
  if (kentselTexCache.has(k)) return kentselTexCache.get(k)
  const cv = document.createElement('canvas')
  cv.width = 512
  cv.height = 192
  const g = cv.getContext('2d')
  g.fillStyle = '#ffd35e'
  g.fillRect(0, 0, 512, 192)
  // Üst ve alt siyah-sarı şantiye şeridi
  g.fillStyle = '#2d243b'
  for (let x = -40; x < 560; x += 48) {
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x + 24, 0)
    g.lineTo(x + 12, 22)
    g.lineTo(x - 12, 22)
    g.closePath()
    g.fill()
    g.beginPath()
    g.moveTo(x, 170)
    g.lineTo(x + 24, 170)
    g.lineTo(x + 12, 192)
    g.lineTo(x - 12, 192)
    g.closePath()
    g.fill()
  }
  g.fillStyle = '#fffdf6'
  g.fillRect(14, 28, 484, 136)
  g.fillStyle = '#2d243b'
  g.font = '900 32px system-ui, sans-serif'
  g.textAlign = 'center'
  g.fillText(KENTSEL_LINES[k][0], 256, 86)
  g.fillStyle = '#d9482b'
  g.font = '900 23px system-ui, sans-serif'
  g.fillText(KENTSEL_LINES[k][1], 256, 132)
  const tex = new CanvasTexture(cv)
  tex.colorSpace = SRGBColorSpace
  kentselTexCache.set(k, tex)
  return tex
}

function Building({ b, i, focusRef }) {
  const { w, d, h, color, roof, facing, label, shop, neon } = b
  const grp = useRef()
  useCull(grp, b.x, b.z, CULL_R, 30)
  const st = neon ? { ...STYLES[3], balcony: false } : STYLES[(i * 5 + (i >> 2)) % STYLES.length]
  const roofType = h > 8 || neon ? 'flat' : st.roofType
  const count = Math.max(1, Math.floor(w / 3))
  const winY = Math.min(3.4, h - 0.9)
  const rows = h > 8 ? [winY, winY + 2.6, winY + 5.2].filter((y) => y < h - 0.8) : [winY]
  const wallColor = lighten(color, st.wall === 'brick' ? 0.62 : 0.45)
  const fac = facadeOf(b)
  const doorShift = ((i * 7) % 3 - 1) * 0.12 * w // sıradan binalarda kapı biraz kayık (hepsi aynı görünmesin)
  const ww = Math.min(1.5, w / count - 0.8)
  const isHome = Boolean(b.homeDoor)
  return (
    <group ref={grp} position={[b.x, 0, b.z]} rotation={[0, FACING[facing], 0]}>
      <Flat x={0} z={d / 2 + 1.6} w={w + 1.4} d={3.4} y={0.038} tex="cobble" color={isHome ? '#fffbf0' : '#f6efe6'} />
      {isHome && (
        <>
          <mesh position={[0, 0.055, d / 2 + 1.35]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.72, 1.05, 36]} />
            <meshStandardMaterial color="#ffd35e" emissive="#ffd35e" emissiveIntensity={0.85} transparent opacity={0.88} />
          </mesh>
          <pointLight position={[0, 3.1, d / 2 + 1.5]} color="#ffe9ad" intensity={3.8} distance={10} decay={2} />
        </>
      )}
      <RoundedBox args={[w, h, d]} radius={0.35} smoothness={2} position={[0, h / 2, 0]} castShadow receiveShadow>
        {isHome ? (
          <meshStandardMaterial color="#fff8e0" emissive="#ffeaad" emissiveIntensity={0.28} roughness={0.38} />
        ) : (
          <primitive object={stdMat(color, 0.55)} attach="material" />
        )}
      </RoundedBox>
      {/* Meshy cephe dokusu: dört yüzeyde ince paneller (köşeler yuvarlak ve düz renkli kalır) */}
      <Panel tex={st.wall} w={w - 0.5} h={h - 0.4} color={isHome ? '#fffdf5' : wallColor} emissive={isHome ? '#ffe9a8' : undefined} emissiveIntensity={isHome ? 0.25 : 0} position={[0, h / 2, d / 2 + 0.012]} />
      <Panel tex={st.wall} w={w - 0.5} h={h - 0.4} color={isHome ? '#fffdf5' : wallColor} emissive={isHome ? '#ffe9a8' : undefined} emissiveIntensity={isHome ? 0.25 : 0} position={[0, h / 2, -d / 2 - 0.012]} rotation={[0, Math.PI, 0]} />
      <Panel tex={st.wall} w={d - 0.5} h={h - 0.4} color={isHome ? '#fffdf5' : wallColor} emissive={isHome ? '#ffe9a8' : undefined} emissiveIntensity={isHome ? 0.25 : 0} position={[w / 2 + 0.012, h / 2, 0]} rotation={[0, Math.PI / 2, 0]} />
      <Panel tex={st.wall} w={d - 0.5} h={h - 0.4} color={isHome ? '#fffdf5' : wallColor} emissive={isHome ? '#ffe9a8' : undefined} emissiveIntensity={isHome ? 0.25 : 0} position={[-w / 2 - 0.012, h / 2, 0]} rotation={[0, -Math.PI / 2, 0]} />
      <Roof w={w} d={d} h={h} color={isHome ? '#ffd866' : roof} type={roofType} emissive={isHome ? '#ffcf54' : undefined} emissiveIntensity={isHome ? 0.24 : 0} />
      {st.chimney && roofType !== 'flat' && (
        <RoundedBox args={[0.8, 1.8, 0.8]} radius={0.1} smoothness={2} position={[w * 0.28, h + 2.2, -d * 0.15]} castShadow>
          <meshStandardMaterial color={lighten(roof, 0.1)} roughness={0.6} />
        </RoundedBox>
      )}

      {fac ? (
        <>
          <Facade F={fac} w={w} h={h} roof={roof} z={d / 2} label={label} venueId={b.venue ?? (b.homeDoor ? 'evim' : null)} />
          {!fac.noUpper && h >= 5.5 &&
            Array.from({ length: Math.max(1, Math.floor(w / 3.2)) }, (_, ci) => (
              <Window key={ci} kind={st.win === 'round' ? 'rect' : st.win} x={(ci - (Math.max(1, Math.floor(w / 3.2)) - 1) / 2) * (w / Math.max(1, Math.floor(w / 3.2)))} y={Math.min(h - 1.2, 4.9)} z={d / 2 + 0.06} w={ww} accent={roof} />
            ))}
        </>
      ) : (
        <>
          {/* kapı: yumuşak yuvarlatılmış balonsu kapı */}
          <RoundedBox args={[1.48, 2.38, 0.18]} radius={0.09} smoothness={2} position={[doorShift, 1.19, d / 2 + 0.04]}>
            <primitive object={stdMat('#fffaf2', 0.45)} attach="material" />
          </RoundedBox>
          <RoundedBox args={[1.22, 2.16, 0.08]} radius={0.05} smoothness={2} position={[doorShift, 1.12, d / 2 + 0.13]}>
            <primitive object={stdMat(st.door, 0.38)} attach="material" />
          </RoundedBox>
          <mesh position={[doorShift + 0.4, 1.1, d / 2 + 0.18]}>
            <sphereGeometry args={[0.075, 10, 8]} />
            <primitive object={stdMat('#ffd35e', 0.25)} attach="material" />
          </mesh>
          {/* pencereler */}
          {rows.map((y, ri) =>
            Array.from({ length: count }, (_, ci) => (
              <Window key={`${y}-${ci}`} kind={st.win} x={(ci - (count - 1) / 2) * (w / count)} y={y} z={d / 2 + 0.06} w={st.win === 'wide' ? Math.min(2.0, w / count - 0.6) : ww} accent={roof} shutters={st.shutters && ri === 0} flowerbox={st.flowerbox && ri === 0} />
            )),
          )}
          {/* Kullanılmayan binalarda esprili Kentsel Dönüşüm afişi */}
          {!b.venue && !b.homeDoor && !b.label && (
            <mesh position={[0, Math.min(h - 1.0, 2.75), d / 2 + 0.16]}>
              <planeGeometry args={[Math.min(3.4, w - 0.9), 1.25]} />
              <meshStandardMaterial map={getKentselTex(i)} roughness={0.65} />
            </mesh>
          )}
        </>
      )}

      {/* balkon (yalnızca bazı stillerde, ikinci katın altında) */}
      {st.balcony && !shop && h > 5 && (
        <group position={[w * 0.25, 3.0, d / 2 + 0.55]}>
          <mesh castShadow>
            <boxGeometry args={[1.9, 0.14, 1.0]} />
            <meshStandardMaterial color="#fffaf2" roughness={0.5} />
          </mesh>
          {[-0.9, -0.3, 0.3, 0.9].map((bx) => (
            <mesh key={bx} position={[bx, 0.38, 0.45]}>
              <boxGeometry args={[0.07, 0.62, 0.07]} />
              <meshStandardMaterial color={roof} />
            </mesh>
          ))}
          <mesh position={[0, 0.7, 0.45]}>
            <boxGeometry args={[1.9, 0.07, 0.07]} />
            <meshStandardMaterial color={roof} />
          </mesh>
        </group>
      )}

      {/* dükkan tentesi */}
      {shop && !fac && (
        <mesh position={[0, 2.95, d / 2 + 0.75]} rotation={[0.3, 0, 0]} castShadow>
          <boxGeometry args={[Math.min(w - 0.6, 4.4), 0.18, 1.6]} />
          <meshStandardMaterial color={roof} roughness={0.6} />
        </mesh>
      )}
      {neon && (
        <>
          <mesh position={[0, h - 0.6, d / 2 + 0.12]}>
            <boxGeometry args={[w * 0.85, 0.28, 0.1]} />
            <primitive object={SKY_MATS.neonPink} attach="material" />
          </mesh>
          <mesh position={[0, 0.5, d / 2 + 0.12]}>
            <boxGeometry args={[w * 0.85, 0.2, 0.1]} />
            <primitive object={SKY_MATS.neonBlue} attach="material" />
          </mesh>
        </>
      )}
      {label && <Label text={label} y={Math.min(h, 3.6) + 1.2} zOff={d / 2 + 0.6} x={b.x} z={b.z} focusRef={focusRef} accent={roof} />}
    </group>
  )
}

/** Balonsu pasterize park çardağı: yuvarlak yastıksı taban, şişkin sütun başlıkları, pofuduk kiremit kubbe ve saçak halkası. */
function Gazebo() {
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

const towelTexCache = new Map()
function getTowelTex(baseHex) {
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
function Towel({ t }) {
  const map = useMemo(() => getTowelTex(t.c), [t.c])
  return (
    <RoundedBox args={[0.98, 0.055, 1.92]} radius={0.024} smoothness={2} position={[t.x, 0.06, t.z]} rotation={[0, t.ry, 0]} receiveShadow>
      <meshStandardMaterial map={map} roughness={0.78} />
    </RoundedBox>
  )
}

/** Gece kulübünden dışarıya doğru yükselen sol anahtarı / nota animasyonu (WebGL sprite — DOM yükü yok). */
function ClubMusicNotes() {
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
function Sun({ focusRef }) {
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

// ---------- deniz: adanın dört yanı (Meshy dokulu, animasyonlu) ----------
const WATER_COLOR = new Color('#feda9d')
const WATER_NIGHT = new Color('#294582')

// ---------- dünya sınırı: şamandıra halatı (oyuncu bunun ötesine geçemez; tatlı bir "buraya kadar" çizgisi) ----------
const BUOY_OFF = 3.2 // oynanabilir sınırın ötesinde (m)
function Buoys() {
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
const GLITTER_L = 420
const glitterMat = () =>
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

function SunGlitter() {
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

function Sea() {
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
function Pond({ x, z, r }) {
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
function BeachPier() {
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
function ToyClouds() {
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

function FountainFx() {
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
function SkyBalloon() {
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
function SpeedRings() {
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

// PROPS ve BLANKETS'i model adına göre grupla (≥ 2 örnek → InstancedPropGroup, tekil → Prop)
const { INSTANCED_PROPS, SINGLE_PROPS } = (() => {
  const byModel = new Map()
  const all = PROPS
  for (const p of all) {
    let arr = byModel.get(p.model)
    if (!arr) {
      arr = []
      byModel.set(p.model, arr)
    }
    arr.push(p)
  }
  const inst = []
  const single = []
  for (const [model, items] of byModel) {
    if (items.length >= 2) inst.push({ model, items })
    else single.push(items[0])
  }
  return { INSTANCED_PROPS: inst, SINGLE_PROPS: single }
})()

export default function City({ focusRef }) {
  const road = ROAD_HALF * 2
  const W = ISLAND.x1 - ISLAND.x0
  const D = ISLAND.z1 - ISLAND.z0
  const cx = (ISLAND.x0 + ISLAND.x1) / 2
  const cz = (ISLAND.z0 + ISLAND.z1) / 2
  const swW = road + 2.8
  const nsN = { len: -ROAD_START - ROAD_END.north, cz: (-ROAD_START + ROAD_END.north) / 2 } // kuzey kolu
  const nsS = { len: ROAD_END.south - ROAD_START, cz: (ROAD_END.south + ROAD_START) / 2 } // güney kolu (plaja)
  const ewE = { len: ROAD_END.east - ROAD_START, cx: (ROAD_END.east + ROAD_START) / 2 } // doğu kolu
  return (
    <group>
      <Sun focusRef={focusRef} />
      <ClubMusicNotes />
      <ToyClouds />
      <FountainFx />
      <SkyBalloon />
      <SpeedRings />
      <BeachPier />
      <BeachParty />
      <TurkishFlags />
      <TownDetails focusRef={focusRef} />

      {/* zemin ve mahalle zeminleri */}
      <Sea />
      <Buoys />
      <Flat x={cx} z={cz} w={W} d={D} y={0} tex="grass" /> {/* ada */}
      {/* kıyı kumu: adanın dört kenarında */}
      <Flat x={cx} z={ISLAND.z0 - RIM / 2} w={W + RIM * 2} d={RIM} y={Y.floor} tex="sand" />
      <Flat x={cx} z={ISLAND.z1 + RIM / 2} w={W + RIM * 2} d={RIM} y={Y.floor} tex="sand" />
      <Flat x={ISLAND.x0 - RIM / 2} z={cz} w={RIM} d={D} y={Y.floor} tex="sand" />
      <Flat x={ISLAND.x1 + RIM / 2} z={cz} w={RIM} d={D} y={Y.floor} tex="sand" />
      <Pond x={-30 - GAP} z={30 + GAP} r={7} />
      <Flat x={0} z={-34.3} w={28} d={34.6} y={Y.floor} tex="cobble" color="#fff3ea" feather={3} /> {/* kafe: sıcak kaldırım taşı */}
      <Flat x={34.3} z={0} w={34.6} d={28} y={Y.floor} tex="cobble" color="#e3d6ff" feather={3} /> {/* kulüp */}
      <Flat x={BEACH.x} z={BEACH.z} round={BEACH.r + 4} y={Y.floor} tex="sand" feather={6} /> {/* yuvarlak plaj: yumuşak kenarlı */}
      <Flat x={BEACH.x} z={BEACH.z} round={BEACH.r - 2} y={Y.floor + 0.004} tex="sand" color="#fff6dc" feather={5} />
      
      <Pond x={-42.5} z={-12.5} r={4.2} />

      {/* kaldırım + yollar */}
      <Flat x={0} z={nsN.cz} w={swW} d={nsN.len} y={Y.sidewalk} tex="cobble" color="#fdf6ff" />
      <Flat x={0} z={nsS.cz} w={swW} d={nsS.len} y={Y.sidewalk} tex="cobble" color="#fdf6ff" />
      <Flat x={ewE.cx} z={0} w={ewE.len} d={swW} y={Y.sidewalk} tex="cobble" color="#fdf6ff" />
      <TexRing r0={PLAZA_R - 0.8} r1={RING.r0} y={Y.sidewalk + 0.004} tex="cobble" color="#fdf6ff" />
      <TexRing r0={RING.r1} r1={RING.r1 + RING.side} y={Y.sidewalk + 0.004} tex="cobble" color="#fdf6ff" />
      <Flat x={-25} z={0} w={12} d={3.4} y={Y.sidewalk} tex="cobble" color="#fff8f0" /> {/* park patikası: lobiden çardağa */}
      <Flat x={0} z={nsN.cz} w={road} d={nsN.len} y={Y.road} tex="asphalt" />
      <Flat x={0} z={nsS.cz} w={road} d={nsS.len} y={Y.road} tex="asphalt" />
      <Flat x={ewE.cx} z={0} w={ewE.len} d={road} y={Y.road} tex="asphalt" />
      <TexRing r0={RING.r0} r1={RING.r1} y={Y.road + 0.006} tex="asphalt" />
      <RoadMarkings />
      <RoadCurbs />
      <RoadDetails />

      {/* lobi meydanı */}
      <Flat round={PLAZA_R} y={Y.plaza} tex="cobble" color="#fff7ee" />
      <Ring r0={12.2} r1={13.1} y={Y.mark} color="#ffebd3" />
      <Flat round={6.3} y={Y.mark} color="#ffebd3" />
      <Gazebo />

      {BUILDINGS.filter((b) => !b.gazebo).map((b, i) => (
        <Building key={i} b={b} i={i} focusRef={focusRef} />
      ))}
      {INSTANCED_PROPS.map((g) => (
        <InstancedPropGroup key={g.model} model={g.model} items={g.items} />
      ))}
      {SINGLE_PROPS.map((p, i) => (
        <Prop key={i} {...p} />
      ))}
      <Plants />
      {TOWELS.map((t, i) => (
        <Towel key={i} t={t} />
      ))}
    </group>
  )
}
