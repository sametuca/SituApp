// Girilebilen mekânların ortak verisi. Mekân iç odası, ev odası gibi ayrı bir sahnedir (oda adı: `venue:<id>`).
// Şehirdeki binalar `label` alanıyla eşleşir (layout.js BUILDINGS'teki etiketle BİREBİR aynı).
// Bu dosya; iç mekân çizimi, NPC'ler, ses/müzik ve etkinlikler arasındaki ANLAŞMA noktasıdır: kimlikleri/anchor'ları değiştirmeden önce hepsini düşün.
//
// İç mekân koordinatları: orijin = oda merkezi, giriş kapısı güney duvarında (+z), kuzey (-z) arka duvar, avatar +z'ye bakar.
// Oda boyutu hepsinde aynı: VENUE_ROOM. `npc`: mekânın sabit karakteri (konum x,z ve bakış ry; ry=0 → güneye/girişe bakar).
// `type`: iç mekân şablonu → airport | cafe | bakery | dessert | icecream | tea | books | fastfood | bar | club | arcade | salon | studio | shop | guide

export const VENUE_ROOM = { hw: 8, hd: 5, wallH: 3.6, spawn: [0, 3.4], exit: { x: 0, z: 4.1, radius: 1.7 } }

export const VENUES = [
  // Başlangıç odası: herkes havalimanı çıkış salonunda doğar (şehirde kapısı yok; bisiklet varsayılan olarak herkeste açıktır).
  { id: 'havalimani', label: '✈️ Havalimanı', name: 'Havalimanı · Çıkış Salonu', emoji: '✈️', type: 'airport', desc: 'Kısa turu tamamla, kasabaya çık.',
    npc: { name: 'Selin', avatar: 'zeynep', x: 3.3, z: -3.7, ry: 0, lines: ['Hoş geldin. Çıkış kapısı hemen güneyde.', 'Önce önündeki yıldızı al, çantanı ve gardırobu dene.', 'Dışarı çıkınca B tuşuyla bisikletine binebilirsin.'] } },
  { id: 'rehber', label: '🧭 Tripadvisör', name: 'Tripadvisör', emoji: '🧭', type: 'guide', desc: 'Kasaba rehberi.',
    npc: { name: 'Rehber Mira', avatar: 'mira', x: 0, z: -3.3, ry: 0, lines: ['Sağ üstteki haritadan istediğin yere tek tıkla gidebilirsin.', 'Kafe Sokağı sakin, Klüp akşamları kalabalık oluyor.', 'Birine yaklaşıp selam ya da kahve ikramı gönderebilirsin.'] } },
  { id: 'kuafor', label: '💇 Toni & Güy', name: 'Toni & Güy', emoji: '💇', type: 'salon', desc: 'Yeni bir görünüm.',
    npc: { name: 'Stilist Elif', avatar: 'elif', x: 3.2, z: -3, ry: 0.4, lines: ['Bugün nasıl bir değişiklik yapalım?', 'Saç, kıyafet ve aksesuarları aynadan ya da soldaki gardıroptan düzenleyebilirsin.', 'Bu tonlar sana yakışmış.'] } },
  { id: 'foto', label: '📸 Sinepsot Foto', name: 'Sinepsot Foto', emoji: '📸', type: 'studio', desc: 'Stüdyo çekimi.',
    npc: { name: 'Fotoğrafçı Ege', avatar: 'ege', x: -3, z: -3, ry: -0.3, lines: ['Işık hazır, geç bakalım.', 'Dışarıdaki fotoğraf noktasında da kare alabilirsin.', 'İki kişi çekilen kareler albümde daha iyi duruyor.'] } },
  { id: 'tatli', label: '🍰 Tatlı Kafası', name: 'Tatlı Kafası', emoji: '🍰', type: 'dessert', desc: 'Tatlı molası.',
    npc: { name: 'Pastacı Zeynep', avatar: 'zeynep', x: 0, z: -3.4, ry: 0, lines: ['Çilekli pasta yeni çıktı, hâlâ taze.', 'İstersen iki çatal koyayım.', 'Randevu masasına geçmek istersen haber ver.'] } },
  { id: 'kafe', label: '☕ Starbucket', name: 'Starbucket', emoji: '☕', type: 'cafe', desc: 'Kahve ve sohbet.',
    npc: { name: 'Barista Kaan', avatar: 'kaan', x: 0, z: -3.4, ry: 0, lines: ['Sütlü mü sade mi?', 'Pencere kenarı boş, geçip oturabilirsin.', 'Hızlı randevu masasında birini beklemek istersen söyle.'] } },
  { id: 'kitapkafe', label: '📚 Di and Ar', name: 'Di and Ar', emoji: '📚', type: 'books', desc: 'Kitap ve sessizlik.',
    npc: { name: 'Kütüphaneci Deniz', avatar: 'deniz', x: -3.5, z: -3.4, ry: 0.3, lines: ['Burada biraz daha sakin takılıyoruz.', 'Arka raflarda yeni çıkanlar var.', 'Bir kitap alıp koltuğa geçebilirsin.'] } },
  { id: 'firin', label: '🥐 Silit Sarayı', name: 'Silit Sarayı', emoji: '🥐', type: 'bakery', desc: 'Taze fırın.',
    npc: { name: 'Fırıncı Mira', avatar: 'mira', x: 0, z: -3.4, ry: 0, lines: ['Simitler yeni çıktı, çıtır çıtır.', 'Sabahları burası bayağı doluyor.', 'Poğaça da sıcak, hangisinden vereyim?'] } },
  { id: 'cayevi', label: '🍵 Çaykurt', name: 'Çaykurt', emoji: '🍵', type: 'tea', desc: 'İnce belli çay.',
    npc: { name: 'Çaycı Ege', avatar: 'ege', x: 3.4, z: -3.4, ry: -0.3, lines: ['Demli mi olsun açık mı?', 'Çay taze, muhabbet serbest.', 'Arkadaki masada tavla var.'] } },
  { id: 'kulup', label: '🪩 Klüp', name: 'Klüp', emoji: '🪩', type: 'club', desc: 'Müzik ve dans.',
    npc: { name: 'DJ Kaan', avatar: 'kaan', x: 0, z: -3.7, ry: 0, lines: ['Ses sistemi açık, pist senin.', 'Sağdaki karttan kabine geçip kendi parçanı çalabilirsin.', 'Biriyle dans etmek istersen davet gönder.'] } },
  { id: 'bar', label: '🍹 Hard Rök', name: 'Hard Rök', emoji: '🍹', type: 'bar', desc: 'Kokteyl ve müzik.',
    npc: { name: 'Barmen Deniz', avatar: 'deniz', x: -2, z: -3.4, ry: 0.2, lines: ['Ne hazırlayayım?', 'Tezgâhın kenarında muhabbet daha kolay açılır.', 'Gün Batımı kokteyli bugün iyi gidiyor.'] } },
  { id: 'oyun', label: '🎮 Playstasyon', name: 'Playstasyon', emoji: '🎮', type: 'arcade', desc: 'Oyun salonu.',
    npc: { name: 'Görevli Elif', avatar: 'elif', x: 3.6, z: -3.4, ry: -0.3, lines: ['Kabinler boş, hangisine geçmek istersin?', 'Birine yaklaşıp doğrudan oyun daveti atabilirsin.', 'Renk Karosu birazdan başlıyor.'] } },
  { id: 'fastfood', label: '🍔 Bulgur King', name: 'Bulgur King', emoji: '🍔', type: 'fastfood', desc: 'Hızlı yemek.',
    npc: { name: 'Kasiyer Zeynep', avatar: 'zeynep', x: 0, z: -3.4, ry: 0, lines: ['Siparişin hazır olsun mu?', 'Büyük boy patates iki kişiye yeter.', 'İstersen pencere tarafına geç.'] } },
  { id: 'dondurma', label: '🍦 Nevarlanda', name: 'Nevarlanda', emoji: '🍦', type: 'icecream', desc: 'Dondurma.',
    npc: { name: 'Dondurmacı Ege', avatar: 'ege', x: 0, z: -3.4, ry: 0, lines: ['Çilek mi vanilya mı?', 'Plaja inmeden önce uğrayan çok oluyor.', 'Külah mı kase mi olsun?'] } },
  { id: 'surf', label: '🏄 Quicksörf', name: 'Quicksörf', emoji: '🏄', type: 'shop', desc: 'Sörf ve plaj.',
    npc: { name: 'Sörfçü Kaan', avatar: 'kaan', x: -0.6, z: -3.0, ry: 0, lines: ['Dalgalar bugün tam ayarında. Yarış için benimle konuş.', 'Gün batımında sahil bayağı kalabalık oluyor.', 'Tahtalar arka rafta hazır.'] } },
  { id: 'plajbar', label: '🥤 Kokabana', name: 'Kokabana', emoji: '🥤', type: 'bar', desc: 'Soğuk içecekler.',
    npc: { name: 'Barmen Elif', avatar: 'elif', x: 0, z: -3.4, ry: 0, lines: ['Limonata mı smoothie mi?', 'Sokağın en serin köşesi burası.', 'Buz gibi bir şey hazırlayayım.'] } },
  { id: 'fitness', label: '🏋️ MakFit', name: 'MakFit Spor Kulübü', emoji: '🏋️', type: 'gym', desc: 'Ağırlık ve boks.',
    npc: { name: 'Koç Kaan', avatar: 'kaan', x: 0.4, z: -3.3, ry: -0.35, lines: ['Gardını düşürme. Ritmi tuttur, gerisi gelir.', 'Güç için sehpaya, kondisyon için koşu bandına geç.', 'Haftalık sıralamada birinci olan altın kemeri takar.'] } },
  { id: 'teknel', label: '🍾 Teknel', name: 'Teknel Şarküteri', emoji: '🍾', type: 'teknel', desc: 'Soğuk dolap ve şarküteri.',
    npc: { name: 'Teknelci Abi', avatar: 'deniz', x: 0, z: -3.4, ry: 0, lines: ['Dolap buz gibi, ne vereyim?', 'Aldıkların çantana düşer, istersen birine ısmarlarsın.', 'Peynir yeni açıldı, masaya geçip takılabilirsin.', 'Saat ondan sonra da açığız, aramızda kalsın.'] } },
]

export const VENUE_SOFT_CAP = 24
export const VENUE_HARD_CAP = 36
export const VENUE_BY_ID = Object.fromEntries(VENUES.map((v) => [v.id, v]))
export const VENUE_BY_LABEL = Object.fromEntries(VENUES.map((v) => [v.label, v]))
export const venueRoom = (id, ch = 1) => (ch > 1 ? `venue:${id}#${ch}` : `venue:${id}`)
export const isVenueRoom = (room) => typeof room === 'string' && room.startsWith('venue:')
export const venueIdOf = (room) => (isVenueRoom(room) ? room.slice(6).split('#')[0] : null)
export const venueChannelOf = (room) => (isVenueRoom(room) ? Math.max(1, parseInt(room.slice(6).split('#')[1], 10) || 1) : 1)
