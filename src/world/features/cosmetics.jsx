import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ToyButton } from '../../components/ui'
import { Modal } from '../Hud'
import AvatarRig from '../AvatarRig'
import { PetLayer, PetModel } from '../Pet'
import { cosStore } from '../cosStore'
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
  WALL_COLORS,
  WALL_PATTERNS,
} from '../cosmeticsData'

// Kişiselleştirme (istemci): gardırop (aksesuar + evcil hayvan), ev dekoru (Döşe → Dekor), hediyeleşme.
// Sunucu tarafı: server/features/cosmetics.js. Seçimler cosStore'a yazılır; AvatarRig aksesuarı, PetLayer evcil hayvanı oradan okur.

const OFFER_TTL_MS = 90_000

const chip = 'border-2 border-white shadow-soft'
const pillBase = 'shrink-0 rounded-full border-2 border-white px-3 py-1.5 text-xs font-extrabold transition active:scale-95'

// ---------- gardırop önizlemesi ----------
function PreviewStage({ slug }) {
  const group = useRef()
  const pet = useRef()
  const t = useRef(0)
  useFrame((_, dt) => {
    t.current += dt
    const fixed = import.meta.env.DEV ? window.__previewAngle : undefined // geliştirme: test için sabit açı
    if (group.current) group.current.rotation.y = fixed ?? Math.sin(t.current * 0.6) * 0.5
    if (pet.current) pet.current.position.y = Math.max(0, Math.sin(t.current * 2.2)) ** 6 * 0.1
  })
  return (
    <>
      <ambientLight intensity={0.9} />
      <hemisphereLight args={['#ffffff', '#ffedd6', 1.2]} />
      <directionalLight position={[2, 4, 3]} intensity={1.4} />
      <group ref={group} position={[-0.25, 0, 0]}>
        <Suspense fallback={null}>
          <AvatarRig slug={slug} anim="idle" cosId="preview" />
        </Suspense>
      </group>
      <group position={[0.75, 0, 0.25]} rotation={[0, -0.5, 0]}>
        <group ref={pet}>
          <PreviewPet />
        </group>
      </group>
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
              <p className="text-[11px] font-bold text-[#8a7a9c]">1 hafta ücretsiz</p>
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
  const [acc, setAcc] = useState(cos?.acc ?? null)
  const [pet, setPet] = useState(cos?.pet ?? null)
  const [tab, setTab] = useState('acc')
  const [color, setColor] = useState(cos?.acc?.color ?? 'pink')
  const petLeft = Math.max(0, Math.ceil((petUntil - Date.now()) / 3600000)) // kalan saat

  useEffect(() => {
    cosStore.set('preview', { acc, pet })
  }, [acc, pet])
  useEffect(() => () => cosStore.set('preview', null), [])

  const pickAcc = (id) => setAcc(id ? { id, color } : null)
  const pickColor = (c) => {
    setColor(c)
    if (acc) setAcc({ ...acc, color: c })
  }

  return (
    <Modal onClose={onClose} label="Gardırop">
      <h2 className="text-2xl font-black text-[#4a3b5c]">Gardırop 👗</h2>
      <div className="mt-3 h-48 overflow-hidden rounded-3xl border-2 border-white bg-gradient-to-b from-[#fff2e3] via-[#f1e6ff] to-[#dff3ff] shadow-soft">
        <Canvas camera={{ position: [0, 1.0, 2.6], fov: 32 }} dpr={[1, 2]} onCreated={({ camera }) => camera.lookAt(0, 0.8, 0)}>
          {import.meta.env.DEV && <DevCam />}
          <PreviewStage slug={slug} />
        </Canvas>
      </div>

      <div className="mt-3 flex gap-2">
        {[['acc', '🎀 Aksesuar'], ['pet', '🐾 Evcil hayvan']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`${pillBase} flex-1 py-2 text-sm ${tab === k ? 'bg-[#a88bff] text-white' : 'bg-[#f6f0ff] text-[#4a3b5c]'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'acc' ? (
        <>
          <div className="mt-3 grid grid-cols-4 gap-2">
            <ItemButton active={!acc} emoji="🚫" label="Yok" onClick={() => pickAcc(null)} />
            {ACCESSORIES.map((a) => (
              <ItemButton key={a.id} active={acc?.id === a.id} emoji={a.emoji} label={a.name} onClick={() => pickAcc(a.id)} />
            ))}
          </div>
          <div className="mt-3 flex items-center justify-center gap-2.5" role="group" aria-label="Renk">
            {PASTELS.map((c) => (
              <button
                key={c.id}
                aria-label={c.name}
                aria-pressed={color === c.id}
                onClick={() => pickColor(c.id)}
                style={{ background: c.hex }}
                className={`h-10 w-10 rounded-full border-4 shadow-soft transition active:scale-90 ${color === c.id ? 'border-[#4a3b5c]' : 'border-white'}`}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl bg-[#f3f0fa] px-3 py-2">
            <p className="text-xs font-extrabold text-[#4a3b5c]">
              {petLeft > 0 ? `🐾 Bakım süresi: ${petLeft >= 48 ? `${Math.ceil(petLeft / 24)} gün` : `${petLeft} saat`}` : '🐾 Evcil hayvan süresi bitti'}
            </p>
            <button onClick={onRenew} disabled={coins < PET_RENEW_PRICE} className="rounded-full bg-[#ffe48f] px-3 py-1 text-[11px] font-black text-[#8a5a00] shadow transition active:scale-95 disabled:opacity-50">
              +1 hafta · {PET_RENEW_PRICE} 🪙
            </button>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            <ItemButton active={!pet} emoji="🚫" label="Yok" onClick={() => setPet(null)} />
            {PETS.map((p) => (
              <ItemButton key={p.id} active={pet === p.id} emoji={p.emoji} label={p.name} onClick={() => (petLeft > 0 ? setPet(p.id) : onRenew())} />
            ))}
          </div>
        </>
      )}

      <div className="mt-4 flex gap-2">
        <button onClick={onClose} className="rounded-2xl px-4 py-2 text-sm font-extrabold text-[#8a7a9c] hover:bg-[#ffedd6]/60">
          Vazgeç
        </button>
        <ToyButton className="!py-3 !text-base" onClick={() => onSave({ acc, pet })}>
          ✓ Kaydet
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
      className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-1 py-2 text-center transition active:scale-95 ${active ? 'border-[#a88bff] bg-[#efe6ff]' : 'border-white bg-[#f6f0ff] hover:bg-[#efe6ff]'}`}
    >
      <span className="text-2xl" aria-hidden>
        {emoji}
      </span>
      <span className="w-full truncate text-[11px] font-extrabold leading-tight text-[#4a3b5c]">{label}</span>
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
    <div className={`absolute left-1/2 top-24 z-20 w-[min(92vw,22rem)] -translate-x-1/2 animate-pop rounded-3xl bg-white/80 p-3 backdrop-blur-md ${chip}`} role="alert">
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
    </div>
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
            <span className="w-full truncate text-center text-[11px] font-extrabold text-[#4a3b5c]">{def?.name}</span>
            <span className="w-full truncate text-center text-[10px] font-bold text-[#8a7a9c]">{placed ? 'Odada ✓' : `${g.from} 💝`}</span>
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
export function useCosmetics({ net, say, home, venue, focusRef, panel, setPanel, closeInteract, slug }) {
  const [self, setSelf] = useState(null) // { acc, pet }
  const [petUntil, setPetUntil] = useState(0)
  const [petOffer, setPetOffer] = useState(false) // ilk girişte 1 haftalık ücretsiz evcil hayvan seçimi
  const [petOfferReady, setPetOfferReady] = useState(false)
  const [coins, setCoins] = useState(0)
  const [gifts, setGifts] = useState([])
  const [decors, setDecors] = useState({}) // ev anahtarı → dekor
  const [offers, setOffers] = useState([])
  const [giftTo, setGiftTo] = useState(null)
  const decorTimer = useRef(null)
  useEffect(() => {
    if (!petOffer || venue || home) return undefined
    const t = setTimeout(() => setPetOfferReady(true), 1800) // şehre çıkınca kısa bir beklemeyle
    return () => clearTimeout(t)
  }, [petOffer, venue, home])
  const on = net.on
  const send = net.send
  const homeKey = net.homeKey

  useEffect(() => {
    const setOthers = (players) => players?.forEach((p) => cosStore.set(p.id, p.cos))
    const offs = [
      on('welcome', (m) => {
        cosStore.clearOthers()
        cosStore.set('self', m.cos)
        setSelf(m.cos ?? null)
        setOthers(m.players)
        setGifts(m.gifts ?? [])
        setPetUntil(m.petUntil ?? 0)
        setPetOffer(Boolean(m.petOffer))
        setCoins(m.coins ?? 0)
        if (m.home) setDecors((d) => ({ ...d, [m.home]: m.decor ?? null }))
      }),
      on('pet_until', (m) => (setPetUntil(m.until ?? 0), setPetOffer(false))),
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

  const settingsSections = [
    <section key="wardrobe" className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-[#4a3b5c]">👗 Gardırop</p>
        <p className="text-xs font-semibold text-[#8a7a9c]">Aksesuar ve evcil hayvan seç; herkes görür. {gifts.length > 0 && `🎁 ${gifts.length} hediyen var (evinde Döşe → Hediyeler).`}</p>
      </div>
      <button onClick={() => setPanel('wardrobe')} className="shrink-0 rounded-2xl bg-[#a88bff] px-4 py-2.5 text-sm font-extrabold text-white shadow-soft active:scale-95">
        Aç
      </button>
    </section>,
  ]

  const editorTabs = isOwn
    ? [
        { key: 'decor', label: '🎨 Dekor', render: () => <DecorTab decor={ownDecor} onChange={changeDecor} /> },
        { key: 'gifts', label: `🎁 Hediyeler${gifts.length ? ` (${gifts.length})` : ''}`, render: ({ furn, place }) => <GiftsTab gifts={gifts} furn={furn} place={place} /> },
      ]
    : []

  const offer = offers[0]
  const reply = (accept) => {
    send({ t: 'gift_reply', offer: offer.offer, accept })
    setOffers((q) => q.slice(1))
  }

  const overlays = (
    <>
      {panel === 'wardrobe' && (
        <Wardrobe
          slug={slug}
          cos={self}
          petUntil={petUntil}
          coins={coins}
          onRenew={() => send({ t: 'pet_renew' })}
          onClose={() => setPanel(null)}
          onSave={(sel) => {
            send({ t: 'cos_set', acc: sel.acc, pet: sel.pet })
            setPanel(null)
            say('👗 Görünümün güncellendi!')
          }}
        />
      )}
      {petOffer && petOfferReady && !venue && !home && <PetAdopt onPick={(pet) => send({ t: 'pet_adopt', pet })} onLater={() => setPetOffer(false)} />}
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

  return { peerActions, settingsSections, overlays, homeDecor: decor, editorTabs, sceneNodes }
}
