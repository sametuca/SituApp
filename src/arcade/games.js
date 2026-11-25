// Playstasyon makineleri için retro oyunlar: Yılan, Pong, Tuğla Kır, Blok Düşür. Hepsi bu projede yazılmış özgün, tek dosyalık canvas oyunlarıdır
// (dış telifli ROM/kod yok). Mantık tamamen istemcidedir: bu oyunlardan altın/puan/ilerleme VERİLMEZ (hile yolu açılmasın); yalnızca yerel rekor tutulur.
//
// Oyun arayüzü: create(canvas, input, api) → { destroy() }
//   input.pressed(ad) abonelik: input.onPress = (ad) => …   ad: left | right | up | down | action
//   input.held(ad) → bool (basılı tutma)
//   api.score(n) skoru günceller; api.over(n) oyun bitti (rekor için); canvas mantıksal boyut W×H.
export const W = 240
export const H = 320

const PAL = { bg: '#1c1233', fg: '#fff3c8', a: '#ffd35e', b: '#7fe3c8', c: '#ff9f6b', d: '#b79cff', dim: '#4a3b7a' }
const raf = (fn) => {
  let id = 0
  let last = performance.now()
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    fn(dt)
    id = requestAnimationFrame(loop)
  }
  id = requestAnimationFrame(loop)
  return () => cancelAnimationFrame(id)
}
const text = (c, s, x, y, size = 14, color = PAL.fg, align = 'center') => {
  c.fillStyle = color
  c.font = `bold ${size}px "Courier New", monospace`
  c.textAlign = align
  c.fillText(s, x, y)
}
const clear = (c) => {
  c.fillStyle = PAL.bg
  c.fillRect(0, 0, W, H)
}

// ------------------------------------------------------------ YILAN
function snake(cv, input, api) {
  const c = cv.getContext('2d')
  const S = 16
  const GW = W / S
  const GH = (H - 20) / S
  let body, dir, next, food, score, acc, dead
  const spawn = () => {
    for (;;) {
      const f = { x: Math.floor(Math.random() * GW), y: Math.floor(Math.random() * GH) }
      if (!body.some((p) => p.x === f.x && p.y === f.y)) return f
    }
  }
  const reset = () => {
    body = [{ x: 7, y: 9 }, { x: 6, y: 9 }, { x: 5, y: 9 }]
    dir = { x: 1, y: 0 }
    next = dir
    score = 0
    acc = 0
    dead = false
    food = spawn()
    api.score(0)
  }
  reset()
  input.onPress = (k) => {
    if (dead) return k === 'action' && reset()
    const v = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[k]
    if (v && !(v[0] === -dir.x && v[1] === -dir.y)) next = { x: v[0], y: v[1] }
  }
  const stop = raf((dt) => {
    if (!dead) {
      acc += dt
      const step = Math.max(0.06, 0.15 - score * 0.003)
      while (acc >= step) {
        acc -= step
        dir = next
        const h = { x: body[0].x + dir.x, y: body[0].y + dir.y }
        if (h.x < 0 || h.y < 0 || h.x >= GW || h.y >= GH || body.some((p) => p.x === h.x && p.y === h.y)) {
          dead = true
          api.over(score)
          break
        }
        body.unshift(h)
        if (h.x === food.x && h.y === food.y) {
          score += 1
          api.score(score)
          food = spawn()
        } else body.pop()
      }
    }
    clear(c)
    c.fillStyle = PAL.dim
    c.fillRect(0, H - 20, W, 1)
    body.forEach((p, i) => {
      c.fillStyle = i === 0 ? PAL.a : PAL.b
      c.fillRect(p.x * S + 1, p.y * S + 1, S - 2, S - 2)
    })
    c.fillStyle = PAL.c
    c.beginPath()
    c.arc(food.x * S + S / 2, food.y * S + S / 2, S / 2 - 2, 0, Math.PI * 2)
    c.fill()
    text(c, `SKOR ${score}`, W / 2, H - 6, 12, PAL.fg)
    if (dead) {
      c.fillStyle = 'rgba(28,18,51,0.7)'
      c.fillRect(0, 100, W, 90)
      text(c, 'OYUN BİTTİ', W / 2, 135, 20, PAL.a)
      text(c, 'Tekrar: BOŞLUK / A', W / 2, 165, 12)
    }
  })
  return { destroy: stop }
}

