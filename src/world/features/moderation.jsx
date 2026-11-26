import { useState } from 'react'
import { Modal } from '../Hud'

const REASONS = [
  ['taciz', '😡 Taciz / rahatsız edici'],
  ['uygunsuz', '🔞 Uygunsuz içerik'],
  ['spam', '📢 Spam / reklam'],
  ['sahte', '🎭 Sahte profil / dolandırıcılık'],
  ['foto', '📷 Profil fotoğrafı'],
  ['diger', '❔ Diğer'],
]

function ReportDialog({ peer, onPick, onClose }) {
  return (
    <Modal onClose={onClose} label="Şikâyet">
      <h2 className="text-xl font-black text-[#4a3b5c]">⚠️ {peer.name} kişisini şikâyet et</h2>
      <p className="mt-1 text-sm font-semibold text-[#8a7a9c]">Son mesajları da moderatöre iletilir. Dilersen ayrıca engelleyebilirsin.</p>
      <div className="mt-4 flex flex-col gap-2">
        {REASONS.map(([k, label]) => (
          <button key={k} onClick={() => onPick(k)} className="rounded-2xl border-2 border-white bg-[#fff2e3]/80 px-4 py-3 text-left text-sm font-extrabold text-[#4a3b5c] active:scale-[0.98] hover:bg-[#ffead0]">
            {label}
          </button>
        ))}
      </div>
      <button onClick={onClose} className="mt-3 w-full rounded-2xl py-2 text-sm font-extrabold text-[#8a7a9c] hover:bg-[#ffedd6]/60">
        Vazgeç
      </button>
    </Modal>
  )
}

/** Güvenlik: kişi başına Engelle/Şikâyet düğmeleri + ayarlarda Rahatsız etme ve engel listesi. */
export function useModeration({ net, closeInteract }) {
  const [reporting, setReporting] = useState(null)

  const peerActions = (peer) => [
    { key: 'report', emoji: '⚠️', label: 'Şikâyet', onClick: () => setReporting(peer) },
    {
      key: 'block',
      emoji: '🚫',
      label: 'Engelle',
      danger: true,
      onClick: () => {
        net.block(peer.id)
        closeInteract()
      },
    },
  ]

  const settingsSections = [
    <section key="dnd" className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-[#4a3b5c]">Rahatsız etme</p>
        <p className="text-xs font-semibold text-[#8a7a9c]">Açıkken fısıltı, jest, özel mesaj ve davet alamazsın. Herkese açık sohbeti görmeye devam edersin.</p>
      </div>
      <button
        role="switch"
        aria-checked={net.dnd}
        onClick={() => net.setDnd(!net.dnd)}
        className={`relative h-8 w-14 shrink-0 rounded-full border-2 border-white transition ${net.dnd ? 'bg-[#a88bff]' : 'bg-[#d9d0e6]'}`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${net.dnd ? 'left-7' : 'left-0.5'}`} />
      </button>
    </section>,
    <section key="blocked">
      <p className="text-sm font-black text-[#4a3b5c]">Engellediklerim</p>
      {net.blocked.length === 0 ? (
        <p className="mt-1 text-xs font-semibold text-[#8a7a9c]">Kimseyi engellemedin.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {net.blocked.map((b) => (
            <li key={b.key} className="flex items-center gap-2 rounded-2xl bg-[#f6f0ff] px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-[#4a3b5c]">{b.name}</span>
              <button onClick={() => net.unblock(b.key)} className="rounded-xl bg-white px-3 py-1 text-xs font-extrabold text-[#a88bff] shadow-soft active:scale-95">
                Kaldır
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>,
  ]

  const overlays = reporting ? (
    <ReportDialog
      peer={reporting}
      onClose={() => setReporting(null)}
      onPick={(reason) => {
        net.report(reporting.id, reason)
        setReporting(null)
      }}
    />
  ) : null

  return { peerActions, settingsSections, overlays }
}
