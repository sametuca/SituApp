// İki kişilik mini oyunlar: XOX, Doğruluk mu Cesaret mi, Aşk testi.
// Sunucu OTORİTERdir: oyun durumu burada tutulur, hamleler doğrulanır, sıra zorlanır.
//
// Protokol
//   istemci → sunucu
//     { t: 'game_offer', to, game }          oyun teklifi (game: xox | tod | love); ≤ 8 m, aynı oda
//     { t: 'game_reply', id, accept }        gelen teklifi kabul/reddet
//     { t: 'game_cancel' }                   verdiğin teklifi geri çek
//     { t: 'game_act', a, ... }              oyun hamlesi (xox: cell{i}, again | tod: pick{kind}, answer{text}, done | love: answer{q,o})
//     { t: 'game_leave' }                    oyunu bitir
//   sunucu → istemci
//     { t: 'game_offer', id, from, name, avatar, game, ttl }   sana teklif geldi
//     { t: 'game_offer_out', id, to, name, game, ttl }         teklifin gönderildi
//     { t: 'game_offer_end', id, why }       teklif bitti (accepted | declined | cancelled | expired | invalid)
//     { t: 'game_state', gid, game, you, players: [{id,name,avatar}, {...}], s }   oyunun (sana özel) görünümü
//     { t: 'game_end', gid, why }            oyun bitti (left | away | blocked | room | idle | closed)
import crypto from 'node:crypto'

export const GAMES = ['xox', 'tod', 'love']
const OFFER_RANGE = 8 // m
const KEEP_RANGE = 25 // m: oyun sırasında bu kadar uzaklaşırsa biter
const OFFER_TTL_MS = 30_000
const IDLE_MS = 5 * 60_000
const OFFER_COOLDOWN_MS = 2000
const ACT_COOLDOWN_MS = 200
const TEXT_MAX = 120

// ---- Doğruluk mu Cesaret mi havuzu (hafif, tatlı, uygun) ----
const TRUTHS = [
  'En sevdiğin çocukluk anın ne?',
  'Hayatında yaptığın en tatlı çılgınlık neydi?',
  'Bir ilk buluşmada seni en çok ne etkiler?',
  'Gizli bir yeteneğin var mı? Nedir?',
  'En son ne zaman kahkaha atarak güldün?',
  'Hiç hayran kaldığın bir ünlü oldu mu? Kim?',
  'Hayalindeki hafta sonu tatili nasıl?',
  'Seni en çok güldüren şey nedir?',
  'Telefonundaki en eski fotoğraf ne? Anlat.',
  'Bir süper gücün olsa ne olmasını isterdin?',
  'En sevdiğin şarkı hangisi ve neden?',
  'Utandığın en komik an neydi?',
  'Bir arkadaşında en çok hangi özelliği seversin?',
  'Sabah mı gece kuşusun? Rutinini anlat.',
  'Hiç sürpriz yaptığın ya da yapılan bir doğum günü oldu mu?',
  'En sevdiğin yemek ve onu kiminle yemek isterdin?',
  'Çocukken büyüyünce ne olmak istiyordun?',
  'Birinde fark ettiğin ilk şey genelde ne olur?',
  'Seni en çok mutlu eden küçük şey nedir?',
  'Kendini üç kelimeyle anlat.',
  'Hiç yaptığın en saçma alışveriş ne oldu?',
  'Romantik film mi, komedi mi? Neden?',
  'Bir günlüğüne başka biri olsan kim olurdun?',
  'Bu oyunda bana sormak isteyip de sormadığın bir şey var mı?',
]
const DARES = [
  'Karşındakine 3 farklı emoji tepkisi gönder.',
  'Sohbete en tatlı iltifatını yaz.',
  'Karşındakine bir çiçek ya da kalp jesti yap.',
  'Karakterinle 5 saniye dans et.',
  'Kendini bir hayvan gibi tanıt (sesiyle birlikte yaz!).',
  'Karşındaki için iki dizelik bir şiir uydur.',
  'Sohbete sadece emojilerle bir film adı yaz, karşın tahmin etsin.',
  'En sevdiğin şarkının bir dizesini yaz.',
  'Karşındakine kendini tek cümleyle satmaya çalış.',
  'Karşındaki için komik bir takma ad bul.',
  'Karakterinle bir daire çizerek koş.',
  'Bir sonraki mesajını "e" harfi kullanmadan yazmayı dene.',
  'Karşındaki oyuncuya el salla ve gülümse 😊',
  'Hayalindeki ilk buluşmayı tek cümleyle anlat.',
  'Şu an hissettiğin duyguyu bir emojiyle anlat ve nedenini yaz.',
  'Karşındakinin avatarı hakkında iyi bir şey söyle.',
  'Bir kahve sipariş eder gibi karşındakine kendini tanıt.',
  'En komik şakanı yap!',
  'Karşındakine bir sonraki oyun için meydan oku.',
  'Sohbete emojilerle bir kalp çiz.',
  'Kendi adını emojilerle yazmayı dene.',
  'Karşındakine tatlı bir lakap ver ve nedenini söyle.',
  'Bir dilek tut ve karşındakine söyle (gerçekleşmesi için 🤞).',
  'İki doğru, bir yalan: kendin hakkında üç şey yaz.',
]

