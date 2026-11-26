// Geri bildirim: POST /api/feedback { kind, text, contact? } → server/data/feedback.jsonl'a eklenir ve SMTP ayarlıysa e-posta atılır.
// Alıcı adresi YALNIZCA ortam değişkenindedir (server/.env → FEEDBACK_TO); depoda/istemcide yoktur, kullanıcıya gösterilmez.
// SMTP (server/.env): SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASS, SMTP_FROM (yoksa SMTP_USER). Yoksa yalnızca dosyaya yazılır.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nodemailer from 'nodemailer'

const DIR = process.env.SITUAPP_DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), 'data')
const FILE = path.join(DIR, 'feedback.jsonl')
const KINDS = { bug: 'Hata', idea: 'Öneri', love: 'Beğendim', other: 'Diğer' }
const hits = new Map() // ip → [zaman damgaları]
const LIMIT = 5 // saatte
let transport = null
const smtpReady = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.FEEDBACK_TO)

function mailer() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  }
  return transport
}

const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n)

export function feedbackHandler(req, res) {
  const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim()
  const now = Date.now()
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000)
  if (list.length >= LIMIT) return res.status(429).json({ ok: false, error: 'Çok sık gönderdin, biraz sonra tekrar dene.' })
  const text = clean(req.body?.text, 1500)
  if (text.length < 5) return res.status(400).json({ ok: false, error: 'Lütfen birkaç kelime yaz.' })
  const kind = KINDS[req.body?.kind] ? req.body.kind : 'other'
  const item = { ts: new Date(now).toISOString(), kind, text, contact: clean(req.body?.contact, 120), who: clean(req.body?.who, 40), page: clean(req.body?.page, 80), ua: clean(req.headers['user-agent'], 160) }
  list.push(now)
  hits.set(ip, list)
  try {
    fs.mkdirSync(DIR, { recursive: true })
    fs.appendFileSync(FILE, JSON.stringify(item) + '\n')
  } catch (e) {
    console.error('Geri bildirim yazılamadı:', e.message)
  }
  if (smtpReady()) {
    mailer()
      .sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: process.env.FEEDBACK_TO,
        subject: `[Plaka82] ${KINDS[kind]} geri bildirimi`,
        text: `${item.text}\n\n— ${item.who || 'misafir'} · ${item.page}${item.contact ? `\nİletişim: ${item.contact}` : ''}\n${item.ts}`,
        replyTo: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.contact) ? item.contact : undefined,
      })
      .catch((e) => console.error('Geri bildirim e-postası gönderilemedi:', e.message))
  }
  res.json({ ok: true })
}
