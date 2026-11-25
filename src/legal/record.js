// Onay kaydını sunucuya (IP + zaman damgasıyla) bildirir: POST /api/consent. Başarısız olsa bile kayıt/giriş akışını bozmaz.
// E-posta ham olarak gönderilmez; yalnızca SHA-256 özeti (başvuruda hesabın onayını doğrulamak için).
export async function emailRef(email) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(email).trim().toLowerCase()))
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return ''
  }
}

export async function recordConsent(record, email) {
  try {
    const ref = await emailRef(email)
    await fetch('/api/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: record.version, items: ['terms', 'kvkk', 'transfer'].filter((k) => record[k]), ref }),
    })
  } catch {
    /* sunucu yoksa sessizce geç: asıl kayıt hesabın meta verisindedir */
  }
}
