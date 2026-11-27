// Mekân ön cepheleri: her mekânın kapısı, camları, tentesi, 3B tabelası ve süsleri farklıdır (veri: facadeData.js). Bina yerel çerçevesi: cephe z = d/2, x genişlik.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { SKY_MATS } from './Sky'
import Prop from './Prop'

const cream = '#fffaf2'
const Glass = () => <primitive object={SKY_MATS.window} attach="material" />
const Mat = ({ c, r = 0.5, e, ei }) => <meshStandardMaterial color={c} roughness={r} emissive={e} emissiveIntensity={ei} />

// Mekân bazlı 3B tabela stilleri (eğlenceli fontlar + uyumlu renk paleti)
const SIGN_THEMES = {
  kafe: { bg: '#2c5e4b', border: '#ffd35e', text: '#fff8e6', shadow: '#19382c', font: '"Fredoka", "Nunito", sans-serif', weight: '700' },
  kitapkafe: { bg: '#23594d', border: '#f4d99b', text: '#fffaf0', shadow: '#13352e', font: '"Lobster", "Nunito", cursive', weight: '400' },
  firin: { bg: '#fff3d6', border: '#d98a3c', text: '#8c4218', shadow: '#f2cfa0', font: '"Fredoka", "Nunito", sans-serif', weight: '700' },
  cayevi: { bg: '#7a3b26', border: '#f2cfa2', text: '#fff5e4', shadow: '#4a1f12', font: '"Lobster", "Nunito", cursive', weight: '400' },
  tatli: { bg: '#ffe3ee', border: '#e87ca4', text: '#9c2d5c', shadow: '#ffc2dc', font: '"Lobster", "Nunito", cursive', weight: '400' },
  kuafor: { bg: '#fff6ea', border: '#e8952c', text: '#5c3b1e', shadow: '#fed095', font: '"Lobster", "Nunito", cursive', weight: '400' },
  kulup: { bg: '#22183b', border: '#d48cff', text: '#ffe6ff', shadow: '#ff5ec4', font: '"Righteous", "Nunito", sans-serif', weight: '400', neon: true },
  bar: { bg: '#2b1e40', border: '#ff9f43', text: '#ffe8b8', shadow: '#ff6b35', font: '"Righteous", "Nunito", sans-serif', weight: '400', neon: true },
  oyun: { bg: '#1e2554', border: '#5fc0ea', text: '#d8f6ff', shadow: '#5fc0ea', font: '"Righteous", "Nunito", sans-serif', weight: '400', neon: true },
  fastfood: { bg: '#d93d26', border: '#ffd35e', text: '#fff6cf', shadow: '#8c1d0e', font: '"Fredoka", "Nunito", sans-serif', weight: '700' },
  dondurma: { bg: '#fff2f8', border: '#7fcdf3', text: '#e05b8b', shadow: '#b9e3ff', font: '"Fredoka", "Nunito", sans-serif', weight: '700' },
  surf: { bg: '#1e8a9c', border: '#ffe48f', text: '#fffaf0', shadow: '#0f5663', font: '"Righteous", "Nunito", sans-serif', weight: '400' },
  plajbar: { bg: '#78502a', border: '#f5d28c', text: '#fff5d6', shadow: '#472d14', font: '"Fredoka", "Nunito", sans-serif', weight: '700' },
  foto: { bg: '#4e3b82', border: '#ffd35e', text: '#fffaf2', shadow: '#2b1d52', font: '"Righteous", "Nunito", sans-serif', weight: '400' },
  rehber: { bg: '#3278b8', border: '#fff3c8', text: '#ffffff', shadow: '#1c4d7a', font: '"Fredoka", "Nunito", sans-serif', weight: '700' },
  evim: { bg: '#fff4e2', border: '#e8952c', text: '#6e451e', shadow: '#fed095', font: '"Fredoka", "Nunito", sans-serif', weight: '700' },
}

