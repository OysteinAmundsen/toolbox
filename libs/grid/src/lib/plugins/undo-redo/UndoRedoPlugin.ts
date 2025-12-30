/**
 * Undo/Redo Plugin (Class-based)
 *
 * Provides undo/redo functionality for cell edits in tbw-grid.
 * Supports Ctrl+Z/Cmd+Z for undo and Ctrl+Y/Cmd+Y (or Ctrl+Shift+Z) for redo.
 */

import { BaseGridPlugin } from '../../core/plugin/base-plugin';
import { canRedo, canUndo, clearHistory, createEditAction, pushAction, redo, undo } from './history';
import type { EditAction, UndoRedoConfig, UndoRedoDetail } from './types';

/**
 * Class-based Undo/Redo plugin for tbw-grid.
 *
 * Tracks cell edits and provides undo/redo functionality via keyboard shortcuts
 * or programmatic API.
 */
export class UndoRedoPlugin extends BaseGridPlugin<UndoRedoConfig> {
  readonly name = 'undoRedo';
  override readonly version = '1.0.0';

  protected override get defaultConfig(): Partial<UndoRedoConfig> {
    return {
      maxHistorySize: 100,
    };
  }

  // State as class properties
  private undoStack: EditAction[] = [];
  private redoStack: EditAction[] = [];

  /**
   * Clean up state when plugin is detached.
   */
  override detach(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * Handle keyboard shortcuts for undo/redo.
   * - Ctrl+Z / Cmd+Z: Undo
   * - Ctrl+Y / Cmd+Y / Ctrl+Shift+Z / Cmd+Shift+Z: Redo
   */
  override onKeyDown(event: KeyboardEvent): boolean {
    const isUndo = (event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey;
    const isRedo = (event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey));

    if (isUndo) {
      const result = undo({ undoStack: this.undoStack, redoStack: this.redoStack });
      if (result.action) {
        // Apply undo - restore old value
        const rows = this.rows as Record<string, unknown>[];
        if (rows[result.action.rowIndex]) {
          rows[result.action.rowIndex][result.action.field] = result.action.oldValue;
        }

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
        // Apply redo - restore new value
        const rows = this.rows as Record<string, unknown>[];
        if (rows[result.action.rowIndex]) {
          rows[result.action.rowIndex][result.action.field] = result.action.newValue;
        }

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

  // ===== Public API Methods =====

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
      const rows = this.rows as Record<string, unknown>[];
      if (rows[result.action.rowIndex]) {
        rows[result.action.rowIndex][result.action.field] = result.action.oldValue;
      }
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
      const rows = this.rows as Record<string, unknown>[];
      if (rows[result.action.rowIndex]) {
        rows[result.action.rowIndex][result.action.field] = result.action.newValue;
      }
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
}
