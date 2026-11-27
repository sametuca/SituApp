// Beceri çubuğu: 4 yuvalı ifade/dans becerileri, bekleme süreleri, tek kişilik dans duruşu ve tepki gönderme (World.jsx'ten ayrıldı).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SKILL_COOLDOWN_MS, loadSlots, saveSlots, skillFor } from '../world/interact'
import { bike } from '../world/bikeStore'
import { together } from '../world/features/togetherStore'

export function useSkills({ net, focusRef }) {
  const react = useCallback((e) => net.sendReact(e), [net])
  const reactRef = useRef(react)
  const [slots, setSlots] = useState(loadSlots) // beceri çubuğu 4 yuvası (ifadeler; sürükle-bırakla değişir)
  const [skillEdit, setSkillEdit] = useState(false)
  const skillList = useMemo(() => slots.map((e, i) => skillFor(e, i)), [slots])
  const skillListRef = useRef(skillList)
  skillListRef.current = skillList
  const changeSlots = useCallback((next) => {
    setSlots(next)
    saveSlots(next)
  }, [])
  const [skillCd, setSkillCd] = useState({})
  const skillCdRef = useRef({})
  const soloDanceTimer = useRef(null)
  useEffect(() => () => clearTimeout(soloDanceTimer.current), [])
  const triggerSkill = useCallback(
    (sk) => {
      const now = Date.now()
      if ((skillCdRef.current[sk.id] ?? 0) > now) return
      const next = { ...skillCdRef.current, [sk.id]: now + SKILL_COOLDOWN_MS }
      skillCdRef.current = next
      setSkillCd(next)
      react(sk.emoji)
      window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: sk.sfx }))
      if (sk.pose && !bike.on && (!together.self.current || together.self.current.solo)) {
        together.self.current = { kind: sk.pose, lead: true, ry: focusRef.current.ry, t0: performance.now() / 1000, solo: true }
        clearTimeout(soloDanceTimer.current)
        soloDanceTimer.current = setTimeout(() => {
          if (together.self.current?.solo) together.self.current = null
        }, sk.dur ?? 2400)
      }
    },
    [react],
  )
  const skillRef = useRef(triggerSkill)
  useEffect(() => {
    reactRef.current = react
    skillRef.current = triggerSkill
  }, [react, triggerSkill])

  return { react, reactRef, slots, skillEdit, setSkillEdit, skillList, skillListRef, changeSlots, skillCd, triggerSkill, skillRef }
}
