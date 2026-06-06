import { defineConfig } from 'vitest/config'

// Solo corre los tests de humo de la carpeta tests/. No toca el codigo de la app.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
