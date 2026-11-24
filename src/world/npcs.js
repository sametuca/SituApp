// NPC verisi (sunucu da okur: server/features/npcs.js → saf JS, React/three yok).
//
// Şehir NPC'leri bu dosyada tanımlı; mekân NPC'leri venues.js `npc` anchor'larından türetilir (kimlik: `v:<mekân>`).
// where: 'city' | mekân kimliği. Konum ve rota HERKESTE AYNI görünsün diye paylaşılan saatin (Date.now) saf fonksiyonudur;
// sunucu hiçbir NPC konumu yollamaz.
//
// Rota: { pts: [[x,z],...], mode: 'loop' | 'pingpong', speed (m/sn), pause (her noktada bekleme sn) }
// Seçenek: { label, reply: [metin, ...] }  (cevaplardan biri rastgele gösterilir)
import { VENUES } from './venues.js'

export const TALK_RADIUS = 2.8 // m: "Konuş" istemi
export const GREET_RADIUS = 5 // m: yaklaşınca selam balonu, oyuncuya döner
export const CLICK_RADIUS = 9 // m: tıklayarak konuşma
export const SERVER_RADIUS = 13 // m: sunucu denetimi (gecikme payı dahil)

const SOLO = { kind: 'dance', lead: false, t0: 0 }
const SIT = { kind: 'sit', style: 'chair' }

