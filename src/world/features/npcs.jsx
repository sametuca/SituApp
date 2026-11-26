// NPC'ler: Canvas katmanı (NpcLayer) + konuşma çekmecesi + "Konuş" istemi.
// Sunucu: server/features/npcs.js (yalnızca { t: 'npc_talk', id } → görev/rozet sayacı).
// Bulunduğun yer: ctx.home ? null : (ctx.venue ?? 'city')  (venue = mekân kimliği; mekân iç sahnesi bağlanınca World ctx'e eklenir).
import { useCallback, useEffect, useRef, useState } from 'react'
import { DoorPrompt } from '../Social'
import { Modal } from '../Hud'
import { Ico, TagIcon, cleanLabel } from '../../components/Icon'
import NpcLayer from '../NpcLayer'
import { CLICK_RADIUS, NPC_BY_ID, displayName, posAt } from '../npcs'
import { together } from './togetherStore'
import { bike } from '../bikeStore'

const glass = 'border-2 border-white bg-white/90 shadow-soft backdrop-blur-md'
const pick = (a) => a[Math.floor(Math.random() * a.length)]
const isTyping = (e) => e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)

/** Daktilo etkisiyle yazan metin; dokununca tamamı görünür. */
function Typed({ text }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setN((v) => (v >= text.length ? v : v + 1)), 22)
    return () => clearInterval(t)
  }, [text])
  return (
    <p onClick={() => setN(text.length)} className="min-h-[3.6rem] cursor-pointer text-[1em] font-bold leading-snug text-[#4a3b5c]" aria-live="polite">
      {text.slice(0, n)}
      {n < text.length && <span className="opacity-40">▍</span>}
    </p>
  )
}

function NpcSheet({ npc, text, onOption, onBuy, onClose, touch }) {
  return (
    <div className={`pointer-events-auto absolute inset-0 z-30 m-auto h-fit max-h-[84svh] w-[min(94vw,max(28rem,34vw))] overflow-y-auto animate-pop rounded-[2rem] p-4 pb-5 text-[clamp(0.95rem,0.25vw+0.75rem,1.15rem)] ${glass}`} role="dialog" aria-label={npc.name}>
      <div className="flex items-start gap-3">
        <img src={`/avatars/${npc.avatar}.png`} alt="" width="64" height="64" className="h-[4em] w-[4em] shrink-0 rounded-2xl border-2 border-white bg-[#fff8f0] object-cover object-top shadow" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.9em] font-black text-[#ff7a3d]">{displayName(npc)}</p>
          <div className="mt-1 rounded-2xl rounded-tl-md bg-[#fff6ee] px-3 py-2">
            <Typed key={text} text={text} />
          </div>
        </div>
        <button onClick={onClose} aria-label="Kapat" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/80 text-lg font-black text-[#8a7a9c] shadow">
          ✕
        </button>
      </div>
      {npc.shop?.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          {npc.shop.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onBuy?.(npc, item)}
              className="flex h-10 w-full items-center justify-between gap-2 rounded-2xl border-b-[3px] border-[#e8952c] bg-[#fdb252] px-4 text-[0.88em] font-extrabold text-white shadow-soft active:translate-y-[2px] active:border-b-[1px]"
            >
              <span className="flex items-center gap-2 truncate">
                <span>{item.emoji}</span>
                <span className="truncate">{item.label}</span>
              </span>
              <span className="shrink-0 rounded-full bg-white/25 px-2.5 py-0.5 text-[0.82em] font-black">{item.price} ₺</span>
            </button>
          ))}
        </div>
      )}
      <div className={`mt-2 flex flex-col gap-1.5 ${touch ? 'pb-2' : ''}`}>
        {npc.options.map((o) => (
          <button
            key={o.label}
            onClick={() => onOption(o)}
            className="flex h-10 w-full items-center justify-center rounded-2xl border-b-[3px] border-[#e4b780] bg-[#ffeed9] px-4 text-[0.88em] font-extrabold text-[#8b5f2b] active:translate-y-[2px] active:border-b-[1px]"
          >
            {o.label.replace(/^[\p{Extended_Pictographic}\uFE0F\u200d\s]+/u, '')}
          </button>
        ))}
        <button onClick={onClose} className="flex h-10 w-full items-center justify-center rounded-2xl border-b-[3px] border-[#c9bde6] bg-[#ece4ff] px-4 text-[0.88em] font-extrabold text-[#6b4fc0] active:translate-y-[2px] active:border-b-[1px]">
          Hoşça kal
        </button>
      </div>
    </div>
  )
}

