// Yönetici ucu (pre-alpha moderasyon paneli). Anahtar: server/.env → ADMIN_KEY (yoksa uçlar kapalıdır).
//   GET  /api/admin/overview            { reports[], feedback[], mode }      başlık: x-admin-key
//   POST /api/admin/resolve  { id }      şikâyeti çözüldü say (dosya modunda ts, Supabase'de data.resolved)
//   POST /api/admin/hide-photo { uid, hidden }   (Supabase) profiles.photo_hidden
// Şikâyetler: dosya modunda social.json `reports`, Supabase'de `reports` tablosu. Geri bildirimler: server/data/feedback.jsonl.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import * as supa from './supa.js'
import { allReports } from './store.js'

const DIR = process.env.SITUAPP_DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), 'data')
const KEY = process.env.ADMIN_KEY || ''
const fails = new Map()

function authed(req, res) {
  if (!KEY) return res.status(503).json({ ok: false, error: 'Yönetici anahtarı (ADMIN_KEY) ayarlı değil.' }), false
  const ip = String(req.socket.remoteAddress ?? '')
  const f = fails.get(ip) ?? { n: 0, t: 0 }
  if (f.n >= 8 && Date.now() - f.t < 600_000) return res.status(429).json({ ok: false, error: 'Çok fazla hatalı deneme.' }), false
  const got = Buffer.from(String(req.headers['x-admin-key'] ?? ''))
  const want = Buffer.from(KEY)
  const ok = got.length === want.length && crypto.timingSafeEqual(got, want)
  if (!ok) {
    fails.set(ip, { n: f.n + 1, t: Date.now() })
    res.status(401).json({ ok: false, error: 'Geçersiz anahtar.' })
    return false
  }
  fails.delete(ip)
  return true
}

function readFeedback() {
  try {
    return fs
      .readFileSync(path.join(DIR, 'feedback.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .slice(-100)
      .map((l) => JSON.parse(l))
      .reverse()
  } catch {
    return []
  }
}

export async function adminOverview(req, res) {
  if (!authed(req, res)) return
  try {
    const reports = await allReports()
    res.json({ ok: true, mode: supa.enabled ? 'supabase' : 'dosya', reports, feedback: readFeedback() })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}

export async function adminResolve(req, res) {
  if (!authed(req, res)) return
  const id = req.body?.id
  try {
    const { resolveReport } = await import('./store.js')
    await resolveReport(id)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}

export async function adminHidePhoto(req, res) {
  if (!authed(req, res)) return
  const uid = String(req.body?.uid ?? '')
  if (!supa.enabled || !supa.UUID_RE.test(uid)) return res.status(400).json({ ok: false, error: 'Yalnızca Supabase modunda ve geçerli uid ile.' })
  try {
    await supa.patch('profiles', `id=eq.${uid}`, { photo_hidden: req.body?.hidden !== false })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}
