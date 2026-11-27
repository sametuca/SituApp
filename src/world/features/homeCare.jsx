// Ev bahçesi & bakım sorumluluğu + arkadaşını eve davet etme özelliği.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal } from '../Hud'
import { DoorPrompt } from '../Social'
import { ToyButton } from '../../components/ui'
import { CROPS, CROP_BY_ID, LAND_TIERS, MAX_LAND_TIER, applyLandTier, clampLandTier, cropProgress, gardenPlots, loadGarden, loadLandTier, saveGarden, saveLandTier } from '../homeGarden'

const PLOT_RADIUS = 1.65
const todayKey = () => new Date().toISOString().slice(0, 10)
function loadCare(ownerKey) {
  try {
    const raw = JSON.parse(localStorage.getItem(`situapp_care:${ownerKey || 'local'}`) || '{}')
    if (raw.day !== todayKey()) return { day: todayKey(), plant: false, water: false, harvest: false, claimed: false }
    return raw
  } catch {
    return { day: todayKey(), plant: false, water: false, harvest: false, claimed: false }
  }
}
function saveCare(ownerKey, c) {
  try {
    localStorage.setItem(`situapp_care:${ownerKey || 'local'}`, JSON.stringify(c))
  } catch {
    /* ignore */
  }
}

export function useHomeCare({ net, home, focusRef, touch, say, panel }) {
  const { on, send } = net
  const isOwnHome = Boolean(home) && (!home.owner || home.owner === net.homeKey)
  const ownerKey = home?.owner || net.homeKey || 'local'

  const [plots, setPlots] = useState(() => loadGarden(ownerKey))
  const [landTier, setLandTier] = useState(() => loadLandTier(ownerKey))
  const [care, setCare] = useState(() => loadCare(ownerKey))
  const [diaryOpen, setDiaryOpen] = useState(false)
  const [kudosSent, setKudosSent] = useState(false)
  const [coins, setCoins] = useState(0)
  const [landOpen, setLandOpen] = useState(false)
  const [nearIdx, setNearIdx] = useState(null)
  const [pickPlot, setPickPlot] = useState(null) // tohum seçme modalı için tarh indeksi
  const [friends, setFriends] = useState([])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [invitedSet, setInvitedSet] = useState(() => new Set())
  const [inviteCard, setInviteCard] = useState(null) // { from, key, name }
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    applyLandTier(landTier)
  }, [landTier])

  useEffect(() => {
    setPlots(loadGarden(ownerKey))
    setCare(loadCare(ownerKey))
    setKudosSent(false)
    const lt = loadLandTier(ownerKey)
    setLandTier(lt)
    applyLandTier(lt)
    if (home && send({ t: 'garden_get', owner: ownerKey })) {
      /* sunucudan güncel bahçeyi ister */
    }
  }, [home, ownerKey, send])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const offs = [
      on('welcome', (m) => {
        if (m.friends?.list) setFriends(m.friends.list)
        if (m.coins != null) setCoins(m.coins)
        if (m.landTier != null && isOwnHome) {
          const lt = clampLandTier(m.landTier)
          setLandTier(lt)
          saveLandTier(ownerKey, lt)
        }
      }),
      on('coins', (m) => setCoins(m.n)),
      on('friends', (m) => {
        if (m.list) setFriends(m.list)
      }),
      on('garden_state', (m) => {
        if (m.owner === ownerKey && Array.isArray(m.plots)) {
          setPlots(m.plots)
          saveGarden(ownerKey, m.plots)
          if (m.landTier != null) {
            const lt = clampLandTier(m.landTier)
            setLandTier(lt)
            saveLandTier(ownerKey, lt)
          }
        }
      }),
      on('home_invite', (m) => {
        setInviteCard({ key: m.key, name: m.name })
      }),
      on('home_kudos', (m) => {
        say(`💗 ${m.from} evini ve bahçeni çok beğendi!`)
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [on, ownerKey, isOwnHome, say])

  // Bahçe tarhlarına yaklaşma kontrolü (4 Hz)
  useEffect(() => {
    if (!home) {
      setNearIdx(null)
      setPickPlot(null)
      return
    }
    const coords = gardenPlots(landTier)
    const id = setInterval(() => {
      const f = focusRef.current
      let best = null
      let bd = PLOT_RADIUS
      coords.forEach((pt, i) => {
        const d = Math.hypot(f.x - pt.x, f.z - pt.z)
        if (d < bd) {
          bd = d
          best = i
        }
      })
      setNearIdx((prev) => (prev === best ? prev : best))
    }, 250)
    return () => clearInterval(id)
  }, [home, focusRef, landTier])

  const commitPlots = useCallback(
    (next) => {
      setPlots(next)
      saveGarden(ownerKey, next)
    },
    [ownerKey],
  )

  const markCare = useCallback(
    (field) => {
      setCare((prev) => {
        if (prev[field]) return prev
        const next = { ...prev, day: todayKey(), [field]: true }
        saveCare(ownerKey, next)
        return next
      })
    },
    [ownerKey],
  )

  const plantCrop = useCallback(
    (idx, cropId) => {
      if (!isOwnHome) return
      const c = CROP_BY_ID[cropId]
      if (!c) return
      send({ t: 'garden_plant', idx, crop: cropId })
      const next = plots.slice()
      next[idx] = { crop: cropId, plantedAt: Date.now(), wateredAt: null }
      commitPlots(next)
      markCare('plant')
      setPickPlot(null)
      say(`${c.emoji} ${c.name} ekildi! Sulamayı unutma 💧`)
    },
    [isOwnHome, plots, commitPlots, markCare, send, say],
  )

  const waterPlot = useCallback(
    (idx) => {
      if (!isOwnHome) return
      const slot = plots[idx]
      if (!slot || slot.wateredAt) return
      if (!send({ t: 'garden_water', idx })) {
        const next = plots.slice()
        next[idx] = { ...slot, wateredAt: Date.now() }
        commitPlots(next)
      }
      markCare('water')
      say('💧 Bitkin sulandı, daha hızlı büyüyecek!')
    },
    [isOwnHome, plots, commitPlots, markCare, send, say],
  )

  const harvestPlot = useCallback(
    (idx) => {
      if (!isOwnHome) return
      const slot = plots[idx]
      if (!slot) return
      const c = CROP_BY_ID[slot.crop]
      if (!send({ t: 'garden_harvest', idx })) {
        const next = plots.slice()
        next[idx] = null
        commitPlots(next)
      }
      markCare('harvest')
      if (c) say(`${c.emoji} ${c.name} hasat edildi! +${c.coins} ₺`)
      window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'collect' }))
    },
    [isOwnHome, plots, commitPlots, markCare, send, say],
  )

  const interactPlot = useCallback(
    (idx) => {
      if (!isOwnHome) return
      const slot = plots[idx]
      if (!slot) return setPickPlot(idx)
      const st = cropProgress(slot, Date.now())
      if (st.ready) return harvestPlot(idx)
      if (!st.watered) return waterPlot(idx)
      const sec = Math.ceil(st.leftMs / 1000)
      say(`🌱 Büyüyor (${sec} sn kaldı)`)
    },
    [isOwnHome, plots, harvestPlot, waterPlot, say],
  )

  // E tuşu ile tarh etkileşimi
  const interactRef = useRef(interactPlot)
  useEffect(() => {
    interactRef.current = interactPlot
  })
  useEffect(() => {
    if (!home || !isOwnHome || nearIdx == null) return
    const onKey = (e) => {
      if ((e.code !== 'KeyE' && e.key !== 'e' && e.key !== 'E') || e.ctrlKey || e.metaKey || e.altKey) return
      const typing = e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)
      if (typing) return
      interactRef.current(nearIdx)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [home, isOwnHome, nearIdx])

  const activeCount = LAND_TIERS[clampLandTier(landTier)].cols * 3
  // Bahçe bakım özeti
  let needWater = 0
  let readyCount = 0
  let plantedCount = 0
  for (let i = 0; i < activeCount; i++) {
    const s = plots[i]
    if (!s) continue
    plantedCount++
    const st = cropProgress(s, now)
    if (st.ready) readyCount++
    else if (!st.watered) needWater++
  }

  const nearSlot = nearIdx != null ? plots[nearIdx] : null
  const nearSt = nearSlot ? cropProgress(nearSlot, now) : null
  const nearCrop = nearSlot ? CROP_BY_ID[nearSlot.crop] : null

  const inviteFriend = (f) => {
    if (!send({ t: 'home_invite', to: f.key })) {
      return say('Davet göndermek için çevrimiçi olmalısın.')
    }
    setInvitedSet((s) => new Set(s).add(f.key))
    say(`💌 ${f.name} evine davet edildi!`)
  }

  const careDone = (care.plant ? 1 : 0) + (care.water ? 1 : 0) + (care.harvest ? 1 : 0)

  const waterAll = () => {
    const next = plots.slice()
    let count = 0
    for (let i = 0; i < activeCount; i++) {
      const s = next[i]
      if (s && !s.wateredAt && !cropProgress(s, now).ready) {
        if (!send({ t: 'garden_water', idx: i })) next[i] = { ...s, wateredAt: Date.now() }
        count++
      }
    }
    if (count > 0) {
      commitPlots(next)
      markCare('water')
      say(`💧 ${count} bitki topluca sulandı!`)
    }
  }

  const harvestAll = () => {
    const next = plots.slice()
    let count = 0
    let totalCoins = 0
    for (let i = 0; i < activeCount; i++) {
      const s = next[i]
      if (s && cropProgress(s, now).ready) {
        const c = CROP_BY_ID[s.crop]
        totalCoins += c?.coins ?? 0
        if (!send({ t: 'garden_harvest', idx: i })) next[i] = null
        count++
      }
    }
    if (count > 0) {
      commitPlots(next)
      markCare('harvest')
      say(`🧺 ${count} ürün topluca hasat edildi! (+${totalCoins} ₺)`)
      window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'collect' }))
    }
  }

  const claimCareBonus = () => {
    if (careDone < 3 || care.claimed) return
    const next = { ...care, claimed: true }
    setCare(next)
    saveCare(ownerKey, next)
    if (!send({ t: 'garden_bonus' })) {
      say('🏡 Günlük ev bakım ödülü: +25 ₺!')
    }
  }

  const overlays = (
    <>
      {/* Ziyaretçi beğeni düğmesi */}
      {home && !isOwnHome && (
        <div className="pointer-events-auto absolute left-16 top-3 z-10">
          <button
            disabled={kudosSent}
            onClick={() => {
              setKudosSent(true)
              send({ t: 'home_kudos', owner: ownerKey })
              say('💗 Ev sahibine beğeni gönderildi!')
            }}
            className={`flex items-center gap-1.5 rounded-full border-2 border-white px-3.5 py-1.5 text-xs font-black shadow-soft transition active:scale-95 ${kudosSent ? 'bg-[#ffe4ec] text-[#be185d]' : 'bg-[#ffd6e4] text-[#9d174d] hover:bg-[#ffc2d6]'}`}
          >
            <span>{kudosSent ? '💗' : '❤️'}</span>
            <span>{kudosSent ? 'Beğenildi!' : 'Evi Beğen'}</span>
          </button>
        </div>
      )}

      {/* Ev içindeyken üstte Bahçe & Bakım + Eve Davet çubuğu */}
      {home && isOwnHome && (
        <div className="pointer-events-auto absolute left-16 top-3 z-10 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 rounded-2xl border-2 border-white bg-white/92 px-3 py-1.5 shadow-soft">
            <span className="text-base">🌱</span>
            <div className="text-xs font-extrabold text-[#4a3b5c]">
              {readyCount > 0 ? (
                <span className="text-[#c9731a]">{readyCount} hasat hazır!</span>
              ) : needWater > 0 ? (
                <span className="text-[#2563eb]">{needWater} bitki sulama bekliyor</span>
              ) : plantedCount > 0 ? (
                <span className="text-[#2f7a55]">Bahçen büyüyor ({plantedCount}/{activeCount})</span>
              ) : (
                <span>Bahçene tohum ek!</span>
              )}
            </div>
            {readyCount > 1 && (
              <button onClick={harvestAll} className="rounded-full bg-[#fff3c4] px-2.5 py-0.5 text-[0.6875rem] font-black text-[#8a5a00] transition hover:bg-[#ffe899] active:scale-95">
                🧺 Hepsini Topla
              </button>
            )}
            {needWater > 1 && (
              <button onClick={waterAll} className="rounded-full bg-[#dbeafe] px-2.5 py-0.5 text-[0.6875rem] font-black text-[#1d4ed8] transition hover:bg-[#bfdbfe] active:scale-95">
                💧 Hepsini Sula
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setInviteOpen(true)}
              className="flex items-center gap-1.5 rounded-full border-2 border-white bg-[#ffeed9] px-3 py-1 text-xs font-black text-[#8a5a00] shadow-soft transition hover:bg-[#ffe1bf] active:scale-95"
            >
              <span>💌</span>
              <span>Eve Davet Et</span>
            </button>
            <button
              onClick={() => setDiaryOpen(true)}
              className="flex items-center gap-1.5 rounded-full border-2 border-white bg-[#f3e8ff] px-3 py-1 text-xs font-black text-[#5b4678] shadow-soft transition hover:bg-[#e9ddff] active:scale-95"
            >
              <span>📋</span>
              <span>Bakım {careDone}/3</span>
            </button>
          </div>
        </div>
      )}

      {/* Yakındaki tarh istemi */}
      {home && isOwnHome && nearIdx != null && pickPlot == null && !panel && (
        <DoorPrompt
          emoji={!nearSlot ? '🌱' : nearSt?.ready ? nearCrop?.emoji : '💧'}
          label={!nearSlot ? 'Boş Bahçe Tarhı' : nearSt?.ready ? `${nearCrop?.name} Hazır!` : !nearSt?.watered ? `${nearCrop?.name} susadı` : `${nearCrop?.name} büyüyor`}
          action={!nearSlot ? 'Ek' : nearSt?.ready ? 'Topla' : !nearSt?.watered ? 'Sula' : 'Durum'}
          touch={touch}
          onGo={() => interactPlot(nearIdx)}
        />
      )}

      {/* Tohum seçme modalı */}
      {pickPlot != null && (
        <Modal onClose={() => setPickPlot(null)} label="Tohum Ek">
          <h2 className="text-xl font-black text-ink">🌱 Bahçene Ne Ekmek İstersin?</h2>
          <p className="mt-1 text-xs font-semibold text-ink-soft">Ektikten sonra sulamayı unutma; sulanan bitkiler iki kat hızlı büyür!</p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {CROPS.map((c) => (
              <button
                key={c.id}
                onClick={() => plantCrop(pickPlot, c.id)}
                className="flex items-center gap-2.5 rounded-2xl border-2 border-white bg-white/85 p-3 text-left shadow-soft transition hover:border-[#b79cff] hover:bg-[#faf5ff] active:scale-95"
              >
                <span className="text-2xl">{c.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-[#4a3b5c]">{c.name}</p>
                  <p className="text-[0.6875rem] font-bold text-[#8a7a9c]">
                    {Math.round(c.ms / 1000)} sn · +{c.coins} ₺
                  </p>
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Arkadaşını eve davet et modalı */}
      {inviteOpen && (
        <Modal onClose={() => setInviteOpen(false)} label="Eve Davet Et">
          <h2 className="text-xl font-black text-ink">💌 Arkadaşını Eve Davet Et</h2>
          <p className="mt-1 text-xs font-semibold text-ink-soft">Dekorasyonunu ve bahçeni görmeleri için çevrimiçi arkadaşlarını çağır.</p>
          <div className="mt-4 flex max-h-60 flex-col gap-2 overflow-y-auto">
            {friends.filter((f) => f.online).length === 0 ? (
              <p className="rounded-2xl bg-[#f6f0ff] p-4 text-center text-sm font-semibold text-[#8a7a9c]">
                Şu an çevrimiçi arkadaşın yok. Arkadaş ekleyip davet edebilirsin!
              </p>
            ) : (
              friends
                .filter((f) => f.online)
                .map((f) => {
                  const sent = invitedSet.has(f.key)
                  return (
                    <div key={f.key} className="flex items-center justify-between gap-2 rounded-2xl border-2 border-white bg-white/80 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-[#4a3b5c]">{f.name}</p>
                        <p className="truncate text-[0.6875rem] font-bold text-[#8a7a9c]">📍 {f.where || 'Şehirde'}</p>
                      </div>
                      <button
                        disabled={sent}
                        onClick={() => inviteFriend(f)}
                        className={`rounded-full px-3 py-1 text-xs font-black text-white transition active:scale-95 ${sent ? 'bg-[#a8d5ba]' : 'bg-[#a88bff] hover:bg-[#9370ff]'}`}
                      >
                        {sent ? 'Davet Edildi ✔️' : 'Davet Et'}
                      </button>
                    </div>
                  )
                })
            )}
          </div>
          <ToyButton onClick={() => setInviteOpen(false)} className="mt-4 !py-2.5 !text-sm">
            Kapat
          </ToyButton>
        </Modal>
      )}

      {/* Günlük Ev & Bahçe Bakım Günlüğü */}
      {diaryOpen && (
        <Modal onClose={() => setDiaryOpen(false)} label="Ev Bakım Günlüğü">
          <h2 className="text-xl font-black text-ink">📋 Günlük Ev & Bahçe Bakımı</h2>
          <p className="mt-1 text-xs font-semibold text-ink-soft">Her gün bahçene uğrayıp 3 bakımı tamamla, +25 TL bonus kazan!</p>
          <ul className="mt-4 flex flex-col gap-2">
            {[
              { ok: care.plant, emoji: '🌱', title: 'Tohum Ek', desc: 'Bahçedeki boş bir tarha tohum ek' },
              { ok: care.water, emoji: '💧', title: 'Bitki Sula', desc: 'Büyüyen bir bitkini sula' },
              { ok: care.harvest, emoji: '🧺', title: 'Hasat Yap', desc: 'Olgunlaşan ürünü topla' },
            ].map((t) => (
              <li key={t.title} className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-2 ${t.ok ? 'border-[#9be7a8] bg-[#eefcf1]' : 'border-white bg-white/80'}`}>
                <span className="text-2xl">{t.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-[#4a3b5c]">{t.title}</p>
                  <p className="text-xs font-semibold text-[#8a7a9c]">{t.desc}</p>
                </div>
                <span className="text-lg">{t.ok ? '✅' : '⬜'}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xs font-black text-[#8a7a9c]">İlerleme: {careDone}/3</span>
            {care.claimed ? (
              <span className="rounded-full bg-[#eefcf1] px-3 py-1.5 text-xs font-black text-[#2f7a55]">Bugünkü ödül alındı ✔️</span>
            ) : (
              <ToyButton onClick={claimCareBonus} disabled={careDone < 3} className="!w-auto !px-5 !py-2 !text-sm">
                {careDone < 3 ? '3/3 Tamamla' : '+25 ₺ Ödülü Al'}
              </ToyButton>
            )}
          </div>
        </Modal>
      )}

      {/* Arazi genişletme modalı */}
      {landOpen && (
        <Modal onClose={() => setLandOpen(false)} label="Araziyi Büyüt">
          <h2 className="text-xl font-black text-ink">🌿 Araziyi Büyüt</h2>
          <p className="mt-1 text-xs font-semibold text-ink-soft">Bahçeni genişleterek daha fazla tarh aç ve daha çok ürün yetiştir.</p>
          <ul className="mt-4 flex flex-col gap-2">
            {LAND_TIERS.map((t, i) => {
              const state = i < landTier ? 'done' : i === landTier ? 'now' : i === landTier + 1 ? 'next' : 'locked'
              return (
                <li key={t.id} className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-2 ${state === 'now' ? 'border-[#9be7a8] bg-[#eefcf1]' : 'border-white bg-white/75'} ${state === 'locked' ? 'opacity-55' : ''}`}>
                  <span className="text-2xl">{t.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-[#4a3b5c]">
                      {t.name} {state === 'now' && <span className="ml-1 rounded-full bg-[#6cd47e] px-2 py-0.5 text-[0.625rem] text-white">Arazin</span>}
                    </p>
                    <p className="text-xs font-semibold text-[#8a7a9c]">{t.desc}</p>
                  </div>
                  {state === 'done' && <span className="text-lg">✅</span>}
                  {state === 'next' && <span className="text-xs font-black text-[#8a5a00]">₺ {t.price}</span>}
                </li>
              )
            })}
          </ul>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="rounded-full bg-[#fff3c8] px-3 py-1 text-sm font-black text-[#8a5a00]">₺ {coins}</span>
            {landTier < MAX_LAND_TIER ? (
              <ToyButton
                onClick={() => {
                  const next = LAND_TIERS[landTier + 1]
                  if (!send({ t: 'land_upgrade' })) {
                    const lt = clampLandTier(landTier + 1)
                    setLandTier(lt)
                    saveLandTier(ownerKey, lt)
                    say(`${next.emoji} Arazin ${next.name} oldu!`)
                  }
                  setLandOpen(false)
                }}
                disabled={net.status === 'online' && coins < LAND_TIERS[landTier + 1].price}
              >
                {net.status === 'online' && coins < LAND_TIERS[landTier + 1].price
                  ? `${LAND_TIERS[landTier + 1].price - coins} TL eksik`
                  : `${LAND_TIERS[landTier + 1].name}'a geç`}
              </ToyButton>
            ) : (
              <span className="text-sm font-extrabold text-[#8a7a9c]">En büyük arazidesin 🎉</span>
            )}
          </div>
        </Modal>
      )}

      {/* Gelen ev daveti kartı */}
      {inviteCard && (
        <div className="pointer-events-auto fixed left-1/2 top-20 z-30 flex w-[min(92vw,22rem)] -translate-x-1/2 animate-pop items-center gap-3 rounded-3xl border-2 border-white bg-white/95 p-3 shadow-lg">
          <span className="text-2xl">🏡</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-[#4a3b5c]">{inviteCard.name} seni evine davet ediyor!</p>
          </div>
          <button
            onClick={() => {
              const k = inviteCard.key
              setInviteCard(null)
              window.dispatchEvent(new CustomEvent('situapp:visit-home', { detail: k }))
            }}
            className="rounded-full bg-[#fdb252] px-3 py-1 text-xs font-black text-white transition hover:brightness-105 active:scale-95"
          >
            Evine Git
          </button>
          <button onClick={() => setInviteCard(null)} aria-label="Kapat" className="text-xs font-black text-[#8a7a9c]">
            ✖️
          </button>
        </div>
      )}
    </>
  )

  return {
    garden: plots,
    landTier,
    onPlotClick: interactPlot,
    onOpenLand: () => setLandOpen(true),
    overlays,
  }
}
