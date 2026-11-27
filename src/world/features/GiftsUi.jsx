// Hediye seçici, gelen hediye teklifi kartı, ev dekoru ve hediye yerleştirme sekmeleri.
import { TopDock } from '../../components/Dock'
import { ToyButton } from '../../components/ui'
import { Modal } from '../Hud'
import { FLOORS, GIFTS, GIFT_BY_ID, GIFT_RANGE, WALL_COLORS, WALL_PATTERNS } from '../cosmeticsData'
import { Pills, Swatches, chip } from './cosmeticsShared'
// ---------- hediye ----------
export function GiftPicker({ peer, onPick, onClose }) {
  return (
    <Modal onClose={onClose} label="Hediye gönder">
      <h2 className="text-xl font-black text-[#4a3b5c]">🎁 {peer.name} için hediye seç</h2>
      <p className="mt-1 text-xs font-semibold text-[#8a7a9c]">En fazla {GIFT_RANGE} m yakınında olmalısın. {peer.name} kabul ederse hediye onun envanterine düşer ve evine yerleştirebilir.</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {GIFTS.map((g) => (
          <button key={g.id} onClick={() => onPick(g.id)} className="flex flex-col items-center gap-1 rounded-3xl border-2 border-white bg-[#fff8f0] p-3 shadow-soft transition hover:bg-[#fff2e3] active:scale-95">
            <span className="text-5xl" aria-hidden>
              {g.emoji}
            </span>
            <span className="text-sm font-black text-[#4a3b5c]">{g.name}</span>
          </button>
        ))}
      </div>
      <button onClick={onClose} className="mt-3 w-full rounded-2xl py-2 text-sm font-extrabold text-[#8a7a9c] hover:bg-[#ffedd6]/60">
        Vazgeç
      </button>
    </Modal>
  )
}

export function OfferCard({ offer, onAccept, onDecline }) {
  const g = GIFT_BY_ID[offer.kind]
  return (
    <TopDock><div className={`pointer-events-auto relative w-[min(92vw,22rem)] animate-pop rounded-3xl bg-white/80 p-3 backdrop-blur-md ${chip}`} role="alert">
      <div className="flex items-center gap-3">
        <span className="text-3xl" aria-hidden>
          {g?.emoji ?? '🎁'}
        </span>
        <p className="min-w-0 flex-1 text-sm font-black text-[#4a3b5c]">
          {offer.fromName} sana {g?.name ?? 'bir hediye'} göndermek istiyor!
        </p>
      </div>
      <div className="mt-2.5 flex gap-2">
        <button onClick={onDecline} className="rounded-2xl bg-[#f6f0ff] px-4 py-2.5 text-sm font-extrabold text-[#8a7a9c] active:scale-95">
          Vazgeç
        </button>
        <ToyButton className="!rounded-2xl !py-2.5 !text-sm" onClick={onAccept}>
          🎁 Kabul et
        </ToyButton>
      </div>
    </div></TopDock>
  )
}

export function DecorTab({ decor, onChange }) {
  return (
    <div className="flex max-h-[38svh] flex-col gap-1 overflow-y-auto pb-1">
      <Swatches label="Duvar" options={WALL_COLORS} value={decor.wall} onPick={(wall) => onChange({ wall })} />
      <Pills label="Desen" options={WALL_PATTERNS} value={decor.pattern} onPick={(pattern) => onChange({ pattern })} />
      <Pills label="Zemin" options={FLOORS} value={decor.floor} onPick={(floor) => onChange({ floor })} />
      <button
        role="switch"
        aria-checked={decor.romantic}
        onClick={() => onChange({ romantic: !decor.romantic })}
        className={`mt-1 flex items-center justify-center gap-2 rounded-2xl border-2 border-white px-4 py-2.5 text-sm font-extrabold transition active:scale-[0.98] ${decor.romantic ? 'bg-gradient-to-r from-[#fec071] to-[#bba0ff] text-white shadow-soft' : 'bg-white/80 text-[#4a3b5c]'}`}
      >
        💗 Romantik ışık modu {decor.romantic ? '· açık' : '· kapalı'}
      </button>
    </div>
  )
}

export function GiftsTab({ gifts, furn, place }) {
  if (!gifts.length) {
    return <p className="rounded-2xl bg-white/70 px-3 py-4 text-center text-xs font-bold text-[#8a7a9c]">Henüz hediyen yok. Biri sana hediye gönderip sen kabul edince burada görünür 🎁</p>
  }
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {gifts.map((g) => {
        const def = GIFT_BY_ID[g.kind]
        const placed = furn.some((i) => i.uid === g.uid)
        return (
          <button
            key={g.uid}
            disabled={placed}
            onClick={() => place(g.kind, { uid: g.uid, from: g.from })}
            className="flex w-24 shrink-0 flex-col items-center gap-0.5 rounded-2xl border-2 border-white bg-white/70 p-2 transition hover:bg-white active:scale-95 disabled:opacity-50"
          >
            <span className="text-3xl" aria-hidden>
              {def?.emoji}
            </span>
            <span className="w-full truncate text-center text-[0.6875rem] font-extrabold text-[#4a3b5c]">{def?.name}</span>
            <span className="w-full truncate text-center text-[0.625rem] font-bold text-[#8a7a9c]">{placed ? 'Odada ✓' : `${g.from} 💝`}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Kişiselleştirme: gardırop paneli (panel === 'wardrobe'), evcil hayvan katmanı, ev dekoru ve hediyeleşme.
 * Döndürür: peerActions, settingsSections, overlays + (özel) homeDecor, editorTabs, sceneNodes.
 */