// avatar: zeynep, elif, mira (pembe) | deniz, kaan, ege (mavi)
const CITY = [
  {
    id: 'gazeteci', avatar: 'elif', name: 'Gazeteci Elif', role: '📰', x: -4.6, z: -4.4, ry: 0.9,
    lines: ['Günün haberi: lobide herkes birbirine selam veriyor! 📰', 'Şehirde ne var ne yok, ilk ben duyarım 🗞️', 'Selam göndermek için karaktere tıklaman yeter 👋', 'Bugünün manşeti: “Park bankları doldu taştı” 😄'],
    options: [
      { label: '📍 Öneri iste', reply: ['Bu akşam Kafe Sokağı çok sakin, sohbet için birebir ☕', 'Gün batımında plaja git, manşet fotoğrafı orada çekiliyor 🌅'] },
      { label: '📖 Hikâye anlat', reply: ['Geçen gün iki yabancı aynı gazeteyi almak için uzandı, elleri değdi… Şimdi her sabah birlikte okuyorlar 💞', 'Bir kadın bana “şu mavi tişörtlü kim?” diye sordu. Dönüp baktım, mavi tişörtlü de aynısını soruyordu 😄'] },
    ],
  },
  {
    id: 'balon', avatar: 'ege', name: 'Balon Satıcısı Ege', role: '🎈', x: 5, z: 0, ry: 0, prop: 'balloons',
    route: { pts: [[5, 0], [3.5, 3.5], [0, 5], [-3.5, 3.5], [-5, 0], [-3.5, -3.5], [0, -5], [3.5, -3.5]], mode: 'loop', speed: 0.9, pause: 3 },
    lines: ['Balon, balon! Rengârenk balon! 🎈', 'Kalp şeklinde olanı birine hediye edebilirsin 💗', 'Çeşmenin etrafında tur atıyorum, yorulmuyorum bile 😄', 'Pembe mi mavi mi? İkisi de olur 🎀'],
    options: [
      { label: '📍 Öneri iste', reply: ['Çeşmenin başında buluşmak klasik ama hep işe yarar ⛲', 'Park çardağı akşamüstü çok romantik oluyor 🌳'] },
      { label: '📖 Hikâye anlat', reply: ['Bir balon uçup gitti, peşinden koşan çocuk bir de baktı ki yeni arkadaş edinmiş 🎈', 'Bir çift buluştuğunda iki balonun ipini birbirine bağlamıştı. Hâlâ birlikteler 💞'] },
    ],
  },
  {
    id: 'muzisyen', avatar: 'deniz', name: 'Sokak Müzisyeni Deniz', role: '🎸', x: 4.4, z: -16.5, ry: 0.5, pose: SIT, prop: 'stool',
    lines: ['Bu şarkıyı sana çalıyorum 🎶', 'Kafe Sokağı’nın sesi benim 🎸', 'Müzik, sohbetin en tatlı başlangıcı 😉', 'Dinleyene bir kahve ısmarlarım… yarın 😄'],
    options: [
      { label: '📍 Öneri iste', reply: ['Müzik dinleyerek kahve içmek için Kafe’nin pencere kenarı ideal ☕', 'Dans etmek istersen Gece Kulübü’ne uğra, pist hiç boş kalmıyor 🪩'] },
      { label: '📖 Hikâye anlat', reply: ['Bir akşam çaldığım şarkıya biri eşlik etti, ses ses derken ikisi de sustu, sadece gülümsediler 🎶', 'İlk şarkımı bir banka oturup yazdım. Yanıma oturan kişi nakaratı buldu 💫'] },
    ],
  },
  {
    id: 'cicekci', avatar: 'zeynep', name: 'Çiçekçi Zeynep', role: '🌷', x: -4.9, z: -25.5, ry: -0.9, prop: 'flowers',
    lines: ['Taze laleler geldi! 🌷', 'Çiçek, “seni düşündüm”ün en kibar hali 💐', 'Kalp mi papatya mı? Ben papatyaya bayılıyorum 🌼', 'Birine çiçek jesti göndermeyi dene 😉'],
    options: [
      { label: '📍 Öneri iste', reply: ['Çiçek göndermek için en iyi yer Park, hem bahar kokusu hem sakinlik 🌳', 'Tatlı Dükkanı’ndan bir şey alıp çiçekle birlikte sürpriz yap 🍰'] },
      { label: '📖 Hikâye anlat', reply: ['Her sabah aynı kişi bir papatya alırdı. Bir gün sebebini sordum: “Birine ‘sevmiyor’ dedirtmemek için” dedi 🌼', 'Bir gün iki kişi aynı buketi almak istedi, buketi ikiye bölüp birlikte yürüdüler 💐'] },
    ],
  },
  {
    id: 'bahcivan', avatar: 'kaan', name: 'Bahçıvan Kaan', role: '🌱', x: -33, z: -7.5, ry: 0,
    route: { pts: [[-33, -7.5], [-27, -7.5]], mode: 'pingpong', speed: 0.7, pause: 4 },
    lines: ['Ağaçlar bu yıl çok güzel yeşerdi 🌳', 'Park banklarında iki kişi oturunca sohbet açılır 😉', 'Çardağın altı yaz sıcağında bir cennet 🌿', 'Çiçekleri sularken dünyayı unutuyorum 🌱'],
    options: [
      { label: '📍 Öneri iste', reply: ['Park banklarından birine otur, biri mutlaka yanına gelir 😉', 'Çardağın önü fotoğraf için güzel, ışığı yumuşak 📸'] },
      { label: '📖 Hikâye anlat', reply: ['Bir fidanı iki kişi birlikte dikmişti. Şimdi her yıl onun gölgesinde buluşuyorlar 🌳', 'Bu bank var ya, üç evliliğe şahit oldu. Söylemem ama… 🤫'] },
    ],
  },
  {
    id: 'kopekci', avatar: 'mira', name: 'Köpek Gezdiren Mira', role: '🐕', x: -30, z: 6.3, ry: 0, companion: 'dog',
    route: { pts: [[-30, 6.3], [-34.5, 4.5], [-36.3, 0], [-34.5, -4.5], [-30, -6.3], [-25.5, -4.5], [-23.7, 0], [-25.5, 4.5]], mode: 'loop', speed: 1.0, pause: 2.5 },
    lines: ['Pofuduk her gün çardağın etrafında dört tur atar 🐕', 'Köpeği olan biriyle sohbet açmak çok kolay, dene 😄', 'Pofuduk senden hoşlandı galiba, kuyruğu sallanıyor 🐾', 'Parkta yürüyüş en iyi buluşma sebebi 🌳'],
    options: [
      { label: '📍 Öneri iste', reply: ['Parkta yürüyüş yapanlara selam vermeyi dene, çoğu sohbete açık 👋', 'Yürüyüşten sonra Çay Evi’nde çay iyi gider 🍵'] },
      { label: '📖 Hikâye anlat', reply: ['Pofuduk bir gün tanımadığı birinin ayağına yatıp kalktı. Şimdi o kişi hafta sonlarının sahibi 🐶💞', 'Bir gün iki köpeğin ipi dolandı, sahipleri gülerek çözdü. Sonrası çay 🍵'] },
    ],
  },
  {
    id: 'cankurtaran', avatar: 'ege', name: 'Cankurtaran Ege', role: '🛟', x: 3.8, z: 31, ry: 0.4,
    lines: ['Bugün deniz sakin, ama yine de dikkatli ol 🌊', 'Gün batımında şezlongda yan yana oturmak bir klasik 🌅', 'Gözüm üstünüzde, rahat edin 🛟', 'Şemsiyenin altı en serin yer, bence 😎'],
    options: [
      { label: '📍 Öneri iste', reply: ['Gün batımını izlemek için iki şezlong yan yana, tam senlik 🌅', 'Plaj Barı’nda serin bir şey içip sohbet et 🥤'] },
      { label: '📖 Hikâye anlat', reply: ['Bir yaz akşamı iki kişi aynı kum kalesini kurmaya çalıştı. Sonunda kale yıkıldı, ama arkadaşlık sağlam kaldı 🏰', 'Bir gün kayıp bir terlik buldum, sahibi de bulundu. Bir teşekkür bir sohbet… gerisi malum 😉'] },
    ],
  },
  {
    id: 'dondurmaci', avatar: 'zeynep', name: 'Dondurmacı Zeynep', role: '🍦', x: -5.6, z: 32, ry: 0.2, prop: 'icecart',
    route: { pts: [[-5.6, 32], [-5.6, 39]], mode: 'pingpong', speed: 0.8, pause: 5 },
    lines: ['Dondurmaaa! Çilekli, vanilyalı, çikolatalı! 🍦', 'İki top alana üçüncüsü benden 😉', 'Arabamın zili çalınca herkes koşuyor 🔔', 'Dondurma paylaşmak flörtün en tatlı yolu 🍓'],
    options: [
      { label: '📍 Öneri iste', reply: ['Dondurmanı al, kıyıya otur, dalga sesi eşlik etsin 🌊', 'Dondurmacı dükkânına da uğra, külahlar özel 🍦'] },
      { label: '📖 Hikâye anlat', reply: ['İki kişi aynı anda son çilekli külahı istedi. Birbirlerine uzatınca külah kırıldı, kahkaha koptu 🍓😄', 'Bir kız “eksik para” çıkardı, arkasındaki çocuk “ben ısmarlayayım” dedi. İkisi de şimdi kuyrukta bekler 🍦'] },
    ],
  },
  {
    id: 'guvenlik', avatar: 'kaan', name: 'Güvenlik Görevlisi Kaan', role: '🕶️', x: 23, z: -4.1, ry: 0,
    lines: ['Burada herkese yer var, kavga yok! 🕶️', 'Kapıdaki kuyruğa dikkat, sıra sıra 😄', 'Rahatsız eden olursa şikâyet düğmesi var, ben de bakarım 👀', 'Kulüpte iyi eğlenceler, ama nazik ol 🪩'],
    options: [
      { label: '📍 Öneri iste', reply: ['İçerideki pist akşamları çok canlı, DJ’e istek şarkı söyle 🎶', 'Kalabalık sevmezsen önce Bar’da bir şey iç, sonra piste geç 🍹'] },
      { label: '📖 Hikâye anlat', reply: ['Bir gece iki kişi pistte aynı anda aynı adımı yaptı. Sonra dans bütün gece sürdü 💃', 'Yıllardır kapıdayım, en güzel manzara içeriden dışarı sızan kahkaha 🪩'] },
    ],
  },
  {
    id: 'hayran', avatar: 'elif', name: 'DJ Hayranı Elif', role: '🎧', x: 29.5, z: -1.8, ry: 3.1, pose: SOLO,
    lines: ['DJ Kaan bu akşam harika çalıyor!! 🎧', 'Ben bu şarkıyı bin kere dinledim ve hâlâ dans ediyorum 💃', 'Dans etmek için birine 💃 gönder, kabul ederse el ele dönersiniz 😍', 'Şarkıyı duyunca duramıyorum 🪩'],
    options: [
      { label: '📍 Öneri iste', reply: ['Cuma akşamları kulüpte konfeti yağıyor, kaçırma 🎉', 'Piste yalnız çıkmaktan çekinme, biri mutlaka katılır 💃'] },
      { label: '📖 Hikâye anlat', reply: ['Pistte yanımdaki kişiyle aynı anda “bu şarkıya bayılıyorum” diye bağırdık. İlk cümlemiz buydu 😂', 'Bir kere DJ benim için “kırmızı elbiseli kız için” diye şarkı çaldı. Hâlâ kırmızı giyiyorum ❤️'] },
    ],
  },
  {
    id: 'kediler', avatar: 'mira', name: 'Kedi Hanım Mira', role: '🐈', x: 5, z: -35, ry: 0.2, companion: 'cat',
    lines: ['Minnoş kimseyi sevmez ama seni sevdi 🐈', 'Kediler iyi insanı hemen tanır, bilirsin 😺', 'Mahalledeki bütün kedilerin adını biliyorum 🐾', 'Sokakta kedi görünce selam ver, o da cevap verir 😸'],
    options: [
      { label: '📍 Öneri iste', reply: ['Kafe Sokağı kediler için ideal, her kafede bir dost var 🐾', 'Kitap Kafe sessiz ve sıcak, tam kedilik bir yer 📚'] },
      { label: '📖 Hikâye anlat', reply: ['Bir kedi iki yabancıyı aynı kucakta uyuyarak tanıştırdı. Adı “Cupid” kaldı 💘🐈', 'Minnoş bir gün benim için bir çift çorap getirdi, sahibi de arkasından geldi. Çorabın sahibi şimdi çay arkadaşım 🧦'] },
    ],
  },
  {
    id: 'turist', avatar: 'deniz', name: 'Gezgin Deniz', role: '📷', x: 5.2, z: 13.2, ry: -0.8,
    lines: ['Fotoğraf noktasını gördün mü? Tam burada 📸', 'Bu şehirde her köşe bir kare 🌆', 'İki kişi poz verince albüm daha tatlı oluyor 💞', 'Fotoğraf makinesi hep yanımda, gülümsemeyi unutma 😄'],
    options: [
      { label: '📍 Öneri iste', reply: ['Fotoğraf Stüdyosu’nun önündeki işaretli noktada kare çek, ışık harika 📸', 'Gün batımında plajda çekilen kareler en tatlısı 🌅'] },
      { label: '📖 Hikâye anlat', reply: ['Bir gün kare çekerken arkaya biri girdi. Fotoğrafın en güzel yeri o sürpriz oldu 📷', 'Albümümün en sevdiğim karesi: iki yabancı aynı anda gülüyor ve haberleri yok 😊'] },
    ],
  },
]

