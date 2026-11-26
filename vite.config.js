import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import emoji from './vite-plugins/emoji.js'

// API_PORT: sunucu portu (varsayılan 3001). Paralel çalışmada her çalışma ağacı kendi portlarını kullanır.
const API = process.env.API_PORT || 3001

export default defineConfig({
  plugins: [emoji(), react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three-vendor', test: /node_modules[\\/]three/ },
            { name: 'r3f-vendor', test: /node_modules[\\/]@react-three/ },
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)/ },
            { name: 'router-vendor', test: /node_modules[\\/]react-router/ },
            { name: 'supabase-vendor', test: /node_modules[\\/]@supabase|node_modules[\\/](@supabase|isows)/ },
            { name: 'phosphor-vendor', test: /node_modules[\\/]@phosphor-icons/ },
          ],
        },
      },
    },
  },
  server: {
    proxy: {
      // çok oyunculu WebSocket ve API (npm run server → :3001, ya da API_PORT)
      '/ws': { target: `ws://localhost:${API}`, ws: true },
      '/api': { target: `http://localhost:${API}` },
    },
  },
})
