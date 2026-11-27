// Auth bağlamı: demo/Supabase oturumu, RequireAuth, KVKK onay kapısı.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { authService, subscribeToAuth } from './auth'
import { ConsentGate } from '../components/Consent'
import { consentCurrent, makeConsentRecord } from '../legal/legalTexts'
import { recordConsent } from '../legal/record'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false) // şifre sıfırlama bağlantısıyla dönüldü: yeni şifre belirlenecek

  useEffect(() => {
    let cancelled = false
    authService.getUser().then((u) => {
      if (cancelled) return
      setUser(u)
      setLoading(false)
    })
    const unsubscribe = subscribeToAuth((u, event) => {
      if (cancelled) return
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setUser(u)
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const signUp = useCallback(async (data) => {
    const consentRecord = makeConsentRecord(data.consent ?? {})
    const res = await authService.signUp({ ...data, consentRecord })
    // Kayıt sadece kullanıcı adı ve şifreyle açılır; KVKK onayı girişten sonra ConsentGate'de alınır.
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

  const acceptConsent = useCallback(async (record) => {
    const u = await authService.acceptConsent(record)
    try {
      await recordConsent(record, await authService.getToken())
    } catch (error) {
      console.error('Onay kaydı gönderilemedi:', error)
    }
    setUser(u)
  }, [])

  const updatePassword = useCallback(async (password) => {
    await authService.updatePassword(password)
    setRecovery(false)
  }, [])

  const value = useMemo(
    () => ({
      user, loading, recovery, signUp, signIn, signOut, updatePassword, acceptConsent,
      resetPassword: authService.resetPassword,
      resendConfirmation: authService.resendConfirmation,
    }),
    [user, loading, recovery, signUp, signIn, signOut, updatePassword, acceptConsent],
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
  const { user, loading, acceptConsent, signOut } = useAuth()
  const location = useLocation()
  if (loading) return null
  if (!user) return <Navigate to="/" replace state={{ from: location.pathname }} />
  // KVKK / kullanım şartları: güncel sürümü onaylamamış hesaplar (eski üyeler dahil) oyuna giremez
  if (!consentCurrent(user.consent)) return <ConsentGate onAccept={acceptConsent} onSignOut={signOut} />
  return children
}
