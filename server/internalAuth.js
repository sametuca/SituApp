// Dahili araç uçlarını (Meshy üretimi, karakter kaydı, asset içe aktarma) korur.
// Bunlar yalnızca Asset Studio için tasarlanmış geliştirici uçlarıdır; üretimde kimliksiz açık kalmamalı.
//
// Anahtar: server/.env → STUDIO_KEY (yoksa ADMIN_KEY). İkisi de tanımlı değilse uçlar KAPALIDIR (503).
// Bilinçli istisna: ALLOW_STUDIO_OPEN=1 → anahtarsız açılır (yalnızca yerel geliştirme için).
// İstemci anahtarı `x-studio-key` başlığıyla gönderir (storefront localStorage'da tutulur).
import crypto from 'node:crypto'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ipOf } from './guard.js'

// index.js'ten önce yüklenir (ESM); .env değerleri burada okunmalı. Var olan ortam değişkenlerini ezmez.
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '.env'), quiet: true })

const KEY = process.env.STUDIO_KEY || process.env.ADMIN_KEY || ''
const OPEN = process.env.ALLOW_STUDIO_OPEN === '1'
const fails = new Map() // ip → { n, t }

export const internalEnabled = Boolean(KEY) || OPEN
export const internalMode = OPEN ? 'open' : KEY ? 'key' : 'disabled'

/** Uç korumalıysa true; değilse yanıtı yazar ve false döner. */
export function requireInternal(req, res) {
  if (OPEN) return true
  if (!KEY) {
    res.status(503).json({ error: 'Dahili araç uçları kapalı. server/.env içine STUDIO_KEY (veya ADMIN_KEY) ekleyin.' })
    return false
  }
  const ip = ipOf(req)
  const f = fails.get(ip) ?? { n: 0, t: 0 }
  if (f.n >= 8 && Date.now() - f.t < 600_000) {
    res.status(429).json({ error: 'Çok fazla hatalı deneme, biraz sonra tekrar deneyin.' })
    return false
  }
  const got = Buffer.from(String(req.headers['x-studio-key'] ?? req.headers['x-admin-key'] ?? ''))
  const want = Buffer.from(KEY)
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) {
    fails.set(ip, { n: f.n + 1, t: Date.now() })
    res.status(401).json({ error: 'Geçersiz studio anahtarı.' })
    return false
  }
  fails.delete(ip)
  return true
}
