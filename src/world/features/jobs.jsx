// Meslekler (istemci): Bahçıvan / Balıkçı / Postacı. Sunucu: server/features/jobs.js. Veri: src/world/jobsData.js.
// Parçalar: meslek paneli (seçim, görevler, çanta + pazar, rehber), balık tutma HUD'u (at → bekle → ÇEK!), kargo HUD'u, kapı istemleri.
// 3B: JobsWorld (iskeleler, Posta Merkezi, kapı ışıkları), WorkProp (elde olta/paket; AvatarRig içinde), duruşlar avatarPose.js.
import { useCallback, useEffect, useRef, useState } from 'react'
import { ToyButton } from '../../components/ui'
import { Em } from '../../components/emoji'
import { Modal } from '../Hud'
import { DoorPrompt } from '../Social'
import JobsWorld from '../JobsWorld'
import { CROP_META, CROP_PRICE, FISH_BY_ID, FISH_SPOTS, JOBS, JOB_IDS, PARCEL_DELIVER_R, PARCEL_KINDS, PERK, POST_CENTER, QUEST_TEMPLATES, RARITY, jobLevel } from '../jobsData'
import { VENUE_DOORS } from '../venueDoors'
import { mkPose, work } from './jobStore'

const isTyping = (e) => e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)
const sfx = (name) => window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: name }))
const glass = 'border-2 border-white bg-white/80 shadow-soft backdrop-blur-md'

