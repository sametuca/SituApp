import { useEffect, useMemo, useRef } from 'react'
import { CanvasTexture, Color, Object3D, SRGBColorSpace } from 'three'
import { GAP, RING, ROAD_END, ROAD_HALF } from './layout'

const ROAD_Y = 0.06
const MARK_Y = 0.1
const DASHES = Array.from({ length: 51 }, (_, i) => -100 + i * 4).filter((t) => Math.abs(t) > RING.r1 + 1.5 && t <= ROAD_END.east)
const RING_DASHES = Array.from({ length: 52 }, (_, i) => (i / 52) * Math.PI * 2 + 0.06).filter((a) =>
  [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].every((c) => Math.abs(Math.atan2(Math.sin(a - c), Math.cos(a - c))) > 0.3),
)
const PARK_X = -12

let manholeTex = null
function getManholeTex() {
  if (manholeTex) return manholeTex
  const cv = document.createElement('canvas')
  cv.width = cv.height = 128
  const g = cv.getContext('2d')
  g.fillStyle = '#6c657c'
  g.fillRect(0, 0, 128, 128)
  g.strokeStyle = '#534c63'
  g.lineWidth = 5
  g.beginPath()
  g.arc(64, 64, 56, 0, Math.PI * 2)
  g.stroke()
  g.lineWidth = 2.5
  g.strokeStyle = '#8d869e'
  g.beginPath()
  g.arc(64, 64, 42, 0, Math.PI * 2)
  g.stroke()
  g.beginPath()
  g.arc(64, 64, 20, 0, Math.PI * 2)
  g.stroke()
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    g.beginPath()
    g.moveTo(64 + Math.cos(a) * 20, 64 + Math.sin(a) * 20)
    g.lineTo(64 + Math.cos(a) * 52, 64 + Math.sin(a) * 52)
    g.stroke()
  }
  const texture = new CanvasTexture(cv)
  texture.colorSpace = SRGBColorSpace
  manholeTex = texture
  return texture
}

export function RoadMarkings() {
  const ref = useRef()
  const items = useMemo(() => {
    const list = []
    const d = new Object3D()
    const push = (x, z, w, len, ry = 0, color = '#fffaf2') => {
      d.position.set(x, MARK_Y, z)
      d.rotation.set(-Math.PI / 2, 0, ry)
      d.scale.set(w, len, 1)
      d.updateMatrix()
      list.push({ mat: d.matrix.clone(), color })
    }
    const YELLOW = '#ffe89e'
    const EDGE = '#f2edf9'
    const WHITE = '#fffdf8'
    for (const a of RING_DASHES) {
      const r = (RING.r0 + RING.r1) / 2
      push(Math.cos(a) * r, Math.sin(a) * r, 0.24, 1.45, -a - Math.PI / 2, YELLOW)
    }
    for (const t of DASHES) {
      if (t <= ROAD_END.south && t >= ROAD_END.north) push(0, t, 0.24, 1.85, 0, YELLOW)
      if (t > PARK_X && t <= ROAD_END.east) push(t, 0, 1.85, 0.24, 0, YELLOW)
    }
    const edgeOff = ROAD_HALF - 0.42
    const edgeRing = RING.r1 + 0.2
    const nLen = -edgeRing - ROAD_END.north
    const sLen = ROAD_END.south - edgeRing
    const eLen = ROAD_END.east - edgeRing
    for (const s of [-1, 1]) {
      push(s * edgeOff, (-edgeRing + ROAD_END.north) / 2, 0.13, nLen, 0, EDGE)
      push(s * edgeOff, (edgeRing + ROAD_END.south) / 2, 0.13, sLen, 0, EDGE)
      push((edgeRing + ROAD_END.east) / 2, s * edgeOff, eLen, 0.13, 0, EDGE)
    }
    for (const ox of [-1.8, -0.9, 0, 0.9, 1.8]) {
      push(ox, -(RING.r1 + 2), 0.44, 2.25, 0, WHITE)
      push(ox, RING.r1 + 2, 0.44, 2.25, 0, WHITE)
      push(ox, ROAD_END.south - 1.6, 0.44, 2.25, 0, WHITE)
      push(RING.r1 + 2, ox, 2.25, 0.44, 0, WHITE)
    }
    return list
  }, [])
  useEffect(() => {
    const im = ref.current
    if (!im) return
    const c = new Color()
    for (let i = 0; i < items.length; i++) {
      im.setMatrixAt(i, items[i].mat)
      im.setColorAt(i, c.set(items[i].color))
    }
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
  }, [items])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} receiveShadow frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial roughness={0.85} />
    </instancedMesh>
  )
}

