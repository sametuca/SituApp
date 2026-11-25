import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, RequireAuth } from './lib/AuthContext'
import AuthPage from './pages/AuthPage'

const AvatarSelect = lazy(() => import('./pages/AvatarSelect'))
const World = lazy(() => import('./pages/World'))
const AssetStudio = lazy(() => import('./pages/AssetStudio'))
const Admin = lazy(() => import('./pages/Admin.jsx'))

const PageFallback = (
  <div className="grid min-h-svh place-items-center bg-gradient-to-br from-[#fff2e3] via-[#f1e6ff] to-[#dff3ff]">
    <div className="h-11 w-11 animate-spin rounded-full border-4 border-candy-pink/50 border-t-candy-pink-deep" />
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
