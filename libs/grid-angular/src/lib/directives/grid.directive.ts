import {
  AfterContentInit,
  ApplicationRef,
  Directive,
  ElementRef,
  EnvironmentInjector,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  ViewContainerRef,
} from '@angular/core';
import { DataGridElement as GridElement } from '@toolbox-web/grid';
import { MasterDetailPlugin } from '@toolbox-web/grid/all';
import { AngularGridAdapter } from '../angular-grid-adapter';

/**
 * Event detail for cell commit events.
 */
export interface CellCommitEvent<TRow = unknown, TValue = unknown> {
  /** The row data object */
  row: TRow;
  /** The field name of the edited column */
  field: string;
  /** The new value after edit */
  value: TValue;
  /** The row index in the data array */
  rowIndex: number;
  /** Array of all rows that have been modified */
  changedRows: TRow[];
  /** Set of row indices that have been modified */
  changedRowIndices: Set<number>;
  /** Whether this is the first modification to this row */
  firstTimeForRow: boolean;
}

/**
 * Event detail for row commit events (bulk editing).
 */
export interface RowCommitEvent<TRow = unknown> {
  /** The row data object */
  row: TRow;
  /** The row index in the data array */
  rowIndex: number;
  /** Array of all rows that have been modified */
  changedRows: TRow[];
  /** Set of row indices that have been modified */
  changedRowIndices: Set<number>;
  /** Whether this is the first modification to this row */
  firstTimeForRow: boolean;
}

/**
 * Directive that automatically registers the Angular adapter with tbw-grid elements.
 *
 * This directive eliminates the need to manually register the adapter in your component
 * constructor. Simply import this directive and it will handle adapter registration.
 *
 * ## Usage
 *
 * ```typescript
 * import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
 * import { Grid } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   selector: 'app-root',
 *   imports: [Grid],
 *   schemas: [CUSTOM_ELEMENTS_SCHEMA],
 *   template: `
 *     <tbw-grid [rows]="rows" [gridConfig]="config" [customStyles]="myStyles">
 *       <!-- column templates -->
 *     </tbw-grid>
 *   `
 * })
 * export class AppComponent {
 *   rows = [...];
 *   config = {...};
 *   myStyles = `.my-class { color: red; }`;
 * }
 * ```
 *
 * The directive automatically:
 * - Creates an AngularGridAdapter instance
 * - Registers it with the GridElement
 * - Injects custom styles into the grid's shadow DOM
 * - Handles cleanup on destruction
 */
@Directive({ selector: 'tbw-grid' })
export class Grid implements OnInit, AfterContentInit, OnDestroy {
  private elementRef = inject(ElementRef<GridElement>);
  private injector = inject(EnvironmentInjector);
  private appRef = inject(ApplicationRef);
  private viewContainerRef = inject(ViewContainerRef);

  private adapter: AngularGridAdapter | null = null;
  private cellCommitListener: ((e: Event) => void) | null = null;
  private rowCommitListener: ((e: Event) => void) | null = null;

  /**
   * Custom CSS styles to inject into the grid's shadow DOM.
   * Use this to style custom cell renderers, editors, or detail panels.
   *
   * @example
   * ```typescript
   * // In your component
   * customStyles = `
   *   .my-detail-panel { padding: 16px; }
   *   .my-status-badge { border-radius: 4px; }
   * `;
   * ```
   *
   * ```html
   * <tbw-grid [customStyles]="customStyles">...</tbw-grid>
   * ```
   */
  customStyles = input<string>();

  /**
   * Emitted when a cell value is committed (inline editing).
   * Provides the row, field, new value, and change tracking information.
   *
   * @example
   * ```html
   * <tbw-grid (cellCommit)="onCellCommit($event)">...</tbw-grid>
   * ```
   *
   * ```typescript
   * onCellCommit(event: CellCommitEvent) {
   *   console.log(`Changed ${event.field} to ${event.value} in row ${event.rowIndex}`);
   * }
   * ```
   */
  cellCommit = output<CellCommitEvent>();

  /**
   * Emitted when a row's values are committed (bulk/row editing).
   * Provides the row data and change tracking information.
   *
   * @example
   * ```html
   * <tbw-grid (rowCommit)="onRowCommit($event)">...</tbw-grid>
   * ```
   */
  rowCommit = output<RowCommitEvent>();

