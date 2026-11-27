// Beceri/ifade ikonları: parlak 3D Microsoft Fluent Emoji seti (public/icons/fluent/*.webp) pastel karo içinde.
import { Em } from './emoji'

const BG = {
  '👋': ['#fff3d6', '#ffe2a8'],
  '💃': ['#efe7ff', '#d9c9ff'],
  '❤️': ['#ffe6e3', '#ffcdc7'],
  '🎉': ['#dcf7ee', '#b8ecd9'],
  '😘': ['#ffe9dc', '#ffd2b8'],
  '😍': ['#fff0c9', '#ffe08a'],
  '🥰': ['#ffe6e3', '#ffcdc7'],
  '😂': ['#fff3d6', '#ffe2a8'],
  '😳': ['#e3f1ff', '#c4e1ff'],
  '🔥': ['#ffe9dc', '#ffcfae'],
  '😉': ['#efe7ff', '#d9c9ff'],
  '🥺': ['#e3f1ff', '#c4e1ff'],
}

/** Yuva/palet ikonu. sk: { emoji } ya da doğrudan emoji dizgesi. */
export function SlotIcon({ sk, emoji, size = 40, dim = false }) {
  const e = emoji ?? sk?.emoji ?? '❤️'
  const bg = BG[e] ?? BG['❤️']
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-[30%] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),inset_0_-2px_0_rgba(0,0,0,0.06),0_2px_5px_rgba(74,59,92,0.16)] ${dim ? 'opacity-45 grayscale-[35%]' : ''}`}
      style={{ width: size, height: size, background: `linear-gradient(155deg, ${bg[0]}, ${bg[1]})` }}
    >
      <Em e={e} size={Math.round(size * 0.66)} />
    </span>
  )
}

export default SlotIcon
