// Supabase için küçük, fetch tabanlı REST istemcisi (bağımlılıksız) + write-behind yardımcıları.
// Ortam: SUPABASE_URL, SUPABASE_SERVICE_KEY (yalnızca sunucuda; asla istemciye/depoya yazma), SUPABASE_PUBLISHABLE_KEY.
// URL ve servis anahtarı yoksa `enabled` false olur ve sunucu eski dosya tabanlı/ad tabanlı modda çalışır (demo).
//
// Anahtar biçimi: legacy JWT (`eyJ…`) hem `apikey` hem `Authorization: Bearer` ile gönderilir; yeni `sb_secret_…`
// biçimi (ya da yer tutucu) yalnızca `apikey` ile gönderilir (JWT olmadığı için Bearer'a konmaz).
import crypto from 'node:crypto'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// index.js'ten önce yüklenir (ESM); .env değerleri burada okunmalı. Var olan ortam değişkenlerini ezmez.
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '.env'), quiet: true })
export const URL_BASE = (process.env.SUPABASE_URL || '').replace(/\/+$/, '')
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || ''
export const enabled = Boolean(URL_BASE && SERVICE_KEY)
export const allowGuest = !enabled || process.env.ALLOW_GUEST === '1'

const keyHeaders = (key) => (key.startsWith('eyJ') ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key })
const svcHeaders = () => keyHeaders(SERVICE_KEY)

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const PHOTO_BUCKET = 'profile-photos'
export const photoUrl = (path) => (enabled && path ? `${URL_BASE}/storage/v1/object/public/${PHOTO_BUCKET}/${path}` : null)

