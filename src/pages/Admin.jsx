// Pre-alpha yönetici paneli (/admin): şikâyetler + geri bildirimler. Anahtar yalnızca bu sekmede (sessionStorage) tutulur.
import { useCallback, useEffect, useState } from 'react'

const KEY = 'situapp_admin_key'
const REASONS = { taciz: 'Taciz', spam: 'Spam', uygunsuz: 'Uygunsuz', foto: 'Fotoğraf', diger: 'Diğer' }
const fmt = (t) => (t ? new Date(t).toLocaleString('tr-TR') : '')

export default function Admin() {
  const [key, setKey] = useState(() => sessionStorage.getItem(KEY) ?? '')
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState('reports')
  const [showDone, setShowDone] = useState(false)

  const api = useCallback(
    async (path, body) => {
      const r = await fetch(`/api/admin/${path}`, { method: body ? 'POST' : 'GET', headers: { 'x-admin-key': key, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) throw new Error(d.error || 'İstek başarısız')
      return d
    },
    [key],
  )
  const load = useCallback(async () => {
    try {
      setErr('')
      setData(await api('overview'))
    } catch (e) {
      setData(null)
      setErr(e.message)
    }
  }, [api])
  useEffect(() => {
    if (key) load()
  }, [key, load])

  if (!data)
    return (
      <main className="grid min-h-svh place-items-center bg-[#fff8ee] p-6">
        <form
          className="w-full max-w-sm rounded-3xl border-2 border-white bg-white p-6 shadow-toy"
          onSubmit={(e) => {
            e.preventDefault()
            const v = new FormData(e.currentTarget).get('k')
            sessionStorage.setItem(KEY, v)
            setKey(v)
          }}
        >
          <h1 className="text-xl font-black text-ink">SituApp · Yönetici</h1>
          <input name="k" type="password" autoFocus placeholder="Yönetici anahtarı" className="mt-3 w-full rounded-2xl border-2 border-[#ffd9a8] px-3 py-2 font-semibold outline-none" />
          {err && <p className="mt-2 text-sm font-bold text-rose-500">{err}</p>}
          <button className="mt-3 w-full rounded-2xl bg-[#fdb252] py-2 font-black text-white">Giriş</button>
        </form>
      </main>
    )

  const reports = data.reports.filter((r) => showDone || !r.resolved)
  const act = async (fn) => {
    try {
      await fn()
      await load()
    } catch (e) {
      setErr(e.message)
    }
  }
  return (
    <main className="min-h-svh bg-[#fff8ee] p-4 text-[#4a3b5c]">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-black">Yönetici paneli</h1>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold">Veri: {data.mode}</span>
          <button onClick={load} className="rounded-full bg-white px-3 py-1 text-xs font-extrabold shadow">Yenile</button>
          <button onClick={() => (sessionStorage.removeItem(KEY), setKey(''), setData(null))} className="ml-auto rounded-full bg-white px-3 py-1 text-xs font-extrabold shadow">Çıkış</button>
        </header>
        {err && <p className="mt-2 text-sm font-bold text-rose-500">{err}</p>}
        <nav className="mt-4 flex gap-2">
          {[['reports', `Şikâyetler (${data.reports.filter((r) => !r.resolved).length})`], ['feedback', `Geri bildirim (${data.feedback.length})`]].map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)} className={`rounded-full px-4 py-1.5 text-sm font-extrabold ${tab === id ? 'bg-[#fdb252] text-white' : 'bg-white'}`}>{l}</button>
          ))}
          {tab === 'reports' && (
            <label className="ml-auto flex items-center gap-1 text-xs font-bold">
              <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> çözülenleri göster
            </label>
          )}
        </nav>

        {tab === 'reports' ? (
          <ul className="mt-3 flex flex-col gap-3">
            {reports.length === 0 && <li className="rounded-2xl bg-white p-4 text-sm font-bold">Bekleyen şikâyet yok 🎉</li>}
            {reports.map((r) => (
              <li key={r.id} className={`rounded-2xl border-2 border-white bg-white p-4 shadow ${r.resolved ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full bg-[#ffe3b8] px-2 py-0.5 text-xs font-black">{REASONS[r.reason] ?? r.reason}</span>
                  <b>{r.fromName ?? '?'}</b> → <b>{r.targetName ?? '?'}</b>
                  <span className="text-xs text-[#8a7a9c]">{fmt(r.ts)}</span>
                </div>
                {Array.isArray(r.context) && r.context.length > 0 && (
                  <div className="mt-2 rounded-xl bg-[#faf6ff] p-2 text-xs font-semibold">
                    {r.context.slice(-8).map((c, i) => (
                      <p key={i}><span className="text-[#8a7a9c]">[{c.kind ?? c.k ?? ''}]</span> {c.text ?? c.t ?? JSON.stringify(c)}</p>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {!r.resolved && <button onClick={() => act(() => api('resolve', { id: r.id }))} className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-black text-white">Çözüldü</button>}
                  {data.mode === 'supabase' && r.target && (
                    <>
                      <button onClick={() => act(() => api('hide-photo', { uid: r.target, hidden: true }))} className="rounded-full bg-rose-500 px-3 py-1 text-xs font-black text-white">Fotoğrafı gizle</button>
                      <button onClick={() => act(() => api('hide-photo', { uid: r.target, hidden: false }))} className="rounded-full bg-white px-3 py-1 text-xs font-extrabold shadow">Gizlemeyi kaldır</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {data.feedback.length === 0 && <li className="rounded-2xl bg-white p-4 text-sm font-bold">Henüz geri bildirim yok.</li>}
            {data.feedback.map((f, i) => (
              <li key={i} className="rounded-2xl border-2 border-white bg-white p-4 shadow">
                <p className="text-xs font-bold text-[#8a7a9c]">{fmt(f.ts)} · {f.kind} · {f.who || 'misafir'}{f.contact ? ` · ${f.contact}` : ''}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm font-semibold">{f.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
