import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Heavy vendor libraries in their own cached chunks, so a code change
        // does not make farm workers re-download charts / PDF tools.
        manualChunks: {
          react: ['react', 'react-dom'],
          icons: ['lucide-react'],
          charts: ['recharts'],
          pdf: ['jspdf', 'jspdf-autotable'],
        },
      },
    },
  }
});