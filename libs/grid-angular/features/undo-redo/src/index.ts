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

import { ElementRef, inject, signal, type Signal } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { registerFeature } from '@toolbox-web/grid-angular';
import { UndoRedoPlugin, type EditAction } from '@toolbox-web/grid/plugins/undo-redo';

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
   * @returns The undone action, or null if nothing to undo
   */
  undo: () => EditAction | null;

  /**
   * Redo the last undone action.
   * @returns The redone action, or null if nothing to redo
   */
  redo: () => EditAction | null;

  /**
   * Check if there are any actions that can be undone.
   */
  canUndo: () => boolean;

  /**
   * Check if there are any actions that can be redone.
   */
  canRedo: () => boolean;

  /**
   * Clear all undo/redo history.
   */
  clearHistory: () => void;

  /**
   * Get a copy of the current undo stack.
   */
  getUndoStack: () => EditAction[];

  /**
   * Get a copy of the current redo stack.
   */
  getRedoStack: () => EditAction[];

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
 * import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
 * import { Grid } from '@toolbox-web/grid-angular';
 * import '@toolbox-web/grid-angular/features/editing';
 * import '@toolbox-web/grid-angular/features/undo-redo';
 * import { injectGridUndoRedo } from '@toolbox-web/grid-angular/features/undo-redo';
 *
 * @Component({
 *   selector: 'app-my-grid',
 *   imports: [Grid],
 *   schemas: [CUSTOM_ELEMENTS_SCHEMA],
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
  const isReady = signal(false);

  let cachedGrid: DataGridElement | null = null;
  let readyPromiseStarted = false;

  const getGrid = (): DataGridElement | null => {
    if (cachedGrid) return cachedGrid;

    const grid = elementRef.nativeElement.querySelector('tbw-grid') as DataGridElement | null;
    if (grid) {
      cachedGrid = grid;
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

  return {
    isReady: isReady.asReadonly(),

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
      return plugin.undo();
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
      return plugin.redo();
    },

    canUndo: () => getPlugin()?.canUndo() ?? false,

    canRedo: () => getPlugin()?.canRedo() ?? false,

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
    },

    getUndoStack: () => getPlugin()?.getUndoStack() ?? [],

    getRedoStack: () => getPlugin()?.getRedoStack() ?? [],
  };
}
