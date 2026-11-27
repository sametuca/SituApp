// KVKK / kullanım şartları onay kaydı: POST /api/consent { version, items: ['terms','kvkk','transfer'], ref } → server/data/consents.jsonl
// Kayıt: zaman damgası, IP, tarayıcı, metin sürümü, onaylanan maddeler ve e-postanın SHA-256 özeti (ref; ham e-posta saklanmaz).
// Asıl onay kaydı hesabın user_metadata.consent alanındadır; bu dosya IP'li, sunucu zamanlı ikinci kanıttır (hesap sahibi değiştiremez).
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ipOf } from './guard.js'
import * as supa from './supa.js'

const DIR = process.env.SITUAPP_DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), 'data')
const FILE = path.join(DIR, 'consents.jsonl')
const ITEMS = ['terms', 'kvkk', 'transfer']
const hits = new Map()
const LIMIT = 20 // saatte IP başına

const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n)

export async function consentHandler(req, res) {
  const authorization = String(req.headers.authorization ?? '')
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  const identity = await supa.verifyToken(token)
  if (!identity) return res.status(401).json({ ok: false, error: 'Geçerli oturum gerekli.' })

  const ip = ipOf(req)
  const now = Date.now()
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000)
  if (list.length >= LIMIT) return res.status(429).json({ ok: false })
  const version = clean(req.body?.version, 32)
  const items = Array.isArray(req.body?.items) ? [...new Set(req.body.items.filter((i) => ITEMS.includes(i)))].sort() : []
  if (!version || items.length !== ITEMS.length || ITEMS.some((item) => !items.includes(item))) {
    return res.status(400).json({ ok: false, error: 'Tüm zorunlu onaylar gereklidir.' })
  }
  list.push(now)
  hits.set(ip, list)
  try {
    fs.mkdirSync(DIR, { recursive: true })
    const ref = identity.email ? createHash('sha256').update(identity.email.trim().toLowerCase()).digest('hex') : ''
    fs.appendFileSync(FILE, JSON.stringify({ at: new Date(now).toISOString(), ip, ua: clean(req.headers['user-agent'], 200), version, items, uid: identity.id, ref }) + '\n')
  } catch (e) {
    console.error('Onay kaydı yazılamadı:', e.message)
    return res.status(500).json({ ok: false, error: 'Onay kaydı yazılamadı.' })
  }
  res.json({ ok: true })
}
