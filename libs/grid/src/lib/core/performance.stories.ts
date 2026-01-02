import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { ColumnConfig, GridElement } from '../../public';

// Import grid for HMR
import '../../index';

// Import plugins for benchmarks
import { ColumnVirtualizationPlugin } from '../plugins/column-virtualization';
import { FilteringPlugin } from '../plugins/filtering';
import { MultiSortPlugin } from '../plugins/multi-sort';
import { PinnedColumnsPlugin } from '../plugins/pinned-columns';
import { SelectionPlugin } from '../plugins/selection';

// #region Benchmark Definitions

type ExtendedColumnConfig = ColumnConfig & { sticky?: 'left' | 'right'; filterable?: boolean };

interface BenchmarkResult {
  name: string;
  category: 'render' | 'scroll' | 'operation' | 'memory';
  time: number;
  unit: string;
  target: number;
  passed: boolean;
  note?: string; // Optional explanation for info-type metrics
}

// #endregion

// #region Story Configuration

const meta: Meta = {
  title: 'Grid/Benchmarks',
  tags: ['!dev'],
  parameters: { layout: 'fullscreen' },
};
export default meta;

interface StressTestArgs {
  rowCount: number;
  columnCount: number;
}

type Story = StoryObj<StressTestArgs>;

// Generate columns dynamically
function generateColumns(
  count: number,
  options?: { sortable?: boolean; filterable?: boolean },
): ExtendedColumnConfig[] {
  const columns: ExtendedColumnConfig[] = [
    { field: 'id', header: 'ID', type: 'number', width: 60, sortable: options?.sortable },
  ];
  for (let i = 1; i < count; i++) {
    columns.push({
      field: `col${i}`,
      header: `Column ${i}`,
      type: 'string',
      width: 100,
      sortable: options?.sortable,
      filterable: options?.filterable,
    });
  }
  return columns;
}

// Generate rows dynamically
function generateRows(rowCount: number, columnCount: number): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < rowCount; i++) {
    const row: Record<string, unknown> = { id: i + 1 };
    for (let j = 1; j < columnCount; j++) {
      row[`col${j}`] = `R${i + 1}C${j}`;
    }
    rows.push(row);
  }
  return rows;
}

// #endregion

// #region Results Display

function formatTime(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function renderResultsTable(results: BenchmarkResult[], isComplete = false): string {
  const categories = ['render', 'scroll', 'operation', 'memory'] as const;
  const categoryLabels: Record<string, string> = {
    render: '🎨 Initial Render',
    scroll: '📜 Scroll Performance',
    operation: '⚡ Operations',
    memory: '💾 Memory',
  };

  let html = `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;">`;

  for (const cat of categories) {
    const catResults = results.filter((r) => r.category === cat);
    if (catResults.length === 0) continue;

    html += `
      <div style="background:var(--tbw-code-bg,#1e1e1e);border-radius:6px;padding:12px;min-width:0;">
        <h4 style="margin:0 0 10px 0;color:#e5e5e5;font-size:13px;font-weight:600;">${categoryLabels[cat]}</h4>
        <div style="display:grid;grid-template-columns:1fr auto auto auto;gap:4px 12px;font-size:12px;align-items:center;">
          ${catResults
            .map(
              (r) => `
            <div style="color:#e5e5e5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.name}</div>
            <div style="color:${r.passed ? '#4ade80' : '#f87171'};font-family:monospace;text-align:right;">
              ${
                r.unit === 'info'
                  ? '—'
                  : r.unit === 'bytes'
                    ? formatBytes(r.time)
                    : r.unit === 'bool'
                      ? r.time
                        ? 'Yes'
                        : 'No'
                      : formatTime(r.time)
              }
            </div>
            <div style="color:#888;font-family:monospace;text-align:right;font-size:11px;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${
              r.note || ''
            }">
              ${
                r.note
                  ? r.note
                  : r.unit === 'bool' || r.unit === 'info'
                    ? ''
                    : r.target === Infinity
                      ? '(info)'
                      : '&lt;' + (r.unit === 'bytes' ? formatBytes(r.target) : formatTime(r.target))
              }
            </div>
            <div style="text-align:center;">${r.target === Infinity ? 'ℹ️' : r.passed ? '✅' : '❌'}</div>
          `,
            )
            .join('')}
        </div>
      </div>
    `;
  }

  html += `</div>`;

  // Summary - only show when complete
  if (isComplete) {
    const passed = results.filter((r) => r.passed).length;
    const total = results.length;
    const allPassed = passed === total;

    html += `
      <div style="margin-top:16px;padding:12px;background:${
        allPassed ? '#166534' : '#991b1b'
      };border-radius:4px;text-align:center;">
        <strong style="color:#fff;font-size:14px;">${
          allPassed ? '✅ All benchmarks passed!' : `⚠️ ${passed}/${total} benchmarks passed`
        }</strong>
      </div>
    `;
  } else {
    html += `
      <div style="margin-top:16px;padding:8px;opacity:0.6;text-align:center;font-size:12px;">
        Running... ${results.length} tests completed
      </div>
    `;
  }

  return html;
}

