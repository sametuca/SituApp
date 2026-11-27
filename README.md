# Rastla

**An open-source, browser-native 3D multiplayer social world** — built with React Three Fiber, Three.js, and WebSocket. No game engine required.

> Pastel-styled, toy-aesthetic virtual city where players roam, chat, date, play and build a home in real time — directly in the browser.

---

## ✨ Features

- 🌐 **Full 3D multiplayer** — real-time positional sync via WebSocket (10 Hz tick), server-authoritative movement, area-of-interest streaming, up to 600 concurrent players
- 🎨 **Pastel / toy design system** — consistent stylized aesthetic, 6 rigged avatar GLBs, pastel UI tokens, Nunito/Fredoka typography
- 📦 **Compressed asset pipeline** — `gltf-transform` (meshopt + WebP 1024px) keeps the whole `public/` tree at ~30 MB; the first screen needs only a few MB
- 📱 **Mobile-first** — virtual joystick, large touch targets, bottom-sheet drawers, `?touch=1` desktop test mode
- 🔐 **Pluggable auth** — Supabase Auth (JWT verified locally against JWKS) or zero-config demo mode (localStorage, no backend needed)
- 🏙️ **18 venues + 14 city zones + 32 NPCs** — cafés, clubs, gym, surf shack, airport, homes; interiors are real rooms, not set dressing
- 🏠 **Personal homes** — 4 upgrade tiers (Garage → Villa), server-validated furniture placement, friend invites, gifts
- 🎮 **Games & economy** — boxing, surfing, beach volleyball, PvP, 5 multiplayer minigames, arcade, jobs, coins with daily caps and an audit ledger
- 💬 **Social & dating** — chat, DMs, whispers, emotes, gestures, friend graph, icebreakers, speed dating, compatibility bonds, profiles with photo privacy
- 🛡️ **Moderation & anti-cheat** — profanity filter, block/report/DND, strike system with bans, HMAC welcome proof, movement budget, honeypots
- 🧩 **Feature-module architecture** — 26 server modules + 39 client hooks; adding a feature is a file plus one line in each registry
- 🤖 **AI-generated 3D assets** — Meshy text-to-3D pipeline with style anchoring, exposed through a key-protected Asset Studio

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router 7, Tailwind CSS 4 |
| 3D Engine | Three.js 0.187, React Three Fiber 9, Drei 10 |
| Multiplayer | WebSocket (`ws`), Express 5 |
| Auth | Supabase Auth (JWKS local verify) / Demo mode |
| Persistence | Supabase REST (write-behind) / JSON files |
| Build | Vite 8, Oxlint |
| Asset Pipeline | Meshy AI, `gltf-transform` (meshopt, WebP) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+

### Installation

```bash
git clone https://github.com/sametuca/SituApp.git
cd SituApp
npm install
```

### Running in Development

```bash
npm run dev:all
```

This starts:
- **Vite** dev server at `http://localhost:5173` (frontend)
- **Express + WebSocket** server at `http://localhost:3001` (multiplayer backend)

Vite proxies `/ws` and `/api` requests to `localhost:3001` automatically.

### Environment Variables

