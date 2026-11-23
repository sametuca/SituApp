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
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validate({ mode, username, email, password, confirm, adult }) {
  const errors = {}
  if (mode === 'register') {
    const u = (username ?? '').trim()
    if (u.length < 3 || u.length > 16) errors.username = 'Kullanıcı adı 3-16 karakter olmalı.'
    else if (!/^[\p{L}\p{N}_.]+$/u.test(u)) errors.username = 'Sadece harf, rakam, nokta ve alt çizgi kullan.'
  }
  if (!EMAIL_RE.test((email ?? '').trim())) errors.email = 'Geçerli bir e-posta gir.'
  if (mode === 'register') {
    if ((password ?? '').length < 8) errors.password = 'Şifre en az 8 karakter olmalı.'
    if (confirm !== password) errors.confirm = 'Şifreler eşleşmiyor.'
    if (!adult) errors.adult = '18 yaşından büyük olmalısın.'
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

const publicUser = (u) => ({ id: u.id, email: u.email, username: u.username })

const demo = {
  async signUp({ email, password, username }) {
    const users = readJSON(DEMO_USERS_KEY, [])
    const mail = email.trim().toLowerCase()
    if (users.some((u) => u.email === mail)) throw new AuthError('Bu e-posta ile zaten bir hesap var.')
    if (users.some((u) => u.username.toLowerCase() === username.trim().toLowerCase()))
      throw new AuthError('Bu kullanıcı adı alınmış.')
    const user = { id: crypto.randomUUID(), email: mail, username: username.trim(), hash: await sha256(password) }
    localStorage.setItem(DEMO_USERS_KEY, JSON.stringify([...users, user]))
    localStorage.setItem(DEMO_SESSION_KEY, user.id)
    return { user: publicUser(user), needsConfirmation: false }
  },
  async signIn({ email, password }) {
    const users = readJSON(DEMO_USERS_KEY, [])
    const user = users.find((u) => u.email === email.trim().toLowerCase())
    if (!user || user.hash !== (await sha256(password))) throw new AuthError('E-posta veya şifre hatalı.')
    localStorage.setItem(DEMO_SESSION_KEY, user.id)
    return { user: publicUser(user) }
  },
  async signOut() {
    localStorage.removeItem(DEMO_SESSION_KEY)
  },
  async getUser() {
    const id = localStorage.getItem(DEMO_SESSION_KEY)
    const user = readJSON(DEMO_USERS_KEY, []).find((u) => u.id === id)
    return user ? publicUser(user) : null
  },
  async resetPassword() {
    return 'Demo modunda şifre sıfırlama yok. Yeni bir hesap açabilirsin.'
  },
}

// ---------- supabase ----------
const SUPABASE_ERRORS = {
  'Invalid login credentials': 'E-posta veya şifre hatalı.',
  'User already registered': 'Bu e-posta ile zaten bir hesap var.',
  'Email not confirmed': 'E-postanı doğrulaman gerekiyor. Gelen kutunu kontrol et.',
}
const toAuthError = (e) =>
  new AuthError(SUPABASE_ERRORS[e.message] ?? (e.status === 429 ? 'Çok fazla deneme. Biraz bekle.' : 'Bir şeyler ters gitti, tekrar dene.'))

const toUser = (u) => (u ? { id: u.id, email: u.email, username: u.user_metadata?.username ?? u.email.split('@')[0] } : null)

const remote = {
  async signUp({ email, password, username }) {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: username.trim() } },
    })
    if (error) throw toAuthError(error)
    // e-posta doğrulaması açıksa oturum hemen oluşmaz
    return { user: toUser(data.user), needsConfirmation: !data.session }
  },
  async signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw toAuthError(error)
    return { user: toUser(data.user) }
  },
  async signOut() {
    await supabase.auth.signOut()
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
}

export const authService = isDemoMode ? demo : remote

/** Oturum değişince çağrılır (yalnızca Supabase modunda). Abonelikten çıkma fonksiyonu döner. */
export function subscribeToAuth(callback) {
  if (isDemoMode) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(toUser(session?.user)))
  return () => data.subscription.unsubscribe()
}
