import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from '../Hud'
import Portrait from '../Portrait'
import { Ico } from '../../components/Icon'

// Arkadaşlık, varlık, mesaj kutusu, okundu bilgisi ve tarayıcı bildirimi (sunucu: server/features/friends.js).

const glass = 'border-2 border-white bg-white/85 shadow-soft backdrop-blur-md'
const NOTIFY_KEY = 'situapp_notify'
const MAIL_MAX = 140
const CARD_MS = { online: 6000, mail: 9000, added: 6000, request: 30000 }

const lsGet = (k) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const lsSet = (k, v) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* özel pencere */
  }
}

const ago = (ts) => {
  if (!ts) return 'uzun zaman önce'
  const s = Math.max(0, (Date.now() - ts) / 1000)
  if (s < 90) return 'az önce'
  if (s < 3600) return `${Math.round(s / 60)} dk önce`
  if (s < 86400) return `${Math.round(s / 3600)} sa önce`
  return `${Math.round(s / 86400)} gün önce`
}

const notifySupported = () => typeof Notification !== 'undefined'

// ---------- tarayıcı bildirimi + başlık yanıp sönmesi ----------
function useTabAlerts(enabled) {
  const base = useRef(typeof document !== 'undefined' ? document.title : '')
  const blink = useRef(null)

  const stop = useCallback(() => {
    clearInterval(blink.current)
    blink.current = null
    if (base.current) document.title = base.current
  }, [])

  useEffect(() => {
    const onVis = () => !document.hidden && stop()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onVis)
      stop()
    }
  }, [stop])

  /** Yalnızca sekme arka plandayken çalışır. */
  return useCallback(
    (title, body, tag) => {
      if (!document.hidden) return
      if (!blink.current) {
        base.current = document.title
        let on = false
        blink.current = setInterval(() => {
          on = !on
          document.title = on ? '💌 Yeni mesaj' : base.current
        }, 1000)
      }
      if (enabled && notifySupported() && Notification.permission === 'granted') {
        try {
          const n = new Notification(title, { body, tag, silent: false })
          n.onclick = () => {
            window.focus()
            n.close()
          }
        } catch {
          /* bazı mobil tarayıcılar yapıcıyı desteklemez */
        }
      }
    },
    [enabled],
  )
}

// ---------- küçük bileşenler ----------
function Avatar({ name, pkey, size = 'h-11 w-11' }) {
  return <Portrait peer={{ key: pkey, avatar: name }} size={44} className={size} />
}

function Pill({ onClick, children, tone = 'pink', disabled, label }) {
  const tones = {
    pink: 'border-[#e85a98] bg-[#ff7eb3] text-white',
    lilac: 'border-[#c9b6f5] bg-[#e9ddff] text-[#5b3fa8]',
    ghost: 'border-[#e6dcf3] bg-white text-[#8a7a9c]',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`min-h-10 rounded-xl border-b-4 px-3 py-1.5 text-sm font-extrabold active:translate-y-[2px] active:border-b-2 disabled:opacity-50 ${tones[tone]}`}
    >
      {children}
    </button>
  )
}

function Composer({ target, onSend, onCancel }) {
  const [text, setText] = useState('')
  return (
    <form
      className="mt-2 flex flex-col gap-2 rounded-2xl bg-[#f6f0ff] p-2.5"
      onSubmit={(e) => {
        e.preventDefault()
        const t = text.trim()
        if (t) onSend(t)
      }}
    >
      <p className="text-xs font-extrabold text-[#8a7a9c]">💌 {target.name} için mesaj bırak</p>
      <textarea
        autoFocus
        value={text}
        maxLength={MAIL_MAX}
        rows={2}
        onChange={(e) => setText(e.target.value)}
        placeholder="Çevrimiçi olunca görecek…"
        className="w-full resize-none rounded-xl border-2 border-[#d6c7ff]/70 bg-white px-3 py-2 text-sm font-semibold text-[#4a3b5c] outline-none focus:border-[#a88bff]"
      />
      <div className="flex items-center gap-2">
        <span className="flex-1 text-xs font-bold text-[#8a7a9c]">
          {text.length}/{MAIL_MAX}
        </span>
        <Pill tone="ghost" onClick={onCancel}>
          Vazgeç
        </Pill>
        <button type="submit" className="min-h-10 rounded-xl border-b-4 border-[#e85a98] bg-[#ff7eb3] px-4 py-1.5 text-sm font-extrabold text-white active:translate-y-[2px] active:border-b-2">
          Gönder
        </button>
      </div>
    </form>
  )
}

