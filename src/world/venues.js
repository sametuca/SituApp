// Girilebilen mekânların ortak verisi. Mekân iç odası, ev odası gibi ayrı bir sahnedir (oda adı: `venue:<id>`).
// Şehirdeki binalar `label` alanıyla eşleşir (layout.js BUILDINGS'teki etiketle BİREBİR aynı).
// Bu dosya; iç mekân çizimi, NPC'ler, ses/müzik ve etkinlikler arasındaki ANLAŞMA noktasıdır: kimlikleri/anchor'ları değiştirmeden önce hepsini düşün.
//
// İç mekân koordinatları: orijin = oda merkezi, giriş kapısı güney duvarında (+z), kuzey (-z) arka duvar, avatar +z'ye bakar.
// Oda boyutu hepsinde aynı: VENUE_ROOM. `npc`: mekânın sabit karakteri (konum x,z ve bakış ry; ry=0 → güneye/girişe bakar).
// `type`: iç mekân şablonu → cafe | bakery | dessert | icecream | tea | books | fastfood | bar | club | arcade | salon | studio | shop | guide

export const VENUE_ROOM = { hw: 6, hd: 5, wallH: 3.6, spawn: [0, 3.4], exit: { x: 0, z: 4.1, radius: 1.7 } }

export const VENUES = [
  { id: 'rehber', label: '🧭 Rehber Merkezi', name: 'Rehber Merkezi', emoji: '🧭', type: 'guide', desc: 'Yeni gelenlere yol gösterir.',
    npc: { name: 'Rehber Mira', avatar: 'mira', x: 0, z: -3.3, ry: 0, lines: ['Hoş geldin! Haritayı sağ üstte bulursun 🗺️', 'Kafe Sokağı sakin sohbetler, Kulüp enerji için ☕🪩', 'Birine yaklaşıp 💗’e basarsan jest gönderebilirsin.'] } },
  { id: 'kuafor', label: '💇 Kuaför & Stil', name: 'Kuaför & Stil', emoji: '💇', type: 'salon', desc: 'Yeni bir görünüm zamanı.',
    npc: { name: 'Stilist Elif', avatar: 'elif', x: 3.2, z: -3, ry: 0.4, lines: ['Aynada kendine bakmak ister misin? ✨', 'Saç rengi ve aksesuarlar gardıropta, Ayarlar’dan 👗', 'Bugün çok şıksın, söylemiş olayım 💇'] } },
  { id: 'foto', label: '📸 Fotoğraf Stüdyosu', name: 'Fotoğraf Stüdyosu', emoji: '📸', type: 'studio', desc: 'Pastel kareler yakala.',
    npc: { name: 'Fotoğrafçı Ege', avatar: 'ege', x: -3, z: -3, ry: -0.3, lines: ['Gülümse! 📸', 'Dışarıdaki işaretli noktada da kare çekebilirsin.', 'İki kişi poz verince albüm daha tatlı oluyor 💞'] } },
  { id: 'tatli', label: '🍰 Tatlı Dükkanı', name: 'Tatlı Dükkanı', emoji: '🍰', type: 'dessert', desc: 'Şekerli bir mola.',
    npc: { name: 'Pastacı Zeynep', avatar: 'zeynep', x: 0, z: -3.4, ry: 0, lines: ['Bugünün tatlısı çilekli rüya 🍓', 'Tatlı paylaşmak flörtün en tatlı yolu 😉', 'Bir dilim ister misin?'] } },
  { id: 'kafe', label: '☕ Kafe', name: 'Kafe', emoji: '☕', type: 'cafe', desc: 'Samimi sohbetler için.',
    npc: { name: 'Barista Kaan', avatar: 'kaan', x: 0, z: -3.4, ry: 0, lines: ['Bir kahve? Sütlü mü sade mi? ☕', 'Masayı paylaşmak istersen yanına oturabilirsin.', 'Buranın en sevilen köşesi pencere kenarı 🌿'] } },
  { id: 'kitapkafe', label: '📚 Kitap Kafe', name: 'Kitap Kafe', emoji: '📚', type: 'books', desc: 'Kitaplar ve sessiz sohbet.',
    npc: { name: 'Kütüphaneci Deniz', avatar: 'deniz', x: -3.5, z: -3.4, ry: 0.3, lines: ['Sessiz sohbet serbest 🤫📚', 'Son zamanlarda en çok okunan: “Yıldızların Altında”.', 'Bir kitap seç, birlikte oku 💫'] } },
  { id: 'firin', label: '🥐 Fırın', name: 'Fırın', emoji: '🥐', type: 'bakery', desc: 'Sıcak, taze kokular.',
    npc: { name: 'Fırıncı Mira', avatar: 'mira', x: 0, z: -3.4, ry: 0, lines: ['Taze çıktı! 🥐', 'Sabah buluşmalarının vazgeçilmezi.', 'Simit mi poğaça mı?'] } },
  { id: 'cayevi', label: '🍵 Çay Evi', name: 'Çay Evi', emoji: '🍵', type: 'tea', desc: 'İnce belli bardakta sohbet.',
    npc: { name: 'Çaycı Ege', avatar: 'ege', x: 3.4, z: -3.4, ry: -0.3, lines: ['Demli mi açık mı? 🍵', 'Çay yanında muhabbet bedava.', 'Bir tavla atar mısın? 🎲'] } },
  { id: 'kulup', label: '🪩 Gece Kulübü', name: 'Gece Kulübü', emoji: '🪩', type: 'club', desc: 'Müzik, dans ve enerji.',
    npc: { name: 'DJ Kaan', avatar: 'kaan', x: 0, z: -3.7, ry: 0, lines: ['Pist senin! 🪩', 'Karşılıklı dans için birine 💃 gönder.', 'İstek şarkı var mı? 🎶'] } },
  { id: 'bar', label: '🍹 Bar', name: 'Bar', emoji: '🍹', type: 'bar', desc: 'Kokteyller ve loş ışık.',
    npc: { name: 'Barmen Deniz', avatar: 'deniz', x: -2, z: -3.4, ry: 0.2, lines: ['Alkolsüz kokteyl önerim: Gün Batımı 🌅', 'Bar tezgâhında sohbet kolay açılır 😉', 'Ne içersin?'] } },
  { id: 'oyun', label: '🎮 Oyun Salonu', name: 'Oyun Salonu', emoji: '🎮', type: 'arcade', desc: 'İki kişilik eğlence.',
    npc: { name: 'Görevli Elif', avatar: 'elif', x: 3.6, z: -3.4, ry: -0.3, lines: ['XOX, aşk testi, doğruluk-cesaret… 🎮', 'Birine yaklaş, menüden “Oyun oyna”yı seç.', 'Yüksek skor yok ama eğlence var!'] } },
  { id: 'fastfood', label: '🍔 Fast Food', name: 'Fast Food', emoji: '🍔', type: 'fastfood', desc: 'Hızlı ve lezzetli.',
    npc: { name: 'Kasiyer Zeynep', avatar: 'zeynep', x: 0, z: -3.4, ry: 0, lines: ['Menü hazır! 🍔', 'Patates paylaşmak şart 🍟', 'İki kişilik menü avantajlı 😉'] } },
  { id: 'dondurma', label: '🍦 Dondurmacı', name: 'Dondurmacı', emoji: '🍦', type: 'icecream', desc: 'Soğuk ve tatlı.',
    npc: { name: 'Dondurmacı Ege', avatar: 'ege', x: 0, z: -3.4, ry: 0, lines: ['Çilek mi vanilya mı? 🍦', 'Yaz geldi, plaj yakın 🏖️', 'İkisini birden yap, külah kırılmaz!'] } },
  { id: 'surf', label: '🏄 Sörf Dükkanı', name: 'Sörf Dükkanı', emoji: '🏄', type: 'shop', desc: 'Dalga için her şey.',
    npc: { name: 'Sörfçü Kaan', avatar: 'kaan', x: -3, z: -3.4, ry: 0.3, lines: ['Dalgalar bugün harika 🌊', 'Gün batımında plaj bir başka güzel 🌅', 'Şezlongda yan yana oturmak da bir sörf sayılır 😄'] } },
  { id: 'plajbar', label: '🥤 Bar', name: 'Plaj Barı', emoji: '🥤', type: 'bar', desc: 'Serin içecekler.',
    npc: { name: 'Barmen Elif', avatar: 'elif', x: 0, z: -3.4, ry: 0, lines: ['Limonata mı smoothie mi? 🥤', 'Plajın en serin köşesi burası.', 'Şemsiyenin altında sohbet daha tatlı 🏖️'] } },
]

export const VENUE_BY_ID = Object.fromEntries(VENUES.map((v) => [v.id, v]))
export const VENUE_BY_LABEL = Object.fromEntries(VENUES.map((v) => [v.label, v]))
export const venueRoom = (id) => `venue:${id}`
export const isVenueRoom = (room) => typeof room === 'string' && room.startsWith('venue:')
export const venueIdOf = (room) => (isVenueRoom(room) ? room.slice(6) : null)