// ---- Aşk testi ----
const QUESTIONS = [
  { q: 'Hafta sonu planı?', o: ['Evde film maratonu 🛋️', 'Dışarıda gezmek 🌳', 'Ani macera yolculuğu 🚗'] },
  { q: 'İdeal ilk buluşma?', o: ['Kahve ☕', 'Akşam yemeği 🍝', 'Lunapark 🎡', 'Sahil yürüyüşü 🌊'] },
  { q: 'Mesajlaşma tarzın?', o: ['Sürekli yazarım 💬', 'Arada bir 📱', 'Sesli arama 📞'] },
  { q: 'Tatlı mı tuzlu mu?', o: ['Tatlı 🍰', 'Tuzlu 🍟', 'İkisi birden 🍕'] },
  { q: 'Hangi mevsim?', o: ['İlkbahar 🌸', 'Yaz ☀️', 'Sonbahar 🍂', 'Kış ❄️'] },
  { q: 'Sürpriz yapılsa?', o: ['Bayılırım 🎁', 'Biraz utanırım 🙈', 'Önceden bilmek isterim 🗓️'] },
]
const LOVE_RESULTS = [
  { min: 0, title: 'Zıt kutuplar çeker 🧲', text: 'Birbirinize pek benzemiyorsunuz; belki de tam bu yüzden sıkılmazsınız!', tip: 'Birlikte hiç yapmadığınız bir şey deneyin 🎢' },
  { min: 35, title: 'Merak uyandıran ikili 🔮', text: 'Ortak noktalarınız az ama keşfedecek çok şey var.', tip: 'Bir kahve içmeli ☕' },
  { min: 55, title: 'Güzel bir uyum 🌷', text: 'Aynı dalga boyundasınız; küçük farklar işleri tatlandırıyor.', tip: 'Birlikte bir tatlı paylaşın 🍰' },
  { min: 75, title: 'Çok uyumlu ikili 💞', text: 'Neredeyse aynı şeyleri seviyorsunuz, anlaşmanız çok kolay!', tip: 'Hafta sonu için plan yapın 🌳' },
  { min: 95, title: 'Ruh ikizi alarmı 💘', text: 'Bu kadar uyum nadir görülür; yıldızlar sizin için parlıyor!', tip: 'Hemen bir fotoğraf çektirin 📸' },
]

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

