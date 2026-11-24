// Uzaklık ayıklama: büyük dünyada uzaktaki bina/süs nesneleri çizilmez (gölge ve çizim maliyeti düşer). Oyuncu konumu LocalPlayer'dan gelir.
import { useFrame } from '@react-three/fiber'

export const playerPos = { x: 0, z: 0 }
export const CULL_R = 105 // m (sis ~140 m'de kapanır)

/** ref: <group>; (x,z) dünya konumu; r: görünürlük yarıçapı. Her ~0,25 sn'de bir değerlendirir. */
export function useCull(ref, x, z, r = CULL_R) {
  let t = Math.random() * 0.25
  useFrame((_, dt) => {
    t += dt
    if (t < 0.25) return
    t = 0
    const g = ref.current
    if (!g) return
    const vis = (playerPos.x - x) ** 2 + (playerPos.z - z) ** 2 < r * r
    if (g.visible !== vis) g.visible = vis
  })
}
