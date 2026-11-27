// Kişiselleştirme ortak parçaları: localStorage yardımcıları (look/favori/evcil hayvan teklifi), seçim düğmeleri (ItemButton/Swatches/Pills).
import { emptyLook, sanitizeLook } from '../lookData'
export const OFFER_TTL_MS = 90_000
export const FAV_KEY = 'situapp_fav_looks_v1'
export const SEEN_KEY = 'situapp_wardrobe_seen'

export const chip = 'border-2 border-white shadow-soft'
export const pillBase = 'shrink-0 rounded-full border-2 border-white px-3 py-1.5 text-xs font-extrabold transition active:scale-95'

export function readSavedLook() {
  try {
    const raw = JSON.parse(localStorage.getItem('situapp_avatar'))
    return raw?.look ? sanitizeLook(raw.look) : emptyLook()
  } catch {
    return emptyLook()
  }
}

export function writeSavedLook(look) {
  try {
    const raw = JSON.parse(localStorage.getItem('situapp_avatar'))
    if (raw) localStorage.setItem('situapp_avatar', JSON.stringify({ ...raw, look }))
  } catch {
    /* önemli değil */
  }
}

export function readFavorites() {
  try {
    const arr = JSON.parse(localStorage.getItem(FAV_KEY))
    return Array.isArray(arr) ? arr.slice(0, 3) : [null, null, null]
  } catch {
    return [null, null, null]
  }
}

// Hediye evcil hayvan teklifi bir kez gösterilir: seçildiyse bu tarayıcıda kalıcı, "Şimdi değil" ise oturum boyunca (sunucu verisi sıfırlansa bile tekrar çıkmasın)
export const petOfferKey = (k) => `situapp_pet_offer_done:${k ?? ''}`
export function petOfferDone(k) {
  try {
    return localStorage.getItem(petOfferKey(k)) === '1' || sessionStorage.getItem(petOfferKey(k)) === '1'
  } catch {
    return false
  }
}
export function petOfferMark(k, sessionOnly = false) {
  try {
    ;(sessionOnly ? sessionStorage : localStorage).setItem(petOfferKey(k), '1')
  } catch {
    /* önemli değil */
  }
}

export function ItemButton({ active, emoji, label, lockedLv = 0, onClick }) {
  const locked = lockedLv > 0
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`relative flex min-h-[4.1rem] flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-1 py-1.5 text-center transition ${locked ? 'cursor-not-allowed border-white bg-[#f6f0ff]/65 opacity-60' : active ? 'border-[#a88bff] bg-[#efe6ff] shadow-sm active:scale-95' : 'border-white bg-[#f6f0ff] hover:bg-[#efe6ff] active:scale-95'}`}
    >
      {locked && <span className="absolute right-1 top-1 rounded-full bg-white/90 px-1 text-[0.5rem] font-black text-[#6b4fc0]">🔒 {lockedLv}</span>}
      <span className="text-2xl" aria-hidden>
        {emoji}
      </span>
      <span className="w-full truncate text-[0.625rem] font-extrabold leading-tight text-[#4a3b5c]">{label}</span>
    </button>
  )
}

// ---------- ev düzenleme sekmeleri ----------
export function Swatches({ options, value, onPick, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-xs font-black text-[#4a3b5c]">{label}</span>
      <div className="flex gap-2 overflow-x-auto py-1">
        {options.map((c) => (
          <button
            key={c.id}
            aria-label={c.name}
            aria-pressed={value === c.id}
            onClick={() => onPick(c.id)}
            style={{ background: c.hex }}
            className={`h-9 w-9 shrink-0 rounded-full border-4 shadow-soft transition active:scale-90 ${value === c.id ? 'border-[#4a3b5c]' : 'border-white'}`}
          />
        ))}
      </div>
    </div>
  )
}

export function Pills({ options, value, onPick, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-xs font-black text-[#4a3b5c]">{label}</span>
      <div className="flex gap-1.5 overflow-x-auto py-1">
        {options.map((o) => (
          <button key={o.id} onClick={() => onPick(o.id)} aria-pressed={value === o.id} className={`${pillBase} ${value === o.id ? 'bg-[#a88bff] text-white' : 'bg-white/80 text-[#4a3b5c]'}`}>
            {o.emoji} {o.name}
          </button>
        ))}
      </div>
    </div>
  )
}
