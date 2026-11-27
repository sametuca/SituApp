// Balonsu / pofuduk pastel kil (toy-clay) dokuları: renk haritası + uyumlu kabartma (bumpMap) çiftleri.
// Tüm dokular dikişsiz (tileable) 512x512 CanvasTexture olarak bir kez üretilir ve önbelleklenir.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

const cache = new Map()

function makePair(key, draw) {
  let entry = cache.get(key)
  if (entry) return entry
  const N = 512
  const cv = document.createElement('canvas')
  cv.width = cv.height = N
  const bcv = document.createElement('canvas')
  bcv.width = bcv.height = N
  draw(cv.getContext('2d'), bcv.getContext('2d'), N)
  const map = new CanvasTexture(cv)
  map.wrapS = map.wrapT = RepeatWrapping
  map.colorSpace = SRGBColorSpace
  map.anisotropy = 8
  const bump = new CanvasTexture(bcv)
  bump.wrapS = bump.wrapT = RepeatWrapping
  bump.anisotropy = 8
  entry = { map, bump }
  cache.set(key, entry)
  return entry
}

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/** Pofuduk, yumuşak bulutsu kil sıva (stucco & plaster). */
export function getClayPlasterPair() {
  return makePair('clay_plaster', (g, bg, N) => {
    g.fillStyle = '#fbf6f0'
    g.fillRect(0, 0, N, N)
    bg.fillStyle = '#888888'
    bg.fillRect(0, 0, N, N)

    const r = rng(1091)
    // yumuşak şişkin kil tümsekleri (dikişsiz sarmalı)
    for (let i = 0; i < 65; i++) {
      const x = r() * N
      const y = r() * N
      const rad = 34 + r() * 68
      const bright = r() > 0.42
      for (const ox of [-N, 0, N]) {
        if (x + ox + rad < 0 || x + ox - rad > N) continue
        for (const oy of [-N, 0, N]) {
          if (y + oy + rad < 0 || y + oy - rad > N) continue
          const gr = g.createRadialGradient(x + ox - rad * 0.2, y + oy - rad * 0.2, 2, x + ox, y + oy, rad)
          gr.addColorStop(0, bright ? 'rgba(255,255,255,0.48)' : 'rgba(222,204,190,0.22)')
          gr.addColorStop(1, 'rgba(255,255,255,0)')
          g.fillStyle = gr
          g.beginPath()
          g.arc(x + ox, y + oy, rad, 0, Math.PI * 2)
          g.fill()

          const bgr = bg.createRadialGradient(x + ox, y + oy, 2, x + ox, y + oy, rad)
          bgr.addColorStop(0, bright ? 'rgba(235,235,235,0.28)' : 'rgba(70,70,70,0.22)')
          bgr.addColorStop(1, 'rgba(128,128,128,0)')
          bg.fillStyle = bgr
          bg.beginPath()
          bg.arc(x + ox, y + oy, rad, 0, Math.PI * 2)
          bg.fill()
        }
      }
    }
    // çok yumuşak pastel şeker tanecikleri
    for (let i = 0; i < 600; i++) {
      const x = r() * N
      const y = r() * N
      g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(218,198,186,0.16)'
      g.beginPath()
      g.arc(x, y, 1.5 + r() * 2.2, 0, Math.PI * 2)
      g.fill()
    }
  })
}

/** Balonsu, yuvarlak şişkin yatay ahşap lambri (siding — sert siyah çizgi yok, yastıksı parlaklık var). */
export function getPuffySidingPair() {
  return makePair('puffy_siding', (g, bg, N) => {
    const rows = 6
    const h = N / rows
    for (let i = 0; i < rows; i++) {
      const y0 = i * h
      // renk: üstte yumuşak parlak şişkinlik, altta tatlı pastel gölge oluğu
      const gr = g.createLinearGradient(0, y0, 0, y0 + h)
      gr.addColorStop(0.0, '#e3d5c5')
      gr.addColorStop(0.14, '#fffaf4')
      gr.addColorStop(0.42, '#faf2e8')
      gr.addColorStop(0.84, '#f0e3d4')
      gr.addColorStop(0.95, '#d9c5b2')
      gr.addColorStop(1.0, '#cdb6a0')
      g.fillStyle = gr
      g.fillRect(0, y0, N, h)

      // kabartma: ortası dışa şişkin, ek yerleri yumuşak içe gömülü
      const bgr = bg.createLinearGradient(0, y0, 0, y0 + h)
      bgr.addColorStop(0.0, '#383838')
      bgr.addColorStop(0.18, '#dcdcdc')
      bgr.addColorStop(0.45, '#ffffff')
      bgr.addColorStop(0.82, '#c8c8c8')
      bgr.addColorStop(1.0, '#383838')
      bg.fillStyle = bgr
      bg.fillRect(0, y0, N, h)
    }
    // hafif sıcak doku benekleri
    const r = rng(2207)
    for (let i = 0; i < 420; i++) {
      g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(186,158,132,0.10)'
      g.fillRect(r() * N, r() * N, 12 + r() * 24, 2)
    }
  })
}