const signTexCache = new Map()
function paintSignCanvas(cv, text, theme) {
  const W = cv.width
  const H = cv.height
  const g = cv.getContext('2d')
  g.clearRect(0, 0, W, H)

  // yuvarlatılmış arka plan
  const r = 34
  const roundRect = (x, y, w, h, rad) => {
    g.beginPath()
    g.moveTo(x + rad, y)
    g.arcTo(x + w, y, x + w, y + h, rad)
    g.arcTo(x + w, y + h, x, y + h, rad)
    g.arcTo(x, y + h, x, y, rad)
    g.arcTo(x, y, x + w, y, rad)
    g.closePath()
  }

  g.fillStyle = theme.bg
  roundRect(0, 0, W, H, r)
  g.fill()

  // üst parlama şeridi (oyuncak / emaye tabela hissi)
  const grad = g.createLinearGradient(0, 0, 0, H * 0.55)
  grad.addColorStop(0, 'rgba(255,255,255,0.16)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  roundRect(10, 10, W - 20, H * 0.5, 24)
  g.fill()

  // iç dekoratif çerçeve
  g.strokeStyle = theme.border
  g.lineWidth = 10
  roundRect(16, 16, W - 32, H - 32, 22)
  g.stroke()

  // köşe perçin noktaları
  g.fillStyle = theme.border
  for (const [cx, cy] of [[42, 42], [W - 42, 42], [42, H - 42], [W - 42, H - 42]]) {
    g.beginPath()
    g.arc(cx, cy, 7, 0, Math.PI * 2)
    g.fill()
  }

  // metin (genişliğe otomatik sığdır)
  let fontSize = 112
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  do {
    g.font = `${theme.weight} ${fontSize}px ${theme.font}`
    if (g.measureText(text).width <= W - 120) break
    fontSize -= 6
  } while (fontSize > 48)

  if (theme.neon) {
    g.shadowColor = theme.shadow
    g.shadowBlur = 24
    g.fillStyle = theme.text
    g.fillText(text, W / 2, H / 2 + 4)
    g.shadowBlur = 10
    g.fillText(text, W / 2, H / 2 + 4)
  } else {
    g.shadowColor = 'transparent'
    g.shadowBlur = 0
    g.fillStyle = theme.shadow
    g.fillText(text, W / 2 + 4, H / 2 + 10)
    g.fillStyle = theme.text
    g.fillText(text, W / 2, H / 2 + 4)
  }
}

function getSignTexture(venueId, title) {
  const key = `${venueId ?? 'def'}|${title}`
  let entry = signTexCache.get(key)
  if (entry) return entry
  const theme = SIGN_THEMES[venueId] ?? SIGN_THEMES.kafe
  const cv = document.createElement('canvas')
  cv.width = 1024
  cv.height = 256
  paintSignCanvas(cv, title, theme)
  const tex = new CanvasTexture(cv)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  entry = { tex, cv, theme, title }
  signTexCache.set(key, entry)
  return entry
}

// Web fontları (Fredoka / Lobster / Righteous) indirilince tüm tabelaları tek seferde yeniden boya
let fontsHooked = false
function hookFontsOnce() {
  if (fontsHooked || typeof document === 'undefined' || !document.fonts?.ready) return
  fontsHooked = true
  document.fonts.ready.then(() => {
    for (const entry of signTexCache.values()) {
      paintSignCanvas(entry.cv, entry.title, entry.theme)
      entry.tex.needsUpdate = true
    }
  })
}

function Signboard({ venueId, label, w, h, z, hasAwning }) {
  const title = useMemo(() => String(label ?? '').replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/gu, '').trim(), [label])
  const entry = useMemo(() => (title ? getSignTexture(venueId, title) : null), [venueId, title])
  useEffect(() => {
    hookFontsOnce()
  }, [])
  if (!entry) return null
  const sw = Math.min(Math.max(3.2, w * 0.78), 5.4)
  const sh = sw * 0.25
  const sy = Math.min(h - sh / 2 - 0.35, hasAwning ? 3.95 : 3.65)
  const { tex, theme } = entry
  return (
    <group position={[0, sy, z + 0.14]}>
      {/* 3B çerçeve gövdesi */}
      <RoundedBox args={[sw + 0.16, sh + 0.14, 0.14]} radius={0.05} smoothness={2} castShadow>
        <Mat c={theme.border} r={0.4} />
      </RoundedBox>
      {/* yazılı ön yüz */}
      <mesh position={[0, 0, 0.076]}>
        <planeGeometry args={[sw, sh]} />
        <meshStandardMaterial
          map={tex}
          roughness={theme.neon ? 0.3 : 0.45}
          emissive={theme.neon ? theme.text : '#ffffff'}
          emissiveMap={tex}
          emissiveIntensity={theme.neon ? 0.65 : 0.1}
        />
      </mesh>
    </group>
  )
}

