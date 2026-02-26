/**
 * Undo/Redo feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `undoRedo` input on Grid directive.
 * Also exports `injectGridUndoRedo()` for programmatic undo/redo control.
 * Requires editing feature to be enabled.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/editing';
 * import '@toolbox-web/grid-angular/features/undo-redo';
 *
 * <tbw-grid [editing]="'dblclick'" [undoRedo]="true" />
 * ```
 *
 * @example Using injectGridUndoRedo
 * ```typescript
 * import { injectGridUndoRedo } from '@toolbox-web/grid-angular/features/undo-redo';
 *
 * @Component({...})
 * export class MyComponent {
 *   private undoRedo = injectGridUndoRedo();
 *
 *   undo() { this.undoRedo.undo(); }
 *   redo() { this.undoRedo.redo(); }
 * }
 * ```
 *
 * @packageDocumentation
 */

import { afterNextRender, DestroyRef, ElementRef, inject, signal, type Signal } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { registerFeature } from '@toolbox-web/grid-angular';
import { UndoRedoPlugin, type UndoRedoAction } from '@toolbox-web/grid/plugins/undo-redo';

registerFeature('undoRedo', (config) => {
  if (config === true) {
    return new UndoRedoPlugin();
  }
  return new UndoRedoPlugin(config ?? undefined);
});

/**
 * Undo/Redo methods returned from injectGridUndoRedo.
 *
 * Uses lazy discovery - the grid is found on first method call, not during initialization.
 */
export interface UndoRedoMethods {
  /**
   * Undo the last edit action.
   * @returns The undone action (or compound action), or null if nothing to undo
   */
  undo: () => UndoRedoAction | null;

  /**
   * Redo the last undone action.
   * @returns The redone action (or compound action), or null if nothing to redo
   */
  redo: () => UndoRedoAction | null;

  /**
   * Reactive signal indicating whether undo is available.
   * Updates automatically when edits are made, undone, redone, or history is cleared.
   *
   * @example
   * ```typescript
   * // In template:
   * // <button [disabled]="!undoRedo.canUndo()">Undo</button>
   *
   * // In computed:
   * readonly undoAvailable = computed(() => this.undoRedo.canUndo());
   * ```
   */
  canUndo: Signal<boolean>;

  /**
   * Reactive signal indicating whether redo is available.
   * Updates automatically when edits are made, undone, redone, or history is cleared.
   *
   * @example
   * ```typescript
   * // In template:
   * // <button [disabled]="!undoRedo.canRedo()">Redo</button>
   *
   * // In computed:
   * readonly redoAvailable = computed(() => this.undoRedo.canRedo());
   * ```
   */
  canRedo: Signal<boolean>;

  /**
   * Clear all undo/redo history.
   */
  clearHistory: () => void;

  /**
   * Get a copy of the current undo stack.
   */
  getUndoStack: () => UndoRedoAction[];

  /**
   * Get a copy of the current redo stack.
   */
  getRedoStack: () => UndoRedoAction[];

  /**
   * Manually record an edit action.
   * If a transaction is active, the action is buffered; otherwise it's pushed to the undo stack.
   */
  recordEdit: (rowIndex: number, field: string, oldValue: unknown, newValue: unknown) => void;

  /**
   * Begin a transaction. All edits recorded until `endTransaction()` are grouped
   * into a single compound action for undo/redo.
   * @throws If a transaction is already active
   */
  beginTransaction: () => void;

  /**
   * End the active transaction and push the compound action to the undo stack.
   * If only one edit was recorded, it's pushed as a plain EditAction.
   * If no edits were recorded, the transaction is discarded.
   * @throws If no transaction is active
   */
  endTransaction: () => void;

  /**
   * Signal indicating if grid is ready.
   */
  isReady: Signal<boolean>;
}

/**
 * Angular inject function for programmatic undo/redo control.
 *
 * Uses **lazy grid discovery** - the grid element is found when methods are called,
 * not during initialization.
 *
 * @example
 * ```typescript
 * import { Component } from '@angular/core';
 * import { Grid } from '@toolbox-web/grid-angular';
 * import '@toolbox-web/grid-angular/features/editing';
 * import '@toolbox-web/grid-angular/features/undo-redo';
 * import { injectGridUndoRedo } from '@toolbox-web/grid-angular/features/undo-redo';
 *
 * @Component({
 *   selector: 'app-my-grid',
 *   imports: [Grid],
 *   template: `
 *     <button (click)="undoRedo.undo()" [disabled]="!undoRedo.canUndo()">Undo</button>
 *     <button (click)="undoRedo.redo()" [disabled]="!undoRedo.canRedo()">Redo</button>
 *     <tbw-grid [rows]="rows" [editing]="'dblclick'" [undoRedo]="true"></tbw-grid>
 *   `
 * })
 * export class MyGridComponent {
 *   undoRedo = injectGridUndoRedo();
 * }
 * ```
 */
