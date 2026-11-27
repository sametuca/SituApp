// Onay kaydını doğrulanmış hesapla sunucuya bildirir; kayıt/giriş akışı sunucu kaydı olmadan da sürebilir.
export async function recordConsent(record, token) {
  if (!token) return
  try {
    const response = await fetch('/api/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ version: record.version, items: ['terms', 'kvkk', 'transfer'].filter((k) => record[k]) }),
    })
    if (!response.ok) console.error('Onay kaydı sunucuya gönderilemedi:', response.status)
  } catch {
    console.error('Onay kaydı sunucuya gönderilemedi.')
  }
}
