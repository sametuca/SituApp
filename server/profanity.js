// Mesaj denetimi: küfür maskeleme ve iletişim bilgisi (bağlantı, telefon, e-posta) gizleme.
// Amaç tacizi ve dolandırıcılığı azaltmak; kusursuz değil. Liste kısa tutuldu, gerektikçe genişletilir.

const MAP = { ı: 'i', ş: 's', ğ: 'g', ü: 'u', ö: 'o', ç: 'c', â: 'a', î: 'i', û: 'u', 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i' }

// Önek eşleşmesi: kelime bununla başlıyorsa küfürdür
const PREFIXES = ['orospu', 'siktir', 'sikik', 'sikim', 'sikeyim', 'sikis', 'yarrak', 'yarak', 'amcik', 'amina', 'aminakoy', 'gotveren', 'gotun', 'pezevenk', 'kahpe', 'ibne', 'puşt', 'pust', 'oc', 'gerizekali', 'serefsiz', 'mal oglu']
// Tam eşleşme: kısa kelimeler başka kelimelere takılmasın
const EXACT = new Set(['amk', 'aq', 'mk', 'oc', 'pic', 'got', 'sik', 'sg', 'amq', 'siktir', 'orospu', 'piç'])

const norm = (w) => {
  let s = ''
  for (const ch of w.toLowerCase()) s += MAP[ch] ?? ch
  return s.replace(/[^a-z]/g, '').replace(/(.)\1{2,}/g, '$1$1').replace(/(.)\1+/g, '$1') // süs karakterleri at, tekrarları sadeleştir
}

const isBad = (w) => {
  const n = norm(w)
  if (n.length < 2) return false
  return EXACT.has(n) || PREFIXES.some((p) => n.startsWith(norm(p)) && n.length >= Math.min(norm(p).length, 4))
}

const URL_RE = /(https?:\/\/\S+|www\.\S+|\b[a-z0-9-]+\.(com|net|org|io|me|tr|co|app|link|gg|xyz|ly)\b\S*)/gi
const EMAIL_RE = /[a-z0-9._%+-]+\s*(@|\(at\)|\[at\])\s*[a-z0-9.-]+\.[a-z]{2,}/gi
const PHONE_RE = /(\+?\d[\s().-]*){10,}/g

/**
 * Metni denetler. { text, flagged }: flagged = bir şey maskelendi.
 * contact=false verilirse bağlantı/telefon maskelenmez (örn. kullanıcı adı).
 */
export function moderate(input, { contact = true } = {}) {
  let text = String(input ?? '')
  let flagged = false
  if (contact) {
    const before = text
    text = text.replace(EMAIL_RE, '[gizlendi]').replace(URL_RE, '[gizlendi]').replace(PHONE_RE, '[gizlendi]')
    if (text !== before) flagged = true
  }
  text = text
    .split(/(\s+)/)
    .map((tok) => {
      if (!tok.trim() || !isBad(tok)) return tok
      flagged = true
      return '*'.repeat(Math.min(tok.length, 8))
    })
    .join('')
  return { text, flagged }
}
