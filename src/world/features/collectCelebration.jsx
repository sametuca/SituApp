// Toplama kutlamaları: her toplamada parlak rozet + halka + parıltılar + "+N ⭐" + seviye çubuğu; seviye atlayınca tam ekran kutlama.
import { useEffect, useMemo } from 'react'
import { Em } from '../../components/emoji'
import { KINDS, levelOf } from '../collectibles'

const SPARKS = 14
const COLORS = ['#ffe48f', '#ffd35e', '#fff3c8', '#bfe9ff', '#d6ccff', '#b9f0d3']

function Sparks({ big }) {
  const items = useMemo(
    () =>
      Array.from({ length: big ? 34 : SPARKS }, (_, i) => {
        const a = (i / (big ? 34 : SPARKS)) * Math.PI * 2 + Math.random() * 0.4
        const r = (big ? 150 : 80) + Math.random() * (big ? 220 : 70)
        return { dx: Math.cos(a) * r, dy: Math.sin(a) * r - (big ? 40 : 20), rot: `${Math.floor(Math.random() * 540 - 270)}deg`, c: COLORS[i % COLORS.length], s: 6 + Math.random() * 8, d: Math.random() * 0.15 }
      }),
    [big],
  )
  return items.map((p, i) => (
    <span
      key={i}
      className="absolute left-1/2 top-1/2 rounded-[3px]"
      style={{ width: p.s, height: p.s * (i % 3 ? 1 : 1.8), background: p.c, '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--rot': p.rot, animation: `confetti-burst ${big ? 1.5 : 0.9}s ${p.d}s ease-out both` }}
    />
  ))
}

/** Küçük toplama patlaması (ekranın üst-orta bölgesinde). */
export function CollectBurst({ ev, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1900)
    return () => clearTimeout(t)
  }, [onDone])
  const k = KINDS[ev.kind]
  const chest = ev.kind === 'chest'
  const lv = levelOf(ev.xp)
  const prev = levelOf(Math.max(0, ev.xp - ev.gain))
  const fromPct = prev.level === lv.level ? (prev.into / prev.span) * 100 : 0
  const toPct = (lv.into / lv.span) * 100
  return (
    <div className="pointer-events-none absolute left-1/2 top-[26%] z-40 -translate-x-1/2" aria-live="polite">
      <div className="relative grid h-0 w-0 place-items-center">
        <span className="absolute left-1/2 top-1/2 h-40 w-40 rounded-full border-[6px] border-[#ffe48f]" style={{ animation: 'cel-ring 0.9s ease-out both' }} />
        <span className="absolute left-1/2 top-1/2 h-40 w-40 rounded-full border-[3px] border-white" style={{ animation: 'cel-ring 1.1s 0.12s ease-out both' }} />
        <Sparks big={chest} />
        <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ animation: 'cel-icon 0.7s cubic-bezier(.2,1.4,.4,1) both', filter: 'drop-shadow(0 6px 14px rgba(255,200,60,.75))' }}>
          <Em e={k.emoji} size={chest ? 96 : 76} />
        </div>
      </div>
      <div className="absolute left-1/2 top-[64px] flex -translate-x-1/2 flex-col items-center gap-2" style={{ animation: 'cel-float 1.7s ease-out both' }}>
        <span className="whitespace-nowrap rounded-full border-2 border-white bg-gradient-to-b from-[#fff3c8] to-[#ffd35e] px-4 py-1 text-lg font-black text-[#8a5a00] shadow-lg">
          +{ev.gain} ⭐ {chest ? 'Hazine!' : k.name}
        </span>
        <div className="w-44 overflow-hidden rounded-full border-2 border-white bg-white/70 p-[3px] shadow">
          <div className="h-2.5 rounded-full bg-gradient-to-r from-[#ffd35e] to-[#ff9f43]" style={{ '--from': `${fromPct}%`, '--to': `${toPct}%`, animation: 'cel-bar 0.9s 0.2s ease-out both' }} />
        </div>
        <span className="rounded-full bg-[#4a3b5c]/80 px-2.5 py-0.5 text-[0.6875rem] font-extrabold text-white">Seviye {lv.level} · {lv.into}/{lv.span} ⭐</span>
      </div>
    </div>
  )
}

/** Seviye atlama: tam ekran parlama, dönen ışınlar, büyük rozet ve afiş. */
export function LevelUp({ level, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3600)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden" role="status" aria-live="assertive">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,#fff6cc_0%,#ffe48f55_35%,transparent_70%)]" style={{ animation: 'cel-flash 1.6s ease-out both' }} />
      <div className="absolute left-1/2 top-[36%] -translate-x-1/2 -translate-y-1/2" style={{ animation: 'cel-banner 3.4s ease-out both' }}>
        <div className="relative grid place-items-center">
          <div className="absolute h-[22rem] w-[22rem] opacity-60" style={{ background: 'conic-gradient(from 0deg, #ffe48f55 0 10deg, transparent 10deg 30deg, #ffe48f55 30deg 40deg, transparent 40deg 60deg, #ffe48f55 60deg 70deg, transparent 70deg 90deg, #ffe48f55 90deg 100deg, transparent 100deg 120deg, #ffe48f55 120deg 130deg, transparent 130deg 150deg, #ffe48f55 150deg 160deg, transparent 160deg 180deg, #ffe48f55 180deg 190deg, transparent 190deg 210deg, #ffe48f55 210deg 220deg, transparent 220deg 240deg, #ffe48f55 240deg 250deg, transparent 250deg 270deg, #ffe48f55 270deg 280deg, transparent 280deg 300deg, #ffe48f55 300deg 310deg, transparent 310deg 330deg, #ffe48f55 330deg 340deg, transparent 340deg 360deg)', borderRadius: '9999px', maskImage: 'radial-gradient(circle, #000 20%, transparent 70%)', animation: 'cel-spin 8s linear infinite' }} />
          <div className="relative grid h-32 w-32 place-items-center rounded-full border-[6px] border-white bg-gradient-to-b from-[#ffe48f] to-[#ff9f43] shadow-[0_10px_30px_rgba(255,159,67,.6)]">
            <span className="text-6xl font-black text-white drop-shadow-[0_3px_0_rgba(138,90,0,.45)]">{level}</span>
          </div>
          <div className="relative -mt-3 rounded-full border-4 border-white bg-[#4a3b5c] px-6 py-1.5 text-xl font-black tracking-wide text-[#ffe48f] shadow-lg">SEVİYE ATLADIN!</div>
          <p className="mt-2 rounded-full bg-white/85 px-4 py-1 text-sm font-extrabold text-[#4a3b5c] shadow">Yeni seviye açıldı, keşfetmeye devam et</p>
        </div>
      </div>
      <div className="pointer-events-none absolute left-1/2 top-[36%]">
        <Sparks big />
      </div>
      <div className="pointer-events-none absolute left-[28%] top-[32%]">
        <Sparks />
      </div>
      <div className="pointer-events-none absolute left-[72%] top-[32%]">
        <Sparks />
      </div>
    </div>
  )
}