/** Pofuduk, köşeleri yuvarlatılmış marşmelov tuğla (brick). */
export function getPuffyBrickPair() {
  return makePair('puffy_brick', (g, bg, N) => {
    // krem harç zemini
    g.fillStyle = '#efe5da'
    g.fillRect(0, 0, N, N)
    bg.fillStyle = '#404040'
    bg.fillRect(0, 0, N, N)

    const rows = 6
    const cols = 3
    const rh = N / rows
    const cw = N / cols
    const pad = 7
    const rad = 16
    const r = rng(3313)

    for (let row = 0; row < rows; row++) {
      const shift = (row % 2) * (cw * 0.5)
      for (let col = -1; col <= cols; col++) {
        const x = col * cw + shift + pad
        const y = row * rh + pad
        const w = cw - pad * 2
        const h = rh - pad * 2
        const tint = (r() - 0.5) * 14
        const cTop = `rgb(${Math.round(255 + tint * 0.3)},${Math.round(248 + tint * 0.4)},${Math.round(242 + tint * 0.4)})`
        const cBot = `rgb(${Math.round(238 + tint * 0.5)},${Math.round(224 + tint * 0.5)},${Math.round(212 + tint * 0.5)})`

        const gr = g.createLinearGradient(x, y, x, y + h)
        gr.addColorStop(0, cTop)
        gr.addColorStop(0.55, '#faf2ea')
        gr.addColorStop(1, cBot)
        g.fillStyle = gr
        roundRect(g, x, y, w, h, rad)
        g.fill()

        // üst balonsu parlama çizgisi
        g.fillStyle = 'rgba(255,255,255,0.55)'
        roundRect(g, x + 8, y + 5, w - 16, h * 0.26, rad * 0.6)
        g.fill()

        // kabartma: şişkin yastık tuğla
        const bgr = bg.createRadialGradient(x + w * 0.5, y + h * 0.45, 4, x + w * 0.5, y + h * 0.5, Math.max(w, h) * 0.65)
        bgr.addColorStop(0, '#ffffff')
        bgr.addColorStop(0.7, '#d8d8d8')
        bgr.addColorStop(1, '#787878')
        bg.fillStyle = bgr
        roundRect(bg, x, y, w, h, rad)
        bg.fill()
      }
    }
  })
}

/** Pofuduk balık pulu / yuvarlak kiremit çatı (shingle). */
export function getPuffyShinglePair() {
  return makePair('puffy_shingle', (g, bg, N) => {
    g.fillStyle = '#e3d5c8'
    g.fillRect(0, 0, N, N)
    bg.fillStyle = '#484848'
    bg.fillRect(0, 0, N, N)

    const rows = 6
    const cols = 6
    const rh = N / rows
    const cw = N / cols
    const r = rng(4421)

    for (let row = -1; row <= rows; row++) {
      const shift = (row % 2) * (cw * 0.5)
      for (let col = -1; col <= cols + 1; col++) {
        const cx = col * cw + shift + cw / 2
        const cy = row * rh + rh * 0.55
        const rad = cw * 0.54
        const shade = (r() - 0.5) * 14

        // alt yumuşak gölge
        g.fillStyle = 'rgba(130,105,95,0.22)'
        g.beginPath()
        g.arc(cx, cy + 5, rad, 0, Math.PI * 2)
        g.fill()

        const gr = g.createRadialGradient(cx - rad * 0.22, cy - rad * 0.25, 4, cx, cy, rad)
        gr.addColorStop(0, '#ffffff')
        gr.addColorStop(0.55, `rgb(${Math.round(248 + shade)},${Math.round(243 + shade)},${Math.round(238 + shade)})`)
        gr.addColorStop(1, '#dfd2c6')
        g.fillStyle = gr
        g.beginPath()
        g.arc(cx, cy, rad - 2, 0, Math.PI * 2)
        g.fill()

        const bgr = bg.createRadialGradient(cx, cy - rad * 0.12, 4, cx, cy, rad)
        bgr.addColorStop(0, '#ffffff')
        bgr.addColorStop(0.75, '#d0d0d0')
        bgr.addColorStop(1, '#585858')
        bg.fillStyle = bgr
        bg.beginPath()
        bg.arc(cx, cy, rad - 2, 0, Math.PI * 2)
        bg.fill()
      }
    }
  })
}

