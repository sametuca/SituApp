// KVKK / kullanım şartları onay kaydı: POST /api/consent { version, items: ['terms','kvkk','transfer'], ref } → server/data/consents.jsonl
// Kayıt: zaman damgası, IP, tarayıcı, metin sürümü, onaylanan maddeler ve e-postanın SHA-256 özeti (ref; ham e-posta saklanmaz).
// Asıl onay kaydı hesabın user_metadata.consent alanındadır; bu dosya IP'li, sunucu zamanlı ikinci kanıttır (hesap sahibi değiştiremez).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ipOf } from './guard.js'

const DIR = process.env.SITUAPP_DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), 'data')
const FILE = path.join(DIR, 'consents.jsonl')
const ITEMS = ['terms', 'kvkk', 'transfer']
const hits = new Map()
const LIMIT = 20 // saatte IP başına

const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n)

export function consentHandler(req, res) {
  const ip = ipOf(req)
  const now = Date.now()
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000)
  if (list.length >= LIMIT) return res.status(429).json({ ok: false })
  const version = clean(req.body?.version, 32)
  const items = Array.isArray(req.body?.items) ? req.body.items.filter((i) => ITEMS.includes(i)) : []
  const ref = /^[0-9a-f]{64}$/.test(String(req.body?.ref ?? '')) ? req.body.ref : ''
  if (!version || items.length === 0) return res.status(400).json({ ok: false })
  list.push(now)
  hits.set(ip, list)
  try {
    fs.mkdirSync(DIR, { recursive: true })
    fs.appendFileSync(FILE, JSON.stringify({ at: new Date(now).toISOString(), ip, ua: clean(req.headers['user-agent'], 200), version, items, ref }) + '\n')
  } catch (e) {
    console.error('Onay kaydı yazılamadı:', e.message)
  }
  res.json({ ok: true })
}
