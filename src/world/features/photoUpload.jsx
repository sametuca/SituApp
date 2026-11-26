// Profil fotoğrafı yükleme: kare kırpma + 512×512 küçültme + JPEG sıkıştırma (tarayıcıda), Supabase Storage'a
// kullanıcının kendi oturumuyla yükleme, sonra sunucuya { t:'profile_photo', path } (sunucu varlığını doğrular).
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePhoto } from '../photoStore'
import Portrait from '../Portrait'

const BUCKET = 'profile-photos'
const SIZE = 512
const MAX_BYTES = 150 * 1024
const MAX_INPUT = 15 * 1024 * 1024

async function decode(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve(img)
      }
      img.onerror = () => reject(new Error('decode'))
      img.src = url
    })
  }
}

/** Merkezden kare kırpar, 512×512'ye küçültür, ≤ ~150 KB JPEG blob döner. */
export async function prepareSquareJpeg(file) {
  const img = await decode(file)
  const w = img.width ?? img.naturalWidth
  const h = img.height ?? img.naturalHeight
  const side = Math.min(w, h)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, SIZE, SIZE)
  img.close?.()
  let blob = null
  for (const q of [0.85, 0.75, 0.65, 0.55]) {
    blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', q))
    if (blob && blob.size <= MAX_BYTES) break
  }
  if (!blob) throw new Error('encode')
  return blob
}

const pathOf = (url) => (url && url.includes(`/${BUCKET}/`) ? decodeURIComponent(url.split(`/${BUCKET}/`)[1].split('?')[0]) : null)

export function PhotoSection({ net, enabled, privacy, setPrivacy }) {
  const ownKey = net.homeKey
  const current = usePhoto(ownKey)
  const [draft, setDraft] = useState(null) // { blob, url }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)
  const camRef = useRef(null)

  useEffect(() => () => draft && URL.revokeObjectURL(draft.url), [draft])

  if (!enabled || !supabase) {
    return (
      <div className="rounded-2xl bg-[#faf6ff] p-3 text-xs font-bold text-[#8a7a9c]">📷 Profil fotoğrafı için hesap gerekli (demo modunda kullanılamaz).</div>
    )
  }

  const pick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    if (!/^image\//.test(file.type) || file.size > MAX_INPUT) return setError('Lütfen 15 MB’tan küçük bir görsel seç.')
    try {
      const blob = await prepareSquareJpeg(file)
      setDraft({ blob, url: URL.createObjectURL(blob) })
    } catch {
      setError('Bu görsel açılamadı, başka bir tane dene.')
    }
  }

  // sunucunun cevabını bekle ({ t:'profile_photo', ok })
  const ask = (path) =>
    new Promise((resolve) => {
      const off = net.on('profile_photo', (m) => {
        off()
        clearTimeout(timer)
        resolve(m)
      })
      const timer = setTimeout(() => {
        off()
        resolve({ ok: false })
      }, 8000)
      if (!net.send({ t: 'profile_photo', path })) {
        off()
        clearTimeout(timer)
        resolve({ ok: false })
      }
    })

  const dropOld = (url) => {
    const old = pathOf(url)
    if (old) supabase.storage.from(BUCKET).remove([old]).catch(() => {})
  }

  const upload = async () => {
    if (!draft || busy) return
    setBusy(true)
    setError('')
    const previous = current
    try {
      const { data } = await supabase.auth.getSession()
      const uid = data.session?.user?.id
      if (!uid) throw new Error('oturum')
      const path = `${uid}/${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, draft.blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
      if (upErr) throw upErr
      const res = await ask(path)
      if (!res.ok) {
        supabase.storage.from(BUCKET).remove([path]).catch(() => {})
        throw new Error('sunucu')
      }
      dropOld(previous)
      setDraft(null)
    } catch {
      setError('Fotoğraf yüklenemedi. Biraz sonra tekrar dene.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    const previous = current
    const res = await ask(null)
    if (res.ok) dropOld(previous)
    else setError('Fotoğraf kaldırılamadı.')
    setBusy(false)
  }

  const btn = 'rounded-2xl px-3 py-2 text-sm font-extrabold active:scale-95 disabled:opacity-50'
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-[#faf6ff] p-3">
      <div className="flex items-center gap-3">
        {draft ? (
          <img src={draft.url} alt="Seçtiğin fotoğrafın önizlemesi" width="80" height="80" className="h-20 w-20 shrink-0 rounded-full border-4 border-[#fec986] object-cover" />
        ) : (
          <Portrait peer={{ key: ownKey, avatar: 'zeynep' }} size={80} className="h-20 w-20 !border-4" alt="Profil fotoğrafın" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-[#4a3b5c]">📷 Profil fotoğrafı</p>
          <p className="text-[0.6875rem] font-semibold text-[#8a7a9c]">Kare kırpılır, küçültülür. Yüzün net olduğu, size ait bir fotoğraf seç.</p>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} data-testid="photo-file" />
      <input ref={camRef} type="file" accept="image/*" capture="user" className="hidden" onChange={pick} />
      {draft ? (
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={upload} className={`${btn} flex-1 bg-[#fdb252] text-white`}>
            {busy ? 'Yükleniyor…' : '✅ Bu fotoğrafı kullan'}
          </button>
          <button type="button" disabled={busy} onClick={() => setDraft(null)} className={`${btn} text-[#8a7a9c] hover:bg-[#ffedd6]/60`}>
            Vazgeç
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className={`${btn} bg-[#fff2e3] text-[#926021]`}>
            {current ? 'Fotoğrafı değiştir' : '📷 Fotoğraf ekle'}
          </button>
          <button type="button" disabled={busy} onClick={() => camRef.current?.click()} className={`${btn} bg-[#e6f4ff] text-[#1f5d7a] sm:hidden`}>
            🤳 Kamera
          </button>
          {current && (
            <button type="button" disabled={busy} onClick={remove} className={`${btn} text-[#8a7a9c] hover:bg-[#ffedd6]/60`}>
              🗑️ Kaldır
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs font-bold text-rose-400">
          {error}
        </p>
      )}
      <div>
        <p className="text-xs font-black text-[#4a3b5c]">Fotoğrafımı kimler görsün?</p>
        <div className="mt-1 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Fotoğraf gizliliği">
          {[
            ['all', '🌍 Herkes'],
            ['friends', '💗 Yalnızca arkadaşlarım'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={privacy === id}
              onClick={() => {
                setPrivacy(id)
                net.send({ t: 'photo_privacy', who: id })
              }}
              className={`rounded-2xl border-2 px-2 py-2 text-xs font-extrabold ${privacy === id ? 'border-[#fdb252] bg-[#ffead0] text-[#926021]' : 'border-white bg-white text-[#5b4a70]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
