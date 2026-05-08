// AG Grid Community adapter — loaded from CDN at first use.

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

interface AgGridApi {
  setGridOption(option: string, value: unknown): void;
  applyColumnState(opts: unknown): void;
  setFilterModel(model: unknown): void;
  applyTransaction(tx: unknown): void;
  ensureIndexVisible(index: number, position?: string): void;
  destroy(): void;
}
interface AgGridGlobal {
  createGrid(container: HTMLElement, options: unknown): AgGridApi;
}
function getAgGrid(): AgGridGlobal {
  const ag = (window as unknown as { agGrid?: AgGridGlobal }).agGrid;
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
    // for rationale (replaces the old `performance.memory` byte metric).

    gridArea.innerHTML = '<div id="compare-ag-grid" class="ag-theme-quartz" style="width:100%;height:100%;"></div>';
    const container = document.getElementById('compare-ag-grid')!;
    await cooldown(100);

    const agColumnDefs = columns.map((c) => ({
      field: c.field,
      headerName: c.header,
      width: c.width,
      sortable: true,
      filter: c.field === 'id' ? 'agNumberColumnFilter' : true,
    }));

    let gridApi: AgGridApi | undefined;
    const renderTime = await measureVisual(() => {
      gridApi = agGrid.createGrid(container, {
        columnDefs: agColumnDefs,
        rowData: rows,
        suppressColumnVirtualisation: false,
        animateRows: false,
        getRowId: (params: { data: { id: number } }) => String(params.data.id),
      });
    });
    results.set('Time to first paint', renderTime);
    await cooldown(200);
    results.set('DOM nodes', countDomNodes(gridArea));
    if (!gridApi) throw new Error('AG Grid createGrid did not return an api');
    const api = gridApi;

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
      async () => {
        const shuffled = shuffleRows([...rows]);
        api.setGridOption('rowData', shuffled);
        await nextFrame();
        await nextFrame();
        return measureVisual(() => {
          api.applyColumnState({ state: [{ colId: 'id', sort: 'desc' }] });
        });
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
        () =>
          measureVisual(() => {
            api.setFilterModel({
              id: { filterType: 'number', type: 'greaterThan', filter: threshold },
            });
          }),
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
    const replaceTime = await measureAvg(() => {
      const fresh = generateRows(rowCount, COL_COUNT);
      return measureVisual(() => {
        api.setGridOption('rowData', fresh);
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
          api.applyTransaction({ update: [{ id: midId, col1: `UPDATED${++updateCounter}` }] });
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
          api.applyColumnState({ state: [{ colId: 'id', width: wide ? 200 : 80 }] });
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
            api.ensureIndexVisible(rowCount - 1, 'bottom');
          }),
        () => {
          api.ensureIndexVisible(0, 'top');
        },
      );
      results.set('Scroll to end', scrollEndTime);
      await cooldown(50);
    }

    // Destroy — fresh instance
    {
      gridArea.innerHTML +=
        '<div id="compare-ag-destroy" class="ag-theme-quartz" style="width:100%;height:100%;position:absolute;top:0;left:0;right:0;bottom:0;"></div>';
      const destroyContainer = document.getElementById('compare-ag-destroy')!;
      const freshRows = generateRows(rowCount, COL_COUNT);
      const destroyApi = agGrid.createGrid(destroyContainer, {
        columnDefs: agColumnDefs,
        rowData: freshRows,
        suppressColumnVirtualisation: false,
        animateRows: false,
        getRowId: (params: { data: { id: number } }) => String(params.data.id),
      });
      await nextFrame();
      await nextFrame();
      await cooldown(100);

      const destroyTime = await measureVisual(() => {
        destroyApi.destroy();
      });
      results.set('Grid destroy', destroyTime);
      destroyContainer.remove();
      await cooldown(50);
    }

    // Memory was measured around the initial render (see above).

    api.destroy();
    gridArea.innerHTML = '';
    await cooldown(300);

    return results;
  },
};