// ---- Mekân NPC'leri: venues.js anchor'larından ----
const TYPE_TIPS = {
  airport: ['Önce parka uğra, orası çok sakin 🌳', 'Bisikletle şehirde gezmek hem hızlı hem tatlı 🚲', 'Evin lobideki “Evim” binasında, ⚙️ menüsünden büyütebilirsin 🏡'],
  guide: ['Önce Kafe Sokağı’nı gez, sakin sohbetler orada başlıyor ☕', 'Haritayı sağ üstten açıp mekânlara ışınlanabilirsin 🗺️'],
  salon: ['Aksesuarlar gardıropta, kendine yakışanı seç 👗', 'Taç mı fiyonk mu? Bence ikisi de olur 👑'],
  studio: ['İki kişi poz verirse kare daha tatlı çıkar 📸', 'Dışarıdaki işaretli noktada da fotoğraf çekilir 😉'],
  dessert: ['Çilekli rüya favorim, birlikte paylaşın 🍓', 'Tatlı paylaşmak sohbeti açar, dene 😉'],
  cafe: ['Pencere kenarı masa en iyi köşe, sohbet kolay akar 🌿', 'Sütlü kahve ve bir sohbet, mükemmel başlangıç ☕'],
  books: ['Sessiz bir köşe seç, yanına biri gelirse kitaptan konuşun 📚', 'Birlikte okumak çok romantik bir fikir 💫'],
  bakery: ['Sabah buluşması için sıcak simit al, yanına çay 🥐', 'Poğaçayı ikiye bölüp paylaşmak klasik 😄'],
  tea: ['Çay yanında tavla, sohbet garanti 🎲', 'İnce belli bardakta ikinci çay hep hediye 🍵'],
  club: ['Pistte bir kişiyle göz göze gelirsen 💃 gönder 😉', 'Cuma gecesi konfeti var, kaçırma 🎉'],
  bar: ['Bar tezgâhında yan yana oturmak sohbetin kısa yolu 🍹', 'Alkolsüz “Gün Batımı” önerim, denemelisin 🌅'],
  arcade: ['XOX’ta kazanana kahve, kaybedene sohbet 🎮', 'Aşk testi bir buz kırıcı, dene 💘'],
  fastfood: ['İki kişilik menü avantajlı, patatesi paylaşın 🍟', 'Hızlı bir mola, uzun bir sohbet için iyi başlangıç 🍔'],
  icecream: ['Çilek ve vanilya birlikte en iyisi 🍦', 'Dondurmayı sahilde yemek bir başka güzel 🏖️'],
  shop: ['Dalgalı bir günde sahile git, huzur orada 🌊', 'Gün batımında şezlonglar çok güzel 🌅'],
}
const TYPE_STORY = {
  club: 'Bir gece pistte iki kişi aynı anda aynı şarkıya bağırdı, gerisi tarih 🪩',
  bar: 'Bir gün tezgâhta iki yabancı aynı içeceği isteyince birlikte gülüp paylaştılar 🍹',
  cafe: 'Bir sabah iki kişi son masa için anlaştı, kahvelerini birlikte içtiler ☕',
}

