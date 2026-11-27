// Kimlik doğrulama servisi.
// - VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY tanımlıysa Supabase Auth kullanılır.
// - Tanımlı değilse DEMO modu: hesaplar yalnızca bu tarayıcının localStorage'ında tutulur,
//   gerçek bir güvenlik sağlamaz (yalnızca geliştirme/önizleme içindir).
import { supabase, isSupabaseConfigured } from './supabase'

export const isDemoMode = !isSupabaseConfigured

const DEMO_USERS_KEY = 'situapp_demo_users'
const DEMO_SESSION_KEY = 'situapp_demo_session'

export class AuthError extends Error {}

// ---------- doğrulama ----------
// Supabase `profiles.username` kısıtıyla aynı olmalı
export const USERNAME_RE = /^[A-Za-z0-9_çğıöşüÇĞİÖŞÜ-]+$/

export function validate({ mode, username, email, password }) {
  const errors = {}
  if (mode === 'register') {
    const u = (username ?? '').trim()
    if (u.length < 3 || u.length > 16) errors.username = 'Kullanıcı adı 3-16 karakter olmalı.'
    else if (!USERNAME_RE.test(u)) errors.username = 'Sadece harf (a-z, Türkçe harfler), rakam, tire ve alt çizgi kullan.'
    if ((password ?? '').length < 8) errors.password = 'Şifre en az 8 karakter olmalı.'
  } else if (!(email ?? '').trim()) {
    errors.email = 'Kullanıcı adını veya e-postanı gir.'
  } else if (!password) {
    errors.password = 'Şifreni gir.'
  }
  return errors
}

// ---------- demo modu ----------
const readJSON = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

const publicUser = (u) => ({ id: u.id, email: u.email, username: u.username, consent: u.consent ?? null })

async function syntheticEmail(username, domain = 'example.com') {
  const normalized = username.trim().toLowerCase()
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized))
  const hash = Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24)
  return `rastla-${hash}@${domain}`
}

const demo = {
  async signUp({ email, password, username, consentRecord }) {
    const users = readJSON(DEMO_USERS_KEY, [])
    const mail = username ? await syntheticEmail(username) : email?.trim().toLowerCase()
    if (users.some((u) => u.email === mail)) throw new AuthError('Bu e-posta ile zaten bir hesap var.')
    if (users.some((u) => u.username.toLowerCase() === username.trim().toLowerCase()))
      throw new AuthError('Bu kullanıcı adı alınmış.')
    const user = { id: crypto.randomUUID(), email: mail, username: username.trim(), hash: await sha256(password), consent: consentRecord ?? null }
    localStorage.setItem(DEMO_USERS_KEY, JSON.stringify([...users, user]))
    localStorage.setItem(DEMO_SESSION_KEY, user.id)
    return { user: publicUser(user), needsConfirmation: false }
  },
  async signIn({ email, password }) {
    const users = readJSON(DEMO_USERS_KEY, [])
    const login = email?.trim()
    const mail = login?.includes('@') ? login.toLowerCase() : login ? await syntheticEmail(login) : ''
    const user = login?.includes('@')
      ? users.find((u) => u.email === mail)
      : users.find((u) => u.username.toLowerCase() === login?.toLowerCase()) ?? users.find((u) => u.email === mail)
    if (!user || user.hash !== (await sha256(password))) throw new AuthError('E-posta veya şifre hatalı.')
    localStorage.setItem(DEMO_SESSION_KEY, user.id)
    return { user: publicUser(user) }
  },
  async signOut() {
    localStorage.removeItem(DEMO_SESSION_KEY)
  },
  async acceptConsent(record) {
    const id = localStorage.getItem(DEMO_SESSION_KEY)
    const users = readJSON(DEMO_USERS_KEY, [])
    const next = users.map((u) => (u.id === id ? { ...u, consent: record } : u))
    localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(next))
    return publicUser(next.find((u) => u.id === id))
  },
  async getUser() {
    const id = localStorage.getItem(DEMO_SESSION_KEY)
    const user = readJSON(DEMO_USERS_KEY, []).find((u) => u.id === id)
    return user ? publicUser(user) : null
  },
  async resetPassword() {
    return 'Demo modunda şifre sıfırlama yok. Yeni bir hesap açabilirsin.'
  },
  async updatePassword() {
    throw new AuthError('Demo modunda şifre değiştirilemez.')
  },
  async resendConfirmation() {
    return 'Demo modunda e-posta doğrulaması yok.'
  },
  async getToken() {
    return null
  },
}

