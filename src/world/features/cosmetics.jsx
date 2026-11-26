import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TopDock } from '../../components/Dock'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import LookPicker from '../../components/LookPicker'
import { ToyButton } from '../../components/ui'
import { Modal } from '../Hud'
import { DoorPrompt } from '../Social'
import { HOME_ROOM } from '../layout'
import AvatarRig from '../AvatarRig'
import { PetLayer, PetModel } from '../Pet'
import { cosStore } from '../cosStore'
import {
  EYE_COLORS,
  HAIR_COLORS,
  OUTFIT_COLORS,
  OUTFIT_PRESETS,
  emptyLook,
  sameLook,
  sanitizeLook,
} from '../lookData'
import {
  ACCESSORIES,
  DEFAULT_DECOR,
  FLOORS,
  GIFTS,
  GIFT_BY_ID,
  GIFT_RANGE,
  PASTELS,
  PETS,
  PET_RENEW_PRICE,
  STYLE_ACCESSORIES,
  WALL_COLORS,
  WALL_PATTERNS,
} from '../cosmeticsData'

// Kişiselleştirme (istemci): gardırop (kombinler, saç/göz/kıyafet rengi, çift slot aksesuar + evcil hayvan), ev dekoru, hediyeleşme.
// Sunucu tarafı: server/features/cosmetics.js. Seçimler cosStore'a yazılır; AvatarRig aksesuar/görünümü, PetLayer evcil hayvanı oradan okur.

const OFFER_TTL_MS = 90_000
const FAV_KEY = 'situapp_fav_looks_v1'
const SEEN_KEY = 'situapp_wardrobe_seen'

const chip = 'border-2 border-white shadow-soft'
const pillBase = 'shrink-0 rounded-full border-2 border-white px-3 py-1.5 text-xs font-extrabold transition active:scale-95'

function readSavedLook() {
  try {
    const raw = JSON.parse(localStorage.getItem('situapp_avatar'))
    return raw?.look ? sanitizeLook(raw.look) : emptyLook()
  } catch {
    return emptyLook()
  }
}

function writeSavedLook(look) {
  try {
    const raw = JSON.parse(localStorage.getItem('situapp_avatar'))
    if (raw) localStorage.setItem('situapp_avatar', JSON.stringify({ ...raw, look }))
  } catch {
    /* önemli değil */
  }
}

function readFavorites() {
  try {
    const arr = JSON.parse(localStorage.getItem(FAV_KEY))
    return Array.isArray(arr) ? arr.slice(0, 3) : [null, null, null]
  } catch {
    return [null, null, null]
  }
}

// ---------- gardırop önizlemesi ----------
function PreviewCam({ zoomMode, controlsRef }) {
  const { camera } = useThree()
  useEffect(() => {
    if (import.meta.env.DEV && window.__previewCam) return
    const close = zoomMode === 'close'
    camera.position.set(0, close ? 1.18 : 1.02, close ? 1.48 : 2.75)
    if (controlsRef.current) {
      controlsRef.current.target.set(close ? -0.22 : 0, close ? 0.98 : 0.74, 0)
      controlsRef.current.update()
    } else {
      camera.lookAt(close ? -0.22 : 0, close ? 0.98 : 0.74, 0)
    }
  }, [zoomMode, camera, controlsRef])
  return null
}

