// Birlikte yapılan şeyler: oturma, çift dans, fotoğraf kabini ve gün batımı anı.
// Sunucu tarafı (oturma/dans): server/features/together.js. Fotoğraf ve gün batımı yalnızca istemcidedir.
// 3D parçalar: TogetherScene.jsx (World.jsx Canvas'ında), duruş çizimi: avatarPose.js + AvatarRig.
import { useCallback, useEffect, useRef, useState } from 'react'
import { ToyButton } from '../../components/ui'
import { DoorPrompt } from '../Social'
import { PHOTO_SPOT, SEATS, SEAT_LABEL, resolveCollisions, zoneAt } from '../layout'
import { AlbumModal, Countdown, PhotoPreview, composePhoto, loadAlbum, removeFromAlbum, saveToAlbum } from './photo'
import { venueLayout, venueSeats } from '../venueLayout'
import { together } from './togetherStore'
import Portrait from '../Portrait'

const glass = 'border-2 border-white bg-white/85 shadow-soft backdrop-blur-md'
const SIT_PROMPT = 1.7 // m: bu kadar yakında boş koltuk varsa "Otur" çıkar
const NEAR_ANY = 4.5 // m: yakında biri varsa istemler yukarı kayar (yakın oyuncu kartıyla çakışmasın)
const SUNSET_DIST = 2 // m: yan yana sayılma mesafesi
const SUNSET_HOLD_MS = 4000 // yan yana durma süresi
const SUNSET_MS = 20000
const SUNSET_COOLDOWN_MS = 30000
const nowS = () => performance.now() / 1000

const isTyping = (e) => e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)

// ---------- küçük arayüz parçaları ----------
function Chip({ children }) {
  return <div className={`pointer-events-auto flex w-[min(94vw,23rem)] animate-pop items-center gap-3 rounded-3xl p-2.5 pl-3 ${glass}`}>{children}</div>
}

function DanceOfferCard({ offer, onAnswer }) {
  const [left, setLeft] = useState(Math.max(0, Math.ceil((offer.until - Date.now()) / 1000)))
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, Math.ceil((offer.until - Date.now()) / 1000))), 500)
    return () => clearInterval(t)
  }, [offer.until])
  return (
    <div className={`pointer-events-auto w-[min(94vw,23rem)] animate-pop rounded-3xl p-3 ${glass}`} role="alertdialog" aria-label={`${offer.name} seni dansa davet ediyor`}>
      <div className="flex items-center gap-3">
        <Portrait peer={offer} size={44} className="h-11 w-11" />
        <p className="min-w-0 flex-1 text-sm font-black text-[#4a3b5c]">
          <span className="block truncate">💃 {offer.name}</span>
          <span className="text-xs font-bold text-[#8a7a9c]">seni dansa davet ediyor · {left} sn</span>
        </p>
      </div>
      <div className="mt-2.5 flex gap-2">
        <button onClick={() => onAnswer(true)} className="flex-1 rounded-2xl border-b-4 border-[#e8952c] bg-[#fdb252] py-2.5 text-sm font-extrabold text-white active:translate-y-[2px] active:border-b-2">
          💃 Dans edelim
        </button>
        <button onClick={() => onAnswer(false)} className="flex-1 rounded-2xl border-b-4 border-[#c9b6f5] bg-[#e9ddff] py-2.5 text-sm font-extrabold text-[#5b3fa8] active:translate-y-[2px] active:border-b-2">
          Şimdi değil
        </button>
      </div>
    </div>
  )
}

