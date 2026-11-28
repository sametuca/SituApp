// Sosyal arayüz birleştirici: beceri çubuğu, kapı istemi, tepki çubuğu; diğer parçalar alt dosyalardan yeniden dışa aktarılır.
import { useEffect, useState } from 'react'
import { Em } from '../components/emoji'
import { SlotIcon } from '../components/SkillIcon'
import { Dock } from '../components/Dock'
import { Ico } from '../components/Icon'
import { ToyButton } from '../components/ui'
import { REACTIONS, SKILL_COOLDOWN_MS, SKILLS } from './interact'
import { levelOf } from './collectibles'
import { glass } from './socialShared'
// ---------- kapı ("Eve gir" / "Dışarı çık" / etkileşim istemi — SkillBar'ın hemen üstünde) ----------
export function DoorPrompt({ emoji, label, action, touch, raised, onGo }) {
  return (
    <Dock><div className="pointer-events-auto relative w-[min(92vw,21rem)] animate-pop" role="status">
      <div className={`flex items-center gap-3 rounded-3xl p-2.5 pl-4 ${glass}`}>
        {emoji && (
          <span className="text-2xl" aria-hidden>
            {emoji}
          </span>
        )}
        <p className="min-w-0 flex-1 truncate text-sm font-black text-[#4a3b5c]">{label}</p>
        <div className="w-28 shrink-0">
          <ToyButton className="!rounded-xl !py-2 !text-sm" onClick={onGo}>
            {action}
          </ToyButton>
        </div>
      </div>
    </div></Dock>
  )
}

