// Tutarlı ikon seti: tüm emojiler Microsoft Fluent Emoji 3D (MIT) görselleriyle çizilir (public/icons/fluent/).
// Kodda emojiyi olduğu gibi yaz ('🏠 Evim', `{x.emoji}`): vite-plugins/emoji.js, JSX çocuklarını emojify()'dan geçirir.
// Setteki olmayan emojiler (ya da toni değişmiş olanlar) yerel emoji olarak kalır. Özel ikon: <Em e="🏠" />.
import index from './emojiIndex.json'

const HAVE = new Set(index)
const QUICK = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u
const EMOJI_RE =
  /\p{Regional_Indicator}{2}|[#*0-9]️?⃣|\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?(?:‍\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?)*/gu

/** '🏠' → '1f3e0' (VS16 atılır). */
export const emojiKey = (s) =>
  Array.from(s, (c) => c.codePointAt(0).toString(16))
    .filter((h) => h !== 'fe0f')
    .join('-')

export const emojiSrc = (s) => {
  const k = emojiKey(s)
  return HAVE.has(k) ? `/icons/fluent/${k}.webp` : null
}

/** Dizgedeki emojileri <img> ile değiştirir; emoji yoksa dizgeyi AYNEN döndürür (diğer değerler de olduğu gibi geçer). */
export function emojify(v) {
  if (typeof v !== 'string' || v.length === 0 || !QUICK.test(v)) return v
  const out = []
  let last = 0
  let n = 0
  for (const m of v.matchAll(EMOJI_RE)) {
    const src = emojiSrc(m[0])
    if (!src) continue
    if (m.index > last) out.push(v.slice(last, m.index))
    out.push(<img key={n++} className="em" src={src} alt={m[0]} draggable={false} />)
    last = m.index + m[0].length
  }
  if (!out.length) return v
  if (last < v.length) out.push(v.slice(last))
  return out
}

/** Tek bir emoji ikonu (isteğe bağlı boyut: CSS font-size ile ya da `size` px). */
export function Em({ e, size, className = '' }) {
  const src = emojiSrc(e)
  if (!src) return <span className={className}>{e}</span>
  return <img className={`em ${className}`} src={src} alt={e} draggable={false} style={size ? { width: `${size / 16}rem`, height: `${size / 16}rem` } : undefined} />
}
