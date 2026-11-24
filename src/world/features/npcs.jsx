// NPC'ler: Canvas katmanı (NpcLayer) + konuşma çekmecesi + "Konuş" istemi.
// Sunucu: server/features/npcs.js (yalnızca { t: 'npc_talk', id } → görev/rozet sayacı).
// Bulunduğun yer: ctx.home ? null : (ctx.venue ?? 'city')  (venue = mekân kimliği; mekân iç sahnesi bağlanınca World ctx'e eklenir).
import { useCallback, useEffect, useRef, useState } from 'react'
import { DoorPrompt } from '../Social'
import NpcLayer from '../NpcLayer'
import { CLICK_RADIUS, NPC_BY_ID, displayName, posAt } from '../npcs'

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

function NpcSheet({ npc, text, onOption, onClose, touch }) {
  return (
    <div className={`pointer-events-auto absolute inset-x-0 bottom-0 z-30 mx-auto w-[min(100vw,max(30rem,38vw))] animate-pop rounded-t-[2rem] p-4 pb-5 text-[clamp(1rem,0.3vw+0.75rem,1.3rem)] ${glass}`} role="dialog" aria-label={npc.name}>
      <div className="flex items-start gap-3">
        <img src={`/avatars/${npc.avatar}.png`} alt="" width="64" height="64" className="h-[4em] w-[4em] shrink-0 rounded-2xl border-2 border-white bg-[#fff0f6] object-cover object-top shadow" />
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
      <div className={`mt-3 flex flex-wrap gap-2 ${touch ? 'pb-2' : ''}`}>
        {npc.options.map((o) => (
          <button
            key={o.label}
            onClick={() => onOption(o)}
            className="min-h-11 flex-1 rounded-2xl border-b-4 border-[#e9a9c9] bg-[#ffd9ea] px-3 py-2 text-[0.9em] font-extrabold text-[#a63d78] active:translate-y-[3px] active:border-b-[1px]"
          >
            {o.label}
          </button>
        ))}
        <button onClick={onClose} className="min-h-11 rounded-2xl border-b-4 border-[#c9bde6] bg-[#ece4ff] px-3 py-2 text-[0.9em] font-extrabold text-[#6b4fc0] active:translate-y-[3px] active:border-b-[1px]">
          Hoşça kal 👋
        </button>
      </div>
    </div>
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

  const nearNpc = near && !open ? NPC_BY_ID[near] : null

  // konuşma balonu NPC'nin başında görünür (NpcLayer 'situapp:npc-say' dinler); çekmece kapanınca silinir
  const sayId = open?.id
  const sayText = open ? talk.text : null
  useEffect(() => {
    if (!sayId) return
    window.dispatchEvent(new CustomEvent('situapp:npc-say', { detail: { id: sayId, text: sayText } }))
    return () => window.dispatchEvent(new CustomEvent('situapp:npc-say', { detail: { id: sayId, text: null } }))
  }, [sayId, sayText])

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

  const onOption = (o) => {
    if (o.action === 'rent_bike') net.send({ t: 'rent', kind: 'bike' })
    else if (o.action === 'rent_car') net.send({ t: 'rent', kind: 'car' })
    setTalk((t) => (t ? { ...t, text: pick(o.reply) } : t))
  }

  // havalimanında oyun açılınca Kiralama Memuru kendiliğinden konuşmaya başlar (başlangıç akışı)
  useEffect(() => {
    const onOpen = (e) => {
      const n = NPC_BY_ID[e.detail]
      if (n && n.where === where) start(n, true)
    }
    window.addEventListener('situapp:npc-open', onOpen)
    return () => window.removeEventListener('situapp:npc-open', onOpen)
  }, [where, start])

  return {
    sceneNodes: where ? <NpcLayer where={where} focusRef={focusRef} onTalk={start} onNear={setNear} /> : null,
    overlays: (
      <>
        {nearNpc && <DoorPrompt emoji={nearNpc.role} label={nearNpc.name} action="Konuş" touch={touch} raised onGo={() => start(nearNpc)} />}
        {open && <NpcSheet key={talk.id} npc={open} text={talk.text} touch={touch} onOption={onOption} onClose={() => setTalk(null)} />}
      </>
    ),
  }
}
