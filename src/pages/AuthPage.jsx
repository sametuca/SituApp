import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { isDemoMode, validate, AuthError } from '../lib/auth'
import { Field, PastelBackground, ToyButton } from '../components/ui'
import { LegalLinks } from '../components/Consent'

// three.js yalnızca giriş ekranı çizildikten sonra yüklensin
const AvatarPreview = lazy(() => import('../components/3d/AvatarPreview'))

const EMPTY = { username: '', email: '', password: '' }
const QUICK_LOGIN = { email: 'tester', password: 'situapp-test-123' }
const SHOW_QUICK_LOGIN = import.meta.env.DEV && isDemoMode // production build'de kod dışarıda kalır

export default function AuthPage() {
  const { user, loading, recovery, signIn, signUp, updatePassword } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState('login') // login | register
  // Çevrimiçi sayısı: her zaman 100-150 arasında, yavaşça oynayan bir değer gösterilir (gerçek sayıdan bağımsız).
  const [online, setOnline] = useState(() => 100 + Math.floor(Math.random() * 51))
  useEffect(() => {
    const t = setInterval(() => setOnline((n) => Math.max(100, Math.min(150, n + Math.floor(Math.random() * 7) - 3))), 4000)
    return () => clearInterval(t)
  }, [])
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [newPw, setNewPw] = useState({ password: '', confirm: '' })

  if (loading) return <PastelBackground><div className="min-h-svh" /></PastelBackground>
  if (user && !recovery) return <Navigate to={location.state?.from ?? '/avatar'} replace />

  const isRegister = mode === 'register'
  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }))
  }

  const switchMode = (next) => {
    setMode(next)
    setErrors({})
    setFormError('')
    setNotice('')
  }

  const fail = (errs, message = '') => {
    setErrors(errs)
    setFormError(message)
    // animasyonu yeniden tetiklemek için önce kapat, sonra aç (kartı yeniden oluşturmadan; odak kaybolmasın)
    setShaking(false)
    requestAnimationFrame(() => setShaking(true))
    setTimeout(() => setShaking(false), 450)
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setNotice('')
    const errs = validate({ mode, ...form })
    if (Object.keys(errs).length) return fail(errs)
    setFormError('')
    setBusy(true)
    try {
      if (isRegister) {
        await signUp(form)
      } else {
        await signIn(form)
      }
      // oturum açılınca üstteki <Navigate> yönlendirir
    } catch (err) {
      fail({}, err instanceof AuthError ? err.message : 'Bir şeyler ters gitti, tekrar dene.')
    } finally {
      setBusy(false)
    }
  }

  // Yalnızca geliştirme + demo modunda: hesap yoksa oluşturur, varsa giriş yapar.
  const onQuickLogin = async () => {
    setBusy(true)
    setFormError('')
    try {
      try {
        await signIn(QUICK_LOGIN)
      } catch {
        await signUp({ ...QUICK_LOGIN, username: 'tester' })
      }
    } catch (err) {
      fail({}, err instanceof AuthError ? err.message : 'Hızlı giriş başarısız.')
    } finally {
      setBusy(false)
    }
  }

  const onNewPassword = async (e) => {
    e.preventDefault()
    const errs = {}
    if (newPw.password.length < 8) errs.password = 'Şifre en az 8 karakter olmalı.'
    if (newPw.confirm !== newPw.password) errs.confirm = 'Şifreler eşleşmiyor.'
    if (Object.keys(errs).length) return fail(errs)
    setBusy(true)
    try {
      await updatePassword(newPw.password) // başarıyla bitince recovery kapanır, <Navigate> yönlendirir
    } catch (err) {
      fail({}, err instanceof AuthError ? err.message : 'Bir şeyler ters gitti, tekrar dene.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PastelBackground>
      <main className="mx-auto flex min-h-svh w-full max-w-[390px] flex-col items-center justify-center px-4 py-3 sm:py-4">
        {/* marka */}
        <header className="animate-pop flex flex-col items-center text-center">
          <h1 className="sr-only">Rastla</h1>
          <img
            src="/logo.png"
            alt="Rastla"
            draggable={false}
            className="mx-auto h-14 w-auto select-none drop-shadow-[0_6px_14px_rgba(74,59,92,0.18)] sm:h-16"
          />
          <p className="mt-1 text-xs font-bold tracking-wide text-ink-soft">
            Hikâye sahilde başlar; kaynaş, tanış ve birlikte şehre ak. 🌴✨
          </p>
          <div className="mt-1.5 flex items-center justify-center gap-2">
            <span className="inline-block rounded-full border-2 border-white bg-[#fff3c8] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-[#8a5a00] shadow-soft">
              Pre-alpha
            </span>
            {online != null && (
              <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-white bg-white/80 px-2.5 py-0.5 text-[11px] font-extrabold text-ink-soft shadow-soft">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {online} çevrimiçi
              </span>
            )}
          </div>
        </header>

        {/* maskot */}
        <div className="relative z-10 -mb-8 -mt-1 h-32 w-32 sm:h-36 sm:w-36">
          <Suspense fallback={<div className="grid h-full place-items-center text-5xl">🧸</div>}>
            <AvatarPreview className="h-full w-full" />
          </Suspense>
        </div>

        {/* kart */}
        <section
          className={`w-full rounded-[1.75rem] border-2 border-white bg-white/75 p-4 pt-8 shadow-toy backdrop-blur-md sm:p-5 sm:pt-9 ${
            shaking ? 'animate-shake' : 'animate-pop'
          }`}
        >
          {recovery ? (
            <form onSubmit={onNewPassword} noValidate className="flex flex-col gap-3">
              <h2 className="text-center text-lg font-black text-ink">Yeni şifre belirle 🔑</h2>
              <Field compact id="new-password" label="Yeni şifre" icon="🔒" type="password" autoComplete="new-password" placeholder="en az 8 karakter" value={newPw.password} onChange={(e) => setNewPw((p) => ({ ...p, password: e.target.value }))} error={errors.password} />
              <Field compact id="new-confirm" label="Yeni şifre (tekrar)" icon="🔒" type="password" autoComplete="new-password" placeholder="şifreni tekrar yaz" value={newPw.confirm} onChange={(e) => setNewPw((p) => ({ ...p, confirm: e.target.value }))} error={errors.confirm} />
              {formError && (
                <p role="alert" className="rounded-xl bg-candy-pink/30 px-3 py-2 text-xs font-bold text-candy-pink-dark">
                  {formError}
                </p>
              )}
              <ToyButton type="submit" loading={busy} className="!py-2.5 !text-base">
                Şifremi Kaydet
              </ToyButton>
            </form>
          ) : (
            <>
          {/* sekmeler */}
          <div role="tablist" aria-label="Giriş veya kayıt" className="mb-3.5 grid grid-cols-2 gap-1 rounded-2xl bg-candy-lilac/40 p-1">
            {[
              ['login', 'Giriş Yap'],
              ['register', 'Kayıt Ol'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                onClick={() => switchMode(id)}
                className={`rounded-xl py-1.5 text-xs font-extrabold transition-all ${
                  mode === id ? 'bg-white text-candy-pink-dark shadow-soft' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2.5">
            {isRegister && (
              <Field
                compact
                id="username"
                label="Kullanıcı adı"
                icon="🧸"
                autoComplete="username"
                placeholder="takma adın"
                maxLength={16}
                value={form.username}
                onChange={set('username')}
                error={errors.username}
              />
            )}
            {!isRegister ? (
              <Field
                compact
                id="email"
                label="Kullanıcı adı veya e-posta"
                icon="🧸"
                autoComplete="username"
                placeholder="kullanıcı adın"
                value={form.email}
                onChange={set('email')}
                error={errors.email}
              />
            ) : null}
            <Field
              compact
              id="password"
              label="Şifre"
              icon="🔒"
              type={showPassword ? 'text' : 'password'}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              placeholder={isRegister ? 'en az 8 karakter' : 'şifren'}
              value={form.password}
              onChange={set('password')}
              error={errors.password}
              right={
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  className="grid h-8 w-8 place-items-center rounded-xl text-base hover:bg-candy-lilac/40"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              }
            />
            {(formError || notice) && (
              <div aria-live="polite">
                {formError && (
                  <p role="alert" className="rounded-xl bg-candy-pink/30 px-3 py-1.5 text-xs font-bold text-candy-pink-dark">
                    {formError}
                  </p>
                )}
                {notice && <p className="rounded-xl bg-candy-mint/50 px-3 py-1.5 text-xs font-bold text-ink">{notice}</p>}
              </div>
            )}

            <ToyButton type="submit" loading={busy} className="mt-0.5 !py-2.5 !text-base">
              {isRegister ? 'Hesap Oluştur' : 'Dünyaya Gir'}
            </ToyButton>
            {isRegister && (
              <p className="px-1 text-center text-[11px] font-semibold leading-4 text-ink-soft">
                Bilgilerini kaybetmek istemiyorsan kullanıcı adını ve şifreni sakla.
              </p>
            )}
          </form>

          <p className="mt-3 text-center text-xs font-semibold text-ink-soft">
            {isRegister ? 'Zaten hesabın var mı?' : 'Henüz hesabın yok mu?'}{' '}
            <button
              type="button"
              onClick={() => switchMode(isRegister ? 'login' : 'register')}
              className="font-extrabold text-candy-pink-dark hover:underline"
            >
              {isRegister ? 'Giriş yap' : 'Kayıt ol'}
            </button>
          </p>
          <LegalLinks />
            </>
          )}
        </section>

        {SHOW_QUICK_LOGIN && (
          <button
            type="button"
            onClick={onQuickLogin}
            disabled={busy}
            className="mt-2.5 rounded-2xl border-2 border-dashed border-candy-lilac-deep/60 bg-white/50 px-4 py-1.5 text-xs font-extrabold text-candy-lilac-deep transition hover:bg-white disabled:opacity-50"
          >
            ⚡ Hızlı giriş (test)
          </button>
        )}
        {isDemoMode && (
          <p className="mt-2 max-w-xs text-center text-[11px] font-semibold text-ink-soft/80">
            🧪 Demo modu: hesapların yalnızca bu tarayıcıda saklanır.
          </p>
        )}
      </main>
    </PastelBackground>
  )
}
