import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { isDemoMode, validate, AuthError } from '../lib/auth'
import { Field, PastelBackground, ToyButton } from '../components/ui'
import { ConsentFields, LegalLinks } from '../components/Consent'
import { emptyConsent } from '../legal/legalTexts'

// three.js yalnızca giriş ekranı çizildikten sonra yüklensin
const AvatarPreview = lazy(() => import('../components/3d/AvatarPreview'))

const EMPTY = { username: '', email: '', password: '', confirm: '', consent: emptyConsent() }
const QUICK_LOGIN = { email: 'test@situapp.dev', password: 'situapp-test-123' }
const SHOW_QUICK_LOGIN = import.meta.env.DEV && isDemoMode // production build'de kod dışarıda kalır

export default function AuthPage() {
  const { user, loading, recovery, signIn, signUp, resetPassword, updatePassword, resendConfirmation } = useAuth()
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
  const [verifyEmail, setVerifyEmail] = useState('') // e-posta doğrulaması bekleniyor
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
        const res = await signUp(form)
        if (res.needsConfirmation) {
          setVerifyEmail(form.email.trim())
          setMode('login')
          setForm({ ...EMPTY, email: form.email })
        }
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
        await signUp({ ...QUICK_LOGIN, username: 'tester', consent: { terms: true, kvkk: true, transfer: true } })
      }
    } catch (err) {
      fail({}, err instanceof AuthError ? err.message : 'Hızlı giriş başarısız.')
    } finally {
      setBusy(false)
    }
  }

  const onResend = async () => {
    const email = verifyEmail || form.email
    if (!email.trim()) return fail({ email: 'Önce e-postanı yaz.' })
    setBusy(true)
    try {
      setNotice(await resendConfirmation(email))
      setFormError('')
    } catch (err) {
      fail({}, err.message)
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

  const onForgot = async () => {
    if (!form.email.trim()) return fail({ email: 'Önce e-postanı yaz.' })
    try {
      setNotice(await resetPassword(form.email))
      setFormError('')
    } catch (err) {
      fail({}, err.message)
    }
  }

  return (
    <PastelBackground>
      <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center px-5 py-8">
        {/* marka */}
        <header className="animate-pop text-center">
          <h1 className="text-5xl font-black tracking-tight text-ink">
            Situ<span className="text-candy-pink-deep">App</span>
          </h1>
          <span className="mx-auto mt-1 inline-block rounded-full border-2 border-white bg-[#fff3c8] px-3 py-0.5 text-[0.6875rem] font-black uppercase tracking-widest text-[#8a5a00] shadow-soft">Pre-alpha</span>
          <p className="mt-1 text-sm font-bold tracking-wide text-ink-soft">
            Avatarını seç. Mekânı bul. Bağlantını kur. 💫
          </p>
          {online != null && (
            <p className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full border-2 border-white bg-white/80 px-3 py-1 text-xs font-extrabold text-ink-soft shadow-soft">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {online} çevrimiçi
            </p>
          )}
        </header>

        {/* maskot */}
        <div className="relative z-10 -mb-10 mt-1 h-56 w-48">
          <Suspense fallback={<div className="grid h-full place-items-center text-6xl">🧸</div>}>
            <AvatarPreview className="h-full w-full" />
          </Suspense>
        </div>

        {/* kart */}
        <section
          className={`w-full rounded-[2rem] border-2 border-white bg-white/75 p-6 pt-12 shadow-toy backdrop-blur-md ${
            shaking ? 'animate-shake' : 'animate-pop'
          }`}
        >
          {recovery ? (
            <form onSubmit={onNewPassword} noValidate className="flex flex-col gap-4">
              <h2 className="text-center text-xl font-black text-ink">Yeni şifre belirle 🔑</h2>
              <Field id="new-password" label="Yeni şifre" icon="🔒" type="password" autoComplete="new-password" placeholder="en az 8 karakter" value={newPw.password} onChange={(e) => setNewPw((p) => ({ ...p, password: e.target.value }))} error={errors.password} />
              <Field id="new-confirm" label="Yeni şifre (tekrar)" icon="🔒" type="password" autoComplete="new-password" placeholder="şifreni tekrar yaz" value={newPw.confirm} onChange={(e) => setNewPw((p) => ({ ...p, confirm: e.target.value }))} error={errors.confirm} />
              {formError && (
                <p role="alert" className="rounded-xl bg-candy-pink/30 px-3 py-2 text-sm font-bold text-candy-pink-dark">
                  {formError}
                </p>
              )}
              <ToyButton type="submit" loading={busy}>
                Şifremi Kaydet
              </ToyButton>
            </form>
          ) : verifyEmail ? (
            <div className="flex flex-col items-center gap-3 text-center" role="status">
              <div className="text-6xl">💌</div>
              <h2 className="text-xl font-black text-ink">E-postanı doğrula</h2>
              <p className="text-sm font-semibold text-ink-soft">
                <b className="text-ink">{verifyEmail}</b> adresine bir doğrulama bağlantısı gönderdik. Bağlantıya dokun, sonra buradan giriş yap. Gelmediyse gereksiz klasörüne de bak.
              </p>
              {notice && <p className="rounded-xl bg-candy-mint/50 px-3 py-2 text-sm font-bold text-ink">{notice}</p>}
              {formError && <p role="alert" className="rounded-xl bg-candy-pink/30 px-3 py-2 text-sm font-bold text-candy-pink-dark">{formError}</p>}
              <ToyButton type="button" loading={busy} onClick={onResend}>
                Yeniden gönder
              </ToyButton>
              <button type="button" onClick={() => { setVerifyEmail(''); setNotice(''); setFormError('') }} className="text-sm font-extrabold text-candy-pink-dark hover:underline">
                Giriş ekranına dön
              </button>
            </div>
          ) : (
            <>
          {/* sekmeler */}
          <div role="tablist" aria-label="Giriş veya kayıt" className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-candy-lilac/40 p-1">
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
                className={`rounded-xl py-2 text-sm font-extrabold transition-all ${
                  mode === id ? 'bg-white text-candy-pink-dark shadow-soft' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            {isRegister && (
              <Field
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
            <Field
              id="email"
              label="E-posta"
              icon="✉️"
              type="email"
              autoComplete="email"
              placeholder="sen@ornek.com"
              value={form.email}
              onChange={set('email')}
              error={errors.email}
            />
            <Field
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
                  className="grid h-9 w-9 place-items-center rounded-xl text-lg hover:bg-candy-lilac/40"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              }
            />
            {isRegister && (
              <>
                <Field
                  id="confirm"
                  label="Şifre (tekrar)"
                  icon="🔒"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="şifreni tekrar yaz"
                  value={form.confirm}
                  onChange={set('confirm')}
                  error={errors.confirm}
                />
                <ConsentFields value={form.consent} onChange={(consent) => setForm((f) => ({ ...f, consent }))} errors={errors} />
              </>
            )}

            {!isRegister && (
              <button type="button" onClick={onForgot} className="-mt-2 self-end text-xs font-bold text-candy-lilac-deep hover:underline">
                Şifremi unuttum
              </button>
            )}

            <div aria-live="polite">
              {formError && (
                <p role="alert" className="rounded-xl bg-candy-pink/30 px-3 py-2 text-sm font-bold text-candy-pink-dark">
                  {formError}
                </p>
              )}
              {notice && <p className="rounded-xl bg-candy-mint/50 px-3 py-2 text-sm font-bold text-ink">{notice}</p>}
              {/doğrulaman/.test(formError) && (
                <button type="button" onClick={onResend} className="mt-2 text-xs font-extrabold text-candy-lilac-deep hover:underline">
                  Doğrulama e-postasını yeniden gönder
                </button>
              )}
            </div>

            <ToyButton type="submit" loading={busy}>
              {isRegister ? 'Hesap Oluştur' : 'Dünyaya Gir'}
            </ToyButton>
          </form>

          <p className="mt-4 text-center text-sm font-semibold text-ink-soft">
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
            className="mt-4 rounded-2xl border-2 border-dashed border-candy-lilac-deep/60 bg-white/50 px-5 py-2 text-sm font-extrabold text-candy-lilac-deep transition hover:bg-white disabled:opacity-50"
          >
            ⚡ Hızlı giriş (test)
          </button>
        )}
        {isDemoMode && (
          <p className="mt-4 max-w-xs text-center text-xs font-semibold text-ink-soft/80">
            🧪 Demo modu: hesapların yalnızca bu tarayıcıda saklanır.
          </p>
        )}
        <a href="/studio" className="mt-3 text-xs font-bold text-ink-soft/50 hover:text-ink-soft">
          studio
        </a>
      </main>
    </PastelBackground>
  )
}
