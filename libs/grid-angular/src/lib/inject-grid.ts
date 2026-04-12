import { afterNextRender, computed, ElementRef, inject, type Signal, signal } from '@angular/core';
import type { ColumnConfig, DataGridElement, GridConfig } from '@toolbox-web/grid';

/**
 * Return type for injectGrid function.
 */
export interface InjectGridReturn<TRow = unknown> {
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
 * import { Component } from '@angular/core';
 * import { Grid, injectGrid } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   selector: 'app-my-grid',
 *   imports: [Grid],
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
 * @param selector - Optional CSS selector to target a specific grid element.
 *   Defaults to `'tbw-grid'` (first grid in the component). Use when the
 *   component contains multiple grids, e.g. `'tbw-grid.primary'` or `'#my-grid'`.
 * @returns Object with grid access methods and state signals
 */
export function injectGrid<TRow = unknown>(selector = 'tbw-grid'): InjectGridReturn<TRow> {
  const elementRef = inject(ElementRef);

  // Reactive signals
  const isReady = signal(false);
  const config = signal<GridConfig<TRow> | null>(null);
  const element = signal<DataGridElement<TRow> | null>(null);

  // Initialize after render
  afterNextRender(() => {
    const gridElement = elementRef.nativeElement.querySelector(selector) as DataGridElement<TRow>;
    if (!gridElement) {
      console.warn('[injectGrid] No tbw-grid element found in component');
      return;
    }

    element.set(gridElement);

    // Wait for grid to be ready
    gridElement.ready?.().then(async () => {
      isReady.set(true);
      const effectiveConfig = await gridElement.getConfig?.();
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
  };
}