export function injectGridUndoRedo(): UndoRedoMethods {
  const elementRef = inject(ElementRef);
  const destroyRef = inject(DestroyRef);
  const isReady = signal(false);

  // Reactive undo/redo availability signals
  const canUndoSignal = signal(false);
  const canRedoSignal = signal(false);

  let cachedGrid: DataGridElement | null = null;
  let readyPromiseStarted = false;
  let listenerAttached = false;

  /**
   * Sync canUndo/canRedo signals with the current plugin state.
   */
  const syncSignals = (): void => {
    const plugin = getPlugin();
    if (plugin) {
      canUndoSignal.set(plugin.canUndo());
      canRedoSignal.set(plugin.canRedo());
    }
  };

  /**
   * Attach event listeners to the grid for undo/redo state changes.
   * Listens for `undo`, `redo`, and `cell-commit` DOM events.
   */
  const attachListeners = (grid: DataGridElement): void => {
    if (listenerAttached) return;
    listenerAttached = true;

    grid.addEventListener('undo', syncSignals);
    grid.addEventListener('redo', syncSignals);
    grid.addEventListener('cell-commit', syncSignals);

    destroyRef.onDestroy(() => {
      grid.removeEventListener('undo', syncSignals);
      grid.removeEventListener('redo', syncSignals);
      grid.removeEventListener('cell-commit', syncSignals);
    });
  };

  const getGrid = (): DataGridElement | null => {
    if (cachedGrid) return cachedGrid;

    const grid = elementRef.nativeElement.querySelector('tbw-grid') as DataGridElement | null;
    if (grid) {
      cachedGrid = grid;
      attachListeners(grid);
      if (!readyPromiseStarted) {
        readyPromiseStarted = true;
        grid.ready?.().then(() => isReady.set(true));
      }
    }
    return grid;
  };

  const getPlugin = (): UndoRedoPlugin | undefined => {
    return getGrid()?.getPlugin(UndoRedoPlugin);
  };

  // Eagerly discover the grid after the first render so event listeners
  // are attached and isReady updates without requiring a programmatic
  // method call. Falls back to MutationObserver for lazy-rendered content.
  afterNextRender(() => {
    const grid = getGrid();
    if (grid) {
      grid.ready?.().then(syncSignals);
      return;
    }

    const host = elementRef.nativeElement as HTMLElement;
    const observer = new MutationObserver(() => {
      const discovered = getGrid();
      if (discovered) {
        observer.disconnect();
        discovered.ready?.().then(syncSignals);
      }
    });
    observer.observe(host, { childList: true, subtree: true });

    destroyRef.onDestroy(() => observer.disconnect());
  });

  return {
    isReady: isReady.asReadonly(),
    canUndo: canUndoSignal.asReadonly(),
    canRedo: canRedoSignal.asReadonly(),

    undo: () => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:undoRedo] UndoRedoPlugin not found.\n\n` +
            `  → Enable undo/redo on the grid:\n` +
            `    <tbw-grid [editing]="'dblclick'" [undoRedo]="true" />`,
        );
        return null;
      }
      const result = plugin.undo();
      syncSignals();
      return result;
    },

    redo: () => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:undoRedo] UndoRedoPlugin not found.\n\n` +
            `  → Enable undo/redo on the grid:\n` +
            `    <tbw-grid [editing]="'dblclick'" [undoRedo]="true" />`,
        );
        return null;
      }
      const result = plugin.redo();
      syncSignals();
      return result;
    },

    clearHistory: () => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:undoRedo] UndoRedoPlugin not found.\n\n` +
            `  → Enable undo/redo on the grid:\n` +
            `    <tbw-grid [editing]="'dblclick'" [undoRedo]="true" />`,
        );
        return;
      }
      plugin.clearHistory();
      syncSignals();
    },

    getUndoStack: () => getPlugin()?.getUndoStack() ?? [],

    getRedoStack: () => getPlugin()?.getRedoStack() ?? [],

    recordEdit: (rowIndex: number, field: string, oldValue: unknown, newValue: unknown) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:undoRedo] UndoRedoPlugin not found.\n\n` +
            `  → Enable undo/redo on the grid:\n` +
            `    <tbw-grid [editing]="'dblclick'" [undoRedo]="true" />`,
        );
        return;
      }
      plugin.recordEdit(rowIndex, field, oldValue, newValue);
      syncSignals();
    },

    beginTransaction: () => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:undoRedo] UndoRedoPlugin not found.\n\n` +
            `  → Enable undo/redo on the grid:\n` +
            `    <tbw-grid [editing]="'dblclick'" [undoRedo]="true" />`,
        );
        return;
      }
      plugin.beginTransaction();
    },

    endTransaction: () => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:undoRedo] UndoRedoPlugin not found.\n\n` +
            `  → Enable undo/redo on the grid:\n` +
            `    <tbw-grid [editing]="'dblclick'" [undoRedo]="true" />`,
        );
        return;
      }
      plugin.endTransaction();
      syncSignals();
    },
  };
}
