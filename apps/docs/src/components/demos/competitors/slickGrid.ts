// SlickGrid (legacy `slickgrid` v2 fork by 6pac) adapter — loaded from CDN
// at first use. Needs jQuery + several slick.* files. Virtualized.
//
// We pin to v2.4.x because v3+ removed the global `Slick` namespace and
// requires ESM-style imports that don't work via plain `<script>` tags.

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
  const s = (window as unknown as { Slick?: SlickNamespace }).Slick;
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

    gridArea.innerHTML = '<div id="compare-slick-host" style="width:100%;height:100%;"></div>';
    const host = document.getElementById('compare-slick-host')!;
    await cooldown(100);

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

    let grid: SlickGridInstance | null = null;
    let dataView: SlickDataView | null = null;
    const renderTime = await measureVisual(() => {
      dataView = new Slick.Data.DataView();
      grid = new Slick.Grid(host, dataView, slickColumns, baseOptions);
      // SlickGrid + DataView is decoupled by design: the grid does NOT
      // automatically observe the dataView. Without these subscriptions
      // setItems() updates the DataView but the grid renders nothing,
      // making every benchmark measure an empty grid.
      dataView.onRowCountChanged.subscribe(() => {
        grid!.updateRowCount();
        grid!.render();
      });
      dataView.onRowsChanged.subscribe((_e, args) => {
        grid!.invalidateRows(args.rows);
        grid!.render();
      });
      dataView.setItems(rows, 'id');
      // SlickGrid caches viewport dimensions at construction time. When the
      // host element was just inserted via innerHTML it can be 0×0 for one
      // frame, leaving the viewport blank even after setItems(). Force a
      // resize + full invalidation so rows actually paint.
      grid.resizeCanvas();
      grid.invalidateAllRows();
      grid.render();
    });
    results.set('Time to first paint', renderTime);
    await cooldown(200);
    results.set('DOM nodes', countDomNodes(gridArea));
    if (!grid || !dataView) throw new Error('SlickGrid did not initialize');
    const g = grid as SlickGridInstance;
    const dv = dataView as SlickDataView;

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
      async () => {
        dv.setItems(shuffleRows([...rows]), 'id');
        await nextFrame();
        await nextFrame();
        return measureVisual(() => {
          dv.sort((a, b) => (b.id as number) - (a.id as number), false);
        });
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
        () =>
          measureVisual(() => {
            dv.setFilter((item) => (item.id as number) > threshold);
            dv.refresh();
          }),
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
    const replaceTime = await measureAvg(() => {
      const fresh = generateRows(rowCount, COL_COUNT);
      return measureVisual(() => {
        dv.setItems(fresh, 'id');
      });
    });
    results.set('Data replacement', replaceTime);
    await cooldown(50);

    // Update single row
    {
      const midId = Math.floor(rowCount / 2) + 1;
      let updateCounter = 0;
      const updateTime = await measureAvg(() =>
        measureVisual(() => {
          const items = dv.getItems();
          const idx = items.findIndex((r) => r.id === midId);
          if (idx >= 0) {
            const item = { ...items[idx], col1: `UPDATED${++updateCounter}` };
            dv.updateItem(midId, item);
          }
        }),
      );
      results.set('Update single row', updateTime);
      await cooldown(50);
    }

    // Column resize
    {
      let wide = true;
      const resizeTime = await measureAvg(() =>
        measureVisual(() => {
          const cols = g.getColumns();
          cols[0] = { ...cols[0], width: wide ? 200 : 80 };
          g.setColumns(cols);
          wide = !wide;
        }),
      );
      results.set('Column resize', resizeTime);
      await cooldown(50);
    }

    // Scroll to end
    {
      const scrollEndTime = await measureAvg(
        () =>
          measureVisual(() => {
            g.scrollRowIntoView(rowCount - 1, false);
          }),
        () => {
          g.scrollRowToTop(0);
        },
      );
      results.set('Scroll to end', scrollEndTime);
      await cooldown(50);
    }

    // Destroy — fresh instance.
    {
      gridArea.innerHTML +=
        '<div id="compare-slick-destroy" style="width:100%;height:100%;position:absolute;top:0;left:0;right:0;bottom:0;"></div>';
      const destroyContainer = document.getElementById('compare-slick-destroy')!;
      const freshRows = generateRows(rowCount, COL_COUNT);
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
      destroyDataView.setItems(freshRows, 'id');
      destroyGrid.resizeCanvas();
      destroyGrid.invalidateAllRows();
      destroyGrid.render();
      await nextFrame();
      await nextFrame();
      await cooldown(100);

      const destroyTime = await measureVisual(() => {
        destroyGrid.destroy();
      });
      results.set('Grid destroy', destroyTime);
      destroyContainer.remove();
      await cooldown(50);
    }

    // Memory was measured around the initial render (see above).

    g.destroy();
    gridArea.innerHTML = '';
    await cooldown(300);

    return results;
  },
};
