import { useEffect, useRef, useState } from 'react'
import { Modal } from '../Hud'

// İki kişilik mini oyunlar (istemci). Durumu sunucu tutar; burada yalnızca gösterim ve hamle gönderme var.
// Protokol: server/features/games.js

const GAME_INFO = {
  xox: { emoji: '❤️', name: 'XOX', desc: 'Kalpler ve yıldızlarla klasik 3x3' },
  tod: { emoji: '🎭', name: 'Doğruluk mu Cesaret mi?', desc: 'Sırayla seç, tatlı sorular ve görevler' },
  love: { emoji: '💘', name: 'Aşk testi', desc: 'Ne kadar uyumlusunuz?' },
}
const MARKS = ['❤️', '⭐']
const END_TEXT = {
  left: 'Oyun bitti.',
  closed: 'Karşındaki ayrıldı, oyun bitti.',
  away: 'Fazla uzaklaştınız, oyun bitti.',
  room: 'Odayı değiştirdiniz, oyun bitti.',
  blocked: 'Oyun sonlandırıldı.',
  idle: 'Uzun süre hamle olmadığı için oyun bitti.',
}
const OFFER_END_TEXT = {
  declined: 'Teklif reddedildi.',
  expired: 'Teklif süresi doldu.',
  invalid: 'Oyun artık başlatılamıyor.',
}

const btnPink = 'rounded-2xl border-b-4 border-[#e8952c] bg-[#fdb252] px-4 py-3 text-base font-extrabold text-white active:translate-y-[3px] active:border-b-[1px] disabled:opacity-50'
const btnSoft = 'rounded-2xl border-2 border-white bg-[#f6f0ff] px-4 py-3 text-sm font-extrabold text-[#7a5fd0] active:scale-[0.97] disabled:opacity-50'

/** Süre çubuğu: ttl ms içinde dolar. */
function Countdown({ ttl }) {
  const [left, setLeft] = useState(1)
  useEffect(() => {
    const t0 = Date.now()
    const id = setInterval(() => setLeft(Math.max(0, 1 - (Date.now() - t0) / ttl)), 200)
    return () => clearInterval(id)
  }, [ttl])
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#f1e6ff]">
      <div className="h-full rounded-full bg-[#fdb252] transition-[width] duration-200" style={{ width: `${left * 100}%` }} />
    </div>
  )
}

