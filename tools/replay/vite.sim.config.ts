import { defineConfig } from 'vite'
import { resolve } from 'node:path'
const root = process.cwd()
export default defineConfig({
  root,
  logLevel: 'warn',
  build: {
    outDir: resolve(root, 'dist-sim'),
    emptyOutDir: true,
    target: 'es2022',
    minify: false,
    lib: { entry: resolve(root, 'tools/replay/host.ts'), formats: ['es'], fileName: () => 'hatchfield-sim.mjs' },
    rollupOptions: { external: [/^node:/] },
  },
})
