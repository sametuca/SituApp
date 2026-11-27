// Sörf arenası canvas çizimi: perspektif izdüşüm, gökyüzü/ufuk, sörfçü ve dalga çizim fonksiyonları (oyun mantığından bağımsız).

// Perspektif izdüşüm: ufuk çizgisinden (y=0) sörfçüye (y=0.78) doğru derinlik ve ölçek kazanır
export function proj(nx, ny, W, H, camX) {
  const horizonY = H * 0.21
  const depth = Math.max(0, Math.min(1.25, ny))
  const persp = Math.pow(Math.max(0, depth), 1.38) // ufukta sıkışık, yakında hızlı akış
  const sy = horizonY + persp * (H - horizonY)
  const scale = 0.28 + persp * 0.86
  const cx = W * 0.5 - camX * W * 0.14 * scale
  const sx = cx + (nx - 0.5) * W * (0.42 + persp * 0.68)
  return { x: sx, y: sy, s: scale, persp }
}

export function drawSkyAndHorizon(ctx, clouds, birds, W, H, time, camX) {
  const horizonY = H * 0.21
  // Tropikal gökyüzü gradyanı (sıcak güneşli ufuk)
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY)
  sky.addColorStop(0, '#5ec2f2')
  sky.addColorStop(0.55, '#a4e3ff')
  sky.addColorStop(1, '#fff1cf')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, horizonY + 2)

  // Parlayan güneş + ışık halesi
  const sunX = W * 0.5 - camX * W * 0.04
  const sunY = horizonY * 0.62
  const halo = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, Math.min(W, H) * 0.26)
  halo.addColorStop(0, 'rgba(255, 250, 224, 0.98)')
  halo.addColorStop(0.22, 'rgba(255, 228, 152, 0.65)')
  halo.addColorStop(0.6, 'rgba(255, 214, 130, 0.16)')
  halo.addColorStop(1, 'rgba(255, 214, 130, 0)')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(sunX, sunY, Math.min(W, H) * 0.26, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff9df'
  ctx.beginPath()
  ctx.arc(sunX, sunY, 22, 0, Math.PI * 2)
  ctx.fill()

  // Yumuşak pastel bulutlar
  for (const c of clouds) {
    const cx = (((c.x + time * c.sp) % 1.25) - 0.12) * W - camX * W * 0.03
    const cy = c.y * H
    const r = 18 * c.s
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)'
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.arc(cx + r * 0.9, cy - r * 0.2, r * 0.85, 0, Math.PI * 2)
    ctx.arc(cx + r * 1.7, cy + r * 0.08, r * 0.72, 0, Math.PI * 2)
    ctx.fill()
  }

  // Uzak tropikal adalar (paralaks siluet)
  const drawIsland = (ix, iw, ih, col) => {
    const x = ix * W - camX * W * 0.06
    ctx.fillStyle = col
    ctx.beginPath()
    ctx.moveTo(x - iw, horizonY + 1)
    ctx.quadraticCurveTo(x, horizonY - ih, x + iw, horizonY + 1)
    ctx.closePath()
    ctx.fill()
  }
  drawIsland(0.16, W * 0.14, 24, '#7ac6c9')
  drawIsland(0.84, W * 0.16, 28, '#6bbbc2')
  drawIsland(0.28, W * 0.09, 14, '#8ed4d1')

  // Süzülen martılar
  ctx.strokeStyle = 'rgba(74, 59, 92, 0.45)'
  ctx.lineWidth = 1.8
  ctx.lineCap = 'round'
  for (const bd of birds) {
    const bx = (((bd.x + time * bd.sp) % 1.2) - 0.1) * W
    const by = bd.y * H + Math.sin(time * 3 + bd.ph) * 4
    const flap = Math.sin(time * 8 + bd.ph) * 4
    ctx.beginPath()
    ctx.moveTo(bx - 7, by + flap)
    ctx.quadraticCurveTo(bx - 3, by - 3, bx, by)
    ctx.quadraticCurveTo(bx + 3, by - 3, bx + 7, by + flap)
    ctx.stroke()
  }

  // Okyanus taban gradyanı (ufukta açık camgöbeği, önde canlı turkuaz)
  const sea = ctx.createLinearGradient(0, horizonY, 0, H)
  sea.addColorStop(0, '#49c8e6')
  sea.addColorStop(0.25, '#25a7cf')
  sea.addColorStop(0.65, '#198cb8')
  sea.addColorStop(1, '#116d96')
  ctx.fillStyle = sea
  ctx.fillRect(0, horizonY, W, H - horizonY)

  // Güneşin sudaki parıltı yolu
  for (let i = 0; i < 16; i++) {
    const f = i / 16
    const sy = horizonY + 4 + Math.pow(f, 1.55) * (H - horizonY) * 0.85
    const sw = (20 + f * 95) * (0.75 + 0.25 * Math.sin(time * 4 + i * 1.3))
    ctx.fillStyle = `rgba(255, 246, 205, ${(0.34 * (1 - f * 0.72)).toFixed(2)})`
    ctx.beginPath()
    ctx.roundRect(sunX - sw / 2 + Math.sin(time * 2.4 + i) * 10 * f, sy, sw, 2.5 + f * 3.5, 4)
    ctx.fill()
  }

  // Perspektif akıntı şeritleri ve su parıltıları
  const lanes = 7
  for (let i = 0; i < lanes; i++) {
    const lx = 0.08 + (i / (lanes - 1)) * 0.84
    const p0 = proj(lx, 0.02, W, H, camX)
    const p1 = proj(lx, 1.05, W, H, camX)
    ctx.strokeStyle = 'rgba(180, 245, 255, 0.11)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(p0.x, p0.y)
    ctx.lineTo(p1.x, p1.y)
    ctx.stroke()
  }

  // Akan dalgacık çizgileri (hız hissiyatı)
  const rippleRows = 12
  for (let i = 0; i < rippleRows; i++) {
    const ny = ((i / rippleRows) + (time * 0.34)) % 1
    const pr = proj(0.5, ny, W, H, camX)
    const alpha = Math.sin(ny * Math.PI) * 0.22
    ctx.strokeStyle = `rgba(215, 250, 255, ${alpha.toFixed(2)})`
    ctx.lineWidth = 1 + pr.s * 2
    ctx.beginPath()
    for (let k = 0; k <= 12; k++) {
      const pt = proj(k / 12, ny, W, H, camX)
      const yy = pt.y + Math.sin(k * 1.4 + time * 4 + i) * 2.5 * pr.s
      if (k === 0) ctx.moveTo(pt.x, yy)
      else ctx.lineTo(pt.x, yy)
    }
    ctx.stroke()
  }
}

