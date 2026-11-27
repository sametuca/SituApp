// Spor salonu ve boks özelliği (istemci): useFitness hook'u, paneller; arena BoxingArena.jsx'te.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { STAT_KEYS, STAT_META, STAT_MAX, STAT_START, coinBonusPct, energyMax } from '../boxing'
import { cosStore } from '../cosStore'
import { fitnessStore } from '../fitnessStore'
import { work } from './jobStore'
import { DoorPrompt } from '../Social'
import { Modal } from '../Hud'
import { CardioWorkoutModal, WeightWorkoutModal } from './WorkoutModals'
import { consumeLocalEnergy, isTyping, pushLocalBoard, readLocalAttr, readLocalBoard, readLocalEnergy, saveLocalAttr } from './fitnessLocal'
import { BoxingArena } from './BoxingArena'
// ======================= 4. ANA HOOK: useFitness =======================
export function useFitness({ net, say, name, venue, focusRef, panel, setPanel, touch, atDoor }) {
  const { on, send } = net
  const [attr, setAttr] = useState(readLocalAttr)
  const [energy, setEnergy] = useState(() => readLocalEnergy(readLocalAttr()).left)
  const [eMax, setEMax] = useState(() => readLocalEnergy(readLocalAttr()).max)
  const [board, setBoard] = useState(readLocalBoard)
  const [champKey, setChampKey] = useState(null)
  const [selfKey, setSelfKey] = useState(null)
  const [lobby, setLobby] = useState([])
  const [queued, setQueued] = useState(false)
  const [tab, setTab] = useState('lobby') // lobby | train | board
  const [workout, setWorkout] = useState(null) // 'str' | 'sta' | null
  const [match, setMatch] = useState(null)
  const [liveState, setLiveState] = useState(null)
  const [result, setResult] = useState(null)
  const [nearEq, setNearEq] = useState(null) // 'weights' | 'cardio' | 'ring' | null
  const savedCos = useRef(null)

  const inBoxingModal = panel === 'boxing'
  const inStatsModal = panel === 'stats'
  const isChamp = Boolean(champKey && selfKey && champKey === selfKey)

  // Stat & şampiyon deposunu güncel tut (LocalPlayer hızı + 3D şampiyon kemeri için)
  useEffect(() => {
    fitnessStore.set({ attr, champKey })
  }, [attr, champKey])

  // Haftalık şampiyon altın kemerini avatara otomatik tak
  useEffect(() => {
    const cur = cosStore.get('self') ?? {}
    if (Boolean(cur.belt) !== isChamp) cosStore.set('self', { ...cur, belt: isChamp })
  }, [isChamp])

  // Boks lobisi/maçı açıkken otomatik 3D boks kıyafeti (eldiven + şort tonu) giydir, çıkınca geri yükle
  useEffect(() => {
    if (!inBoxingModal && !match) return undefined
    const prev = cosStore.get('self')
    savedCos.current = prev ? { ...prev } : null
    cosStore.set('self', {
      ...(prev ?? {}),
      gloves: true,
      belt: isChamp,
      look: { ...(prev?.look ?? { h: -1, e: -1, o: -1 }), o: '#ff6b6b' },
    })
    return () => {
      const base = savedCos.current ?? { acc: null, acc2: null, pet: null, look: null }
      cosStore.set('self', { ...base, gloves: false, belt: isChamp })
    }
  }, [inBoxingModal, match, isChamp])

  // Sunucu mesajları
  useEffect(() => {
    const offs = [
      on('welcome', (m) => {
        if (m.home) setSelfKey(m.home)
        if (m.fitness) {
          setAttr(m.fitness.attr)
          setEnergy(m.fitness.energy)
          setEMax(m.fitness.energyMax)
          setChampKey(m.fitness.champKey ?? null)
        }
      }),
      on('fitness_state', (m) => {
        if (m.attr) setAttr(m.attr)
        if (m.energy != null) setEnergy(m.energy)
        if (m.energyMax != null) setEMax(m.energyMax)
        if (m.champKey !== undefined) setChampKey(m.champKey)
      }),
      on('box_info', (m) => {
        if (m.attr) setAttr(m.attr)
        if (m.energy != null) setEnergy(m.energy)
        if (m.energyMax != null) setEMax(m.energyMax)
        if (Array.isArray(m.top)) setBoard(m.top)
        if (m.champKey !== undefined) setChampKey(m.champKey)
        if (Array.isArray(m.lobby)) setLobby(m.lobby)
      }),
      on('box_lobby', (m) => {
        const list = m.players ?? []
        setLobby(list)
        setQueued(list.some((p) => p.id === net.selfId.current))
      }),
      on('box_left', () => setQueued(false)),
      on('box_start', (m) => {
        setQueued(false)
        setResult(null)
        setLiveState(null)
        setMatch({ mid: m.mid, seed: m.seed, startAt: m.startAt, you: m.you, opp: m.opp, solo: false })
        setPanel('boxing')
      }),
      on('box_state', (m) => setLiveState(m)),
      on('box_end', (m) => {
        setMatch(null)
        setLiveState(null)
        setResult(m)
        if (Array.isArray(m.top)) setBoard(m.top)
        if (m.champKey !== undefined) setChampKey(m.champKey)
        window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: m.res === 'win' ? 'badge' : 'pop' }))
      }),
      on('box_train_res', (m) => {
        if (!m.ok) {
          if (m.reason === 'energy') say('⚡ Bugünkü antrenman enerjin bitti, yarın yeniden dolacak!')
          return
        }
        setAttr(m.attr)
        setEnergy(m.energy)
        setEMax(m.energyMax)
        const meta = STAT_META[m.kind]
        say(`${meta.emoji} Antrenman tamam! +${m.gain} ${meta.name} kazandın (+${m.coins} ₺)`)
        window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'quest' }))
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [on, net.selfId, say, setPanel])

  // NPC ve özel olaylardan açma
  useEffect(() => {
    const onOpenBox = (e) => {
      setTab(e.detail?.mode === 'board' ? 'board' : 'lobby')
      setResult(null)
      setPanel('boxing')
      send({ t: 'box_info' })
    }
    const onOpenWork = (e) => {
      const k = e.detail?.kind === 'sta' ? 'sta' : 'str'
      setWorkout(k)
      send({ t: 'box_info' })
    }
    window.addEventListener('situapp:open-boxing', onOpenBox)
    window.addEventListener('situapp:open-workout', onOpenWork)
    return () => {
      window.removeEventListener('situapp:open-boxing', onOpenBox)
      window.removeEventListener('situapp:open-workout', onOpenWork)
    }
  }, [send, setPanel])

  // MakFit içindeyken aletlere (bench press, koşu bandı, ring) yaklaşınca hızlı etkileşim istemi
  useEffect(() => {
    if (venue !== 'fitness') {
      setNearEq(null)
      return undefined
    }
    const id = setInterval(() => {
      const f = focusRef.current
      if (!f) return
      const dW = Math.hypot(f.x - 4.5, f.z - -2.4)
      const dC = Math.hypot(f.x - 5.2, f.z - 1.5)
      const dR = Math.hypot(f.x - -3.2, f.z - -0.6)
      if (dW < 2.1) setNearEq('weights')
      else if (dC < 2.2) setNearEq('cardio')
      else if (dR < 2.95) setNearEq('ring')
      else setNearEq(null)
    }, 250)
    return () => clearInterval(id)
  }, [venue, focusRef])

  const openNearEq = useCallback(() => {
    if (!nearEq) return
    if (nearEq === 'weights') setWorkout('str')
    else if (nearEq === 'cardio') setWorkout('sta')
    else if (nearEq === 'ring') {
      setTab('lobby')
      setResult(null)
      setPanel('boxing')
      send({ t: 'box_info' })
    }
  }, [nearEq, send, setPanel])

  useEffect(() => {
    if (!nearEq || panel || workout || match || atDoor) return undefined
    const onKey = (e) => {
      if (isTyping(e)) return
      if (e.code === 'KeyE') openNearEq()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nearEq, panel, workout, match, atDoor, openNearEq])

  useEffect(() => {
    if (venue !== 'fitness') return
    useGLTF.preload('/models/venues/boxer-red.glb')
    useGLTF.preload('/models/venues/boxer-blue.glb')
  }, [venue])

  const finishWorkout = useCallback(
    (kind, reps, perfects) => {
      if (send({ t: 'box_train', kind, reps, perfects })) return
      // Çevrimdışı yerel fallback
      const en = consumeLocalEnergy(attr)
      if (!en.ok) {
        setEnergy(0)
        return say('⚡ Bugünkü antrenman enerjin bitti!')
      }
      const gain = reps >= 10 || perfects >= 5 ? 3 : reps >= 5 ? 2 : 1
      const next = { ...attr, [kind]: Math.min(STAT_MAX, Math.floor(attr[kind]) + gain) }
      saveLocalAttr(next)
      setAttr(next)
      setEnergy(en.left)
      setEMax(energyMax(next))
      say(`${STAT_META[kind].emoji} Antrenman tamam! +${gain} ${STAT_META[kind].name} kazandın!`)
    },
    [attr, send, say],
  )

  const startSoloBox = () => {
    if (queued) send({ t: 'box_leave' })
    setQueued(false)
    setResult(null)
    setLiveState(null)
    setMatch({
      mid: `solo_${Date.now()}`,
      seed: Math.floor(Math.random() * 1_000_000),
      startAt: Date.now() + 800,
      you: { str: Math.floor(attr.str), sta: Math.floor(attr.sta), ski: Math.floor(attr.ski) },
      opp: { id: 'coach', name: 'Koç Kaan', str: 14, sta: 14, ski: 14 },
      solo: true,
    })
  }

  const onSoloEnd = useCallback(
    (res, reason, score) => {
      setMatch(null)
      const pts = res === 'win' ? (reason === 'ko' ? 90 : 65) : res === 'draw' ? 35 : 15
      const top = pushLocalBoard(name || 'Sen', res === 'win', res === 'win' && reason === 'ko', pts)
      setBoard(top)
      setResult({ res, reason, pts, coins: 0, solo: true, score })
      window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: res === 'win' ? 'badge' : 'pop' }))
    },
    [name],
  )

  // MakFit içinde ağırlık/koşu antrenmanındayken karakteri aletin yanına konumlandırıp canlı 3B antrenman pozu oynat
  useEffect(() => {
    if (!workout) return undefined
    if (venue === 'fitness' && focusRef.current) {
      focusRef.current.teleport = workout === 'str' ? [3.55, -2.4, Math.PI / 2] : [4.4, 1.5, 0]
    }
    work.self.current = { kind: 'work', style: workout === 'str' ? 'bench' : 'cardio', t0: performance.now() / 1000 }
    return () => {
      if (work.self.current?.style === 'bench' || work.self.current?.style === 'cardio') work.self.current = null
    }
  }, [workout, venue, focusRef])

  const closeBoxing = () => {
    if (queued || match) send({ t: 'box_leave' })
    setQueued(false)
    setMatch(null)
    setLiveState(null)
    setResult(null)
    setPanel(null)
  }

  const menuNodes = (
    <button
      onClick={() => {
        setPanel('stats')
        send({ t: 'box_info' })
      }}
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-extrabold text-[#4a3b5c] transition hover:bg-[#fff8f0]"
    >
      <span className="text-lg">💪</span>
      <span className="flex-1">Statlar ve Enerji</span>
      <span className="rounded-full bg-[#fff3c8] px-2 py-0.5 text-[11px] font-black text-[#8a5a00]">⚡ {energy}/{eMax}</span>
    </button>
  )

  const promptMeta =
    nearEq === 'weights'
      ? { emoji: '💪', label: 'Ağırlık Sehpası (+Güç)', action: 'Çalış' }
      : nearEq === 'cardio'
        ? { emoji: '🏃', label: 'Koşu Bandı (+Kondisyon)', action: 'Koş' }
        : nearEq === 'ring'
          ? { emoji: '🥊', label: 'MakFit Boks Ringi', action: 'Ringe Çık' }
          : null

  const overlays = (
    <>
      {promptMeta && !panel && !workout && !match && !atDoor && (
        <DoorPrompt emoji={promptMeta.emoji} label={promptMeta.label} action={promptMeta.action} touch={touch} onGo={openNearEq} />
      )}

      {workout === 'str' && (
        <WeightWorkoutModal
          ski={Math.floor(attr.ski)}
          energy={energy}
          energyMaxVal={eMax}
          onDone={(r, p) => finishWorkout('str', r, p)}
          onClose={() => setWorkout(null)}
        />
      )}

      {workout === 'sta' && (
        <CardioWorkoutModal
          energy={energy}
          energyMaxVal={eMax}
          onDone={(r, p) => finishWorkout('sta', r, p)}
          onClose={() => setWorkout(null)}
        />
      )}

      {match && (
        <BoxingArena
          match={match}
          selfName={name || 'Sen'}
          liveState={liveState}
          onSendHit={(i, type) => send({ t: 'box_hit', i, type })}
          onSoloEnd={onSoloEnd}
          onExit={closeBoxing}
        />
      )}

      {inBoxingModal && !match && (
        <Modal onClose={closeBoxing} label="MakFit Boks Ringi" theme="gym">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-black text-white">MakFit Ringi</h2>
              <p className="text-xs font-semibold text-white/65">Ritmi yakala, haftalık kemeri al.</p>
            </div>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black text-[#ffd35e]">⚡ {energy}/{eMax}</span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-2xl bg-white/10 p-1">
            {[
              ['lobby', 'Ring'],
              ['train', 'Antrenman'],
              ['board', 'Sıralama'],
            ].map(([id, lbl]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTab(id)
                  if (id === 'board') send({ t: 'box_info' })
                }}
                className={`rounded-xl py-2 text-xs font-black transition ${tab === id ? 'bg-[#ff7e70] text-white shadow-sm' : 'text-white/70'}`}
              >
                {lbl}
              </button>
            ))}
          </div>

          <div className="mt-3">
            {result ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-full rounded-3xl bg-gradient-to-br from-[#fff3c4] via-white to-[#efe6ff] p-5 shadow-soft">
                  <p className="text-4xl">{result.res === 'win' ? '🏆' : result.res === 'draw' ? '🤝' : '🥊'}</p>
                  <p className="mt-1 text-lg font-black text-[#4a3b5c]">
                    {result.res === 'win' ? (result.reason === 'ko' ? 'NAKAVT İLE KAZANDIN!' : 'MAÇI KAZANDIN!') : result.res === 'draw' ? 'BERABERE!' : 'İYİ MÜCADELE!'}
                  </p>
                  <p className="mt-1 text-xs font-extrabold text-[#6b4fc0]">
                    +{result.pts} sıralama puanı{result.coins ? ` · +${result.coins} ₺` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="w-full rounded-2xl border-b-4 border-[#d96c5b] bg-[#ff8a7a] py-3 text-sm font-black text-white"
                >
                  Ringe Dön 🥊
                </button>
              </div>
            ) : tab === 'board' ? (
              <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
                {board.length === 0 ? (
                  <p className="py-8 text-center text-sm font-bold text-[#8a7a9c]">Bu hafta henüz maç yok — ilk şampiyon sen ol! 🏆</p>
                ) : (
                  board.map((r, i) => (
                    <div key={r.key ?? i} className={`flex items-center gap-2.5 rounded-2xl px-3 py-2 ${i === 0 ? 'bg-[#fff3c4]' : 'bg-[#f6f0ff]/75'}`}>
                      <span className="w-7 text-center text-sm font-black text-[#4a3b5c]">{i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-[#4a3b5c]">
                          {r.name} {i === 0 ? '· Altın Kemer' : ''}
                        </p>
                        <p className="text-[11px] font-bold text-[#8a7a9c]">{r.wins} galibiyet · {r.ko} KO</p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-[#5b3fa8] shadow-sm">{r.points} p</span>
                    </div>
                  ))
                )}
              </div>
            ) : tab === 'train' ? (
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setPanel(null)
                    setWorkout('str')
                  }}
                  className="flex items-center justify-between rounded-2xl border-2 border-[#ffd4cd] bg-[#fff5f3] p-3.5 text-left transition hover:bg-[#ffebe7]"
                >
                  <div>
                    <p className="text-sm font-black text-[#4a3b5c]">Ağırlık Sehpası (+Güç)</p>
                    <p className="text-xs font-bold text-[#8a7a9c]">Boks yumruk hasarını artırır · Mevcut: {Math.floor(attr.str)}</p>
                  </div>
                  <span className="rounded-xl bg-[#ff8a7a] px-3 py-1.5 text-xs font-black text-white">Çalış</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPanel(null)
                    setWorkout('sta')
                  }}
                  className="flex items-center justify-between rounded-2xl border-2 border-[#cbe8ff] bg-[#f2faff] p-3.5 text-left transition hover:bg-[#e5f4ff]"
                >
                  <div>
                    <p className="text-sm font-black text-[#4a3b5c]">Koşu Bandı (+Kondisyon)</p>
                    <p className="text-xs font-bold text-[#8a7a9c]">Savunma, enerji ve koşu hızı · Mevcut: {Math.floor(attr.sta)}</p>
                  </div>
                  <span className="rounded-xl bg-[#7fcdf3] px-3 py-1.5 text-xs font-black text-white">Koş</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="rounded-2xl border-2 border-[#efe6ff] bg-[#fcfaff] p-3.5">
                  <div className="flex items-center justify-between text-xs font-black text-[#4a3b5c]">
                    <span>1v1 Oyuncu Lobisi</span>
                    <span className="rounded-full bg-[#e9ddff] px-2.5 py-0.5 text-[#5b3fa8]">{lobby.length} bekliyor</span>
                  </div>
                  <div className="mt-3">
                    {queued ? (
                      <button
                        type="button"
                        onClick={() => {
                          send({ t: 'box_leave' })
                          setQueued(false)
                        }}
                        className="w-full rounded-2xl border-2 border-[#ffd2d2] bg-[#fff5f5] py-2.5 text-sm font-black text-[#b54141]"
                      >
                        Rakip Aranıyor… (İptal Et)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (!send({ t: 'box_queue' })) say('Çevrimdışısın — Koç Kaan ile hemen antrenman maçına çıkabilirsin!')
                          else setQueued(true)
                        }}
                        className="w-full rounded-2xl border-b-4 border-[#d96c5b] bg-[#ff8a7a] py-2.5 text-sm font-black text-white shadow-soft active:translate-y-[2px]"
                      >
                        Başka Oyuncuyla Maç Ara (1v1)
                      </button>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={startSoloBox}
                  className="w-full rounded-2xl border-b-4 border-[#d98a1c] bg-[#fdb252] py-3 text-sm font-black text-white shadow-soft active:translate-y-[2px]"
                >
                  Koç Kaan ile Antrenman Maçı
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {inStatsModal && (
        <Modal onClose={() => setPanel(null)} label="Karakter Statları" theme="bag">
          <div className="mb-3 flex items-center gap-2">
            <div className="grid flex-1 grid-cols-3 gap-1.5 rounded-2xl bg-[#f3ece0] p-1">
              <button type="button" onClick={() => setPanel('inventory')} className="rounded-xl py-1.5 text-xs font-black text-[#8a7a68]">Çanta</button>
              <button type="button" className="rounded-xl bg-white py-1.5 text-xs font-black text-[#4a3b5c] shadow-sm">Statlar</button>
              <button type="button" onClick={() => setPanel('collection')} className="rounded-xl py-1.5 text-xs font-black text-[#8a7a68]">Koleksiyon</button>
            </div>
            <button
              type="button"
              onClick={() => setPanel(null)}
              aria-label="Kapat"
              className="h-9 shrink-0 rounded-full bg-[#f3ece0] px-3 text-xs font-black text-[#6b5a4e] transition hover:bg-[#eadcc8] active:scale-95"
            >
              Kapat
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-black text-[#4a3b5c]">Statlar</h2>
              <p className="text-xs font-bold text-[#8a7a9c]">MakFit antrenmanları ve sosyal aktivitelerle gelişir.</p>
            </div>
            <span className="rounded-full bg-[#fff3c8] px-3 py-1 text-xs font-black text-[#8a5a00]">{energy}/{eMax}</span>
          </div>

          {isChamp && (
            <div className="mt-3 rounded-2xl bg-gradient-to-r from-[#fff3c4] to-[#ffe49e] px-3.5 py-2 text-center text-xs font-black text-[#8a5a00]">
              Bu haftanın MakFit Boks Şampiyonusun! Altın kemerin aktif.
            </div>
          )}

          <div className="mt-3 flex flex-col gap-2.5">
            {STAT_KEYS.map((k) => {
              const m = STAT_META[k]
              const val = Math.floor(attr[k] ?? STAT_START)
              const bonus =
                k === 'str'
                  ? `+%${Math.round((val / 100) * 60)} boks hasarı`
                  : k === 'sta'
                    ? `-%${Math.round((val / 100) * 30)} hasar · +%${Math.round((val / 100) * 12)} koşu`
                    : k === 'cha'
                      ? `+%${coinBonusPct(val)} TL bonusu`
                      : `+${Math.round(val * 0.95)} ms zamanlama`
              return (
                <div key={k} className="rounded-2xl bg-[#f8f4ff] p-3">
                  <div className="flex items-center justify-between text-xs font-black text-[#4a3b5c]">
                    <span>{m.name}</span>
                    <span className="text-[#6b4fc0]">{val}/{STAT_MAX} · {bonus}</span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full transition-all" style={{ width: `${val}%`, backgroundColor: m.color }} />
                  </div>
                  <p className="mt-1 text-[11px] font-bold text-[#8a7a9c]">{m.how}</p>
                </div>
              )
            })}
          </div>
        </Modal>
      )}
    </>
  )

  return { menuNodes, overlays }
}
