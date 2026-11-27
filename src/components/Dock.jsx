// Alt orta HUD yığını: yakın oyuncu kartı, kapı/etkileşim istemleri, fotoğraf/oturma istemleri, davet kartları vb. aynı kapta ALT ALTA akar,
// asla üst üste binmez. Kart bileşenleri kök öğesini <Dock> içine sarar (kök: relative, pointer-events-auto; konum sınıfı YOK).
// <DockSlot/> World.jsx'te beceri çubuğunun hemen üstünde bir kez çizilir; en yeni kart en altta (beceri çubuğuna en yakın) görünür.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export function DockSlot() {
  return (
    <div
      id="hud-dock"
      className="pointer-events-none absolute inset-x-0 bottom-[5.8rem] z-20 flex flex-col-reverse items-center gap-1.5 px-3 sm:bottom-[9.75rem] sm:gap-2 max-sm:[&>*]:origin-bottom max-sm:[&>*]:scale-[0.88]"
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
export function TopDockSlot() {
  return (
    <div
      id="hud-top"
      className="pointer-events-none absolute inset-x-0 top-2.5 z-30 flex flex-col items-center gap-1 px-14 sm:top-[4.6rem] sm:gap-2 sm:px-3 max-sm:[&>*]:origin-top max-sm:[&>*]:scale-[0.85]"
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
