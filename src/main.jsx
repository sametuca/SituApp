// Giriş noktası: React kökü, global stiller, unisex shader yaması ve emoji kurulumu.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installUnisexPalette } from './world/unisex'

installUnisexPalette() // 3D pembe tonlarını turkuaza çevirir (unisex palet)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
