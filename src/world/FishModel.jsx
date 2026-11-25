// Balıkların ve yakalanan eşyaların oyuncak tarzı 3B modelleri (jobsData.js FISH renkleri). Yerel koordinat: baş +x yönüne bakar.
// Not: Meshy GLB üretildiğinde bu bileşenin içi GLB ile değiştirilebilir; dış arayüz (id, size) aynı kalır.
import { memo, useMemo } from 'react'
import { FISH_BY_ID } from './jobsData'

const mat = (color, extra = {}) => <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} {...extra} />

function Eye({ x, y, z, r = 0.035 }) {
  return (
    <group position={[x, y, z]}>
      <mesh>
        <sphereGeometry args={[r, 10, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} />
      </mesh>
      <mesh position={[r * 0.35, 0, r * 0.35 * Math.sign(z || 1)]}>
        <sphereGeometry args={[r * 0.55, 8, 6]} />
        <meshStandardMaterial color="#3a2b4a" roughness={0.4} />
      </mesh>
    </group>
  )
}

function Fishy({ f }) {
  const s = f.size
  const wide = f.id === 'balon' ? 0.95 : f.id === 'kilic' ? 0.28 : 0.42
  return (
    <group scale={s}>
      <mesh scale={[f.id === 'balon' ? 0.6 : 1, wide, wide * 0.9]}>
        <sphereGeometry args={[0.5, 18, 14]} />
        {mat(f.body)}
      </mesh>
      {/* karın aydınlığı */}
      <mesh position={[0.02, -wide * 0.18, 0]} scale={[0.9, wide * 0.55, wide * 0.85]}>
        <sphereGeometry args={[0.46, 14, 10]} />
        {mat('#ffffff', { transparent: true, opacity: 0.55 })}
      </mesh>
      {/* kuyruk */}
      <mesh position={[-0.52, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 0.7, 0.18]}>
        <coneGeometry args={[0.3, 0.42, 4]} />
        {mat(f.fin)}
      </mesh>
      {/* sırt yüzgeci */}
      <mesh position={[0, wide * 0.5, 0]} rotation={[0, 0, -0.2]} scale={[1, 1, 0.2]}>
        <coneGeometry args={[0.16, 0.28, 4]} />
        {mat(f.fin)}
      </mesh>
      <mesh position={[0.05, -wide * 0.35, 0.12]} rotation={[0.9, 0, -0.5]} scale={[1, 1, 0.2]}>
        <coneGeometry args={[0.09, 0.2, 4]} />
        {mat(f.fin)}
      </mesh>
      {f.id === 'kilic' && (
        <mesh position={[0.78, 0.02, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.03, 0.55, 6]} />
          {mat('#9aa7d8')}
        </mesh>
      )}
      {f.id === 'balon' &&
        Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[Math.cos(i * 0.785) * 0.3, Math.sin(i * 0.785) * 0.42, 0.2 * Math.sin(i * 2)]} rotation={[0, 0, i * 0.785 - Math.PI / 2]} scale={0.6}>
            <coneGeometry args={[0.04, 0.1, 5]} />
            {mat(f.fin)}
          </mesh>
        ))}
      {f.id === 'altin' && (
        <mesh position={[0, 0, 0]} scale={[1.08, wide * 1.08, wide * 0.98]}>
          <sphereGeometry args={[0.5, 12, 10]} />
          <meshBasicMaterial color="#fff2a6" transparent opacity={0.25} />
        </mesh>
      )}
      <Eye x={0.3} y={wide * 0.16} z={wide * 0.4} />
      <Eye x={0.3} y={wide * 0.16} z={-wide * 0.4} />
    </group>
  )
}

function Octopus({ f }) {
  return (
    <group scale={f.size}>
      <mesh position={[0, 0.2, 0]} scale={[0.8, 1, 0.8]}>
        <sphereGeometry args={[0.38, 16, 12]} />
        {mat(f.body)}
      </mesh>
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 0.22, -0.12, Math.sin(a) * 0.22]} rotation={[Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]}>
            <capsuleGeometry args={[0.07, 0.34, 4, 8]} />
            {mat(f.fin)}
          </mesh>
        )
      })}
      <Eye x={0.2} y={0.22} z={0.22} r={0.06} />
      <Eye x={0.2} y={0.22} z={-0.22} r={0.06} />
    </group>
  )
}

function Shell({ f }) {
  return (
    <group scale={f.size} rotation={[0, 0, 0]}>
      <mesh position={[0, 0.05, 0]} scale={[1, 0.45, 0.85]}>
        <sphereGeometry args={[0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        {mat(f.body)}
      </mesh>
      <mesh position={[0, -0.02, 0]} scale={[0.95, 0.3, 0.8]} rotation={[Math.PI, 0, 0]}>
        <sphereGeometry args={[0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        {mat(f.fin)}
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <sphereGeometry args={[0.11, 12, 10]} />
        <meshStandardMaterial color="#ffffff" roughness={0.1} metalness={0.3} emissive="#ffeef5" emissiveIntensity={0.35} />
      </mesh>
    </group>
  )
}

function Boot({ f }) {
  return (
    <group scale={f.size} rotation={[0, 0, 0.3]}>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.16, 0.18, 0.5, 12]} />
        {mat(f.body)}
      </mesh>
      <mesh position={[0.12, 0.0, 0]} scale={[1.4, 0.7, 1]}>
        <sphereGeometry args={[0.22, 12, 10]} />
        {mat(f.fin)}
      </mesh>
    </group>
  )
}

function Seaweed({ f }) {
  return (
    <group scale={f.size}>
      {[-0.12, 0, 0.12].map((x, i) => (
        <mesh key={i} position={[x, 0.2 + i * 0.03, (i - 1) * 0.05]} rotation={[0, 0, (i - 1) * 0.35]}>
          <capsuleGeometry args={[0.05, 0.4 + i * 0.1, 4, 8]} />
          {mat(i % 2 ? f.fin : f.body)}
        </mesh>
      ))}
    </group>
  )
}

/** id: FISH kimliği. Boyut data'dan gelir; `scale` ek çarpan. */
export default memo(function FishModel({ id, scale = 1 }) {
  const f = FISH_BY_ID[id]
  const body = useMemo(() => {
    if (!f) return null
    if (f.id === 'ahtapot') return <Octopus f={f} />
    if (f.id === 'inci') return <Shell f={f} />
    if (f.id === 'cizme') return <Boot f={f} />
    if (f.id === 'yosun') return <Seaweed f={f} />
    return <Fishy f={f} />
  }, [f])
  if (!f) return null
  return <group scale={scale}>{body}</group>
})
