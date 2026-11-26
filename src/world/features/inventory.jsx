// Oyuncu Envanteri (🎒), içki/hediye ısmarlama, hediye kabul ekranı ve 5 saniyelik alkol bulanıklık efekti.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal } from '../Hud'
import { together } from './togetherStore'
import { bike } from '../bikeStore'

const LOCAL_KEY = 'situapp_inv_v1'
const SEEN_KEY = 'situapp_inv_seen_v1'
const hasSeenInv = () => {
  try {
    return Boolean(localStorage.getItem(SEEN_KEY))
  } catch {
    return false
  }
}
const markSeenInv = () => {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* ignore */
  }
}
const readLocal = () => {
  try {
    const a = JSON.parse(localStorage.getItem(LOCAL_KEY))
    return Array.isArray(a) ? a : []
  } catch {
    return []
  }
}
const saveLocal = (list) => {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(-30)))
  } catch {
    /* ignore */
  }
}

export function useInventory({ net, say, panel, setPanel, roster, focusRef, closeInteract }) {
  const { on, send } = net
  const [items, setItems] = useState(readLocal)
  const [unseen, setUnseen] = useState(() => !hasSeenInv())
  const prevLenRef = useRef(items.length)
  const [offer, setOffer] = useState(null) // { offerId, fromId, fromName, item }
  const [giftPick, setGiftPick] = useState(null) // { uid, label, emoji } — kime gönderelim?
  const [targetPeer, setTargetPeer] = useState(null) // belirli bir oyuncuya ısmarlama kısayolu
  const [tipsy, setTipsy] = useState(false)
  const tipsyTimer = useRef(null)
  const drinkTimer = useRef(null)

  const open = panel === 'inventory'

  useEffect(() => {
    if (items.length > prevLenRef.current && (!hasSeenInv() || prevLenRef.current === 0)) {
      setUnseen(true)
    }
    prevLenRef.current = items.length
  }, [items.length])

  useEffect(() => {
    if (open && unseen) {
      setUnseen(false)
      markSeenInv()
    }
  }, [open, unseen])

  useEffect(() => () => {
    clearTimeout(tipsyTimer.current)
    clearTimeout(drinkTimer.current)
  }, [])

  const triggerConsume = useCallback(
    (item) => {
      window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'collect' }))
      net.sendReact?.(item.emoji)
      if (!bike.on && (!together.self.current || together.self.current.solo)) {
        together.self.current = { kind: 'eat', style: 'eat', item, lead: true, ry: focusRef.current.ry, t0: performance.now() / 1000, solo: true }
        clearTimeout(drinkTimer.current)
        drinkTimer.current = setTimeout(() => {
          if (together.self.current?.solo && together.self.current.kind === 'eat') together.self.current = null
        }, 2400)
      }
      if (item.alcohol) {
        setTipsy(true)
        clearTimeout(tipsyTimer.current)
        tipsyTimer.current = setTimeout(() => setTipsy(false), 5000)
        say(`${item.emoji} ${item.label} içtin — hafif çakırkeyif oldun! 😵‍💫`)
      } else {
        say(`${item.emoji} ${item.label} keyfini çıkardın!`)
      }
    },
    [focusRef, net, say],
  )

  useEffect(() => {
    const offs = [
      on('welcome', (m) => {
        if (Array.isArray(m.inv)) {
          setItems(m.inv)
          saveLocal(m.inv)
        }
      }),
      on('inv_state', (m) => {
        if (Array.isArray(m.items)) {
          setItems(m.items)
          saveLocal(m.items)
        }
      }),
      on('inv_used', (m) => {
        if (m.item) triggerConsume(m.item)
      }),
      on('gift_offer', (m) => {
        setOffer(m)
        window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [on, triggerConsume])

  // Çevrimdışı yerel envantere ekleme
  useEffect(() => {
    const onAdd = (e) => {
      const it = e.detail
      if (!it) return
      setItems((prev) => {
        const next = [...prev, { uid: `l_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, ...it }].slice(-30)
        saveLocal(next)
        return next
      })
    }
    window.addEventListener('situapp:inv-add', onAdd)
    return () => window.removeEventListener('situapp:inv-add', onAdd)
  }, [])

  const consumeItem = (item) => {
    if (!send({ t: 'inv_use', uid: item.uid })) {
      setItems((prev) => {
        const next = prev.filter((x) => x.uid !== item.uid)
        saveLocal(next)
        return next
      })
      triggerConsume(item)
    }
  }

  const sendGiftTo = (item, peer) => {
    if (!peer) return
    if (!send({ t: 'inv_gift', uid: item.uid, toId: peer.id })) {
      say('Hediye göndermek için çevrimiçi olmalısın!')
      return
    }
    setGiftPick(null)
    setTargetPeer(null)
  }

  const replyOffer = (accept) => {
    if (!offer) return
    send({ t: 'gift_reply', offerId: offer.offerId, accept })
    setOffer(null)
  }

  const showHighlight = unseen && items.length > 0

  const extraButtons = [
    {
      key: 'inventory',
      emoji: '🎒',
      label: 'Envanter',
      badge: items.length > 0 ? items.length : 0,
      highlight: showHighlight,
      hint: showHighlight ? 'Çantana eklendi! Tıkla 🎒' : null,
      onClick: () => {
        if (unseen) {
          setUnseen(false)
          markSeenInv()
        }
        setTargetPeer(null)
        setGiftPick(null)
        setPanel(open ? null : 'inventory')
        send({ t: 'inv_get' })
      },
    },
  ]

  const peerActions = (peer) => [
    {
      key: 'gift_inv',
      emoji: '🍾',
      label: 'İçki / Hediye Ismarla',
      onClick: () => {
        closeInteract?.()
        setTargetPeer(peer)
        setGiftPick(null)
        setPanel('inventory')
        send({ t: 'inv_get' })
      },
    },
  ]

  const overlays = (
    <>
      {/* 5 saniyelik hafif alkol bulanıklık efekti */}
      {tipsy && (
        <div
          className="pointer-events-none fixed inset-0 z-30 transition-all duration-700"
          style={{ backdropFilter: 'blur(3.5px)', WebkitBackdropFilter: 'blur(3.5px)', background: 'radial-gradient(circle, transparent 55%, rgba(168,139,255,0.16) 100%)' }}
        >
          <div className="absolute left-1/2 top-20 -translate-x-1/2 animate-pulse rounded-full border-2 border-white bg-white/85 px-4 py-1 text-xs font-black text-[#6b4fc0] shadow-soft">
            🍻 Hafif çakırkeyif…
          </div>
        </div>
      )}

      {/* Hediye Kabul Etme Ekranı */}
      {offer && (
        <Modal onClose={() => replyOffer(false)} label="Hediye Geldi">
          <div className="flex flex-col items-center text-center">
            <span className="text-5xl">{offer.item?.emoji ?? '🎁'}</span>
            <h2 className="mt-2 text-xl font-black text-[#4a3b5c]">Sana Bir İkram Var!</h2>
            <p className="mt-1 text-sm font-bold text-[#6b4fc0]">
              <strong>{offer.fromName}</strong> sana <strong>{offer.item?.label}</strong> gönderdi.
            </p>
            <p className="mt-1 text-xs font-semibold text-[#8a7a9c]">Kabul edersen doğrudan 🎒 Envanterine eklenecek.</p>
            <div className="mt-4 grid w-full grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => replyOffer(false)}
                className="rounded-2xl border-2 border-[#e4daf7] bg-[#f6f0ff] py-3 text-sm font-black text-[#6b4fc0]"
              >
                Reddet
              </button>
              <button
                type="button"
                onClick={() => replyOffer(true)}
                className="rounded-2xl border-b-4 border-[#5aa886] bg-[#7fd3b8] py-3 text-sm font-black text-white shadow-soft active:translate-y-[2px]"
              >
                Kabul Et 🎒
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Envanter Penceresi */}
      {open && (
        <Modal
          onClose={() => {
            setGiftPick(null)
            setTargetPeer(null)
            setPanel(null)
          }}
          label="Karakter ve Çanta"
          theme="bag"
        >
          <div className="mb-3 grid grid-cols-3 gap-1.5 rounded-2xl bg-[#f3ece0] p-1">
            <button type="button" className="rounded-xl bg-white py-1.5 text-xs font-black text-[#4a3b5c] shadow-sm">🎒 Çanta</button>
            <button type="button" onClick={() => setPanel('stats')} className="rounded-xl py-1.5 text-xs font-black text-[#8a7a68]">💪 Statlar</button>
            <button type="button" onClick={() => setPanel('collection')} className="rounded-xl py-1.5 text-xs font-black text-[#8a7a68]">🧺 Koleksiyon</button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-black text-[#4a3b5c]">Çanta</h2>
              <p className="text-xs font-bold text-[#8a7a9c]">
                {targetPeer ? `${targetPeer.name} için bir ikram seç.` : 'İçecekler, şarküteri ve hediyelerin burada.'}
              </p>
            </div>
            <span className="rounded-full bg-[#f3ece0] px-3 py-1 text-xs font-black text-[#5b4678]">{items.length}/30</span>
          </div>

          {giftPick ? (
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-xs font-black text-[#4a3b5c]">
                {giftPick.emoji} {giftPick.label} kime gönderilsin?
              </p>
              {roster.length === 0 ? (
                <p className="rounded-2xl bg-[#f8f4ff] p-4 text-center text-xs font-bold text-[#8a7a9c]">Şu an aynı yerde başka oyuncu yok.</p>
              ) : (
                <div className="flex max-h-52 flex-col gap-1.5 overflow-y-auto">
                  {roster.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => sendGiftTo(giftPick, p)}
                      className="flex items-center justify-between rounded-2xl bg-[#f6f0ff] px-3.5 py-2.5 text-sm font-black text-[#4a3b5c] hover:bg-[#ece2ff]"
                    >
                      <span>{p.name}</span>
                      <span className="rounded-full bg-[#7fd3b8] px-2.5 py-0.5 text-xs text-white">Gönder 🎁</span>
                    </button>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => setGiftPick(null)} className="mt-1 rounded-xl bg-[#f3ecff] py-2 text-xs font-black text-[#6b4fc0]">
                ← Geri
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="mt-4 rounded-3xl bg-[#f8f4ff] p-6 text-center">
              <p className="text-3xl">🍾</p>
              <p className="mt-2 text-sm font-black text-[#4a3b5c]">Envanterin şu an boş!</p>
              <p className="mt-1 text-xs font-bold text-[#8a7a9c]">Plaj yolundaki mavi logolu <strong>Teknel</strong> dükkanından içecek ve şarküteri alabilirsin.</p>
            </div>
          ) : (
            <div className="mt-3 flex max-h-72 flex-col gap-2 overflow-y-auto">
              {items.map((it) => (
                <div key={it.uid} className="flex items-center justify-between gap-2 rounded-2xl bg-[#f8f4ff] px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="text-2xl">{it.emoji}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#4a3b5c]">{it.label}</p>
                      <p className="text-[11px] font-bold text-[#8a7a9c]">
                        {it.from ? `${it.from} gönderdi` : it.alcohol ? '5 sn çakırkeyif efekti' : 'Taze ürün'}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {targetPeer ? (
                      <button
                        type="button"
                        onClick={() => sendGiftTo(it, targetPeer)}
                        className="rounded-xl bg-[#fdb252] px-3 py-1.5 text-xs font-black text-white shadow-sm"
                      >
                        Ismarla
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => consumeItem(it)}
                          className="rounded-xl bg-[#7fd3b8] px-2.5 py-1.5 text-xs font-black text-white shadow-sm"
                        >
                          İç / Kullan
                        </button>
                        <button
                          type="button"
                          onClick={() => setGiftPick(it)}
                          className="rounded-xl bg-[#a88bff] px-2.5 py-1.5 text-xs font-black text-white shadow-sm"
                        >
                          Ismarla
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </>
  )

  return { extraButtons, peerActions, overlays }
}
