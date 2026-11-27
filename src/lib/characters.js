import { studioHeaders } from './studioKey'

const API_BASE = import.meta.env.VITE_API_BASE || ''

export async function listCharacters() {
  const res = await fetch(`${API_BASE}/api/characters`, { headers: studioHeaders() })
  if (!res.ok) throw new Error('Karakter listesi alınamadı')
  return res.json()
}

export async function saveCharacter(entry) {
  const res = await fetch(`${API_BASE}/api/characters`, {
    method: 'POST',
    headers: studioHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(entry),
  })
  if (!res.ok) throw new Error('Karakter kaydedilemedi')
  return res.json()
}

export async function deleteCharacter(id) {
  const res = await fetch(`${API_BASE}/api/characters/${id}`, { method: 'DELETE', headers: studioHeaders() })
  if (!res.ok) throw new Error('Karakter silinemedi')
  return res.json()
}
