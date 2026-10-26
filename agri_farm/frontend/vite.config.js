import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Rolldown codeSplitting replaces the deprecated advancedChunks option.
    // Keep frequently cached vendors separate; PDF code is also dynamically imported
    // from report actions so it is not downloaded on the initial app load.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 20 },
            { name: 'motion', test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/, priority: 10 },
            { name: 'icons', test: /node_modules[\\/]lucide-react[\\/]/, priority: 5 },
            { name: 'http', test: /node_modules[\\/]axios[\\/]/, priority: 5 },
            { name: 'pdf', test: /node_modules[\\/](jspdf|jspdf-autotable|fflate|fast-png|iobuffer)[\\/]/, priority: 15 },
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
