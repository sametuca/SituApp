// 5 Çok Oyunculu Mini Oyun Merkezi: Lobi (2–10 kişi) + Botlarla Hemen Oyna + Otomatik Kıyafet + Genel Puan Tablosu.
import { useCallback, useEffect, useRef, useState } from 'react'
import { cosStore } from '../cosStore'
import { BalloonPopArena, BaristaArena, BikeSprintArena, ColorTilesArena, RhythmArena } from './minigameArenas'

const GAME_META = {
  rhythm: {
    id: 'rhythm',
    title: 'Ritim & Dans Savaşı',
    emoji: '🪩',
    desc: 'Düşen disko notalarına ritimle bas, en yüksek komboyu yap!',
    outfitNote: 'Parlak disko kıyafeti & hale otomatik giyildi!',
    outfit: { acc: { id: 'halo', color: 'gold' }, color: '#7a5fd0' },
    Arena: RhythmArena,
  },
  tiles: {
    id: 'tiles',
    title: 'Renk Karosu',
    emoji: '🎮',
    desc: 'Söylenen renge koş, yanlış karoda kalan düşer!',
    outfitNote: 'Neon oyun tulumu & kulaklık otomatik giyildi!',
    outfit: { acc: { id: 'headphones', color: 'blue' }, color: '#3b82f6' },
    Arena: ColorTilesArena,
  },
  barista: {
    id: 'barista',
    title: 'Barista Sipariş Yarışı',
    emoji: '☕',
    desc: 'Müşteri siparişlerini doğru katman sırasıyla en hızlı hazırla!',
    outfitNote: 'Barista önlüğü & bere otomatik giyildi!',
    outfit: { acc: { id: 'beret', color: 'peach' }, color: '#6b4226' },
    Arena: BaristaArena,
  },
  bike: {
    id: 'bike',
    title: 'Bisiklet Engel Yarışı',
    emoji: '🚲',
    desc: 'Engellerden kaç, ⚡ hız şeritleriyle rekor kır!',
    outfitNote: 'Spor forma & gözlük otomatik giyildi!',
    outfit: { acc: { id: 'shades', color: 'yellow' }, color: '#2bb89a' },
    Arena: BikeSprintArena,
  },
  balloon: {
    id: 'balloon',
    title: 'Balon Patlatma',
    emoji: '🎈',
    desc: 'Bombalara dokunmadan yükselen balonları patlat!',
    outfitNote: 'Parti kombini & şapka otomatik giyildi!',
    outfit: { acc: { id: 'hat', color: 'yellow' }, color: '#ff8fb8' },
    Arena: BalloonPopArena,
  },
}

const LOCAL_KEY = (g) => `situapp_mg_board_${g}`
const readBoard = (g) => {
  try {
    const a = JSON.parse(localStorage.getItem(LOCAL_KEY(g)))
    return Array.isArray(a) ? a : []
  } catch {
    return []
  }
}
const pushLocalBoard = (g, name, score) => {
  try {
    const list = readBoard(g)
    const key = name || 'Sen'
    const pts = Math.max(15, Math.min(100, Math.round(score / 8)))
    const i = list.findIndex((r) => r.name === key)
    if (i >= 0) {
      list[i].points += pts
      list[i].wins += score >= 300 ? 1 : 0
      list[i].best = Math.max(list[i].best, score)
    } else {
      list.push({ key, name: key, points: pts, wins: score >= 300 ? 1 : 0, best: score })
    }
    list.sort((a, b) => b.points - a.points || b.best - a.best)
    localStorage.setItem(LOCAL_KEY(g), JSON.stringify(list.slice(0, 15)))
    return list.slice(0, 15)
  } catch {
    return []
  }
}

