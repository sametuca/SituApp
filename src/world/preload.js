// Model önyükleme. React 19'da yükleme bekleyen bir bileşen kardeşlerinin çizilmesini durdurur; bu yüzden bir sahnedeki onlarca
// GLB tek tek (şelale gibi) yüklenir ve her adımda sahne yeniden çizilir. Çözüm: sahne çizilmeden ÖNCE hepsini paralel indirmek.
//   preloadCritical(slug): şehir + oyuncunun avatarı (ilk çizim bunlara bağlı) — hemen çağrılır.
//   preloadLater(): geri kalan her şey (mekân eşyaları, mobilya, NPC avatarları, hayvan, hediye…) — sahne açıldıktan sonra, boş zamanda.
import { useGLTF } from '@react-three/drei'
import { useLoader } from '@react-three/fiber'
import { TextureLoader } from 'three'
import { PROPS } from './layout'
import { FURNITURE, furnitureUrl } from './furniture'
import { canUseBackgroundPreload } from './performanceProfile'

const AVATARS = ['zeynep', 'deniz', 'elif', 'kaan', 'mira', 'ege']
const CITY = [...new Set([...PROPS.map((p) => p.model), '/models/venues/picnic-blanket.glb', '/models/plants/bush.glb', '/models/plants/tuft.glb', '/models/venues/surfboard-a.glb', '/models/venues/surfboard-b.glb', '/models/venues/dj-stand.glb', '/models/club/club-ball.glb', '/models/club/club-speaker.glb', '/models/beach/lifeguard.glb', '/models/beach/volleyball.glb', '/models/beach/sandcastle.glb', '/models/airport/toy-plane.glb'])]
const VENUE_ITEMS = [
  'arcade-cabinet', 'bakery-oven', 'bar-stool', 'bottle-shelf', 'cake-display', 'camera-tripod', 'cash-register', 'claw-machine', 'clothes-rack', 'coffee-machine',
  'counter', 'dj-stand', 'icecream-freezer', 'karaoke-mic', 'salon-chair', 'salon-mirror', 'samovar', 'softbox-light', 'stage-podium', 'surfboard-a', 'surfboard-b', 'world-globe',
  'cafe-neon-cup', 'cafe-pastry-cart', 'tea-wall-carpet', 'tea-backgammon-table', 'bakery-bread-rack', 'bakery-flour-barrel', 'dessert-donut-wall', 'dessert-macaron-tower',
  'icecream-cone-lamp', 'icecream-menu-board', 'fastfood-burger-statue', 'fastfood-soda-fountain', 'books-reading-ladder', 'books-globe-lamp', 'club-neon-wings', 'club-velvet-rope',
  'bar-guitar-wall', 'bar-neon-cocktail', 'arcade-prize-shelf', 'arcade-neon-joystick', 'salon-dryer-chair', 'salon-perfume-shelf', 'studio-ring-light', 'studio-polaroid-wall',
  'surf-tiki-mask', 'surf-wetsuit-rack', 'guide-postcard-rack', 'guide-compass-plaque', 'airport-departure-clock', 'airport-dutyfree-shelf', 'gym-trophy-case', 'teknel-cheese-case',
  'cafe-wall-menu', 'tea-copper-tray-wall', 'bakery-oven-hood', 'club-speaker-tower', 'bar-dartboard', 'salon-wall-dryer', 'gym-wall-mirror-banner', 'airport-flight-board',
].map((n) => `/models/venues/${n}.glb`)
const AIRPORT = ['suitcases', 'luggage-cart', 'toy-plane'].map((n) => `/models/airport/${n}.glb`).concat('/models/bike/bike.glb')
const COLLECT = ['star', 'heartstone', 'flower', 'balloon', 'shell', 'chest'].map((n) => `/models/collectibles/${n}.glb`)
const PETS = ['cat', 'bunny', 'chick', 'dog'].map((n) => `/models/pets/pet-${n}.glb`)
const GIFTS = ['bear', 'heartbox', 'roses', 'choco'].map((n) => `/models/gifts/gift-${n}.glb`)

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
  const run = () => load([...AIRPORT, ...COLLECT, ...AVATARS.map((a) => `/models/avatars/${a}.glb`), ...PETS, ...VENUE_ITEMS, ...GIFTS, ...FURNITURE.map((f) => furnitureUrl(f.id))])
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 4000 })
  else setTimeout(run, 1500)
}
