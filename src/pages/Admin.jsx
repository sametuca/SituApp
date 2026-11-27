// Yönetim Paneli (/admin): kullanıcı adı + şifre (varsayılan: sametuca / 789522) ile giriş.
// Çevrimiçi oyuncular, atma (kick), yasaklama / yasak kaldırma, oyuncu şifresi & yönetici şifresi değiştirme, ödül ve duyuru.
import { useCallback, useEffect, useState } from 'react'

const TOK_KEY = 'situapp_admin_token'
const REASONS = { taciz: 'Taciz', spam: 'Spam', uygunsuz: 'Uygunsuz', foto: 'Fotoğraf', diger: 'Diğer' }
const fmt = (t) => (t ? new Date(t).toLocaleString('tr-TR') : '')
const fmtUp = (s) => `${Math.floor(s / 3600)}sa ${Math.floor((s % 3600) / 60)}dk`

export default function Admin() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOK_KEY) ?? '')
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [okMsg, setOkMsg] = useState('')
  const [tab, setTab] = useState('players')
  const [showDone, setShowDone] = useState(false)
  const [search, setSearch] = useState('')
  const [announceText, setAnnounceText] = useState('')

  // Form durumları
  const [banForm, setBanForm] = useState({ kind: 'key', target: '', name: '', reason: '' })
  const [pwForm, setPwForm] = useState({ uid: '', password: '' })
  const [adminPwForm, setAdminPwForm] = useState({ currentPassword: '', newPassword: '' })
  const [rewardForm, setRewardForm] = useState({ key: '', coins: '100', stars: '5' })

  const api = useCallback(
    async (path, body, authTok = token) => {
      const r = await fetch(`/api/admin/${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { ...(authTok ? { 'x-admin-token': authTok } : {}), 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) throw new Error(d.error || 'İstek başarısız')
      return d
    },
    [token],
  )

  const load = useCallback(async () => {
    try {
      setErr('')
      setData(await api('overview'))
    } catch (e) {
      setData(null)
      if (e.message.includes('Oturum')) {
        sessionStorage.removeItem(TOK_KEY)
        setToken('')
      }
      setErr(e.message)
    }
  }, [api])

  useEffect(() => {
    if (token) load()
  }, [token, load])

  const flash = (msg) => {
    setOkMsg(msg)
    setTimeout(() => setOkMsg(''), 3200)
  }

  const act = async (fn, successMsg) => {
    try {
      setErr('')
      await fn()
      if (successMsg) flash(successMsg)
      await load()
    } catch (e) {
      setErr(e.message)
    }
  }

  if (!data) {
    return (
      <main className="grid min-h-svh place-items-center bg-gradient-to-br from-[#fff2e3] via-[#f1e6ff] to-[#dff3ff] p-6">
        <form
          className="w-full max-w-sm rounded-[2rem] border-2 border-white bg-white/90 p-7 shadow-toy backdrop-blur-md"
          onSubmit={async (e) => {
            e.preventDefault()
            setErr('')
            const fd = new FormData(e.currentTarget)
            try {
              const res = await api('login', { username: fd.get('u'), password: fd.get('p') }, '')
              sessionStorage.setItem(TOK_KEY, res.token)
              setToken(res.token)
            } catch (ex) {
              setErr(ex.message)
            }
          }}
        >
          <div className="flex flex-col items-center text-center">
            <img src="/logo.png" alt="Rastla" className="h-14 w-auto" draggable={false} />
            <h1 className="mt-2 text-2xl font-black text-[#4a3b5c]">Yönetim Paneli</h1>
            <p className="text-xs font-bold text-[#8a7a9c]">Yetkili girişi yap</p>
          </div>
          <div className="mt-5 flex flex-col gap-3">
            <input
              name="u"
              autoFocus
              required
              placeholder="Kullanıcı adı"
              className="w-full rounded-2xl border-2 border-[#e9ddff] bg-[#faf7ff] px-4 py-2.5 text-sm font-bold text-[#4a3b5c] outline-none focus:border-[#a88bff]"
            />
            <input
              name="p"
              type="password"
              required
              placeholder="Şifre"
              className="w-full rounded-2xl border-2 border-[#e9ddff] bg-[#faf7ff] px-4 py-2.5 text-sm font-bold text-[#4a3b5c] outline-none focus:border-[#a88bff]"
            />
          </div>
          {err && <p className="mt-3 text-center text-xs font-extrabold text-rose-500">{err}</p>}
          <button className="mt-4 w-full rounded-2xl border-b-4 border-[#d98a1c] bg-[#fdb252] py-3 text-sm font-black text-white shadow-soft active:translate-y-[2px]">
            Giriş Yap
          </button>
        </form>
      </main>
    )
  }

  const openReports = data.reports.filter((r) => !r.resolved).length
  const banCount = data.bans.keys.length + data.bans.ips.length
  const reports = data.reports.filter((r) => showDone || !r.resolved)
  const q = search.trim().toLowerCase()
  const filteredPlayers = (data.players ?? []).filter(
    (p) => !q || p.name?.toLowerCase().includes(q) || p.key?.toLowerCase().includes(q) || p.room?.toLowerCase().includes(q),
  )

  return (
    <main className="min-h-svh bg-gradient-to-br from-[#fff5eb] via-[#f6f0ff] to-[#ebf6ff] p-4 text-[#4a3b5c] sm:p-6">
      <div className="mx-auto max-w-5xl">
        {/* Üst Başlık */}
        <header className="flex flex-wrap items-center gap-3 rounded-3xl border-2 border-white bg-white/85 px-5 py-3.5 shadow-soft backdrop-blur-md">
          <div>
            <h1 className="text-xl font-black text-[#4a3b5c]">Rastla · Yönetim Paneli</h1>
            <p className="text-xs font-bold text-[#8a7a9c]">
              Yönetici: <span className="text-[#6b4fc0]">{data.adminUser}</span> · Mod: {data.mode}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={load} className="rounded-full bg-[#efe6ff] px-4 py-1.5 text-xs font-black text-[#5b3fa8] transition hover:bg-[#e2d2ff]">
              Yenile
            </button>
            <button
              onClick={() => {
                sessionStorage.removeItem(TOK_KEY)
                setToken('')
                setData(null)
              }}
              className="rounded-full bg-[#ffece8] px-4 py-1.5 text-xs font-black text-[#b54141] transition hover:bg-[#ffd8d0]"
            >
              Çıkış
            </button>
          </div>
        </header>

        {/* Özet Kartları */}
        <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Çevrimiçi Oyuncu', data.onlineCount ?? 0, 'bg-[#e8f6ff] text-[#226b99]'],
            ['Açık Şikâyet', openReports, 'bg-[#fff2e3] text-[#9b5a00]'],
            ['Yasaklı Hesap/IP', banCount, 'bg-[#ffe8e8] text-[#a33131]'],
            ['Sunucu / Bellek', `${fmtUp(data.uptimeSec ?? 0)} · ${data.memMb ?? 0} MB`, 'bg-[#efe6ff] text-[#5b3fa8]'],
          ].map(([lbl, val, cls]) => (
            <div key={lbl} className={`rounded-2xl border-2 border-white p-3.5 shadow-soft ${cls}`}>
              <p className="text-[0.6875rem] font-extrabold uppercase tracking-wide opacity-80">{lbl}</p>
              <p className="mt-1 text-lg font-black">{val}</p>
            </div>
          ))}
        </section>

        {/* Canlı Duyuru Barı */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!announceText.trim()) return
            act(async () => {
              const r = await api('announce', { text: announceText })
              setAnnounceText('')
              flash(`Duyuru ${r.count} oyuncuya gönderildi!`)
            })
          }}
          className="mt-4 flex flex-wrap gap-2 rounded-2xl border-2 border-white bg-white/85 p-3 shadow-soft"
        >
          <input
            value={announceText}
            onChange={(e) => setAnnounceText(e.target.value)}
            placeholder="Tüm çevrimiçi oyunculara anlık duyuru yaz…"
            className="min-w-[220px] flex-1 rounded-xl border-2 border-[#efe6ff] bg-[#faf7ff] px-3.5 py-2 text-sm font-bold outline-none focus:border-[#a88bff]"
          />
          <button className="rounded-xl border-b-4 border-[#6c48c9] bg-[#8f6ef5] px-5 py-2 text-xs font-black text-white shadow-soft active:translate-y-[2px]">
            📢 Duyuru Gönder
          </button>
        </form>

        {err && <p className="mt-3 rounded-2xl bg-rose-100 px-4 py-2 text-xs font-extrabold text-rose-700">{err}</p>}
        {okMsg && <p className="mt-3 rounded-2xl bg-emerald-100 px-4 py-2 text-xs font-extrabold text-emerald-700">{okMsg}</p>}

        {/* Sekmeler */}
        <nav className="mt-4 flex flex-wrap gap-2">
          {[
            ['players', `Oyuncular (${data.players?.length ?? 0})`],
            ['bans', `Yasaklılar (${banCount})`],
            ['reports', `Şikâyetler (${openReports})`],
            ['feedback', `Geri Bildirim (${data.feedback.length})`],
            ['settings', 'Şifre & Ödül'],
          ].map(([id, l]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-full border-2 border-white px-4 py-1.5 text-xs font-black shadow-soft transition ${
                tab === id ? 'bg-[#fdb252] text-white' : 'bg-white text-[#5b4678] hover:bg-[#faf6ff]'
              }`}
            >
              {l}
            </button>
          ))}
          {tab === 'reports' && (
            <label className="ml-auto flex items-center gap-1.5 text-xs font-bold">
              <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> çözülenleri göster
            </label>
          )}
        </nav>

        {/* 1. ÇEVRİMİÇİ OYUNCULAR */}
        {tab === 'players' && (
          <section className="mt-4 flex flex-col gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Oyuncu adı, hesap anahtarı veya oda ara…"
              className="w-full rounded-2xl border-2 border-white bg-white/90 px-4 py-2.5 text-sm font-bold shadow-soft outline-none focus:border-[#a88bff]"
            />
            {filteredPlayers.length === 0 ? (
              <div className="rounded-2xl border-2 border-white bg-white/90 p-6 text-center text-sm font-bold text-[#8a7a9c] shadow-soft">
                Şu an çevrimiçi oyuncu yok.
              </div>
            ) : (
              <div className="grid gap-2.5">
                {filteredPlayers.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-white bg-white/90 p-3.5 shadow-soft">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-[#4a3b5c]">{p.name}</span>
                        <span className="rounded-full bg-[#efe6ff] px-2 py-0.5 text-[0.6875rem] font-extrabold text-[#5b3fa8]">{p.room}</span>
                        <span className="text-xs font-bold text-[#8a7a9c]">Sv. {p.level} · ⭐ {p.stars} · 🪙 {p.coins} ₺</span>
                      </div>
                      <p className="mt-0.5 truncate text-[0.6875rem] font-semibold text-[#8a7a9c]">
                        Anahtar: {p.key} {p.ip ? `· IP: ${p.ip}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => act(() => api('reward', { key: p.key, coins: 100 }), `${p.name} hesabına +100 ₺ eklendi`)}
                        className="rounded-xl bg-[#fff3c4] px-2.5 py-1.5 text-xs font-black text-[#8a5a00] hover:bg-[#ffe899]"
                      >
                        +100 ₺
                      </button>
                      <button
                        onClick={() => act(() => api('reward', { key: p.key, stars: 5 }), `${p.name} hesabına +5 ⭐ eklendi`)}
                        className="rounded-xl bg-[#efe6ff] px-2.5 py-1.5 text-xs font-black text-[#5b3fa8] hover:bg-[#e1d1ff]"
                      >
                        +5 ⭐
                      </button>
                      {p.uid && data.mode === 'supabase' && (
                        <button
                          onClick={() => {
                            setPwForm({ uid: p.uid, password: '' })
                            setTab('settings')
                          }}
                          className="rounded-xl bg-[#e6f4ff] px-2.5 py-1.5 text-xs font-black text-[#1d6496] hover:bg-[#d2ecff]"
                        >
                          Şifre
                        </button>
                      )}
                      <button
                        onClick={() => act(() => api('kick', { id: p.id }), `${p.name} oyundan atıldı`)}
                        className="rounded-xl bg-[#ffe6d6] px-2.5 py-1.5 text-xs font-black text-[#9e471b] hover:bg-[#ffd5bc]"
                      >
                        At
                      </button>
                      <button
                        onClick={() => act(() => api('ban', { key: p.key, name: p.name, reason: 'Yönetici yasağı' }), `${p.name} yasaklandı`)}
                        className="rounded-xl bg-[#4a3b5c] px-2.5 py-1.5 text-xs font-black text-white hover:bg-[#362946]"
                      >
                        Yasakla
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 2. YASAKLILAR VE MANUEL BAN */}
        {tab === 'bans' && (
          <section className="mt-4 flex flex-col gap-3">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!banForm.target.trim()) return
                act(async () => {
                  await api('ban', {
                    [banForm.kind === 'ip' ? 'ip' : 'key']: banForm.target.trim(),
                    name: banForm.name.trim() || undefined,
                    reason: banForm.reason.trim() || 'Yönetici yasağı',
                  })
                  setBanForm({ kind: 'key', target: '', name: '', reason: '' })
                }, 'Yasak eklendi')
              }}
              className="grid gap-2 rounded-2xl border-2 border-white bg-white/90 p-4 shadow-soft sm:grid-cols-5"
            >
              <select
                value={banForm.kind}
                onChange={(e) => setBanForm((f) => ({ ...f, kind: e.target.value }))}
                className="rounded-xl border-2 border-[#efe6ff] bg-[#faf7ff] px-3 py-2 text-xs font-extrabold outline-none"
              >
                <option value="key">Hesap / UID</option>
                <option value="ip">IP Adresi</option>
              </select>
              <input
                value={banForm.target}
                onChange={(e) => setBanForm((f) => ({ ...f, target: e.target.value }))}
                placeholder={banForm.kind === 'ip' ? 'Örn: 1.2.3.4' : 'Hesap anahtarı / UID'}
                className="rounded-xl border-2 border-[#efe6ff] bg-[#faf7ff] px-3 py-2 text-xs font-bold outline-none sm:col-span-2"
              />
              <input
                value={banForm.reason}
                onChange={(e) => setBanForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Yasak sebebi"
                className="rounded-xl border-2 border-[#efe6ff] bg-[#faf7ff] px-3 py-2 text-xs font-bold outline-none"
              />
              <button className="rounded-xl bg-[#4a3b5c] px-4 py-2 text-xs font-black text-white hover:bg-[#362946]">
                Yasakla
              </button>
            </form>

            <ul className="flex flex-col gap-2">
              {[...data.bans.keys.map((b) => ({ ...b, kind: 'hesap', id: b.key })), ...data.bans.ips.map((b) => ({ ...b, kind: 'ip', id: b.ip }))].map((b) => (
                <li key={b.kind + b.id} className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-white bg-white/90 p-3.5 text-sm shadow-soft">
                  <span className="rounded-full bg-[#ffe3b8] px-2.5 py-0.5 text-xs font-black">{b.kind}</span>
                  <b className="truncate">{b.name ?? b.id}</b>
                  <span className="text-xs text-[#8a7a9c]">({b.id}) · {b.reason} · {fmt(b.at)}</span>
                  <button
                    onClick={() => act(() => api('ban', { unban: true, [b.kind === 'ip' ? 'ip' : 'key']: b.id }), 'Yasak kaldırıldı')}
                    className="ml-auto rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-600"
                  >
                    Yasağı Kaldır
                  </button>
                </li>
              ))}
              {banCount === 0 && <li className="rounded-2xl border-2 border-white bg-white/90 p-4 text-sm font-bold text-[#8a7a9c] shadow-soft">Yasaklı hesap veya IP yok.</li>}
            </ul>
          </section>
        )}

        {/* 3. ŞİKÂYETLER */}
        {tab === 'reports' && (
          <ul className="mt-4 flex flex-col gap-3">
            {reports.length === 0 && <li className="rounded-2xl border-2 border-white bg-white/90 p-5 text-sm font-bold text-[#8a7a9c] shadow-soft">Bekleyen şikâyet yok.</li>}
            {reports.map((r) => (
              <li key={r.id} className={`rounded-2xl border-2 border-white bg-white/90 p-4 shadow-soft ${r.resolved ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full bg-[#ffe3b8] px-2.5 py-0.5 text-xs font-black">{REASONS[r.reason] ?? r.reason}</span>
                  <b>{r.fromName ?? '?'}</b> → <b>{r.targetName ?? '?'}</b>
                  <span className="text-xs text-[#8a7a9c]">{fmt(r.ts)}</span>
                </div>
                {Array.isArray(r.context) && r.context.length > 0 && (
                  <div className="mt-2 rounded-xl bg-[#faf6ff] p-2.5 text-xs font-semibold">
                    {r.context.slice(-8).map((c, i) => (
                      <p key={i}><span className="text-[#8a7a9c]">[{c.kind ?? c.k ?? ''}]</span> {c.text ?? c.t ?? JSON.stringify(c)}</p>
                    ))}
                  </div>
                )}
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {!r.resolved && (
                    <button onClick={() => act(() => api('resolve', { id: r.id }), 'Şikâyet çözüldü işaretlendi')} className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-black text-white">
                      Çözüldü
                    </button>
                  )}
                  {r.target && (
                    <button onClick={() => act(() => api('ban', { key: r.target, name: r.targetName, reason: `şikâyet: ${r.reason}` }), `${r.targetName ?? r.target} yasaklandı`)} className="rounded-xl bg-[#4a3b5c] px-3 py-1.5 text-xs font-black text-white">
                      Sınırsız Yasakla
                    </button>
                  )}
                  {data.mode === 'supabase' && r.target && (
                    <>
                      <button onClick={() => act(() => api('hide-photo', { uid: r.target, hidden: true }), 'Fotoğraf gizlendi')} className="rounded-xl bg-rose-500 px-3 py-1.5 text-xs font-black text-white">
                        Fotoğrafı Gizle
                      </button>
                      <button onClick={() => act(() => api('hide-photo', { uid: r.target, hidden: false }), 'Fotoğraf tekrar açıldı')} className="rounded-xl bg-[#efe6ff] px-3 py-1.5 text-xs font-extrabold text-[#5b3fa8]">
                        Gizlemeyi Kaldır
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* 4. GERİ BİLDİRİMLER */}
        {tab === 'feedback' && (
          <ul className="mt-4 flex flex-col gap-3">
            {data.feedback.length === 0 && <li className="rounded-2xl border-2 border-white bg-white/90 p-5 text-sm font-bold text-[#8a7a9c] shadow-soft">Henüz geri bildirim yok.</li>}
            {data.feedback.map((f, i) => (
              <li key={i} className="rounded-2xl border-2 border-white bg-white/90 p-4 shadow-soft">
                <p className="text-xs font-bold text-[#8a7a9c]">{fmt(f.ts)} · {f.kind} · {f.who || 'misafir'}{f.contact ? ` · ${f.contact}` : ''}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm font-semibold">{f.text}</p>
              </li>
            ))}
          </ul>
        )}

        {/* 5. ŞİFRE DEĞİŞTİRME & ÖDÜL GÖNDERME */}
        {tab === 'settings' && (
          <section className="mt-4 grid gap-4 sm:grid-cols-2">
            {/* Yönetici şifresi değiştir */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                act(async () => {
                  await api('admin-password', adminPwForm)
                  setAdminPwForm({ currentPassword: '', newPassword: '' })
                }, 'Yönetici şifresi güncellendi!')
              }}
              className="flex flex-col gap-3 rounded-2xl border-2 border-white bg-white/90 p-5 shadow-soft"
            >
              <h2 className="text-base font-black text-[#4a3b5c]">🔐 Yönetici Şifresini Değiştir</h2>
              <input
                type="password"
                required
                value={adminPwForm.currentPassword}
                onChange={(e) => setAdminPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
                placeholder="Mevcut yönetici şifresi"
                className="rounded-xl border-2 border-[#efe6ff] bg-[#faf7ff] px-3 py-2 text-xs font-bold outline-none"
              />
              <input
                type="password"
                required
                minLength={4}
                value={adminPwForm.newPassword}
                onChange={(e) => setAdminPwForm((f) => ({ ...f, newPassword: e.target.value }))}
                placeholder="Yeni şifre (en az 4 karakter)"
                className="rounded-xl border-2 border-[#efe6ff] bg-[#faf7ff] px-3 py-2 text-xs font-bold outline-none"
              />
              <button className="mt-auto rounded-xl bg-[#fdb252] py-2.5 text-xs font-black text-white shadow-soft">
                Yönetici Şifresini Güncelle
              </button>
            </form>

            {/* Oyuncu şifresi değiştir (Supabase) */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                act(async () => {
                  await api('set-password', pwForm)
                  setPwForm({ uid: '', password: '' })
                }, 'Oyuncu şifresi güncellendi!')
              }}
              className="flex flex-col gap-3 rounded-2xl border-2 border-white bg-white/90 p-5 shadow-soft"
            >
              <h2 className="text-base font-black text-[#4a3b5c]">🔑 Oyuncu Şifresi Değiştir</h2>
              <p className="text-xs font-semibold text-[#8a7a9c]">
                {data.mode === 'supabase' ? 'Supabase Auth UID üzerinden kullanıcının yeni şifresini belirler.' : 'Şifre sıfırlama yalnızca Supabase modunda aktiftir.'}
              </p>
              <input
                required
                value={pwForm.uid}
                onChange={(e) => setPwForm((f) => ({ ...f, uid: e.target.value }))}
                placeholder="Oyuncu UID (UUID)"
                className="rounded-xl border-2 border-[#efe6ff] bg-[#faf7ff] px-3 py-2 text-xs font-bold outline-none"
              />
              <input
                type="password"
                required
                minLength={6}
                value={pwForm.password}
                onChange={(e) => setPwForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Yeni şifre (en az 6 karakter)"
                className="rounded-xl border-2 border-[#efe6ff] bg-[#faf7ff] px-3 py-2 text-xs font-bold outline-none"
              />
              <button disabled={data.mode !== 'supabase'} className="mt-auto rounded-xl bg-[#8f6ef5] py-2.5 text-xs font-black text-white shadow-soft disabled:opacity-50">
                Oyuncu Şifresini Güncelle
              </button>
            </form>

            {/* Hesaba TL / Yıldız Ödülü Gönder */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                act(async () => {
                  await api('reward', { key: rewardForm.key, coins: Number(rewardForm.coins), stars: Number(rewardForm.stars) })
                }, 'Ödül hesaba eklendi!')
              }}
              className="flex flex-col gap-3 rounded-2xl border-2 border-white bg-white/90 p-5 shadow-soft sm:col-span-2"
            >
              <h2 className="text-base font-black text-[#4a3b5c]">🎁 Hesaba TL / Yıldız Gönder</h2>
              <div className="grid gap-2.5 sm:grid-cols-4">
                <input
                  required
                  value={rewardForm.key}
                  onChange={(e) => setRewardForm((f) => ({ ...f, key: e.target.value }))}
                  placeholder="Hesap anahtarı / UID"
                  className="rounded-xl border-2 border-[#efe6ff] bg-[#faf7ff] px-3 py-2 text-xs font-bold outline-none sm:col-span-2"
                />
                <input
                  type="number"
                  value={rewardForm.coins}
                  onChange={(e) => setRewardForm((f) => ({ ...f, coins: e.target.value }))}
                  placeholder="TL miktarı"
                  className="rounded-xl border-2 border-[#efe6ff] bg-[#faf7ff] px-3 py-2 text-xs font-bold outline-none"
                />
                <input
                  type="number"
                  value={rewardForm.stars}
                  onChange={(e) => setRewardForm((f) => ({ ...f, stars: e.target.value }))}
                  placeholder="Yıldız (⭐)"
                  className="rounded-xl border-2 border-[#efe6ff] bg-[#faf7ff] px-3 py-2 text-xs font-bold outline-none"
                />
              </div>
              <button className="w-fit rounded-xl bg-emerald-500 px-5 py-2 text-xs font-black text-white shadow-soft">
                Ödülü Gönder
              </button>
            </form>
          </section>
        )}
      </div>
    </main>
  )
}