// ------------------------------------------------------------ PONG (bilgisayara karşı, ilk 5'e)
function pong(cv, input, api) {
  const c = cv.getContext('2d')
  const PW = 44
  const PH = 6
  let px, ax, bx, by, vx, vy, me, ai, over, serve
  const reset = () => {
    px = W / 2 - PW / 2
    ax = px
    me = 0
    ai = 0
    over = false
    api.score(0)
    launch(1)
  }
  function launch(dirY) {
    bx = W / 2
    by = H / 2
    const a = (Math.random() * 0.8 - 0.4)
    vx = 110 * a
    vy = 150 * dirY
    serve = 0.8
  }
  reset()
  input.onPress = (k) => over && k === 'action' && reset()
  const stop = raf((dt) => {
    if (!over) {
      if (input.held('left')) px -= 190 * dt
      if (input.held('right')) px += 190 * dt
      px = Math.max(0, Math.min(W - PW, px))
      const target = bx - PW / 2
      ax += Math.max(-105 * dt, Math.min(105 * dt, target - ax))
      ax = Math.max(0, Math.min(W - PW, ax))
      if (serve > 0) serve -= dt
      else {
        bx += vx * dt
        by += vy * dt
        if (bx < 4 || bx > W - 4) {
          vx = -vx
          bx = Math.max(4, Math.min(W - 4, bx))
        }
        const hit = (py, x0, up) => {
          if (bx > x0 - 4 && bx < x0 + PW + 4 && Math.abs(by - py) < 7 && (vy > 0) === up) {
            const off = (bx - (x0 + PW / 2)) / (PW / 2)
            vy = -vy * 1.06
            vx = off * 130
            return true
          }
          return false
        }
        hit(H - 24, px, true)
        hit(24, ax, false)
        if (by > H) {
          ai += 1
          launch(-1)
        } else if (by < 0) {
          me += 1
          api.score(me)
          launch(1)
        }
        if (me >= 5 || ai >= 5) {
          over = true
          api.over(me)
        }
      }
    }
    clear(c)
    c.fillStyle = PAL.dim
    for (let x = 0; x < W; x += 16) c.fillRect(x + 4, H / 2 - 1, 8, 2)
    c.fillStyle = PAL.c
    c.fillRect(ax, 20, PW, PH)
    c.fillStyle = PAL.b
    c.fillRect(px, H - 26, PW, PH)
    c.fillStyle = PAL.a
    c.fillRect(bx - 4, by - 4, 8, 8)
    text(c, `${ai}`, 14, H / 2 - 12, 18, PAL.c, 'left')
    text(c, `${me}`, 14, H / 2 + 26, 18, PAL.b, 'left')
    if (over) {
      c.fillStyle = 'rgba(28,18,51,0.7)'
      c.fillRect(0, 100, W, 90)
      text(c, me >= 5 ? 'KAZANDIN!' : 'KAYBETTİN', W / 2, 135, 20, PAL.a)
      text(c, 'Tekrar: BOŞLUK / A', W / 2, 165, 12)
    }
  })
  return { destroy: stop }
}

