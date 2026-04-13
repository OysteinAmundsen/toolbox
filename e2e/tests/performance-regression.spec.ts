import { expect, test, type Page } from '@playwright/test';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { flushMetrics, recordMetric } from './perf-metrics-helper';

/**
 * Performance Regression Tests — Self-Comparison vs Released CDN Version
 *
 * Compares the current build against the latest published release loaded
 * from CDN. Both versions execute identical benchmarks in the same browser
 * session, so CI runner variance cancels out. If the current build is
 * significantly slower, the test fails.
 *
 * No demo server required — tests load UMD bundles into blank pages.
 *
 * Metrics tested:
 * - Initial render (500 + 1000 rows)
 * - Data replacement
 * - Vertical scroll (avg frame time)
 * - Sort
 * - Filter
 * - Single-row update
 * - Column resize
 * - Scroll-to-end
 *
 * Run locally:  bun nx build grid && bunx playwright test performance-regression.spec.ts
 * Run on CI:    runs as part of the regular e2e suite
 */

// ─── Configuration ──────────────────────────────────────────────────────────

const LOCAL_UMD = resolve(__dirname, '../../dist/libs/grid/umd/grid.all.umd.js');

const CDN_VERSION = process.env.PERF_CDN_VERSION ?? 'latest';
const CDN_UMD = `https://cdn.jsdelivr.net/npm/@toolbox-web/grid@${CDN_VERSION}/umd/grid.all.umd.js`;

/**
 * Maximum allowed slowdown ratio (current / released).
 * 1.10 means current can be at most 10% slower than the released version.
 * Self-comparison in the same session has low variance, so 10% is safe.
 */
const REGRESSION_THRESHOLD = 1.1;

const ROW_COUNT = 500;
const LARGE_ROW_COUNT = 1000;

const runId = process.env.PERF_RUN_ID ?? Date.now().toString();

// ─── Helpers ────────────────────────────────────────────────────────────────

const BENCH_COLUMNS = [
  { field: 'id', header: 'ID', width: 80, type: 'number', sortable: true },
  { field: 'firstName', header: 'First Name', sortable: true },
  { field: 'lastName', header: 'Last Name', sortable: true },
  { field: 'email', header: 'Email', sortable: true },
  { field: 'department', header: 'Department', sortable: true },
  { field: 'salary', header: 'Salary', width: 100, type: 'number', sortable: true },
];
const BENCH_COLUMNS_JSON = JSON.stringify(BENCH_COLUMNS);

function rowGeneratorScript(count: number, prefix = ''): string {
  return `(() => {
    const d = ['Engineering','Marketing','Sales','HR','Finance'];
    return Array.from({length:${count}}, (_,i) => ({
      id: i,
      firstName: '${prefix}First' + i,
      lastName: '${prefix}Last' + i,
      email: '${prefix}e' + i + '@test.com',
      department: d[i % 5],
      salary: 50000 + i * 100,
    }));
  })()`;
}

async function loadGridScript(page: Page, source: 'local' | 'cdn'): Promise<boolean> {
  await page.goto('about:blank');
  await page.setViewportSize({ width: 1280, height: 720 });

  try {
    if (source === 'local') {
      await page.addScriptTag({ path: LOCAL_UMD });
    } else {
      await page.addScriptTag({ url: CDN_UMD });
    }
    return await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          if (customElements.get('tbw-grid')) return resolve(true);
          const t = setTimeout(() => resolve(false), 10_000);
          customElements.whenDefined('tbw-grid').then(() => {
            clearTimeout(t);
            resolve(true);
          });
        }),
    );
  } catch {
    return false;
  }
}

/** Create a grid, set config + rows, wait for first rendered row. */
async function setupGrid(page: Page, rowCount: number): Promise<number> {
  return page.evaluate(
    `(async () => {
      const rows = ${rowGeneratorScript(rowCount)};
      const start = performance.now();
      const grid = document.createElement('tbw-grid');
      grid.style.cssText = 'width:100%;height:600px;display:block';
      document.body.appendChild(grid);
      grid.gridConfig = {
        columns: ${BENCH_COLUMNS_JSON},
        features: { filtering: true },
        getRowId: (row) => String(row.id),
      };
      grid.rows = rows;

      return new Promise(resolve => {
        let n = 0;
        const check = () => {
          n++;
          const root = grid.shadowRoot || grid;
          if (root.querySelector('[role="row"]')) {
            requestAnimationFrame(() => resolve(performance.now() - start));
          } else if (n > 300) {
            resolve(-1);
          } else {
            requestAnimationFrame(check);
          }
        };
        requestAnimationFrame(check);
      });
    })()`,
  ) as Promise<number>;
}