/** Yumuşak, şişkin pastel kum tepecikleri (sert zikzak çizgiler yerine kremamsı dalgalı plaj kumu). */
export function getPuffySandPair() {
  return makePair('puffy_sand', (g, bg, N) => {
    g.fillStyle = '#fae7b8'
    g.fillRect(0, 0, N, N)
    bg.fillStyle = '#808080'
    bg.fillRect(0, 0, N, N)

    // yumuşak, geniş kum dalgaları (dikişsiz sinüs şeritleri)
    const bands = 4
    const bh = N / bands
    for (let b = -1; b <= bands + 1; b++) {
      const baseY = b * bh
      const grad = g.createLinearGradient(0, baseY - bh * 0.4, 0, baseY + bh * 0.6)
      grad.addColorStop(0, 'rgba(255,250,234,0.45)')
      grad.addColorStop(0.5, 'rgba(248,225,172,0.18)')
      grad.addColorStop(1, 'rgba(226,196,136,0.28)')
      g.fillStyle = grad
      g.beginPath()
      g.moveTo(0, baseY + bh)
      for (let x = 0; x <= N; x += 16) {
        const y = baseY + Math.sin((x / N) * Math.PI * 2) * 14
        g.lineTo(x, y)
      }
      g.lineTo(N, baseY + bh)
      g.closePath()
      g.fill()

      const bgrad = bg.createLinearGradient(0, baseY - bh * 0.4, 0, baseY + bh * 0.6)
      bgrad.addColorStop(0, 'rgba(225,225,225,0.45)')
      bgrad.addColorStop(0.55, 'rgba(130,130,130,0.15)')
      bgrad.addColorStop(1, 'rgba(75,75,75,0.35)')
      bg.fillStyle = bgrad
      bg.beginPath()
      bg.moveTo(0, baseY + bh)
      for (let x = 0; x <= N; x += 16) {
        const y = baseY + Math.sin((x / N) * Math.PI * 2) * 14
        bg.lineTo(x, y)
      }
      bg.lineTo(N, baseY + bh)
      bg.closePath()
      bg.fill()
    }

    // yumuşak parlak kum ışıltıları ve minik pastel çakıl noktaları
    const r = rng(5503)
    for (let i = 0; i < 1400; i++) {
      const x = r() * N
      const y = r() * N
      const rad = 1 + r() * 1.8
      g.fillStyle = r() > 0.45 ? 'rgba(255,252,240,0.42)' : 'rgba(218,184,126,0.24)'
      g.beginPath()
      g.arc(x, y, rad, 0, Math.PI * 2)
      g.fill()
    }
    const pebbles = ['#ffd2dc', '#cbe8ff', '#fff7e0', '#d8f3dc']
    for (let i = 0; i < 14; i++) {
      const x = r() * N
      const y = r() * N
      const pr = 3.5 + r() * 3.5
      g.fillStyle = 'rgba(195,165,115,0.25)'
      g.beginPath()
      g.ellipse(x + 1.5, y + 2, pr, pr * 0.72, r() * 3, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = pebbles[i % pebbles.length]
      g.beginPath()
      g.ellipse(x, y, pr, pr * 0.72, r() * 3, 0, Math.PI * 2)
      g.fill()
    }
  })
}

/** Temiz, sıcak krem/kumtaşı pofuduk taş karo (kaldırım ve meydan zemini — karmaşık pembe kaldırım yerine). */
export function getPuffyPaverPair() {
  return makePair('puffy_paver', (g, bg, N) => {
    // yumuşak sıcak harç zemini
    g.fillStyle = '#ddd2c6'
    g.fillRect(0, 0, N, N)
    bg.fillStyle = '#4c4c4c'
    bg.fillRect(0, 0, N, N)

    const rows = 4
    const cols = 4
    const rh = N / rows
    const cw = N / cols
    const pad = 5
    const rad = 14
    const r = rng(6619)
    const tones = [
      ['#fffaf2', '#f3e7d8'],
      ['#fdf6ec', '#efe2d2'],
      ['#faf2e8', '#eadcc9'],
      ['#fffcf6', '#f4eadc'],
    ]

    for (let row = 0; row < rows; row++) {
      const shift = (row % 2) * (cw * 0.5)
      for (let col = -1; col <= cols; col++) {
        const x = col * cw + shift + pad
        const y = row * rh + pad
        const w = cw - pad * 2
        const h = rh - pad * 2
        const [cTop, cBot] = tones[Math.floor(r() * tones.length)]

        const gr = g.createLinearGradient(x, y, x, y + h)
        gr.addColorStop(0, cTop)
        gr.addColorStop(0.65, '#faf3ea')
        gr.addColorStop(1, cBot)
        g.fillStyle = gr
        roundRect(g, x, y, w, h, rad)
        g.fill()

        // hafif üst parlaklık kenarı
        g.fillStyle = 'rgba(255,255,255,0.45)'
        roundRect(g, x + 6, y + 4, w - 12, h * 0.22, rad * 0.55)
        g.fill()

        // kabartma: ortası düz-şişkin karo, kenarlar yumuşak derz
        const bgr = bg.createRadialGradient(x + w * 0.5, y + h * 0.5, 6, x + w * 0.5, y + h * 0.5, Math.max(w, h) * 0.68)
        bgr.addColorStop(0, '#f2f2f2')
        bgr.addColorStop(0.78, '#dcdcdc')
        bgr.addColorStop(1, '#7a7a7a')
        bg.fillStyle = bgr
        roundRect(bg, x, y, w, h, rad)
        bg.fill()
      }
    }

    // ince terrazzo taş benekleri (doğal ama göz yormayan doku)
    for (let i = 0; i < 650; i++) {
      const x = r() * N
      const y = r() * N
      g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.38)' : 'rgba(182,162,142,0.16)'
      g.beginPath()
      g.arc(x, y, 1 + r() * 1.5, 0, Math.PI * 2)
      g.fill()
    }
  })
}