function Door({ w, h, c, arch, style, open, z }) {
  if (open) {
    // açık giriş (plaj barı): içeri açılan sıcak bir boşluk
    return (
      <group position={[0, 0, z]}>
        <mesh position={[0, h / 2, 0.02]}>
          <boxGeometry args={[w, h, 0.05]} />
          <Mat c="#6b4a2e" r={0.9} />
        </mesh>
        <mesh position={[0, h + 0.06, 0.1]}>
          <boxGeometry args={[w + 0.3, 0.14, 0.2]} />
          <Mat c={cream} />
        </mesh>
      </group>
    )
  }
  return (
    <group position={[0, 0, z]}>
      <RoundedBox args={[w + 0.24, h + 0.14, 0.14]} radius={0.05} position={[0, (h + 0.14) / 2, 0.03]}>
        <Mat c={cream} />
      </RoundedBox>
      {arch && (
        <mesh position={[0, h + 0.07, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[(w + 0.24) / 2, (w + 0.24) / 2, 0.14, 20, 1, false, Math.PI / 2, Math.PI]} />
          <Mat c={cream} />
        </mesh>
      )}
      <mesh position={[0, h / 2, 0.11]}>
        <boxGeometry args={[w, h, 0.05]} />
        <Mat c={c} r={0.4} />
      </mesh>
      {arch && (
        <mesh position={[0, h, 0.11]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[w / 2, w / 2, 0.05, 20, 1, false, Math.PI / 2, Math.PI]} />
          <Mat c={c} r={0.4} />
        </mesh>
      )}
      {style === 'double' && (
        <mesh position={[0, h / 2, 0.145]}>
          <boxGeometry args={[0.04, h, 0.02]} />
          <Mat c={cream} />
        </mesh>
      )}
      <mesh position={[style === 'double' ? 0.2 : w * 0.32, h * 0.5, 0.15]}>
        <circleGeometry args={[0.06, 12]} />
        <Mat c="#ffd35e" r={0.3} />
      </mesh>
    </group>
  )
}

function GlassPane({ k, x, w, W, z }) {
  const px = x * W
  const gw = (w ?? 0.4) * W
  if (k === 'round')
    return (
      <group position={[px, 1.75, z]}>
        <mesh position={[0, 0, 0.01]}>
          <circleGeometry args={[0.48, 24]} />
          <Glass />
        </mesh>
        <mesh>
          <ringGeometry args={[0.48, 0.62, 24]} />
          <Mat c={cream} />
        </mesh>
      </group>
    )
  if (k === 'tall')
    return (
      <group position={[px, 1.5, z]}>
        <mesh position={[0, 0, 0.01]}>
          <boxGeometry args={[0.7, 2.0, 0.08]} />
          <Glass />
        </mesh>
        <mesh position={[0, 0, 0.06]}>
          <boxGeometry args={[0.76, 0.06, 0.03]} />
          <Mat c={cream} />
        </mesh>
      </group>
    )
  if (k === 'strip')
    return (
      <group position={[px, 2.35, z]}>
        {[-1.5, -0.5, 0.5, 1.5].map((i) => (
          <mesh key={i} position={[(i * gw) / 4.4, 0, 0.01]}>
            <boxGeometry args={[gw / 4.8, 0.8, 0.08]} />
            <Glass />
          </mesh>
        ))}
      </group>
    )
  if (k === 'screen')
    return (
      <group position={[px, 1.7, z]}>
        <mesh position={[0, 0, 0.01]}>
          <boxGeometry args={[gw, 1.5, 0.08]} />
          <Mat c="#bfe9ff" e="#7fcdf3" ei={0.9} />
        </mesh>
        <mesh position={[0, 0, 0.07]}>
          <boxGeometry args={[gw + 0.14, 1.64, 0.04]} />
          <Mat c="#3a2d63" />
        </mesh>
      </group>
    )
  // big / lattice
  return (
    <group position={[px, 1.6, z]}>
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[gw, 1.5, 0.08]} />
        <Glass />
      </mesh>
      <mesh position={[0, -0.82, 0.07]}>
        <boxGeometry args={[gw + 0.2, 0.14, 0.14]} />
        <Mat c={cream} />
      </mesh>
      {k === 'lattice' && (
        <>
          <mesh position={[0, 0, 0.06]}>
            <boxGeometry args={[0.05, 1.5, 0.03]} />
            <Mat c={cream} />
          </mesh>
          <mesh position={[0, 0, 0.06]}>
            <boxGeometry args={[gw, 0.05, 0.03]} />
            <Mat c={cream} />
          </mesh>
        </>
      )}
    </group>
  )
}

