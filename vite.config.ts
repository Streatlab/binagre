import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { vercelApiPlugin } from './vite-api-plugin'

export default defineConfig({
  plugins: [react(), vercelApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Forzar hash único por build — 12/05/2026
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
})
