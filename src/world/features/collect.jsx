// Toplanabilirler (istemci): Canvas katmanı (CollectiblesLayer), "Topla" istemi (E / dokunma / objeye tıklama) ve koleksiyon paneli.
// Sunucu: server/features/collect.js. Veri: src/world/collectibles.js.
import { useCallback, useEffect, useRef, useState } from 'react'
import { ToyButton } from '../../components/ui'
import { Modal } from '../Hud'
import { DoorPrompt } from '../Social'
import CollectiblesLayer from '../CollectiblesLayer'
import { COLLECTIBLE_BY_ID, COLLECT_PROMPT, HIDDEN_CHESTS, KINDS, KIND_ORDER, TOTAL_BY_KIND } from '../collectibles'

const isTyping = (e) => e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)
const sfx = (name) => window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: name }))

function Bar({ value, max, tone = '#ff7eb3' }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#f1e6ff]">
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.round((Math.min(value, max) / (max || 1)) * 100)}%`, background: tone }} />
    </div>
  )
}

function CollectionPanel({ data, onClose }) {
  const [tab, setTab] = useState('kinds')
  const s = data?.s
  const found = new Set(s?.chests ?? [])
  return (
    <Modal onClose={onClose} label="Koleksiyon">
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 flex-1 text-2xl font-black text-[#4a3b5c]">Koleksiyonum 🧺</h2>
        <span className="rounded-full bg-[#ffe48f] px-3 py-1 text-sm font-black text-[#7a5b00]">{s?.total ?? 0} toplandı</span>
      </div>
      <div className="mt-3 flex gap-2" role="tablist">
        {[
          ['kinds', '✨ Türler'],
          ['hidden', `🧰 Gizli ${found.size}/${HIDDEN_CHESTS.length}`],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex-1 rounded-2xl px-2 py-2.5 text-sm font-extrabold transition active:scale-95 ${tab === id ? 'bg-[#ff7eb3] text-white shadow-soft' : 'bg-[#f6f0ff] text-[#4a3b5c]'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {!s ? (
        <p className="mt-6 text-center text-sm font-semibold text-[#8a7a9c]">Yükleniyor… (çevrimdışıysan görünmez)</p>
      ) : tab === 'kinds' ? (
        <>
          <ul className="mt-3 flex flex-col gap-2.5">
            {KIND_ORDER.map((id) => {
              const k = KINDS[id]
              const n = s.kinds[id] ?? 0
              const done = s.series.includes(id)
              return (
                <li key={id} className={`rounded-2xl border-2 px-3 py-2.5 shadow-soft ${done ? 'border-[#ffe48f] bg-[#fffbea]' : 'border-white bg-[#fbf7ff]'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{k.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-[#4a3b5c]">
                        {k.plural} <span className="font-bold text-[#8a7a9c]">· {n} toplandı</span>
                      </p>
                      <p className="text-[11px] font-semibold text-[#8a7a9c]">
                        Bugün kalan: {s.left[id] ?? 0}/{TOTAL_BY_KIND[id]} · her biri +{k.stars} ⭐
                      </p>
                    </div>
                    {done && <span className="text-lg">🏆</span>}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Bar value={n} max={k.series.goal} tone={done ? '#ffc94d' : '#ff7eb3'} />
                    <span className="shrink-0 text-xs font-extrabold tabular-nums text-[#8a7a9c]">
                      {Math.min(n, k.series.goal)}/{k.series.goal}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-bold text-[#7a5fd0]">
                    {done ? `✅ ${k.series.name} tamamlandı` : `${k.series.name}: ${k.series.goal} tane topla → +${k.series.bonus} ⭐`}
                  </p>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-xs font-semibold text-[#8a7a9c]">Yıldızlar ve çiçekler 12 saatte, kalp taşları ve sandıklar her gece yarısı (Türkiye saati) yeniden doğar.</p>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm font-bold text-[#4a3b5c]">Şehirde {HIDDEN_CHESTS.length} gizli hazine sandığı saklı. Yaklaşınca ışıldarlar!</p>
          <ul className="mt-3 flex flex-col gap-2">
            {HIDDEN_CHESTS.map((h, i) => {
              const ok = found.has(h.id)
              return (
                <li key={h.id} className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2 ${ok ? 'border-[#b9ebcf] bg-[#effcf4]' : 'border-white bg-[#fbf7ff]'}`}>
                  <span className="text-2xl">{ok ? '✅' : '🧰'}</span>
                  <p className="min-w-0 flex-1 text-xs font-extrabold text-[#4a3b5c]">
                    {ok ? `${h.name} · ${h.area}` : `#${i + 1} · ${h.hint}`}
                  </p>
                </li>
              )
            })}
          </ul>
          {s.series.includes('hidden_all') && <p className="mt-3 text-sm font-extrabold text-[#2f7a55]">🏆 Tüm gizli hazineleri buldun!</p>}
        </>
      )}
      <ToyButton onClick={onClose} className="mt-5 !py-3 !text-base">
        Tamam
      </ToyButton>
    </Modal>
  )
}

export function useCollect(ctx) {
  const { net, say, touch, focusRef, home, venue, panel, setPanel } = ctx
  const { on, send } = net
  const where = home ? null : venue ? `venue:${venue}` : 'city'
  const store = useRef({ until: {}, leaving: {} })
  const [data, setData] = useState(null)
  const [near, setNear] = useState(null)
  const [pops, setPops] = useState([])
  const lastSend = useRef(0)

  const applyState = useCallback((m) => {
    const now = Date.now()
    const until = {}
    for (const [id, ttl] of Object.entries(m?.c ?? {})) until[id] = now + ttl
    store.current.until = until
    setData(m ?? null)
  }, [])

  useEffect(() => {
    const offs = [
      on('welcome', (m) => applyState(m.collect)),
      on('collect_state', (m) => applyState(m)),
      on('collected', (m) => {
        const col = COLLECTIBLE_BY_ID[m.id]
        const now = Date.now()
        store.current.until[m.id] = now + m.ttl
        store.current.leaving[m.id] = performance.now()
        setData((d) => {
          if (!d) return d
          const c = { ...d.c, [m.id]: m.ttl }
          const kinds = { ...d.s.kinds, [m.kind]: (d.s.kinds[m.kind] ?? 0) + 1 }
          const left = { ...d.s.left, [m.kind]: Math.max(0, (d.s.left[m.kind] ?? 1) - 1) }
          const chests = col?.hidden && !d.s.chests.includes(m.id) ? [...d.s.chests, m.id] : d.s.chests
          return { c, s: { ...d.s, total: d.s.total + 1, kinds, left, chests } }
        })
        if (col) {
          const key = Math.random()
          setPops((p) => [...p, { key, x: col.x, z: col.z, text: `+${m.stars} ⭐${col.hidden ? ' hazine!' : ''}` }])
          setTimeout(() => setPops((p) => p.filter((x) => x.key !== key)), 1400)
        }
        sfx(m.kind === 'chest' ? 'badge' : m.kind === 'heart' ? 'quest' : 'pop')
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [on, applyState])

  useEffect(() => {
    if (panel === 'collection') send({ t: 'collect_get' })
  }, [panel, send])

  const pick = useCallback(
    (id) => {
      const col = COLLECTIBLE_BY_ID[id]
      if (!col) return
      const f = focusRef.current
      if (Math.hypot(f.x - col.x, f.z - col.z) > COLLECT_PROMPT + 0.5) return say(`${KINDS[col.kind].emoji} Biraz daha yaklaş 🚶`)
      const now = Date.now()
      if (now - lastSend.current < 400) return
      lastSend.current = now
      send({ t: 'collect', id })
    },
    [focusRef, say, send],
  )

  const nearCol = near ? COLLECTIBLE_BY_ID[near] : null
  useEffect(() => {
    if (!nearCol) return
    const onKey = (e) => {
      if (e.code === 'KeyE' && !isTyping(e) && !e.ctrlKey && !e.metaKey && !e.altKey) pick(nearCol.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nearCol, pick])

  return {
    extraButtons: [{ key: 'collection', emoji: '🧺', label: 'Koleksiyon', onClick: () => setPanel('collection') }],
    sceneNodes: where ? <CollectiblesLayer where={where} focusRef={focusRef} store={store} onNear={setNear} onPick={pick} pops={pops} /> : null,
    overlays: (
      <>
        {nearCol && !panel && <DoorPrompt emoji={KINDS[nearCol.kind].emoji} label={KINDS[nearCol.kind].name} action="Topla" touch={touch} raised onGo={() => pick(nearCol.id)} />}
        {panel === 'collection' && <CollectionPanel data={data} onClose={() => setPanel(null)} />}
      </>
    ),
  }
}
