// Şehir bileşenlerinin ortak sabitleri ve bina pin etiketi (CityBuildings/CityDecor/City kullanır).
import { useRef, useState } from 'react'
import { screenK } from './screenK'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Em } from '../components/emoji'
export const FACING = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }

// katman yükseklikleri (z-fighting olmasın)
export const Y = { floor: 0.02, sidewalk: 0.04, road: 0.06, plaza: 0.08, mark: 0.1 }

// Doku önbelleği: aynı (doku, tekrar, kaydırma) için tek Texture nesnesi (her bina/parça için ayrı klon GPU'ya ayrı yüklenir; 70 bina × 4 yüz = yüzlerce yükleme).
export const LABEL_RANGE = 34 // m: bundan uzaktaki bina pinleri gizlenir
export const LABEL_NAME_RANGE = 15 // m: bundan yakında pinin adı da açılır

// "🍰 Tatlı Dükkanı" → { icon: '🍰', name: 'Tatlı Dükkanı' }
export function splitLabel(text) {
  const m = /^(\p{Extended_Pictographic}\uFE0F?)\s*(.*)$/u.exec(text)
  return m ? { icon: m[1], name: m[2] } : { icon: '📍', name: text }
}

// Modern harita pini: renkli halkalı yuvarlak rozet + 3D ikon + sivri uç; yakında ad etiketi açılır.
export function Label({ text, y, x, z, zOff = 0, focusRef, accent = '#fdbb63' }) {
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

