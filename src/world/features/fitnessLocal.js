// Spor/boks yerel (çevrimdışı) veriler: nitelik, enerji ve skor tablosu localStorage yardımcıları.
import { STAT_START, energyMax } from '../boxing'
export const LOCAL_ATTR_KEY = 'situapp_attr_v1'
export const LOCAL_BOARD_KEY = 'situapp_box_board_v1'
export const LOCAL_EN_KEY = 'situapp_gym_en_v1'

export const todayStr = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10)
export const isTyping = (e) => e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)

export function readLocalAttr() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_ATTR_KEY))
    if (raw && typeof raw === 'object') {
      return {
        str: Number(raw.str) || STAT_START,
        sta: Number(raw.sta) || STAT_START,
        cha: Number(raw.cha) || STAT_START,
        ski: Number(raw.ski) || STAT_START,
      }
    }
  } catch {
    /* ignore */
  }
  return { str: STAT_START, sta: STAT_START, cha: STAT_START, ski: STAT_START }
}

export function saveLocalAttr(attr) {
  try {
    localStorage.setItem(LOCAL_ATTR_KEY, JSON.stringify(attr))
  } catch {
    /* ignore */
  }
}

export function readLocalEnergy(attr) {
  const max = energyMax(attr)
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_EN_KEY))
    if (raw?.day === todayStr()) return { left: Math.max(0, max - (raw.used || 0)), max }
  } catch {
    /* ignore */
  }
  return { left: max, max }
}

export function consumeLocalEnergy(attr) {
  const day = todayStr()
  let used = 0
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_EN_KEY))
    if (raw?.day === day) used = raw.used || 0
  } catch {
    /* ignore */
  }
  const max = energyMax(attr)
  if (used >= max) return { ok: false, left: 0, max }
  used += 1
  try {
    localStorage.setItem(LOCAL_EN_KEY, JSON.stringify({ day, used }))
  } catch {
    /* ignore */
  }
  return { ok: true, left: Math.max(0, max - used), max }
}

export function readLocalBoard() {
  try {
    const a = JSON.parse(localStorage.getItem(LOCAL_BOARD_KEY))
    return Array.isArray(a) ? a : []
  } catch {
    return []
  }
}

export function pushLocalBoard(name, win, ko, pts) {
  const list = readLocalBoard()
  const key = name || 'Sen'
  const i = list.findIndex((r) => r.name === key)
  if (i >= 0) {
    list[i].points += pts
    if (win) list[i].wins += 1
    if (ko) list[i].ko += 1
  } else {
    list.push({ key, name: key, points: pts, wins: win ? 1 : 0, ko: ko ? 1 : 0 })
  }
  list.sort((a, b) => b.points - a.points || b.wins - a.wins)
  const top = list.slice(0, 15)
  try {
    localStorage.setItem(LOCAL_BOARD_KEY, JSON.stringify(top))
  } catch {
    /* ignore */
  }
  return top
}
