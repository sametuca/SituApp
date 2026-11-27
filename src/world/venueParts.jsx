// Mekân iç mekânı temel parçaları: GLB yerleştirici (Glb), kutu/silindir/tahta ilkelleri, sandalye, kanepe, pencere, raf, neon, sahne.
import { useMemo } from 'react'
import { RoundedBox, useGLTF } from '@react-three/drei'
import { Box3, CanvasTexture, SRGBColorSpace, Vector3 } from 'three'
import { VENUE_ROOM } from './venues'
import { fixPropMaterialSeams } from './avatarTextureFix'
export const { hw, hd, wallH } = VENUE_ROOM
export const CHAIR_FLIP = 0 // cafe-chair GLB'nin önü ters çıkarsa Math.PI yap
export const V = (n) => `/models/venues/${n}.glb`
export const OLD = { table: '/models/cafe/cafe-table.glb', plant: '/models/cafe/cafe-plant.glb', palm: '/models/beach/beach-palm.glb', speaker: '/models/club/club-speaker.glb', ball: '/models/club/club-ball.glb', bike: '/models/bike/bike.glb', car: '/models/airport/car.glb', suitcases: '/models/airport/suitcases.glb', cart: '/models/airport/luggage-cart.glb', plane: '/models/airport/toy-plane.glb' }

// ---------- GLB (en-boy-yükseklik hedefiyle ölçeklenir) ----------
/** h/w/d verilirse kutuya sığacak biçimde (hepsi → esnetir), yalnızca biri → orantılı. Taban y=0'a oturur. */
export function Glb({ model, x = 0, y = 0, z = 0, ry = 0, h, w, d, tilt = 0 }) {
  const { scene } = useGLTF(model)
  const { obj, scale } = useMemo(() => {
    const clone = scene.clone(true)
    const box = new Box3().setFromObject(clone)
    const size = box.getSize(new Vector3())
    const c = box.getCenter(new Vector3())
    clone.position.set(-c.x, -box.min.y, -c.z)
    clone.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = o.receiveShadow = true
        fixPropMaterialSeams(o.material)
      }
    })
    let sc
    if (h && w && d) sc = [w / size.x, h / size.y, d / size.z]
    else {
      const k = h ? h / size.y : w ? w / size.x : d / size.z
      sc = [k, k, k]
    }
    return { obj: clone, scale: sc }
  }, [scene, h, w, d])
  return (
    <group position={[x, y, z]} rotation={[tilt, ry, 0]} scale={scale}>
      <primitive object={obj} />
    </group>
  )
}

// ---------- küçük yardımcılar ----------
export function Mat({ c, r = 0.7, em, ei = 0, o }) {
  return <meshStandardMaterial color={c} roughness={r} emissive={em ?? '#000000'} emissiveIntensity={ei} transparent={o !== undefined} opacity={o ?? 1} />
}
export function Box({ x = 0, y = 0, z = 0, w, h, d, c, ry = 0, rad = 0.05, em, ei, shadow = true, o }) {
  return (
    <RoundedBox args={[w, h, d]} radius={Math.min(rad, w / 2.05, h / 2.05, d / 2.05)} smoothness={2} position={[x, y + h / 2, z]} rotation={[0, ry, 0]} castShadow={shadow} receiveShadow>
      <Mat c={c} em={em} ei={ei} o={o} />
    </RoundedBox>
  )
}
export function Cyl({ x = 0, y = 0, z = 0, r, h, c, em, ei, rt }) {
  return (
    <mesh position={[x, y + h / 2, z]} castShadow>
      <cylinderGeometry args={[rt ?? r, r, h, 16]} />
      <Mat c={c} em={em} ei={ei} />
    </mesh>
  )
}