async function call(method, pathAndQuery, { body, headers, timeout = 10000 } = {}) {
  const res = await fetch(`${URL_BASE}${pathAndQuery}`, {
    method,
    headers: { ...svcHeaders(), 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Supabase ${method} ${pathAndQuery.split('?')[0]} → ${res.status} ${text.slice(0, 200)}`)
  }
  if (res.status === 204) return null
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

/** GET /rest/v1/<table>?<query> — tüm sayfaları (1000'lik) birleştirir. */
export async function select(table, query = 'select=*') {
  const out = []
  for (let from = 0; ; from += 1000) {
    const page = await call('GET', `/rest/v1/${table}?${query}`, { headers: { Range: `${from}-${from + 999}`, 'Range-Unit': 'items' } })
    out.push(...page)
    if (page.length < 1000) return out
  }
}
/** Toplu upsert (onConflict: birincil anahtar sütunu). */
export const upsert = (table, rows, onConflict) =>
  call('POST', `/rest/v1/${table}?on_conflict=${onConflict}`, { body: rows, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, timeout: 20000 })
export const insert = (table, rows) => call('POST', `/rest/v1/${table}`, { body: rows, headers: { Prefer: 'return=minimal' } })
export const patch = (table, filter, values) => call('PATCH', `/rest/v1/${table}?${filter}`, { body: values, headers: { Prefer: 'return=minimal' } })
export const del = (table, filter) => call('DELETE', `/rest/v1/${table}?${filter}`)
export const rpc = (fn, args = {}) => call('POST', `/rest/v1/rpc/${fn}`, { body: args })

/** Admin API ile doğrulanmış kullanıcı açar; bu işlem doğrulama e-postası göndermez. */
export async function createConfirmedAuthUser({ email, password, metadata }) {
  if (!enabled) {
    const error = new Error('Supabase sunucu kimlik bilgileri yapılandırılmamış.')
    error.code = 'supabase_not_configured'
    throw error
  }
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { ...svcHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: metadata }),
    signal: AbortSignal.timeout(10000),
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    const error = new Error('Supabase kullanıcı oluşturma isteği başarısız.')
    error.status = res.status
    error.code = data?.code ?? data?.error_code ?? 'auth_user_create_failed'
    throw error
  }
  return data
}

/** Admin API ile kullanıcının şifresini günceller. */
export async function setUserPassword(uid, password) {
  if (!enabled) throw new Error('Supabase modu aktif değil.')
  if (!UUID_RE.test(String(uid ?? ''))) throw new Error('Geçersiz kullanıcı UID.')
  if (typeof password !== 'string' || password.length < 6) throw new Error('Şifre en az 6 karakter olmalı.')
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users/${uid}`, {
    method: 'PUT',
    headers: { ...svcHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error('Şifre güncellenemedi.')
  return true
}

// ---- Auth: token doğrulama (kısa süreli önbellek) ----
const tokenCache = new Map() // token → { user, exp }
const TOKEN_TTL_MS = 60_000

// Asimetrik imzalı (ES256/RS256) access token'lar projenin herkese açık JWKS anahtarıyla YEREL doğrulanır
// (ağ isteği yok; dolaşımdaki anahtar bir kez indirilir). HS256 (legacy) tokenlar için Auth sunucusuna sorulur.
let jwks = { keys: new Map(), at: 0 }
async function jwkFor(kid) {
  if (!jwks.keys.has(kid) && Date.now() - jwks.at > 60_000) {
    jwks.at = Date.now()
    const res = await fetch(`${URL_BASE}/auth/v1/.well-known/jwks.json`, { signal: AbortSignal.timeout(8000) })
    if (res.ok) jwks.keys = new Map((await res.json()).keys.map((k) => [k.kid, k]))
  }
  return jwks.keys.get(kid) ?? null
}
async function verifyLocal(token, header) {
  const [h, p, sig] = token.split('.')
  if (!sig) return null
  const jwk = await jwkFor(header.kid)
  if (!jwk) return null
  const key = crypto.createPublicKey({ key: jwk, format: 'jwk' })
  const ok =
    header.alg === 'ES256'
      ? crypto.verify('sha256', Buffer.from(`${h}.${p}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url'))
      : crypto.verify('sha256', Buffer.from(`${h}.${p}`), key, Buffer.from(sig, 'base64url'))
  if (!ok) return null
  const c = JSON.parse(Buffer.from(p, 'base64url').toString())
  if (!c.sub || !UUID_RE.test(c.sub) || c.aud !== 'authenticated' || !(c.exp * 1000 > Date.now()) || !String(c.iss).startsWith(URL_BASE)) return null
  return { id: c.sub.toLowerCase(), email: c.email ?? '' }
}

/** Geçerliyse { id, email } döner, değilse null. */
export async function verifyToken(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) return null
  const hit = tokenCache.get(token)
  if (hit && hit.exp > Date.now()) return hit.user
  try {
    const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString())
    if (header.alg === 'ES256' || header.alg === 'RS256') {
      const user = await verifyLocal(token, header)
      if (user) tokenCache.set(token, { user, exp: Date.now() + TOKEN_TTL_MS })
      return user
    }
  } catch {
    return null
  }
  try {
    // Kullanıcının kendi token'ı Authorization'da; apikey olarak herkese açık anahtar (yoksa servis anahtarı)
    const res = await fetch(`${URL_BASE}/auth/v1/user`, {
      headers: { ...(PUBLISHABLE_KEY ? { apikey: PUBLISHABLE_KEY } : { apikey: SERVICE_KEY }), Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const u = await res.json()
    if (!u?.id || !UUID_RE.test(u.id)) return null
    const user = { id: u.id.toLowerCase(), email: u.email ?? '' }
    tokenCache.set(token, { user, exp: Date.now() + TOKEN_TTL_MS })
    if (tokenCache.size > 500) for (const [k, v] of tokenCache) if (v.exp < Date.now()) tokenCache.delete(k)
    return user
  } catch {
    return null
  }
}

/** Storage nesnesi gerçekten var mı? (herkese açık kova: HEAD). */
export async function objectExists(path) {
  try {
    const res = await fetch(photoUrl(path), { method: 'HEAD', signal: AbortSignal.timeout(8000) })
    return res.ok
  } catch {
    return false
  }
}

// ---- write-behind aynası ----
const mirrors = []
/**
 * Bellekteki bir kayıt kümesini (anahtar → nesne) satırlara yansıtır. `touch()` çağrılınca 800 ms sonra
 * yalnızca değişen kayıtlar (JSON anlık görüntüsü farkıyla) toplu upsert edilir; hata olursa üstel geri çekilmeyle tekrar dener.
 * Yalnızca UUID anahtarlar yazılır (ALLOW_GUEST ile gelen ad tabanlı misafirler kalıcı değildir).
 */
export function createMirror({ table, getAll, toRow, label }) {
  const snap = new Map() // anahtar → son yazılan JSON
  let timer = null
  let busy = null
  let fails = 0
  const m = {
    /** Başlangıç: satırları yükle; snapshot'ı doldur. */
    prime(rows, keyOf, dataOf) {
      for (const r of rows) snap.set(keyOf(r), JSON.stringify(dataOf(r)))
    },
    // Kısıtlama (throttle): sürekli aktivite olsa bile en geç `delay` ms sonra yazar (eskiden debounce'tu: 500 oyuncuda hiç yazılmazdı).
    touch(delay = 5000) {
      if (!enabled || timer) return
      timer = setTimeout(() => void m.flush(), delay)
    },
    async flush() {
      clearTimeout(timer)
      timer = null
      if (busy) await busy.catch(() => {})
      const dirty = []
      for (const [k, v] of Object.entries(getAll())) {
        if (!UUID_RE.test(k)) continue
        const json = JSON.stringify(v)
        if (snap.get(k) !== json) dirty.push([k, json, v])
      }
      if (!dirty.length) return
      busy = (async () => {
        try {
          for (let i = 0; i < dirty.length; i += 200) {
            const part = dirty.slice(i, i + 200)
            await upsert(table, part.map(([k, , v]) => toRow(k, v)), 'uid')
            for (const [k, json] of part) snap.set(k, json)
          }
          fails = 0
        } catch (e) {
          fails += 1
          const wait = Math.min(60_000, 1000 * 2 ** fails)
          console.error(`${label ?? table} yazılamadı (${wait} ms sonra tekrar): ${e.message}`)
          timer = setTimeout(() => void m.flush(), wait)
        }
      })()
      await busy
    },
  }
  mirrors.push(m)
  return m
}

/** Süreç kapanırken bekleyen yazmaları boşalt. */
export async function flushAll() {
  await Promise.all(mirrors.map((m) => m.flush().catch(() => {})))
}
let hooked = false
export function hookShutdown() {
  if (hooked) return
  hooked = true
  const stop = async () => {
    await flushAll()
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}
