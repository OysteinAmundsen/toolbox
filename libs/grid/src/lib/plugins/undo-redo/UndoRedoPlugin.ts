/**
 * Undo/Redo Plugin (Class-based)
 *
 * Provides undo/redo functionality for cell edits in tbw-grid.
 * Supports Ctrl+Z/Cmd+Z for undo and Ctrl+Y/Cmd+Y (or Ctrl+Shift+Z) for redo.
 */

import { FOCUSABLE_EDITOR_SELECTOR } from '../../core/internal/rows';
import { BaseGridPlugin, type GridElement, type PluginDependency } from '../../core/plugin/base-plugin';
import type { InternalGrid } from '../../core/types';
import {
  canRedo,
  canUndo,
  clearHistory,
  createCompoundAction,
  createEditAction,
  pushAction,
  redo,
  undo,
} from './history';
import type { EditAction, UndoRedoAction, UndoRedoConfig, UndoRedoDetail } from './types';

/**
 * Undo/Redo Plugin for tbw-grid
 *
 * Tracks all cell edits and lets users revert or replay changes with familiar keyboard
 * shortcuts (Ctrl+Z / Ctrl+Y). Maintains an in-memory history stack with configurable
 * depth—perfect for data entry workflows where mistakes happen.
 *
 * > **Required Dependency:** This plugin requires EditingPlugin to be loaded first.
 * > UndoRedo tracks the edit history that EditingPlugin creates.
 *
 * ## Installation
 *
 * ```ts
 * import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';
 * import { UndoRedoPlugin } from '@toolbox-web/grid/plugins/undo-redo';
 * ```
 *
 * ## Configuration Options
 *
 * | Option | Type | Default | Description |
 * |--------|------|---------|-------------|
 * | `maxHistorySize` | `number` | `100` | Maximum actions in history stack |
 *
 * ## Keyboard Shortcuts
 *
 * | Shortcut | Action |
 * |----------|--------|
 * | `Ctrl+Z` / `Cmd+Z` | Undo last edit |
 * | `Ctrl+Y` / `Cmd+Shift+Z` | Redo last undone edit |
 *
 * ## Programmatic API
 *
 * | Method | Signature | Description |
 * |--------|-----------|-------------|
 * | `undo` | `() => UndoRedoAction \| null` | Undo the last edit (or compound) |
 * | `redo` | `() => UndoRedoAction \| null` | Redo the last undone edit (or compound) |
 * | `canUndo` | `() => boolean` | Check if undo is available |
 * | `canRedo` | `() => boolean` | Check if redo is available |
 * | `clearHistory` | `() => void` | Clear the entire history stack |
 * | `recordEdit` | `(rowIndex, field, old, new) => void` | Manually record a cell edit |
 * | `beginTransaction` | `() => void` | Start grouping edits into a compound |
 * | `endTransaction` | `() => void` | Finalize and push the compound action |
 *
 * @example Basic Usage with EditingPlugin
 * ```ts
 * import '@toolbox-web/grid';
 * import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';
 * import { UndoRedoPlugin } from '@toolbox-web/grid/plugins/undo-redo';
 *
 * const grid = document.querySelector('tbw-grid');
 * grid.gridConfig = {
 *   columns: [
 *     { field: 'name', header: 'Name', editable: true },
 *     { field: 'price', header: 'Price', type: 'number', editable: true },
 *   ],
 *   plugins: [
 *     new EditingPlugin({ editOn: 'dblclick' }), // Required - must be first
 *     new UndoRedoPlugin({ maxHistorySize: 50 }),
 *   ],
 * };
 * ```
 *
 * @see {@link UndoRedoConfig} for configuration options
 * @see {@link EditingPlugin} for the required dependency
 *
 * @internal Extends BaseGridPlugin
 */