// ------------------------------------------------------------ TUĞLA KIR
function breakout(cv, input, api) {
  const c = cv.getContext('2d')
  const COLS = 8
  const ROWS = 5
  const BW = W / COLS
  const BH = 14
  const PW = 48
  let px, bx, by, vx, vy, bricks, lives, score, over, stuck
  const reset = () => {
    px = W / 2 - PW / 2
    bricks = Array.from({ length: ROWS * COLS }, () => true)
    lives = 3
    score = 0
    over = false
    api.score(0)
    ball()
  }
  function ball() {
    stuck = true
    bx = px + PW / 2
    by = H - 36
    vx = 90
    vy = -170
  }
  reset()
  input.onPress = (k) => {
    if (over && k === 'action') reset()
    else if (stuck && k === 'action') stuck = false
  }
  const colors = [PAL.c, PAL.a, PAL.b, PAL.d, PAL.fg]
  const stop = raf((dt) => {
    if (!over) {
      if (input.held('left')) px -= 220 * dt
      if (input.held('right')) px += 220 * dt
      px = Math.max(0, Math.min(W - PW, px))
      if (stuck) bx = px + PW / 2
      else {
        bx += vx * dt
        by += vy * dt
        if (bx < 4 || bx > W - 4) {
          vx = -vx
          bx = Math.max(4, Math.min(W - 4, bx))
        }
        if (by < 4) {
          vy = Math.abs(vy)
          by = 4
        }
        if (vy > 0 && by > H - 34 && by < H - 24 && bx > px - 4 && bx < px + PW + 4) {
          const off = (bx - (px + PW / 2)) / (PW / 2)
          vy = -Math.abs(vy)
          vx = off * 160
        }
        const col = Math.floor(bx / BW)
        const row = Math.floor((by - 30) / BH)
        if (row >= 0 && row < ROWS && col >= 0 && col < COLS && bricks[row * COLS + col]) {
          bricks[row * COLS + col] = false
          vy = -vy
          score += 10
          api.score(score)
          if (bricks.every((b) => !b)) {
            bricks = Array.from({ length: ROWS * COLS }, () => true)
            vy *= 1.1
            ball()
          }
        }
        if (by > H) {
          lives -= 1
          if (lives <= 0) {
            over = true
            api.over(score)
          } else ball()
        }
      }
    }
    clear(c)
    bricks.forEach((b, i) => {
      if (!b) return
      const r = Math.floor(i / COLS)
      c.fillStyle = colors[r % colors.length]
      c.fillRect((i % COLS) * BW + 1, 30 + r * BH + 1, BW - 2, BH - 2)
    })
    c.fillStyle = PAL.b
    c.fillRect(px, H - 28, PW, 6)
    c.fillStyle = PAL.a
    c.beginPath()
    c.arc(bx, by, 4, 0, Math.PI * 2)
    c.fill()
    text(c, `SKOR ${score}`, 6, 16, 12, PAL.fg, 'left')
    text(c, '♥'.repeat(Math.max(0, lives)), W - 6, 16, 12, PAL.c, 'right')
    if (stuck && !over) text(c, 'BOŞLUK / A: fırlat', W / 2, H - 6, 11, PAL.dim)
    if (over) {
      c.fillStyle = 'rgba(28,18,51,0.7)'
      c.fillRect(0, 110, W, 80)
      text(c, 'OYUN BİTTİ', W / 2, 145, 20, PAL.a)
      text(c, 'Tekrar: BOŞLUK / A', W / 2, 170, 12)
    }
  })
  return { destroy: stop }
}

