// AG Grid Community adapter — loaded from CDN at first use.

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

interface AgGridApi {
  setGridOption(option: string, value: unknown): void;
  applyColumnState(opts: unknown): void;
  setFilterModel(model: unknown): void;
  applyTransaction(tx: unknown): void;
  ensureIndexVisible(index: number, position?: string): void;
  getDisplayedRowCount(): number;
  getDisplayedRowAtIndex(index: number): { data?: BenchmarkRow } | undefined;
  getLastDisplayedRowIndex(): number;
  getRowNode(id: string): { data?: BenchmarkRow } | undefined;
  getColumnState(): Array<{ colId: string; width?: number }>;
  destroy(): void;
}
interface AgGridGlobal {
  createGrid(container: HTMLElement, options: unknown): AgGridApi;
}
function getAgGrid(): AgGridGlobal {
  const ag = (window as Window & { agGrid?: AgGridGlobal }).agGrid;
  if (!ag) throw new Error('AG Grid not loaded');
  return ag;
}

const AG_CONFIG_CODE = [
  'agGrid.createGrid(container, {',
  '  columnDefs: [',
  "    { field: 'id', headerName: 'ID', width: 80, sortable: true,",
  "      filter: 'agNumberColumnFilter' },",
  '    // ... 9 more columns, width: 120, sortable: true, filter: true',
  '  ],',
  '  rowData: data, // 5K → 1M rows',
  '  getRowId: (params) => String(params.data.id),',
  "  theme: 'legacy', // adapter loads the legacy Quartz CSS files",
  '  suppressColumnVirtualisation: false,',
  '  animateRows: false,',
  '});',
  '',
  "api.applyColumnState({ state: [{ colId: 'id', sort: 'desc' }] });",
  'api.setFilterModel({ id: { filterType: "number", type: "greaterThan", filter: N } });',
].join('\n');

let loaded = false;

