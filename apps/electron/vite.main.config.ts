import { builtinModules } from 'node:module'
import { defineConfig } from 'vite'

/**
 * Electron main-process build: an ESM bundle whose workspace imports stay
 * external (resolved from node_modules at runtime, like apps/cli's bin).
 */
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'node20',
    rollupOptions: {
      input: { main: 'src/main.ts' },
      output: {
        entryFileNames: '[name].js',
        format: 'es',
      },
      external(id) {
        return id === 'electron'
          || id.startsWith('node:')
          || id.startsWith('@deepseek-ai/')
          || builtinModules.includes(id)
      },
    },
  },
})
