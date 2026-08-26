// SlickGrid (legacy `slickgrid` v2 fork by 6pac) adapter — loaded from CDN
// at first use. Needs jQuery + several slick.* files. Virtualized.
//
// We pin to v2.4.x because v3+ removed the global `Slick` namespace and
// requires ESM-style imports that don't work via plain `<script>` tags.

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

interface SlickColumn {
  id: string;
  name: string;
  field: string;
  width: number;
  sortable: boolean;
}
interface SlickGridInstance {
  setColumns(cols: SlickColumn[]): void;
  getColumns(): SlickColumn[];
  scrollRowIntoView(row: number, doPaging?: boolean): void;
  scrollRowToTop(row: number): void;
  getViewport(): { top: number; bottom: number };
  invalidateAllRows(): void;
  invalidateRows(rows: number[]): void;
  render(): void;
  updateRowCount(): void;
  resizeCanvas(): void;
  destroy(): void;
}
interface SlickEvent<T> {
  subscribe(handler: (e: unknown, args: T) => void): void;
}
interface SlickDataView {
  setItems(items: BenchmarkRow[], idProperty?: string): void;
  getItems(): BenchmarkRow[];
  getLength(): number;
  getItem(index: number): BenchmarkRow | undefined;
  getItemById(id: string | number): BenchmarkRow | undefined;
  sort(comparer: (a: BenchmarkRow, b: BenchmarkRow) => number, ascending?: boolean): void;
  setFilter(fn: ((item: BenchmarkRow) => boolean) | null): void;
  refresh(): void;
  updateItem(id: string | number, item: BenchmarkRow): void;
  onRowCountChanged: SlickEvent<{ previous: number; current: number }>;
  onRowsChanged: SlickEvent<{ rows: number[] }>;
}
interface SlickNamespace {
  Grid: new (
    container: HTMLElement | string,
    data: unknown,
    columns: SlickColumn[],
    options: Record<string, unknown>,
  ) => SlickGridInstance;
  Data: { DataView: new (options?: Record<string, unknown>) => SlickDataView };
}
function getSlick(): SlickNamespace {
  const s = (window as Window & { Slick?: SlickNamespace }).Slick;
  if (!s) throw new Error('SlickGrid not loaded');
  return s;
}

const SLICK_VERSION = '2.4.45';
const JQUERY_VERSION = '3.7.1';

const SLICK_CONFIG_CODE = [
  'const dataView = new Slick.Data.DataView();',
  'const grid = new Slick.Grid(container, dataView, columns, {',
  '  enableColumnReorder: false,',
  '  enableCellNavigation: true,',
  '  forceFitColumns: false,',
  '  rowHeight: 32,',
  '  forceSyncScrolling: true, // render rows during fast scroll',
  '});',
  '// REQUIRED: subscribe the grid to dataView events, otherwise the',
  '// grid stays empty when setItems() is called.',
  'dataView.onRowCountChanged.subscribe(() => {',
  '  grid.updateRowCount(); grid.render();',
  '});',
  'dataView.onRowsChanged.subscribe((_, args) => {',
  '  grid.invalidateRows(args.rows); grid.render();',
  '});',
  'dataView.setItems(rows, "id"); // 5K → 1M rows',
  '',
  '// Sort: dataView.sort((a, b) => b.id - a.id, false)',
  '// Filter: dataView.setFilter(item => item.id > N); dataView.refresh();',
  '// Update: dataView.updateItem(id, { ...item, col1: "..." });',
].join('\n');

let loaded = false;

