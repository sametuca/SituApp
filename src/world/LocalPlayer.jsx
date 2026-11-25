import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, Vector3 } from 'three'
import AvatarRig from './AvatarRig'
import { groundY, resolveCollisions } from './layout'
import { together } from './features/togetherStore'
import { playerPos } from './cull'
import { BIKE_POSE, BIKE_SPEED, bike, speedBoost, useRiding } from './bikeStore'
import BikeModel from './Bike'

const WALK_SPEED = 3.2 // m/sn
const RUN_SPEED = 6.5

const MOVE_KEYS = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
}

const isTyping = (e) => e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)

/**
 * Yerel oyuncu: WASD / ok tuşları + Shift ile koşma, kameraya göre hareket, çarpışma, takip eden kamera.
 * focusRef.current = { x, z, ry, anim, teleport } paylaşılan durumdur (HUD, güneş ışığı, minimap okur).
 * focusRef.current.teleport = [x, z, ry?] atanırsa bir sonraki karede oyuncu oraya ışınlanır.
 */
export default function LocalPlayer({ slug, start, focusRef, controlsRef, joystickRef, onMove, collide = resolveCollisions, camOffset = [4.2, 8], locked = false, children }) {
  const camera = useThree((s) => s.camera)
  const group = useRef()
  const keys = useRef({})
  const [anim, setAnim] = useState('idle')
  const animRef = useRef('idle')
  const v = useMemo(() => ({ fwd: new Vector3(), right: new Vector3(), dir: new Vector3(), up: new Vector3(0, 1, 0) }), [])
  const placed = useRef(false)
  const riding = useRiding()
  const movingRef = useRef(false)
  // duruş: oturma/dans (together) ya da bisiklet; AvatarRig her karede .current okur
  const pose = useMemo(
    () => ({
      get current() {
        return bike.on ? { ...BIKE_POSE, moving: movingRef.current } : together.self.current
      },
    }),
    [],
  )

  useEffect(() => {
    const down = (e) => {
      const k = MOVE_KEYS[e.code]
      if (!k || isTyping(e)) return
      keys.current[k] = true
      e.preventDefault()
    }
    const up = (e) => {
      const k = MOVE_KEYS[e.code]
      if (k) keys.current[k] = false
    }
    const blur = () => (keys.current = {})
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  // kamerayı ve oyuncuyu verilen noktaya taşır (kamera ofseti korunur)
  const placeAt = (x, z) => {
    const g = group.current
    const dx = x - g.position.x
    const dz = z - g.position.z
    g.position.set(x, 0, z)
    camera.position.x += dx
    camera.position.z += dz
    controlsRef.current?.target.set(x, 0.8, z)
  }

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const f = focusRef.current

    if (!placed.current) {
      placed.current = true
      g.position.set(start.x, 0, start.z)
      camera.position.set(start.x, camOffset[0], start.z + camOffset[1])
      controlsRef.current?.target.set(start.x, 0.8, start.z)
    }
    if (f.teleport) {
      const [tx, tz, tr] = f.teleport
      f.teleport = null
      placeAt(tx, tz)
      if (tr !== undefined) g.rotation.y = tr
    }

    const k = keys.current
    let fwdIn = (k.forward ? 1 : 0) - (k.back ? 1 : 0)
    let rightIn = (k.right ? 1 : 0) - (k.left ? 1 : 0)
    let running = Boolean(k.run)
    let analog = 1 // joystick'te itme miktarı hızı ölçekler
    const j = joystickRef?.current
    const mag = j ? Math.hypot(j.x, j.y) : 0
    if (mag > 0.15) {
      fwdIn = -j.y // ekranda yukarı = ileri
      rightIn = j.x
      analog = Math.max(0.5, Math.min(1, mag))
      running = mag > 0.85
    }
    let moving = !locked && Boolean(fwdIn || rightIn)

    // oturuyor / dans ediyor: hareket girdisi duruşu bitirir (sunucuya haber verilir), aksi halde konum kilitli
    if (together.self.current && moving) together.onBreak?.(true)
    if (bike.on && together.self.current) bike.set(false) // oturunca/dans edince bisikletten in
    const posed = together.self.current
    if (posed) {
      moving = false
      if (posed.kind === 'sit' && posed.x != null && posed.z != null) {
        const kLerp = Math.min(1, dt * 10)
        g.position.x = MathUtils.lerp(g.position.x, posed.x, kLerp)
        g.position.z = MathUtils.lerp(g.position.z, posed.z, kLerp)
      }
      const diff = MathUtils.euclideanModulo(posed.ry - g.rotation.y + Math.PI, Math.PI * 2) - Math.PI
      g.rotation.y += diff * Math.min(1, dt * 8)
    }

    if (moving) {
      const { fwd, right, dir, up } = v
      camera.getWorldDirection(fwd)
      fwd.y = 0
      fwd.normalize()
      right.crossVectors(fwd, up)
      dir.copy(fwd).multiplyScalar(fwdIn).addScaledVector(right, rightIn).normalize()

      const boost = Date.now() < speedBoost.until ? 1.55 : 1
      const baseSpeed = bike.on ? (running ? 7.2 : BIKE_SPEED) : running ? RUN_SPEED : WALK_SPEED
      const speed = baseSpeed * boost * (bike.on ? Math.max(0.65, analog) : analog) * Math.min(dt, 0.1)
      const [nx, nz] = collide(g.position.x + dir.x * speed, g.position.z + dir.z * speed)
      const dx = nx - g.position.x
      const dz = nz - g.position.z
      g.position.x = nx
      g.position.z = nz
      camera.position.x += dx
      camera.position.z += dz
      controlsRef.current?.target.set(nx, 0.8, nz)

      // yüzünü yürüdüğü yöne çevir (model +Z'ye bakar)
      const target = Math.atan2(dir.x, dir.z)
      const diff = MathUtils.euclideanModulo(target - g.rotation.y + Math.PI, Math.PI * 2) - Math.PI
      g.rotation.y += diff * Math.min(1, dt * 12)
    }

    const next = bike.on ? 'ride' : moving ? (running ? 'run' : 'walk') : 'idle'
    movingRef.current = moving
    if (next !== animRef.current) {
      animRef.current = next
      setAnim(next === 'ride' ? 'idle' : next) // bisiklette klip idle, duruş procedural
    }
    const targetY = groundY(g.position.x, g.position.z)
    g.position.y = MathUtils.lerp(g.position.y, targetY, Math.min(1, dt * 16))
    controlsRef.current?.target.set(g.position.x, g.position.y + 0.8, g.position.z)
    f.x = g.position.x
    f.z = g.position.z
    playerPos.x = f.x
    playerPos.z = f.z
    f.ry = g.rotation.y
    f.anim = next
    onMove?.(f.x, f.z, f.ry, next)
  })

  return (
    <group ref={group}>
      <AvatarRig slug={slug} anim={anim} pose={pose} cosId="self" />
      {riding && (
        <Suspense fallback={null}>
          <BikeModel />
        </Suspense>
      )}
      {children}
    </group>
  )
}
