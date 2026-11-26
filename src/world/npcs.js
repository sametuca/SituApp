// NPC verisi (sunucu da okur: server/features/npcs.js → saf JS, React/three yok).
//
// Şehir NPC'leri bu dosyada tanımlı; mekân NPC'leri venues.js `npc` anchor'larından türetilir (kimlik: `v:<mekân>`).
// where: 'city' | mekân kimliği. Konum ve rota HERKESTE AYNI görünsün diye paylaşılan saatin (Date.now) saf fonksiyonudur;
// sunucu hiçbir NPC konumu yollamaz.
//
// Rota: { pts: [[x,z],...], mode: 'loop' | 'pingpong', speed (m/sn), pause (her noktada bekleme sn) }
// Seçenek: { label, reply: [metin, ...] }  (cevaplardan biri rastgele gösterilir)
import { VENUES } from './venues.js'
import { G } from './layout.js'

export const TALK_RADIUS = 2.8 // m: "Konuş" istemi
export const GREET_RADIUS = 5 // m: yaklaşınca selam balonu, oyuncuya döner
export const CLICK_RADIUS = 9 // m: tıklayarak konuşma
export const SERVER_RADIUS = 13 // m: sunucu denetimi (gecikme payı dahil)

const SOLO = { kind: 'dance', lead: false, t0: 0 }
const SIT_STOOL = { kind: 'sit', style: 'stool' }
const GUARD = { kind: 'guard' }
const BLACK_SUIT = { h: 0, e: -1, o: '#1a1b22' }

