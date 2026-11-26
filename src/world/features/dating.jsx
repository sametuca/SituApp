// Flört & Sosyal Akış Merkezi: Mod (Vibe) seçimi, Canlı Sıcak Nokta, Zamanlı Kasaba Etkinlikleri,
// 3 Dakikalık Hızlı Randevu Masası (Canlı + Demo), Uyum Seviyesi (Bond 1–5), Tek Tık Buz Kırıcılar ve Gizlilik.
import { useCallback, useEffect, useState } from 'react'
import { Em } from '../../components/emoji'
import { BOND_LEVELS, ICEBREAKERS, SPEED_QUESTIONS, VIBE_BY_ID, VIBES, townEventStatus } from '../datingData'
import { ZONES } from '../layout'
import { Modal } from '../Hud'

const VIBE_KEY = 'situapp_vibe_v1'
const ZONE_BY_ID = Object.fromEntries(ZONES.map((z) => [z.id, z]))
const fmtTime = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function SpeedDateModal({ session, msgs, onVote, onChat, onDecide, onClose }) {
  const [text, setText] = useState('')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])
  const leftMs = Math.max(0, session.endsAt - now)

  const submit = (e) => {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    onChat(t)
    setText('')
  }

  return (
    <Modal onClose={onClose} label="3 Dakikalık Hızlı Randevu" wide theme="dating">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-black text-[#4a3b5c]">Hızlı Randevu · {session.opp.name}</h2>
          <p className="text-xs font-bold text-[#8a7a9c]">Soruları oyla, sohbet et ve sonunda kararını ver.</p>
        </div>
        <div className="flex items-center gap-2">
          {session.compat !== null && (
            <span className="rounded-full bg-[#ffe6f2] px-3 py-1 text-xs font-black text-[#c93b78]">
              %{session.compat} Uyum
            </span>
          )}
          <span className="rounded-full bg-[#f3ecff] px-3 py-1 text-xs font-black tabular-nums text-[#5b3fa8]">
            {fmtTime(leftMs)}
          </span>
        </div>
      </div>

      {/* İkilem soruları */}
      <div className="mt-3 flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
        {session.qs.map((q, qi) => {
          const mine = session.myVotes[qi]
          const hers = session.opVotes[qi]
          return (
            <div key={qi} className="rounded-2xl bg-[#f8f4ff] p-2.5">
              <div className="flex items-center justify-between text-xs font-black text-[#4a3b5c]">
                <span>{qi + 1}. {q.q}</span>
                {mine && hers && hers !== '?' && (
                  <span className={`text-[11px] ${mine === hers ? 'text-[#2b9e70]' : 'text-[#8a7a9c]'}`}>
                    {mine === hers ? '✨ Aynı seçim!' : `${session.opp.name}: ${hers === 'a' ? 'A' : 'B'}`}
                  </span>
                )}
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {(['a', 'b']).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onVote(qi, opt)}
                    className={`rounded-xl px-2.5 py-1.5 text-left text-xs font-extrabold transition ${
                      mine === opt ? 'bg-[#a88bff] text-white shadow-sm' : 'bg-white text-[#4a3b5c] hover:bg-[#efe6ff]'
                    }`}
                  >
                    {q[opt]}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Mini randevu sohbeti */}
      <div className="mt-3 rounded-2xl bg-[#fcfaff] p-2.5">
        <div className="flex max-h-24 flex-col gap-1 overflow-y-auto text-xs">
          {msgs.length === 0 ? (
            <p className="text-center font-bold text-[#8a7a9c]/75">Sorular hakkında ilk yorumunu yaz! 💬</p>
          ) : (
            msgs.map((m, i) => (
              <p key={i} className="font-bold text-[#4a3b5c]">
                <span className="text-[#7a5fd0]">{m.fromName}:</span> {m.text}
              </p>
            ))
          )}
        </div>
        <form onSubmit={submit} className="mt-2 flex gap-1.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={140}
            placeholder="Randevu mesajı yaz…"
            className="min-w-0 flex-1 rounded-xl border-2 border-[#e4daf7] bg-white px-3 py-1.5 text-xs font-bold text-[#4a3b5c] outline-none"
          />
          <button type="submit" className="rounded-xl bg-[#a88bff] px-3 py-1.5 text-xs font-black text-white">
            Gönder
          </button>
        </form>
      </div>

      {/* Karar butonları */}
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <button
          type="button"
          disabled={session.myDec !== null}
          onClick={() => onDecide(false)}
          className={`rounded-2xl border-2 py-2.5 text-sm font-black transition ${session.myDec === 'pass' ? 'border-[#c5bdd8] bg-[#e9e3f5] text-[#6b5d85]' : 'border-[#e4daf7] bg-[#f6f0ff] text-[#6b4fc0]'}`}
        >
          {session.myDec === 'pass' ? 'Pas Seçildi' : 'Pas'}
        </button>
        <button
          type="button"
          disabled={session.myDec !== null}
          onClick={() => onDecide(true)}
          className={`rounded-2xl border-b-4 py-2.5 text-sm font-black text-white shadow-soft transition active:translate-y-[2px] ${session.myDec === 'like' ? 'border-[#c93b78] bg-[#ff7aa8]' : 'border-[#d96c8e] bg-[#ff8fb8]'}`}
        >
          {session.myDec === 'like' ? 'Beğendin (Bekleniyor…)' : 'Eşleş'}
        </button>
      </div>
    </Modal>
  )
}

export function useDating({ net, say, panel, setPanel, focusRef, home, venue, closeInteract }) {
  const { on, send } = net
  const [vibe, setVibe] = useState(() => {
    try {
      return localStorage.getItem(VIBE_KEY) || null
    } catch {
      return null
    }
  })
  const [showVibeIntro, setShowVibeIntro] = useState(false)
  const [privacy, setPrivacy] = useState('all') // 'all' | 'matched'
  const [bonds, setBonds] = useState([])
  const [pulse, setPulse] = useState(() => ({ hotZone: 'beach', hotCount: 1, vibeCounts: {}, event: townEventStatus(), sdQueue: 0 }))
  const [tab, setTab] = useState('hot') // hot | speed | bonds
  const [sdQueued, setSdQueued] = useState(false)
  const [sdSession, setSdSession] = useState(null)
  const [sdMsgs, setSdMsgs] = useState([])
  const [sdResult, setSdResult] = useState(null)
  const [ibBanner, setIbBanner] = useState(null)
  const [now, setNow] = useState(() => Date.now())

  const open = panel === 'dating'

  // Şehirde ilk kez mod seçilmemişse nazik 10 saniyelik mod seçici göster
  useEffect(() => {
    if (!home && !venue && !vibe) {
      const t = setTimeout(() => setShowVibeIntro(true), 2200)
      return () => clearTimeout(t)
    }
    return undefined
  }, [home, venue, vibe])

  // Etkinlik sayacını güncelle
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now())
      setPulse((p) => ({ ...p, event: townEventStatus() }))
    }, 10_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const offs = [
      on('welcome', (m) => {
        if (m.dating) {
          if (m.dating.vibe) {
            setVibe(m.dating.vibe)
            try { localStorage.setItem(VIBE_KEY, m.dating.vibe) } catch { /* ignore */ }
          }
          if (m.dating.whisperPrivacy) setPrivacy(m.dating.whisperPrivacy)
          if (Array.isArray(m.dating.bonds)) setBonds(m.dating.bonds)
          if (m.dating.pulse) setPulse(m.dating.pulse)
        }
      }),
      on('dating_pulse', (m) => setPulse(m)),
      on('vibe_state', (m) => setVibe(m.vibe ?? null)),
      on('privacy_state', (m) => setPrivacy(m.whisperPrivacy ?? 'all')),
      on('bonds_state', (m) => Array.isArray(m.list) && setBonds(m.list)),
      on('sd_queued', () => setSdQueued(true)),
      on('sd_left', () => {
        setSdQueued(false)
        setSdSession(null)
      }),
      on('sd_state', (m) => {
        setSdQueued(false)
        setSdResult(null)
        setSdSession({ ...m, demo: false })
      }),
      on('sd_chat', (m) => setSdMsgs((prev) => [...prev.slice(-18), m])),
      on('sd_end', (m) => {
        setSdSession(null)
        setSdQueued(false)
        setSdResult(m)
        if (m.matched) window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'badge' }))
      }),
      on('icebreaker_rx', (m) => {
        setIbBanner(m)
        window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'heart' }))
        setTimeout(() => setIbBanner((cur) => (cur === m ? null : cur)), 6500)
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [on])

  useEffect(() => {
    const onOpenSpeed = () => {
      setTab('speed')
      setSdResult(null)
      setPanel('dating')
      send({ t: 'dating_info' })
    }
    window.addEventListener('situapp:open-speed-date', onOpenSpeed)
    return () => window.removeEventListener('situapp:open-speed-date', onOpenSpeed)
  }, [send, setPanel])

  const chooseVibe = useCallback(
    (id) => {
      setVibe(id)
      setShowVibeIntro(false)
      try { localStorage.setItem(VIBE_KEY, id) } catch { /* ignore */ }
      send({ t: 'vibe_set', vibe: id })
      const v = VIBE_BY_ID[id]
      if (v) say(`${v.emoji} Modun "${v.label}" olarak ayarlandı!`)
    },
    [send, say],
  )

  const jumpTo = useCallback(
    (zoneId, spawn) => {
      window.dispatchEvent(new CustomEvent('situapp:tp', { detail: zoneId }))
      if (focusRef.current && spawn) focusRef.current.teleport = spawn
      setPanel(null)
      setShowVibeIntro(false)
    },
    [focusRef, setPanel],
  )

  const startDemoDate = () => {
    const qs = SPEED_QUESTIONS.slice(0, 5)
    setSdResult(null)
    setSdMsgs([{ fromName: 'Mina (Demo)', text: 'Selam! Sorular çok eğlenceli, hangisinden başlayalım? 😊' }])
    setSdSession({
      sid: 'demo',
      demo: true,
      endsAt: Date.now() + 180_000,
      opp: { id: 'demo', name: 'Mina (Demo)', avatar: 'mira' },
      qs,
      myVotes: Array(5).fill(null),
      opVotes: ['a', 'b', 'a', 'a', 'b'],
      compat: null,
      myDec: null,
      opDecDone: true,
    })
  }

  const voteSd = (qi, choice) => {
    if (!sdSession) return
    if (sdSession.demo) {
      setSdSession((s) => {
        if (!s) return s
        const myVotes = [...s.myVotes]
        myVotes[qi] = choice
        let same = 0
        let both = 0
        for (let i = 0; i < s.qs.length; i++) {
          if (myVotes[i] && s.opVotes[i]) {
            both += 1
            if (myVotes[i] === s.opVotes[i]) same += 1
          }
        }
        return { ...s, myVotes, compat: both > 0 ? Math.round((same / both) * 100) : null }
      })
      return
    }
    send({ t: 'sd_vote', qi, choice })
  }

  const chatSd = (text) => {
    if (!sdSession) return
    if (sdSession.demo) {
      setSdMsgs((prev) => [...prev, { fromName: 'Sen', text }, { fromName: 'Mina (Demo)', text: 'Haha tamamen katılıyorum! 😄' }])
      return
    }
    send({ t: 'sd_chat', text })
  }

  const decideSd = (like) => {
    if (!sdSession) return
    if (sdSession.demo) {
      setSdSession(null)
      setSdResult({ matched: like, oppName: 'Mina (Demo)', demo: true })
      if (like) window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'badge' }))
      return
    }
    send({ t: 'sd_decide', like })
  }

  const evStatus = pulse.event ?? townEventStatus(now)
  const hotZoneObj = ZONE_BY_ID[pulse.hotZone] ?? ZONE_BY_ID.beach

  const extraButtons = [
    {
      key: 'dating',
      emoji: '💞',
      label: 'Flört Merkezi & Sıcak Nokta',
      highlight: Boolean(evStatus.active),
      onClick: () => {
        setPanel(open ? null : 'dating')
        send({ t: 'dating_info' })
      },
    },
  ]

  const peerHeader = (peer) => {
    const b = bonds.find((x) => x.key === peer.key || x.name === peer.name)
    const lv = b?.lv ?? 1
    const info = BOND_LEVELS[lv - 1]
    return (
      <div className="mt-2 flex items-center justify-between rounded-2xl bg-[#fff3f8] px-3 py-1.5 text-xs font-black text-[#a83668]">
        <span>{info.emoji} Uyum Sv.{lv} · {info.title}</span>
        <span>{b?.matched ? '💗 Eşleşme' : `${b?.xp ?? 0} XP`}</span>
      </div>
    )
  }

  const peerActions = (peer) =>
    ICEBREAKERS.map((ib) => ({
      key: `ib_${ib.id}`,
      emoji: ib.emoji,
      label: ib.text,
      onClick: () => {
        closeInteract?.()
        if (!send({ t: 'icebreaker', toId: peer.id, id: ib.id })) {
          say(`${ib.emoji} ${peer.name} kişisine "${ib.text}" gönderildi!`)
        }
      },
    }))

  const settingsSections = [
    <div key="dating-privacy" className="rounded-2xl bg-[#f8f4ff] p-3.5">
      <p className="text-sm font-black text-[#4a3b5c]">Flört & Mesaj Rahatlığı</p>
      <p className="mt-0.5 text-xs font-bold text-[#8a7a9c]">Kimlerin sana fısıltı ve buz kırıcı gönderebileceğini seç.</p>
      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        {[
          ['all', 'Herkes'],
          ['matched', 'Eşleşmeler & Arkadaşlar'],
        ].map(([val, lbl]) => (
          <button
            key={val}
            type="button"
            onClick={() => {
              setPrivacy(val)
              send({ t: 'privacy_set', whisperPrivacy: val })
            }}
            className={`rounded-xl px-2.5 py-2 text-xs font-black transition ${privacy === val ? 'bg-[#a88bff] text-white shadow-sm' : 'bg-white text-[#6b4fc0]'}`}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>,
  ]

  const overlays = (
    <>
      {/* Gelen Buz Kırıcı bildirimi */}
      {ibBanner && (
        <div className="pointer-events-auto fixed left-1/2 top-20 z-40 w-[min(92vw,24rem)] -translate-x-1/2 animate-pop rounded-3xl border-2 border-white bg-white/95 px-4 py-3 shadow-toy">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-black text-[#c93b78]">
              {ibBanner.emoji} {ibBanner.fromName}: “{ibBanner.text}”
            </p>
            <button type="button" onClick={() => setIbBanner(null)} className="text-xs font-black text-[#8a7a9c]">
              ✖️
            </button>
          </div>
        </div>
      )}

      {/* İlk giriş Mod (Vibe) seçici */}
      {showVibeIntro && !open && !sdSession && (
        <Modal onClose={() => setShowVibeIntro(false)} label="Bugün Modun Ne?">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-xl font-black text-[#4a3b5c]">Bugün Modun Ne?</h2>
              <p className="mt-0.5 text-xs font-bold text-[#8a7a9c]">Modunu seç, seninle aynı kafadaki oyuncuların olduğu bölgeyi gösterelim.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowVibeIntro(false)}
              aria-label="Kapat"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f6f0ff] text-sm font-black text-[#6b4fc0] transition hover:bg-[#ece2ff]"
            >
              ✖️
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {VIBES.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => chooseVibe(v.id)}
                className="flex items-center gap-2.5 rounded-2xl border-2 border-white bg-[#faf6ff] p-2.5 text-left shadow-soft transition hover:border-[#a88bff] hover:bg-[#f3ebff] active:scale-95"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white shadow-sm">
                  <Em e={v.emoji} size={26} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black text-[#4a3b5c]">{v.label}</p>
                  <p className="truncate text-[11px] font-semibold text-[#8a7a9c]">{v.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Aktif 3 Dakikalık Hızlı Randevu ekranı */}
      {sdSession && (
        <SpeedDateModal
          session={sdSession}
          msgs={sdMsgs}
          onVote={voteSd}
          onChat={chatSd}
          onDecide={decideSd}
          onClose={() => {
            if (!sdSession.demo) send({ t: 'sd_leave' })
            setSdSession(null)
          }}
        />
      )}

      {/* Flört Merkezi Modalı */}
      {open && !sdSession && (
        <Modal onClose={() => setPanel(null)} label="Sosyal ve Buluşma" theme="dating">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-xl font-black text-[#4a3b5c]">Sosyal ve Buluşma</h2>
              <p className="text-xs font-bold text-[#8a7a9c]">Sıcak nokta, hızlı randevu ve uyumların.</p>
            </div>
            <button
              type="button"
              onClick={() => setPanel(null)}
              aria-label="Kapat"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#ffeef5] text-sm font-black text-[#a83668] transition hover:bg-[#ffdceb] active:scale-95"
            >
              ✖️
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-2xl bg-[#f3ecff] p-1">
            {[
              ['hot', 'Sıcak Nokta'],
              ['speed', 'Hızlı Randevu'],
              ['bonds', 'Uyumlarım'],
            ].map(([id, lbl]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTab(id)
                  send({ t: 'dating_info' })
                }}
                className={`rounded-xl py-2 text-xs font-black transition ${tab === id ? 'bg-white text-[#5b3fa8] shadow-sm' : 'text-[#8a7a9c]'}`}
              >
                {lbl}
              </button>
            ))}
          </div>

          <div className="mt-3">
            {tab === 'hot' && (
              <div className="flex flex-col gap-3">
                {/* Tek Sade Öne Çıkan Kart: Canlı Etkinlik + Sıcak Nokta */}
                <div className={`flex items-center gap-3 rounded-2xl border-2 p-3 ${evStatus.active ? 'border-[#ffd35e] bg-[#fff9e6]' : 'border-white bg-[#fff3f8] shadow-soft'}`}>
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white shadow-sm">
                    <Em e={evStatus.active ? evStatus.event.emoji : hotZoneObj.emoji} size={30} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-[#4a3b5c]">
                      {evStatus.active ? evStatus.event.title : `Sıcak Nokta: ${hotZoneObj.name}`}
                    </p>
                    <p className="truncate text-xs font-bold text-[#a83668]">
                      {evStatus.active
                        ? `${evStatus.event.desc} · ${fmtTime(evStatus.endsInMs)}`
                        : `En hareketli bölge (${pulse.hotCount} kişi) · Sıradaki: ${evStatus.next.title} (${fmtTime(evStatus.startsInMs)})`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      evStatus.active
                        ? jumpTo(evStatus.event.zone, evStatus.event.spawn)
                        : jumpTo(hotZoneObj.id, hotZoneObj.spawn)
                    }
                    className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-black text-white shadow-sm active:scale-95 ${
                      evStatus.active ? 'bg-[#fdb252]' : 'bg-[#ff8fb8]'
                    }`}
                  >
                    Git
                  </button>
                </div>

                {/* Mod seçimi (Büyük 3D Fluent ikon kartları) */}
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-[#8a7a9c]">Bugünkü Modun</p>
                  <div className="grid grid-cols-2 gap-2">
                    {VIBES.map((v) => {
                      const active = vibe === v.id
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => chooseVibe(v.id)}
                          className={`flex items-center gap-2.5 rounded-2xl border-2 px-2.5 py-2 text-left transition active:scale-95 ${
                            active ? 'border-[#a88bff] bg-[#efe6ff] shadow-soft' : 'border-white bg-[#faf6ff] hover:bg-[#f3ebff]'
                          }`}
                        >
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white shadow-sm">
                            <Em e={v.emoji} size={26} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-black text-[#4a3b5c]">{v.label}</p>
                            <p className="text-[11px] font-bold text-[#8a7a9c]">{pulse.vibeCounts?.[v.id] ?? 0} kişi</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Sade ikincil kısayollar */}
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setPanel('quests')}
                    className="rounded-xl bg-[#fff7dc] py-2 text-xs font-black text-[#8a5a00] transition hover:bg-[#ffefbf]"
                  >
                    Günlük Görevler
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanel('pvp')}
                    className="rounded-xl bg-[#f3ecff] py-2 text-xs font-black text-[#5b3fa8] transition hover:bg-[#e8dcff]"
                  >
                    Düello & Arena
                  </button>
                </div>
              </div>
            )}

            {tab === 'speed' && (
              <div className="flex flex-col gap-3">
                {sdResult ? (
                  <div className="rounded-3xl bg-gradient-to-br from-[#ffe6f2] via-white to-[#efe6ff] p-5 text-center shadow-soft">
                    <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white shadow-sm">
                      <Em e={sdResult.matched ? '💞' : '👋'} size={36} />
                    </span>
                    <p className="mt-2 text-lg font-black text-[#4a3b5c]">
                      {sdResult.matched ? `${sdResult.oppName} ile Eşleştin` : 'Güzel bir sohbetti'}
                    </p>
                    <p className="mt-1 text-xs font-bold text-[#6b4fc0]">
                      {sdResult.matched ? 'Uyum Seviyesi +40 XP, +2 Karizma ve +15 Altın kazandın.' : 'Yeni bir hızlı randevuya hemen katılabilirsin.'}
                    </p>
                    <button type="button" onClick={() => setSdResult(null)} className="mt-3 w-full rounded-2xl bg-[#ff8fb8] py-2.5 text-sm font-black text-white">
                      Tamam
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 rounded-2xl border-2 border-white bg-[#fff3f8] p-3 shadow-soft">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white shadow-sm">
                        <Em e="💞" size={26} />
                      </span>
                      <p className="text-xs font-bold text-[#a83668]">
                        3 dakika boyunca ikilem sorularıyla tanış; süre bitince ikiniz de eşleşmeye basarsanız <strong>Eşleşme</strong> açılır.
                      </p>
                    </div>
                    {sdQueued ? (
                      <button
                        type="button"
                        onClick={() => {
                          send({ t: 'sd_leave' })
                          setSdQueued(false)
                        }}
                        className="w-full rounded-2xl border-2 border-[#ffd2d2] bg-[#fff5f5] py-3 text-sm font-black text-[#b54141]"
                      >
                        Randevu Eşi Aranıyor… (İptal Et)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (!send({ t: 'sd_join' })) say('Çevrimdışısın — Demo Randevu ile hemen deneyebilirsin!')
                          else setSdQueued(true)
                        }}
                        className="w-full rounded-2xl border-b-4 border-[#d96c8e] bg-[#ff8fb8] py-3 text-sm font-black text-white shadow-soft active:translate-y-[2px]"
                      >
                        Canlı Hızlı Randevuya Katıl ({pulse.sdQueue ?? 0} bekliyor)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={startDemoDate}
                      className="w-full rounded-2xl border-b-4 border-[#7a5fd0] bg-[#a88bff] py-2.5 text-sm font-black text-white shadow-soft active:translate-y-[2px]"
                    >
                      Hızlı Pratik (Demo Randevu)
                    </button>
                  </>
                )}
              </div>
            )}

            {tab === 'bonds' && (
              <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                {bonds.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-7 text-center">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fff3f8] shadow-sm">
                      <Em e="💞" size={30} />
                    </span>
                    <p className="max-w-xs text-xs font-bold text-[#8a7a9c]">
                      Henüz bir uyumun yok — Hızlı Randevu, Buz Kırıcı veya Teknel ikramıyla başla.
                    </p>
                  </div>
                ) : (
                  bonds.map((b) => (
                    <div key={b.key} className="flex items-center gap-3 rounded-2xl border-2 border-white bg-[#faf6ff] p-2.5 shadow-sm">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white shadow-sm">
                        <Em e={b.emoji} size={24} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between text-xs font-black text-[#4a3b5c]">
                          <span className="truncate">{b.name}</span>
                          <span className="text-[#6b4fc0]">Sv.{b.lv} · {b.title}</span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] font-bold text-[#8a7a9c]">{b.perk} ({b.xp} XP)</p>
                      </div>
                      {b.lv >= 3 && (
                        <button
                          type="button"
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('situapp:visit-home', { detail: b.name }))
                            setPanel(null)
                          }}
                          className="shrink-0 rounded-xl bg-[#7fd3b8] px-3 py-1.5 text-[11px] font-black text-white"
                        >
                          Ziyaret Et
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  )

  return { extraButtons, peerHeader, peerActions, settingsSections, overlays }
}
