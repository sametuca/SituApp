// Ev kademeleri: garaj evi → stüdyo → müstakil ev → villa (src/world/homeTiers.js). Her ev ayrı bir oda olduğundan şehirde yer tutmaz.
//   istemci → sunucu: { t: 'home_upgrade' }     bir üst kademeye geç (altın harcar)
//   sunucu → istemci: { t: 'home_tier', owner, tier }   evin kademesi değişti (evdekilerin hepsine); welcome.homeTier; room.tier
import { HOME_TIERS, MAX_TIER } from '../../src/world/homeTiers.js'
import { CROP_BY_ID, GARDEN_PLOT_COUNT, LAND_TIERS, MAX_LAND_TIER, clampLandTier, cropProgress } from '../../src/world/homeGarden.js'
import { PERK } from '../../src/world/jobsData.js'
import { getTier, setTier } from '../homes.js'
import { save, user } from '../store.js'

function getGarden(ownerKey) {
  const u = user(ownerKey)
  if (!u.stats.garden || !Array.isArray(u.stats.garden)) {
    u.stats.garden = Array(GARDEN_PLOT_COUNT).fill(null)
  }
  return u.stats.garden
}

export default function housing(ctx) {
  const { send, broadcast } = ctx
  const pushGarden = (ownerKey, plots, me) => {
    const landTier = clampLandTier(user(ownerKey).stats.landTier ?? 0)
    const msg = { t: 'garden_state', owner: ownerKey, plots, landTier }
    if (me) send(me.ws, msg)
    broadcast(msg, me?.id, `home:${ownerKey}`)
  }

  return {
    welcome: (me) => ({ homeTier: getTier(me.homeKey), landTier: clampLandTier(user(me.homeKey).stats.landTier ?? 0) }),
    handlers: {
      garden_get(me, msg) {
        const owner = typeof msg.owner === 'string' && msg.owner ? msg.owner : me.homeKey
        const landTier = clampLandTier(user(owner).stats.landTier ?? 0)
        send(me.ws, { t: 'garden_state', owner, plots: getGarden(owner), landTier })
      },
      land_upgrade(me) {
        const now = Date.now()
        if (now - (me.lastLandUpgrade ?? 0) < 1200) return
        me.lastLandUpgrade = now
        const u = user(me.homeKey)
        const cur = clampLandTier(u.stats.landTier ?? 0)
        if (cur >= MAX_LAND_TIER) return send(me.ws, { t: 'info', text: '🌻 Arazin zaten en büyük kademede.' })
        const next = LAND_TIERS[cur + 1]
        if (!ctx.spendCoins?.(me, next.price, 'land')) return send(me.ws, { t: 'info', text: `₺ ${next.name} için ${next.price} TL gerekiyor.` })
        u.stats.landTier = cur + 1
        save()
        pushGarden(me.homeKey, getGarden(me.homeKey), me)
        send(me.ws, { t: 'info', text: `${next.emoji} Arazin ${next.name} oldu!` })
      },
      garden_plant(me, msg) {
        const idx = Number(msg.idx)
        const crop = CROP_BY_ID[msg.crop]
        if (!Number.isInteger(idx) || idx < 0 || idx >= GARDEN_PLOT_COUNT || !crop) return
        const plots = getGarden(me.homeKey)
        if (plots[idx]) return
        plots[idx] = { crop: crop.id, plantedAt: Date.now(), wateredAt: null }
        if (ctx.jobOf?.(me) === 'gardener') ctx.jobEvent?.(me, 'plant')
        ctx.workTend?.(me)
        save()
        pushGarden(me.homeKey, plots, me)
      },
      garden_water(me, msg) {
        const idx = Number(msg.idx)
        if (!Number.isInteger(idx) || idx < 0 || idx >= GARDEN_PLOT_COUNT) return
        const plots = getGarden(me.homeKey)
        if (!plots[idx] || plots[idx].wateredAt) return
        plots[idx] = { ...plots[idx], wateredAt: Date.now() }
        if (ctx.jobOf?.(me) === 'gardener') ctx.jobEvent?.(me, 'water')
        ctx.workTend?.(me)
        save()
        pushGarden(me.homeKey, plots, me)
      },
      garden_harvest(me, msg) {
        const idx = Number(msg.idx)
        if (!Number.isInteger(idx) || idx < 0 || idx >= GARDEN_PLOT_COUNT) return
        const plots = getGarden(me.homeKey)
        const slot = plots[idx]
        if (!slot) return
        const crop = CROP_BY_ID[slot.crop]
        if (!crop || !cropProgress(slot, Date.now()).ready) return
        plots[idx] = null
        save()
        ctx.workTend?.(me)
        if (ctx.bagAdd) {
          // ürün çantaya girer, pazarda satılır (Bahçıvan: seviyeye göre çifte ürün şansı)
          const gardener = ctx.jobOf?.(me) === 'gardener'
          const lv = ctx.features.find((f) => f.api?.levelOf)?.api.levelOf(me.key, 'gardener') ?? 1
          const n = gardener && Math.random() < PERK.double(lv) ? 2 : 1
          ctx.bagAdd(me, 'crop', crop.id, n)
          if (gardener) {
            ctx.jobGain?.(me, 4 + crop.stars * 2)
            ctx.jobEvent?.(me, 'harvest', n)
          }
          send(me.ws, { t: 'info', text: `🧺 ${crop.emoji} ${crop.name} ×${n} çantaya girdi. Pazarda sat: 💼 meslek paneli.` })
        } else ctx.addCoins?.(me, crop.coins, 'garden')
        pushGarden(me.homeKey, plots, me)
      },
      garden_bonus(me) {
        const day = new Date().toISOString().slice(0, 10)
        const u = user(me.homeKey)
        if (u.stats.gardenBonusDay === day) return
        u.stats.gardenBonusDay = day
        save()
        ctx.addCoins?.(me, 25, 'garden_bonus')
        send(me.ws, { t: 'info', text: '🏡 Günlük ev bakım ödülü: +25 ₺!' })
      },
      home_kudos(me, msg) {
        const now = Date.now()
        if (now - (me.lastKudos ?? 0) < 4000) return
        me.lastKudos = now
        const owner = typeof msg.owner === 'string' ? msg.owner : ''
        if (!owner || owner === me.homeKey) return
        broadcast({ t: 'home_kudos', from: me.name, owner }, me.id, `home:${owner}`)
      },
      home_upgrade(me) {
        const now = Date.now()
        if (now - (me.lastUpgrade ?? 0) < 1500) return
        me.lastUpgrade = now
        const cur = getTier(me.homeKey)
        if (cur >= MAX_TIER) return send(me.ws, { t: 'info', text: '🏰 Evin zaten en büyük kademede.' })
        const next = HOME_TIERS[cur + 1]
        if (!ctx.spendCoins?.(me, next.price, 'ev')) return send(me.ws, { t: 'info', text: `₺ ${next.name} için ${next.price} TL gerekiyor.` })
        const tier = setTier(me.homeKey, me.name, cur + 1)
        const msg = { t: 'home_tier', owner: me.homeKey, tier }
        send(me.ws, msg)
        broadcast(msg, me.id, `home:${me.homeKey}`)
        send(me.ws, { t: 'info', text: `${next.emoji} Evin ${next.name} oldu!` })
        ctx.emitEvent?.(me, 'home_upgrade', 1)
      },
    },
  }
}
