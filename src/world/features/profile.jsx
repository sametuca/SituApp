import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal } from '../Hud'
import { PhotoSection } from './photoUpload'

const NUDGE_KEY = 'situapp_profile_nudge'
const MAX_TAGS = 6
const glass = 'border-2 border-white bg-white/90 shadow-toy backdrop-blur-md'

const isEmpty = (p) => !p || (!p.bio && !p.age && !p.city && !(p.tags?.length > 0))
const safeStore = {
  get: () => {
    try {
      return localStorage.getItem(NUDGE_KEY)
    } catch {
      return null
    }
  },
  set: () => {
    try {
      localStorage.setItem(NUDGE_KEY, '1')
    } catch {
      /* depolama kapalı */
    }
  },
}

function Chip({ tag, on, common, onClick, small }) {
  const cls = `inline-flex items-center gap-1 rounded-full border-2 font-extrabold transition ${small ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1.5 text-sm'} ${
    on ? 'border-[#fdb252] bg-[#ffead0] text-[#926021]' : common ? 'border-[#ffb703] bg-[#fff3c4] text-[#8a5a00]' : 'border-white bg-[#f6f0ff] text-[#5b4a70]'
  }`
  const body = (
    <>
      <span>{tag.emoji}</span>
      {tag.label}
    </>
  )
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={on} className={`${cls} active:scale-95`}>
      {body}
    </button>
  ) : (
    <span className={cls}>{body}</span>
  )
}

/** Etkileşim menüsünde kişinin mini profili + buz kırıcı düğmesi. */
function ProfileCard({ peer, profile, mine, catalog, request, onIce }) {
  useEffect(() => {
    request(peer.id)
  }, [peer.id, request])

  const byId = Object.fromEntries(catalog.map((t) => [t.id, t]))
  const tags = (profile?.tags ?? []).map((id) => byId[id]).filter(Boolean)
  const mineSet = new Set(mine?.tags ?? [])
  const common = tags.filter((t) => mineSet.has(t.id))
  const loading = profile === undefined
  const has = profile && !isEmpty(profile)

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-[#faf6ff] p-3">
      {loading ? (
        <p className="text-xs font-bold text-[#8a7a9c]">Profil yükleniyor…</p>
      ) : !has ? (
        <p className="text-xs font-bold text-[#8a7a9c]">{peer.name} henüz profilini doldurmamış.</p>
      ) : (
        <>
          {(profile.age || profile.city) && (
            <p className="text-xs font-extrabold text-[#6b4fc0]">
              {[profile.age ? `${profile.age} yaş` : null, profile.city ? `📍 ${profile.city}` : null].filter(Boolean).join(' · ')}
            </p>
          )}
          {profile.bio && <p className="text-sm font-semibold italic text-[#4a3b5c]">“{profile.bio}”</p>}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <Chip key={t.id} tag={t} small common={mineSet.has(t.id)} />
              ))}
            </div>
          )}
          {common.length > 0 && (
            <p className="text-xs font-extrabold text-[#b07a00]">
              ✨ {common.length} ortak ilgi: {common.map((t) => t.emoji).join(' ')}
            </p>
          )}
        </>
      )}
      <button
        onClick={onIce}
        className="rounded-2xl border-b-4 border-[#5fb0d8] bg-[#9bdcf7] py-2 text-sm font-extrabold text-[#1f5d7a] active:translate-y-[2px] active:border-b-2"
      >
        🧊 Buz kırıcı
      </button>
    </div>
  )
}

