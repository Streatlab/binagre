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
  optimizeDeps: {
    exclude: ['node-unrar-js'],
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
})
