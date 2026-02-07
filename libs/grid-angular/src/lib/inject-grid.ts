import { afterNextRender, computed, ElementRef, inject, type Signal, signal } from '@angular/core';
import type { ColumnConfig, DataGridElement, GridConfig } from '@toolbox-web/grid';

/**
 * Selection convenience methods returned from injectGrid.
 *
 * @deprecated These methods are deprecated and will be removed in a future version.
 * Use `injectGridSelection()` from `@toolbox-web/grid-angular/features/selection` instead.
 *
 * @example
 * ```typescript
 * // Old (deprecated)
 * const grid = injectGrid();
 * grid.selectAll();
 *
 * // New (recommended)
 * import { injectGridSelection } from '@toolbox-web/grid-angular/features/selection';
 * const selection = injectGridSelection();
 * selection.selectAll();
 * ```
 */
export interface SelectionMethods<TRow = unknown> {
  /**
   * Select all rows in the grid.
   * Requires SelectionPlugin with mode: 'row'.
   * @deprecated Use `injectGridSelection()` from `@toolbox-web/grid-angular/features/selection` instead.
   */
  selectAll: () => void;

  /**
   * Clear all selection.
   * Works with any SelectionPlugin mode.
   * @deprecated Use `injectGridSelection()` from `@toolbox-web/grid-angular/features/selection` instead.
   */
  clearSelection: () => void;

  /**
   * Get selected row indices.
   * Returns Set of selected row indices.
   * @deprecated Use `injectGridSelection()` from `@toolbox-web/grid-angular/features/selection` instead.
   */
  getSelectedIndices: () => Set<number>;

  /**
   * Get selected rows data.
   * Returns array of selected row objects.
   * @deprecated Use `injectGridSelection()` from `@toolbox-web/grid-angular/features/selection` instead.
   */
  getSelectedRows: () => TRow[];
}

/**
 * Export convenience methods returned from injectGrid.
 *
 * @deprecated These methods are deprecated and will be removed in a future version.
 * Use `injectGridExport()` from `@toolbox-web/grid-angular/features/export` instead.
 *
 * @example
 * ```typescript
 * // Old (deprecated)
 * const grid = injectGrid();
 * grid.exportToCsv('data.csv');
 *
 * // New (recommended)
 * import { injectGridExport } from '@toolbox-web/grid-angular/features/export';
 * const gridExport = injectGridExport();
 * gridExport.exportToCsv('data.csv');
 * ```
 */
export interface ExportMethods {
  /**
   * Export grid data to CSV file.
   * Requires ExportPlugin to be loaded.
   *
   * @param filename - Optional filename (defaults to 'export.csv')
   * @deprecated Use `injectGridExport()` from `@toolbox-web/grid-angular/features/export` instead.
   */
  exportToCsv: (filename?: string) => void;

  /**
   * Export grid data to JSON file.
   * Requires ExportPlugin to be loaded.
   *
   * @param filename - Optional filename (defaults to 'export.json')
   * @deprecated Use `injectGridExport()` from `@toolbox-web/grid-angular/features/export` instead.
   */
  exportToJson: (filename?: string) => void;
}

/**
 * Return type for injectGrid function.
 *
 * Note: Selection and export convenience methods are deprecated.
 * Use feature-specific inject functions instead:
 * - `injectGridSelection()` from `@toolbox-web/grid-angular/features/selection`
 * - `injectGridExport()` from `@toolbox-web/grid-angular/features/export`
 */
export interface InjectGridReturn<TRow = unknown> extends SelectionMethods<TRow>, ExportMethods {
  /** Direct access to the typed grid element */
  element: Signal<DataGridElement<TRow> | null>;
  /** Whether the grid is ready */
  isReady: Signal<boolean>;
  /** Current grid configuration */
  config: Signal<GridConfig<TRow> | null>;
  /** Get the effective configuration */
  getConfig: () => Promise<GridConfig<TRow> | null>;
  /** Force a layout recalculation */
  forceLayout: () => Promise<void>;
  /** Toggle a group row */
  toggleGroup: (key: string) => Promise<void>;
  /** Register custom styles */
  registerStyles: (id: string, css: string) => void;
  /** Unregister custom styles */
  unregisterStyles: (id: string) => void;
  /** Get current visible columns */
  visibleColumns: Signal<ColumnConfig<TRow>[]>;
}

/**
 * Angular inject function for programmatic access to a grid instance.
 *
 * This function should be called in the constructor or as a field initializer
 * of an Angular component that contains a `<tbw-grid>` element.
 *
 * ## Usage
 *
 * ```typescript
 * import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
 * import { Grid, injectGrid } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   selector: 'app-my-grid',
 *   imports: [Grid],
 *   schemas: [CUSTOM_ELEMENTS_SCHEMA],
 *   template: `
 *     <button (click)="handleResize()">Force Layout</button>
 *     <button (click)="handleExport()" [disabled]="!grid.isReady()">Export</button>
 *     <tbw-grid [rows]="rows" [gridConfig]="config"></tbw-grid>
 *   `
 * })
 * export class MyGridComponent {
 *   grid = injectGrid<Employee>();
 *
 *   async handleResize() {
 *     await this.grid.forceLayout();
 *   }
 *
 *   async handleExport() {
 *     const config = await this.grid.getConfig();
 *     console.log('Exporting with columns:', config?.columns);
 *   }
 * }
 * ```
 *
 * @returns Object with grid access methods and state signals
 */
