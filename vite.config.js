import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // çok oyunculu WebSocket ve API (npm run server → :3001)
      '/ws': { target: 'ws://localhost:3001', ws: true },
      '/api': { target: 'http://localhost:3001' },
    },
  },
})
