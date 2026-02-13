import { expect, test } from '@playwright/test';
import { DEMOS, waitForGridReady } from './utils';

/**
 * E2E Performance Regression Tests
 *
 * These tests measure real-world grid performance in a browser and enforce
 * budgets that fail CI if a feature degrades performance. Each test measures
 * a specific operation and asserts it completes within an acceptable time.
 *
 * Performance budgets are intentionally generous (2-3x expected) to avoid
 * flaky failures from CI machine variance, while still catching real
 * regressions (10x+ slowdowns).
 *
 * Run with: npx playwright test performance-regression.spec.ts
 */

// #region Helpers

/**
 * Set the demo row count via the slider and wait for re-render.
 */
async function setRowCount(page: import('@playwright/test').Page, count: number): Promise<void> {
  const slider = page.locator('#row-count');
  if (await slider.isVisible()) {
    await slider.fill(String(count));
    await slider.dispatchEvent('input');
    await page.waitForTimeout(500);
    await waitForGridReady(page);
  }
}

/**
 * Inject rows directly into the grid element.
 * Used for demos without a row-count slider (Angular, React, Vue).
 */
async function injectRows(page: import('@playwright/test').Page, count: number): Promise<void> {
  await page.evaluate((n) => {
    const grid = document.querySelector('tbw-grid');
    if (!grid) return;
    const depts = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Legal', 'Ops'];
    const statuses = ['Active', 'On Leave', 'Remote'];
    const rows = [];
    for (let i = 0; i < n; i++) {
      rows.push({
        id: `emp-${i}`,
        firstName: `First${i}`,
        lastName: `Last${i}`,
        email: `emp${i}@example.com`,
        department: depts[i % depts.length],
        title: `Title ${i % 20}`,
        status: statuses[i % statuses.length],
        salary: 50000 + Math.random() * 100000,
        level: (i % 10) + 1,
        rating: Math.round(Math.random() * 5 * 10) / 10,
        hireDate: new Date(2015 + (i % 10), i % 12, (i % 28) + 1).toISOString().split('T')[0],
      });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (grid as any).rows = rows;
  }, count);
  await page.waitForTimeout(500);
  await waitForGridReady(page);
}

/**
 * Set row count via slider if available, otherwise inject directly.
 */
async function ensureRowCount(page: import('@playwright/test').Page, count: number): Promise<void> {
  const slider = page.locator('#row-count');
  if (await slider.isVisible()) {
    await setRowCount(page, count);
  } else {
    await injectRows(page, count);
  }
}

/**
 * Helper to wait a single rAF in Playwright evaluate context.
 */
const RAF_WAIT = `await new Promise(r => requestAnimationFrame(() => r()));`;

// #endregion

// #region Initial Render Performance

test.describe('Performance Regression: Initial Render', () => {
  test('vanilla: initial render completes within budget', async ({ page }) => {
    // Measure navigation + grid render time
    const before = Date.now();

    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    const renderTime = Date.now() - before;

    // Budget: full page load + grid render should be < 5s
    // This is generous to account for CI cold-start
    expect(renderTime).toBeLessThan(5000);
  });

  test('vanilla: grid renders 500 rows within time budget', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    // Set to 500 rows and measure re-render
    const renderTime = await page.evaluate(`
      (async () => {
        const grid = document.querySelector('tbw-grid');
        const slider = document.querySelector('#row-count');
        ${RAF_WAIT}
        const start = performance.now();
        slider.value = '500';
        slider.dispatchEvent(new Event('input'));
        // Wait for grid to re-render (multiple frames)
        await new Promise(r => setTimeout(r, 500));
        ${RAF_WAIT}
        return performance.now() - start;
      })()
    `);

    // Budget: 500 rows should render in < 2s including data generation
    expect(renderTime).toBeLessThan(2000);
  });

  test('vanilla: grid renders 1000 rows within time budget', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    const renderTime = await page.evaluate(`
      (async () => {
        const grid = document.querySelector('tbw-grid');
        const slider = document.querySelector('#row-count');
        ${RAF_WAIT}
        const start = performance.now();
        slider.value = '1000';
        slider.dispatchEvent(new Event('input'));
        await new Promise(r => setTimeout(r, 800));
        ${RAF_WAIT}
        return performance.now() - start;
      })()
    `);

    // Budget: 1000 rows should render in < 3s including data generation
    expect(renderTime).toBeLessThan(3000);
  });
});

// #endregion

// #region Scroll Performance

