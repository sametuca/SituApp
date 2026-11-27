// Günlük Ortak Görevler: tek başına yapılamayan, biriyle birlikte tamamlanan görevler. Sunucu: server/features/duo.js.
import { useEffect, useState } from 'react'
import { Modal } from '../Hud'

export function useDuo({ net, panel, setPanel }) {
  const { on, send } = net
  const [state, setState] = useState({ list: [], left: 0 })
  const open = panel === 'duo'

  useEffect(() => {
    const offs = [
      on('welcome', (m) => m.duo && setState(m.duo)),
      on('duo', (m) => setState({ list: m.list ?? [], left: m.left ?? 0 })),
      on('duo_done', () => window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'quest' }))),
    ]
    return () => offs.forEach((o) => o())
  }, [on])

  useEffect(() => {
    if (open) send({ t: 'duo_get' })
  }, [open, send])

  const extraButtons = [{ key: 'duo', icon: 'friends', label: 'Ortak görevler', badge: state.left || undefined, onClick: () => setPanel('duo') }]

  const overlays = open ? (
    <Modal onClose={() => setPanel(null)} label="Ortak görevler">
      <h2 className="text-2xl font-black text-[#4a3b5c]">🤝 Ortak görevler</h2>
      <p className="mt-1 text-sm font-bold text-ink-soft">Bunlar tek başına yapılamaz: yanına biri gerekir. Yeni biriyle tanışmak için güzel bir bahane!</p>
      <div className="mt-3 flex flex-col gap-2">
        {state.list.map((q) => (
          <div key={q.id} className={`rounded-2xl p-3 shadow-soft ${q.done ? 'bg-[#e6f7ea]' : 'bg-white'}`}>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{q.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black text-ink">{q.title}</div>
                <div className="text-xs font-semibold text-ink-soft">{q.desc}</div>
              </div>
              <div className="shrink-0 text-right text-xs font-black text-[#8a5a00]">{q.done ? '✅' : `+${q.reward} 🪙`}</div>
            </div>
            {q.done && <div className="mt-1 text-xs font-extrabold text-[#2f7a55]">{q.done} ile tamamlandı</div>}
          </div>
        ))}
        {state.list.length === 0 && <p className="text-sm font-semibold text-ink-soft">Görevler yükleniyor…</p>}
      </div>
      <p className="mt-3 text-[0.6875rem] font-semibold text-ink-soft">Her gün yenilenir. Ödül aynı kişiyle günde en çok 3 kez ve farklı bağlantılardan oynayanlara verilir.</p>
    </Modal>
  ) : null

  return { extraButtons, overlays }
}