export function drawSurfer(ctx, s, W, H, time, camX) {
  const base = proj(s.x, 0.78, W, H, camX)
  const px = base.x
  const baseY = base.y
  const jumpLift = s.jump * 64 * base.s
  const bob = Math.sin(time * 5.6 + s.x * 9) * 3.2 * base.s
  const py = baseY + bob - jumpLift

  // İkili köpük izi (V-wake: sağ/sol kenardan açılan profesyonel sörf izi)
  if (s.wake.length > 2) {
    for (const side of [-1, 1]) {
      for (let i = 1; i < s.wake.length; i++) {
        const a = proj(s.wake[i - 1].x, s.wake[i - 1].y, W, H, camX)
        const b = proj(s.wake[i].x, s.wake[i].y, W, H, camX)
        const frac = i / s.wake.length
        const spreadA = (1 - frac) * 22 * a.s * side
        const spreadB = (1 - frac) * 22 * b.s * side
        ctx.strokeStyle = `rgba(230, 252, 255, ${(frac * 0.55).toFixed(2)})`
        ctx.lineWidth = Math.max(1.5, frac * 11 * b.s)
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(a.x + spreadA, a.y + 14 * a.s)
        ctx.lineTo(b.x + spreadB, b.y + 14 * b.s)
        ctx.stroke()
      }
    }
  }

  // Suda yumuşak gölge + temas köpük halkası
  ctx.save()
  ctx.translate(px, baseY + bob + 16 * base.s)
  const shScale = Math.max(0.45, 1 - s.jump * 0.42) * base.s
  ctx.fillStyle = `rgba(8, 56, 84, ${(0.34 * shScale).toFixed(2)})`
  ctx.beginPath()
  ctx.ellipse(0, 0, 20 * shScale, 11 * shScale, 0, 0, Math.PI * 2)
  ctx.fill()
  if (s.jump < 0.08) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)'
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.ellipse(0, 4, 22 * base.s, 9 * base.s, 0, 0, Math.PI)
    ctx.stroke()
  }
  ctx.restore()

  // Sörf tahtası + stilize karakter (hasar sonrası kısa dokunulmazlık yanıp sönmesi)
  ctx.save()
  if (s.invuln > 0 && Math.floor(time * 16) % 2 === 0) ctx.globalAlpha = 0.45
  ctx.translate(px, py)
  const airSpin = s.jump > 0.02 ? s.spin : 0
  ctx.rotate(s.tilt * 0.44 + airSpin)
  const sc = base.s * (1.06 + s.jump * 0.28)
  ctx.scale(sc, sc)

  // Havadayken altın-turkuaz sıçrama halesi
  if (s.jump > 0.12) {
    const gAura = ctx.createRadialGradient(0, 0, 6, 0, 0, 44)
    gAura.addColorStop(0, 'rgba(255, 236, 153, 0.45)')
    gAura.addColorStop(1, 'rgba(127, 230, 255, 0)')
    ctx.fillStyle = gAura
    ctx.beginPath()
    ctx.arc(0, 0, 44, 0, Math.PI * 2)
    ctx.fill()
  }

  // Sörf tahtası (3B parlak gradyan + kuyruk yüzgeci + beyaz parıltı)
  const bGrad = ctx.createLinearGradient(-16, -34, 16, 32)
  bGrad.addColorStop(0, '#ffffff')
  bGrad.addColorStop(0.22, s.style.board)
  bGrad.addColorStop(1, s.style.board)
  ctx.fillStyle = bGrad
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2.6
  ctx.beginPath()
  ctx.moveTo(0, -37)
  ctx.bezierCurveTo(18, -19, 17, 19, 9, 31)
  ctx.quadraticCurveTo(0, 36, -9, 31)
  ctx.bezierCurveTo(-17, 19, -18, -19, 0, -37)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // Tahta yarış şeridi + kaymaz ped
  ctx.fillStyle = s.style.stripe
  ctx.beginPath()
  ctx.roundRect(-3.2, -28, 6.4, 56, 3)
  ctx.fill()
  ctx.fillStyle = 'rgba(42, 34, 56, 0.24)'
  ctx.beginPath()
  ctx.roundRect(-7, 14, 14, 12, 4)
  ctx.fill()

  // Atletik sörf duruşu (bükülü dizler, yana yaslı gövde, eklemli denge kolları)
  const lean = s.tilt * 8
  const crouch = s.jump > 0.05 ? 4 : 0
  // Bacaklar & şort
  ctx.strokeStyle = '#f2be9a'
  ctx.lineWidth = 5.5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-5 + lean * 0.3, 1 + crouch)
  ctx.lineTo(-9 + lean * 0.15, 13)
  ctx.moveTo(5 + lean * 0.3, -1 + crouch)
  ctx.lineTo(8 + lean * 0.15, 11)
  ctx.stroke()
  ctx.fillStyle = s.style.shorts
  ctx.beginPath()
  ctx.roundRect(-10 + lean * 0.35, -5 + crouch, 20, 10, 4)
  ctx.fill()

  // Gövde (parlak wetsuit)
  const sGrad = ctx.createLinearGradient(-10, -22, 10, 0)
  sGrad.addColorStop(0, s.style.suit)
  sGrad.addColorStop(1, '#184b68')
  ctx.fillStyle = sGrad
  ctx.beginPath()
  ctx.roundRect(-10.5 + lean * 0.55, -21 + crouch, 21, 18, 8)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.beginPath()
  ctx.roundRect(-8 + lean * 0.55, -16 + crouch, 16, 3.8, 2)
  ctx.fill()

  // Eklemli denge kolları (dirsek + el)
  const armWave = Math.sin(time * 8 + s.x * 12) * 2.5
  ctx.strokeStyle = s.style.suit
  ctx.lineWidth = 5.2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  // sol kol
  ctx.moveTo(-9 + lean * 0.55, -15 + crouch)
  ctx.lineTo(-18 + lean * 0.45, -13 - s.tilt * 7 + armWave + crouch)
  ctx.lineTo(-25 + lean * 0.35, -18 - s.tilt * 10 - armWave + crouch)
  // sağ kol
  ctx.moveTo(9 + lean * 0.55, -15 + crouch)
  ctx.lineTo(18 + lean * 0.45, -13 + s.tilt * 7 - armWave + crouch)
  ctx.lineTo(25 + lean * 0.35, -18 + s.tilt * 10 + armWave + crouch)
  ctx.stroke()

  // Baş + rüzgârda uçuşan saç + parlak güneş gözlüğü
  const hx = lean * 0.65
  const hy = -28 + crouch
  ctx.fillStyle = '#f6c8a8'
  ctx.beginPath()
  ctx.arc(hx, hy, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = s.style.hair
  ctx.beginPath()
  ctx.arc(hx, hy - 2, 10.4, Math.PI * 0.9, Math.PI * 2.12)
  ctx.fill()
  // Uçuşan saç tutamları
  ctx.strokeStyle = s.style.hair
  ctx.lineWidth = 3.2
  ctx.beginPath()
  ctx.moveTo(hx - 6, hy - 7)
  ctx.quadraticCurveTo(hx - 12 - s.tilt * 5, hy - 12 + Math.sin(time * 14) * 2, hx - 14 - s.tilt * 7, hy - 6)
  ctx.stroke()
  // Güneş gözlüğü + beyaz parlama
  ctx.fillStyle = '#241b35'
  ctx.beginPath()
  ctx.roundRect(hx - 7.5, hy - 1.5, 6.4, 4.4, 2)
  ctx.roundRect(hx + 1.1, hy - 1.5, 6.4, 4.4, 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.fillRect(hx - 6.2, hy - 0.6, 2.2, 1.3)
  ctx.fillRect(hx + 2.4, hy - 0.6, 2.2, 1.3)

  ctx.restore()

  // İsim etiketi
  ctx.save()
  ctx.font = s.isSelf ? '900 12px Nunito, sans-serif' : '800 11px Nunito, sans-serif'
  const lbl = s.isSelf ? `★ ${s.name}` : s.name
  const tw = ctx.measureText(lbl).width + 16
  const tagY = py - 56 * base.s
  ctx.fillStyle = s.isSelf ? 'rgba(255, 243, 196, 0.96)' : 'rgba(255, 255, 255, 0.88)'
  ctx.strokeStyle = s.isSelf ? '#fdb252' : '#ffffff'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(px - tw / 2, tagY - 10, tw, 20, 10)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = s.isSelf ? '#8a5a00' : '#4a3b5c'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(lbl, px, tagY)
  ctx.restore()
}

export function drawWave(ctx, w, W, H, time, camX) {
  const pTop = proj(0.5, w.y, W, H, camX)
  const pBot = proj(0.5, w.y + w.h, W, H, camX)
  const wy = pTop.y
  const wh = Math.max(8, pBot.y - pTop.y)
  const sc = pTop.s
  const sorted = [...w.gaps].sort((a, b) => a[0] - b[0])
  const segs = []
  let cur = 0
  for (const [g0, g1] of sorted) {
    if (g0 > cur) segs.push([cur, g0])
    cur = Math.max(cur, g1)
  }
  if (cur < 1) segs.push([cur, 1])

  // Güvenli geçiş kanalında parlayan yön okları (veya tam en zıplama duvarı uyarısı)
  if (w.jumpWall) {
    const mid = proj(0.5, w.y + w.h * 0.35, W, H, camX)
    ctx.save()
    ctx.font = `900 ${Math.max(11, Math.round(16 * sc))}px Nunito, sans-serif`
    ctx.textAlign = 'center'
    ctx.strokeStyle = 'rgba(74, 24, 24, 0.8)'
    ctx.lineWidth = 3.5
    ctx.strokeText('⬆ ZIPLA!', mid.x, mid.y - 8 * sc)
    ctx.fillStyle = '#ffe48f'
    ctx.fillText('⬆ ZIPLA!', mid.x, mid.y - 8 * sc)
    ctx.restore()
  }
  for (const [g0, g1] of sorted) {
    const mid = proj((g0 + g1) / 2, w.y + w.h * 0.5, W, H, camX)
    const pulse = 0.35 + 0.35 * Math.sin(time * 7 + w.phase)
    ctx.save()
    ctx.strokeStyle = `rgba(255, 243, 176, ${pulse.toFixed(2)})`
    ctx.lineWidth = Math.max(2, 3.2 * sc)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const aw = 14 * sc
    const ah = 8 * sc
    ctx.beginPath()
    ctx.moveTo(mid.x - aw, mid.y - ah)
    ctx.lineTo(mid.x, mid.y + ah)
    ctx.lineTo(mid.x + aw, mid.y - ah)
    ctx.stroke()
    ctx.restore()
  }

  // Kıvrılan 3B dalga duvarları
  for (const [s0, s1] of segs) {
    const a = proj(s0, w.y, W, H, camX)
    const b = proj(s1, w.y, W, H, camX)
    const x0 = a.x
    const x1 = b.x
    const sw = x1 - x0
    if (sw < 4) continue

    // Ön su gölgesi
    ctx.fillStyle = 'rgba(7, 54, 82, 0.34)'
    ctx.beginPath()
    ctx.roundRect(x0 - 2, wy + wh * 0.55, sw + 4, wh * 0.85, 16 * sc)
    ctx.fill()

    // Kıvrılan dalga gövdesi (zengin okyanus gradyanı)
    const grad = ctx.createLinearGradient(0, wy - wh * 0.25, 0, wy + wh * 1.05)
    grad.addColorStop(0, '#c8f8ff')
    grad.addColorStop(0.24, '#56d7ee')
    grad.addColorStop(0.62, w.crestColor)
    grad.addColorStop(1, '#0e587d')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(x0, wy + wh)
    ctx.quadraticCurveTo(x0 - 4 * sc, wy + wh * 0.2, x0 + 10 * sc, wy)
    const steps = Math.max(4, Math.floor(sw / 26))
    for (let i = 1; i <= steps; i++) {
      const ux = x0 + (i / steps) * sw
      const crest = wy + Math.sin(time * 6.5 + i * 1.4 + w.phase) * 3.5 * sc
      ctx.lineTo(ux, crest)
    }
    ctx.quadraticCurveTo(x1 + 4 * sc, wy + wh * 0.2, x1, wy + wh)
    ctx.closePath()
    ctx.fill()

    // Köpüklü kırılan dalga tepesi (çok katmanlı beyaz köpük)
    const bumps = Math.max(4, Math.floor(sw / (18 * Math.max(0.45, sc))))
    for (let i = 0; i <= bumps; i++) {
      const bx = x0 + (i / bumps) * sw
      const by = wy + 3 * sc + Math.sin(time * 7.5 + i * 1.3 + w.phase) * 3 * sc
      const br = (6.5 + Math.sin(time * 5 + i + w.phase) * 2.2) * sc
      ctx.fillStyle = 'rgba(255, 255, 255, 0.94)'
      ctx.beginPath()
      ctx.arc(bx, by, br, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Kanal kenarlarında su halkalı çizgili şamandıralar
  for (const [g0, g1] of sorted) {
    for (const gn of [g0, g1]) {
      if (gn < 0.03 || gn > 0.97) continue
      const pt = proj(gn, w.y + w.h * 0.45, W, H, camX)
      const by = pt.y + Math.sin(time * 6 + gn * 20) * 3 * sc
      const br = Math.max(4, 9 * sc)
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.ellipse(pt.x, by + br * 0.7, br * 1.4, br * 0.55, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = '#ff7b6b'
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = Math.max(1.5, 2.2 * sc)
      ctx.beginPath()
      ctx.arc(pt.x, by, br, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#ffe48f'
      ctx.beginPath()
      ctx.arc(pt.x - br * 0.25, by - br * 0.25, br * 0.28, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}
