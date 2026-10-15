import { defineConfig } from '@playwright/test'

const PORT = 5199

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 720 },
    // Headless Chromium needs SwiftShader allowed explicitly to expose WebGL2.
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
  },
})
