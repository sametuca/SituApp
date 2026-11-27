// Asenkron izler: "sen yokken" özeti, çevrimdışı arkadaşa bırakılan hediye paketleri (notlu) ve arkadaş sinyalleri.
// Sunucu: server/features/away.js. Mesaj kutusu ve çevrimiçi bildirimleri friends.jsx'te.
import { useEffect, useRef, useState } from 'react'
import { Dock, TopDock } from '../../components/Dock'
import { Modal } from '../Hud'
import { GIFTS, GIFT_BY_ID } from '../cosmeticsData'

const NOTIFY_KEY = 'situapp_notify'
const PRICE = 15
const when = (ts) => {
  const s = Math.max(0, (Date.now() - ts) / 1000)
  return s < 3600 ? 'az önce' : s < 86400 ? `${Math.round(s / 3600)} sa önce` : `${Math.round(s / 86400)} gün önce`
}
// sekme arka plandayken tarayıcı bildirimi (izin friends.jsx'teki anahtardan)
function pageAlert(title, body, tag) {
  try {
    if (!document.hidden || localStorage.getItem(NOTIFY_KEY) !== '1' || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const n = new Notification(title, { body, tag })
    n.onclick = () => {
      window.focus()
      n.close()
    }
  } catch {
    /* bildirim desteklenmiyor */
  }
}

export function useAway({ net, panel, setPanel, home }) {
  const { on, send } = net
  const [parcels, setParcels] = useState([])
  const [friends, setFriends] = useState([])
  const [digest, setDigest] = useState(null) // { parcels, mails, online: [{name, where}] }
  const [sig, setSig] = useState(null) // { key, name, where }
  const [res, setRes] = useState(null)
  const sigTimer = useRef(null)
  const open = panel === 'away'

  useEffect(() => {
    const offs = [
      on('welcome', (m) => {
        const fl = m.friendsInit?.list ?? []
        setFriends(fl)
        setParcels(m.parcels ?? [])
        const online = fl.filter((f) => f.online && f.where).slice(0, 3)
        const d = { parcels: (m.parcels ?? []).length, mails: m.friendsInit?.unread ?? 0, online }
        setDigest(d.parcels || d.mails || online.length ? d : null)
      }),
      on('friends', (m) => setFriends(m.list ?? [])),
      on('parcels', (m) => setParcels(m.list ?? [])),
      on('parcel_new', (m) => {
        setDigest((d) => ({ ...(d ?? { mails: 0, online: [] }), parcels: (d?.parcels ?? 0) + 1 }))
        pageAlert('Yeni hediye paketi 🎁', `${m.from} sana bir hediye bıraktı`, 'parcel')
        window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
      }),
      on('parcel_sent', (m) => setRes(m)),
      on('friend_active', (m) => {
        setSig(m)
        clearTimeout(sigTimer.current)
        sigTimer.current = setTimeout(() => setSig(null), 7000)
        pageAlert(`${m.name} şimdi ${m.where}’da`, 'Yanına uğramak ister misin?', `act-${m.key}`)
      }),
    ]
    return () => {
      offs.forEach((o) => o())
      clearTimeout(sigTimer.current)
    }
  }, [on])

  const extraButtons = [{ key: 'away', emoji: '📦', label: 'Paketler ve hediye bırak', badge: parcels.length || undefined, onClick: () => setPanel('away') }]

  const overlays = (
    <>
      {sig && !home && (
        <TopDock>
          <div className="pointer-events-auto flex animate-pop items-center gap-2 rounded-full border-2 border-white bg-white/85 px-4 py-2 text-sm font-extrabold text-[#4a3b5c] shadow-soft backdrop-blur-md">
            <span>💗 {sig.name} şimdi {sig.where}’da</span>
            <button className="rounded-full bg-[#fdb252] px-3 py-1 text-xs font-black text-white active:scale-95" onClick={() => (send({ t: 'friend_goto', key: sig.key }), setSig(null))}>
              Yanına git
            </button>
          </div>
        </TopDock>
      )}
      {digest && !open && !home && (
        <Dock>
          <div className="pointer-events-auto relative mx-auto flex w-full max-w-sm animate-pop flex-col gap-2 rounded-3xl border-2 border-white bg-white/85 p-4 shadow-soft backdrop-blur-md" role="status">
            <p className="text-base font-black text-[#4a3b5c]">Sen yokken… ✨</p>
            <ul className="text-sm font-bold text-[#5b4a70]">
              {digest.parcels > 0 && <li>🎁 {digest.parcels} hediye paketi seni bekliyor</li>}
              {digest.mails > 0 && <li>💌 {digest.mails} okunmamış mesaj</li>}
              {digest.online.map((f) => (
                <li key={f.key}>💗 {f.name} şu an {f.where}’da</li>
              ))}
            </ul>
            <div className="flex gap-2">
              {digest.parcels > 0 && (
                <button className="flex-1 rounded-2xl border-b-4 border-[#e8952c] bg-[#fdb252] py-2.5 text-sm font-extrabold text-white active:translate-y-[2px] active:border-b-2" onClick={() => (setDigest(null), setPanel('away'))}>
                  Paketleri aç
                </button>
              )}
              <button className="rounded-2xl px-4 py-2.5 text-sm font-extrabold text-[#8a7a9c] hover:bg-[#ffedd6]/60" onClick={() => setDigest(null)}>
                Tamam
              </button>
            </div>
          </div>
        </Dock>
      )}
      {open && <AwayPanel parcels={parcels} friends={friends} send={send} res={res} onClose={() => (setRes(null), setPanel(null))} />}
    </>
  )

  return { extraButtons, overlays }
}

function AwayPanel({ parcels, friends, send, res, onClose }) {
  const [tab, setTab] = useState(parcels.length ? 'in' : 'out')
  const [to, setTo] = useState('')
  const [kind, setKind] = useState(GIFTS[0].id)
  const [note, setNote] = useState('')
  const tabBtn = (id, label) => (
    <button key={id} className={`flex-1 rounded-2xl px-3 py-2 text-sm font-extrabold active:scale-95 ${tab === id ? 'bg-[#ffead0] text-[#926021]' : 'bg-[#f6f0ff] text-[#5b4a70]'}`} onClick={() => setTab(id)}>
      {label}
    </button>
  )
  const field = 'w-full rounded-2xl border-2 border-[#d6c7ff] bg-[#faf6ff] px-3 py-2 text-sm font-semibold text-[#4a3b5c] outline-none'
  return (
    <Modal onClose={onClose} label="Paketler">
      <h2 className="text-2xl font-black text-[#4a3b5c]">📦 Paketler</h2>
      <div className="mt-3 flex gap-2">{[tabBtn('in', `Gelenler${parcels.length ? ` (${parcels.length})` : ''}`), tabBtn('out', 'Hediye bırak')]}</div>
      {tab === 'in' ? (
        <div className="mt-3 flex flex-col gap-2">
          {parcels.length === 0 && <p className="text-sm font-semibold text-[#8a7a9c]">Şu an bekleyen paketin yok. Arkadaşların sen yokken buraya hediye bırakabilir.</p>}
          {parcels.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-soft">
              <span className="text-3xl">{GIFT_BY_ID[p.kind]?.emoji ?? '🎁'}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-black text-[#4a3b5c]">
                  {p.name} · {GIFT_BY_ID[p.kind]?.name ?? 'Hediye'}
                </div>
                {p.note && <div className="text-xs font-semibold italic text-[#5b4a70]">“{p.note}”</div>}
                <div className="text-[11px] font-bold text-[#8a7a9c]">{when(p.ts)}</div>
              </div>
              <button className="rounded-xl border-b-4 border-[#e8952c] bg-[#fdb252] px-3 py-1.5 text-sm font-extrabold text-white active:translate-y-[2px] active:border-b-2" onClick={() => send({ t: 'parcel_open', id: p.id })}>
                Aç
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-xs font-semibold text-[#8a7a9c]">Arkadaşın çevrimdışı olsa bile hediye bırak; girince onu karşılar. Paket başına {PRICE} 🪙, günde en çok 5.</p>
          <select className={field} value={to} onChange={(e) => setTo(e.target.value)} aria-label="Arkadaş">
            <option value="">Arkadaşını seç…</option>
            {friends.map((f) => (
              <option key={f.key} value={f.key}>
                {f.name}
                {f.online ? ' (çevrimiçi)' : ''}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-4 gap-2">
            {GIFTS.map((g) => (
              <button key={g.id} type="button" aria-pressed={kind === g.id} title={g.name} onClick={() => setKind(g.id)} className={`rounded-2xl border-2 py-2 text-2xl active:scale-95 ${kind === g.id ? 'border-[#fdb252] bg-[#ffead0]' : 'border-white bg-[#f6f0ff]'}`}>
                {g.emoji}
              </button>
            ))}
          </div>
          <input className={field} maxLength={80} placeholder="Küçük bir not (isteğe bağlı)" value={note} onChange={(e) => setNote(e.target.value)} />
          {res && <p className={`text-xs font-extrabold ${res.ok ? 'text-[#2f7a55]' : 'text-[#c0392b]'}`}>{res.text}</p>}
          <button disabled={!to} className="rounded-2xl border-b-4 border-[#e8952c] bg-[#fdb252] py-2.5 text-sm font-extrabold text-white active:translate-y-[2px] active:border-b-2 disabled:opacity-50" onClick={() => send({ t: 'parcel_send', key: to, kind, note })}>
            📦 Bırak ({PRICE} 🪙)
          </button>
        </div>
      )}
    </Modal>
  )
}
