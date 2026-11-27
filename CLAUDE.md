# Rastla (repo/kod adı: SituApp)

Pastel/oyuncak görünümlü, çok oyunculu, tarayıcıda çalışan 3B sosyal/flört dünyası (React + react-three-fiber + Express/WebSocket, isteğe bağlı Supabase). Kullanıcı Türkçe konuşur; **arayüz metinleri Türkçe**.

> **Önce buradan başla.** Dosya başına ne yaptığını `docs/FILE_MAP.md` söyler (`npm run docs:map` ile yenilenir). Sistem ayrıntıları `docs/FEATURES.md`'de; oradaki "Güncel durum" bölümü eski notların yerine geçer. Çelişkide **kod doğrudur**.

## Depo haritası

| Yer | İçerik |
|---|---|
| `src/pages/` | Sayfalar. `World.jsx` oyunun orkestratörü (Canvas, ağ, HUD, odalar) |
| `src/world/` | 3B dünya: `layout.js` (harita verisi, tek kaynak), `City.jsx`, `Sky.jsx`, `Venue.jsx`, `HomeRoom.jsx`, oyuncu/avatar, `net.js` (WebSocket hook'u) |
| `src/world/features/` | İstemci özellik modülleri (`useX(ctx)` hook'ları); kayıt: `features/index.jsx` |
| `src/components/`, `src/lib/` | Ortak arayüz (`ui.jsx`, `Icon.jsx`, `emoji.jsx`), auth soyutlaması |
| `server/game.js` | Oyun sunucusu çekirdeği (WebSocket protokolü dosya başındaki yorumda) |
| `server/features/` | Sunucu özellik modülleri; kayıt: `features/index.js` |
| `server/store.js`, `homes.js`, `supa.js`, `guard.js` | Kalıcı veri (dosya/Supabase), evler, Supabase istemcisi, hile koruması |
| `src/world/*Data.js`, `layout.js`, `npcs.js`, `collectibles.js`, `vibeData.js`... | **Saf JS ortak veri**: istemci ve sunucu aynı dosyayı okur (tarayıcı/Node bağımsız tut) |
| Parçalı büyük dosyalar | `City.jsx` → `CityBuildings/CitySea/CityDecor/cityShared`; `Sky.jsx` → `SkyDome/SkyLights/skyState` (`skyLive`, `SKY_MATS` hâlâ `./Sky`'dan da alınır); `Venue.jsx` → `venueParts/VenueSpecial/VenueLighting`; `Social.jsx` → `Joysticks/InteractSheet/SocialChips/ChatSheet`; `World.jsx` → `WorldCanvas` (R3F sahnesi, props ile), `WorldOverlays`, `worldConfig`, `worldCommands`, hook'lar `useHomeFurniture/useAirportTutorial/useSkills`; `SurfArena.jsx` → `surfDraw.js` (canvas çizimi) + `SurfHud.jsx`; `cosmetics.jsx` → `Wardrobe/WardrobePreview/GiftsUi`; `fitness.jsx` → `BoxingArena`; `minigameArenas.jsx` → her arena ayrı dosya |
| `scripts/` | Asset üretimi (Meshy), ölçüm, yük testi, `file-map.mjs` |
| `docs/` | `FILE_MAP.md` (otomatik), `FEATURES.md` (ayrıntılı sistem notları) |

## Temel mimari kurallar

- **Sunucu otoriterdir.** İstemci güvenilmez: altın/puan/ödül/konum kararı yalnızca sunucuda. Yeni altın kaynağı `server/features/economy.js` `DAILY_CAP`'e neden ekler. Ayrıntı: `docs/FEATURES.md` (Hile/bot koruması, Guard mührü).
- **Özellik modülü kalıbı** (yeni özellik eklerken bunu izle; çekirdek dosyaları şişirme):
  - Sunucu: `server/features/<ad>.js` → `(ctx) => { api?, handlers?, onJoin?, onLeave?, onRoomChange?, welcome? }`, `features/index.js` listesine ekle (moderasyon her zaman ilk). `ctx = { players, send, broadcast, dist, inRoom, clean, homeKey, publicInfo, emitEvent, addCoins, spendCoins, ... }`.
  - İstemci: `src/world/features/<ad>.jsx` → `useX(ctx)` → `{ extraButtons?, overlays?, peerActions?, peerHeader?, settingsSections?, worldEffects?, sceneNodes? }`, `features/index.jsx` `useFeatures` listesine ekle. Ağ: `net.on(tip, fn)` (iptal fonksiyonu döner), `net.send(obj)`.
  - Yeni mesajları `server/game.js` başındaki protokol yorumuna yaz. Kişiye yönelik eylemden önce engel/DND denetimi (`ctx.features[0].api.reach`), metinler `censor`'dan geçer.
  - Kalıcı veri: `store.user(key)`; yeni alanı `store.js defaults()`'a ekle.
- **Odalar**: `city`, `home:<anahtar>`, `venue:<id>`; konum/sohbet yalnızca aynı odada yayılır.
- **HUD**: kartlar `Dock`/`TopDock` (portal) ile alt alta akar, üst üste binmez.
- **Yeni GLB** kullanıyorsan `src/world/preload.js` listelerine ekle (yükleme şelalesi sorunu).
- **Dosya boyutu**: bir dosya ~600 satırı geçerse bileşenlerini ayrı dosyalara böl (ortak sabitler `*Shared.js`'e, döngüsel import olmasın); eski yol yeniden dışa aktarımla (`export * from`) geriye uyumlu kalsın.
- **Dosya başlığı**: her yeni dosyanın ilk satırı tek cümlelik açıklama yorumu olsun (`FILE_MAP.md` bunu okur).
- Metinler Türkçe, mobil öncelikli, pastel stil (`candy-*` token'ları, `ToyButton`, `PastelBackground`).

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
- **Supabase modu (gerçek hesaplar + kalıcı veri)**: web için `.env.local`'a `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (publishable), sunucu için `server/.env`'e `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (GİZLİ secret/service_role; yalnızca sunucuda, depoya/log'a/çıktıya asla), `SUPABASE_PUBLISHABLE_KEY`. Sunucuda bunlar yoksa eski ad-tabanlı + dosya (`server/data/*.json`) modu çalışır; istemcide yoksa auth demo modundadır. Anahtar `eyJ` ile başlamıyorsa (`sb_secret_…`) yalnızca `apikey` başlığı gönderilir. `ALLOW_GUEST=1` Supabase modunda tokensiz misafir girişine izin verir (kalıcı veri yazılmaz). Proje: `lsaxidkolqyvpnwofljf` (`motomeet` ve `insta-copy` başka işlere ait, dokunma). Şema: `profiles` (+`handle_new_user` tetikleyicisi, `username_available` RPC, `profiles_guard` photo_hidden'ı korur), `user_data`/`homes`/`reports` (RLS açık, politika yok → yalnızca service role), Storage `profile-photos` (public, `<uid>/…`). **Supabase Auth'ta e-posta doğrulaması AÇIK kalmalı** (Dashboard → Authentication → Providers → Email → Confirm email; flört uygulaması); redirect URL'lerine üretim/geliştirme adresini ekle (şifre sıfırlama/doğrulama bağlantıları `window.location.origin`'e döner). Eski dosya verisini taşımak için: `node scripts/migrate-to-supabase.mjs --dry-run` sonra `--dry-run`'sız (kullanıcı adı eşleşen profillere uid olarak çevirir, eşleşmeyenleri raporlar). Sunucu bulutta `NODE_USE_ENV_PROXY=1` ister.
- Dev'de giriş ekranında "⚡ Hızlı giriş (test)" düğmesi çıkar (yalnızca dev + demo modu).
- `?touch=1` ile masaüstünde dokunmatik arayüz (joystick) test edilir.

## Tasarım kuralları (önemli)

- **Tüm oyun pastel, stilize, oyuncak gibi olmalı.** Gerçekçi asset karışmamalı. Tutarlılık kullanıcı için en önemli şey.
- **Öne çıkan objeler Meshy modeli olmalı (kodla çizme).** Karakterli/göze çarpan her şey (evcil hayvan, hediye, mobilya, mekân eşyaları, toplanabilirler, oturma yerleri, bina süsleri) GLB olarak Meshy'den üretilir; yalnızca küçük, fark edilmeyecek şeyler (ince çizgi/zemin karoları, ışık zinciri, parçacık, basit kutu/tabela, yardımcı şekiller) three.js ilkelleriyle çizilebilir. Toplu üretim: `NODE_USE_ENV_PROXY=1 node scripts/meshy-batch.mjs <spec.json> <çıktı klasörü>` (spec: `[{id, prompt}]`; görsel→3D→sıkıştırma otomatik, model başına ~25 kredi). Kredi sınırlı: önce `--dry-run`, aynı objeyi tekrar üretme.
- **Arayüz kromu ikonları: Phosphor Icons (MIT, `fill` ağırlığı)**: düğme/menü/üst çubuk ikonları `<Ico name="..." />` (`src/components/Icon.jsx`, isim→bileşen+ton tablosu); özellik düğmeleri `extraButtons` için `icon: '<ad>'` verilir (yoksa `emoji`). Yeni düğme ikonu gerekirse `Icon.jsx` tablosuna ekle. İçerik emojileri (yiyecek, mekân, tepki, sohbet) aşağıdaki Fluent setinde kalır.
- **İçerik ikonları: tek, tutarlı set (Fluent Emoji 3D, Microsoft, MIT).** Kodda emojiyi olduğu gibi yaz (`'🏠 Evim'`, `{x.emoji}`); `vite-plugins/emoji.js` JSX çocuklarını (metin ve `{ifade}`) `emojify()`'dan geçirir ve `src/components/emoji.jsx` emojileri `public/icons/fluent/<kod>.webp` görseline çevirir (sohbette kullanıcının yazdığı ve sunucudan gelen emojiler de). Öznitelikler (`title`, `aria-label`, `placeholder`), canvas ve `document.title` düz metin kalır; sette olmayan (renk tonlu vb.) emojiler yerel emoji olarak görünür. Tek ikon için `<Em e="🏠" size={32} />`. Seti yeniden üretmek: `scripts/build-emoji-pack.py` (dosyanın başında komutlar). Lisans: `public/icons/fluent/LICENSE.txt`.
- **Unisex palet**: oyun kız çocuğu oyununa benzemesin diye pembe tonlar sıcak turuncu-amber'e çevrildi (seviye atlama rozeti `#ffe48f→#ff9f43`, banner `#4a3b5c`; ana vurgu `#fdb252`, token `candy-pink*` artık turuncu): arayüz hex'leri `scripts/unisex-colors.py` (pembe→turkuaz) + `scripts/turquoise-to-orange.py` (turkuaz→turuncu) ile; yeni renk yazarken pembe kullanma. 3D'de `src/world/unisex.js` global shader yaması (GLB dokularındaki pembeler de çevrilir; `main.jsx` kurar, materyalde `userData.keepHue` ile kapatılır). Kadın/erkek avatar teması farkı (`TONES`) küçüldü.
- Yeni ekran: `PastelBackground`, `ToyButton`, `candy-*` token'ları, Nunito yazı tipi.
- Mobil öncelikli düşün: dokunma alanları büyük, joystick, alttan açılan çekmeceler.

## 3D asset üretimi (Meshy)

Stil çapası: Meshy text-to-image task `01a20888-a21f-712f-8551-9aa5803d2d27` (pembe kafe masası). Yeni asset = `image_to_image` (nano-banana-2, çapa referanslı, arka plan kaldır) → `image_to_3d` (`meshy-t2`, smart-topology, ~4000 poly, texture `meshy-n1`). Avatar: aynı stilde T-pose görsel → `meshy-t2.5`, 15000 poly → rig (`height_meters: 1.2`) → animate (Idle action 0).

Notlar:
- Rig/animasyon dosyaları `download_model` ile inmez; URL'den indirilir.
- İndirilen GLB'ler `gltf-transform` ile sıkıştırıldı (meshopt + WebP 1024 px): 102 MB → 7,5 MB. Avatarların idle/walk/run klipleri tek GLB'de (`public/models/avatars/<isim>.glb`). Yeni asset eklerken aynısını yap.
- Skinned mesh'te `Box3` yanıltıcı; avatar ölçeği sabit (`AVATAR_HEIGHT / RIG_HEIGHT`).
- Avatarlar: zeynep, deniz, elif, kaan, mira, ege (`public/avatars/<isim>.png` portre kartları).

## Test ipuçları

- **Yükleme (React 19 şelale sorunu):** Yükleme bekleyen (`useGLTF`) bileşen kardeşlerinin çizilmesini durdurur; modeller tek tek yüklenir ve her adımda sahne yeniden çizilir (yavaş makinede dakikalar). Bu yüzden yeni bir GLB kullanıyorsan `src/world/preload.js` listelerine ekle (`preloadCritical`: şehir + oyuncu avatarı, `preloadLater`: geri kalan). `World.jsx`'te ana sahne (şehir/oda + oyuncu) kendi `Suspense`'inde, uzak oyuncular/NPC/toplanabilirler/hayvan/etkinlik katmanları ayrı `Suspense`'lerde (`features/index.jsx` her `sceneNodes`/`worldEffects`'i sarar); yükleme ekranı `SceneReady` ile ana sahne gerçekten çizilince kapanır.

- Tarayıcı testinde sekme ön planda değilse R3F çizim döngüsü durur.
- Dev'de `window.__focus.current` oyuncu konumunu verir.
- İki oyuncuyu simüle etmek için `ws` ile sahte istemci bağlanabilir (protokol `server/game.js` başında).

## Git

- Commit mesajlarında ve PR açıklamalarında Claude/Anthropic'e ait hiçbir ifade kullanma (Co-Authored-By, "Generated with" vb.).
- Ana dal `main`.
