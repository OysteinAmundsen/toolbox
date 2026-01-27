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
  CellActivateDetail,
  CellChangeDetail,
  CellClickDetail,
  ChangedRowsResetDetail,
  ColumnResizeDetail,
  GridColumnState,
  DataGridElement as GridElement,
  RowClickDetail,
  SortChangeDetail,
} from '@toolbox-web/grid';
// eslint-disable-next-line @nx/enforce-module-boundaries -- Intentional: need class reference for registerAdapter
import { DataGridElement as GridElementClass } from '@toolbox-web/grid';
// Import plugin types and the two plugins always needed for Angular template integration
import type {
  ClipboardConfig,
  ColumnMoveDetail,
  ColumnVirtualizationConfig,
  ColumnVisibilityDetail,
  ContextMenuConfig,
  CopyDetail,
  DetailExpandDetail,
  ExportCompleteDetail,
  ExportConfig,
  FilterChangeDetail,
  FilterConfig,
  GroupingColumnsConfig,
  GroupingRowsConfig,
  GroupToggleDetail,
  MasterDetailConfig,
  MasterDetailPlugin,
  MultiSortConfig,
  PasteDetail,
  PinnedRowsConfig,
  PivotConfig,
  PrintCompleteDetail,
  PrintConfig,
  PrintStartDetail,
  ReorderConfig,
  ResponsiveChangeDetail,
  ResponsivePlugin,
  ResponsivePluginConfig,
  RowMoveDetail,
  RowReorderConfig,
  SelectionChangeDetail,
  SelectionConfig,
  ServerSideConfig,
  TreeConfig,
  TreeExpandDetail,
  UndoRedoConfig,
  UndoRedoDetail,
  VisibilityConfig,
} from '@toolbox-web/grid/all';
import type { AngularGridConfig } from '../angular-column-config';
import { AngularGridAdapter } from '../angular-grid-adapter';
import { createPluginFromFeature, type FeatureName } from '../feature-registry';

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
 * - Injects custom styles into the grid
 * - Handles cleanup on destruction
 */
@Directive({ selector: 'tbw-grid' })
export class Grid implements OnInit, AfterContentInit, OnDestroy {
  private elementRef = inject(ElementRef<GridElement>);
  private injector = inject(EnvironmentInjector);
  private appRef = inject(ApplicationRef);
  private viewContainerRef = inject(ViewContainerRef);

  private adapter: AngularGridAdapter | null = null;

