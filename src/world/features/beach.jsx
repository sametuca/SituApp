// Plaj etkinlikleri (istemci): gün batımı buluşması bannerı + plaj halkası ve voleybol (zamanlama). Sunucu: server/features/beach.js.
import { TopDock } from '../../components/Dock'
import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoorPrompt } from '../Social'
import { BEACH, VOLLEY_NET } from '../layout'

const NET = VOLLEY_NET
const glass = 'border-2 border-white bg-white/90 shadow-soft backdrop-blur-md'
const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Buluşma sırasında plajın ortasında nabız gibi atan sıcak halka. */
function MeetupRing({ on }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (!ref.current) return
    const k = (clock.elapsedTime * 0.6) % 1
    ref.current.scale.setScalar(0.5 + k * 1.1)
    ref.current.material.opacity = 0.55 * (1 - k)
  })
  return (
    <mesh ref={ref} position={[BEACH.x, 0.12, BEACH.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[BEACH.r - 3, BEACH.r - 2, 64]} />
      <meshBasicMaterial color={on ? '#ffb347' : '#ffe48f'} transparent depthWrite={false} />
    </mesh>
  )
}

function Volley({ vb, me, touch, onHit, onLeave }) {
  const [, tick] = useState(0)
  const arrive = useRef(0)
  useEffect(() => {
    arrive.current = performance.now() + (vb.in ?? 0)
  }, [vb])
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 40)
    return () => clearInterval(id)
  }, [])
  const mine = vb.turn === me
  const left = arrive.current - performance.now() // >0: top henüz gelmedi
  const pos = Math.max(0, Math.min(1, 1 - left / 1700)) // 0 → 1 (1 = vuruş anı)
  const hot = Math.abs(left) < 380
  useEffect(() => {
    const on = (e) => (e.code === 'Space' || e.code === 'KeyF') && (e.preventDefault(), onHit())
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [onHit])
  const over = vb.over
  const mineScore = vb.a.id === me ? vb.sa : vb.sb
  const oppScore = vb.a.id === me ? vb.sb : vb.sa
  const opp = vb.a.id === me ? vb.b.name : vb.a.name
  return (
    <TopDock><div className={`relative pointer-events-auto w-[min(92vw,24rem)] animate-pop rounded-3xl p-3 ${glass}`}>
      <div className="flex items-center justify-between text-sm font-black text-[#4a3b5c]">
        <span>🏐 Voleybol · {opp}</span>
        <span className="rounded-full bg-[#ffe3b8] px-3 py-0.5">{mineScore} – {oppScore}</span>
      </div>
      {over ? (
        <div className="mt-3 text-center">
          <p className="text-xl font-black text-[#4a3b5c]">{over.winner === me ? '🏆 Kazandın! +15 ₺' : 'Güzel maçtı! +3 ₺'}</p>
          <button onClick={onLeave} className="mt-2 rounded-full bg-[#fdb252] px-5 py-1.5 text-sm font-black text-white">Tamam</button>
        </div>
      ) : (
        <>
          <div className="relative mt-3 h-6 overflow-hidden rounded-full bg-[#fff1d9]">
            <div className="absolute inset-y-0 right-[14%] w-[22%] rounded-full bg-[#ffb347]/70" />
            {mine && <div className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow ring-2 ring-[#fdb252]" style={{ left: `${pos * 86}%` }} />}
          </div>
          <p className="mt-2 text-center text-xs font-extrabold text-[#8a7a9c]">{mine ? (hot ? 'ŞİMDİ!' : 'Top gelirken turuncu alanda vur') : 'Rakibin vuruşu bekleniyor…'}</p>
          <button
            onPointerDown={(e) => {
              if (!mine) return
              e.preventDefault()
              onHit()
            }}
            disabled={!mine}
            className={`mt-2 w-full select-none rounded-2xl border-b-4 py-3 text-base font-black text-white transition active:translate-y-[2px] ${mine ? (hot ? 'border-[#c9731a] bg-[#ff9f43]' : 'border-[#d99a3d] bg-[#fdb252]') : 'border-[#cfc6de] bg-[#d9d2e6]'}`}
          >
            Vur! {!touch && <span className="text-xs opacity-80">(Boşluk)</span>}
          </button>
          <button onClick={onLeave} className="mt-1 w-full text-center text-[0.6875rem] font-extrabold text-[#8a7a9c] hover:underline">Ayrıl</button>
        </>
      )}
    </div></TopDock>
  )
}

export function useBeach({ net, focusRef, home, venue, touch }) {
  const { on, send } = net
  const [meetup, setMeetup] = useState({ phase: 'idle', start: 0, end: 0, n: 0 })
  const [now, setNow] = useState(Date.now())
  const [vb, setVb] = useState(null)
  const [waiting, setWaiting] = useState(false)
  const [near, setNear] = useState(null) // 'net' | null
  const [res, setRes] = useState(null)
  const myId = useRef(null)

  useEffect(() => {
    const offs = [
      on('welcome', (m) => {
        myId.current = m.id
        if (m.meetup) setMeetup(m.meetup)
      }),
      on('meetup', (m) => setMeetup(m)),
      on('meetup_end', (m) => {
        setRes(m)
        setTimeout(() => setRes(null), 6000)
        window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'quest' }))
      }),
      on('vb_wait', () => setWaiting(true)),
      on('vb_gone', () => (setWaiting(false), setVb(null))),
      on('vb', (m) => {
        setWaiting(false)
        setVb(m)
        if (m.over) window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: m.over.winner === myId.current ? 'badge' : 'pop' }))
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [on])

  // saniye saati + yakınlık denetimi
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now())
      const f = focusRef.current
      if (home || venue) return setNear(null)
      if (Math.hypot(f.x - NET.x, f.z - NET.z) <= NET.r - 0.5) setNear('net')
      else setNear(null)
    }, 400)
    return () => clearInterval(id)
  }, [focusRef, home, venue])

  const localVbTimer = useRef(null)
  const localVb = useRef(null)
  useEffect(() => () => clearTimeout(localVbTimer.current), [])

  const runLocalVbTurn = (m) => {
    clearTimeout(localVbTimer.current)
    localVb.current = m
    setVb({ ...m })
    if (m.over) {
      window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: m.over.winner === 'local' ? 'badge' : 'pop' }))
      return
    }
    if (m.turn === 'local') {
      localVbTimer.current = setTimeout(() => {
        const cur = localVb.current
        if (!cur || cur.over || cur.turn !== 'local') return
        const sb = cur.sb + 1
        const over = sb >= 5 ? { winner: 'bot' } : null
        runLocalVbTurn({ ...cur, sb, turn: over ? null : 'bot', in: 1100, over })
      }, (m.in ?? 1600) + 420)
    } else {
      localVbTimer.current = setTimeout(() => {
        const cur = localVb.current
        if (!cur || cur.over || cur.turn !== 'bot') return
        if (Math.random() < 0.28) {
          const sa = cur.sa + 1
          const over = sa >= 5 ? { winner: 'local' } : null
          runLocalVbTurn({ ...cur, sa, turn: over ? null : 'local', in: 1650, over })
        } else {
          runLocalVbTurn({ ...cur, turn: 'local', in: 1550 })
        }
      }, 1050)
    }
  }

  const startVolley = () => {
    if (send({ t: 'vb_join' })) return
    myId.current = 'local'
    runLocalVbTurn({
      local: true,
      a: { id: 'local', name: 'Sen' },
      b: { id: 'bot', name: 'Plaj Botu' },
      sa: 0,
      sb: 0,
      turn: 'local',
      in: 1700,
      arriveAt: performance.now() + 1700,
      over: null,
    })
  }

  const hit = () => {
    if (vb?.local) {
      const cur = localVb.current
      if (!cur || cur.over || cur.turn !== 'local') return
      clearTimeout(localVbTimer.current)
      window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
      runLocalVbTurn({ ...cur, turn: 'bot', in: 1050 })
      return
    }
    send({ t: 'vb_hit' })
  }
  const leaveVolley = () => {
    clearTimeout(localVbTimer.current)
    localVb.current = null
    if (!vb?.local) send({ t: 'vb_leave' })
    setVb(null)
  }
  const busy = Boolean(vb || waiting)
  const triggerRef = useRef(null)
  useEffect(() => {
    triggerRef.current = () => {
      if (busy || near !== 'net') return
      startVolley()
    }
  })
  useEffect(() => {
    const onKey = (e) => {
      if ((e.code !== 'KeyE' && e.key !== 'e' && e.key !== 'E') || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
      triggerRef.current?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const dist = Math.round(Math.hypot(focusRef.current.x - BEACH.x, focusRef.current.z - BEACH.z))
  const showMeetup = !home && !venue && meetup.phase !== 'idle'
  const overlays = (
    <>
      {showMeetup && (
        <TopDock><div className={`relative pointer-events-none rounded-2xl px-4 py-1.5 text-center ${glass}`}>
          <p className="text-xs font-black text-[#c9731a]">
            🌅 Gün batımı buluşması · {meetup.phase === 'soon' ? `${mmss(meetup.start - now)} sonra` : `${mmss(meetup.end - now)} kaldı`}
          </p>
          <p className="text-[0.6875rem] font-bold text-[#8a7a9c]">
            {meetup.phase === 'soon' ? 'Plajın ortasına gel, TL kazan!' : dist <= BEACH.r + 4 ? `Plajdasın ₺ · ${meetup.n} kişi burada` : `Plaja gel (${dist} m) · ${meetup.n} kişi bekliyor`}
          </p>
        </div></TopDock>
      )}
      {res && (
        <TopDock><div className={`relative pointer-events-none animate-pop rounded-2xl px-5 py-2 text-center ${glass}`}>
          <p className="text-sm font-black text-[#c9731a]">🌅 Buluşma bitti!</p>
          <p className="text-xs font-bold text-[#8a7a9c]">{res.secs} sn kaldın{res.bonus ? ' · +10 ₺ bonus' : ''}</p>
        </div></TopDock>
      )}
      {near === 'net' && !busy && !home && !venue && (
        <DoorPrompt emoji="🏐" label="Voleybol" action="Oyna" touch={touch} raised onGo={startVolley} />
      )}
      {waiting && !vb && (
        <TopDock><div className={`relative pointer-events-auto rounded-2xl px-4 py-2 text-center ${glass}`}>
          <p className="text-sm font-black text-[#4a3b5c]">🏐 Rakip bekleniyor…</p>
          <button onClick={() => (send({ t: 'vb_leave' }), setWaiting(false))} className="text-xs font-extrabold text-[#8a7a9c] hover:underline">Vazgeç</button>
        </div></TopDock>
      )}
      {vb && <Volley vb={vb} me={myId.current} touch={touch} onHit={hit} onLeave={leaveVolley} />}
    </>
  )
  return { overlays, worldEffects: !home && !venue && meetup.phase !== 'idle' ? <MeetupRing on={meetup.phase === 'on'} /> : null }
}
