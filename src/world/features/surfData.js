export const LOCAL_BOARD_KEY = 'situapp_surf_board_v1'
export const BOARD_STYLES = [
  { board: '#ff8fb8', stripe: '#fff8ee', suit: '#1ea8c7', shorts: '#ffd35e', hair: '#4a3326' },
  { board: '#7fcdf3', stripe: '#ffe48f', suit: '#ff7b6b', shorts: '#4a3b5c', hair: '#2a2230' },
  { board: '#8fdcb4', stripe: '#ffffff', suit: '#7a5fd0', shorts: '#fec172', hair: '#7c4d2e' },
  { board: '#ffd35e', stripe: '#ff8fb8', suit: '#2bb89a', shorts: '#3b4a6b', hair: '#c98a3b' },
  { board: '#b79cff', stripe: '#fff3c4', suit: '#f2785c', shorts: '#2e6f95', hair: '#3a2a22' },
  { board: '#fdb252', stripe: '#ffffff', suit: '#3a8fd6', shorts: '#ff9ec7', hair: '#5a3a26' },
]

export const BOT_NAMES = ['Dalga Ece', 'Köpük Mert', 'Mercan Su', 'Rüzgar Alp']

export function makeRng(seed) {
  let s = (seed >>> 0) || 1234567
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function fmtSec(ms) {
  return `${(Math.max(0, ms) / 1000).toFixed(1)} sn`
}

export function loadLocalBoard() {
  try {
    const arr = JSON.parse(localStorage.getItem(LOCAL_BOARD_KEY))
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function saveLocalScore(name, pts, won, ms) {
  try {
    const list = loadLocalBoard()
    const key = name || 'Sen'
    const idx = list.findIndex((r) => r.name === key)
    if (idx >= 0) {
      list[idx].points += pts
      list[idx].games += 1
      if (won) list[idx].wins += 1
      list[idx].bestMs = Math.max(list[idx].bestMs, Math.round(ms))
    } else {
      list.push({ key, name: key, points: pts, wins: won ? 1 : 0, games: 1, bestMs: Math.round(ms) })
    }
    list.sort((a, b) => b.points - a.points || b.wins - a.wins || b.bestMs - a.bestMs)
    localStorage.setItem(LOCAL_BOARD_KEY, JSON.stringify(list.slice(0, 15)))
    return list.slice(0, 15)
  } catch {
    return []
  }
}

export const MAX_LIVES = 2
export const JUMP_CD = 1.8