function PreviewStage({ slug, poseMode, zoomMode }) {
  const pet = useRef()
  const controls = useRef()
  const t = useRef(0)
  const dancePose = useMemo(() => ({ current: poseMode === 'dance' ? { kind: 'dance', lead: true, t0: 0 } : null }), [poseMode])

  useFrame((_, dt) => {
    t.current += dt
    if (pet.current) pet.current.position.y = Math.max(0, Math.sin(t.current * 2.2)) ** 6 * 0.1
  })
  return (
    <>
      <PreviewCam zoomMode={zoomMode} controlsRef={controls} />
      <ambientLight intensity={0.95} />
      <hemisphereLight args={['#ffffff', '#ffedd6', 1.25]} />
      <directionalLight position={[2, 4, 3]} intensity={1.45} />
      {/* stüdyo podyumu */}
      <group position={[-0.22, -0.05, 0]}>
        <mesh>
          <cylinderGeometry args={[0.58, 0.64, 0.1, 40]} />
          <meshStandardMaterial color="#f5e6ff" roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.052, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.45, 0.5, 40]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
        </mesh>
      </group>
      <group position={[-0.22, 0, 0]} rotation={[0, import.meta.env.DEV && window.__previewAngle !== undefined ? window.__previewAngle : 0, 0]}>
        <Suspense fallback={null}>
          <AvatarRig slug={slug} anim={poseMode === 'walk' ? 'walk' : 'idle'} pose={poseMode === 'dance' ? dancePose : undefined} cosId="preview" />
        </Suspense>
      </group>
      <group position={[0.72, 0, 0.2]} rotation={[0, -0.45, 0]}>
        <group ref={pet}>
          <PreviewPet />
        </group>
      </group>
      <OrbitControls
        ref={controls}
        enablePan={false}
        minDistance={1.1}
        maxDistance={3.6}
        minPolarAngle={0.6}
        maxPolarAngle={Math.PI / 1.95}
      />
    </>
  )
}

/** Geliştirme: window.__previewCam = [x, y, z, hedefY] ile önizleme kamerasını yaklaştır (aksesuar ayarı için). */
function DevCam() {
  useFrame(({ camera }) => {
    const c = window.__previewCam
    if (!c) return
    camera.position.set(c[0], c[1], c[2])
    camera.lookAt(0, c[3], 0)
  })
  return null
}

function PreviewPet() {
  const [kind, setKind] = useState(() => cosStore.get('preview')?.pet ?? null)
  useEffect(() => {
    setKind(cosStore.get('preview')?.pet ?? null)
    return cosStore.subscribe(() => setKind(cosStore.get('preview')?.pet ?? null))
  }, [])
  return kind ? <PetModel kind={kind} /> : null
}

/** İlk giriş: 1 haftalık ücretsiz evcil hayvan seçimi (kedi ya da köpek). */
// Hediye evcil hayvan teklifi bir kez gösterilir: seçildiyse bu tarayıcıda kalıcı, "Şimdi değil" ise oturum boyunca (sunucu verisi sıfırlansa bile tekrar çıkmasın)
const petOfferKey = (k) => `situapp_pet_offer_done:${k ?? ''}`
function petOfferDone(k) {
  try {
    return localStorage.getItem(petOfferKey(k)) === '1' || sessionStorage.getItem(petOfferKey(k)) === '1'
  } catch {
    return false
  }
}
function petOfferMark(k, sessionOnly = false) {
  try {
    ;(sessionOnly ? sessionStorage : localStorage).setItem(petOfferKey(k), '1')
  } catch {
    /* önemli değil */
  }
}

