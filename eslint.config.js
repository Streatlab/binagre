import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  // C24 · Prohíbe color hexadecimal literal en src/ (kit de tokens obligatorio).
  // Excepción: los archivos maestros de estilo y el marco de documentos.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/styles/**', 'src/lib/marcoDoc.ts', 'src/components/marco/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/#[0-9a-fA-F]{3,8}/]',
          message: 'Prohibido hex literal: usa un token de @/styles/neobrutal.',
        },
        {
          selector: 'TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}/]',
          message: 'Prohibido hex literal en template: usa un token de @/styles/neobrutal.',
        },
      ],
    },
  },
])