export default function games(ctx) {
  const { players, send, dist, clean } = ctx
  const mod = () => ctx.features[0].api // moderasyon her zaman ilk modül

  const sessions = new Map() // gid → oturum
  const sessionOf = new Map() // oyuncu id → gid
  const offers = new Map() // teklif id → { id, from, to, game, exp }

  const pubPlayer = (p) => ({ id: p.id, name: p.name, avatar: p.avatar })
  const info = (p, text) => send(p.ws, { t: 'info', text })
  const offerOfSender = (id) => [...offers.values()].find((o) => o.from === id)
  const offerToTarget = (id) => [...offers.values()].find((o) => o.to === id)

  // a ile b arasında oyun mümkün mü? null = evet; değilse sebep metni ('' = sessiz, engellenene sezdirme)
  const blockedWhy = (a, b) => {
    const r1 = mod().reach(a, b, 'game')
    if (r1) return r1.text ?? ''
    const r2 = mod().reach(b, a, 'game')
    if (r2) return ''
    return null
  }

  function emitPlayed(s) {
    if (s.counted) return
    s.counted = true
    for (const p of s.players) ctx.emitEvent?.(p, 'game_played', 1)
  }

  const initState = {
    xox: (starter) => ({ board: Array(9).fill(null), turn: starter, winner: null, line: null, again: [false, false], starter }),
    tod: () => ({ turn: 0, phase: 'choose', kind: null, prompt: null, rounds: 0, last: null, used: [] }),
    love: () => ({ answers: [[], []], result: null }),
  }

  // oyuncuya özel görünüm (aşk testinde rakibin cevapları sonuç gelene kadar gizli)
  function view(s, idx) {
    const st = s.state
    if (s.type === 'xox') return { board: st.board, turn: st.turn, winner: st.winner, line: st.line, again: st.again }
    if (s.type === 'tod') return { turn: st.turn, phase: st.phase, kind: st.kind, prompt: st.prompt, rounds: st.rounds, last: st.last }
    return {
      qs: QUESTIONS,
      mine: st.answers[idx],
      other: st.answers[1 - idx].length,
      result: st.result ? { ...st.result, answers: st.answers } : null,
    }
  }

  function push(s) {
    s.players.forEach((p, idx) => send(p.ws, { t: 'game_state', gid: s.id, game: s.type, you: idx, players: s.players.map(pubPlayer), s: view(s, idx) }))
  }

  function endSession(s, why, except) {
    if (!sessions.delete(s.id)) return
    if (s.type === 'tod' && s.state.rounds > 0) emitPlayed(s)
    for (const p of s.players) {
      if (sessionOf.get(p.id) === s.id) sessionOf.delete(p.id)
      if (p.id !== except) send(p.ws, { t: 'game_end', gid: s.id, why })
    }
  }

  function endOffer(o, why) {
    if (!offers.delete(o.id)) return
    for (const id of [o.from, o.to]) {
      const p = players.get(id)
      if (p) send(p.ws, { t: 'game_offer_end', id: o.id, why })
    }
  }

  // ---- hamleler ----
  function actXox(s, idx, msg) {
    const st = s.state
    if (msg.a === 'cell') {
      const i = msg.i
      if (!Number.isInteger(i) || i < 0 || i > 8) return
      if (st.winner !== null || st.turn !== idx || st.board[i] !== null) return
      st.board[i] = idx
      const line = LINES.find((l) => l.every((k) => st.board[k] === idx))
      if (line) {
        st.winner = idx
        st.line = line
        emitPlayed(s)
      } else if (st.board.every((c) => c !== null)) {
        st.winner = -1
        emitPlayed(s)
      } else st.turn = 1 - idx
    } else if (msg.a === 'again') {
      if (st.winner === null) return
      st.again[idx] = true
      if (st.again[0] && st.again[1]) {
        s.counted = false
        s.state = initState.xox(1 - st.starter)
      }
    } else return
    push(s)
  }

  function actTod(s, idx, msg) {
    const st = s.state
    if (st.turn !== idx) return
    if (msg.a === 'pick' && st.phase === 'choose') {
      if (msg.kind !== 'truth' && msg.kind !== 'dare') return
      const pool = msg.kind === 'truth' ? TRUTHS : DARES
      let free = pool.filter((x) => !st.used.includes(x))
      if (!free.length) {
        st.used = st.used.filter((x) => !pool.includes(x))
        free = pool
      }
      st.kind = msg.kind
      st.prompt = pick(free)
      st.used.push(st.prompt)
      st.phase = 'answer'
    } else if ((msg.a === 'answer' || msg.a === 'done') && st.phase === 'answer') {
      let answer = null
      if (msg.a === 'answer') {
        const raw = clean(msg.text, TEXT_MAX)
        if (!raw) return
        mod().remember(s.players[idx], 'oyun', raw)
        answer = mod().censor(raw)
        if (!answer) return
      }
      st.last = { by: idx, kind: st.kind, prompt: st.prompt, answer }
      st.rounds += 1
      st.turn = 1 - idx
      st.phase = 'choose'
      st.kind = null
      st.prompt = null
    } else return
    push(s)
  }

  function actLove(s, idx, msg) {
    const st = s.state
    if (msg.a !== 'answer' || st.result) return
    const mine = st.answers[idx]
    if (msg.q !== mine.length || mine.length >= QUESTIONS.length) return
    const o = msg.o
    if (!Number.isInteger(o) || o < 0 || o >= QUESTIONS[msg.q].o.length) return
    mine.push(o)
    if (st.answers.every((a) => a.length === QUESTIONS.length)) {
      const same = QUESTIONS.map((_, i) => st.answers[0][i] === st.answers[1][i])
      const matches = same.filter(Boolean).length
      const pct = Math.round(10 + (matches / QUESTIONS.length) * 90)
      const r = [...LOVE_RESULTS].reverse().find((x) => pct >= x.min)
      st.result = { pct, matches, same, title: r.title, text: r.text, tip: r.tip }
      emitPlayed(s)
    }
    push(s)
  }

  function start(a, b, type) {
    const s = { id: crypto.randomUUID().slice(0, 8), type, players: [a, b], last: Date.now(), counted: false }
    s.state = initState[type](0)
    sessions.set(s.id, s)
    sessionOf.set(a.id, s.id)
    sessionOf.set(b.id, s.id)
    push(s)
  }

  // ---- mesaj işleyicileri ----
  const handlers = {
    game_offer(me, msg) {
      const now = Date.now()
      if (now - (me.lastGameOffer ?? 0) < OFFER_COOLDOWN_MS) return
      me.lastGameOffer = now
      if (!GAMES.includes(msg.game)) return
      const target = typeof msg.to === 'string' ? players.get(msg.to) : null
      if (!target || target.id === me.id || target.room !== me.room) return info(me, 'Bu kişi artık burada değil.')
      if (dist(me, target) > OFFER_RANGE) return info(me, `🎮 ${target.name} çok uzakta. Oyun için biraz yaklaş.`)
      const why = blockedWhy(me, target)
      if (why !== null) return why ? info(me, why) : undefined
      if (sessionOf.has(me.id)) return info(me, 'Zaten bir oyundasın. Önce onu bitir.')
      if (sessionOf.has(target.id) || offerToTarget(target.id)) return info(me, `🎮 ${target.name} şu an meşgul.`)
      const old = offerOfSender(me.id)
      if (old) endOffer(old, 'cancelled')
      const o = { id: crypto.randomUUID().slice(0, 8), from: me.id, to: target.id, game: msg.game, exp: now + OFFER_TTL_MS }
      offers.set(o.id, o)
      send(target.ws, { t: 'game_offer', id: o.id, from: me.id, name: me.name, avatar: me.avatar, game: o.game, ttl: OFFER_TTL_MS })
      send(me.ws, { t: 'game_offer_out', id: o.id, to: target.id, name: target.name, game: o.game, ttl: OFFER_TTL_MS })
    },
    game_reply(me, msg) {
      const o = offers.get(msg.id)
      if (!o || o.to !== me.id) return
      if (!msg.accept) return endOffer(o, 'declined')
      const from = players.get(o.from)
      if (!from || from.room !== me.room || dist(from, me) > OFFER_RANGE || blockedWhy(from, me) !== null) {
        endOffer(o, 'invalid')
        return info(me, 'Oyun artık başlatılamıyor.')
      }
      if (sessionOf.has(me.id) || sessionOf.has(from.id)) {
        endOffer(o, 'invalid')
        return info(me, 'Biri başka bir oyunda.')
      }
      endOffer(o, 'accepted')
      start(from, me, o.game) // teklif eden birinci oyuncu (XOX'ta ilk hamle onda)
    },
    game_cancel(me) {
      const o = offerOfSender(me.id)
      if (o) endOffer(o, 'cancelled')
    },
    game_act(me, msg) {
      const now = Date.now()
      if (now - (me.lastGameAct ?? 0) < ACT_COOLDOWN_MS) return
      me.lastGameAct = now
      const s = sessions.get(sessionOf.get(me.id))
      if (!s) return
      const idx = s.players.indexOf(me)
      if (idx < 0) return
      s.last = now
      if (s.type === 'xox') actXox(s, idx, msg)
      else if (s.type === 'tod') actTod(s, idx, msg)
      else actLove(s, idx, msg)
    },
    game_leave(me) {
      const s = sessions.get(sessionOf.get(me.id))
      if (!s) return
      const other = s.players.find((p) => p !== me)
      if (other) info(other, `🎮 ${me.name} oyundan ayrıldı.`)
      endSession(s, 'left')
    },
  }

  // süre aşımı + koşul denetimi (ayrılma, oda değişimi, uzaklaşma, engel/DND)
  const sweep = setInterval(() => {
    const now = Date.now()
    for (const o of [...offers.values()]) {
      const a = players.get(o.from)
      const b = players.get(o.to)
      if (now > o.exp) endOffer(o, 'expired')
      else if (!a || !b || a.room !== b.room || blockedWhy(a, b) !== null) endOffer(o, 'invalid')
    }
    for (const s of [...sessions.values()]) {
      const [a, b] = s.players
      let why = null
      if (players.get(a.id) !== a || players.get(b.id) !== b) why = 'closed'
      else if (a.room !== b.room) why = 'room'
      else if (blockedWhy(a, b) !== null) why = 'blocked'
      else if (dist(a, b) > KEEP_RANGE) why = 'away'
      else if (now - s.last > IDLE_MS) why = 'idle'
      if (why) endSession(s, why)
    }
  }, 1000)
  sweep.unref?.()

  return {
    handlers,
    onLeave(me) {
      for (const o of [offerOfSender(me.id), offerToTarget(me.id)]) if (o) endOffer(o, 'invalid')
      const s = sessions.get(sessionOf.get(me.id))
      if (!s) return
      const other = s.players.find((p) => p !== me)
      if (other) info(other, `🎮 ${me.name} ayrıldı, oyun bitti.`)
      endSession(s, 'closed')
    },
  }
}