test.describe('Performance Regression: Scroll', () => {
  test('vanilla: vertical scroll frame times stay under budget', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);
    await setRowCount(page, 500);

    const result = (await page.evaluate(`
      (async () => {
        const scrollable = document.querySelector('.faux-vscroll');
        if (!scrollable) return { avg: 999, p95: 999, p99: 999, max: 999 };

        const totalHeight = scrollable.scrollHeight;
        const viewportHeight = scrollable.clientHeight;
        const steps = 30;
        const stepSize = (totalHeight - viewportHeight) / steps;

        if (stepSize <= 0) return { avg: 0, p95: 0, p99: 0, max: 0 };

        // Warm-up pass
        for (let i = 0; i <= steps; i++) {
          scrollable.scrollTop = i * stepSize;
          await new Promise(r => requestAnimationFrame(() => r()));
        }
        scrollable.scrollTop = 0;
        await new Promise(r => setTimeout(r, 100));

        // Measurement pass
        const frameTimes = [];
        for (let i = 0; i <= steps; i++) {
          const start = performance.now();
          scrollable.scrollTop = i * stepSize;
          await new Promise(r => requestAnimationFrame(() => r()));
          frameTimes.push(performance.now() - start);
        }

        const sorted = [...frameTimes].sort((a, b) => a - b);
        const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        const p99 = sorted[Math.floor(sorted.length * 0.99)];
        const max = sorted[sorted.length - 1];

        return { avg, p95, p99, max };
      })()
    `)) as { avg: number; p95: number; p99: number; max: number };

    // Scroll budgets (generous for CI)
    expect(result.avg).toBeLessThan(50); // Average: < 50ms (20fps minimum)
    expect(result.p95).toBeLessThan(80); // P95: < 80ms
    expect(result.p99).toBeLessThan(100); // P99: < 100ms
  });

  test('vanilla: stress scroll (random jumps) stays under budget', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);
    await setRowCount(page, 500);

    const result = (await page.evaluate(`
      (async () => {
        const scrollable = document.querySelector('.faux-vscroll');
        if (!scrollable) return { avg: 999, max: 999 };

        const totalHeight = scrollable.scrollHeight;
        const viewportHeight = scrollable.clientHeight;
        const maxScroll = totalHeight - viewportHeight;

        // Warm-up
        scrollable.scrollTop = maxScroll;
        await new Promise(r => requestAnimationFrame(() => r()));
        scrollable.scrollTop = 0;
        await new Promise(r => setTimeout(r, 100));

        // Random jump measurement
        const frameTimes = [];
        const jumps = 20;
        for (let i = 0; i < jumps; i++) {
          const pos = Math.random() * maxScroll;
          const start = performance.now();
          scrollable.scrollTop = pos;
          await new Promise(r => requestAnimationFrame(() => r()));
          frameTimes.push(performance.now() - start);
        }

        const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        const max = Math.max(...frameTimes);
        return { avg, max };
      })()
    `)) as { avg: number; max: number };

    expect(result.avg).toBeLessThan(80); // Random jumps are expensive
    expect(result.max).toBeLessThan(150); // Worst case single frame
  });

  test('vanilla: horizontal scroll frame times stay under budget', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    const result = (await page.evaluate(`
      (async () => {
        const scrollArea = document.querySelector('.tbw-scroll-area');
        if (!scrollArea) return { avg: 0, p95: 0, skipped: true };

        const totalWidth = scrollArea.scrollWidth;
        const viewportWidth = scrollArea.clientWidth;
        const steps = 20;
        const stepSize = (totalWidth - viewportWidth) / steps;

        if (stepSize <= 0) return { avg: 0, p95: 0, skipped: true };

        // Warm-up
        for (let i = 0; i <= steps; i++) {
          scrollArea.scrollLeft = i * stepSize;
          await new Promise(r => requestAnimationFrame(() => r()));
        }
        scrollArea.scrollLeft = 0;
        await new Promise(r => setTimeout(r, 100));

        // Measurement
        const frameTimes = [];
        for (let i = 0; i <= steps; i++) {
          const start = performance.now();
          scrollArea.scrollLeft = i * stepSize;
          await new Promise(r => requestAnimationFrame(() => r()));
          frameTimes.push(performance.now() - start);
        }

        const sorted = [...frameTimes].sort((a, b) => a - b);
        const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        return { avg, p95, skipped: false };
      })()
    `)) as { avg: number; p95: number; skipped: boolean };

    if (!result.skipped) {
      expect(result.avg).toBeLessThan(50);
      expect(result.p95).toBeLessThan(80);
    }
  });
});

// Cross-framework scroll performance tests
// These run the same scroll measurements against Angular, React, and Vue demos
// to catch framework-specific regressions (adapter overhead, change detection, etc.)

const SCROLL_MEASUREMENT = `
  (async () => {
    const scrollable = document.querySelector('.faux-vscroll');
    if (!scrollable) return { avg: 999, p95: 999, p99: 999, max: 999, error: 'no-scrollable' };

    const totalHeight = scrollable.scrollHeight;
    const viewportHeight = scrollable.clientHeight;
    const steps = 30;
    const stepSize = (totalHeight - viewportHeight) / steps;

    if (stepSize <= 0) return { avg: 0, p95: 0, p99: 0, max: 0, error: 'nothing-to-scroll' };

    // Warm-up pass
    for (let i = 0; i <= steps; i++) {
      scrollable.scrollTop = i * stepSize;
      await new Promise(r => requestAnimationFrame(() => r()));
    }
    scrollable.scrollTop = 0;
    await new Promise(r => setTimeout(r, 100));

    // Measurement pass
    const frameTimes = [];
    for (let i = 0; i <= steps; i++) {
      const start = performance.now();
      scrollable.scrollTop = i * stepSize;
      await new Promise(r => requestAnimationFrame(() => r()));
      frameTimes.push(performance.now() - start);
    }

    const sorted = [...frameTimes].sort((a, b) => a - b);
    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const max = sorted[sorted.length - 1];

    return { avg, p95, p99, max };
  })()
`;