/** Canlı, yumuşak ressam-stili pastel çim + ince ot tutamları ve kabartma haritası. */
export function getPuffyGrassPair() {
  return makePair('puffy_grass', (g, bg, N) => {
    g.fillStyle = '#9fe0a6'
    g.fillRect(0, 0, N, N)
    bg.fillStyle = '#7c7c7c'
    bg.fillRect(0, 0, N, N)

    const r = rng(7741)
    // Yumuşak güneşli/gölgeli çayır lekeleri (dikişsiz sarmalı)
    for (let i = 0; i < 54; i++) {
      const x = r() * N
      const y = r() * N
      const rad = 36 + r() * 76
      const warm = r() > 0.45
      for (const ox of [-N, 0, N]) {
        if (x + ox + rad < 0 || x + ox - rad > N) continue
        for (const oy of [-N, 0, N]) {
          if (y + oy + rad < 0 || y + oy - rad > N) continue
          const gr = g.createRadialGradient(x + ox, y + oy, 4, x + ox, y + oy, rad)
          gr.addColorStop(0, warm ? 'rgba(196, 244, 174, 0.44)' : 'rgba(116, 198, 138, 0.34)')
          gr.addColorStop(1, 'rgba(159, 224, 166, 0)')
          g.fillStyle = gr
          g.beginPath()
          g.arc(x + ox, y + oy, rad, 0, Math.PI * 2)
          g.fill()
        }
      }
    }

    // Stilize yumuşak çim yaprakları (renk + kabartma)
    g.lineCap = 'round'
    bg.lineCap = 'round'
    for (let i = 0; i < 620; i++) {
      const x = r() * N
      const y = r() * N
      const len = 7 + r() * 11
      const tilt = (r() - 0.5) * 7
      const light = r() > 0.42
      g.strokeStyle = light ? 'rgba(218, 250, 194, 0.55)' : 'rgba(98, 178, 120, 0.38)'
      g.lineWidth = 1.6 + r() * 1.4
      g.beginPath()
      g.moveTo(x, y)
      g.quadraticCurveTo(x + tilt * 0.5, y - len * 0.5, x + tilt, y - len)
      g.stroke()

      bg.strokeStyle = light ? 'rgba(235, 235, 235, 0.42)' : 'rgba(65, 65, 65, 0.35)'
      bg.lineWidth = 2.0
      bg.beginPath()
      bg.moveTo(x, y)
      bg.lineTo(x + tilt, y - len)
      bg.stroke()
    }

    // Minik pastel yonca / çiçek benekleri
    const blooms = ['#fff8d6', '#ffffff', '#ffe0ec', '#dff4ff']
    for (let i = 0; i < 55; i++) {
      g.fillStyle = blooms[i % blooms.length]
      g.globalAlpha = 0.72
      g.beginPath()
      g.arc(r() * N, r() * N, 1.5 + r() * 1.6, 0, Math.PI * 2)
      g.fill()
    }
    g.globalAlpha = 1
  })
}

export function getWallPair(tex) {
  if (tex === 'siding') return getPuffySidingPair()
  if (tex === 'brick') return getPuffyBrickPair()
  if (tex === 'shingle') return getPuffyShinglePair()
  return getClayPlasterPair()
}
