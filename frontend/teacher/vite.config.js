import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Set base to repo name for GitHub Pages
  base: '/Gojo-Teacher-Web/',
  server: {
    proxy: {
      // Proxy /api calls to the backend to avoid CORS during development
      '/api': {
        target: 'https://gojo-teacher-web.onrender.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  }
})