const RANDOM_JUMP_MEASUREMENT = `
  (async () => {
    const scrollable = document.querySelector('.faux-vscroll');
    if (!scrollable) return { avg: 999, max: 999, error: 'no-scrollable' };

    const totalHeight = scrollable.scrollHeight;
    const viewportHeight = scrollable.clientHeight;
    const maxScroll = totalHeight - viewportHeight;

    // Warm-up
    scrollable.scrollTop = maxScroll;
    await new Promise(r => requestAnimationFrame(() => r()));
    scrollable.scrollTop = 0;
    await new Promise(r => setTimeout(r, 100));

    // Random jump measurement
    const frameTimes = [];
    const jumps = 20;
    for (let i = 0; i < jumps; i++) {
      const pos = Math.random() * maxScroll;
      const start = performance.now();
      scrollable.scrollTop = pos;
      await new Promise(r => requestAnimationFrame(() => r()));
      frameTimes.push(performance.now() - start);
    }

    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const max = Math.max(...frameTimes);
    return { avg, max };
  })()
`;

for (const framework of ['angular', 'react', 'vue'] as const) {
  test.describe(`Performance Regression: Scroll (${framework})`, () => {
    test(`${framework}: vertical scroll frame times stay under budget`, async ({ page }) => {
      await page.goto(DEMOS[framework]);
      await waitForGridReady(page);
      await ensureRowCount(page, 500);

      const result = (await page.evaluate(SCROLL_MEASUREMENT)) as {
        avg: number;
        p95: number;
        p99: number;
        max: number;
      };

      expect(result.avg).toBeLessThan(50);
      expect(result.p95).toBeLessThan(80);
      expect(result.p99).toBeLessThan(100);
    });

    test(`${framework}: stress scroll (random jumps) stays under budget`, async ({ page }) => {
      await page.goto(DEMOS[framework]);
      await waitForGridReady(page);
      await ensureRowCount(page, 500);

      const result = (await page.evaluate(RANDOM_JUMP_MEASUREMENT)) as {
        avg: number;
        max: number;
      };

      expect(result.avg).toBeLessThan(80);
      expect(result.max).toBeLessThan(150);
    });
  });
}

// Cross-framework initial render tests
// Measure how quickly each framework demo loads and renders the grid
for (const framework of ['angular', 'react', 'vue'] as const) {
  test.describe(`Performance Regression: Initial Render (${framework})`, () => {
    test(`${framework}: initial page load + grid render within budget`, async ({ page }) => {
      const before = Date.now();

      await page.goto(DEMOS[framework]);
      await waitForGridReady(page);

      const renderTime = Date.now() - before;

      // Budget: full page load + framework bootstrap + grid render < 8s
      // Frameworks have more overhead than vanilla (Angular zone.js, React hydration, etc.)
      expect(renderTime).toBeLessThan(8000);
    });

    test(`${framework}: grid renders 500 rows within time budget`, async ({ page }) => {
      await page.goto(DEMOS[framework]);
      await waitForGridReady(page);

      const renderTime = await page.evaluate(`
        (async () => {
          const grid = document.querySelector('tbw-grid');
          if (!grid) return 9999;

          ${RAF_WAIT}
          const start = performance.now();

          // Inject 500 rows directly
          const depts = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance'];
          const rows = [];
          for (let i = 0; i < 500; i++) {
            rows.push({
              id: 'perf-' + i,
              firstName: 'First' + i,
              lastName: 'Last' + i,
              email: 'e' + i + '@test.com',
              department: depts[i % depts.length],
              title: 'Title ' + (i % 20),
              status: i % 3 === 0 ? 'Active' : 'Remote',
              salary: 50000 + i * 100,
              level: (i % 10) + 1,
              rating: (i % 50) / 10,
              hireDate: '2020-01-01',
            });
          }
          grid.rows = rows;

          await new Promise(r => setTimeout(r, 500));
          ${RAF_WAIT}
          return performance.now() - start;
        })()
      `);

      // Budget: 500 rows re-render < 3s (generous for framework overhead)
      expect(renderTime).toBeLessThan(3000);
    });
  });
}

// #endregion

// Cross-framework interaction latency tests
// Measure cell click and keyboard navigation response across frameworks
// to catch framework adapter overhead (change detection, reconciliation)

// #region Cross-Framework Interaction Latency

