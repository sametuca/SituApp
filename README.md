# Rastla

**An open-source, browser-native 3D multiplayer social world** — built with React Three Fiber, Three.js, and WebSocket. No game engine required.

> Pastel-styled, toy-aesthetic virtual city where multiple players roam, chat, and interact in real time — directly in the browser.

---

## ✨ Features

- 🌐 **Full 3D multiplayer** — real-time positional sync via WebSocket (10 Hz tick), private messaging, proximity detection, up to 100 concurrent players
- 🎨 **Pastel / toy design system** — consistent stylized aesthetic with custom avatar rigs, ToyButton/pastel UI tokens, Nunito font
- 📦 **Ultra-light asset pipeline** — GLTF-transform compression (meshopt + WebP 1024px): full city world at ~7.5 MB total
- 📱 **Mobile-first** — virtual joystick, large touch targets, bottom-sheet drawers, `?touch=1` desktop test mode
- 🔐 **Pluggable auth** — Supabase integration or zero-config demo mode (localStorage, no backend needed)
- 🤖 **AI-generated 3D assets** — Meshy text-to-3D pipeline with style anchoring, smart topology, auto-rig + animation baked into single GLBs
- 🏙️ **Modular world layout** — neighborhoods, buildings, collision, teleports, NPC guide system defined in a single `layout.js` data file
- 🧩 **Developer-friendly architecture** — clean separation between world engine, multiplayer layer, auth, and UI; easy to fork and extend

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router 7, Tailwind CSS 4 |
| 3D Engine | Three.js, React Three Fiber, Drei |
| Multiplayer | WebSocket (`ws`), Express 5 |
| Auth | Supabase (optional) / Demo mode |
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

Copy `.env.example` and fill in your keys (all optional — the app works in demo mode without them):

```bash
cp .env.example .env.local
```

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (optional) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (optional) |
| `MESHY_API_KEY` | Only needed for 3D asset generation via Asset Studio |

> Without Supabase keys, the app runs in **demo mode** — accounts are stored in localStorage. A quick-login button appears in dev mode.

### Build for Production

```bash
npm run build
```

---

## 🗺️ Architecture

```
/
├── src/
│   ├── pages/          # AuthPage, AvatarSelect, World, AssetStudio
│   ├── world/          # City, LocalPlayer, RemotePlayers, AvatarRig
│   │   ├── layout.js   # Map data: neighborhoods, buildings, collisions, NPCs
│   │   ├── net.js      # useMultiplayer hook (WebSocket, 10Hz, refs)
│   │   ├── Hud.jsx     # Top bar, minimap, chat panel, help overlay
│   │   └── Social.jsx  # Joystick, nearby player cards, DM drawer
│   ├── lib/            # auth.js, AuthContext, RequireAuth
│   └── components/     # ui.jsx: ToyButton, Field, PastelBackground, TONES
├── server/
│   ├── game.js         # WebSocket server: protocol, rate limiting, 100-player cap
│   └── index.js        # Express entry point, static serving
└── public/
    ├── models/         # Compressed GLB assets (avatars + environment props)
    └── avatars/        # Avatar portrait cards (PNG)
```

**User flow:** `/` Login → `/avatar` Character select → `/world` City (lobby plaza as starting point)

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

---

## 🗺️ Roadmap

- [ ] **Personal homes** — per-user instanced rooms with furniture placement and friend invites
- [ ] **Interior spaces** — enter buildings and locations (currently decorative)
- [ ] **Persistent data** — Supabase-backed storage for homes, inventory, relationships
- [ ] **More NPCs** — context-aware autonomous characters beyond the lobby guide
- [ ] **Moderation** — profanity filter, block/report, server-side auth tokens
- [ ] **Mobile testing** — real device joystick feel polish

---

## 🤝 Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Open a Pull Request

---

## 📄 License

MIT — see [LICENSE](./LICENSE)
