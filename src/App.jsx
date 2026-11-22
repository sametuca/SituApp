import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import AvatarSelect from './pages/AvatarSelect'
import LocationSelect from './pages/LocationSelect'
import World from './pages/World'
import AssetStudio from './pages/AssetStudio'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/avatar" element={<AvatarSelect />} />
        <Route path="/location" element={<LocationSelect />} />
        <Route path="/world" element={<World />} />
        <Route path="/studio" element={<AssetStudio />} />
      </Routes>
    </BrowserRouter>
  )
}
