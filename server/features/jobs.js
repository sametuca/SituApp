// Serbest meslekler (sunucu): meslek seçme zorunluluğu yok; herkes istediği zaman balık tutabilir veya posta dağıtabilir.
// İstemci → sunucu: { t: 'job_fish', spot } · { t: 'job_post_start' } · { t: 'job_post_deliver' }
import { VENUE_DOORS } from '../../src/world/venueDoors.js'

const FISH_SPOTS = [
  { id: 'pier', x: 0, z: 51.2, r: 10 },
  { id: 'pond', x: -30, z: 30, r: 12 },
]
const canFishAt = (x, z) => (z >= 47 && Math.abs(x) <= 28) || FISH_SPOTS.some((s) => Math.hypot(x - s.x, z - s.z) <= s.r)
const MAILBOX = { x: 6.6, z: -6.2, r: 7 }
const POST_VENUES = ['kafe', 'kitapkafe', 'firin', 'cayevi', 'tatli', 'kuafor', 'foto', 'dondurma', 'plajbar'].filter((id) => VENUE_DOORS[id])

const FISH_TABLE = [
  { id: 'sardalya', name: 'Sardalya', rarity: 'Yaygın', coins: 6, w: 30 },
  { id: 'istavrit', name: 'İstavrit', rarity: 'Yaygın', coins: 8, w: 24 },
  { id: 'cipura', name: 'Çipura', rarity: 'Orta', coins: 11, w: 18 },
  { id: 'palyaco', name: 'Palyaço Balığı', rarity: 'Nadir', coins: 15, w: 12 },
  { id: 'kalamar', name: 'Kalamar', rarity: 'Nadir', coins: 18, w: 9 },
  { id: 'altin', name: 'Altın Balık', rarity: 'Efsanevi', coins: 28, w: 4 },
  { id: 'ahtapot', name: 'Kral Ahtapot', rarity: 'Efsanevi', coins: 32, w: 3 },
]
const FISH_BY_ID = Object.fromEntries(FISH_TABLE.map((f) => [f.id, f]))
const FISH_TOTAL_W = FISH_TABLE.reduce((s, f) => s + f.w, 0)
function rollFish() {
  let r = Math.random() * FISH_TOTAL_W
  for (const f of FISH_TABLE) {
    r -= f.w
    if (r <= 0) return f
  }
  return FISH_TABLE[0]
}

export default function jobs(ctx) {
  const { send } = ctx
  return {
    handlers: {
      job_fish(me, msg) {
        if (me.room !== 'city') return
        const now = Date.now()
        if (now - (me.lastFish ?? 0) < 3500) return
        if (!canFishAt(me.x, me.z)) return
        me.lastFish = now
        const caught = (typeof msg?.fishId === 'string' && FISH_BY_ID[msg.fishId]) || rollFish()
        ctx.addCoins?.(me, caught.coins, 'fish')
        ctx.emitEvent?.(me, 'job_fish', 1, caught.id)
        send(me.ws, { t: 'job_fish_res', fish: caught })
      },
      job_post_start(me) {
        if (me.room !== 'city') return
        if (Math.hypot(me.x - MAILBOX.x, me.z - MAILBOX.z) > MAILBOX.r) return
        const target = POST_VENUES[Math.floor(Math.random() * POST_VENUES.length)]
        if (!target) return
        me.postTarget = target
        me.postAt = Date.now()
        send(me.ws, { t: 'job_post_state', target })
      },
      job_post_deliver(me) {
        if (me.room !== 'city' || !me.postTarget) return
        const door = VENUE_DOORS[me.postTarget]
        if (!door || Math.hypot(me.x - door.x, me.z - door.z) > 6) return
        if (Date.now() - (me.postAt ?? 0) < 1500) return
        const target = me.postTarget
        me.postTarget = null
        const coins = 12
        ctx.addCoins?.(me, coins, 'post')
        ctx.emitEvent?.(me, 'job_post', 1, target)
        send(me.ws, { t: 'job_post_done', target, coins })
      },
    },
  }
}
