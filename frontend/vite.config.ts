import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://betgol.tech', // 🔥 Apontando direto para o seu backend na Hostinger!
        changeOrigin: true,
      },
    },
  },
})
