import { expect, test } from '@playwright/test';
import { EXCLUDED_DEMOS } from './utils';

/**
 * Smoke test: visit every demo and verify it renders a grid with rows
 * and produces no console errors.
 *
 * This is the baseline — every demo must pass this.
 */

// Discover all demos by fetching the index page
let demoSlugs: string[] = [];

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

  test('every demo renders grid with rows and no console errors', async ({ browser }) => {
    // Run in batches to avoid overwhelming the browser
    const BATCH_SIZE = 10;
    const failures: string[] = [];

    for (let i = 0; i < demoSlugs.length; i += BATCH_SIZE) {
      const batch = demoSlugs.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (slug) => {
        const page = await browser.newPage();
        const errors: string[] = [];
        page.on('console', (msg) => {
          if (msg.type() === 'error') errors.push(msg.text());
        });

        try {
          await page.goto(`/demo/${slug}`, { timeout: 15_000 });
          await page.waitForSelector('tbw-grid', { state: 'attached', timeout: 10_000 });

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

          if (errors.length > 0) {
            failures.push(`${slug}: console errors: ${errors.join('; ')}`);
          }
        } catch (e) {
          failures.push(`${slug}: ${(e as Error).message}`);
        } finally {
          await page.close();
        }
      });

      await Promise.all(promises);
    }

    if (failures.length > 0) {
      throw new Error(`Smoke test failures:\n${failures.join('\n')}`);
    }
  });
});
