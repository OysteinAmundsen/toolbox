import { defineConfig, devices } from '@playwright/test';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const _dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 4450;
const baseURL = `http://localhost:${PORT}`;

// Use GitHub summary reporter on CI, custom clean-list reporter locally.
// The summary reporter only writes to `$GITHUB_STEP_SUMMARY`, so on its own it
// leaves the job log completely silent about *which* test failed. The built-in
// `github` reporter is what turns a failure into a `::error` annotation (and
// therefore into readable output in `gh run view --log-failed`), and `list`
// keeps the raw expect diff in the log. Never drop these two.
const reporters: Parameters<typeof defineConfig>[0]['reporter'] = process.env.CI
  ? [
      ['list'],
      ['github'],
      ['html', { outputFolder: resolve(_dirname, 'playwright-report'), open: 'never' }],
      [resolve(_dirname, '../../e2e/reporters/github-summary-reporter.ts'), { title: 'Docs E2E Test Report' }],
    ]
  : [
      ['html', { outputFolder: resolve(_dirname, 'playwright-report') }],
      [resolve(_dirname, '../../e2e/reporters/clean-list-reporter.ts')],
    ];

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
      // On CI, use the system Google Chrome preinstalled on the
      // ubuntu-24.04 runner image (see ci.yml `e2e` job). Avoids the
      // `bunx playwright install` unzip-to-cache hang.
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.CI ? { channel: 'chrome' as const } : {}),
      },
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
