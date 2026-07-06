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
  ColumnInferenceMode,
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
// Import plugin config types only. Specific plugin classes are intentionally
// not imported here — feature-specific bridging lives in the feature secondary
// entries (see `internal/feature-extensions.ts`).
import type { ColumnResizeResetDetail, DataChangeDetail, DataGridEventMap, RenderDetail } from '@toolbox-web/grid/all';
import type { ColumnConfig, GridConfig } from '../angular-column-config';
import { GridAdapter } from '../angular-grid-adapter';
import { applyColumnDefaults, type ColumnShorthand, normalizeColumns } from '../column-shorthand';
import { createPluginFromFeature, type FeatureName } from '../feature-registry';
import { GridIconRegistry } from '../grid-icon-registry';
import { getFeatureClaim, isEventClaimed } from '../internal/feature-claims';
import { getFeatureConfigPreprocessor, runTemplateBridges } from '../internal/feature-extensions';

/**
 * Event detail for cell commit events.
 * @since 0.1.1
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
 * @since 0.1.1
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
 * ## Multi-version coexistence
 *
 * In single-version apps the directive matches the bare `<tbw-grid>` tag. When
 * two different grid versions share a page, the second-loaded bundle registers
 * under a version-suffixed tag (e.g. `<tbw-grid-v2-15-0>`). Because Angular
 * matches selectors at compile time, a runtime-only tag cannot be matched by
 * tag name. The directive therefore also matches the stable `[data-tbw-grid]`
 * attribute, so a suffixed grid can opt in by adding it literally:
 *
 * ```html
 * <tbw-grid-v2-15-0 data-tbw-grid [rows]="rows" [gridConfig]="config"></tbw-grid-v2-15-0>
 * ```
 *
 * Read the concrete tag from `DataGridElement.activeTag` of the bundle you
 * imported. See the multi-version coexistence guide.
 *
 * @category Directive
 * @since 0.1.0
 */
