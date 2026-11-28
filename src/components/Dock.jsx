// Alt orta HUD yığını: yakın oyuncu kartı, kapı/etkileşim istemleri, fotoğraf/oturma istemleri, davet kartları vb. aynı kapta ALT ALTA akar,
// asla üst üste binmez. Kart bileşenleri kök öğesini <Dock> içine sarar (kök: relative, pointer-events-auto; konum sınıfı YOK).
// <DockSlot/> World.jsx'te beceri çubuğunun hemen üstünde bir kez çizilir; en yeni kart en altta (beceri çubuğuna en yakın) görünür.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export function DockSlot({ hidden = false }) {
  return (
    <div
      id="hud-dock"
      className="pointer-events-none absolute inset-x-0 bottom-[5.8rem] z-20 flex flex-col-reverse items-center gap-1.5 px-3 sm:bottom-[9.75rem] sm:gap-2 max-sm:[&>*]:origin-bottom max-sm:[&>*]:scale-[0.88]"
      style={hidden ? { visibility: 'hidden' } : undefined}
    />
  )
}

export function Dock({ children }) {
  const [el, setEl] = useState(() => (typeof document === 'undefined' ? null : document.getElementById('hud-dock')))
  useEffect(() => {
    if (!el) setEl(document.getElementById('hud-dock'))
  }, [el])
  return el ? createPortal(children, el) : null
}

// ---- Üst orta HUD yığını: bölge başlığı, etkinlik/davet bannerları, bekleme kartları, ipuçları vb. yukarıdan aşağı SIRALI akar ----
// Yığın tıklamaları geçirir; etkileşimli kartların kendi köküne pointer-events-auto ekle.
export function TopDockSlot({ touch = false, hidden = false }) {
  return (
    <div
      id="hud-top"
      className={`pointer-events-none absolute inset-x-0 z-30 flex flex-col items-center gap-1 px-14 sm:gap-2 sm:px-3 max-sm:[&>*]:origin-top max-sm:[&>*]:scale-[0.85] ${touch ? 'top-[max(0.625rem,env(safe-area-inset-top))] sm:top-[calc(max(0.5rem,env(safe-area-inset-top))+4.1rem)]' : 'top-2.5 sm:top-[4.6rem]'}`}
      style={hidden ? { visibility: 'hidden' } : undefined}
    />
  )
}

export function TopDock({ children }) {
  const [el, setEl] = useState(() => (typeof document === 'undefined' ? null : document.getElementById('hud-top')))
  useEffect(() => {
    if (!el) setEl(document.getElementById('hud-top'))
  }, [el])
  return el ? createPortal(children, el) : null
}
