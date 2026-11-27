// Saç / göz / kıyafet rengi seçici (karakter seçimi ve gardırop). value = { h, e, o } palet indeksleri (-1 = orijinal).
import { EYE_COLORS, EYE_LEVELS, EYE_NAMES, HAIR_COLORS, HAIR_LEVELS, HAIR_NAMES, OUTFIT_COLORS, OUTFIT_LEVELS, OUTFIT_NAMES } from '../world/lookData'
import { Em } from './emoji'

const ROWS = [
  { key: 'h', label: 'Saç', colors: HAIR_COLORS, names: HAIR_NAMES, levels: HAIR_LEVELS },
  { key: 'e', label: 'Göz', colors: EYE_COLORS, names: EYE_NAMES, levels: EYE_LEVELS },
  { key: 'o', label: 'Kıyafet', colors: OUTFIT_COLORS, names: OUTFIT_NAMES, levels: OUTFIT_LEVELS },
]

export default function LookPicker({ value, onChange, compact = false, playerLv = Infinity, onLocked }) {
  const sz = compact ? 'h-7 w-7' : 'h-8 w-8'
  return (
    <div className="flex flex-col gap-3">
      {ROWS.map((r) => {
        const curIdx = value?.[r.key] ?? -1
        const curName = curIdx >= 0 ? r.names[curIdx] : 'Orijinal'
        return (
          <div key={r.key} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-xs font-black uppercase tracking-wide text-ink-soft">{r.label}</span>
              <span className="rounded-full bg-[#f6f0ff] px-2 py-0.5 text-[0.6875rem] font-extrabold text-[#6b4fc0]">{curName}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                title="Orijinal"
                aria-label={`${r.label}: orijinal`}
                onClick={() => onChange({ ...value, [r.key]: -1 })}
                className={`grid ${sz} place-items-center rounded-full border-2 bg-white text-xs font-black text-ink-soft transition active:scale-90 ${curIdx === -1 ? 'scale-105 border-ink' : 'border-white shadow-soft'}`}
              >
                <Em e="🎨" size={16} />
              </button>
              {r.colors.map((c, i) => {
                const reqLv = r.levels[i] ?? 1
                const locked = reqLv > playerLv
                return (
                  <button
                    key={c}
                    type="button"
                    title={locked ? `${r.names[i]} (Seviye ${reqLv})` : r.names[i]}
                    aria-label={`${r.label}: ${r.names[i]}${locked ? ` (Seviye ${reqLv})` : ''}`}
                    onClick={() => (locked ? onLocked?.(reqLv) : onChange({ ...value, [r.key]: i }))}
                    style={{ background: c }}
                    className={`relative ${sz} rounded-full border-2 transition ${locked ? 'cursor-not-allowed opacity-45' : 'active:scale-90 hover:scale-105'} ${curIdx === i ? 'scale-110 border-ink ring-2 ring-[#a88bff]/40' : 'border-white shadow-soft'}`}
                  >
                    {locked && <span className="absolute inset-0 grid place-items-center text-[0.625rem] drop-shadow">🔒</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