// avatar: zeynep, elif, mira (pembe) | deniz, kaan, ege (mavi)
const CITY = [
  {
    id: 'gazeteci', avatar: 'elif', name: 'Gazeteci Elif', role: '📰', x: -4.6, z: -4.4, ry: 0.9,
    lines: ['Günün haberi: lobide herkes birbirine selam veriyor! 📰', 'Şehirde ne var ne yok, ilk ben duyarım 🗞️', 'Selam göndermek için karaktere tıklaman yeter 👋', 'Bugünün manşeti: “Park bankları doldu taştı” 😄'],
    shop: [
      { id: 'newspaper', label: 'Günün Gazetesi', emoji: '📰', price: 3, style: 'read', color: '#fffaf2', reply: 'Sıcak sıcak günün manşetleri! 📰✨' },
    ],
    options: [
      { label: 'Öneri iste', reply: ['Bu akşam Kafe Sokağı çok sakin, sohbet için birebir ☕', 'Gün batımında plaja git, manşet fotoğrafı orada çekiliyor 🌅'] },
      { label: 'Hikâye anlat', reply: ['Geçen gün iki yabancı aynı gazeteyi almak için uzandı, elleri değdi… Şimdi her sabah birlikte okuyorlar 💞', 'Bir kadın bana “şu mavi tişörtlü kim?” diye sordu. Dönüp baktım, mavi tişörtlü de aynısını soruyordu 😄'] },
    ],
  },
  {
    id: 'balon', avatar: 'ege', name: 'Balon Satıcısı Ege', role: '🎈', x: 5.4, z: 4.8, ry: -0.7, prop: 'balloons',
    lines: ['Balon, balon! Rengârenk balon! 🎈', 'Kalp şeklinde olanı birine hediye edebilirsin 💗', 'Meydandaki yerimdeyim, her zaman taze balon var 😄', 'Pembe mi mavi mi? İkisi de olur 🎀'],
    shop: [
      { id: 'balloon_pink', label: 'Pembe Balon', emoji: '🎈', price: 5, style: 'hold', color: '#ff9ec7', reply: 'Uçup gitmesin, sıkı tut! 🎈😄' },
      { id: 'balloon_blue', label: 'Mavi Balon', emoji: '🎈', price: 5, style: 'hold', color: '#7fcdf3', reply: 'Gökyüzü rengi balonun hazır! 🎈✨' },
    ],
    options: [
      { label: '🎈 Balon Patlatma Oyunu', action: 'open_mg:balloon', reply: ['Parti şapkanı tak, bombalara dokunmadan balonları patlat! 🎈✨'] },
      { label: 'Öneri iste', reply: ['Çeşmenin başında buluşmak klasik ama hep işe yarar ⛲', 'Park çardağı akşamüstü çok romantik oluyor 🌳'] },
      { label: 'Hikâye anlat', reply: ['Bir balon uçup gitti, peşinden koşan çocuk bir de baktı ki yeni arkadaş edinmiş 🎈', 'Bir çift buluştuğunda iki balonun ipini birbirine bağlamıştı. Hâlâ birlikteler 💞'] },
    ],
  },
  {
    id: 'muzisyen', avatar: 'deniz', name: 'Sokak Müzisyeni Deniz', role: '🎸', x: 5.35, z: -17.2, ry: -1.45, pose: SIT_STOOL, prop: 'stool',
    lines: ['Bu şarkıyı sana çalıyorum 🎶', 'Kafe Sokağı’nın sesi benim 🎸', 'Müzik, sohbetin en tatlı başlangıcı 😉', 'Dinleyene bir kahve ısmarlarım… yarın 😄'],
    options: [
      { label: 'Öneri iste', reply: ['Müzik dinleyerek kahve içmek için Starbucket’in pencere kenarı ideal ☕', 'Dans etmek istersen Gece Kulübü’ne uğra, pist hiç boş kalmıyor 🪩'] },
      { label: 'Hikâye anlat', reply: ['Bir akşam çaldığım şarkıya biri eşlik etti, ses ses derken ikisi de sustu, sadece gülümsediler 🎶', 'İlk şarkımı bir banka oturup yazdım. Yanıma oturan kişi nakaratı buldu 💫'] },
    ],
  },
  {
    id: 'cicekci', avatar: 'zeynep', name: 'Çiçekçi Zeynep', role: '🌷', x: -4.6, z: -22.4, ry: -0.9, prop: 'flowers',
    lines: ['Taze laleler geldi! 🌷', 'Çiçek, “seni düşündüm”ün en kibar hali 💐', 'Kalp mi papatya mı? Ben papatyaya bayılıyorum 🌼', 'Birine çiçek jesti göndermeyi dene 😉'],
    shop: [
      { id: 'flower_tulip', label: 'Taze Lale', emoji: '🌷', price: 5, style: 'smell', color: '#ff8fb8', reply: 'Mis gibi taze laleler, keyfini çıkar 🌷✨' },
    ],
    options: [
      { label: 'Öneri iste', reply: ['Çiçek göndermek için en iyi yer Park, hem bahar kokusu hem sakinlik 🌳', 'Tatlı Kafası’ndan bir şey alıp çiçekle birlikte sürpriz yap 🍰'] },
      { label: 'Hikâye anlat', reply: ['Her sabah aynı kişi bir papatya alırdı. Bir gün sebebini sordum: “Birine ‘sevmiyor’ dedirtmemek için” dedi 🌼', 'Bir gün iki kişi aynı buketi almak istedi, buketi ikiye bölüp birlikte yürüdüler 💐'] },
    ],
  },
  {
    id: 'bahcivan', avatar: 'kaan', name: 'Bahçıvan Kaan', role: '🌱', x: -33, z: -7.5, ry: 0,
    route: { pts: [[-33, -7.5], [-27, -7.5]], mode: 'pingpong', speed: 0.7, pause: 4 },
    lines: ['Ağaçlar bu yıl çok güzel yeşerdi 🌳', 'Park banklarında iki kişi oturunca sohbet açılır 😉', 'Çardağın altı yaz sıcağında bir cennet 🌿', 'Çiçekleri sularken dünyayı unutuyorum 🌱'],
    options: [
      { label: '🚲 Bisiklet Engel Yarışı', action: 'open_mg:bike', reply: ['Forma hazır! Park yolunda engellerden kaçıp hız şeritlerini yakala 🚲⚡'] },
      { label: 'Öneri iste', reply: ['Park banklarından birine otur, biri mutlaka yanına gelir 😉', 'Çardağın önü fotoğraf için güzel, ışığı yumuşak 📸'] },
      { label: 'Hikâye anlat', reply: ['Bir fidanı iki kişi birlikte dikmişti. Şimdi her yıl onun gölgesinde buluşuyorlar 🌳', 'Bu bank var ya, üç evliliğe şahit oldu. Söylemem ama… 🤫'] },
    ],
  },
  {
    id: 'kopekci', avatar: 'mira', name: 'Köpek Gezdiren Mira', role: '🐕', x: -30, z: 6.3, ry: 0, companion: 'dog',
    route: { pts: [[-30, 6.3], [-34.5, 4.5], [-36.3, 0], [-34.5, -4.5], [-30, -6.3], [-25.5, -4.5], [-23.7, 0], [-25.5, 4.5]], mode: 'loop', speed: 1.0, pause: 2.5 },
    lines: ['Pofuduk her gün çardağın etrafında dört tur atar 🐕', 'Köpeği olan biriyle sohbet açmak çok kolay, dene 😄', 'Pofuduk senden hoşlandı galiba, kuyruğu sallanıyor 🐾', 'Parkta yürüyüş en iyi buluşma sebebi 🌳'],
    options: [
      { label: 'Öneri iste', reply: ['Parkta yürüyüş yapanlara selam vermeyi dene, çoğu sohbete açık 👋', 'Yürüyüşten sonra Çay Evi’nde çay iyi gider 🍵'] },
      { label: 'Hikâye anlat', reply: ['Pofuduk bir gün tanımadığı birinin ayağına yatıp kalktı. Şimdi o kişi hafta sonlarının sahibi 🐶💞', 'Bir gün iki köpeğin ipi dolandı, sahipleri gülerek çözdü. Sonrası çay 🍵'] },
    ],
  },
  {
    id: 'cankurtaran', avatar: 'ege', name: 'Kendini Mafya Sanan Hırtcan', role: '🕶️', x: 4.2, z: 44, ry: -0.35,
    pose: GUARD, look: BLACK_SUIT, scale: 1.08,
    lines: [
      'Şezlongun yoksa plajı terket burası bizim! 🕶️',
      'Havlunu serdin 500 TL işgaliye alayım hemşerim 😎',
      'Deniz herkesin ama kum bizim koçum, ona göre!',
      'Valeye bırakmadın mı terlikleri? Ayıp oluyor 😤',
    ],
    options: [
      { label: 'Plaj halkın değil mi?', reply: ['Halk da biziz hemşerim, şezlong fişini göster yoksa yürü! 😎', 'Kanun var nizam var… ama şemsiye benim 🏖️'] },
      { label: 'Şezlong ne kadar?', reply: ['Sana özel 499,99 TL, yanında bir de sert bakış bedava 🕶️', 'Müzik açarsan ekstra tarife yazarım koçum 😄'] },
    ],
  },
  {
    id: 'dondurmaci', avatar: 'zeynep', name: 'Dondurmacı Zeynep', role: '🍦', x: -5.8, z: 42, ry: 0.35, prop: 'icecart', pose: { kind: 'push' },
    lines: ['Dondurmaaa! Çilekli, vanilyalı, çikolatalı! 🍦', 'İki top alana üçüncüsü benden 😉', 'Arabam hep burada, sıcak bastırınca hemen uğra 🔔', 'Dondurma paylaşmak flörtün en tatlı yolu 🍓'],
    shop: [
      { id: 'ice_strawberry', label: 'Çilekli Dondurma', emoji: '🍦', price: 5, style: 'eat', color: '#ff9ec7', color2: '#fff3c8', reply: 'Afiyet olsun! Çilekli külahın hazır 🍦🍓' },
      { id: 'ice_choco', label: 'Çikolatalı Dondurma', emoji: '🍦', price: 5, style: 'eat', color: '#7a4b32', color2: '#f5d7b0', reply: 'Bol çikolatalı dondurman hazır, afiyet olsun! 🍫🍦' },
    ],
    options: [
      { label: 'Öneri iste', reply: ['Dondurmanı al, kıyıya otur, dalga sesi eşlik etsin 🌊', 'Nevarlanda’e da uğra, külahlar özel 🍦'] },
      { label: 'Hikâye anlat', reply: ['İki kişi aynı anda son çilekli külahı istedi. Birbirlerine uzatınca külah kırıldı, kahkaha koptu 🍓😄', 'Bir kız “eksik para” çıkardı, arkasındaki çocuk “ben ısmarlayayım” dedi. İkisi de şimdi kuyrukta bekler 🍦'] },
    ],
  },
  {
    id: 'guvenlik', avatar: 'kaan', name: 'Bodyguard Kaan', role: '🕶️', x: 24.15, z: -4.95, ry: 0,
    pose: GUARD, look: BLACK_SUIT, scale: 1.12,
    lines: ['Hoş geldin, içeride herkese yer var ama kavga yok! 🕶️', 'Kapıdaki düzene dikkat, sıra sıra geçelim 😄', 'Rahatsız eden olursa haber ver, ben buradayım 👀', 'Klüp’te iyi eğlenceler 🪩'],
    options: [
      { label: 'Öneri iste', reply: ['İçerideki pist akşamları çok canlı, DJ’e istek şarkı söyle 🎶', 'Kalabalık sevmezsen önce Hard Rök’te bir şey iç, sonra piste geç 🍹'] },
      { label: 'Hikâye anlat', reply: ['Bir gece iki kişi pistte aynı anda aynı adımı yaptı. Sonra dans bütün gece sürdü 💃', 'Yıllardır kapıdayım, en güzel manzara içeriden dışarı sızan kahkaha 🪩'] },
    ],
  },
  {
    id: 'guvenlik2', avatar: 'deniz', name: 'Bodyguard Deniz', role: '🕶️', x: 27.85, z: -4.95, ry: 0,
    pose: GUARD, look: BLACK_SUIT, scale: 1.12,
    lines: ['İyi akşamlar, buyurun içeri 🕶️', 'Kıyafet tamam, enerji tamam — geçebilirsin ✨', 'Pist bu gece alev alıyor, keyfine bak 🪩', 'Gözüm kapıda, içeride rahatça eğlen 👀'],
    options: [
      { label: 'İçeride ne var?', reply: ['DJ Kaan kabinde, pist kalabalık ve ışıklar yanıyor 🪩', 'Arkadaşlarınla dans edip müzik seçebilirsin 🎶'] },
      { label: 'Hikâye anlat', reply: ['Geçen hafta biri kapıda adını unuttu, heyecanla “VIP” dedi. Gülüştük, içeri aldık 😄', 'Kaan’la yıllardır bu kapıyı tutuyoruz, içeriden mutsuz çıkan görmedim 🕶️'] },
    ],
  },
  {
    id: 'hayran', where: 'kulup', avatar: 'elif', name: 'DJ Hayranı Elif', role: '🎧', x: -1.4, z: 0.8, ry: 3.1, pose: SOLO,
    lines: ['DJ Kaan bu akşam harika çalıyor!! 🎧', 'Ben bu şarkıyı bin kere dinledim ve hâlâ dans ediyorum 💃', 'Dans etmek için birine 💃 gönder, kabul ederse el ele dönersiniz 😍', 'Şarkıyı duyunca duramıyorum 🪩'],
    options: [
      { label: 'Öneri iste', reply: ['Cuma akşamları kulüpte konfeti yağıyor, kaçırma 🎉', 'Piste yalnız çıkmaktan çekinme, biri mutlaka katılır 💃'] },
      { label: 'Hikâye anlat', reply: ['Pistte yanımdaki kişiyle aynı anda “bu şarkıya bayılıyorum” diye bağırdık. İlk cümlemiz buydu 😂', 'Bir kere DJ benim için “kırmızı elbiseli kız için” diye şarkı çaldı. Hâlâ kırmızı giyiyorum ❤️'] },
    ],
  },
  {
    id: 'kediler', avatar: 'mira', name: 'Kedi Hanım Mira', role: '🐈', x: 5, z: -35, ry: 0.2, companion: 'cat',
    lines: ['Minnoş kimseyi sevmez ama seni sevdi 🐈', 'Kediler iyi insanı hemen tanır, bilirsin 😺', 'Mahalledeki bütün kedilerin adını biliyorum 🐾', 'Sokakta kedi görünce selam ver, o da cevap verir 😸'],
    options: [
      { label: 'Öneri iste', reply: ['Kafe Sokağı kediler için ideal, her kafede bir dost var 🐾', 'Kitap Kafe sessiz ve sıcak, tam kedilik bir yer 📚'] },
      { label: 'Hikâye anlat', reply: ['Bir kedi iki yabancıyı aynı kucakta uyuyarak tanıştırdı. Adı “Cupid” kaldı 💘🐈', 'Minnoş bir gün benim için bir çift çorap getirdi, sahibi de arkasından geldi. Çorabın sahibi şimdi çay arkadaşım 🧦'] },
    ],
  },
  {
    id: 'turist', avatar: 'deniz', name: 'Gezgin Deniz', role: '📷', x: 5.2, z: 13.2, ry: -0.8,
    lines: ['Fotoğraf noktasını gördün mü? Tam burada 📸', 'Bu şehirde her köşe bir kare 🌆', 'İki kişi poz verince albüm daha tatlı oluyor 💞', 'Fotoğraf makinesi hep yanımda, gülümsemeyi unutma 😄'],
    options: [
      { label: 'Öneri iste', reply: ['Fotoğraf Stüdyosu’nun önündeki işaretli noktada kare çek, ışık harika 📸', 'Gün batımında plajda çekilen kareler en tatlısı 🌅'] },
      { label: 'Hikâye anlat', reply: ['Bir gün kare çekerken arkaya biri girdi. Fotoğrafın en güzel yeri o sürpriz oldu 📷', 'Albümümün en sevdiğim karesi: iki yabancı aynı anda gülüyor ve haberleri yok 😊'] },
    ],
  },
  // Sahil Partisi (Beach Party) NPC'leri: plaja yeni inen oyuncuları canlı müzik ve dansla karşılar
  {
    id: 'beach_dj', worldPos: true, avatar: 'kaan', name: 'Beach DJ Mert', role: '🎧', x: 12.1, z: 57.6, ry: -0.58, pose: SOLO,
    lines: ['Sahil partisine hoş geldin! 🌴🪩', 'Müziği açtık, pist senin — birine 💃 gönderip dansa kaldır!', 'Güneş, deniz ve en iyi ritimler burada 🌊🎶'],
    options: [
      { label: 'Parti nasıl gidiyor?', reply: ['Enerji tavan! Yeni gelenler ilk burada tanışıyor 🪩✨', 'Birazdan gün batımı setine geçiyoruz, kaçırma 🌅'] },
      { label: 'Öneri iste', reply: ['Plajın sağında MakFit, solunda kendi evin var — her şey elinin altında! 🏖️', 'Quicksörf’te Sörfçü Kaan’la konuşup dalgalara da çıkabilirsin 🏄'] },
    ],
  },
  {
    id: 'beach_dancer1', worldPos: true, avatar: 'zeynep', name: 'Selin', role: '🪩', x: 9.2, z: 60.4, ry: -0.3, pose: SOLO,
    lines: ['Bu şarkıya bayılıyorum!! 🪩✨', 'Yeni mi geldin? Piste gel, birlikte dans edelim 💃', 'Sahil partisi her gün ayrı güzel 🌴🌊'],
    options: [
      { label: 'Nasıl dans ederim?', reply: ['Alttaki 2 tuşuna bas ya da birine tıklayıp dans teklifi gönder 💃✨'] },
    ],
  },
  {
    id: 'beach_dancer2', worldPos: true, avatar: 'ege', name: 'Arda', role: '🌴', x: 11.4, z: 61.8, ry: -0.9, pose: SOLO,
    lines: ['Plaka82’ye hoş geldin! 🌴🔥', 'Plajda tanışmak çok kolay, selam vermekten çekinme 👋', 'Akşam da Kulüp’e geçiyoruz, unutma 🪩'],
    options: [
      { label: 'Burada neler var?', reply: ['Hemen arkada voleybol, karşıda Teknel, sağda MakFit… Ada dopdolu! 🏖️'] },
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
  gym: ['Önce birkaç set ağırlık çalış, sonra ringe çık — yumrukların çok daha sert olur! 💪', 'Koşu bandı kondisyonunu ve günlük antrenman enerjini artırır 🏃', 'Haftalık boks lideri altın şampiyon kemerini belinde taşır 🏆'],
  teknel: ['Buz gibi içecekler dolapta, aldıkların çantana (Envanter) düşer 🎒', 'İstersen bir arkadaşına içki ısmarlayıp gönderebilirsin 🍻'],
}
const TYPE_STORY = {
  club: 'Bir gece pistte iki kişi aynı anda aynı şarkıya bağırdı, gerisi tarih 🪩',
  bar: 'Bir gün tezgâhta iki yabancı aynı içeceği isteyince birlikte gülüp paylaştılar 🍹',
  cafe: 'Bir sabah iki kişi son masa için anlaştı, kahvelerini birlikte içtiler ☕',
  gym: 'Geçen hafta son rauntta 1 canla aparkat atıp kemeri kapan bir çaylak hâlâ konuşuluyor 🥊',
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
  shop: v.type === 'teknel'
    ? [
        { id: 'teknel_beer', label: 'Soğuk Bira', emoji: '🍺', price: 8, style: 'eat', alcohol: true, toInv: true, reply: 'Buz gibi bira çantana eklendi! Envanterden içebilir veya ısmarlayabilirsin 🍺' },
        { id: 'teknel_wine', label: 'Kırmızı Şarap', emoji: '🍷', price: 12, style: 'eat', alcohol: true, toInv: true, reply: 'Kırmızı şarap çantana eklendi! 🍷' },
        { id: 'teknel_raki', label: 'Teknel Rakısı', emoji: '🥃', price: 14, style: 'eat', alcohol: true, toInv: true, reply: 'Teknel rakısı çantana eklendi — afiyet olsun! 🥃' },
        { id: 'teknel_soda', label: 'Soğuk Gazoz', emoji: '🥤', price: 5, style: 'eat', alcohol: false, toInv: true, reply: 'Serin gazoz çantana eklendi! 🥤' },
        { id: 'teknel_cheese', label: 'Peynir Tabağı', emoji: '🧀', price: 9, style: 'eat', alcohol: false, toInv: true, reply: 'Taze şarküteri peynir tabağı çantana eklendi! 🧀' },
      ]
    : undefined,
  options: [
    ...(v.id === 'surf'
      ? [
          { label: '🏄 Sörf Yarışına Katıl (2–10 kişi)', action: 'open_surf', reply: ['Sörf kıyafetin hazır! Dalgalardan kaç, en sona kalan kazanır! 🏄🌊'] },
          { label: '🏆 Sörf Puan Tablosu', action: 'open_surf_board', reply: ['İşte şehrin en iyi sörfçüleri! 🏆🌊'] },
        ]
      : []),
    ...(v.type === 'club'
      ? [{ label: '🪩 Ritim & Dans Savaşı (2–10 kişi)', action: 'open_mg:rhythm', reply: ['Disko ışıkları açıldı! Ritimle notalara bas, pistin kralı ol 🪩✨'] }]
      : []),
    ...(v.type === 'arcade'
      ? [{ label: '🎮 Renk Karosu — Düşmeden Kal!', action: 'open_mg:tiles', reply: ['Neon tulumun hazır! Söylenen renge koş, en sona kalan kazanır 🎮🔥'] }]
      : []),
    ...(v.type === 'cafe' || v.type === 'dessert'
      ? [{ label: '☕ Barista Sipariş Yarışı', action: 'open_mg:barista', reply: ['Önlüğünü taktın! Müşteri siparişlerini katman katman en hızlı hazırla ☕🍰'] }]
      : []),
    ...(v.type === 'salon'
      ? [{ label: '👗 Gardırobu aç', action: 'open_wardrobe', reply: ['İşte ayna hazır! Saç, kıyafet ve aksesuarlarını dilediğin gibi seç ✨'] }]
      : []),
    ...(v.type === 'gym'
      ? [
          { label: '🥊 Boks Ringine Çık', action: 'open_boxing', reply: ['Eldivenlerini giydin! Ringe çık, ritmi yakala ve şampiyon ol 🥊🔥'] },
          { label: '💪 Ağırlık Çalış (+Güç)', action: 'open_workout:str', reply: ['Sehpa hazır! Yeşil bölgede kaldır, gücünü katla 💪'] },
          { label: '🏃 Koşu Bandı (+Kondisyon)', action: 'open_workout:sta', reply: ['Koşu bandı açıldı! Ritmik adımlarla kondisyonunu artır 🏃⚡'] },
          { label: '🏆 Boks Sıralaması', action: 'open_boxing_board', reply: ['İşte MakFit’in haftalık şampiyonları! 🏆🥊'] },
        ]
      : []),
    ...(v.type === 'guide'
      ? [
          { label: '👗 Gardırop nerede?', action: 'open_wardrobe', reply: ['Soldaki 👗 düğmesinden (veya Toni & Güy’den) dilediğin zaman açabilirsin! Açıyorum ✨'] },
          { label: '🗺️ Mekanlara nasıl giderim?', reply: ['Sağ üstteki yuvarlak haritaya tıklayınca tüm şehir açılır; kafe, kulüp, plaj veya Toni & Güy’e tek tıkla ışınlanabilirsin 🗺️'] },
        ]
      : []),
    { label: 'Ne önerirsin?', reply: TYPE_TIPS[v.type] ?? TYPE_TIPS.cafe },
    ...(TYPE_STORY[v.type] ? [{ label: 'Hikâye anlat', reply: [TYPE_STORY[v.type]] }] : []),
  ],
}))