// ---------- oyun seçimi ----------
function Picker({ peer, onPick, onClose }) {
  return (
    <Modal onClose={onClose} label="Oyun seç">
      <h2 className="text-xl font-black text-[#4a3b5c]">🎮 {peer.name} ile ne oynayalım?</h2>
      <div className="mt-4 flex flex-col gap-2.5">
        {Object.entries(GAME_INFO).map(([k, g]) => (
          <button key={k} onClick={() => onPick(k)} className="flex items-center gap-3 rounded-2xl border-2 border-white bg-[#fff2e3]/80 px-4 py-3.5 text-left active:scale-[0.98] hover:bg-[#ffead0]">
            <span className="text-3xl">{g.emoji}</span>
            <span className="min-w-0">
              <span className="block text-base font-black text-[#4a3b5c]">{g.name}</span>
              <span className="block text-xs font-semibold text-[#8a7a9c]">{g.desc}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs font-semibold text-[#8a7a9c]">Teklif 30 saniye geçerli. Karşı taraf kabul ederse oyun başlar.</p>
      <button onClick={onClose} className="mt-2 w-full rounded-2xl py-2 text-sm font-extrabold text-[#8a7a9c] hover:bg-[#ffedd6]/60">
        Vazgeç
      </button>
    </Modal>
  )
}

// ---------- teklif kartı ----------
function OfferCard({ offer, onReply }) {
  const g = GAME_INFO[offer.game]
  return (
    <div className="pointer-events-auto absolute inset-x-0 top-16 z-40 mx-auto w-[min(92vw,22rem)] animate-pop rounded-[1.6rem] border-2 border-white bg-white/95 p-4 shadow-toy" role="alertdialog" aria-label="Oyun teklifi">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fff2e3] text-2xl">{g.emoji}</span>
        <p className="min-w-0 flex-1 text-sm font-extrabold text-[#4a3b5c]">
          <span className="text-[#fda533]">{offer.name}</span> seninle <span className="text-[#7a5fd0]">{g.name}</span> oynamak istiyor!
        </p>
      </div>
      <div className="mt-3">
        <Countdown ttl={offer.ttl} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={() => onReply(false)} className={btnSoft}>
          Reddet
        </button>
        <button onClick={() => onReply(true)} className={btnPink}>
          Kabul 🎮
        </button>
      </div>
    </div>
  )
}

function WaitingChip({ out, onCancel }) {
  return (
    <div className="pointer-events-auto absolute inset-x-0 top-16 z-40 mx-auto flex w-[min(92vw,22rem)] animate-pop items-center gap-3 rounded-2xl border-2 border-white bg-white/95 px-4 py-3 shadow-toy">
      <span className="text-xl">{GAME_INFO[out.game].emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold text-[#4a3b5c]">{out.name} bekleniyor…</p>
        <Countdown ttl={out.ttl} />
      </div>
      <button onClick={onCancel} className="rounded-xl bg-[#f6f0ff] px-3 py-2 text-xs font-extrabold text-[#7a5fd0] active:scale-95">
        Geri çek
      </button>
    </div>
  )
}

// ---------- XOX ----------
function Xox({ g, act }) {
  const { board, turn, winner, line, again } = g.s
  const other = g.players[1 - g.you]
  const mine = turn === g.you
  const done = winner !== null
  let status = mine ? `Sıra sende ${MARKS[g.you]}` : `Sıra ${other.name} kişisinde ${MARKS[1 - g.you]}`
  if (winner === -1) status = 'Berabere! 🤝'
  else if (done) status = winner === g.you ? 'Kazandın! 🎉' : `${other.name} kazandı 👏`
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-base font-black text-[#4a3b5c]">{status}</p>
      <div className="grid w-[min(72vw,16rem)] grid-cols-3 gap-2">
        {board.map((c, i) => {
          const win = line?.includes(i)
          return (
            <button
              key={i}
              onClick={() => act({ a: 'cell', i })}
              disabled={done || !mine || c !== null}
              aria-label={`Kare ${i + 1}`}
              className={`grid aspect-square place-items-center rounded-2xl border-2 text-3xl transition active:scale-95 ${
                win ? 'scale-105 animate-[match-pulse_0.9s_ease-in-out_infinite] border-[#ffd24d] bg-[#fff3c4]' : 'border-white bg-[#f6f0ff]'
              } ${!done && mine && c === null ? 'hover:bg-[#fff2e3]' : ''}`}
            >
              {c !== null && <span className="animate-pop">{MARKS[c]}</span>}
            </button>
          )
        })}
      </div>
      {done && (
        <button onClick={() => act({ a: 'again' })} disabled={again[g.you]} className={btnPink}>
          {again[g.you] ? 'Karşı taraf bekleniyor…' : again[1 - g.you] ? `${other.name} tekrar istiyor 🎲` : 'Tekrar oyna 🎲'}
        </button>
      )}
    </div>
  )
}

// ---------- Doğruluk mu Cesaret mi ----------
function Tod({ g, act }) {
  const { turn, phase, kind, prompt, rounds, last } = g.s
  const [text, setText] = useState('')
  const mine = turn === g.you
  const who = g.players[turn]
  const submit = () => {
    if (!text.trim()) return
    act({ a: 'answer', text: text.trim() })
    setText('')
  }
  return (
    <div className="flex flex-col gap-3">
      {last && (
        <div className="rounded-2xl bg-[#f6f0ff] p-3 text-xs font-semibold text-[#6b5a80]">
          <p className="font-extrabold">
            {last.kind === 'truth' ? '💬 Doğruluk' : '🔥 Cesaret'} · {g.players[last.by].name}
          </p>
          <p className="mt-0.5">{last.prompt}</p>
          <p className="mt-1 text-sm font-extrabold text-[#4a3b5c]">{last.answer ?? 'Yaptı ✅'}</p>
        </div>
      )}
      {phase === 'choose' && (
        <>
          <p className="text-center text-base font-black text-[#4a3b5c]">{mine ? 'Sıra sende! Seç:' : `${who.name} seçiyor…`}</p>
          <div className="grid grid-cols-2 gap-2">
            <button disabled={!mine} onClick={() => act({ a: 'pick', kind: 'truth' })} className={btnSoft}>
              💬 Doğruluk
            </button>
            <button disabled={!mine} onClick={() => act({ a: 'pick', kind: 'dare' })} className={btnPink}>
              🔥 Cesaret
            </button>
          </div>
        </>
      )}
      {phase === 'answer' && (
        <>
          <div className={`rounded-2xl border-2 border-white p-4 text-center ${kind === 'truth' ? 'bg-[#e8f3ff]' : 'bg-[#fff2e3]'}`}>
            <p className="text-xs font-extrabold text-[#8a7a9c]">
              {kind === 'truth' ? '💬 Doğruluk' : '🔥 Cesaret'} · {who.name}
            </p>
            <p className="mt-1 animate-pop text-lg font-black text-[#4a3b5c]">{prompt}</p>
          </div>
          {mine ? (
            <>
              <div className="flex gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  maxLength={120}
                  placeholder="Cevabını yaz…"
                  className="min-w-0 flex-1 rounded-2xl border-2 border-[#e6d9ff] bg-white px-3 py-3 text-base font-semibold text-[#4a3b5c] outline-none focus:border-[#a88bff]"
                />
                <button onClick={submit} disabled={!text.trim()} className={btnPink}>
                  Gönder
                </button>
              </div>
              <button onClick={() => act({ a: 'done' })} className={btnSoft}>
                Yaptım ✅
              </button>
            </>
          ) : (
            <p className="text-center text-sm font-bold text-[#8a7a9c]">{who.name} cevaplıyor…</p>
          )}
        </>
      )}
      <p className="text-center text-[0.6875rem] font-bold text-[#b3a5c6]">{rounds} tur oynandı</p>
    </div>
  )
}

// ---------- Aşk testi ----------
function LoveResult({ g }) {
  const r = g.s.result
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const id = setInterval(() => {
      const k = Math.min(1, (Date.now() - start) / 1600)
      setShown(Math.round(r.pct * (1 - (1 - k) ** 3)))
      if (k >= 1) clearInterval(id)
    }, 40)
    return () => clearInterval(id)
  }, [r.pct])
  const other = g.players[1 - g.you]
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-sm font-extrabold text-[#8a7a9c]">
        {g.players[0].name} 💘 {g.players[1].name}
      </p>
      <div className="relative h-8 w-full overflow-hidden rounded-full border-2 border-white bg-[#f1e6ff]">
        <div className="h-full rounded-full bg-gradient-to-r from-[#fec986] to-[#fda533]" style={{ width: `${shown}%` }} />
        <span className="absolute inset-0 grid place-items-center text-sm font-black text-[#4a3b5c]">%{shown}</span>
      </div>
      <p className="animate-pop text-xl font-black text-[#4a3b5c]">{r.title}</p>
      <p className="text-sm font-semibold text-[#6b5a80]">{r.text}</p>
      <p className="rounded-2xl bg-[#fff3c4] px-4 py-2 text-sm font-extrabold text-[#8a6a00]">{r.tip}</p>
      <ul className="w-full text-left">
        {g.s.qs.map((q, i) => (
          <li key={i} className="flex items-center gap-2 border-t border-[#f1e6ff] py-1.5 text-xs font-semibold text-[#6b5a80]">
            <span>{r.same[i] ? '💞' : '✨'}</span>
            <span className="min-w-0 flex-1">
              {q.q} <span className="font-extrabold text-[#4a3b5c]">{q.o[r.answers[g.you][i]]}</span>
              {!r.same[i] && (
                <>
                  {' · '}
                  {other.name}: <span className="font-extrabold text-[#4a3b5c]">{q.o[r.answers[1 - g.you][i]]}</span>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Love({ g, act }) {
  const { qs, mine, other, result } = g.s
  if (result) return <LoveResult g={g} />
  const partner = g.players[1 - g.you]
  if (mine.length >= qs.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <span className="animate-[match-pulse_1.2s_ease-in-out_infinite] text-5xl">💗</span>
        <p className="text-base font-black text-[#4a3b5c]">Cevapların hazır!</p>
        <p className="text-sm font-semibold text-[#8a7a9c]">
          {partner.name} bitirince sonucu göreceksiniz ({other}/{qs.length})
        </p>
      </div>
    )
  }
  const q = qs[mine.length]
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs font-extrabold text-[#8a7a9c]">
        <span>
          Soru {mine.length + 1}/{qs.length}
        </span>
        <span>
          {partner.name}: {other}/{qs.length}
        </span>
      </div>
      <p className="text-center text-lg font-black text-[#4a3b5c]">{q.q}</p>
      <div className="flex flex-col gap-2">
        {q.o.map((label, o) => (
          <button key={o} onClick={() => act({ a: 'answer', q: mine.length, o })} className="rounded-2xl border-2 border-white bg-[#fff2e3]/80 px-4 py-3.5 text-left text-base font-extrabold text-[#4a3b5c] active:scale-[0.98] hover:bg-[#ffead0]">
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------- oyun paneli (alttan çekmece) ----------
function GamePanel({ g, act, onLeave }) {
  const info = GAME_INFO[g.game]
  const other = g.players[1 - g.you]
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 mx-auto max-h-[78svh] w-full max-w-md animate-pop overflow-y-auto rounded-t-[2rem] border-2 border-b-0 border-white bg-white/95 p-5 pb-6 shadow-toy" role="dialog" aria-label={info.name}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-2xl">{info.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-black text-[#4a3b5c]">{info.name}</p>
          <p className="truncate text-xs font-bold text-[#8a7a9c]">{other.name} ile</p>
        </div>
        <button onClick={onLeave} className="rounded-xl bg-[#fff2e3] px-3 py-2 text-xs font-extrabold text-[#da881d] active:scale-95">
          Bitir
        </button>
      </div>
      {g.game === 'xox' && <Xox g={g} act={act} />}
      {g.game === 'tod' && <Tod g={g} act={act} />}
      {g.game === 'love' && <Love g={g} act={act} />}
    </div>
  )
}

/** İki kişilik mini oyunlar: etkileşim menüsünde "Oyun oyna", teklif kartı ve oyun paneli. */
export function useGames({ net, say, closeInteract }) {
  const [picker, setPicker] = useState(null) // oyun seçilecek oyuncu
  const [offerIn, setOfferIn] = useState(null)
  const [offerOut, setOfferOut] = useState(null)
  const [game, setGame] = useState(null)
  const sayRef = useRef(say)
  const outRef = useRef(null)
  useEffect(() => {
    sayRef.current = say
    outRef.current = offerOut
  })

  useEffect(() => {
    const offs = [
      net.on('game_offer', (m) => setOfferIn({ id: m.id, name: m.name, game: m.game, ttl: m.ttl })),
      net.on('game_offer_out', (m) => setOfferOut({ id: m.id, name: m.name, game: m.game, ttl: m.ttl })),
      net.on('game_offer_end', (m) => {
        setOfferIn((o) => (o?.id === m.id ? null : o))
        if (outRef.current?.id === m.id && OFFER_END_TEXT[m.why]) sayRef.current?.(OFFER_END_TEXT[m.why])
        setOfferOut((o) => (o?.id === m.id ? null : o))
      }),
      net.on('game_state', (m) => {
        setOfferIn(null)
        setOfferOut(null)
        setGame({ gid: m.gid, game: m.game, you: m.you, players: m.players, s: m.s })
      }),
      net.on('game_end', (m) => {
        setGame((g) => (g?.gid === m.gid ? null : g))
        sayRef.current?.(END_TEXT[m.why] ?? 'Oyun bitti.')
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [net.on]) // eslint-disable-line react-hooks/exhaustive-deps

  // bağlantı koparsa / yeniden bağlanınca eski durumu temizle
  useEffect(() => {
    if (net.status !== 'online') {
      setOfferIn(null)
      setOfferOut(null)
      setGame(null)
    }
  }, [net.status])

  const peerActions = (peer) => [
    {
      key: 'game',
      category: 'events',
      emoji: '🎮',
      label: 'Oyun oyna',
      onClick: () => {
        closeInteract()
        setPicker(peer)
      },
    },
  ]

  const overlays = (
    <>
      {picker && (
        <Picker
          peer={picker}
          onClose={() => setPicker(null)}
          onPick={(k) => {
            net.send({ t: 'game_offer', to: picker.id, game: k })
            setPicker(null)
          }}
        />
      )}
      {offerIn && !game && (
        <OfferCard
          offer={offerIn}
          onReply={(accept) => {
            net.send({ t: 'game_reply', id: offerIn.id, accept })
            setOfferIn(null)
          }}
        />
      )}
      {offerOut && !game && (
        <WaitingChip
          out={offerOut}
          onCancel={() => {
            net.send({ t: 'game_cancel' })
            setOfferOut(null)
          }}
        />
      )}
      {game && <GamePanel g={game} act={(m) => net.send({ t: 'game_act', ...m })} onLeave={() => net.send({ t: 'game_leave' })} />}
    </>
  )

  return { peerActions, overlays }
}