export const slickGridAdapter: CompetitorAdapter = {
  id: 'slickgrid',
  name: 'SlickGrid (v2)',
  shortLabel: 'SLK',
  color: '#34d399',
  url: 'https://github.com/6pac/SlickGrid',
  description: `Loaded from CDN. Pinned to v${SLICK_VERSION} (last release with global \`Slick\`). Requires jQuery v${JQUERY_VERSION}.`,
  configCode: SLICK_CONFIG_CODE,
  version: SLICK_VERSION,
  async load() {
    if (loaded) return;
    this.version = (await fetchPackageVersion('slickgrid')) || SLICK_VERSION;
    injectCss(`https://cdn.jsdelivr.net/npm/slickgrid@${SLICK_VERSION}/slick.grid.css`);
    // Load order matters. SlickGrid v2 hard-requires `jquery.event.drag` at
    // module load time (the check fires from `slick.grid.js` itself, even if
    // column reorder / row drag are disabled). The npm package for
    // `jquery.event.drag` doesn't ship a usable CDN file path, so we pull
    // SlickGrid's own bundled copy from its GitHub release tag via jsDelivr.
    await injectScript(`https://cdn.jsdelivr.net/npm/jquery@${JQUERY_VERSION}/dist/jquery.min.js`);
    await injectScript(`https://cdn.jsdelivr.net/gh/6pac/SlickGrid@${SLICK_VERSION}/lib/jquery.event.drag-2.3.0.js`);
    await injectScript(`https://cdn.jsdelivr.net/npm/slickgrid@${SLICK_VERSION}/slick.core.min.js`);
    await injectScript(`https://cdn.jsdelivr.net/npm/slickgrid@${SLICK_VERSION}/slick.dataview.min.js`);
    await injectScript(`https://cdn.jsdelivr.net/npm/slickgrid@${SLICK_VERSION}/slick.grid.min.js`);
    loaded = true;
  },
  async runAtScale(gridArea: HTMLElement, rowCount: number): Promise<Map<MetricName, number>> {
    const results = new Map<MetricName, number>();
    const Slick = getSlick();
    const columns = generateColumns(COL_COUNT);
    const rows = generateRows(rowCount, COL_COUNT);

    // DOM node count after first paint. See toolbox.ts for rationale.

    const slickColumns: SlickColumn[] = columns.map((c) => ({
      id: c.field,
      name: c.header,
      field: c.field,
      width: c.width,
      sortable: true,
    }));

    const baseOptions = {
      enableColumnReorder: false,
      enableCellNavigation: true,
      forceFitColumns: false,
      rowHeight: 32,
      // SlickGrid defers row rendering during fast scrolling by default,
      // which leaves visible blank stripes until the scroll settles. The
      // other competitors render synchronously, so flip this on for a
      // fair comparison (and so the grid actually shows rows mid-scroll).
      forceSyncScrolling: true,
    };

    const initialRender = await measureRetained(
      async () => {
        let grid: SlickGridInstance | null = null;
        let dataView: SlickDataView | null = null;
        let host: HTMLElement | null = null;
        const duration = await measureVisual(() => {
          gridArea.innerHTML = '<div id="compare-slick-host" style="width:100%;height:100%;"></div>';
          host = document.getElementById('compare-slick-host');
          dataView = new Slick.Data.DataView();
          grid = new Slick.Grid(host!, dataView, slickColumns, baseOptions);
          dataView.onRowCountChanged.subscribe(() => {
            grid!.updateRowCount();
            grid!.render();
          });
          dataView.onRowsChanged.subscribe((_e, args) => {
            grid!.invalidateRows(args.rows);
            grid!.render();
          });
          dataView.setItems(rows, 'id');
          grid.resizeCanvas();
          grid.invalidateAllRows();
          grid.render();
        });
        if (!grid || !dataView || !host) throw new Error('SlickGrid did not initialize');
        assertBenchmark(
          'SlickGrid',
          'Cold mount to painted viewport',
          rowCount,
          dataView.getLength() === rowCount && host.querySelector('.slick-row') !== null,
          `expected ${rowCount} modeled rows and at least one painted row, got ${dataView.getLength()} rows`,
        );
        return { duration, value: { grid, dataView, host } };
      },
      ({ grid, host }) => {
        grid.destroy();
        host.remove();
        gridArea.innerHTML = '';
      },
    );
    results.set('Cold mount to painted viewport', initialRender.duration);
    await cooldown(200);
    results.set('DOM nodes', countDomNodes(gridArea));
    const { grid: g, dataView: dv, host } = initialRender.value;

    // Warmup scroll — timed per-frame metric removed (vsync floor).
    const slickScrollViewport = host.querySelector('.slick-viewport') as HTMLElement | null;
    if (slickScrollViewport) {
      const totalHeight = slickScrollViewport.scrollHeight;
      const viewportHeight = slickScrollViewport.clientHeight;
      const steps = 30;
      const stepSize = (totalHeight - viewportHeight) / steps;
      if (stepSize > 0) {
        for (let i = 0; i <= steps; i++) {
          slickScrollViewport.scrollTop = i * stepSize;
          await nextFrame();
        }
        slickScrollViewport.scrollTop = 0;
        await cooldown(50);
      }
    }

    // Sort
    const sortTime = await measureAvg(
      async (iteration) => {
        dv.setItems(shuffleRows([...rows], rowCount * 31 + iteration), 'id');
        await nextFrame();
        await nextFrame();
        const duration = await measureVisual(() => {
          dv.sort((a, b) => (b.id as number) - (a.id as number), false);
        });
        assertBenchmark(
          'SlickGrid',
          'Sort',
          rowCount,
          dv.getItem(0)?.id === rowCount && dv.getItem(rowCount - 1)?.id === 1,
          `expected descending ids ${rowCount}..1, got ${dv.getItem(0)?.id}..${dv.getItem(rowCount - 1)?.id}`,
        );
        return duration;
      },
      () => {
        dv.sort((a, b) => (a.id as number) - (b.id as number), true);
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
            dv.setFilter((item) => (item.id as number) > threshold);
            dv.refresh();
          });
          assertBenchmark(
            'SlickGrid',
            'Filter',
            rowCount,
            dv.getLength() === rowCount - threshold &&
              dv.getItem(0)!.id > threshold &&
              dv.getItem(dv.getLength() - 1)!.id > threshold,
            `expected ${rowCount - threshold} rows with id > ${threshold}, got ${dv.getLength()}`,
          );
          return duration;
        },
        async () => {
          dv.setFilter(null);
          dv.refresh();
          await nextFrame();
        },
      );
      results.set('Filter', filterTime);
      dv.setFilter(null);
      dv.refresh();
      await nextFrame();
      await cooldown(50);
    }

    // Data replacement
    const replaceTime = await measureAvg(async () => {
      const fresh = markReplacement(generateRows(rowCount, COL_COUNT));
      const duration = await measureVisual(() => {
        dv.setItems(fresh, 'id');
      });
      assertBenchmark(
        'SlickGrid',
        'Replace data to painted viewport',
        rowCount,
        dv.getLength() === rowCount &&
          dv.getItem(0)?.col1 === REPLACEMENT_MARKER &&
          host.textContent?.includes(REPLACEMENT_MARKER) === true,
        `expected ${rowCount} replacement rows and visible marker ${REPLACEMENT_MARKER}`,
      );
      return duration;
    });
    results.set('Replace data to painted viewport', replaceTime);
    await cooldown(50);

    // Update single row
    {
      const midId = Math.floor(rowCount / 2) + 1;
      // Generated rows have sequential ids 1..rowCount, so the row with id=midId
      // sits at index midId - 1. Avoids an O(n) `findIndex` across 1M rows on
      // every benchmark iteration.
      const items = dv.getItems();
      let updateCounter = 0;
      const updateTime = await measureAvg(async () => {
        const expected = `UPDATED${++updateCounter}`;
        const duration = await measureVisual(() => {
          const idx = midId - 1;
          if (items[idx]?.id === midId) {
            const item = { ...items[idx], col1: expected };
            dv.updateItem(midId, item);
          }
        });
        assertBenchmark(
          'SlickGrid',
          'Update single row',
          rowCount,
          dv.getItemById(midId)?.col1 === expected,
          `expected row ${midId} col1 to equal ${expected}`,
        );
        return duration;
      });
      results.set('Update single row', updateTime);
      await cooldown(50);
    }

    // Column resize
    {
      let wide = true;
      const resizeTime = await measureAvg(async () => {
        const expectedWidth = wide ? 200 : 80;
        const duration = await measureVisual(() => {
          const cols = g.getColumns();
          cols[0] = { ...cols[0], width: expectedWidth };
          g.setColumns(cols);
          wide = !wide;
        });
        assertBenchmark(
          'SlickGrid',
          'Column resize',
          rowCount,
          g.getColumns()[0]?.width === expectedWidth,
          `expected first column width ${expectedWidth}, got ${g.getColumns()[0]?.width}`,
        );
        return duration;
      });
      results.set('Column resize', resizeTime);
      await cooldown(50);
    }

    // Scroll to end
    {
      const scrollEndTime = await measureAvg(
        async () => {
          const duration = await measureVisual(() => {
            g.scrollRowIntoView(rowCount - 1, false);
          });
          const viewport = g.getViewport();
          assertBenchmark(
            'SlickGrid',
            'Scroll to end',
            rowCount,
            viewport.bottom === rowCount - 1,
            `expected viewport bottom ${rowCount - 1}, got ${viewport.bottom}`,
          );
          return duration;
        },
        () => {
          g.scrollRowToTop(0);
        },
      );
      results.set('Scroll to end', scrollEndTime);
      await cooldown(50);
    }

    // Destroy — a fresh mounted instance per iteration.
    {
      const destroyTime = await measureAvg(async () => {
        gridArea.innerHTML = '<div id="compare-slick-destroy" style="width:100%;height:100%;"></div>';
        const destroyContainer = document.getElementById('compare-slick-destroy')!;
        const destroyDataView = new Slick.Data.DataView();
        const destroyGrid = new Slick.Grid(destroyContainer, destroyDataView, slickColumns, baseOptions);
        destroyDataView.onRowCountChanged.subscribe(() => {
          destroyGrid.updateRowCount();
          destroyGrid.render();
        });
        destroyDataView.onRowsChanged.subscribe((_e, args) => {
          destroyGrid.invalidateRows(args.rows);
          destroyGrid.render();
        });
        destroyDataView.setItems(rows, 'id');
        destroyGrid.resizeCanvas();
        destroyGrid.invalidateAllRows();
        destroyGrid.render();
        await nextFrame();
        await cooldown(30);

        const duration = await measureVisual(() => {
          destroyGrid.destroy();
          destroyContainer.remove();
        });
        assertBenchmark(
          'SlickGrid',
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

    g.destroy();
    host.remove();
    gridArea.innerHTML = '';
    await cooldown(300);

    return results;
  },
};
