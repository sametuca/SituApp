// Sörf arenası arayüzü: üst skor çubuğu, canvas (işaretçi girdisi), geri sayım, elenme bandı ve zıpla düğmesi.
import { MAX_LIVES, fmtSec } from './surfData'

export default function SurfHud({ hud, touch, canvasRef, inputRef, onExit }) {
  const setPointer = (e) => {
    const r = canvasRef.current?.getBoundingClientRect()
    if (!r) return
    inputRef.current.pointerX = Math.max(0.06, Math.min(0.94, (e.clientX - r.left) / r.width))
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1b7fa3] select-none touch-none">
      {/* Üst canlı skor çubuğu */}
      <div className="flex items-center justify-between gap-2 bg-white/92 px-4 py-2.5 shadow-soft backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#ffe8ee] px-2.5 py-1 text-xs font-black text-[#c93b5a]" title="Kalan can">
            {Array.from({ length: MAX_LIVES }, (_, i) => (i < hud.lives ? '❤️' : '🤍')).join('')}
          </span>
          <span className="rounded-full bg-[#dff7ff] px-3 py-1 text-xs font-black text-[#12688a]">
            🏄 {hud.alive}/{hud.total} Ayakta
          </span>
          <span className="rounded-full bg-[#fff3c8] px-3 py-1 text-xs font-black text-[#8a5a00]">
            🌊 Seviye {hud.speedLv}
          </span>
          <span className="hidden rounded-full bg-[#f6f0ff] px-3 py-1 text-xs font-black tabular-nums text-[#5b4678] sm:inline-block">
            ⏱ {fmtSec(hud.ms)}
          </span>
          {hud.wind !== 0 && (
            <span className="rounded-full bg-[#e3f6ff] px-2.5 py-1 text-xs font-black text-[#0f6b8a]">
              💨 {hud.wind > 0 ? 'Akıntı →' : '← Akıntı'}
            </span>
          )}
          {hud.combo >= 2 && (
            <span className="rounded-full bg-[#ffe8d1] px-3 py-1 text-xs font-black text-[#c7640a]">
              🔥 {hud.combo}× Seri
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onExit}
          className="rounded-full bg-[#ffe8e8] px-3.5 py-1 text-xs font-black text-[#b54141] active:scale-95"
        >
          Çık ✖️
        </button>
      </div>

      {/* 60 FPS Okyanus Canvas */}
      <div className="relative flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture?.(e.pointerId)
            setPointer(e)
          }}
          onPointerMove={(e) => {
            if (e.buttons > 0 || e.pointerType === 'touch') setPointer(e)
          }}
          onPointerUp={() => {
            inputRef.current.pointerX = null
          }}
          onPointerCancel={() => {
            inputRef.current.pointerX = null
          }}
          className="block h-full w-full cursor-ew-resize"
        />

        {/* Başlangıç geri sayımı */}
        {hud.countdown > 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[#125d7a]/30 backdrop-blur-[1px]">
            <div className="animate-pop rounded-[2rem] border-2 border-white bg-white/95 px-8 py-5 text-center shadow-toy">
              <p className="text-sm font-black uppercase tracking-wider text-[#1ea8c7]">Dalgalardan Kaç!</p>
              <p className="mt-1 text-6xl font-black text-[#4a3b5c]">{hud.countdown}</p>
              <p className="mt-1 text-xs font-bold text-[#8a7a9c]">
                {touch ? 'Parmağınla sürükle · Zıpla ile dalga aş!' : 'A / D veya ← → ile kay · Boşluk ile zıpla!'}
              </p>
            </div>
          </div>
        )}

        {/* Elendiyse izleyici bandı */}
        {hud.out && (
          <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border-2 border-white bg-[#4a3b5c]/90 px-5 py-2 text-xs font-black text-white shadow-lg">
            🌊 Dalgaya yakalandın! Kazanan bekleniyor…
          </div>
        )}

        {/* Dalga Sıçraması (Ollie) düğmesi */}
        {!hud.out && hud.countdown === 0 && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault()
              inputRef.current.wantJump = true
            }}
            disabled={hud.jumpReady < 1}
            className={`absolute bottom-5 right-5 flex h-16 w-28 flex-col items-center justify-center rounded-3xl border-2 border-white font-black text-white shadow-toy transition active:scale-95 ${
              hud.jumpReady >= 1 ? 'bg-gradient-to-b from-[#ffb85c] to-[#f08b2d]' : 'bg-[#6b8fa3]/75'
            }`}
            style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            <span className="text-lg leading-none">🌊 Zıpla</span>
            <span className="mt-0.5 text-[10px] opacity-90">{hud.jumpReady >= 1 ? (touch ? 'Dokun' : 'Boşluk') : 'Doluyor…'}</span>
          </button>
        )}
      </div>
    </div>
  )
}