export class UndoRedoPlugin extends BaseGridPlugin<UndoRedoConfig> {
  /**
   * Plugin dependencies - UndoRedoPlugin requires EditingPlugin to track edits.
   *
   * The EditingPlugin must be loaded BEFORE this plugin in the plugins array.
   * @internal
   */
  static override readonly dependencies: PluginDependency[] = [
    { name: 'editing', required: true, reason: 'UndoRedoPlugin tracks cell edit history' },
  ];

  /** @internal */
  readonly name = 'undoRedo';

  /** @internal */
  protected override get defaultConfig(): Partial<UndoRedoConfig> {
    return {
      maxHistorySize: 100,
    };
  }

  // State as class properties
  private undoStack: UndoRedoAction[] = [];
  private redoStack: UndoRedoAction[] = [];

  /** Suppresses recording during undo/redo to prevent feedback loops. */
  #suppressRecording = false;

  /** Accumulates edits during a transaction; `null` when no transaction is active. */
  #transactionBuffer: EditAction[] | null = null;

  /**
   * Apply a value to a row cell, using `updateRow()` when possible so that
   * active editors (during row-edit mode) are notified via the `cell-change`
   * → `onValueChange` pipeline. Falls back to direct mutation when the row
   * has no ID.
   */
  #applyValue(action: EditAction, value: unknown): void {
    const rows = this.rows as Record<string, unknown>[];
    const row = rows[action.rowIndex];
    if (!row) return;

    // Prefer updateRow() — it emits `cell-change` events which notify active
    // editors via their `onValueChange` callbacks. Without this, undo/redo
    // during row-edit mode is invisible because the render pipeline skips
    // cells that have active editors.
    try {
      const rowId = this.grid.getRowId(row);
      if (rowId) {
        this.grid.updateRow(rowId, { [action.field]: value });
        return;
      }
    } catch {
      // No row ID configured — fall back to direct mutation
    }