  ngOnInit(): void {
    // Create and register the adapter
    this.adapter = new AngularGridAdapter(this.injector, this.appRef, this.viewContainerRef);
    GridElement.registerAdapter(this.adapter);

    // Set up event listeners for commit events
    const grid = this.elementRef.nativeElement;

    this.cellCommitListener = (e: Event) => {
      const detail = (e as CustomEvent).detail as CellCommitEvent;
      this.cellCommit.emit(detail);
    };
    grid.addEventListener('cell-commit', this.cellCommitListener);

    this.rowCommitListener = (e: Event) => {
      const detail = (e as CustomEvent).detail as RowCommitEvent;
      this.rowCommit.emit(detail);
    };
    grid.addEventListener('row-commit', this.rowCommitListener);

    // Register adapter on the grid element so MasterDetailPlugin can use it
    // via the __frameworkAdapter hook during attach()
    (grid as any).__frameworkAdapter = this.adapter;
  }

  ngAfterContentInit(): void {
    // After Angular child directives have initialized (GridColumnView, GridColumnEditor, GridDetailView, GridToolPanel),
    // force the grid to re-parse light DOM columns so adapters can create renderers/editors
    const grid = this.elementRef.nativeElement;
    if (grid && typeof (grid as any).refreshColumns === 'function') {
      // Use setTimeout to ensure Angular effects have run (template registration)
      setTimeout(() => {
        (grid as any).refreshColumns();

        // Configure MasterDetailPlugin after Angular templates are registered
        this.configureMasterDetail(grid);

        // Refresh shell header to pick up tool panel templates
        // This allows Angular templates to be used in tool panels
        if (typeof (grid as any).refreshShellHeader === 'function') {
          (grid as any).refreshShellHeader();
        }

        // Register custom styles if provided
        this.registerCustomStyles(grid);
      }, 0);
    }
  }

  /**
   * Registers custom styles into the grid's shadow DOM.
   * Uses the grid's registerStyles() API for clean encapsulation.
   */
  private registerCustomStyles(grid: GridElement): void {
    const styles = this.customStyles();
    if (!styles) return;

    // Wait for grid to be ready before registering styles
    grid.ready?.().then(() => {
      grid.registerStyles?.('angular-custom-styles', styles);
    });
  }

  /**
   * Configures the MasterDetailPlugin after Angular templates are registered.
   * - If plugin exists: refresh its detail renderer
   * - If plugin doesn't exist but <tbw-grid-detail> is present: create and add the plugin
   */
  private configureMasterDetail(grid: GridElement): void {
    if (!this.adapter) return;

    const existingPlugin = grid.getPlugin?.(MasterDetailPlugin);
    if (existingPlugin && typeof existingPlugin.refreshDetailRenderer === 'function') {
      // Plugin exists - just refresh the renderer to pick up Angular templates
      existingPlugin.refreshDetailRenderer();
      return;
    }

    // Check if <tbw-grid-detail> is present in light DOM
    const detailElement = (grid as unknown as Element).querySelector('tbw-grid-detail');
    if (!detailElement) return;

    // Create detail renderer from Angular template
    const detailRenderer = this.adapter.createDetailRenderer(grid as unknown as HTMLElement);
    if (!detailRenderer) return;

    // Parse configuration from attributes
    const animationAttr = detailElement.getAttribute('animation');
    let animation: 'slide' | 'fade' | false = 'slide';
    if (animationAttr === 'false') {
      animation = false;
    } else if (animationAttr === 'fade') {
      animation = 'fade';
    }

    const showExpandColumn = detailElement.getAttribute('showExpandColumn') !== 'false';

    // Create and add the plugin
    const plugin = new MasterDetailPlugin({
      detailRenderer: detailRenderer,
      showExpandColumn,
      animation,
    });

    const currentConfig = grid.gridConfig || {};
    const existingPlugins = currentConfig.plugins || [];
    grid.gridConfig = {
      ...currentConfig,
      plugins: [...existingPlugins, plugin],
    };
  }

  ngOnDestroy(): void {
    // Cleanup event listeners
    const grid = this.elementRef.nativeElement;
    if (grid) {
      if (this.cellCommitListener) {
        grid.removeEventListener('cell-commit', this.cellCommitListener);
        this.cellCommitListener = null;
      }
      if (this.rowCommitListener) {
        grid.removeEventListener('row-commit', this.rowCommitListener);
        this.rowCommitListener = null;
      }
    }

    // Cleanup custom styles
    if (grid && this.customStyles()) {
      grid.unregisterStyles?.('angular-custom-styles');
    }

    // Cleanup adapter if needed
    if (this.adapter) {
      this.adapter.destroy?.();
      this.adapter = null;
    }
  }
}
