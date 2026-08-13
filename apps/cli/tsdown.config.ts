import { defineConfig } from 'tsdown'

/**
 * The dsh CLI ships two entries: the `bin` referenced by package.json `bin`,
 * and `index` exposing the same profile boot for in-process embedders (the
 * Electron main process). The root tsdown builds only `lib/types/index.js`, so
 * this override points at both compiled entrypoints; the bin's reachable mode
 * modules bundle with it. Declarations come from `tsc -b` (dts: false),
 * matching every package.
 */
export default defineConfig({
  entry: ['lib/types/bin.js', 'lib/types/index.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
})