@Directive({ selector: 'tbw-grid,[data-tbw-grid]' })
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

    // Effect to sync columnInference to the grid element
    effect(() => {
      const columnInferenceValue = this.columnInference();
      const grid = this.elementRef.nativeElement;
      grid.columnInference = columnInferenceValue;
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
   * How automatic column inference combines with explicitly provided columns.
   *
   * - `'auto'` (default): infer only when no columns are provided.
   * - `'merge'`: always infer from data, then overlay provided columns by `field`.
   *
   * @example
   * ```html
   * <tbw-grid [rows]="data" columnInference="merge" />
   * <tbw-grid [rows]="data" [columnInference]="mode()" />
   * ```
   */
  columnInference = input<ColumnInferenceMode>();

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
   * Emitted when row data is replaced (e.g. via the `rows` setter).
   *
   * @example
   * ```html
   * <tbw-grid (dataChange)="onDataChange($event)">...</tbw-grid>
   * ```
   */
  dataChange = output<DataChangeDetail>();

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
   * Emitted when column state changes (resize, reorder, visibility).
   *
   * @example
   * ```html
   * <tbw-grid (columnStateChange)="onColumnStateChange($event)">...</tbw-grid>
   * ```
   */
  columnStateChange = output<GridColumnState>();

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

  /**
   * Emitted once at the end of every render-scheduler flush, after all
   * plugin `afterRender` hooks have run and `ready()` has resolved.
   *
   * Use this to act on the rendered DOM after a programmatic mutation
   * (e.g. focus the first input of a freshly added row in full-grid edit
   * mode) without `setTimeout` or double-`requestAnimationFrame` hacks.
   * The `render` event fires on every flush — including scroll-driven
   * virtual-window updates — so prefer subscribing once and unsubscribing
   * (or gating on `detail.phase >= RenderPhase.ROWS`) when you only care
   * about a specific mutation.
   *
   * @example
   * ```html
   * <tbw-grid (render)="onRender($event)">...</tbw-grid>
   * ```
   */
  render = output<RenderDetail>();

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
    dataChange: 'data-change',
    sortChange: 'sort-change',
    columnResize: 'column-resize',
    columnResizeReset: 'column-resize-reset',
    columnStateChange: 'column-state-change',
    tbwScroll: 'tbw-scroll',
    render: 'render',
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
  // To consciously omit an event from the `Grid` directive surface, add it to
  // the `_intentionallyOmittedEvents` union below with a comment explaining why.
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Events deliberately not exposed as outputs on the `Grid` directive.
   *
   * Every entry here is a **feature-owned** event surfaced by its per-feature
   * directive instead (e.g. `GridEditingDirective` declares `(cellCommit)`,
   * `GridSelectionDirective` declares `(selectionChange)`). The directive
   * claims the DOM event via `claimEvent` so it is the sole emitter. The v1.x
   * shims that forwarded these events from `Grid` were removed in v3.0.0 —
   * consumers must import the relevant feature directive.
   */
  declare private _intentionallyOmittedEvents:
    | 'cell-commit'
    | 'cell-cancel'
    | 'row-commit'
    | 'changed-rows-reset'
    | 'edit-open'
    | 'before-edit-close'
    | 'edit-close'
    | 'dirty-change'
    | 'filter-change'
    | 'column-move'
    | 'column-visibility'
    | 'selection-change'
    | 'row-move'
    | 'row-drag-start'
    | 'row-drag-end'
    | 'row-drop'
    | 'row-transfer'
    | 'group-toggle'
    | 'group-expand'
    | 'group-collapse'
    | 'tree-expand'
    | 'detail-expand'
    | 'responsive-change'
    | 'context-menu-open'
    | 'copy'
    | 'paste'
    | 'undo'
    | 'redo'
    | 'export-complete'
    | 'print-start'
    | 'print-complete';
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
   * Sets up event listeners for the core outputs in `eventOutputMap`.
   *
   * Feature-owned events (e.g. `cell-commit`, `selection-change`) are not in
   * `eventOutputMap` — they are surfaced by their per-feature directive, which
   * claims the DOM event via `claimEvent`. Events still claimed here are
   * skipped so the claiming directive's `output()` is the sole emitter.
   */
  private setupEventListeners(grid: GridElement): void {
    // Wire up all event listeners
    for (const [outputName, eventName] of Object.entries(this.eventOutputMap)) {
      if (isEventClaimed(grid, eventName)) continue;
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
   * Creates plugins from the per-feature directive claims.
   * Uses the feature registry to allow tree-shaking - only imported features are bundled.
   * Per-feature config bridging (e.g. converting Angular component classes inside
   * `groupingColumns` / `groupingRows` / `pinnedRows` configs to renderer functions)
   * runs via `getFeatureConfigPreprocessor`, populated by feature secondary entries.
   *
   * v3 ownership: feature configuration is owned entirely by the per-feature
   * attribute-selector directives (e.g. `GridFilteringDirective`). When such a
   * directive is present on the same `<tbw-grid>` element it claims its feature
   * in `feature-claims.ts`; we read the claim's config getter — which
   * transitively reads the directive's input signal, establishing reactive
   * dependency tracking. The deprecated per-feature inputs that previously
   * lived on this directive were removed in v3.0.0.
   *
   * Returns the array of created plugins (doesn't modify grid).
   */
  private createFeaturePlugins(): unknown[] {
    const plugins: unknown[] = [];
    const adapter = this.adapter;
    const grid = this.elementRef.nativeElement;

    // Helper to add a plugin when its per-feature directive claims the feature.
    const addPlugin = (name: FeatureName) => {
      // Reading the claim's getter registers the directive's input signal as a
      // dependency, so changes to e.g. `[filtering]` on the directive
      // re-trigger this effect.
      const claim = getFeatureClaim(grid, name);
      const config = claim ? claim() : undefined;
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

    addPlugin('selection');
    addPlugin('editing');
    addPlugin('clipboard');
    addPlugin('contextMenu');
    addPlugin('multiSort');
    addPlugin('filtering');
    addPlugin('reorderColumns');
    addPlugin('visibility');
    addPlugin('pinnedColumns');
    addPlugin('groupingColumns');
    addPlugin('columnVirtualization');
    addPlugin('rowDragDrop');
    addPlugin('groupingRows');
    addPlugin('pinnedRows');
    addPlugin('tree');
    addPlugin('masterDetail');
    addPlugin('responsive');
    addPlugin('undoRedo');
    addPlugin('export');
    addPlugin('print');
    addPlugin('pivot');
    addPlugin('serverSide');
    addPlugin('stickyRows');
    addPlugin('tooltip');

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
