// Fotoğraf kabini: kare çerçeveleme, yerel albüm (localStorage) ve diyaloglar. Sunucu gerekmez.
import { useState } from 'react'
import { Modal } from '../Hud'

const ALBUM_MAX = 12
const albumKey = (who) => `situapp_photos_v1_${who || 'misafir'}`

export function loadAlbum(who) {
  try {
    const list = JSON.parse(localStorage.getItem(albumKey(who)))
    return Array.isArray(list) ? list.filter((p) => p && typeof p.url === 'string') : []
  } catch {
    return []
  }
}

/** Albüme ekler (en yeni başta, en çok 12); kota dolarsa en eskiyi atıp yeniden dener. Yeni listeyi döndürür. */
export function saveToAlbum(who, photo) {
  let list = [photo, ...loadAlbum(who)].slice(0, ALBUM_MAX)
  for (;;) {
    try {
      localStorage.setItem(albumKey(who), JSON.stringify(list))
      return list
    } catch {
      if (list.length <= 1) return list
      list = list.slice(0, -1)
    }
  }
}

export function removeFromAlbum(who, id) {
  const list = loadAlbum(who).filter((p) => p.id !== id)
  try {
    localStorage.setItem(albumKey(who), JSON.stringify(list))
  } catch {
    /* yoksay */
  }
  return list
}

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

function heart(ctx, x, y, s, color) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, 0.35)
  ctx.bezierCurveTo(-1, -0.35, -0.5, -1, 0, -0.45)
  ctx.bezierCurveTo(0.5, -1, 1, -0.35, 0, 0.35)
  ctx.fill()
  ctx.restore()
}

function star(ctx, x, y, r, color) {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = color
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2
    const rad = i % 2 ? r * 0.45 : r
    ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad)
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

const pad2 = (n) => String(n).padStart(2, '0')

