import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        proxyTimeout: 3600000,  // 1 hour
        timeout: 3600000,       // 1 hour
        // Required for SSE streaming — prevent the proxy from buffering
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Tell the backend not to compress the response (needed for streaming)
            proxyReq.setHeader('Accept-Encoding', 'identity');
          });
          proxy.on('proxyRes', (proxyRes) => {
            // Disable buffering so SSE chunks pass through immediately
            proxyRes.headers['x-accel-buffering'] = 'no';
          });
        },
      },
    },
  },
})
