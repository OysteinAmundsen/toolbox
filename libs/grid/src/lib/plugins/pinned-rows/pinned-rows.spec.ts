import { beforeEach, describe, expect, it } from 'vitest';
import { buildContext, createPinnedRowsElement } from './pinned-rows';
import type { PinnedRowsConfig, PinnedRowsContext, PinnedRowsPanel } from './types';

describe('pinnedRows', () => {
  describe('createPinnedRowsElement', () => {
    let defaultContext: PinnedRowsContext;

    beforeEach(() => {
      defaultContext = {
        totalRows: 100,
        filteredRows: 100,
        selectedRows: 0,
        columns: [],
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
        let capturedContext: PinnedRowsContext | null = null;

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
          grid: document.createElement('div'),
        };

        createPinnedRowsElement(config, context);

        expect(capturedContext).not.toBeNull();
        expect(capturedContext?.totalRows).toBe(250);
        expect(capturedContext?.filteredRows).toBe(200);
        expect(capturedContext?.selectedRows).toBe(10);
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
});
