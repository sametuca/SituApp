// Pastel tasarım sisteminin ortak bileşenleri (tüm ekranlarda kullanılacak).

// tone: 'pink' (kadın avatarlar, varsayılan) | 'blue' (erkek avatarlar)
// Tailwind sınıfları dinamik üretilemediği için tam sınıf adları burada yazılı.
export const TONES = {
  pink: {
    button: 'bg-candy-pink-deep border-candy-pink-dark focus-visible:ring-candy-pink/60',
    dotActive: 'bg-candy-pink-deep',
    dotDone: 'bg-candy-pink',
    accent: 'text-candy-pink-dark',
    ring: 'border-candy-pink-deep',
    badge: 'bg-candy-pink-deep',
    soft: 'bg-candy-pink/40',
  },
  blue: {
    button: 'bg-candy-blue-deep border-candy-blue-dark focus-visible:ring-candy-blue/70',
    dotActive: 'bg-candy-blue-deep',
    dotDone: 'bg-candy-blue',
    accent: 'text-candy-blue-dark',
    ring: 'border-candy-blue-deep',
    badge: 'bg-candy-blue-deep',
    soft: 'bg-candy-blue/40',
  },
}

export function ToyButton({ children, loading, tone = 'pink', className = '', ...props }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`relative w-full rounded-2xl ${TONES[tone].button} px-6 py-3.5 text-lg font-extrabold text-white
        border-b-4 shadow-soft transition-all duration-150
        hover:brightness-105 active:translate-y-[3px] active:scale-[0.98] active:border-b-[1px]
        focus-visible:outline-none focus-visible:ring-4
        disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {loading ? <span className="inline-block h-5 w-5 animate-spin rounded-full border-[3px] border-white/40 border-t-white align-middle" /> : children}
    </button>
  )
}

export function Field({ id, label, icon, error, right, compact = false, ...props }) {
  return (
    <div>
      <label htmlFor={id} className={`block font-bold text-ink ${compact ? 'mb-1 text-xs' : 'mb-1.5 text-sm'}`}>
        {label}
      </label>
      <div className="relative">
        <span aria-hidden className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${compact ? 'text-base' : 'left-3.5 text-lg'}`}>
          {icon}
        </span>
        <input
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
          className={`w-full rounded-2xl border-2 bg-white/80 ${compact ? 'py-2 pl-9 text-sm' : 'py-3 pl-11'} ${right ? 'pr-11' : 'pr-4'} font-semibold text-ink
            placeholder:font-normal placeholder:text-ink-soft/60 outline-none transition
            focus:bg-white focus:ring-4 focus:ring-candy-lilac/50
            ${error ? 'border-candy-pink-dark' : 'border-candy-lilac/60 focus:border-candy-lilac-deep'}`}
        />
        {right && <div className="absolute right-2 top-1/2 -translate-y-1/2">{right}</div>}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-bold text-candy-pink-dark">
          {error}
        </p>
      )}
    </div>
  )
}

/** İkincil, açık renkli buton. */
export function SoftButton({ children, className = '', ...props }) {
  return (
    <button
      {...props}
      className={`rounded-2xl border-2 border-white bg-white/70 px-5 py-2.5 text-sm font-extrabold text-ink shadow-soft
        backdrop-blur-sm transition hover:bg-white active:translate-y-px
        focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-candy-lilac/60 ${className}`}
    >
      {children}
    </button>
  )
}

/** Adım göstergesi: ● ● ○ */
export function StepDots({ step, total = 2, tone = 'pink' }) {
  const t = TONES[tone]
  return (
    <div className="flex items-center gap-2" aria-label={`Adım ${step} / ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-2.5 rounded-full transition-all ${
            i + 1 === step ? `w-8 ${t.dotActive}` : i + 1 < step ? `w-2.5 ${t.dotDone}` : 'w-2.5 bg-candy-lilac/70'
          }`}
        />
      ))}
    </div>
  )
}

/** Pastel balonlar: arka plan süsü. Sabit konumlar (render'lar arasında zıplamasın). */
const BUBBLES = [
  { c: 'bg-candy-pink', s: 120, x: '6%', y: '12%', d: '0s' },
  { c: 'bg-candy-blue', s: 90, x: '84%', y: '8%', d: '1.2s' },
  { c: 'bg-candy-yellow', s: 70, x: '90%', y: '62%', d: '2.1s' },
  { c: 'bg-candy-mint', s: 110, x: '4%', y: '70%', d: '0.7s' },
  { c: 'bg-candy-lilac', s: 60, x: '72%', y: '86%', d: '1.6s' },
  { c: 'bg-candy-pink', s: 50, x: '22%', y: '90%', d: '2.6s' },
]

// 'pink' varsayılan (pembe-lavanta-mavi karışımı); 'blue' erkek avatar teması. İkisi arasında yumuşak geçiş yapar.
export function PastelBackground({ children, tone }) {
  return (
    <div className="relative min-h-svh w-full overflow-hidden bg-gradient-to-br from-[#fff2e3] via-[#f1e6ff] to-[#dff3ff]">
      {tone && (
        <>
          <div
            aria-hidden
            className={`absolute inset-0 bg-gradient-to-br from-[#ffeed9] via-[#fff8f0] to-[#f1e6ff] transition-opacity duration-700 ${tone === 'pink' ? 'opacity-100' : 'opacity-0'}`}
          />
          <div
            aria-hidden
            className={`absolute inset-0 bg-gradient-to-br from-[#cfeaff] via-[#eaf6ff] to-[#e3e6ff] transition-opacity duration-700 ${tone === 'blue' ? 'opacity-100' : 'opacity-0'}`}
          />
        </>
      )}
      {BUBBLES.map((b, i) => (
        <div
          key={i}
          aria-hidden
          className={`absolute animate-float rounded-full opacity-60 blur-[1px] transition-colors duration-700 ${
            tone === 'blue' ? (i % 2 ? 'bg-candy-lilac' : 'bg-candy-blue') : b.c
          }`}
          style={{ width: b.s, height: b.s, left: b.x, top: b.y, animationDelay: b.d }}
        />
      ))}
      <div className="relative z-10">{children}</div>
    </div>
  )
}
