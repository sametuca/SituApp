// Beceri/ifade ikonları: Hugeicons (MIT) yuvarlak çizgi ikonları, her ifade için kendi pastel tonunda yumuşak karo içinde.
// Emoji kullanılmaz (sohbet emojileriyle karışmasın); yuva (SlotIcon) ve düzenleyici paleti aynı bileşeni kullanır.
import { HugeiconsIcon } from '@hugeicons/react'
import {
  FavouriteIcon,
  FireIcon,
  HandHeartIcon,
  HandIcon,
  HandPrayerIcon,
  KissingIcon,
  LaughingIcon,
  MusicNote02Icon,
  PartyPopperIcon,
  SmileDizzyIcon,
  SparklesIcon,
  StarFaceIcon,
} from '@hugeicons/core-free-icons'

// emoji → { icon, bg (karo), fg (çizgi) }
const ART = {
  '👋': { icon: HandIcon, bg: ['#fff3d6', '#ffe2a8'], fg: '#d98a14' },
  '💃': { icon: MusicNote02Icon, bg: ['#efe7ff', '#d9c9ff'], fg: '#6b4fc0' },
  '❤️': { icon: FavouriteIcon, bg: ['#ffe6e3', '#ffcdc7'], fg: '#d93a3f' },
  '🎉': { icon: PartyPopperIcon, bg: ['#dcf7ee', '#b8ecd9'], fg: '#17906f' },
  '😘': { icon: KissingIcon, bg: ['#ffe9dc', '#ffd2b8'], fg: '#d9622b' },
  '😍': { icon: StarFaceIcon, bg: ['#fff0c9', '#ffe08a'], fg: '#c98a00' },
  '🥰': { icon: HandHeartIcon, bg: ['#ffe6e3', '#ffcdc7'], fg: '#d93a3f' },
  '😂': { icon: LaughingIcon, bg: ['#fff3d6', '#ffe2a8'], fg: '#d98a14' },
  '😳': { icon: SmileDizzyIcon, bg: ['#e3f1ff', '#c4e1ff'], fg: '#2f7fc8' },
  '🔥': { icon: FireIcon, bg: ['#ffe9dc', '#ffcfae'], fg: '#e0561b' },
  '😉': { icon: SparklesIcon, bg: ['#efe7ff', '#d9c9ff'], fg: '#6b4fc0' },
  '🥺': { icon: HandPrayerIcon, bg: ['#e3f1ff', '#c4e1ff'], fg: '#2f7fc8' },
}

/** Yuva/palet ikonu. sk: { emoji } ya da doğrudan emoji dizgesi. */
export function SlotIcon({ sk, emoji, size = 40, dim = false }) {
  const e = emoji ?? sk?.emoji
  const a = ART[e] ?? ART['❤️']
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-[30%] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),inset_0_-2px_0_rgba(0,0,0,0.06),0_2px_5px_rgba(74,59,92,0.16)] ${dim ? 'opacity-45 grayscale-[35%]' : ''}`}
      style={{ width: size, height: size, background: `linear-gradient(155deg, ${a.bg[0]}, ${a.bg[1]})` }}
    >
      <HugeiconsIcon icon={a.icon} size={Math.round(size * 0.58)} color={a.fg} strokeWidth={1.7} />
    </span>
  )
}

export default SlotIcon