const CELL_CLICK_MEASUREMENT = `
  (async () => {
    const cell = document.querySelector('[role="gridcell"]');
    if (!cell) return 999;

    ${RAF_WAIT}
    const start = performance.now();
    cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    cell.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    cell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    ${RAF_WAIT}
    return performance.now() - start;
  })()
`;

const KEYBOARD_NAV_MEASUREMENT = `
  (async () => {
    const grid = document.querySelector('tbw-grid');
    if (!grid) return { avg: 999, max: 999 };

    // Click a cell first to establish focus
    const cell = grid.querySelector('[role="gridcell"]');
    if (cell) {
      cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      cell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    await new Promise(r => requestAnimationFrame(() => r()));

    const frameTimes = [];
    const keys = ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowRight',
                  'ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowUp',
                  'ArrowUp', 'ArrowLeft'];

    for (const key of keys) {
      const start = performance.now();
      grid.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      await new Promise(r => requestAnimationFrame(() => r()));
      frameTimes.push(performance.now() - start);
    }

    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const max = Math.max(...frameTimes);
    return { avg, max };
  })()
`;

for (const framework of ['angular', 'react', 'vue'] as const) {
  test.describe(`Performance Regression: Interaction Latency (${framework})`, () => {
    test(`${framework}: cell click response time stays under budget`, async ({ page }) => {
      await page.goto(DEMOS[framework]);
      await waitForGridReady(page);

      const clickTime = await page.evaluate(CELL_CLICK_MEASUREMENT);

      // Click response should be < 100ms (feels instant)
      // Framework adapters may add small overhead but should not be noticeable
      expect(clickTime).toBeLessThan(100);
    });

    test(`${framework}: keyboard navigation response time`, async ({ page }) => {
      await page.goto(DEMOS[framework]);
      await waitForGridReady(page);

      const navTime = (await page.evaluate(KEYBOARD_NAV_MEASUREMENT)) as {
        avg: number;
        max: number;
      };

      // Arrow key nav should be < 50ms average
      expect(navTime.avg).toBeLessThan(50);
      expect(navTime.max).toBeLessThan(100);
    });
  });
}

// #endregion

// #region Sort & Filter Performance

test.describe('Performance Regression: Sort & Filter', () => {
  test('vanilla: clicking header to sort completes within budget', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);
    await setRowCount(page, 500);

    // Measure sort by clicking the "Name" header
    const sortTime = await page.evaluate(`
      (async () => {
        ${RAF_WAIT}
        const header = document.querySelector('[role="columnheader"]');
        if (!header) return 999;

        const start = performance.now();
        header.click();
        ${RAF_WAIT}
        await new Promise(r => setTimeout(r, 100));
        ${RAF_WAIT}
        return performance.now() - start;
      })()
    `);

    // Budget: sort 500 rows should be < 500ms
    expect(sortTime).toBeLessThan(500);
  });

  test('vanilla: sorting twice (asc then desc) stays within budget', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);
    await setRowCount(page, 500);

    const totalTime = await page.evaluate(`
      (async () => {
        const header = document.querySelector('[role="columnheader"]');
        if (!header) return 999;

        const start = performance.now();

        // Sort ascending
        header.click();
        ${RAF_WAIT}
        await new Promise(r => setTimeout(r, 100));

        // Sort descending
        header.click();
        ${RAF_WAIT}
        await new Promise(r => setTimeout(r, 100));

        ${RAF_WAIT}
        return performance.now() - start;
      })()
    `);

    // Two sorts should still be fast
    expect(totalTime).toBeLessThan(1000);
  });
});

// #endregion

// #region Filter Latency Performance

/**
 * Filter latency tests measure the time from clicking a filter button,
 * typing in a search term, and the grid completing the re-render.
 * This catches regressions in the FilteringPlugin debounce + render pipeline.
 */
