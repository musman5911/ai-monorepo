import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Split stable third-party libraries into their own cacheable chunks so
    // the app bundle stays small and a code change doesn't re-download vendors.
    // (Vite 8 / Rolldown syntax.)
    rollupOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'motion', test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/ },
            { name: 'icons', test: /node_modules[\\/]lucide-react[\\/]/ },
            { name: 'http', test: /node_modules[\\/]axios[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    host: true, // Listen on all network interfaces (IPv4)
    allowedHosts: true, // Accept any preview/proxy host
    port: 3030,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      }
    }
  }
})
