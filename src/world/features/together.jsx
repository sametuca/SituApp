// Birlikte yapılan şeyler: oturma, çift dans ve fotoğraf kabini.
// Sunucu tarafı (oturma/dans): server/features/together.js. Fotoğraf yalnızca istemcidedir.
// 3D parçalar: TogetherScene.jsx (World.jsx Canvas'ında), duruş çizimi: avatarPose.js + AvatarRig.
import { Dock } from '../../components/Dock'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ToyButton } from '../../components/ui'
import { DoorPrompt } from '../Social'
import { PHOTO_SPOT, SEATS, SEAT_LABEL, resolveCollisions } from '../layout'
import { AlbumModal, Countdown, PhotoPreview, composePhoto, loadAlbum, removeFromAlbum, saveToAlbum } from './photo'
import { venueLayout, venueSeats } from '../venueLayout'
import { together } from './togetherStore'
import Portrait from '../Portrait'

const glass = 'border-2 border-white bg-white/85 shadow-soft backdrop-blur-md'
const SIT_PROMPT = 1.7 // m: bu kadar yakında boş koltuk varsa "Otur" çıkar
const NEAR_ANY = 4.5 // m: yakında biri varsa istemler yukarı kayar (yakın oyuncu kartıyla çakışmasın)
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

function PhotoPrompt({ touch, raised, onShoot, onAlbum }) {
  return (
    <Dock><div className="pointer-events-auto relative w-[min(92vw,21rem)] animate-pop" role="status">
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
    </div></Dock>
  )
}

