// Arayüz (HUD) ikonları: Phosphor Icons (MIT), "fill" ağırlığı (dolgulu, oyuncak gibi), yuvarlak hatlı, her rol için tek pastel-koyu ton.
// Kural: DÜĞME/MENÜ gibi arayüz kromu için <Ico name="..." />; içerik (yiyecek, mekân, tepki, sohbet) emojileri Fluent 3D'de kalır (emoji.jsx).
import {
  ArrowLeft, Armchair, Basket, Bicycle, ChatCircleDots, Coins, GearSix, Heart, House, Moon, PersonSimpleWalk, Question,
  SpeakerHigh, SpeakerSlash, Smiley, Star, Storefront, Sun, SunHorizon, Trophy, Gift, GameController, PaperPlaneTilt, HandGrabbing,
} from '@phosphor-icons/react'

const ICONS = {
  back: [ArrowLeft, '#6b5a80'],
  settings: [GearSix, '#7a5fd0'],
  help: [Question, '#71dedd'],
  friends: [Heart, '#58d8d8'],
  quests: [Star, '#f2a30f'],
  trophy: [Trophy, '#f2a30f'],
  soundOn: [SpeakerHigh, '#4b9fd6'],
  soundOff: [SpeakerSlash, '#9a8cae'],
  collection: [Basket, '#e0873a'],
  bike: [Bicycle, '#4fb9b8'],
  walk: [PersonSimpleWalk, '#6b5a80'],
  coins: [Coins, '#e0a000'],
  smile: [Smiley, '#f2a30f'],
  chat: [ChatCircleDots, '#7a5fd0'],
  sofa: [Armchair, '#60958f'],
  home: [House, '#4fb9b8'],
  shop: [Storefront, '#e0873a'],
  day: [Sun, '#f2a30f'],
  dusk: [SunHorizon, '#ef7d4a'],
  night: [Moon, '#7a5fd0'],
  gift: [Gift, '#4fb9b8'],
  game: [GameController, '#7a5fd0'],
  feedback: [PaperPlaneTilt, '#3fb7b0'],
  hand: [HandGrabbing, '#4a3b5c'],
}

export function Ico({ name, size = 22, weight = 'fill', color, className = '' }) {
  const [Cmp, tone] = ICONS[name] ?? ICONS.help
  return <Cmp size={size} weight={weight} color={color ?? tone} className={className} aria-hidden="true" />
}
export const hasIco = (name) => Boolean(ICONS[name])