// ------------------------------------------------------------ BLOK DÜŞÜR
const SHAPES = [
  [[1, 1, 1, 1]],
  [[1, 1], [1, 1]],
  [[0, 1, 0], [1, 1, 1]],
  [[1, 0, 0], [1, 1, 1]],
  [[0, 0, 1], [1, 1, 1]],
  [[0, 1, 1], [1, 1, 0]],
  [[1, 1, 0], [0, 1, 1]],
]
const SHAPE_COLORS = [PAL.b, PAL.a, PAL.d, PAL.c, '#7fcdf3', '#8fdcb4', '#ff8fa3']
function tetris(cv, input, api) {
  const c = cv.getContext('2d')
  const CW = 15
  const GW = 10
  const GH = 20
  const OX = 45
  const OY = 12
  let grid, piece, score, lines, acc, over
  const rot = (m) => m[0].map((_, i) => m.map((r) => r[i]).reverse())
  const fits = (m, x, y) => m.every((r, j) => r.every((v, i) => !v || (x + i >= 0 && x + i < GW && y + j < GH && (y + j < 0 || !grid[y + j][x + i]))))
  const spawn = () => {
    const k = Math.floor(Math.random() * SHAPES.length)
    piece = { m: SHAPES[k].map((r) => [...r]), x: Math.floor((GW - SHAPES[k][0].length) / 2), y: -1, col: SHAPE_COLORS[k] }
    if (!fits(piece.m, piece.x, piece.y)) {
      over = true
      api.over(score)
    }
  }
  const reset = () => {
    grid = Array.from({ length: GH }, () => Array(GW).fill(0))
    score = 0
    lines = 0
    acc = 0
    over = false
    api.score(0)
    spawn()
  }
  const lock = () => {
    piece.m.forEach((r, j) => r.forEach((v, i) => v && piece.y + j >= 0 && (grid[piece.y + j][piece.x + i] = piece.col)))
    let cleared = 0
    for (let y = GH - 1; y >= 0; y--) {
      if (grid[y].every(Boolean)) {
        grid.splice(y, 1)
        grid.unshift(Array(GW).fill(0))
        cleared++
        y++
      }
    }
    if (cleared) {
      lines += cleared
      score += [0, 100, 300, 500, 800][cleared]
      api.score(score)
    }
    spawn()
  }
  reset()
  input.onPress = (k) => {
    if (over) return k === 'action' && reset()
    if (k === 'left' && fits(piece.m, piece.x - 1, piece.y)) piece.x -= 1
    else if (k === 'right' && fits(piece.m, piece.x + 1, piece.y)) piece.x += 1
    else if (k === 'up') {
      const r = rot(piece.m)
      for (const dx of [0, -1, 1, -2, 2]) {
        if (fits(r, piece.x + dx, piece.y)) {
          piece.m = r
          piece.x += dx
          break
        }
      }
    } else if (k === 'action') {
      while (fits(piece.m, piece.x, piece.y + 1)) piece.y += 1
      lock()
    }
  }
  const stop = raf((dt) => {
    if (!over) {
      acc += dt * (input.held('down') ? 14 : 1)
      const step = Math.max(0.08, 0.6 - lines * 0.025)
      while (acc >= step && !over) {
        acc -= step
        if (fits(piece.m, piece.x, piece.y + 1)) piece.y += 1
        else lock()
      }
    }
    clear(c)
    c.fillStyle = '#251a45'
    c.fillRect(OX, OY, GW * CW, GH * CW)
    const cell = (x, y, col) => {
      c.fillStyle = col
      c.fillRect(OX + x * CW + 1, OY + y * CW + 1, CW - 2, CW - 2)
    }
    grid.forEach((r, y) => r.forEach((v, x) => v && cell(x, y, v)))
    if (!over) piece.m.forEach((r, j) => r.forEach((v, i) => v && piece.y + j >= 0 && cell(piece.x + i, piece.y + j, piece.col)))
    text(c, `SKOR ${score}`, W / 2, H - 6, 12, PAL.fg)
    if (over) {
      c.fillStyle = 'rgba(28,18,51,0.7)'
      c.fillRect(0, 110, W, 80)
      text(c, 'OYUN BİTTİ', W / 2, 145, 20, PAL.a)
      text(c, 'Tekrar: BOŞLUK / A', W / 2, 170, 12)
    }
  })
  return { destroy: stop }
}

export const ARCADE_GAMES = [
  { id: 'snake', title: 'YILAN', hint: 'Ok tuşları / WASD · yem ye, büyü', create: snake },
  { id: 'pong', title: 'PONG', hint: 'Sol/Sağ · bilgisayara karşı ilk 5', create: pong },
  { id: 'breakout', title: 'TUĞLA KIR', hint: 'Sol/Sağ · BOŞLUK ile fırlat', create: breakout },
  { id: 'tetris', title: 'BLOK DÜŞÜR', hint: 'Sol/Sağ · Yukarı döndür · Aşağı hızlandır · BOŞLUK bırak', create: tetris },
]
