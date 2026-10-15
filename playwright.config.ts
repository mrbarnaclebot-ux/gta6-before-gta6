import { defineConfig } from '@playwright/test'

const PORT = 5199
const CI = !!process.env.CI

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  forbidOnly: CI,
  // SwiftShader on a shared runner stalls now and then; one retry tells a flake from a break.
  retries: CI ? 1 : 0,
  workers: CI ? 1 : undefined,
  reporter: CI ? 'list' : undefined,
  use: {
    baseURL: `http://localhost:${PORT}`,
    // A smaller frame in CI: SwiftShader's cost is per pixel and the runner has 2 cores.
    viewport: CI ? { width: 640, height: 360 } : { width: 1280, height: 720 },
    trace: CI ? 'retain-on-failure' : 'off',
    // Headless Chromium needs SwiftShader allowed explicitly to expose WebGL2.
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: {
    // CI tests the production build that `pnpm build` just made; locally, the dev server.
    command: CI
      ? `pnpm exec vite preview --port ${PORT} --strictPort`
      : `pnpm exec vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
})
