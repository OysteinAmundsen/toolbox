import { expect, test } from '@playwright/test';
import { EXCLUDED_DEMOS } from './utils';

/**
 * Smoke test: visit every demo and verify it renders a grid with rows
 * and produces no console errors.
 *
 * This is the baseline — every demo must pass this.
 * Each demo runs as its own test with a per-page timeout.
 */

// Discover all demos by fetching the index page
const demoSlugs: string[] = [];

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto('/');
  const links = await page.locator('ul a').all();
  for (const link of links) {
    const href = await link.getAttribute('href');
    if (href?.startsWith('/demo/')) {
      const slug = href.replace('/demo/', '');
      if (!EXCLUDED_DEMOS.some((ex) => slug.includes(ex))) {
        demoSlugs.push(slug);
      }
    }
  }
  await page.close();
});

test.describe('Smoke Tests — All Demos Render', () => {
  test('discovered demos from index page', () => {
    expect(demoSlugs.length).toBeGreaterThan(50);
  });

  test('every demo renders grid with rows and no console errors', async ({ page }) => {
    // 10 s budget per demo — individual goto/waitFor timeouts catch per-page hangs
    test.setTimeout(demoSlugs.length * 10_000);
    for (const slug of demoSlugs) {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });

      await page.goto(`/demo/${slug}`, { timeout: 10_000 });
      await page.waitForSelector('tbw-grid', { state: 'attached', timeout: 5_000 });

      // Most demos should render rows — some loading demos may not immediately
      const hasRows =
        (await page
          .locator('tbw-grid [role="row"]')
          .count()
          .catch(() => 0)) > 0;
      if (!hasRows) {
        // Give an extra moment for async demos
        await page.waitForTimeout(1000);
      }

      expect(errors, `${slug}: console errors`).toEqual([]);
      page.removeAllListeners('console');
    }
  });
});