function AfkPlayerModal({ bot, onClose, say }) {
  const [msg, setMsg] = useState('')
  const [sent, setSent] = useState([])
  const p = bot.profile ?? {}
  const fmtDate = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? ''))
    return m ? `${m[3]}.${m[2]}.${m[1]}` : ''
  }

  const sendMsg = (e) => {
    e.preventDefault()
    const t = msg.trim()
    if (!t) return
    setSent((list) => [...list, t].slice(-5))
    setMsg('')
    window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
  }

  const sendGesture = (emoji, label) => {
    window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'heart' }))
    say?.(`${emoji} ${bot.name} kişisine ${label.toLowerCase()} gönderdin.`)
  }

  return (
    <Modal onClose={onClose} label={bot.name}>
      <div className="flex items-center gap-3.5">
        <img src={`/avatars/${bot.avatar}.png`} alt="" width="72" height="72" className="h-16 w-16 rounded-2xl border-2 border-white bg-[#fff3e6] object-cover object-top shadow" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-black text-[#4a3b5c]">{bot.name}</p>
          <p className="flex items-center gap-1 text-xs font-bold text-[#8a7a9c]"><Ico name="afk" size={14} /> Şu an klavyeden uzakta (AFK)</p>
        </div>
        <button onClick={onClose} aria-label="Kapat" className="grid h-9 w-9 place-items-center rounded-full bg-[#f6f0ff] text-sm font-black text-[#8a7a9c] hover:bg-[#ffedd6]/70">
          ✕
        </button>
      </div>

      {/* gerçekçi profil kartı (dolu veya boş alanlarla birlikte görünür) */}
      <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-[#faf6ff] p-3">
        <div className="grid grid-cols-2 gap-1.5 text-xs font-extrabold text-[#6b4fc0]">
          <p className="flex items-center gap-1.5 truncate">
            <Ico name="cake" size={14} />
            <span className="truncate">{p.birthDate ? `${fmtDate(p.birthDate)}${p.age ? ` (${p.age})` : ''}` : <span className="font-semibold text-[#8a7a9c]/70">Belirtilmedi</span>}</span>
          </p>
          <p className="flex items-center gap-1.5 truncate">
            <Ico name="pin" size={14} />
            <span className="truncate">{p.city ? p.city : <span className="font-semibold text-[#8a7a9c]/70">Belirtilmedi</span>}</span>
          </p>
          <p className="flex items-center gap-1.5 truncate">
            <Ico name="instagram" size={14} />
            <span className="truncate">
              {p.instagramLocked || (p.socialPrivacy === 'friends' && p.instagram) ? (
                <span title="Sadece arkadaşlara açık" className="inline-flex items-center gap-1 font-bold text-[#8a7a9c]">
                  <Ico name="lock" size={12} /> Sadece arkadaşlar
                </span>
              ) : p.instagram ? (
                `@${p.instagram}`
              ) : (
                <span className="font-semibold text-[#8a7a9c]/70">Belirtilmedi</span>
              )}
            </span>
          </p>
          <p className="flex items-center gap-1.5 truncate">
            <Ico name="x" size={14} />
            <span className="truncate">
              {p.xLocked || (p.socialPrivacy === 'friends' && p.x) ? (
                <span title="Sadece arkadaşlara açık" className="inline-flex items-center gap-1 font-bold text-[#8a7a9c]">
                  <Ico name="lock" size={12} /> Sadece arkadaşlar
                </span>
              ) : p.x ? (
                `@${p.x}`
              ) : (
                <span className="font-semibold text-[#8a7a9c]/70">Belirtilmedi</span>
              )}
            </span>
          </p>
        </div>
        <p className={`text-sm font-semibold ${p.bio ? 'italic text-[#4a3b5c]' : 'text-xs text-[#8a7a9c]/70'}`}>
          {p.bio ? `“${p.bio}”` : 'Hakkında bilgisi girilmemiş.'}
        </p>
        {p.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {p.tags.map((tg) => {
              const label = cleanLabel(tg)
              return (
                <span key={tg} className="inline-flex items-center gap-1.5 rounded-full border border-white bg-[#f6f0ff] px-2.5 py-0.5 text-[11px] font-extrabold text-[#5b4a70]">
                  <TagIcon label={label} size={13} />
                  {label}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* hızlı jestler */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          ['friends', '💗', 'Kalp'],
          ['flower', '🌸', 'Çiçek'],
          ['hand', '👋', 'Selam'],
        ].map(([ico, emoji, label]) => (
          <button
            key={label}
            type="button"
            onClick={() => sendGesture(emoji, label)}
            className="flex flex-col items-center gap-1 rounded-2xl border-2 border-white bg-[#fff2e3]/80 py-2 text-[#4a3b5c] transition hover:bg-[#ffead0] active:scale-95"
          >
            <Ico name={ico} size={20} />
            <span className="text-[11px] font-extrabold">{label}</span>
          </button>
        ))}
      </div>

      {/* mesaj at alanı */}
      <div className="mt-3 flex flex-col gap-2">
        {sent.length > 0 && (
          <div className="flex flex-col gap-1 rounded-2xl bg-[#f3f0fa] p-2.5">
            {sent.map((t, i) => (
              <div key={i} className="self-end rounded-2xl bg-[#a9ddf5] px-3 py-1 text-xs font-semibold text-[#2f4a5c]">
                {t}
              </div>
            ))}
            <p className="text-right text-[10px] font-bold text-[#8a7a9c]">✓ İletildi · dönünce görecek</p>
          </div>
        )}
        <form onSubmit={sendMsg} className="flex gap-2">
          <input
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            maxLength={140}
            autoComplete="off"
            aria-label={`${bot.name} kişisine mesaj yaz`}
            placeholder="Mesaj at… (dönünce görür)"
            className="min-w-0 flex-1 rounded-2xl border-2 border-[#d6c7ff] bg-[#faf6ff] px-3.5 py-2 text-sm font-semibold text-[#4a3b5c] outline-none placeholder:text-[#8a7a9c]/60 focus:ring-4 focus:ring-[#d6c7ff]/60"
          />
          <button type="submit" className="shrink-0 rounded-2xl border-b-4 border-[#e8952c] bg-[#fdb252] px-4 py-2 text-sm font-extrabold text-white active:translate-y-[2px] active:border-b-2">
            Gönder
          </button>
        </form>
      </div>
    </Modal>
  )
}

export function useNpcs(ctx) {
  const { net, say, touch, focusRef, home } = ctx
  const where = home ? null : (ctx.venue ?? 'city')
  const [near, setNear] = useState(null)
  const [talk, setTalk] = useState(null) // { id, text }
  const lastSent = useRef(0)
  const open = talk && talk.where === where ? NPC_BY_ID[talk.id] : null

  const start = useCallback(
    (npc, first = false) => {
      if (!npc) return
      const p = posAt(npc)
      const f = focusRef.current
      if (Math.hypot(f.x - p.x, f.z - p.z) > CLICK_RADIUS) return say(`${displayName(npc)} biraz uzakta, yaklaş 🚶`)
      setTalk({ id: npc.id, where, text: first ? npc.lines[0] : pick(npc.lines) })
      const now = Date.now()
      if (now - lastSent.current > 1000) {
        lastSent.current = now
        net.send({ t: 'npc_talk', id: npc.id })
      }
    },
    [focusRef, net, say, where],
  )

  const nearNpc = near && !open && !ctx.atDoor ? NPC_BY_ID[near] : null
  const [bot, setBot] = useState(null) // AFK botuna tıklayınca küçük profil penceresi
  useEffect(() => {
    const on = (e) => setBot(e.detail)
    window.addEventListener('situapp:bot-click', on)
    return () => window.removeEventListener('situapp:bot-click', on)
  }, [])

  // E ile konuş, Esc ile kapat
  useEffect(() => {
    const onKey = (e) => {
      if (isTyping(e)) return
      if (e.key === 'Escape' && talk) setTalk(null)
      else if ((e.key === 'e' || e.key === 'E') && nearNpc) start(nearNpc)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [talk, nearNpc, start])

  // uzaklaşınca ya da yer değişince çekmeceyi kapat
  useEffect(() => {
    if (!open) return
    const t = setInterval(() => {
      const p = posAt(open)
      const f = focusRef.current
      if (Math.hypot(f.x - p.x, f.z - p.z) > CLICK_RADIUS + 3) setTalk(null)
    }, 500)
    return () => clearInterval(t)
  }, [open, focusRef])

  const eatTimer = useRef(null)
  useEffect(() => () => clearTimeout(eatTimer.current), [])

  const enjoyItem = useCallback(
    (item) => {
      setTalk(null)
      window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'collect' }))
      net.sendReact?.(item.emoji)
      say(`${item.emoji} ${item.reply ?? `${item.label} aldın, keyfini çıkar!`}`)
      if (!bike.on && (!together.self.current || together.self.current.solo)) {
        together.self.current = { kind: 'eat', style: item.style ?? 'eat', item, lead: true, ry: focusRef.current.ry, t0: performance.now() / 1000, solo: true }
        clearTimeout(eatTimer.current)
        eatTimer.current = setTimeout(() => {
          if (together.self.current?.solo && together.self.current.kind === 'eat') together.self.current = null
        }, 2400)
      }
    },
    [focusRef, net, say],
  )

  useEffect(
    () =>
      net.on('npc_buy_res', (m) => {
        const npc = NPC_BY_ID[m.npcId]
        const item = npc?.shop?.find((s) => s.id === m.itemId)
        if (!item) return
        if (!m.ok) {
          setTalk((t) => (t ? { ...t, text: `₺ Yeterli bakiyen yok! Bunun için ${m.price ?? item.price} TL gerekiyor.` } : t))
          return
        }
        if (item.toInv) {
          setTalk(null)
          window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'collect' }))
          say(`🎒 ${item.emoji} ${item.label} envanterine eklendi!`)
          return
        }
        enjoyItem(item)
      }),
    [net, enjoyItem],
  )

  const onBuy = useCallback(
    (npc, item) => {
      if (!net.send({ t: 'npc_buy', npcId: npc.id, itemId: item.id })) {
        // çevrimdışı modda doğrudan envantere ekle veya keyif animasyonunu oynat
        if (item.toInv) {
          setTalk(null)
          window.dispatchEvent(new CustomEvent('situapp:inv-add', { detail: { id: item.id, label: item.label, emoji: item.emoji, alcohol: Boolean(item.alcohol) } }))
          say(`🎒 ${item.emoji} ${item.label} envanterine eklendi!`)
        } else {
          if (item.toInv) {
          setTalk(null)
          window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'collect' }))
          say(`🎒 ${item.emoji} ${item.label} envanterine eklendi!`)
          return
        }
        enjoyItem(item)
        }
      }
    },
    [net, enjoyItem, say],
  )

  const onOption = (o) => {
    if (o.action === 'open_wardrobe') {
      setTalk(null)
      ctx.setPanel('wardrobe')
      return
    }
    if (o.action === 'open_surf' || o.action === 'open_surf_board') {
      setTalk(null)
      window.dispatchEvent(new CustomEvent('situapp:open-surf', { detail: { mode: o.action === 'open_surf_board' ? 'board' : 'lobby' } }))
      return
    }
    if (typeof o.action === 'string' && o.action.startsWith('open_mg:')) {
      const game = o.action.slice('open_mg:'.length)
      setTalk(null)
      window.dispatchEvent(new CustomEvent('situapp:open-mg', { detail: { game } }))
      return
    }
    if (o.action === 'open_speed_date') {
      setTalk(null)
      window.dispatchEvent(new CustomEvent('situapp:open-speed-date'))
      return
    }
    if (o.action === 'open_boxing' || o.action === 'open_boxing_board') {
      setTalk(null)
      window.dispatchEvent(new CustomEvent('situapp:open-boxing', { detail: { mode: o.action === 'open_boxing_board' ? 'board' : 'lobby' } }))
      return
    }
    if (typeof o.action === 'string' && o.action.startsWith('open_workout:')) {
      const kind = o.action.slice('open_workout:'.length)
      setTalk(null)
      window.dispatchEvent(new CustomEvent('situapp:open-workout', { detail: { kind } }))
      return
    }
    setTalk((t) => (t ? { ...t, text: pick(o.reply) } : t))
  }

  // havalimanında oyun açılınca Havalimanı Görevlisi kendiliğinden konuşmaya başlar (başlangıç akışı)
  useEffect(() => {
    const onOpen = (e) => {
      const n = NPC_BY_ID[e.detail]
      if (!n || n.where !== where) return
      const p = posAt(n)
      const f = focusRef.current
      if (Math.hypot(f.x - p.x, f.z - p.z) <= CLICK_RADIUS) start(n, true) // uzaksa (örn. hesap yeni değilse) sessizce geç
    }
    window.addEventListener('situapp:npc-open', onOpen)
    return () => window.removeEventListener('situapp:npc-open', onOpen)
  }, [where, start])

  return {
    sceneNodes: where ? <NpcLayer where={where} focusRef={focusRef} onTalk={start} onNear={setNear} /> : null,
    overlays: (
      <>
        {nearNpc && <DoorPrompt label={nearNpc.name} action="Konuş" touch={touch} raised onGo={() => start(nearNpc)} />}
        {bot && <AfkPlayerModal key={bot.id} bot={bot} say={say} onClose={() => setBot(null)} />}
        {open && <NpcSheet key={talk.id} npc={open} text={talk.text} touch={touch} onOption={onOption} onBuy={onBuy} onClose={() => setTalk(null)} />}
      </>
    ),
  }
}
