// Uzaklık ayıklama: büyük dünyada uzaktaki bina/süs nesneleri çizilmez (gölge ve çizim maliyeti düşer). Oyuncu konumu LocalPlayer'dan gelir.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

export const playerPos = { x: 0, z: 0 }
export const CULL_R = 76 // m: kamera yüksekliği ve sis (45→122 m) ötesindeki nesneler görünmez; sıkı yarıçap çizim çağrılarını ~%65 azaltır

/**
 * ref: <group>; (x,z) dünya konumu; r: görünürlük yarıçapı; shadowR: > 0 ise gölge yalnızca bu yarıçap içinde açık kalır.
 * Her ~0,25 sn'de bir değerlendirir.
 */
export function useCull(ref, x, z, r = CULL_R, shadowR = 0) {
  const timer = useRef(Math.random() * 0.25)
  const casters = useRef(null)
  const shOn = useRef(true)

  useFrame((_, dt) => {
    timer.current += dt
    if (timer.current < 0.25) return
    timer.current = 0
    const g = ref.current
    if (!g) return
    const dx = playerPos.x - x
    const dz = playerPos.z - z
    const d2 = dx * dx + dz * dz
    const vis = d2 < r * r
    if (g.visible !== vis) g.visible = vis
    if (shadowR > 0 && vis) {
      if (!casters.current) {
        const list = []
        g.traverse((o) => {
          if (o.isMesh && o.castShadow) list.push(o)
        })
        casters.current = list
      }
      const wantSh = d2 < shadowR * shadowR
      if (wantSh !== shOn.current) {
        shOn.current = wantSh
        for (let i = 0; i < casters.current.length; i++) casters.current[i].castShadow = wantSh
      }
    }
  })
}
