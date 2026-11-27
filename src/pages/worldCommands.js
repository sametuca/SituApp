// Sohbet komutları (/yardım, /ev, /f, /ışınlan ...): World.jsx'ten ayrıldı; bağımlılıklar `c` ile verilir.
import { BEACH_START, TELEPORTS, ZONES } from '../world/layout'

// "Işınlan" gibi komutlardaki Türkçe karakterleri sadeleştir
export const normalize = (s) => s.toLowerCase().replaceAll('ı', 'i').replaceAll('ş', 's').replaceAll('ğ', 'g').replaceAll('ö', 'o').replaceAll('ü', 'u').replaceAll('ç', 'c')

/** c = { say, net, focusRef, home, venue, goTo, ownHome, leaveVenue, visit, setHelp, setPanel, setIntroActive } */
export function runWorldCommand(text, c) {
  const { say, net, focusRef, home, venue, goTo, ownHome, leaveVenue, visit, setHelp, setPanel, setIntroActive } = c
  const [raw, ...args] = text.slice(1).trim().split(/\s+/)
  const cmd = normalize(raw ?? '')
  if (['yardim', 'help', 'h'].includes(cmd)) return setHelp(true)
  if (cmd === 'mekanlar') {
    ZONES.forEach((z) => say(`${z.emoji} ${z.name} — ${z.desc}`))
    return
  }
  if (cmd === 'yakindakiler') {
    const f = focusRef.current
    const near = [...net.remotes.current.values()]
      .map((r) => ({ name: r.name, d: Math.hypot(r.x - f.x, r.z - f.z) }))
      .filter((r) => r.d < 15)
      .sort((a, b) => a.d - b.d)
    say(near.length ? `Yakınındakiler: ${near.map((r) => `${r.name} (${Math.round(r.d)} m)`).join(', ')}` : 'Yakınında kimse yok. Kafe veya Kulüp’e uğrayabilirsin!')
    return
  }
  if (['ev', 'eve'].includes(cmd)) {
    if (home) return say('Zaten evdesin 🏠')
    if (venue) return say('Önce dışarı çık: /dışarı')
    goTo(ownHome())
    return say('🏠 Evine girdin.')
  }
  if (['disari', 'cik', 'sehir'].includes(cmd)) {
    if (venue) {
      leaveVenue()
      return say('Şehre döndün.')
    }
    if (!home) return say('Zaten dışarıdasın 🌳')
    goTo('city')
    return say('Şehre döndün.')
  }
  if (['f', 'fisilda', 'fisilti'].includes(cmd)) {
    const [who, ...rest] = args
    const msg = rest.join(' ').trim()
    if (!who || !msg) return say('Örnek: /f Elif Bugün çok güzelsin 🤫')
    const peer = net.roster.find((p) => normalize(p.name) === normalize(who)) ?? net.roster.find((p) => normalize(p.name).startsWith(normalize(who)))
    if (!peer) return say(`“${who}” burada yok. Fısıldamak için aynı yerde olmalısınız.`)
    if (!net.sendWhisper(msg, peer.id)) say('Şu an çevrimdışısın.')
    return
  }
  if (['ayarlar', 'ayar'].includes(cmd)) return setPanel('settings')
  if (['gardirop', 'kiyafet'].includes(cmd)) return setPanel('wardrobe')
  if (cmd === 'engelle') {
    const who = args.join(' ')
    const peer = net.roster.find((p) => normalize(p.name) === normalize(who))
    if (!who) return say('Kimi? Örnek: /engelle Elif (yakınındakiler için). Listeyi Ayarlar’dan yönet.')
    if (!peer) return say(`“${who}” burada yok. Karakterine tıklayıp menüden de engelleyebilirsin.`)
    net.block(peer.id)
    return
  }
  if (cmd === 'davet') {
    const who = args.join(' ')
    if (!who) return say('Kimi? Örnek: /davet Elif')
    net.invite({ name: who })
    return
  }
  if (['ziyaret', 'misafir'].includes(cmd)) {
    const who = args.join(' ')
    if (!who) return say('Kimin evine? Örnek: /ziyaret Elif')
    visit(who)
    return
  }
  if (cmd === 'kapi') {
    const open = ['ac', 'acik'].includes(normalize(args[0] ?? ''))
    const close = ['kapat', 'kapali'].includes(normalize(args[0] ?? ''))
    if (!open && !close) return say('Örnek: /kapı aç (herkes gelebilir) ya da /kapı kapat (yalnızca davetliler)')
    net.setHomeOpen(open)
    return
  }
  if (['intro', 'arasahne'].includes(cmd)) {
    if (home || venue) return say('Ara sahneyi izlemek için önce şehirde olmalısın: /dışarı')
    focusRef.current.teleport = [BEACH_START.x, BEACH_START.z, BEACH_START.ry]
    setIntroActive(true)
    return
  }
  if (['isinlan', 'tp', 'git'].includes(cmd)) {
    if (home || venue) return say('Işınlanmak için önce dışarı çık: /dışarı')
    const id = TELEPORTS[normalize(args[0] ?? '')] ?? TELEPORTS[(args[0] ?? '').toLowerCase()]
    const z = ZONES.find((zn) => zn.id === id)
    if (!z) return say('Nereye? Örnek: /ışınlan kafe — lobi, kafe, kulüp, park, plaj')
    window.dispatchEvent(new CustomEvent('situapp:tp', { detail: z.id }))
    focusRef.current.teleport = z.spawn
    return say(`${z.emoji} ${z.name}’a ışınlandın.`)
  }
  say('Bilinmeyen komut. /yardım yazarak komutları görebilirsin.')
}