    // Fallback: direct mutation (editors won't see the change during editing)
    row[action.field] = value;
  }

  /**
   * Move keyboard focus to the cell targeted by an undo/redo action.
   * If the grid is in row-edit mode and the cell has an active editor,
   * the editor input is focused so the user can continue editing.
   */
  #focusActionCell(action: EditAction): void {
    const internalGrid = this.grid as unknown as InternalGrid;

    // Map field name → visible column index
    const colIdx = internalGrid._visibleColumns?.findIndex((c) => c.field === action.field) ?? -1;
    if (colIdx < 0) return;

    internalGrid._focusRow = action.rowIndex;
    internalGrid._focusCol = colIdx;

    // If we're in row-edit mode, focus the editor input in the target cell
    const rowEl = internalGrid.findRenderedRowElement?.(action.rowIndex);
    if (rowEl) {
      const cellEl = rowEl.querySelector(`.cell[data-col="${colIdx}"]`) as HTMLElement | null;
      if (cellEl?.classList.contains('editing')) {
        // Defer focus to next microtask so the render cycle can update the editor value first
        queueMicrotask(() => {
          const editor = cellEl.querySelector(FOCUSABLE_EDITOR_SELECTOR) as HTMLElement | null;
          editor?.focus({ preventScroll: true });
        });
      }
    }
  }

  /**
   * Apply value changes for a single or compound action.
   * Wraps `#applyValue` calls with `#suppressRecording` to prevent feedback loops.
   */
  #applyUndoRedoAction(action: UndoRedoAction, direction: 'undo' | 'redo'): void {
    this.#suppressRecording = true;
    if (action.type === 'compound') {
      const subActions = direction === 'undo' ? [...action.actions].reverse() : action.actions;
      for (const sub of subActions) {
        this.#applyValue(sub, direction === 'undo' ? sub.oldValue : sub.newValue);
      }
    } else {
      this.#applyValue(action, direction === 'undo' ? action.oldValue : action.newValue);
    }
    this.#suppressRecording = false;
  }

  /**
   * Focus the cell associated with an undo/redo action.
   * For compound actions, focuses the first action's cell (the user's original edit).
   */
  #focusUndoRedoAction(action: UndoRedoAction): void {
    const target = action.type === 'compound' ? action.actions[0] : action;
    if (target) this.#focusActionCell(target);
  }

  /**
   * Subscribe to cell-edit-committed events from EditingPlugin.
   * @internal
   */
  override attach(grid: GridElement): void {
    super.attach(grid);
    // Auto-record edits via Event Bus
    this.on(
      'cell-edit-committed',
      (detail: { rowIndex: number; field: string; oldValue: unknown; newValue: unknown }) => {
        // Skip recording during undo/redo operations. When undo/redo applies a
        // value via updateRow, two things can cause re-entry:
        // 1. updateRow → cell-change → onValueChange → editor triggers commit
        // 2. Browser native undo (if not fully suppressed) fires input event → commit
        // The suppress flag prevents these from corrupting the history stacks.
        if (this.#suppressRecording) return;
        this.recordEdit(detail.rowIndex, detail.field, detail.oldValue, detail.newValue);
      },
    );
  }

  /**
   * Clean up state when plugin is detached.
   * @internal
   */
  override detach(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.#transactionBuffer = null;
  }

  /**
   * Handle keyboard shortcuts for undo/redo.
   * - Ctrl+Z / Cmd+Z: Undo
   * - Ctrl+Y / Cmd+Y / Ctrl+Shift+Z / Cmd+Shift+Z: Redo
   * @internal
   */
  override onKeyDown(event: KeyboardEvent): boolean {
    const isUndo = (event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey;
    const isRedo = (event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey));

    if (isUndo) {
      // Prevent browser native undo on text inputs — it would conflict
      // with the grid's undo by mutating the input text independently,
      // triggering re-commits that cancel the grid undo.
      event.preventDefault();

      const result = undo({ undoStack: this.undoStack, redoStack: this.redoStack });
      if (result.action) {
        this.#applyUndoRedoAction(result.action, 'undo');

        // Update state from result
        this.undoStack = result.newState.undoStack;
        this.redoStack = result.newState.redoStack;

        this.emit<UndoRedoDetail>('undo', {
          action: result.action,
          type: 'undo',
        });

        this.#focusUndoRedoAction(result.action);
        this.requestRender();
      }
      return true;
    }

    if (isRedo) {
      // Prevent browser native redo — same reason as undo above
      event.preventDefault();

      const result = redo({ undoStack: this.undoStack, redoStack: this.redoStack });
      if (result.action) {
        this.#applyUndoRedoAction(result.action, 'redo');

        // Update state from result
        this.undoStack = result.newState.undoStack;
        this.redoStack = result.newState.redoStack;

        this.emit<UndoRedoDetail>('redo', {
          action: result.action,
          type: 'redo',
        });

        this.#focusUndoRedoAction(result.action);
        this.requestRender();
      }
      return true;
    }

    return false;
  }

  // #region Public API Methods

  /**
   * Record a cell edit for undo/redo tracking.
   * Call this when a cell value changes.
   *
   * @param rowIndex - The row index where the edit occurred
   * @param field - The field (column key) that was edited
   * @param oldValue - The value before the edit
   * @param newValue - The value after the edit
   */
  recordEdit(rowIndex: number, field: string, oldValue: unknown, newValue: unknown): void {
    const action = createEditAction(rowIndex, field, oldValue, newValue);

    // Buffer during transactions instead of pushing to undo stack
    if (this.#transactionBuffer) {
      this.#transactionBuffer.push(action);
      return;
    }

    const newState = pushAction(
      { undoStack: this.undoStack, redoStack: this.redoStack },
      action,
      this.config.maxHistorySize ?? 100,
    );
    this.undoStack = newState.undoStack;
    this.redoStack = newState.redoStack;
  }

  /**
   * Begin grouping subsequent edits into a single compound action.
   *
   * While a transaction is active, all `recordEdit()` calls (both manual
   * and auto-recorded from `cell-edit-committed`) are buffered instead of
   * pushed to the undo stack. Call `endTransaction()` to finalize the group.
   *
   * **Typical usage** — group a user edit with its cascaded side-effects:
   *
   * ```ts
   * grid.addEventListener('cell-commit', (e) => {
   *   const undoRedo = grid.getPluginByName('undoRedo');
   *   undoRedo.beginTransaction();
   *
   *   // Record cascaded updates (these won't auto-record)
   *   const oldB = row.fieldB;
   *   undoRedo.recordEdit(rowIndex, 'fieldB', oldB, computedB);
   *   grid.updateRow(rowId, { fieldB: computedB });
   *
   *   // End after the auto-recorded original edit is captured
   *   queueMicrotask(() => undoRedo.endTransaction());
   * });
   * ```
   *
   * @throws Error if a transaction is already in progress
   */
  beginTransaction(): void {
    if (this.#transactionBuffer) {
      throw new Error('UndoRedoPlugin: Transaction already in progress. Call endTransaction() first.');
    }
    this.#transactionBuffer = [];
  }

  /**
   * Finalize the current transaction, wrapping all buffered edits into a
   * single compound action on the undo stack.
   *
   * - If the buffer contains multiple edits, they are wrapped in a `CompoundEditAction`.
   * - If the buffer contains a single edit, it is pushed as a regular `EditAction`.
   * - If the buffer is empty, this is a no-op.
   *
   * Undoing a compound action reverts all edits in reverse order; redoing
   * replays them in forward order.
   *
   * @throws Error if no transaction is in progress
   */
  endTransaction(): void {
    const buffer = this.#transactionBuffer;
    if (!buffer) {
      throw new Error('UndoRedoPlugin: No transaction in progress. Call beginTransaction() first.');
    }
    this.#transactionBuffer = null;

    if (buffer.length === 0) return;

    const action: UndoRedoAction = buffer.length === 1 ? buffer[0] : createCompoundAction(buffer);
    const newState = pushAction(
      { undoStack: this.undoStack, redoStack: this.redoStack },
      action,
      this.config.maxHistorySize ?? 100,
    );
    this.undoStack = newState.undoStack;
    this.redoStack = newState.redoStack;
  }

  /**
   * Programmatically undo the last action.
   *
   * @returns The undone action, or null if nothing to undo
   */
  undo(): UndoRedoAction | null {
    const result = undo({ undoStack: this.undoStack, redoStack: this.redoStack });
    if (result.action) {
      this.#applyUndoRedoAction(result.action, 'undo');
      this.undoStack = result.newState.undoStack;
      this.redoStack = result.newState.redoStack;
      this.#focusUndoRedoAction(result.action);
      this.requestRender();
    }
    return result.action;
  }

  /**
   * Programmatically redo the last undone action.
   *
   * @returns The redone action, or null if nothing to redo
   */
  redo(): UndoRedoAction | null {
    const result = redo({ undoStack: this.undoStack, redoStack: this.redoStack });
    if (result.action) {
      this.#applyUndoRedoAction(result.action, 'redo');
      this.undoStack = result.newState.undoStack;
      this.redoStack = result.newState.redoStack;
      this.#focusUndoRedoAction(result.action);
      this.requestRender();
    }
    return result.action;
  }

  /**
   * Check if there are any actions that can be undone.
   */
  canUndo(): boolean {
    return canUndo({ undoStack: this.undoStack, redoStack: this.redoStack });
  }

  /**
   * Check if there are any actions that can be redone.
   */
  canRedo(): boolean {
    return canRedo({ undoStack: this.undoStack, redoStack: this.redoStack });
  }

  /**
   * Clear all undo/redo history.
   */
  clearHistory(): void {
    const newState = clearHistory();
    this.undoStack = newState.undoStack;
    this.redoStack = newState.redoStack;
    this.#transactionBuffer = null;
  }

  /**
   * Get a copy of the current undo stack.
   */
  getUndoStack(): UndoRedoAction[] {
    return [...this.undoStack];
  }

  /**
   * Get a copy of the current redo stack.
   */
  getRedoStack(): UndoRedoAction[] {
    return [...this.redoStack];
  }
  // #endregion
}