export function RoadCurbs() {
  const ref = useRef()
  const blocks = useMemo(() => {
    const list = []
    const d = new Object3D()
    const push = (x, z, len, ry, idx) => {
      d.position.set(x, 0.068, z)
      d.rotation.set(0, ry, 0)
      d.scale.set(0.24, 0.135, len)
      d.updateMatrix()
      list.push({ mat: d.matrix.clone(), alt: idx % 2 === 0 })
    }
    const cx = ROAD_HALF + 0.12
    const step = 2.05
    let k = 0
    const start = RING.r1 + 0.4
    for (let z = -start; z >= ROAD_END.north + 0.5; z -= step) {
      push(-cx, z - step / 2, step - 0.08, 0, k++)
      push(cx, z - step / 2, step - 0.08, 0, k++)
    }
    for (let z = start; z <= ROAD_END.south - 0.5; z += step) {
      push(-cx, z + step / 2, step - 0.08, 0, k++)
      push(cx, z + step / 2, step - 0.08, 0, k++)
    }
    for (let x = start; x <= ROAD_END.east - 0.5; x += step) {
      push(x + step / 2, -cx, step - 0.08, Math.PI / 2, k++)
      push(x + step / 2, cx, step - 0.08, Math.PI / 2, k++)
    }
    const inN = Math.round((2 * Math.PI * RING.r0) / 1.8)
    for (let i = 0; i < inN; i++) {
      const a = (i / inN) * Math.PI * 2
      push(Math.cos(a) * (RING.r0 - 0.1), Math.sin(a) * (RING.r0 - 0.1), (2 * Math.PI * RING.r0) / inN - 0.08, -a, k++)
    }
    const outN = Math.round((2 * Math.PI * RING.r1) / 2)
    for (let i = 0; i < outN; i++) {
      const a = (i / outN) * Math.PI * 2
      const blocked = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].some((c) => Math.abs(Math.atan2(Math.sin(a - c), Math.cos(a - c))) < 0.31)
      if (blocked) continue
      push(Math.cos(a) * (RING.r1 + 0.1), Math.sin(a) * (RING.r1 + 0.1), (2 * Math.PI * RING.r1) / outN - 0.08, -a, k++)
    }
    return list
  }, [])
  useEffect(() => {
    const im = ref.current
    if (!im) return
    const c1 = new Color('#f6eee4')
    const c2 = new Color('#e8ddd0')
    for (let i = 0; i < blocks.length; i++) {
      im.setMatrixAt(i, blocks[i].mat)
      im.setColorAt(i, blocks[i].alt ? c1 : c2)
    }
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
  }, [blocks])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, blocks.length]} receiveShadow frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.78} />
    </instancedMesh>
  )
}

export function RoadDetails() {
  const ref = useRef()
  const tex = useMemo(() => getManholeTex(), [])
  const pts = useMemo(() => {
    const list = []
    for (let z = -22 - GAP; z >= -86 - GAP; z -= 18) list.push([Math.round(z) % 36 === 0 ? 2.1 : -2.1, z])
    list.push([2.0, 21.5 + GAP])
    for (let x = 22 + GAP; x <= 86 + GAP; x += 18) list.push([x, Math.round(x) % 36 === 0 ? 2.1 : -2.1])
    return list
  }, [])
  useEffect(() => {
    const im = ref.current
    if (!im) return
    const d = new Object3D()
    pts.forEach(([x, z], i) => {
      d.position.set(x, ROAD_Y + 0.012, z)
      d.rotation.set(0, i * 0.7, 0)
      d.scale.set(1, 1, 1)
      d.updateMatrix()
      im.setMatrixAt(i, d.matrix)
    })
    im.instanceMatrix.needsUpdate = true
  }, [pts])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, pts.length]} receiveShadow frustumCulled={false}>
      <cylinderGeometry args={[0.42, 0.44, 0.016, 16]} />
      <meshStandardMaterial map={tex} roughness={0.55} metalness={0.22} />
    </instancedMesh>
  )
}