export function injectGrid<TRow = unknown>(): InjectGridReturn<TRow> {
  const elementRef = inject(ElementRef);

  // Reactive signals
  const isReady = signal(false);
  const config = signal<GridConfig<TRow> | null>(null);
  const element = signal<DataGridElement<TRow> | null>(null);

  // Initialize after render
  afterNextRender(() => {
    const gridElement = elementRef.nativeElement.querySelector('tbw-grid') as DataGridElement<TRow>;
    if (!gridElement) {
      console.warn('[injectGrid] No tbw-grid element found in component');
      return;
    }

    element.set(gridElement);

    // Wait for grid to be ready
    gridElement.ready?.().then(async () => {
      isReady.set(true);
      const effectiveConfig = gridElement.getConfig?.();
      if (effectiveConfig) {
        config.set(effectiveConfig as GridConfig<TRow>);
      }
    });
  });

  // Computed visible columns
  const visibleColumns = computed<ColumnConfig<TRow>[]>(() => {
    const currentConfig = config();
    if (!currentConfig?.columns) return [];
    return currentConfig.columns.filter((col) => !col.hidden);
  });

  // ═══════════════════════════════════════════════════════════════════
  // CORE METHODS
  // ═══════════════════════════════════════════════════════════════════

  const getConfig = async (): Promise<GridConfig<TRow> | null> => {
    const gridElement = element();
    if (!gridElement) return null;
    const effectiveConfig = gridElement.getConfig?.();
    return (effectiveConfig as GridConfig<TRow>) ?? null;
  };

  const forceLayout = async (): Promise<void> => {
    const gridElement = element();
    if (!gridElement) return;
    await gridElement.forceLayout?.();
  };

  const toggleGroup = async (key: string): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gridElement = element() as any;
    if (!gridElement) return;
    await gridElement.toggleGroup?.(key);
  };

  const registerStyles = (id: string, css: string): void => {
    element()?.registerStyles?.(id, css);
  };

  const unregisterStyles = (id: string): void => {
    element()?.unregisterStyles?.(id);
  };

  // ═══════════════════════════════════════════════════════════════════
  // SELECTION CONVENIENCE METHODS
  // ═══════════════════════════════════════════════════════════════════

  const selectAll = (): void => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gridElement = element() as any;
    const plugin = gridElement?.getPluginByName?.('selection');
    if (!plugin) {
      console.warn('[injectGrid] selectAll requires SelectionPlugin');
      return;
    }
    // Row mode: select all row indices
    if (plugin.config?.mode === 'row') {
      const rows = gridElement?.rows ?? [];
      const allIndices = new Set<number>(rows.map((_: unknown, i: number) => i));
      plugin.selected = allIndices;
      plugin.requestAfterRender?.();
    }
  };

  const clearSelection = (): void => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gridElement = element() as any;
    const plugin = gridElement?.getPluginByName?.('selection');
    if (!plugin) return;

    const mode = plugin.config?.mode;
    if (mode === 'row') {
      plugin.selected = new Set();
    } else if (mode === 'range' || mode === 'cell') {
      plugin.ranges = [];
    }
    plugin.requestAfterRender?.();
  };

  const getSelectedIndices = (): Set<number> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gridElement = element() as any;
    const plugin = gridElement?.getPluginByName?.('selection');
    if (!plugin) return new Set();

    if (plugin.config?.mode === 'row') {
      return new Set(plugin.selected ?? []);
    }
    // Range/cell mode: extract unique row indices from ranges
    const ranges = plugin.ranges ?? [];
    const indices = new Set<number>();
    for (const range of ranges) {
      for (let r = range.startRow; r <= range.endRow; r++) {
        indices.add(r);
      }
    }
    return indices;
  };

  const getSelectedRows = (): TRow[] => {
    const gridElement = element();
    if (!gridElement) return [];
    const rows = gridElement.rows ?? [];
    const indices = getSelectedIndices();
    return Array.from(indices)
      .filter((i) => i >= 0 && i < rows.length)
      .map((i) => rows[i]);
  };

  // ═══════════════════════════════════════════════════════════════════
  // EXPORT CONVENIENCE METHODS
  // ═══════════════════════════════════════════════════════════════════

  const exportToCsv = (filename?: string): void => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gridElement = element() as any;
    const plugin = gridElement?.getPluginByName?.('export');
    if (!plugin) {
      console.warn('[injectGrid] exportToCsv requires ExportPlugin');
      return;
    }
    plugin.exportToCsv?.(filename);
  };

  const exportToJson = (filename?: string): void => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gridElement = element() as any;
    const plugin = gridElement?.getPluginByName?.('export');
    if (!plugin) {
      console.warn('[injectGrid] exportToJson requires ExportPlugin');
      return;
    }
    plugin.exportToJson?.(filename);
  };

  return {
    element,
    isReady,
    config,
    visibleColumns,
    getConfig,
    forceLayout,
    toggleGroup,
    registerStyles,
    unregisterStyles,
    selectAll,
    clearSelection,
    getSelectedIndices,
    getSelectedRows,
    exportToCsv,
    exportToJson,
  };
}
