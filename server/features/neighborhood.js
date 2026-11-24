// Konut Mahallesi: oyuncu evi parselleri ve evin dış görünümü.
//  - Parsel ataması kalıcıdır (homes kaydında `plot`): oyuncu evini ilk kez döşeyince/açınca sıradaki boş parseli alır.
//  - exterior_set: ev stili, çit, bahçe öğeleri, hoş geldin mesajı (≤ 40, censor), kapı rengi; yalnızca sahibi (anahtar sunucudaki kimlikten).
//  - welcome.plots: dolu parsellerin toplu listesi; değişince { t:'plot', p } herkese yayılır.
// Ev kapısına girmek mevcut `room` mesajıdır (canEnter: sahibi / davetli / herkese açık).
import { PLOTS, PLOT_BY_ID, DEFAULT_EXTERIOR, sanitizeExterior } from '../../src/world/neighborhood.js'
import { getExterior, getHome, getPlot, listPlotted, setExterior, setPlot } from '../homes.js'

const pub = (e) => ({ id: e.plot, key: e.key, name: e.owner, open: e.open, ext: e.exterior ?? DEFAULT_EXTERIOR })
const pubOf = (key) => {
  const h = getHome(key)
  return h?.plot ? pub({ key, owner: h.owner, open: Boolean(h.open), plot: h.plot, exterior: h.exterior ?? null }) : null
}

export default function neighborhood(ctx) {
  const { send, broadcast } = ctx
  const mod = () => ctx.features[0].api

  const announce = (key) => {
    const p = pubOf(key)
    if (p) broadcast({ t: 'plot', p })
  }

  /** Parseli yoksa sıradaki boş parseli verir. Döner: parsel kimliği ya da null (boş parsel yok). */
  const claim = (me) => {
    const have = getPlot(me.homeKey)
    if (have && PLOT_BY_ID[have]) return have
    const used = new Set(listPlotted().map((h) => h.plot))
    const free = PLOTS.find((p) => !used.has(p.id))
    if (!free) return null
    setPlot(me.homeKey, me.name, free.id)
    send(me.ws, { t: 'info', text: `🏘️ Konut Mahallesi’nde ${free.n}. parsel senin oldu! Evin artık mahallede görünüyor.` })
    return free.id
  }

  return {
    welcome: (me) => ({
      plots: listPlotted().map(pub),
      myExt: getExterior(me.homeKey),
    }),
    // çekirdek (game.js) ev değişince çağırır: kind = 'save' (döşeme) | 'open' (kapı aç/kapat)
    onHomeChange(me, kind) {
      const items = getHome(me.homeKey)?.items ?? []
      if (kind === 'save' && !items.length && !getPlot(me.homeKey)) return // boş kayıt parsel almaz
      if (!claim(me)) return send(me.ws, { t: 'info', text: '🏘️ Konut Mahallesi’nde boş parsel kalmadı; evine lobideki 🏠 kapıdan girebilirsin.' })
      announce(me.homeKey)
    },
    handlers: {
      exterior_set(me, msg) {
        const now = Date.now()
        if (now - (me.lastExterior ?? 0) < 300) return
        me.lastExterior = now
        const ext = sanitizeExterior(msg.ext, (s) => mod().censor(ctx.clean(s, 40)))
        setExterior(me.homeKey, me.name, ext)
        if (!claim(me)) send(me.ws, { t: 'info', text: '🏘️ Konut Mahallesi’nde boş parsel kalmadı; dış görünümün kaydedildi, parsel açılınca görünür.' })
        announce(me.homeKey)
      },
    },
  }
}
