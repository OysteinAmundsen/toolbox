import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UndoRedoPlugin } from './UndoRedoPlugin';

// #region Test Helpers

/**
 * Create a minimal mock grid that satisfies BaseGridPlugin.attach() requirements.
 * The mock supports getRowId / updateRow for testing #applyValue.
 */
function createMockGrid(
  rows: Record<string, unknown>[] = [],
  opts: { getRowId?: (row: unknown) => string } = {},
) {
  const grid = document.createElement('div');

  const pm = {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    emitPluginEvent: vi.fn(),
  };

  Object.assign(grid, {
    rows,
    gridConfig: {},
    disconnectSignal: new AbortController().signal,
    requestRender: vi.fn(),
    requestAfterRender: vi.fn(),
    getPlugin: vi.fn(),
    getPluginByName: vi.fn(),
    query: vi.fn().mockReturnValue([]),
    queryPlugins: vi.fn().mockReturnValue([]),
    _pluginManager: pm,
    // updateRow: mutates the row in-place (simulating the real grid behavior)
    updateRow: vi.fn((id: string, changes: Record<string, unknown>) => {
      const row = rows.find((r) => String(r['id']) === id);
      if (row) Object.assign(row, changes);
    }),
    getRowId:
      opts.getRowId ??
      vi.fn((row: unknown) => {
        const r = row as Record<string, unknown>;
        return r['id'] != null ? String(r['id']) : '';
      }),
  });

  return grid as any;
}

/** Create a Ctrl+Z keyboard event */
function ctrlZ(): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true });
}

/** Create a Ctrl+Y keyboard event */
function ctrlY(): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true });
}

// #endregion