const venueNpcs = VENUES.filter((v) => v.npc).map((v) => ({
  id: `v:${v.id}`,
  where: v.id,
  avatar: v.npc.avatar,
  name: v.npc.name,
  role: v.emoji,
  x: v.npc.x,
  z: v.npc.z,
  ry: v.npc.ry ?? 0,
  lines: v.npc.lines,
  options: [
    // Havalimanı memuru: kiralama burada yapılır (action → istemci 'rent' mesajı yollar; sunucu karar verir)
    ...(v.type === 'airport'
      ? [
          { label: '🚲 Bisiklet · 20 🪙', action: 'rent_bike', reply: ['Bisikletin hazırlanıyor, anahtarı sana veriyorum! Şehirde B tuşuyla binebilirsin 🚲'] },
          { label: '🚗 Araba', action: 'rent_car', reply: ['Arabalar çok değerli… şimdilik bakiyen buna yetmiyor, camın ardından hayran kalabilirsin 😄'] },
        ]
      : []),
    { label: '📍 Ne önerirsin?', reply: TYPE_TIPS[v.type] ?? TYPE_TIPS.cafe },
    ...(TYPE_STORY[v.type] ? [{ label: '📖 Hikâye anlat', reply: [TYPE_STORY[v.type]] }] : []),
  ],
}))

