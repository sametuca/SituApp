// Oyuncu kimliği (Supabase modu): kullanıcı adı ↔ uid haritası ve profil yükleme.
// Supabase ortamı yoksa hiçbir şey yapmaz; game.js eski ad tabanlı akışı kullanır.
import * as supa from './supa.js'

const names = new Map() // küçük harf kullanıcı adı → uid

export async function initNames() {
  if (!supa.enabled) return
  const rows = await supa.select('profiles', 'select=id,username')
  for (const r of rows) names.set(String(r.username).toLowerCase(), r.id)
  console.log(`Supabase: ${rows.length} profil adı yüklendi.`)
}

export const setName = (name, uid) => {
  for (const [k, v] of names) if (v === uid && k !== name.toLowerCase()) names.delete(k)
  names.set(name.toLowerCase(), uid)
}
export const uidByName = (name) => names.get(String(name ?? '').toLowerCase()) ?? null

/** profiles satırı: { id, username, avatar, photo_path, photo_hidden } ya da null */
export async function loadProfile(uid) {
  const rows = await supa.select('profiles', `select=id,username,avatar,photo_path,photo_hidden&id=eq.${uid}`)
  return rows[0] ?? null
}
export const saveAvatar = (uid, avatar) => supa.patch('profiles', `id=eq.${uid}`, { avatar })
export const savePhotoPath = (uid, photo_path) => supa.patch('profiles', `id=eq.${uid}`, { photo_path })
