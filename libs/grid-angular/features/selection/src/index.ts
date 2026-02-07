/**
 * Selection feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `selection` input on Grid directive.
 * Also exports `injectGridSelection()` for programmatic selection control.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/selection';
 *
 * <tbw-grid [selection]="'range'" />
 * ```
 *
 * @example Using injectGridSelection
 * ```typescript
 * import { injectGridSelection } from '@toolbox-web/grid-angular/features/selection';
 *
 * @Component({...})
 * export class MyComponent {
 *   private selection = injectGridSelection<Employee>();
 *
 *   selectAll() {
 *     this.selection.selectAll();
 *   }
 *
 *   getSelected() {
 *     return this.selection.getSelection();
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

import { ElementRef, inject, signal, type Signal } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { registerFeature } from '@toolbox-web/grid-angular';
import { SelectionPlugin, type CellRange, type SelectionResult } from '@toolbox-web/grid/plugins/selection';

registerFeature('selection', (config) => {
  // Handle shorthand: 'cell', 'row', 'range'
  if (config === 'cell' || config === 'row' || config === 'range') {
    return new SelectionPlugin({ mode: config });
  }
  // Full config object
  return new SelectionPlugin(config ?? undefined);
});

/**
 * Selection methods returned from injectGridSelection.
 *
 * Uses lazy discovery - the grid is found on first method call, not during initialization.
 * This ensures it works with lazy-rendered tabs, conditional rendering, etc.
 */
export interface SelectionMethods {
  /**
   * Select all rows (row mode) or all cells (range mode).
   */
  selectAll: () => void;

  /**
   * Clear all selection.
   */
  clearSelection: () => void;

  /**
   * Get the current selection state.
   * Use this to derive selected rows, indices, etc.
   */
  getSelection: () => SelectionResult | null;

  /**
   * Check if a specific cell is selected.
   */
  isCellSelected: (row: number, col: number) => boolean;

  /**
   * Set selection ranges programmatically.
   */
  setRanges: (ranges: CellRange[]) => void;

  /**
   * Signal indicating if grid is ready.
   * The grid is discovered lazily, so this updates when first method call succeeds.
   */
  isReady: Signal<boolean>;
}

/**
 * Angular inject function for programmatic selection control.
 *
 * Uses **lazy grid discovery** - the grid element is found when methods are called,
 * not during initialization. This ensures it works reliably with:
 * - Lazy-rendered tabs
 * - Conditional rendering (*ngIf)
 * - Dynamic component loading
 *
 * @example
 * ```typescript
 * import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
 * import { Grid } from '@toolbox-web/grid-angular';
 * import '@toolbox-web/grid-angular/features/selection';
 * import { injectGridSelection } from '@toolbox-web/grid-angular/features/selection';
 *
 * @Component({
 *   selector: 'app-my-grid',
 *   imports: [Grid],
 *   schemas: [CUSTOM_ELEMENTS_SCHEMA],
 *   template: `
 *     <button (click)="handleSelectAll()">Select All</button>
 *     <tbw-grid [rows]="rows" [selection]="'range'"></tbw-grid>
 *   `
 * })
 * export class MyGridComponent {
 *   selection = injectGridSelection();
 *
 *   handleSelectAll() {
 *     this.selection.selectAll();
 *   }
 *
 *   getSelectedRows() {
 *     const selection = this.selection.getSelection();
 *     if (!selection) return [];
 *     // Derive rows from selection.ranges as needed
 *   }
 * }
 * ```
 */
export function injectGridSelection<TRow = unknown>(): SelectionMethods {
  const elementRef = inject(ElementRef);
  const isReady = signal(false);

  // Lazy discovery: cached grid reference
  let cachedGrid: DataGridElement<TRow> | null = null;
  let readyPromiseStarted = false;

  /**
   * Lazily find the grid element. Called on each method invocation.
   * Caches the reference once found and triggers ready() check.
   */
  const getGrid = (): DataGridElement<TRow> | null => {
    if (cachedGrid) return cachedGrid;

    const grid = elementRef.nativeElement.querySelector('tbw-grid') as DataGridElement<TRow> | null;
    if (grid) {
      cachedGrid = grid;
      // Start ready() check only once
      if (!readyPromiseStarted) {
        readyPromiseStarted = true;
        grid.ready?.().then(() => isReady.set(true));
      }
    }
    return grid;
  };

  const getPlugin = (): SelectionPlugin | undefined => {
    return getGrid()?.getPlugin(SelectionPlugin);
  };

  return {
    isReady: isReady.asReadonly(),

    selectAll: () => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:selection] SelectionPlugin not found.\n\n` +
            `  → Enable selection on the grid:\n` +
            `    <tbw-grid [selection]="'range'" />`,
        );
        return;
      }
      const grid = getGrid();
      // Cast to any to access protected config
      const mode = (plugin as any).config?.mode;

      if (mode === 'row') {
        const rowCount = grid?.rows?.length ?? 0;
        const allIndices = new Set<number>();
        for (let i = 0; i < rowCount; i++) allIndices.add(i);
        (plugin as any).selected = allIndices;
        (plugin as any).requestAfterRender?.();
      } else if (mode === 'range') {
        const rowCount = grid?.rows?.length ?? 0;
        const colCount = (grid as any)?._columns?.length ?? 0;
        if (rowCount > 0 && colCount > 0) {
          plugin.setRanges([{ from: { row: 0, col: 0 }, to: { row: rowCount - 1, col: colCount - 1 } }]);
        }
      }
    },

    clearSelection: () => {
      getPlugin()?.clearSelection();
    },

    getSelection: () => {
      return getPlugin()?.getSelection() ?? null;
    },

    isCellSelected: (row: number, col: number) => {
      return getPlugin()?.isCellSelected(row, col) ?? false;
    },

    setRanges: (ranges: CellRange[]) => {
      getPlugin()?.setRanges(ranges);
    },
  };
}
