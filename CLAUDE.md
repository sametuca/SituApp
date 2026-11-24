# SituApp

Sanalika tarzı, pastel/oyuncak görünümlü, çok oyunculu bir sosyal/flört dünyası. Kullanıcı Türkçe konuşur; arayüz metinleri Türkçe.

## Çalıştırma

```powershell
npm install
npm run dev:all        # web (Vite, :5173) + sunucu (Express + WebSocket, :3001)
npm run build          # üretim derlemesi
npm run lint           # oxlint (World/LocalPlayer'daki react-hooks "immutability" uyarıları R3F kalıbı, zararsız)
```

- Vite `/ws` ve `/api` isteklerini `localhost:3001`'e yönlendirir (`vite.config.js`).
- `server/.env` (git'e girmez): `MESHY_API_KEY=...` yalnızca asset üretimi/Asset Studio için gerekir. Oyunu çalıştırmak için gerekmez.
- Frontend env (`.env.local`, git'e girmez): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. İkisi de yoksa auth **demo modunda** çalışır (hesaplar localStorage'da, gerçek güvenlik yok). Bkz. `.env.example`.
- Dev'de giriş ekranında "⚡ Hızlı giriş (test)" düğmesi çıkar (yalnızca dev + demo modu).
- `?touch=1` ile masaüstünde dokunmatik arayüz (joystick) test edilir.

## Akış ve mimari

`/` giriş/kayıt → `/avatar` karakter seç → `/world` şehir. Herkes lobi meydanında başlar (mekan seçme adımı kaldırıldı).

- `src/lib/auth.js`, `AuthContext.jsx`: demo/Supabase auth soyutlaması, `RequireAuth`.
- `src/pages/`: `AuthPage`, `AvatarSelect`, `World` (orkestratör), `AssetStudio` (dahili geliştirici aracı, hâlâ koyu tema).
- `src/world/`
  - `layout.js`: harita verisi (mahalleler, binalar, süs nesneleri, çarpışma, `GUIDE` NPC, `TELEPORTS`). Birim metre; orijin = lobi merkezi; -z kuzey.
  - `City.jsx`, `Prop.jsx`: şehir çizimi; GLB süs nesneleri `public/models/<mekan>/`.
  - `LocalPlayer.jsx`, `RemotePlayers.jsx`, `AvatarRig.jsx`: oyuncu, uzak oyuncular + Rehber NPC, rig'li avatar (kendi `AnimationMixer`'ı; drei `useAnimations` ilk açılışta T-pose'da kalıyordu).
  - `net.js`: `useMultiplayer` hook'u (konumlar ref'te tutulur, 10 Hz). `enterRoom('city' | { owner? })` ile oda değiştirir.
  - `HomeEditor.jsx` + `homeLayout.js` + `furniture.js`: mobilya katalogu (11 eşya, `public/models/furniture/`), "🛋️ Döşe" modu (ekle, sürükle, döndür `R`, kaldır `Del`), SAT çakışma kontrolü, kapı önü boş kalır. Düzen sunucuda kalıcıdır (`server/homes.js` → `server/data/homes.json`, git'e girmez; Supabase'e geçilirse yalnızca bu dosya değişir). Tarayıcıdaki `localStorage` (`situapp_home_v1_<kullanıcı>`) yalnızca önbellek. Ev **davetleri**: `/davet <isim>` ya da yakındaki oyuncu kartındaki 🏠; davetli `Git` ile girer. `/ziyaret <isim>` + `/kapı aç|kapat` (herkese açık ev). Ziyaretçi yalnızca bakar, sahibi düzenleyebilir. Sunucu `node --watch` olmadan çalışır: `server/` değişince yeniden başlat. Yeni eşya: `furniture.js`'e ekle → `npm run furniture -- --only <id>` (Meshy; bulutta `NODE_USE_ENV_PROXY=1` gerekir) → gltf-transform ile sıkıştır → `node scripts/measure-furniture.mjs` → önizleme PNG'sini 256 px WebP yap.
  - `HomeRoom.jsx`: ev iç mekânı (oyuncak evi gibi, duvarlar yalnızca içe bakar). Lobideki `🏠 Evim` binası (`HOME_DOOR`) ya da `/ev` ile girilir, kapı önünde `E` ile çıkılır. Odanın koordinatları `HOME_ROOM` (layout.js), çarpışma `resolveRoom`.
  - `interact.js`: etkileşim sabitleri (emoji tepkileri, jestler, menzil, hazır cevaplar; sunucudaki `REACTIONS`/`GESTURES`/menzillerle aynı tutulmalı).
  - **Oyuncu etkileşimi (flört)**: emoji tepkisi (`😊` düğmesi, 1-9/0 tuşları; kafanın üstünde süzülür), fısıldama (`/f isim mesaj` ya da menüden; ≤ 7 m, çevre yalnızca "🤫 fısıldıyor…" görür), jestler (kalp, çiçek, göz kırp, öpücük, selam, dans; ≤ 8 m), karşılıklı kalp = 💞 eşleşme (10 dk penceresi, `MatchOverlay`), özel sohbette "yazıyor…" ve emoji seçici. Karaktere tıklayınca ya da yakın oyuncu kartındaki 💗 ile `InteractSheet` açılır. Menzil/hız sınırı sunucuda zorlanır. Tailwind v4: `@theme` dışı keyframe'ler `index.css` sonunda.
  - `Hud.jsx` (üst çubuk, harita, ipuçları, yardım, sohbet paneli), `Social.jsx` (joystick, yakın oyuncu kartı, DM çekmecesi), `useIsTouch.js`.
