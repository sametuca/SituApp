// Barista (sipariş hazırlama) mini oyunu arenası.
import { useEffect, useRef, useState } from 'react'
import { makeRng } from './minigameShared'
// ======================= 3. BARİSTA SİPARİŞ YARIŞI (KAFE / TATLI) =======================
export const INGS = [
  { id: 'esp', label: 'Espresso', emoji: '☕', color: '#6b4226' },
  { id: 'milk', label: 'Süt', emoji: '🥛', color: '#fff8ee' },
  { id: 'straw', label: 'Çilek', emoji: '🍓', color: '#ff9ec7' },
  { id: 'matcha', label: 'Matcha', emoji: '🍵', color: '#8fdcb4' },
  { id: 'caramel', label: 'Karamel', emoji: '🍯', color: '#f3b659' },
  { id: 'cream', label: 'Krema', emoji: '🍦', color: '#efe2ff' },
]

export function nextOrder(rng, count) {
  const len = count > 4 ? 4 : 3
  return Array.from({ length: len }, () => INGS[Math.floor(rng() * INGS.length)])
}

export function BaristaArena({ seed, onFinish, onExit }) {
  const [init] = useState(() => {
    const r = makeRng(seed)
    return { rng: r, firstOrder: nextOrder(r, 0) }
  })
  const rngRef = useRef(init.rng)
  const [order, setOrder] = useState(init.firstOrder)
  const [cup, setCup] = useState([])
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [left, setLeft] = useState(40)
  const [msg, setMsg] = useState('Siparişi alttan üste doğru hazırla!')
  const scoreRef = useRef(0)

  useEffect(() => {
    const id = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          clearInterval(id)
          onFinish(scoreRef.current, 40_000)
          return 0
        }
        return l - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [onFinish])

  const pickIng = (ing) => {
    if (left <= 0) return
    const want = order[cup.length]
    if (want.id === ing.id) {
      const next = [...cup, ing]
      window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'pop' }))
      if (next.length === order.length) {
        const pts = 100 + streak * 25
        scoreRef.current += pts
        setScore(scoreRef.current)
        setStreak((s) => s + 1)
        setMsg(`✨ Harika! +${pts} puan!`)
        setCup([])
        setOrder(nextOrder(rngRef.current, streak + 1))
      } else {
        setCup(next)
      }
    } else {
      setStreak(0)
      setCup([])
      setMsg('Yanlış katman! Bardak sıfırlandı 😅')
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#3a2a45]/60 p-4 backdrop-blur-sm">
      <div className="flex w-[min(94vw,28rem)] animate-pop flex-col items-center rounded-[2rem] border-2 border-white bg-[#fffaf4] p-5 shadow-toy">
        <div className="flex w-full items-center justify-between">
          <div className="flex gap-2">
            <span className="rounded-full bg-[#fff3c8] px-3 py-1 text-xs font-black text-[#8a5a00]">☕ {score} puan</span>
            <span className="rounded-full bg-[#dff3ff] px-3 py-1 text-xs font-black text-[#12688a]">⏱ {left} sn</span>
          </div>
          <button type="button" onClick={onExit} className="rounded-full bg-[#ffe8e8] px-3 py-1 text-xs font-black text-[#b54141]">Çık ✖️</button>
        </div>

        <p className="mt-3 text-xs font-extrabold text-[#8a7a9c]">{msg}</p>

        {/* Hedef Sipariş + Canlı Dolum Bardağı */}
        <div className="mt-3 flex w-full items-end justify-center gap-6">
          <div className="flex flex-col items-center">
            <span className="mb-1 text-[11px] font-black text-[#8a7a9c]">MÜŞTERİ SİPARİŞİ</span>
            <div className="flex h-36 w-24 flex-col-reverse overflow-hidden rounded-b-3xl rounded-t-xl border-4 border-white bg-[#f3ece4] shadow-inner">
              {order.map((ing, i) => (
                <div key={i} className="flex flex-1 items-center justify-center text-xs font-black text-[#4a3b5c]" style={{ background: ing.color }}>
                  {ing.emoji}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center">
            <span className="mb-1 text-[11px] font-black text-[#e8952c]">SENİN BARDAĞIN</span>
            <div className="flex h-36 w-24 flex-col-reverse overflow-hidden rounded-b-3xl rounded-t-xl border-4 border-[#fdb252] bg-white shadow-soft">
              {cup.map((ing, i) => (
                <div key={i} className="flex h-1/3 animate-pop items-center justify-center text-sm" style={{ background: ing.color }}>
                  {ing.emoji}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 grid w-full grid-cols-3 gap-2">
          {INGS.map((ing) => (
            <button
              key={ing.id}
              type="button"
              onPointerDown={(e) => { e.preventDefault(); pickIng(ing) }}
              className="flex flex-col items-center gap-1 rounded-2xl border-2 border-white bg-white py-3 text-xs font-black text-[#4a3b5c] shadow-soft transition active:scale-95"
            >
              <span className="text-2xl">{ing.emoji}</span>
              <span>{ing.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
