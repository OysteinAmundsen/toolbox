/**
 * Undo/Redo Plugin (Class-based)
 *
 * Provides undo/redo functionality for cell edits in tbw-grid.
 * Supports Ctrl+Z/Cmd+Z for undo and Ctrl+Y/Cmd+Y (or Ctrl+Shift+Z) for redo.
 */

import { BaseGridPlugin, type GridElement, type PluginDependency } from '../../core/plugin/base-plugin';
import { canRedo, canUndo, clearHistory, createEditAction, pushAction, redo, undo } from './history';
import type { EditAction, UndoRedoConfig, UndoRedoDetail } from './types';

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
 * | `undo` | `() => void` | Undo the last edit |
 * | `redo` | `() => void` | Redo the last undone edit |
 * | `canUndo` | `() => boolean` | Check if undo is available |
 * | `canRedo` | `() => boolean` | Check if redo is available |
 * | `clearHistory` | `() => void` | Clear the entire history stack |
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
  private undoStack: EditAction[] = [];
  private redoStack: EditAction[] = [];

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
   * Subscribe to cell-edit-committed events from EditingPlugin.
   * @internal
   */
  override attach(grid: GridElement): void {
    super.attach(grid);
    // Auto-record edits via Event Bus
    this.on(
      'cell-edit-committed',
      (detail: { rowIndex: number; field: string; oldValue: unknown; newValue: unknown }) => {
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
      const result = undo({ undoStack: this.undoStack, redoStack: this.redoStack });
      if (result.action) {
        this.#applyValue(result.action, result.action.oldValue);

        // Update state from result
        this.undoStack = result.newState.undoStack;
        this.redoStack = result.newState.redoStack;

        this.emit<UndoRedoDetail>('undo', {
          action: result.action,
          type: 'undo',
        });

        this.requestRender();
      }
      return true;
    }

    if (isRedo) {
      const result = redo({ undoStack: this.undoStack, redoStack: this.redoStack });
      if (result.action) {
        this.#applyValue(result.action, result.action.newValue);

        // Update state from result
        this.undoStack = result.newState.undoStack;
        this.redoStack = result.newState.redoStack;

        this.emit<UndoRedoDetail>('redo', {
          action: result.action,
          type: 'redo',
        });

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
  undo(): EditAction | null {
    const result = undo({ undoStack: this.undoStack, redoStack: this.redoStack });
    if (result.action) {
      this.#applyValue(result.action, result.action.oldValue);
      this.undoStack = result.newState.undoStack;
      this.redoStack = result.newState.redoStack;
      this.requestRender();
    }
    return result.action;
  }

  /**
   * Programmatically redo the last undone action.
   *
   * @returns The redone action, or null if nothing to redo
   */
  redo(): EditAction | null {
    const result = redo({ undoStack: this.undoStack, redoStack: this.redoStack });
    if (result.action) {
      this.#applyValue(result.action, result.action.newValue);
      this.undoStack = result.newState.undoStack;
      this.redoStack = result.newState.redoStack;
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
  }

  /**
   * Get a copy of the current undo stack.
   */
  getUndoStack(): EditAction[] {
    return [...this.undoStack];
  }

  /**
   * Get a copy of the current redo stack.
   */
  getRedoStack(): EditAction[] {
    return [...this.redoStack];
  }
  // #endregion
}
