import { defineConfig, devices } from '@playwright/test';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const _dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 4450;
const baseURL = `http://localhost:${PORT}`;

// Use GitHub Actions reporter on CI, custom clean-list reporter locally
const reporters: Parameters<typeof defineConfig>[0]['reporter'] = process.env.CI
  ? [
      ['html', { outputFolder: resolve(_dirname, 'playwright-report') }],
      ['@estruyf/github-actions-reporter', { title: 'Docs E2E Test Results' }],
    ]
  : [['html', { outputFolder: resolve(_dirname, 'playwright-report') }], [resolve(_dirname, '../../e2e/reporters/clean-list-reporter.ts')]];

export default defineConfig({
  testDir: resolve(_dirname, 'tests'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : undefined,

  reporter: reporters,

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
