// Beceri çubuğu düzenleyici: alttaki ifade paletinden üstteki 4 yuvaya SÜRÜKLE-BIRAK (dokunmatikte: önce ifadeye, sonra yuvaya dokun).
import { useState } from 'react'
import { ToyButton } from './ui'
import { DEFAULT_SLOTS, REACTIONS, REACTION_LABEL, skillFor } from '../world/interact'
import { SlotIcon } from './SkillIcon'

export default function SkillEditor({ slots, onChange, onClose }) {
  const [picked, setPicked] = useState(null) // dokunma ile seçilen ifade
  const [over, setOver] = useState(null)
  const put = (i, emoji) => {
    if (!emoji || !REACTIONS.includes(emoji)) return
    const next = [...slots]
    const from = next.indexOf(emoji)
    if (from >= 0 && from !== i) next[from] = next[i] // ikisi yer değiştirir (aynı ifade iki yuvada olmaz)
    next[i] = emoji
    onChange(next)
    setPicked(null)
  }
  return (
    <div className="fixed inset-0 z-[55] grid place-items-center bg-[#4a3b5c]/35 p-3 backdrop-blur-[2px]" onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-label="İfadeleri düzenle" onClick={(e) => e.stopPropagation()} className="w-full max-w-md animate-pop rounded-[2rem] border-2 border-white bg-white/95 p-5 shadow-toy">
        <h2 className="text-xl font-black text-[#4a3b5c]">İfadelerini seç</h2>
        <p className="mt-1 text-sm font-semibold text-[#8a7a9c]">Aşağıdan bir ifadeyi sürükleyip yuvaya bırak (telefonda: ifadeye, sonra yuvaya dokun).</p>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {slots.map((emoji, i) => {
            const sk = skillFor(emoji, i)
            return (
              <div
                key={i}
                onDragOver={(e) => (e.preventDefault(), setOver(i))}
                onDragLeave={() => setOver((o) => (o === i ? null : o))}
                onDrop={(e) => {
                  e.preventDefault()
                  setOver(null)
                  put(i, e.dataTransfer.getData('text/plain'))
                }}
                onClick={() => picked && put(i, picked)}
                className={`relative flex h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 transition ${over === i || picked ? 'border-[#a88bff] bg-[#f1eaff]' : 'border-[#ece4fa] bg-[#faf6ff]'}`}
              >
                <span className="absolute left-1.5 top-0.5 text-[0.7rem] font-black text-[#8a7a9c]">{i + 1}</span>
                <SlotIcon sk={sk} size={34} />
                <span className="text-[0.7rem] font-extrabold text-[#5b4a70]">{sk.label}</span>
              </div>
            )
          })}
        </div>

        <p className="mt-4 text-xs font-extrabold uppercase tracking-wide text-[#8a7a9c]">İfadeler</p>
        <div className="mt-2 grid grid-cols-6 gap-2">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', emoji)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onClick={() => setPicked((p) => (p === emoji ? null : emoji))}
              aria-label={REACTION_LABEL[emoji] ?? emoji}
              title={REACTION_LABEL[emoji] ?? emoji}
              className={`grid h-12 w-full cursor-grab place-items-center rounded-2xl border-2 transition active:scale-90 ${picked === emoji ? 'border-[#a88bff] bg-[#f1eaff]' : slots.includes(emoji) ? 'border-[#e1d6f7] bg-[#f6f0ff]' : 'border-transparent bg-[#faf6ff]'}`}
            >
              <SlotIcon emoji={emoji} size={38} />
            </button>
          ))}
        </div>

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => onChange([...DEFAULT_SLOTS])} className="rounded-2xl bg-[#f1eaff] px-4 py-3 text-sm font-extrabold text-[#6b4fc0] active:scale-95">
            Sıfırla
          </button>
          <ToyButton onClick={onClose} className="!py-3 !text-base">
            Tamam
          </ToyButton>
        </div>
      </div>
    </div>
  )
}
