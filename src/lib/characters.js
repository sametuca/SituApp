const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001'

export async function listCharacters() {
  const res = await fetch(`${API_BASE}/api/characters`)
  if (!res.ok) throw new Error('Karakter listesi alınamadı')
  return res.json()
}

export async function saveCharacter(entry) {
  const res = await fetch(`${API_BASE}/api/characters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  })
  if (!res.ok) throw new Error('Karakter kaydedilemedi')
  return res.json()
}

export async function deleteCharacter(id) {
  const res = await fetch(`${API_BASE}/api/characters/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Karakter silinemedi')
  return res.json()
}
