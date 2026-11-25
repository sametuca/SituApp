// Kayıt/ilk giriş onayları: üç ayrı onay kutusu (her biri ilgili metne bağlanır) + metin penceresi + eski hesaplar için engelleyici onay ekranı.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { CONSENT_ITEMS, CONTROLLER, DOCS, LEGAL_READY, LEGAL_VERSION, consentComplete, emptyConsent, makeConsentRecord } from '../legal/legalTexts'
import { ToyButton } from './ui'

/** Hukuki metin penceresi (kaydırılabilir). */
export function LegalModal({ doc, onClose }) {
  const d = DOCS[doc]
  if (!d) return null
  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[#4a3b5c]/40 p-4 backdrop-blur-[2px]" onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-label={d.title} onClick={(e) => e.stopPropagation()} className="flex max-h-[88svh] w-full max-w-xl flex-col rounded-[2rem] border-2 border-white bg-white p-5 shadow-toy sm:p-6">
        <div className="flex items-start gap-3">
          <h2 className="min-w-0 flex-1 text-xl font-black text-ink">{d.title}</h2>
          <span className="shrink-0 rounded-full bg-candy-lilac/50 px-2.5 py-1 text-[0.7rem] font-black text-ink-soft">Sürüm {LEGAL_VERSION}</span>
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1 text-sm font-semibold leading-relaxed text-ink-soft">
          {!LEGAL_READY && <p className="mb-3 rounded-xl bg-[#fff3c8] px-3 py-2 text-xs font-bold text-[#7a5b00]">Taslak: veri sorumlusu bilgileri henüz tanımlanmadı.</p>}
          <p>{d.intro}</p>
          {d.sections.map((s) => (
            <section key={s.h} className="mt-4">
              <h3 className="text-base font-black text-ink">{s.h}</h3>
              {s.p.map((t, i) => (
                <p key={i} className="mt-1.5">{t}</p>
              ))}
            </section>
          ))}
          <p className="mt-5 text-xs text-ink-soft/80">Veri sorumlusu: {CONTROLLER.name}</p>
        </div>
        <ToyButton onClick={onClose} className="mt-4 !py-3 !text-base">Kapat</ToyButton>
      </div>
    </div>,
    document.body,
  )
}

/** Üç onay kutusu. value: { terms, kvkk, transfer }; errors: aynı anahtarlarla metin. */
export function ConsentFields({ value, onChange, errors = {} }) {
  const [doc, setDoc] = useState(null)
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl bg-white/60 p-3">
      {CONSENT_ITEMS.map((it) => (
        <div key={it.id}>
          <label className="flex cursor-pointer items-start gap-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={Boolean(value[it.id])}
              onChange={(e) => onChange({ ...value, [it.id]: e.target.checked })}
              aria-invalid={Boolean(errors[it.id])}
              className="mt-0.5 h-5 w-5 shrink-0 accent-candy-pink-deep"
            />
            <span>
              {it.label}{' '}
              <button type="button" onClick={(e) => (e.preventDefault(), setDoc(it.doc))} className="font-extrabold text-candy-lilac-deep underline">
                Metni oku
              </button>
            </span>
          </label>
          {errors[it.id] && (
            <p role="alert" className="mt-1 text-xs font-bold text-candy-pink-dark">{errors[it.id]}</p>
          )}
        </div>
      ))}
      {doc && <LegalModal doc={doc} onClose={() => setDoc(null)} />}
    </div>
  )
}

/** Giriş ekranının altındaki metin bağlantıları (kayıt olmadan da okunabilir). */
export function LegalLinks() {
  const [doc, setDoc] = useState(null)
  return (
    <>
      <p className="mt-3 text-center text-xs font-bold text-ink-soft/80">
        {['kvkk', 'terms', 'transfer'].map((k, i) => (
          <span key={k}>
            {i > 0 && ' · '}
            <button type="button" onClick={() => setDoc(k)} className="underline hover:text-ink">
              {k === 'kvkk' ? 'KVKK Aydınlatma' : k === 'terms' ? 'Kullanım Şartları' : 'Yurt dışı aktarım'}
            </button>
          </span>
        ))}
      </p>
      {doc && <LegalModal doc={doc} onClose={() => setDoc(null)} />}
    </>
  )
}

/** Giriş yapmış ama güncel sürümü onaylamamış hesaplar için engelleyici ekran. */
export function ConsentGate({ onAccept, onSignOut }) {
  const [value, setValue] = useState(emptyConsent())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async () => {
    if (!consentComplete(value)) return setErr('Devam etmek için üç onayı da vermelisin.')
    setBusy(true)
    try {
      await onAccept(makeConsentRecord(value))
    } catch {
      setErr('Kaydedilemedi, tekrar dene.')
      setBusy(false)
    }
  }
  return (
    <div className="fixed inset-0 z-[55] grid place-items-center overflow-y-auto bg-[#fff7ee] p-4">
      <div className="w-full max-w-lg rounded-[2rem] border-2 border-white bg-white p-6 shadow-toy">
        <h1 className="text-2xl font-black text-ink">Devam etmeden önce 📜</h1>
        <p className="mt-2 text-sm font-semibold text-ink-soft">Kişisel verilerinin korunması ve kullanım şartları güncellendi. Oyuna devam etmek için aşağıdaki metinleri okuyup onaylaman gerekiyor.</p>
        <div className="mt-4">
          <ConsentFields value={value} onChange={(v) => (setValue(v), setErr(''))} />
        </div>
        {err && <p role="alert" className="mt-3 rounded-xl bg-candy-pink/30 px-3 py-2 text-sm font-bold text-candy-pink-dark">{err}</p>}
        <ToyButton onClick={submit} loading={busy} className="mt-4">Kabul et ve devam et</ToyButton>
        <button type="button" onClick={onSignOut} className="mt-3 w-full text-center text-sm font-extrabold text-ink-soft underline">Kabul etmiyorum, çıkış yap</button>
      </div>
    </div>
  )
}
