// Arayüz (HUD & kartlar) ikonları: tutarlı Phosphor duotone vektör ikon seti (@phosphor-icons/react).
import {
  AirplaneTilt,
  Armchair,
  ArrowLeft,
  Barbell,
  Basket,
  Bicycle,
  BookOpen,
  Cake,
  Camera,
  ChatCircleDots,
  CoatHanger,
  Coffee,
  Coins,
  Compass,
  DiscoBall,
  EnvelopeSimple,
  FilmSlate,
  FishSimple,
  Flower,
  FlowerLotus,
  GameController,
  GearSix,
  Gift,
  HandWaving,
  Headphones,
  Heart,
  House,
  InstagramLogo,
  LockSimple,
  MapPin,
  MapTrifold,
  MicrophoneStage,
  Moon,
  MoonStars,
  MusicNotes,
  Package,
  Palette,
  PawPrint,
  PersonSimpleWalk,
  Pizza,
  PuzzlePiece,
  Question,
  ShoppingBag,
  Smiley,
  Snowflake,
  Sparkle,
  SpeakerHigh,
  SpeakerSlash,
  Star,
  Sun,
  SunHorizon,
  Sword,
  Tree,
  Trophy,
  Umbrella,
  UserCircle,
  Wine,
  XLogo,
} from '@phosphor-icons/react'

const ICONS = {
  back: [ArrowLeft, '#5b4678'],
  settings: [GearSix, '#6b558e'],
  help: [Question, '#6b558e'],
  friends: [Heart, '#e86a92'],
  quests: [Star, '#e8952c'],
  trophy: [Trophy, '#d98a1c'],
  pvp: [Sword, '#7c5cc4'],
  soundOn: [SpeakerHigh, '#5b4678'],
  soundOff: [SpeakerSlash, '#9b8bb0'],
  collection: [Basket, '#d98a1c'],
  bike: [Bicycle, '#4c94c8'],
  walk: [PersonSimpleWalk, '#5b4678'],
  coins: [Coins, '#d98a1c'],
  smile: [Smiley, '#e8952c'],
  chat: [ChatCircleDots, '#6b4fc0'],
  sofa: [Armchair, '#a66b46'],
  home: [House, '#e07a5f'],
  shop: [ShoppingBag, '#e86a92'],
  day: [Sun, '#e8952c'],
  dusk: [SunHorizon, '#e07a5f'],
  night: [Moon, '#6b4fc0'],
  gift: [Gift, '#e86a92'],
  game: [GameController, '#7c5cc4'],
  feedback: [EnvelopeSimple, '#4c94c8'],
  hand: [HandWaving, '#e8952c'],
  wardrobe: [CoatHanger, '#7c5cc4'],
  map: [MapTrifold, '#4c94c8'],
  compass: [Compass, '#4c94c8'],
  sparkles: [Sparkle, '#d98a1c'],
  cake: [Cake, '#e86a92'],
  pin: [MapPin, '#e07a5f'],
  instagram: [InstagramLogo, '#c85086'],
  x: [XLogo, '#4a3b5c'],
  lock: [LockSimple, '#8a7a9c'],
  ice: [Snowflake, '#2b7ea3'],
  afk: [MoonStars, '#7c5cc4'],
  flower: [Flower, '#e86a92'],
  user: [UserCircle, '#6b4fc0'],
  fish: [FishSimple, '#3898c8'],
  parcel: [Package, '#d98a1c'],
}

const TAG_ICONS = {
  kahve: [Coffee, '#9c6644'],
  muzik: [MusicNotes, '#7c5cc4'],
  kitap: [BookOpen, '#4c86b8'],
  film: [FilmSlate, '#6b4fc0'],
  plaj: [Umbrella, '#e8952c'],
  doga: [Tree, '#4b9e6c'],
  oyun: [GameController, '#7c5cc4'],
  dans: [DiscoBall, '#e86a92'],
  yemek: [Pizza, '#e07a5f'],
  seyahat: [AirplaneTilt, '#4c94c8'],
  hayvanlar: [PawPrint, '#b07a44'],
  sanat: [Palette, '#d96b96'],
  spor: [Barbell, '#5b4678'],
  karaoke: [MicrophoneStage, '#c85086'],
  fotograf: [Camera, '#5b4678'],
  yoga: [FlowerLotus, '#4b9e6c'],
  gece: [Wine, '#8b4b7a'],
  'gece hayati': [Wine, '#8b4b7a'],
  gecekusu: [MoonStars, '#5e4b96'],
  'gece kusu': [MoonStars, '#5e4b96'],
  erken: [Sun, '#e8952c'],
  'erken kalkan': [Sun, '#e8952c'],
  tatli: [Cake, '#e86a92'],
  podcast: [Headphones, '#6b4fc0'],
  bulmaca: [PuzzlePiece, '#4c94c8'],
  bisiklet: [Bicycle, '#4c94c8'],
  bahce: [Flower, '#e86a92'],
}

const norm = (s) =>
  String(s ?? '')
    .replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/gu, '')
    .trim()
    .toLowerCase()
    .replaceAll('ı', 'i')
    .replaceAll('ş', 's')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')

export const cleanLabel = (s) => String(s ?? '').replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/gu, '').trim()

export function Ico({ name, size = 22, className = '', color, weight = 'duotone' }) {
  const [Comp, defColor] = ICONS[name] ?? ICONS.help
  return <Comp size={size} weight={weight} color={color ?? defColor} className={`inline-block shrink-0 ${className}`} aria-hidden />
}

export function TagIcon({ id, label, size = 14, className = '' }) {
  const entry = TAG_ICONS[id] ?? TAG_ICONS[norm(label ?? id)] ?? [Sparkle, '#7c5cc4']
  const [Comp, color] = entry
  return <Comp size={size} weight="duotone" color={color} className={`inline-block shrink-0 ${className}`} aria-hidden />
}

export const hasIco = (name) => Boolean(ICONS[name])
