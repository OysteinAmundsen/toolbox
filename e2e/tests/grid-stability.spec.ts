import { expect, test, type Page } from '@playwright/test';
import { DEMOS, waitForGridReady } from './utils';

/**
 * Grid Stability Tests
 *
 * Structural assertions that verify grid invariants:
 * - Virtualization keeps DOM bounded
 * - No JS errors during normal interaction sequences
 * - No memory leaks from data replacement or scrolling
 *
 * These tests use the vanilla demo server and run as part of the regular
 * e2e suite — they are fast and deterministic (no timing-sensitive assertions).
 */

async function setRowCount(page: Page, count: number): Promise<void> {
  const slider = page.locator('#row-count');
  if (await slider.isVisible()) {
    await slider.fill(String(count));
    await slider.dispatchEvent('input');
    await page.waitForTimeout(500);
    await waitForGridReady(page);
  }
}

// ─── Virtualization ─────────────────────────────────────────────────────

test.describe('Stability: Virtualization', () => {
  test('DOM row count stays bounded regardless of data size', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);
    await setRowCount(page, 1000);

    const domMetrics = (await page.evaluate(`
      (() => {
        const grid = document.querySelector('tbw-grid');
        if (!grid) return { rows: 0, cells: 0 };
        const rows = grid.querySelectorAll('.data-grid-row').length;
        const cells = grid.querySelectorAll('.cell').length;
        return { rows, cells };
      })()
    `)) as { rows: number; cells: number };

    // With 1000 data rows, DOM should have far fewer rendered rows
    expect(domMetrics.rows).toBeLessThan(80);
    expect(domMetrics.rows).toBeGreaterThan(0);
    expect(domMetrics.cells).toBeLessThan(2000);
    expect(domMetrics.cells).toBeGreaterThan(0);
  });

  test('DOM stays bounded after scrolling to bottom', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);
    await setRowCount(page, 1000);

    await page.evaluate(`
      (async () => {
        const scrollable = document.querySelector('.faux-vscroll');
        if (!scrollable) return;
        scrollable.scrollTop = scrollable.scrollHeight - scrollable.clientHeight;
        await new Promise(r => requestAnimationFrame(() => r()));
        await new Promise(r => setTimeout(r, 200));
      })()
    `);

    const domRows = await page.evaluate(`
      document.querySelector('tbw-grid')?.querySelectorAll('.data-grid-row').length ?? 0
    `);

    expect(domRows).toBeLessThan(80);
    expect(domRows).toBeGreaterThan(0);
  });
});

// ─── Error Budget ───────────────────────────────────────────────────────

test.describe('Stability: Error Budget', () => {
  test('no JS errors during normal operation sequence', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    const scrollable = page.locator('.faux-vscroll');

    await scrollable.evaluate((el) => {
      el.scrollTop = 200;
    });
    await page.waitForTimeout(100);
    await scrollable.evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.waitForTimeout(100);

    const header = page.locator('[role="columnheader"]:not([data-field^="__tbw_"])').first();
    await header.click();
    await page.waitForTimeout(200);

    const toggle = page.locator('.master-detail-toggle').first();
    if (await toggle.isVisible()) {
      await toggle.click({ force: true });
      await page.waitForTimeout(200);
      await toggle.click({ force: true });
      await page.waitForTimeout(200);
    }

    const slider = page.locator('#row-count');
    if (await slider.isVisible()) {
      await slider.fill('300');
      await slider.dispatchEvent('input');
      await page.waitForTimeout(500);
    }

    expect(errors).toHaveLength(0);
  });
});

// ─── Memory Stability ───────────────────────────────────────────────────

test.describe('Stability: Memory', () => {
  test('repeated data replacement does not leak memory', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    const cdp = await page.context().newCDPSession(page);

    await cdp.send('HeapProfiler.collectGarbage');
    const baseline = (await cdp.send('Runtime.getHeapUsage')) as {
      usedSize: number;
      totalSize: number;
    };

    await page.evaluate(`
      (async () => {
        const grid = document.querySelector('tbw-grid');
        if (!grid) return;
        for (let cycle = 0; cycle < 10; cycle++) {
          const rows = [];
          for (let i = 0; i < 500; i++) {
            rows.push({
              id: 'c' + cycle + '-' + i,
              firstName: 'First' + i,
              lastName: 'Last' + i,
              email: 'e' + i + '@test.com',
              department: 'Dept' + (i % 5),
              salary: 50000 + i * 100,
            });
          }
          grid.rows = rows;
          await new Promise(r => setTimeout(r, 200));
        }
      })()
    `);

    await cdp.send('HeapProfiler.collectGarbage');
    const final = (await cdp.send('Runtime.getHeapUsage')) as {
      usedSize: number;
      totalSize: number;
    };

    const growthMB = (final.usedSize - baseline.usedSize) / 1024 / 1024;
    expect(growthMB).toBeLessThan(20);

    await cdp.detach();
  });

  test('scroll does not leak DOM nodes', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);
    await setRowCount(page, 1000);

    const before = await page.evaluate(() => document.querySelectorAll('*').length);

    await page.evaluate(`
      (async () => {
        const scrollable = document.querySelector('.faux-vscroll');
        if (!scrollable) return;
        const maxScroll = scrollable.scrollHeight - scrollable.clientHeight;
        for (let pass = 0; pass < 3; pass++) {
          for (let pos = 0; pos <= maxScroll; pos += maxScroll / 20) {
            scrollable.scrollTop = pos;
            await new Promise(r => requestAnimationFrame(() => r()));
          }
          for (let pos = maxScroll; pos >= 0; pos -= maxScroll / 20) {
            scrollable.scrollTop = pos;
            await new Promise(r => requestAnimationFrame(() => r()));
          }
        }
        scrollable.scrollTop = 0;
        await new Promise(r => setTimeout(r, 200));
      })()
    `);

    const after = await page.evaluate(() => document.querySelectorAll('*').length);
    expect(after).toBeLessThan(before * 1.2);
  });
});
