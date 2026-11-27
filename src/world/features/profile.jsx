// Profil kartı, düzenleyici, ilgi etiketleri, uyumluluk göstergeleri, ruh hali.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Dock } from '../../components/Dock'
import { Modal } from '../Hud'
import { PhotoSection } from './photoUpload'
import { Ico, TagIcon } from '../../components/Icon'
import { MUSIC, MOODS, zodiacOf, zodiacMatch } from '../vibeData'

const NUDGE_KEY = 'situapp_profile_nudge'
const MAX_TAGS = 6

const isEmpty = (p) => !p || (!p.bio && !p.age && !p.birthDate && !p.city && !p.instagram && !p.x && !p.music && !p.instagramLocked && !p.xLocked && !(p.tags?.length > 0))

function SocialValue({ label, value, locked }) {
  return (
    <p className="flex items-center gap-1.5 truncate">
      <span className="shrink-0">{label}:</span>
      <span className="truncate">
        {value ? (
          `@${value}`
        ) : locked ? (
          <span title="Sadece arkadaşlara açık" className="font-bold text-[#8a7a9c]">
            Sadece arkadaşlar
          </span>
        ) : (
          <span className="font-semibold text-[#8a7a9c]/75">—</span>
        )}
      </span>
    </p>
  )
}

function calcAge(birthDate) {
  if (!birthDate) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate)
  if (!m) return null
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  const now = new Date()
  let age = now.getFullYear() - y
  if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) age--
  return age
}

function fmtBirth(birthDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthDate ?? ''))
  return m ? `${m[3]}.${m[2]}.${m[1]}` : ''
}
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

function Chip({ tag, on, common, onClick, small, showIcon = true }) {
  const cls = `inline-flex items-center gap-1.5 rounded-full border-2 font-extrabold transition ${small ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1.5 text-sm'} ${
    on ? 'border-[#fdb252] bg-[#ffead0] text-[#926021]' : common ? 'border-[#ffb703] bg-[#fff3c4] text-[#8a5a00]' : 'border-white bg-[#f6f0ff] text-[#5b4a70]'
  }`
  const body = (
    <>
      {showIcon && <TagIcon id={tag.id} label={tag.label} size={small ? 13 : 15} />}
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

/** Göze batmayan ortak etiketler: burç, müzik zevki, ruh hali + sohbet açıcı öneri. */
function Vibes({ profile, mine, mood, myMood }) {
  const zo = zodiacOf(profile?.birthDate)
  const myZo = zodiacOf(mine?.birthDate)
  const music = MUSIC.find((m) => m.id === profile?.music)
  const myMusic = mine?.music
  const md = MOODS.find((m) => m.id === mood)
  const zMatch = zodiacMatch(zo, myZo)
  const sameMusic = music && music.id === myMusic
  const sameMood = md && md.id === myMood
  const items = [
    zo && { k: 'z', text: `${zo.emoji} ${zo.label}`, common: Boolean(zMatch), title: zMatch ?? 'Burç' },
    music && { k: 'm', text: `${music.emoji} ${music.label}`, common: sameMusic, title: 'Müzik zevki' },
    md && { k: 'd', text: `${md.emoji} ${md.label}`, common: sameMood, title: 'Şu anki ruh hali' },
  ].filter(Boolean)
  if (!items.length) return null
  const hint = sameMusic ? `🎵 İkiniz de ${music.label} dinliyorsunuz. Ona en sevdiği şarkıyı sor!` : sameMood ? `${md.emoji} İkiniz de aynı havadasınız, sohbet başlatmak için güzel bir an.` : zMatch ? `${zo.emoji} ${zMatch}. Burç muhabbetiyle başlayabilirsin.` : md?.id === 'sohbet' ? '💬 Sohbete açık görünüyor, bir merhaba yeter.' : null
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        {items.map((i) => (
          <span key={i.k} title={i.title} className={`rounded-full border-2 px-2 py-0.5 text-[11px] font-extrabold ${i.common ? 'border-[#ffb703] bg-[#fff3c4] text-[#8a5a00]' : 'border-white bg-[#f6f0ff] text-[#5b4a70]'}`}>
            {i.text}
          </span>
        ))}
      </div>
      {hint && <p className="text-[11px] font-bold text-[#8a5a00]">{hint}</p>}
    </div>
  )
}

/** Etkileşim menüsünde kişinin mini profili. */
function ProfileCard({ peer, profile, mine, catalog, request, myMood }) {
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
        <div className="grid grid-cols-2 gap-1.5 text-[11px] font-bold text-[#8a7a9c]">
          <p>Doğum: <span className="font-semibold opacity-70">Belirtilmedi</span></p>
          <p>Şehir: <span className="font-semibold opacity-70">Belirtilmedi</span></p>
          <p>Instagram: <span className="font-semibold opacity-70">—</span></p>
          <p>X: <span className="font-semibold opacity-70">—</span></p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1.5 text-xs font-extrabold text-[#6b4fc0]">
            <p className="flex items-center gap-1.5 truncate">
              <span className="shrink-0">Doğum:</span>
              <span className="truncate">
                {profile.birthDate ? `${fmtBirth(profile.birthDate)}${profile.age ? ` (${profile.age})` : ''}` : profile.age ? `${profile.age} yaş` : <span className="font-semibold text-[#8a7a9c]/75">Belirtilmedi</span>}
              </span>
            </p>
            <p className="flex items-center gap-1.5 truncate">
              <span className="shrink-0">Şehir:</span>
              <span className="truncate">
                {profile.city ? profile.city : <span className="font-semibold text-[#8a7a9c]/75">Belirtilmedi</span>}
              </span>
            </p>
            <SocialValue label="Instagram" value={profile.instagram} locked={profile.instagramLocked} />
            <SocialValue label="X" value={profile.x} locked={profile.xLocked} />
          </div>
          <Vibes profile={profile} mine={mine} mood={profile.mood} myMood={myMood} />
          {profile.bio && <p className="text-sm font-semibold italic text-[#4a3b5c]">“{profile.bio}”</p>}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <Chip key={t.id} tag={t} small common={mineSet.has(t.id)} showIcon={false} />
              ))}
            </div>
          )}
          {common.length > 0 && (
            <p className="text-xs font-extrabold text-[#b07a00]">
              {common.length} ortak ilgi: {common.map((t) => t.label).join(', ')}
            </p>
          )}
        </>
      )}
    </div>
  )
}

