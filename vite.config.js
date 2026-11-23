import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// API_PORT: sunucu portu (varsayılan 3001). Paralel çalışmada her çalışma ağacı kendi portlarını kullanır.
const API = process.env.API_PORT || 3001

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // çok oyunculu WebSocket ve API (npm run server → :3001, ya da API_PORT)
      '/ws': { target: `ws://localhost:${API}`, ws: true },
      '/api': { target: `http://localhost:${API}` },
    },
  },
})
