// Uygulama yönlendirmesi: giriş, karakter seçimi, dünya, admin, asset studio sayfaları.
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, RequireAuth } from './lib/AuthContext'
import AuthPage from './pages/AuthPage'
import { LandscapeGuard } from './world/MobileViewport'

const AvatarSelect = lazy(() => import('./pages/AvatarSelect'))
const World = lazy(() => import('./pages/World'))
const AssetStudio = lazy(() => import('./pages/AssetStudio'))
const Admin = lazy(() => import('./pages/Admin.jsx'))

const PageFallback = (
  <div className="flex min-h-svh flex-col items-center justify-center bg-gradient-to-br from-[#fff2e3] via-[#f1e6ff] to-[#dff3ff] p-6">
    <div className="flex flex-col items-center gap-3.5 rounded-[2rem] border-2 border-white bg-white/80 px-8 py-6 shadow-[0_18px_44px_rgba(104,79,145,0.16)] backdrop-blur-md">
      <img src="/logo.png" alt="Rastla" draggable={false} className="h-20 w-auto select-none drop-shadow-[0_8px_18px_rgba(74,59,92,0.16)]" />
      <div className="h-8 w-8 animate-spin rounded-full border-[3.5px] border-[#efe6ff] border-r-[#ff9ec7] border-t-[#a88bff]" />
      <p className="text-xs font-extrabold tracking-wide text-[#6b5a80]">Yükleniyor…</p>
    </div>
  </div>
)

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LandscapeGuard />
        <Suspense fallback={PageFallback}>
          <Routes>
            <Route path="/" element={<AuthPage />} />
            <Route path="/avatar" element={<RequireAuth><AvatarSelect /></RequireAuth>} />
            <Route path="/world" element={<RequireAuth><World /></RequireAuth>} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/studio" element={<AssetStudio />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
