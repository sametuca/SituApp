// PvP: eşleşme düğmesi (sol sütun), bekleyenler penceresi, üç düello. Sunucu: server/features/pvp.js.
import { useEffect, useRef, useState } from 'react'
import { Modal } from '../Hud'

const GAMES = {
  reflex: { emoji: '⚡', name: 'Refleks Düellosu', hint: 'Yeşil olunca ilk basan turu alır. Erken basma!' },
  rps: { emoji: '✊', name: 'Taş-Kâğıt-Makas', hint: 'İlk 2 turu alan kazanır.' },
  snow: { emoji: '❄️', name: 'Kartopu Savaşı', hint: '3 canın var. Topla, at ya da kaç — üst üste kaçamazsın!' },
}
const RPS = { r: '✊', p: '✋', s: '✌️' }
const SNOW = { throw: ['🎯', 'At'], dodge: ['💨', 'Kaç'], pack: ['❄️', 'Topla'] }
const btn = 'rounded-2xl px-4 py-2 text-sm font-extrabold text-ink shadow-soft active:scale-95'

export function usePvp({ net, panel, setPanel }) {
  const { on, send } = net
  const [lobby, setLobby] = useState(null)
  const [match, setMatch] = useState(null) // { mid, game, opp, s }
  const [result, setResult] = useState(null)
  const [now, setNow] = useState(Date.now())
  const open = panel === 'pvp'

  useEffect(() => {
    const offs = [
      on('pvp_lobby', setLobby),
      on('pvp_state', (m) => {
        setResult(null)
        setMatch(m)
        setPanel?.('pvp')
      }),
      on('pvp_end', (m) => {
        setResult(m)
        setMatch((x) => (x ? { ...x, over: true } : x))
        window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: m.res === 'win' ? 'quest' : 'pop' }))
      }),
    ]
    return () => offs.forEach((o) => o())
  }, [on, setPanel])

  useEffect(() => {
    if (!open) return
    send({ t: 'pvp_list' })
    const id = setInterval(() => {
      setNow(Date.now())
      if (!match) send({ t: 'pvp_list' })
    }, 1500)
    return () => clearInterval(id)
  }, [open, match, send])

  const close = () => {
    if (match && !match.over) send({ t: 'pvp_leave' })
    else if (lobby?.queued) send({ t: 'pvp_cancel' })
    send({ t: 'pvp_leave' })
    setMatch(null)
    setResult(null)
    setPanel(null)
  }

  const extraButtons = [{ key: 'pvp', icon: 'pvp', label: 'Düello (PvP)', badge: lobby?.list?.length || undefined, onClick: () => setPanel('pvp') }]

  const overlays = open ? (
    <Modal onClose={close} label="Düello">
      {match ? <Match match={match} result={result} send={send} now={now} onBack={() => (setMatch(null), setResult(null))} /> : <Lobby lobby={lobby} send={send} now={now} />}
    </Modal>
  ) : null

  return { extraButtons, overlays }
}