// ---------- ana hook ----------
export function useTogether(ctx) {
  const { net, say, touch, roster, focusRef, home, venue, atDoor, panel, setPanel, openChat, closeInteract } = ctx
  const { on, send } = net
  const who = net.homeKey

  const [selfPose, setSelfPose] = useState(null)
  const [offer, setOffer] = useState(null) // gelen dans daveti { id, name, avatar, until }
  const [pair, setPair] = useState(null) // bankta yan yana oturduğum kişi { id, name, avatar }
  const [seatOpt, setSeatOpt] = useState(null)
  const [fullSeat, setFullSeat] = useState(null) // yakındaki koltuk/masa tamamen doluysa: kind
  const [photoNear, setPhotoNear] = useState(false)
  const [nearAny, setNearAny] = useState(false)
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
      if (!s.solo) send({ t: 'pose_end' })
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

  // ---- 4 Hz izleyici: koltuk istemi ve fotoğraf noktası ----
  useEffect(() => {
    const tick = () => {
      const f = focusRef.current
      const posed = Boolean(together.self.current)

      // koltuk (boş yer varsa seatOpt, hepsi doluysa fullSeat uyarısı)
      let opt = null
      let full = null
      const seats = venue ? venueSeats(venue) : home ? null : SEATS // evde koltuk yok; mekânda iç mekân koltukları
      if (seats && !posed) {
        const taken = together.takenSeats()
        const groupCount = new Map()
        for (const s of seats) {
          if (!s.group) continue
          let cnt = 0
          s.slots.forEach((_, idx) => {
            if (taken.has(`${s.id}:${idx}`)) cnt++
          })
          if (cnt > 0) groupCount.set(s.group, (groupCount.get(s.group) ?? 0) + cnt)
        }
        let best = SIT_PROMPT
        let bestFull = SIT_PROMPT
        for (const seat of seats) {
          if (Math.abs(seat.x - f.x) > 4 || Math.abs(seat.z - f.z) > 4) continue
          const tableFull = seat.kind === 'table' && seat.group && (groupCount.get(seat.group) ?? 0) >= 2
          const singleFull = (seat.kind === 'lounger' || seat.kind === 'towel') && seat.slots.some((_, k) => taken.has(`${seat.id}:${k}`))
          seat.slots.forEach((sl, i) => {
            const d = Math.hypot(sl.x - f.x, sl.z - f.z)
            if (taken.has(`${seat.id}:${i}`) || tableFull || singleFull) {
              if (d < bestFull) {
                bestFull = d
                full = seat.kind
              }
              return
            }
            if (d < best) {
              best = d
              opt = { seat: seat.id, slot: i, kind: seat.kind, style: seat.style ?? seat.kind, x: sl.x, z: sl.z, ry: seat.ry }
            }
          })
        }
      }
      setSeatOpt((p) => (p?.seat === opt?.seat && p?.slot === opt?.slot ? p : opt))
      setFullSeat((p) => {
        const next = opt ? null : full
        return p === next ? p : next
      })
      const spot = venue ? venueLayout(venue)?.photo : home ? null : PHOTO_SPOT // şehirde dış nokta, Fotoğraf Stüdyosu'nda iç nokta
      setPhotoNear(Boolean(spot) && Math.hypot(f.x - spot.x, f.z - spot.z) < spot.radius)

      // Yakında oyuncu varsa etkileşim istemlerini biraz yukarı al.
      let any = false
      for (const r of net.remotes.current.values()) {
        const d = Math.hypot(r.x - f.x, r.z - f.z)
        if (d < NEAR_ANY) any = true
      }
      setNearAny(any)
    }
    const id = setInterval(tick, 250)
    return () => {
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, venue, focusRef])

  // ---- eylemler ----
  const sit = useCallback(() => {
    if (!seatOpt) return
    if (!send({ t: 'sit', seat: seatOpt.seat, slot: seatOpt.slot })) {
      // çevrimdışı modda yerel oturma
      const pose = {
        kind: 'sit',
        style: seatOpt.style ?? seatOpt.kind,
        seatKind: seatOpt.kind,
        seat: seatOpt.seat,
        slot: seatOpt.slot,
        x: seatOpt.x,
        z: seatOpt.z,
        ry: seatOpt.ry,
        t0: nowS(),
      }
      together.self.current = pose
      setSelfPose(pose)
      focusRef.current.teleport = [pose.x, pose.z, pose.ry]
    }
  }, [seatOpt, send, focusRef])

  // E tuşu: kalk > (kapı önündeysen kapı öncelikli) > otur > fotoğraf çek
  const keyRef = useRef(null)
  useEffect(() => {
    keyRef.current = () => {
      if (shoot || photo) return
      if (together.self.current) return stand(false)
      if (atDoor) return
      if (seatOpt) return sit()
      if (fullSeat) return say('Boş yer yok 🪑')
      if (photoNear) return startShoot()
    }
  })
  useEffect(() => {
    const onKey = (e) => {
      if ((e.code !== 'KeyE' && e.key !== 'e' && e.key !== 'E') || isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return
      keyRef.current?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ---- dışarıya verilenler ----
  const peerActions = (peer) => [
    {
      key: 'dance',
      category: 'events',
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
        <p className="text-sm font-black text-[#4a3b5c]">Fotoğraf albümü</p>
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
      </div>

      {!busy && selfPose?.kind === 'sit' && (
        <DoorPrompt emoji={selfPose.style === 'lounger' ? '🏖️' : '🪑'} label={selfPose.style === 'lounger' ? 'Dinleniyorsun' : 'Oturuyorsun'} action="Kalk" touch={touch} raised={nearAny} onGo={() => stand(false)} />
      )}
      {!busy && !atDoor && !selfPose && seatOpt && (
        <DoorPrompt
          emoji={seatOpt.style === 'lounger' ? '🏖️' : '🪑'}
          label={SEAT_LABEL[seatOpt.kind]}
          action={seatOpt.style === 'lounger' ? 'Uzan' : 'Otur'}
          touch={touch}
          raised={nearAny}
          onGo={sit}
        />
      )}
      {!busy && !atDoor && !selfPose && !seatOpt && fullSeat && (
        <Dock><div className="pointer-events-none relative w-[min(92vw,18rem)] animate-pop" role="status">
          <div className={`flex items-center justify-center gap-2 rounded-3xl px-4 py-2.5 text-sm font-black text-[#8a7a9c] ${glass}`}>
            <span aria-hidden>{fullSeat === 'lounger' || fullSeat === 'towel' ? '🏖️' : '🪑'}</span>
            <span>
              {fullSeat === 'table'
                ? 'Masa dolu (en fazla 2 kişi)'
                : fullSeat === 'lounger'
                  ? 'Şezlong dolu (1/1)'
                  : fullSeat === 'towel'
                    ? 'Havlu dolu (1/1)'
                    : 'Boş yer yok'}
            </span>
          </div>
        </div></Dock>
      )}
      {!busy && !atDoor && !selfPose && !seatOpt && photoNear && <PhotoPrompt touch={touch} raised={nearAny} onShoot={startShoot} onAlbum={() => setPanel('photos')} />}

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
