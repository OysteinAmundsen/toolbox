import { afterNextRender, computed, DestroyRef, ElementRef, inject, type Signal, signal } from '@angular/core';
import type { ColumnConfig, DataGridElement, GridConfig } from '@toolbox-web/grid';

/**
 * Return type for injectGrid function.
 * @since 0.6.0
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
  /**
   * Look up a plugin instance by its class constructor.
   * Returns `undefined` if the plugin is not registered or the grid is not yet ready.
   */
  getPlugin: <T>(pluginClass: new (...args: unknown[]) => T) => T | undefined;
  /**
   * Look up a plugin instance by its registered name (e.g. `'tooltip'`, `'undoRedo'`).
   * Returns `undefined` if the plugin is not registered or the grid is not yet ready.
   */
  getPluginByName: DataGridElement<TRow>['getPluginByName'];
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
 * @since 0.6.0
 */
export function injectGrid<TRow = unknown>(selector = 'tbw-grid'): InjectGridReturn<TRow> {
  const elementRef = inject(ElementRef);
  const destroyRef = inject(DestroyRef);

  // Reactive signals
  const isReady = signal(false);
  const config = signal<GridConfig<TRow> | null>(null);
  const element = signal<DataGridElement<TRow> | null>(null);

  // Track destruction so async work doesn't touch signals after teardown
  let destroyed = false;
  destroyRef.onDestroy(() => {
    destroyed = true;
  });

  // Initialize after render
  afterNextRender(() => {
    const gridElement = elementRef.nativeElement.querySelector(selector) as DataGridElement<TRow>;
    if (!gridElement) {
      console.warn('[injectGrid] No tbw-grid element found in component');
      return;
    }

    element.set(gridElement);

    // Wait for grid to be ready. Use Promise.resolve to guard against
    // gridElement.ready being undefined (would otherwise throw on .then).
    Promise.resolve(gridElement.ready?.())
      .then(async () => {
        if (destroyed) return;
        isReady.set(true);
        const effectiveConfig = await gridElement.getConfig?.();
        if (destroyed) return;
        if (effectiveConfig) {
          config.set(effectiveConfig as GridConfig<TRow>);
        }
      })
      .catch((err) => {
        console.error('[injectGrid] Error waiting for grid to be ready:', err);
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

  const getPlugin = <T>(pluginClass: new (...args: unknown[]) => T): T | undefined => {
    return element()?.getPlugin?.(pluginClass);
  };

  const getPluginByName = ((name: string) => {
    return element()?.getPluginByName?.(name);
  }) as DataGridElement<TRow>['getPluginByName'];

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
    getPlugin,
    getPluginByName,
  };
}