function Lobby({ lobby, send, now }) {
  const me = lobby?.me
  const queued = lobby?.queued
  return (
    <div>
      <h2 className="text-2xl font-black text-[#4a3b5c]">Düello</h2>
      {me && (
        <p className="mt-1 text-sm font-bold text-ink-soft">
          Puanın <b>{me.elo}</b> · {me.w} galibiyet / {me.l} yenilgi
        </p>
      )}
      <p className="mt-3 text-xs font-extrabold uppercase tracking-wide text-ink-soft">Hızlı eşleş</p>
      <div className="mt-2 grid gap-2">
        {queued ? (
          <div className="rounded-2xl bg-candy-lilac/40 p-3 text-center text-sm font-extrabold text-ink">
            Rakip bekleniyor…
            <button type="button" className={`${btn} ml-2 bg-white`} onClick={() => send({ t: 'pvp_cancel' })}>
              Vazgeç
            </button>
          </div>
        ) : (
          <>
            <button type="button" className={`${btn} bg-candy-pink`} onClick={() => send({ t: 'pvp_queue', game: 'any' })}>
              Rastgele düello
            </button>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(GAMES).map(([id, g]) => (
                <button key={id} type="button" title={g.hint} className={`${btn} bg-white px-2 text-xs`} onClick={() => send({ t: 'pvp_queue', game: id })}>
                  {g.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <p className="mt-4 text-xs font-extrabold uppercase tracking-wide text-ink-soft">Rakip bekleyenler</p>
      <div className="mt-2 flex flex-col gap-2">
        {(lobby?.list ?? []).length === 0 && <p className="text-sm font-semibold text-ink-soft">Şu an kimse beklemiyor. Sıraya gir, biri gelsin!</p>}
        {(lobby?.list ?? []).map((w) => (
          <div key={w.id} className="flex items-center gap-2 rounded-2xl bg-white p-2 shadow-soft">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black text-ink">{w.name}</div>
              <div className="text-xs font-bold text-ink-soft">
                {GAMES[w.game]?.name ?? 'Herhangi'} · {w.elo} puan · {w.wait + Math.floor((Date.now() - now) / 1000) * 0} sn
              </div>
            </div>
            <button type="button" className={`${btn} bg-candy-pink`} onClick={() => send({ t: 'pvp_join', id: w.id })}>
              Katıl
            </button>
          </div>
        ))}
      </div>
      {(lobby?.top ?? []).length > 0 && (
        <>
          <p className="mt-4 text-xs font-extrabold uppercase tracking-wide text-ink-soft">En iyiler</p>
          <ol className="mt-1 text-sm font-bold text-ink">
            {lobby.top.map((t, i) => (
              <li key={i}>
                {i + 1}. {t.name} — {t.elo}
              </li>
            ))}
          </ol>
        </>
      )}
      <p className="mt-3 text-[0.6875rem] font-semibold text-ink-soft">Kazanç ve puan; aynı kişiyle günde en çok 3 maçta işler.</p>
    </div>
  )
}

function Match({ match, result, send, now, onBack }) {
  const { game, opp, s } = match
  const g = GAMES[game]
  const left = s.deadline ? Math.max(0, Math.ceil((s.deadline - now) / 1000)) : null
  const act = (o) => send({ t: 'pvp_act', ...o })
  const last = s.last
  return (
    <div className="text-center">
      <h2 className="text-xl font-black text-[#4a3b5c]">
        {g.name}
      </h2>
      <p className="text-sm font-bold text-ink-soft">
        Rakip: <b>{opp.name}</b> ({opp.elo})
      </p>

      {result ? (
        <div className="mt-4 rounded-3xl bg-white p-4 shadow-soft">
          <div className="text-5xl">{result.res === 'win' ? '🏆' : result.res === 'lose' ? '💥' : '🤝'}</div>
          <div className="mt-1 text-xl font-black text-ink">{result.res === 'win' ? 'Kazandın!' : result.res === 'lose' ? 'Kaybettin' : 'Berabere'}</div>
          {result.ranked ? (
            <div className="text-sm font-bold text-ink-soft">
              {result.d > 0 ? '+' : ''}
              {result.d} puan · +{result.coins} 🪙
            </div>
          ) : (
            <div className="text-xs font-semibold text-ink-soft">Bu maç puan/altın getirmedi (günlük çift sınırı ya da çok kısa).</div>
          )}
          <button type="button" className={`${btn} mt-3 bg-candy-pink`} onClick={onBack}>
            Tamam
          </button>
        </div>
      ) : game === 'reflex' ? (
        <div className="mt-3">
          <div className="text-sm font-black text-ink">
            Sen {s.you} – {s.opp} Rakip
          </div>
          <button
            type="button"
            onPointerDown={() => act({ a: 'tap' })}
            className={`mt-3 h-40 w-full select-none rounded-[2rem] text-2xl font-black text-white shadow-soft ${s.go ? 'bg-emerald-400' : s.phase === 'between' ? 'bg-slate-300' : 'bg-rose-400'}`}
          >
            {s.go ? 'ŞİMDİ BAS!' : s.phase === 'between' ? (last?.win ? 'Tur bitti' : 'Süre doldu') : 'Bekle…'}
          </button>
          {last?.rt != null && <p className="mt-1 text-xs font-bold text-ink-soft">Tepki: {last.rt} ms</p>}
        </div>
      ) : game === 'rps' ? (
        <div className="mt-3">
          <div className="text-sm font-black text-ink">
            Sen {s.you} – {s.opp} Rakip · {left != null && `${left} sn`}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {Object.entries(RPS).map(([k, e]) => (
              <button key={k} type="button" disabled={s.picked} className={`${btn} bg-white text-4xl disabled:opacity-40`} onClick={() => act({ a: 'pick', v: k })}>
                {e}
              </button>
            ))}
          </div>
          {s.picked && <p className="mt-2 text-xs font-bold text-ink-soft">Rakip bekleniyor…</p>}
          {last?.picks && <p className="mt-2 text-sm font-bold text-ink">Önceki tur: {Object.values(last.picks).map((p) => RPS[p] ?? '?').join(' vs ')}</p>}
        </div>
      ) : (
        <div className="mt-3">
          <div className="text-lg font-black text-ink">
            ❤️ {'♥'.repeat(Math.max(0, s.hp))} <span className="text-ink-soft">vs</span> {'♥'.repeat(Math.max(0, s.ohp))}
          </div>
          <div className="text-xs font-bold text-ink-soft">
            Kartopun: {s.ammo} · Rakibin: {s.oammo} · {left != null && `${left} sn`}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {Object.entries(SNOW).map(([k, [e, n]]) => {
              const off = s.picked || (k === 'throw' && s.ammo < 1) || (k === 'dodge' && s.cantDodge)
              return (
                <button key={k} type="button" disabled={off} className={`${btn} bg-white disabled:opacity-40`} onClick={() => act({ a: 'pick', v: k })}>
                  <div className="text-3xl">{e}</div>
                  {n}
                </button>
              )
            })}
          </div>
          {s.picked && <p className="mt-2 text-xs font-bold text-ink-soft">Rakip bekleniyor…</p>}
          {last?.acts && <p className="mt-2 text-sm font-bold text-ink">Önceki tur: {Object.values(last.acts).map((a) => SNOW[a]?.[0] ?? '?').join(' · ')}</p>}
        </div>
      )}

      {!result && (
        <button type="button" className="mt-4 text-xs font-bold text-ink-soft underline" onClick={() => send({ t: 'pvp_leave' })}>
          Çekil
        </button>
      )}
    </div>
  )
}