- `server/game.js`: WebSocket (`/ws`). Protokol dosyanın başındaki yorumda. **Odalar**: `city` ve `home:<sahip>`; konum/sohbet yalnızca aynı odadakilere gider, `canEnter` giriş iznini belirler. Ev anahtarı oyuncu adından türer (auth yok). Özel mesaj (`to`), isim/mesaj temizleme, hız sınırı, 100 oyuncu sınırı. **Kimlik doğrulama yok**: isim istemciden gelir.
- `src/components/ui.jsx`: pastel tasarım sistemi (`ToyButton`, `Field`, `StepDots`, `PastelBackground`, `TONES` pembe/mavi). `src/index.css`: renk token'ları (`candy-*`, `ink`).

- **Kişiselleştirme** (`server/features/cosmetics.js`, `src/world/features/cosmetics.jsx`; ortak katalog `src/world/cosmeticsData.js`): (1) **Aksesuar** (taç, fiyonk, gözlük, kulaklık, tavşan kulağı, çiçek tacı, şapka × 6 pastel renk; procedural, `Accessories.jsx`): `AvatarRig`'in `cosId` prop'u kafa kemiğine (`Head`/`head_end`, `createPortal`) takar; seçim `cosStore.js`'te (id → {acc, pet}), sunucudan `welcome/join/room/cos` mesajlarıyla gelir (`cos` alanı `publicInfo`da). (2) **Evcil hayvan** (kedi/tavşan/civciv, `Pet.jsx`): `PetLayer` sahibin konumundan istemcide türetir, sunucu trafiği yok. Kalıcı: `store.user(key).cosmetics {accessory, pet}`. Gardırop: Ayarlar → 👗 ya da `/gardırop` (`setPanel('wardrobe')`, canlı R3F önizleme). (3) **Ev dekoru** (`HomeDecor.jsx`, `decor_set/decor_get`): duvar rengi/deseni, zemin, 💗 romantik ışık; `homes.js`'te `decor` alanı, yalnızca sahibi yazar, odaya `decor` yayılır; Döşe → 🎨 Dekor sekmesi (`FurnitureSheet` `tabs` kancası). (4) **Hediye** (`Gifts.jsx`, `gift_send/gift_reply`): 4 procedural hediye (`gift-*` kimlikleri `cosmeticsData`'da; mobilya kataloğundan ayrı), ≤ 8 m, `reach()` + hız sınırı, alıcı kabul edince `store.user(key).gifts`a düşer; evde Döşe → 🎁 Hediyeler'den yerleştirilir, `homes.js sanitizeItems` hediyeyi yalnızca sahibinin envanterindeyse kabul eder (`from` etiketi sunucudan gelir). Geliştirmede `window.__previewAngle` / `window.__previewCam` gardırop önizlemesini sabitler.

## Özellik modülleri (yeni özellik eklerken bunu izle)

Yeni sosyal özellikler çekirdek dosyaları şişirmeden kendi modüllerinde yaşar:
- **Sunucu**: `server/features/<ad>.js` → `(ctx) => { api?, handlers?, onJoin?, onLeave?, welcome? }`; `server/features/index.js` listesine bir satır ekle (moderasyon her zaman ilk). `ctx = { players, send, broadcast(msg, exceptId, room, from?), dist, inRoom, clean, homeKey, publicInfo }`. Oyuncu nesnesinde `me.key` (kalıcı kimlik, şimdilik addan türer), `me.room`, `me.x/z`, `me.blocks`, `me.dnd`. Kişiye yönelik her eylemden önce çekirdekteki `refuse(me, target, kind)` benzeri engel/DND denetimi yapılmalı (modül içinden `ctx.features[0].api.reach(from, target, kind)`); metinler `ctx.features[0].api.censor(text)` ile süzülür.
- **Kalıcı veri**: `server/store.js` (`user(key)` kullanıcı kaydı, `save()`); dosya `server/data/social.json` (git'e girmez). Kullanıcı alanları `store.js` içindeki `defaults()`te; yeni alan eklersen oraya ekle.
- **İstemci**: `src/world/features/<ad>.jsx` içinde `useX(ctx)` hook'u → `{ peerActions?(peer), settingsSections?, overlays? }`; `src/world/features/index.jsx`teki `useFeatures` listesine bir satır ekle. `ctx = { net, say, touch, roster, focusRef, home, panel, setPanel, openChat, closeInteract }`. Ağ: `net.on(tip, fn)` ile mesaja abone ol (döner: abonelik iptali), `net.send(obj)` ile yolla. Panel açmak için `setPanel('<ad>')`.
- Mesaj protokolü `server/game.js` başındaki yorumda; yeni mesajları oraya da yaz. Yeni dosya/çıktı kuralları: Türkçe arayüz, pastel stil, mobil öncelik.
- **İlerleme modülü** (`features/progress`): olay veriyolu `ctx.emitEvent?.(me, tip, n = 1, karşı?)` (karşı = oyuncu/anahtar; farklı kişi/mekan sayımı için). Günlük görevler (Europe/Istanbul günü, `user.quests`), 12 rozet (`user.badges`), sayaçlar `user.stats` (kümeler `peers/zones/guests`), günün önerisi (`suggest_get/hi/close`) ve sezon etkinlikleri (takvim sunucu saatine göre; `SITUAPP_EVENT=valentine|newyear|mothers|party` ile zorla; `welcome.event` + `event` yayını). Diğer modüller `game_played` ve `photo` olaylarını yollar. İstemci: `useFeatures` çıktıları `extraButtons` (TopBar sol sütun) ve `worldEffects` (Canvas içi, `EventFx` parçacıkları; Ayarlar'dan kapatılır).
- **Medya modülü** (`features/media`): özel sohbette sesli mesaj (`voice`, ≤ 96 KB / 10 sn; game.js `MAX_PAYLOAD` yalnızca `BIG_TYPES` için büyük, diğer mesajlar 8 KB) ve çıkartmalar (`sticker`, kimlikler `src/world/features/stickers.js` ile aynı; kafa üstü balonda `{ big: true }`).
- **Birlikte modülü** (`features/together`): oturma (`SEATS` layout.js'te; bank 2, şezlong/sandalye 1 kişilik; sunucu koltuğu otoriter tutar, `pose`/`poses` yayını), çift dans (`dance_invite/reply`, ≤ 6 m, 15 sn, teklif 20 sn), fotoğraf kabini (`PHOTO_SPOT`, Canvas karesi + çerçeve, `localStorage` son 12 kare, sunucuya yalnızca `photo_taken` olayı) ve plajda gün batımı anı (istemci hesaplar, `together.sky` → `TogetherScene` gökyüzü tonu). Duruş katmanı: `avatarPose.js` (kemiklere procedural; AvatarRig `pose` prop'u). Çekirdek kancaları: modül `moveVeto` (game.js 'move'), `onRoomChange`. Paylaşılan istemci durumu: `features/togetherStore.js`.
- **NPC modülü** (`features/npcs`): `src/world/npcs.js` (saf JS; sunucu da okur) şehir NPC'lerini (12 adet) tanımlar, mekân NPC'lerini `venues.js` `npc` anchor'larından türetir (kimlik `v:<mekân>`). Gezen NPC konumu `posAt(npc, Date.now())` ile paylaşılan saatten hesaplanır (sunucu konum yollamaz). `NpcLayer.jsx` (AvatarRig, etiket, selam balonu, oyuncuya dönme, köpek/kedi eşlikçisi) `where` ('city' | mekân kimliği | null) alır; hook `ctx.venue ?? 'city'` kullanır (`home` ise çizmez). Diyalog çekmecesi `features/npcs.jsx` (E / "Konuş" / tıklama); sunucu yalnızca `npc_talk {id}` alır (oda + mesafe + hız sınırı) ve `emitEvent(me,'npc_talk',1,id)` yollar → görev "2 farklı karakterle konuş", rozet "Sohbetçi" (10 farklı NPC). Yeni NPC: `npcs.js` CITY dizisine ekle, rotayı açık alana kur.
- **Mekânlar modülü** (`features/venues`): 15 mekân `src/world/venues.js`'ten; binalar `venue` kimliğiyle bağlı (`layout.js b()`), kapı önü `venueDoors.js` (`venueDoor(id)`; `E` ile girilir). Oda adı `venue:<id>` (`enterRoom({ venue })`, sunucu `room` yanıtında `venue`; World.jsx'te `venue` durumu ev sahnesinin paraleli; `useFeatures` ctx'inde `venue`). İç mekân verisi (öğeler, çarpışma, koltuklar) `venueLayout.js`, çizim `Venue.jsx` (öne çıkan eşyalar Meshy GLB: `public/models/venues/`, `scripts/meshy-batch.mjs` ile üretildi). NPC alanına (npc ± 1,1 m) eşya konmaz, tezgâh `npc.z + 1.6`. Mekân içi oturma `together` koltuk sistemini genişletir (`group` = aynı masa/yan yana şezlong → `sit_pair`, `kind: 'table'` ise "Masayı paylaşıyorsunuz ☕"). Gece Kulübü karaokesi: `server/features/venues.js` (kuyruk ≤ 6, sahne 30 sn, `kar_*` mesajları, alkış 👏), özgün şarkı sözleri `karaokeSongs.js`. Park battaniyeleri ve plaj şezlong çiftleri `layout.js`'te veri olarak.
- Paralel geliştirme (çalışma ağaçları): her kopya kendi portlarını ve veri klasörünü kullanır → sunucu `PORT=3101 SITUAPP_DATA_DIR=/tmp/x node server/index.js`, web `API_PORT=3101 npx vite --port 5201`. `node_modules`'ı ana kopyadan symlink'le.
- Test: `npm run build` + sahte `ws` istemcileriyle sunucu kuralları + Playwright ile arayüz (CLAUDE.md "Test ipuçları"). `server/` değişince sunucuyu yeniden başlat.
- **Ses modülü** (`features/audio`, `src/world/audio/`): tamamen procedural Web Audio (dış ses dosyası yok). `engine.js` (tek AudioContext, ilk dokunuşta başlar, bus'lar + sıkıştırıcı, ayarlar `situapp_audio_v1`, sekme gizliyken sessiz), `sfx.js` (efektler; ad listesi dosya başında), `music.js` (bölge sahneleri: lobby/jazz/lounge/park/beach/house/home/arcade/pop, lookahead planlayıcı, crossfade; `worldClock` gece/yağmur etkiler). Bölge: `net.room` + `zoneAt` + `venues.js type`. Başka modül ses isterse `window.dispatchEvent(new CustomEvent('situapp:sfx', { detail: 'quest' }))`; sesli mesajda müziği kısmak için `situapp:duck` (`true|false`). Test: sentez fonksiyonları `OfflineAudioContext`'e bağlanabilir (`renderScene`, `SFX[ad](ac, out, t)`); dev'de `window.__audio` müzik denetçisidir.
- **Gün-gece + hava modülü** (`features/sky`, `server/features/weather.js`): `worldClock.js` (ortak durum + saat hesabı; `hour/phase/night/sunset/weather` her saniye `publishWorld` ile yayımlanır, `setHourSource` ile hızlandırılmış saat). `world/Sky.jsx` (Canvas içi, World.jsx'te `<Sky home focusRef/>`): saat → anahtar kare renkleri, ambient/hemisphere, arka plan + sis (`skyBase` TogetherScene SkyTint'e taban verir), yıldız/ay/güneş diski, lamba parıltıları + 3 gerçek PointLight, ıslak zemin; `SKY_MATS` (pencere/neon/çeşme malzemeleri City.jsx'te paylaşılır), `skyLive` (City `Sun` ışık yönü/rengi, HomeRoom pencere camı). Ev içi gün-geceden etkilenmez. Hava: sunucu mevsim+saate göre 20-40 dk blokları seçer (`welcome.weather`, `{t:'weather', w}`; `SITUAPP_WEATHER=rain` zorlar); `WeatherFx.jsx` tek InstancedMesh (≤ 300, dokunmatik ≤ 120, etkinlik efekti varsa azalır). Ayarlar: 🌗 Zaman (localStorage `situapp_time_mode`), 🌦️ Hava efektleri. Test URL'leri: `?hour=21`, `?daylen=3` (3 dk'da bir gün), `?weather=snow`.
- **Konut Mahallesi modülü** (`features/neighborhood`): kuzeybatı/güneybatı bloklar (eski dekor binalar kaldırıldı) 12 oyuncu parseline dönüştü; veri `src/world/neighborhood.js` (saf JS: `PLOTS`, sokak x = -31, katalog, `sanitizeExterior`, çarpışma — yalnızca sahipli parsellerde `occupiedPlots`), çizim `Neighborhood.jsx` (`City.jsx` içinde; ev/bahçe/ağaç/bank Meshy GLB `public/models/neighborhood/`, çit/kapı/tabela procedural, sahibin adı + 🔒/🔓 + hoş geldin mesajı canvas tabelada). Parsel ataması sunucuda kalıcı (`homes.js` `plot`, `exterior`; `getPlot/setPlot/getExterior/setExterior/listPlotted`): ilk döşeme (≥1 eşya), `home_open` ya da `exterior_set` sıradaki boş parseli verir (çekirdek kancası `onHomeChange(me, 'save'|'open')`). Protokol: `exterior_set {ext}` → `plot {p}` yayını, `welcome.plots/myExt`. İstemci: kapı yaklaşınca `DoorPrompt` ("E · Gir", kendi evin ya da mevcut `canEnter` kuralı; reddedilirse sunucu mesajı), çıkışta parsel kapısının önüne dönülür (`plotNav.exit`, `ctx.enterHome`), Döşe → 🏡 Dış görünüm sekmesi. Bölge `residential` (`ZONES` `rects`), `/ışınlan konut`, Minimap parselleri çizer. **Mobilya tema setleri**: `furniture.js` `set` alanı (`classic`/`romantic`/`spring`/`retro`, 18 yeni Meshy eşya), Döşe çekmecesinde set sekmeleri.

## Tasarım kuralları (önemli)

- **Tüm oyun pastel, stilize, oyuncak gibi olmalı.** Gerçekçi asset karışmamalı. Tutarlılık kullanıcı için en önemli şey.
- **Öne çıkan objeler Meshy modeli olmalı (kodla çizme).** Karakterli/göze çarpan her şey (evcil hayvan, hediye, mobilya, mekân eşyaları, toplanabilirler, oturma yerleri, bina süsleri) GLB olarak Meshy'den üretilir; yalnızca küçük, fark edilmeyecek şeyler (ince çizgi/zemin karoları, ışık zinciri, parçacık, basit kutu/tabela, yardımcı şekiller) three.js ilkelleriyle çizilebilir. Toplu üretim: `NODE_USE_ENV_PROXY=1 node scripts/meshy-batch.mjs <spec.json> <çıktı klasörü>` (spec: `[{id, prompt}]`; görsel→3D→sıkıştırma otomatik, model başına ~25 kredi). Kredi sınırlı: önce `--dry-run`, aynı objeyi tekrar üretme.
- Kadın avatarlarda pembe tema, erkeklerde (Deniz, Kaan, Ege) mavi tema (`TONES`).
- Yeni ekran: `PastelBackground`, `ToyButton`, `candy-*` token'ları, Nunito yazı tipi.
- Mobil öncelikli düşün: dokunma alanları büyük, joystick, alttan açılan çekmeceler.

## 3D asset üretimi (Meshy)

Stil çapası: Meshy text-to-image task `01a20888-a21f-712f-8551-9aa5803d2d27` (pembe kafe masası). Yeni asset = `image_to_image` (nano-banana-2, çapa referanslı, arka plan kaldır) → `image_to_3d` (`meshy-t2`, smart-topology, ~4000 poly, texture `meshy-n1`). Avatar: aynı stilde T-pose görsel → `meshy-t2.5`, 15000 poly → rig (`height_meters: 1.2`) → animate (Idle action 0).

Notlar:
- Rig/animasyon dosyaları `download_model` ile inmez; URL'den indirilir.
- İndirilen GLB'ler `gltf-transform` ile sıkıştırıldı (meshopt + WebP 1024 px): 102 MB → 7,5 MB. Avatarların idle/walk/run klipleri tek GLB'de (`public/models/avatars/<isim>.glb`). Yeni asset eklerken aynısını yap.
- Skinned mesh'te `Box3` yanıltıcı; avatar ölçeği sabit (`AVATAR_HEIGHT / RIG_HEIGHT`).
- Avatarlar: zeynep, deniz, elif, kaan, mira, ege (`public/avatars/<isim>.png` portre kartları).

## Bekleyen işler (kullanıcının istediği, henüz yok)

1. **Her kullanıcının kendi evi** (en önemlisi): ev girişi + iç mekân + oda sistemi YAPILDI. Girişi, mobilya, davet ve sunucuda kayıt YAPILDI. Kalan: ev anahtarı oyuncu adından türüyor (gerçek auth gelince kullanıcı id'sine geç), evin dışarıdan görünen kapısı/tabelası, ziyaretçi sınırı.
2. Mekanlara/binalara girebilme (iç mekanlar; binalar şu an dekor).
3. Daha fazla sabit NPC (şu an yalnızca lobide Rehber).
4. Kalıcı veri: evler dosya tabanlı (`server/data/homes.json`). Hesaplar hâlâ demo/localStorage. Gerçek veritabanı için Supabase projesi gerekir. Hesabındaki `motomeet` ve `insta-copy` Supabase projeleri **başka işlere ait, dokunma**.
5. Moderasyon: engelle/şikâyet/küfür-link filtresi/rahatsız etme YAPILDI (`features/moderation`). Şikâyetler `social.json` içinde `reports`ta birikiyor, görüntüleyen bir yönetici ekranı yok. Gerçek auth (join mesajına token) yok.
6. Gerçek telefonda joystick/his testi yapılmadı.

## Test ipuçları

- Tarayıcı testinde sekme ön planda değilse R3F çizim döngüsü durur.
- Dev'de `window.__focus.current` oyuncu konumunu verir.
- İki oyuncuyu simüle etmek için `ws` ile sahte istemci bağlanabilir (protokol `server/game.js` başında).

## Git

- Commit mesajlarında ve PR açıklamalarında Claude/Anthropic'e ait hiçbir ifade kullanma (Co-Authored-By, "Generated with" vb.).
- Ana dal `main`.