  constructor() {
    // Effect to process angularConfig and apply to grid
    // This merges feature input plugins with the user's config plugins
    effect(() => {
      const config = this.angularConfig();
      if (!this.adapter) return;

      // Process the config to convert component classes to actual renderer/editor functions
      const processedConfig = config ? this.adapter.processGridConfig(config) : {};

      // Create plugins from feature inputs and merge with config plugins
      const featurePlugins = this.createFeaturePlugins();
      const configPlugins = processedConfig.plugins || [];

      // Merge: feature plugins first, then config plugins
      const mergedPlugins = [...featurePlugins, ...configPlugins];

      // Apply to the grid element
      const grid = this.elementRef.nativeElement;
      grid.gridConfig = {
        ...processedConfig,
        plugins: mergedPlugins.length > 0 ? mergedPlugins : undefined,
      };
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
   * Angular-specific grid configuration that supports component classes for renderers/editors.
   *
   * Use this input when you want to specify Angular component classes directly in column configs.
   * Components must implement the appropriate interfaces:
   * - Renderers: `AngularCellRenderer<TRow, TValue>` - requires `value()` and `row()` signal inputs
   * - Editors: `AngularCellEditor<TRow, TValue>` - adds `commit` and `cancel` outputs
   *
   * The directive automatically processes component classes and converts them to grid-compatible
   * renderer/editor functions before applying to the grid.
   *
   * @example
   * ```typescript
   * // Component that implements AngularCellEditor
   * @Component({...})
   * export class BonusEditorComponent implements AngularCellEditor<Employee, number> {
   *   value = input.required<number>();
   *   row = input.required<Employee>();
   *   commit = output<number>();
   *   cancel = output<void>();
   * }
   *
   * // In your grid config
   * config: AngularGridConfig<Employee> = {
   *   columns: [
   *     { field: 'name', header: 'Name' },
   *     { field: 'bonus', header: 'Bonus', editable: true, editor: BonusEditorComponent }
   *   ]
   * };
   * ```
   *
   * ```html
   * <tbw-grid [angularConfig]="config" [rows]="employees"></tbw-grid>
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  angularConfig = input<AngularGridConfig<any>>();

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
   * ```
   */
  editing = input<boolean | 'click' | 'dblclick' | 'manual'>();

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
   * Enable column sorting.
   *
   * **Requires feature import:**
   * ```typescript
   * import '@toolbox-web/grid-angular/features/sorting';
   * ```
   *
   * @example
   * ```html
   * <!-- Enable with default (multi-sort) -->
   * <tbw-grid [sorting]="true" />
   *
   * <!-- Single column sort only -->
   * <tbw-grid [sorting]="'single'" />
   *
   * <!-- Multi-column sort -->
   * <tbw-grid [sorting]="'multi'" />
   * ```
   */
  sorting = input<boolean | 'single' | 'multi' | MultiSortConfig>();

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
   * import '@toolbox-web/grid-angular/features/reorder';
   * ```
   *
   * @example
   * ```html
   * <tbw-grid [reorder]="true" />
   * ```
   */
  reorder = input<boolean | ReorderConfig>();

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
   *   { field: 'id', sticky: 'left' },
   *   { field: 'name' },
   *   { field: 'actions', sticky: 'right' }
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
   * <tbw-grid [groupingColumns]="{ columnGroups: [...] }" />
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
   * **Requires feature import:**
   * ```typescript
   * import '@toolbox-web/grid-angular/features/row-reorder';
   * ```
   *
   * @example
   * ```html
   * <tbw-grid [rowReorder]="true" />
   * ```
   */
  rowReorder = input<boolean | RowReorderConfig>();

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
  exportFeature = input<boolean | ExportConfig>();

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
   * Emitted when a column is moved via drag-and-drop.
   *
   * @example
   * ```html
   * <tbw-grid (columnMove)="onColumnMove($event)">...</tbw-grid>
   * ```
   */
  columnMove = output<ColumnMoveDetail>();

  /**
   * Emitted when column visibility changes.
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
   * Emitted when a group is expanded or collapsed.
   *
   * @example
   * ```html
   * <tbw-grid (groupToggle)="onGroupToggle($event)">...</tbw-grid>
   * ```
   */
  groupToggle = output<GroupToggleDetail>();

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
   * Emitted when undo/redo is performed.
   *
   * @example
   * ```html
   * <tbw-grid (undoRedoAction)="onUndoRedo($event)">...</tbw-grid>
   * ```
   */
  undoRedoAction = output<UndoRedoDetail>();

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

  // Map of output names to event names for automatic wiring
  private readonly eventOutputMap = {
    cellClick: 'cell-click',
    rowClick: 'row-click',
    cellActivate: 'cell-activate',
    cellChange: 'cell-change',
    cellCommit: 'cell-commit',
    rowCommit: 'row-commit',
    changedRowsReset: 'changed-rows-reset',
    sortChange: 'sort-change',
    filterChange: 'filter-change',
    columnResize: 'column-resize',
    columnMove: 'column-move',
    columnVisibility: 'column-visibility',
    columnStateChange: 'column-state-change',
    selectionChange: 'selection-change',
    rowMove: 'row-move',
    groupToggle: 'group-toggle',
    treeExpand: 'tree-expand',
    detailExpand: 'detail-expand',
    responsiveChange: 'responsive-change',
    copy: 'copy',
    paste: 'paste',
    undoRedoAction: 'undo-redo',
    exportComplete: 'export-complete',
    printStart: 'print-start',
    printComplete: 'print-complete',
  } as const;

  // Store event listeners for cleanup
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private eventListeners: Map<string, (e: Event) => void> = new Map();

  ngOnInit(): void {
    // Create and register the adapter
    this.adapter = new AngularGridAdapter(this.injector, this.appRef, this.viewContainerRef);
    GridElementClass.registerAdapter(this.adapter);

    const grid = this.elementRef.nativeElement;

    // Wire up all event listeners based on eventOutputMap
    this.setupEventListeners(grid);

    // Register adapter on the grid element so MasterDetailPlugin can use it
    // via the __frameworkAdapter hook during attach()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (grid as any).__frameworkAdapter = this.adapter;
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
   * Returns the array of created plugins (doesn't modify grid).
   */
  private createFeaturePlugins(): unknown[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plugins: unknown[] = [];

    // Helper to add plugin if feature is registered
    const addPlugin = (name: FeatureName, config: unknown) => {
      if (config === undefined || config === null || config === false) return;
      const plugin = createPluginFromFeature(name, config);
      if (plugin) plugins.push(plugin);
    };

    // Add plugins for each feature input
    addPlugin('selection', this.selection());
    addPlugin('editing', this.editing());
    addPlugin('clipboard', this.clipboard());
    addPlugin('contextMenu', this.contextMenu());
    addPlugin('sorting', this.sorting());
    addPlugin('filtering', this.filtering());
    addPlugin('reorder', this.reorder());
    addPlugin('visibility', this.visibility());
    addPlugin('pinnedColumns', this.pinnedColumns());
    addPlugin('groupingColumns', this.groupingColumns());
    addPlugin('columnVirtualization', this.columnVirtualization());
    addPlugin('rowReorder', this.rowReorder());
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

        // Configure MasterDetailPlugin after Angular templates are registered
        this.configureMasterDetail(grid);

        // Configure ResponsivePlugin card renderer if template is present
        this.configureResponsiveCard(grid);

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

  /**
   * Configures the MasterDetailPlugin after Angular templates are registered.
   * - If plugin exists: refresh its detail renderer
   * - If plugin doesn't exist but <tbw-grid-detail> is present: dynamically import and add the plugin
   */
  private async configureMasterDetail(grid: GridElement): Promise<void> {
    if (!this.adapter) return;

    // Check for existing plugin by name to avoid importing the class
    const existingPlugin = grid.gridConfig?.plugins?.find((p) => (p as { name?: string }).name === 'masterDetail') as
      | MasterDetailPlugin
      | undefined;

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

    // Dynamically import the plugin to avoid bundling it when not used
    const { MasterDetailPlugin } = await import('@toolbox-web/grid/plugins/master-detail');

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

  /**
   * Configures the ResponsivePlugin with Angular template-based card renderer.
   * - If plugin exists: updates its cardRenderer configuration
   * - If plugin doesn't exist but <tbw-grid-responsive-card> is present: logs a warning
   */
  private configureResponsiveCard(grid: GridElement): void {
    if (!this.adapter) return;

    // Check if <tbw-grid-responsive-card> is present in light DOM
    const cardElement = (grid as unknown as Element).querySelector('tbw-grid-responsive-card');
    if (!cardElement) return;

    // Create card renderer from Angular template
    const cardRenderer = this.adapter.createResponsiveCardRenderer(grid as unknown as HTMLElement);
    if (!cardRenderer) return;

    // Find existing plugin by name to avoid importing the class
    const existingPlugin = grid.gridConfig?.plugins?.find((p) => (p as { name?: string }).name === 'responsive') as
      | ResponsivePlugin
      | undefined;

    if (existingPlugin && typeof existingPlugin.setCardRenderer === 'function') {
      // Plugin exists - update its cardRenderer
      existingPlugin.setCardRenderer(cardRenderer);
      return;
    }

    // Plugin doesn't exist - log a warning
    console.warn(
      '[tbw-grid-angular] <tbw-grid-responsive-card> found but ResponsivePlugin is not configured.\n' +
        'Add ResponsivePlugin to your gridConfig.plugins array:\n\n' +
        '  import { ResponsivePlugin } from "@toolbox-web/grid/plugins/responsive";\n' +
        '  gridConfig = {\n' +
        '    plugins: [new ResponsivePlugin({ breakpoint: 600 })]\n' +
        '  };',
    );
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