test.describe('Performance Regression: Filter Latency', () => {
  test('vanilla: filter panel open + type + re-render stays under budget', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);
    await setRowCount(page, 500);

    const filterTime = (await page.evaluate(`
      (async () => {
        // Find any filterable column header with a filter button
        const filterBtn = document.querySelector('.tbw-filter-btn');
        if (!filterBtn) return { openTime: -1, filterTime: -1, error: 'no-filter-btn' };

        // Measure panel open time
        ${RAF_WAIT}
        const openStart = performance.now();
        filterBtn.click();
        ${RAF_WAIT}
        await new Promise(r => setTimeout(r, 200));
        const openTime = performance.now() - openStart;

        // Find search input in the filter panel
        const searchInput = document.querySelector('.tbw-filter-search-input');
        if (!searchInput) return { openTime, filterTime: -1, error: 'no-search-input' };

        // Type a filter term and measure re-render time
        const filterStart = performance.now();
        searchInput.value = 'Eng';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        // Wait for debounce (200ms default) + re-render
        await new Promise(r => setTimeout(r, 400));
        ${RAF_WAIT}
        const filterTime = performance.now() - filterStart;

        return { openTime, filterTime };
      })()
    `)) as { openTime: number; filterTime: number; error?: string };

    if (filterTime.error) return; // Skip if filtering not available

    // Panel open should be < 300ms
    expect(filterTime.openTime).toBeLessThan(300);
    // Filter re-render (including 200ms debounce) should be < 800ms
    expect(filterTime.filterTime).toBeLessThan(800);
  });

  test('vanilla: rapid filter typing does not cause compounding delays', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);
    await setRowCount(page, 500);

    const result = (await page.evaluate(`
      (async () => {
        // Open filter panel
        const filterBtn = document.querySelector('.tbw-filter-btn');
        if (!filterBtn) return { times: [], error: 'no-filter-btn' };

        filterBtn.click();
        await new Promise(r => setTimeout(r, 200));

        const searchInput = document.querySelector('.tbw-filter-search-input');
        if (!searchInput) return { times: [], error: 'no-search-input' };

        // Type characters rapidly, measuring each keystroke's frame time
        const chars = 'Engineering'.split('');
        const times = [];

        for (const char of chars) {
          searchInput.value += char;
          const start = performance.now();
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => requestAnimationFrame(() => r()));
          times.push(performance.now() - start);
        }

        // Wait for final debounce + render
        await new Promise(r => setTimeout(r, 400));

        return { times };
      })()
    `)) as { times: number[]; error?: string };

    if (result.error || result.times.length === 0) return;

    // Individual keystrokes should be fast (debounce absorbs the heavy work)
    const avg = result.times.reduce((a: number, b: number) => a + b, 0) / result.times.length;
    expect(avg).toBeLessThan(50); // Each keystroke event < 50ms

    // Later keystrokes should not be slower than earlier ones (no compounding)
    const firstHalf = result.times.slice(0, 5);
    const secondHalf = result.times.slice(5);
    if (secondHalf.length > 0) {
      const firstAvg = firstHalf.reduce((a: number, b: number) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a: number, b: number) => a + b, 0) / secondHalf.length;
      expect(secondAvg).toBeLessThan(firstAvg * 3 + 20); // Generous tolerance
    }
  });
});

// Cross-framework filter latency
for (const framework of ['angular', 'react', 'vue'] as const) {
  test.describe(`Performance Regression: Filter Latency (${framework})`, () => {
    test(`${framework}: filter panel open + type + re-render stays under budget`, async ({ page }) => {
      await page.goto(DEMOS[framework]);
      await waitForGridReady(page);

      const filterTime = (await page.evaluate(`
        (async () => {
          const filterBtn = document.querySelector('.tbw-filter-btn');
          if (!filterBtn) return { openTime: -1, filterTime: -1, error: 'no-filter-btn' };

          ${RAF_WAIT}
          const openStart = performance.now();
          filterBtn.click();
          ${RAF_WAIT}
          await new Promise(r => setTimeout(r, 200));
          const openTime = performance.now() - openStart;

          const searchInput = document.querySelector('.tbw-filter-search-input');
          if (!searchInput) return { openTime, filterTime: -1, error: 'no-search-input' };

          const filterStart = performance.now();
          searchInput.value = 'Eng';
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 400));
          ${RAF_WAIT}
          const filterTime = performance.now() - filterStart;

          return { openTime, filterTime };
        })()
      `)) as { openTime: number; filterTime: number; error?: string };

      if (filterTime.error) return;

      // Panel open < 300ms, filter re-render < 800ms (including debounce)
      expect(filterTime.openTime).toBeLessThan(300);
      expect(filterTime.filterTime).toBeLessThan(800);
    });
  });
}

// #endregion

// #region Data Mutation Performance

test.describe('Performance Regression: Data Mutation', () => {
  test('vanilla: changing row count (data replacement) stays within budget', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    // Time the row count change from 200 → 500
    const mutationTime = await page.evaluate(`
      (async () => {
        const slider = document.querySelector('#row-count');
        if (!slider) return 999;

        ${RAF_WAIT}
        const start = performance.now();
        slider.value = '500';
        slider.dispatchEvent(new Event('input'));
        // Wait for full grid rebuild (demo recreates grid on config change)
        await new Promise(r => setTimeout(r, 800));
        ${RAF_WAIT}
        return performance.now() - start;
      })()
    `);

    // Budget: full re-render with 500 rows < 2s
    expect(mutationTime).toBeLessThan(2000);
  });

  test('vanilla: toggling a feature (editing) re-renders within budget', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    // Toggle editing off — this recreates the grid
    const toggleTime = await page.evaluate(`
      (async () => {
        const checkbox = document.querySelector('#enable-editing');
        if (!checkbox) return 999;

        ${RAF_WAIT}
        const start = performance.now();
        checkbox.click();
        await new Promise(r => setTimeout(r, 800));
        ${RAF_WAIT}
        return performance.now() - start;
      })()
    `);

    // Budget: feature toggle + grid rebuild < 2s
    expect(toggleTime).toBeLessThan(2000);
  });
});

// #endregion

// #region DOM Virtualization Verification