export function useMinigames({ net, panel, setPanel, touch, say, name }) {
  const { on, send } = net
  const [gameId, setGameId] = useState('rhythm')
  const [view, setView] = useState('lobby') // lobby | board | play | result
  const [lobby, setLobby] = useState({ players: [], min: 2, max: 10, startsAt: 0 })
  const [joined, setJoined] = useState(false)
  const [board, setBoard] = useState([])
  const [match, setMatch] = useState(null)
  const [result, setResult] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const savedCos = useRef(null)

  const active = panel === 'minigame'
  const meta = GAME_META[gameId] ?? GAME_META.rhythm

  // Oyun temasına uygun geçici 3B kıyafet giydir & çıkınca eski kombini geri yükle
  useEffect(() => {
    if (!active) return undefined
    const prev = cosStore.get('self')
    savedCos.current = prev ? { ...prev } : null
    cosStore.set('self', {
      ...(prev ?? {}),
      acc: meta.outfit.acc,
      look: { ...(prev?.look ?? { h: -1, e: -1, o: -1 }), o: meta.outfit.color },
    })
    return () => {
      if (savedCos.current) cosStore.set('self', savedCos.current)
      else cosStore.set('self', { acc: null, acc2: null, pet: null, look: null })
    }
  }, [active, meta])

  useEffect(() => {
    const onOpen = (e) => {
      const g = GAME_META[e.detail?.game] ? e.detail.game : 'rhythm'
      setGameId(g)
      setView(e.detail?.mode === 'board' ? 'board' : 'lobby')
      setResult(null)
      setMatch(null)
      setBoard(readBoard(g))
      setPanel('minigame')
      send({ t: 'mg_board', game: g })
    }
    window.addEventListener('situapp:open-mg', onOpen)
    return () => window.removeEventListener('situapp:open-mg', onOpen)
  }, [send, setPanel])

  useEffect(() => {
    const offs = [
      on('mg_board', (m) => {
        if (m.game === gameId && Array.isArray(m.top)) setBoard(m.top)
      }),
      on('mg_lobby', (m) => {
        if (m.game !== gameId) return
        setLobby({ players: m.players ?? [], min: m.min ?? 2, max: m.max ?? 10, startsAt: m.startsAt ?? 0 })
        setJoined((m.players ?? []).some((p) => p.id === net.selfId.current))
      }),
      on('mg_left', () => setJoined(false)),
      on('mg_start', (m) => {
        setGameId(m.game)
        setMatch({ matchId: m.matchId, seed: m.seed, practice: false })
        setJoined(false)
        setResult(null)
        setView('play')
      }),
      on('mg_end', (m) => {
        setMatch(null)
        setResult(m)
        if (Array.isArray(m.top)) setBoard(m.top)
        setView('result')
        window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'badge' }))
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [on, gameId, net.selfId])

  useEffect(() => {
    if (!active || !lobby.startsAt) return undefined
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [active, lobby.startsAt])

  const closeAll = useCallback(() => {
    if (joined || match) send({ t: 'mg_leave' })
    setJoined(false)
    setMatch(null)
    setResult(null)
    setPanel(null)
  }, [joined, match, send, setPanel])

  const startPractice = () => {
    if (joined) send({ t: 'mg_leave' })
    setJoined(false)
    setMatch({ matchId: `p_${Date.now()}`, seed: Math.floor(Math.random() * 1_000_000), practice: true })
    setResult(null)
    setView('play')
  }

  const onFinish = useCallback(
    (score, ms) => {
      if (match?.practice) {
        const top = pushLocalBoard(gameId, name || 'Sen', score)
        setBoard(top)
        setMatch(null)
        setResult({
          practice: true,
          winner: { name: name || 'Sen', score },
          standings: [{ rank: 1, id: 'me', name: name || 'Sen', score, pts: Math.max(15, Math.min(100, Math.round(score / 8))), coins: 0 }],
          top,
        })
        setView('result')
        window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'quest' }))
      } else {
        send({ t: 'mg_score', game: gameId, score, ms })
        setMatch(null)
        setView('lobby')
        say(`${meta.emoji} Skorun (${score}) gönderildi! Sonuçlar hesaplanıyor…`)
      }
    },
    [match, gameId, name, send, say, meta.emoji],
  )

  const cdSec = lobby.startsAt ? Math.max(0, Math.ceil((lobby.startsAt - now) / 1000)) : 0
  const Arena = meta.Arena

  const overlays = active ? (
    view === 'play' && match ? (
      <Arena seed={match.seed} touch={touch} onFinish={onFinish} onExit={closeAll} />
    ) : (
      <div className="fixed inset-0 z-40 grid place-items-center bg-[#2c1f4a]/45 p-4 backdrop-blur-[2px]" onClick={closeAll}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={meta.title}
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-[90svh] w-[min(94vw,29rem)] animate-pop flex-col overflow-hidden rounded-[2rem] border-2 border-white bg-white/95 p-5 shadow-toy backdrop-blur-md"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black text-[#4a3b5c]">
                <span>{meta.emoji}</span> {meta.title}
              </h2>
              <p className="text-xs font-bold text-[#8a7a9c]">{meta.desc}</p>
            </div>
            <button type="button" onClick={closeAll} aria-label="Kapat" className="grid h-9 w-9 place-items-center rounded-full bg-[#f6f0ff] text-sm font-black text-[#8a7a9c]">
              ✕
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-2xl bg-[#f3ecff] p-1">
            <button type="button" onClick={() => setView('lobby')} className={`rounded-xl py-2 text-xs font-black transition ${view !== 'board' ? 'bg-white text-[#5b3fa8] shadow-sm' : 'text-[#8a7a9c]'}`}>
              🎮 Lobi (2–10 Kişi)
            </button>
            <button
              type="button"
              onClick={() => {
                setView('board')
                send({ t: 'mg_board', game: gameId })
              }}
              className={`rounded-xl py-2 text-xs font-black transition ${view === 'board' ? 'bg-white text-[#8a5a00] shadow-sm' : 'text-[#8a7a9c]'}`}
            >
              🏆 Puan Tablosu
            </button>
          </div>

          <div className="mt-3 flex-1 overflow-y-auto">
            {view === 'board' ? (
              <div className="flex flex-col gap-1.5">
                {board.length === 0 ? (
                  <p className="py-8 text-center text-sm font-bold text-[#8a7a9c]">Henüz skor yok — ilk rekoru sen kır! {meta.emoji}</p>
                ) : (
                  board.map((r, i) => (
                    <div key={r.key ?? i} className={`flex items-center gap-2.5 rounded-2xl px-3 py-2 ${i === 0 ? 'bg-[#fff3c4]' : 'bg-[#f6f0ff]/75'}`}>
                      <span className="w-7 text-center text-sm font-black text-[#4a3b5c]">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-[#4a3b5c]">{r.name}</p>
                        <p className="text-[11px] font-bold text-[#8a7a9c]">{r.wins} galibiyet · Rekor: {r.best}</p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-[#5b3fa8] shadow-sm">{r.points} puan</span>
                    </div>
                  ))
                )}
              </div>
            ) : view === 'result' && result ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="rounded-3xl bg-gradient-to-br from-[#fff3c4] via-[#ffffff] to-[#efe6ff] px-6 py-4 shadow-soft">
                  <p className="text-3xl">🏆</p>
                  <p className="mt-1 text-lg font-black text-[#4a3b5c]">{result.winner?.name} — {result.winner?.score} puan!</p>
                </div>
                <div className="flex w-full flex-col gap-1.5 text-left">
                  {(result.standings ?? []).map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-2xl bg-[#f6f0ff]/75 px-3 py-2 text-xs font-extrabold text-[#4a3b5c]">
                      <span>{s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : `#${s.rank}`} {s.name}</span>
                      <span className="text-[#5b3fa8]">{s.score} skor · +{s.pts} puan{s.coins ? ` · +${s.coins} 🪙` : ''}</span>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={startPractice} className="w-full rounded-2xl border-b-4 border-[#d98a1c] bg-[#fdb252] py-3 text-sm font-black text-white active:translate-y-[2px]">
                  Tekrar Oyna {meta.emoji}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="rounded-2xl bg-[#f6f0ff] p-3 text-center text-xs font-black text-[#5b3fa8]">
                  👕 {meta.outfitNote}
                </div>
                <div className="rounded-2xl border-2 border-[#efe6ff] bg-[#fcfaff] p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-[#4a3b5c]">Lobi ({lobby.players.length}/{lobby.max})</span>
                    {cdSec > 0 ? (
                      <span className="rounded-full bg-[#fdb252] px-2.5 py-0.5 text-xs font-black text-white">{cdSec} sn!</span>
                    ) : (
                      <span className="rounded-full bg-[#e9ddff] px-2.5 py-0.5 text-[11px] font-black text-[#5b4678]">Min. {lobby.min} kişi</span>
                    )}
                  </div>
                  <div className="mt-3">
                    {joined ? (
                      <button type="button" onClick={() => { send({ t: 'mg_leave' }); setJoined(false) }} className="w-full rounded-2xl border-2 border-[#ffd2d2] bg-[#fff5f5] py-2.5 text-sm font-black text-[#b54141]">
                        Lobiden Ayrıl
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (!send({ t: 'mg_join', game: gameId })) say('Çevrimdışısın — Hemen Oyna ile doğrudan başlayabilirsin!')
                          else setJoined(true)
                        }}
                        className="w-full rounded-2xl border-b-4 border-[#7a5fd0] bg-[#a88bff] py-2.5 text-sm font-black text-white shadow-soft active:translate-y-[2px]"
                      >
                        {meta.emoji} Arkadaş Bekle / Katıl (2–10 Kişi)
                      </button>
                    )}
                  </div>
                </div>
                <button type="button" onClick={startPractice} className="w-full rounded-2xl border-b-4 border-[#d98a1c] bg-[#fdb252] py-3 text-sm font-black text-white shadow-soft active:translate-y-[2px]">
                  Hemen Oyna {meta.emoji}
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