// ---------- supabase ----------
const SUPABASE_ERRORS = {
  'Invalid login credentials': 'E-posta veya şifre hatalı.',
  'User already registered': 'Bu e-posta ile zaten bir hesap var.',
  'Email not confirmed': 'E-postanı doğrulaman gerekiyor. Gelen kutunu (ve gereksiz klasörünü) kontrol et.',
  'Database error saving new user': 'Bu kullanıcı adı alınmış.',
  'New password should be different from the old password.': 'Yeni şifren eskisinden farklı olmalı.',
  'Auth session missing!': 'Bağlantının süresi dolmuş. Şifre sıfırlama e-postasını yeniden iste.',
}
const toAuthError = (e) => {
  const msg = String(e?.message ?? '')
  if (SUPABASE_ERRORS[msg]) return new AuthError(SUPABASE_ERRORS[msg])
  if (/password should be at least|weak/i.test(msg)) return new AuthError('Şifre en az 8 karakter olmalı.')
  if (e?.code === 'email_address_invalid') return new AuthError('Kayıt sağlayıcısı geçici hesap adresini reddetti. Kullanıcıdan e-posta istenmiyor; Supabase Auth ayarlarını kontrol edin.')
  if (e?.code === 'weak_password') return new AuthError('Şifre çok zayıf, daha uzun/karışık bir şifre dene.')
  if (e?.status === 429 || /rate limit/i.test(msg)) return new AuthError('Çok fazla deneme. Biraz bekle.')
  return new AuthError('Bir şeyler ters gitti, tekrar dene.')
}

const toUser = (u) => (u ? { id: u.id, email: u.email, username: u.user_metadata?.username ?? u.email.split('@')[0], consent: u.user_metadata?.consent ?? null } : null)

const remote = {
  async signUp({ password, username }) {
    const name = username.trim()
    let avatar = 'zeynep'
    try {
      avatar = JSON.parse(localStorage.getItem('situapp_avatar'))?.slug ?? 'zeynep'
    } catch {
      /* seçim yok */
    }
    const synthetic = await syntheticEmail(name)
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: name, password, avatar }),
    })
    const result = await response.json().catch(() => null)
    if (!response.ok) {
      throw new AuthError(result?.error ?? 'Hesap oluşturulamadı. Biraz sonra tekrar dene.')
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email: synthetic, password })
    if (error) throw new AuthError('Hesabın oluşturuldu ancak oturum açılamadı. Aynı kullanıcı adı ve şifreyle giriş yap.')
    return { user: toUser(data.user), needsConfirmation: false }
  },
  async signIn({ email, password }) {
    const login = email.trim()
    const accountEmail = login.includes('@') ? login : await syntheticEmail(login)
    let { data, error } = await supabase.auth.signInWithPassword({ email: accountEmail, password })
    if (error?.message === 'Invalid login credentials' && !login.includes('@')) {
      const legacyEmail = await syntheticEmail(login, 'local.rastla.app')
      if (legacyEmail !== accountEmail) ({ data, error } = await supabase.auth.signInWithPassword({ email: legacyEmail, password }))
    }
    if (error) throw toAuthError(error)
    return { user: toUser(data.user) }
  },
  async signOut() {
    await supabase.auth.signOut()
  },
  async acceptConsent(record) {
    const { data, error } = await supabase.auth.updateUser({ data: { consent: record } })
    if (error) throw toAuthError(error)
    return toUser(data.user)
  },
  async getUser() {
    const { data } = await supabase.auth.getSession()
    return toUser(data.session?.user)
  },
  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
    if (error) throw toAuthError(error)
    return 'Şifre sıfırlama bağlantısı e-postana gönderildi.'
  },
  async updatePassword(password) {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw toAuthError(error)
  },
  async resendConfirmation(email) {
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: window.location.origin } })
    if (error) throw toAuthError(error)
    return 'Doğrulama e-postası yeniden gönderildi. 💌'
  },
  /** Oyun sunucusuna gönderilecek access_token (süresi dolmuşsa supabase-js yeniler). */
  async getToken() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  },
}

export const authService = isDemoMode ? demo : remote

/** Oturum değişince çağrılır (yalnızca Supabase modunda). Abonelikten çıkma fonksiyonu döner. */
export function subscribeToAuth(callback) {
  if (isDemoMode) return () => {}
  const { data } = supabase.auth.onAuthStateChange((event, session) => callback(toUser(session?.user), event))
  return () => data.subscription.unsubscribe()
}
