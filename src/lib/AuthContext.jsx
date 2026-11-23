import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { authService, subscribeToAuth } from './auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    authService.getUser().then((u) => {
      if (cancelled) return
      setUser(u)
      setLoading(false)
    })
    const unsubscribe = subscribeToAuth((u) => !cancelled && setUser(u))
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const signUp = useCallback(async (data) => {
    const res = await authService.signUp(data)
    if (res.user && !res.needsConfirmation) setUser(res.user)
    return res
  }, [])

  const signIn = useCallback(async (data) => {
    const res = await authService.signIn(data)
    setUser(res.user)
    return res
  }, [])

  const signOut = useCallback(async () => {
    await authService.signOut()
    // bir sonraki hesap önceki seçimleri görmesin
    localStorage.removeItem('situapp_avatar')
    localStorage.removeItem('situapp_location')
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, signUp, signIn, signOut, resetPassword: authService.resetPassword }),
    [user, loading, signUp, signIn, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı')
  return ctx
}

/** Oturum yoksa giriş ekranına yönlendirir. */
export function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return null
  if (!user) return <Navigate to="/" replace state={{ from: location.pathname }} />
  return children
}