function ProfileEditor({ initial, catalog, onSave, onClose, net, photoEnabled, privacy, setPrivacy }) {
  const [bio, setBio] = useState(initial?.bio ?? '')
  const [age, setAge] = useState(initial?.age ? String(initial.age) : '')
  const [city, setCity] = useState(initial?.city ?? '')
  const [tags, setTags] = useState(initial?.tags ?? [])
  const ageNum = age === '' ? null : Number(age)
  const ageBad = age !== '' && (!Number.isInteger(ageNum) || ageNum < 18 || ageNum > 99)
  const toggle = (id) => setTags((t) => (t.includes(id) ? t.filter((x) => x !== id) : t.length >= MAX_TAGS ? t : [...t, id]))
  const field = 'w-full rounded-2xl border-2 border-[#d6c7ff] bg-[#faf6ff] px-4 py-2.5 text-base font-semibold text-[#4a3b5c] outline-none placeholder:text-[#8a7a9c]/60 focus:ring-4 focus:ring-[#d6c7ff]/60'

  return (
    <Modal onClose={onClose} label="Profilim">
      <h2 className="text-2xl font-black text-[#4a3b5c]">Profilim 💗</h2>
      <div className="mt-3">
        <PhotoSection net={net} enabled={photoEnabled} privacy={privacy} setPrivacy={setPrivacy} />
      </div>
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!ageBad) onSave({ bio: bio.trim(), age: ageNum, city: city.trim(), tags })
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-black text-[#4a3b5c]">Hakkında</span>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={120} rows={2} placeholder="Kendinden kısaca bahset…" className={`${field} resize-none`} />
          <span className="self-end text-[11px] font-bold text-[#8a7a9c]">{bio.length}/120</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-black text-[#4a3b5c]">Yaş</span>
            <input value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" placeholder="18+" aria-invalid={ageBad} className={field} />
            {ageBad && <span className="text-[11px] font-bold text-rose-400">Yaş 18–99 arasında olmalı.</span>}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-black text-[#4a3b5c]">Şehir</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={20} placeholder="İstanbul" className={field} />
          </label>
        </div>
        <div>
          <p className="text-sm font-black text-[#4a3b5c]">
            İlgi alanların <span className="text-xs font-bold text-[#8a7a9c]">({tags.length}/{MAX_TAGS})</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {catalog.map((t) => (
              <Chip key={t.id} tag={t} on={tags.includes(t.id)} onClick={() => toggle(t.id)} />
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={ageBad}
          className="w-full rounded-2xl border-b-4 border-[#e8952c] bg-[#fdb252] py-3 text-base font-extrabold text-white active:translate-y-[3px] active:border-b-[1px] disabled:opacity-50"
        >
          Kaydet
        </button>
        <button type="button" onClick={onClose} className="w-full rounded-2xl py-2 text-sm font-extrabold text-[#8a7a9c] hover:bg-[#ffedd6]/60">
          Vazgeç
        </button>
      </form>
    </Modal>
  )
}

/** Profil, ilgi etiketleri ve buz kırıcı kartlar (sunucu: server/features/profile.js). */
export function useProfile({ net, say, panel, setPanel, home }) {
  const [mine, setMine] = useState(null)
  const [catalog, setCatalog] = useState([])
  const [cache, setCache] = useState({}) // oyuncu id → profil | null
  const [nudge, setNudge] = useState(false)
  const [photoEnabled, setPhotoEnabled] = useState(false)
  const [privacy, setPrivacy] = useState('all')
  const [incoming, setIncoming] = useState([]) // yanıt bekleyen buz kırıcılar
  const [answers, setAnswers] = useState([]) // karşı tarafın seçimleri
  const reqAt = useRef({})

  useEffect(() => {
    const offs = [
      net.on('welcome', (m) => {
        setMine(m.profile ?? null)
        setPhotoEnabled(Boolean(m.photoEnabled))
        setPrivacy(m.photoPrivacy ?? 'all')
        setCatalog(m.profileTags ?? [])
        setCache({})
        setIncoming([])
        if (isEmpty(m.profile) && !safeStore.get()) {
          safeStore.set()
          // girişte ekran zaten kalabalık (öneri, rozet, ipuçları): hatırlatmayı biraz sonra göster
          setTimeout(() => setNudge(true), 30000)
        }
      }),
      net.on('photo_privacy', (m) => setPrivacy(m.who)),
      net.on('profile_saved', (m) => {
        setMine(m.profile)
        say('Profilin kaydedildi 💗')
      }),
      net.on('profile', (m) => setCache((c) => ({ ...c, [m.id]: m.profile }))),
      net.on('icebreaker', (m) => setIncoming((l) => [...l.filter((x) => x.id !== m.id), m].slice(-3))),
      net.on('icebreaker_answer', (m) => {
        const k = Date.now() + Math.random()
        setAnswers((l) => [...l, { ...m, k }].slice(-3))
        setTimeout(() => setAnswers((l) => l.filter((x) => x.k !== k)), 12000)
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [net, say])

  const request = useCallback(
    (id) => {
      const now = Date.now()
      if (now - (reqAt.current[id] ?? 0) < 2000) return
      reqAt.current[id] = now
      net.send({ t: 'profile', id })
    },
    [net],
  )

  const peerHeader = (peer) => (
    <ProfileCard peer={peer} profile={cache[peer.id]} mine={mine} catalog={catalog} request={request} onIce={() => net.send({ t: 'icebreaker', to: peer.id })} />
  )

  const settingsSections = [
    <section key="profile">
      <p className="text-sm font-black text-[#4a3b5c]">💗 Profilim</p>
      <p className="mt-0.5 text-xs font-semibold text-[#8a7a9c]">
        {isEmpty(mine) ? 'Henüz doldurmadın. Hakkında, yaşın, şehrin ve ilgi alanların diğer oyunculara görünür.' : `${mine.age ? `${mine.age} yaş · ` : ''}${mine.city || 'şehir yok'} · ${mine.tags?.length ?? 0} ilgi alanı`}
      </p>
      <button onClick={() => setPanel('profile')} className="mt-2 rounded-2xl bg-[#fff2e3] px-4 py-2 text-sm font-extrabold text-[#926021] active:scale-95">
        ✏️ Profilimi düzenle
      </button>
    </section>,
  ]

  const first = incoming[0]
  const overlays = (
    <>
      {panel === 'profile' && (
        <ProfileEditor
          initial={mine}
          net={net}
          photoEnabled={photoEnabled}
          privacy={privacy}
          setPrivacy={setPrivacy}
          catalog={catalog}
          onClose={() => setPanel(null)}
          onSave={(p) => {
            net.send({ t: 'profile_save', profile: p })
            setPanel(null)
          }}
        />
      )}
      {nudge && !panel && !home && (
        <div className={`absolute inset-x-3 bottom-24 z-20 mx-auto flex max-w-sm animate-pop flex-col gap-2 rounded-3xl p-4 ${glass}`} role="status">
          <p className="text-base font-black text-[#4a3b5c]">Profilini tamamla 💗</p>
          <p className="text-xs font-semibold text-[#8a7a9c]">Kısa bir tanıtım ve ilgi alanları ekle; ortak ilgileri olanlar seni daha kolay bulur.</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setNudge(false)
                setPanel('profile')
              }}
              className="flex-1 rounded-2xl border-b-4 border-[#e8952c] bg-[#fdb252] py-2.5 text-sm font-extrabold text-white active:translate-y-[2px] active:border-b-2"
            >
              Hadi dolduralım
            </button>
            <button onClick={() => setNudge(false)} className="rounded-2xl px-4 py-2.5 text-sm font-extrabold text-[#8a7a9c] hover:bg-[#ffedd6]/60">
              Sonra
            </button>
          </div>
        </div>
      )}
      {first && (
        <div className={`absolute left-1/2 top-24 z-20 flex w-[min(92vw,22rem)] -translate-x-1/2 animate-pop flex-col gap-2 rounded-3xl p-4 ${glass}`} role="dialog" aria-label="Buz kırıcı">
          <p className="text-xs font-extrabold text-[#5fb0d8]">🧊 {first.name} sana bir soru gönderdi</p>
          <p className="text-base font-black text-[#4a3b5c]">{first.q}</p>
          <div className="grid grid-cols-2 gap-2">
            {['a', 'b'].map((pick) => (
              <button
                key={pick}
                onClick={() => {
                  net.send({ t: 'icebreaker_answer', to: first.id, qid: first.qid, pick })
                  setIncoming((l) => l.slice(1))
                }}
                className="rounded-2xl border-b-4 border-[#5fb0d8] bg-[#9bdcf7] px-2 py-3 text-sm font-extrabold text-[#1f5d7a] active:translate-y-[2px] active:border-b-2"
              >
                {first[pick]}
              </button>
            ))}
          </div>
          <button onClick={() => setIncoming((l) => l.slice(1))} className="self-center text-xs font-extrabold text-[#8a7a9c] hover:underline">
            Şimdi değil
          </button>
        </div>
      )}
      {answers.length > 0 && (
        <div className="absolute left-1/2 top-48 z-20 flex w-[min(92vw,22rem)] -translate-x-1/2 flex-col gap-2">
          {answers.map((a) => (
            <div key={a.k} className={`animate-pop rounded-3xl p-3 pl-4 ${glass}`} role="status">
              <p className="text-sm font-extrabold text-[#4a3b5c]">
                🧊 {a.name} şunu seçti: <span className="text-[#fda533]">{a.choice}</span>
              </p>
              <p className="text-[11px] font-semibold text-[#8a7a9c]">
                {a.a} · {a.b}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  )

  return { peerHeader, settingsSections, overlays }
}