function ProfileEditor({ initial, catalog, onSave, onClose, net, photoEnabled, privacy, setPrivacy }) {
  const [bio, setBio] = useState(initial?.bio ?? '')
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? '')
  const [city, setCity] = useState(initial?.city ?? '')
  const [instagram, setInstagram] = useState(initial?.instagram ?? '')
  const [xHandle, setXHandle] = useState(initial?.x ?? '')
  const [socialPrivacy, setSocialPrivacy] = useState(initial?.socialPrivacy === 'friends' ? 'friends' : 'all')
  const [tags, setTags] = useState(initial?.tags ?? [])
  const [music, setMusic] = useState(initial?.music ?? '')
  const ageNum = birthDate ? calcAge(birthDate) : (initial?.age ?? null)
  const ageBad = Boolean(birthDate) && (ageNum === null || ageNum < 18 || ageNum > 99)
  const toggle = (id) => setTags((t) => (t.includes(id) ? t.filter((x) => x !== id) : t.length >= MAX_TAGS ? t : [...t, id]))
  const field = 'w-full rounded-2xl border-2 border-[#d6c7ff] bg-[#faf6ff] px-3.5 py-2 text-sm font-semibold text-[#4a3b5c] outline-none placeholder:text-[#8a7a9c]/60 focus:ring-4 focus:ring-[#d6c7ff]/60'

  return (
    <Modal onClose={onClose} label="Profilim">
      <h2 className="flex items-center gap-2 text-2xl font-black text-[#4a3b5c]"><Ico name="user" size={26} /> Profilim</h2>
      <div className="mt-3">
        <PhotoSection net={net} enabled={photoEnabled} privacy={privacy} setPrivacy={setPrivacy} />
      </div>
      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!ageBad) {
            onSave({
              bio: bio.trim(),
              birthDate,
              age: ageNum,
              city: city.trim(),
              instagram: instagram.trim().replace(/^@+/, ''),
              x: xHandle.trim().replace(/^@+/, ''),
              socialPrivacy,
              tags,
              music,
            })
          }
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-black text-[#4a3b5c]">Hakkında</span>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={120} rows={2} placeholder="Kendinden kısaca bahset…" className={`${field} resize-none`} />
          <span className="self-end text-[11px] font-bold text-[#8a7a9c]">{bio.length}/120</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="flex items-center justify-between text-sm font-black text-[#4a3b5c]">
              <span className="inline-flex items-center gap-1.5"><Ico name="cake" size={16} /> Doğum Tarihi</span>
              {ageNum !== null && !ageBad && <span className="rounded-full bg-[#efe6ff] px-2 py-0.5 text-[10px] text-[#6b4fc0]">{ageNum} yaş</span>}
            </span>
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} aria-invalid={ageBad} className={field} />
            {ageBad && <span className="text-[11px] font-bold text-rose-400">18–99 yaş arasında olmalı.</span>}
          </label>
          <label className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-1.5 text-sm font-black text-[#4a3b5c]"><Ico name="pin" size={16} /> Şehir</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={20} placeholder="İstanbul" className={field} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-1.5 text-sm font-black text-[#4a3b5c]"><Ico name="instagram" size={16} /> Instagram</span>
            <input value={instagram} onChange={(e) => setInstagram(e.target.value.replace(/\s/g, ''))} maxLength={30} placeholder="@kullaniciadi" className={field} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-black text-[#4a3b5c]">𝕏 X (Twitter)</span>
            <input value={xHandle} onChange={(e) => setXHandle(e.target.value.replace(/\s/g, ''))} maxLength={30} placeholder="@kullaniciadi" className={field} />
          </label>
        </div>
        <div className="rounded-2xl bg-[#faf6ff] p-2.5">
          <p className="text-xs font-black text-[#4a3b5c]">Instagram ve X’i kimler görsün?</p>
          <div className="mt-1.5 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Sosyal hesap gizliliği">
            {[
              ['all', '🌍 Herkes'],
              ['friends', '🔒 Sadece arkadaşlar'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={socialPrivacy === id}
                onClick={() => setSocialPrivacy(id)}
                className={`rounded-2xl border-2 px-2 py-2 text-xs font-extrabold transition ${socialPrivacy === id ? 'border-[#fdb252] bg-[#ffead0] text-[#926021]' : 'border-white bg-white text-[#5b4a70]'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-black text-[#4a3b5c]">
            Müzik zevkin
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {MUSIC.map((m) => (
              <button key={m.id} type="button" aria-pressed={music === m.id} onClick={() => setMusic(music === m.id ? '' : m.id)} className={`rounded-full border-2 px-3 py-1.5 text-sm font-extrabold active:scale-95 ${music === m.id ? 'border-[#fdb252] bg-[#ffead0] text-[#926021]' : 'border-white bg-[#f6f0ff] text-[#5b4a70]'}`}>
                {m.emoji} {m.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm font-black text-[#4a3b5c]">
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

/** Profil ve ilgi etiketleri (sunucu: server/features/profile.js). */
export function useProfile({ net, say, panel, setPanel, home }) {
  const [mine, setMine] = useState(null)
  const [catalog, setCatalog] = useState([])
  const [cache, setCache] = useState({}) // oyuncu id → profil | null
  const [nudge, setNudge] = useState(false)
  const [photoEnabled, setPhotoEnabled] = useState(false)
  const [privacy, setPrivacy] = useState('all')
  const [myMood, setMyMood] = useState(null)
  const reqAt = useRef({})

  useEffect(() => {
    const offs = [
      net.on('welcome', (m) => {
        setMine(m.profile ?? null)
        setMyMood(m.vibe?.mood ?? null)
        setPhotoEnabled(Boolean(m.photoEnabled))
        setPrivacy(m.photoPrivacy ?? 'all')
        setCatalog(m.profileTags ?? [])
        setCache({})
        if (isEmpty(m.profile) && !safeStore.get()) {
          safeStore.set()
          // girişte ekran zaten kalabalık (öneri, rozet, ipuçları): hatırlatmayı biraz sonra göster
          setTimeout(() => setNudge(true), 30000)
        }
      }),
      net.on('mood', (m) => {
        if (m.mine) setMyMood(m.mood)
        else {
          reqAt.current = {}
          setCache({})
        }
      }),
      net.on('photo_privacy', (m) => setPrivacy(m.who)),
      net.on('profile_saved', (m) => {
        setMine(m.profile)
        say('Profilin kaydedildi 💗')
      }),
      net.on('profile', (m) => setCache((c) => ({ ...c, [m.id]: m.profile }))),
      net.on('friends', () => {
        reqAt.current = {}
        setCache({})
      }),
      net.on('friend_added', () => {
        reqAt.current = {}
        setCache({})
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
    <ProfileCard peer={peer} profile={cache[peer.id]} mine={mine} catalog={catalog} request={request} myMood={myMood} />
  )

  const settingsSections = [
    <section key="profile">
      <p className="text-sm font-black text-[#4a3b5c]">Profilim</p>
      <p className="mt-0.5 text-xs font-semibold text-[#8a7a9c]">
        {isEmpty(mine) ? 'Henüz doldurmadın. Hakkında, yaşın, şehrin ve ilgi alanların diğer oyunculara görünür.' : `${mine.age ? `${mine.age} yaş · ` : ''}${mine.city || 'şehir yok'} · ${mine.tags?.length ?? 0} ilgi alanı`}
      </p>
      <button onClick={() => setPanel('profile')} className="mt-2 rounded-2xl bg-[#fff2e3] px-4 py-2 text-sm font-extrabold text-[#926021] active:scale-95">
        Profilimi düzenle
      </button>
      <p className="mt-3 text-sm font-black text-[#4a3b5c]">Şu anki ruh halim</p>
      <p className="mt-0.5 text-xs font-semibold text-[#8a7a9c]">Diğerleri profil kartında görür, 6 saat sonra kendiliğinden silinir.</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {MOODS.map((m) => (
          <button key={m.id} type="button" aria-pressed={myMood === m.id} onClick={() => net.send({ t: 'mood_set', id: myMood === m.id ? null : m.id })} className={`rounded-full border-2 px-3 py-1.5 text-xs font-extrabold active:scale-95 ${myMood === m.id ? 'border-[#fdb252] bg-[#ffead0] text-[#926021]' : 'border-white bg-[#f6f0ff] text-[#5b4a70]'}`}>
            {m.emoji} {m.label}
          </button>
        ))}
      </div>
    </section>,
  ]

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
        <Dock><div className="pointer-events-auto relative mx-auto flex w-full max-w-sm animate-pop flex-col gap-2 rounded-3xl p-4 border-2 border-white bg-white/80 shadow-soft backdrop-blur-md" role="status">
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
        </div></Dock>
      )}
    </>
  )

  return { peerHeader, settingsSections, overlays }
}
