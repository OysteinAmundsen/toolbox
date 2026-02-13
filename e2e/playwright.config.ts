import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'path';

/**
 * Cross-Framework Visual Regression Testing Configuration
 *
 * This Playwright config runs visual regression tests across all three
 * demo applications (Vanilla, React, Angular) to ensure visual parity.
 */

// Workspace root (one level up from e2e folder)
const workspaceRoot = resolve(__dirname, '..');

// Default ports for each demo (from project.json configurations)
const DEMO_PORTS = {
  vanilla: 4000, // From demos/employee-management/vanilla/project.json
  react: 4300, // From demos/employee-management/react/project.json
  angular: 4200, // Angular default
};

// Use GitHub Actions reporter on CI, custom clean-list reporter locally
const reporters: Parameters<typeof defineConfig>[0]['reporter'] = process.env.CI
  ? [
      ['html', { outputFolder: '../playwright-report' }],
      ['@estruyf/github-actions-reporter', { title: 'E2E Test Results' }],
    ]
  : [['html', { outputFolder: '../playwright-report' }], ['./reporters/clean-list-reporter.ts']];

export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only - individual test files override with retries: 0
   * where appropriate. This acts as a fallback for any test files that
   * don't set their own retry policy. */
  retries: 0,
  /* Run tests in parallel - since visual baselines are not committed and
   * expectScreenshotIfBaselineExists skips comparisons when no baseline exists,
   * we can safely parallelize even in CI */
  workers: process.env.CI ? 4 : undefined,
  /* Reporter to use - GitHub Actions on CI, custom clean-list locally */
  reporter: reporters,
  /* Shared settings for all the projects below */
  use: {
    /* Base URL for tests - vanilla is the baseline */
    baseURL: `http://localhost:${DEMO_PORTS.vanilla}`,
    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    /* Video on failure */
    video: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Can add Firefox and WebKit for broader testing
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  /*
   * Web server configuration
   *
   * IMPORTANT: This test suite requires demo servers to be running before tests start.
   *
   * For local development, start servers manually in separate terminals:
   *   bun nx run demo-vanilla:serve
   *   bun nx run demo-react:serve
   *   bun nx run demo-angular:serve
   *
   * In CI, the workflow starts servers before running tests.
   *
   * We don't use Playwright's webServer auto-start because Nx commands
   * don't work reliably when spawned as subprocesses on all platforms.
   */
  webServer: undefined,

  /* Folder for test artifacts (screenshots, videos, traces) */
  outputDir: './test-results',

  /* Folder for snapshot baselines (visual regression) */
  snapshotDir: './snapshots',

  /* Snapshot settings for visual regression */
  expect: {
    /* Threshold for visual comparisons - allow minor anti-aliasing differences */
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      threshold: 0.2,
    },
    toMatchSnapshot: {
      maxDiffPixelRatio: 0.01,
      threshold: 0.2,
    },
  },

  /* Global timeout */
  timeout: 60 * 1000,
});
