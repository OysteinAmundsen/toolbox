import {
  AfterContentInit,
  ApplicationRef,
  Directive,
  effect,
  ElementRef,
  EnvironmentInjector,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  ViewContainerRef,
} from '@angular/core';
import type {
  ColumnConfig as BaseColumnConfig,
  CellActivateDetail,
  CellChangeDetail,
  CellClickDetail,
  ColumnConfigMap,
  ColumnResizeDetail,
  FitMode,
  GridColumnState,
  DataGridElement as GridElement,
  RowClickDetail,
  SortChangeDetail,
  TbwScrollDetail,
} from '@toolbox-web/grid';
import { DataGridElement as GridElementClass } from '@toolbox-web/grid';
// Import editing event types from the editing plugin
import type {
  BeforeEditCloseDetail,
  CellCancelDetail,
  ChangedRowsResetDetail,
  DirtyChangeDetail,
  EditCloseDetail,
  EditingConfig,
  EditOpenDetail,
} from '@toolbox-web/grid/plugins/editing';
// Import plugin config types only. Specific plugin classes are intentionally
// not imported here — feature-specific bridging lives in the feature secondary
// entries (see `internal/feature-extensions.ts`).
import type {
  ClipboardConfig,
  ColumnMoveDetail,
  ColumnResizeResetDetail,
  ColumnVirtualizationConfig,
  ColumnVisibilityDetail,
  ContextMenuConfig,
  ContextMenuOpenDetail,
  CopyDetail,
  DataChangeDetail,
  DataGridEventMap,
  DetailExpandDetail,
  ExportCompleteDetail,
  ExportConfig,
  FilterChangeDetail,
  FilterConfig,
  GroupCollapseDetail,
  GroupExpandDetail,
  GroupingColumnsConfig,
  GroupingRowsConfig,
  GroupToggleDetail,
  MasterDetailConfig,
  MultiSortConfig,
  PasteDetail,
  PinnedRowsConfig,
  PivotConfig,
  PrintCompleteDetail,
  PrintConfig,
  PrintStartDetail,
  ReorderConfig,
  ResponsiveChangeDetail,
  ResponsivePluginConfig,
  RowDragDropConfig,
  RowDragEndDetail,
  RowDragStartDetail,
  RowDropDetail,
  RowMoveDetail,
  RowReorderConfig,
  RowTransferDetail,
  SelectionChangeDetail,
  SelectionConfig,
  ServerSideConfig,
  TooltipConfig,
  TreeConfig,
  TreeExpandDetail,
  UndoRedoConfig,
  UndoRedoDetail,
  VisibilityConfig,
} from '@toolbox-web/grid/all';
import type { ColumnConfig, GridConfig } from '../angular-column-config';
import { GridAdapter } from '../angular-grid-adapter';
import { applyColumnDefaults, type ColumnShorthand, normalizeColumns } from '../column-shorthand';
import { createPluginFromFeature, type FeatureName } from '../feature-registry';
import { GridIconRegistry } from '../grid-icon-registry';
import { getFeatureConfigPreprocessor, runTemplateBridges } from '../internal/feature-extensions';

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
 * import { Component } from '@angular/core';
 * import { Grid } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   selector: 'app-root',
 *   imports: [Grid],
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
 * - Creates a GridAdapter instance
 * - Registers it with the GridElement
 * - Injects custom styles into the grid
 * - Handles cleanup on destruction
 *
 * @category Directive
 */
@Directive({ selector: 'tbw-grid' })
export class Grid implements OnInit, AfterContentInit, OnDestroy {
  private elementRef = inject(ElementRef<GridElement>);
  private injector = inject(EnvironmentInjector);
  private appRef = inject(ApplicationRef);
  private viewContainerRef = inject(ViewContainerRef);
  private iconRegistry = inject(GridIconRegistry, { optional: true });

  private adapter: GridAdapter | null = null;