function PetAdopt({ onPick, onLater }) {
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

function Wardrobe({ slug, cos, petUntil, coins, onRenew, onSave, onClose }) {
  const initialLook = useMemo(() => sanitizeLook(cos?.look ?? readSavedLook()), [cos?.look])
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
    setLook(sanitizeLook(p.look))
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
    const r = (arr) => Math.floor(Math.random() * arr.length)
    const c1 = PASTELS[r(PASTELS)].id
    const c2 = PASTELS[r(PASTELS)].id
    const a1 = ACCESSORIES[r(ACCESSORIES)].id
    const a2 = Math.random() > 0.25 ? STYLE_ACCESSORIES[r(STYLE_ACCESSORIES)].id : null
    setLook({ h: r(HAIR_COLORS), e: r(EYE_COLORS), o: r(OUTFIT_COLORS) })
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
    <Modal onClose={onClose} label="Gardırop" wide>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-black text-[#4a3b5c]">Stüdyo & Gardırop 👗</h2>
          <p className="text-xs font-bold text-[#8a7a9c]">Sürükleyip 360° çevir, kombinini oluştur</p>
        </div>
        <button onClick={onClose} aria-label="Gardırobu kapat" className="grid h-9 w-9 place-items-center rounded-full bg-[#f6f0ff] text-sm font-black text-[#8a7a9c] hover:bg-[#ffedd6]/70">
          ✕
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
            className="grid h-7 w-7 place-items-center rounded-full border border-white bg-white/85 text-xs font-black text-[#8a7a9c] shadow-sm backdrop-blur-sm transition hover:bg-white active:scale-95"
          >
            ↺
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
                  const f = favs[i]
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
                        className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-white/90 text-[0.625rem] font-black text-[#8a7a9c] hover:text-rose-500"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      key={i}
                      type="button"
                      onClick={() => saveFav(i)}
                      className="flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-dashed border-[#d6c7ff] bg-[#faf6ff] px-2 py-2.5 text-center transition hover:border-[#a88bff] active:scale-95"
                    >
                      <span className="text-base font-black text-[#a88bff]">＋</span>
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
                  const active = sameLook(look, p.look) && acc?.id === p.acc?.id && acc2?.id === p.acc2?.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className={`flex items-center gap-2.5 rounded-2xl border-2 px-2.5 py-2 text-left transition active:scale-95 ${active ? 'border-[#a88bff] bg-[#efe6ff] shadow-soft' : 'border-white bg-[#faf6ff] hover:bg-[#f3ebff]'}`}
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-2xl shadow-sm">{p.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black text-[#4a3b5c]">{p.name}</p>
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
            <LookPicker value={look} onChange={setLook} compact />
          </div>
        )}

        {tab === 'acc' && (
          <div className="flex flex-col gap-3">
            <div>
              <p className="mb-1.5 text-[0.6875rem] font-black uppercase tracking-wide text-[#8a7a9c]">👑 Baş & Saç</p>
              <div className="grid grid-cols-4 gap-1.5">
                <ItemButton active={!acc} emoji="🚫" label="Yok" onClick={() => pickAcc(null)} />
                {ACCESSORIES.map((a) => (
                  <ItemButton key={a.id} active={acc?.id === a.id} emoji={a.emoji} label={a.name} onClick={() => pickAcc(a.id)} />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[0.6875rem] font-black uppercase tracking-wide text-[#8a7a9c]">✨ Yüz, Kanat & Çanta (Ekstra)</p>
              <div className="grid grid-cols-4 gap-1.5">
                <ItemButton active={!acc2} emoji="🚫" label="Yok" onClick={() => pickAcc2(null)} />
                {STYLE_ACCESSORIES.map((a) => (
                  <ItemButton key={a.id} active={acc2?.id === a.id} emoji={a.emoji} label={a.name} onClick={() => pickAcc2(a.id)} />
                ))}
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
                {PASTELS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    title={c.name}
                    aria-label={c.name}
                    aria-pressed={activeColor === c.id}
                    onClick={() => pickColor(c.id)}
                    style={{ background: c.hex }}
                    className={`h-8 w-8 rounded-full border-[3px] shadow-soft transition active:scale-90 ${activeColor === c.id ? 'scale-110 border-[#4a3b5c]' : 'border-white'}`}
                  />
                ))}
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
          ✓ Görünümü Kaydet
        </ToyButton>
      </div>
    </Modal>
  )
}

function ItemButton({ active, emoji, label, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-[4.1rem] flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-1 py-1.5 text-center transition active:scale-95 ${active ? 'border-[#a88bff] bg-[#efe6ff] shadow-sm' : 'border-white bg-[#f6f0ff] hover:bg-[#efe6ff]'}`}
    >
      <span className="text-2xl" aria-hidden>
        {emoji}
      </span>
      <span className="w-full truncate text-[0.625rem] font-extrabold leading-tight text-[#4a3b5c]">{label}</span>
    </button>
  )
}

// ---------- hediye ----------
function GiftPicker({ peer, onPick, onClose }) {
  return (
    <Modal onClose={onClose} label="Hediye gönder">
      <h2 className="text-xl font-black text-[#4a3b5c]">🎁 {peer.name} için hediye seç</h2>
      <p className="mt-1 text-xs font-semibold text-[#8a7a9c]">En fazla {GIFT_RANGE} m yakınında olmalısın. {peer.name} kabul ederse hediye onun envanterine düşer ve evine yerleştirebilir.</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {GIFTS.map((g) => (
          <button key={g.id} onClick={() => onPick(g.id)} className="flex flex-col items-center gap-1 rounded-3xl border-2 border-white bg-[#fff8f0] p-3 shadow-soft transition hover:bg-[#fff2e3] active:scale-95">
            <span className="text-5xl" aria-hidden>
              {g.emoji}
            </span>
            <span className="text-sm font-black text-[#4a3b5c]">{g.name}</span>
          </button>
        ))}
      </div>
      <button onClick={onClose} className="mt-3 w-full rounded-2xl py-2 text-sm font-extrabold text-[#8a7a9c] hover:bg-[#ffedd6]/60">
        Vazgeç
      </button>
    </Modal>
  )
}

function OfferCard({ offer, onAccept, onDecline }) {
  const g = GIFT_BY_ID[offer.kind]
  return (
    <TopDock><div className={`relative w-[min(92vw,22rem)] animate-pop rounded-3xl bg-white/80 p-3 backdrop-blur-md ${chip}`} role="alert">
      <div className="flex items-center gap-3">
        <span className="text-3xl" aria-hidden>
          {g?.emoji ?? '🎁'}
        </span>
        <p className="min-w-0 flex-1 text-sm font-black text-[#4a3b5c]">
          {offer.fromName} sana {g?.name ?? 'bir hediye'} göndermek istiyor!
        </p>
      </div>
      <div className="mt-2.5 flex gap-2">
        <button onClick={onDecline} className="rounded-2xl bg-[#f6f0ff] px-4 py-2.5 text-sm font-extrabold text-[#8a7a9c] active:scale-95">
          Vazgeç
        </button>
        <ToyButton className="!rounded-2xl !py-2.5 !text-sm" onClick={onAccept}>
          🎁 Kabul et
        </ToyButton>
      </div>
    </div></TopDock>
  )
}

// ---------- ev düzenleme sekmeleri ----------
function Swatches({ options, value, onPick, label }) {
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

function Pills({ options, value, onPick, label }) {
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

function DecorTab({ decor, onChange }) {
  return (
    <div className="flex max-h-[38svh] flex-col gap-1 overflow-y-auto pb-1">
      <Swatches label="Duvar" options={WALL_COLORS} value={decor.wall} onPick={(wall) => onChange({ wall })} />
      <Pills label="Desen" options={WALL_PATTERNS} value={decor.pattern} onPick={(pattern) => onChange({ pattern })} />
      <Pills label="Zemin" options={FLOORS} value={decor.floor} onPick={(floor) => onChange({ floor })} />
      <button
        role="switch"
        aria-checked={decor.romantic}
        onClick={() => onChange({ romantic: !decor.romantic })}
        className={`mt-1 flex items-center justify-center gap-2 rounded-2xl border-2 border-white px-4 py-2.5 text-sm font-extrabold transition active:scale-[0.98] ${decor.romantic ? 'bg-gradient-to-r from-[#fec071] to-[#bba0ff] text-white shadow-soft' : 'bg-white/80 text-[#4a3b5c]'}`}
      >
        💗 Romantik ışık modu {decor.romantic ? '· açık' : '· kapalı'}
      </button>
    </div>
  )
}

function GiftsTab({ gifts, furn, place }) {
  if (!gifts.length) {
    return <p className="rounded-2xl bg-white/70 px-3 py-4 text-center text-xs font-bold text-[#8a7a9c]">Henüz hediyen yok. Biri sana hediye gönderip sen kabul edince burada görünür 🎁</p>
  }
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {gifts.map((g) => {
        const def = GIFT_BY_ID[g.kind]
        const placed = furn.some((i) => i.uid === g.uid)
        return (
          <button
            key={g.uid}
            disabled={placed}
            onClick={() => place(g.kind, { uid: g.uid, from: g.from })}
            className="flex w-24 shrink-0 flex-col items-center gap-0.5 rounded-2xl border-2 border-white bg-white/70 p-2 transition hover:bg-white active:scale-95 disabled:opacity-50"
          >
            <span className="text-3xl" aria-hidden>
              {def?.emoji}
            </span>
            <span className="w-full truncate text-center text-[0.6875rem] font-extrabold text-[#4a3b5c]">{def?.name}</span>
            <span className="w-full truncate text-center text-[0.625rem] font-bold text-[#8a7a9c]">{placed ? 'Odada ✓' : `${g.from} 💝`}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Kişiselleştirme: gardırop paneli (panel === 'wardrobe'), evcil hayvan katmanı, ev dekoru ve hediyeleşme.
 * Döndürür: peerActions, settingsSections, overlays + (özel) homeDecor, editorTabs, sceneNodes.
 */
export function useCosmetics({ net, say, touch, home, homeItems, venue, focusRef, panel, setPanel, closeInteract, slug }) {
  const [self, setSelf] = useState(null) // { acc, acc2, pet, look }
  const [petUntil, setPetUntil] = useState(0)
  const [petOffer, setPetOffer] = useState(false) // ilk girişte 1 haftalık ücretsiz evcil hayvan seçimi
  const [petOfferReady, setPetOfferReady] = useState(false)
  const [coins, setCoins] = useState(0)
  const [gifts, setGifts] = useState([])
  const [decors, setDecors] = useState({}) // ev anahtarı → dekor
  const [offers, setOffers] = useState([])
  const [giftTo, setGiftTo] = useState(null)
  const [nearWardrobe, setNearWardrobe] = useState(null) // { emoji, label, action }
  const [wardrobeSeen, setWardrobeSeen] = useState(() => {
    try {
      return Boolean(localStorage.getItem(SEEN_KEY))
    } catch {
      return false
    }
  })
  const decorTimer = useRef(null)

  useEffect(() => {
    if (panel !== 'wardrobe' || wardrobeSeen) return
    setWardrobeSeen(true)
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* önemli değil */
    }
  }, [panel, wardrobeSeen])

  useEffect(() => {
    if (!petOffer || venue || home) return undefined
    const t = setTimeout(() => setPetOfferReady(true), 1800) // şehre çıkınca kısa bir beklemeyle
    return () => clearTimeout(t)
  }, [petOffer, venue, home])
  const on = net.on
  const send = net.send
  const homeKey = net.homeKey

  useEffect(() => {
    if (!cosStore.get('self')) {
      const saved = readSavedLook()
      if (!sameLook(saved, emptyLook())) cosStore.set('self', { look: saved })
    }
    const setOthers = (players) => players?.forEach((p) => cosStore.set(p.id, p.cos))
    const offs = [
      on('welcome', (m) => {
        cosStore.clearOthers()
        cosStore.set('self', m.cos)
        setSelf(m.cos ?? null)
        setOthers(m.players)
        setGifts(m.gifts ?? [])
        setPetUntil(m.petUntil ?? 0)
        setPetOffer(Boolean(m.petOffer) && !petOfferDone(net.homeKey))
        setCoins(m.coins ?? 0)
        if (m.home) setDecors((d) => ({ ...d, [m.home]: m.decor ?? null }))
      }),
      on('pet_until', (m) => (setPetUntil(m.until ?? 0), setPetOffer(false), petOfferMark(net.homeKey))),
      on('coins', (m) => setCoins(m.n)),
      on('join', (m) => cosStore.set(m.p.id, m.p.cos)),
      on('leave', (m) => cosStore.remove(m.id)),
      on('room', (m) => {
        cosStore.clearOthers()
        setOthers(m.players)
        if (m.owner) send({ t: 'decor_get', owner: m.owner })
      }),
      on('cos', (m) => {
        if (m.id === net.selfId.current) {
          cosStore.set('self', m.cos)
          setSelf(m.cos)
        } else cosStore.set(m.id, m.cos)
      }),
      on('decor', (m) => setDecors((d) => ({ ...d, [m.owner]: m.decor }))),
      on('gifts', (m) => setGifts(m.list ?? [])),
      on('gift_offer', (m) => setOffers((q) => [...q.filter((o) => o.offer !== m.offer), { ...m, ts: Date.now() }].slice(-5))),
    ]
    return () => offs.forEach((off) => off())
  }, [on, send, net.selfId])

  // süresi dolan teklifleri düşür
  useEffect(() => {
    if (!offers.length) return
    const t = setInterval(() => setOffers((q) => q.filter((o) => Date.now() - o.ts < OFFER_TTL_MS)), 5000)
    return () => clearInterval(t)
  }, [offers.length])

  // ---- ev dekoru ----
  const owner = home ? (home.owner ?? homeKey) : null
  const isOwn = Boolean(home) && (!home.owner || home.owner === homeKey)
  const decor = owner ? (decors[owner] ?? null) : null
  const ownDecor = (homeKey && decors[homeKey]) || DEFAULT_DECOR

  // ---- mekân içi / ev içi gardırop noktası (Toni & Güy boy aynası + evdeki Gardırop / Kalpli ayna mobilyası) ----
  const mirrors = useMemo(
    () => (isOwn && Array.isArray(homeItems) ? homeItems.filter((i) => i.id === 'wardrobe' || i.id === 'heart-mirror') : []),
    [isOwn, homeItems],
  )
  const canMirror = venue === 'kuafor' || mirrors.length > 0
  useEffect(() => {
    if (!canMirror) return undefined
    const id = setInterval(() => {
      const f = focusRef.current
      let next = null
      const atHomeExit = isOwn && Math.hypot(f.x - HOME_ROOM.exit.x, f.z - HOME_ROOM.exit.z) < HOME_ROOM.exit.radius
      if (venue === 'kuafor' && Math.hypot(f.x - 7.1, f.z - -0.6) < 2.2) {
        next = { emoji: '🪞', label: 'Stil Aynası', action: 'Gardırop' }
      } else if (mirrors.length && !atHomeExit) {
        for (const it of mirrors) {
          if (Math.hypot(f.x - it.x, f.z - it.z) < 2.1) {
            next = { emoji: it.id === 'heart-mirror' ? '🪞' : '👗', label: it.id === 'heart-mirror' ? 'Kalpli Ayna' : 'Gardırobun', action: 'Aç' }
            break
          }
        }
      }
      setNearWardrobe((prev) => (prev?.label === next?.label ? prev : next))
    }, 300)
    return () => clearInterval(id)
  }, [canMirror, venue, isOwn, mirrors, focusRef])
  const activeMirror = canMirror ? nearWardrobe : null

  useEffect(() => {
    if (!activeMirror || panel) return undefined
    const onKey = (e) => {
      if ((e.code !== 'KeyE' && e.key !== 'e' && e.key !== 'E') || e.ctrlKey || e.metaKey || e.altKey) return
      const typing = e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)
      if (typing) return
      setPanel('wardrobe')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeMirror, panel, setPanel])

  const changeDecor = useCallback(
    (patch) => {
      if (!homeKey) return
      const next = { ...ownDecor, ...patch }
      setDecors((d) => ({ ...d, [homeKey]: next }))
      clearTimeout(decorTimer.current)
      decorTimer.current = setTimeout(() => send({ t: 'decor_set', decor: next }), 300)
    },
    [homeKey, ownDecor, send],
  )
  useEffect(() => () => clearTimeout(decorTimer.current), [])

  // ---- hediye ----
  const peerActions = (peer) => [
    {
      key: 'gift',
      emoji: '🎁',
      label: 'Hediye gönder',
      onClick: () => {
        setGiftTo(peer)
        closeInteract()
      },
    },
  ]

  const extraButtons = [
    {
      key: 'wardrobe',
      icon: 'wardrobe',
      label: 'Gardırop (Stil, Kıyafet & Aksesuar)',
      highlight: !wardrobeSeen,
      onClick: () => setPanel('wardrobe'),
    },
  ]

  const settingsSections = [
    <section key="wardrobe" className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-[#4a3b5c]">Gardırop</p>
        <p className="text-xs font-semibold text-[#8a7a9c]">Kombinler, saç/kıyafet rengi, aksesuar ve evcil hayvan. {gifts.length > 0 && `${gifts.length} hediyen var (evinde Döşe → Hediyeler).`}</p>
      </div>
      <button onClick={() => setPanel('wardrobe')} className="shrink-0 rounded-2xl bg-[#a88bff] px-4 py-2.5 text-sm font-extrabold text-white shadow-soft active:scale-95">
        Aç
      </button>
    </section>,
  ]

  const editorTabs = isOwn
    ? [
        { key: 'decor', label: 'Dekor', render: () => <DecorTab decor={ownDecor} onChange={changeDecor} /> },
        { key: 'gifts', label: `Hediyeler${gifts.length ? ` (${gifts.length})` : ''}`, render: ({ furn, place }) => <GiftsTab gifts={gifts} furn={furn} place={place} /> },
      ]
    : []

  const offer = offers[0]
  const reply = (accept) => {
    send({ t: 'gift_reply', offer: offer.offer, accept })
    setOffers((q) => q.slice(1))
  }

  const overlays = (
    <>
      {activeMirror && !panel && (
        <DoorPrompt emoji={activeMirror.emoji} label={activeMirror.label} action={activeMirror.action} touch={touch} raised onGo={() => setPanel('wardrobe')} />
      )}
      {panel === 'wardrobe' && (
        <Wardrobe
          slug={slug}
          cos={self}
          petUntil={petUntil}
          coins={coins}
          onRenew={() => send({ t: 'pet_renew' })}
          onClose={() => setPanel(null)}
          onSave={(sel) => {
            const nextCos = { ...(self ?? {}), acc: sel.acc, acc2: sel.acc2, pet: sel.pet, look: sel.look }
            cosStore.set('self', nextCos)
            setSelf(nextCos)
            writeSavedLook(sel.look)
            send({ t: 'cos_set', acc: sel.acc, acc2: sel.acc2, pet: sel.pet })
            if (!sameLook(self?.look, sel.look)) send({ t: 'look_set', look: sel.look })
            window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'collect' }))
            setPanel(null)
            say('👗 Görünümün güncellendi!')
          }}
        />
      )}
      {petOffer && petOfferReady && !venue && !home && <PetAdopt onPick={(pet) => (petOfferMark(homeKey), send({ t: 'pet_adopt', pet }))} onLater={() => (petOfferMark(homeKey, true), setPetOffer(false))} />}
      {giftTo && (
        <GiftPicker
          peer={giftTo}
          onClose={() => setGiftTo(null)}
          onPick={(kind) => {
            send({ t: 'gift_send', to: giftTo.id, kind })
            setGiftTo(null)
          }}
        />
      )}
      {offer && !giftTo && <OfferCard offer={offer} onAccept={() => reply(true)} onDecline={() => reply(false)} />}
      {/* romantik ışık: loş, sıcak bir perde (HUD'ın altında kalır) */}
      {home && decor?.romantic && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1] mix-blend-multiply"
          style={{ background: 'radial-gradient(ellipse at center, rgba(255,190,215,0.55) 0%, rgba(150,70,140,0.55) 100%)' }}
        />
      )}
    </>
  )

  const sceneNodes = <PetLayer focusRef={focusRef} remotes={net.remotes} />

  return { peerActions, extraButtons, settingsSections, overlays, homeDecor: decor, editorTabs, sceneNodes }
}
