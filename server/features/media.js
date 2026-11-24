// Medya: özel sohbette sesli mesaj ve çıkartmalar.
//   { t: 'voice', to, mime, dur, data }   sesli mesaj (yalnızca özel; base64 webm/ogg/mp4, ≤ 96 KB, ≤ 10 sn)
//   { t: 'sticker', id, to? }             çıkartma kimliği (metin yok). to yoksa odadakilere, varsa yalnızca o kişiye
//   sunucu → istemci:
//     { t: 'voice', id, name, ts, to, dm: true, mime, dur, data }   alıcıya ve göndericiye
//     { t: 'sticker', id, name, ts, sticker, to?, dm? }
// Çıkartma kimlikleri istemcideki src/world/features/stickers.js ile aynı olmalı (set-sıra).

export const VOICE_MAX_BYTES = 96 * 1024
export const VOICE_MAX_SEC = 10
/** Bu kadar base64 karakterden büyük sesli mesaj zaten reddedilir (96 KB → 131072). */
export const VOICE_MAX_B64 = Math.ceil((VOICE_MAX_BYTES * 4) / 3) + 4

const STICKER_RE = /^(ask|gunluk|parti|tatli)-[0-7]$/
const MIMES = new Set(['audio/webm', 'audio/ogg', 'audio/mp4'])

// dosya başlığı mime ile uyuşuyor mu? (rastgele veri taşımayı zorlaştırır)
function magicOk(buf, mime) {
  if (mime === 'audio/webm') return buf.length > 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3
  if (mime === 'audio/ogg') return buf.length > 4 && buf.toString('latin1', 0, 4) === 'OggS'
  return buf.length > 12 && buf.toString('latin1', 4, 8) === 'ftyp'
}

export default function media(ctx) {
  const { players, send, broadcast } = ctx
  const mod = () => ctx.features[0].api
  const emit = (me, type, n, peer) => ctx.emitEvent?.(me, type, n, peer)

  return {
    handlers: {
      voice(me, msg) {
        const now = Date.now()
        if (now - (me.lastVoice ?? 0) < 2500) return send(me.ws, { t: 'info', text: 'Biraz yavaş, sesli mesajlar arasında birkaç saniye bekle.' })
        me.voiceTimes = (me.voiceTimes ?? []).filter((x) => now - x < 60000)
        if (me.voiceTimes.length >= 8) return send(me.ws, { t: 'info', text: 'Bu dakikada çok fazla sesli mesaj gönderdin.' })
        const target = typeof msg.to === 'string' ? players.get(msg.to) : null
        if (!target || target.id === me.id || target.room !== me.room) return send(me.ws, { t: 'info', text: 'Bu kişi artık burada değil.' })
        const mime = typeof msg.mime === 'string' ? msg.mime.split(';')[0].trim().toLowerCase() : ''
        const dur = Number(msg.dur)
        if (!MIMES.has(mime) || !Number.isFinite(dur) || dur < 0.2 || dur > VOICE_MAX_SEC + 1) return send(me.ws, { t: 'info', text: 'Ses biçimi desteklenmiyor.' })
        const data = msg.data
        if (typeof data !== 'string' || data.length < 16 || data.length > VOICE_MAX_B64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return send(me.ws, { t: 'info', text: 'Sesli mesaj geçersiz ya da çok büyük.' })
        const buf = Buffer.from(data, 'base64')
        if (buf.length > VOICE_MAX_BYTES || !magicOk(buf, mime)) return send(me.ws, { t: 'info', text: 'Sesli mesaj geçersiz ya da çok büyük.' })
        const why = mod().reach(me, target, 'dm')
        if (why) return why.text && send(me.ws, { t: 'info', text: why.text })
        me.lastVoice = now
        me.voiceTimes.push(now)
        mod().remember(me, 'özel', '[sesli mesaj]')
        const out = { t: 'voice', id: me.id, name: me.name, ts: now, to: target.id, dm: true, mime, dur: Math.round(Math.min(dur, VOICE_MAX_SEC) * 10) / 10, data }
        send(target.ws, out)
        send(me.ws, out)
        emit(me, 'chat', 1, target)
      },

      sticker(me, msg) {
        const now = Date.now()
        if (typeof msg.id !== 'string' || !STICKER_RE.test(msg.id) || now - (me.lastSticker ?? 0) < 900) return
        const target = typeof msg.to === 'string' ? players.get(msg.to) : null
        if (msg.to && (!target || target.id === me.id || target.room !== me.room)) return send(me.ws, { t: 'info', text: 'Bu kişi artık burada değil.' })
        if (target) {
          const why = mod().reach(me, target, 'dm')
          if (why) return why.text && send(me.ws, { t: 'info', text: why.text })
        }
        me.lastSticker = now
        mod().remember(me, target ? 'özel' : 'herkese', `[çıkartma ${msg.id}]`)
        const out = { t: 'sticker', id: me.id, name: me.name, ts: now, sticker: msg.id }
        if (target) {
          out.to = target.id
          out.dm = true
          send(target.ws, out)
          send(me.ws, out)
        } else broadcast(out, undefined, me.room, me)
        emit(me, 'chat', 1, target)
      },
    },
  }
}
