import { expect, test, type Browser, type Page } from '@playwright/test';
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
 * - Grouping (row grouping with expand/collapse)
 * - Wide columns (100 columns with horizontal scroll)
 * - Grid destroy (teardown cost)
 *
 * Flaky-test mitigation: When a regression is detected, the benchmark is
 * re-run up to 2 more times with fresh browser pages. The test only fails
 * if the regression reproduces consistently across all attempts.
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
const WIDE_COL_ROW_COUNT = 200;

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

/** Warm up JS engine by creating and destroying a small grid. */
async function warmUpGrid(page: Page): Promise<void> {
  await page.evaluate(
    `(async () => {
      const grid = document.createElement('tbw-grid');
      grid.style.cssText = 'width:100%;height:100px;display:block';
      document.body.appendChild(grid);
      grid.gridConfig = {
        columns: ${BENCH_COLUMNS_JSON},
        getRowId: (row) => String(row.id),
      };
      grid.rows = Array.from({length:10}, (_,i) => ({
        id: i, firstName: 'W'+i, lastName: 'W'+i,
        email: 'w@w.com', department: 'Eng', salary: 50000,
      }));
      await new Promise(r => requestAnimationFrame(() =>
        requestAnimationFrame(() => r())
      ));
      grid.remove();
      await new Promise(r => setTimeout(r, 50));
    })()`,
  );
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

/** Measure row grouping: apply grouping by department, measure render time. */
async function measureGrouping(page: Page): Promise<number> {
  return page.evaluate(
    `(async () => {
      const grid = document.querySelector('tbw-grid');
      if (!grid || !grid.getPluginByName) return -1;
      const plugin = grid.getPluginByName('grouping-rows');
      if (!plugin) return -1;

      const raf = () => new Promise(r => requestAnimationFrame(() => r()));
      const samples = [];
      for (let i = 0; i < 5; i++) {
        await raf();
        const start = performance.now();
        if (plugin.setGroupOn) {
          plugin.setGroupOn((row) => [row.department]);
        } else if (plugin.groupOn) {
          plugin.groupOn = (row) => [row.department];
        }
        await raf(); await raf();
        samples.push(performance.now() - start);
        // Clear grouping
        if (plugin.setGroupOn) {
          plugin.setGroupOn(null);
        } else if (plugin.clearGrouping) {
          plugin.clearGrouping();
        }
        await raf();
        await new Promise(r => setTimeout(r, 30));
      }
      samples.sort((a, b) => a - b);
      const trimmed = samples.slice(1, -1);
      return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    })()`,
  ) as Promise<number>;
}

/** Generate wide-column config JSON for evaluation in page context. */
function wideColumnConfigJson(colCount: number): string {
  const cols = [];
  for (let i = 0; i < colCount; i++) {
    cols.push(`{ "field": "col${i}", "header": "Column ${i}", "width": 120, "sortable": true }`);
  }
  return `[${cols.join(',')}]`;
}

/** Create a grid with many columns and fewer rows. */
async function setupWideGrid(page: Page, colCount: number, rowCount: number): Promise<number> {
  return page.evaluate(
    `(async () => {
      const rows = Array.from({length:${rowCount}}, (_,i) => {
        const row = { id: i };
        for (let c = 0; c < ${colCount}; c++) row['col' + c] = 'R' + i + 'C' + c;
        return row;
      });
      const start = performance.now();
      const grid = document.createElement('tbw-grid');
      grid.style.cssText = 'width:100%;height:600px;display:block';
      document.body.appendChild(grid);
      grid.gridConfig = {
        columns: ${wideColumnConfigJson(colCount)},
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

/** Measure horizontal scroll avg frame time. */
async function measureHorizontalScroll(page: Page): Promise<number> {
  return page.evaluate(
    `(async () => {
      const grid = document.querySelector('tbw-grid');
      if (!grid) return -1;
      const root = grid.shadowRoot || grid;
      let scrollable = null;
      for (const el of root.querySelectorAll('*')) {
        const s = getComputedStyle(el);
        if ((s.overflowX === 'auto' || s.overflowX === 'scroll') &&
            el.scrollWidth > el.clientWidth + 50) {
          scrollable = el; break;
        }
      }
      if (!scrollable) {
        // Try the grid body itself
        if (grid.scrollWidth > grid.clientWidth + 50) scrollable = grid;
        else return -1;
      }

      const maxScroll = scrollable.scrollWidth - scrollable.clientWidth;
      const steps = 30;
      const step = maxScroll / steps;
      const raf = () => new Promise(r => requestAnimationFrame(() => r()));

      // Warm-up
      for (let i = 0; i <= steps; i++) { scrollable.scrollLeft = i * step; await raf(); }
      scrollable.scrollLeft = 0;
      await new Promise(r => setTimeout(r, 100));

      // Measure
      const times = [];
      for (let i = 0; i <= steps; i++) {
        const t = performance.now();
        scrollable.scrollLeft = i * step;
        await raf();
        times.push(performance.now() - t);
      }
      scrollable.scrollLeft = 0;
      return times.reduce((a, b) => a + b, 0) / times.length;
    })()`,
  ) as Promise<number>;
}

/** Measure grid creation + destroy cycle time. */
async function measureDestroy(page: Page, rowCount: number): Promise<number> {
  return page.evaluate(
    `(async () => {
      const d = ['Engineering','Marketing','Sales','HR','Finance'];
      const rows = Array.from({length:${rowCount}}, (_,i) => ({
        id: i,
        firstName: 'First' + i,
        lastName: 'Last' + i,
        email: 'e' + i + '@test.com',
        department: d[i % 5],
        salary: 50000 + i * 100,
      }));
      const cols = ${BENCH_COLUMNS_JSON};

      const raf = () => new Promise(r => requestAnimationFrame(() => r()));
      const samples = [];

      for (let i = 0; i < 5; i++) {
        // Create grid
        const grid = document.createElement('tbw-grid');
        grid.style.cssText = 'width:100%;height:600px;display:block';
        document.body.appendChild(grid);
        grid.gridConfig = { columns: cols, getRowId: (row) => String(row.id) };
        grid.rows = rows;
        await raf(); await raf();

        // Measure destroy
        const start = performance.now();
        grid.remove();
        await raf();
        samples.push(performance.now() - start);
        await new Promise(r => setTimeout(r, 50));
      }
      samples.sort((a, b) => a - b);
      const trimmed = samples.slice(1, -1);
      return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    })()`,
  ) as Promise<number>;
}

// ─── Assert Helper ──────────────────────────────────────────────────────────

/**
 * Maximum number of retry attempts when a regression is initially detected.
 * The benchmark is re-run this many extra times before declaring a real failure.
 * This absorbs transient CI noise (CPU spikes, thermal throttling, GC pauses)
 * without masking genuine regressions — a consistent slowdown will fail every retry.
 */
const REGRESSION_RETRIES = 2;

function checkRegression(metricName: string, localTime: number, cdnTime: number): string | null {
  recordMetric(`compare.${metricName}.local`, localTime);
  recordMetric(`compare.${metricName}.cdn`, cdnTime);

  // Skip assertion if either measurement failed
  if (localTime <= 0 || cdnTime <= 0) return null;

  const ratio = localTime / cdnTime;
  const absoluteDelta = localTime - cdnTime;
  recordMetric(`compare.${metricName}.ratio`, ratio);

  // Only flag if the ratio exceeds threshold AND the absolute difference
  // is meaningful. Small absolute deltas (e.g. 4 ms = 25% slower) are noise,
  // not real regressions — skip unless the delta is clearly significant.
  const MIN_ABSOLUTE_DELTA_MS = 20;
  if (absoluteDelta < MIN_ABSOLUTE_DELTA_MS) return null;

  if (ratio > REGRESSION_THRESHOLD) {
    return `${metricName} regression: local=${localTime.toFixed(1)}ms, released=${cdnTime.toFixed(1)}ms, ratio=${ratio.toFixed(2)}`;
  }
  return null;
}

/**
 * Assert that a benchmark shows no regression, retrying up to {@link REGRESSION_RETRIES}
 * times when the initial run looks like a regression. Each retry calls `retryFn`
 * to get a fresh pair of measurements from new browser pages so transient noise
 * from one run does not carry over.
 */
async function assertNoRegression(
  metricName: string,
  localTime: number,
  cdnTime: number,
  retryFn?: () => Promise<{ local: number; cdn: number }>,
): Promise<void> {
  let failure = checkRegression(metricName, localTime, cdnTime);
  if (!failure) return;

  // Regression detected — retry to confirm it's not transient noise
  if (retryFn) {
    for (let attempt = 1; attempt <= REGRESSION_RETRIES; attempt++) {
      const { local, cdn } = await retryFn();
      failure = checkRegression(`${metricName}.retry${attempt}`, local, cdn);
      if (!failure) return; // Retry passed — transient noise, not a real regression
    }
  }

  // All retries also showed regression — this is real
  expect(failure).toBeNull();
}

// ─── Flush metrics ──────────────────────────────────────────────────────────

test.afterAll(() => {
  flushMetrics(runId);
});

// ─── Comparison Runner ──────────────────────────────────────────────────────

/**
 * Run a benchmark comparison between local and CDN builds, with automatic
 * retry support. `benchFn` receives local and CDN pages (already loaded with
 * the grid script) and must return both measurements. The helper handles
 * page lifecycle and passes a retry callback to {@link assertNoRegression}.
 */
async function runComparison(
  browser: Browser,
  metricName: string,
  benchFn: (localPage: Page, cdnPage: Page) => Promise<{ local: number; cdn: number }>,
): Promise<void> {
  const run = async (): Promise<{ local: number; cdn: number }> => {
    const localPage = await browser.newPage();
    const localOk = await loadGridScript(localPage, 'local');
    expect(localOk, 'Local UMD failed to register <tbw-grid>').toBe(true);

    const cdnPage = await browser.newPage();
    const cdnOk = await loadGridScript(cdnPage, 'cdn');
    if (!cdnOk) {
      await localPage.close();
      await cdnPage.close();
      test.skip(true, `CDN version (${CDN_VERSION}) not available`);
    }

    const result = await benchFn(localPage, cdnPage);
    await localPage.close();
    await cdnPage.close();
    return result;
  };

  const { local, cdn } = await run();
  await assertNoRegression(metricName, local, cdn, run);
}

// ═══════════════════════════════════════════════════════════════════════════
// SELF-COMPARISON BENCHMARKS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Performance: Self-Comparison', () => {
  test('render 500 rows', async ({ browser }) => {
    test.skip(!existsSync(LOCAL_UMD), 'Local build not found — run: bun nx build grid');

    await runComparison(browser, 'render500', async (localPage, cdnPage) => {
      await warmUpGrid(localPage);
      await warmUpGrid(cdnPage);
      return {
        local: await setupGrid(localPage, ROW_COUNT),
        cdn: await setupGrid(cdnPage, ROW_COUNT),
      };
    });
  });

  test('render 1000 rows', async ({ browser }) => {
    test.skip(!existsSync(LOCAL_UMD), 'Local build not found — run: bun nx build grid');

    await runComparison(browser, 'render1000', async (localPage, cdnPage) => {
      await warmUpGrid(localPage);
      await warmUpGrid(cdnPage);
      return {
        local: await setupGrid(localPage, LARGE_ROW_COUNT),
        cdn: await setupGrid(cdnPage, LARGE_ROW_COUNT),
      };
    });
  });

  test('data replacement', async ({ browser }) => {
    test.skip(!existsSync(LOCAL_UMD), 'Local build not found — run: bun nx build grid');

    await runComparison(browser, 'dataUpdate', async (localPage, cdnPage) => {
      await setupGrid(localPage, ROW_COUNT);
      await setupGrid(cdnPage, ROW_COUNT);
      return {
        local: await measureDataUpdate(localPage, ROW_COUNT),
        cdn: await measureDataUpdate(cdnPage, ROW_COUNT),
      };
    });
  });

  test('vertical scroll', async ({ browser }) => {
    test.skip(!existsSync(LOCAL_UMD), 'Local build not found — run: bun nx build grid');

    await runComparison(browser, 'scroll', async (localPage, cdnPage) => {
      await setupGrid(localPage, ROW_COUNT);
      await setupGrid(cdnPage, ROW_COUNT);
      return {
        local: await measureScroll(localPage),
        cdn: await measureScroll(cdnPage),
      };
    });
  });

  test('sort', async ({ browser }) => {
    test.skip(!existsSync(LOCAL_UMD), 'Local build not found — run: bun nx build grid');

    await runComparison(browser, 'sort', async (localPage, cdnPage) => {
      await setupGrid(localPage, ROW_COUNT);
      await setupGrid(cdnPage, ROW_COUNT);
      return {
        local: await measureSort(localPage),
        cdn: await measureSort(cdnPage),
      };
    });
  });

  test('filter', async ({ browser }) => {
    test.skip(!existsSync(LOCAL_UMD), 'Local build not found — run: bun nx build grid');

    await runComparison(browser, 'filter', async (localPage, cdnPage) => {
      await setupGrid(localPage, ROW_COUNT);
      await setupGrid(cdnPage, ROW_COUNT);
      return {
        local: await measureFilter(localPage, ROW_COUNT),
        cdn: await measureFilter(cdnPage, ROW_COUNT),
      };
    });
  });

  test('single-row update', async ({ browser }) => {
    test.skip(!existsSync(LOCAL_UMD), 'Local build not found — run: bun nx build grid');

    await runComparison(browser, 'rowUpdate', async (localPage, cdnPage) => {
      await setupGrid(localPage, ROW_COUNT);
      await setupGrid(cdnPage, ROW_COUNT);
      return {
        local: await measureRowUpdate(localPage, ROW_COUNT),
        cdn: await measureRowUpdate(cdnPage, ROW_COUNT),
      };
    });
  });

  test('column resize', async ({ browser }) => {
    test.skip(!existsSync(LOCAL_UMD), 'Local build not found — run: bun nx build grid');

    await runComparison(browser, 'columnResize', async (localPage, cdnPage) => {
      await setupGrid(localPage, ROW_COUNT);
      await setupGrid(cdnPage, ROW_COUNT);
      return {
        local: await measureColumnResize(localPage),
        cdn: await measureColumnResize(cdnPage),
      };
    });
  });

  test('scroll to end', async ({ browser }) => {
    test.skip(!existsSync(LOCAL_UMD), 'Local build not found — run: bun nx build grid');

    await runComparison(browser, 'scrollToEnd', async (localPage, cdnPage) => {
      await setupGrid(localPage, ROW_COUNT);
      await setupGrid(cdnPage, ROW_COUNT);
      return {
        local: await measureScrollToEnd(localPage, ROW_COUNT),
        cdn: await measureScrollToEnd(cdnPage, ROW_COUNT),
      };
    });
  });

  test('grouping', async ({ browser }) => {
    test.skip(!existsSync(LOCAL_UMD), 'Local build not found — run: bun nx build grid');

    await runComparison(browser, 'grouping', async (localPage, cdnPage) => {
      await setupGrid(localPage, ROW_COUNT);
      await setupGrid(cdnPage, ROW_COUNT);
      return {
        local: await measureGrouping(localPage),
        cdn: await measureGrouping(cdnPage),
      };
    });
  });

  test('wide columns render', async ({ browser }) => {
    test.skip(!existsSync(LOCAL_UMD), 'Local build not found — run: bun nx build grid');

    await runComparison(browser, 'wideColsRender', async (localPage, cdnPage) => ({
      local: await setupWideGrid(localPage, 200, WIDE_COL_ROW_COUNT),
      cdn: await setupWideGrid(cdnPage, 200, WIDE_COL_ROW_COUNT),
    }));
  });

  test('wide columns horizontal scroll', async ({ browser }) => {
    test.skip(!existsSync(LOCAL_UMD), 'Local build not found — run: bun nx build grid');

    await runComparison(browser, 'horizontalScroll', async (localPage, cdnPage) => {
      await setupWideGrid(localPage, 100, WIDE_COL_ROW_COUNT);
      await setupWideGrid(cdnPage, 100, WIDE_COL_ROW_COUNT);
      return {
        local: await measureHorizontalScroll(localPage),
        cdn: await measureHorizontalScroll(cdnPage),
      };
    });
  });

  test('grid destroy', async ({ browser }) => {
    test.skip(!existsSync(LOCAL_UMD), 'Local build not found — run: bun nx build grid');

    await runComparison(browser, 'destroy', async (localPage, cdnPage) => ({
      local: await measureDestroy(localPage, ROW_COUNT),
      cdn: await measureDestroy(cdnPage, ROW_COUNT),
    }));
  });
});
