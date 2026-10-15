import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'muf-workbench-dev-route',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.split('?')[0] !== '/__muf-workbench') return next();
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end('<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>MUF Visual Workbench</title></head><body><div id="muf-workbench-root"></div><script type="module" src="/src/editing-x-projetcs.tsx"></script></body></html>');
        });
      },
    },
  ],
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