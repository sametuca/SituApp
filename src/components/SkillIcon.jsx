// Beceri çubuğu ikonları: emoji yerine renkli, yumuşak degrade "sticker" karo içinde beyaz Phosphor glifi (özgün, emoji setinden ayrı görünüm).
import { Confetti, HandWaving, Heart, MusicNotes } from '@phosphor-icons/react'

const SKILL_ART = {
  wave: { Glyph: HandWaving, from: '#ffd36b', to: '#f59a23' },
  dance: { Glyph: MusicNotes, from: '#b79cff', to: '#7a5fd0' },
  heart: { Glyph: Heart, from: '#ff9a8a', to: '#e5484d' },
  party: { Glyph: Confetti, from: '#7fe3c8', to: '#26a58a' },
}

export default function SkillIcon({ id, size = 40, dim = false }) {
  const a = SKILL_ART[id]
  if (!a) return null
  const { Glyph } = a
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-[28%] shadow-[inset_0_-3px_0_rgba(0,0,0,0.14),0_2px_4px_rgba(74,59,92,0.18)] ${dim ? 'opacity-45 grayscale-[35%]' : ''}`}
      style={{ width: size, height: size, background: `linear-gradient(150deg, ${a.from}, ${a.to})` }}
    >
      <Glyph size={size * 0.62} weight="fill" color="#ffffff" style={{ filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.18))' }} />
    </span>
  )
}
