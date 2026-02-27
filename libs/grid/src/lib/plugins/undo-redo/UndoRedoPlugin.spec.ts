import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UndoRedoPlugin } from './UndoRedoPlugin';

// #region Test Helpers

/**
 * Create a minimal mock grid that satisfies BaseGridPlugin.attach() requirements.
 * The mock supports getRowId / updateRow for testing #applyValue.
 */
function createMockGrid(
  rows: Record<string, unknown>[] = [],
  opts: {
    getRowId?: (row: unknown) => string;
    columns?: { field: string }[];
  } = {},
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
    requestRenderWithFocus: vi.fn(),
    requestAfterRender: vi.fn(),
    getPlugin: vi.fn(),
    getPluginByName: vi.fn(),
    query: vi.fn().mockReturnValue([]),
    queryPlugins: vi.fn().mockReturnValue([]),
    _pluginManager: pm,
    // Internal state used by #focusActionCell
    _visibleColumns: opts.columns ?? [{ field: 'id' }, { field: 'name' }, { field: 'price' }],
    _focusRow: -1,
    _focusCol: -1,
    findRenderedRowElement: vi.fn().mockReturnValue(null),
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
      expect(grid._pluginManager.subscribe).toHaveBeenCalledWith(plugin, 'cell-edit-committed', expect.any(Function));
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
      expect(grid.requestRenderWithFocus).toHaveBeenCalled();
    });

    it('should request render after redo', () => {
      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      rows[0]['name'] = 'Changed';
      plugin.undo();
      grid.requestRenderWithFocus.mockClear();
      plugin.redo();
      expect(grid.requestRenderWithFocus).toHaveBeenCalled();
    });
  });

  // #endregion

  // #region preventDefault on Ctrl+Z / Ctrl+Y

  describe('preventDefault', () => {
    it('should call preventDefault on Ctrl+Z to block browser native undo', () => {
      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      rows[0]['name'] = 'Changed';

      const event = ctrlZ();
      const spy = vi.spyOn(event, 'preventDefault');
      plugin.onKeyDown(event);

      expect(spy).toHaveBeenCalled();
    });

    it('should call preventDefault on Ctrl+Z even when nothing to undo', () => {
      const event = ctrlZ();
      const spy = vi.spyOn(event, 'preventDefault');
      plugin.onKeyDown(event);

      expect(spy).toHaveBeenCalled();
    });

    it('should call preventDefault on Ctrl+Y to block browser native redo', () => {
      const event = ctrlY();
      const spy = vi.spyOn(event, 'preventDefault');
      plugin.onKeyDown(event);

      expect(spy).toHaveBeenCalled();
    });

    it('should call preventDefault on Ctrl+Shift+Z (alternative redo)', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      const spy = vi.spyOn(event, 'preventDefault');
      plugin.onKeyDown(event);

      expect(spy).toHaveBeenCalled();
    });
  });

  // #endregion

  // #region suppressRecording (feedback loop prevention)

  describe('suppressRecording during undo/redo', () => {
    it('should not record edits triggered by undo via cell-edit-committed', () => {
      // Simulate: edit committed → undo → updateRow triggers cell-change →
      // editor re-commit → cell-edit-committed fires again.
      // Without suppressRecording, the re-commit would be recorded as a new edit,
      // wiping the redo stack.
      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      rows[0]['name'] = 'Changed';

      // Grab the cell-edit-committed handler from the subscribe call
      const subscribeCalls = grid._pluginManager.subscribe.mock.calls;
      const commitHandler = subscribeCalls.find((c: unknown[]) => c[1] === 'cell-edit-committed')?.[2] as (
        detail: Record<string, unknown>,
      ) => void;

      // Make updateRow trigger a re-commit (simulating editor feedback loop)
      grid.updateRow.mockImplementation((id: string, changes: Record<string, unknown>) => {
        const row = rows.find((r) => String(r['id']) === id);
        if (row) Object.assign(row, changes);
        // Simulate the feedback: editor re-commits the value it received via onValueChange
        commitHandler?.({
          rowIndex: 0,
          field: 'name',
          oldValue: 'Changed',
          newValue: 'Alpha',
        });
      });

      plugin.undo();

      // The redo stack should have exactly 1 entry (the original edit), not 2
      expect(plugin.getRedoStack()).toHaveLength(1);
      // The undo stack should be empty (we undid the only action)
      expect(plugin.getUndoStack()).toHaveLength(0);
    });

    it('should not record edits triggered by redo via cell-edit-committed', () => {
      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      rows[0]['name'] = 'Changed';
      plugin.undo(); // undo first

      const subscribeCalls = grid._pluginManager.subscribe.mock.calls;
      const commitHandler = subscribeCalls.find((c: unknown[]) => c[1] === 'cell-edit-committed')?.[2] as (
        detail: Record<string, unknown>,
      ) => void;

      grid.updateRow.mockImplementation((id: string, changes: Record<string, unknown>) => {
        const row = rows.find((r) => String(r['id']) === id);
        if (row) Object.assign(row, changes);
        commitHandler?.({
          rowIndex: 0,
          field: 'name',
          oldValue: 'Alpha',
          newValue: 'Changed',
        });
      });

      plugin.redo();

      // After redo: undo stack should have 1 (the original edit), redo stack should be empty
      expect(plugin.getUndoStack()).toHaveLength(1);
      expect(plugin.getRedoStack()).toHaveLength(0);
    });
  });

  // #endregion

  // #region Focus management after undo/redo

  describe('focus management', () => {
    it('should set _focusRow and _focusCol after undo', () => {
      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      rows[0]['name'] = 'Changed';

      plugin.undo();

      // 'name' is at index 1 in _visibleColumns [id, name, price]
      expect(grid._focusRow).toBe(0);
      expect(grid._focusCol).toBe(1);
    });

    it('should set _focusRow and _focusCol after redo', () => {
      plugin.recordEdit(1, 'price', 20, 50);
      rows[1]['price'] = 50;

      plugin.undo();
      plugin.redo();

      // 'price' is at index 2 in _visibleColumns [id, name, price]
      expect(grid._focusRow).toBe(1);
      expect(grid._focusCol).toBe(2);
    });

    it('should set _focusRow and _focusCol after keyboard undo', () => {
      plugin.recordEdit(0, 'price', 10, 99);
      rows[0]['price'] = 99;

      plugin.onKeyDown(ctrlZ());

      expect(grid._focusRow).toBe(0);
      expect(grid._focusCol).toBe(2);
    });

    it('should set _focusRow and _focusCol after keyboard redo', () => {
      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      rows[0]['name'] = 'Changed';

      plugin.onKeyDown(ctrlZ());
      plugin.onKeyDown(ctrlY());

      expect(grid._focusRow).toBe(0);
      expect(grid._focusCol).toBe(1);
    });

    it('should not crash when field is not in visible columns', () => {
      plugin.recordEdit(0, 'nonexistent', 'a', 'b');

      // Should not throw, focus should not be set
      expect(() => plugin.undo()).not.toThrow();
      expect(grid._focusRow).toBe(-1);
      expect(grid._focusCol).toBe(-1);
    });

    it('should focus editor input when cell is in editing mode', async () => {
      // Create a mock row element with an editing cell containing an input
      const input = document.createElement('input');
      const focusSpy = vi.spyOn(input, 'focus');
      const cellEl = document.createElement('div');
      cellEl.classList.add('cell', 'editing');
      cellEl.setAttribute('data-col', '1');
      cellEl.appendChild(input);
      const rowEl = document.createElement('div');
      rowEl.appendChild(cellEl);

      grid.findRenderedRowElement.mockReturnValue(rowEl);

      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      rows[0]['name'] = 'Changed';

      plugin.undo();

      // The focus happens in a queueMicrotask, so we need to wait
      await new Promise((r) => queueMicrotask(r));

      expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    });

    it('should not focus editor when cell is not in editing mode', async () => {
      const input = document.createElement('input');
      const focusSpy = vi.spyOn(input, 'focus');
      const cellEl = document.createElement('div');
      cellEl.classList.add('cell'); // no 'editing' class
      cellEl.setAttribute('data-col', '1');
      cellEl.appendChild(input);
      const rowEl = document.createElement('div');
      rowEl.appendChild(cellEl);

      grid.findRenderedRowElement.mockReturnValue(rowEl);

      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      rows[0]['name'] = 'Changed';

      plugin.undo();

      await new Promise((r) => queueMicrotask(r));

      expect(focusSpy).not.toHaveBeenCalled();
    });
  });

  // #endregion

  // #region Transaction API (beginTransaction / endTransaction)

  describe('beginTransaction / endTransaction', () => {
    it('should group multiple recordEdit calls into a single compound action', () => {
      plugin.beginTransaction();
      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      plugin.recordEdit(0, 'price', 10, 99);
      plugin.endTransaction();

      expect(plugin.getUndoStack()).toHaveLength(1);
      const entry = plugin.getUndoStack()[0];
      expect(entry.type).toBe('compound');
      if (entry.type === 'compound') {
        expect(entry.actions).toHaveLength(2);
        expect(entry.actions[0].field).toBe('name');
        expect(entry.actions[1].field).toBe('price');
      }
    });

    it('should push single edit as regular EditAction (no wrapper)', () => {
      plugin.beginTransaction();
      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      plugin.endTransaction();

      const entry = plugin.getUndoStack()[0];
      expect(entry.type).toBe('cell-edit');
    });

    it('should no-op when transaction buffer is empty', () => {
      plugin.beginTransaction();
      plugin.endTransaction();

      expect(plugin.getUndoStack()).toHaveLength(0);
    });

    it('should throw if beginTransaction is called while already in a transaction', () => {
      plugin.beginTransaction();
      expect(() => plugin.beginTransaction()).toThrow(/already in progress/);
      plugin.endTransaction(); // cleanup
    });

    it('should throw if endTransaction is called without beginTransaction', () => {
      expect(() => plugin.endTransaction()).toThrow(/No transaction in progress/);
    });

    it('should capture auto-recorded edits during transaction', () => {
      // Simulate: beginTransaction, then cell-edit-committed fires (which calls recordEdit internally)
      plugin.beginTransaction();

      // Manual cascaded edit
      plugin.recordEdit(0, 'price', 10, 99);

      // Simulate auto-recorded edit from cell-edit-committed event bus
      const subscribeCalls = grid._pluginManager.subscribe.mock.calls;
      const commitHandler = subscribeCalls.find((c: unknown[]) => c[1] === 'cell-edit-committed')?.[2] as (
        detail: Record<string, unknown>,
      ) => void;
      commitHandler?.({ rowIndex: 0, field: 'name', oldValue: 'Alpha', newValue: 'Changed' });

      plugin.endTransaction();

      expect(plugin.getUndoStack()).toHaveLength(1);
      const entry = plugin.getUndoStack()[0];
      expect(entry.type).toBe('compound');
      if (entry.type === 'compound') {
        expect(entry.actions).toHaveLength(2);
      }
    });

    it('should clear transaction buffer on detach', () => {
      plugin.beginTransaction();
      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      plugin.detach();

      // Re-attach and verify clean state
      plugin.attach(grid);
      expect(plugin.getUndoStack()).toHaveLength(0);
      expect(() => plugin.endTransaction()).toThrow(/No transaction in progress/);
    });

    it('should clear transaction buffer on clearHistory', () => {
      plugin.beginTransaction();
      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      plugin.clearHistory();

      // Transaction was aborted — endTransaction should throw
      expect(() => plugin.endTransaction()).toThrow(/No transaction in progress/);
      expect(plugin.getUndoStack()).toHaveLength(0);
    });
  });

  // #endregion

  // #region Compound undo / redo

  describe('compound undo / redo', () => {
    it('should revert all edits in a compound on undo', () => {
      rows[0]['name'] = 'Changed';
      rows[0]['price'] = 99;

      plugin.beginTransaction();
      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      plugin.recordEdit(0, 'price', 10, 99);
      plugin.endTransaction();

      plugin.undo();

      // Both fields should be reverted via updateRow
      expect(grid.updateRow).toHaveBeenCalledWith('1', { price: 10 });
      expect(grid.updateRow).toHaveBeenCalledWith('1', { name: 'Alpha' });
    });

    it('should undo compound in reverse order', () => {
      rows[0]['name'] = 'Changed';
      rows[0]['price'] = 99;

      plugin.beginTransaction();
      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      plugin.recordEdit(0, 'price', 10, 99);
      plugin.endTransaction();

      const calls: string[] = [];
      grid.updateRow.mockImplementation((_id: string, changes: Record<string, unknown>) => {
        calls.push(Object.keys(changes)[0]);
        const row = rows.find((r) => String(r['id']) === _id);
        if (row) Object.assign(row, changes);
      });

      plugin.undo();

      // price was recorded second → undone first (reverse order)
      expect(calls).toEqual(['price', 'name']);
    });

    it('should redo compound in forward order', () => {
      rows[0]['name'] = 'Changed';
      rows[0]['price'] = 99;

      plugin.beginTransaction();
      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      plugin.recordEdit(0, 'price', 10, 99);
      plugin.endTransaction();

      plugin.undo();

      const calls: string[] = [];
      grid.updateRow.mockImplementation((_id: string, changes: Record<string, unknown>) => {
        calls.push(Object.keys(changes)[0]);
        const row = rows.find((r) => String(r['id']) === _id);
        if (row) Object.assign(row, changes);
      });

      plugin.redo();

      // Forward order on redo: name first, then price
      expect(calls).toEqual(['name', 'price']);
    });

    it('should focus last action cell after compound undo (primary field)', () => {
      rows[0]['name'] = 'Changed';
      rows[0]['price'] = 99;

      plugin.beginTransaction();
      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      plugin.recordEdit(0, 'price', 10, 99);
      plugin.endTransaction();

      plugin.undo();

      // Last action is 'price' at _visibleColumns index 2 (the primary field
      // when using beginTransaction + queueMicrotask endTransaction pattern)
      expect(grid._focusRow).toBe(0);
      expect(grid._focusCol).toBe(2);
    });

    it('should handle keyboard undo of compound action', () => {
      rows[0]['name'] = 'Changed';
      rows[0]['price'] = 99;

      plugin.beginTransaction();
      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      plugin.recordEdit(0, 'price', 10, 99);
      plugin.endTransaction();

      const events: CustomEvent[] = [];
      grid.addEventListener('undo', (e: Event) => events.push(e as CustomEvent));

      plugin.onKeyDown(ctrlZ());

      expect(events).toHaveLength(1);
      expect(events[0].detail.action.type).toBe('compound');
      expect(grid.updateRow).toHaveBeenCalledTimes(2);
    });

    it('should handle keyboard redo of compound action', () => {
      rows[0]['name'] = 'Changed';
      rows[0]['price'] = 99;

      plugin.beginTransaction();
      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      plugin.recordEdit(0, 'price', 10, 99);
      plugin.endTransaction();

      plugin.onKeyDown(ctrlZ()); // undo first
      grid.updateRow.mockClear();

      const events: CustomEvent[] = [];
      grid.addEventListener('redo', (e: Event) => events.push(e as CustomEvent));

      plugin.onKeyDown(ctrlY());

      expect(events).toHaveLength(1);
      expect(events[0].detail.action.type).toBe('compound');
      expect(grid.updateRow).toHaveBeenCalledTimes(2);
    });

    it('should not record during compound undo (suppressRecording)', () => {
      plugin.beginTransaction();
      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      plugin.recordEdit(0, 'price', 10, 99);
      plugin.endTransaction();

      rows[0]['name'] = 'Changed';
      rows[0]['price'] = 99;

      // Simulate feedback: updateRow triggers cell-edit-committed
      const subscribeCalls = grid._pluginManager.subscribe.mock.calls;
      const commitHandler = subscribeCalls.find((c: unknown[]) => c[1] === 'cell-edit-committed')?.[2] as (
        detail: Record<string, unknown>,
      ) => void;

      grid.updateRow.mockImplementation((_id: string, changes: Record<string, unknown>) => {
        const row = rows.find((r) => String(r['id']) === _id);
        if (row) Object.assign(row, changes);
        const key = Object.keys(changes)[0];
        commitHandler?.({ rowIndex: 0, field: key, oldValue: changes[key], newValue: 'feedback' });
      });

      plugin.undo();

      // Should have 1 compound on the redo stack, nothing extra on undo
      expect(plugin.getUndoStack()).toHaveLength(0);
      expect(plugin.getRedoStack()).toHaveLength(1);
    });

    it('should request render after compound undo', () => {
      plugin.beginTransaction();
      plugin.recordEdit(0, 'name', 'Alpha', 'Changed');
      plugin.recordEdit(0, 'price', 10, 99);
      plugin.endTransaction();

      rows[0]['name'] = 'Changed';
      rows[0]['price'] = 99;

      plugin.undo();
      expect(grid.requestRenderWithFocus).toHaveBeenCalled();
    });
  });

  // #endregion
});
