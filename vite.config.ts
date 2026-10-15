import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 45217,
    strictPort: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/sim/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    // Building the high-quality world rasters its ground textures in Node, about 5 s on a slower
    // 4-core runner. The 5 s default failed the same render tests on main and on every branch there.
    testTimeout: 15_000,
    // The 150-day soak measures heap after GC. Workers do not inherit --expose-gc.
    ...(process.env.SOAK_150 === '1'
      ? { execArgv: ['--expose-gc'], fileParallelism: false, maxWorkers: 1 }
      : {}),
  },
})