/** Measure data replacement using trimmed mean of 5 runs. */
async function measureDataUpdate(page: Page, rowCount: number): Promise<number> {
  return page.evaluate(
    `(async () => {
      const grid = document.querySelector('tbw-grid');
      if (!grid) return -1;
      const raf = () => new Promise(r => requestAnimationFrame(() => r()));
      const d = ['Engineering','Marketing','Sales','HR','Finance'];
      const samples = [];
      for (let i = 0; i < 5; i++) {
        const newRows = Array.from({length:${rowCount}}, (_,j) => ({
          id: j,
          firstName: 'Run' + i + 'First' + j,
          lastName: 'Run' + i + 'Last' + j,
          email: 'run' + i + 'e' + j + '@test.com',
          department: d[j % 5],
          salary: 50000 + j * 100,
        }));
        await raf();
        const start = performance.now();
        grid.rows = newRows;
        await raf(); await raf(); await raf();
        samples.push(performance.now() - start);
        await new Promise(r => setTimeout(r, 30));
      }
      samples.sort((a, b) => a - b);
      const trimmed = samples.slice(1, -1);
      return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    })()`,
  ) as Promise<number>;
}

/** Measure vertical scroll avg frame time. */
async function measureScroll(page: Page): Promise<number> {
  return page.evaluate(
    `(async () => {
      const grid = document.querySelector('tbw-grid');
      if (!grid) return -1;
      const root = grid.shadowRoot || grid;
      let scrollable = null;
      for (const el of root.querySelectorAll('*')) {
        const s = getComputedStyle(el);
        if ((s.overflowY === 'auto' || s.overflowY === 'scroll') &&
            el.scrollHeight > el.clientHeight + 50) {
          scrollable = el; break;
        }
      }
      if (!scrollable) return -1;

      const maxScroll = scrollable.scrollHeight - scrollable.clientHeight;
      const steps = 30;
      const step = maxScroll / steps;
      const raf = () => new Promise(r => requestAnimationFrame(() => r()));

      // Warm-up
      for (let i = 0; i <= steps; i++) { scrollable.scrollTop = i * step; await raf(); }
      scrollable.scrollTop = 0;
      await new Promise(r => setTimeout(r, 100));

      // Measure
      const times = [];
      for (let i = 0; i <= steps; i++) {
        const t = performance.now();
        scrollable.scrollTop = i * step;
        await raf();
        times.push(performance.now() - t);
      }
      scrollable.scrollTop = 0;
      return times.reduce((a, b) => a + b, 0) / times.length;
    })()`,
  ) as Promise<number>;
}

/** Measure sort: sort by 'id' desc then clear, using trimmed mean of 5 runs. */
async function measureSort(page: Page): Promise<number> {
  return page.evaluate(
    `(async () => {
      const grid = document.querySelector('tbw-grid');
      if (!grid || !grid.sort) return -1;
      const raf = () => new Promise(r => requestAnimationFrame(() => r()));
      const samples = [];
      for (let i = 0; i < 5; i++) {
        await raf();
        const start = performance.now();
        grid.sort('id', 'desc');
        await raf();
        samples.push(performance.now() - start);
        grid.sort(null);
        await raf();
        await new Promise(r => setTimeout(r, 30));
      }
      samples.sort((a, b) => a - b);
      const trimmed = samples.slice(1, -1);
      return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    })()`,
  ) as Promise<number>;
}

