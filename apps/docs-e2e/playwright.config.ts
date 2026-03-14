import { defineConfig, devices } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const _dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 4450;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: resolve(_dirname, 'tests'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : undefined,

  reporter: process.env.CI
    ? [['html', { outputFolder: resolve(_dirname, 'playwright-report') }]]
    : [['html', { outputFolder: resolve(_dirname, 'playwright-report') }], ['list']],

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Auto-start the minimal Astro dev server before tests */
  webServer: {
    command: `bun astro dev --port ${PORT}`,
    cwd: resolve(_dirname),
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
