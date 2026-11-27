// Kişiselleştirme özelliği (istemci): useCosmetics hook'u (ağ mesajları, gardırop/hediye/dekor katmanları).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DoorPrompt } from '../Social'
import { HOME_ROOM } from '../layout'
import { PetLayer } from '../Pet'
import { cosStore } from '../cosStore'
import { levelOf } from '../collectibles'
import { emptyLook, sameLook } from '../lookData'
import { DEFAULT_DECOR } from '../cosmeticsData'
import { OFFER_TTL_MS, SEEN_KEY, petOfferDone, petOfferMark, readSavedLook, writeSavedLook } from './cosmeticsShared'
import { PetAdopt, Wardrobe } from './Wardrobe'
import { DecorTab, GiftPicker, GiftsTab, OfferCard } from './GiftsUi'
export function useCosmetics({ net, say, touch, home, homeItems, venue, focusRef, panel, setPanel, closeInteract, slug }) {
  const [self, setSelf] = useState(null) // { acc, acc2, pet, look }
  const [petUntil, setPetUntil] = useState(0)
  const [petOffer, setPetOffer] = useState(false) // ilk girişte 1 haftalık ücretsiz evcil hayvan seçimi
  const [petOfferReady, setPetOfferReady] = useState(false)
  const [coins, setCoins] = useState(0)
  const [xp, setXp] = useState(0)
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
        if (m.collect?.s?.stars != null) setXp(m.collect.s.stars)
        if (m.home) setDecors((d) => ({ ...d, [m.home]: m.decor ?? null }))
      }),
      on('collect_xp', (m) => setXp(m.xp ?? 0)),
      on('collect_state', (m) => {
        if (m.s?.stars != null) setXp(m.s.stars)
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
      category: 'gifts',
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
          playerLv={levelOf(xp).level}
          xp={xp}
          onLocked={(reqLv) => say(`🔒 Bu stil Seviye ${reqLv} ile açılır! Yıldız toplayarak seviye atla ⭐`)}
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