// AFK oyuncular: gerçekçi profilleriyle şehirde dinlenen oyuncular (kimisi dolu, kimisi sade profil).
const AFK_RAW = [
  {
    id: 'afk1',
    avatar: 'zeynep',
    name: 'melis.kaya',
    x: -19.6,
    z: -2.4,
    ry: 1.2,
    profile: {
      birthDate: '2001-06-18',
      age: 25,
      city: 'İzmir',
      instagram: '',
      x: '',
      socialPrivacy: 'friends',
      instagramLocked: true,
      xLocked: true,
      bio: 'Kahve kokusu ve gün batımı yürüyüşleri',
      tags: ['Kahve', 'Plaj', 'Fotoğraf', 'Tatlı'],
    },
  },
  {
    id: 'afk2',
    avatar: 'kaan',
    name: 'berke_34',
    x: 10.6,
    z: -1.2,
    ry: -1.9,
    profile: {
      birthDate: '1999-11-04',
      age: 27,
      city: 'İstanbul',
      instagram: '',
      x: '',
      socialPrivacy: 'friends',
      instagramLocked: true,
      xLocked: true,
      bio: 'Akşamları kulüpte müzik dinlemeyi severim',
      tags: ['Müzik', 'Gece hayatı', 'Spor', 'Oyun'],
    },
  },
  {
    id: 'afk3',
    avatar: 'mira',
    name: 'selinay_',
    x: -2.6,
    z: -33,
    ry: 2.6,
    profile: {
      birthDate: '2002-09-09',
      age: 24,
      city: 'Antalya',
      instagram: '',
      x: '',
      socialPrivacy: 'friends',
      instagramLocked: true,
      xLocked: false,
      bio: 'Resim, kediler ve sakin kafeler',
      tags: ['Sanat', 'Hayvanlar', 'Kahve', 'Bahçe'],
    },
  },
  {
    id: 'afk4',
    avatar: 'deniz',
    name: 'ardacan_06',
    x: 1.8,
    z: 23,
    ry: 0.4,
    profile: {
      birthDate: '2003-03-22',
      age: 23,
      city: 'Ankara',
      instagram: '',
      x: '',
      socialPrivacy: 'friends',
      instagramLocked: false,
      xLocked: true,
      bio: 'Yeni geldim, şehir turundayım.',
      tags: ['Kitap', 'Film'],
    },
  },
  {
    id: 'afk5',
    avatar: 'elif',
    name: 'elifnur.y',
    x: 17.5,
    z: 8.5,
    ry: -0.6,
    profile: {
      birthDate: '',
      age: null,
      city: '',
      instagram: '',
      x: '',
      bio: '',
      tags: [],
    },
  },
]
export const AFK_BOTS = AFK_RAW.map((b) => ({ ...b, x: G(b.x, b.z)[0], z: G(b.x, b.z)[1] }))

