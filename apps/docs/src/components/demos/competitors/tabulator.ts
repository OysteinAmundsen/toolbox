// Tabulator (tabulator-tables) adapter — loaded from CDN at first use.
// Validates the CompetitorAdapter abstraction with a second non-Toolbox grid.

import {
  COL_COUNT,
  REPLACEMENT_MARKER,
  assertBenchmark,
  cooldown,
  countDomNodes,
  fetchPackageVersion,
  generateColumns,
  generateRows,
  injectCss,
  injectScript,
  markReplacement,
  measureAvg,
  measureRetained,
  measureVisual,
  nextFrame,
  shuffleRows,
} from './shared.js';
import type { BenchmarkRow, CompetitorAdapter, MetricName } from './types.js';

interface TabulatorRow {
  getData(): BenchmarkRow;
}

/** Minimal subset of Tabulator's instance API we use here. */
interface TabulatorInstance {
  setSort(sorters: Array<{ column: string; dir: 'asc' | 'desc' }>): void;
  clearSort(): void;
  setFilter(field: string, type: string, value: unknown): void;
  clearFilter(includeHeaderFilters: boolean): void;
  replaceData(rows: unknown[]): Promise<void>;
  updateRow(id: string | number, patch: Record<string, unknown>): Promise<boolean>;
  getColumn(field: string): { setWidth(width: number): boolean; getWidth(): number } | false;
  getDataCount(range?: 'active'): number;
  getRows(range?: 'active' | 'visible'): TabulatorRow[];
  getRow(id: string | number): TabulatorRow | false;
  scrollToRow(id: string | number, position: 'top' | 'center' | 'bottom', ifVisible: boolean): Promise<void>;
  destroy(): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler?: (...args: unknown[]) => void): void;
}
type TabulatorCtor = new (selector: HTMLElement | string, options: Record<string, unknown>) => TabulatorInstance;

function getTabulator(): TabulatorCtor {
  const T = (window as Window & { Tabulator?: TabulatorCtor }).Tabulator;
  if (!T) throw new Error('Tabulator not loaded');
  return T;
}

const TABULATOR_CONFIG_CODE = [
  'new Tabulator(container, {',
  '  data: rows, // 5K → 1M rows',
  "  index: 'id',",
  "  height: '100%',",
  "  layout: 'fitDataStretch',",
  '  virtualDom: true,        // default, kept explicit for clarity',
  '  columns: [',
  "    { title: 'ID', field: 'id', width: 80, sorter: 'number' },",
  '    // ... 9 more columns, width: 120, sortable: true',
  '  ],',
  '});',
  '',
  "table.setSort([{ column: 'id', dir: 'desc' }]);",
  "table.setFilter('id', '>', threshold);",
].join('\n');

let loaded = false;

