import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, RequireAuth } from './lib/AuthContext'
import AuthPage from './pages/AuthPage'

const AvatarSelect = lazy(() => import('./pages/AvatarSelect'))
const World = lazy(() => import('./pages/World'))
const AssetStudio = lazy(() => import('./pages/AssetStudio'))
const Admin = lazy(() => import('./pages/Admin.jsx'))

const PageFallback = (
  <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-gradient-to-br from-[#fff2e3] via-[#f1e6ff] to-[#dff3ff]">
    <img src="/logo.png" alt="SituApp" draggable={false} className="h-20 w-auto select-none drop-shadow-[0_8px_18px_rgba(74,59,92,0.18)]" />
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-candy-pink/50 border-t-candy-pink-deep" />
  </div>
)

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