function SunsetCard({ moment }) {
  const ref = useRef(null)
  useEffect(() => {
    let raf
    const loop = () => {
      const k = Math.max(0, Math.min(1, (moment.until - Date.now()) / SUNSET_MS))
      if (ref.current) ref.current.style.transform = `scaleX(${k})`
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [moment.until])
  return (
    <div className="pointer-events-auto w-[min(94vw,21rem)] animate-pop overflow-hidden rounded-3xl border-2 border-white bg-gradient-to-r from-[#ffd1b8]/95 via-[#fed195]/95 to-[#f3c9ff]/95 p-3 shadow-soft" role="status">
      <p className="text-sm font-black text-[#604727]">🌅 Gün batımı anı</p>
      <p className="text-xs font-bold text-[#4f6766]">{moment.name} ile yan yanasınız. Tadını çıkarın 💗</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/60">
        <div ref={ref} className="h-full origin-left rounded-full bg-[#fdb252]" />
      </div>
    </div>
  )
}

/** Ekran kenarlarında turuncu-pembe ışık: gökyüzü rengine eşlik eder (opaklık together.sky.t'yi izler). */
function SunsetVeil() {
  const ref = useRef(null)
  useEffect(() => {
    let raf
    const loop = () => {
      const t = together.sky.t
      if (ref.current) {
        ref.current.style.opacity = String(t * t * (3 - 2 * t))
        ref.current.style.display = t > 0.001 ? 'block' : 'none'
      }
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[5] hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 120%, rgba(255,150,110,0.55) 0%, rgba(255,140,170,0.28) 45%, rgba(255,170,200,0) 80%), linear-gradient(to top, rgba(255,160,130,0.18), rgba(255,200,220,0.05))' }}
    />
  )
}

function PhotoPrompt({ touch, raised, onShoot, onAlbum }) {
  return (
    <div className={`absolute left-1/2 z-10 w-[min(92vw,20rem)] -translate-x-1/2 animate-pop ${touch ? (raised ? 'bottom-64' : 'bottom-44') : raised ? 'bottom-24' : 'bottom-4'}`} role="status">
      <div className={`flex items-center gap-2 rounded-3xl p-2.5 pl-4 ${glass}`}>
        <span className="text-2xl" aria-hidden>
          📸
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-black text-[#4a3b5c]">Fotoğraf Stüdyosu</p>
        <button onClick={onAlbum} aria-label="Fotoğraf albümü" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e9ddff] text-lg active:scale-95">
          🖼️
        </button>
        <div className="w-24 shrink-0">
          <ToyButton className="!rounded-xl !py-2 !text-sm" onClick={onShoot}>
            {touch ? 'Çek' : 'E · Çek'}
          </ToyButton>
        </div>
      </div>
    </div>
  )
}

// ---------- ana hook ----------
export function useTogether(ctx) {
  const { net, say, touch, roster, focusRef, home, venue, panel, setPanel, openChat, closeInteract } = ctx
  const { on, send } = net
  const who = net.homeKey

  const [selfPose, setSelfPose] = useState(null)
  const [offer, setOffer] = useState(null) // gelen dans daveti { id, name, avatar, until }
  const [pair, setPair] = useState(null) // bankta yan yana oturduğum kişi { id, name, avatar }
  const [seatOpt, setSeatOpt] = useState(null)
  const [photoNear, setPhotoNear] = useState(false)
  const [nearAny, setNearAny] = useState(false)
  const [moment, setMoment] = useState(null) // gün batımı anı { id, name, until }
  const [shoot, setShoot] = useState(null) // { n } geri sayım
  const [photo, setPhoto] = useState(null) // önizleme { full, thumb }
  const [flash, setFlash] = useState(false)
  const [album, setAlbum] = useState(() => loadAlbum(who))
  const [albumWho, setAlbumWho] = useState(who)
  if (albumWho !== who) {
    setAlbumWho(who)
    setAlbum(loadAlbum(who))
  }

  // ---- ağ mesajları ----
  useEffect(() => {
    const fresh = (pose) => ({ ...pose, t0: nowS() })
    const setSelf = (pose) => {
      together.self.current = pose
      setSelfPose(pose)
      if (pose) focusRef.current.teleport = [pose.x, pose.z, pose.ry] // koltuğa / dans yerine yerleş
    }
    const reset = () => {
      together.poses.clear()
      setSelf(null)
      setPair(null)
      setOffer(null)
    }
    const offs = [
      on('pose', (m) => {
        if (m.id === net.selfId.current) {
          setSelf(m.pose ? fresh(m.pose) : null)
          if (!m.pose || m.pose.kind !== 'sit') setPair(null)
        } else if (m.pose) together.poses.set(m.id, fresh(m.pose))
        else together.poses.delete(m.id)
      }),
      on('poses', (m) => {
        together.poses.clear()
        for (const { id, pose } of m.list ?? []) {
          if (id === net.selfId.current) setSelf(fresh(pose))
          else together.poses.set(id, fresh(pose))
        }
      }),
      on('welcome', () => {
        reset()
        send({ t: 'poses' })
      }),
      on('room', () => {
        reset()
        send({ t: 'poses' })
      }),
      on('leave', (m) => together.poses.delete(m.id)),
      on('dance_offer', (m) => setOffer({ id: m.id, name: m.name, avatar: m.avatar, until: Date.now() + (m.ttl ?? 20000) })),
      on('dance_cancel', (m) => setOffer((o) => (o?.id === m.id ? null : o))),
      on('sit_pair', (m) => setPair({ id: m.id, name: m.name, avatar: m.avatar, kind: m.kind })),
    ]
    send({ t: 'poses' })
    return () => {
      offs.forEach((off) => off())
      together.poses.clear()
      together.self.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, send])

  // teklif süresi dolunca kartı kaldır
  useEffect(() => {
    if (!offer) return
    const t = setTimeout(() => setOffer(null), Math.max(0, offer.until - Date.now()))
    return () => clearTimeout(t)
  }, [offer])
  // bankta yan yana kısayolu 10 sn görünür
  useEffect(() => {
    if (!pair) return
    const t = setTimeout(() => setPair(null), 10000)
    return () => clearTimeout(t)
  }, [pair])
  // kalkınca ya da eşim ayrılınca kısayol kaybolur
  useEffect(() => {
    if (pair && !roster.some((p) => p.id === pair.id)) setPair(null)
  }, [pair, roster])

  // ---- kalkma / dansı bırakma ----
  const stand = useCallback(
    (fromInput) => {
      const s = together.self.current
      if (!s) return
      together.self.current = null
      setSelfPose(null)
      setPair(null)
      send({ t: 'pose_end' })
      if (!fromInput && s.kind === 'sit') {
        // koltuğun önüne (sandalyede arkasına: önünde masa var) çık
        const dir = s.style === 'chair' ? -1 : 1
        const [x, z] = (together.collide ?? resolveCollisions)(s.x + Math.sin(s.ry) * 0.75 * dir, s.z + Math.cos(s.ry) * 0.75 * dir)
        focusRef.current.teleport = [x, z, s.ry]
      }
    },
    [send, focusRef],
  )
  useEffect(() => {
    together.onBreak = stand
    return () => {
      together.onBreak = null
    }
  }, [stand])

  // ---- fotoğraf ----
  const startShoot = useCallback(() => {
    if (!together.capture) return say('Kamera henüz hazır değil, birazdan tekrar dene 📸')
    setPhoto(null)
    setShoot({ n: 3 })
  }, [say])
  useEffect(() => {
    if (!shoot) return
    if (shoot.n > 0) {
      window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: { name: 'beep', final: shoot.n === 1 } }))
      const t = setTimeout(() => setShoot({ n: shoot.n - 1 }), 900)
      return () => clearTimeout(t)
    }
    // çekim: önce ekran beyaza parlasın, kare alınır, önizleme açılır
    let alive = true
    setFlash(true)
    window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'shutter' }))
    const done = setTimeout(() => setFlash(false), 450)
    ;(async () => {
      try {
        const shot = together.capture?.()
        if (!shot) throw new Error('kare yok')
        const out = await composePhoto(shot)
        if (!alive) return
        const item = { id: Date.now().toString(36), ts: Date.now(), url: out.thumb }
        setAlbum(saveToAlbum(who, item))
        setPhoto(out)
        send({ t: 'photo_taken' })
      } catch {
        if (alive) say('Fotoğraf çekilemedi 😿 Tekrar dene.')
      } finally {
        if (alive) setShoot(null)
      }
    })()
    return () => {
      alive = false
      clearTimeout(done)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shoot])

  // ---- 4 Hz izleyici: koltuk istemi, fotoğraf noktası, gün batımı anı ----
  const momentRef = useRef(null)
  const hold = useRef({ id: null, since: 0, cooldown: 0 })
  const rosterRef = useRef(roster)
  useEffect(() => {
    rosterRef.current = roster
  }, [roster])
  useEffect(() => {
    momentRef.current = moment
  }, [moment])
  useEffect(() => {
    const endMoment = (now) => {
      momentRef.current = null
      setMoment(null)
      together.sky.target = 0
      hold.current = { id: null, since: 0, cooldown: now + SUNSET_COOLDOWN_MS }
    }
    const tick = () => {
      const f = focusRef.current
      const now = Date.now()
      const posed = Boolean(together.self.current)

      // koltuk
      let opt = null
      const seats = venue ? venueSeats(venue) : home ? null : SEATS // evde koltuk yok; mekânda iç mekân koltukları
      if (seats && !posed) {
        const taken = together.takenSeats()
        let best = SIT_PROMPT
        for (const seat of seats) {
          if (Math.abs(seat.x - f.x) > 4 || Math.abs(seat.z - f.z) > 4) continue
          seat.slots.forEach((sl, i) => {
            if (taken.has(`${seat.id}:${i}`)) return
            const d = Math.hypot(sl.x - f.x, sl.z - f.z)
            if (d < best) {
              best = d
              opt = { seat: seat.id, slot: i, kind: seat.kind }
            }
          })
        }
      }
      setSeatOpt((p) => (p?.seat === opt?.seat && p?.slot === opt?.slot ? p : opt))
      const spot = venue ? venueLayout(venue)?.photo : home ? null : PHOTO_SPOT // şehirde dış nokta, Fotoğraf Stüdyosu'nda iç nokta
      setPhotoNear(Boolean(spot) && Math.hypot(f.x - spot.x, f.z - spot.z) < spot.radius)

      // yakında biri var mı + gün batımı adayı
      let any = false
      let cand = null
      let candD = SUNSET_DIST
      const onBeach = !home && !venue && zoneAt(f.x, f.z).id === 'beach'
      for (const r of net.remotes.current.values()) {
        const d = Math.hypot(r.x - f.x, r.z - f.z)
        if (d < NEAR_ANY) any = true
        if (onBeach && d < candD && r.anim === 'idle' && !rosterRef.current.find((p) => p.id === r.id)?.dnd) {
          cand = r
          candD = d
        }
      }
      setNearAny(any)

      const m = momentRef.current
      if (m) {
        const partner = net.remotes.current.get(m.id)
        const ok = onBeach && partner && Math.hypot(partner.x - f.x, partner.z - f.z) < SUNSET_DIST * 2 && now < m.until
        if (!ok) endMoment(now)
      } else if (now > hold.current.cooldown) {
        if (cand && f.anim === 'idle') {
          if (hold.current.id !== cand.id) hold.current = { ...hold.current, id: cand.id, since: now }
          else if (now - hold.current.since >= SUNSET_HOLD_MS) {
            const mm = { id: cand.id, name: cand.name, until: now + SUNSET_MS }
            momentRef.current = mm
            setMoment(mm)
            together.sky.target = 1
          }
        } else hold.current = { ...hold.current, id: null }
      }
    }
    const id = setInterval(tick, 250)
    return () => {
      clearInterval(id)
      together.sky.target = 0
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, venue, focusRef])

  // ---- eylemler ----
  const sit = useCallback(() => {
    if (!seatOpt) return
    if (!send({ t: 'sit', seat: seatOpt.seat, slot: seatOpt.slot })) say('Şu an çevrimdışısın.')
  }, [seatOpt, send, say])

  // E tuşu: kalk > otur > fotoğraf çek
  const keyRef = useRef(null)
  useEffect(() => {
    keyRef.current = () => {
      if (shoot || photo) return
      if (together.self.current) return stand(false)
      if (seatOpt) return sit()
      if (photoNear) return startShoot()
    }
  })
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'KeyE' || isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return
      keyRef.current?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ---- dışarıya verilenler ----
  const peerActions = (peer) => [
    {
      key: 'dance',
      emoji: '💃',
      label: 'Dansa davet',
      onClick: () => {
        send({ t: 'dance_invite', to: peer.id })
        closeInteract()
      },
    },
  ]

  const settingsSections = [
    <section key="photos" className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-[#4a3b5c]">📸 Fotoğraf albümü</p>
        <p className="text-xs font-semibold text-[#8a7a9c]">Lobideki Fotoğraf Stüdyosu’nda çektiğin son 12 kare bu tarayıcıda saklanır ({album.length}/12).</p>
      </div>
      <button onClick={() => setPanel('photos')} className="shrink-0 rounded-xl bg-[#e9ddff] px-3 py-2 text-xs font-extrabold text-[#5b3fa8] active:scale-95">
        Albümü aç
      </button>
    </section>,
  ]

  const busy = Boolean(shoot || photo || panel === 'photos')
  const answer = (accept) => {
    if (!offer) return
    send({ t: 'dance_reply', id: offer.id, accept })
    setOffer(null)
  }
  const danceMate = selfPose?.kind === 'dance' ? roster.find((p) => p.id === selfPose.mate) : null

  const overlays = (
    <>
      <SunsetVeil />
      <div className="pointer-events-none absolute inset-x-0 top-16 z-20 flex flex-col items-center gap-2 px-3">
        {offer && <DanceOfferCard offer={offer} onAnswer={answer} />}
        {selfPose?.kind === 'dance' && (
          <Chip>
            <span className="text-2xl" aria-hidden>
              💃
            </span>
            <p className="min-w-0 flex-1 truncate text-sm font-black text-[#4a3b5c]">{danceMate ? `${danceMate.name} ile dans ediyorsun` : 'Dans ediyorsun'}</p>
            <button onClick={() => stand(false)} className="shrink-0 rounded-xl border-b-4 border-[#c9b6f5] bg-[#e9ddff] px-3 py-1.5 text-xs font-extrabold text-[#5b3fa8] active:translate-y-[2px] active:border-b-2">
              Bitir
            </button>
          </Chip>
        )}
        {pair && selfPose?.kind === 'sit' && (
          <Chip>
            <span className="text-2xl" aria-hidden>
              💞
            </span>
            <p className="min-w-0 flex-1 truncate text-sm font-black text-[#4a3b5c]">{pair.kind === 'table' ? `☕ ${pair.name} ile masayı paylaşıyorsunuz` : `${pair.name} ile yan yanasınız`}</p>
            <button
              onClick={() => {
                openChat(pair.id)
                setPair(null)
              }}
              className="shrink-0 rounded-xl border-b-4 border-[#e8952c] bg-[#fdb252] px-3 py-1.5 text-xs font-extrabold text-white active:translate-y-[2px] active:border-b-2"
            >
              Sohbet et
            </button>
          </Chip>
        )}
        {moment && <SunsetCard moment={moment} />}
      </div>

      {!busy && selfPose?.kind === 'sit' && (
        <DoorPrompt emoji="🪑" label={selfPose.style === 'lounger' ? 'Uzanıyorsun' : 'Oturuyorsun'} action="Kalk" touch={touch} raised={nearAny} onGo={() => stand(false)} />
      )}
      {!busy && !selfPose && seatOpt && <DoorPrompt emoji="🪑" label={SEAT_LABEL[seatOpt.kind]} action="Otur" touch={touch} raised={nearAny} onGo={sit} />}
      {!busy && !selfPose && !seatOpt && photoNear && <PhotoPrompt touch={touch} raised={nearAny} onShoot={startShoot} onAlbum={() => setPanel('photos')} />}

      {shoot && shoot.n > 0 && <Countdown n={shoot.n} />}
      {flash && <div aria-hidden className="pointer-events-none absolute inset-0 z-40 bg-white [animation:together-flash_0.45s_ease-out_forwards]" />}
      {photo && (
        <PhotoPreview
          photo={photo}
          onClose={() => setPhoto(null)}
          onAgain={() => {
            setPhoto(null)
            startShoot()
          }}
          onAlbum={() => {
            setPhoto(null)
            setPanel('photos')
          }}
        />
      )}
      {panel === 'photos' && <AlbumModal list={album} onDelete={(id) => setAlbum(removeFromAlbum(who, id))} onClose={() => setPanel(null)} />}
    </>
  )

  return { peerActions, settingsSections, overlays }
}