function Awning({ w, c, stripe, z }) {
  const n = Math.max(4, Math.round(w / 1.1))
  const sw = (w * 0.9) / n
  const g = useRef()
  const ph = (w * 1.7 + z * 3.1) % 6.28
  useFrame(({ clock }) => {
    // kumaş tente rüzgârda çok hafif salınır
    if (g.current) g.current.rotation.x = 0.32 + Math.sin(clock.elapsedTime * 0.9 + ph) * 0.014
  })
  return (
    <group ref={g} position={[0, 2.85, z + 0.7]} rotation={[0.32, 0, 0]}>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} position={[(i - (n - 1) / 2) * sw, 0, 0]} castShadow>
          <boxGeometry args={[sw, 0.1, 1.5]} />
          <Mat c={stripe && i % 2 ? stripe : c} r={0.6} />
        </mesh>
      ))}
    </group>
  )
}

function Extra({ kind, W, h, z, doorX, accent }) {
  const dx = doorX
  switch (kind) {
    case 'pole':
      return (
        <group position={[dx - 1.25, 0, z + 0.3]}>
          {Array.from({ length: 8 }, (_, i) => (
            <mesh key={i} position={[0, 0.25 + i * 0.22, 0]}>
              <cylinderGeometry args={[0.13, 0.13, 0.22, 10]} />
              <Mat c={['#ffffff', '#ff9f43', '#ffffff', '#5fc0ea'][i % 4]} />
            </mesh>
          ))}
          <mesh position={[0, 2.1, 0]}>
            <sphereGeometry args={[0.15, 10, 8]} />
            <Mat c="#ffd35e" />
          </mesh>
        </group>
      )
    case 'cone':
      return (
        <group position={[0, h + 0.9, z - 0.2]} rotation={[0, 0, Math.PI]}>
          <mesh>
            <coneGeometry args={[0.55, 1.4, 14]} />
            <Mat c="#f0c48a" />
          </mesh>
          <mesh position={[0, -0.85, 0]}>
            <sphereGeometry args={[0.55, 14, 12]} />
            <Mat c="#ffc2dc" />
          </mesh>
          <mesh position={[0, -1.35, 0]}>
            <sphereGeometry args={[0.42, 14, 12]} />
            <Mat c="#fff3c8" />
          </mesh>
        </group>
      )
    case 'cupcake':
      return (
        <group position={[0, h + 0.55, z - 0.3]}>
          <mesh>
            <cylinderGeometry args={[0.5, 0.36, 0.5, 14]} />
            <Mat c="#f0c48a" />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <sphereGeometry args={[0.52, 14, 12]} />
            <Mat c="#ffc2dc" />
          </mesh>
          <mesh position={[0, 0.98, 0]}>
            <sphereGeometry args={[0.13, 10, 8]} />
            <Mat c="#e8952c" />
          </mesh>
        </group>
      )
    case 'boards':
      return [-1, 1].map((s) => (
        <group key={s} position={[dx + s * 1.5, 0, z + 0.5]} rotation={[-0.12, 0, s * 0.1]}>
          <Prop model={s < 0 ? '/models/venues/surfboard-a.glb' : '/models/venues/surfboard-b.glb'} x={0} z={0} scale={2.3} />
        </group>
      ))
    case 'planters':
      return [-1, 1].map((s) => (
        <group key={s} position={[dx + s * 1.1, 0, z + 0.55]}>
          <Prop model="/models/cafe/cafe-plant.glb" x={0} z={0} scale={0.95} />
        </group>
      ))
    case 'lantern':
      return (
        <group position={[dx + 0.95, 2.35, z + 0.2]}>
          <mesh>
            <boxGeometry args={[0.22, 0.34, 0.22]} />
            <Mat c="#ffe48f" e="#ffd35e" ei={0.7} />
          </mesh>
          <mesh position={[0, 0.25, 0]}>
            <coneGeometry args={[0.2, 0.16, 4]} />
            <Mat c="#8a5a2b" />
          </mesh>
        </group>
      )
    case 'marquee':
      {
        const n = Math.max(6, Math.round(W / 0.9))
      return (
        <group position={[0, 3.0, z + 0.08]}>
          {Array.from({ length: n }, (_, i) => (
            <mesh key={i} position={[(i - (n - 1) / 2) * ((W * 0.8) / n), 0, 0]}>
              <sphereGeometry args={[0.1, 8, 6]} />
              <Mat c="#fff3c8" e="#ffd35e" ei={1.2} />
            </mesh>
          ))}
        </group>
      )
      }
    case 'neonframe':
      return (
        <group position={[dx, 1.2, z + 0.2]}>
          <mesh position={[-1.15, 0, 0]}>
            <boxGeometry args={[0.07, 2.7, 0.06]} />
            <primitive object={SKY_MATS.neonBlue} attach="material" />
          </mesh>
          <mesh position={[1.15, 0, 0]}>
            <boxGeometry args={[0.07, 2.7, 0.06]} />
            <primitive object={SKY_MATS.neonBlue} attach="material" />
          </mesh>
          <mesh position={[0, 1.38, 0]}>
            <boxGeometry args={[2.37, 0.07, 0.06]} />
            <primitive object={SKY_MATS.neonPink} attach="material" />
          </mesh>
        </group>
      )
    case 'neonsign':
      return (
        <mesh position={[dx + 1.7, 2.1, z + 0.1]}>
          <boxGeometry args={[1.1, 0.4, 0.06]} />
          <primitive object={SKY_MATS.neonPink} attach="material" />
        </mesh>
      )
    case 'flag':
      return (
        <group position={[W / 2 - 0.5, h, z - 0.4]}>
          <mesh position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 2.4, 6]} />
            <Mat c="#d9d2e6" />
          </mesh>
          <mesh position={[0.4, 2.05, 0]}>
            <boxGeometry args={[0.8, 0.5, 0.03]} />
            <Mat c={accent} />
          </mesh>
        </group>
      )
    case 'chalk':
      return (
        <mesh position={[Math.min(W / 2 - 0.55, dx + 2.15), 0.55, z + 0.55]} rotation={[-0.12, 0, 0]}>
          <boxGeometry args={[0.7, 1.0, 0.06]} />
          <Mat c="#3b3446" />
        </mesh>
      )
    case 'palmthatch':
      return (
        <mesh position={[0, 2.95, z + 0.9]} rotation={[0.35, 0, 0]}>
          <boxGeometry args={[W * 0.95, 0.16, 2.0]} />
          <Mat c="#d9b36a" r={0.95} />
        </mesh>
      )
    case 'flowers':
      return [-1, 1].map((s) => (
        <mesh key={s} position={[dx + s * 1.0, 0.25, z + 0.4]}>
          <boxGeometry args={[0.7, 0.4, 0.4]} />
          <Mat c="#a0723a" />
        </mesh>
      ))
    default:
      return null
  }
}

/** Mekânın ön cephesi (kapı + camlar + tente + 3B tabela + süsler). z = cephenin ön yüzü (d/2). */
export default function Facade({ F, w, h, roof, z, label, venueId }) {
  const doorX = F.door.x * w
  return (
    <group>
      <group position={[doorX, 0, 0]}>
        <Door {...F.door} z={z} />
      </group>
      {F.glass.map((g, i) => (
        <GlassPane key={i} {...g} W={w} z={z} />
      ))}
      {F.awning && <Awning w={w} c={F.awning.c} stripe={F.awning.stripe} z={z} />}
      {label && <Signboard venueId={venueId} label={label} w={w} h={h} z={z} hasAwning={Boolean(F.awning)} />}
      {F.extra.map((k) => (
        <Extra key={k} kind={k} W={w} h={h} z={z} doorX={doorX} accent={roof} />
      ))}
    </group>
  )
}