describe('UndoRedoPlugin', () => {
  let plugin: UndoRedoPlugin;
  let rows: Record<string, unknown>[];
  let grid: ReturnType<typeof createMockGrid>;

  beforeEach(() => {
    rows = [
      { id: 1, name: 'Alpha', price: 10 },
      { id: 2, name: 'Beta', price: 20 },
    ];
    grid = createMockGrid(rows);
    plugin = new UndoRedoPlugin({ maxHistorySize: 50 });
    plugin.attach(grid);
  });

  afterEach(() => {
    plugin.detach();
  });

  // #region attach / detach

  describe('attach', () => {
    it('should subscribe to cell-edit-committed event bus', () => {
      expect(grid._pluginManager.subscribe).toHaveBeenCalledWith(
        plugin,
        'cell-edit-committed',
        expect.any(Function),
      );
    });
  });

  describe('detach', () => {
    it('should clear history stacks', () => {
      plugin.recordEdit(0, 'name', 'Alpha', 'Gamma');
      expect(plugin.canUndo()).toBe(true);

      plugin.detach();
      expect(plugin.canUndo()).toBe(false);
      expect(plugin.canRedo()).toBe(false);
    });
  });

  // #endregion

  // #region #applyValue via updateRow

  describe('undo uses updateRow when row ID is available', () => {
    it('should call grid.updateRow on undo', () => {
      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      rows[0]['name'] = 'Changed'; // simulate the edit having been applied

      plugin.undo();

      expect(grid.updateRow).toHaveBeenCalledWith('1', { name: 'Alpha' });
      expect(rows[0]['name']).toBe('Alpha');
    });

    it('should call grid.updateRow on redo', () => {
      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      rows[0]['name'] = 'Changed';

      plugin.undo();
      plugin.redo();

      expect(grid.updateRow).toHaveBeenCalledTimes(2);
      expect(grid.updateRow).toHaveBeenLastCalledWith('1', { name: 'Changed' });
      expect(rows[0]['name']).toBe('Changed');
    });

    it('should call grid.updateRow on Ctrl+Z keyboard undo', () => {
      plugin.recordEdit(0, 'price', 10, 99);
      rows[0]['price'] = 99;

      plugin.onKeyDown(ctrlZ());

      expect(grid.updateRow).toHaveBeenCalledWith('1', { price: 10 });
    });

    it('should call grid.updateRow on Ctrl+Y keyboard redo', () => {
      plugin.recordEdit(0, 'price', 10, 99);
      rows[0]['price'] = 99;

      plugin.onKeyDown(ctrlZ()); // undo first
      plugin.onKeyDown(ctrlY()); // redo

      expect(grid.updateRow).toHaveBeenCalledTimes(2);
      expect(grid.updateRow).toHaveBeenLastCalledWith('1', { price: 99 });
    });
  });

  // #endregion

  // #region Fallback to direct mutation

  describe('falls back to direct mutation when no row ID', () => {
    it('should mutate directly when getRowId throws', () => {
      const noIdGrid = createMockGrid(rows, {
        getRowId: () => {
          throw new Error('No getRowId configured');
        },
      });
      const p = new UndoRedoPlugin();
      p.attach(noIdGrid);

      p.recordEdit(0, 'name', 'Alpha', 'Changed');
      rows[0]['name'] = 'Changed';

      p.undo();

      expect(noIdGrid.updateRow).not.toHaveBeenCalled();
      expect(rows[0]['name']).toBe('Alpha');

      p.detach();
    });

    it('should mutate directly when getRowId returns empty string', () => {
      const emptyIdGrid = createMockGrid(rows, {
        getRowId: () => '',
      });
      const p = new UndoRedoPlugin();
      p.attach(emptyIdGrid);

      p.recordEdit(1, 'price', 20, 50);
      rows[1]['price'] = 50;

      p.undo();

      expect(emptyIdGrid.updateRow).not.toHaveBeenCalled();
      expect(rows[1]['price']).toBe(20);

      p.detach();
    });
  });

  // #endregion

  // #region Event emission

  describe('events', () => {
    it('should emit undo event on Ctrl+Z', () => {
      const events: CustomEvent[] = [];
      grid.addEventListener('undo', (e: Event) => events.push(e as CustomEvent));

      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      rows[0]['name'] = 'Changed';

      plugin.onKeyDown(ctrlZ());

      expect(events).toHaveLength(1);
      expect(events[0].detail).toMatchObject({ type: 'undo' });
    });

    it('should emit redo event on Ctrl+Y', () => {
      const events: CustomEvent[] = [];
      grid.addEventListener('redo', (e: Event) => events.push(e as CustomEvent));

      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      rows[0]['name'] = 'Changed';

      plugin.onKeyDown(ctrlZ());
      plugin.onKeyDown(ctrlY());

      expect(events).toHaveLength(1);
      expect(events[0].detail).toMatchObject({ type: 'redo' });
    });
  });

  // #endregion

  // #region Keyboard handling

  describe('onKeyDown', () => {
    it('should return true for Ctrl+Z (consumed)', () => {
      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      expect(plugin.onKeyDown(ctrlZ())).toBe(true);
    });

    it('should return true for Ctrl+Y (consumed)', () => {
      expect(plugin.onKeyDown(ctrlY())).toBe(true);
    });

    it('should return false for unrelated keys', () => {
      const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
      expect(plugin.onKeyDown(event)).toBe(false);
    });

    it('should handle Ctrl+Shift+Z as redo', () => {
      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      rows[0]['name'] = 'Changed';
      plugin.onKeyDown(ctrlZ()); // undo

      const ctrlShiftZ = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      plugin.onKeyDown(ctrlShiftZ);

      expect(grid.updateRow).toHaveBeenCalledTimes(2);
      expect(grid.updateRow).toHaveBeenLastCalledWith('1', { name: 'Changed' });
    });
  });

  // #endregion

  // #region Edge cases

  describe('edge cases', () => {
    it('should not crash when row at index no longer exists', () => {
      plugin.recordEdit(5, 'name', 'Alpha', 'Changed'); // index 5 doesn't exist
      expect(() => plugin.undo()).not.toThrow();
      expect(grid.updateRow).not.toHaveBeenCalled();
    });

    it('should return null from undo() when nothing to undo', () => {
      expect(plugin.undo()).toBeNull();
    });

    it('should return null from redo() when nothing to redo', () => {
      expect(plugin.redo()).toBeNull();
    });

    it('should request render after undo', () => {
      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      rows[0]['name'] = 'Changed';
      plugin.undo();
      expect(grid.requestRender).toHaveBeenCalled();
    });

    it('should request render after redo', () => {
      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      rows[0]['name'] = 'Changed';
      plugin.undo();
      grid.requestRender.mockClear();
      plugin.redo();
      expect(grid.requestRender).toHaveBeenCalled();
    });
  });

  // #endregion
});
