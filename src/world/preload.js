// Model önyükleme. React 19'da yükleme bekleyen bir bileşen kardeşlerinin çizilmesini durdurur; bu yüzden bir sahnedeki onlarca
// GLB tek tek (şelale gibi) yüklenir ve her adımda sahne yeniden çizilir. Çözüm: sahne çizilmeden ÖNCE hepsini paralel indirmek.
//   preloadCritical(slug): şehir + oyuncunun avatarı (ilk çizim bunlara bağlı) — hemen çağrılır.
//   preloadLater(): diğer oyuncuların avatarları ve toplanabilirler — sahne açıldıktan sonra, boş zamanda.
import { useGLTF } from '@react-three/drei'
import { useLoader } from '@react-three/fiber'
import { TextureLoader } from 'three'
import { PROPS } from './layout'
import { canUseBackgroundPreload } from './performanceProfile'

const AVATARS = ['zeynep', 'deniz', 'elif', 'kaan', 'mira', 'ege']
const CITY = [...new Set([...PROPS.map((p) => p.model), '/models/venues/picnic-blanket.glb', '/models/plants/bush.glb', '/models/plants/tuft.glb', '/models/venues/surfboard-a.glb', '/models/venues/surfboard-b.glb', '/models/venues/dj-stand.glb', '/models/club/club-ball.glb', '/models/club/club-speaker.glb', '/models/beach/lifeguard.glb', '/models/beach/volleyball.glb', '/models/beach/sandcastle.glb', '/models/airport/toy-plane.glb'])]
const COLLECT = ['star', 'heartstone', 'flower', 'balloon', 'shell', 'chest'].map((n) => `/models/collectibles/${n}.glb`)

const done = new Set()
const load = (urls) =>
  urls.forEach((u) => {
    if (done.has(u)) return
    done.add(u)
    try {
      useGLTF.preload(u)
    } catch {
      /* önyükleme başarısız olursa sahne kendi isteğini yapar */
    }
  })

export function preloadCritical(slug) {
  load([`/models/avatars/${slug}.glb`, ...CITY])
  for (const n of ['grass', 'asphalt', 'cobble', 'sand', 'brick', 'siding', 'mosaic', 'plaster', 'shingle', 'water', 'foam', 'wood', 'tile', 'carpet']) useLoader.preload(TextureLoader, `/textures/${n}.webp`) // yer dokuları (City.jsx Flat)
}

export function preloadLater() {
  if (!canUseBackgroundPreload()) return
  const run = () => load([...COLLECT, ...AVATARS.map((a) => `/models/avatars/${a}.glb`)])
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 4000 })
  else setTimeout(run, 1500)
}