```bash
cp .env.example .env.local          # client (Vite, optional)
cp server/.env.example server/.env  # server (optional)
```

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Client-side Supabase auth (optional) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` / `SUPABASE_PUBLISHABLE_KEY` | Server persistence + token verification |
| `MESHY_API_KEY` | 3D asset generation (Asset Studio only) |
| `STUDIO_KEY` | Protects `/api/meshy/*`, `/api/characters`, `/api/assets/import` |
| `ADMIN_KEY` | Enables the `/admin` moderation panel |
| `TRUST_PROXY` | Set to `1` behind a reverse proxy (real client IPs) |
| `CORS_ORIGINS` | Comma-separated exact origins when the frontend is hosted separately; same-origin requests work by default |

> Without Supabase keys the app runs in **demo mode** — accounts live in `localStorage` and data in `server/data/`.
> Both `.env` files are gitignored; only the `.example` files are committed.
> Username/password registration is created server-side with `SUPABASE_SERVICE_KEY` and marks the internal auth account confirmed, so users do not need to provide an email and no verification email is sent. Keep the service key only in `server/.env`; the Supabase email-confirm setting can remain enabled.

### Build & Run for Production

```bash
npm run build   # writes dist/
npm start       # Express serves dist/ + /api + /ws on :3001
```

A single Node process serves the SPA, the JSON API and the WebSocket — no separate static host needed.

---

## 🗺️ Architecture

```
/
├── src/
│   ├── pages/          # AuthPage, AvatarSelect, World, Admin, AssetStudio
│   ├── world/          # City, Venue, HomeRoom, LocalPlayer, RemotePlayers
│   │   ├── layout.js   # Map data: zones, props, collisions, NPC anchors
│   │   ├── venues.js   # 18 venue definitions, room + channel helpers
│   │   ├── net.js      # useMultiplayer hook (WebSocket, 10 Hz, refs)
│   │   ├── Hud.jsx     # Top bar, minimap, chat, menus
│   │   └── features/   # 39 client feature hooks (index.jsx registry)
│   ├── lib/            # auth, supabase, studioKey
│   └── components/     # UI kit, Icon, Dock, Consent
├── server/
│   ├── index.js        # Express entry, static dist/, /api routes
│   ├── game.js         # WebSocket core: protocol, rooms, AOI, movement
│   ├── guard.js        # Anti-cheat: strikes, bans, HMAC proof, IP limits
│   ├── features/       # 26 server modules (index.js registry)
│   ├── store.js        # Per-user data with write-behind persistence
│   ├── supa.js         # Supabase REST + JWT/JWKS verification
│   └── internalAuth.js # STUDIO_KEY gate for internal tooling endpoints
└── public/
    ├── models/         # Compressed GLB assets (avatars, props, furniture)
    ├── textures/       # Tileable WebP ground materials
    └── icons/          # Fluent Emoji 3D set
```

**User flow:** `/` Login → `/avatar` Character select → `/world` (airport on first spawn, beach afterwards)

**Rooms:** `city`, `home:<uid>`, `venue:<id>#<channel>` — venue channels shard past a soft cap of 24 players.

---

## 👾 Avatars

Six stylized toy-aesthetic characters with idle/walk/run animations baked into single compressed GLBs:

| Name | Theme |
|---|---|
| Zeynep | Pink |
| Elif | Pink |
| Mira | Pink |
| Deniz | Blue |
| Kaan | Blue |
| Ege | Blue |

---

## 🎨 3D Asset Pipeline (Meshy)

Style anchor: Meshy task `01a20888-a21f-712f-8551-9aa5803d2d27` (pastel cafe table).

**New prop workflow:**
1. `image_to_image` (nano-banana-2, style-anchored, background removed)
2. `image_to_3d` (meshy-t2, smart-topology, ~4000 poly, texture meshy-n1)
3. `gltf-transform` compression: meshopt + WebP 1024px

**New avatar workflow:**
1. T-pose image (same pastel style) → `meshy-t2.5`, 15k poly
2. Auto-rig (`height_meters: 1.2`) → animate (Idle action 0)
3. Download GLB via URL (not `download_model`) → compress

Compress any new model before committing:

```bash
npx @gltf-transform/cli optimize in.glb out.glb \
  --compress meshopt --texture-compress webp --texture-size 1024 \
  --simplify true --simplify-error 0.002
```

---

## 🗺️ Roadmap

- [x] **Personal homes** — per-user instanced rooms with furniture placement and friend invites
- [x] **Interior spaces** — 18 enterable venues with sharded channels
- [x] **Persistent data** — Supabase-backed storage for profiles, homes, inventory, relationships, leaderboards
- [x] **More NPCs** — 32 context-aware characters across the city
- [x] **Moderation** — profanity filter, block/report, server-side auth tokens, admin panel
- [ ] **Automated tests & CI** — protocol integration tests, economy/guard unit tests, lint + build pipeline
- [ ] **Horizontal scaling** — shared room state (Redis pub/sub) for multi-instance deployments
- [ ] **Mobile polish** — real-device joystick tuning and low-end GPU presets

---

## 🤝 Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Run `npm run lint` and `npm run build` before committing
4. Open a Pull Request

---

## 📄 License

MIT — see [LICENSE](./LICENSE)
