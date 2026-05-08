// Toolbox Grid baseline adapter. Always loaded; runs first at every scale.

import '@toolbox-web/grid';
import type { ColumnConfig } from '@toolbox-web/grid';
import { queryGrid } from '@toolbox-web/grid';
import '@toolbox-web/grid/features/column-virtualization';
import '@toolbox-web/grid/features/filtering';

import {
  COL_COUNT,
  cooldown,
  countDomNodes,
  generateColumns,
  generateRows,
  measureAvg,
  measureVisual,
  nextFrame,
  shuffleRows,
} from './shared.js';
import type { CompetitorAdapter, MetricName } from './types.js';

const TOOLBOX_CONFIG_CODE = [
  'grid.gridConfig = {',
  '  columns: [',
  "    { field: 'id', header: 'ID', width: 80, type: 'number', sortable: true },",
  '    // ... 9 more columns, width: 120, sortable: true',
  '  ],',
  "  fitMode: 'fixed',",
  '  getRowId: (row) => String(row.id),',
  '  features: { filtering: true },',
  '};',
  'grid.rows = data; // 5K → 1M rows',
  '',
  "grid.sort('id', 'desc');  // programmatic sort",
  'grid.sort(null);          // clear sort',
].join('\n');

export const toolboxAdapter: CompetitorAdapter = {
  id: 'toolbox',
  name: 'Toolbox Grid',
  shortLabel: 'TBW',
  color: '#38bdf8',
  url: 'https://toolboxjs.com/grid/',
  configCode: TOOLBOX_CONFIG_CODE,
  version: '',
  async load() {
    // Already imported at module top — nothing else to do.
  },
  async runAtScale(gridArea: HTMLElement, rowCount: number): Promise<Map<MetricName, number>> {
    const results = new Map<MetricName, number>();
    const columns = generateColumns(COL_COUNT);
    const rows = generateRows(rowCount, COL_COUNT);

    // DOM node count after first paint settles. Deterministic, exact —
    // see `countDomNodes` doc for rationale.

    gridArea.innerHTML = '<tbw-grid id="compare-tbw-grid" style="width:100%;height:100%;"></tbw-grid>';
    const grid = queryGrid('#compare-tbw-grid')!;
    await cooldown(100);

    const tbwColumns: ColumnConfig[] = columns.map((c) => ({
      field: c.field,
      header: c.header,
      width: c.width,
      type: c.field === 'id' ? 'number' : 'string',
      sortable: true,
    }));

    // Initial render
    const renderTime = await measureVisual(() => {
      grid.gridConfig = {
        columns: tbwColumns,
        fitMode: 'fixed',
        getRowId: (row) => String((row as { id: number }).id),
        features: { filtering: true },
      };
      grid.rows = rows;
    });
    results.set('Time to first paint', renderTime);
    await cooldown(200);
    results.set('DOM nodes', countDomNodes(gridArea));

    // Warmup scroll once so later operations start from a consistent
    // state. The per-frame timing was removed — it always pinned to the
    // ~16 ms vsync floor on every grid and produced no comparison signal.
    const scrollContainer = grid.querySelector('.faux-vscroll');
    if (scrollContainer) {
      const totalHeight = scrollContainer.scrollHeight;
      const viewportHeight = scrollContainer.clientHeight;
      const steps = 30;
      const stepSize = (totalHeight - viewportHeight) / steps;
      if (stepSize > 0) {
        for (let i = 0; i <= steps; i++) {
          scrollContainer.scrollTop = i * stepSize;
          await nextFrame();
        }
        scrollContainer.scrollTop = 0;
        await cooldown(50);
      }
    }

    // Sort — shuffle data first so we measure real O(n log n)
    const sortTime = await measureAvg(
      async () => {
        grid.rows = shuffleRows([...rows]);
        await nextFrame();
        await nextFrame();
        return measureVisual(() => {
          grid.sort?.('id', 'desc');
        });
      },
      () => {
        grid.sort?.(null);
      },
    );
    results.set('Sort', sortTime);
    await cooldown(50);

    // Filter
    const filterPlugin = grid.getPluginByName?.('filtering');
    if (filterPlugin) {
      const threshold = Math.floor(rowCount / 2);
      const filterTime = await measureAvg(
        () =>
          measureVisual(() => {
            filterPlugin.setFilterModel([{ field: 'id', type: 'number', operator: 'greaterThan', value: threshold }]);
          }),
        async () => {
          filterPlugin.clearAllFilters();
          await grid.forceLayout?.();
        },
      );
      results.set('Filter', filterTime);
      filterPlugin.clearAllFilters();
      await grid.forceLayout?.();
      await cooldown(50);
    }

    // Data replacement
    const replaceTime = await measureAvg(() => {
      const fresh = generateRows(rowCount, COL_COUNT);
      return measureVisual(() => {
        grid.rows = fresh;
      });
    });
    results.set('Data replacement', replaceTime);
    await cooldown(50);

    // Update single row
    if (grid.updateRow) {
      let updateCounter = 0;
      const updateTime = await measureAvg(() =>
        measureVisual(() => {
          grid.updateRow!(String(Math.floor(rowCount / 2) + 1), {
            col1: `UPDATED${++updateCounter}`,
          });
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
          const state = grid.getColumnState?.();
          if (state?.columns?.[0]) {
            state.columns[0].width = wide ? 200 : 80;
            wide = !wide;
            grid.applyColumnState(state);
          }
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
            grid.scrollToRow?.(rowCount - 1, { align: 'end' });
          }),
        () => {
          grid.scrollToRow?.(0, { align: 'start' });
        },
      );
      results.set('Scroll to end', scrollEndTime);
      await cooldown(50);
    }

    // Grid destroy — fresh instance just for this measurement
    {
      gridArea.innerHTML = '<tbw-grid id="compare-tbw-destroy" style="width:100%;height:100%;"></tbw-grid>';
      const destroyGrid = queryGrid('#compare-tbw-destroy')!;
      destroyGrid.gridConfig = {
        columns: tbwColumns,
        fitMode: 'fixed',
        getRowId: (row) => String((row as { id: number }).id),
      };
      destroyGrid.rows = rows;
      await nextFrame();
      await nextFrame();
      await cooldown(100);

      const destroyTime = await measureVisual(() => {
        destroyGrid.remove();
      });
      results.set('Grid destroy', destroyTime);
      gridArea.innerHTML = '';
      await cooldown(50);
    }

    // Cleanup
    grid.rows = [];
    grid.gridConfig = { columns: [] };
    gridArea.innerHTML = '';
    await cooldown(300);

    return results;
  },
};