test.describe('Performance Regression: Virtualization', () => {
  test('vanilla: DOM row count stays bounded regardless of data size', async ({ page }) => {
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
    // Virtualization: ~15-30 viewport rows + 16 overscan = max ~50
    expect(domMetrics.rows).toBeLessThan(80);
    expect(domMetrics.rows).toBeGreaterThan(0);

    // Cells should be bounded too
    expect(domMetrics.cells).toBeLessThan(2000);
    expect(domMetrics.cells).toBeGreaterThan(0);
  });

  test('vanilla: DOM stays bounded after scrolling to bottom', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);
    await setRowCount(page, 1000);

    // Scroll to bottom
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

    // Same budget at bottom of scroll
    expect(domRows).toBeLessThan(80);
    expect(domRows).toBeGreaterThan(0);
  });
});

// #endregion

// #region Interaction Latency

test.describe('Performance Regression: Interaction Latency', () => {
  test('vanilla: cell click response time stays under budget', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    // Measure time from click to selection visual update
    const clickTime = await page.evaluate(`
      (async () => {
        const cell = document.querySelector('[role="gridcell"]');
        if (!cell) return 999;

        ${RAF_WAIT}
        const start = performance.now();
        cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        cell.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        cell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        ${RAF_WAIT}
        return performance.now() - start;
      })()
    `);

    // Click response should be < 100ms (feels instant)
    expect(clickTime).toBeLessThan(100);
  });

  test('vanilla: double-click to edit response time stays under budget', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    // Find an editable cell and measure dblclick → editor visible
    const editTime = await page.evaluate(`
      (async () => {
        // Find a cell with data-field that should be editable
        const cell = document.querySelector('[role="gridcell"][data-field]');
        if (!cell) return 999;

        ${RAF_WAIT}
        const start = performance.now();
        cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        ${RAF_WAIT}
        await new Promise(r => setTimeout(r, 50));
        ${RAF_WAIT}
        return performance.now() - start;
      })()
    `);

    // Double-click to editor should be < 200ms
    expect(editTime).toBeLessThan(200);
  });

  test('vanilla: keyboard navigation (arrow keys) response time', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    // Click a cell first to establish focus
    const firstCell = page.locator('[role="gridcell"]').first();
    await firstCell.click();
    await page.waitForTimeout(100);

    // Measure arrow key navigation time
    const navTime = (await page.evaluate(`
      (async () => {
        const grid = document.querySelector('tbw-grid');
        if (!grid) return { avg: 999, max: 999 };

        const frameTimes = [];
        const keys = ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowRight',
                      'ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowUp',
                      'ArrowUp', 'ArrowLeft'];

        for (const key of keys) {
          const start = performance.now();
          grid.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
          await new Promise(r => requestAnimationFrame(() => r()));
          frameTimes.push(performance.now() - start);
        }

        const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        const max = Math.max(...frameTimes);
        return { avg, max };
      })()
    `)) as { avg: number; max: number };

    // Arrow key nav should be < 50ms average (feels instant)
    expect(navTime.avg).toBeLessThan(50);
    expect(navTime.max).toBeLessThan(100);
  });
});

// #endregion

// #region Master-Detail Performance

test.describe('Performance Regression: Master-Detail', () => {
  test('vanilla: expand detail row response time', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    // Master-detail is enabled by default in the demo
    const expanders = page.locator('.master-detail-toggle');
    const expanderCount = await expanders.count();

    if (expanderCount > 0) {
      const expandTime = await page.evaluate(`
        (async () => {
          const toggle = document.querySelector('.master-detail-toggle');
          if (!toggle) return 999;

          await new Promise(r => requestAnimationFrame(() => r()));
          const start = performance.now();
          toggle.click();
          await new Promise(r => requestAnimationFrame(() => r()));
          await new Promise(r => setTimeout(r, 100));
          await new Promise(r => requestAnimationFrame(() => r()));
          return performance.now() - start;
        })()
      `);

      // Expand should be < 300ms
      expect(expandTime).toBeLessThan(300);
    }
  });

  test('vanilla: expand/collapse cycle does not leak time', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    const expanders = page.locator('.master-detail-toggle');
    if ((await expanders.count()) === 0) return;

    // Measure 5 expand/collapse cycles — later cycles should not be slower
    const cycleTimes = (await page.evaluate(`
      (async () => {
        const toggle = document.querySelector('.master-detail-toggle');
        if (!toggle) return [];

        const times = [];
        for (let i = 0; i < 10; i++) {
          const start = performance.now();
          toggle.click();
          await new Promise(r => requestAnimationFrame(() => r()));
          await new Promise(r => setTimeout(r, 50));
          times.push(performance.now() - start);
        }
        return times;
      })()
    `)) as number[];

    if (cycleTimes.length >= 10) {
      // Compare first half vs second half — second half should not be 2x slower
      const firstHalf = cycleTimes.slice(0, 5).reduce((a: number, b: number) => a + b, 0) / 5;
      const secondHalf = cycleTimes.slice(5).reduce((a: number, b: number) => a + b, 0) / 5;

      // No time leak: second half should be < 2x first half
      expect(secondHalf).toBeLessThan(firstHalf * 2 + 50); // +50ms tolerance
    }
  });
});

