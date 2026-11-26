// Asset Studio anahtarı (server/.env → STUDIO_KEY, yoksa ADMIN_KEY).
// Tarayıcıda localStorage'da tutulur ve dahili uçlara `x-studio-key` başlığıyla gönderilir.
const KEY_STORE = 'rastla_studio_key'

export function getStudioKey() {
  try {
    return localStorage.getItem(KEY_STORE) ?? ''
  } catch {
    return ''
  }
}

export function setStudioKey(v) {
  try {
    if (v) localStorage.setItem(KEY_STORE, v)
    else localStorage.removeItem(KEY_STORE)
  } catch {
    /* localStorage kapalıysa sessiz */
  }
}

/** Verilen başlıklara studio anahtarını ekler (anahtar yoksa dokunmaz). */
export function studioHeaders(extra = {}) {
  const key = getStudioKey()
  return key ? { ...extra, 'x-studio-key': key } : extra
}
