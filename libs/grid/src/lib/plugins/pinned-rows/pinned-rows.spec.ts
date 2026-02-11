import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildContext,
  createAggregationContainer,
  createPinnedRowsElement,
  renderAggregationRows,
} from './pinned-rows';
import type { AggregationRowConfig, PinnedRowsConfig, PinnedRowsContext, PinnedRowsPanel } from './types';

describe('pinnedRows', () => {
  describe('createPinnedRowsElement', () => {
    let defaultContext: PinnedRowsContext;

    beforeEach(() => {
      defaultContext = {
        totalRows: 100,
        filteredRows: 100,
        selectedRows: 0,
        columns: [],
        rows: [],
        grid: document.createElement('div'),
      };
    });

    it('should create a status bar with role="presentation"', () => {
      const config: PinnedRowsConfig = {};
      const element = createPinnedRowsElement(config, defaultContext);

      expect(element.getAttribute('role')).toBe('presentation');
      expect(element.getAttribute('aria-live')).toBe('polite');
      expect(element.className).toBe('tbw-pinned-rows');
    });

    it('should show row count by default', () => {
      const config: PinnedRowsConfig = {};
      const element = createPinnedRowsElement(config, defaultContext);

      const rowCountPanel = element.querySelector('.tbw-status-panel-row-count');
      expect(rowCountPanel).not.toBeNull();
      expect(rowCountPanel?.textContent).toBe('Total: 100 rows');
    });

    it('should hide row count when showRowCount is false', () => {
      const config: PinnedRowsConfig = { showRowCount: false };
      const element = createPinnedRowsElement(config, defaultContext);

      const rowCountPanel = element.querySelector('.tbw-status-panel-row-count');
      expect(rowCountPanel).toBeNull();
    });

    it('should show filtered count when different from total', () => {
      const config: PinnedRowsConfig = { showFilteredCount: true };
      const context: PinnedRowsContext = { ...defaultContext, filteredRows: 50 };
      const element = createPinnedRowsElement(config, context);

      const filteredPanel = element.querySelector('.tbw-status-panel-filtered-count');
      expect(filteredPanel).not.toBeNull();
      expect(filteredPanel?.textContent).toBe('Filtered: 50');
    });

    it('should not show filtered count when equal to total', () => {
      const config: PinnedRowsConfig = { showFilteredCount: true };
      const element = createPinnedRowsElement(config, defaultContext);

      const filteredPanel = element.querySelector('.tbw-status-panel-filtered-count');
      expect(filteredPanel).toBeNull();
    });

    it('should show selected count when rows are selected', () => {
      const config: PinnedRowsConfig = { showSelectedCount: true };
      const context: PinnedRowsContext = { ...defaultContext, selectedRows: 5 };
      const element = createPinnedRowsElement(config, context);

      const selectedPanel = element.querySelector('.tbw-status-panel-selected-count');
      expect(selectedPanel).not.toBeNull();
      expect(selectedPanel?.textContent).toBe('Selected: 5');
    });

    it('should not show selected count when zero rows selected', () => {
      const config: PinnedRowsConfig = { showSelectedCount: true };
      const element = createPinnedRowsElement(config, defaultContext);

      const selectedPanel = element.querySelector('.tbw-status-panel-selected-count');
      expect(selectedPanel).toBeNull();
    });

    it('should not show selected count when showSelectedCount is false', () => {
      const config: PinnedRowsConfig = { showSelectedCount: false };
      const context: PinnedRowsContext = { ...defaultContext, selectedRows: 5 };
      const element = createPinnedRowsElement(config, context);

      const selectedPanel = element.querySelector('.tbw-status-panel-selected-count');
      expect(selectedPanel).toBeNull();
    });

    describe('custom panels', () => {
      it('should render custom panel with string content', () => {
        const customPanel: PinnedRowsPanel = {
          id: 'test-panel',
          position: 'center',
          render: () => '<strong>Custom Content</strong>',
        };
        const config: PinnedRowsConfig = { customPanels: [customPanel] };
        const element = createPinnedRowsElement(config, defaultContext);

        const panel = element.querySelector('#status-panel-test-panel');
        expect(panel).not.toBeNull();
        expect(panel?.innerHTML).toBe('<strong>Custom Content</strong>');
      });

      it('should render custom panel with HTMLElement content', () => {
        const customEl = document.createElement('span');
        customEl.textContent = 'Element Content';
        customEl.className = 'custom-span';

        const customPanel: PinnedRowsPanel = {
          id: 'element-panel',
          position: 'right',
          render: () => customEl,
        };
        const config: PinnedRowsConfig = { customPanels: [customPanel] };
        const element = createPinnedRowsElement(config, defaultContext);

        const panel = element.querySelector('#status-panel-element-panel');
        expect(panel).not.toBeNull();
        expect(panel?.querySelector('.custom-span')?.textContent).toBe('Element Content');
      });

      it('should place panels in correct positions', () => {
        const leftPanel: PinnedRowsPanel = {
          id: 'left-panel',
          position: 'left',
          render: () => 'Left',
        };
        const centerPanel: PinnedRowsPanel = {
          id: 'center-panel',
          position: 'center',
          render: () => 'Center',
        };
        const rightPanel: PinnedRowsPanel = {
          id: 'right-panel',
          position: 'right',
          render: () => 'Right',
        };

        const config: PinnedRowsConfig = {
          showRowCount: false,
          customPanels: [leftPanel, centerPanel, rightPanel],
        };
        const element = createPinnedRowsElement(config, defaultContext);

        const leftContainer = element.querySelector('.tbw-pinned-rows-left');
        const centerContainer = element.querySelector('.tbw-pinned-rows-center');
        const rightContainer = element.querySelector('.tbw-pinned-rows-right');

        expect(leftContainer?.querySelector('#status-panel-left-panel')).not.toBeNull();
        expect(centerContainer?.querySelector('#status-panel-center-panel')).not.toBeNull();
        expect(rightContainer?.querySelector('#status-panel-right-panel')).not.toBeNull();
      });

      it('should provide context to custom panel render function', () => {
        let capturedContext: PinnedRowsContext | undefined;

        const customPanel: PinnedRowsPanel = {
          id: 'context-test',
          position: 'center',
          render: (ctx) => {
            capturedContext = ctx;
            return `Rows: ${ctx.totalRows}`;
          },
        };

        const config: PinnedRowsConfig = { customPanels: [customPanel] };
        const context: PinnedRowsContext = {
          totalRows: 250,
          filteredRows: 200,
          selectedRows: 10,
          columns: [],
          rows: [],
          grid: document.createElement('div'),
        };

        createPinnedRowsElement(config, context);

        expect(capturedContext).toBeDefined();
        if (capturedContext) {
          expect(capturedContext.totalRows).toBe(250);
          expect(capturedContext.filteredRows).toBe(200);
          expect(capturedContext.selectedRows).toBe(10);
        }
      });
    });

    describe('structure', () => {
      it('should have three section containers', () => {
        const config: PinnedRowsConfig = {};
        const element = createPinnedRowsElement(config, defaultContext);

        expect(element.querySelector('.tbw-pinned-rows-left')).not.toBeNull();
        expect(element.querySelector('.tbw-pinned-rows-center')).not.toBeNull();
        expect(element.querySelector('.tbw-pinned-rows-right')).not.toBeNull();
      });
    });
  });

  describe('buildContext', () => {
    it('should build context with basic row data', () => {
      const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const columns = [{ field: 'id' }];
      const grid = document.createElement('div');

      const context = buildContext(rows, columns, grid);

      expect(context.totalRows).toBe(3);
      expect(context.filteredRows).toBe(3);
      expect(context.selectedRows).toBe(0);
      expect(context.columns).toBe(columns);
      expect(context.grid).toBe(grid);
    });

    it('should use filtered count from filter state', () => {
      const rows = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
      const columns = [{ field: 'id' }];
      const grid = document.createElement('div');
      const filterState = { cachedResult: [{ id: 1 }, { id: 3 }] };

      const context = buildContext(rows, columns, grid, null, filterState);

      expect(context.totalRows).toBe(5);
      expect(context.filteredRows).toBe(2);
    });

    it('should use selection count from selection state', () => {
      const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const columns = [{ field: 'id' }];
      const grid = document.createElement('div');
      const selectionState = { selected: new Set([0, 2]) };

      const context = buildContext(rows, columns, grid, selectionState);

      expect(context.selectedRows).toBe(2);
    });

    it('should handle null/undefined plugin states', () => {
      const rows = [{ id: 1 }];
      const columns = [{ field: 'id' }];
      const grid = document.createElement('div');

      const context = buildContext(rows, columns, grid, null, null);

      expect(context.totalRows).toBe(1);
      expect(context.filteredRows).toBe(1);
      expect(context.selectedRows).toBe(0);
    });

    it('should handle undefined plugin states', () => {
      const rows = [{ id: 1 }];
      const columns = [{ field: 'id' }];
      const grid = document.createElement('div');

      const context = buildContext(rows, columns, grid, undefined, undefined);

      expect(context.totalRows).toBe(1);
      expect(context.filteredRows).toBe(1);
      expect(context.selectedRows).toBe(0);
    });

    it('should handle filter state with null cachedResult', () => {
      const rows = [{ id: 1 }, { id: 2 }];
      const columns = [{ field: 'id' }];
      const grid = document.createElement('div');
      const filterState = { cachedResult: null };

      const context = buildContext(rows, columns, grid, null, filterState);

      expect(context.filteredRows).toBe(2); // Falls back to row count
    });

    it('should handle empty rows array', () => {
      const rows: unknown[] = [];
      const columns = [{ field: 'id' }];
      const grid = document.createElement('div');

      const context = buildContext(rows, columns, grid);

      expect(context.totalRows).toBe(0);
      expect(context.filteredRows).toBe(0);
    });
  });

  describe('createAggregationContainer', () => {
    it('should create a container for top position', () => {
      const container = createAggregationContainer('top');

      expect(container.className).toBe('tbw-aggregation-rows tbw-aggregation-rows-top');
      expect(container.getAttribute('role')).toBe('presentation');
    });

    it('should create a container for bottom position', () => {
      const container = createAggregationContainer('bottom');

      expect(container.className).toBe('tbw-aggregation-rows tbw-aggregation-rows-bottom');
      expect(container.getAttribute('role')).toBe('presentation');
    });
  });

  describe('renderAggregationRows', () => {
    it('should clear container and render new rows', () => {
      const container = document.createElement('div');
      container.innerHTML = '<div>existing content</div>';
      const columns = [{ field: 'amount' }];
      const dataRows = [{ amount: 100 }, { amount: 200 }];
      const rows: AggregationRowConfig[] = [{ id: 'totals' }];

      renderAggregationRows(container, rows, columns, dataRows);

      expect(container.querySelector(':scope > div > div.existing')).toBeNull();
      expect(container.querySelector('.tbw-aggregation-row')).not.toBeNull();
    });

    it('should set data-aggregation-id attribute when id is provided', () => {
      const container = document.createElement('div');
      const columns = [{ field: 'value' }];
      const dataRows: unknown[] = [];
      const rows: AggregationRowConfig[] = [{ id: 'summary' }];

      renderAggregationRows(container, rows, columns, dataRows);

      const row = container.querySelector('.tbw-aggregation-row');
      expect(row?.getAttribute('data-aggregation-id')).toBe('summary');
    });

    it('should not set data-aggregation-id when id is not provided', () => {
      const container = document.createElement('div');
      const columns = [{ field: 'value' }];
      const dataRows: unknown[] = [];
      const rows: AggregationRowConfig[] = [{}];

      renderAggregationRows(container, rows, columns, dataRows);

      const row = container.querySelector('.tbw-aggregation-row');
      expect(row?.hasAttribute('data-aggregation-id')).toBe(false);
    });

    it('should render fullWidth row with label', () => {
      const container = document.createElement('div');
      const columns = [{ field: 'a' }, { field: 'b' }];
      const dataRows: unknown[] = [];
      const rows: AggregationRowConfig[] = [{ fullWidth: true, label: 'Summary Row' }];

      renderAggregationRows(container, rows, columns, dataRows);

      const cell = container.querySelector('.tbw-aggregation-cell-full');
      expect(cell).not.toBeNull();
      const label = cell?.querySelector('.tbw-aggregation-label');
      expect(label?.textContent).toBe('Summary Row');
      expect(cell?.getAttribute('style')).toContain('grid-column');
    });

    it('should render fullWidth row with empty label when not provided', () => {
      const container = document.createElement('div');
      const columns = [{ field: 'a' }];
      const dataRows: unknown[] = [];
      const rows: AggregationRowConfig[] = [{ fullWidth: true }];

      renderAggregationRows(container, rows, columns, dataRows);

      const cell = container.querySelector('.tbw-aggregation-cell-full');
      const label = cell?.querySelector('.tbw-aggregation-label');
      expect(label).toBeNull(); // No label element when label is empty
    });

    it('should render fullWidth row with dynamic label function', () => {
      const container = document.createElement('div');
      const columns = [{ field: 'name' }, { field: 'price' }];
      const dataRows = [
        { name: 'A', price: 10 },
        { name: 'B', price: 20 },
        { name: 'C', price: 30 },
      ];
      const rows: AggregationRowConfig[] = [{ fullWidth: true, label: (r) => `Total: ${r.length} rows` }];

      renderAggregationRows(container, rows, columns, dataRows);

      const label = container.querySelector('.tbw-aggregation-label');
      expect(label?.textContent).toBe('Total: 3 rows');
    });

    it('should pass columns to dynamic label function', () => {
      const container = document.createElement('div');
      const columns = [
        { field: 'a', header: 'Alpha' },
        { field: 'b', header: 'Beta' },
      ];
      const dataRows = [{ a: 1, b: 2 }];
      const rows: AggregationRowConfig[] = [{ fullWidth: true, label: (_r, cols) => `${cols.length} columns` }];

      renderAggregationRows(container, rows, columns, dataRows);

      const label = container.querySelector('.tbw-aggregation-label');
      expect(label?.textContent).toBe('2 columns');
    });

    it('should render per-column cells with static values', () => {
      const container = document.createElement('div');
      const columns = [{ field: 'name' }, { field: 'value' }];
      const dataRows: unknown[] = [];
      const rows: AggregationRowConfig[] = [
        {
          cells: { name: 'Total:', value: 500 },
        },
      ];

      renderAggregationRows(container, rows, columns, dataRows);

      const cells = container.querySelectorAll('.tbw-aggregation-cell');
      expect(cells.length).toBe(2);
      expect(cells[0]?.getAttribute('data-field')).toBe('name');
      expect(cells[0]?.textContent).toBe('Total:');
      expect(cells[1]?.getAttribute('data-field')).toBe('value');
      expect(cells[1]?.textContent).toBe('500');
    });

    it('should render per-column cells with function values', () => {
      const container = document.createElement('div');
      const columns = [{ field: 'count' }];
      const dataRows = [{ count: 10 }, { count: 20 }];
      const computeFn = vi.fn((data: unknown[]) => data.length);
      const rows: AggregationRowConfig[] = [
        {
          cells: { count: computeFn },
        },
      ];

      renderAggregationRows(container, rows, columns, dataRows);

      expect(computeFn).toHaveBeenCalledWith(dataRows, 'count', columns[0]);
      const cell = container.querySelector('[data-field="count"]');
      expect(cell?.textContent).toBe('2');
    });

    it('should use aggregator when specified', () => {
      const container = document.createElement('div');
      const columns = [{ field: 'amount' }];
      const dataRows = [{ amount: 100 }, { amount: 200 }, { amount: 300 }];
      const rows: AggregationRowConfig[] = [
        {
          aggregators: { amount: 'sum' },
        },
      ];

      renderAggregationRows(container, rows, columns, dataRows);

      const cell = container.querySelector('[data-field="amount"]');
      expect(cell?.textContent).toBe('600');
    });

    it('should prioritize aggregator over static cells', () => {
      const container = document.createElement('div');
      const columns = [{ field: 'value' }];
      const dataRows = [{ value: 50 }];
      const rows: AggregationRowConfig[] = [
        {
          aggregators: { value: 'sum' },
          cells: { value: 'ignored' },
        },
      ];

      renderAggregationRows(container, rows, columns, dataRows);

      const cell = container.querySelector('[data-field="value"]');
      expect(cell?.textContent).toBe('50'); // sum result, not 'ignored'
    });

    it('should render empty cell when no value is found', () => {
      const container = document.createElement('div');
      const columns = [{ field: 'missing' }];
      const dataRows: unknown[] = [];
      const rows: AggregationRowConfig[] = [{}];

      renderAggregationRows(container, rows, columns, dataRows);

      const cell = container.querySelector('[data-field="missing"]');
      expect(cell?.textContent).toBe('');
    });

    it('should handle null and undefined values gracefully', () => {
      const container = document.createElement('div');
      const columns = [{ field: 'nullField' }, { field: 'undefinedField' }];
      const dataRows: unknown[] = [];
      const rows: AggregationRowConfig[] = [
        {
          cells: { nullField: null, undefinedField: undefined },
        },
      ];

      renderAggregationRows(container, rows, columns, dataRows);

      const nullCell = container.querySelector('[data-field="nullField"]');
      const undefinedCell = container.querySelector('[data-field="undefinedField"]');
      expect(nullCell?.textContent).toBe('');
      expect(undefinedCell?.textContent).toBe('');
    });

    it('should render multiple aggregation rows', () => {
      const container = document.createElement('div');
      const columns = [{ field: 'value' }];
      const dataRows = [{ value: 10 }];
      const rows: AggregationRowConfig[] = [
        { id: 'row1', cells: { value: 'Row 1' } },
        { id: 'row2', cells: { value: 'Row 2' } },
        { id: 'row3', cells: { value: 'Row 3' } },
      ];

      renderAggregationRows(container, rows, columns, dataRows);

      const allRows = container.querySelectorAll('.tbw-aggregation-row');
      expect(allRows.length).toBe(3);
      expect(allRows[0]?.getAttribute('data-aggregation-id')).toBe('row1');
      expect(allRows[1]?.getAttribute('data-aggregation-id')).toBe('row2');
      expect(allRows[2]?.getAttribute('data-aggregation-id')).toBe('row3');
    });

    it('should set role="presentation" on aggregation rows', () => {
      const container = document.createElement('div');
      const columns = [{ field: 'a' }];
      const dataRows: unknown[] = [];
      const rows: AggregationRowConfig[] = [{ id: 'test' }];

      renderAggregationRows(container, rows, columns, dataRows);

      const row = container.querySelector('.tbw-aggregation-row');
      expect(row?.getAttribute('role')).toBe('presentation');
    });

    it('should handle custom aggregator function', () => {
      const container = document.createElement('div');
      const columns = [{ field: 'scores' }];
      const dataRows = [{ scores: 10 }, { scores: 20 }, { scores: 30 }];
      const customAggregator = vi.fn((_rows: unknown[], field: string) => `Custom: ${field}`);
      const rows: AggregationRowConfig[] = [
        {
          aggregators: { scores: customAggregator },
        },
      ];

      renderAggregationRows(container, rows, columns, dataRows);

      expect(customAggregator).toHaveBeenCalled();
      const cell = container.querySelector('[data-field="scores"]');
      expect(cell?.textContent).toBe('Custom: scores');
    });

    it('should handle aggregator that returns null', () => {
      const container = document.createElement('div');
      const columns = [{ field: 'empty' }];
      const dataRows: unknown[] = [];
      const nullAggregator = () => null;
      const rows: AggregationRowConfig[] = [
        {
          aggregators: { empty: nullAggregator },
        },
      ];

      renderAggregationRows(container, rows, columns, dataRows);

      const cell = container.querySelector('[data-field="empty"]');
      expect(cell?.textContent).toBe('');
    });

    it('should apply formatter when using object syntax with aggFunc', () => {
      const container = document.createElement('div');
      const columns = [{ field: 'price' }];
      const dataRows = [{ price: 100 }, { price: 50.5 }];
      const formatter = vi.fn((value: unknown) => `$${(value as number).toFixed(2)}`);
      const rows: AggregationRowConfig[] = [
        {
          aggregators: {
            price: { aggFunc: 'sum', formatter },
          },
        },
      ];

      renderAggregationRows(container, rows, columns, dataRows);

      expect(formatter).toHaveBeenCalledWith(150.5, 'price', columns[0]);
      const cell = container.querySelector('[data-field="price"]');
      expect(cell?.textContent).toBe('$150.50');
    });

    it('should work with simple string aggregator (backward compat)', () => {
      const container = document.createElement('div');
      const columns = [{ field: 'amount' }];
      const dataRows = [{ amount: 10 }, { amount: 20 }];
      const rows: AggregationRowConfig[] = [
        {
          aggregators: { amount: 'sum' },
        },
      ];

      renderAggregationRows(container, rows, columns, dataRows);

      const cell = container.querySelector('[data-field="amount"]');
      expect(cell?.textContent).toBe('30');
    });

    it('should work with custom function aggregator (backward compat)', () => {
      const container = document.createElement('div');
      const columns = [{ field: 'items' }];
      const dataRows = [{ items: ['a', 'b'] }, { items: ['c'] }];
      const rows: AggregationRowConfig[] = [
        {
          aggregators: {
            items: (rows) => (rows as { items: string[] }[]).flatMap((r) => r.items).length,
          },
        },
      ];

      renderAggregationRows(container, rows, columns, dataRows);

      const cell = container.querySelector('[data-field="items"]');
      expect(cell?.textContent).toBe('3');
    });

    it('should use object syntax with custom function as aggFunc', () => {
      const container = document.createElement('div');
      const columns = [{ field: 'count' }];
      const dataRows = [{ count: 1 }, { count: 2 }, { count: 3 }];
      const customAgg = (rows: unknown[]) => rows.length * 100;
      const formatter = (value: unknown) => `${value} items`;
      const rows: AggregationRowConfig[] = [
        {
          aggregators: {
            count: { aggFunc: customAgg, formatter },
          },
        },
      ];

      renderAggregationRows(container, rows, columns, dataRows);

      const cell = container.querySelector('[data-field="count"]');
      expect(cell?.textContent).toBe('300 items');
    });

    it('should not apply formatter when value is null', () => {
      const container = document.createElement('div');
      const columns = [{ field: 'empty' }];
      const dataRows: unknown[] = [];
      const formatter = vi.fn((value: unknown) => `formatted: ${value}`);
      const nullAggregator = () => null;
      const rows: AggregationRowConfig[] = [
        {
          aggregators: { empty: { aggFunc: nullAggregator, formatter } },
        },
      ];

      renderAggregationRows(container, rows, columns, dataRows);

      expect(formatter).not.toHaveBeenCalled();
      const cell = container.querySelector('[data-field="empty"]');
      expect(cell?.textContent).toBe('');
    });

    it('should pass column config to formatter', () => {
      const container = document.createElement('div');
      const columns = [{ field: 'value', header: 'Value Column' }];
      const dataRows = [{ value: 42 }];
      const formatter = vi.fn((_value: unknown, field: string, column?: { header?: string }) => {
        return `${column?.header}: ${_value}`;
      });
      const rows: AggregationRowConfig[] = [
        {
          aggregators: {
            value: { aggFunc: 'sum', formatter },
          },
        },
      ];

      renderAggregationRows(container, rows, columns, dataRows);

      expect(formatter).toHaveBeenCalledWith(42, 'value', columns[0]);
      const cell = container.querySelector('[data-field="value"]');
      expect(cell?.textContent).toBe('Value Column: 42');
    });

    // #region fullWidth with inline aggregates
    it('should render fullWidth row with inline aggregated values', () => {
      const container = document.createElement('div');
      const columns = [
        { field: 'name', header: 'Name' },
        { field: 'amount', header: 'Amount' },
      ];
      const dataRows = [
        { name: 'A', amount: 100 },
        { name: 'B', amount: 200 },
      ];
      const rows: AggregationRowConfig[] = [
        {
          fullWidth: true,
          label: 'Totals',
          aggregators: { amount: 'sum' },
        },
      ];

      renderAggregationRows(container, rows, columns, dataRows);

      const cell = container.querySelector('.tbw-aggregation-cell-full');
      expect(cell).not.toBeNull();
      // Label
      const label = cell?.querySelector('.tbw-aggregation-label');
      expect(label?.textContent).toBe('Totals');
      // Aggregates container
      const aggregates = cell?.querySelector('.tbw-aggregation-aggregates');
      expect(aggregates).not.toBeNull();
      const aggSpan = aggregates?.querySelector('[data-field="amount"]');
      expect(aggSpan?.textContent).toBe('Amount: 300');
    });

    it('should render fullWidth row with static cell values inline', () => {
      const container = document.createElement('div');
      const columns = [
        { field: 'category', header: 'Category' },
        { field: 'count', header: 'Count' },
      ];
      const dataRows: unknown[] = [];
      const rows: AggregationRowConfig[] = [
        {
          fullWidth: true,
          label: 'Summary',
          cells: { count: 42 },
        },
      ];

      renderAggregationRows(container, rows, columns, dataRows);

      const cell = container.querySelector('.tbw-aggregation-cell-full');
      const aggregates = cell?.querySelector('.tbw-aggregation-aggregates');
      expect(aggregates).not.toBeNull();
      const aggSpan = aggregates?.querySelector('[data-field="count"]');
      expect(aggSpan?.textContent).toBe('Count: 42');
    });

    it('should render fullWidth row with formatter in inline aggregates', () => {
      const container = document.createElement('div');
      const columns = [{ field: 'price', header: 'Price' }];
      const dataRows = [{ price: 100 }, { price: 50.5 }];
      const formatter = vi.fn((value: unknown) => `$${(value as number).toFixed(2)}`);
      const rows: AggregationRowConfig[] = [
        {
          fullWidth: true,
          label: 'Total',
          aggregators: { price: { aggFunc: 'sum', formatter } },
        },
      ];

      renderAggregationRows(container, rows, columns, dataRows);

      const aggSpan = container.querySelector('.tbw-aggregation-aggregate[data-field="price"]');
      expect(aggSpan?.textContent).toBe('Price: $150.50');
    });

    it('should not show aggregates container when no aggregators or cells are defined', () => {
      const container = document.createElement('div');
      const columns = [{ field: 'a' }];
      const dataRows: unknown[] = [];
      const rows: AggregationRowConfig[] = [{ fullWidth: true, label: 'Empty' }];

      renderAggregationRows(container, rows, columns, dataRows);

      const cell = container.querySelector('.tbw-aggregation-cell-full');
      const aggregates = cell?.querySelector('.tbw-aggregation-aggregates');
      expect(aggregates).toBeNull();
    });

    it('should use field name as header fallback in inline aggregates', () => {
      const container = document.createElement('div');
      const columns = [{ field: 'myField' }]; // no header property
      const dataRows = [{ myField: 10 }];
      const rows: AggregationRowConfig[] = [
        {
          fullWidth: true,
          aggregators: { myField: 'sum' },
        },
      ];

      renderAggregationRows(container, rows, columns, dataRows);

      const aggSpan = container.querySelector('.tbw-aggregation-aggregate[data-field="myField"]');
      expect(aggSpan?.textContent).toBe('myField: 10');
    });

    it('should use global fullWidth when per-row fullWidth is not set', () => {
      const container = document.createElement('div');
      const columns = [
        { field: 'name', header: 'Name' },
        { field: 'value', header: 'Value' },
      ];
      const dataRows = [{ name: 'A', value: 100 }];
      const rows: AggregationRowConfig[] = [{ id: 'totals', label: 'Totals', aggregators: { value: 'sum' } }];

      // Pass globalFullWidth = true
      renderAggregationRows(container, rows, columns, dataRows, true);

      // Should render as fullWidth (single spanning cell)
      const fullCell = container.querySelector('.tbw-aggregation-cell-full');
      expect(fullCell).not.toBeNull();
      expect(fullCell?.querySelector('.tbw-aggregation-label')?.textContent).toBe('Totals');
    });

    it('should allow per-row fullWidth to override global fullWidth', () => {
      const container = document.createElement('div');
      const columns = [
        { field: 'name', header: 'Name' },
        { field: 'value', header: 'Value' },
      ];
      const dataRows = [{ name: 'A', value: 100 }];
      const rows: AggregationRowConfig[] = [
        // Global is true, but this row explicitly sets false
        { id: 'per-col', fullWidth: false, cells: { name: 'Label', value: 100 } },
      ];

      renderAggregationRows(container, rows, columns, dataRows, true);

      // Should render per-column cells (NOT fullWidth)
      const fullCell = container.querySelector('.tbw-aggregation-cell-full');
      expect(fullCell).toBeNull();
      const cells = container.querySelectorAll('.tbw-aggregation-cell');
      expect(cells.length).toBe(2);
    });

    it('should render per-column by default when global fullWidth is false', () => {
      const container = document.createElement('div');
      const columns = [{ field: 'a' }, { field: 'b' }];
      const dataRows: unknown[] = [];
      const rows: AggregationRowConfig[] = [{}];

      // Explicit globalFullWidth = false (default behavior)
      renderAggregationRows(container, rows, columns, dataRows, false);

      const fullCell = container.querySelector('.tbw-aggregation-cell-full');
      expect(fullCell).toBeNull();
      const cells = container.querySelectorAll('.tbw-aggregation-cell');
      expect(cells.length).toBe(2);
    });
    // #endregion
  });
});
