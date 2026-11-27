// Sörf Yarışı — Dalgalardan Kaç! (2–10 oyunculu gerçek zamanlı + tek kişilik bot antrenmanı + genel puan tablosu).
// Sörfçü Kaan'dan (Quicksörf) açılır. Sörf sırasında 3B avatar geçici olarak sörf kıyafetine (turkuaz wetsuit + gözlük) geçer.
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Ico } from '../../components/Icon'
import { cosStore } from '../cosStore'

import { BOT_NAMES, fmtSec, loadLocalBoard } from './surfData'
import SurfArena from './SurfArenaLazy'
export function useSurf({ net, panel, setPanel, touch, say, name }) {
  const { on, send } = net
  const [view, setView] = useState('lobby') // lobby | board | play | result
  const [lobby, setLobby] = useState({ players: [], min: 2, max: 10, startsAt: 0 })
  const [joined, setJoined] = useState(false)
  const [board, setBoard] = useState(() => loadLocalBoard())
  const [match, setMatch] = useState(null)
  const [result, setResult] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const remoteRef = useRef([])
  const savedCosRef = useRef(null)

  const active = panel === 'surf'

  // Sörf ekranındayken 3B avatara geçici olarak sörf kıyafeti (turkuaz wetsuit + güneş gözlüğü) giydir
  useEffect(() => {
    if (!active) return undefined
    const prev = cosStore.get('self')
    savedCosRef.current = prev ? { ...prev } : null
    cosStore.set('self', {
      ...(prev ?? {}),
      acc: { id: 'shades', color: 'coral' },
      look: { ...(prev?.look ?? { h: -1, e: -1, o: -1 }), o: '#1ea8c7' },
    })
    return () => {
      if (savedCosRef.current) cosStore.set('self', savedCosRef.current)
      else cosStore.set('self', { acc: null, acc2: null, pet: null, look: null })
    }
  }, [active])

  // Sörfçü Kaan'dan gelen açma olayı
  useEffect(() => {
    const onOpen = (e) => {
      const mode = e.detail?.mode === 'board' ? 'board' : 'lobby'
      setView(mode)
      setResult(null)
      setPanel('surf')
      send({ t: 'surf_board' })
    }
    window.addEventListener('situapp:open-surf', onOpen)
    return () => window.removeEventListener('situapp:open-surf', onOpen)
  }, [send, setPanel])

  // Sunucu mesajları
  useEffect(() => {
    const offs = [
      on('surf_board', (m) => {
        if (Array.isArray(m.top)) setBoard(m.top)
      }),
      on('surf_lobby', (m) => {
        setLobby({ players: m.players ?? [], min: m.min ?? 2, max: m.max ?? 10, startsAt: m.startsAt ?? 0 })
        const isIn = (m.players ?? []).some((p) => p.id === net.selfId.current)
        setJoined(isIn)
      }),
      on('surf_left', () => setJoined(false)),
      on('surf_start', (m) => {
        remoteRef.current = m.players ?? []
        setMatch({ matchId: m.matchId, seed: m.seed, startAt: m.startAt, players: m.players ?? [], practice: false })
        setJoined(false)
        setResult(null)
        setView('play')
      }),
      on('surf_state', (m) => {
        remoteRef.current = m.players ?? []
      }),
      on('surf_end', (m) => {
        setMatch(null)
        setResult(m)
        if (Array.isArray(m.top)) setBoard(m.top)
        setView('result')
        window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: m.winner?.id === net.selfId.current ? 'badge' : 'quest' }))
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [on, net.selfId])

  useEffect(() => {
    if (!active || !lobby.startsAt) return undefined
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [active, lobby.startsAt])

  const closeAll = useCallback(() => {
    if (joined || match) send({ t: 'surf_leave' })
    setJoined(false)
    setMatch(null)
    setResult(null)
    setPanel(null)
  }, [joined, match, send, setPanel])

  const joinLobby = () => {
    if (!send({ t: 'surf_join' })) {
      say('Çevrimdışısın — Botlarla Sörf Antrenmanına hemen başlayabilirsin! 🏄')
      return
    }
    setJoined(true)
  }

  const leaveLobby = () => {
    send({ t: 'surf_leave' })
    setJoined(false)
  }

  const startPractice = () => {
    if (joined) send({ t: 'surf_leave' })
    setJoined(false)
    const meId = net.selfId.current ?? 'local'
    const players = [
      { id: meId, name: name || 'Sen', x: 0.5, isBot: false },
      ...BOT_NAMES.map((bn, i) => ({ id: `bot_${i}`, name: bn, x: 0.16 + i * 0.22, isBot: true })),
    ]
    setMatch({
      matchId: `practice_${Date.now()}`,
      seed: Math.floor(Math.random() * 1_000_000),
      startAt: Date.now() + 2600,
      players,
      practice: true,
    })
    setResult(null)
    setView('play')
  }

  const onSendPos = useCallback((p) => send({ t: 'surf_pos', ...p }), [send])
  const onLocalOut = useCallback((ms) => send({ t: 'surf_out', ms }), [send])
  const onBotFinish = useCallback((res) => {
    setMatch(null)
    setResult(res)
    if (Array.isArray(res.top)) setBoard(res.top)
    setView('result')
    window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: res.winner?.id === (net.selfId.current ?? 'local') ? 'badge' : 'quest' }))
  }, [net.selfId])

  const cdSec = lobby.startsAt ? Math.max(0, Math.ceil((lobby.startsAt - now) / 1000)) : 0

  const overlays = active ? (
    view === 'play' && match ? (
      <Suspense fallback={<div className="fixed inset-0 z-50 grid place-items-center bg-[#155a75]/80 text-lg font-black text-white">🏄 Yarış hazırlanıyor…</div>}>
        <SurfArena
          match={match}
          selfId={net.selfId.current ?? 'local'}
          selfName={name || 'Sen'}
          touch={touch}
          remoteRef={remoteRef}
          onSendPos={onSendPos}
          onLocalOut={onLocalOut}
          onBotFinish={onBotFinish}
          onExit={closeAll}
        />
      </Suspense>
    ) : (
      <div className="fixed inset-0 z-40 grid place-items-center bg-[#155a75]/45 p-4 backdrop-blur-[2px]" onClick={closeAll}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Sörf Yarışı"
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-[90svh] w-[min(94vw,29rem)] animate-pop flex-col overflow-hidden rounded-[2rem] border-2 border-white bg-white/95 p-5 shadow-toy backdrop-blur-md"
        >
          {/* Başlık */}
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-black text-[#4a3b5c]">Sörf Yarışı</h2>
              <p className="text-xs font-bold text-[#8a7a9c]">Dalgalardan kaç, en sona kalan kazanır! (2–10 kişi)</p>
            </div>
            <button type="button" onClick={closeAll} aria-label="Kapat" className="grid h-9 w-9 place-items-center rounded-full bg-[#f6f0ff] text-sm font-black text-[#8a7a9c] hover:bg-[#ffedd6]">
              ✖️
            </button>
          </div>

          {/* Sekmeler */}
          <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-2xl bg-[#eef8fc] p-1">
            <button
              type="button"
              onClick={() => setView('lobby')}
              className={`rounded-xl py-2 text-xs font-black transition ${view !== 'board' ? 'bg-white text-[#12688a] shadow-sm' : 'text-[#6c8a99]'}`}
            >
              Yarış Lobisi
            </button>
            <button
              type="button"
              onClick={() => {
                setView('board')
                send({ t: 'surf_board' })
              }}
              className={`rounded-xl py-2 text-xs font-black transition ${view === 'board' ? 'bg-white text-[#8a5a00] shadow-sm' : 'text-[#6c8a99]'}`}
            >
              Puan Tablosu
            </button>
          </div>

          {/* İçerik */}
          <div className="mt-3 flex-1 overflow-y-auto">
            {view === 'board' ? (
              <div className="flex flex-col gap-1.5">
                {board.length === 0 ? (
                  <p className="py-8 text-center text-sm font-bold text-[#8a7a9c]">Henüz sörf skoru yok — ilk şampiyon sen ol! 🏄</p>
                ) : (
                  board.map((r, i) => (
                    <div key={r.key ?? i} className={`flex items-center gap-2.5 rounded-2xl px-3 py-2 ${i === 0 ? 'bg-[#fff3c4]' : 'bg-[#f6f0ff]/70'}`}>
                      <span className="w-7 text-center text-sm font-black text-[#4a3b5c]">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-[#4a3b5c]">{r.name}</p>
                        <p className="text-[11px] font-bold text-[#8a7a9c]">
                          {r.wins} galibiyet · En iyi {fmtSec(r.bestMs)}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-[#12688a] shadow-sm">
                        {r.points} puan
                      </span>
                    </div>
                  ))
                )}
              </div>
            ) : view === 'result' && result ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="rounded-3xl bg-gradient-to-br from-[#fff3c4] via-[#ffffff] to-[#dff7ff] px-5 py-4 shadow-soft">
                  <p className="text-3xl">🏆</p>
                  <p className="mt-1 text-lg font-black text-[#4a3b5c]">
                    {result.winner ? `${result.winner.name} Kazandı!` : 'Yarış Bitti!'}
                  </p>
                  {result.practice && <p className="text-xs font-bold text-[#8a7a9c]">Bot antrenmanı · Skorun tabloya kaydedildi</p>}
                </div>
                <div className="flex w-full flex-col gap-1.5 text-left">
                  {(result.standings ?? []).map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-2xl bg-[#f6f0ff]/75 px-3 py-2 text-xs font-extrabold text-[#4a3b5c]">
                      <span>
                        {s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : `#${s.rank}`} {s.name}
                      </span>
                      <span className="text-[#12688a]">
                        {fmtSec(s.ms)} · +{s.pts} puan{s.coins ? ` · +${s.coins} ₺` : ''}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex w-full gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResult(null)
                      setView('lobby')
                    }}
                    className="flex-1 rounded-2xl border-b-4 border-[#157c9c] bg-[#22b8cf] py-2.5 text-sm font-black text-white active:translate-y-[2px]"
                  >
                    Lobiye Dön
                  </button>
                  <button
                    type="button"
                    onClick={startPractice}
                    className="flex-1 rounded-2xl border-b-4 border-[#d98a1c] bg-[#fdb252] py-2.5 text-sm font-black text-white active:translate-y-[2px]"
                  >
                    Tekrar Sörf
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="rounded-2xl bg-[#eef8fc] p-3.5 text-center">
                  <p className="text-xs font-black text-[#12688a]">
                    👕 Sörf kıyafetin (turkuaz wetsuit & gözlük) otomatik giyildi!
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#5b7a8a]">
                    Gelen dalgaların boşluklarından kay, sıkışınca <b>Zıpla</b> ile dalganın üstünden atla.
                  </p>
                </div>

                {/* Çok oyunculu lobi kutusu */}
                <div className="rounded-2xl border-2 border-[#dff3ff] bg-[#fafdff] p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-[#4a3b5c]">
                      Bekleyen Sörfçüler ({lobby.players.length}/{lobby.max})
                    </span>
                    {cdSec > 0 ? (
                      <span className="rounded-full bg-[#fdb252] px-2.5 py-0.5 text-xs font-black text-white">
                        {cdSec} sn sonra başlıyor!
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#e9ddff] px-2.5 py-0.5 text-[11px] font-black text-[#5b4678]">
                        Min. {lobby.min} kişi
                      </span>
                    )}
                  </div>
                  {lobby.players.length === 0 ? (
                    <p className="mt-2 text-xs font-bold text-[#8a7a9c]">
                      Şu an bekleyen yok. Lobiye katıl, 1 arkadaşın daha gelince 10 sn içinde başlar!
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {lobby.players.map((p) => (
                        <span key={p.id} className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#4a3b5c] shadow-sm">
                          🏄 {p.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex gap-2">
                    {joined ? (
                      <button
                        type="button"
                        onClick={leaveLobby}
                        className="w-full rounded-2xl border-2 border-[#ffd2d2] bg-[#fff5f5] py-2.5 text-sm font-black text-[#b54141] active:scale-95"
                      >
                        Lobiden Ayrıl
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={joinLobby}
                        className="w-full rounded-2xl border-b-4 border-[#157c9c] bg-[#22b8cf] py-2.5 text-sm font-black text-white shadow-soft active:translate-y-[2px]"
                      >
                        🏄 Arkadaş Bekle / Katıl (2–10 Kişi)
                      </button>
                    )}
                  </div>
                </div>

                {/* Tek başına / hemen deneme (botlarla 5 kişilik yarış) */}
                <button
                  type="button"
                  onClick={startPractice}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border-b-4 border-[#d98a1c] bg-[#fdb252] py-3 text-sm font-black text-white shadow-soft active:translate-y-[2px]"
                >
                  <Ico name="quests" size={18} color="#ffffff" />
                  Hemen Oyna (5 Sörfçü · Botlarla)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  ) : null

  return { overlays }
}
