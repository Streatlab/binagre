import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Solo corre los tests de humo de la carpeta tests/. No toca el codigo de la app.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