// NPC görünümü: oyunculardan ayırt edilsin diye her NPC'nin rolüne göre aksesuarı (şapka, gözlük, kulaklık…) ve ayağında rol halkası vardır.
const NPC_ACC = {
  gazeteci: ['hat', 'blue'], balon: ['hat', 'yellow'], muzisyen: ['headphones', 'lilac'], cicekci: ['flowers', 'mint'], bahcivan: ['hat', 'mint'],
  kopekci: ['shades', 'blue'], cankurtaran: ['shades', 'yellow'], dondurmaci: ['hat', 'peach'], guvenlik: ['shades', '#18181f'], guvenlik2: ['shades', '#18181f'], hayran: ['headphones', 'mint'],
  kediler: ['bunny', 'peach'], turist: ['hat', 'blue'],
  beach_dj: ['headphones', 'yellow'], beach_dancer1: ['shades', 'peach'], beach_dancer2: ['shades', 'mint'],
}
const VENUE_ACC = [['hat', 'mint'], ['hat', 'peach'], ['hat', 'yellow'], ['hat', 'blue'], ['hat', 'lilac']]
export const npcAccessory = (n) => {
  const a = NPC_ACC[n.id] ?? VENUE_ACC[[...n.id].reduce((x, c) => x + c.charCodeAt(0), 0) % VENUE_ACC.length]
  return { id: a[0], color: a[1] }
}
export const NPC_SCALE = 1.06 // oyuncu avatarlarından biraz büyük

// Şehir NPC'leri eski (v1) koordinatla yazıldı: harita genişleyince (layout.js G) konum ve rotalar yeni haritaya oturur.
const toMap = (n) => (n.worldPos ? n : {
  ...n,
  ...(n.x != null ? { x: G(n.x, n.z)[0], z: G(n.x, n.z)[1] } : {}),
  ...(n.route ? { route: { ...n.route, pts: n.route.pts.map(([x, z]) => G(x, z)) } } : {}),
})
export const NPCS = [...CITY.map((n) => ({ where: 'city', ...toMap(n) })), ...venueNpcs]
export const NPC_BY_ID = Object.fromEntries(NPCS.map((n) => [n.id, n]))
export const npcsFor = (where) => NPCS.filter((n) => n.where === where)
export const displayName = (n) => n.name // ikonsuz: NPC adı sade gösterilir

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
