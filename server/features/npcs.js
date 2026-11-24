// NPC'ler: yalnızca ilerleme olayı. İstemci NPC'yle konuşunca { t: 'npc_talk', id } yollar;
// sunucu kimliği, odayı ve (paylaşılan saatten hesaplanan) mesafeyi doğrular, hız sınırı uygular
// ve ctx.emitEvent(me, 'npc_talk', 1, npcId) ile günlük görev/rozet sayaçlarını besler.
import { NPC_BY_ID, SERVER_RADIUS, posAt } from '../../src/world/npcs.js'

export default function npcs(ctx) {
  const { send } = ctx
  return {
    handlers: {
      npc_talk(me, msg) {
        const npc = typeof msg.id === 'string' ? NPC_BY_ID[msg.id] : null
        if (!npc) return
        const room = npc.where === 'city' ? 'city' : `venue:${npc.where}`
        if (me.room !== room) return
        const now = Date.now()
        if (now - (me.lastNpcTalk ?? 0) < 800) return
        me.npcTimes = (me.npcTimes ?? []).filter((x) => now - x < 60000)
        if (me.npcTimes.length >= 30) return send(me.ws, { t: 'info', text: 'Biraz soluklan, karakterler de dinlensin 😄' })
        const p = posAt(npc, now)
        if (Math.hypot(me.x - p.x, me.z - p.z) > SERVER_RADIUS) return
        me.lastNpcTalk = now
        me.npcTimes.push(now)
        ctx.emitEvent?.(me, 'npc_talk', 1, npc.id)
      },
    },
  }
}
