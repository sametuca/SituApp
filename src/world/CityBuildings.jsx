// Şehir binaları: stil çeşitliliği (cephe dokusu, çatı, pencere), kentsel doku ve Building bileşeni.
import { useMemo, useRef } from 'react'
import { CanvasTexture, Color, ExtrudeGeometry, Shape, SRGBColorSpace } from 'three'
import { RoundedBox } from '@react-three/drei'
import { CULL_R, useCull } from './cull'
import Facade from './Facade'
import { facadeOf } from './facadeData'
import { SKY_MATS } from './Sky'
import { Flat } from './CityGround'
import { q, sharedTexture, stdMat } from './CityGroundUtils'
import { getPuffyShinglePair, getWallPair } from './pastelTex'
import { FACING, Label } from './cityShared'
// ---------- bina çeşitliliği ----------
// Her bina, sırasına göre bir stil alır (komşu binalar farklı olur): cephe dokusu (Meshy), çatı biçimi, pencere türü ve süsler.
export const WALL_TEX = { brick: 2.4, siding: 2.0, stucco: 3.2, plaster: 4, shingle: 2.0 } // doku adı → bir kiremitin metre boyu
export const STYLES = [
  { wall: 'brick', roofType: 'gable', win: 'arch', shutters: true, chimney: true, door: '#bf8942' },
  { wall: 'siding', roofType: 'flat', win: 'round', flowerbox: true, door: '#cc7914' },
  { wall: 'stucco', roofType: 'hip', win: 'wide', door: '#e8873a' },
  { wall: 'plaster', roofType: 'flat', win: 'rect', balcony: true, door: '#8a6bd1' },
  { wall: 'brick', roofType: 'hip', win: 'rect', shutters: true, chimney: true, door: '#5b86d6' },
  { wall: 'siding', roofType: 'gable', win: 'wide', flowerbox: true, door: '#d58f2b' },
]
export const lighten = (hex, t) => `#${new Color(hex).lerp(new Color('#ffffff'), t).getHexString()}`

/** Balonsu pasterize cephe/duvar paneli: renk + yumuşak kabartma haritasıyla pofuduk kil görünümü. */
export function Panel({ tex, w, h, color, position, rotation, repeat, emissive, emissiveIntensity = 0 }) {
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
export function GableRoof({ w, d, h, mat }) {
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

export function Roof({ w, d, h, color, type, emissive, emissiveIntensity = 0 }) {
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

export function Window({ kind, x, y, z, w, accent, shutters, flowerbox }) {
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
export const KENTSEL_LINES = [
  ['🚧 KENTSEL DÖNÜŞÜM', 'YAKINDA REZİDANS (BELKİ)'],
  ['📋 MÜTEAHHİT ARANIYOR', '%50 KAT KARŞILIĞI'],
  ['🧱 RİSKLİ YAPI', 'YIKIM BEKLİYOR · GİRİLMEZ'],
  ['🏗️ PROJE ALANI', '2029 TESLİM (İNŞALLAH)'],
]
export const kentselTexCache = new Map()
export function getKentselTex(idx) {
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

export function Building({ b, i, focusRef }) {
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