export const agGridAdapter: CompetitorAdapter = {
  id: 'ag-grid',
  name: 'AG Grid Community',
  shortLabel: 'AG',
  color: '#fb923c',
  url: 'https://www.ag-grid.com/',
  description: 'Loaded from CDN. Latest published version of ag-grid-community.',
  configCode: AG_CONFIG_CODE,
  version: '',
  async load() {
    if (loaded) return;
    this.version = await fetchPackageVersion('ag-grid-community');
    injectCss('https://cdn.jsdelivr.net/npm/ag-grid-community/styles/ag-grid.min.css');
    injectCss('https://cdn.jsdelivr.net/npm/ag-grid-community/styles/ag-theme-quartz.min.css');
    await injectScript('https://cdn.jsdelivr.net/npm/ag-grid-community/dist/ag-grid-community.min.js');
    loaded = true;
  },
  async runAtScale(gridArea: HTMLElement, rowCount: number): Promise<Map<MetricName, number>> {
    const results = new Map<MetricName, number>();
    const agGrid = getAgGrid();
    const columns = generateColumns(COL_COUNT);
    const rows = generateRows(rowCount, COL_COUNT);

    // DOM node count after first paint. See toolbox.ts / `countDomNodes`
    // for rationale.

    const agColumnDefs = columns.map((c) => ({
      field: c.field,
      headerName: c.header,
      width: c.width,
      sortable: true,
      filter: c.field === 'id' ? 'agNumberColumnFilter' : true,
    }));

    const initialRender = await measureRetained(
      async () => {
        let api: AgGridApi | undefined;
        let container: HTMLElement | undefined;
        const duration = await measureVisual(() => {
          gridArea.innerHTML =
            '<div id="compare-ag-grid" class="ag-theme-quartz" style="width:100%;height:100%;"></div>';
          container = document.getElementById('compare-ag-grid')!;
          api = agGrid.createGrid(container, {
            columnDefs: agColumnDefs,
            rowData: rows,
            theme: 'legacy',
            suppressColumnVirtualisation: false,
            animateRows: false,
            getRowId: (params: { data: { id: number } }) => String(params.data.id),
          });
        });
        if (!api || !container) throw new Error('AG Grid createGrid did not return an api');
        assertBenchmark(
          'AG Grid Community',
          'Cold mount to painted viewport',
          rowCount,
          api.getDisplayedRowCount() === rowCount && container.querySelector('.ag-row') !== null,
          `expected ${rowCount} modeled rows and at least one painted row, got ${api.getDisplayedRowCount()} rows`,
        );
        return { duration, value: { api, container } };
      },
      ({ api, container }) => {
        api.destroy();
        container.remove();
        gridArea.innerHTML = '';
      },
    );
    results.set('Cold mount to painted viewport', initialRender.duration);
    await cooldown(200);
    results.set('DOM nodes', countDomNodes(gridArea));
    const { api, container } = initialRender.value;

    // Warmup scroll — timed per-frame metric removed (vsync floor).
    const agScrollViewport = container.querySelector('.ag-body-viewport');
    if (agScrollViewport) {
      const totalHeight = agScrollViewport.scrollHeight;
      const viewportHeight = agScrollViewport.clientHeight;
      const steps = 30;
      const stepSize = (totalHeight - viewportHeight) / steps;
      if (stepSize > 0) {
        for (let i = 0; i <= steps; i++) {
          agScrollViewport.scrollTop = i * stepSize;
          await nextFrame();
        }
        agScrollViewport.scrollTop = 0;
        await cooldown(50);
      }
    }

    // Sort — shuffle first
    const sortTime = await measureAvg(
      async (iteration) => {
        const shuffled = shuffleRows([...rows], rowCount * 31 + iteration);
        api.setGridOption('rowData', shuffled);
        await nextFrame();
        await nextFrame();
        const duration = await measureVisual(() => {
          api.applyColumnState({ state: [{ colId: 'id', sort: 'desc' }] });
        });
        assertBenchmark(
          'AG Grid Community',
          'Sort',
          rowCount,
          api.getDisplayedRowAtIndex(0)?.data?.id === rowCount &&
            api.getDisplayedRowAtIndex(rowCount - 1)?.data?.id === 1,
          `expected descending ids ${rowCount}..1, got ${api.getDisplayedRowAtIndex(0)?.data?.id}..${api.getDisplayedRowAtIndex(rowCount - 1)?.data?.id}`,
        );
        return duration;
      },
      () => {
        api.applyColumnState({ defaultState: { sort: null } });
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
            api.setFilterModel({
              id: { filterType: 'number', type: 'greaterThan', filter: threshold },
            });
          });
          const firstFilteredId = api.getDisplayedRowAtIndex(0)?.data?.id;
          assertBenchmark(
            'AG Grid Community',
            'Filter',
            rowCount,
            api.getDisplayedRowCount() === rowCount - threshold &&
              firstFilteredId !== undefined &&
              firstFilteredId > threshold,
            `expected ${rowCount - threshold} rows with id > ${threshold}, got ${api.getDisplayedRowCount()}`,
          );
          return duration;
        },
        async () => {
          api.setFilterModel(null);
          await nextFrame();
        },
      );
      results.set('Filter', filterTime);
      api.setFilterModel(null);
      await nextFrame();
      await cooldown(50);
    }

    // Data replacement
    const replaceTime = await measureAvg(async () => {
      const fresh = markReplacement(generateRows(rowCount, COL_COUNT));
      const duration = await measureVisual(() => {
        api.setGridOption('rowData', fresh);
      });
      assertBenchmark(
        'AG Grid Community',
        'Replace data to painted viewport',
        rowCount,
        api.getDisplayedRowCount() === rowCount &&
          api.getDisplayedRowAtIndex(0)?.data?.col1 === REPLACEMENT_MARKER &&
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
        const duration = await measureVisual(() => {
          api.applyTransaction({ update: [{ ...rows[midId - 1], col1: expected }] });
        });
        assertBenchmark(
          'AG Grid Community',
          'Update single row',
          rowCount,
          api.getRowNode(String(midId))?.data?.col1 === expected,
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
          api.applyColumnState({ state: [{ colId: 'id', width: expectedWidth }] });
          wide = !wide;
        });
        const actualWidth = api.getColumnState().find((column) => column.colId === 'id')?.width;
        assertBenchmark(
          'AG Grid Community',
          'Column resize',
          rowCount,
          actualWidth === expectedWidth,
          `expected id column width ${expectedWidth}, got ${actualWidth}`,
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
            api.ensureIndexVisible(rowCount - 1, 'bottom');
          });
          assertBenchmark(
            'AG Grid Community',
            'Scroll to end',
            rowCount,
            api.getLastDisplayedRowIndex() === rowCount - 1,
            `expected last displayed row index ${rowCount - 1}, got ${api.getLastDisplayedRowIndex()}`,
          );
          return duration;
        },
        () => {
          api.ensureIndexVisible(0, 'top');
        },
      );
      results.set('Scroll to end', scrollEndTime);
      await cooldown(50);
    }

    // Destroy — a fresh mounted instance per iteration
    {
      const destroyTime = await measureAvg(async () => {
        gridArea.innerHTML =
          '<div id="compare-ag-destroy" class="ag-theme-quartz" style="width:100%;height:100%;"></div>';
        const destroyContainer = document.getElementById('compare-ag-destroy')!;
        const destroyApi = agGrid.createGrid(destroyContainer, {
          columnDefs: agColumnDefs,
          rowData: rows,
          theme: 'legacy',
          suppressColumnVirtualisation: false,
          animateRows: false,
          getRowId: (params: { data: { id: number } }) => String(params.data.id),
        });
        await nextFrame();
        await cooldown(30);

        const duration = await measureVisual(() => {
          destroyApi.destroy();
          destroyContainer.remove();
        });
        assertBenchmark(
          'AG Grid Community',
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

    api.destroy();
    container.remove();
    gridArea.innerHTML = '';
    await cooldown(300);

    return results;
  },
};