export function useCanvasTexture(draw, w, h, deps) {
  return useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    draw(cv.getContext('2d'), w, h)
    const t = new CanvasTexture(cv)
    t.colorSpace = SRGBColorSpace
    return t
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

export function Board({ x, y, z, ry = 0, w, h, lines, bg, fg, frame, big, map }) {
  const px = 512
  const tex = useCanvasTexture(
    (g, W, H) => {
      g.fillStyle = bg
      g.fillRect(0, 0, W, H)
      if (map) {
        // basit şehir haritası
        const zones = [['#fff2e3', 0.04, 0.04, 0.44, 0.44], ['#e6dcff', 0.52, 0.04, 0.44, 0.44], ['#bdeccb', 0.04, 0.52, 0.44, 0.44], ['#ffe9b8', 0.52, 0.52, 0.44, 0.44]]
        for (const [c, a, b, cw, ch] of zones) {
          g.fillStyle = c
          g.beginPath()
          g.roundRect(a * W, b * H, cw * W, ch * H, 18)
          g.fill()
        }
        g.fillStyle = '#d9cdee'
        g.fillRect(W * 0.46, 0, W * 0.08, H)
        g.fillRect(0, H * 0.46, W, H * 0.08)
        g.fillStyle = '#fecb89'
        g.beginPath()
        g.arc(W / 2, H / 2, W * 0.07, 0, 7)
        g.fill()
        g.font = `800 ${W * 0.07}px Nunito, sans-serif`
        g.textAlign = 'center'
        g.fillStyle = '#4a3b5c'
        g.fillText('☕', W * 0.26, H * 0.3)
        g.fillText('🪩', W * 0.74, H * 0.3)
        g.fillText('🌳', W * 0.26, H * 0.78)
        g.fillText('🏖️', W * 0.74, H * 0.78)
        g.fillText('⛲', W / 2, H / 2 + W * 0.025)
        return
      }
      g.fillStyle = fg
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      if (big || lines.length === 1) {
        g.font = `900 ${Math.min(H * 0.34, W * 0.1)}px Nunito, sans-serif`
        lines.forEach((l, i) => g.fillText(l, W / 2, (H / (lines.length + 1)) * (i + 1), W * 0.94))
      } else {
        const step = H / (lines.length + 0.6)
        lines.forEach((l, i) => {
          g.font = `${i === 0 ? 900 : 700} ${i === 0 ? step * 0.62 : step * 0.5}px Nunito, sans-serif`
          g.fillText(l, W / 2, step * (i + 0.8), W * 0.9)
        })
      }
    },
    px,
    Math.round(px * (h / w)),
    [bg, fg, lines.join('|'), map],
  )
  return (
    <group position={[x, y, z]} rotation={[0, ry, 0]}>
      {frame && (
        <mesh position={[0, 0, -0.018]}>
          <boxGeometry args={[w + 0.12, h + 0.12, 0.03]} />
          <Mat c={frame} />
        </mesh>
      )}
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={tex} roughness={0.8} emissive="#ffffff" emissiveMap={tex} emissiveIntensity={0.25} />
      </mesh>
    </group>
  )
}

// ---------- küçük süs parçaları (procedural) ----------
// sandalye: cafe-chair GLB (modelin önü = +z; oturan avatar ry yönüne bakar)
export function Chair({ x, z, ry }) {
  return <Glb model="/models/cafe/cafe-chair.glb" x={x} z={z} ry={ry + CHAIR_FLIP} h={0.95} />
}

export function Sofa({ x, z, ry, w, c }) {
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      <Box y={0.08} w={w} h={0.34} d={0.8} c={c} rad={0.1} />
      <Box y={0.35} z={-0.3} w={w} h={0.5} d={0.22} c={c} rad={0.1} />
      <Box y={0.08} x={-w / 2 + 0.1} w={0.2} h={0.55} d={0.8} c={c} rad={0.08} />
      <Box y={0.08} x={w / 2 - 0.1} w={0.2} h={0.55} d={0.8} c={c} rad={0.08} />
      <Box y={0.4} z={0.05} w={w - 0.5} h={0.1} d={0.55} c="#fffaf2" rad={0.05} shadow={false} />
    </group>
  )
}

export function Window({ wall, z }) {
  return (
    <group position={[wall === 'w' ? -hw + 0.02 : hw - 0.02, 1.9, z]} rotation={[0, wall === 'w' ? Math.PI / 2 : -Math.PI / 2, 0]}>
      <RoundedBox args={[1.7, 1.3, 0.12]} radius={0.05}>
        <Mat c="#fffaf2" r={0.5} />
      </RoundedBox>
      <mesh position={[0, 0, 0.07]}>
        <planeGeometry args={[1.45, 1.05]} />
        <meshStandardMaterial color="#cfeaff" emissive="#bfe3ff" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.08]}>
        <boxGeometry args={[0.06, 1.05, 0.02]} />
        <Mat c="#fffaf2" />
      </mesh>
    </group>
  )
}

export function Shelf({ x, z, ry, w, mode }) {
  // kitaplık/raf: GLB; kitap kafede dolu raf, diğerlerinde aynı raf (süs eşyasız)
  return <Glb model="/models/furniture/bookshelf.glb" x={x} z={z} ry={ry} h={mode === 'books' ? 2.0 : 1.7} w={w} />
}

export function Stage({ x, z, w, d }) {
  return <Glb model={V('stage-podium')} x={x} z={z} w={w} d={d} h={0.5} />
}

export function Neon({ x, y, z, w, c, ry = 0 }) {
  return (
    <mesh position={[x, y, z]} rotation={[0, ry, 0]}>
      <boxGeometry args={[w, 0.07, 0.05]} />
      <meshStandardMaterial color={c} emissive={c} emissiveIntensity={1.6} />
    </mesh>
  )
}

export function Backdrop({ x, z, w, h, c, c2 }) {
  const tex = useCanvasTexture(
    (g, W, H) => {
      const gr = g.createLinearGradient(0, 0, 0, H)
      gr.addColorStop(0, c2)
      gr.addColorStop(1, c)
      g.fillStyle = gr
      g.fillRect(0, 0, W, H)
    },
    8,
    128,
    [c, c2],
  )
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={tex} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.02, 0.9]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, 1.8]} />
        <Mat c={c} r={0.9} />
      </mesh>
    </group>
  )
}

/** Cam vitrin: dört cam yüzey + ince çerçeve (içine girilmez; çarpışma yerleşimde). floor: içi zemin rengi (bahçe gibi). */
