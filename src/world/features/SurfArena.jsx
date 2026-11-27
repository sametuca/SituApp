import { useEffect, useRef, useState } from 'react'
import { drawSkyAndHorizon as drawSky, drawSurfer as drawSurferAt, drawWave as drawWaveAt, proj } from './surfDraw'
import SurfHud from './SurfHud'
import { BOARD_STYLES, JUMP_CD, MAX_LIVES, makeRng, saveLocalScore } from './surfData'

/** 60 FPS perspektif 3B-hissi veren, dinamik okyanus & animasyonlu sörf arenası. */
export default function SurfArena({ match, selfId, selfName, touch, remoteRef, onSendPos, onLocalOut, onBotFinish, onExit }) {
  const canvasRef = useRef(null)
  const [hud, setHud] = useState({ countdown: 3, alive: match.players.length, total: match.players.length, ms: 0, speedLv: 1, out: false, jumpReady: 1, combo: 0, lives: MAX_LIVES, wind: 0 })
  const inputRef = useRef({ left: false, right: false, pointerX: null, wantJump: false })

  useEffect(() => {
    const onDown = (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') inputRef.current.left = true
      if (e.code === 'ArrowRight' || e.code === 'KeyD') inputRef.current.right = true
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault()
        inputRef.current.wantJump = true
      }
    }
    const onUp = (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') inputRef.current.left = false
      if (e.code === 'ArrowRight' || e.code === 'KeyD') inputRef.current.right = false
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return undefined
    const ctx = cv.getContext('2d')
    const rng = makeRng(match.seed)
    const isPractice = Boolean(match.practice)

    const surfers = match.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      isSelf: p.id === selfId,
      isBot: Boolean(p.isBot),
      style: BOARD_STYLES[i % BOARD_STYLES.length],
      x: p.x ?? 0.5,
      vx: 0,
      tilt: 0,
      jump: 0,
      jumpVel: 0,
      jumpCd: 0,
      spin: 0,
      alive: true,
      lives: MAX_LIVES,
      invuln: 0,
      outMs: 0,
      botTarget: p.x ?? 0.5,
      botSkill: 0.64 + (i % 4) * 0.09,
      wake: [],
    }))
    const me = surfers.find((s) => s.isSelf) ?? surfers[0]
    const outOrder = []
    const waves = []
    const particles = []
    const splashes = []
    const callouts = []
    // Gökyüzü bulutları ve martılar
    const clouds = Array.from({ length: 6 }, (_, i) => ({
      x: (i / 6) * 1.15,
      y: 0.04 + (i % 3) * 0.036,
      s: 0.7 + (i % 3) * 0.35,
      sp: 0.008 + (i % 4) * 0.004,
    }))
    const birds = Array.from({ length: 4 }, (_, i) => ({
      x: 0.15 + i * 0.22,
      y: 0.07 + (i % 2) * 0.04,
      ph: i * 1.7,
      sp: 0.025 + i * 0.006,
    }))
    let nextWaveY = 0
    let waveIdx = 0
    let shake = 0
    let camShift = 0
    let combo = 0
    let lastPosSend = 0
    let lastHud = 0
    let finished = false
    let raf = 0
    let prev = performance.now()
    const matchStart = match.startAt

    const drawSkyAndHorizon = (W, H, time, camX) => drawSky(ctx, clouds, birds, W, H, time, camX)
    const drawSurfer = (s, W, H, time, camX) => drawSurferAt(ctx, s, W, H, time, camX)
    const drawWave = (w, W, H, time, camX) => drawWaveAt(ctx, w, W, H, time, camX)
    const spawnSpray = (x, y, vx, vy, n = 6, color = 'rgba(255,255,255,0.92)') => {
      for (let i = 0; i < n; i++) {
        particles.push({
          x,
          y,
          vx: vx + (Math.random() - 0.5) * 110,
          vy: vy + (Math.random() - 0.5) * 80 - 20,
          r: 2 + Math.random() * 5,
          life: 0.35 + Math.random() * 0.45,
          maxLife: 0.8,
          color,
        })
      }
    }

    const addCallout = (text, x, y, color = '#ffe48f') => {
      callouts.push({ text, x, y, vy: -52, life: 1.05, maxLife: 1.05, color })
    }

    const spawnWave = (elapsedSec) => {
      waveIdx++
      // Daha uzun ve kademeli zorlaşan parkur: daralan geçişler, kayan kanallar ve tam en zıplama dalgaları
      const gapW = Math.max(0.135, 0.255 - elapsedSec * 0.0022)
      const isJumpWall = elapsedSec >= 16 && waveIdx % 6 === 0
      const doubleGap = !isJumpWall && waveIdx % 4 === 0 && elapsedSec > 8
      const gaps = []
      if (!isJumpWall) {
        if (doubleGap) {
          const g1 = 0.1 + rng() * 0.24
          const g2 = 0.58 + rng() * 0.22
          gaps.push([g1, g1 + gapW * 0.84], [g2, g2 + gapW * 0.84])
        } else {
          const g = 0.07 + rng() * (0.86 - gapW)
          gaps.push([g, g + gapW])
        }
      }
      // 12. saniyeden sonra bazı dalgaların güvenli geçişi yanlara doğru kayar
      const canDrift = !isJumpWall && !doubleGap && elapsedSec >= 12 && waveIdx % 2 === 1
      const driftSpeed = canDrift ? (rng() < 0.5 ? -1 : 1) * (0.07 + Math.min(0.12, elapsedSec * 0.0018)) : 0
      waves.push({
        id: waveIdx,
        y: 0.01,
        h: isJumpWall ? 0.056 : 0.066 + rng() * 0.018,
        gaps,
        jumpWall: isJumpWall,
        driftSpeed,
        phase: rng() * Math.PI * 2,
        cleared: false,
        crestColor: isJumpWall ? '#e65c4f' : waveIdx % 3 === 0 ? '#1ea9c9' : '#1390b5',
      })
    }

    const loop = (now) => {
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now
      const time = now / 1000

      const rect = cv.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const W = Math.max(300, Math.floor(rect.width))
      const H = Math.max(260, Math.floor(rect.height))
      if (cv.width !== Math.floor(W * dpr) || cv.height !== Math.floor(H * dpr)) {
        cv.width = Math.floor(W * dpr)
        cv.height = Math.floor(H * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const nowEpoch = Date.now()
      const started = nowEpoch >= matchStart
      const elapsedMs = started ? nowEpoch - matchStart : 0
      const elapsedSec = elapsedMs / 1000
      const speed = 0.27 + Math.min(0.45, elapsedSec * 0.0085)
      // 22. saniyeden sonra periyodik yan akıntı (deterministik: tüm oyuncularda aynı)
      const windPhase = elapsedSec >= 22 ? Math.sin((elapsedSec - 22) * 0.42 + (match.seed % 7)) : 0
      const windForce = Math.abs(windPhase) > 0.55 ? Math.sign(windPhase) * (0.09 + Math.min(0.08, (elapsedSec - 22) * 0.0016)) : 0

      // Yumuşak kamera paralaksı (sörfçünün yatışını takip eder)
      camShift += ((me.x - 0.5) - camShift) * Math.min(1, dt * 4.5)

      // 1. Uzak oyuncuları güncelle (multiplayer)
      if (!isPractice && remoteRef.current) {
        for (const rp of remoteRef.current) {
          const s = surfers.find((x) => x.id === rp.id)
          if (!s || s.isSelf) continue
          s.x += (rp.x - s.x) * Math.min(1, dt * 14)
          s.tilt += (rp.tilt - s.tilt) * Math.min(1, dt * 14)
          s.jump += ((rp.jump ?? 0) - s.jump) * Math.min(1, dt * 16)
          if (s.alive && !rp.alive) {
            s.alive = false
            const sp = proj(s.x, 0.78, W, H, camShift)
            splashes.push({ x: sp.x, y: sp.y, r: 12, life: 0.7 })
            spawnSpray(sp.x, sp.y, 0, -45, 22)
          }
        }
      }

      // 2. Kendi kontrolüm + fizik
      if (started && me.alive && !finished) {
        if (me.invuln > 0) me.invuln = Math.max(0, me.invuln - dt)
        let steer = 0
        if (inputRef.current.pointerX !== null) {
          const diff = inputRef.current.pointerX - me.x
          steer = Math.max(-1, Math.min(1, diff * 7.5))
        } else {
          if (inputRef.current.left) steer -= 1
          if (inputRef.current.right) steer += 1
        }
        const targetVx = steer * 0.78 + (me.jump < 0.05 ? windForce : 0)
        me.vx += (targetVx - me.vx) * Math.min(1, dt * 11)
        me.x = Math.max(0.06, Math.min(0.94, me.x + me.vx * dt))
        me.tilt += (Math.max(-1, Math.min(1, me.vx * 1.9)) - me.tilt) * Math.min(1, dt * 12)

        const mePt = proj(me.x, 0.78, W, H, camShift)
        if (me.jumpCd > 0) me.jumpCd = Math.max(0, me.jumpCd - dt)
        if (inputRef.current.wantJump && me.jump <= 0.001 && me.jumpCd <= 0) {
          me.jumpVel = 3.35
          me.jumpCd = JUMP_CD
          me.spin = 0
          spawnSpray(mePt.x, mePt.y + 18, 0, 50, 14, 'rgba(220,252,255,0.95)')
          window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
        }
        inputRef.current.wantJump = false
        if (me.jump > 0 || me.jumpVel > 0) {
          me.jump += me.jumpVel * dt
          me.jumpVel -= 9.4 * dt
          me.spin += dt * Math.PI * 2.9 // havada şık 360° dönüş
          if (me.jump <= 0) {
            me.jump = 0
            me.jumpVel = 0
            me.spin = 0
            splashes.push({ x: mePt.x, y: mePt.y + 10, r: 8, life: 0.45 })
            spawnSpray(mePt.x, mePt.y + 14, 0, 30, 14)
          }
        }

        if (Math.abs(me.vx) > 0.14 && me.jump < 0.1 && Math.random() < 0.65) {
          spawnSpray(mePt.x - Math.sign(me.vx) * 16, mePt.y + 20, -me.vx * 105, 55, 2, 'rgba(235,253,255,0.92)')
        }

        if (!isPractice && now - lastPosSend > 65) {
          lastPosSend = now
          onSendPos({ x: me.x, tilt: me.tilt, jump: me.jump })
        }
      }

      // 3. Dalgaları üret & ilerlet (kayan geçiş kanalları dahil)
      if (started && !finished) {
        nextWaveY -= speed * dt
        if (nextWaveY <= 0) {
          spawnWave(elapsedSec)
          nextWaveY = Math.max(0.24, 0.48 - elapsedSec * 0.0038)
        }
        for (const w of waves) {
          w.y += speed * dt
          if (w.driftSpeed && w.gaps.length === 1) {
            const g = w.gaps[0]
            const gw = g[1] - g[0]
            let ng0 = g[0] + w.driftSpeed * dt
            if (ng0 < 0.06) {
              ng0 = 0.06
              w.driftSpeed = Math.abs(w.driftSpeed)
            } else if (ng0 + gw > 0.94) {
              ng0 = 0.94 - gw
              w.driftSpeed = -Math.abs(w.driftSpeed)
            }
            g[0] = ng0
            g[1] = ng0 + gw
          }
        }
        while (waves.length && waves[0].y > 1.15) waves.shift()
      }

      // 4. Bot yapay zekâsı (antrenman modu — zıplama ve gerçekçi hata payı dahil)
      if (started && isPractice && !finished) {
        const incoming = waves.find((w) => w.y + w.h > 0.18 && w.y < 0.8)
        for (const s of surfers) {
          if (!s.isBot || !s.alive) continue
          if (s.invuln > 0) s.invuln = Math.max(0, s.invuln - dt)
          if (s.jumpCd > 0) s.jumpCd = Math.max(0, s.jumpCd - dt)
          if (incoming) {
            if (incoming.jumpWall) {
              if (incoming.y > 0.56 && incoming.y < 0.68 && s.jump <= 0.001 && s.jumpCd <= 0 && rng() < s.botSkill * 0.92) {
                s.jumpVel = 3.3
                s.jumpCd = JUMP_CD
              }
            } else if (incoming.gaps.length) {
              let bestGap = incoming.gaps[0]
              let bestD = 9
              for (const g of incoming.gaps) {
                const mid = (g[0] + g[1]) / 2
                const d = Math.abs(mid - s.x)
                if (d < bestD) {
                  bestD = d
                  bestGap = g
                }
              }
              const mid = (bestGap[0] + bestGap[1]) / 2
              const fatigue = Math.min(0.14, elapsedSec * 0.0018)
              const jitter = Math.sin(time * 2.4 + s.botSkill * 20) * (1 - s.botSkill + fatigue) * 0.22
              s.botTarget = Math.max(0.08, Math.min(0.92, mid + jitter))
            }
          }
          if (s.jump > 0 || s.jumpVel > 0) {
            s.jump += s.jumpVel * dt
            s.jumpVel -= 9.4 * dt
            if (s.jump <= 0) {
              s.jump = 0
              s.jumpVel = 0
            }
          }
          const diff = s.botTarget - s.x
          s.vx += (Math.max(-1, Math.min(1, diff * 5)) * 0.64 * s.botSkill + windForce * 0.55 - s.vx) * Math.min(1, dt * 8)
          s.x = Math.max(0.06, Math.min(0.94, s.x + s.vx * dt))
          s.tilt += (Math.max(-1, Math.min(1, s.vx * 1.8)) - s.tilt) * Math.min(1, dt * 10)
        }
      }

      // 5. Çarpışma kontrolü (2 can sistemi + kısa toparlanma süresi) + temiz geçiş ödül efektleri
      for (const s of surfers) {
        if (!s.alive) continue
        if (s.jump < 0.15) {
          s.wake.push({ x: s.x, y: 0.8 })
          if (s.wake.length > 16) s.wake.shift()
        }
        for (const pt of s.wake) pt.y += speed * dt * 1.15

        if (!started || finished) continue
        if (!s.isSelf && !isPractice) continue
        for (const w of waves) {
          if (s.isSelf && !w.cleared && w.y > 0.79) {
            w.cleared = true
            combo++
            const mp = proj(me.x, 0.78, W, H, camShift)
            if (me.jump > 0.2) addCallout(w.jumpWall ? 'MEGA ATLAYIŞ! 🌊' : 'HARİKA ATLAYIŞ! 🌊', mp.x, mp.y - 68, '#ffe48f')
            else if (combo >= 3) addCallout(`${combo}× SERİ! ✨`, mp.x, mp.y - 64, '#a8f0ff')
          }
          if (s.invuln > 0) continue
          if (s.jump > 0.25) continue // havada dalganın üstünden atladı!
          if (w.y + w.h >= 0.735 && w.y <= 0.785) {
            const safe = !w.jumpWall && w.gaps.some(([g0, g1]) => s.x >= g0 + 0.015 && s.x <= g1 - 0.015)
            if (!safe) {
              s.lives -= 1
              const sp = proj(s.x, 0.78, W, H, camShift)
              splashes.push({ x: sp.x, y: sp.y, r: 16, life: 0.8 })
              spawnSpray(sp.x, sp.y, 0, -60, 26)
              if (s.lives > 0) {
                s.invuln = 1.35
                if (s.isSelf) {
                  shake = 10
                  combo = 0
                  addCallout('SON CAN! ❤️', sp.x, sp.y - 68, '#ff9c8f')
                  window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
                }
                break
              }
              s.alive = false
              s.outMs = elapsedMs
              outOrder.push(s)
              if (s.isSelf) {
                shake = 14
                combo = 0
                window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
                if (!isPractice) onLocalOut(elapsedMs)
              }
              break
            }
          }
        }
      }

      // Antrenman modu bitiş kontrolü
      if (started && isPractice && !finished) {
        const aliveList = surfers.filter((s) => s.alive)
        if (aliveList.length <= 1 || (!me.alive && elapsedMs - me.outMs > 1200)) {
          finished = true
          const ordered = [...aliveList, ...[...outOrder].reverse()]
          const standings = ordered.map((s, idx) => {
            const rank = idx + 1
            const pts = rank === 1 ? 100 : rank === 2 ? 60 : rank === 3 ? 35 : 15
            return { rank, id: s.id, name: s.name, ms: Math.round(s.alive ? elapsedMs : s.outMs), pts, coins: 0 }
          })
          const myRow = standings.find((r) => r.id === me.id)
          const top = saveLocalScore(selfName, myRow?.pts ?? 15, myRow?.rank === 1, myRow?.ms ?? elapsedMs)
          onBotFinish({ winner: standings[0], standings, top, practice: true })
        }
      }

      // 6. ÇİZİM — Gökyüzü, perspektif okyanus, dalgalar, sörfçüler, köpük & hız çizgileri
      ctx.save()
      if (shake > 0.2) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake)
        shake *= Math.pow(0.05, dt)
      }

      drawSkyAndHorizon(W, H, time, camShift)

      // Arkadan öne doğru dalgalar (perspektif derinlik sırası)
      const backWaves = waves.filter((w) => w.y <= 0.78)
      const frontWaves = waves.filter((w) => w.y > 0.78)
      for (const w of backWaves) drawWave(w, W, H, time, camShift)

      // Sörfçüler
      for (const s of surfers) if (s.alive) drawSurfer(s, W, H, time, camShift)

      // Sörfçüyü geçmiş ön dalgalar
      for (const w of frontWaves) drawWave(w, W, H, time, camShift)

      // Çarpışma & iniş dalga halkaları
      for (let i = splashes.length - 1; i >= 0; i--) {
        const sp = splashes[i]
        sp.r += dt * 130
        sp.life -= dt
        if (sp.life <= 0) {
          splashes.splice(i, 1)
          continue
        }
        ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, sp.life).toFixed(2)})`
        ctx.lineWidth = 4.5
        ctx.beginPath()
        ctx.ellipse(sp.x, sp.y, sp.r, sp.r * 0.55, 0, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Su spreyi parçacıkları
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += 120 * dt
        p.life -= dt
        if (p.life <= 0) {
          particles.splice(i, 1)
          continue
        }
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife)
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // Yüzen başarı yazıları ("HARİKA ATLAYIŞ!", "3× SERİ!")
      for (let i = callouts.length - 1; i >= 0; i--) {
        const c = callouts[i]
        c.y += c.vy * dt
        c.life -= dt
        if (c.life <= 0) {
          callouts.splice(i, 1)
          continue
        }
        ctx.save()
        ctx.globalAlpha = Math.min(1, c.life * 2)
        ctx.font = '900 16px Nunito, sans-serif'
        ctx.textAlign = 'center'
        ctx.strokeStyle = 'rgba(74, 59, 92, 0.75)'
        ctx.lineWidth = 4
        ctx.strokeText(c.text, c.x, c.y)
        ctx.fillStyle = c.color
        ctx.fillText(c.text, c.x, c.y)
        ctx.restore()
      }

      // Yüksek hızda kenar hız çizgileri
      const speedLv = 1 + Math.floor(elapsedSec / 8)
      if (started && speedLv >= 2) {
        const alpha = Math.min(0.28, (speedLv - 1) * 0.06)
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`
        ctx.lineWidth = 2
        for (let i = 0; i < 10; i++) {
          const leftSide = i % 2 === 0
          const sx = leftSide ? 10 + (i * 7) % 36 : W - 10 - ((i * 7) % 36)
          const sy = ((time * 520 + i * 97) % H)
          ctx.beginPath()
          ctx.moveTo(sx, sy)
          ctx.lineTo(sx + (leftSide ? -6 : 6), sy + 38)
          ctx.stroke()
        }
      }
      ctx.restore()

      // HUD güncelle (~10 Hz)
      if (now - lastHud > 100) {
        lastHud = now
        const cd = started ? 0 : Math.ceil((matchStart - nowEpoch) / 1000)
        const aliveCnt = surfers.filter((s) => s.alive).length
        setHud({
          countdown: cd,
          alive: aliveCnt,
          total: surfers.length,
          ms: elapsedMs,
          speedLv,
          out: !me.alive,
          jumpReady: Math.max(0, Math.min(1, 1 - me.jumpCd / JUMP_CD)),
          combo,
          lives: Math.max(0, me.lives),
          wind: Math.sign(windForce),
        })
      }

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [match, selfId, selfName, remoteRef, onSendPos, onLocalOut, onBotFinish])

  return <SurfHud hud={hud} touch={touch} canvasRef={canvasRef} inputRef={inputRef} onExit={onExit} />
}
