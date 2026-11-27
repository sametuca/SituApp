// İstemci içi hafif stat/kemer deposu (LocalPlayer koşu hızı ve avatar kemer/eldiven görünümü için).
import { STAT_START } from './boxing'

const state = {
  attr: { str: STAT_START, sta: STAT_START, cha: STAT_START, ski: STAT_START },
  champKey: null,
}
const listeners = new Set()

export const fitnessStore = {
  subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  get: () => state,
  set(next) {
    if (next.attr) state.attr = { ...state.attr, ...next.attr }
    if (next.champKey !== undefined) state.champKey = next.champKey
    listeners.forEach((fn) => fn())
  },
}
