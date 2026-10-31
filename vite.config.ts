import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Tests that check the drawn 3D picture (pixels or screenshots). They keep drawing.
const SCREEN_TESTS = ['src/ui/infoViews.e2e.test.ts', 'src/ui/deskTheme.e2e.test.ts']
const screenRun = process.argv.some((arg) => SCREEN_TESTS.some((file) => file.endsWith(arg) || arg.includes(file)))

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
    // Screenshot tests draw the full 3D picture, which takes minutes in headless Chrome without a GPU.
    // They run with `npm run test:screens` (or by naming the file), not in the default `npm test`.
    exclude: screenRun ? ['**/node_modules/**'] : ['**/node_modules/**', ...SCREEN_TESTS],
    // CI runners are small; two workers keep the heavy sim tests from starving each other.
    ...(process.env.CI ? { maxWorkers: 2 } : {}),
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
