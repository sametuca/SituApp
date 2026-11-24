// Saç / göz / kıyafet rengi seçici (karakter seçimi ve gardırop). value = { h, e, o } palet indeksleri (-1 = orijinal).
import { EYE_COLORS, EYE_NAMES, HAIR_COLORS, HAIR_NAMES, OUTFIT_COLORS, OUTFIT_NAMES } from '../world/lookData'

const ROWS = [
  { key: 'h', label: 'Saç', colors: HAIR_COLORS, names: HAIR_NAMES },
  { key: 'e', label: 'Göz', colors: EYE_COLORS, names: EYE_NAMES },
  { key: 'o', label: 'Kıyafet', colors: OUTFIT_COLORS, names: OUTFIT_NAMES },
]

export default function LookPicker({ value, onChange }) {
  return (
    <div className="flex flex-col gap-2.5">
      {ROWS.map((r) => (
        <div key={r.key} className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-xs font-extrabold uppercase tracking-wide text-ink-soft">{r.label}</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              title="Orijinal"
              aria-label={`${r.label}: orijinal`}
              onClick={() => onChange({ ...value, [r.key]: -1 })}
              className={`grid h-8 w-8 place-items-center rounded-full border-2 bg-white text-xs font-black text-ink-soft ${value[r.key] === -1 ? 'border-ink' : 'border-white shadow-soft'}`}
            >
              ↺
            </button>
            {r.colors.map((c, i) => (
              <button
                key={c}
                type="button"
                title={r.names[i]}
                aria-label={`${r.label}: ${r.names[i]}`}
                onClick={() => onChange({ ...value, [r.key]: i })}
                style={{ background: c }}
                className={`h-8 w-8 rounded-full border-2 transition active:scale-90 ${value[r.key] === i ? 'scale-110 border-ink' : 'border-white shadow-soft'}`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
