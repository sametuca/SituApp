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
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validate({ mode, username, email, password, confirm, consent }) {
  const errors = {}
  if (mode === 'register') {
    const u = (username ?? '').trim()
    if (u.length < 3 || u.length > 16) errors.username = 'Kullanıcı adı 3-16 karakter olmalı.'
    else if (!USERNAME_RE.test(u)) errors.username = 'Sadece harf (a-z, Türkçe harfler), rakam, tire ve alt çizgi kullan.'
  }
  if (!EMAIL_RE.test((email ?? '').trim())) errors.email = 'Geçerli bir e-posta gir.'
  if (mode === 'register') {
    if ((password ?? '').length < 8) errors.password = 'Şifre en az 8 karakter olmalı.'
    if (confirm !== password) errors.confirm = 'Şifreler eşleşmiyor.'
    for (const k of ['terms', 'kvkk', 'transfer']) if (!consent?.[k]) errors[k] = 'Devam etmek için bu onay gerekli.'
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

const demo = {
  async signUp({ email, password, username, consentRecord }) {
    const users = readJSON(DEMO_USERS_KEY, [])
    const mail = email.trim().toLowerCase()
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
    const user = users.find((u) => u.email === email.trim().toLowerCase())
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
  if (e?.code === 'email_address_invalid') return new AuthError('Bu e-posta adresi geçersiz görünüyor.')
  if (e?.code === 'weak_password') return new AuthError('Şifre çok zayıf, daha uzun/karışık bir şifre dene.')
  if (e?.status === 429 || /rate limit/i.test(msg)) return new AuthError('Çok fazla deneme. Biraz bekle.')
  return new AuthError('Bir şeyler ters gitti, tekrar dene.')
}

const toUser = (u) => (u ? { id: u.id, email: u.email, username: u.user_metadata?.username ?? u.email.split('@')[0], consent: u.user_metadata?.consent ?? null } : null)

const remote = {
  async signUp({ email, password, username, consentRecord }) {
    const name = username.trim()
    // kullanıcı adı boş mu? (sunucu tarafı RPC; tetikleyici yine de benzersizliği garanti eder)
    const { data: free, error: rpcErr } = await supabase.rpc('username_available', { p_name: name })
    if (!rpcErr && free === false) throw new AuthError('Bu kullanıcı adı alınmış.')
    let avatar = 'zeynep'
    try {
      avatar = JSON.parse(localStorage.getItem('situapp_avatar'))?.slug ?? 'zeynep'
    } catch {
      /* seçim yok */
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: name, avatar, consent: consentRecord ?? null }, emailRedirectTo: window.location.origin },
    })
    if (error) throw toAuthError(error)
    // e-posta zaten kayıtlıysa Supabase (kullanıcı sızdırmamak için) sahte bir kullanıcı döner: identities boş
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new AuthError('Bu e-posta ile zaten bir hesap var.')
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
