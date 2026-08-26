// Toolbox Grid baseline adapter. Always loaded; runs first at every scale.

import '@toolbox-web/grid';
import type { ColumnConfig } from '@toolbox-web/grid';
import { queryGrid } from '@toolbox-web/grid';
import '@toolbox-web/grid/features/column-virtualization';
import '@toolbox-web/grid/features/filtering';

import {
  COL_COUNT,
  REPLACEMENT_MARKER,
  assertBenchmark,
  cooldown,
  countDomNodes,
  generateColumns,
  generateRows,
  markReplacement,
  measureAvg,
  measureRetained,
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

    const tbwColumns: ColumnConfig[] = columns.map((c) => ({
      field: c.field,
      header: c.header,
      width: c.width,
      type: c.field === 'id' ? 'number' : 'string',
      sortable: true,
    }));

    // Initial render
    const initialRender = await measureRetained(
      async () => {
        let createdGrid: ReturnType<typeof queryGrid>;
        const duration = await measureVisual(() => {
          gridArea.innerHTML = '<tbw-grid id="compare-tbw-grid" style="width:100%;height:100%;"></tbw-grid>';
          createdGrid = queryGrid('#compare-tbw-grid');
          if (!createdGrid) throw new Error('Toolbox Grid did not initialize');
          createdGrid.gridConfig = {
            columns: tbwColumns,
            fitMode: 'fixed',
            getRowId: (row) => String((row as { id: number }).id),
            features: { filtering: true },
          };
          createdGrid.rows = rows;
        });
        if (!createdGrid!) throw new Error('Toolbox Grid did not initialize');
        assertBenchmark(
          'Toolbox Grid',
          'Cold mount to painted viewport',
          rowCount,
          createdGrid.rows.length === rowCount && createdGrid.querySelector('.data-grid-row .cell') !== null,
          `expected ${rowCount} modeled rows and at least one painted cell, got ${createdGrid.rows.length} rows`,
        );
        return { duration, value: createdGrid };
      },
      (instance) => {
        instance.remove();
        gridArea.innerHTML = '';
      },
    );
    const grid = initialRender.value;
    results.set('Cold mount to painted viewport', initialRender.duration);
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
      async (iteration) => {
        grid.rows = shuffleRows([...rows], rowCount * 31 + iteration);
        await nextFrame();
        await nextFrame();
        const duration = await measureVisual(() => {
          grid.sort?.('id', 'desc');
        });
        assertBenchmark(
          'Toolbox Grid',
          'Sort',
          rowCount,
          grid.rows[0]?.id === rowCount && grid.rows[rowCount - 1]?.id === 1,
          `expected descending ids ${rowCount}..1, got ${grid.rows[0]?.id}..${grid.rows[rowCount - 1]?.id}`,
        );
        return duration;
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
        async () => {
          const duration = await measureVisual(() => {
            filterPlugin.setFilterModel([{ field: 'id', type: 'number', operator: 'greaterThan', value: threshold }]);
          });
          assertBenchmark(
            'Toolbox Grid',
            'Filter',
            rowCount,
            grid.rows.length === rowCount - threshold && grid.rows.every((row) => row.id > threshold),
            `expected ${rowCount - threshold} rows with id > ${threshold}, got ${grid.rows.length}`,
          );
          return duration;
        },
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
    const replaceTime = await measureAvg(async () => {
      const fresh = markReplacement(generateRows(rowCount, COL_COUNT));
      const duration = await measureVisual(() => {
        grid.rows = fresh;
      });
      assertBenchmark(
        'Toolbox Grid',
        'Replace data to painted viewport',
        rowCount,
        grid.rows.length === rowCount &&
          grid.rows[0]?.col1 === REPLACEMENT_MARKER &&
          grid.textContent?.includes(REPLACEMENT_MARKER) === true,
        `expected ${rowCount} replacement rows and visible marker ${REPLACEMENT_MARKER}`,
      );
      return duration;
    });
    results.set('Replace data to painted viewport', replaceTime);
    await cooldown(50);

    // Update single row
    if (grid.updateRow) {
      let updateCounter = 0;
      const midId = Math.floor(rowCount / 2) + 1;
      const updateTime = await measureAvg(async () => {
        const expected = `UPDATED${++updateCounter}`;
        const duration = await measureVisual(() => {
          grid.updateRow!(String(Math.floor(rowCount / 2) + 1), {
            col1: expected,
          });
        });
        assertBenchmark(
          'Toolbox Grid',
          'Update single row',
          rowCount,
          grid.getRow?.(String(midId))?.col1 === expected,
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
          const state = grid.getColumnState?.();
          if (state?.columns?.[0]) {
            state.columns[0].width = expectedWidth;
            wide = !wide;
            grid.applyColumnState(state);
          }
        });
        assertBenchmark(
          'Toolbox Grid',
          'Column resize',
          rowCount,
          grid.getColumnState?.().columns[0]?.width === expectedWidth,
          `expected first column width ${expectedWidth}, got ${grid.getColumnState?.().columns[0]?.width}`,
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
            grid.scrollToRow?.(rowCount - 1, { align: 'end' });
          });
          const targetCell = grid.querySelector(`.cell[data-row="${rowCount - 1}"]`);
          assertBenchmark(
            'Toolbox Grid',
            'Scroll to end',
            rowCount,
            targetCell !== null,
            `expected row ${rowCount - 1} to be rendered`,
          );
          return duration;
        },
        () => {
          grid.scrollToRow?.(0, { align: 'start' });
        },
      );
      results.set('Scroll to end', scrollEndTime);
      await cooldown(50);
    }

    // Grid destroy — a fresh mounted instance per iteration
    {
      const destroyTime = await measureAvg(async () => {
        gridArea.innerHTML = '<tbw-grid id="compare-tbw-destroy" style="width:100%;height:100%;"></tbw-grid>';
        const destroyGrid = queryGrid('#compare-tbw-destroy');
        if (!destroyGrid) throw new Error('Toolbox Grid destroy fixture did not initialize');
        destroyGrid.gridConfig = {
          columns: tbwColumns,
          fitMode: 'fixed',
          getRowId: (row) => String((row as { id: number }).id),
        };
        destroyGrid.rows = rows;
        await nextFrame();
        await cooldown(30);

        const duration = await measureVisual(() => {
          destroyGrid.remove();
        });
        assertBenchmark(
          'Toolbox Grid',
          'Grid destroy',
          rowCount,
          !destroyGrid.isConnected,
          'expected benchmark grid host to be disconnected',
        );
        return duration;
      });
      results.set('Grid destroy', destroyTime);
      gridArea.innerHTML = '';
      await cooldown(50);
    }

    // Cleanup
    grid.remove();
    gridArea.innerHTML = '';
    await cooldown(300);

    return results;
  },
};