// #endregion

// #region Resize Performance

test.describe('Performance Regression: Resize', () => {
  test('vanilla: column resize drag does not drop below 20fps', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    // Find a resize handle and simulate drag
    const resizeHandle = page.locator('.resize-handle').first();
    if (!(await resizeHandle.isVisible())) return;

    const handleBox = await resizeHandle.boundingBox();
    if (!handleBox) return;

    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;

    // Start drag
    await page.mouse.move(startX, startY);
    await page.mouse.down();

    // Measure frame times during drag
    const dragFrameTimes: number[] = [];
    const dragSteps = 15;
    for (let i = 0; i < dragSteps; i++) {
      const x = startX + (i + 1) * 10; // Move 10px per step
      const before = Date.now();
      await page.mouse.move(x, startY);
      await page.waitForTimeout(16); // ~60fps target
      dragFrameTimes.push(Date.now() - before);
    }

    await page.mouse.up();

    // Average frame time should stay under 65ms (~15fps minimum during resize)
    // CI environments have higher variance, so we use a generous threshold
    const avg = dragFrameTimes.reduce((a, b) => a + b, 0) / dragFrameTimes.length;
    expect(avg).toBeLessThan(65);
  });

  test('vanilla: container resize does not cause layout thrashing', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    // Resize the viewport to simulate container resize
    const resizeTime = (await page.evaluate(`
      (async () => {
        const frameTimes = [];
        const sizes = [
          { width: 1000, height: 600 },
          { width: 800, height: 500 },
          { width: 1200, height: 700 },
          { width: 600, height: 400 },
          { width: 1000, height: 600 },
        ];

        for (const size of sizes) {
          const start = performance.now();
          // Trigger ResizeObserver by changing grid wrapper size
          const wrapper = document.querySelector('.grid-wrapper');
          if (wrapper) {
            wrapper.style.width = size.width + 'px';
            wrapper.style.height = size.height + 'px';
          }
          await new Promise(r => requestAnimationFrame(() => r()));
          await new Promise(r => setTimeout(r, 100));
          await new Promise(r => requestAnimationFrame(() => r()));
          frameTimes.push(performance.now() - start);
        }

        const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        const max = Math.max(...frameTimes);
        return { avg, max };
      })()
    `)) as { avg: number; max: number };

    // Container resize should not cause long frames
    expect(resizeTime.avg).toBeLessThan(300);
    expect(resizeTime.max).toBeLessThan(500);
  });
});

// #endregion

// #region No JavaScript Errors

test.describe('Performance Regression: Error Budget', () => {
  test('vanilla: no JS errors during normal operation sequence', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    // Full interaction sequence: scroll → sort → expand → collapse → resize row count
    const scrollable = page.locator('.faux-vscroll');

    // Scroll
    await scrollable.evaluate((el) => {
      el.scrollTop = 200;
    });
    await page.waitForTimeout(100);
    await scrollable.evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.waitForTimeout(100);

    // Sort — pick a visible, non-utility column header
    const header = page.locator('[role="columnheader"]:not([data-field^="__tbw_"])').first();
    await header.click();
    await page.waitForTimeout(200);

    // Expand detail
    const toggle = page.locator('.master-detail-toggle').first();
    if (await toggle.isVisible()) {
      await toggle.click({ force: true });
      await page.waitForTimeout(200);
      await toggle.click({ force: true });
      await page.waitForTimeout(200);
    }

    // Change row count
    const slider = page.locator('#row-count');
    if (await slider.isVisible()) {
      await slider.fill('300');
      await slider.dispatchEvent('input');
      await page.waitForTimeout(500);
    }

    expect(errors).toHaveLength(0);
  });
});

// #endregion
// #region Large Column Count Performance