  constructor() {
    // Effect to process gridConfig and apply to grid
    // This merges feature input plugins with the user's config plugins
    effect(() => {
      const userGridConfig = this.gridConfig();

      const angularCfg = userGridConfig;
      if (!this.adapter) return;

      // Create plugins from feature inputs
      const featurePlugins = this.createFeaturePlugins();

      // Build core config overrides from individual inputs
      const sortableValue = this.sortable();
      const filterableValue = this.filterable();
      const selectableValue = this.selectable();
      const coreConfigOverrides: Record<string, unknown> = {};
      if (sortableValue !== undefined) {
        coreConfigOverrides['sortable'] = sortableValue;
      }
      if (filterableValue !== undefined) {
        coreConfigOverrides['filterable'] = filterableValue;
      }
      if (selectableValue !== undefined) {
        coreConfigOverrides['selectable'] = selectableValue;
      }

      const grid = this.elementRef.nativeElement;

      // Merge icon overrides from registry with any existing icons
      // Registry icons are base, config.icons override them
      const registryIcons = this.iconRegistry?.getAll();
      if (registryIcons && Object.keys(registryIcons).length > 0) {
        const existingIcons = angularCfg?.icons || {};
        coreConfigOverrides['icons'] = { ...registryIcons, ...existingIcons };
      }

      // Nothing to do if there's no config input and no feature inputs
      const hasFeaturePlugins = featurePlugins.length > 0;
      const hasConfigOverrides = Object.keys(coreConfigOverrides).length > 0;

      if (!angularCfg && !hasFeaturePlugins && !hasConfigOverrides) {
        return;
      }

      const userConfig = angularCfg || {};

      // Merge feature-input plugins with the user's own plugins
      const configPlugins = userConfig.plugins || [];
      const mergedPlugins = [...featurePlugins, ...configPlugins];

      // The interceptor on element.gridConfig (installed in ngOnInit)
      // handles converting component classes → functions via processGridConfig,
      // so we can pass the raw Angular config through. The interceptor is
      // idempotent, making this safe even if the config is already processed.
      grid.gridConfig = {
        ...userConfig,
        ...coreConfigOverrides,
        plugins: mergedPlugins.length > 0 ? mergedPlugins : userConfig.plugins,
      };
    });

    // Effect to sync loading state to the grid element
    effect(() => {
      const loadingValue = this.loading();
      if (loadingValue === undefined) return;

      const grid = this.elementRef.nativeElement;
      grid.loading = loadingValue;
    });

    // Effect to sync rows to the grid element
    effect(() => {
      const rowsValue = this.rows();
      if (rowsValue === undefined) return;

      const grid = this.elementRef.nativeElement;
      grid.rows = rowsValue;
    });

    // Effect to sync columns to the grid element
    effect(() => {
      const columnsValue = this.columns();
      if (columnsValue === undefined) return;

      const grid = this.elementRef.nativeElement;
      // First normalize any shorthand strings to ColumnConfig objects, then
      // merge in any per-grid column defaults. Individual column props always win.
      // Note: Angular ColumnConfig allows component classes for renderer/editor,
      // which the adapter normalizes via processColumn below; we widen to `any`
      // here so the shorthand helpers (typed against the core ColumnConfig) accept
      // the Angular-flavoured payload unchanged.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const normalized = applyColumnDefaults<any>(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        normalizeColumns<any>(columnsValue as ColumnShorthand<any>[]),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.columnDefaults() as any,
      );
      // Process columns through the adapter to convert Angular component classes
      // (renderer/editor) to functions — the grid's columns setter does NOT call
      // processConfig, unlike gridConfig. Without this, raw component classes
      // would be invoked without `new`, causing runtime errors.
      const processed = this.adapter
        ? (normalized as ColumnConfig[]).map((col) => this.adapter!.processColumn(col))
        : normalized;
      grid.columns = processed as BaseColumnConfig[] | ColumnConfigMap;
    });