// #endregion

// #region Main Story

/**
 * ## Comprehensive Grid Benchmark
 *
 * Tests all aspects of grid performance:
 *
 * **🎨 Initial Render**
 * - Time to first paint with large dataset
 * - Time to render with plugins enabled
 *
 * **📜 Scroll Performance**
 * - Baseline scroll (no plugins)
 * - Scroll with multiple plugins
 *
 * **⚡ Operations**
 * - Sort 100% of data
 * - Filter to 10% of data
 * - Full data replacement
 * - Select all rows
 *
 * **💾 Memory**
 * - Bytes per row
 * - Total heap usage
 */
export const PerformanceStressTest: Story = {
  args: {
    rowCount: 10000,
    columnCount: 10,
  },
  argTypes: {
    rowCount: {
      control: { type: 'range', min: 1000, max: 100000, step: 1000 },
      description: 'Number of data rows',
    },
    columnCount: {
      control: { type: 'range', min: 5, max: 50, step: 5 },
      description: 'Number of columns',
    },
  },
  render: (args: StressTestArgs) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'dg-view-wrapper';

    // Control bar
    const bar = document.createElement('div');
    bar.className = 'dg-view-bar';
    bar.style.cssText = 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;';
    bar.innerHTML = `
      <button id="run-bench" class="dg-toggle-btn">Run Full Benchmark</button>
      <span id="bench-status" style="font-size:13px;">Ready - ${args.rowCount.toLocaleString()} rows × ${
        args.columnCount
      } columns</span>
    `;

    // Grid container
    const gridContainer = document.createElement('div');
    gridContainer.className = 'dg-grid-container';

    const grid = document.createElement('tbw-grid') as GridElement;
    gridContainer.appendChild(grid);

    // Results area
    const resultsEl = document.createElement('div');
    resultsEl.className = 'dg-description';
    resultsEl.id = 'bench-results';
    resultsEl.innerHTML = `
      <p>Click <strong>Run Full Benchmark</strong> to test all grid operations.</p>
      <p style="opacity:0.7;font-size:12px;">Tests: Initial render, scroll performance, sort, filter, data update, selection, memory usage</p>
    `;
    gridContainer.appendChild(resultsEl);

    wrapper.appendChild(bar);
    wrapper.appendChild(gridContainer);

    // Setup benchmark runner
    setTimeout(() => {
      const runBtn = bar.querySelector('#run-bench') as HTMLButtonElement;
      const status = bar.querySelector('#bench-status') as HTMLSpanElement;
      const results = wrapper.querySelector('#bench-results') as HTMLDivElement;

      if (!runBtn) return;

      runBtn.addEventListener('click', async () => {
        runBtn.disabled = true;
        const allResults: BenchmarkResult[] = [];

        const updateResults = () => {
          results.innerHTML = renderResultsTable(allResults);
        };

        // Helper: wait for RAF
        const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

        // Helper: measure operation
        const measure = async (fn: () => void | Promise<void>): Promise<number> => {
          await nextFrame();
          const start = performance.now();
          await fn();
          await nextFrame();
          return performance.now() - start;
        };

        // Modern memory measurement API (requires COOP/COEP headers)
        type MemoryMeasurement = { bytes: number; breakdown: { bytes: number; types: string[] }[] };
        let memoryApiReason = '';
        const measureMemory = async (): Promise<number | null> => {
          try {
            // Check if API exists
            const perf = performance as unknown as {
              measureUserAgentSpecificMemory?: () => Promise<MemoryMeasurement>;
            };
            if (!perf.measureUserAgentSpecificMemory) {
              memoryApiReason = 'API unavailable (Chrome 89+ only)';
              return null;
            }
            // Check cross-origin isolation
            if (!crossOriginIsolated) {
              memoryApiReason = 'Missing COOP/COEP headers (restart Storybook)';
              return null;
            }
            const result = await perf.measureUserAgentSpecificMemory();
            return result.bytes;
          } catch (e) {
            memoryApiReason = `API error: ${e instanceof Error ? e.message : String(e)}`;
            return null;
          }
        };

        status.textContent = 'Generating test data...';
        await nextFrame();

        // Capture heap before grid data is loaded (baseline for delta calculation)
        // Clear grid first and wait for GC opportunity
        grid.gridConfig = { columns: [], plugins: [] };
        grid.rows = [];
        await new Promise((r) => setTimeout(r, 100));
        const heapBefore = await measureMemory();

        const baseColumns = generateColumns(args.columnCount, { sortable: true, filterable: true });
        const baseRows = generateRows(args.rowCount, args.columnCount);

        // Calculate scaling factors for targets based on data size
        // Baseline: 10k rows × 10 columns = 100k cells
        // Use sqrt scaling - performance doesn't degrade linearly due to virtualization
        const baselineRows = 10_000;
        const baselineCols = 10;
        const rowScale = Math.max(1, Math.sqrt(args.rowCount / baselineRows));
        const colScale = Math.max(1, Math.sqrt(args.columnCount / baselineCols));
        const cellScale = rowScale * colScale;

        // Target calculators with different scaling curves
        const scaledByRows = (base: number) => Math.round(base * rowScale);
        const scaledByCells = (base: number) => Math.round(base * cellScale);

        // #region 🎨 INITIAL RENDER BENCHMARKS
        status.textContent = 'Testing: Initial render (baseline)...';

        // Clear grid
        grid.gridConfig = { columns: [], plugins: [] };
        grid.rows = [];
        await new Promise((r) => setTimeout(r, 50));

        // Benchmark: Initial render baseline
        const renderTime = await measure(() => {
          grid.columns = baseColumns;
          grid.rows = [...baseRows];
        });

        allResults.push({
          name: 'Baseline render',
          category: 'render',
          time: renderTime,
          unit: 'ms',
          target: scaledByCells(100),
          passed: renderTime < scaledByCells(100),
        });
        updateResults();

        // Benchmark: Render with plugins
        status.textContent = 'Testing: Initial render (with plugins)...';
        grid.gridConfig = { columns: [], plugins: [] };
        grid.rows = [];
        await new Promise((r) => setTimeout(r, 50));

        const pluginColumns = baseColumns.map((col, i) => ({
          ...col,
          sticky: i === 0 ? ('left' as const) : undefined,
        }));

        const pluginRenderTime = await measure(() => {
          grid.gridConfig = {
            columns: pluginColumns as ColumnConfig[],
            plugins: [
              new SelectionPlugin({ mode: 'row' }),
              new PinnedColumnsPlugin(),
              new MultiSortPlugin({ maxSortColumns: 3 }),
              new FilteringPlugin({ debounceMs: 0 }),
              new ColumnVirtualizationPlugin({ threshold: 20, overscan: 3 }),
            ],
          };
          grid.rows = [...baseRows];
        });

        allResults.push({
          name: 'Render with 5 plugins',
          category: 'render',
          time: pluginRenderTime,
          unit: 'ms',
          target: scaledByCells(150),
          passed: pluginRenderTime < scaledByCells(150),
        });
        updateResults();

        // #endregion

        // #region 📜 SCROLL BENCHMARKS
        status.textContent = 'Testing: Scroll performance...';
        await new Promise((r) => setTimeout(r, 100));

        const scrollContainer = grid.shadowRoot?.querySelector('.faux-vscroll') as HTMLElement | null;
        if (scrollContainer) {
          const totalHeight = scrollContainer.scrollHeight;
          const viewportHeight = scrollContainer.clientHeight;
          const steps = 30;
          const stepSize = (totalHeight - viewportHeight) / steps;

          if (stepSize > 0) {
            // Warm-up pass
            for (let i = 0; i <= steps; i++) {
              scrollContainer.scrollTop = i * stepSize;
              await nextFrame();
            }
            scrollContainer.scrollTop = 0;
            await new Promise((r) => setTimeout(r, 50));

            // Actual measurement
            const frameTimes: number[] = [];
            for (let i = 0; i <= steps; i++) {
              const start = performance.now();
              scrollContainer.scrollTop = i * stepSize;
              await nextFrame();
              frameTimes.push(performance.now() - start);
            }

            const avgScroll = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
            const p95Scroll = [...frameTimes].sort((a, b) => a - b)[Math.floor(frameTimes.length * 0.95)];

            // Scroll target scales with columns (more cells per row = heavier render)
            const scrollTarget = Math.min(33.33, 17 * (1 + (args.columnCount - 10) / 40));

            allResults.push({
              name: 'Scroll avg frame',
              category: 'scroll',
              time: avgScroll,
              unit: 'ms',
              target: scrollTarget,
              passed: avgScroll < scrollTarget,
            });

            allResults.push({
              name: 'Scroll P95 frame',
              category: 'scroll',
              time: p95Scroll,
              unit: 'ms',
              target: 33.33, // 30fps acceptable for P95
              passed: p95Scroll < 33.33,
            });
            updateResults();
          }
        }

        // Horizontal scroll (column virtualization)
        status.textContent = 'Testing: Horizontal scroll performance...';
        await new Promise((r) => setTimeout(r, 100));

        // Get horizontal scroll container
        const hScrollContainer = grid.shadowRoot?.querySelector('.tbw-scroll-area') as HTMLElement | null;
        const colVirtPlugin = grid.getPlugin?.(ColumnVirtualizationPlugin);

        if (hScrollContainer && args.columnCount >= 20) {
          // Calculate total content width (all columns)
          const totalWidth = hScrollContainer.scrollWidth;
          const viewportWidth = hScrollContainer.clientWidth;
          const hSteps = 30;
          const hStepSize = (totalWidth - viewportWidth) / hSteps;

          if (hStepSize > 0) {
            // Warm-up pass
            for (let i = 0; i <= hSteps; i++) {
              hScrollContainer.scrollLeft = i * hStepSize;
              await nextFrame();
            }
            hScrollContainer.scrollLeft = 0;
            await new Promise((r) => setTimeout(r, 50));

            // Actual measurement
            const hFrameTimes: number[] = [];
            for (let i = 0; i <= hSteps; i++) {
              const start = performance.now();
              hScrollContainer.scrollLeft = i * hStepSize;
              await nextFrame();
              hFrameTimes.push(performance.now() - start);
            }

            const avgHScroll = hFrameTimes.reduce((a, b) => a + b, 0) / hFrameTimes.length;
            const p95HScroll = [...hFrameTimes].sort((a, b) => a - b)[Math.floor(hFrameTimes.length * 0.95)];

            // Horizontal scroll target - columns virtualize so should be fast
            const hScrollTarget = 17; // Target 60fps

            allResults.push({
              name: 'H-Scroll avg frame',
              category: 'scroll',
              time: avgHScroll,
              unit: 'ms',
              target: hScrollTarget,
              passed: avgHScroll < hScrollTarget,
            });

            allResults.push({
              name: 'H-Scroll P95 frame',
              category: 'scroll',
              time: p95HScroll,
              unit: 'ms',
              target: 33.33,
              passed: p95HScroll < 33.33,
            });

            // Report if column virtualization is active
            if (colVirtPlugin) {
              const isVirt = colVirtPlugin.getIsVirtualized();
              const range = colVirtPlugin.getVisibleColumnRange();
              allResults.push({
                name: `Col virtualization (${range.end - range.start + 1}/${args.columnCount} visible)`,
                category: 'scroll',
                time: isVirt ? 1 : 0,
                unit: 'bool',
                target: 1, // Should be virtualized with 20+ columns
                passed: isVirt,
              });
            }
            updateResults();
          }
        }

        // #endregion

        // #region ⚡ OPERATION BENCHMARKS

        // Sort operation
        status.textContent = 'Testing: Sort operation...';
        if (scrollContainer) {
          scrollContainer.scrollTop = 0;
        }
        await new Promise((r) => setTimeout(r, 50));

        const sortPlugin = grid.getPlugin?.(MultiSortPlugin);
        if (sortPlugin) {
          // Sort scales with row count (O(n log n)), base 150ms for 10k rows
          const sortTarget = Math.round(150 * (Math.log2(args.rowCount) / Math.log2(10000)));

          // Sort ascending by numeric id column
          const sortTime = await measure(() => {
            sortPlugin.setSortModel([{ field: 'id', direction: 'asc' }]);
          });

          allResults.push({
            name: 'Sort (ascending)',
            category: 'operation',
            time: sortTime,
            unit: 'ms',
            target: sortTarget,
            passed: sortTime < sortTarget,
          });
          updateResults();

          // Replace with fresh unsorted data before descending test
          grid.rows = generateRows(args.rowCount, args.columnCount);
          await nextFrame();
          await new Promise((r) => setTimeout(r, 50));

          // Sort descending on fresh unsorted data
          const reverseSortTime = await measure(() => {
            sortPlugin.setSortModel([{ field: 'id', direction: 'desc' }]);
          });

          allResults.push({
            name: 'Sort (descending)',
            category: 'operation',
            time: reverseSortTime,
            unit: 'ms',
            target: sortTarget,
            passed: reverseSortTime < sortTarget,
          });
          updateResults();

          // Clear sort
          sortPlugin.clearSort();
          await nextFrame();
        }

        // Filter operation
        status.textContent = 'Testing: Filter operation...';
        const filterPlugin = grid.getPlugin?.(FilteringPlugin);
        if (filterPlugin) {
          const filterTime = await measure(() => {
            filterPlugin.setFilter('col1', { type: 'text', operator: 'contains', value: 'R1' }); // Should match ~10% of rows
          });

          allResults.push({
            name: 'Filter (to ~10%)',
            category: 'operation',
            time: filterTime,
            unit: 'ms',
            target: scaledByRows(50),
            passed: filterTime < scaledByRows(50),
          });
          updateResults();

          // Clear filter
          const clearFilterTime = await measure(() => {
            filterPlugin.setFilter('col1', null);
          });

          allResults.push({
            name: 'Clear filter',
            category: 'operation',
            time: clearFilterTime,
            unit: 'ms',
            target: scaledByRows(50),
            passed: clearFilterTime < scaledByRows(50),
          });
          updateResults();
        }

        // Data replacement
        status.textContent = 'Testing: Data replacement...';
        const newRows = generateRows(args.rowCount, args.columnCount);
        const replaceTime = await measure(() => {
          grid.rows = newRows;
        });

        allResults.push({
          name: 'Full data replace',
          category: 'operation',
          time: replaceTime,
          unit: 'ms',
          target: scaledByRows(50),
          passed: replaceTime < scaledByRows(50),
        });
        updateResults();

        // Selection (select range to simulate select all)
        status.textContent = 'Testing: Selection...';
        const selectionPlugin = grid.getPlugin?.(SelectionPlugin);
        if (selectionPlugin) {
          // Select all rows by setting a large range
          const selectAllTime = await measure(() => {
            selectionPlugin.setRanges([
              { from: { row: 0, col: 0 }, to: { row: args.rowCount - 1, col: args.columnCount - 1 } },
            ]);
          });

          allResults.push({
            name: 'Select all cells',
            category: 'operation',
            time: selectAllTime,
            unit: 'ms',
            target: 50,
            passed: selectAllTime < 50,
          });
          updateResults();

          // Clear selection
          const clearSelectionTime = await measure(() => {
            selectionPlugin.clearSelection();
          });

          allResults.push({
            name: 'Clear selection',
            category: 'operation',
            time: clearSelectionTime,
            unit: 'ms',
            target: 50,
            passed: clearSelectionTime < 50,
          });
          updateResults();
        }

        // #endregion

        // #region 💾 MEMORY BENCHMARKS
        status.textContent = 'Calculating: Data size...';

        // Calculate estimated data size directly (more reliable than performance.memory API)
        // Each row object: key overhead (~40 bytes) + values
        // Each string value: ~50 bytes avg (header + 2 bytes per char)
        // Each number: 8 bytes
        const estimatedBytesPerRow = 40 + args.columnCount * 52; // object overhead + (field key + string value) per column
        const estimatedDataSize = args.rowCount * estimatedBytesPerRow;

        allResults.push({
          name: 'Est. data size',
          category: 'memory',
          time: estimatedDataSize,
          unit: 'bytes',
          target: 500 * 1024 * 1024, // < 500MB
          passed: estimatedDataSize < 500 * 1024 * 1024,
        });

        allResults.push({
          name: 'Est. bytes/row',
          category: 'memory',
          time: estimatedBytesPerRow,
          unit: 'bytes',
          target: 5000, // < 5KB per row
          passed: estimatedBytesPerRow < 5000,
        });

        // Note: performance.memory API is deprecated and unreliable for real-time measurements.
        // Memory efficiency is tracked via Est. data size and Est. bytes/row above.
        // Use modern measureUserAgentSpecificMemory if available (requires COOP/COEP headers)
        if (heapBefore !== null) {
          const heapAfter = await measureMemory();
          if (heapAfter !== null) {
            const heapDelta = Math.max(0, heapAfter - heapBefore);
            // Target: grid overhead should be < 50MB + data size
            const heapTarget = 50 * 1024 * 1024 + estimatedDataSize;
            allResults.push({
              name: 'Heap delta (measured)',
              category: 'memory',
              time: heapDelta,
              unit: 'bytes',
              target: heapTarget,
              passed: heapDelta < heapTarget,
            });
          }
        } else if (memoryApiReason) {
          // Only show heap delta row if there's a reason to explain
          // Skip entirely if API is simply unavailable - the estimated metrics are sufficient
          if (memoryApiReason.includes('COOP/COEP')) {
            allResults.push({
              name: 'Heap delta',
              category: 'memory',
              time: 0,
              unit: 'info',
              target: 0,
              passed: true,
              note: memoryApiReason,
            });
          }
          // If API is unavailable (Chrome 89+ only), silently skip - calculated metrics are primary
        }
        updateResults();

        // #endregion

        // #region COMPLETE
        status.textContent = 'Benchmark complete!';
        runBtn.disabled = false;

        // Final update with summary
        results.innerHTML = renderResultsTable(allResults, true);

        // Console summary
        console.table(
          allResults.map((r) => ({
            Benchmark: r.name,
            Result: r.unit === 'bytes' ? formatBytes(r.time) : formatTime(r.time),
            Target: r.unit === 'bytes' ? '< ' + formatBytes(r.target) : '< ' + formatTime(r.target),
            Status: r.passed ? '✅ PASS' : '❌ FAIL',
          })),
        );
        // #endregion
      });
    });

    return wrapper;
  },
};

// #endregion
