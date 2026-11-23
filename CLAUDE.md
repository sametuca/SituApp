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
  - `Hud.jsx` (üst çubuk, harita, ipuçları, yardım, sohbet paneli), `Social.jsx` (joystick, yakın oyuncu kartı, DM çekmecesi), `useIsTouch.js`.
- `server/game.js`: WebSocket (`/ws`). Protokol dosyanın başındaki yorumda. **Odalar**: `city` ve `home:<sahip>`; konum/sohbet yalnızca aynı odadakilere gider, `canEnter` giriş iznini belirler. Ev anahtarı oyuncu adından türer (auth yok). Özel mesaj (`to`), isim/mesaj temizleme, hız sınırı, 100 oyuncu sınırı. **Kimlik doğrulama yok**: isim istemciden gelir.
- `src/components/ui.jsx`: pastel tasarım sistemi (`ToyButton`, `Field`, `StepDots`, `PastelBackground`, `TONES` pembe/mavi). `src/index.css`: renk token'ları (`candy-*`, `ink`).

## Tasarım kuralları (önemli)

- **Tüm oyun pastel, stilize, oyuncak gibi olmalı.** Gerçekçi asset karışmamalı. Tutarlılık kullanıcı için en önemli şey.
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
5. Moderasyon: küfür filtresi, engelle, şikâyet. Gerçek auth (join mesajına token).
6. Gerçek telefonda joystick/his testi yapılmadı.

## Test ipuçları

- Tarayıcı testinde sekme ön planda değilse R3F çizim döngüsü durur.
- Dev'de `window.__focus.current` oyuncu konumunu verir.
- İki oyuncuyu simüle etmek için `ws` ile sahte istemci bağlanabilir (protokol `server/game.js` başında).

## Git

- Commit mesajlarında ve PR açıklamalarında Claude/Anthropic'e ait hiçbir ifade kullanma (Co-Authored-By, "Generated with" vb.).
- Ana dal `main`.
