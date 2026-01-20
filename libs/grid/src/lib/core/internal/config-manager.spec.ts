import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BaseGridPlugin } from '../plugin';
import type { ColumnInternal, GridColumnState, GridConfig } from '../types';
import { ConfigManager, type ConfigManagerCallbacks } from './config-manager';

describe('ConfigManager', () => {
  let configManager: ConfigManager<{ id: number; name: string }>;
  let mockCallbacks: ConfigManagerCallbacks<{ id: number; name: string }>;

  beforeEach(() => {
    mockCallbacks = {
      getRows: vi.fn(() => []),
      getSortState: vi.fn(() => null),
      setSortState: vi.fn(),
      onConfigChange: vi.fn(),
      emit: vi.fn(),
      clearRowPool: vi.fn(),
      setup: vi.fn(),
      renderHeader: vi.fn(),
      updateTemplate: vi.fn(),
      refreshVirtualWindow: vi.fn(),
      getVirtualization: vi.fn(() => ({ rowHeight: 28 })),
      setRowHeight: vi.fn(),
      applyAnimationConfig: vi.fn(),
      getShellLightDomTitle: vi.fn(() => null),
      getShellToolPanels: vi.fn(() => new Map()),
      getShellHeaderContents: vi.fn(() => new Map()),
      getShellToolbarContents: vi.fn(() => new Map()),
      getShellLightDomHeaderContent: vi.fn(() => []),
      getShellHasToolButtonsContainer: vi.fn(() => false),
    };
    configManager = new ConfigManager(mockCallbacks);
  });

  describe('Source Management', () => {
    it('should set and get gridConfig', () => {
      const config: GridConfig<{ id: number; name: string }> = {
        columns: [{ field: 'id', header: 'ID' }],
        fitMode: 'fit',
      };
      configManager.setGridConfig(config);
      expect(configManager.getGridConfig()).toBe(config);
    });

    it('should set and get columns', () => {
      const columns = [{ field: 'id' as const, header: 'ID' }];
      configManager.setColumns(columns);
      expect(configManager.getColumns()).toBe(columns);
    });

    it('should set and get fitMode', () => {
      configManager.setFitMode('fit');
      expect(configManager.getFitMode()).toBe('fit');
    });

    it('should set and get editOn', () => {
      configManager.setEditOn('dblclick');
      expect(configManager.getEditOn()).toBe('dblclick');
    });
  });

  describe('Config Merge', () => {
    it('should merge gridConfig into effective config', () => {
      configManager.setGridConfig({
        columns: [{ field: 'id', header: 'ID' }],
        fitMode: 'fit',
      });
      configManager.merge();

      expect(configManager.effective.columns).toHaveLength(1);
      expect(configManager.effective.columns![0].field).toBe('id');
      expect(configManager.effective.fitMode).toBe('fit');
    });

    it('should apply individual prop overrides over gridConfig', () => {
      configManager.setGridConfig({
        fitMode: 'fit',
      });
      configManager.setFitMode('stretch');
      configManager.merge();

      expect(configManager.effective.fitMode).toBe('stretch');
    });

    it('should use columns prop over gridConfig columns', () => {
      configManager.setGridConfig({
        columns: [{ field: 'id', header: 'ID' }],
      });
      configManager.setColumns([{ field: 'name', header: 'Name' }]);
      configManager.merge();

      expect(configManager.effective.columns).toHaveLength(1);
      expect(configManager.effective.columns![0].field).toBe('name');
    });

    it('should infer columns from rows if none provided', () => {
      (mockCallbacks.getRows as ReturnType<typeof vi.fn>).mockReturnValue([{ id: 1, name: 'Test' }]);
      configManager.merge();

      expect(configManager.effective.columns).toBeDefined();
      expect(configManager.effective.columns!.length).toBeGreaterThan(0);
    });
  });

  describe('Column Visibility', () => {
    beforeEach(() => {
      configManager.setGridConfig({
        columns: [
          { field: 'id', header: 'ID' },
          { field: 'name', header: 'Name' },
        ],
      });
      configManager.merge();
    });

    it('should hide a column', () => {
      const result = configManager.setColumnVisible('id', false);
      expect(result).toBe(true);
      expect(configManager.isColumnVisible('id')).toBe(false);
    });

    it('should show a hidden column', () => {
      configManager.setColumnVisible('id', false);
      const result = configManager.setColumnVisible('id', true);
      expect(result).toBe(true);
      expect(configManager.isColumnVisible('id')).toBe(true);
    });

    it('should toggle column visibility', () => {
      const initialVisible = configManager.isColumnVisible('id');
      configManager.toggleColumnVisibility('id');
      expect(configManager.isColumnVisible('id')).toBe(!initialVisible);
    });

    it('should not hide the last visible column', () => {
      configManager.setColumnVisible('id', false);
      const result = configManager.setColumnVisible('name', false);
      expect(result).toBe(false);
      expect(configManager.isColumnVisible('name')).toBe(true);
    });

    it('should not hide lockVisible column', () => {
      configManager.setGridConfig({
        columns: [
          { field: 'id', header: 'ID', lockVisible: true },
          { field: 'name', header: 'Name' },
        ],
      });
      configManager.merge();

      const result = configManager.setColumnVisible('id', false);
      expect(result).toBe(false);
      expect(configManager.isColumnVisible('id')).toBe(true);
    });

    it('should show all columns', () => {
      configManager.setColumnVisible('id', false);
      configManager.showAllColumns();
      expect(configManager.isColumnVisible('id')).toBe(true);
      expect(configManager.isColumnVisible('name')).toBe(true);
    });

    it('should emit visibility event', () => {
      configManager.setColumnVisible('id', false);
      expect(mockCallbacks.emit).toHaveBeenCalledWith(
        'column-visibility',
        expect.objectContaining({
          field: 'id',
          visible: false,
        }),
      );
    });

    it('should return all columns with visibility info', () => {
      configManager.setColumnVisible('id', false);
      const allCols = configManager.getAllColumns();

      expect(allCols).toHaveLength(2);
      expect(allCols.find((c) => c.field === 'id')?.visible).toBe(false);
      expect(allCols.find((c) => c.field === 'name')?.visible).toBe(true);
    });
  });

  describe('Column Order', () => {
    beforeEach(() => {
      configManager.setGridConfig({
        columns: [
          { field: 'id', header: 'ID' },
          { field: 'name', header: 'Name' },
          { field: 'email', header: 'Email' },
        ],
      });
      configManager.merge();
    });

    it('should get column order', () => {
      const order = configManager.getColumnOrder();
      expect(order).toEqual(['id', 'name', 'email']);
    });

    it('should set column order', () => {
      configManager.setColumnOrder(['email', 'id', 'name']);
      const order = configManager.getColumnOrder();
      expect(order).toEqual(['email', 'id', 'name']);
    });

    it('should call render callbacks after reorder', () => {
      configManager.setColumnOrder(['email', 'id', 'name']);
      expect(mockCallbacks.renderHeader).toHaveBeenCalled();
      expect(mockCallbacks.updateTemplate).toHaveBeenCalled();
      expect(mockCallbacks.refreshVirtualWindow).toHaveBeenCalled();
    });
  });

  describe('State Management', () => {
    beforeEach(() => {
      configManager.setGridConfig({
        columns: [
          { field: 'id', header: 'ID', width: 100 },
          { field: 'name', header: 'Name', width: 200 },
        ],
      });
      configManager.merge();
    });

    it('should collect column state', () => {
      const plugins: BaseGridPlugin[] = [];
      const state = configManager.collectState(plugins);

      expect(state.columns).toHaveLength(2);
      expect(state.columns[0].field).toBe('id');
      expect(state.columns[0].visible).toBe(true);
      expect(state.columns[0].order).toBe(0);
    });

    it('should apply column state', () => {
      const plugins: BaseGridPlugin[] = [];
      const state: GridColumnState = {
        columns: [
          { field: 'name', order: 0, visible: true, width: 300 },
          { field: 'id', order: 1, visible: false, width: 150 },
        ],
      };

      configManager.applyState(state, plugins);

      // Check order was applied
      expect(configManager.getColumnOrder()).toEqual(['name', 'id']);
      // Check visibility was applied
      expect(configManager.isColumnVisible('id')).toBe(false);
      // Check width was applied
      const idCol = configManager.columns.find((c) => c.field === 'id') as ColumnInternal<unknown>;
      expect(idCol.__renderedWidth).toBe(150);
    });

    it('should reset state to original', () => {
      const plugins: BaseGridPlugin[] = [];

      // Make changes
      configManager.setColumnVisible('id', false);
      configManager.setColumnOrder(['name', 'id']);

      // Reset
      configManager.resetState(plugins);

      // Columns should be visible again
      expect(configManager.isColumnVisible('id')).toBe(true);
    });

    it('should request state change with debounce', async () => {
      const plugins: BaseGridPlugin[] = [];

      configManager.requestStateChange(plugins);
      configManager.requestStateChange(plugins);
      configManager.requestStateChange(plugins);

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should only emit once due to debounce
      expect(mockCallbacks.emit).toHaveBeenCalledTimes(1);
      expect(mockCallbacks.emit).toHaveBeenCalledWith('column-state-change', expect.any(Object));
    });
  });

  describe('Cleanup', () => {
    it('should dispose resources', () => {
      configManager.dispose();
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Two-Layer Config Architecture', () => {
    it('should create frozen original config from sources', () => {
      configManager.setGridConfig({
        columns: [{ field: 'id', header: 'ID' }],
      });
      configManager.merge();

      // Original config should be frozen
      const original = configManager.original;
      expect(Object.isFrozen(original)).toBe(true);
      expect(original.columns?.length).toBe(1);
    });

    it('should clone original to mutable effective config', () => {
      configManager.setGridConfig({
        columns: [{ field: 'id', header: 'ID' }],
      });
      configManager.merge();

      // Effective should be a different object
      expect(configManager.effective).not.toBe(configManager.original);

      // But have same structure
      expect(configManager.effective.columns?.length).toBe(1);
    });

    it('should allow runtime mutations on effective config', () => {
      configManager.setGridConfig({
        columns: [
          { field: 'id', header: 'ID' },
          { field: 'name', header: 'Name' },
        ],
      });
      configManager.merge();

      // Hide a column via API (mutates effective config)
      configManager.setColumnVisible('id', false);

      // Effective config should be mutated
      expect(configManager.isColumnVisible('id')).toBe(false);

      // Original config should NOT be mutated
      const originalIdCol = configManager.original.columns?.find((c) => c.field === 'id');
      expect(originalIdCol?.hidden).toBeFalsy();
    });

    it('should reset effective to original on resetState', () => {
      configManager.setGridConfig({
        columns: [
          { field: 'id', header: 'ID' },
          { field: 'name', header: 'Name' },
        ],
      });
      configManager.merge();

      // Make runtime changes
      configManager.setColumnVisible('id', false);
      expect(configManager.isColumnVisible('id')).toBe(false);

      // Reset state
      configManager.resetState([]);

      // Should be back to original
      expect(configManager.isColumnVisible('id')).toBe(true);
    });

    it('should rebuild both layers when sources change', () => {
      // Initial config
      configManager.setGridConfig({
        columns: [{ field: 'id', header: 'ID' }],
      });
      configManager.merge();
      expect(configManager.columns.length).toBe(1);

      // Change sources
      configManager.setGridConfig({
        columns: [
          { field: 'id', header: 'ID' },
          { field: 'name', header: 'Name' },
        ],
      });
      configManager.merge();

      // Both layers should have new structure
      expect(configManager.original.columns?.length).toBe(2);
      expect(configManager.effective.columns?.length).toBe(2);
    });

    it('should discard runtime state when sources change', () => {
      // Initial config with two columns
      configManager.setGridConfig({
        columns: [
          { field: 'id', header: 'ID' },
          { field: 'name', header: 'Name' },
        ],
      });
      configManager.merge();

      // Make runtime change (hide a column)
      configManager.setColumnVisible('id', false);
      expect(configManager.isColumnVisible('id')).toBe(false);

      // Change sources (triggers rebuild of both layers)
      configManager.setGridConfig({
        columns: [
          { field: 'id', header: 'ID' },
          { field: 'name', header: 'Name' },
        ],
      });
      configManager.merge();

      // Runtime state should be discarded (column visible again)
      expect(configManager.isColumnVisible('id')).toBe(true);
    });

    it('should preserve width changes in effective until sources change', () => {
      configManager.setGridConfig({
        columns: [{ field: 'id', header: 'ID', width: 100 }],
      });
      configManager.merge();

      // Simulate user-resized width (runtime mutation)
      const col = configManager.columns.find((c) => c.field === 'id') as ColumnInternal<unknown>;
      col.width = 200;

      // Width is preserved in effective
      expect(configManager.columns.find((c) => c.field === 'id')?.width).toBe(200);

      // Original still has source width
      expect(configManager.original.columns?.find((c) => c.field === 'id')?.width).toBe(100);

      // Source change rebuilds both layers
      configManager.setGridConfig({
        columns: [{ field: 'id', header: 'ID', width: 100 }],
      });
      configManager.merge();

      // Width reset to source value
      expect(configManager.columns.find((c) => c.field === 'id')?.width).toBe(100);
    });
  });
});