test.describe('Performance Regression: Large Column Count', () => {
  test('vanilla: 50-column grid renders within budget', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    const result = (await page.evaluate(`
      (async () => {
        const grid = document.querySelector('tbw-grid');
        if (!grid) return { renderTime: 9999, domCells: 0, error: 'no-grid' };

        // Generate 50 columns
        const columns = [];
        for (let i = 0; i < 50; i++) {
          columns.push({ field: 'col' + i, header: 'Column ' + i });
        }

        // Generate 200 rows × 50 columns
        const rows = [];
        for (let r = 0; r < 200; r++) {
          const row = { id: r };
          for (let c = 0; c < 50; c++) {
            row['col' + c] = 'R' + r + 'C' + c;
          }
          rows.push(row);
        }

        ${RAF_WAIT}
        const start = performance.now();
        grid.gridConfig = { columns };
        grid.rows = rows;
        await new Promise(r => setTimeout(r, 1000));
        ${RAF_WAIT}
        const renderTime = performance.now() - start;

        const domCells = grid.querySelectorAll('[role="gridcell"]').length;
        return { renderTime, domCells };
      })()
    `)) as { renderTime: number; domCells: number; error?: string };

    // 50 columns × 200 rows should render in < 5s
    expect(result.renderTime).toBeLessThan(5000);

    // With column virtualization off, all column cells are rendered per row
    // With it on, only visible ones. Either way, should be bounded.
    expect(result.domCells).toBeGreaterThan(0);
  });

  test('vanilla: 100-column grid scroll stays responsive', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    const result = (await page.evaluate(`
      (async () => {
        const grid = document.querySelector('tbw-grid');
        if (!grid) return { renderTime: 999, scrollAvg: 999, error: 'no-grid' };

        // Generate 100 columns
        const columns = [];
        for (let i = 0; i < 100; i++) {
          columns.push({ field: 'c' + i, header: 'Col ' + i, width: 120 });
        }

        const rows = [];
        for (let r = 0; r < 100; r++) {
          const row = { id: r };
          for (let c = 0; c < 100; c++) row['c' + c] = 'v' + r + '.' + c;
          rows.push(row);
        }

        ${RAF_WAIT}
        const start = performance.now();
        grid.gridConfig = { columns };
        grid.rows = rows;
        await new Promise(r => setTimeout(r, 1500));
        ${RAF_WAIT}
        const renderTime = performance.now() - start;

        // Horizontal scroll measurement
        const scrollArea = grid.querySelector('.tbw-scroll-area');
        if (!scrollArea) return { renderTime, scrollAvg: -1, error: 'no-scroll-area' };

        const totalWidth = scrollArea.scrollWidth;
        const viewportWidth = scrollArea.clientWidth;
        const steps = 15;
        const stepSize = (totalWidth - viewportWidth) / steps;

        if (stepSize <= 0) return { renderTime, scrollAvg: 0 };

        const frameTimes = [];
        for (let i = 0; i <= steps; i++) {
          const s = performance.now();
          scrollArea.scrollLeft = i * stepSize;
          await new Promise(r => requestAnimationFrame(() => r()));
          frameTimes.push(performance.now() - s);
        }

        const scrollAvg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        return { renderTime, scrollAvg };
      })()
    `)) as { renderTime: number; scrollAvg: number };

    // 100-column grid initial render < 8s (generous for CI)
    expect(result.renderTime).toBeLessThan(8000);

    // Horizontal scroll should remain responsive
    if (result.scrollAvg >= 0) {
      expect(result.scrollAvg).toBeLessThan(100);
    }
  });
});

// #endregion

// #region Memory Stability

test.describe('Performance Regression: Memory Stability', () => {
  test('vanilla: repeated data replacement does not leak memory', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    // Needs CDP for heap metrics
    const cdp = await page.context().newCDPSession(page);

    // Force GC and get baseline
    await cdp.send('HeapProfiler.collectGarbage');
    const baseline = (await cdp.send('Runtime.getHeapUsage')) as {
      usedSize: number;
      totalSize: number;
    };

    // Perform 10 cycles of data replacement (each replaces all rows)
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

    // Force GC and measure final state
    await cdp.send('HeapProfiler.collectGarbage');
    const final = (await cdp.send('Runtime.getHeapUsage')) as {
      usedSize: number;
      totalSize: number;
    };

    const growthMB = (final.usedSize - baseline.usedSize) / 1024 / 1024;

    // After 10 data replacements (500 rows each), heap growth should be bounded.
    // Allow up to 20MB growth (generous for CI variance + renderer caches)
    expect(growthMB).toBeLessThan(20);

    await cdp.detach();
  });

  test('vanilla: scroll does not leak DOM nodes', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);
    await setRowCount(page, 1000);

    // Count DOM nodes before scrolling
    const before = await page.evaluate(() => document.querySelectorAll('*').length);

    // Scroll through entire dataset multiple times
    await page.evaluate(`
      (async () => {
        const scrollable = document.querySelector('.faux-vscroll');
        if (!scrollable) return;

        const maxScroll = scrollable.scrollHeight - scrollable.clientHeight;

        for (let pass = 0; pass < 3; pass++) {
          // Scroll down in steps
          for (let pos = 0; pos <= maxScroll; pos += maxScroll / 20) {
            scrollable.scrollTop = pos;
            await new Promise(r => requestAnimationFrame(() => r()));
          }
          // Scroll back up
          for (let pos = maxScroll; pos >= 0; pos -= maxScroll / 20) {
            scrollable.scrollTop = pos;
            await new Promise(r => requestAnimationFrame(() => r()));
          }
        }

        // Return to top
        scrollable.scrollTop = 0;
        await new Promise(r => setTimeout(r, 200));
      })()
    `);

    // Count DOM nodes after scrolling
    const after = await page.evaluate(() => document.querySelectorAll('*').length);

    // DOM node count should be roughly stable (virtualization reuses nodes)
    // Allow 20% growth tolerance for any deferred rendering
    expect(after).toBeLessThan(before * 1.2);
  });
});

// #endregion