// AFK botlar: oyuna girmiş ama klavyeden kalkmış gerçek oyuncu gibi görünen, hareketsiz 5 karakter (şehirde, kimlikleri Reddit tarzı).
// NPC değildir: konuşmaz, sunucu bilmez, görev/rozet saymaz. Yalnızca istemcide çizilir (NpcLayer AfkView).
export const AFK_BOTS = [
  { id: 'afk1', avatar: 'zeynep', name: 'pixel_pancake42', x: -19.6, z: -2.4, ry: 1.2 },
  { id: 'afk2', avatar: 'kaan', name: 'NotAGoodUsername', x: 10.6, z: -1.2, ry: -1.9 },
  { id: 'afk3', avatar: 'mira', name: 'sleepy_toaster_', x: -2.6, z: -33, ry: 2.6 },
  { id: 'afk4', avatar: 'deniz', name: 'midnight_bagel', x: 1.8, z: 23, ry: 0.4 },
  { id: 'afk5', avatar: 'elif', name: 'ThrowawayTulip', x: 17.5, z: 8.5, ry: -0.6 },
]

export const NPCS = [...CITY.map((n) => ({ where: 'city', ...n })), ...venueNpcs]
export const NPC_BY_ID = Object.fromEntries(NPCS.map((n) => [n.id, n]))
export const npcsFor = (where) => NPCS.filter((n) => n.where === where)
export const displayName = (n) => `${n.role} ${n.name}`

