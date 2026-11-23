import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, RequireAuth } from './lib/AuthContext'
import AuthPage from './pages/AuthPage'
import AvatarSelect from './pages/AvatarSelect'
import World from './pages/World'
import AssetStudio from './pages/AssetStudio'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<AuthPage />} />
          <Route path="/avatar" element={<RequireAuth><AvatarSelect /></RequireAuth>} />
          <Route path="/world" element={<RequireAuth><World /></RequireAuth>} />
          <Route path="/studio" element={<AssetStudio />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
