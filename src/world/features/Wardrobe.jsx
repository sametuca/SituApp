// Gardırop paneli (aksesuar, evcil hayvan, saç/göz/kıyafet rengi) ve evcil hayvan sahiplenme penceresi.
import { useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import LookPicker from '../../components/LookPicker'
import { ToyButton } from '../../components/ui'
import { Modal } from '../Hud'
import { cosStore } from '../cosStore'
import { EYE_LEVELS, HAIR_LEVELS, OUTFIT_LEVELS, OUTFIT_PRESETS, emptyLook, sameLook, sanitizeLook } from '../lookData'
import { ACCESSORIES, PASTELS, PETS, PET_RENEW_PRICE, STYLE_ACCESSORIES } from '../cosmeticsData'
import { FAV_KEY, ItemButton, readFavorites, readSavedLook } from './cosmeticsShared'
import { DevCam, PreviewStage } from './WardrobePreview'
export function PetAdopt({ onPick, onLater }) {
  return (
    <Modal onClose={onLater} label="Evcil hayvan seç">
      <div className="text-center">
        <h2 className="text-2xl font-black text-[#4a3b5c]">Bir dost seç 🐾</h2>
        <p className="mt-1 text-sm font-semibold text-[#8a7a9c]">Hoş geldin hediyesi: yeni arkadaşın 1 hafta boyunca seninle gezer. Sonra Gardırop’tan yenileyebilirsin.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {PETS.filter((p) => p.id === 'cat' || p.id === 'dog').map((p) => (
            <button key={p.id} onClick={() => onPick(p.id)} className="rounded-3xl border-2 border-white bg-gradient-to-b from-[#f3f0fa] to-white p-4 shadow-soft transition active:scale-95 hover:-translate-y-0.5">
              <div className="grid h-20 place-items-center text-6xl">{p.emoji}</div>
              <p className="mt-1 text-base font-black text-[#4a3b5c]">{p.name}</p>
              <p className="text-[0.6875rem] font-bold text-[#8a7a9c]">1 hafta ücretsiz</p>
            </button>
          ))}
        </div>
        <button onClick={onLater} className="mt-4 text-xs font-extrabold text-[#8a7a9c] hover:underline">
          Şimdi değil
        </button>
      </div>
    </Modal>
  )
}

export function Wardrobe({ slug, cos, petUntil, coins, playerLv = 1, xp = 0, onLocked, onRenew, onSave, onClose }) {
  const initialLook = useMemo(() => sanitizeLook(cos?.look ?? readSavedLook(), playerLv), [cos?.look, playerLv])
  const [acc, setAcc] = useState(cos?.acc ?? null)
  const [acc2, setAcc2] = useState(cos?.acc2 ?? null)
  const [pet, setPet] = useState(cos?.pet ?? null)
  const [look, setLook] = useState(initialLook)
  const [tab, setTab] = useState('presets') // presets | look | acc | pet
  const [colorSlot, setColorSlot] = useState('acc') // acc | acc2
  const [color1, setColor1] = useState(cos?.acc?.color ?? 'pink')
  const [color2, setColor2] = useState(cos?.acc2?.color ?? 'pearl')
  const [poseMode, setPoseMode] = useState('idle') // idle | walk | dance
  const [zoomMode, setZoomMode] = useState('full') // full | close
  const [favs, setFavs] = useState(readFavorites)
  const petLeft = Math.max(0, Math.ceil((petUntil - Date.now()) / 3600000)) // kalan saat

  useEffect(() => {
    cosStore.set('preview', { acc, acc2, pet, look })
  }, [acc, acc2, pet, look])
  useEffect(() => () => cosStore.set('preview', null), [])

  const pickAcc = (id) => {
    setColorSlot('acc')
    setAcc(id ? { id, color: color1 } : null)
  }
  const pickAcc2 = (id) => {
    setColorSlot('acc2')
    setAcc2(id ? { id, color: color2 } : null)
  }
  const activeColor = colorSlot === 'acc2' ? color2 : color1
  const pickColor = (c) => {
    if (colorSlot === 'acc2') {
      setColor2(c)
      if (acc2) setAcc2({ ...acc2, color: c })
    } else {
      setColor1(c)
      if (acc) setAcc({ ...acc, color: c })
    }
  }

  const applyPreset = (p) => {
    setLook(sanitizeLook(p.look, playerLv))
    if (p.acc) {
      setColor1(p.acc.color)
      setAcc(p.acc)
    } else setAcc(null)
    if (p.acc2) {
      setColor2(p.acc2.color)
      setAcc2(p.acc2)
    } else setAcc2(null)
    window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
  }

  const randomize = () => {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
    const openColors = PASTELS.filter((c) => (c.lv ?? 1) <= playerLv)
    const openAcc = ACCESSORIES.filter((a) => (a.lv ?? 1) <= playerLv)
    const openAcc2 = STYLE_ACCESSORIES.filter((a) => (a.lv ?? 1) <= playerLv)
    const openIdx = (levels) => levels.map((lv, i) => (lv <= playerLv ? i : -1)).filter((i) => i >= 0)
    const c1 = pick(openColors).id
    const c2 = pick(openColors).id
    const a1 = pick(openAcc).id
    const a2 = openAcc2.length && Math.random() > 0.25 ? pick(openAcc2).id : null
    setLook({ h: pick(openIdx(HAIR_LEVELS)), e: pick(openIdx(EYE_LEVELS)), o: pick(openIdx(OUTFIT_LEVELS)) })
    setColor1(c1)
    setColor2(c2)
    setAcc({ id: a1, color: c1 })
    setAcc2(a2 ? { id: a2, color: c2 } : null)
    window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
  }

  const resetAll = () => {
    setLook(emptyLook())
    setAcc(null)
    setAcc2(null)
  }

  const saveFav = (idx) => {
    const next = [...favs]
    next[idx] = { name: `Kombin ${idx + 1}`, look, acc, acc2 }
    setFavs(next)
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(next))
    } catch {
      /* önemli değil */
    }
    window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'collect' }))
  }

  const clearFav = (idx, e) => {
    e.stopPropagation()
    const next = [...favs]
    next[idx] = null
    setFavs(next)
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(next))
    } catch {
      /* önemli değil */
    }
  }

  return (
    <Modal onClose={onClose} label="Gardırop" wide hideClose>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-[#4a3b5c]">Stüdyo & Gardırop</h2>
            <span className="rounded-full bg-[#efe6ff] px-2.5 py-0.5 text-xs font-black text-[#6b4fc0]">Sv. {playerLv} · ⭐ {xp}</span>
          </div>
          <p className="text-xs font-bold text-[#8a7a9c]">Yıldız toplayıp seviye atlayarak yeni stiller ve aksesuarlar aç</p>
        </div>
        <button onClick={onClose} aria-label="Gardırobu kapat" className="grid h-9 w-9 place-items-center rounded-full bg-[#f6f0ff] text-sm font-black text-[#8a7a9c] hover:bg-[#ffedd6]/70">
          ✖️
        </button>
      </div>

      {/* 3D stüdyo önizleme */}
      <div className="relative mt-3 h-56 overflow-hidden rounded-3xl border-2 border-white bg-gradient-to-b from-[#fff2e3] via-[#f1e6ff] to-[#dff3ff] shadow-soft sm:h-60">
        <Canvas camera={{ position: [0, 1.02, 2.75], fov: 32 }} dpr={[1, 2]}>
          {import.meta.env.DEV && <DevCam />}
          <PreviewStage slug={slug} poseMode={poseMode} zoomMode={zoomMode} />
        </Canvas>
        {/* sol üst: yakınlaşma */}
        <button
          type="button"
          onClick={() => setZoomMode((z) => (z === 'full' ? 'close' : 'full'))}
          className="absolute left-2.5 top-2.5 rounded-full border border-white bg-white/85 px-2.5 py-1 text-[0.6875rem] font-black text-[#4a3b5c] shadow-sm backdrop-blur-sm transition hover:bg-white active:scale-95"
        >
          {zoomMode === 'full' ? '🔍 Yakınlaş' : '🧍 Tam Boy'}
        </button>
        {/* sağ üst: sürpriz + sıfırla */}
        <div className="absolute right-2.5 top-2.5 flex gap-1.5">
          <button
            type="button"
            onClick={randomize}
            title="Sürpriz kombin yap"
            className="rounded-full border border-white bg-white/85 px-2.5 py-1 text-[0.6875rem] font-black text-[#6b4fc0] shadow-sm backdrop-blur-sm transition hover:bg-white active:scale-95"
          >
            🎲 Sürpriz
          </button>
          <button
            type="button"
            onClick={resetAll}
            title="Görünümü sıfırla"
            className="grid h-7 w-7 place-items-center rounded-full border border-white bg-white/85 text-sm shadow-sm backdrop-blur-sm transition hover:bg-white active:scale-95"
          >
            🎨
          </button>
        </div>
        {/* sol alt: duruş seçici */}
        <div className="absolute bottom-2.5 left-2.5 flex gap-1 rounded-full border border-white bg-white/80 p-0.5 shadow-sm backdrop-blur-sm">
          {[
            ['idle', '🧍'],
            ['walk', '🚶'],
            ['dance', '💃'],
          ].map(([k, ico]) => (
            <button
              key={k}
              type="button"
              onClick={() => setPoseMode(k)}
              aria-pressed={poseMode === k}
              title={k === 'idle' ? 'Duruş' : k === 'walk' ? 'Yürüyüş' : 'Dans'}
              className={`grid h-7 w-7 place-items-center rounded-full text-sm transition active:scale-90 ${poseMode === k ? 'bg-[#a88bff] text-white shadow-sm' : 'text-[#4a3b5c] hover:bg-white'}`}
            >
              {ico}
            </button>
          ))}
        </div>
      </div>

      {/* sekmeler */}
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {[
          ['presets', '✨ Kombin'],
          ['look', '🎨 Saç·Kıyafet'],
          ['acc', '👑 Aksesuar'],
          ['pet', '🐾 Dostum'],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-2xl border-2 border-white px-1.5 py-2 text-[0.6875rem] font-extrabold transition active:scale-95 sm:text-xs ${tab === k ? 'bg-[#a88bff] text-white shadow-soft' : 'bg-[#f6f0ff] text-[#4a3b5c] hover:bg-[#efe6ff]'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* sekme içeriği */}
      <div className="mt-3 max-h-[34svh] overflow-y-auto pr-0.5">
        {tab === 'presets' && (
          <div className="flex flex-col gap-3">
            <div>
              <p className="mb-1.5 text-[0.6875rem] font-black uppercase tracking-wide text-[#8a7a9c]">💖 Favori Kombinlerim (Kaydet & Tek Tıkla Giy)</p>
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => {
                  const slotLv = i + 1
                  const slotLocked = slotLv > playerLv
                  const f = favs[i]
                  if (slotLocked) {
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onLocked?.(slotLv)}
                        className="flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-dashed border-[#e5dcfa] bg-[#faf6ff]/60 px-2 py-2.5 text-center opacity-60 transition"
                      >
                        <span className="text-base">🔒</span>
                        <span className="text-[0.6875rem] font-extrabold text-[#8a7a9c]">Slot {i + 1} · Sv. {slotLv}</span>
                      </button>
                    )
                  }
                  return f ? (
                    <div key={i} className="relative">
                      <button
                        type="button"
                        onClick={() => applyPreset(f)}
                        className="flex w-full flex-col items-center gap-0.5 rounded-2xl border-2 border-white bg-gradient-to-b from-[#fff6eb] to-white px-2 py-2 text-center shadow-soft transition hover:border-[#fdb252] active:scale-95"
                      >
                        <span className="text-lg">👗</span>
                        <span className="text-[0.6875rem] font-black text-[#4a3b5c]">{f.name}</span>
                        <span className="text-[0.625rem] font-bold text-[#fdb252]">Giy</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => clearFav(i, e)}
                        aria-label={`${f.name} sil`}
                        className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-white/90 text-[0.625rem] hover:scale-110"
                      >
                        ✖️
                      </button>
                    </div>
                  ) : (
                    <button
                      key={i}
                      type="button"
                      onClick={() => saveFav(i)}
                      className="flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-dashed border-[#d6c7ff] bg-[#faf6ff] px-2 py-2.5 text-center transition hover:border-[#a88bff] active:scale-95"
                    >
                      <span className="text-base">➕</span>
                      <span className="text-[0.6875rem] font-extrabold text-[#6b4fc0]">Slot {i + 1}’e Kaydet</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[0.6875rem] font-black uppercase tracking-wide text-[#8a7a9c]">✨ Hazır Stil Paketleri</p>
              <div className="grid grid-cols-2 gap-2">
                {OUTFIT_PRESETS.map((p) => {
                  const reqLv = p.lv ?? 1
                  const locked = reqLv > playerLv
                  const active = !locked && sameLook(look, p.look) && acc?.id === p.acc?.id && acc2?.id === p.acc2?.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => (locked ? onLocked?.(reqLv) : applyPreset(p))}
                      className={`flex items-center gap-2.5 rounded-2xl border-2 px-2.5 py-2 text-left transition ${locked ? 'cursor-not-allowed border-white bg-[#faf6ff]/70 opacity-60' : active ? 'border-[#a88bff] bg-[#efe6ff] shadow-soft active:scale-95' : 'border-white bg-[#faf6ff] hover:bg-[#f3ebff] active:scale-95'}`}
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-2xl shadow-sm">{locked ? '🔒' : p.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="truncate text-xs font-black text-[#4a3b5c]">{p.name}</p>
                          {locked && <span className="shrink-0 rounded-full bg-[#efe6ff] px-1.5 py-0.5 text-[0.5625rem] font-black text-[#6b4fc0]">Sv. {reqLv}</span>}
                        </div>
                        <p className="truncate text-[0.625rem] font-semibold text-[#8a7a9c]">{p.desc}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {tab === 'look' && (
          <div className="rounded-2xl border-2 border-white bg-[#faf6ff] p-3">
            <LookPicker value={look} onChange={setLook} compact playerLv={playerLv} onLocked={onLocked} />
          </div>
        )}

        {tab === 'acc' && (
          <div className="flex flex-col gap-3">
            <div>
              <p className="mb-1.5 text-[0.6875rem] font-black uppercase tracking-wide text-[#8a7a9c]">👑 Baş & Saç</p>
              <div className="grid grid-cols-4 gap-1.5">
                <ItemButton active={!acc} emoji="🚫" label="Yok" onClick={() => pickAcc(null)} />
                {ACCESSORIES.map((a) => {
                  const reqLv = a.lv ?? 1
                  const locked = reqLv > playerLv
                  return (
                    <ItemButton
                      key={a.id}
                      active={!locked && acc?.id === a.id}
                      emoji={a.emoji}
                      label={a.name}
                      lockedLv={locked ? reqLv : 0}
                      onClick={() => (locked ? onLocked?.(reqLv) : pickAcc(a.id))}
                    />
                  )
                })}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[0.6875rem] font-black uppercase tracking-wide text-[#8a7a9c]">✨ Yüz, Kanat & Çanta (Ekstra)</p>
              <div className="grid grid-cols-4 gap-1.5">
                <ItemButton active={!acc2} emoji="🚫" label="Yok" onClick={() => pickAcc2(null)} />
                {STYLE_ACCESSORIES.map((a) => {
                  const reqLv = a.lv ?? 1
                  const locked = reqLv > playerLv
                  return (
                    <ItemButton
                      key={a.id}
                      active={!locked && acc2?.id === a.id}
                      emoji={a.emoji}
                      label={a.name}
                      lockedLv={locked ? reqLv : 0}
                      onClick={() => (locked ? onLocked?.(reqLv) : pickAcc2(a.id))}
                    />
                  )
                })}
              </div>
            </div>

            <div className="rounded-2xl border-2 border-white bg-[#faf6ff] p-2.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[0.6875rem] font-black text-[#4a3b5c]">🎨 Aksesuar Rengi</span>
                <div className="flex gap-1">
                  {[
                    ['acc', 'Baş'],
                    ['acc2', 'Ekstra'],
                  ].map(([s, lbl]) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setColorSlot(s)}
                      className={`rounded-full px-2.5 py-0.5 text-[0.625rem] font-black transition ${colorSlot === s ? 'bg-[#a88bff] text-white' : 'bg-white text-[#6b4fc0]'}`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Aksesuar rengi">
                {PASTELS.map((c) => {
                  const reqLv = c.lv ?? 1
                  const locked = reqLv > playerLv
                  return (
                    <button
                      key={c.id}
                      type="button"
                      title={locked ? `${c.name} (Seviye ${reqLv})` : c.name}
                      aria-label={`${c.name}${locked ? ` (Seviye ${reqLv})` : ''}`}
                      aria-pressed={!locked && activeColor === c.id}
                      onClick={() => (locked ? onLocked?.(reqLv) : pickColor(c.id))}
                      style={{ background: c.hex }}
                      className={`relative h-8 w-8 rounded-full border-[3px] shadow-soft transition ${locked ? 'cursor-not-allowed border-white opacity-45' : 'active:scale-90'} ${!locked && activeColor === c.id ? 'scale-110 border-[#4a3b5c]' : 'border-white'}`}
                    >
                      {locked && <span className="absolute inset-0 grid place-items-center text-[0.625rem] drop-shadow">🔒</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {tab === 'pet' && (
          <>
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-[#f3f0fa] px-3 py-2">
              <p className="text-xs font-extrabold text-[#4a3b5c]">
                {petLeft > 0 ? `🐾 Bakım süresi: ${petLeft >= 48 ? `${Math.ceil(petLeft / 24)} gün` : `${petLeft} saat`}` : '🐾 Evcil hayvan süresi bitti'}
              </p>
              <button onClick={onRenew} disabled={coins < PET_RENEW_PRICE} className="rounded-full bg-[#ffe48f] px-3 py-1 text-[0.6875rem] font-black text-[#8a5a00] shadow transition active:scale-95 disabled:opacity-50">
                +1 hafta · {PET_RENEW_PRICE} ₺
              </button>
            </div>
            <div className="mt-2.5 grid grid-cols-4 gap-2">
              <ItemButton active={!pet} emoji="🚫" label="Yok" onClick={() => setPet(null)} />
              {PETS.map((p) => (
                <ItemButton key={p.id} active={pet === p.id} emoji={p.emoji} label={p.name} onClick={() => (petLeft > 0 ? setPet(p.id) : onRenew())} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={onClose} className="rounded-2xl px-4 py-2 text-sm font-extrabold text-[#8a7a9c] hover:bg-[#ffedd6]/60">
          Vazgeç
        </button>
        <ToyButton className="!py-3 !text-base" onClick={() => onSave({ acc, acc2, pet, look })}>
          ✔️ Görünümü Kaydet
        </ToyButton>
      </div>
    </Modal>
  )
}