// ---- paylaşılan saatten deterministik konum ----
const planCache = new Map()
function plan(npc) {
  let p = planCache.get(npc.id)
  if (p) return p
  const r = npc.route
  let pts = r.pts
  if (r.mode === 'pingpong' && pts.length > 2) pts = [...pts, ...pts.slice(1, -1).reverse()]
  else if (r.mode === 'pingpong') pts = [...pts, ...pts.slice(0, 1)] // iki noktalı: gidip dön (başa dönüş = loop)
  const segs = []
  let total = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const walk = len / r.speed
    segs.push({ a, b, len, walk, start: total, pause: r.pause })
    total += walk + r.pause
  }
  // iki noktalı pingpong: sondaki ek nokta başa eşit olduğundan son parça sıfır uzunlukta; temizle
  p = { segs: segs.filter((s) => s.len > 0.001), total }
  // zamanı yeniden hesapla (sıfır uzunluklu parçalar atılınca başlangıçlar kayar)
  let acc = 0
  for (const s of p.segs) {
    s.start = acc
    acc += s.walk + s.pause
  }
  p.total = acc
  planCache.set(npc.id, p)
  return p
}

/** NPC'nin now (ms) anındaki konumu: { x, z, ry, moving }. Rotası yoksa sabit anchor. */
export function posAt(npc, now = Date.now()) {
  if (!npc.route) return { x: npc.x, z: npc.z, ry: npc.ry ?? 0, moving: false }
  const p = plan(npc)
  const t = (((now / 1000) % p.total) + p.total) % p.total
  for (const s of p.segs) {
    const local = t - s.start
    if (local < 0 || local >= s.walk + s.pause) continue
    const ry = Math.atan2(s.b[0] - s.a[0], s.b[1] - s.a[1]) // +z = ry 0 (avatar +z'ye bakar)
    if (local < s.walk) {
      const k = local / s.walk
      return { x: s.a[0] + (s.b[0] - s.a[0]) * k, z: s.a[1] + (s.b[1] - s.a[1]) * k, ry, moving: true }
    }
    return { x: s.b[0], z: s.b[1], ry, moving: false }
  }
  return { x: npc.x, z: npc.z, ry: npc.ry ?? 0, moving: false }
}
