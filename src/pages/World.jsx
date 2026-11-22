import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei'

const locationThemes = {
  cafe: { sky: '#3a2a1a', floor: '#5c4530', env: 'sunset' },
  park: { sky: '#1a3a2a', floor: '#2d4a2d', env: 'forest' },
  club: { sky: '#2a0a3a', floor: '#1a0a2a', env: 'night' },
  beach: { sky: '#2a3a5a', floor: '#c2a878', env: 'dawn' },
}

function AvatarBlob({ color }) {
  return (
    <mesh position={[0, 0.5, 0]} castShadow>
      <capsuleGeometry args={[0.4, 0.8, 8, 16]} />
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} />
    </mesh>
  )
}

export default function World() {
  const navigate = useNavigate()
  const [avatar, setAvatar] = useState(null)
  const [location, setLocation] = useState(null)

  useEffect(() => {
    const a = localStorage.getItem('situapp_avatar')
    const l = localStorage.getItem('situapp_location')
    if (!a || !l) {
      navigate('/')
      return
    }
    setAvatar(JSON.parse(a))
    setLocation(JSON.parse(l))
  }, [navigate])

  if (!avatar || !location) return null

  const theme = locationThemes[location.id] ?? locationThemes.cafe
  const avatarColor = avatar.gradient.includes('pink') ? '#ec4899'
    : avatar.gradient.includes('blue') ? '#3b82f6'
    : avatar.gradient.includes('purple') ? '#a855f7'
    : avatar.gradient.includes('amber') ? '#f59e0b'
    : avatar.gradient.includes('teal') ? '#14b8a6'
    : '#8b5cf6'

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ background: theme.sky }}>
      <Canvas camera={{ position: [0, 1.5, 4], fov: 50 }} shadows>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 2]} intensity={1.2} castShadow />
        <Environment preset={theme.env} />

        <AvatarBlob color={avatarColor} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <circleGeometry args={[4, 32]} />
          <meshStandardMaterial color={theme.floor} roughness={0.9} />
        </mesh>

        <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={8} blur={2} far={2} />

        <OrbitControls
          enablePan={false}
          minDistance={2.5}
          maxDistance={6}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2}
        />
      </Canvas>

      {/* top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent z-10">
        <button
          onClick={() => navigate('/location')}
          className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white"
        >
          ←
        </button>
        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5">
          <span>{location.emoji}</span>
          <span className="text-white text-sm font-medium">{location.name}</span>
        </div>
        <div className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white text-sm">
          {avatar.emoji}
        </div>
      </div>

      {/* bottom placeholder for interactions */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-10 bg-gradient-to-t from-black/70 to-transparent z-10">
        <p className="text-white/70 text-sm text-center mb-3">
          {avatar.name} olarak {location.name.toLowerCase()}dasın
        </p>
        <div className="flex gap-2 justify-center">
          <button className="px-5 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm text-white text-sm font-medium">
            💬 Sohbet Başlat
          </button>
          <button className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium">
            👋 Yakındakiler
          </button>
        </div>
      </div>
    </div>
  )
}