    // Effect to sync fitMode to the grid element
    effect(() => {
      const fitModeValue = this.fitMode();
      if (fitModeValue === undefined) return;

      const grid = this.elementRef.nativeElement;
      grid.fitMode = fitModeValue;
    });
  }

  /**
   * Custom CSS styles to inject into the grid.
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
   * Grid-wide sorting toggle.
   * When false, disables sorting for all columns regardless of their individual `sortable` setting.
   * When true (default), columns with `sortable: true` can be sorted.
   *
   * This is a core grid config property, not a plugin feature.
   * For multi-column sorting, also add the `[multiSort]` feature.
   *
   * @default true
   *
   * @example
   * ```html
   * <!-- Disable all sorting -->
   * <tbw-grid [sortable]="false" />
   *
   * <!-- Enable sorting (default) - columns still need sortable: true -->
   * <tbw-grid [sortable]="true" />
   *
   * <!-- Enable multi-column sorting -->
   * <tbw-grid [sortable]="true" [multiSort]="true" />
   * ```
   */
  sortable = input<boolean>();

  /**
   * Grid-wide filtering toggle.
   * When false, disables filtering for all columns regardless of their individual `filterable` setting.
   * When true (default), columns with `filterable: true` can be filtered.
   *
   * Requires the FilteringPlugin to be loaded.
   *
   * @default true
   *
   * @example
   * ```html
   * <!-- Disable all filtering -->
   * <tbw-grid [filterable]="false" [filtering]="true" />
   *
   * <!-- Enable filtering (default) -->
   * <tbw-grid [filterable]="true" [filtering]="true" />
   * ```
   */
  filterable = input<boolean>();

  /**
   * Grid-wide selection toggle.
   * When false, disables selection for all rows/cells.
   * When true (default), selection is enabled based on plugin mode.
   *
   * Requires the SelectionPlugin to be loaded.
   *
   * @default true
   *
   * @example
   * ```html
   * <!-- Disable all selection -->
   * <tbw-grid [selectable]="false" [selection]="'range'" />
   *
   * <!-- Enable selection (default) -->
   * <tbw-grid [selectable]="true" [selection]="'range'" />
   * ```
   */
  selectable = input<boolean>();

  /**
   * Show a loading overlay on the grid.
   * Use this during initial data fetch or refresh operations.
   *
   * For row/cell loading states, access the grid element directly:
   * - `grid.setRowLoading(rowId, true/false)`
   * - `grid.setCellLoading(rowId, field, true/false)`
   *
   * @default false
   *
   * @example
   * ```html
   * <!-- Show loading during data fetch -->
   * <tbw-grid [loading]="isLoading" [rows]="rows" />
   * ```
   *
   * ```typescript
   * isLoading = true;
   *
   * ngOnInit() {
   *   this.dataService.fetchData().subscribe(data => {
   *     this.rows = data;
   *     this.isLoading = false;
   *   });
   * }
   * ```
   */
  loading = input<boolean>();

  /**
   * The data rows to display in the grid.
   *
   * Accepts an array of data objects. Each object represents one row.
   * The grid reads property values for each column's `field` from these objects.
   *
   * @example
   * ```html
   * <tbw-grid [rows]="employees()" [gridConfig]="config" />
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows = input<any[]>();

  /**
   * Column configuration array.
   *
   * Accepts either full `ColumnConfig` objects or shorthand strings such as
   * `'name'` or `'salary:number'`. Shorthands auto-generate human-readable
   * headers from the field name.
   *
   * Shorthand for setting columns without wrapping them in a full `gridConfig`.
   * If both `columns` and `gridConfig.columns` are set, `columns` takes precedence
   * (see configuration precedence system).
   *
   * @example
   * ```html
   * <tbw-grid [rows]="data" [columns]="['id:number', 'name', { field: 'status', editable: true }]" />
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns = input<ColumnShorthand<any>[]>();

  /**
   * Default column properties applied to every column in `columns`.
   * Individual column properties override these defaults.
   *
   * @example
   * ```html
   * <tbw-grid
   *   [columnDefaults]="{ sortable: true, resizable: true }"
   *   [columns]="[{ field: 'id', sortable: false }, { field: 'name' }]"
   * />
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columnDefaults = input<Partial<ColumnConfig<any>>>();

  /**
   * Column sizing strategy.
   *
   * - `'stretch'` (default) — columns stretch to fill available width
   * - `'fixed'` — columns use their declared widths; enables horizontal scrolling
   * - `'auto-fit'` — columns auto-size to content, then stretch to fill
   *
   * @default 'stretch'
   *
   * @example
   * ```html
   * <tbw-grid [rows]="data" fitMode="fixed" />
   * <tbw-grid [rows]="data" [fitMode]="dynamicMode()" />
   * ```
   */
  fitMode = input<FitMode>();

  /**
   * Grid configuration object with optional Angular-specific extensions.
   *
   * Accepts Angular-augmented `GridConfig` from `@toolbox-web/grid-angular`.
   * You can specify Angular component classes directly for renderers and editors.
   *
   * Component classes must implement the appropriate interfaces:
   * - Renderers: `CellRenderer<TRow, TValue>` - requires `value()` and `row()` signal inputs
   * - Editors: `CellEditor<TRow, TValue>` - adds `commit` and `cancel` outputs
   *
   * @example
   * ```typescript
   * // Simple config with plain renderers
   * config: GridConfig = {
   *   columns: [
   *     { field: 'name', header: 'Name' },
   *     { field: 'active', type: 'boolean' }
   *   ],
   *   typeDefaults: {
   *     boolean: { renderer: (ctx) => ctx.value ? '✓' : '✗' }
   *   }
   * };
   *
   * // Config with component classes
   * config: GridConfig<Employee> = {
   *   columns: [
   *     { field: 'name', header: 'Name' },
   *     { field: 'bonus', header: 'Bonus', editable: true, editor: BonusEditorComponent }
   *   ]
   * };
   * ```
   *
   * ```html
   * <tbw-grid [gridConfig]="config" [rows]="employees"></tbw-grid>
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gridConfig = input<GridConfig<any>>();

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURE INPUTS - Declarative plugin configuration
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Enable cell/row/range selection.
   *
   * **Requires feature import:**
   * ```typescript
   * import '@toolbox-web/grid-angular/features/selection';
   * ```
   *
   * @example
   * ```html
   * <!-- Shorthand - just the mode -->
   * <tbw-grid [selection]="'range'" />
   *
   * <!-- Full config object -->
   * <tbw-grid [selection]="{ mode: 'range', checkbox: true }" />
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selection = input<'cell' | 'row' | 'range' | SelectionConfig<any>>();

  /**
   * Enable inline cell editing.
   *
   * **Requires feature import:**
   * ```typescript
   * import '@toolbox-web/grid-angular/features/editing';
   * ```
   *
   * @example
   * ```html
   * <!-- Enable with default trigger (dblclick) -->
   * <tbw-grid [editing]="true" />
   *
   * <!-- Specify trigger -->
   * <tbw-grid [editing]="'click'" />
   * <tbw-grid [editing]="'dblclick'" />
   * <tbw-grid [editing]="'manual'" />
   *
   * <!-- Full config with callbacks -->
   * <tbw-grid [editing]="{ editOn: 'dblclick', onBeforeEditClose: myCallback }" />
   * ```
   */
  editing = input<boolean | 'click' | 'dblclick' | 'manual' | EditingConfig>();

  /**
   * Enable clipboard copy/paste. Requires selection to be enabled.
   *
   * **Requires feature import:**
   * ```typescript
   * import '@toolbox-web/grid-angular/features/clipboard';
   * ```
   *
   * @example
   * ```html
   * <tbw-grid [selection]="'range'" [clipboard]="true" />
   * ```
   */
  clipboard = input<boolean | ClipboardConfig>();

  /**
   * Enable right-click context menu.
   *
   * **Requires feature import:**
   * ```typescript
   * import '@toolbox-web/grid-angular/features/context-menu';
   * ```
   *
   * @example
   * ```html
   * <tbw-grid [contextMenu]="true" />
   * ```
   */
  contextMenu = input<boolean | ContextMenuConfig>();

  /**
   * Enable multi-column sorting.
   *
   * Multi-sort allows users to sort by multiple columns simultaneously.
   * For basic single-column sorting, columns with `sortable: true` work without this plugin.
   *
   * **Requires feature import:**
   * ```typescript
   * import '@toolbox-web/grid-angular/features/multi-sort';
   * ```
   *
   * @example
   * ```html
   * <!-- Enable multi-column sorting -->
   * <tbw-grid [multiSort]="true" />
   *
   * <!-- Limit to single column (uses plugin but restricts to 1 column) -->
   * <tbw-grid [multiSort]="'single'" />
   *
   * <!-- Full config -->
   * <tbw-grid [multiSort]="{ maxSortColumns: 3 }" />
   * ```
   */
  multiSort = input<boolean | 'single' | 'multi' | MultiSortConfig>();

  /**
   * Enable column filtering.
   *
   * **Requires feature import:**
   * ```typescript
   * import '@toolbox-web/grid-angular/features/filtering';
   * ```
   *
   * @example
   * ```html
   * <tbw-grid [filtering]="true" />
   * <tbw-grid [filtering]="{ debounceMs: 200 }" />
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filtering = input<boolean | FilterConfig<any>>();

  /**
   * Enable column drag-to-reorder.
   *
   * **Requires feature import:**
   * ```typescript
   * import '@toolbox-web/grid-angular/features/reorder-columns';
   * ```
   *
   * @example
   * ```html
   * <tbw-grid [reorderColumns]="true" />
   * ```
   */
  reorderColumns = input<boolean | ReorderConfig>();

  /**
   * Enable column visibility toggle panel.
   *
   * **Requires feature import:**
   * ```typescript
   * import '@toolbox-web/grid-angular/features/visibility';
   * ```
   *
   * @example
   * ```html
   * <tbw-grid [visibility]="true" />
   * ```
   */
  visibility = input<boolean | VisibilityConfig>();

  /**
   * Enable pinned/sticky columns.
   * Columns are pinned via the `sticky` column property.
   *
   * **Requires feature import:**
   * ```typescript
   * import '@toolbox-web/grid-angular/features/pinned-columns';
   * ```
   *
   * @example
   * ```html
   * <tbw-grid [pinnedColumns]="true" [columns]="[
   *   { field: 'id', pinned: 'left' },
   *   { field: 'name' },
   *   { field: 'actions', pinned: 'right' }
   * ]" />
   * ```
   */
  pinnedColumns = input<boolean>();

  /**
   * Enable multi-level column headers (column groups).
   *
   * **Requires feature import:**
   * ```typescript
   * import '@toolbox-web/grid-angular/features/grouping-columns';
   * ```
   *
   * @example
   * ```html
   * <tbw-grid [groupingColumns]="true" />
   * ```
   */
  groupingColumns = input<boolean | GroupingColumnsConfig>();

  /**
   * Enable horizontal column virtualization for wide grids.
   *
   * **Requires feature import:**
   * ```typescript
   * import '@toolbox-web/grid-angular/features/column-virtualization';
   * ```
   *
   * @example
   * ```html
   * <tbw-grid [columnVirtualization]="true" />
   * ```
   */
  columnVirtualization = input<boolean | ColumnVirtualizationConfig>();

  /**
   * Enable row drag-to-reorder.
   *
   * @deprecated Use `rowDragDrop` instead. `reorderRows` remains as an alias.
   *
   * **Requires feature import:**
   * ```typescript
   * import '@toolbox-web/grid-angular/features/reorder-rows';
   * ```
   */
  reorderRows = input<boolean | RowReorderConfig>();

  /**
   * Enable row drag-and-drop within and across grids.
   *
   * **Requires feature import:**
   * ```typescript
   * import '@toolbox-web/grid-angular/features/row-drag-drop';
   * ```
   *
   * @example
   * ```html
   * <tbw-grid [rowDragDrop]="{ dropZone: 'employees', operation: 'move' }" />
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rowDragDrop = input<boolean | RowDragDropConfig<any>>();

  /**
   * Enable row grouping by field values.
   *
   * **Requires feature import:**
   * ```typescript
   * import '@toolbox-web/grid-angular/features/grouping-rows';
   * ```
   *
   * @example
   * ```html
   * <tbw-grid [groupingRows]="{ groupBy: ['department'] }" />
   * ```
   */
  groupingRows = input<GroupingRowsConfig>();

  /**
   * Enable pinned rows (aggregation/status bar).
   *
   * **Requires feature import:**
   * ```typescript
   * import '@toolbox-web/grid-angular/features/pinned-rows';
   * ```
   *
   * @example
   * ```html
   * <tbw-grid [pinnedRows]="{ bottom: [{ type: 'aggregation' }] }" />
   * ```
   */
  pinnedRows = input<boolean | PinnedRowsConfig>();

  /**
   * Enable hierarchical tree view.
   *
   * **Requires feature import:**
   * ```typescript
   * import '@toolbox-web/grid-angular/features/tree';
   * ```
   *
   * @example
   * ```html
   * <tbw-grid [tree]="{ childrenField: 'children' }" />
   * ```
   */
  tree = input<boolean | TreeConfig>();

  /**
   * Enable master-detail expandable rows.
   *
   * **Requires feature import:**
   * ```typescript
   * import '@toolbox-web/grid-angular/features/master-detail';
   * ```
   *
   * @example
   * ```html
   * <tbw-grid [masterDetail]="{ detailRenderer: detailFn }" />
   * ```
   */
  masterDetail = input<MasterDetailConfig>();

  /**
   * Enable responsive card layout for narrow viewports.
   *
   * **Requires feature import:**
   * ```typescript
   * import '@toolbox-web/grid-angular/features/responsive';
   * ```
   *
   * @example
   * ```html
   * <tbw-grid [responsive]="{ breakpoint: 768 }" />
   * ```
   */
  responsive = input<boolean | ResponsivePluginConfig>();

  /**
   * Enable undo/redo for cell edits. Requires editing to be enabled.
   *
   * **Requires feature import:**
   * ```typescript
   * import '@toolbox-web/grid-angular/features/undo-redo';
   * ```
   *
   * @example
   * ```html
   * <tbw-grid [editing]="'dblclick'" [undoRedo]="true" />
   * ```
   */
  undoRedo = input<boolean | UndoRedoConfig>();

  /**
   * Enable CSV/JSON export functionality.
   *
   * **Requires feature import:**
   * ```typescript
   * import '@toolbox-web/grid-angular/features/export';
   * ```
   *
   * @example
   * ```html
   * <tbw-grid [export]="true" />
   * <tbw-grid [export]="{ filename: 'data.csv' }" />
   * ```
   */
  exportFeature = input<boolean | ExportConfig>(undefined, { alias: 'export' });

  /**
   * Enable print functionality.
   *
   * **Requires feature import:**
   * ```typescript
   * import '@toolbox-web/grid-angular/features/print';
   * ```
   *
   * @example
   * ```html
   * <tbw-grid [print]="true" />
   * ```
   */
  print = input<boolean | PrintConfig>();

  /**
   * Enable pivot table functionality.
   *
   * **Requires feature import:**
   * ```typescript
   * import '@toolbox-web/grid-angular/features/pivot';
   * ```
   *
   * @example
   * ```html
   * <tbw-grid [pivot]="{ rowFields: ['category'], valueField: 'sales' }" />
   * ```
   */
  pivot = input<PivotConfig>();

  /**
   * Enable server-side data operations.
   *
   * **Requires feature import:**
   * ```typescript
   * import '@toolbox-web/grid-angular/features/server-side';
   * ```
   *
   * @example
   * ```html
   * <tbw-grid [serverSide]="{ dataSource: fetchDataFn }" />
   * ```
   */
  serverSide = input<ServerSideConfig>();

  /**
   * Controls the tooltip behavior for the grid.
   *
   * @example
   * ```html
   * <tbw-grid [tooltip]="true" />
   * <tbw-grid [tooltip]="{ header: true, cell: false }" />
   * ```
   */
  tooltip = input<boolean | TooltipConfig>();

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT OUTPUTS - All grid events
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Emitted when a cell is clicked.
   *
   * @example
   * ```html
   * <tbw-grid (cellClick)="onCellClick($event)">...</tbw-grid>
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cellClick = output<CellClickDetail<any>>();

  /**
   * Emitted when a row is clicked.
   *
   * @example
   * ```html
   * <tbw-grid (rowClick)="onRowClick($event)">...</tbw-grid>
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rowClick = output<RowClickDetail<any>>();

  /**
   * Emitted when a cell is activated (Enter key or double-click).
   *
   * @example
   * ```html
   * <tbw-grid (cellActivate)="onCellActivate($event)">...</tbw-grid>
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cellActivate = output<CellActivateDetail<any>>();

  /**
   * Emitted when a cell value changes (before commit).
   *
   * @example
   * ```html
   * <tbw-grid (cellChange)="onCellChange($event)">...</tbw-grid>
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cellChange = output<CellChangeDetail<any>>();

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
   * Emitted when a cell edit is cancelled (Escape, click outside without
   * commit, or `editor.cancel()`).
   *
   * @example
   * ```html
   * <tbw-grid (cellCancel)="onCellCancel($event)">...</tbw-grid>
   * ```
   */
  cellCancel = output<CellCancelDetail>();

  /**
   * Emitted when a cell editor opens.
   *
   * @example
   * ```html
   * <tbw-grid (editOpen)="onEditOpen($event)">...</tbw-grid>
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editOpen = output<EditOpenDetail<any>>();

  /**
   * Emitted before an editor closes. Useful for last-chance validation.
   *
   * @example
   * ```html
   * <tbw-grid (beforeEditClose)="onBeforeEditClose($event)">...</tbw-grid>
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  beforeEditClose = output<BeforeEditCloseDetail<any>>();

  /**
   * Emitted after an editor closes (whether committed or cancelled).
   *
   * @example
   * ```html
   * <tbw-grid (editClose)="onEditClose($event)">...</tbw-grid>
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editClose = output<EditCloseDetail<any>>();

  /**
   * Emitted when the dirty / changed-rows state transitions.
   *
   * @example
   * ```html
   * <tbw-grid (dirtyChange)="onDirtyChange($event)">...</tbw-grid>
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dirtyChange = output<DirtyChangeDetail<any>>();

  /**
   * Emitted when row data is replaced (e.g. via the `rows` setter).
   *
   * @example
   * ```html
   * <tbw-grid (dataChange)="onDataChange($event)">...</tbw-grid>
   * ```
   */
  dataChange = output<DataChangeDetail>();

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

  /**
   * Emitted when the changed rows are reset.
   *
   * @example
   * ```html
   * <tbw-grid (changedRowsReset)="onChangedRowsReset($event)">...</tbw-grid>
   * ```
   */
  changedRowsReset = output<ChangedRowsResetDetail>();

  /**
   * Emitted when sort state changes.
   *
   * @example
   * ```html
   * <tbw-grid (sortChange)="onSortChange($event)">...</tbw-grid>
   * ```
   */
  sortChange = output<SortChangeDetail>();

  /**
   * Emitted when filter values change.
   *
   * @example
   * ```html
   * <tbw-grid (filterChange)="onFilterChange($event)">...</tbw-grid>
   * ```
   */
  filterChange = output<FilterChangeDetail>();

  /**
   * Emitted when a column is resized.
   *
   * @example
   * ```html
   * <tbw-grid (columnResize)="onColumnResize($event)">...</tbw-grid>
   * ```
   */
  columnResize = output<ColumnResizeDetail>();

  /**
   * Emitted when a column's width is reset (double-click on the resize handle).
   *
   * @example
   * ```html
   * <tbw-grid (columnResizeReset)="onColumnResizeReset($event)">...</tbw-grid>
   * ```
   */
  columnResizeReset = output<ColumnResizeResetDetail>();

  /**
   * Emitted when a column is moved via drag-and-drop.
   *
   * @example
   * ```html
   * <tbw-grid (columnMove)="onColumnMove($event)">...</tbw-grid>
   * ```
   */
  columnMove = output<ColumnMoveDetail>();

  /**
   * Emitted when a column is shown or hidden — either via the visibility
   * sidebar, `grid.toggleColumnVisibility(field)`, `grid.setColumnVisible(field, visible)`,
   * or `grid.showAllColumns()`.
   *
   * @example
   * ```html
   * <tbw-grid (columnVisibility)="onColumnVisibility($event)">...</tbw-grid>
   * ```
   */
  columnVisibility = output<ColumnVisibilityDetail>();

  /**
   * Emitted when column state changes (resize, reorder, visibility).
   *
   * @example
   * ```html
   * <tbw-grid (columnStateChange)="onColumnStateChange($event)">...</tbw-grid>
   * ```
   */
  columnStateChange = output<GridColumnState>();

  /**
   * Emitted when selection changes.
   *
   * @example
   * ```html
   * <tbw-grid (selectionChange)="onSelectionChange($event)">...</tbw-grid>
   * ```
   */
  selectionChange = output<SelectionChangeDetail>();

  /**
   * Emitted when a row is moved via drag-and-drop.
   *
   * @example
   * ```html
   * <tbw-grid (rowMove)="onRowMove($event)">...</tbw-grid>
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rowMove = output<RowMoveDetail<any>>();

  /**
   * Emitted when a row drag starts. Cancelable via `event.preventDefault()`.
   *
   * @example
   * ```html
   * <tbw-grid (rowDragStart)="onRowDragStart($event)">...</tbw-grid>
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rowDragStart = output<RowDragStartDetail<any>>();

  /**
   * Emitted when a row drag ends (after drop or cancel).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rowDragEnd = output<RowDragEndDetail<any>>();

  /**
   * Emitted on the target grid when rows are dropped from another grid.
   * Cancelable via `event.preventDefault()`.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rowDrop = output<RowDropDetail<any>>();

  /**
   * Emitted on BOTH source and target grids after a successful cross-grid
   * row transfer.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rowTransfer = output<RowTransferDetail<any>>();

  /**
   * Emitted when a group is expanded or collapsed.
   *
   * @example
   * ```html
   * <tbw-grid (groupToggle)="onGroupToggle($event)">...</tbw-grid>
   * ```
   */
  groupToggle = output<GroupToggleDetail>();

  /**
   * Emitted when a group is expanded.
   *
   * @example
   * ```html
   * <tbw-grid (groupExpand)="onGroupExpand($event)">...</tbw-grid>
   * ```
   */
  groupExpand = output<GroupExpandDetail>();

  /**
   * Emitted when a group is collapsed.
   *
   * @example
   * ```html
   * <tbw-grid (groupCollapse)="onGroupCollapse($event)">...</tbw-grid>
   * ```
   */
  groupCollapse = output<GroupCollapseDetail>();

  /**
   * Emitted when a tree node is expanded.
   *
   * @example
   * ```html
   * <tbw-grid (treeExpand)="onTreeExpand($event)">...</tbw-grid>
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  treeExpand = output<TreeExpandDetail<any>>();

  /**
   * Emitted when a detail panel is expanded or collapsed.
   *
   * @example
   * ```html
   * <tbw-grid (detailExpand)="onDetailExpand($event)">...</tbw-grid>
   * ```
   */
  detailExpand = output<DetailExpandDetail>();

  /**
   * Emitted when responsive mode changes (table ↔ card).
   *
   * @example
   * ```html
   * <tbw-grid (responsiveChange)="onResponsiveChange($event)">...</tbw-grid>
   * ```
   */
  responsiveChange = output<ResponsiveChangeDetail>();

  /**
   * Emitted when the context menu opens.
   *
   * @example
   * ```html
   * <tbw-grid (contextMenuOpen)="onContextMenuOpen($event)">...</tbw-grid>
   * ```
   */
  contextMenuOpen = output<ContextMenuOpenDetail>();

  /**
   * Emitted when cells are copied to clipboard.
   *
   * @example
   * ```html
   * <tbw-grid (copy)="onCopy($event)">...</tbw-grid>
   * ```
   */
  copy = output<CopyDetail>();

  /**
   * Emitted when cells are pasted from clipboard.
   *
   * @example
   * ```html
   * <tbw-grid (paste)="onPaste($event)">...</tbw-grid>
   * ```
   */
  paste = output<PasteDetail>();

  /**
   * Emitted when an undo action is performed.
   *
   * @example
   * ```html
   * <tbw-grid (undo)="onUndo($event)">...</tbw-grid>
   * ```
   */
  undo = output<UndoRedoDetail>();

  /**
   * Emitted when a redo action is performed.
   *
   * @example
   * ```html
   * <tbw-grid (redo)="onRedo($event)">...</tbw-grid>
   * ```
   */
  redo = output<UndoRedoDetail>();

  /**
   * Emitted when export completes.
   *
   * @example
   * ```html
   * <tbw-grid (exportComplete)="onExportComplete($event)">...</tbw-grid>
   * ```
   */
  exportComplete = output<ExportCompleteDetail>();

  /**
   * Emitted when print starts.
   *
   * @example
   * ```html
   * <tbw-grid (printStart)="onPrintStart($event)">...</tbw-grid>
   * ```
   */
  printStart = output<PrintStartDetail>();

  /**
   * Emitted when print completes.
   *
   * @example
   * ```html
   * <tbw-grid (printComplete)="onPrintComplete($event)">...</tbw-grid>
   * ```
   */
  printComplete = output<PrintCompleteDetail>();

  /**
   * Emitted (rAF-batched) when the grid's viewport is scrolled vertically.
   *
   * For server-side pagination of large datasets prefer `ServerSidePlugin`
   * — this event is the lower-level primitive for custom load-more triggers,
   * deferring heavy cell content, dismissing overlays, etc.
   *
   * Named `tbwScroll` (not `scroll`) to avoid collision with the native DOM
   * scroll event that bubbles from focusable internals.
   *
   * @example
   * ```html
   * <tbw-grid (tbwScroll)="onScroll($event)">...</tbw-grid>
   * ```
   */
  tbwScroll = output<TbwScrollDetail>();

  // Map of output names to event names for automatic wiring.
  //
  // The `satisfies` clause enforces compile-time sync against
  // `DataGridEventMap`: every value must be a real event name (typos and
  // stale entries pointing at non-existent events fail to compile).
  // Plugin event augmentations of `DataGridEventMap` flow through
  // automatically via the `/all` import.
  private readonly eventOutputMap = {
    cellClick: 'cell-click',
    rowClick: 'row-click',
    cellActivate: 'cell-activate',
    cellChange: 'cell-change',
    cellCommit: 'cell-commit',
    cellCancel: 'cell-cancel',
    rowCommit: 'row-commit',
    changedRowsReset: 'changed-rows-reset',
    editOpen: 'edit-open',
    beforeEditClose: 'before-edit-close',
    editClose: 'edit-close',
    dirtyChange: 'dirty-change',
    dataChange: 'data-change',
    sortChange: 'sort-change',
    filterChange: 'filter-change',
    columnResize: 'column-resize',
    columnResizeReset: 'column-resize-reset',
    columnMove: 'column-move',
    columnVisibility: 'column-visibility',
    columnStateChange: 'column-state-change',
    selectionChange: 'selection-change',
    rowMove: 'row-move',
    rowDragStart: 'row-drag-start',
    rowDragEnd: 'row-drag-end',
    rowDrop: 'row-drop',
    rowTransfer: 'row-transfer',
    groupToggle: 'group-toggle',
    groupExpand: 'group-expand',
    groupCollapse: 'group-collapse',
    treeExpand: 'tree-expand',
    detailExpand: 'detail-expand',
    responsiveChange: 'responsive-change',
    contextMenuOpen: 'context-menu-open',
    copy: 'copy',
    paste: 'paste',
    undo: 'undo',
    redo: 'redo',
    exportComplete: 'export-complete',
    printStart: 'print-start',
    printComplete: 'print-complete',
    tbwScroll: 'tbw-scroll',
  } as const satisfies Readonly<Record<string, keyof DataGridEventMap<unknown>>>;

  // ─────────────────────────────────────────────────────────────────────────
  // Forward-only event coverage guard.
  //
  // Mirrors the React adapter's `_AssertFeaturePropsCoverCore` pattern. If a
  // new event is added to core's `DataGridEventMap` (via plugin module
  // augmentation in `/all`) but no `eventOutputMap` entry covers it, this
  // type fails to evaluate to `true` and the build breaks. Adapter consumers
  // never see a silently-dropped event.
  //
  // Reverse direction (extra `eventOutputMap` entries pointing at non-existent
  // events) is already enforced by the `satisfies` clause above.
  //
  // To consciously omit an event from the Angular surface, add it to the
  // `IntentionallyOmittedEvents` union below with a comment explaining why.
  // ─────────────────────────────────────────────────────────────────────────
  /** Events deliberately not exposed as Angular outputs. Keep empty unless documented. */
  declare private _intentionallyOmittedEvents: never;
  declare private _assertEventOutputMapCoversCore: [
    Exclude<
      keyof DataGridEventMap<unknown>,
      | (typeof Grid.prototype.eventOutputMap)[keyof typeof Grid.prototype.eventOutputMap]
      | Grid['_intentionallyOmittedEvents']
    >,
  ] extends [never]
    ? true
    : [
        'Missing Angular outputs for core grid events:',
        Exclude<
          keyof DataGridEventMap<unknown>,
          | (typeof Grid.prototype.eventOutputMap)[keyof typeof Grid.prototype.eventOutputMap]
          | Grid['_intentionallyOmittedEvents']
        >,
      ];

  // Store event listeners for cleanup
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private eventListeners: Map<string, (e: Event) => void> = new Map();

  ngOnInit(): void {
    // Create and register the adapter
    this.adapter = new GridAdapter(this.injector, this.appRef, this.viewContainerRef);
    GridElementClass.registerAdapter(this.adapter);

    const grid = this.elementRef.nativeElement;

    // Register adapter on the grid element so processConfig is called
    // automatically by the grid's set gridConfig setter, and so
    // MasterDetailPlugin can use it via the __frameworkAdapter hook during attach()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (grid as any).__frameworkAdapter = this.adapter;

    // Wire up all event listeners based on eventOutputMap
    this.setupEventListeners(grid);
  }

  /**
   * Sets up event listeners for all outputs using the eventOutputMap.
   */
  private setupEventListeners(grid: GridElement): void {
    // Wire up all event listeners
    for (const [outputName, eventName] of Object.entries(this.eventOutputMap)) {
      const listener = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this as any)[outputName].emit(detail);
      };
      grid.addEventListener(eventName, listener);
      this.eventListeners.set(eventName, listener);
    }
  }

  /**
   * Creates plugins from feature inputs.
   * Uses the feature registry to allow tree-shaking - only imported features are bundled.
   * Per-feature config bridging (e.g. converting Angular component classes inside
   * `groupingColumns` / `groupingRows` / `pinnedRows` configs to renderer functions)
   * runs via `getFeatureConfigPreprocessor`, populated by feature secondary entries.
   * Returns the array of created plugins (doesn't modify grid).
   */
  private createFeaturePlugins(): unknown[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plugins: unknown[] = [];
    const adapter = this.adapter;

    // Helper to add plugin if feature is registered
    const addPlugin = (name: FeatureName, config: unknown) => {
      if (config === undefined || config === null || config === false) return;
      // Apply per-feature config preprocessor (registered by feature secondary entries)
      // to bridge Angular component classes embedded in the config before instantiation.
      let finalConfig: unknown = config;
      if (adapter && config !== true && typeof config === 'object') {
        const preprocess = getFeatureConfigPreprocessor(name);
        if (preprocess) finalConfig = preprocess(config, adapter);
      }
      const plugin = createPluginFromFeature(name, finalConfig);
      if (plugin) plugins.push(plugin);
    };

    addPlugin('selection', this.selection());
    addPlugin('editing', this.editing());
    addPlugin('clipboard', this.clipboard());
    addPlugin('contextMenu', this.contextMenu());
    addPlugin('multiSort', this.multiSort());
    addPlugin('filtering', this.filtering());
    addPlugin('reorderColumns', this.reorderColumns());
    addPlugin('visibility', this.visibility());
    addPlugin('pinnedColumns', this.pinnedColumns());
    addPlugin('groupingColumns', this.groupingColumns());
    addPlugin('columnVirtualization', this.columnVirtualization());
    addPlugin('reorderRows', this.reorderRows());
    addPlugin('rowDragDrop', this.rowDragDrop());
    addPlugin('groupingRows', this.groupingRows());
    addPlugin('pinnedRows', this.pinnedRows());
    addPlugin('tree', this.tree());
    addPlugin('masterDetail', this.masterDetail());
    addPlugin('responsive', this.responsive());
    addPlugin('undoRedo', this.undoRedo());
    addPlugin('export', this.exportFeature());
    addPlugin('print', this.print());
    addPlugin('pivot', this.pivot());
    addPlugin('serverSide', this.serverSide());
    addPlugin('tooltip', this.tooltip());

    return plugins;
  }

  ngAfterContentInit(): void {
    // After Angular child directives have initialized (GridColumnView, GridColumnEditor, GridDetailView, GridToolPanel),
    // force the grid to re-parse light DOM columns so adapters can create renderers/editors
    const grid = this.elementRef.nativeElement;
    if (grid && typeof (grid as any).refreshColumns === 'function') {
      // Use setTimeout to ensure Angular effects have run (template registration)
      setTimeout(() => {
        (grid as any).refreshColumns();

        // Run feature-registered template bridges. Each bridge wires a specific
        // light-DOM slot element (<tbw-grid-detail>, <tbw-grid-responsive-card>, ...)
        // to its plugin. Bridges are registered by feature secondary entries
        // (e.g. `import '@toolbox-web/grid-angular/features/master-detail';`).
        if (this.adapter) {
          runTemplateBridges({ grid, adapter: this.adapter });
        }

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
   * Registers custom styles into the grid.
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

  ngOnDestroy(): void {
    const grid = this.elementRef.nativeElement;

    // Cleanup all event listeners
    if (grid) {
      for (const [eventName, listener] of this.eventListeners) {
        grid.removeEventListener(eventName, listener);
      }
      this.eventListeners.clear();
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
