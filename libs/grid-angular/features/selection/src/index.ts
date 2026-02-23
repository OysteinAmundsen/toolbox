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

import { afterNextRender, DestroyRef, ElementRef, inject, signal, type Signal } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { registerFeature } from '@toolbox-web/grid-angular';
import {
  SelectionPlugin,
  type CellRange,
  type SelectionChangeDetail,
  type SelectionResult,
} from '@toolbox-web/grid/plugins/selection';

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
export interface SelectionMethods<TRow = unknown> {
  /**
   * Select all rows (row mode) or all cells (range mode).
   */
  selectAll: () => void;

  /**
   * Clear all selection.
   */
  clearSelection: () => void;

  /**
   * Get the current selection state (imperative, point-in-time snapshot).
   * For reactive selection state, use the `selection` signal instead.
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
   * Reactive selection state. Updates automatically whenever the selection changes.
   * Null when no SelectionPlugin is active or no selection has been made yet.
   *
   * @example
   * ```typescript
   * readonly selection = injectGridSelection();
   *
   * // In template:
   * // {{ selection.selection()?.ranges?.length ?? 0 }} cells selected
   *
   * // In computed:
   * readonly hasSelection = computed(() => (this.selection.selection()?.ranges?.length ?? 0) > 0);
   * ```
   */
  selection: Signal<SelectionResult | null>;

  /**
   * Reactive selected row indices (sorted ascending). Updates automatically.
   * Convenience signal for row-mode selection — returns `[]` in cell/range modes
   * or when nothing is selected.
   *
   * **Prefer `selectedRows`** for getting actual row objects — it handles
   * index-to-object resolution correctly regardless of sorting/filtering.
   *
   * @example
   * ```typescript
   * readonly selection = injectGridSelection();
   *
   * // In template:
   * // {{ selection.selectedRowIndices().length }} rows selected
   * ```
   */
  selectedRowIndices: Signal<number[]>;

  /**
   * Reactive selected row objects. Updates automatically whenever the selection changes.
   * Works in all selection modes (row, cell, range) — returns the actual row objects
   * from the grid's processed (sorted/filtered) rows.
   *
   * This is the recommended way to get selected rows. Unlike manual index mapping,
   * it correctly resolves rows even when the grid is sorted or filtered.
   *
   * @example
   * ```typescript
   * readonly selection = injectGridSelection<Employee>();
   *
   * // In template:
   * // {{ selection.selectedRows().length }} rows selected
   *
   * // In computed:
   * readonly hasSelection = computed(() => this.selection.selectedRows().length > 0);
   * ```
   */
  selectedRows: Signal<TRow[]>;

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
 * import { Component } from '@angular/core';
 * import { Grid } from '@toolbox-web/grid-angular';
 * import '@toolbox-web/grid-angular/features/selection';
 * import { injectGridSelection } from '@toolbox-web/grid-angular/features/selection';
 *
 * @Component({
 *   selector: 'app-my-grid',
 *   imports: [Grid],
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
export function injectGridSelection<TRow = unknown>(): SelectionMethods<TRow> {
  const elementRef = inject(ElementRef);
  const destroyRef = inject(DestroyRef);
  const isReady = signal(false);

  // Reactive selection state
  const selectionSignal = signal<SelectionResult | null>(null);
  const selectedRowIndicesSignal = signal<number[]>([]);
  const selectedRowsSignal = signal<TRow[]>([]);

  // Lazy discovery: cached grid reference
  let cachedGrid: DataGridElement<TRow> | null = null;
  let readyPromiseStarted = false;
  let listenerAttached = false;

  /**
   * Handle selection-change events from the grid.
   * Updates both reactive signals.
   */
  const onSelectionChange = (e: Event): void => {
    const detail = (e as CustomEvent<SelectionChangeDetail>).detail;
    const plugin = getPlugin();
    if (plugin) {
      selectionSignal.set(plugin.getSelection());
      selectedRowIndicesSignal.set(detail.mode === 'row' ? plugin.getSelectedRowIndices() : []);
      selectedRowsSignal.set(plugin.getSelectedRows<TRow>());
    }
  };

  /**
   * Attach the selection-change event listener to the grid element.
   * Called once when the grid is first discovered.
   */
  const attachListener = (grid: DataGridElement<TRow>): void => {
    if (listenerAttached) return;
    listenerAttached = true;

    grid.addEventListener('selection-change', onSelectionChange);

    destroyRef.onDestroy(() => {
      grid.removeEventListener('selection-change', onSelectionChange);
    });
  };

  /**
   * Lazily find the grid element. Called on each method invocation.
   * Caches the reference once found and triggers ready() check.
   */
  const getGrid = (): DataGridElement<TRow> | null => {
    if (cachedGrid) return cachedGrid;

    const grid = elementRef.nativeElement.querySelector('tbw-grid') as DataGridElement<TRow> | null;
    if (grid) {
      cachedGrid = grid;
      attachListener(grid);
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

  /**
   * Sync reactive signals with the current plugin state.
   * Called once when the grid is first discovered and ready.
   */
  const syncSignals = (): void => {
    const plugin = getPlugin();
    if (plugin) {
      selectionSignal.set(plugin.getSelection());
      const mode = (plugin as any).config?.mode;
      selectedRowIndicesSignal.set(mode === 'row' ? plugin.getSelectedRowIndices() : []);
      selectedRowsSignal.set(plugin.getSelectedRows<TRow>());
    }
  };

  // Discover the grid after the first render so the selection-change
  // listener is attached without requiring a programmatic method call.
  // Uses a MutationObserver as fallback for lazy-rendered tabs, *ngIf,
  // @defer, etc. where the grid may not be in the DOM on first render.
  afterNextRender(() => {
    const grid = getGrid();
    if (grid) {
      grid.ready?.().then(syncSignals);
      return;
    }

    // Grid not in DOM yet — watch for it to appear.
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
    selection: selectionSignal.asReadonly(),
    selectedRowIndices: selectedRowIndicesSignal.asReadonly(),
    selectedRows: selectedRowsSignal.asReadonly(),

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
