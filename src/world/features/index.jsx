// Özellik modülleri (istemci). Her modül bir hook'tur: useX(ctx) → { peerActions?(peer), settingsSections?, overlays? }
//   peerActions(peer): etkileşim menüsüne eklenecek düğmeler  [{ key, emoji, label, onClick, danger? }]
//   settingsSections:  Ayarlar paneline eklenecek JSX parçaları
//   overlays:          ekranın üstüne çizilecek JSX (diyaloglar, bildirimler…)
// ctx: { net, say, touch, openChat, closeInteract, roster, focusRef, home, panel, setPanel }
// Yeni özellik: src/world/features/<ad>.jsx yaz, aşağıya bir satır ekle (kuralı bozma: hook sırası sabit olmalı).
import { Modal } from '../Hud'
import { useModeration } from './moderation'

function SettingsPanel({ sections, onClose }) {
  return (
    <Modal onClose={onClose} label="Ayarlar">
      <h2 className="text-2xl font-black text-[#4a3b5c]">Ayarlar ⚙️</h2>
      <div className="mt-4 flex flex-col gap-5">{sections}</div>
      <button onClick={onClose} className="mt-5 w-full rounded-2xl border-b-4 border-[#e85a98] bg-[#ff7eb3] py-3 text-base font-extrabold text-white active:translate-y-[3px] active:border-b-[1px]">
        Tamam
      </button>
    </Modal>
  )
}

export function useFeatures(ctx) {
  const parts = [useModeration(ctx)]

  const peerActions = (peer) => parts.flatMap((p) => p.peerActions?.(peer) ?? [])
  const settingsSections = parts.flatMap((p) => p.settingsSections ?? [])
  const overlays = (
    <>
      {ctx.panel === 'settings' && <SettingsPanel sections={settingsSections} onClose={() => ctx.setPanel(null)} />}
      {parts.map((p, i) => (p.overlays ? <div key={i}>{p.overlays}</div> : null))}
    </>
  )
  return { peerActions, overlays }
}