function Bar({ value, max, tone = '#fdb252', h = 'h-2.5' }) {
  return (
    <div className={`${h} w-full overflow-hidden rounded-full bg-[#f1e6ff]`}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.round((Math.min(value, max) / (max || 1)) * 100)}%`, background: tone }} />
    </div>
  )
}

const unitPrice = (kind, id, st) => {
  const base = kind === 'crop' ? CROP_PRICE[id] : FISH_BY_ID[id]?.price
  const mult = st.market?.[kind]?.[id] ?? 1
  const lv = jobLevel(st.xp?.[kind === 'crop' ? 'gardener' : 'fisher'] ?? 0).level
  return { unit: Math.max(1, Math.round((base ?? 1) * mult * PERK.sell(lv))), mult }
}

// ---------- panel ----------
function JobCard({ job, current, onPick, locked, cost }) {
  const j = JOBS[job]
  return (
    <div className="rounded-3xl border-2 border-white p-3.5 shadow-soft" style={{ background: `${j.color}55` }}>
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/80 shadow-soft">
          <Em e={j.emoji} size={38} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-black text-[#4a3b5c]">{j.name}</p>
          <p className="text-xs font-extrabold" style={{ color: j.deep }}>{j.tag}</p>
        </div>
      </div>
      <p className="mt-2 text-[13px] font-semibold leading-snug text-[#5d4d70]">{j.desc}</p>
      <ul className="mt-2 flex flex-col gap-0.5">
        {j.perks.map((p) => (
          <li key={p} className="text-[12px] font-bold text-[#6f5f82]">✨ {p}</li>
        ))}
      </ul>
      <ToyButton onClick={() => onPick(job)} disabled={current || locked} className="mt-3 !py-2.5 !text-sm">
        {current ? 'Mesleğin bu' : locked ? locked : cost ? `Seç · ${cost} 🪙` : 'Bu mesleği seç'}
      </ToyButton>
    </div>
  )
}

function Guide({ job }) {
  const steps = {
    gardener: ['Evine gir (🏠 Evim kapısı ya da /ev). Arka bahçede boş bir tarhı tıkla ve tohum seç.', 'Tarhı sula: olgunlaşma süresi yarıya iner. Hazır olunca tıkla ve hasat et.', 'Ürünler çantana girer. Bu paneldeki Çanta sekmesinde pazar fiyatından sat.', 'Her gün fiyatlar değişir: ↑ işaretli ürünler daha çok kazandırır.'],
    fisher: ['Adanın güney kıyısındaki 🎣 iskelelerden birine git (plaj çevresindeki tahta yollar).', 'E ile olta at. Şamandıra suya düşünce sabırla bekle.', 'Şamandıra batınca ekranda ÇEK! çıkar: E / Boşluk / dokunma ile zamanında çek.', 'Erken çekersen yem kaçar, geç kalırsan balık kaçar. Çabuk çekmek bonus XP verir.'],
    postman: ['Parktaki 📮 Posta Merkezi’ne git (çardağın hemen yanı).', 'E ile kargo al. Her kargonun gideceği mekân paneldeki listede ve kapısındaki turuncu ışıkta.', 'Kapıya varınca E ile teslim et. Süre dolmadan teslim edersen ⚡ ekspres bonus!', 'Bisikletle teslim ettikçe +%20 kazanırsın. Seviye atladıkça daha çok kargo taşırsın.'],
  }[job]
  return (
    <ol className="mt-3 flex flex-col gap-2">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-2.5 rounded-2xl bg-[#fbf7ff] p-2.5 text-[13px] font-semibold text-[#5d4d70]">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#fdb252] text-xs font-black text-white">{i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  )
}

function JobsPanel({ st, onPick, onSell, onClose }) {
  const [tab, setTab] = useState('quests')
  const [choosing, setChoosing] = useState(false)
  const job = st?.job
  const j = job ? JOBS[job] : null
  const lv = job ? jobLevel(st.xp?.[job] ?? 0) : null
  const left = st ? Math.max(0, (st.canSwitchAt ?? 0) - Date.now()) : 0
  const lockMsg = job && left > 0 ? `⏳ ${Math.ceil(left / 60000)} dk sonra` : null

  if (!st) {
    return (
      <Modal onClose={onClose} label="Meslekler">
        <p className="py-8 text-center text-sm font-semibold text-[#8a7a9c]">Yükleniyor… (çevrimdışıysan meslekler çalışmaz)</p>
        <ToyButton onClick={onClose} className="!py-3">Tamam</ToyButton>
      </Modal>
    )
  }
  if (!job || choosing) {
    return (
      <Modal onClose={onClose} label="Meslek seç">
        <h2 className="text-2xl font-black text-[#4a3b5c]">{job ? 'Mesleği değiştir' : 'Bir meslek seç'} 💼</h2>
        <p className="mt-1 text-sm font-semibold text-[#8a7a9c]">
          {job ? `Değiştirmek ${st.switchCost} 🪙. Her mesleğin seviyesi ayrı tutulur, geri dönünce kaldığın yerden devam edersin.` : 'İlk seçim ücretsiz. Mesleğine göre görevler alırsın, kazanırsın, seviye atlarsın.'}
        </p>
        <div className="mt-3 flex flex-col gap-3">
          {JOB_IDS.map((id) => (
            <JobCard
              key={id}
              job={id}
              current={id === job}
              locked={id !== job && lockMsg}
              cost={job && id !== job ? st.switchCost : 0}
              onPick={(x) => {
                onPick(x)
                setChoosing(false)
              }}
            />
          ))}
        </div>
        <ToyButton onClick={() => (job ? setChoosing(false) : onClose())} className="mt-4 !bg-[#e9ddff] !text-[#4a3b5c] !py-3">
          {job ? 'Vazgeç' : 'Şimdi değil'}
        </ToyButton>
      </Modal>
    )
  }

  const qs = st.quests ?? []
  const doneN = qs.filter((q) => q.done).length
  const cropItems = Object.entries(st.inv?.crop ?? {})
  const fishItems = Object.entries(st.inv?.fish ?? {})
  const worth = (kind, items) => items.reduce((s, [id, n]) => s + unitPrice(kind, id, st).unit * n, 0)

  return (
    <Modal onClose={onClose} label="Meslek">
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl shadow-soft" style={{ background: j.color }}>
          <Em e={j.emoji} size={38} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-black text-[#4a3b5c]">{j.name}</p>
          <p className="text-xs font-extrabold" style={{ color: j.deep }}>
            Seviye {lv.level}{lv.max ? ' · en yüksek' : ''}
          </p>
        </div>
        <button onClick={() => setChoosing(true)} className="rounded-xl bg-[#f6f0ff] px-2.5 py-1.5 text-xs font-extrabold text-[#6b4fc0] active:scale-95">Değiştir</button>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <Bar value={lv.into} max={lv.need || 1} tone={j.deep} h="h-3" />
        <span className="shrink-0 text-[11px] font-extrabold tabular-nums text-[#8a7a9c]">{lv.max ? 'MAX' : `${lv.into}/${lv.need} XP`}</span>
      </div>
      <p className="mt-1.5 text-[12px] font-bold text-[#6f5f82]">
        {job === 'gardener' && `Satış +%${Math.round((PERK.sell(lv.level) - 1) * 100)} · çifte hasat %${Math.round(PERK.double(lv.level) * 100)}`}
        {job === 'fisher' && `Satış +%${Math.round((PERK.sell(lv.level) - 1) * 100)} · çekme süresi ${(PERK.window(lv.level) / 1000).toFixed(1)} sn · nadir şansı ×${PERK.luck(lv.level).toFixed(2)}`}
        {job === 'postman' && `Kargo kapasitesi ${PERK.cap(lv.level)} · kazanç +%${Math.round((PERK.pay(lv.level) - 1) * 100)}`}
      </p>

      <div className="mt-3 flex gap-2" role="tablist">
        {[['quests', `✅ Görevler ${doneN}/${qs.length}`], ['bag', '🎒 Çanta'], ['guide', '❓ Rehber']].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`flex-1 rounded-2xl px-2 py-2.5 text-[13px] font-extrabold transition active:scale-95 ${tab === id ? 'bg-[#fdb252] text-white shadow-soft' : 'bg-[#f6f0ff] text-[#4a3b5c]'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'quests' && (
        <ul className="mt-3 flex flex-col gap-2.5">
          {qs.map((q) => {
            const t = QUEST_TEMPLATES[job].find((x) => x.id === q.id)
            return (
              <li key={q.id} className={`rounded-2xl border-2 px-3 py-2.5 shadow-soft ${q.done ? 'border-[#bfe8cf] bg-[#f1fbf5]' : 'border-white bg-[#fbf7ff]'}`}>
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 text-sm font-extrabold text-[#4a3b5c]">{q.done ? '✅ ' : ''}{t?.text(q.goal)}</p>
                  <span className="shrink-0 rounded-full bg-[#fff3c8] px-2 py-0.5 text-[11px] font-black text-[#8a5a00]">+{t?.coins} 🪙</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <Bar value={q.n} max={q.goal} tone={q.done ? '#43b97f' : j.deep} />
                  <span className="shrink-0 text-xs font-extrabold tabular-nums text-[#8a7a9c]">{q.n}/{q.goal}</span>
                </div>
              </li>
            )
          })}
          <p className="text-center text-[11px] font-bold text-[#8a7a9c]">Görevler her gün (Türkiye saatiyle gece yarısı) yenilenir.</p>
        </ul>
      )}

      {tab === 'bag' && (
        <div className="mt-3 flex flex-col gap-3">
          {[
            ['crop', '🧺 Ürünler', cropItems, (id) => CROP_META[id]],
            ['fish', '🐟 Balıklar', fishItems, (id) => FISH_BY_ID[id]],
          ].map(([kind, title, items, meta]) => (
            <div key={kind}>
              <div className="flex items-center gap-2">
                <p className="flex-1 text-sm font-black text-[#4a3b5c]">{title}</p>
                {items.length > 0 && (
                  <button onClick={() => onSell(kind, 'all')} className="rounded-xl bg-[#fdb252] px-2.5 py-1.5 text-xs font-extrabold text-white active:scale-95">
                    Hepsini sat · {worth(kind, items)} 🪙
                  </button>
                )}
              </div>
              {items.length === 0 ? (
                <p className="mt-1 rounded-2xl bg-[#fbf7ff] p-3 text-center text-xs font-semibold text-[#8a7a9c]">
                  {kind === 'crop' ? 'Bahçeden hasat ettiğin ürünler burada.' : 'Tuttuğun balıklar burada.'}
                </p>
              ) : (
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {items.map(([id, n]) => {
                    const m = meta(id)
                    const { unit, mult } = unitPrice(kind, id, st)
                    const r = RARITY[m?.rar]
                    return (
                      <li key={id} className="flex items-center gap-2.5 rounded-2xl bg-[#fbf7ff] px-2.5 py-2 shadow-soft">
                        <Em e={m?.emoji ?? '❔'} size={30} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-extrabold text-[#4a3b5c]">
                            {m?.name} <span className="text-[#8a7a9c]">×{n}</span>
                          </p>
                          <p className="text-[11px] font-bold text-[#8a7a9c]">
                            {unit} 🪙 / adet{' '}
                            <span className={mult >= 1.15 ? 'text-[#2f9a6a]' : mult <= 0.9 ? 'text-[#d9604a]' : ''}>{mult >= 1.15 ? '↑ talep yüksek' : mult <= 0.9 ? '↓ düşük' : ''}</span>
                            {r && kind === 'fish' && <span style={{ color: r.color }}> · {r.name}</span>}
                          </p>
                        </div>
                        <button onClick={() => onSell(kind, id)} className="rounded-xl bg-[#e9ddff] px-2.5 py-1.5 text-xs font-extrabold text-[#4a3b5c] active:scale-95">Sat</button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ))}
          <p className="text-center text-[11px] font-bold text-[#8a7a9c]">Pazar fiyatları her gün değişir. Günlük satış kazancının üst sınırı vardır.</p>
        </div>
      )}

      {tab === 'guide' && <Guide job={job} />}

      <ToyButton onClick={onClose} className="mt-5 !py-3 !text-base">Tamam</ToyButton>
    </Modal>
  )
}

// ---------- küçük kartlar ----------
function Toast({ children, tone = '#fff3c8', className = '' }) {
  return <div className={`pointer-events-none animate-pop rounded-3xl border-2 border-white px-4 py-2.5 text-center shadow-soft ${className}`} style={{ background: tone }}>{children}</div>
}

function CatchCard({ res, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3400)
    return () => clearTimeout(t)
  }, [onDone])
  const f = FISH_BY_ID[res.fish]
  const r = RARITY[f?.rar] ?? RARITY.common
  return (
    <div className="pointer-events-none absolute left-1/2 top-[22%] z-20 w-[min(88vw,19rem)] -translate-x-1/2 animate-pop">
      <div className={`rounded-[2rem] p-4 text-center ${glass}`} style={{ boxShadow: `0 10px 30px ${r.color}55` }}>
        <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: r.color }}>{r.name}{res.quick ? ' · ⚡ çabuk çektin' : ''}</p>
        <div className="mx-auto mt-1 grid h-20 w-20 place-items-center rounded-full" style={{ background: `${r.color}22` }}>
          <Em e={f?.emoji ?? '🐟'} size={52} />
        </div>
        <p className="mt-1 text-xl font-black text-[#4a3b5c]">{f?.name}</p>
        <p className="text-xs font-extrabold text-[#8a7a9c]">+{res.xp} XP · ≈ {f?.price} 🪙</p>
      </div>
    </div>
  )
}

// ---------- ana hook ----------
export function useJobs(ctx) {
  const { net, touch, focusRef, home, venue, panel, setPanel } = ctx
  const { on, send } = net
  const where = home ? null : venue ? `venue:${venue}` : 'city'
  const [st, setSt] = useState(null)
  const [near, setNear] = useState({ spot: null, post: false, deliver: null })
  const [fish, setFish] = useState({ phase: 'idle' }) // idle | cast | wait | bite
  const [catchRes, setCatchRes] = useState(null)
  const [toast, setToast] = useState(null)
  const [tick, setTick] = useState(0)
  const stRef = useRef(null)
  stRef.current = st
  const fishRef = useRef(fish)
  fishRef.current = fish
  const castPos = useRef(null)

  // ----- ağ -----
  useEffect(() => {
    const showToast = (node, ms = 3000) => {
      const k = Math.random()
      setToast({ k, node })
      setTimeout(() => setToast((t) => (t?.k === k ? null : t)), ms)
    }
    const setWorkFor = (m) => {
      const prevPose = m.id === net.selfId.current ? work.self.current : work.poses.get(m.id)
      let pose = null
      if (m.style) {
        const same = prevPose && prevPose.style === m.style && prevPose.phase === (m.phase ?? null)
        pose = same && prevPose.fish === m.fish && prevPose.pk === m.pk ? prevPose : mkPose(m.style, m.phase ?? null, { fish: m.fish, pk: m.pk })
      }
      if (m.id === net.selfId.current) work.self.current = pose
      else if (pose) work.poses.set(m.id, pose)
      else work.poses.delete(m.id)
    }
    const offs = [
      on('welcome', () => {
        work.poses.clear()
        work.self.current = null
        send({ t: 'job_get' })
        send({ t: 'work_get' })
      }),
      on('room', () => {
        work.poses.clear()
        setFish({ phase: 'idle' })
        send({ t: 'work_get' })
      }),
      on('works', (m) => {
        work.poses.clear()
        for (const w of m.list ?? []) work.poses.set(w.id, mkPose(w.style, w.phase ?? null, { fish: w.fish, pk: w.pk }))
      }),
      on('work', setWorkFor),
      on('job_state', (m) => {
        setSt(m)
        work.job = m.job
        work.parcels = (m.parcels ?? []).map((p) => ({ ...p, name: p.name }))
        work.emit()
      }),
      on('job_level', (m) => {
        sfx('badge')
        showToast(
          <span className="text-sm font-black text-[#7a5b00]">
            {JOBS[m.job].emoji} {JOBS[m.job].name} · Seviye {m.level}!
          </span>,
          3200,
        )
      }),
      on('fish_state', (m) => {
        if (m.phase === 'cast') {
          castPos.current = { x: focusRef.current.x, z: focusRef.current.z }
          setFish({ phase: 'cast', spot: m.spot, t0: performance.now() })
          setTimeout(() => setFish((f) => (f.phase === 'cast' ? { ...f, phase: 'wait' } : f)), 800)
          sfx('move')
        } else if (m.phase === 'bite') {
          setFish({ phase: 'bite', spot: m.spot, t0: performance.now(), win: m.win })
          sfx('bell')
        } else if (m.phase === 'miss') {
          setFish({ phase: 'idle' })
          sfx('error')
          showToast(<span className="text-sm font-black text-[#7a4a4a]">🐟 Balık kaçtı… biraz geç kaldın!</span>, 2200)
        } else if (m.phase === 'early') {
          setFish({ phase: 'idle' })
          sfx('error')
          showToast(<span className="text-sm font-black text-[#7a4a4a]">🪝 Erken çektin, yem kaçtı. Şamandıra batınca çek!</span>, 2400)
        } else setFish({ phase: 'idle' })
      }),
      on('fish_caught', (m) => {
        setCatchRes({ ...m, k: Math.random() })
        sfx(m.rare ? 'badge' : 'quest')
      }),
      on('post_done', (m) => {
        sfx('gift')
        showToast(
          <span className="text-sm font-black text-[#7a5b00]">
            📮 Teslim edildi! +{m.coins} 🪙 {m.express ? '⚡ Ekspres' : ''} {m.bike ? '🚲' : ''}
          </span>,
          2800,
        )
      }),
      on('sfx', (m) => sfx(m.n)),
    ]
    return () => offs.forEach((off) => off())
  }, [on, send, net.selfId, focusRef])

  // ----- yakınlık + kargo süresi -----
  useEffect(() => {
    if (where !== 'city') {
      setNear({ spot: null, post: false, deliver: null })
      return
    }
    const id = setInterval(() => {
      const f = focusRef.current
      const spot = FISH_SPOTS.find((s) => Math.hypot(f.x - s.x, f.z - s.z) < s.radius + 0.9) ?? null
      const post = Math.hypot(f.x - POST_CENTER.x, f.z - POST_CENTER.z) < POST_CENTER.radius
      let deliver = null
      for (const p of work.parcels) {
        const d = VENUE_DOORS[p.to]
        if (d && Math.hypot(f.x - d.x, f.z - d.z) < PARCEL_DELIVER_R) {
          deliver = p
          break
        }
      }
      setNear((o) => (o.spot?.id === spot?.id && o.post === post && o.deliver?.id === deliver?.id ? o : { spot, post, deliver }))
      // olta atılmışken yerinden ayrılırsan olta toplanır
      const fs = fishRef.current
      if (fs.phase !== 'idle' && castPos.current && Math.hypot(f.x - castPos.current.x, f.z - castPos.current.z) > 0.9) {
        send({ t: 'fish_cancel' })
        setFish({ phase: 'idle' })
      }
    }, 180)
    return () => clearInterval(id)
  }, [where, focusRef, send])
  useEffect(() => {
    if (!st?.parcels?.length) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [st?.parcels?.length])

  // ----- eylemler -----
  const job = st?.job ?? null
  const openJobs = useCallback(() => {
    send({ t: 'job_get' })
    setPanel('jobs')
  }, [send, setPanel])
  const cast = useCallback(() => {
    if (!near.spot) return
    if (job !== 'fisher') return openJobs()
    send({ t: 'fish_cast', spot: near.spot.id })
  }, [near.spot, job, send, openJobs])
  const reel = useCallback(() => send({ t: 'fish_reel' }), [send])
  const pickup = useCallback(() => (job === 'postman' ? send({ t: 'post_pickup' }) : openJobs()), [job, send, openJobs])
  const deliver = useCallback(() => near.deliver && send({ t: 'post_deliver', id: near.deliver.id }), [near.deliver, send])

  useEffect(() => {
    const onKey = (e) => {
      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey || panel) return
      const k = e.code
      if (fish.phase === 'bite' && (k === 'KeyE' || k === 'Space')) {
        e.preventDefault()
        return reel()
      }
      if (k !== 'KeyE') return
      if (near.deliver) return deliver()
      if (fish.phase === 'idle' && near.spot) return cast()
      if (near.post) return pickup()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fish.phase, near, panel, reel, cast, deliver, pickup])

  // ----- çizim -----
  const parcels = st?.parcels ?? []
  const f0 = focusRef.current
  void tick
  const chips = parcels.map((p) => {
    const d = VENUE_DOORS[p.to]
    const dist = d ? Math.round(Math.hypot(f0.x - d.x, f0.z - d.z)) : 0
    const left = Math.max(0, Math.ceil((p.exp - Date.now()) / 1000))
    return { p, dist, left }
  })

  const prompt = (() => {
    if (panel || fish.phase !== 'idle') return null
    if (near.deliver) {
      const k = PARCEL_KINDS.find((x) => x.id === near.deliver.kind)
      return <DoorPrompt emoji={k?.emoji ?? '📦'} label={`${near.deliver.name}`} action="Teslim et" touch={touch} raised onGo={deliver} />
    }
    if (near.spot)
      return job === 'fisher' ? (
        <DoorPrompt emoji="🎣" label="Balıkçı İskelesi" action="Olta at" touch={touch} raised onGo={cast} />
      ) : (
        <DoorPrompt emoji="🎣" label="Balık tutmak için Balıkçı ol" action="Meslek seç" touch={touch} raised onGo={openJobs} />
      )
    if (near.post)
      return job === 'postman' ? (
        <DoorPrompt emoji="📮" label={`Posta Merkezi${parcels.length ? ` · ${parcels.length}/${st.cap}` : ''}`} action="Kargo al" touch={touch} raised onGo={pickup} />
      ) : (
        <DoorPrompt emoji="📮" label="Kargo taşımak için Postacı ol" action="Meslek seç" touch={touch} raised onGo={openJobs} />
      )
    return null
  })()

  const fishHud =
    fish.phase !== 'idle' && !panel ? (
      <div className={`pointer-events-auto absolute left-1/2 z-10 w-[min(92vw,20rem)] -translate-x-1/2 ${touch ? 'bottom-52' : 'bottom-16'}`}>
        {fish.phase === 'bite' ? (
          <button onClick={reel} className="relative w-full animate-pop overflow-hidden rounded-3xl border-b-4 border-[#d9604a] bg-[#ff7a66] px-4 py-4 text-2xl font-black text-white shadow-toy active:translate-y-[3px] active:border-b-[1px]">
            <span className="relative z-10">ÇEK! {touch ? '' : '(E / Boşluk)'}</span>
            <span key={fish.t0} className="absolute inset-y-0 left-0 bg-white/30" style={{ width: '100%', animation: `shrink-w ${fish.win ?? 1500}ms linear forwards` }} />
          </button>
        ) : (
          <div className={`flex animate-pop items-center gap-3 rounded-3xl p-3 pl-4 ${glass}`}>
            <span className="text-2xl" aria-hidden>🪝</span>
            <p className="min-w-0 flex-1 text-sm font-black text-[#4a3b5c]">
              {fish.phase === 'cast' ? 'Olta atılıyor…' : 'Şamandıra suda… sabırla bekle'}
              <span className="ml-1 inline-flex gap-0.5 align-middle">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#7fb9e8]" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </span>
            </p>
            <button onClick={() => send({ t: 'fish_cancel' })} className="rounded-xl bg-[#f6f0ff] px-3 py-2 text-xs font-extrabold text-[#6b4fc0] active:scale-95">Vazgeç</button>
          </div>
        )}
      </div>
    ) : null

  const parcelHud =
    chips.length > 0 && where === 'city' ? (
      <div className="pointer-events-none absolute left-1/2 top-[4.6rem] z-10 flex max-w-[94vw] -translate-x-1/2 flex-wrap justify-center gap-1.5">
        {chips.map(({ p, dist, left }) => {
          const k = PARCEL_KINDS.find((x) => x.id === p.kind)
          return (
            <div key={p.id} className={`flex animate-pop items-center gap-1.5 rounded-full py-1 pl-1.5 pr-3 text-xs font-black text-[#4a3b5c] ${glass}`}>
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#fff3c8]"><Em e={k?.emoji ?? '📦'} size={20} /></span>
              <span className="max-w-[8rem] truncate">{p.name}</span>
              <span className="tabular-nums text-[#8a7a9c]">{dist} m</span>
              <span className={`tabular-nums ${left > 0 ? 'text-[#d98a1c]' : 'text-[#b5a9c4]'}`}>{left > 0 ? `⚡ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : ''}</span>
            </div>
          )
        })}
      </div>
    ) : null

  return {
    extraButtons: [{ key: 'jobs', icon: 'job', label: 'Meslek', onClick: openJobs }],
    sceneNodes: <JobsWorld where={where} />,
    overlays: (
      <>
        {prompt}
        {fishHud}
        {parcelHud}
        {catchRes && <CatchCard key={catchRes.k} res={catchRes} onDone={() => setCatchRes(null)} />}
        {toast && (
          <div className="pointer-events-none absolute left-1/2 top-[30%] z-20 -translate-x-1/2">
            <Toast>{toast.node}</Toast>
          </div>
        )}
        {panel === 'jobs' && (
          <JobsPanel
            st={st}
            onClose={() => setPanel(null)}
            onPick={(id) => send({ t: 'job_choose', id })}
            onSell={(kind, id) => send({ t: 'job_sell', kind, id })}
          />
        )}
      </>
    ),
  }
}