export const tabulatorAdapter: CompetitorAdapter = {
  id: 'tabulator',
  name: 'Tabulator (tabulator-tables)',
  shortLabel: 'TBL',
  color: '#a78bfa',
  url: 'https://tabulator.info/',
  description: 'Loaded from CDN. Latest published version of tabulator-tables (MIT).',
  configCode: TABULATOR_CONFIG_CODE,
  version: '',
  async load() {
    if (loaded) return;
    this.version = await fetchPackageVersion('tabulator-tables');
    injectCss('https://cdn.jsdelivr.net/npm/tabulator-tables/dist/css/tabulator.min.css');
    await injectScript('https://cdn.jsdelivr.net/npm/tabulator-tables/dist/js/tabulator.min.js');
    loaded = true;
  },
  async runAtScale(gridArea: HTMLElement, rowCount: number): Promise<Map<MetricName, number>> {
    const results = new Map<MetricName, number>();
    const Tabulator = getTabulator();
    const columns = generateColumns(COL_COUNT);
    const rows = generateRows(rowCount, COL_COUNT);

    // DOM node count after first paint. See toolbox.ts for rationale.

    const tblColumns = columns.map((c) => ({
      title: c.header,
      field: c.field,
      width: c.width,
      sorter: c.field === 'id' ? 'number' : 'string',
    }));

    const baseOptions: Record<string, unknown> = {
      index: 'id',
      height: '100%',
      layout: 'fitDataStretch',
      virtualDom: true,
      columns: tblColumns,
      // Disable animations to match other grids' fairness baseline.
      movableColumns: false,
      resizableColumnFit: false,
    };

    // Initial render — wait for `tableBuilt` (Tabulator fires it once
    // construction *and* initial data render are both complete).
    const initialRender = await measureRetained(
      async () => {
        let table: TabulatorInstance | null = null;
        let container: HTMLElement | null = null;
        const duration = await measureVisual(
          () =>
            new Promise<void>((resolve) => {
              gridArea.innerHTML = '<div id="compare-tbl-grid" style="width:100%;height:100%;"></div>';
              container = document.getElementById('compare-tbl-grid');
              let resolved = false;
              const built = () => {
                if (resolved) return;
                resolved = true;
                resolve();
              };
              table = new Tabulator(container!, { ...baseOptions, data: rows });
              table.on('tableBuilt', built);
              setTimeout(built, 30_000);
            }),
        );
        if (!table || !container) throw new Error('Tabulator did not initialize');
        assertBenchmark(
          'Tabulator',
          'Cold mount to painted viewport',
          rowCount,
          table.getDataCount() === rowCount && container.querySelector('.tabulator-row') !== null,
          `expected ${rowCount} modeled rows and at least one painted row, got ${table.getDataCount()} rows`,
        );
        return { duration, value: { table, container } };
      },
      ({ table, container }) => {
        table.destroy();
        container.remove();
        gridArea.innerHTML = '';
      },
    );
    results.set('Cold mount to painted viewport', initialRender.duration);
    await cooldown(200);
    results.set('DOM nodes', countDomNodes(gridArea));
    const { table: t, container } = initialRender.value;

    // Warmup scroll — timed per-frame metric removed (vsync floor).
    const tblScrollViewport = container.querySelector('.tabulator-tableholder');
    if (tblScrollViewport) {
      const totalHeight = tblScrollViewport.scrollHeight;
      const viewportHeight = tblScrollViewport.clientHeight;
      const steps = 30;
      const stepSize = (totalHeight - viewportHeight) / steps;
      if (stepSize > 0) {
        for (let i = 0; i <= steps; i++) {
          tblScrollViewport.scrollTop = i * stepSize;
          await nextFrame();
        }
        tblScrollViewport.scrollTop = 0;
        await cooldown(50);
      }
    }

    // Sort — shuffle first
    const sortTime = await measureAvg(
      async (iteration) => {
        await t.replaceData(shuffleRows([...rows], rowCount * 31 + iteration));
        await nextFrame();
        await nextFrame();
        const duration = await measureVisual(() => {
          t.setSort([{ column: 'id', dir: 'desc' }]);
        });
        const activeRows = t.getRows('active');
        assertBenchmark(
          'Tabulator',
          'Sort',
          rowCount,
          activeRows[0]?.getData().id === rowCount && activeRows[rowCount - 1]?.getData().id === 1,
          `expected descending ids ${rowCount}..1, got ${activeRows[0]?.getData().id}..${activeRows[rowCount - 1]?.getData().id}`,
        );
        return duration;
      },
      () => {
        t.clearSort();
      },
    );
    results.set('Sort', sortTime);
    await cooldown(50);

    // Filter
    {
      const threshold = Math.floor(rowCount / 2);
      const filterTime = await measureAvg(
        async () => {
          const duration = await measureVisual(() => {
            t.setFilter('id', '>', threshold);
          });
          const activeRows = t.getRows('active');
          assertBenchmark(
            'Tabulator',
            'Filter',
            rowCount,
            activeRows.length === rowCount - threshold && activeRows.every((row) => row.getData().id > threshold),
            `expected ${rowCount - threshold} rows with id > ${threshold}, got ${activeRows.length}`,
          );
          return duration;
        },
        async () => {
          t.clearFilter(true);
          await nextFrame();
        },
      );
      results.set('Filter', filterTime);
      t.clearFilter(true);
      await nextFrame();
      await cooldown(50);
    }

    // Data replacement — replaceData returns a Promise; measureVisual still
    // adds one rAF after the await for fair "until painted" parity.
    const replaceTime = await measureAvg(async () => {
      const fresh = markReplacement(generateRows(rowCount, COL_COUNT));
      const duration = await measureVisual(async () => {
        await t.replaceData(fresh);
      });
      const first = t.getRows('active')[0]?.getData();
      assertBenchmark(
        'Tabulator',
        'Replace data to painted viewport',
        rowCount,
        t.getDataCount() === rowCount &&
          first?.col1 === REPLACEMENT_MARKER &&
          container.textContent?.includes(REPLACEMENT_MARKER) === true,
        `expected ${rowCount} replacement rows and visible marker ${REPLACEMENT_MARKER}`,
      );
      return duration;
    });
    results.set('Replace data to painted viewport', replaceTime);
    await cooldown(50);

    // Update single row
    {
      const midId = Math.floor(rowCount / 2) + 1;
      let updateCounter = 0;
      const updateTime = await measureAvg(async () => {
        const expected = `UPDATED${++updateCounter}`;
        const duration = await measureVisual(async () => {
          await t.updateRow(midId, { col1: expected });
        });
        const row = t.getRow(midId);
        assertBenchmark(
          'Tabulator',
          'Update single row',
          rowCount,
          row !== false && row.getData().col1 === expected,
          `expected row ${midId} col1 to equal ${expected}`,
        );
        return duration;
      });
      results.set('Update single row', updateTime);
      await cooldown(50);
    }

    // Column resize
    {
      const idColumn = t.getColumn('id');
      if (idColumn) {
        let wide = true;
        const resizeTime = await measureAvg(async () => {
          const expectedWidth = wide ? 200 : 80;
          const duration = await measureVisual(() => {
            idColumn.setWidth(expectedWidth);
            wide = !wide;
          });
          assertBenchmark(
            'Tabulator',
            'Column resize',
            rowCount,
            idColumn.getWidth() === expectedWidth,
            `expected id column width ${expectedWidth}, got ${idColumn.getWidth()}`,
          );
          return duration;
        });
        results.set('Column resize', resizeTime);
        await cooldown(50);
      }
    }

    // Scroll to end
    {
      const lastId = rowCount;
      const scrollEndTime = await measureAvg(
        async () => {
          const duration = await measureVisual(async () => {
            await t.scrollToRow(lastId, 'bottom', false);
          });
          const lastVisibleRow = t.getRows('visible').at(-1)?.getData();
          assertBenchmark(
            'Tabulator',
            'Scroll to end',
            rowCount,
            lastVisibleRow?.id === lastId,
            `expected last visible row id ${lastId}, got ${lastVisibleRow?.id ?? 'missing'}`,
          );
          return duration;
        },
        async () => {
          await t.scrollToRow(1, 'top', false);
        },
      );
      results.set('Scroll to end', scrollEndTime);
      await cooldown(50);
    }

    // Destroy — a fresh mounted instance per iteration
    {
      const destroyTime = await measureAvg(async () => {
        gridArea.innerHTML = '<div id="compare-tbl-destroy" style="width:100%;height:100%;"></div>';
        const destroyContainer = document.getElementById('compare-tbl-destroy')!;
        const destroyTable = await new Promise<TabulatorInstance>((resolve) => {
          let resolved = false;
          const built = () => {
            if (resolved) return;
            resolved = true;
            resolve(instance);
          };
          const instance = new Tabulator(destroyContainer, { ...baseOptions, data: rows });
          instance.on('tableBuilt', built);
          setTimeout(built, 30_000);
        });
        await nextFrame();
        await cooldown(30);

        const duration = await measureVisual(() => {
          destroyTable.destroy();
          destroyContainer.remove();
        });
        assertBenchmark(
          'Tabulator',
          'Grid destroy',
          rowCount,
          !destroyContainer.isConnected,
          'expected benchmark grid host to be disconnected',
        );
        return duration;
      });
      results.set('Grid destroy', destroyTime);
      gridArea.innerHTML = '';
      await cooldown(50);
    }

    t.destroy();
    container.remove();
    gridArea.innerHTML = '';
    await cooldown(300);

    return results;
  },
};