/** Canvas karesini pastel çerçeve + tarih + "SituApp" damgasıyla birleştirir. { full, thumb } (JPEG data URL) döndürür. */
export async function composePhoto(shot, who) {
  const img = await loadImage(shot.url)
  const maxW = 1100
  const pw = Math.min(maxW, img.naturalWidth)
  const ph = Math.round((pw * img.naturalHeight) / img.naturalWidth)
  const PAD = 44
  const FOOT = 128
  const W = pw + PAD * 2
  const H = ph + PAD + FOOT
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')

  const bg = g.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#dbf7f6')
  bg.addColorStop(0.5, '#e9ddff')
  bg.addColorStop(1, '#c9ebff')
  g.fillStyle = bg
  g.fillRect(0, 0, W, H)

  // süs: noktalı pastel daireler
  g.globalAlpha = 0.35
  g.fillStyle = '#ffffff'
  for (let i = 0; i < 26; i++) {
    g.beginPath()
    g.arc(((i * 197) % W) | 0, ((i * 331) % H) | 0, 6 + (i % 4) * 4, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1

  // beyaz çerçeveli, yuvarlak köşeli fotoğraf
  const r = 30
  const rr = (x, y, w, h, rad) => {
    g.beginPath()
    g.roundRect(x, y, w, h, rad)
  }
  g.save()
  g.shadowColor = 'rgba(168,139,255,0.45)'
  g.shadowBlur = 24
  g.shadowOffsetY = 8
  g.fillStyle = '#fff'
  rr(PAD - 10, PAD - 10, pw + 20, ph + 20, r + 8)
  g.fill()
  g.restore()
  g.save()
  rr(PAD, PAD, pw, ph, r)
  g.clip()
  g.drawImage(img, PAD, PAD, pw, ph)
  g.restore()

  // köşelerde kalp ve yıldız
  heart(g, PAD + 6, PAD + 6, 34, '#71dedd')
  star(g, W - PAD - 6, PAD + 4, 22, '#ffd35e')
  heart(g, W - PAD - 30, PAD + ph - 12, 22, '#9fe8e8')

  // alt şerit: damga + tarih
  const d = new Date()
  const stamp = `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} · ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  const baseY = PAD + ph + 80
  g.textBaseline = 'alphabetic'
  g.fillStyle = '#53c1bf'
  g.font = '900 52px Nunito, system-ui, sans-serif'
  g.textAlign = 'left'
  g.fillText('SituApp', PAD + 4, baseY)
  heart(g, PAD + 4 + g.measureText('SituApp').width + 26, baseY - 20, 18, '#71dedd')
  g.fillStyle = '#6d5a85'
  g.font = '800 30px Nunito, system-ui, sans-serif'
  g.textAlign = 'right'
  g.fillText(stamp, W - PAD - 4, baseY - 22)
  if (who) {
    g.fillStyle = '#9a89b3'
    g.font = '700 24px Nunito, system-ui, sans-serif'
    g.fillText(who, W - PAD - 4, baseY + 10)
  }

  const full = c.toDataURL('image/jpeg', 0.9)
  const tw = 520
  const t = document.createElement('canvas')
  t.width = tw
  t.height = Math.round((tw * H) / W)
  t.getContext('2d').drawImage(c, 0, 0, t.width, t.height)
  return { full, thumb: t.toDataURL('image/jpeg', 0.72) }
}

export function download(url, name = `situapp-${Date.now()}.jpg`) {
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

const btn = 'flex-1 rounded-2xl border-b-4 py-2.5 text-sm font-extrabold active:translate-y-[2px] active:border-b-2'
const pink = `${btn} border-[#53c1bf] bg-[#71dedd] text-white`
const lilac = `${btn} border-[#c9b6f5] bg-[#e9ddff] text-[#5b3fa8]`

/** 3-2-1 geri sayımı (kamera DOM'u çekmez; yalnızca poz verme zamanı). */
export function Countdown({ n }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center" role="status" aria-live="assertive">
      <div className="flex flex-col items-center gap-2">
        <span key={n} className="animate-pop text-[8rem] font-black leading-none text-white [text-shadow:0_6px_0_#53c1bf,0_14px_30px_rgba(168,139,255,0.6)]">
          {n}
        </span>
        <span className="rounded-full border-2 border-white bg-white/85 px-4 py-1 text-sm font-black text-[#4a3b5c] shadow-soft">Poz ver! 🤳</span>
      </div>
    </div>
  )
}

/** Çekilen karenin önizlemesi. */
export function PhotoPreview({ photo, onAgain, onAlbum, onClose }) {
  return (
    <Modal onClose={onClose} label="Fotoğraf önizleme">
      <h2 className="text-xl font-black text-[#4a3b5c]">Fotoğrafın hazır 📸</h2>
      <img src={photo.full} alt="Çekilen fotoğraf" className="mt-3 max-h-[52vh] w-full rounded-2xl border-2 border-white object-contain shadow-soft" />
      <p className="mt-2 text-xs font-bold text-[#8a7a9c]">Albümüne eklendi (son {ALBUM_MAX} kare bu tarayıcıda saklanır).</p>
      <div className="mt-3 flex gap-2">
        <button onClick={() => download(photo.full)} className={pink}>
          💾 Kaydet
        </button>
        <button onClick={onAgain} className={lilac}>
          🔁 Tekrar
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        <button onClick={onAlbum} className="flex-1 rounded-2xl py-2 text-sm font-extrabold text-[#8a7a9c] hover:bg-[#def7f7]/60">
          🖼️ Albüm
        </button>
        <button onClick={onClose} className="flex-1 rounded-2xl py-2 text-sm font-extrabold text-[#8a7a9c] hover:bg-[#def7f7]/60">
          Kapat
        </button>
      </div>
    </Modal>
  )
}

/** Yerel albüm: küçük resimler, büyük görünüm, indir, sil. */
export function AlbumModal({ list, onDelete, onClose }) {
  const [open, setOpen] = useState(null)
  const shown = list.find((p) => p.id === open)
  return (
    <Modal onClose={onClose} label="Fotoğraf albümü">
      <h2 className="text-xl font-black text-[#4a3b5c]">🖼️ Fotoğraf albümü</h2>
      {shown ? (
        <>
          <img src={shown.url} alt="" className="mt-3 max-h-[52vh] w-full rounded-2xl border-2 border-white object-contain shadow-soft" />
          <div className="mt-3 flex gap-2">
            <button onClick={() => download(shown.url, `situapp-${shown.id}.jpg`)} className={pink}>
              💾 Kaydet
            </button>
            <button
              onClick={() => {
                onDelete(shown.id)
                setOpen(null)
              }}
              className={lilac}
            >
              🗑️ Sil
            </button>
          </div>
          <button onClick={() => setOpen(null)} className="mt-2 w-full rounded-2xl py-2 text-sm font-extrabold text-[#8a7a9c] hover:bg-[#def7f7]/60">
            ← Albüme dön
          </button>
        </>
      ) : list.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-[#f6f0ff] p-4 text-center text-sm font-bold text-[#8a7a9c]">Henüz fotoğrafın yok. Lobideki 📸 Fotoğraf Stüdyosu’nun önüne git ve bir kare çek!</p>
      ) : (
        <div className="mt-3 grid max-h-[55vh] grid-cols-3 gap-2 overflow-y-auto">
          {list.map((p) => (
            <button key={p.id} onClick={() => setOpen(p.id)} className="overflow-hidden rounded-xl border-2 border-white bg-white shadow-soft active:scale-95">
              <img src={p.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {!shown && (
        <button onClick={onClose} className="mt-4 w-full rounded-2xl border-b-4 border-[#53c1bf] bg-[#71dedd] py-3 text-base font-extrabold text-white active:translate-y-[3px] active:border-b-[1px]">
          Tamam
        </button>
      )}
    </Modal>
  )
}
