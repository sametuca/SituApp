import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ModelViewer from '../components/3d/ModelViewer'
import { generateModel } from '../lib/meshy'
import { listCharacters, saveCharacter, deleteCharacter } from '../lib/characters'
import { getStudioKey, setStudioKey, studioHeaders } from '../lib/studioKey'

const artStyles = [
  { id: 'realistic', label: 'Gerçekçi' },
  { id: 'sculpture', label: 'Heykelsi' },
]

const API_BASE = import.meta.env.VITE_API_BASE || ''

const WORLD_LOCATIONS = [
  { id: 'cafe', label: '☕ Kafe' },
  { id: 'park', label: '🌳 Park' },
  { id: 'club', label: '🪩 Gece Kulübü' },
  { id: 'beach', label: '🏖️ Plaj' },
]

const STAGE_LABELS = {
  preview: 'Taslak oluşturuluyor',
  refine: 'Doku & detay ekleniyor',
}

export default function AssetStudio() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [artStyle, setArtStyle] = useState('realistic')
  const [negativePrompt, setNegativePrompt] = useState('low quality, low poly, blurry texture')
  const [status, setStatus] = useState('idle') // idle | generating | done | error
  const [progress, setProgress] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [characters, setCharacters] = useState([])
  const [worldLocation, setWorldLocation] = useState('cafe')
  const [added, setAdded] = useState(null)
  const [studioKey, setStudioKeyState] = useState(getStudioKey())

  const saveStudioKey = (v) => {
    setStudioKeyState(v)
    setStudioKey(v.trim())
  }

  useEffect(() => {
    listCharacters().then(setCharacters).catch(() => {})
  }, [])

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setStatus('generating')
    setError(null)
    setResult(null)
    setProgress(null)
    setAdded(null)
    try {
      const data = await generateModel({
        prompt,
        artStyle,
        negativePrompt,
        onProgress: setProgress,
      })
      setResult(data)
      setStatus('done')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  const handleSave = async () => {
    if (!result) return
    const entry = await saveCharacter({
      name: name || prompt.slice(0, 24),
      prompt,
      artStyle,
      modelUrls: result.model_urls,
      thumbnailUrl: result.thumbnail_url,
    })
    setCharacters((c) => [...c, entry])
    setName('')
    setPrompt('')
    setResult(null)
    setStatus('idle')
  }

  const handleAddToWorld = async () => {
    if (!result?.model_urls?.glb) return
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/assets/import`, {
        method: 'POST',
        headers: studioHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          name: name || prompt.slice(0, 24),
          location: worldLocation,
          prompt,
          glbUrl: result.model_urls.glb,
          thumbnailUrl: result.thumbnail_url,
          position: [-2 + Math.random() * 4, 0, -2 + Math.random() * 2],
          scale: 1.5,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Eklenemedi')
      setAdded(data.url)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (id) => {
    await deleteCharacter(id)
    setCharacters((c) => c.filter((x) => x.id !== id))
  }

  return (
    <div className="min-h-screen w-full bg-[#0a0010] px-6 py-8">
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a0030] via-[#0a0010] to-[#000820] -z-10 fixed" />

      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate('/')} className="text-white/40 text-sm">
            ← Ana sayfa
          </button>
          <h1 className="text-white text-xl font-bold">Asset Studio</h1>
          <div className="w-16" />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* form */}
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10 flex flex-col gap-3">
            <label className="text-white/60 text-xs uppercase tracking-wide">Studio Anahtarı</label>
            <input
              type="password"
              value={studioKey}
              onChange={(e) => saveStudioKey(e.target.value)}
              placeholder="server/.env → STUDIO_KEY"
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/20 outline-none focus:border-purple-400"
            />
            <p className="text-white/30 text-xs -mt-1">Bu anahtar yalnızca tarayıcında saklanır; dahili asset uçlarına gönderilir.</p>

            <label className="text-white/60 text-xs uppercase tracking-wide mt-2">Karakter Adı</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="örn. Lara"
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/20 outline-none focus:border-purple-400"
            />

            <label className="text-white/60 text-xs uppercase tracking-wide mt-2">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="örn. genç kadın karakter, kısa kahverengi saç, rahat kıyafet, stilize 3d karakter"
              rows={4}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/20 outline-none focus:border-purple-400 resize-none"
            />

            <label className="text-white/60 text-xs uppercase tracking-wide mt-2">Negatif Prompt</label>
            <input
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/20 outline-none focus:border-purple-400"
            />

            <label className="text-white/60 text-xs uppercase tracking-wide mt-2">Stil</label>
            <div className="flex gap-2">
              {artStyles.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setArtStyle(s.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border ${
                    artStyle === s.id
                      ? 'bg-purple-600 border-purple-400 text-white'
                      : 'bg-white/5 border-white/10 text-white/50'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <button
              onClick={handleGenerate}
              disabled={status === 'generating' || !prompt.trim()}
              className="mt-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold disabled:opacity-40"
            >
              {status === 'generating' ? 'Üretiliyor…' : 'Modeli Üret'}
            </button>

            {status === 'generating' && (
              <div className="text-white/50 text-sm text-center">
                {STAGE_LABELS[progress?.stage] || 'Başlatılıyor'}
                {typeof progress?.progress === 'number' ? ` — %${progress.progress}` : ''}
              </div>
            )}
            {status === 'error' && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}
          </div>

          {/* preview */}
          <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden h-80 md:h-auto flex items-center justify-center">
            {result?.model_urls?.glb ? (
              <ModelViewer url={result.model_urls.glb} />
            ) : (
              <p className="text-white/20 text-sm px-6 text-center">
                Üretilen model burada 3D olarak önizlenecek
              </p>
            )}
          </div>
        </div>

        {result?.model_urls?.glb && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={handleSave}
              className="px-6 py-3 rounded-xl bg-white/10 text-white font-medium border border-white/20"
            >
              ✓ Karaktere kaydet
            </button>
            <select
              value={worldLocation}
              onChange={(e) => setWorldLocation(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white"
            >
              {WORLD_LOCATIONS.map((l) => (
                <option key={l.id} value={l.id} className="text-black">
                  {l.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleAddToWorld}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium"
            >
              🌍 Dünyaya ekle
            </button>
            {added && <span className="text-emerald-400 text-sm">Eklendi: {added}</span>}
          </div>
        )}
        {status === 'done' && error && <p className="text-red-400 text-sm mt-2">{error}</p>}

        {/* saved characters */}
        <div className="mt-10">
          <h2 className="text-white/70 text-sm uppercase tracking-wide mb-3">
            Kayıtlı Karakterler ({characters.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {characters.map((c) => (
              <div key={c.id} className="bg-white/5 border border-white/10 rounded-xl p-3 relative group">
                <div className="aspect-square rounded-lg overflow-hidden bg-black/20 mb-2">
                  {c.modelUrls?.glb && <ModelViewer url={c.modelUrls.glb} />}
                </div>
                <p className="text-white text-sm font-medium truncate">{c.name}</p>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white/60 text-xs opacity-0 group-hover:opacity-100 transition"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