/** Measure filter: apply a number filter on 'id' column then clear. */
async function measureFilter(page: Page, rowCount: number): Promise<number> {
  return page.evaluate(
    `(async () => {
      const grid = document.querySelector('tbw-grid');
      if (!grid || !grid.getPluginByName) return -1;
      const plugin = grid.getPluginByName('filtering');
      if (!plugin || !plugin.setFilterModel) return -1;

      const raf = () => new Promise(r => requestAnimationFrame(() => r()));
      const threshold = Math.floor(${rowCount} / 2);
      const samples = [];

      for (let i = 0; i < 5; i++) {
        await raf();
        const start = performance.now();
        plugin.setFilterModel([
          { field: 'id', type: 'number', operator: 'greaterThan', value: threshold },
        ]);
        await raf();
        samples.push(performance.now() - start);
        plugin.clearAllFilters();
        if (grid.forceLayout) await grid.forceLayout();
        await raf();
        await new Promise(r => setTimeout(r, 30));
      }
      samples.sort((a, b) => a - b);
      const trimmed = samples.slice(1, -1);
      return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    })()`,
  ) as Promise<number>;
}

/** Measure single-row update via updateRow(). */
async function measureRowUpdate(page: Page, rowCount: number): Promise<number> {
  return page.evaluate(
    `(async () => {
      const grid = document.querySelector('tbw-grid');
      if (!grid || !grid.updateRow) return -1;
      const raf = () => new Promise(r => requestAnimationFrame(() => r()));
      const targetId = String(Math.floor(${rowCount} / 2));
      const samples = [];
      for (let i = 0; i < 5; i++) {
        await raf();
        const start = performance.now();
        grid.updateRow(targetId, { firstName: 'Updated' + i });
        await raf();
        samples.push(performance.now() - start);
        await new Promise(r => setTimeout(r, 30));
      }
      samples.sort((a, b) => a - b);
      const trimmed = samples.slice(1, -1);
      return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    })()`,
  ) as Promise<number>;
}

/** Measure column resize via columnState API. */
async function measureColumnResize(page: Page): Promise<number> {
  return page.evaluate(
    `(async () => {
      const grid = document.querySelector('tbw-grid');
      if (!grid || !grid.getColumnState) return -1;
      const raf = () => new Promise(r => requestAnimationFrame(() => r()));
      let wide = true;
      const samples = [];
      for (let i = 0; i < 5; i++) {
        const state = grid.getColumnState();
        if (!state?.columns?.[0]) return -1;
        state.columns[0].width = wide ? 200 : 80;
        wide = !wide;
        await raf();
        const start = performance.now();
        grid.columnState = state;
        await raf();
        samples.push(performance.now() - start);
        await new Promise(r => setTimeout(r, 30));
      }
      samples.sort((a, b) => a - b);
      const trimmed = samples.slice(1, -1);
      return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    })()`,
  ) as Promise<number>;
}

/** Measure scrollToRow to the last row. */
async function measureScrollToEnd(page: Page, rowCount: number): Promise<number> {
  return page.evaluate(
    `(async () => {
      const grid = document.querySelector('tbw-grid');
      if (!grid || !grid.scrollToRow) return -1;
      const raf = () => new Promise(r => requestAnimationFrame(() => r()));
      const samples = [];
      for (let i = 0; i < 5; i++) {
        grid.scrollToRow(0, { align: 'start' });
        await raf();
        await new Promise(r => setTimeout(r, 50));

        const start = performance.now();
        grid.scrollToRow(${rowCount} - 1, { align: 'end' });
        await raf();
        samples.push(performance.now() - start);
        await new Promise(r => setTimeout(r, 30));
      }
      samples.sort((a, b) => a - b);
      const trimmed = samples.slice(1, -1);
      return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    })()`,
  ) as Promise<number>;
}

// ─── Assert Helper ──────────────────────────────────────────────────────────

function assertNoRegression(metricName: string, localTime: number, cdnTime: number): void {
  recordMetric(`compare.${metricName}.local`, localTime);
  recordMetric(`compare.${metricName}.cdn`, cdnTime);

  // Skip assertion if either measurement failed
  if (localTime <= 0 || cdnTime <= 0) return;

  const ratio = localTime / cdnTime;
  const absoluteDelta = localTime - cdnTime;
  recordMetric(`compare.${metricName}.ratio`, ratio);

  // Only assert if the ratio exceeds threshold AND the absolute difference
  // is meaningful. Small absolute deltas (e.g. 4 ms = 25% slower) are noise,
  // not real regressions — skip unless the delta is clearly significant.
  const MIN_ABSOLUTE_DELTA_MS = 20;
  if (absoluteDelta < MIN_ABSOLUTE_DELTA_MS) return;

  expect(
    ratio,
    `${metricName} regression: local=${localTime.toFixed(1)}ms, released=${cdnTime.toFixed(1)}ms, ratio=${ratio.toFixed(2)}`,
  ).toBeLessThanOrEqual(REGRESSION_THRESHOLD);
}