// ---------- emoji tepki çubuğu ----------
export function ReactionBar({ onReact, touch }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="absolute z-10"
      style={touch ? { right: 'calc(max(0.85rem, env(safe-area-inset-right)) + 4rem)', bottom: 'max(1rem, env(safe-area-inset-bottom))' } : { right: '0.75rem', bottom: '4rem' }}
    >
      {open && (
        <div className={`absolute bottom-full right-0 mb-2 grid w-max animate-pop grid-cols-4 gap-1.5 rounded-3xl p-2 ${glass}`} role="menu" aria-label="Emoji tepkileri">
          {REACTIONS.map((e, i) => (
            <button
              key={e}
              role="menuitem"
              onClick={() => {
                onReact(e)
                setOpen(false)
              }}
              className="relative grid h-12 w-12 place-items-center rounded-2xl text-2xl transition hover:bg-[#ffedd6]/70 active:scale-90"
            >
              {e}
              {!touch && i < 10 && <span className="absolute bottom-0 right-1 text-[10px] font-black text-[#8a7a9c]">{(i + 1) % 10}</span>}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Emoji tepkisi gönder"
        aria-expanded={open}
        className={`grid ${touch ? 'h-14 w-14 text-2xl' : 'h-14 w-14 text-2xl'} place-items-center rounded-full transition hover:bg-white active:scale-95 ${glass}`}
      >
        <Ico name="smile" size={touch ? 30 : 32} />
      </button>
    </div>
  )
}

// ---------- alt beceri ve EXP çubuğu (Skill 1-4 · 5 sn bekleme) ----------
export function SkillBar({ xp = 0, cooldowns, onSkill, onOpenExp, touch, slots = SKILLS, onEdit }) {
  const [now, setNow] = useState(() => Date.now())
  const hasCd = slots.some((s) => (cooldowns[s.id] ?? 0) > now)

  useEffect(() => {
    if (!hasCd) return
    const t = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(t)
  }, [hasCd])

  const lv = levelOf(xp)
  const pct = Math.min(100, Math.round((lv.into / (lv.span || 1)) * 100))

  if (touch) {
    return (
      <div
        data-tour="skill-bar"
        className="pointer-events-auto absolute z-10 flex flex-col gap-1 rounded-2xl border border-white/60 bg-white/68 p-1.5 shadow-sm backdrop-blur-sm"
        style={{ right: 'max(0.75rem, env(safe-area-inset-right))', bottom: 'max(0.8rem, env(safe-area-inset-bottom))' }}
        aria-label="Beceri çubuğu"
      >
        <div className="grid grid-cols-4 gap-1">
          {slots.map((sk) => {
            const rem = Math.min(SKILL_COOLDOWN_MS, Math.max(0, (cooldowns[sk.id] ?? 0) - now))
            const onCd = rem > 0
            const fillPct = onCd ? Math.min(100, (rem / SKILL_COOLDOWN_MS) * 100) : 0
            const secs = Math.ceil(rem / 1000)
            return (
              <button
                key={sk.id}
                type="button"
                disabled={onCd}
                onClick={() => onSkill(sk)}
                aria-label={`${sk.label}${onCd ? ` (${secs} saniye bekle)` : ''}`}
                className={`relative flex h-11 w-11 flex-col items-center justify-center overflow-hidden rounded-xl border transition ${
                  onCd ? 'cursor-not-allowed border-white/60 bg-[#ede6fa]/75' : 'border-white/80 bg-[#faf6ff]/85 shadow-sm active:scale-95'
                }`}
              >
                <SlotIcon sk={sk} size={22} dim={onCd} />
                {onCd && (
                  <>
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-[#4a3b5c]/35 transition-[height] duration-100" style={{ height: `${fillPct}%` }} />
                    <span className="pointer-events-none absolute inset-0 grid place-items-center text-xs font-black text-white drop-shadow-[0_1px_3px_rgba(74,59,92,0.85)] tabular-nums">
                      {secs}
                    </span>
                  </>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div
      data-tour="skill-bar"
      className={`pointer-events-auto absolute bottom-3.5 left-1/2 z-10 flex w-[min(94vw,27rem)] -translate-x-1/2 flex-col gap-2 rounded-[1.75rem] px-3.5 py-2.5 ${glass}`}
      aria-label="Beceri ve deneyim çubuğu"
    >
      <div className="grid grid-cols-4 gap-2">
        {slots.map((sk) => {
          const rem = Math.min(SKILL_COOLDOWN_MS, Math.max(0, (cooldowns[sk.id] ?? 0) - now))
          const onCd = rem > 0
          const fillPct = onCd ? Math.min(100, (rem / SKILL_COOLDOWN_MS) * 100) : 0
          const secs = Math.ceil(rem / 1000)
          return (
            <button
              key={sk.id}
              type="button"
              disabled={onCd}
              onClick={() => onSkill(sk)}
              title={`${sk.label} (${sk.key}) · 5 sn`}
              aria-label={`${sk.label}${onCd ? ` (${secs} saniye bekle)` : ''}`}
              className={`relative flex h-16 flex-col items-center justify-center overflow-hidden rounded-2xl border-2 transition ${
                onCd ? 'cursor-not-allowed border-white/70 bg-[#ede6fa]' : 'border-white bg-[#faf6ff] shadow-sm hover:-translate-y-0.5 hover:bg-white active:scale-95'
              }`}
            >
              {!touch && (
                <span className="absolute left-2 top-1 text-xs font-black text-[#8a7a9c]">
                  {sk.key}
                </span>
              )}
              <SlotIcon sk={sk} size={38} dim={onCd} />
              <span className="mt-1 text-xs font-extrabold leading-none text-[#5b4a70]">{sk.label}</span>
              {onCd && (
                <>
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-[#4a3b5c]/35 transition-[height] duration-100" style={{ height: `${fillPct}%` }} />
                  <span className="pointer-events-none absolute inset-0 grid place-items-center text-base font-black text-white drop-shadow-[0_1px_3px_rgba(74,59,92,0.85)] tabular-nums">
                    {secs}
                  </span>
                </>
              )}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onOpenExp}
        title="Koleksiyon ve seviye ilerlemesini aç"
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl bg-[#faf6ff]/90 px-3 py-1.5 text-left transition hover:bg-white active:scale-[0.99]"
      >
        <span className="shrink-0 rounded-full bg-[#ffe48f] px-2.5 py-0.5 text-xs font-black text-[#7a5b00]">
          Sv. {lv.level}
        </span>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#eadfff]">
          <div className="h-full rounded-full bg-gradient-to-r from-[#ffe48f] via-[#fdb252] to-[#ff9248] transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="shrink-0 text-xs font-black tabular-nums text-[#6b4fc0]">
          EXP {lv.into}/{lv.span}
        </span>
      </button>
      {onEdit && <button
            type="button"
            onClick={onEdit}
            aria-label="İfadeleri düzenle"
            title="İfadeleri düzenle"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#efe7ff] text-[#6b4fc0] transition hover:bg-[#e3d6ff] active:scale-90"
          >
            <Em e="✏️" size={16} />
          </button>}
      </div>
    </div>
  )
}

export * from './Joysticks'
export * from './InteractSheet'
export * from './SocialChips'
export * from './ChatSheet'
