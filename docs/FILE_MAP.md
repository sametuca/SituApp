# Dosya haritası

> `node scripts/file-map.mjs` ile otomatik üretilir; elle düzenleme. Açıklama = dosyanın başındaki ilk yorum satırı.
> Açıklaması olmayan dosyalar `—` ile gösterilir (yeni dosya yazarken başına tek satır açıklama ekle).

## scripts/

| Dosya | Satır | Ne yapar |
|---|---:|---|
| `file-map.mjs` | 63 | Kaynak dosya haritası üretir: docs/FILE_MAP.md (her dosyanın ilk açıklama satırı + satır sayısı). |
| `generate-assets.mjs` | 107 | Kullanım: |
| `generate-furniture.mjs` | 103 | Ev mobilyalarını Meshy ile üretir (CLAUDE.md'deki hat: image_to_image → image_to_3d). |
| `generate-venue-decor.mjs` | 173 | Meshy toplu mekân dekoru üretici (bağımsız, dotenv gerektirmez). |
| `loadtest.mjs` | 104 | Yük testi: N sahte oyuncu bağlanıp şehirde rastgele yürür. Kullanım: |
| `measure-furniture.mjs` | 31 | Mobilya GLB'lerinin sınır kutusunu ölçer → src/world/furnitureDims.json |
| `meshy-batch.mjs` | 102 | Genel Meshy toplu asset üretimi (CLAUDE.md hattı: image_to_image (çapa referanslı) → image_to_3d → gltf-transform sıkıştırma). |
| `meshy-textures.mjs` | 50 | Yer dokuları için Meshy text-to-image (nano-banana-2): üstten bakış, döşenebilir desen. Çıktı ham PNG; kiremit hâline getirmek için |
| `migrate-to-supabase.mjs` | 89 | Eski dosya verisini (server/data/social.json + homes.json) Supabase'e taşır. |

## server/

| Dosya | Satır | Ne yapar |
|---|---:|---|
| `admin.js` | 92 | Yönetici ucu (pre-alpha moderasyon paneli). Anahtar: server/.env → ADMIN_KEY (yoksa uçlar kapalıdır). |
| `assetSpecs.js` | 30 | Oyun dünyası için üretilecek asset listesi. |
| `assets.js` | 101 | Asset Studio: public/models manifesti okuma ve Meshy çıktısını içe aktarma (geliştirici aracı). |
| `auth.js` | 27 | Oyuncu kimliği (Supabase modu): kullanıcı adı ↔ uid haritası ve profil yükleme. |
| `consent.js` | 46 | KVKK / kullanım şartları onay kaydı: POST /api/consent { version, items: ['terms','kvkk','transfer'], ref } → server/data/consents.jsonl |
| `feedback.js` | 62 | Geri bildirim: POST /api/feedback { kind, text, contact? } → server/data/feedback.jsonl'a eklenir ve SMTP ayarlıysa e-posta atılır. |
| `game.js` | 779 | Çok oyunculu dünya sunucusu (WebSocket, yol: /ws). |
| `guard.js` | 149 | Hile/bot koruması (sunucu otoriter). İstemci kodu kullanıcının elindedir (konsoldan enjekte edilebilir, bir yapay zekâya hile yazdırılabilir): |
| `homes.js` | 157 | Ev deposu: her evin mobilya listesi, "herkese açık" ayarı ve dekoru. Arayüz senkron (getHome / saveItems / setOpen / |
| `index.js` | 239 | Sunucu girişi: Express (/api, dist/ statik) + WebSocket (/ws) + başlangıç yüklemeleri (store/homes/guard). |
| `internalAuth.js` | 46 | Dahili araç uçlarını (Meshy üretimi, karakter kaydı, asset içe aktarma) korur. |
| `profanity.js` | 49 | Mesaj denetimi: küfür maskeleme ve iletişim bilgisi (bağlantı, telefon, e-posta) gizleme. |
| `register.js` | 72 | POST /api/register: kullanıcı adı + şifre ile sunucu tarafı kayıt (e-posta doğrulamasız). |
| `store.js` | 125 | Sosyal veriler için kalıcı depo: kullanıcı başına engeller, ayarlar, profil, arkadaşlar, |
| `supa.js` | 232 | Supabase için küçük, fetch tabanlı REST istemcisi (bağımlılıksız) + write-behind yardımcıları. |

## server/features/

| Dosya | Satır | Ne yapar |
|---|---:|---|
| `away.js` | 109 | Asenkron izler: çevrimdışı arkadaşa bırakılan hediye paketleri (notlu) ve "arkadaşın şimdi şurada" sinyalleri. |
| `beach.js` | 164 | Plaj etkinlikleri: (1) Gün batımı buluşması, (2) voleybol (2 kişilik zamanlama). Sunucu otoriter. |
| `collect.js` | 121 | Toplanabilirler ve gizli noktalar. Konumlar: src/world/collectibles.js (istemciyle ortak). Sunucu otoriterdir: |
| `cosmetics.js` | 153 | Kişiselleştirme: aksesuar, evcil hayvan, ev dekoru ve hediyeleşme. |
| `dating.js` | 420 | Flört & Sosyal Motoru: Mod (Vibe), Canlı Sıcak Nokta, 3 Dakikalık Hızlı Randevu Masası, |
| `dj.js` | 213 | Küçük iş: Gece Kulübü'nde DJ olma. Sunucu otoriter vardiya kuyruğu, bağlantı doğrulama (yalnızca YouTube/Spotify), |
| `duo.js` | 129 | Günlük Ortak Görevler (Duo): tek başına yapılamaz, başka bir oyuncuyla birlikte tamamlanır. |
| `economy.js` | 107 | Altın ekonomisi (küçük işlerden kazanılır; mağaza/harcama sonraki adım). Kalıcı: store.user(key).stats.coins. |
| `fitness.js` | 322 | Fitness Kulübü (MakFit): 4 karakter statı, günlük antrenman enerjisi, ağırlık/koşu antrenmanı, |
| `friends.js` | 350 | Arkadaşlık, varlık (çevrimiçi/nerede/son görülme), çevrimdışı mesaj kutusu ve okundu bilgisi. |
| `games.js` | 357 | İki kişilik mini oyunlar: XOX, Doğruluk mu Cesaret mi, Aşk testi. |
| `housing.js` | 132 | Ev kademeleri: garaj evi → stüdyo → müstakil ev → villa (src/world/homeTiers.js). Her ev ayrı bir oda olduğundan şehirde yer tutmaz. |
| `index.js` | 34 | Özellik modülleri. Her modül (ctx) => { api?, handlers?, onJoin?, onLeave?, welcome? } döndürür: |
| `inventory.js` | 126 | Oyuncu envanteri (içecekler, hediyeler) ve hediye/ısmarlama kabul akışı. |
| `jobs.js` | 110 | Serbest meslekler (sunucu): meslek seçme zorunluluğu yok; herkes istediği zaman balık tutabilir veya posta dağıtabilir. |
| `media.js` | 79 | Medya: özel sohbette sesli mesaj ve çıkartmalar. |
| `minigames.js` | 187 | Çok oyunculu mini oyun merkezi (2–10 kişi + kalıcı liderlik tabloları): |
| `moderation.js` | 88 | Güvenlik: engelleme, şikâyet, rahatsız etme (DND) ve mesaj denetimi. |
| `neighborhood.js` | 61 | Konut Mahallesi: oyuncu evi parselleri ve evin dış görünümü. |
| `npcs.js` | 47 | NPC'ler: yalnızca ilerleme olayı. İstemci NPC'yle konuşunca { t: 'npc_talk', id } yollar; |
| `pets.js` | 60 | Evcil hayvan süresi: yeni oyuncu ilk girişte 1 haftalık ücretsiz bir arkadaş seçer (kedi/köpek); süre bitince hayvan kalkar, |
| `profile.js` | 246 | Profil ve ilgi etiketleri. |
| `progress.js` | 353 | İlerleme: olay veriyolu (ctx.emitEvent), günlük görevler, rozetler, günün önerisi ve sezon etkinlikleri. |
| `rental.js` | 22 | Başlangıç ödülü ve yeni hesap bayrağı (bisiklet tüm oyunculara varsayılan olarak açıktır; kiralama yoktur). |
| `surf.js` | 257 | Sörf Yarışı (Dalgalardan Kaç!): minimum 2, maksimum 10 kişilik çok oyunculu dalgadan kaçma oyunu + kalıcı puan tablosu. |
| `together.js` | 254 | Birlikte yapılan şeyler: oturma (banklar/şezlonglar/sandalyeler) ve çift dans. |
| `venues.js` | 165 | Mekân etkinlikleri: Gece Kulübü karaokesi (sunucu otoriter kuyruk, sahne süresi, alkış sayacı). |

## src/

| Dosya | Satır | Ne yapar |
|---|---:|---|
| `App.jsx` | 39 | Uygulama yönlendirmesi: giriş, karakter seçimi, dünya, admin, asset studio sayfaları. |
| `main.jsx` | 15 | Giriş noktası: React kökü, global stiller, unisex shader yaması ve emoji kurulumu. |

## src/arcade/

| Dosya | Satır | Ne yapar |
|---|---:|---|
| `games.js` | 406 | Playstasyon makineleri için retro oyunlar: Yılan, Pong, Tuğla Kır, Blok Düşür. Hepsi bu projede yazılmış özgün, tek dosyalık canvas oyunlarıdır |

## src/components/

| Dosya | Satır | Ne yapar |
|---|---:|---|
| `Consent.jsx` | 120 | Kayıt/ilk giriş onayları: üç ayrı onay kutusu (her biri ilgili metne bağlanır) + metin penceresi + eski hesaplar için engelleyici onay ekranı. |
| `Dock.jsx` | 32 | Alt orta HUD yığını: yakın oyuncu kartı, kapı/etkileşim istemleri, fotoğraf/oturma istemleri, davet kartları vb. aynı kapta ALT ALTA akar, |
| `Icon.jsx` | 111 | Arayüz (HUD & kartlar) ikonları: tamamı Microsoft Fluent Emoji 3D seti (public/icons/fluent/*.webp) üzerinden çizilir. |
| `LookPicker.jsx` | 58 | Saç / göz / kıyafet rengi seçici (karakter seçimi ve gardırop). value = { h, e, o } palet indeksleri (-1 = orijinal). |
| `SkillEditor.jsx` | 82 | Beceri çubuğu düzenleyici: alttaki ifade paletinden üstteki 4 yuvaya SÜRÜKLE-BIRAK (dokunmatikte: önce ifadeye, sonra yuvaya dokun). |
| `SkillIcon.jsx` | 35 | Beceri/ifade ikonları: parlak 3D Microsoft Fluent Emoji seti (public/icons/fluent/*.webp) pastel karo içinde. |
| `emoji.jsx` | 46 | Tutarlı ikon seti: tüm emojiler Microsoft Fluent Emoji 3D (MIT) görselleriyle çizilir (public/icons/fluent/). |
| `ui.jsx` | 144 | Pastel tasarım sisteminin ortak bileşenleri (tüm ekranlarda kullanılacak). |

## src/components/3d/

| Dosya | Satır | Ne yapar |
|---|---:|---|
| `AvatarPreview.jsx` | 85 | Karakter seçiminde dönen avatar önizlemesi (look rengi uygulanır). |
| `ModelViewer.jsx` | 28 | Asset Studio için basit GLB görüntüleyici. |

## src/legal/

| Dosya | Satır | Ne yapar |
|---|---:|---|
| `legalTexts.js` | 158 | Hukuki metinler: KVKK Aydınlatma Metni, Kullanım Şartları, Yurt Dışına Aktarım Açık Rızası. |
| `record.js` | 15 | Onay kaydını doğrulanmış hesapla sunucuya bildirir; kayıt/giriş akışı sunucu kaydı olmadan da sürebilir. |

## src/lib/

| Dosya | Satır | Ne yapar |
|---|---:|---|
| `AuthContext.jsx` | 99 | Auth bağlamı: demo/Supabase oturumu, RequireAuth, KVKK onay kapısı. |
| `auth.js` | 204 | Kimlik doğrulama servisi. |
| `characters.js` | 27 | Asset Studio karakter listesi API istemcisi (list/save/delete). |
| `meshy.js` | 61 | Meshy API istemcisi: önizleme/rafine görev oluşturma ve durum yoklama. |
| `studioKey.js` | 27 | Asset Studio anahtarı (server/.env → STUDIO_KEY, yoksa ADMIN_KEY). |
| `supabase.js` | 14 | Değerlerin başındaki/sonundaki boşluk ve tırnaklar atılır (.env.local'da sık yapılan hata). |

## src/pages/

| Dosya | Satır | Ne yapar |
|---|---:|---|
| `Admin.jsx` | 144 | Pre-alpha yönetici paneli (/admin): şikâyetler + geri bildirimler. Anahtar yalnızca bu sekmede (sessionStorage) tutulur. |
| `AssetStudio.jsx` | 274 | Dahili geliştirici aracı: Meshy ile model üretme/önizleme (koyu tema). |
| `AuthPage.jsx` | 297 | three.js yalnızca giriş ekranı çizildikten sonra yüklensin |
| `AvatarSelect.jsx` | 172 | Karakter seçimi + renk özelleştirme ekranı (tek karakter kilidi). |
| `World.jsx` | 1171 | Dünya sayfası orkestratörü: Canvas, ağ, HUD, özellik modülleri, odalar (şehir/ev/mekân). |
| `WorldLoading.jsx` | 125 | 3B sahne çökerse boş ekran yerine kurtarma kartı gösterir. |
| `loadingMessages.js` | 15 | Yükleme ekranı mesajları ve rastgele seçici. |

## src/world/

| Dosya | Satır | Ne yapar |
|---|---:|---|
| `Accessories.jsx` | 606 | Aksesuarlar procedural (three.js ilkelleri) ve pastel/oyuncak görünümlüdür. "Baş birimi" koordinatlarında çizilir: |
| `AirportTutorial.jsx` | 277 | Havalimanı başlangıç eğitimi sahnesi: zemin okları, işaret ışıkları, hedef yıldızı. |
| `AvatarRig.jsx` | 363 | Rig'li avatar: AnimationMixer, duruş katmanı (avatarPose), aksesuar/look, iş aksesuarı. |
| `BeachParty.jsx` | 221 | Sahil Partisi (Beach Party): plajda doğan oyuncuları ilk anda karşılayan müzikli, ışıklı, danslı sahil sahnesi. |
| `Bike.jsx` | 33 | Bisiklet modeli ve sürüş görünümü (bikeStore durumu). |
| `City.jsx` | 1321 | Şehir çizimi: zemin dokuları, binalar, yollar, deniz/ada, süs nesneleri, sınır şamandıraları. |
| `CityGround.jsx` | 74 | tex: GROUND_TEX adı. Doku dünya ölçüsünde döşenir (kiremit boyu metre), renk tonu `color` ile çarpılır (pastel ton). feather: kenar yumuşatma (m). |
| `CityGroundUtils.js` | 155 | Şehir zemini yardımcıları: paylaşımlı doku önbelleği, malzeme ve tekrar yuvarlama. |
| `CollectiblesLayer.jsx` | 372 | Toplanabilirler katmanı (Canvas içi): şehirdeki ya da mekândaki toplanabilirleri tek katmanda çizer. |
| `CrowdHud.jsx` | 186 | Kalabalık arayüzü: mekân kanal seçici ve yakındaki oyuncu seçici. |
| `Facade.jsx` | 492 | Mekân ön cepheleri: her mekânın kapısı, camları, tentesi, 3B tabelası ve süsleri farklıdır (veri: facadeData.js). Bina yerel çerçevesi: cephe z = d/2, x genişlik. |
| `FishModel.jsx` | 159 | Balıkların ve yakalanan eşyaların oyuncak tarzı 3B modelleri (jobsData.js FISH renkleri). Yerel koordinat: baş +x yönüne bakar. |
| `Gifts.jsx` | 62 | Hediye eşyaları (Meshy GLB) + paylaşılan kalp biçimi (ev dekoru). |
| `GraphicsEffects.jsx` | 30 | Son işlem efektleri: N8AO ve hafif bloom (grafik profiline göre). |
| `HomeDecor.jsx` | 295 | ---------- doku yardımcıları (canvas, önbellekli) ---------- |
| `HomeEditor.jsx` | 245 | Ev "Döşe" modu: mobilya ekle/sürükle/döndür/kaldır, dekor ve hediye sekmeleri. |
| `HomeGarden.jsx` | 512 | Evin doğu tarafındaki pastel bahçe: çiçekli çimen dokusu, ahşap kazıklı çit, peri ışıklı pergola, |
| `HomeRoom.jsx` | 369 | Ev iç mekânı (oyuncak evi gibi, duvarlar içe bakar), kademeye göre oda ölçüsü. |
| `Hud.jsx` | 542 | Üst çubuk, ipuçları, yardım, modal ve ortak HUD bileşenleri. |
| `HudChat.jsx` | 200 | Sohbet paneli (genel/özel mesajlar, yazma ve ikili sohbet bağlantıları). |
| `HudMap.jsx` | 341 | Mini harita ve büyük harita çizimi (ada, yollar, mekânlar). |
| `IntroCutscene.jsx` | 124 | İlk giriş kamera sinematiği ve atla düğmesi. |
| `JobsWorld.jsx` | 282 | Mesleklerin şehirdeki sahneleri: balıkçı iskeleleri (güney kıyısı), Posta Merkezi (park) ve teslimat kapısı ışıkları. |
| `LocalPlayer.jsx` | 355 | Yerel oyuncu: hareket, çarpışma, kamera takibi, bisiklet, tıkla-git, ışınlanma. |
| `NeighborhoodView.jsx` | 334 | Konut Mahallesi çizimi (City.jsx içinden): sokak, parseller, evler, çitler, bahçe öğeleri, tabelalar. |
| `NpcLayer.jsx` | 482 | NPC'ler: rig'li avatarlar, isim etiketi, selam balonu, oyuncuya dönme, gezen NPC'ler (paylaşılan saatten deterministik konum). |
| `Pet.jsx` | 199 | Evcil hayvanlar: Meshy GLB (statik), hareket procedural (zıplama, nefes, sağa sola bakma). Yaklaşık 0,5 m boyunda. |
| `Plants.jsx` | 99 | Çalılar ve çim öbekleri: Meshy GLB'leri (public/models/plants/), yerleri plantSpots.js'ten; her model tek InstancedMesh seti (ucuz). |
| `Portrait.jsx` | 26 | Oyuncu portresi: profil fotoğrafı varsa o, yoksa avatar portresi. |
| `Prop.jsx` | 145 | GLB süs nesneleri: tekil Prop ve instanced PropGroup (mesafe kırpma, gölge yarıçapı, palmiye salınımı). |
| `RemotePlayers.jsx` | 387 | Uzak oyuncular + NPC çizimi, yumuşatma ve çizim bütçesi. |
| `RoadInfrastructure.jsx` | 200 | Yol işaretleri, kaldırım taşları ve yol süsleri. |
| `Sky.jsx` | 939 | Gökyüzü, ışık ve gece görünümü (Canvas içi): güneş/ay yönü, ambient/hemisphere, arka plan + sis, yıldızlar, ay, güneş diski, |
| `Social.jsx` | 881 | Joystick, beceri çubuğu, yakın oyuncu kartı ve DM çekmecesi. |
| `SpeedFx.jsx` | 78 | Hız halkasından geçince geçici hız efekti (yalnızca benim avatarımın yanında): arkaya akan rüzgâr çizgileri, ayakta yayılan halka, "HIZ!" yazısı (kartsız). |
| `TownDetails.jsx` | 557 | Kasaba detayları: çeşitli meyve/kiraz/çam ağaçları, pastel çalılıklar, çöp kutuları, |
| `TurkishFlags.jsx` | 140 | Plaka82 genelinde rüzgârda dalgalanan Türk bayrakları. |
| `Venue.jsx` | 973 | Girilebilen mekânların iç mekânı: ev odası gibi oyuncak evi kesiti (duvarlar yalnızca içe bakar, kamera güneyden). |
| `WhisperInbox.jsx` | 256 | Fısıltı gelen kutusu paneli. |
| `WorkProp.jsx` | 286 | Mesleklerde avatarın elindeki eşyalar: olta (+ misina, şamandıra, sıçrama, yakalanan balık), kargo paketi, bahçe tozu. |
| `avatarLook.js` | 342 | Avatar renklendirme: GLB dokuları düz renkli yamalardan oluşur. Saç ve kıyafet = (kemik bölgesi: baş / gövde) + (dokudaki orijinal renge yakınlık), |
| `avatarPose.js` | 393 | Avatar GLB'lerinde yalnızca idle/walk/run klipleri var. Oturma ve dans, klibin ÜSTÜNE kemiklere eklenen |
| `avatarTextureFix.js` | 194 | Meshy avatar GLB dokularındaki siyah UV boşluklarını (gutter) üçgen kenarlarından dışarı doğru boyar |
| `bikeStore.js` | 33 | Bisiklet durumu (React dışı paylaşılan depo): LocalPlayer hız/duruşu okur, BikeModel görünür, düğme/tuş değiştirir. |
| `boxing.js` | 69 | Boks + karakter statları: istemci ve sunucunun ORTAK saf mantığı (aynı tohumla aynı vuruş dizisi, aynı hasar formülü). |
| `collectibles.js` | 94 | Toplanabilirler: şehre ve mekân içlerine dağılmış küçük pastel objeler + gizli hazine sandıkları. |
| `cosStore.js` | 51 | Oyuncuların kozmetik seçimleri (aksesuar + evcil hayvan) için küçük bir dış depo. |
| `cosmeticsData.js` | 126 | Kişiselleştirme kataloğu: aksesuar, evcil hayvan, ev dekoru, hediye. Hem sunucu (doğrulama) hem istemci (çizim) kullanır; |
| `cull.js` | 44 | Uzaklık ayıklama: büyük dünyada uzaktaki bina/süs nesneleri çizilmez (gölge ve çizim maliyeti düşer). Oyuncu konumu LocalPlayer'dan gelir. |
| `datingData.js` | 75 | Flört & sosyal akış verisi (istemci + sunucu ortak): modlar, buz kırıcılar, 3 dk hızlı randevu soruları, uyum seviyeleri ve zamanlı etkinlikler. |
| `djLinks.js` | 51 | DJ'in çalacağı bağlantıların ortak (istemci + sunucu) ayrıştırıcısı. Yalnızca YouTube ve Spotify kabul edilir; |
| `facadeData.js` | 30 | Mekân ön cephe tasarımları (saf veri; City.jsx Facade bileşeni çizer, venueDoors.js kapı konumunu buradan kaydırır). |
| `fitnessStore.js` | 22 | İstemci içi hafif stat/kemer deposu (LocalPlayer koşu hızı ve avatar kemer/eldiven görünümü için). |
| `floorTex.js` | 22 | Zemin dokuları (Meshy, üstten bakış, döşenebilir): public/textures/{wood,tile,carpet}.webp. Mekân ve ev iç zeminleri kullanır. |
| `furniture.js` | 50 | Ev mobilyası kataloğu. GLB'ler public/models/furniture/<id>.glb (scripts/generate-furniture.mjs ile Meshy'den üretilir). |
| `homeGarden.js` | 92 | Ev bahçesi veri modeli, arazi kademeleri, büyüme hesapları ve yerel kalıcılık. |
| `homeLayout.js` | 113 | Ev düzeni: mobilya listesi, ayak izi (footprint), çakışma ve kayıt. |
| `homeTiers.js` | 26 | Ev kademeleri (saf JS; sunucu da okur). Her ev ayrı bir "oda"dır (hideout): şehirden bağımsız, oyuncu sayısı ne olursa olsun |
| `interact.js` | 59 | Oyuncular arası etkileşim sabitleri (sunucudaki REACTIONS / GESTURES ile aynı olmalı: server/game.js). |
| `jobsData.js` | 140 | Meslekler: ortak veri (istemci + sunucu aynı dosyayı okur; saf JS, tarayıcı/Node bağımsız). |
| `karaokeSongs.js` | 64 | Gece Kulübü karaokesi: özgün, tatlı/komik şarkı sözleri (hiçbiri bilinen bir şarkıdan alınmadı). |
| `layout.js` | 482 | Şehir haritası verisi: yollar, mahalleler, binalar, süs nesneleri ve çarpışma alanları. |
| `lookData.js` | 59 | Karakter görünümü (saç / göz / kıyafet rengi) — istemci ve sunucu ortak. Seçim = palet indeksi (-1 / null = orijinal renk). |
| `neighborhood.js` | 127 | Konut Mahallesi verisi (saf JS: sunucu da okur). Birim metre, orijin = lobi merkezi. |
| `net.js` | 399 | useMultiplayer: WebSocket bağlantısı, mesaj aboneliği (on/send), konum ref'leri, oda geçişi. |
| `npcs.js` | 416 | NPC verisi (sunucu da okur: server/features/npcs.js → saf JS, React/three yok). |
| `pastelTex.js` | 449 | Balonsu / pofuduk pastel kil (toy-clay) dokuları: renk haritası + uyumlu kabartma (bumpMap) çiftleri. |
| `performanceProfile.js` | 24 | Cihaza göre grafik profili ve arka plan ön yükleme izni. |
| `pettingStore.js` | 3 | Evcil hayvan sevme durumu (basit paylaşılan store). |
| `photoStore.js` | 38 | Profil fotoğrafı adresleri: oyuncu anahtarı → url. Sunucu her izleyici için izne göre hesaplar |
| `plantSpots.js` | 49 | Süs bitkisi yerleri (saf JS, deterministik): çalı ve çim öbekleri yalnızca ÇİMLİ boş alanlara serpiştirilir — |
| `preload.js` | 51 | Model önyükleme. React 19'da yükleme bekleyen bir bileşen kardeşlerinin çizilmesini durdurur; bu yüzden bir sahnedeki onlarca |
| `screenK.js` | 4 | Ekran boyutuna göre 3D etiket (drei <Html distanceFactor>) ölçeği: piksel boyutlu etiketler büyük ekranda küçük kalmasın. |
| `unisex.js` | 45 | Unisex palet: 3D sahnedeki pembe/magenta tonları (GLB dokuları dahil) sıcak turuncu-amber tonuna çevirilir. Tüm MeshStandard/Basic malzemeler |
| `useIsTouch.js` | 47 | Test için ?touch=1 ile masaüstünde de dokunmatik arayüz açılır. |
| `venueDoors.js` | 29 | Mekânların şehirdeki kapıları. Bina (layout.js BUILDINGS) `venue` kimliğiyle bağlanır; kapı bina yerel +z yüzünde, `facing` yönündedir. |
| `venueLayout.js` | 610 | Mekân iç mekânlarının VERİSİ (çizim: Venue.jsx). Saf veri: hem istemci hem sunucu okur (sunucu koltukları buradan bilir). |
| `venues.js` | 59 | Girilebilen mekânların ortak verisi. Mekân iç odası, ev odası gibi ayrı bir sahnedir (oda adı: `venue:<id>`). |
| `vibeData.js` | 63 | Uyumluluk göstergeleri: müzik zevki, ruh hali ve burç (ortak veri; sunucu ve istemci aynı dosyayı okur). |
| `windSway.js` | 40 | Hafif rüzgâr salınımı: GLB malzemesine tepe-ağırlıklı yatay sallanma ekler (palmiye yaprakları gibi). |
| `worldClock.js` | 61 | Dünya saati ve gökyüzü görünümü için ortak durum. Gün/gece modülü yazar (publishWorld). |

## src/world/audio/

| Dosya | Satır | Ne yapar |
|---|---:|---|
| `engine.js` | 181 | Ses motoru: tek AudioContext, master/müzik/efekt bus'ları, ayarlar (localStorage), sekme gizliyken sessizlik. |
| `music.js` | 495 | Üretken (generative) arka plan müziği; tamamen procedural. Bölgeye göre sahne (scene) seçilir, sahneler arasında crossfade yapılır. |
| `sfx.js` | 174 | Ses efektleri (tamamen procedural). Her efekt: (ac, out, t, opt?) → nominal süre (sn). Kısa, pastel, oyuncak tınılı. |
| `synth.js` | 176 | Ortak sentez parçaları (Web Audio). Hepsi (ac, out, t, ...) biçimindedir; ac gerçek AudioContext ya da OfflineAudioContext olabilir. |

## src/world/features/

| Dosya | Satır | Ne yapar |
|---|---:|---|
| `BoxingArena3D.jsx` | 214 | Boks arenası 3B: boksörler, vuruş kıvılcımları. |
| `EventFx.jsx` | 90 | Sezon efekti: oyuncunun çevresinde hafif parçacıklar (tek InstancedMesh, ≤ 36 örnek). |
| `SurfArena.jsx` | 1047 | 60 FPS perspektif 3B-hissi veren, dinamik okyanus & animasyonlu sörf arenası. |
| `TogetherScene.jsx` | 103 | "Birlikte yapılan şeyler"in 3D parçaları (Canvas içinde): dans efektleri, fotoğraf noktası işareti ve kare alma. |
| `WorkoutModals.jsx` | 401 | ======================= 1. AĞIRLIK ÇALIŞMA MİNİ OYUNU (+GÜÇ) ======================= |
| `arcade.jsx` | 183 | Playstasyon makineleri: yakındaki kabine E ile "Oyna" → tam ekran retro oyun (src/arcade/games.js). Oyunlar tamamen istemcide çalışır; |
| `audio.jsx` | 198 | Ses efektleri (tamamen procedural, Web Audio). Motor: ../audio/engine.js, efektler: sfx.js. (Müzik şimdilik devre dışı.) |
| `away.jsx` | 177 | Asenkron izler: "sen yokken" özeti, çevrimdışı arkadaşa bırakılan hediye paketleri (notlu) ve arkadaş sinyalleri. |
| `beach.jsx` | 238 | Plaj etkinlikleri (istemci): gün batımı buluşması bannerı + plaj halkası ve voleybol (zamanlama). Sunucu: server/features/beach.js. |
| `bike.jsx` | 39 | Bisiklet (istemci): sol sütunda 🚲 düğmesi ve B tuşu. Şehirde ücretsiz binilir; hız yürüyüşten bir tık hızlıdır (5,2 m/sn, Shift ile 7,2). |
| `cityLife.jsx` | 131 | Şehir yaşamı oynanışı: Lobi Çeşmesi dilek tutma, hız halkaları ve günlük 5 bölge keşif turu. |
| `collect.jsx` | 238 | Toplanabilirler (istemci): Canvas katmanı (CollectiblesLayer), "Topla" istemi (E / dokunma / objeye tıklama) ve koleksiyon paneli. |
| `collectCelebration.jsx` | 95 | Toplama kutlamaları: her toplamada parlak rozet + halka + parıltılar + "+N ⭐" + seviye çubuğu; seviye atlayınca tam ekran kutlama. |
| `cosmetics.jsx` | 1012 | Gardırop (aksesuar/evcil hayvan/look), hediye teklifleri, ev dekoru sekmeleri. |
| `dating.jsx` | 716 | Flört & Sosyal Akış Merkezi: Mod (Vibe) seçimi, Canlı Sıcak Nokta, Zamanlı Kasaba Etkinlikleri, |
| `dj.jsx` | 342 | Küçük iş (istemci): Gece Kulübü'nde DJ olma. Sunucu: server/features/dj.js; bağlantı ayrıştırıcı: src/world/djLinks.js. |
| `duo.jsx` | 51 | Günlük Ortak Görevler: tek başına yapılamayan, biriyle birlikte tamamlanan görevler. Sunucu: server/features/duo.js. |
| `economy.jsx` | 48 | Altın göstergesi (üst çubukta 🪙 sayısı) ve kazanç bildirimi. Sunucu: server/features/economy.js. |
| `edge.jsx` | 30 | Dünya sınırı ipucu: oyuncu sınıra (şamandıra halatı) yaklaşınca tatlı, kısa bir bilgi kartı. Sunucu da sınırı zorlar (hile denetimi). |
| `feedback.jsx` | 204 | Geri bildirim: ⚙️ menüsünde "Geri bildirim" + ara sıra beliren küçük davet kartı. Gönderim: POST /api/feedback (server/feedback.js); |
| `fitness.jsx` | 943 | Fitness Kulübü (MakFit): 4 karakter statı, günlük enerji, ağırlık & koşu bandı mini oyunları, |
| `friends.jsx` | 623 | Arkadaşlık, varlık, mesaj kutusu, okundu bilgisi ve tarayıcı bildirimi (sunucu: server/features/friends.js). |
| `games.jsx` | 421 | İki kişilik mini oyunlar (istemci). Durumu sunucu tutar; burada yalnızca gösterim ve hamle gönderme var. |
| `homeCare.jsx` | 563 | Ev bahçesi & bakım sorumluluğu + arkadaşını eve davet etme özelliği. |
| `housing.jsx` | 67 | Ev kademeleri (istemci): ⚙️ menüsünde "🏡 Evini büyüt" satırı → kademe paneli. Sunucu: server/features/housing.js. |
| `index.jsx` | 91 | Özellik modülleri (istemci). Her modül bir hook'tur: useX(ctx) → { peerActions?(peer), settingsSections?, overlays? } |
| `inventory.jsx` | 398 | Oyuncu Envanteri (🎒), içki/hediye ısmarlama, hediye kabul ekranı ve 5 saniyelik alkol bulanıklık efekti. |
| `jobStore.js` | 23 | Meslekler için paylaşılan istemci durumu (React dışı; 3B katmanlar her karede okur). Yazan: features/jobs.jsx. |
| `jobs.jsx` | 656 | Serbest meslekler (istemci): meslek seçme yok — herkes istediği zaman sahil iskelesinde/gölette balık tutabilir veya lobiden posta dağıtabilir. |
| `media.jsx` | 306 | Medya özelliği (istemci): özel sohbette sesli mesaj ve çıkartmalar. Sunucu tarafı: server/features/media.js. |
| `meetupDialogs.jsx` | 55 | Buluşma daveti seçici ve gelen davet penceresi. |
| `minigameArenas.jsx` | 939 | 5 yüksek kaliteli, 60 FPS animasyonlu mini oyun arenası (masaüstü + mobil dokunmatik uyumlu): |
| `minigames.jsx` | 330 | 5 Çok Oyunculu Mini Oyun Merkezi: Lobi (2–10 kişi) + Botlarla Hemen Oyna + Otomatik Kıyafet + Genel Puan Tablosu. |
| `moderation.jsx` | 99 | Engelle/şikâyet/rahatsız etme arayüzü. |
| `neighborhood.jsx` | 202 | Konut Mahallesi (istemci): parsel verisi ağdan, kapıya yaklaşınca "Gir" istemi, Döşe → 🏡 Dış görünüm sekmesi. |
| `neighborhoodStore.js` | 40 | Konut Mahallesi paylaşılan istemci durumu: parsel kimliği → { id, key, name, open, ext }. |
| `npcs.jsx` | 404 | NPC'ler: Canvas katmanı (NpcLayer) + konuşma çekmecesi + "Konuş" istemi. |
| `photo.jsx` | 266 | Fotoğraf kabini: kare çerçeveleme, yerel albüm (localStorage) ve diyaloglar. Sunucu gerekmez. |
| `photoUpload.jsx` | 217 | Profil fotoğrafı yükleme: kare kırpma + 512×512 küçültme + JPEG sıkıştırma (tarayıcıda), Supabase Storage'a |
| `profile.jsx` | 428 | Profil kartı, düzenleyici, ilgi etiketleri, uyumluluk göstergeleri, ruh hali. |
| `progress.jsx` | 317 | İlerleme (istemci): günlük görevler, rozetler, günün önerisi ve sezon etkinliği. Sunucu: server/features/progress.js. |
| `sky.jsx` | 103 | Gün batımı/gece görünümü (istemci). Görsel: world/Sky.jsx. |
| `stickers.js` | 72 | Pastel çıkartma setleri (4 set × 8). Kimlikler `<set>-<0..7>`; sunucudaki server/features/media.js ile aynı olmalı. |
| `surf.jsx` | 343 | Sörf Yarışı — Dalgalardan Kaç! (2–10 oyunculu gerçek zamanlı + tek kişilik bot antrenmanı + genel puan tablosu). |
| `surfData.js` | 58 | Sörf ortak verileri: tahta stilleri, bot adları, tohumlu rastgele üretici. |
| `together.jsx` | 442 | Birlikte yapılan şeyler: oturma, çift dans ve fotoğraf kabini. |
| `togetherStore.js` | 40 | "Birlikte yapılan şeyler" için paylaşılan istemci durumu (React dışı, ref gibi okunur). |
| `venueStore.js` | 7 | Mekân etkinlikleri için paylaşılan istemci durumu (React dışı, her karede okunur). |
| `venues.jsx` | 203 | Mekân etkinlikleri (istemci): Gece Kulübü karaokesi (kuyruk, sözler, alkış) ve mekân içi çarpışma kaydı. |

## vite-plugins/

| Dosya | Satır | Ne yapar |
|---|---:|---|
| `emoji.js` | 69 | Vite eklentisi: src/**/*.jsx içindeki JSX çocuklarını (metin ve {ifade}) emojify()'dan geçirir. |
