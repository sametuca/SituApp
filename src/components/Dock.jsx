// Alt orta HUD yığını: yakın oyuncu kartı, kapı/etkileşim istemleri, fotoğraf/oturma istemleri, davet kartları vb. aynı kapta ALT ALTA akar,
// asla üst üste binmez. Kart bileşenleri kök öğesini <Dock> içine sarar (kök: relative, pointer-events-auto; konum sınıfı YOK).
// <DockSlot/> World.jsx'te beceri çubuğunun hemen üstünde bir kez çizilir; en yeni kart en altta (beceri çubuğuna en yakın) görünür.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export function DockSlot() {
  return <div id="hud-dock" className="pointer-events-none absolute inset-x-0 bottom-[9.75rem] z-20 flex flex-col-reverse items-center gap-2 px-3" />
}

export function Dock({ children }) {
  const [el, setEl] = useState(() => (typeof document === 'undefined' ? null : document.getElementById('hud-dock')))
  useEffect(() => {
    if (!el) setEl(document.getElementById('hud-dock'))
  }, [el])
  return el ? createPortal(children, el) : null
}

// ---- Üst orta HUD yığını: bölge başlığı, etkinlik/davet bannerları, bekleme kartları, ipuçları vb. yukarıdan aşağı SIRALI akar ----
export function TopDockSlot() {
  return <div id="hud-top" className="pointer-events-none absolute inset-x-0 top-[4.6rem] z-30 flex flex-col items-center gap-2 px-3" />
}

export function TopDock({ children }) {
  const [el, setEl] = useState(() => (typeof document === 'undefined' ? null : document.getElementById('hud-top')))
  useEffect(() => {
    if (!el) setEl(document.getElementById('hud-top'))
  }, [el])
  return el ? createPortal(children, el) : null
}
