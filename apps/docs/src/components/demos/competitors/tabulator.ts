// Tabulator (tabulator-tables) adapter — loaded from CDN at first use.
// Validates the CompetitorAdapter abstraction with a second non-Toolbox grid.

import {
  COL_COUNT,
  cooldown,
  countDomNodes,
  fetchPackageVersion,
  generateColumns,
  generateRows,
  injectCss,
  injectScript,
  measureAvg,
  measureVisual,
  nextFrame,
  shuffleRows,
} from './shared.js';
import type { CompetitorAdapter, MetricName } from './types.js';

/** Minimal subset of Tabulator's instance API we use here. */
interface TabulatorInstance {
  setSort(sorters: Array<{ column: string; dir: 'asc' | 'desc' }>): void;
  clearSort(): void;
  setFilter(field: string, type: string, value: unknown): void;
  clearFilter(includeHeaderFilters: boolean): void;
  replaceData(rows: unknown[]): Promise<void>;
  updateRow(id: string | number, patch: Record<string, unknown>): Promise<boolean>;
  getColumn(field: string): { setWidth(width: number): boolean } | false;
  scrollToRow(id: string | number, position: 'top' | 'center' | 'bottom', ifVisible: boolean): Promise<void>;
  destroy(): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler?: (...args: unknown[]) => void): void;
}
type TabulatorCtor = new (selector: HTMLElement | string, options: Record<string, unknown>) => TabulatorInstance;

function getTabulator(): TabulatorCtor {
  const T = (window as unknown as { Tabulator?: TabulatorCtor }).Tabulator;
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
  "    { title: 'ID', field: 'id', width: 80, sorter: 'number',",
  "      headerFilter: 'number' },",
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

    gridArea.innerHTML = '<div id="compare-tbl-grid" style="width:100%;height:100%;"></div>';
    const container = document.getElementById('compare-tbl-grid')!;
    await cooldown(100);

    const tblColumns = columns.map((c) => ({
      title: c.header,
      field: c.field,
      width: c.width,
      sorter: c.field === 'id' ? 'number' : 'string',
      headerFilter: c.field === 'id' ? 'number' : true,
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
    let table: TabulatorInstance | null = null;
    const renderTime = await measureVisual(
      () =>
        new Promise<void>((resolve) => {
          let resolved = false;
          const built = () => {
            if (resolved) return;
            resolved = true;
            resolve();
          };
          table = new Tabulator(container, { ...baseOptions, data: rows });
          table.on('tableBuilt', built);
          // Safety: never block forever.
          setTimeout(built, 30_000);
        }),
    );
    results.set('Time to first paint', renderTime);
    await cooldown(200);
    results.set('DOM nodes', countDomNodes(gridArea));
    if (!table) throw new Error('Tabulator did not initialize');
    const t = table as TabulatorInstance;

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
      async () => {
        await t.replaceData(shuffleRows([...rows]));
        await nextFrame();
        await nextFrame();
        return measureVisual(() => {
          t.setSort([{ column: 'id', dir: 'desc' }]);
        });
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
        () =>
          measureVisual(() => {
            t.setFilter('id', '>', threshold);
          }),
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
    const replaceTime = await measureAvg(() => {
      const fresh = generateRows(rowCount, COL_COUNT);
      return measureVisual(async () => {
        await t.replaceData(fresh);
      });
    });
    results.set('Data replacement', replaceTime);
    await cooldown(50);

    // Update single row
    {
      const midId = Math.floor(rowCount / 2) + 1;
      let updateCounter = 0;
      const updateTime = await measureAvg(() =>
        measureVisual(async () => {
          await t.updateRow(midId, { col1: `UPDATED${++updateCounter}` });
        }),
      );
      results.set('Update single row', updateTime);
      await cooldown(50);
    }

    // Column resize
    {
      const idColumn = t.getColumn('id');
      if (idColumn) {
        let wide = true;
        const resizeTime = await measureAvg(() =>
          measureVisual(() => {
            idColumn.setWidth(wide ? 200 : 80);
            wide = !wide;
          }),
        );
        results.set('Column resize', resizeTime);
        await cooldown(50);
      }
    }

    // Scroll to end
    {
      const lastId = rowCount;
      const scrollEndTime = await measureAvg(
        () =>
          measureVisual(async () => {
            await t.scrollToRow(lastId, 'bottom', false);
          }),
        async () => {
          await t.scrollToRow(1, 'top', false);
        },
      );
      results.set('Scroll to end', scrollEndTime);
      await cooldown(50);
    }

    // Destroy — fresh instance
    {
      gridArea.innerHTML +=
        '<div id="compare-tbl-destroy" style="width:100%;height:100%;position:absolute;top:0;left:0;right:0;bottom:0;"></div>';
      const destroyContainer = document.getElementById('compare-tbl-destroy')!;
      const freshRows = generateRows(rowCount, COL_COUNT);
      const destroyTable = await new Promise<TabulatorInstance>((resolve) => {
        let resolved = false;
        const built = () => {
          if (resolved) return;
          resolved = true;
          resolve(instance);
        };
        const instance = new Tabulator(destroyContainer, { ...baseOptions, data: freshRows });
        instance.on('tableBuilt', built);
        setTimeout(built, 30_000);
      });
      await nextFrame();
      await nextFrame();
      await cooldown(100);

      const destroyTime = await measureVisual(() => {
        destroyTable.destroy();
      });
      results.set('Grid destroy', destroyTime);
      destroyContainer.remove();
      await cooldown(50);
    }

    // Memory was measured around the initial render (see above).

    t.destroy();
    gridArea.innerHTML = '';
    await cooldown(300);

    return results;
  },
};
