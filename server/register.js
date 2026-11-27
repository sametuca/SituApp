// POST /api/register: kullanıcı adı + şifre ile sunucu tarafı kayıt (e-posta doğrulamasız).
import { createHash } from 'node:crypto'
import { ipOf } from './guard.js'
import * as supa from './supa.js'

const USERNAME_RE = /^[A-Za-z0-9_çğıöşüÇĞİÖŞÜ-]+$/
const AVATARS = new Set(['zeynep', 'deniz', 'elif', 'kaan', 'mira', 'ege'])
const WINDOW_MS = 60 * 60 * 1000
const LIMIT = 5
const attempts = new Map()

const accountEmail = (username) => {
  const digest = createHash('sha256').update(username.trim().toLowerCase()).digest('hex').slice(0, 24)
  return `rastla-${digest}@example.com`
}

function limited(ip, now) {
  const recent = (attempts.get(ip) ?? []).filter((at) => now - at < WINDOW_MS)
  if (recent.length >= LIMIT) return true
  recent.push(now)
  attempts.set(ip, recent)
  if (attempts.size > 10000) {
    for (const [key, values] of attempts) {
      if (!values.some((at) => now - at < WINDOW_MS)) attempts.delete(key)
    }
  }
  return false
}

export async function registerHandler(req, res) {
  const username = String(req.body?.username ?? '').trim()
  const password = String(req.body?.password ?? '')
  const avatar = String(req.body?.avatar ?? '')

  if (username.length < 3 || username.length > 16 || !USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Kullanıcı adı 3-16 karakter olmalı; harf, rakam, tire ve alt çizgi kullan.' })
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Şifre 8-128 karakter olmalı.' })
  }
  if (!supa.enabled) {
    return res.status(503).json({ error: 'Hesap servisi hazır değil. Sunucuda Supabase ayarlarını kontrol edin.' })
  }

  const ip = ipOf(req)
  const now = Date.now()
  if (limited(ip, now)) {
    return res.status(429).json({ error: 'Bu ağdan çok fazla hesap açıldı. Bir süre sonra tekrar dene.' })
  }

  try {
    const available = await supa.rpc('username_available', { p_name: username })
    if (available === false) return res.status(409).json({ error: 'Bu kullanıcı adı alınmış.' })

    await supa.createConfirmedAuthUser({
      email: accountEmail(username),
      password,
      metadata: { username, avatar: AVATARS.has(avatar) ? avatar : 'zeynep' },
    })
    return res.status(201).json({ ok: true })
  } catch (error) {
    if (error.code === 'email_exists' || error.code === 'user_already_exists') {
      return res.status(409).json({ error: 'Bu kullanıcı adı alınmış.' })
    }
    if (error.code === 'supabase_not_configured') {
      return res.status(503).json({ error: 'Hesap servisi hazır değil. Sunucuda Supabase ayarlarını kontrol edin.' })
    }
    console.error('Supabase kayıt isteği başarısız:', { status: error.status ?? null, code: error.code ?? 'unknown' })
    return res.status(502).json({ error: 'Hesap oluşturulamadı. Biraz sonra tekrar dene.' })
  }
}
