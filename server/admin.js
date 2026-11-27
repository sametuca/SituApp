// Yönetici paneli API uçları (/admin). Giriş: kullanıcı adı + şifre (varsayılan: sametuca / 789522) veya x-admin-key.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import * as supa from './supa.js'
import { allReports, resolveReport } from './store.js'
import * as guard from './guard.js'

const DIR = process.env.SITUAPP_DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), 'data')
const AUTH_FILE = path.join(DIR, 'admin-auth.json')
const KEY = process.env.ADMIN_KEY || ''
const ADMIN_USER = process.env.ADMIN_USER || 'sametuca'
const DEFAULT_PASS = process.env.ADMIN_PASS || '789522'
const TOKEN_TTL_MS = 24 * 3600 * 1000
const fails = new Map()
const sessions = new Map() // token → { user, exp }
let gameBridge = null

export function setGameBridge(g) {
  gameBridge = g
}

function readAdminPass() {
  try {
    const raw = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'))
    if (typeof raw?.password === 'string' && raw.password.length >= 4) return raw.password
  } catch {
    /* ilk çalıştırma: varsayılan şifre */
  }
  return DEFAULT_PASS
}

function writeAdminPass(password) {
  fs.mkdirSync(DIR, { recursive: true })
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ user: ADMIN_USER, password, updatedAt: Date.now() }, null, 2))
}

function safeEq(a, b) {
  const ba = Buffer.from(String(a ?? ''))
  const bb = Buffer.from(String(b ?? ''))
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb)
}

function authed(req, res) {
  const ip = guard.ipOf(req)
  const f = fails.get(ip) ?? { n: 0, t: 0 }
  if (f.n >= 8 && Date.now() - f.t < 600_000) return res.status(429).json({ ok: false, error: 'Çok fazla hatalı deneme.' }), false

  const tok = String(req.headers['x-admin-token'] ?? '')
  if (tok) {
    const s = sessions.get(tok)
    if (s && s.exp > Date.now()) {
      fails.delete(ip)
      return true
    }
    sessions.delete(tok)
  }

  const gotKey = String(req.headers['x-admin-key'] ?? '')
  if (KEY && gotKey && safeEq(gotKey, KEY)) {
    fails.delete(ip)
    return true
  }

  fails.set(ip, { n: f.n + 1, t: Date.now() })
  res.status(401).json({ ok: false, error: 'Oturum geçersiz veya yetkisiz.' })
  return false
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

export function adminLogin(req, res) {
  const ip = guard.ipOf(req)
  const f = fails.get(ip) ?? { n: 0, t: 0 }
  if (f.n >= 8 && Date.now() - f.t < 600_000) return res.status(429).json({ ok: false, error: 'Çok fazla hatalı deneme. Biraz sonra dene.' })

  const username = String(req.body?.username ?? '').trim()
  const password = String(req.body?.password ?? '')
  const ok = safeEq(username, ADMIN_USER) && safeEq(password, readAdminPass())
  if (!ok) {
    fails.set(ip, { n: f.n + 1, t: Date.now() })
    return res.status(401).json({ ok: false, error: 'Kullanıcı adı veya şifre hatalı.' })
  }
  fails.delete(ip)
  const token = crypto.randomBytes(24).toString('hex')
  sessions.set(token, { user: ADMIN_USER, exp: Date.now() + TOKEN_TTL_MS })
  res.json({ ok: true, token, username: ADMIN_USER })
}

export async function adminOverview(req, res) {
  if (!authed(req, res)) return
  try {
    const reports = await allReports()
    const players = gameBridge?.listPlayers?.() ?? []
    const rooms = {}
    for (const p of players) rooms[p.room] = (rooms[p.room] ?? 0) + 1
    res.json({
      ok: true,
      mode: supa.enabled ? 'supabase' : 'dosya',
      adminUser: ADMIN_USER,
      onlineCount: gameBridge?.online?.() ?? players.length,
      uptimeSec: Math.round(process.uptime()),
      memMb: Math.round(process.memoryUsage().rss / 1048576),
      rooms,
      players,
      reports,
      feedback: readFeedback(),
      bans: guard.listBans(),
    })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}

export async function adminResolve(req, res) {
  if (!authed(req, res)) return
  try {
    await resolveReport(req.body?.id)
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

export async function adminBan(req, res) {
  if (!authed(req, res)) return
  const key = req.body?.key ? String(req.body.key).slice(0, 80) : null
  const ip = req.body?.ip ? String(req.body.ip).slice(0, 60) : null
  if (!key && !ip) return res.status(400).json({ ok: false, error: 'Hesap anahtarı ya da IP gerekli.' })
  if (req.body?.unban) {
    guard.unban({ key, ip })
  } else {
    const reason = String(req.body?.reason || 'yönetici kararı').slice(0, 120)
    guard.ban({ key, ip, reason, name: req.body?.name })
    if (key) gameBridge?.kick?.(key, `Hesabın yasaklandı: ${reason}`)
  }
  res.json({ ok: true })
}

export function adminKick(req, res) {
  if (!authed(req, res)) return
  const id = String(req.body?.id ?? '')
  if (!id) return res.status(400).json({ ok: false, error: 'Oyuncu id gerekli.' })
  const n = gameBridge?.kick?.(id, req.body?.reason || 'Yönetici tarafından çıkarıldın.') ?? 0
  res.json({ ok: true, kicked: n })
}

export function adminAnnounce(req, res) {
  if (!authed(req, res)) return
  const text = String(req.body?.text ?? '').trim()
  if (!text) return res.status(400).json({ ok: false, error: 'Duyuru metni boş olamaz.' })
  const count = gameBridge?.announce?.(text) ?? 0
  res.json({ ok: true, count })
}

export function adminReward(req, res) {
  if (!authed(req, res)) return
  const key = String(req.body?.key ?? '').trim()
  if (!key) return res.status(400).json({ ok: false, error: 'Hesap anahtarı gerekli.' })
  const result = gameBridge?.reward?.(key, { coins: req.body?.coins, stars: req.body?.stars })
  res.json({ ok: true, result })
}

export async function adminSetUserPassword(req, res) {
  if (!authed(req, res)) return
  try {
    await supa.setUserPassword(req.body?.uid, req.body?.password)
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message })
  }
}

export function adminChangePassword(req, res) {
  if (!authed(req, res)) return
  const cur = String(req.body?.currentPassword ?? '')
  const next = String(req.body?.newPassword ?? '')
  if (!safeEq(cur, readAdminPass())) return res.status(400).json({ ok: false, error: 'Mevcut yönetici şifresi hatalı.' })
  if (next.length < 4) return res.status(400).json({ ok: false, error: 'Yeni şifre en az 4 karakter olmalı.' })
  writeAdminPass(next)
  res.json({ ok: true })
}
