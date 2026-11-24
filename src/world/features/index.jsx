// Özellik modülleri (istemci). Her modül bir hook'tur: useX(ctx) → { peerActions?(peer), settingsSections?, overlays? }
//   peerActions(peer): etkileşim menüsüne eklenecek düğmeler  [{ key, emoji, label, onClick, danger? }]
//   peerHeader(peer):  etkileşim menüsünde kişinin altına çizilecek JSX (mini profil vb.)
//   settingsSections:  Ayarlar paneline eklenecek JSX parçaları
//   overlays:          ekranın üstüne çizilecek JSX (diyaloglar, bildirimler…)
//   extraButtons:      üst çubuğa düğmeler [{ key, emoji, label, onClick, badge? }] (sol sütun)
//   extraNodes:        üst çubuğun sağ grubuna hazır JSX düğmeler
//   readAt:            { oyuncuId: ts } DM okundu bilgisi
//   worldEffects:      <Canvas> içine çizilecek R3F düğümleri (sezon efektleri…)
// ctx: { net, say, touch, openChat, closeInteract, roster, focusRef, home, venue (mekân kimliği | null), panel, setPanel, chatTarget, pushFeed, slug }
// Ek dönüş alanları: homeDecor (HomeRoom'a), editorTabs (Döşe çekmecesine sekme), sceneNodes (Canvas içine R3F düğümleri: evcil hayvan).
// Yeni özellik: src/world/features/<ad>.jsx yaz, aşağıya bir satır ekle (kuralı bozma: hook sırası sabit olmalı).
import { Modal } from '../Hud'
import { useModeration } from './moderation'
import { useGames } from './games'
import { useFriends } from './friends'
import { useProfile } from './profile'
import { useProgress } from './progress'
import { useMedia } from './media'
import { useTogether } from './together'
import { useCosmetics } from './cosmetics'
import { useNpcs } from './npcs'
import { useAudio } from './audio'
import { useSky } from './sky'
import { useVenues } from './venues'

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
  const parts = [useModeration(ctx), useGames(ctx), useFriends(ctx), useProfile(ctx), useProgress(ctx), useMedia(ctx), useTogether(ctx), useCosmetics(ctx), useNpcs(ctx), useAudio(ctx), useSky(ctx), useVenues(ctx)]

  const peerActions = (peer) => parts.flatMap((p) => p.peerActions?.(peer) ?? [])
  const peerHeader = (peer) => parts.map((p, i) => (p.peerHeader ? <div key={i}>{p.peerHeader(peer)}</div> : null))
  const settingsSections = parts.flatMap((p) => p.settingsSections ?? [])
  const extraButtons = parts.flatMap((p) => p.extraButtons ?? []) // üst çubuk düğmeleri [{ key, emoji, label, onClick, badge? }]
  const worldEffects = parts.map((p, i) => (p.worldEffects ? <group key={i}>{p.worldEffects}</group> : null)) // Canvas içine
  const overlays = (
    <>
      {ctx.panel === 'settings' && <SettingsPanel sections={settingsSections} onClose={() => ctx.setPanel(null)} />}
      {parts.map((p, i) => (p.overlays ? <div key={i}>{p.overlays}</div> : null))}
    </>
  )
  // hazır JSX üst çubuk düğmeleri ve DM'de karşı tarafın okuma zamanları (id → ts)
  const extraNodes = parts.map((p, i) => (p.extraNodes ? <span key={i} className="contents">{p.extraNodes}</span> : null))
  const readAt = Object.assign({}, ...parts.map((p) => p.readAt))
  // kişiselleştirme: ev dekoru, döşeme sekmeleri, evcil hayvan katmanı
  const homeDecor = parts.find((p) => p.homeDecor)?.homeDecor
  const editorTabs = parts.flatMap((p) => p.editorTabs ?? [])
  const sceneNodes = parts.map((p, i) => (p.sceneNodes ? <group key={i}>{p.sceneNodes}</group> : null))
  return { peerActions, peerHeader, overlays, extraButtons, extraNodes, readAt, worldEffects, homeDecor, editorTabs, sceneNodes }
}