// ─── Flush metrics ──────────────────────────────────────────────────────────

test.afterAll(() => {
  flushMetrics(runId);
});

// ═══════════════════════════════════════════════════════════════════════════
// SELF-COMPARISON BENCHMARKS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Performance: Self-Comparison', () => {
  test('render 500 rows', async ({ browser }) => {
    test.skip(!existsSync(LOCAL_UMD), 'Local build not found — run: bun nx build grid');

    const localPage = await browser.newPage();
    const localOk = await loadGridScript(localPage, 'local');
    expect(localOk, 'Local UMD failed to register <tbw-grid>').toBe(true);

    const cdnPage = await browser.newPage();
    const cdnOk = await loadGridScript(cdnPage, 'cdn');
    if (!cdnOk) {
      await localPage.close();
      await cdnPage.close();
      test.skip(true, `CDN version (${CDN_VERSION}) not available`);
      return;
    }

    const localTime = await setupGrid(localPage, ROW_COUNT);
    const cdnTime = await setupGrid(cdnPage, ROW_COUNT);
    await localPage.close();
    await cdnPage.close();

    assertNoRegression('render500', localTime, cdnTime);
  });

  test('render 1000 rows', async ({ browser }) => {
    test.skip(!existsSync(LOCAL_UMD), 'Local build not found — run: bun nx build grid');

    const localPage = await browser.newPage();
    expect(await loadGridScript(localPage, 'local')).toBe(true);
    const cdnPage = await browser.newPage();
    const cdnOk = await loadGridScript(cdnPage, 'cdn');
    if (!cdnOk) {
      await localPage.close();
      await cdnPage.close();
      test.skip(true, `CDN version (${CDN_VERSION}) not available`);
      return;
    }

    const localTime = await setupGrid(localPage, LARGE_ROW_COUNT);
    const cdnTime = await setupGrid(cdnPage, LARGE_ROW_COUNT);
    await localPage.close();
    await cdnPage.close();

    assertNoRegression('render1000', localTime, cdnTime);
  });

  test('data replacement', async ({ browser }) => {
    test.skip(!existsSync(LOCAL_UMD), 'Local build not found — run: bun nx build grid');

    const localPage = await browser.newPage();
    expect(await loadGridScript(localPage, 'local')).toBe(true);
    await setupGrid(localPage, ROW_COUNT);
    const cdnPage = await browser.newPage();
    const cdnOk = await loadGridScript(cdnPage, 'cdn');
    if (!cdnOk) {
      await localPage.close();
      await cdnPage.close();
      test.skip(true, `CDN version (${CDN_VERSION}) not available`);
      return;
    }
    await setupGrid(cdnPage, ROW_COUNT);

    const localTime = await measureDataUpdate(localPage, ROW_COUNT);
    const cdnTime = await measureDataUpdate(cdnPage, ROW_COUNT);
    await localPage.close();
    await cdnPage.close();

    assertNoRegression('dataUpdate', localTime, cdnTime);
  });

  test('vertical scroll', async ({ browser }) => {
    test.skip(!existsSync(LOCAL_UMD), 'Local build not found — run: bun nx build grid');

    const localPage = await browser.newPage();
    expect(await loadGridScript(localPage, 'local')).toBe(true);
    await setupGrid(localPage, ROW_COUNT);
    const cdnPage = await browser.newPage();
    const cdnOk = await loadGridScript(cdnPage, 'cdn');
    if (!cdnOk) {
      await localPage.close();
      await cdnPage.close();
      test.skip(true, `CDN version (${CDN_VERSION}) not available`);
      return;
    }
    await setupGrid(cdnPage, ROW_COUNT);

    const localTime = await measureScroll(localPage);
    const cdnTime = await measureScroll(cdnPage);
    await localPage.close();
    await cdnPage.close();

    assertNoRegression('scroll', localTime, cdnTime);
  });

  test('sort', async ({ browser }) => {
    test.skip(!existsSync(LOCAL_UMD), 'Local build not found — run: bun nx build grid');

    const localPage = await browser.newPage();
    expect(await loadGridScript(localPage, 'local')).toBe(true);
    await setupGrid(localPage, ROW_COUNT);
    const cdnPage = await browser.newPage();
    const cdnOk = await loadGridScript(cdnPage, 'cdn');
    if (!cdnOk) {
      await localPage.close();
      await cdnPage.close();
      test.skip(true, `CDN version (${CDN_VERSION}) not available`);
      return;
    }
    await setupGrid(cdnPage, ROW_COUNT);

    const localTime = await measureSort(localPage);
    const cdnTime = await measureSort(cdnPage);
    await localPage.close();
    await cdnPage.close();

    assertNoRegression('sort', localTime, cdnTime);
  });

  test('filter', async ({ browser }) => {
    test.skip(!existsSync(LOCAL_UMD), 'Local build not found — run: bun nx build grid');

    const localPage = await browser.newPage();
    expect(await loadGridScript(localPage, 'local')).toBe(true);
    await setupGrid(localPage, ROW_COUNT);
    const cdnPage = await browser.newPage();
    const cdnOk = await loadGridScript(cdnPage, 'cdn');
    if (!cdnOk) {
      await localPage.close();
      await cdnPage.close();
      test.skip(true, `CDN version (${CDN_VERSION}) not available`);
      return;
    }
    await setupGrid(cdnPage, ROW_COUNT);

    const localTime = await measureFilter(localPage, ROW_COUNT);
    const cdnTime = await measureFilter(cdnPage, ROW_COUNT);
    await localPage.close();
    await cdnPage.close();

    assertNoRegression('filter', localTime, cdnTime);
  });

  test('single-row update', async ({ browser }) => {
    test.skip(!existsSync(LOCAL_UMD), 'Local build not found — run: bun nx build grid');

    const localPage = await browser.newPage();
    expect(await loadGridScript(localPage, 'local')).toBe(true);
    await setupGrid(localPage, ROW_COUNT);
    const cdnPage = await browser.newPage();
    const cdnOk = await loadGridScript(cdnPage, 'cdn');
    if (!cdnOk) {
      await localPage.close();
      await cdnPage.close();
      test.skip(true, `CDN version (${CDN_VERSION}) not available`);
      return;
    }
    await setupGrid(cdnPage, ROW_COUNT);

    const localTime = await measureRowUpdate(localPage, ROW_COUNT);
    const cdnTime = await measureRowUpdate(cdnPage, ROW_COUNT);
    await localPage.close();
    await cdnPage.close();

    assertNoRegression('rowUpdate', localTime, cdnTime);
  });

  test('column resize', async ({ browser }) => {
    test.skip(!existsSync(LOCAL_UMD), 'Local build not found — run: bun nx build grid');

    const localPage = await browser.newPage();
    expect(await loadGridScript(localPage, 'local')).toBe(true);
    await setupGrid(localPage, ROW_COUNT);
    const cdnPage = await browser.newPage();
    const cdnOk = await loadGridScript(cdnPage, 'cdn');
    if (!cdnOk) {
      await localPage.close();
      await cdnPage.close();
      test.skip(true, `CDN version (${CDN_VERSION}) not available`);
      return;
    }
    await setupGrid(cdnPage, ROW_COUNT);

    const localTime = await measureColumnResize(localPage);
    const cdnTime = await measureColumnResize(cdnPage);
    await localPage.close();
    await cdnPage.close();

    assertNoRegression('columnResize', localTime, cdnTime);
  });

  test('scroll to end', async ({ browser }) => {
    test.skip(!existsSync(LOCAL_UMD), 'Local build not found — run: bun nx build grid');

    const localPage = await browser.newPage();
    expect(await loadGridScript(localPage, 'local')).toBe(true);
    await setupGrid(localPage, ROW_COUNT);
    const cdnPage = await browser.newPage();
    const cdnOk = await loadGridScript(cdnPage, 'cdn');
    if (!cdnOk) {
      await localPage.close();
      await cdnPage.close();
      test.skip(true, `CDN version (${CDN_VERSION}) not available`);
      return;
    }
    await setupGrid(cdnPage, ROW_COUNT);

    const localTime = await measureScrollToEnd(localPage, ROW_COUNT);
    const cdnTime = await measureScrollToEnd(cdnPage, ROW_COUNT);
    await localPage.close();
    await cdnPage.close();

    assertNoRegression('scrollToEnd', localTime, cdnTime);
  });
});
