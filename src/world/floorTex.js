// Zemin dokuları (Meshy, üstten bakış, döşenebilir): public/textures/{wood,tile,carpet}.webp. Mekân ve ev iç zeminleri kullanır.
// Doku dünya ölçüsünde döşenir (kiremit boyu metre); renk tonu materyal rengiyle çarpılır (pastel ton).
import { useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import { RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three'

export const FLOOR_METERS = { wood: 2.6, tile: 2.2, carpet: 2.4 }

export function useFloorTexture(name, w, d) {
  const base = useLoader(TextureLoader, `/textures/${name}.webp`)
  return useMemo(() => {
    const t = base.clone()
    t.wrapS = t.wrapT = RepeatWrapping
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 8
    const m = FLOOR_METERS[name] ?? 2.4
    t.repeat.set(w / m, d / m)
    t.needsUpdate = true
    return t
  }, [base, name, w, d])
}
