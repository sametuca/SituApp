import { createClient } from '@supabase/supabase-js'

// Değerlerin başındaki/sonundaki boşluk ve tırnaklar atılır (.env.local'da sık yapılan hata).
const clean = (v) => String(v ?? '').trim().replace(/^["']|["']$/g, '')
const supabaseUrl = clean(import.meta.env.VITE_SUPABASE_URL)
const supabaseAnonKey = clean(import.meta.env.VITE_SUPABASE_ANON_KEY)

const validUrl = /^https?:\/\/[^\s/]+/i.test(supabaseUrl)
if (supabaseUrl && !validUrl) console.warn('VITE_SUPABASE_URL geçerli bir http(s) adresi değil; auth DEMO modunda çalışıyor. Örnek: https://xxxx.supabase.co')

// Env değişkenleri yoksa ya da bozuksa createClient hata fırlatır; bu yüzden null döner ve auth demo moduna düşer.
export const isSupabaseConfigured = Boolean(validUrl && supabaseAnonKey)
export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null
