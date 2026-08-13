import { builtinModules } from 'node:module'
import { defineConfig } from 'vite'

/**
 * Electron preload build: a CommonJS bundle (the widest-compatible preload
 * format) whose only external is the `electron` module.
 */
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'node20',
    rollupOptions: {
      input: { preload: 'src/preload.ts' },
      output: {
        entryFileNames: '[name].cjs',
        format: 'cjs',
      },
      external(id) {
        return id === 'electron'
          || id.startsWith('node:')
          || builtinModules.includes(id)
      },
    },
  },
})