function FriendRow({ f, onGoto, onMessage, onChat, onRemove, composing, onSendMail, onCancelMail }) {
  const [confirm, setConfirm] = useState(false)
  return (
    <li className="rounded-2xl bg-[#f6f0ff] p-2.5">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar name={f.avatar} pkey={f.key} />
          <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${f.online ? 'bg-emerald-400' : 'bg-[#cfc6de]'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-black text-[#4a3b5c]">
            {f.name} {f.dnd && <span title="Rahatsız etme açık">🌙</span>}
          </p>
          <p className="truncate text-xs font-bold text-[#8a7a9c]">{f.online ? `📍 ${f.where}` : `Çevrimdışı · ${ago(f.lastSeen)}`}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {f.online && (
          <Pill tone="pink" disabled={f.dnd} onClick={onGoto}>
            🚶 Yanına git
          </Pill>
        )}
        {f.here ? (
          <Pill tone="lilac" onClick={onChat}>
            💬 Yaz
          </Pill>
        ) : (
          <Pill tone="lilac" onClick={onMessage}>
            💌 Mesaj bırak
          </Pill>
        )}
        {confirm ? (
          <Pill tone="ghost" onClick={onRemove}>
            Emin misin? Çıkar
          </Pill>
        ) : (
          <Pill tone="ghost" onClick={() => setConfirm(true)} label="Arkadaşlıktan çıkar">
            💔
          </Pill>
        )}
      </div>
      {composing && <Composer target={f} onSend={onSendMail} onCancel={onCancelMail} />}
    </li>
  )
}

function FriendsPanel({ data, inbox, fresh, roster, onClose, api, startTab }) {
  const [tab, setTab] = useState(startTab ?? (data.requests.length ? 'requests' : 'friends'))
  useEffect(() => {
    if (startTab === 'mail') api.openMail()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [composeKey, setComposeKey] = useState(null)
  const online = useMemo(() => [...data.list].sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, 'tr')), [data.list])

  const tabs = [
    ['friends', `💗 Arkadaş${data.list.length ? ` ${data.list.filter((f) => f.online).length}/${data.list.length}` : ''}`],
    ['requests', `✋ İstekler${data.requests.length ? ` (${data.requests.length})` : ''}`],
    ['mail', `💌 Mesajlar${data.unread ? ` (${data.unread})` : ''}`],
  ]

  return (
    <Modal onClose={onClose} label="Arkadaşlar">
      <h2 className="text-2xl font-black text-[#4a3b5c]">Arkadaşlar 💗</h2>
      <div className="mt-3 flex gap-1.5" role="tablist">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => {
              setTab(k)
              if (k === 'mail') api.openMail()
            }}
            className={`min-w-0 flex-1 truncate rounded-full border-2 px-2 py-2 text-xs font-extrabold ${tab === k ? 'border-white bg-[#ff7eb3] text-white shadow-soft' : 'border-transparent bg-[#f6f0ff] text-[#8a7a9c]'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {tab === 'friends' &&
          (online.length === 0 ? (
            <p className="rounded-2xl bg-[#f6f0ff] p-4 text-center text-sm font-semibold text-[#8a7a9c]">
              Henüz arkadaşın yok. Birinin karakterine tıkla ve “💗 Arkadaş ekle” de!
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {online.map((f) => {
                const peer = roster.find((p) => p.key === f.key)
                return (
                  <FriendRow
                    key={f.key}
                    f={{ ...f, here: Boolean(peer) && f.online }}
                    composing={composeKey === f.key}
                    onGoto={() => {
                      api.goto(f.key)
                      onClose()
                    }}
                    onChat={() => {
                      onClose()
                      api.openChat(peer.id)
                    }}
                    onMessage={() => setComposeKey(composeKey === f.key ? null : f.key)}
                    onRemove={() => api.remove(f.key)}
                    onSendMail={(t) => {
                      api.mail(f.key, t)
                      setComposeKey(null)
                    }}
                    onCancelMail={() => setComposeKey(null)}
                  />
                )
              })}
            </ul>
          ))}

        {tab === 'requests' &&
          (data.requests.length === 0 ? (
            <p className="rounded-2xl bg-[#f6f0ff] p-4 text-center text-sm font-semibold text-[#8a7a9c]">Bekleyen arkadaşlık isteği yok.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.requests.map((r) => (
                <li key={r.key} className="flex items-center gap-2 rounded-2xl bg-[#f6f0ff] p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-black text-[#4a3b5c]">{r.name}</p>
                    <p className="text-xs font-bold text-[#8a7a9c]">{ago(r.ts)} istek gönderdi</p>
                  </div>
                  <Pill tone="pink" onClick={() => api.answer(r.key, true)}>
                    Kabul
                  </Pill>
                  <Pill tone="ghost" onClick={() => api.answer(r.key, false)}>
                    Reddet
                  </Pill>
                </li>
              ))}
            </ul>
          ))}

        {tab === 'mail' && (
          <>
            {inbox.length === 0 ? (
              <p className="rounded-2xl bg-[#f6f0ff] p-4 text-center text-sm font-semibold text-[#8a7a9c]">Mesaj kutun boş. Çevrimdışıyken sana yazılanlar burada görünür 💌</p>
            ) : (
              <>
                <ul className="flex flex-col gap-2">
                  {[...inbox].reverse().map((m) => (
                    <li key={m.id} className={`rounded-2xl p-2.5 ${fresh.has(m.id) ? 'bg-[#ffe3f0]' : 'bg-[#f6f0ff]'}`}>
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-black text-[#4a3b5c]">
                          {fresh.has(m.id) && <span className="mr-1 rounded-full bg-[#ff7eb3] px-1.5 py-0.5 text-[10px] text-white">yeni</span>}
                          {m.name}
                        </p>
                        <span className="text-xs font-bold text-[#8a7a9c]">{ago(m.ts)}</span>
                      </div>
                      <p className="mt-1 break-words text-sm font-semibold text-[#4a3b5c]">{m.text}</p>
                      <div className="mt-2 flex gap-2">
                        <Pill tone="lilac" onClick={() => setComposeKey(composeKey === m.id ? null : m.id)}>
                          ↩️ Yanıtla
                        </Pill>
                        <Pill tone="ghost" onClick={() => api.deleteMail(m.id)} label="Sil">
                          🗑️
                        </Pill>
                      </div>
                      {composeKey === m.id && (
                        <Composer
                          target={{ name: m.name }}
                          onSend={(t) => {
                            api.mail(m.key, t)
                            setComposeKey(null)
                          }}
                          onCancel={() => setComposeKey(null)}
                        />
                      )}
                    </li>
                  ))}
                </ul>
                <button onClick={() => api.deleteMail('all')} className="mt-3 w-full rounded-2xl py-2 text-sm font-extrabold text-[#8a7a9c] hover:bg-[#ffd6e8]/60">
                  Hepsini sil
                </button>
              </>
            )}
          </>
        )}
      </div>

      <button onClick={onClose} className="mt-4 w-full rounded-2xl border-b-4 border-[#e85a98] bg-[#ff7eb3] py-3 text-base font-extrabold text-white active:translate-y-[3px] active:border-b-[1px]">
        Kapat
      </button>
    </Modal>
  )
}

/** Ekranın üstünde kısa ömürlü bildirim kartları. */
function Cards({ cards, onDismiss, onAnswer, onOpen }) {
  if (!cards.length) return null
  return (
    <div className="pointer-events-none absolute left-1/2 top-44 z-20 flex w-[min(92vw,22rem)] -translate-x-1/2 flex-col gap-2" aria-live="polite">
      {cards.map((c) => (
        <div key={c.id} className={`pointer-events-auto animate-pop rounded-3xl p-2.5 pl-4 ${glass}`} role="status">
          <div className="flex items-center gap-3">
            {c.avatar ? <Avatar name={c.avatar} pkey={c.key} size="h-10 w-10" /> : <span className="text-2xl">{c.emoji}</span>}
            <p className="min-w-0 flex-1 text-sm font-black text-[#4a3b5c]">{c.text}</p>
            <button onClick={() => onDismiss(c.id)} aria-label="Kapat" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black text-[#8a7a9c] hover:bg-[#ffd6e8]/70">
              ✕
            </button>
          </div>
          {c.kind === 'request' && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => onAnswer(c, true)}
                className="min-h-10 flex-1 rounded-xl border-b-4 border-[#e85a98] bg-[#ff7eb3] py-1.5 text-sm font-extrabold text-white active:translate-y-[2px] active:border-b-2"
              >
                💗 Kabul et
              </button>
              <button
                onClick={() => onAnswer(c, false)}
                className="min-h-10 flex-1 rounded-xl border-b-4 border-[#c9b6f5] bg-[#e9ddff] py-1.5 text-sm font-extrabold text-[#5b3fa8] active:translate-y-[2px] active:border-b-2"
              >
                Reddet
              </button>
            </div>
          )}
          {c.kind === 'mail' && (
            <div className="mt-2">
              <button
                onClick={() => onOpen(c, 'mail')}
                className="min-h-10 w-full rounded-xl border-b-4 border-[#c9b6f5] bg-[#e9ddff] py-1.5 text-sm font-extrabold text-[#5b3fa8] active:translate-y-[2px] active:border-b-2"
              >
                💌 Oku
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const EMPTY = { list: [], requests: [], unread: 0 }

/** Arkadaş ekle, arkadaş paneli, varlık bildirimleri, mesaj kutusu, okundu bilgisi, tarayıcı bildirimi. */
export function useFriends({ net, say, focusRef, home, venue, panel, setPanel, openChat, closeInteract, chatTarget }) {
  const [data, setData] = useState(EMPTY)
  const [inbox, setInbox] = useState([])
  const [fresh, setFresh] = useState(() => new Set()) // panel açıkken "yeni" işaretli mesaj id'leri
  const [cards, setCards] = useState([])
  const [readAt, setReadAt] = useState({}) // oyuncu id → karşı tarafın özel sohbeti okuduğu an (sunucu zamanı)
  const [notifyOn, setNotifyOn] = useState(() => lsGet(NOTIFY_KEY) === '1')
  const [perm, setPerm] = useState(() => (notifySupported() ? Notification.permission : 'unsupported'))
  const alert = useTabAlerts(notifyOn)

  // en güncel değerler (abonelikler bir kez kurulur)
  const live = useRef({})
  useEffect(() => {
    live.current = { say, focusRef, home: home || venue, alert, dnd: net.dnd, chatTarget, selfId: net.selfId, send: net.send }
  })
  const [startTab, setStartTab] = useState(null)

  const addCard = useCallback((card) => {
    const id = `${Date.now()}-${Math.random()}`
    setCards((cs) => [...cs.filter((c) => !(c.kind === card.kind && c.key === card.key)), { ...card, id, until: Date.now() + (CARD_MS[card.kind] ?? 6000) }].slice(-3))
  }, [])
  const dismiss = useCallback((id) => setCards((cs) => cs.filter((c) => c.id !== id)), [])
  useEffect(() => {
    if (!cards.length) return
    const t = setInterval(() => setCards((cs) => cs.filter((c) => c.until > Date.now())), 1000)
    return () => clearInterval(t)
  }, [cards.length])

  // ---- okundu bilgisi: açık özel sohbeti görüyorsam karşı tarafa bildir ----
  const readTimer = useRef(null)
  const markRead = useCallback(() => {
    clearTimeout(readTimer.current)
    readTimer.current = setTimeout(() => {
      const id = live.current.chatTarget
      if (id && id !== 'public' && !document.hidden) live.current.send({ t: 'read', to: id })
    }, 350)
  }, [])
  useEffect(() => {
    if (chatTarget && chatTarget !== 'public') markRead()
  }, [chatTarget, markRead])
  useEffect(() => {
    const onVis = () => !document.hidden && markRead()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      clearTimeout(readTimer.current)
    }
  }, [markRead])

  // ---- ağ mesajları ----
  const { on } = net
  useEffect(() => {
    const offs = [
      on('welcome', (m) => {
        const d = m.friendsInit ?? EMPTY
        setData(d)
        setReadAt({})
        if (d.unread) addCard({ kind: 'mail', key: 'mail', emoji: '💌', text: `${d.unread} yeni mesaj 💌` })
        if (d.requests.length && !m.dnd) addCard({ kind: 'note', key: 'reqs', emoji: '✋', text: `${d.requests.length} arkadaşlık isteğin var` })
      }),
      on('friends', (m) => setData({ list: m.list, requests: m.requests, unread: m.unread })),
      on('inbox', (m) => setInbox(m.list)),
      on('friend_online', (m) => addCard({ kind: 'online', key: m.key, emoji: '💗', text: `${m.name} çevrimiçi oldu 💗` })),
      on('friend_added', (m) => addCard({ kind: 'added', key: m.key, emoji: '🎉', text: `${m.name} ile arkadaş oldunuz!` })),
      on('friend_request', (m) => {
        if (live.current.dnd) return
        addCard({ kind: 'request', key: m.key, avatar: m.avatar, text: `${m.name} arkadaş olmak istiyor 💗` })
        live.current.alert('Arkadaşlık isteği 💗', `${m.name} arkadaş olmak istiyor`, 'friend')
      }),
      on('mail_new', (m) => {
        addCard({ kind: 'mail', key: 'mail', emoji: '💌', text: `${m.unread > 1 ? `${m.unread} yeni mesaj` : `${m.from} sana mesaj bıraktı`} 💌` })
        live.current.alert('Yeni mesaj 💌', `${m.from} sana mesaj bıraktı`, 'mail')
      }),
      on('goto', (m) => {
        if (live.current.home) return live.current.say('Önce dışarı çık, sonra arkadaşının yanına gidebilirsin.')
        live.current.focusRef.current.teleport = [m.x, m.z]
        live.current.say(`💗 ${m.name} yanına ışınlandın.`)
      }),
      on('read', (m) => setReadAt((r) => ({ ...r, [m.id]: m.ts }))),
      // tarayıcı bildirimleri (yalnızca sekme arka plandayken)
      on('chat', (m) => {
        if (!m.dm || m.id === live.current.selfId.current) return
        live.current.alert(`💌 ${m.name}`, m.text, `dm-${m.id}`)
        if (m.id === live.current.chatTarget) markRead()
      }),
      on('whisper', (m) => {
        if (m.id === live.current.selfId.current) return
        live.current.alert(`🤫 ${m.name} fısıldadı`, m.text, `wh-${m.id}`)
      }),
      on('gesture', (m) => live.current.alert(`${m.emoji} ${m.name}`, 'sana bir jest yaptı', `ge-${m.id}`)),
    ]
    return () => offs.forEach((off) => off())
  }, [on, addCard, markRead])

  // ---- panel açılınca güncel durum; açıkken ~10 sn'de bir varlığı yenile ----
  const open = panel === 'friends'
  useEffect(() => {
    if (!open) return
    net.send({ t: 'friends_get' })
    const t = setInterval(() => net.send({ t: 'friends_get' }), 10000)
    return () => clearInterval(t)
  }, [open, net.send]) // eslint-disable-line react-hooks/exhaustive-deps
  const openMail = useCallback(() => {
    net.send({ t: 'mail_get' })
  }, [net.send]) // eslint-disable-line react-hooks/exhaustive-deps
  // mesaj sekmesi görüldüyse okunmuş say; o oturumda "yeni" işareti kalsın
  const seen = useRef(new Set())
  useEffect(() => {
    if (!open) {
      seen.current = new Set()
      setFresh(new Set())
      return
    }
    const unread = inbox.filter((m) => !m.read).map((m) => m.id)
    if (unread.length) {
      unread.forEach((id) => seen.current.add(id))
      setFresh(new Set(seen.current))
      net.send({ t: 'mail_read', all: true })
    }
  }, [open, inbox]) // eslint-disable-line react-hooks/exhaustive-deps

  const friendKeys = useMemo(() => new Set(data.list.map((f) => f.key)), [data.list])

  const api = {
    goto: (key) => net.send({ t: 'friend_goto', key }),
    remove: (key) => net.send({ t: 'friend_remove', key }),
    answer: (key, accept) => net.send({ t: 'friend_answer', key, accept }),
    mail: (key, text) => net.send({ t: 'mail_send', key, text }),
    deleteMail: (id) => net.send(id === 'all' ? { t: 'mail_delete', all: true } : { t: 'mail_delete', id }),
    openMail,
    openChat,
  }

  const peerActions = (peer) =>
    friendKeys.has(peer.key)
      ? []
      : [
          {
            key: 'friend',
            emoji: '💗',
            label: 'Arkadaş ekle',
            onClick: () => {
              net.send({ t: 'friend_request', id: peer.id })
              closeInteract()
            },
          },
        ]

  const toggleNotify = async () => {
    if (notifyOn) {
      lsSet(NOTIFY_KEY, '0')
      return setNotifyOn(false)
    }
    if (!notifySupported()) return
    let p = Notification.permission
    if (p === 'default') {
      try {
        p = await Notification.requestPermission()
      } catch {
        p = 'denied'
      }
    }
    setPerm(p)
    if (p === 'granted') {
      lsSet(NOTIFY_KEY, '1')
      setNotifyOn(true)
    }
  }

  const settingsSections = [
    <section key="notify" className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-[#4a3b5c]">🔔 Tarayıcı bildirimi</p>
        <p className="text-xs font-semibold text-[#8a7a9c]">
          {perm === 'unsupported'
            ? 'Bu tarayıcı bildirimleri desteklemiyor. Sekme arka plandayken başlık yanıp söner.'
            : perm === 'denied'
              ? 'Bildirimler tarayıcıdan engellenmiş. Adres çubuğundaki kilit simgesinden izin verebilirsin.'
              : 'Sekme arka plandayken mesaj, fısıltı, jest ve arkadaş isteği için bildirim gelir.'}
        </p>
      </div>
      <button
        role="switch"
        aria-checked={notifyOn}
        disabled={perm === 'unsupported' || perm === 'denied'}
        onClick={toggleNotify}
        className={`relative h-8 w-14 shrink-0 rounded-full border-2 border-white transition disabled:opacity-50 ${notifyOn ? 'bg-[#a88bff]' : 'bg-[#d9d0e6]'}`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${notifyOn ? 'left-7' : 'left-0.5'}`} />
      </button>
    </section>,
  ]

  const badge = data.requests.length + data.unread
  const menuNodes = (
    <button
      onClick={() => {
        setStartTab(null)
        setPanel('friends')
      }}
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm font-extrabold text-[#4a3b5c] transition hover:bg-[#fff0f6]"
    >
      <Ico name="friends" size={22} />
      <span className="flex-1">Arkadaşlar</span>
      {badge > 0 && !net.dnd && (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#ff7eb3] px-1 text-[10px] font-black text-white">{badge}</span>
      )}
    </button>
  )
  const menuBadge = net.dnd ? 0 : badge

  const overlays = (
    <>
      <Cards
        cards={cards}
        onDismiss={dismiss}
        onAnswer={(c, accept) => {
          api.answer(c.key, accept)
          dismiss(c.id)
        }}
        onOpen={(c) => {
          dismiss(c.id)
          setStartTab('mail')
          setPanel('friends')
        }}
      />
      {open && <FriendsPanel data={data} inbox={inbox} fresh={fresh} roster={net.roster} api={api} startTab={startTab} onClose={() => setPanel(null)} />}
    </>
  )

  return { peerActions, settingsSections, overlays, menuNodes, menuBadge, readAt }
}
