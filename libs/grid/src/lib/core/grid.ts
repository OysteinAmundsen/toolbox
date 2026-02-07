import { createAriaState, updateAriaCounts, updateAriaLabels, type AriaState } from './internal/aria';
import { autoSizeColumns, updateTemplate } from './internal/columns';
import { ConfigManager } from './internal/config-manager';
import { setupCellEventDelegation, setupRootEventDelegation } from './internal/event-delegation';
import { renderHeader } from './internal/header';
import { cancelIdle, scheduleIdle } from './internal/idle-scheduler';
import { ensureCellVisible } from './internal/keyboard';
import {
  createLoadingOverlay,
  hideLoadingOverlay,
  setCellLoadingState,
  setRowLoadingState,
  showLoadingOverlay,
} from './internal/loading';
import {
  computeAverageExcludingPluginRows,
  getRowIndexAtOffset,
  getTotalHeight,
  measureRenderedRowHeights,
  rebuildPositionCache,
  updateRowHeight,
} from './internal/position-cache';
import { RenderPhase, RenderScheduler } from './internal/render-scheduler';
import { createResizeController } from './internal/resize';
import { animateRow, animateRowById, animateRows } from './internal/row-animation';
import { invalidateCellCache, renderVisibleRows } from './internal/rows';
import {
  buildGridDOMIntoElement,
  cleanupShellState,
  createShellController,
  createShellState,
  parseLightDomShell,
  parseLightDomToolButtons,
  parseLightDomToolPanels,
  renderCustomToolbarContents,
  renderHeaderContent,
  renderShellHeader,
  setupShellEventListeners,
  setupToolPanelResize,
  shouldRenderShellHeader,
  type ShellController,
  type ShellState,
  type ToolPanelRendererFactory,
} from './internal/shell';
import { addPluginStyles, injectStyles } from './internal/style-injector';
import {
  cancelMomentum,
  createTouchScrollState,
  setupTouchScrollListeners,
  type TouchScrollState,
} from './internal/touch-scroll';
import {
  validatePluginConfigRules,
  validatePluginIncompatibilities,
  validatePluginProperties,
} from './internal/validate-config';
import type { AfterCellRenderContext, AfterRowRenderContext, CellMouseEvent, ScrollEvent } from './plugin';
import type {
  BaseGridPlugin,
  CellClickEvent,
  HeaderClickEvent,
  PluginQuery,
  RowClickEvent,
} from './plugin/base-plugin';
import { PluginManager } from './plugin/plugin-manager';
import styles from './styles';
import type {
  AnimationConfig,
  CellChangeDetail,
  ColumnConfig,
  ColumnConfigMap,
  ColumnInternal,
  DataGridEventMap,
  FitMode,
  FrameworkAdapter,
  GridColumnState,
  GridConfig,
  HeaderContentDefinition,
  InternalGrid,
  ResizeController,
  RowAnimationType,
  ToolbarContentDefinition,
  ToolPanelDefinition,
  UpdateSource,
  VirtualState,
} from './types';
import { DEFAULT_ANIMATION_CONFIG, DEFAULT_GRID_ICONS } from './types';

/**
 * High-performance data grid web component.
 *
 * ## Instantiation
 *
 * **Do not call the constructor directly.** Web components must be created via
 * the DOM API. Use one of these approaches:
 *
 * ```typescript
 * // Recommended: Use the createGrid() factory for TypeScript type safety
 * import { createGrid, SelectionPlugin } from '@toolbox-web/grid/all';
 *
 * const grid = createGrid<Employee>({
 *   columns: [
 *     { field: 'name', header: 'Name' },
 *     { field: 'email', header: 'Email' }
 *   ],
 *   plugins: [new SelectionPlugin()]
 * });
 * grid.rows = employees;
 * document.body.appendChild(grid);
 *
 * // Alternative: Query existing element from DOM
 * import { queryGrid } from '@toolbox-web/grid';
 * const grid = queryGrid<Employee>('#my-grid');
 *
 * // Alternative: Use document.createElement (loses type inference)
 * const grid = document.createElement('tbw-grid');
 * ```
 *
 * ## Configuration Architecture
 *
 * The grid follows a **single source of truth** pattern where all configuration
 * is managed by ConfigManager. Users can set configuration via multiple inputs:
 *
 * **Input Sources (precedence low → high):**
 * 1. `gridConfig` property - base configuration object
 * 2. Light DOM elements:
 *    - `<tbw-grid-column>` → `effectiveConfig.columns`
 *    - `<tbw-grid-header title="...">` → `effectiveConfig.shell.header.title`
 *    - `<tbw-grid-header-content>` → `effectiveConfig.shell.header.content`
 * 3. `columns` property → merged into `effectiveConfig.columns`
 * 4. `fitMode` property → merged into `effectiveConfig.fitMode`
 * 5. Column inference from first row (if no columns defined)
 *
 * **Derived State:**
 * - `_columns` - processed columns from `effectiveConfig.columns` after plugin hooks
 * - `_rows` - processed rows after plugin hooks (grouping, filtering, etc.)
 *
 * ConfigManager.merge() is the single place where all inputs converge.
 * All rendering and logic should read from `effectiveConfig` or derived state.
 *
 * @element tbw-grid
 *
 * @csspart container - The main grid container
 * @csspart header - The header row container
 * @csspart body - The body/rows container
 *
 * @cssprop --tbw-color-bg - Background color
 * @cssprop --tbw-color-fg - Foreground/text color
 */
// Injected by Vite at build time from package.json
declare const __GRID_VERSION__: string;

export class DataGridElement<T = any> extends HTMLElement implements InternalGrid<T> {
  // TODO: Rename to 'data-grid' when migration is complete
  static readonly tagName = 'tbw-grid';
  /** Version of the grid component, injected at build time from package.json */
  static readonly version = typeof __GRID_VERSION__ !== 'undefined' ? __GRID_VERSION__ : 'dev';

  /** Static counter for generating unique grid IDs */
  static #instanceCounter = 0;

  // #region Static Methods - Framework Adapters
  /**
   * Registry of framework adapters that handle converting light DOM elements
   * to functional renderers/editors. Framework libraries (Angular, React, Vue)
   * register adapters to enable zero-boilerplate component integration.
   */
  private static adapters: FrameworkAdapter[] = [];

  /**
   * Register a framework adapter for handling framework-specific components.
   * Adapters are checked in registration order when processing light DOM templates.
   *
   * @example
   * ```typescript
   * // In @toolbox-web/grid-angular
   * import { AngularGridAdapter } from '@toolbox-web/grid-angular';
   *
   * // One-time setup in app
   * GridElement.registerAdapter(new AngularGridAdapter(injector, appRef));
   * ```
   * @category Framework Adapters
   */
  static registerAdapter(adapter: FrameworkAdapter): void {
    this.adapters.push(adapter);
  }

  /**
   * Get all registered framework adapters.
   * Used internally by light DOM parsing to find adapters that can handle templates.
   * @category Framework Adapters
   */
  static getAdapters(): readonly FrameworkAdapter[] {
    return this.adapters;
  }

  /**
   * Clear all registered adapters (primarily for testing).
   * @category Framework Adapters
   */
  static clearAdapters(): void {
    this.adapters = [];
  }
  // #endregion

  // #region Static Methods - Observed Attributes
  static get observedAttributes(): string[] {
    return ['rows', 'columns', 'grid-config', 'fit-mode', 'loading'];
  }
  // #endregion

  /**
   * The render root for the grid. Without Shadow DOM, this is the element itself.
   * This abstraction allows internal code to work the same way regardless of DOM mode.
   */
  get #renderRoot(): HTMLElement {
    return this;
  }

  #initialized = false;

  // Ready Promise
  #readyPromise: Promise<void>;
  #readyResolve?: () => void;

  // #region Input Properties
  // Raw rows are stored here. Config sources (gridConfig, columns, fitMode)
  // are owned by ConfigManager. Grid.ts property setters delegate to ConfigManager.
  #rows: T[] = [];
  // #endregion

  // #region Private properties
  // effectiveConfig is owned by ConfigManager - access via getter
  get #effectiveConfig(): GridConfig<T> {
    return this.#configManager?.effective ?? {};
  }

  #connected = false;

  // Batched Updates - coalesces rapid property changes into single update
  #pendingUpdate = false;
  #pendingUpdateFlags = {
    rows: false,
    columns: false,
    gridConfig: false,
    fitMode: false,
  };

  // Render Scheduler - centralizes all rendering through RAF
  #scheduler!: RenderScheduler;

  #scrollRaf = 0;
  #pendingScrollTop: number | null = null;
  #hasScrollPlugins = false; // Cached flag for plugin scroll handlers
  #needsRowHeightMeasurement = false; // Flag to measure row height after render (for plugin-based variable heights)
  #scrollMeasureTimeout = 0; // Debounce timer for measuring rows after scroll settles
  #renderRowHook?: (row: any, rowEl: HTMLElement, rowIndex: number) => boolean; // Cached hook to avoid closures
  #touchState: TouchScrollState = createTouchScrollState();
  #eventAbortController?: AbortController;
  #resizeObserver?: ResizeObserver;
  #rowHeightObserver?: ResizeObserver; // Watches first row for size changes (CSS loading, custom renderers)
  #idleCallbackHandle?: number; // Handle for cancelling deferred idle work

  // Pooled scroll event object (reused to avoid GC pressure during scroll)
  #pooledScrollEvent: ScrollEvent = {
    scrollTop: 0,
    scrollLeft: 0,
    scrollHeight: 0,
    scrollWidth: 0,
    clientHeight: 0,
    clientWidth: 0,
  };

  // Plugin System
  #pluginManager!: PluginManager;
  #lastPluginsArray?: BaseGridPlugin[]; // Track last attached plugins to avoid unnecessary re-initialization

  // Event Listeners
  #eventListenersAdded = false; // Guard against adding duplicate component-level listeners
  #scrollAbortController?: AbortController; // Separate controller for DOM scroll listeners (recreated on DOM changes)
  #scrollAreaEl?: HTMLElement; // Reference to horizontal scroll container (.tbw-scroll-area)

  // Column State
  #initialColumnState?: GridColumnState;

  // Config Manager
  #configManager!: ConfigManager<T>;

  // Shell State
  #shellState: ShellState = createShellState();
  #shellController!: ShellController;
  #resizeCleanup?: () => void;

  // Loading State
  #loading = false;
  #loadingRows = new Set<string>(); // Row IDs currently loading
  #loadingCells = new Map<string, Set<string>>(); // Map<rowId, Set<field>> for cells loading
  #loadingOverlayEl?: HTMLElement; // Cached loading overlay element

  // Row ID Map - O(1) lookup for rows by ID
  #rowIdMap = new Map<string, { row: T; index: number }>();
  // #endregion

  // #region Derived State
  // _rows: result of applying plugin processRows hooks
  _rows: T[] = [];

  // _baseColumns: columns before plugin transformation (analogous to #rows for row processing)
  // This is the source of truth for processColumns - plugins transform these
  #baseColumns: ColumnInternal<T>[] = [];

  // _columns is a getter/setter that operates on effectiveConfig.columns
  // This ensures effectiveConfig.columns is the single source of truth for columns
  // _columns always contains ALL columns (including hidden)
  get _columns(): ColumnInternal<T>[] {
    return (this.#effectiveConfig.columns ?? []) as ColumnInternal<T>[];
  }
  set _columns(value: ColumnInternal<T>[]) {
    this.#effectiveConfig.columns = value as ColumnConfig<T>[];
  }

  // visibleColumns returns only visible columns for rendering
  // This is what header/row rendering should use
  get _visibleColumns(): ColumnInternal<T>[] {
    return this._columns.filter((c) => !c.hidden);
  }
  // #endregion

  // #region Runtime State (Plugin-accessible)
  // DOM references
  _headerRowEl!: HTMLElement;
  _bodyEl!: HTMLElement;
  _rowPool: HTMLElement[] = [];
  _resizeController!: ResizeController;

  // Virtualization & scroll state
  _virtualization: VirtualState = {
    enabled: true,
    rowHeight: 28,
    bypassThreshold: 24,
    start: 0,
    end: 0,
    container: null,
    viewportEl: null,
    totalHeightEl: null,
    // Variable row height support
    positionCache: null,
    heightCache: {
      byKey: new Map<string, number>(),
      byRef: new WeakMap<object, number>(),
    },
    averageHeight: 28,
    measuredCount: 0,
    variableHeights: false,
  };

  // Focus & navigation
  _focusRow = 0;
  _focusCol = 0;
  /** Flag to restore focus styling after next render. @internal */
  _restoreFocusAfterRender = false;

  // Sort state
  _sortState: { field: string; direction: 1 | -1 } | null = null;

  // Layout
  _gridTemplate = '';
  // #endregion

  // #region Implementation Details (Internal only)
  __rowRenderEpoch = 0;
  __didInitialAutoSize = false;

  /** Light DOM columns cache - delegates to ConfigManager */
  get __lightDomColumnsCache(): ColumnInternal[] | undefined {
    return this.#configManager?.lightDomColumnsCache as ColumnInternal[] | undefined;
  }
  set __lightDomColumnsCache(value: ColumnInternal[] | undefined) {
    if (this.#configManager) {
      this.#configManager.lightDomColumnsCache = value as ColumnInternal<T>[] | undefined;
    }
  }

  /** Original column nodes - delegates to ConfigManager */
  get __originalColumnNodes(): HTMLElement[] | undefined {
    return this.#configManager?.originalColumnNodes;
  }
  set __originalColumnNodes(value: HTMLElement[] | undefined) {
    if (this.#configManager) {
      this.#configManager.originalColumnNodes = value;
    }
  }

  __originalOrder: T[] = [];

  /**
   * Framework adapter instance set by framework directives (Angular Grid, React DataGrid).
   * Used to handle framework-specific component rendering.
   * @internal
   */
  __frameworkAdapter?: FrameworkAdapter;

  // Cached DOM refs for hot path (refreshVirtualWindow) - avoid querySelector per scroll
  __rowsBodyEl: HTMLElement | null = null;
  // #endregion

  // #region Public API Props (getters/setters)
  // Getters return the EFFECTIVE value (after merging), not the raw input.
  // This is what consumers and plugins need - the current resolved state.
  // Setters update input properties which trigger re-merge into effectiveConfig.

  /**
   * Get or set the row data displayed in the grid.
   *
   * The getter returns processed rows (after filtering, sorting, grouping by plugins).
   * The setter accepts new source data and triggers a re-render.
   *
   * @group Configuration
   * @example
   * ```typescript
   * // Set initial data
   * grid.rows = employees;
   *
   * // Update with new data (triggers re-render)
   * grid.rows = [...employees, newEmployee];
   *
   * // Read current (processed) rows
   * console.log(`Displaying ${grid.rows.length} rows`);
   * ```
   */
  get rows(): T[] {
    return this._rows;
  }
  set rows(value: T[]) {
    const oldValue = this.#rows;
    this.#rows = value;
    if (oldValue !== value) {
      this.#queueUpdate('rows');
    }
  }

  /**
   * Get the original unfiltered/unprocessed source rows.
   *
   * Use this when you need access to all source data regardless of active
   * filters, sorting, or grouping applied by plugins. The `rows` property
   * returns processed data, while `sourceRows` returns the original input.
   *
   * @group Configuration
   * @example
   * ```typescript
   * // Get total count including filtered-out rows
   * console.log(`${grid.rows.length} of ${grid.sourceRows.length} rows visible`);
   *
   * // Export all data, not just visible
   * exportToCSV(grid.sourceRows);
   * ```
   */
  get sourceRows(): T[] {
    return this.#rows;
  }

  /**
   * Get or set the column configurations.
   *
   * The getter returns processed columns (after plugin transformations).
   * The setter accepts an array of column configs or a column config map.
   *
   * @group Configuration
   * @example
   * ```typescript
   * // Set columns as array
   * grid.columns = [
   *   { field: 'name', header: 'Name', width: 200 },
   *   { field: 'email', header: 'Email' },
   *   { field: 'role', header: 'Role', width: 120 }
   * ];
   *
   * // Set columns as map (keyed by field)
   * grid.columns = {
   *   name: { header: 'Name', width: 200 },
   *   email: { header: 'Email' },
   *   role: { header: 'Role', width: 120 }
   * };
   *
   * // Read current columns
   * grid.columns.forEach(col => {
   *   console.log(`${col.field}: ${col.width ?? 'auto'}`);
   * });
   * ```
   */
  get columns(): ColumnConfig<T>[] {
    return [...this._columns] as ColumnConfig<T>[];
  }
  set columns(value: ColumnConfig<T>[] | ColumnConfigMap<T> | undefined) {
    const oldValue = this.#configManager?.getColumns();
    this.#configManager?.setColumns(value);
    if (oldValue !== value) {
      this.#queueUpdate('columns');
    }
  }

  /**
   * Get or set the full grid configuration object.
   *
   * The getter returns the effective (merged) configuration.
   * The setter accepts a new configuration and triggers a full re-render.
   *
   * @group Configuration
   * @example
   * ```typescript
   * import { SelectionPlugin, SortingPlugin } from '@toolbox-web/grid/all';
   *
   * // Set full configuration
   * grid.gridConfig = {
   *   columns: [
   *     { field: 'name', header: 'Name' },
   *     { field: 'status', header: 'Status' }
   *   ],
   *   fitMode: 'stretch',
   *   plugins: [
   *     new SelectionPlugin({ mode: 'row' }),
   *     new SortingPlugin()
   *   ]
   * };
   *
   * // Read current configuration
   * console.log('Fit mode:', grid.gridConfig.fitMode);
   * console.log('Columns:', grid.gridConfig.columns?.length);
   * ```
   */
  get gridConfig(): GridConfig<T> {
    return this.#effectiveConfig;
  }
  set gridConfig(value: GridConfig<T> | undefined) {
    const oldValue = this.#configManager?.getGridConfig();
    this.#configManager?.setGridConfig(value);
    if (oldValue !== value) {
      // Clear light DOM column cache so columns are re-parsed from light DOM
      // This is needed for frameworks like Angular that project content asynchronously
      this.#configManager.clearLightDomCache();
      this.#queueUpdate('gridConfig');
    }
  }

  /**
   * Get or set the column sizing mode.
   *
   * - `'stretch'` (default): Columns stretch to fill available width
   * - `'fixed'`: Columns use explicit widths; horizontal scroll if needed
   * - `'auto'`: Columns auto-size to content on initial render
   *
   * @group Configuration
   * @example
   * ```typescript
   * // Use fixed widths with horizontal scroll
   * grid.fitMode = 'fixed';
   *
   * // Stretch columns to fill container
   * grid.fitMode = 'stretch';
   *
   * // Auto-size columns based on content
   * grid.fitMode = 'auto';
   * ```
   */
  get fitMode(): FitMode {
    return this.#effectiveConfig.fitMode ?? 'stretch';
  }
  set fitMode(value: FitMode | undefined) {
    const oldValue = this.#configManager?.getFitMode();
    this.#configManager?.setFitMode(value);
    if (oldValue !== value) {
      this.#queueUpdate('fitMode');
    }
  }

  // #region Loading API

  /**
   * Whether the grid is currently in a loading state.
   * When true, displays a loading overlay with spinner (or custom loadingRenderer).
   *
   * @example
   * ```typescript
   * grid.loading = true;
   * const data = await fetchData();
   * grid.rows = data;
   * grid.loading = false;
   * ```
   */
  get loading(): boolean {
    return this.#loading;
  }

  set loading(value: boolean) {
    const wasLoading = this.#loading;
    this.#loading = value;

    // Toggle attribute for CSS styling and external queries
    if (value) {
      this.setAttribute('loading', '');
    } else {
      this.removeAttribute('loading');
    }

    // Only update overlay if state actually changed
    if (wasLoading !== value) {
      this.#updateLoadingOverlay();
    }
  }

  /**
   * Set loading state for a specific row.
   * Shows a small spinner indicator on the row.
   *
   * @param rowId - The row's unique identifier (from getRowId)
   * @param loading - Whether the row is loading
   */
  setRowLoading(rowId: string, loading: boolean): void {
    const wasLoading = this.#loadingRows.has(rowId);
    if (loading) {
      this.#loadingRows.add(rowId);
    } else {
      this.#loadingRows.delete(rowId);
    }

    // Update row element if state changed
    if (wasLoading !== loading) {
      this.#updateRowLoadingState(rowId, loading);
    }
  }

  /**
   * Set loading state for a specific cell.
   * Shows a small spinner indicator on the cell.
   *
   * @param rowId - The row's unique identifier
   * @param field - The column field
   * @param loading - Whether the cell is loading
   */
  setCellLoading(rowId: string, field: string, loading: boolean): void {
    let cellFields = this.#loadingCells.get(rowId);
    const wasLoading = cellFields?.has(field) ?? false;

    if (loading) {
      if (!cellFields) {
        cellFields = new Set();
        this.#loadingCells.set(rowId, cellFields);
      }
      cellFields.add(field);
    } else {
      cellFields?.delete(field);
      // Clean up empty sets
      if (cellFields?.size === 0) {
        this.#loadingCells.delete(rowId);
      }
    }

    // Update cell element if state changed
    if (wasLoading !== loading) {
      this.#updateCellLoadingState(rowId, field, loading);
    }
  }

  /**
   * Check if a row is currently in loading state.
   * @param rowId - The row's unique identifier
   */
  isRowLoading(rowId: string): boolean {
    return this.#loadingRows.has(rowId);
  }

  /**
   * Check if a cell is currently in loading state.
   * @param rowId - The row's unique identifier
   * @param field - The column field
   */
  isCellLoading(rowId: string, field: string): boolean {
    return this.#loadingCells.get(rowId)?.has(field) ?? false;
  }

  /**
   * Clear all row and cell loading states.
   */
  clearAllLoading(): void {
    this.loading = false;

    // Clear all row loading states
    for (const rowId of this.#loadingRows) {
      this.#updateRowLoadingState(rowId, false);
    }
    this.#loadingRows.clear();

    // Clear all cell loading states
    for (const [rowId, fields] of this.#loadingCells) {
      for (const field of fields) {
        this.#updateCellLoadingState(rowId, field, false);
      }
    }
    this.#loadingCells.clear();
  }

  // #endregion

  /**
   * Effective config accessor for internal modules and plugins.
   * Returns the merged config (single source of truth) before plugin processing.
   * Use this when you need the raw merged config (e.g., for column definitions including hidden).
   * @group State Access
   * @internal Plugin API
   */
  get effectiveConfig(): GridConfig<T> {
    return this.#effectiveConfig;
  }

  /**
   * Get the disconnect signal for event listener cleanup.
   * This signal is aborted when the grid disconnects from the DOM.
   * Plugins and internal code can use this for automatic listener cleanup.
   * @group State Access
   * @internal Plugin API
   * @example
   * element.addEventListener('click', handler, { signal: this.grid.disconnectSignal });
   */
  get disconnectSignal(): AbortSignal {
    // Ensure AbortController exists (created in connectedCallback before plugins attach)
    if (!this.#eventAbortController) {
      this.#eventAbortController = new AbortController();
    }
    return this.#eventAbortController.signal;
  }
  // #endregion

  /**
   * @internal Do not call directly. Use `createGrid()` or `document.createElement('tbw-grid')`.
   */
  constructor() {
    super();
    // No Shadow DOM - render directly into the element
    void this.#injectStyles(); // Fire and forget - styles load asynchronously
    this.#readyPromise = new Promise((res) => (this.#readyResolve = res));

    // Initialize render scheduler with callbacks
    this.#scheduler = new RenderScheduler({
      mergeConfig: () => {
        // Re-parse light DOM columns to pick up framework adapter renderers
        // This is essential for React/Angular where renderers register asynchronously
        this.#configManager.parseLightDomColumns(this as unknown as HTMLElement);
        this.#configManager.merge();
        this.#updatePluginConfigs(); // Sync plugin configs (including auto-detection) before processing
        // Validate that plugin-specific column properties have their required plugins loaded
        // This runs after plugins are loaded and config is merged
        validatePluginProperties(this.#effectiveConfig, this.#pluginManager?.getPlugins() ?? []);
        // Validate plugin configRules (errors/warnings for invalid config combinations)
        validatePluginConfigRules(this.#pluginManager?.getPlugins() ?? []);
        // Validate plugin incompatibilities (warnings for conflicting plugin combinations)
        validatePluginIncompatibilities(this.#pluginManager?.getPlugins() ?? []);
        // Update ARIA labels (explicit config or derived from shell title)
        this.#updateAriaLabels();
        // Store base columns before plugin transformation
        this.#baseColumns = [...this._columns];
      },
      processColumns: () => this.#processColumns(),
      processRows: () => this.#rebuildRowModel(),
      renderHeader: () => renderHeader(this),
      updateTemplate: () => updateTemplate(this),
      renderVirtualWindow: () => this.refreshVirtualWindow(true, true),
      afterRender: () => {
        this.#pluginManager?.afterRender();
        // Auto-size columns on first render if fitMode is 'fixed'
        const mode = this.#effectiveConfig.fitMode;
        if (mode === 'fixed' && !this.__didInitialAutoSize) {
          this.__didInitialAutoSize = true;
          autoSizeColumns(this);
        }
        // Restore focus styling if requested by a plugin
        if (this._restoreFocusAfterRender) {
          this._restoreFocusAfterRender = false;
          ensureCellVisible(this);
        }
        // Set up row height observer after first render (rows are now in DOM)
        if (this._virtualization.enabled && !this.#rowHeightObserverSetup) {
          this.#setupRowHeightObserver();
        }
        // Measure base row height for plugin-based variable heights on first render
        // Uses RAF to ensure browser has computed layout before measuring
        if (this.#needsRowHeightMeasurement) {
          this.#needsRowHeightMeasurement = false;
          // Double RAF ensures layout is fully computed (first RAF schedules after paint,
          // second RAF runs after that frame's layout)
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              this.#measureRowHeightForPlugins();
            });
          });
        }
      },
      isConnected: () => this.isConnected && this.#connected,
    });
    // Connect ready promise to scheduler
    this.#scheduler.setInitialReadyResolver(() => this.#readyResolve?.());

    // Initialize shell controller with callbacks
    this.#shellController = createShellController(this.#shellState, {
      getShadow: () => this.#renderRoot,
      getShellConfig: () => this.#effectiveConfig?.shell,
      getAccordionIcons: () => ({
        expand: this.#effectiveConfig?.icons?.expand ?? DEFAULT_GRID_ICONS.expand,
        collapse: this.#effectiveConfig?.icons?.collapse ?? DEFAULT_GRID_ICONS.collapse,
      }),
      emit: (eventName, detail) => this.#emit(eventName, detail),
      refreshShellHeader: () => this.refreshShellHeader(),
    });

    // Initialize config manager with callbacks
    this.#configManager = new ConfigManager<T>({
      getRows: () => this.#rows,
      getSortState: () => this._sortState,
      setSortState: (state) => {
        this._sortState = state;
      },
      onConfigChange: () => {
        this.#scheduler.requestPhase(RenderPhase.FULL, 'configChange');
      },
      emit: (eventName, detail) => this.#emit(eventName, detail),
      clearRowPool: () => {
        this._rowPool.length = 0;
        if (this._bodyEl) this._bodyEl.innerHTML = '';
        this.__rowRenderEpoch++;
      },
      setup: () => this.#setup(),
      renderHeader: () => renderHeader(this),
      updateTemplate: () => updateTemplate(this),
      refreshVirtualWindow: () => this.#scheduler.requestPhase(RenderPhase.VIRTUALIZATION, 'configManager'),
      getVirtualization: () => this._virtualization,
      setRowHeight: (height) => {
        this._virtualization.rowHeight = height;
      },
      applyAnimationConfig: (config) => this.#applyAnimationConfig(config),
      getShellLightDomTitle: () => this.#shellState.lightDomTitle,
      getShellToolPanels: () => this.#shellState.toolPanels,
      getShellHeaderContents: () => this.#shellState.headerContents,
      getShellToolbarContents: () => this.#shellState.toolbarContents,
      getShellLightDomHeaderContent: () => this.#shellState.lightDomHeaderContent,
      getShellHasToolButtonsContainer: () => this.#shellState.hasToolButtonsContainer,
    });
  }

  /**
   * Inject grid styles into the document.
   * Delegates to the style-injector module (singleton pattern).
   */
  async #injectStyles(): Promise<void> {
    await injectStyles(styles);
  }

  // #region Plugin System
  /**
   * Get a plugin instance by its class.
   * Used by plugins for inter-plugin communication.
   * @group Plugin Communication
   * @internal Plugin API
   */
  getPlugin<P>(PluginClass: new (...args: any[]) => P): P | undefined {
    return this.#pluginManager?.getPlugin(PluginClass as new (...args: any[]) => BaseGridPlugin) as P | undefined;
  }

  /**
   * Get a plugin instance by its name.
   * Used for loose coupling between plugins (avoids static imports).
   * @group Plugin Communication
   * @internal Plugin API
   */
  getPluginByName(name: string): BaseGridPlugin | undefined {
    return this.#pluginManager?.getPluginByName(name);
  }

  /**
   * Request a full re-render of the grid.
   * Called by plugins when they need the grid to update.
   * Note: This does NOT reset plugin state - just re-processes rows/columns and renders.
   * @group Rendering
   * @internal Plugin API
   */
  requestRender(): void {
    this.#scheduler.requestPhase(RenderPhase.ROWS, 'plugin:requestRender');
  }

  /**
   * Request a columns re-render of the grid.
   * Called by plugins when they need to trigger processColumns hooks.
   * This uses a higher render phase than requestRender() to ensure
   * column processing occurs.
   * @group Rendering
   * @internal Plugin API
   */
  requestColumnsRender(): void {
    this.#scheduler.requestPhase(RenderPhase.COLUMNS, 'plugin:requestColumnsRender');
  }

  /**
   * Request a full re-render and restore focus styling afterward.
   * Use this when a plugin action (like expand/collapse) triggers a render
   * but needs to maintain keyboard navigation focus.
   * @group Rendering
   * @internal Plugin API
   */
  requestRenderWithFocus(): void {
    this._restoreFocusAfterRender = true;
    this.#scheduler.requestPhase(RenderPhase.ROWS, 'plugin:requestRenderWithFocus');
  }

  /**
   * Update the grid's column template CSS.
   * Called by resize controller during column resize operations.
   * @group Rendering
   * @internal Plugin API
   */
  updateTemplate(): void {
    updateTemplate(this);
  }

  /**
   * Request a lightweight style update without rebuilding DOM.
   * Called by plugins when they only need to update CSS classes/styles.
   * This runs all plugin afterRender hooks without rebuilding row/column DOM.
   * @group Rendering
   * @internal Plugin API
   */
  requestAfterRender(): void {
    this.#scheduler.requestPhase(RenderPhase.STYLE, 'plugin:requestAfterRender');
  }

  /**
   * Initialize plugin system with instances from config.
   * Plugins are class instances passed in gridConfig.plugins[].
   */
  #initializePlugins(): void {
    // Create plugin manager for this grid
    this.#pluginManager = new PluginManager(this);

    // Get plugin instances from config - ensure it's an array
    const pluginsConfig = this.#effectiveConfig?.plugins;
    const plugins = Array.isArray(pluginsConfig) ? (pluginsConfig as BaseGridPlugin[]) : [];

    // Attach all plugins
    this.#pluginManager.attachAll(plugins);
  }

  /**
   * Inject all plugin styles into the consolidated style element.
   * Plugin styles are appended after base grid styles in the same <style> element.
   * Uses a Map to accumulate styles from all grid instances on the page.
   */
  #injectAllPluginStyles(): void {
    const pluginStyles = this.#pluginManager?.getPluginStyles() ?? [];
    addPluginStyles(pluginStyles);
  }

  /**
   * Update plugins when grid config changes.
   * With class-based plugins, we need to detach old and attach new.
   * Skips re-initialization if the plugins array hasn't changed.
   */
  #updatePluginConfigs(): void {
    // Get the new plugins array from config
    const pluginsConfig = this.#effectiveConfig?.plugins;
    const newPlugins = Array.isArray(pluginsConfig) ? (pluginsConfig as BaseGridPlugin[]) : [];

    // Check if plugins have actually changed (same array reference or same contents)
    // This avoids unnecessary detach/attach cycles on every render
    if (this.#lastPluginsArray === newPlugins) {
      return; // Same array reference - no change
    }

    // Check if the arrays have the same plugin instances
    if (
      this.#lastPluginsArray &&
      this.#lastPluginsArray.length === newPlugins.length &&
      this.#lastPluginsArray.every((p, i) => p === newPlugins[i])
    ) {
      // Same plugins in same order - just update the reference tracking
      this.#lastPluginsArray = newPlugins;
      return;
    }

    // Plugins have changed - detach old and attach new
    if (this.#pluginManager) {
      this.#pluginManager.detachAll();
    }

    // Clear plugin-contributed panels BEFORE re-initializing plugins
    // This is critical: when plugins are re-initialized, they create NEW instances
    // with NEW render functions. The old panel definitions have stale closures.
    // We preserve light DOM panels (tracked in lightDomToolPanelIds) and
    // API-registered panels (tracked in apiToolPanelIds).
    for (const panelId of this.#shellState.toolPanels.keys()) {
      const isLightDom = this.#shellState.lightDomToolPanelIds.has(panelId);
      const isApiRegistered = this.#shellState.apiToolPanelIds.has(panelId);
      if (!isLightDom && !isApiRegistered) {
        // Clean up any active panel cleanup function
        const cleanup = this.#shellState.panelCleanups.get(panelId);
        if (cleanup) {
          cleanup();
          this.#shellState.panelCleanups.delete(panelId);
        }
        this.#shellState.toolPanels.delete(panelId);
      }
    }

    // Similarly clear plugin-contributed header contents
    // Header contents don't have a light DOM tracking set, so clear all and re-collect
    for (const contentId of this.#shellState.headerContents.keys()) {
      const cleanup = this.#shellState.headerContentCleanups.get(contentId);
      if (cleanup) {
        cleanup();
        this.#shellState.headerContentCleanups.delete(contentId);
      }
      this.#shellState.headerContents.delete(contentId);
    }

    this.#initializePlugins();
    this.#injectAllPluginStyles();

    // Track the new plugins array
    this.#lastPluginsArray = newPlugins;

    // Re-collect plugin shell contributions (tool panels, header content)
    // Now the new plugin instances will add their fresh panel definitions
    this.#collectPluginShellContributions();

    // Update cached scroll plugin flag
    this.#hasScrollPlugins = this.#pluginManager?.getAll().some((p) => p.onScroll) ?? false;
  }

  /**
   * Clean up plugin states when grid disconnects.
   */
  #destroyPlugins(): void {
    this.#pluginManager?.detachAll();
  }

  /**
   * Collect tool panels and header content from all plugins.
   * Called after plugins are attached but before render.
   */
  #collectPluginShellContributions(): void {
    if (!this.#pluginManager) return;

    // Collect tool panels from plugins
    const pluginPanels = this.#pluginManager.getToolPanels();
    for (const { panel } of pluginPanels) {
      // Skip if already registered (light DOM or API takes precedence)
      if (!this.#shellState.toolPanels.has(panel.id)) {
        this.#shellState.toolPanels.set(panel.id, panel);
      }
    }

    // Collect header contents from plugins
    const pluginContents = this.#pluginManager.getHeaderContents();
    for (const { content } of pluginContents) {
      // Skip if already registered (light DOM or API takes precedence)
      if (!this.#shellState.headerContents.has(content.id)) {
        this.#shellState.headerContents.set(content.id, content);
      }
    }
  }

  /**
   * Gets a renderer factory for tool panels from registered framework adapters.
   * Returns a factory function that tries each adapter in order until one handles the element.
   */
  #getToolPanelRendererFactory(): ToolPanelRendererFactory | undefined {
    const adapters = DataGridElement.getAdapters();
    if (adapters.length === 0 && !this.__frameworkAdapter) return undefined;

    // Also check for instance-level adapter (e.g., __frameworkAdapter from Angular Grid directive)
    const instanceAdapter = this.__frameworkAdapter;

    return (element: HTMLElement) => {
      // Try instance adapter first (from Grid directive)
      if (instanceAdapter?.createToolPanelRenderer) {
        const renderer = instanceAdapter.createToolPanelRenderer(element);
        if (renderer) return renderer;
      }

      // Try global adapters
      for (const adapter of adapters) {
        if (adapter.createToolPanelRenderer) {
          const renderer = adapter.createToolPanelRenderer(element);
          if (renderer) return renderer;
        }
      }

      return undefined;
    };
  }
  // #endregion

  // #region Lifecycle
  /** @internal Web component lifecycle - not part of public API */
  connectedCallback(): void {
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    if (!this.hasAttribute('version')) this.setAttribute('version', DataGridElement.version);
    // Ensure grid has a unique ID for print isolation and other use cases
    if (!this.id) {
      this.id = `tbw-grid-${++DataGridElement.#instanceCounter}`;
    }
    this._rows = Array.isArray(this.#rows) ? [...this.#rows] : [];

    // Create AbortController for all event listeners (grid internal + plugins)
    // This must happen BEFORE plugins attach so they can use disconnectSignal
    // Abort any previous controller first (in case of re-connect)
    if (this.#eventAbortController) {
      this.#eventAbortController.abort();
      this.#eventListenersAdded = false; // Reset so listeners can be re-added
    }
    this.#eventAbortController = new AbortController();

    // Cancel any pending idle work from previous connection
    if (this.#idleCallbackHandle) {
      cancelIdle(this.#idleCallbackHandle);
      this.#idleCallbackHandle = undefined;
    }

    // === CRITICAL PATH (synchronous) - needed for first paint ===

    // Parse light DOM shell elements BEFORE merging config
    parseLightDomShell(this, this.#shellState);
    // Parse light DOM tool buttons container
    parseLightDomToolButtons(this, this.#shellState);
    // Parse light DOM tool panels (framework adapters may not be ready yet, but vanilla JS works)
    parseLightDomToolPanels(this, this.#shellState, this.#getToolPanelRendererFactory());
    // Parse light DOM columns (must be before merge to pick up templates)
    this.#configManager.parseLightDomColumns(this as unknown as HTMLElement);

    // Merge all config sources into effectiveConfig (including columns and shell)
    this.#configManager.merge();

    // Initialize plugin system (now plugins can access disconnectSignal)
    this.#initializePlugins();

    // Track the initial plugins array to avoid unnecessary re-initialization
    const pluginsConfig = this.#effectiveConfig?.plugins;
    this.#lastPluginsArray = Array.isArray(pluginsConfig) ? (pluginsConfig as BaseGridPlugin[]) : [];

    // Collect tool panels and header content from plugins (must be before render)
    this.#collectPluginShellContributions();

    if (!this.#initialized) {
      this.#render();
      this.#injectAllPluginStyles(); // Inject plugin styles after render
      this.#initialized = true;
    }
    this.#afterConnect();

    // === DEFERRED WORK (idle) - not needed for first paint ===
    this.#idleCallbackHandle = scheduleIdle(
      () => {
        // Set up Light DOM observation via ConfigManager
        // This handles frameworks like Angular that project content asynchronously
        this.#setupLightDomHandlers();
      },
      { timeout: 100 },
    );
  }

  /** @internal Web component lifecycle - not part of public API */
  disconnectedCallback(): void {
    // Cancel any pending idle work
    if (this.#idleCallbackHandle) {
      cancelIdle(this.#idleCallbackHandle);
      this.#idleCallbackHandle = undefined;
    }

    // Cancel any pending scroll measurement
    if (this.#scrollMeasureTimeout) {
      clearTimeout(this.#scrollMeasureTimeout);
      this.#scrollMeasureTimeout = 0;
    }

    // Clean up plugin states
    this.#destroyPlugins();

    // Clean up shell state
    cleanupShellState(this.#shellState);
    this.#shellController.setInitialized(false);

    // Clean up tool panel resize handler
    this.#resizeCleanup?.();
    this.#resizeCleanup = undefined;

    // Cancel any ongoing touch momentum animation
    cancelMomentum(this.#touchState);

    // Abort all event listeners (internal + document-level)
    // This cleans up all listeners added with { signal } option
    if (this.#eventAbortController) {
      this.#eventAbortController.abort();
      this.#eventAbortController = undefined;
    }
    // Also abort scroll-specific listeners (separate controller)
    this.#scrollAbortController?.abort();
    this.#scrollAbortController = undefined;
    this.#eventListenersAdded = false; // Reset so listeners can be re-added on reconnect

    if (this._resizeController) {
      this._resizeController.dispose();
    }
    if (this.#resizeObserver) {
      this.#resizeObserver.disconnect();
      this.#resizeObserver = undefined;
    }
    if (this.#rowHeightObserver) {
      this.#rowHeightObserver.disconnect();
      this.#rowHeightObserver = undefined;
      this.#rowHeightObserverSetup = false;
    }

    // Clear caches to prevent memory leaks
    invalidateCellCache(this);
    this.#customStyleSheets.clear();

    // Clear plugin tracking to allow fresh initialization on reconnect
    this.#lastPluginsArray = undefined;

    // Clear row pool - detach from DOM and release references
    for (const rowEl of this._rowPool) {
      rowEl.remove();
    }
    this._rowPool.length = 0;

    // Clear cached DOM refs to prevent stale references
    this.__rowsBodyEl = null;

    this.#connected = false;
  }

  /**
   * Handle HTML attribute changes.
   * Only processes attribute values when SET (non-null).
   * Removing an attribute does NOT clear JS-set properties.
   * @internal Web component lifecycle - not part of public API
   */
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    // Handle boolean attributes first (presence = true, absence/null = false, "false" = false)
    if (name === 'loading') {
      const isLoading = newValue !== null && newValue !== 'false';
      if (this.loading !== isLoading) {
        this.loading = isLoading;
      }
      return;
    }

    if (oldValue === newValue || !newValue || newValue === 'null' || newValue === 'undefined') return;

    // JSON attributes need parsing
    if (name === 'rows' || name === 'columns' || name === 'grid-config') {
      try {
        const parsed = JSON.parse(newValue);
        if (name === 'rows') this.rows = parsed;
        else if (name === 'columns') this.columns = parsed;
        else if (name === 'grid-config') this.gridConfig = parsed;
      } catch {
        console.warn(`[tbw-grid] Invalid JSON for '${name}' attribute:`, newValue);
      }
    } else if (name === 'fit-mode') {
      this.fitMode = newValue as FitMode;
    }
  }

  #afterConnect(): void {
    // Shell changes the DOM structure - need to find elements appropriately
    const gridContent = this.#renderRoot.querySelector('.tbw-grid-content');
    const gridRoot = gridContent ?? this.#renderRoot.querySelector('.tbw-grid-root');

    this._headerRowEl = gridRoot?.querySelector('.header-row') as HTMLElement;
    // Faux scrollbar pattern:
    // - .faux-vscroll-spacer sets virtual height
    // - .rows-viewport provides visible height for virtualization calculations
    this._virtualization.totalHeightEl = gridRoot?.querySelector('.faux-vscroll-spacer') as HTMLElement;
    this._virtualization.viewportEl = gridRoot?.querySelector('.rows-viewport') as HTMLElement;
    this._bodyEl = gridRoot?.querySelector('.rows') as HTMLElement;

    // Cache DOM refs for hot path (refreshVirtualWindow) - avoid querySelector per scroll
    this.__rowsBodyEl = gridRoot?.querySelector('.rows-body') as HTMLElement;

    // Initialize shell header content and custom buttons if shell is active
    if (this.#shellController.isInitialized) {
      // Render plugin header content
      renderHeaderContent(this.#renderRoot, this.#shellState);
      // Render custom toolbar contents (render modes) - all contents unified in effectiveConfig
      renderCustomToolbarContents(this.#renderRoot, this.#effectiveConfig?.shell, this.#shellState);
      // Open default section if configured
      const defaultOpen = this.#effectiveConfig?.shell?.toolPanel?.defaultOpen;
      if (defaultOpen && this.#shellState.toolPanels.has(defaultOpen)) {
        this.openToolPanel();
        this.#shellState.expandedSections.add(defaultOpen);
      }
    }

    // Mark for tests that afterConnect ran
    this.setAttribute('data-upgraded', '');
    this.#connected = true;

    // Create resize controller BEFORE setup - renderHeader() needs it for resize handle mousedown events
    this._resizeController = createResizeController(this as unknown as InternalGrid<T>);

    // Run setup
    this.#setup();

    // Set up DOM-element scroll listeners (these need to be re-attached when DOM is recreated)
    this.#setupScrollListeners(gridRoot);

    // Only add component-level event listeners once (afterConnect can be called multiple times)
    // When shell state changes or refreshShellHeader is called, we re-run afterConnect
    // but component-level listeners should not be duplicated (they don't depend on DOM elements)
    // Scroll listeners are already set up above and handle DOM recreation via their own AbortController
    if (this.#eventListenersAdded) {
      return;
    }
    this.#eventListenersAdded = true;

    // Get the signal for event listener cleanup (AbortController created in connectedCallback)
    const signal = this.disconnectSignal;

    // Set up all root-level and document-level event listeners
    // Consolidates keydown, mousedown, mousemove, mouseup in one place (event-delegation.ts)
    setupRootEventDelegation(this as unknown as InternalGrid<T>, this, this.#renderRoot, signal);

    // Note: click/dblclick handlers are set up via setupCellEventDelegation in #setupScrollListeners
    // This consolidates all body-level delegated event handlers in one place (event-delegation.ts)

    // Determine row height for virtualization:
    // 1. User-configured rowHeight in gridConfig takes precedence
    // 2. Otherwise, measure actual row height from DOM (respects CSS variable --tbw-row-height)
    const userRowHeight = this.#effectiveConfig.rowHeight;

    // Variable row heights: rowHeight is a function OR a plugin implements getRowHeight()
    const hasRowHeightPlugin = this.#pluginManager.hasRowHeightPlugin();
    if (typeof userRowHeight === 'function' || hasRowHeightPlugin) {
      this._virtualization.variableHeights = true;
      // Default row height used for unmeasured rows (estimated height for scrollbar)
      this._virtualization.rowHeight = typeof userRowHeight === 'number' && userRowHeight > 0 ? userRowHeight : 28;
      // Initialize position cache (will be rebuilt when rows are processed)
      this.#initializePositionCache();
      // For plugin-based variable heights (not rowHeight function), flag for measurement
      // after first render completes (when rows actually exist in DOM)
      if (typeof userRowHeight !== 'function') {
        this.#needsRowHeightMeasurement = true;
      }
    } else if (typeof userRowHeight === 'number' && userRowHeight > 0) {
      this._virtualization.rowHeight = userRowHeight;
      this._virtualization.variableHeights = false;
    } else {
      // Initial measurement after first paint (CSS is already loaded via Vite)
      // ResizeObserver in #setupScrollListeners handles subsequent dynamic changes
      requestAnimationFrame(() => this.#measureRowHeight());
    }

    // Initialize ARIA selection state
    queueMicrotask(() => this.#updateAriaSelection());

    // Request initial render through the scheduler.
    // The scheduler resolves ready() after the render cycle completes.
    // Framework adapters (React/Angular) will request COLUMNS phase via refreshColumns(),
    // which will be batched with this request - highest phase wins.
    this.#scheduler.requestPhase(RenderPhase.FULL, 'afterConnect');
  }

  /**
   * Measure actual row height from DOM.
   * Finds the tallest cell to account for custom renderers that may push height.
   */
  #measureRowHeight(): void {
    // Skip if a plugin is managing variable row heights (e.g., ResponsivePlugin with groups)
    // In that case, the plugin handles height via getExtraHeight() and we shouldn't
    // override the base row height, which would cause oscillation loops.
    if (this.#pluginManager.hasExtraHeight()) {
      return;
    }

    const firstRow = this._bodyEl?.querySelector('.data-grid-row');
    if (!firstRow) return;

    // Find the tallest cell in the row (custom renderers may push some cells taller)
    const cells = firstRow.querySelectorAll('.cell');
    let maxCellHeight = 0;
    cells.forEach((cell) => {
      const h = (cell as HTMLElement).offsetHeight;
      if (h > maxCellHeight) maxCellHeight = h;
    });

    const rowRect = (firstRow as HTMLElement).getBoundingClientRect();

    // Use the larger of row height or max cell height
    const measuredHeight = Math.max(rowRect.height, maxCellHeight);
    // Use a 1px threshold to avoid oscillation from sub-pixel rounding
    if (measuredHeight > 0 && Math.abs(measuredHeight - this._virtualization.rowHeight) > 1) {
      this._virtualization.rowHeight = measuredHeight;
      // Use scheduler to batch with other pending work
      this.#scheduler.requestPhase(RenderPhase.VIRTUALIZATION, 'measureRowHeight');
    }
  }

  /**
   * Measure actual row height from DOM for plugin-based variable heights.
   * Similar to #measureRowHeight but rebuilds the position cache after measurement.
   * Called after first render when a plugin implements getRowHeight() but user didn't provide a rowHeight function.
   */
  #measureRowHeightForPlugins(): void {
    const firstRow = this._bodyEl?.querySelector('.data-grid-row');
    if (!firstRow) return;

    // Find the tallest cell in the row (custom renderers may push some cells taller)
    const cells = firstRow.querySelectorAll('.cell');
    let maxCellHeight = 0;
    cells.forEach((cell) => {
      const h = (cell as HTMLElement).offsetHeight;
      if (h > maxCellHeight) maxCellHeight = h;
    });

    const rowRect = (firstRow as HTMLElement).getBoundingClientRect();

    // Use the larger of row height or max cell height
    const measuredHeight = Math.max(rowRect.height, maxCellHeight);

    // Update rowHeight if measurement is valid and different
    if (measuredHeight > 0) {
      const heightChanged = Math.abs(measuredHeight - this._virtualization.rowHeight) > 1;
      if (heightChanged) {
        this._virtualization.rowHeight = measuredHeight;
      }

      // ALWAYS rebuild position cache when this method is called (first render with plugins)
      // The position cache may have been built with the wrong estimated height (e.g., 28px)
      // even if rowHeight was later updated by ResizeObserver (e.g., to 33px)
      this.#initializePositionCache();

      // Update spacer height with the correct total
      if (this._virtualization.totalHeightEl) {
        const newHeight = this.#calculateTotalSpacerHeight(this._rows.length);
        this._virtualization.totalHeightEl.style.height = `${newHeight}px`;
      }
    }
  }

  /**
   * Set up scroll-related event listeners on DOM elements.
   * These need to be re-attached when the DOM is recreated (e.g., shell toggle).
   * Uses a separate AbortController that is recreated each time.
   */
  #setupScrollListeners(gridRoot: Element | null): void {
    // Abort any existing scroll listeners before adding new ones
    this.#scrollAbortController?.abort();
    this.#scrollAbortController = new AbortController();
    const scrollSignal = this.#scrollAbortController.signal;

    // Faux scrollbar pattern: scroll events come from the fake scrollbar element
    // Content area doesn't scroll - rows are positioned via transforms
    const fauxScrollbar = gridRoot?.querySelector('.faux-vscroll') as HTMLElement;
    const rowsEl = gridRoot?.querySelector('.rows') as HTMLElement;

    // Store reference for scroll position reading in refreshVirtualWindow
    this._virtualization.container = fauxScrollbar ?? this;

    // Cache whether any plugin has scroll handlers (checked once during setup)
    this.#hasScrollPlugins = this.#pluginManager?.getAll().some((p) => p.onScroll) ?? false;

    if (fauxScrollbar && rowsEl) {
      fauxScrollbar.addEventListener(
        'scroll',
        () => {
          // Fast exit if no scroll processing needed
          if (!this._virtualization.enabled && !this.#hasScrollPlugins) return;

          const currentScrollTop = fauxScrollbar.scrollTop;
          const rowHeight = this._virtualization.rowHeight;

          // Bypass mode: all rows are rendered, just translate by scroll position
          // No need for virtual window calculations
          if (this._rows.length <= this._virtualization.bypassThreshold) {
            rowsEl.style.transform = `translateY(${-currentScrollTop}px)`;
          } else {
            // Virtualized mode: calculate sub-pixel offset for smooth scrolling
            // Even-aligned start preserves zebra stripe parity
            // DOM nth-child(even) will always match data row parity
            const rawStart = Math.floor(currentScrollTop / rowHeight);
            const evenAlignedStart = rawStart - (rawStart % 2);
            const subPixelOffset = -(currentScrollTop - evenAlignedStart * rowHeight);
            rowsEl.style.transform = `translateY(${subPixelOffset}px)`;
          }

          // Batch content update with requestAnimationFrame
          // Old content stays visible with smooth offset until new content renders
          this.#pendingScrollTop = currentScrollTop;
          if (!this.#scrollRaf) {
            this.#scrollRaf = requestAnimationFrame(() => {
              this.#scrollRaf = 0;
              if (this.#pendingScrollTop !== null) {
                this.#onScrollBatched(this.#pendingScrollTop);
                this.#pendingScrollTop = null;
              }
            });
          }
        },
        { passive: true, signal: scrollSignal },
      );

      // Horizontal scroll listener on scroll area
      // This is needed for plugins like column virtualization that need to respond to horizontal scroll
      const scrollArea = this.#renderRoot.querySelector('.tbw-scroll-area') as HTMLElement;
      this.#scrollAreaEl = scrollArea; // Store reference for use in #onScrollBatched
      if (scrollArea && this.#hasScrollPlugins) {
        scrollArea.addEventListener(
          'scroll',
          () => {
            // Dispatch horizontal scroll to plugins
            const scrollEvent = this.#pooledScrollEvent;
            scrollEvent.scrollTop = fauxScrollbar.scrollTop;
            scrollEvent.scrollLeft = scrollArea.scrollLeft;
            scrollEvent.scrollHeight = fauxScrollbar.scrollHeight;
            scrollEvent.scrollWidth = scrollArea.scrollWidth;
            scrollEvent.clientHeight = fauxScrollbar.clientHeight;
            scrollEvent.clientWidth = scrollArea.clientWidth;
            this.#pluginManager?.onScroll(scrollEvent);
          },
          { passive: true, signal: scrollSignal },
        );
      }

      // Forward wheel events from content area to faux scrollbar
      // Without this, mouse wheel over content wouldn't scroll
      // Listen on .tbw-grid-content to capture wheel events from entire grid area
      // Note: gridRoot may already BE .tbw-grid-content when shell is active, so search from shadow root
      const gridContentEl = this.#renderRoot.querySelector('.tbw-grid-content') as HTMLElement;
      // Use the already-stored scrollArea reference
      const scrollAreaForWheel = this.#scrollAreaEl;
      if (gridContentEl) {
        gridContentEl.addEventListener(
          'wheel',
          (e: WheelEvent) => {
            // SHIFT+wheel or trackpad deltaX = horizontal scroll
            const isHorizontal = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);

            if (isHorizontal && scrollAreaForWheel) {
              const delta = e.shiftKey ? e.deltaY : e.deltaX;
              const { scrollLeft, scrollWidth, clientWidth } = scrollAreaForWheel;
              const canScroll = (delta > 0 && scrollLeft < scrollWidth - clientWidth) || (delta < 0 && scrollLeft > 0);
              if (canScroll) {
                e.preventDefault();
                scrollAreaForWheel.scrollLeft += delta;
              }
            } else if (!isHorizontal) {
              const { scrollTop, scrollHeight, clientHeight } = fauxScrollbar;
              const canScroll =
                (e.deltaY > 0 && scrollTop < scrollHeight - clientHeight) || (e.deltaY < 0 && scrollTop > 0);
              if (canScroll) {
                e.preventDefault();
                fauxScrollbar.scrollTop += e.deltaY;
              }
            }
            // If can't scroll, event bubbles to scroll the page
          },
          { passive: false, signal: scrollSignal },
        );

        // Touch scrolling support for mobile devices
        // Supports both vertical (via faux scrollbar) and horizontal (via scroll area) scrolling
        // Includes momentum scrolling for natural "flick" behavior
        setupTouchScrollListeners(
          gridContentEl,
          this.#touchState,
          { fauxScrollbar, scrollArea: scrollAreaForWheel },
          scrollSignal,
        );
      }
    }

    // Set up delegated event handlers for cell interactions (click, dblclick, keydown)
    // This replaces per-cell event listeners with a single set of delegated handlers
    // Dramatically reduces memory usage: 4 listeners total vs. 30,000+ for large grids
    if (this._bodyEl) {
      setupCellEventDelegation(this as unknown as InternalGrid<T>, this._bodyEl, scrollSignal);
    }

    // Disconnect existing resize observer before creating new one
    // This ensures we observe the NEW viewport element after DOM recreation
    this.#resizeObserver?.disconnect();

    // Resize observer to refresh virtualization when viewport size changes
    // (e.g., when footer is added, window resizes, or shell panel toggles)
    if (this._virtualization.viewportEl) {
      this.#resizeObserver = new ResizeObserver(() => {
        // Use scheduler for viewport resize - batches with other pending work
        // The scheduler already batches multiple requests per RAF
        this.#scheduler.requestPhase(RenderPhase.VIRTUALIZATION, 'resize-observer');
      });
      this.#resizeObserver.observe(this._virtualization.viewportEl);
    }

    // Note: We no longer need to schedule init-virtualization here since
    // the initial FULL render from #setup already includes virtualization.
    // Requesting it again here caused duplicate renders on initialization.

    // Track focus state via data attribute (shadow DOM doesn't reliably support :focus-within)
    // Listen on shadow root to catch focus events from shadow DOM elements
    // Cast to EventTarget since TypeScript's lib.dom doesn't include focus events on ShadowRoot
    (this.#renderRoot as EventTarget).addEventListener(
      'focusin',
      () => {
        this.dataset.hasFocus = '';
      },
      { signal: scrollSignal },
    );
    (this.#renderRoot as EventTarget).addEventListener(
      'focusout',
      (e) => {
        // Only remove if focus is leaving the grid entirely
        // relatedTarget is null when focus leaves the document, or the new focus target
        const newFocus = (e as FocusEvent).relatedTarget as Node | null;
        if (!newFocus || !this.#renderRoot.contains(newFocus)) {
          delete this.dataset.hasFocus;
        }
      },
      { signal: scrollSignal },
    );
  }

  /**
   * Set up ResizeObserver on first row to detect height changes.
   * Called after rows are rendered to observe the actual content.
   * Handles dynamic CSS loading, lazy images, font loading, column virtualization, etc.
   */
  #rowHeightObserverSetup = false; // Only set up once per lifecycle
  #setupRowHeightObserver(): void {
    // Only set up once - row height measurement is one-time during initialization
    if (this.#rowHeightObserverSetup) return;

    const firstRow = this._bodyEl?.querySelector('.data-grid-row') as HTMLElement | null;
    if (!firstRow) return;

    this.#rowHeightObserverSetup = true;
    this.#rowHeightObserver?.disconnect();

    // Observe the row element itself, not individual cells.
    // This catches all height changes including:
    // - Custom renderers that push cell height
    // - Column virtualization adding/removing columns
    // - Dynamic content loading (images, fonts)
    // Note: ResizeObserver fires on initial observation in modern browsers,
    // so no separate measurement call is needed.
    this.#rowHeightObserver = new ResizeObserver(() => {
      this.#measureRowHeight();
    });
    this.#rowHeightObserver.observe(firstRow);
  }
  // #endregion

  // #region Event System
  /**
   * Add a typed event listener for grid events.
   *
   * This override provides type-safe event handling for DataGrid-specific events.
   * The event detail is automatically typed based on the event name.
   *
   * @example
   * ```typescript
   * // Type-safe: detail is CellClickDetail<Employee>
   * grid.addEventListener('cell-click', (e) => {
   *   console.log(e.detail.field, e.detail.value);
   * });
   *
   * // Works with editing events when EditingPlugin is imported
   * grid.addEventListener('cell-commit', (e) => {
   *   console.log(e.detail.oldValue, '→', e.detail.value);
   * });
   * ```
   *
   * @category Events
   */
  override addEventListener<K extends keyof DataGridEventMap<T>>(
    type: K,
    listener: (this: DataGridElement<T>, ev: CustomEvent<DataGridEventMap<T>[K]>) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | ((ev: CustomEvent) => void),
    options?: boolean | AddEventListenerOptions,
  ): void {
    super.addEventListener(type, listener as EventListener, options);
  }

  /**
   * Remove a typed event listener for grid events.
   *
   * @category Events
   */
  override removeEventListener<K extends keyof DataGridEventMap<T>>(
    type: K,
    listener: (this: DataGridElement<T>, ev: CustomEvent<DataGridEventMap<T>[K]>) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  override removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
  override removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | ((ev: CustomEvent) => void),
    options?: boolean | EventListenerOptions,
  ): void {
    super.removeEventListener(type, listener as EventListener, options);
  }

  #emit<D>(eventName: string, detail: D): void {
    this.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: true, composed: true }));
  }

  /** Update ARIA selection attributes on rendered rows/cells */
  #updateAriaSelection(): void {
    // Mark active row and cell with aria-selected
    const rows = this._bodyEl?.querySelectorAll('.data-grid-row');
    rows?.forEach((row, rowIdx) => {
      const isActiveRow = rowIdx === this._focusRow;
      row.setAttribute('aria-selected', String(isActiveRow));
      row.querySelectorAll('.cell').forEach((cell, colIdx) => {
        (cell as HTMLElement).setAttribute('aria-selected', String(isActiveRow && colIdx === this._focusCol));
      });
    });
  }
  // #endregion

  // #region Batched Update System
  // Allows multiple property changes within the same microtask to be coalesced
  // into a single update cycle, dramatically reducing redundant renders.

  /**
   * Queue an update for a specific property type.
   * All updates queued within the same microtask are batched together.
   */
  #queueUpdate(type: 'rows' | 'columns' | 'gridConfig' | 'fitMode'): void {
    this.#pendingUpdateFlags[type] = true;

    // If already queued, skip scheduling
    if (this.#pendingUpdate) return;

    this.#pendingUpdate = true;
    // Use queueMicrotask to batch synchronous property sets
    queueMicrotask(() => this.#flushPendingUpdates());
  }

  /**
   * Process all pending updates in optimal order.
   * Priority: gridConfig first (may affect all), then columns, rows, fitMode, editMode
   */
  #flushPendingUpdates(): void {
    if (!this.#pendingUpdate || !this.#connected) {
      this.#pendingUpdate = false;
      return;
    }

    const flags = this.#pendingUpdateFlags;

    // Reset flags before processing to allow new updates during processing
    this.#pendingUpdate = false;
    this.#pendingUpdateFlags = {
      rows: false,
      columns: false,
      gridConfig: false,
      fitMode: false,
    };

    // If gridConfig changed, it supersedes columns/fit changes
    // but we still need to handle rows if set separately
    if (flags.gridConfig) {
      this.#applyGridConfigUpdate();
      // Still process rows if set separately (e.g., grid.gridConfig = ...; grid.rows = ...;)
      if (flags.rows) {
        this.#applyRowsUpdate();
      }
      return;
    }

    // Process remaining changes in dependency order
    if (flags.columns) {
      this.#applyColumnsUpdate();
    }
    if (flags.rows) {
      this.#applyRowsUpdate();
    }
    if (flags.fitMode) {
      this.#applyFitModeUpdate();
    }
  }

  // Individual update applicators - these do the actual work
  #applyRowsUpdate(): void {
    this._rows = Array.isArray(this.#rows) ? [...this.#rows] : [];
    // Rebuild row ID map for O(1) lookups
    this.#rebuildRowIdMap();
    // Request a ROWS phase render through the scheduler.
    // This batches with any other pending work (e.g., React adapter's refreshColumns).
    this.#scheduler.requestPhase(RenderPhase.ROWS, 'applyRowsUpdate');
  }

  /**
   * Rebuild the row ID map for O(1) lookups.
   * Called when rows array changes.
   */
  #rebuildRowIdMap(): void {
    this.#rowIdMap.clear();
    const getRowId = this.#effectiveConfig.getRowId;

    this._rows.forEach((row, index) => {
      const id = this.#tryResolveRowId(row, getRowId);
      if (id !== undefined) {
        this.#rowIdMap.set(id, { row, index });
      }
      // Rows without IDs are skipped - they won't be accessible via getRow/updateRow
    });
  }

  /**
   * Try to resolve the ID for a row using configured getRowId or fallback.
   * Returns undefined if no ID can be determined (non-throwing).
   * Used internally by #rebuildRowIdMap.
   */
  #tryResolveRowId(row: T, getRowId?: (row: T) => string): string | undefined {
    if (getRowId) {
      return getRowId(row);
    }

    // Fallback: common ID fields
    const r = row as Record<string, unknown>;
    if ('id' in r && r.id != null) return String(r.id);
    if ('_id' in r && r._id != null) return String(r._id);

    return undefined;
  }

  /**
   * Resolve the ID for a row, throwing if not found.
   * Used by public getRowId() method.
   */
  #resolveRowIdOrThrow(row: T, getRowId?: (row: T) => string): string {
    const id = this.#tryResolveRowId(row, getRowId);
    if (id === undefined) {
      throw new Error(
        '[tbw-grid] Cannot determine row ID. ' +
          'Configure getRowId in gridConfig or ensure rows have an "id" property.',
      );
    }
    return id;
  }

  #applyColumnsUpdate(): void {
    invalidateCellCache(this);
    this.#configManager.merge();
    this.#setup();
  }

  #applyFitModeUpdate(): void {
    this.#configManager.merge();
    const mode = this.#effectiveConfig.fitMode;
    if (mode === 'fixed') {
      this.__didInitialAutoSize = false;
      autoSizeColumns(this);
    } else {
      this._columns.forEach((c: any) => {
        if (!c.__userResized && c.__autoSized) delete c.width;
      });
      updateTemplate(this);
    }
  }

  #applyGridConfigUpdate(): void {
    // Parse shell config (title, etc.) - needed for React where gridConfig is set after initial render
    parseLightDomShell(this, this.#shellState);
    // Parse tool buttons container before checking shell state
    parseLightDomToolButtons(this, this.#shellState);

    const hadShell = !!this.#renderRoot.querySelector('.has-shell');
    const hadToolPanel = !!this.#renderRoot.querySelector('.tbw-tool-panel');

    // Count accordion sections before update (to detect new panels added)
    const accordionSectionsBefore = this.#renderRoot.querySelectorAll('.tbw-accordion-section').length;

    this.#configManager.parseLightDomColumns(this as unknown as HTMLElement);
    this.#configManager.merge();
    this.#updatePluginConfigs();

    // Parse light DOM tool panels AFTER plugins are initialized
    // This ensures plugin panels are collected first, then light DOM panels merge in
    parseLightDomToolPanels(this, this.#shellState, this.#getToolPanelRendererFactory());

    // Mark sources as changed since parseLightDomToolPanels may have updated shell state maps
    // This ensures the next merge() will pick up any new tool panels
    this.#configManager.markSourcesChanged();

    // Re-merge to pick up any light DOM tool panels
    this.#configManager.merge();

    const nowNeedsShell = shouldRenderShellHeader(this.#effectiveConfig?.shell);
    const nowHasToolPanels = (this.#effectiveConfig?.shell?.toolPanels?.length ?? 0) > 0;

    // Full re-render needed if:
    // 1. Shell state changed (added or removed)
    // 2. Tool panels were added but sidebar doesn't exist in DOM yet
    // 3. Number of tool panels changed (plugin panels added/removed)
    const toolPanelCountChanged = (this.#effectiveConfig?.shell?.toolPanels?.length ?? 0) !== accordionSectionsBefore;
    const needsFullRerender =
      hadShell !== nowNeedsShell ||
      (!hadShell && nowNeedsShell) ||
      (!hadToolPanel && nowHasToolPanels) ||
      (hadToolPanel && toolPanelCountChanged);

    if (needsFullRerender) {
      this.#render();
      this.#injectAllPluginStyles(); // Re-inject after render clears shadow DOM
      this.#afterConnect();
      // Rebuild row ID map in case getRowId changed
      this.#rebuildRowIdMap();
      return;
    }

    // Update shell header in place if it exists (e.g., title changed)
    // This avoids a full re-render when only shell config changed
    if (hadShell) {
      this.#updateShellHeaderInPlace();
    }

    // Rebuild row ID map in case getRowId changed
    this.#rebuildRowIdMap();

    // Request a COLUMNS phase render through the scheduler.
    // This batches with any other pending work (e.g., React adapter's refreshColumns).
    // Previously this called rebuildRowModel, processColumns, renderHeader, updateTemplate,
    // and refreshVirtualWindow directly - causing race conditions with framework adapters.
    this.#scheduler.requestPhase(RenderPhase.COLUMNS, 'applyGridConfigUpdate');
  }

  /**
   * Update the shell header DOM in place without a full re-render.
   * Handles title, toolbar buttons, and other shell header changes.
   */
  #updateShellHeaderInPlace(): void {
    const shellHeader = this.#renderRoot.querySelector('.tbw-shell-header');
    if (!shellHeader) return;

    const title = this.#effectiveConfig.shell?.header?.title ?? this.#shellState.lightDomTitle;

    // Update or create title element
    let titleEl = shellHeader.querySelector('.tbw-shell-title') as HTMLElement | null;
    if (title) {
      if (!titleEl) {
        // Create title element if it doesn't exist
        titleEl = document.createElement('h2');
        titleEl.className = 'tbw-shell-title';
        titleEl.setAttribute('part', 'shell-title');
        // Insert at the beginning of the shell header
        shellHeader.insertBefore(titleEl, shellHeader.firstChild);
      }
      titleEl.textContent = title;
    } else if (titleEl) {
      // Remove title element if no title
      titleEl.remove();
    }
  }

  // NOTE: Legacy watch handlers have been replaced by the batched update system.
  // The #queueUpdate() method schedules updates which are processed by #flushPendingUpdates()
  // and individual #apply*Update() methods. This coalesces rapid property changes
  // (e.g., setting rows, columns, gridConfig in quick succession) into a single update cycle.

  #processColumns(): void {
    // Let plugins process visible columns (column grouping, etc.)
    // Start from base columns (before any plugin transformation) - like #rebuildRowModel uses #rows
    if (this.#pluginManager) {
      // Use base columns as source of truth, falling back to current _columns if not set
      const sourceColumns = this.#baseColumns.length > 0 ? this.#baseColumns : this._columns;
      const visibleCols = sourceColumns.filter((c) => !c.hidden);
      const hiddenCols = sourceColumns.filter((c) => c.hidden);
      const processedColumns = this.#pluginManager.processColumns([...visibleCols]);

      // If plugins modified visible columns, update them
      if (processedColumns !== visibleCols) {
        // Build set for quick lookup
        const processedFields = new Set(processedColumns.map((c: ColumnInternal) => c.field));

        // Check if this is a complete column replacement (e.g., pivot mode)
        // If no processed columns match original columns, use processed columns directly
        const hasMatchingFields = visibleCols.some((c) => processedFields.has(c.field));

        if (!hasMatchingFields && processedColumns.length > 0) {
          // Complete replacement: use processed columns directly (pivot mode)
          // Preserve hidden columns at the end
          this._columns = [...processedColumns, ...hiddenCols] as ColumnInternal<T>[];
        } else {
          // Plugins may have:
          // 1. Modified existing columns
          // 2. Added new columns (e.g., expander column)
          // 3. Reordered columns
          // We trust the plugin's output order and include all columns they returned
          // plus any hidden columns at the end
          this._columns = [...processedColumns, ...hiddenCols] as ColumnInternal<T>[];
        }
      } else {
        // Plugins returned columns unchanged, but we may need to restore from base
        this._columns = [...sourceColumns] as ColumnInternal<T>[];
      }
    }
  }

  /** Recompute row model via plugin hooks. */
  #rebuildRowModel(): void {
    // Invalidate cell display value cache - rows are changing
    invalidateCellCache(this);

    // Start fresh from original rows (plugins will transform them)
    const originalRows = Array.isArray(this.#rows) ? [...this.#rows] : [];

    // Let plugins process rows (they may add, remove, transform rows)
    // Plugins can add markers for specialized rendering via the renderRow hook
    const processedRows = this.#pluginManager?.processRows(originalRows) ?? originalRows;

    // Store processed rows for rendering
    // Note: processedRows may contain group markers that plugins handle via renderRow hook
    this._rows = processedRows as T[];

    // Rebuild position cache for variable heights (rows may have changed)
    if (this._virtualization.variableHeights) {
      this.#initializePositionCache();
    }
  }

  /**
   * Apply animation configuration to CSS custom properties on the host element.
   * This makes the grid's animation settings available to plugins via CSS variables.
   * Called by ConfigManager after merge.
   */
  #applyAnimationConfig(gridConfig: GridConfig<T>): void {
    const config: AnimationConfig = {
      ...DEFAULT_ANIMATION_CONFIG,
      ...gridConfig.animation,
    };

    // Resolve animation mode
    const mode = config.mode ?? 'reduced-motion';
    let enabled: 0 | 1 = 1;

    if (mode === false || mode === 'off') {
      enabled = 0;
    } else if (mode === true || mode === 'on') {
      enabled = 1;
    }
    // For 'reduced-motion', we leave enabled=1 and let CSS @media query handle it

    // Set CSS custom properties
    this.style.setProperty('--tbw-animation-duration', `${config.duration}ms`);
    this.style.setProperty('--tbw-animation-easing', config.easing ?? 'ease-out');
    this.style.setProperty('--tbw-animation-enabled', String(enabled));

    // Set data attribute for mode-based CSS selectors
    this.dataset.animationMode = typeof mode === 'boolean' ? (mode ? 'on' : 'off') : mode;
  }
  // #endregion

  // #region Internal Helpers
  #renderVisibleRows(start: number, end: number, epoch = this.__rowRenderEpoch): void {
    // Use cached hook to avoid creating closures on every render (hot path optimization)
    if (!this.#renderRowHook) {
      this.#renderRowHook = (row: any, rowEl: HTMLElement, rowIndex: number): boolean => {
        return this.#pluginManager?.renderRow(row, rowEl, rowIndex) ?? false;
      };
    }
    renderVisibleRows(this as unknown as InternalGrid<T>, start, end, epoch, this.#renderRowHook);
  }

  // ARIA state - uses external module for pure functions
  #ariaState: AriaState = createAriaState();

  /** Updates ARIA row/col counts. Delegates to aria.ts module. */
  #updateAriaCounts(rowCount: number, colCount: number): void {
    updateAriaCounts(this.#ariaState, this.__rowsBodyEl, this._bodyEl, rowCount, colCount);
  }

  /** Updates ARIA label and describedby attributes. Delegates to aria.ts module. */
  #updateAriaLabels(): void {
    updateAriaLabels(this.#ariaState, this.__rowsBodyEl, this.#effectiveConfig, this.#shellState);
  }

  /**
   * Update the loading overlay visibility.
   * Called when `loading` property changes.
   */
  #updateLoadingOverlay(): void {
    const gridRoot = this.querySelector('.tbw-grid-root');
    if (!gridRoot) return;

    if (this.#loading) {
      // Create overlay if it doesn't exist
      if (!this.#loadingOverlayEl) {
        this.#loadingOverlayEl = createLoadingOverlay(this.#effectiveConfig?.loadingRenderer);
      }
      showLoadingOverlay(gridRoot, this.#loadingOverlayEl);
    } else {
      hideLoadingOverlay(this.#loadingOverlayEl);
    }
  }

  /**
   * Update a row's loading state in the DOM.
   * @param rowId - The row's unique identifier
   * @param loading - Whether the row is loading
   */
  #updateRowLoadingState(rowId: string, loading: boolean): void {
    // Find the row element by row ID
    const rowData = this.#rowIdMap.get(rowId);
    if (!rowData) return;

    const rowEl = this.findRenderedRowElement?.(rowData.index);
    if (!rowEl) return;

    setRowLoadingState(rowEl, loading);
  }

  /**
   * Update a cell's loading state in the DOM.
   * @param rowId - The row's unique identifier
   * @param field - The column field
   * @param loading - Whether the cell is loading
   */
  #updateCellLoadingState(rowId: string, field: string, loading: boolean): void {
    // Find the row element by row ID
    const rowData = this.#rowIdMap.get(rowId);
    if (!rowData) return;

    const rowEl = this.findRenderedRowElement?.(rowData.index);
    if (!rowEl) return;

    // Find the cell by field
    const colIndex = this._visibleColumns.findIndex((c) => c.field === field);
    if (colIndex < 0) return;

    const cellEl = rowEl.children[colIndex] as HTMLElement | undefined;
    if (!cellEl) return;

    setCellLoadingState(cellEl, loading);
  }

  /**
   * Request a full grid re-setup through the render scheduler.
   * This method queues all the config merging, column/row processing, and rendering
   * to happen in the next animation frame via the scheduler.
   *
   * Previously this method executed rendering synchronously, but that caused race
   * conditions with framework adapters that also schedule their own render work.
   */
  #setup(): void {
    if (!this.isConnected) return;
    if (!this._headerRowEl || !this._bodyEl) {
      return;
    }

    // Read light DOM column configuration (synchronous DOM read)
    this.#configManager.parseLightDomColumns(this as unknown as HTMLElement);

    // Apply initial column state synchronously if present
    // (needs to happen before scheduler to avoid flash of unstyled content)
    if (this.#initialColumnState) {
      const state = this.#initialColumnState;
      this.#initialColumnState = undefined; // Clear to avoid re-applying
      // Temporarily merge config so applyState has columns to work with
      this.#configManager.merge();
      const plugins = (this.#pluginManager?.getAll() ?? []) as BaseGridPlugin[];
      this.#configManager.applyState(state, plugins);
    }

    // Ensure legacy inline grid styles are cleared from container
    if (this._bodyEl) {
      this._bodyEl.style.display = '';
      this._bodyEl.style.gridTemplateColumns = '';
    }

    // Request full render through scheduler - batches with framework adapter work
    this.#scheduler.requestPhase(RenderPhase.FULL, 'setup');
  }

  #onScrollBatched(scrollTop: number): void {
    // Faux scrollbar pattern: content never scrolls, just update transforms
    // Old content stays visible until new transforms are applied
    this.refreshVirtualWindow(false);

    // Let plugins reapply visual state to recycled DOM elements
    this.#pluginManager?.onScrollRender();

    // Schedule debounced measurement for variable heights mode
    // This progressively builds up the height cache as user scrolls
    if (this._virtualization.variableHeights) {
      if (this.#scrollMeasureTimeout) {
        clearTimeout(this.#scrollMeasureTimeout);
      }
      // Measure after scroll settles (100ms debounce)
      this.#scrollMeasureTimeout = window.setTimeout(() => {
        this.#scrollMeasureTimeout = 0;
        this.#measureRenderedRowHeights(this._virtualization.start, this._virtualization.end);
      }, 100);
    }

    // Dispatch to plugins (using cached flag and pooled event object to avoid GC)
    if (this.#hasScrollPlugins) {
      const fauxScrollbar = this._virtualization.container;
      const scrollArea = this.#scrollAreaEl;
      // Reuse pooled event object - update values in-place instead of allocating new object
      const scrollEvent = this.#pooledScrollEvent;
      scrollEvent.scrollTop = scrollTop;
      // Get horizontal scroll from scroll area (where horizontal scrolling actually happens)
      scrollEvent.scrollLeft = scrollArea?.scrollLeft ?? 0;
      scrollEvent.scrollHeight = fauxScrollbar?.scrollHeight ?? 0;
      scrollEvent.scrollWidth = scrollArea?.scrollWidth ?? 0;
      scrollEvent.clientHeight = fauxScrollbar?.clientHeight ?? 0;
      scrollEvent.clientWidth = scrollArea?.clientWidth ?? 0;
      // Note: originalEvent removed to avoid allocation - plugins should not rely on it
      this.#pluginManager?.onScroll(scrollEvent);
    }
  }

  /**
   * Find the header row element in the shadow DOM.
   * Used by plugins that need to access header cells for styling or measurement.
   * @group DOM Access
   * @internal Plugin API
   */
  findHeaderRow(): HTMLElement {
    return this.#renderRoot.querySelector('.header-row') as HTMLElement;
  }

  /**
   * Find a rendered row element by its data row index.
   * Returns null if the row is not currently rendered (virtualized out of view).
   * Used by plugins that need to access specific row elements for styling or measurement.
   * @group DOM Access
   * @internal Plugin API
   * @param rowIndex - The data row index (not the DOM position)
   */
  findRenderedRowElement(rowIndex: number): HTMLElement | null {
    return (
      (Array.from(this._bodyEl.querySelectorAll('.data-grid-row')) as HTMLElement[]).find((r) => {
        const cell = r.querySelector('.cell[data-row]');
        return cell && Number(cell.getAttribute('data-row')) === rowIndex;
      }) || null
    );
  }

  /**
   * Dispatch a cell click event to the plugin system, then emit a public event.
   * Plugins get first chance to handle the event. After plugins process it,
   * a `cell-click` CustomEvent is dispatched for external listeners.
   *
   * @returns `true` if any plugin handled (consumed) the event, or if consumer canceled
   * @fires cell-activate - Unified activation event (cancelable) - fires FIRST
   * @fires cell-click - Emitted after plugins process the click, with full cell context
   */
  _dispatchCellClick(event: MouseEvent, rowIndex: number, colIndex: number, cellEl: HTMLElement): boolean {
    const row = this._rows[rowIndex];
    const col = this._columns[colIndex];
    if (!row || !col) return false;

    const field = col.field;
    const value = (row as Record<string, unknown>)[field];

    // Emit cell-activate FIRST (cancelable) - consumers can prevent plugin behavior
    const activateEvent = new CustomEvent('cell-activate', {
      cancelable: true,
      bubbles: true,
      composed: true,
      detail: {
        rowIndex,
        colIndex,
        field,
        value,
        row,
        cellEl,
        trigger: 'pointer' as const,
        originalEvent: event,
      },
    });
    this.dispatchEvent(activateEvent);

    // If consumer canceled, don't let plugins handle it
    if (activateEvent.defaultPrevented) {
      return true; // Treated as "handled"
    }

    const cellClickEvent: CellClickEvent = {
      row,
      rowIndex,
      colIndex,
      field,
      value,
      cellEl,
      originalEvent: event,
    };

    // Let plugins handle (editing, selection, etc.)
    const handled = this.#pluginManager?.onCellClick(cellClickEvent) ?? false;

    // Emit informational cell-click event for external listeners
    this.#emit('cell-click', cellClickEvent);

    return handled;
  }

  /**
   * Dispatch a row click event to the plugin system, then emit a public event.
   * Plugins get first chance to handle the event. After plugins process it,
   * a `row-click` CustomEvent is dispatched for external listeners.
   *
   * @returns `true` if any plugin handled (consumed) the event
   * @fires row-click - Emitted after plugins process the click, with full row context
   */
  _dispatchRowClick(event: MouseEvent, rowIndex: number, row: any, rowEl: HTMLElement): boolean {
    if (!row) return false;

    const rowClickEvent: RowClickEvent = {
      rowIndex,
      row,
      rowEl,
      originalEvent: event,
    };

    // Let plugins handle first
    const handled = this.#pluginManager?.onRowClick(rowClickEvent) ?? false;

    // Emit public event for external listeners (reuse same event object)
    this.#emit('row-click', rowClickEvent);

    return handled;
  }

  /**
   * Dispatch a header click event to the plugin system.
   * Returns true if any plugin handled the event.
   */
  _dispatchHeaderClick(event: MouseEvent, colIndex: number, headerEl: HTMLElement): boolean {
    const col = this._columns[colIndex];
    if (!col) return false;

    const headerClickEvent: HeaderClickEvent = {
      colIndex,
      field: col.field,
      column: col,
      headerEl,
      originalEvent: event,
    };

    return this.#pluginManager?.onHeaderClick(headerClickEvent) ?? false;
  }

  /**
   * Dispatch a keyboard event to the plugin system.
   * Returns true if any plugin handled the event.
   */
  _dispatchKeyDown(event: KeyboardEvent): boolean {
    return this.#pluginManager?.onKeyDown(event) ?? false;
  }

  /**
   * Get horizontal scroll boundary offsets from plugins.
   * Used by keyboard navigation to ensure focused cells are fully visible
   * when plugins like pinned columns obscure part of the scroll area.
   */
  _getHorizontalScrollOffsets(
    rowEl?: HTMLElement,
    focusedCell?: HTMLElement,
  ): { left: number; right: number; skipScroll?: boolean } {
    return this.#pluginManager?.getHorizontalScrollOffsets(rowEl, focusedCell) ?? { left: 0, right: 0 };
  }

  /**
   * Query all plugins with a generic query and collect responses.
   * This enables inter-plugin communication without the core knowing plugin-specific concepts.
   * @group Plugin Communication
   * @internal Plugin API
   *
   * @example
   * // Check if any plugin vetoes moving a column
   * const responses = grid.queryPlugins<boolean>({ type: 'canMoveColumn', context: column });
   * const canMove = !responses.includes(false);
   *
   * @deprecated Use the simplified `query<T>(type, context)` method instead.
   */
  queryPlugins<T>(query: PluginQuery): T[] {
    return this.#pluginManager?.queryPlugins<T>(query) ?? [];
  }

  /**
   * Query plugins with a simplified API.
   * This is a convenience wrapper around `queryPlugins` that uses a flat signature.
   *
   * @param type - The query type (e.g., 'canMoveColumn')
   * @param context - The query context/parameters
   * @returns Array of non-undefined responses from plugins
   * @group Plugin Communication
   * @internal Plugin API
   *
   * @example
   * // Check if any plugin vetoes moving a column
   * const responses = grid.query<boolean>('canMoveColumn', column);
   * const canMove = !responses.includes(false);
   *
   * // Get context menu items from all plugins
   * const items = grid.query<ContextMenuItem[]>('getContextMenuItems', params).flat();
   */
  query<T>(type: string, context: unknown): T[] {
    return this.#pluginManager?.queryPlugins<T>({ type, context }) ?? [];
  }

  /**
   * Dispatch cell mouse events for drag operations.
   * Returns true if any plugin started a drag.
   * @group Event Dispatching
   * @internal Plugin API - called by event-delegation.ts
   */
  _dispatchCellMouseDown(event: CellMouseEvent): boolean {
    return this.#pluginManager?.onCellMouseDown(event) ?? false;
  }

  /**
   * Dispatch cell mouse move during drag.
   * @group Event Dispatching
   * @internal Plugin API - called by event-delegation.ts
   */
  _dispatchCellMouseMove(event: CellMouseEvent): void {
    this.#pluginManager?.onCellMouseMove(event);
  }

  /**
   * Dispatch cell mouse up to end drag.
   * @group Event Dispatching
   * @internal Plugin API - called by event-delegation.ts
   */
  _dispatchCellMouseUp(event: CellMouseEvent): void {
    this.#pluginManager?.onCellMouseUp(event);
  }

  /**
   * Call afterCellRender hook on all plugins.
   * This is called by rows.ts for each cell after it's rendered,
   * allowing plugins to modify cells during render rather than
   * requiring expensive post-render DOM queries.
   *
   * @group Plugin Hooks
   * @internal Plugin API - called by rows.ts
   */
  _afterCellRender(context: AfterCellRenderContext<T>): void {
    // Cast needed because PluginManager uses unknown for row type
    this.#pluginManager?.afterCellRender(context as AfterCellRenderContext);
  }

  /**
   * Check if any plugin has registered an afterCellRender hook.
   * Used to skip the hook call entirely for performance when no plugins need it.
   *
   * @group Plugin Hooks
   * @internal Plugin API - called by rows.ts
   */
  _hasAfterCellRenderHook(): boolean {
    return this.#pluginManager?.hasAfterCellRenderHook() ?? false;
  }

  /**
   * Call afterRowRender hook on all plugins that have registered for it.
   * Called by rows.ts after each row is completely rendered.
   *
   * @param context - Context containing row data, index, and DOM element
   *
   * @group Plugin Hooks
   * @internal Plugin API - called by rows.ts
   */
  _afterRowRender(context: AfterRowRenderContext<T>): void {
    // Cast needed because PluginManager uses unknown for row type
    this.#pluginManager?.afterRowRender(context as AfterRowRenderContext);
  }

  /**
   * Check if any plugin has registered an afterRowRender hook.
   * Used to skip the hook call entirely for performance when no plugins need it.
   *
   * @group Plugin Hooks
   * @internal Plugin API - called by rows.ts
   */
  _hasAfterRowRenderHook(): boolean {
    return this.#pluginManager?.hasAfterRowRenderHook() ?? false;
  }

  /**
   * Wait for the grid to be ready.
   * Resolves once the component has finished initial setup, including
   * column inference, plugin initialization, and first render.
   *
   * @group Lifecycle
   * @returns Promise that resolves when the grid is ready
   *
   * @example
   * ```typescript
   * const grid = document.querySelector('tbw-grid');
   * await grid.ready();
   * console.log('Grid is ready, rows:', grid.rows.length);
   * ```
   */
  async ready(): Promise<void> {
    return this.#readyPromise;
  }

  /**
   * Force a full layout/render cycle.
   * Use this after programmatic changes that require re-measurement,
   * such as container resize or dynamic style changes.
   *
   * @group Lifecycle
   * @returns Promise that resolves when the render cycle completes
   *
   * @example
   * ```typescript
   * // After resizing the container
   * container.style.width = '800px';
   * await grid.forceLayout();
   * console.log('Grid re-rendered');
   * ```
   */
  async forceLayout(): Promise<void> {
    // Request a full render cycle through the scheduler
    this.#scheduler.requestPhase(RenderPhase.FULL, 'forceLayout');
    // Wait for the render cycle to complete
    return this.#scheduler.whenReady();
  }

  /**
   * Get a frozen snapshot of the current effective configuration.
   * The returned object is read-only and reflects all merged config sources.
   *
   * @group Configuration
   * @returns Promise resolving to frozen configuration object
   *
   * @example
   * ```typescript
   * const config = await grid.getConfig();
   * console.log('Columns:', config.columns?.length);
   * console.log('Fit mode:', config.fitMode);
   * ```
   */
  async getConfig(): Promise<Readonly<GridConfig<T>>> {
    return Object.freeze({ ...(this.#effectiveConfig || {}) });
  }
  // #endregion

  // #region Row API
  /**
   * Get the unique ID for a row.
   * Uses the configured `getRowId` function or falls back to `row.id` / `row._id`.
   *
   * @group Data Management
   * @param row - The row object
   * @returns The row's unique identifier
   * @throws Error if no ID can be determined
   *
   * @example
   * ```typescript
   * const id = grid.getRowId(row);
   * console.log('Row ID:', id);
   * ```
   */
  getRowId(row: T): string {
    return this.#resolveRowIdOrThrow(row, this.#effectiveConfig.getRowId);
  }

  /**
   * Get a row by its ID.
   * O(1) lookup via internal Map.
   *
   * @group Data Management
   * @param id - Row identifier (from getRowId)
   * @returns The row object, or undefined if not found
   *
   * @example
   * ```typescript
   * const row = grid.getRow('cargo-123');
   * if (row) {
   *   console.log('Found:', row.name);
   * }
   * ```
   */
  getRow(id: string): T | undefined {
    return this.#rowIdMap.get(id)?.row;
  }

  /**
   * Update a row by ID.
   * Mutates the row in-place and emits `cell-change` for each changed field.
   *
   * @group Data Management
   * @param id - Row identifier (from getRowId)
   * @param changes - Partial row data to merge
   * @param source - Origin of update (default: 'api')
   * @throws Error if row is not found
   * @fires cell-change - For each field that changed
   *
   * @example
   * ```typescript
   * // WebSocket update handler
   * socket.on('cargo-update', (data) => {
   *   grid.updateRow(data.id, { status: data.status, eta: data.eta });
   * });
   * ```
   */
  updateRow(id: string, changes: Partial<T>, source: UpdateSource = 'api'): void {
    const entry = this.#rowIdMap.get(id);
    if (!entry) {
      throw new Error(
        `[tbw-grid] Row with ID "${id}" not found. ` + `Ensure the row exists and getRowId is correctly configured.`,
      );
    }

    const { row, index } = entry;
    const changedFields: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];

    // Compute changes and apply in-place
    for (const [field, newValue] of Object.entries(changes)) {
      const oldValue = (row as Record<string, unknown>)[field];
      if (oldValue !== newValue) {
        changedFields.push({ field, oldValue, newValue });
        (row as Record<string, unknown>)[field] = newValue;
      }
    }

    // Emit cell-change for each changed field
    for (const { field, oldValue, newValue } of changedFields) {
      this.#emit('cell-change', {
        row,
        rowId: id,
        rowIndex: index,
        field,
        oldValue,
        newValue,
        changes,
        source,
      } as CellChangeDetail<T>);
    }

    // Schedule re-render if anything changed
    if (changedFields.length > 0) {
      this.#scheduler.requestPhase(RenderPhase.ROWS, 'updateRow');
    }
  }

  /**
   * Batch update multiple rows.
   * More efficient than multiple `updateRow()` calls - single render cycle.
   *
   * @group Data Management
   * @param updates - Array of { id, changes } objects
   * @param source - Origin of updates (default: 'api')
   * @throws Error if any row is not found
   * @fires cell-change - For each field that changed on each row
   *
   * @example
   * ```typescript
   * // Bulk status update
   * grid.updateRows([
   *   { id: 'cargo-1', changes: { status: 'shipped' } },
   *   { id: 'cargo-2', changes: { status: 'shipped' } },
   * ]);
   * ```
   */
  updateRows(updates: Array<{ id: string; changes: Partial<T> }>, source: UpdateSource = 'api'): void {
    let anyChanged = false;

    for (const { id, changes } of updates) {
      const entry = this.#rowIdMap.get(id);
      if (!entry) {
        throw new Error(
          `[tbw-grid] Row with ID "${id}" not found. ` + `Ensure the row exists and getRowId is correctly configured.`,
        );
      }

      const { row, index } = entry;

      // Compute changes and apply in-place
      for (const [field, newValue] of Object.entries(changes)) {
        const oldValue = (row as Record<string, unknown>)[field];
        if (oldValue !== newValue) {
          anyChanged = true;
          (row as Record<string, unknown>)[field] = newValue;

          // Emit cell-change for each changed field
          this.#emit('cell-change', {
            row,
            rowId: id,
            rowIndex: index,
            field,
            oldValue,
            newValue,
            changes,
            source,
          } as CellChangeDetail<T>);
        }
      }
    }

    // Schedule single re-render for all changes
    if (anyChanged) {
      this.#scheduler.requestPhase(RenderPhase.ROWS, 'updateRows');
    }
  }

  /**
   * Animate a row at the specified index.
   * Applies a visual animation to highlight changes, insertions, or removals.
   *
   * **Animation types:**
   * - `'change'`: Flash highlight (for data changes, e.g., after cell edit)
   * - `'insert'`: Slide-in animation (for newly added rows)
   * - `'remove'`: Fade-out animation (for rows being removed)
   *
   * The animation is purely visual - it does not affect the data.
   * For remove animations, the row remains in the DOM until animation completes.
   *
   * @group Row Animation
   * @param rowIndex - Index of the row in the current row set
   * @param type - Type of animation to apply
   *
   * @example
   * ```typescript
   * // Highlight a row after external data update
   * grid.updateRow('row-123', { status: 'shipped' });
   * grid.animateRow(rowIndex, 'change');
   *
   * // Animate new row insertion
   * grid.rows = [...grid.rows, newRow];
   * grid.animateRow(grid.rows.length - 1, 'insert');
   * ```
   */
  animateRow(rowIndex: number, type: RowAnimationType): void {
    animateRow(this as unknown as InternalGrid, rowIndex, type);
  }

  /**
   * Animate multiple rows at once.
   * More efficient than calling `animateRow()` multiple times.
   *
   * @group Row Animation
   * @param rowIndices - Indices of the rows to animate
   * @param type - Type of animation to apply to all rows
   *
   * @example
   * ```typescript
   * // Highlight all changed rows after bulk update
   * const changedIndices = [0, 2, 5];
   * grid.animateRows(changedIndices, 'change');
   * ```
   */
  animateRows(rowIndices: number[], type: RowAnimationType): void {
    animateRows(this as unknown as InternalGrid, rowIndices, type);
  }

  /**
   * Animate a row by its ID.
   * Uses the configured `getRowId` function to find the row.
   *
   * @group Row Animation
   * @param rowId - The row's unique identifier (from getRowId)
   * @param type - Type of animation to apply
   * @returns `true` if the row was found and animated, `false` otherwise
   *
   * @example
   * ```typescript
   * // Highlight a row after real-time update
   * socket.on('row-updated', (data) => {
   *   grid.updateRow(data.id, data.changes);
   *   grid.animateRowById(data.id, 'change');
   * });
   * ```
   */
  animateRowById(rowId: string, type: RowAnimationType): boolean {
    return animateRowById(this as unknown as InternalGrid, rowId, type);
  }
  // #endregion

  // #region Column API
  /**
   * Show or hide a column by field name.
   *
   * @group Column Visibility
   * @param field - The field name of the column to modify
   * @param visible - Whether the column should be visible
   * @returns `true` if the visibility changed, `false` if unchanged
   * @fires column-state-change - Emitted when the visibility changes
   *
   * @example
   * ```typescript
   * // Hide the email column
   * grid.setColumnVisible('email', false);
   *
   * // Show it again
   * grid.setColumnVisible('email', true);
   * ```
   */
  setColumnVisible(field: string, visible: boolean): boolean {
    const result = this.#configManager.setColumnVisible(field, visible);
    if (result) {
      this.requestStateChange();
    }
    return result;
  }

  /**
   * Toggle a column's visibility.
   *
   * @group Column Visibility
   * @param field - The field name of the column to toggle
   * @returns The new visibility state (`true` = visible, `false` = hidden)
   * @fires column-state-change - Emitted when the visibility changes
   *
   * @example
   * ```typescript
   * // Toggle the notes column visibility
   * const isNowVisible = grid.toggleColumnVisibility('notes');
   * console.log(`Notes column is now ${isNowVisible ? 'visible' : 'hidden'}`);
   * ```
   */
  toggleColumnVisibility(field: string): boolean {
    const result = this.#configManager.toggleColumnVisibility(field);
    if (result) {
      this.requestStateChange();
    }
    return result;
  }

  /**
   * Check if a column is currently visible.
   *
   * @group Column Visibility
   * @param field - The field name to check
   * @returns `true` if the column is visible, `false` if hidden
   *
   * @example
   * ```typescript
   * if (grid.isColumnVisible('email')) {
   *   console.log('Email column is showing');
   * }
   * ```
   */
  isColumnVisible(field: string): boolean {
    return this.#configManager.isColumnVisible(field);
  }

  /**
   * Show all columns, resetting any hidden columns to visible.
   *
   * @group Column Visibility
   * @fires column-state-change - Emitted when column visibility changes
   * @example
   * ```typescript
   * // Reset button handler
   * resetButton.onclick = () => grid.showAllColumns();
   * ```
   */
  showAllColumns(): void {
    this.#configManager.showAllColumns();
    this.requestStateChange();
  }

  /**
   * Get metadata for all columns including visibility state.
   * Useful for building a column picker UI.
   *
   * @group Column Visibility
   * @returns Array of column info objects
   *
   * @example
   * ```typescript
   * // Build a column visibility menu
   * const columns = grid.getAllColumns();
   * columns.forEach(col => {
   *   if (!col.utility) { // Skip utility columns like selection checkbox
   *     const menuItem = document.createElement('label');
   *     menuItem.innerHTML = `
   *       <input type="checkbox" ${col.visible ? 'checked' : ''}>
   *       ${col.header}
   *     `;
   *     menuItem.querySelector('input').onchange = () =>
   *       grid.toggleColumnVisibility(col.field);
   *     menu.appendChild(menuItem);
   *   }
   * });
   * ```
   */
  getAllColumns(): Array<{
    field: string;
    header: string;
    visible: boolean;
    lockVisible?: boolean;
    utility?: boolean;
  }> {
    return this.#configManager.getAllColumns();
  }

  /**
   * Set the display order of columns.
   *
   * @group Column Order
   * @param order - Array of field names in desired order
   * @fires column-state-change - Emitted when column order changes
   *
   * @example
   * ```typescript
   * // Move 'status' column to first position
   * const currentOrder = grid.getColumnOrder();
   * const newOrder = ['status', ...currentOrder.filter(f => f !== 'status')];
   * grid.setColumnOrder(newOrder);
   * ```
   */
  setColumnOrder(order: string[]): void {
    this.#configManager.setColumnOrder(order);
    this.requestStateChange();
  }

  /**
   * Get the current column display order.
   *
   * @group Column Order
   * @returns Array of field names in display order
   *
   * @example
   * ```typescript
   * const order = grid.getColumnOrder();
   * console.log('Columns:', order.join(', '));
   * ```
   */
  getColumnOrder(): string[] {
    return this.#configManager.getColumnOrder();
  }

  /**
   * Get the current column state for persistence.
   * Returns a serializable object including column order, widths, visibility,
   * sort state, and any plugin-specific state.
   *
   * Use this to save user preferences to localStorage or a database.
   *
   * @group State Persistence
   * @returns Serializable column state object
   *
   * @example
   * ```typescript
   * // Save state to localStorage
   * const state = grid.getColumnState();
   * localStorage.setItem('gridState', JSON.stringify(state));
   *
   * // Later, restore the state
   * const saved = localStorage.getItem('gridState');
   * if (saved) {
   *   grid.columnState = JSON.parse(saved);
   * }
   * ```
   */
  getColumnState(): GridColumnState {
    const plugins = this.#pluginManager?.getAll() ?? [];
    return this.#configManager.collectState(plugins as BaseGridPlugin[]);
  }

  /**
   * Set the column state, restoring all saved preferences.
   * Can be set before or after grid initialization.
   *
   * @group State Persistence
   * @fires column-state-change - Emitted after state is applied (if grid is initialized)
   * @example
   * ```typescript
   * // Restore saved state on page load
   * const grid = document.querySelector('tbw-grid');
   * const saved = localStorage.getItem('myGridState');
   * if (saved) {
   *   grid.columnState = JSON.parse(saved);
   * }
   * ```
   */
  set columnState(state: GridColumnState | undefined) {
    if (!state) return;

    // Store for use after initialization if called before ready
    this.#initialColumnState = state;
    this.#configManager.initialColumnState = state;

    // If already initialized, apply immediately
    if (this.#initialized) {
      this.#applyColumnState(state);
    }
  }

  /**
   * Get the current column state.
   * Alias for `getColumnState()` for property-style access.
   * @group State Persistence
   */
  get columnState(): GridColumnState | undefined {
    return this.getColumnState();
  }

  /**
   * Apply column state internally.
   */
  #applyColumnState(state: GridColumnState): void {
    const plugins = (this.#pluginManager?.getAll() ?? []) as BaseGridPlugin[];
    this.#configManager.applyState(state, plugins);

    // Re-setup to apply changes
    this.#setup();
  }

  /**
   * Request a state change event to be emitted.
   * Called internally after resize, reorder, visibility, or sort changes.
   * Plugins should call this after changing their state.
   * The event is debounced to avoid excessive events during drag operations.
   * @group State Persistence
   * @internal Plugin API
   */
  requestStateChange(): void {
    const plugins = (this.#pluginManager?.getAll() ?? []) as BaseGridPlugin[];
    this.#configManager.requestStateChange(plugins);
  }

  /**
   * Reset column state to initial configuration.
   * Clears all user modifications including order, widths, visibility, and sort.
   *
   * @group State Persistence
   * @fires column-state-change - Emitted after state is reset
   * @example
   * ```typescript
   * // Reset button handler
   * resetBtn.onclick = () => {
   *   grid.resetColumnState();
   *   localStorage.removeItem('gridState');
   * };
   * ```
   */
  resetColumnState(): void {
    // Clear initial state
    this.#initialColumnState = undefined;
    this.__originalOrder = [];

    // Use ConfigManager to reset state
    const plugins = (this.#pluginManager?.getAll() ?? []) as BaseGridPlugin[];
    this.#configManager.resetState(plugins);

    // Re-initialize columns from config
    this.#configManager.merge();
    this.#setup();
  }
  // #endregion

  // #region Shell & Tool Panel API
  /**
   * Check if the tool panel sidebar is currently open.
   *
   * The tool panel is an accordion-based sidebar that contains sections
   * registered by plugins or via `registerToolPanel()`.
   *
   * @group Tool Panel
   * @example
   * ```typescript
   * // Conditionally show/hide a "toggle panel" button
   * const isPanelOpen = grid.isToolPanelOpen;
   * toggleButton.textContent = isPanelOpen ? 'Close Panel' : 'Open Panel';
   * ```
   */
  get isToolPanelOpen(): boolean {
    return this.#shellController.isPanelOpen;
  }

  /**
   * The default row height in pixels.
   *
   * For fixed heights, this is the configured or CSS-measured row height.
   * For variable heights, this is the average/estimated row height.
   * Plugins should use this instead of hardcoding row heights.
   *
   * @group Virtualization
   */
  get defaultRowHeight(): number {
    return this._virtualization.rowHeight;
  }

  /**
   * Get the IDs of currently expanded accordion sections in the tool panel.
   *
   * Multiple sections can be expanded simultaneously in the accordion view.
   *
   * @group Tool Panel
   * @example
   * ```typescript
   * // Check which sections are expanded
   * const expanded = grid.expandedToolPanelSections;
   * console.log('Expanded sections:', expanded);
   * // e.g., ['columnVisibility', 'filtering']
   * ```
   */
  get expandedToolPanelSections(): string[] {
    return this.#shellController.expandedSections;
  }

  /**
   * Open the tool panel sidebar.
   *
   * The tool panel displays an accordion view with all registered panel sections.
   * Each section can be expanded/collapsed independently.
   *
   * @group Tool Panel
   * @example
   * ```typescript
   * // Open the tool panel when a toolbar button is clicked
   * settingsButton.addEventListener('click', () => {
   *   grid.openToolPanel();
   * });
   * ```
   */
  openToolPanel(): void {
    this.#shellController.openToolPanel();
  }

  /**
   * Close the tool panel sidebar.
   *
   * @group Tool Panel
   * @example
   * ```typescript
   * // Close the panel after user makes a selection
   * grid.closeToolPanel();
   * ```
   */
  closeToolPanel(): void {
    this.#shellController.closeToolPanel();
  }

  /**
   * Toggle the tool panel sidebar open or closed.
   *
   * @group Tool Panel
   * @example
   * ```typescript
   * // Wire up a toggle button
   * toggleButton.addEventListener('click', () => {
   *   grid.toggleToolPanel();
   * });
   * ```
   */
  toggleToolPanel(): void {
    this.#shellController.toggleToolPanel();
  }

  /**
   * Toggle an accordion section expanded or collapsed within the tool panel.
   *
   * @group Tool Panel
   * @param sectionId - The ID of the section to toggle (matches `ToolPanelDefinition.id`)
   *
   * @example
   * ```typescript
   * // Expand the column visibility section programmatically
   * grid.openToolPanel();
   * grid.toggleToolPanelSection('columnVisibility');
   * ```
   */
  toggleToolPanelSection(sectionId: string): void {
    this.#shellController.toggleToolPanelSection(sectionId);
  }

  /**
   * Get all registered tool panel definitions.
   *
   * Returns both plugin-registered panels and panels registered via `registerToolPanel()`.
   *
   * @group Tool Panel
   * @returns Array of tool panel definitions
   *
   * @example
   * ```typescript
   * // List all available panels
   * const panels = grid.getToolPanels();
   * panels.forEach(panel => {
   *   console.log(`Panel: ${panel.title} (${panel.id})`);
   * });
   * ```
   */
  getToolPanels(): ToolPanelDefinition[] {
    return this.#shellController.getToolPanels();
  }

  /**
   * Register a custom tool panel section.
   *
   * Use this API to add custom UI sections to the tool panel sidebar
   * without creating a full plugin. The panel will appear as an accordion
   * section in the tool panel.
   *
   * @group Tool Panel
   * @param panel - The tool panel definition
   *
   * @example
   * ```typescript
   * // Register a custom "Export" panel
   * grid.registerToolPanel({
   *   id: 'export',
   *   title: 'Export Options',
   *   icon: '📥',
   *   order: 50, // Lower order = higher in list
   *   render: (container) => {
   *     container.innerHTML = `
   *       <button id="export-csv">Export CSV</button>
   *       <button id="export-json">Export JSON</button>
   *     `;
   *     container.querySelector('#export-csv')?.addEventListener('click', () => {
   *       exportToCSV(grid.rows);
   *     });
   *   }
   * });
   * ```
   */
  registerToolPanel(panel: ToolPanelDefinition): void {
    this.#shellState.apiToolPanelIds.add(panel.id);
    this.#shellController.registerToolPanel(panel);
  }

  /**
   * Unregister a custom tool panel section.
   *
   * @group Tool Panel
   * @param panelId - The ID of the panel to remove
   *
   * @example
   * ```typescript
   * // Remove the export panel when no longer needed
   * grid.unregisterToolPanel('export');
   * ```
   */
  unregisterToolPanel(panelId: string): void {
    this.#shellState.apiToolPanelIds.delete(panelId);
    this.#shellController.unregisterToolPanel(panelId);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Header Content API
  // ════════════════════════════════════════════════════════════════════════════
  // Header content appears in the grid's header bar area (above the column headers).

  /**
   * Get all registered header content definitions.
   *
   * @group Header Content
   * @returns Array of header content definitions
   *
   * @example
   * ```typescript
   * const contents = grid.getHeaderContents();
   * console.log('Header sections:', contents.map(c => c.id));
   * ```
   */
  getHeaderContents(): HeaderContentDefinition[] {
    return this.#shellController.getHeaderContents();
  }

  /**
   * Register custom header content.
   *
   * Header content appears in the grid's header bar area, which is displayed
   * above the column headers. Use this for search boxes, filters, or other
   * controls that should be prominently visible.
   *
   * @group Header Content
   * @param content - The header content definition
   *
   * @example
   * ```typescript
   * // Add a global search box to the header
   * grid.registerHeaderContent({
   *   id: 'global-search',
   *   order: 10,
   *   render: (container) => {
   *     const input = document.createElement('input');
   *     input.type = 'search';
   *     input.placeholder = 'Search all columns...';
   *     input.addEventListener('input', (e) => {
   *       const term = (e.target as HTMLInputElement).value;
   *       filterGrid(term);
   *     });
   *     container.appendChild(input);
   *   }
   * });
   * ```
   */
  registerHeaderContent(content: HeaderContentDefinition): void {
    this.#shellController.registerHeaderContent(content);
  }

  /**
   * Unregister custom header content.
   *
   * @group Header Content
   * @param contentId - The ID of the content to remove
   *
   * @example
   * ```typescript
   * grid.unregisterHeaderContent('global-search');
   * ```
   */
  unregisterHeaderContent(contentId: string): void {
    this.#shellController.unregisterHeaderContent(contentId);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Toolbar Content API
  // ════════════════════════════════════════════════════════════════════════════
  // Toolbar content appears in the grid's toolbar area (typically below header,
  // above column headers). Use for action buttons, dropdowns, etc.

  /**
   * Get all registered toolbar content definitions.
   *
   * @group Toolbar
   * @returns Array of toolbar content definitions
   *
   * @example
   * ```typescript
   * const contents = grid.getToolbarContents();
   * console.log('Toolbar items:', contents.map(c => c.id));
   * ```
   */
  getToolbarContents(): ToolbarContentDefinition[] {
    return this.#shellController.getToolbarContents();
  }

  /**
   * Register custom toolbar content.
   *
   * Toolbar content appears in the grid's toolbar area. Use this for action
   * buttons, dropdowns, or other controls that should be easily accessible.
   * Content is rendered in order of the `order` property (lower = first).
   *
   * @group Toolbar
   * @param content - The toolbar content definition
   *
   * @example
   * ```typescript
   * // Add export buttons to the toolbar
   * grid.registerToolbarContent({
   *   id: 'export-buttons',
   *   order: 100, // Position in toolbar (lower = first)
   *   render: (container) => {
   *     const csvBtn = document.createElement('button');
   *     csvBtn.textContent = 'Export CSV';
   *     csvBtn.className = 'dg-toolbar-btn';
   *     csvBtn.addEventListener('click', () => exportToCSV(grid.rows));
   *
   *     const jsonBtn = document.createElement('button');
   *     jsonBtn.textContent = 'Export JSON';
   *     jsonBtn.className = 'dg-toolbar-btn';
   *     jsonBtn.addEventListener('click', () => exportToJSON(grid.rows));
   *
   *     container.append(csvBtn, jsonBtn);
   *   }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Add a dropdown filter to the toolbar
   * grid.registerToolbarContent({
   *   id: 'status-filter',
   *   order: 50,
   *   render: (container) => {
   *     const select = document.createElement('select');
   *     select.innerHTML = `
   *       <option value="">All Statuses</option>
   *       <option value="active">Active</option>
   *       <option value="inactive">Inactive</option>
   *     `;
   *     select.addEventListener('change', (e) => {
   *       const status = (e.target as HTMLSelectElement).value;
   *       applyStatusFilter(status);
   *     });
   *     container.appendChild(select);
   *   }
   * });
   * ```
   */
  registerToolbarContent(content: ToolbarContentDefinition): void {
    this.#shellController.registerToolbarContent(content);
  }

  /**
   * Unregister custom toolbar content.
   *
   * @group Toolbar
   * @param contentId - The ID of the content to remove
   *
   * @example
   * ```typescript
   * // Remove export buttons when switching to read-only mode
   * grid.unregisterToolbarContent('export-buttons');
   * ```
   */
  unregisterToolbarContent(contentId: string): void {
    this.#shellController.unregisterToolbarContent(contentId);
  }

  /** Pending shell refresh - used to batch multiple rapid calls */
  #pendingShellRefresh = false;

  /**
   * Re-parse light DOM shell elements and refresh shell header.
   * Call this after dynamically modifying <tbw-grid-header> children.
   *
   * Multiple calls are batched via microtask to avoid redundant DOM rebuilds
   * when registering multiple tool panels in sequence.
   *
   * @internal Plugin API
   */
  refreshShellHeader(): void {
    // Batch multiple rapid calls into a single microtask
    if (this.#pendingShellRefresh) return;
    this.#pendingShellRefresh = true;

    queueMicrotask(() => {
      this.#pendingShellRefresh = false;
      if (!this.isConnected) return;

      // Re-parse light DOM (header, tool buttons, and tool panels)
      parseLightDomShell(this, this.#shellState);
      parseLightDomToolButtons(this, this.#shellState);
      parseLightDomToolPanels(this, this.#shellState, this.#getToolPanelRendererFactory());

      // Mark sources as changed since shell parsing may have updated state maps
      this.#configManager.markSourcesChanged();

      // Re-merge config to sync shell state changes into effectiveConfig.shell
      this.#configManager.merge();

      // Re-render the entire grid (shell structure may change)
      this.#render();
      this.#injectAllPluginStyles(); // Re-inject after render clears shadow DOM

      // Use lighter-weight post-render setup instead of full #afterConnect()
      // This avoids requesting another FULL render since #render() already rebuilt the DOM
      this.#afterShellRefresh();
    });
  }

  /**
   * Lighter-weight post-render setup after shell refresh.
   * Unlike #afterConnect(), this skips scheduler FULL request since DOM is already built.
   */
  #afterShellRefresh(): void {
    // Shell changes the DOM structure - need to re-cache element references
    const gridContent = this.#renderRoot.querySelector('.tbw-grid-content');
    const gridRoot = gridContent ?? this.#renderRoot.querySelector('.tbw-grid-root');

    this._headerRowEl = gridRoot?.querySelector('.header-row') as HTMLElement;
    this._virtualization.totalHeightEl = gridRoot?.querySelector('.faux-vscroll-spacer') as HTMLElement;
    this._virtualization.viewportEl = gridRoot?.querySelector('.rows-viewport') as HTMLElement;
    this._bodyEl = gridRoot?.querySelector('.rows') as HTMLElement;
    this.__rowsBodyEl = gridRoot?.querySelector('.rows-body') as HTMLElement;

    // Render shell header content and custom toolbar contents
    if (this.#shellController.isInitialized) {
      renderHeaderContent(this.#renderRoot, this.#shellState);
      renderCustomToolbarContents(this.#renderRoot, this.#effectiveConfig?.shell, this.#shellState);

      const defaultOpen = this.#effectiveConfig?.shell?.toolPanel?.defaultOpen;
      if (defaultOpen && this.#shellState.toolPanels.has(defaultOpen)) {
        this.openToolPanel();
        this.#shellState.expandedSections.add(defaultOpen);
      }
    }

    // Re-create resize controller (DOM elements changed)
    this._resizeController = createResizeController(this as unknown as InternalGrid<T>);

    // Re-setup scroll listeners (DOM elements changed)
    this.#setupScrollListeners(gridRoot);

    // Request COLUMNS phase to reprocess columns (including column groups) and render header
    // #render() rebuilds the DOM with an empty header-row, so we need COLUMNS phase (5)
    // which includes processColumns (for column groups), processRows, and renderHeader
    this.#scheduler.requestPhase(RenderPhase.COLUMNS, 'shellRefresh');
  }

  // #region Custom Styles API
  /** Map of registered custom stylesheets by ID - uses adoptedStyleSheets which survive DOM rebuilds */
  #customStyleSheets = new Map<string, CSSStyleSheet>();

  /**
   * Register custom CSS styles to be injected into the grid's shadow DOM.
   * Use this to style custom cell renderers, editors, or detail panels.
   *
   * Uses adoptedStyleSheets for efficiency - styles survive shadow DOM rebuilds.
   *
   * @group Custom Styles
   * @param id - Unique identifier for the style block (for removal/updates)
   * @param css - CSS string to inject
   *
   * @example
   * ```typescript
   * // Register custom styles for a detail panel
   * grid.registerStyles('my-detail-styles', `
   *   .my-detail-panel { padding: 16px; }
   *   .my-detail-table { width: 100%; }
   * `);
   *
   * // Update styles later
   * grid.registerStyles('my-detail-styles', updatedCss);
   *
   * // Remove styles
   * grid.unregisterStyles('my-detail-styles');
   * ```
   */
  registerStyles(id: string, css: string): void {
    // Create or update the stylesheet
    let sheet = this.#customStyleSheets.get(id);
    if (!sheet) {
      sheet = new CSSStyleSheet();
      this.#customStyleSheets.set(id, sheet);
    }
    sheet.replaceSync(css);

    // Update adoptedStyleSheets to include all custom sheets
    this.#updateAdoptedStyleSheets();
  }

  /**
   * Remove previously registered custom styles.
   *
   * @group Custom Styles
   * @param id - The ID used when registering the styles
   */
  unregisterStyles(id: string): void {
    if (this.#customStyleSheets.delete(id)) {
      this.#updateAdoptedStyleSheets();
    }
  }

  /**
   * Get list of registered custom style IDs.
   *
   * @group Custom Styles
   */
  getRegisteredStyles(): string[] {
    return Array.from(this.#customStyleSheets.keys());
  }

  /**
   * Update document.adoptedStyleSheets to include custom sheets.
   * Without Shadow DOM, all custom styles go into the document.
   */
  #updateAdoptedStyleSheets(): void {
    const customSheets = Array.from(this.#customStyleSheets.values());

    // Start with document's existing sheets (excluding any we've added before)
    // We track custom sheets by their presence in our map
    const existingSheets = document.adoptedStyleSheets.filter(
      (sheet) => !Array.from(this.#customStyleSheets.values()).includes(sheet),
    );

    document.adoptedStyleSheets = [...existingSheets, ...customSheets];
  }
  // #endregion

  /**
   * Set up Light DOM handlers via ConfigManager's observer infrastructure.
   * This handles frameworks like Angular that project content asynchronously.
   *
   * The observer is owned by ConfigManager (generic infrastructure).
   * The handlers (parsing logic) are owned here (eventually ShellPlugin).
   *
   * This separation allows plugins to register their own Light DOM elements
   * and handle parsing themselves.
   */
  #setupLightDomHandlers(): void {
    // Handler for shell header element changes
    const handleShellChange = () => {
      const hadTitle = this.#shellState.lightDomTitle;
      const hadToolButtons = this.#shellState.hasToolButtonsContainer;
      parseLightDomShell(this, this.#shellState);
      parseLightDomToolButtons(this, this.#shellState);
      parseLightDomToolPanels(this, this.#shellState, this.#getToolPanelRendererFactory());
      const hasTitle = this.#shellState.lightDomTitle;
      const hasToolButtons = this.#shellState.hasToolButtonsContainer;

      if ((hasTitle && !hadTitle) || (hasToolButtons && !hadToolButtons)) {
        this.#configManager.markSourcesChanged();
        this.#configManager.merge();
        const shellHeader = this.#renderRoot.querySelector('.tbw-shell-header');
        if (shellHeader) {
          const newHeaderHtml = renderShellHeader(
            this.#effectiveConfig.shell,
            this.#shellState,
            this.#effectiveConfig.icons?.toolPanel,
          );
          const temp = document.createElement('div');
          temp.innerHTML = newHeaderHtml;
          const newHeader = temp.firstElementChild;
          if (newHeader) {
            shellHeader.replaceWith(newHeader);
            this.#setupShellListeners();
          }
        }
      }
    };

    // Handler for column element changes
    const handleColumnChange = () => {
      this.__lightDomColumnsCache = undefined;
      this.#setup();
    };

    // Register handlers with ConfigManager
    // Shell-related elements (eventually these move to ShellPlugin)
    this.#configManager.registerLightDomHandler('tbw-grid-header', handleShellChange);
    this.#configManager.registerLightDomHandler('tbw-grid-tool-buttons', handleShellChange);
    this.#configManager.registerLightDomHandler('tbw-grid-tool-panel', handleShellChange);

    // Column elements (core grid functionality)
    this.#configManager.registerLightDomHandler('tbw-grid-column', handleColumnChange);
    this.#configManager.registerLightDomHandler('tbw-grid-detail', handleColumnChange);

    // Start observing
    this.#configManager.observeLightDOM(this as unknown as HTMLElement);
  }

  /**
   * Re-parse light DOM column elements and refresh the grid.
   * Call this after framework adapters have registered their templates.
   * Uses the render scheduler to batch with other pending updates.
   * @category Framework Adapters
   */
  refreshColumns(): void {
    // Clear the column cache to force re-parsing
    this.__lightDomColumnsCache = undefined;

    // Invalidate cell cache to reset __hasSpecialColumns flag
    // This is critical for frameworks like React where renderers are registered asynchronously
    // after the initial render (which may have cached __hasSpecialColumns = false)
    invalidateCellCache(this);

    // Re-parse light DOM columns SYNCHRONOUSLY to pick up newly registered framework renderers
    // This must happen before the scheduler runs processColumns
    this.#configManager.parseLightDomColumns(this as unknown as HTMLElement);

    // Re-parse light DOM shell elements (may have been rendered asynchronously by frameworks)
    const hadTitle = this.#shellState.lightDomTitle;
    const hadToolButtons = this.#shellState.hasToolButtonsContainer;
    parseLightDomShell(this, this.#shellState);
    // Also parse tool buttons container that is a direct child (React/Vue pattern)
    parseLightDomToolButtons(this, this.#shellState);
    parseLightDomToolPanels(this, this.#shellState, this.#getToolPanelRendererFactory());
    const hasTitle = this.#shellState.lightDomTitle;
    const hasToolButtons = this.#shellState.hasToolButtonsContainer;

    // If title or tool buttons were added via light DOM, update the shell header in place
    // The shell may already be rendered (due to plugins/panels), but without the title
    const needsShellRefresh = (hasTitle && !hadTitle) || (hasToolButtons && !hadToolButtons);
    if (needsShellRefresh) {
      // Mark sources as changed since shell parsing may have updated state maps
      this.#configManager.markSourcesChanged();
      // Merge the new title into effectiveConfig
      this.#configManager.merge();
      // Update the existing shell header element with new HTML
      const shellHeader = this.#renderRoot.querySelector('.tbw-shell-header');
      if (shellHeader) {
        const newHeaderHtml = renderShellHeader(
          this.#effectiveConfig.shell,
          this.#shellState,
          this.#effectiveConfig.icons?.toolPanel,
        );
        // Create a temporary container and extract the new header
        const temp = document.createElement('div');
        temp.innerHTML = newHeaderHtml;
        const newHeader = temp.firstElementChild;
        if (newHeader) {
          shellHeader.replaceWith(newHeader);
          // Re-attach event listeners to the new toolbar element
          this.#setupShellListeners();
        }
      }
    }

    // Request a COLUMNS phase render through the scheduler
    // This batches with any other pending work (e.g., afterConnect)
    this.#scheduler.requestPhase(RenderPhase.COLUMNS, 'refreshColumns');
  }
  // #endregion

  // #region Virtualization
  /**
   * Calculate total height for the faux scrollbar spacer element.
   * Used by both bypass and virtualized rendering paths to ensure consistent scroll behavior.
   */
  #calculateTotalSpacerHeight(totalRows: number): number {
    const fauxScrollbar = this._virtualization.container ?? this;
    const viewportEl = this._virtualization.viewportEl ?? fauxScrollbar;
    const fauxScrollHeight = fauxScrollbar.clientHeight;
    const viewportHeight = viewportEl.clientHeight;

    // Get scroll-area height (may differ from faux when h-scrollbar present)
    const shadowRoot = (this as unknown as Element).shadowRoot;
    const scrollAreaEl = shadowRoot?.querySelector('.tbw-scroll-area');
    const scrollAreaHeight = scrollAreaEl ? (scrollAreaEl as HTMLElement).clientHeight : fauxScrollHeight;

    // Use scroll-area height as reference since it contains the actual content
    const containerHeight = scrollAreaHeight;
    const viewportHeightDiff = containerHeight - viewportHeight;

    // Horizontal scrollbar compensation: When a horizontal scrollbar appears inside scroll-area,
    // the faux scrollbar (sibling) is taller than scroll-area. Add the difference as padding.
    const hScrollbarPadding = Math.max(0, fauxScrollHeight - scrollAreaHeight);

    // Calculate row content height - use position cache for variable heights, simple multiplication otherwise
    let rowContentHeight: number;
    let pluginExtraHeight = 0;

    if (this._virtualization.variableHeights && this._virtualization.positionCache) {
      // Variable heights mode: position cache includes heights from getRowHeight() plugin hooks
      // Do NOT add pluginExtraHeight here - it would double-count since getRowHeight() already
      // reports expanded detail heights via the position cache
      rowContentHeight = getTotalHeight(this._virtualization.positionCache);
    } else {
      // Fixed heights mode: use simple multiplication and add plugin extra heights
      // (for plugins using deprecated getExtraHeight() that don't implement getRowHeight())
      rowContentHeight = totalRows * this._virtualization.rowHeight;
      pluginExtraHeight = this.#pluginManager?.getExtraHeight() ?? 0;
    }

    const total = rowContentHeight + viewportHeightDiff + pluginExtraHeight + hScrollbarPadding;
    return total;
  }

  /**
   * Initialize or rebuild the position cache for variable row heights.
   * Called when rows change or variable heights mode is enabled.
   * @internal
   */
  #initializePositionCache(): void {
    if (!this._virtualization.variableHeights) return;

    const rows = this._rows;
    const estimatedHeight = this._virtualization.rowHeight || 28;
    const rowHeightFn = this.#effectiveConfig.rowHeight as ((row: T, index: number) => number | undefined) | undefined;
    const getRowId = this.#effectiveConfig.getRowId;
    const rowIdFn = getRowId ? (row: T) => getRowId(row) : undefined;

    // Build position cache with priority: plugin height > rowHeight function > cached > estimated
    this._virtualization.positionCache = rebuildPositionCache(
      rows,
      this._virtualization.heightCache,
      estimatedHeight,
      { rowId: rowIdFn },
      (row, index) => {
        const pluginHeight = this.#pluginManager?.getRowHeight?.(row, index);
        if (pluginHeight !== undefined) return pluginHeight;
        if (rowHeightFn) {
          const height = rowHeightFn(row, index);
          if (height !== undefined && height > 0) return height;
        }
        return undefined;
      },
    );

    // Compute stats excluding plugin-managed rows
    const stats = computeAverageExcludingPluginRows(
      this._virtualization.positionCache,
      rows,
      estimatedHeight,
      (row, index) => this.#pluginManager?.getRowHeight?.(row, index),
    );
    this._virtualization.measuredCount = stats.measuredCount;
    if (stats.measuredCount > 0) {
      this._virtualization.averageHeight = stats.averageHeight;
    }
  }

  /**
   * Invalidate a row's height in the position cache.
   * Call this when a plugin changes a row's height (e.g., expanding/collapsing a detail panel).
   * Updates the position cache incrementally O(1) + offset recalc O(k) without a full rebuild.
   *
   * @param rowIndex - Index of the row whose height changed
   * @param newHeight - Optional new height. If not provided, queries plugins for height.
   */
  invalidateRowHeight(rowIndex: number, newHeight?: number): void {
    if (!this._virtualization.variableHeights) return;
    if (!this._virtualization.positionCache) return;
    if (rowIndex < 0 || rowIndex >= this._rows.length) return;

    const positionCache = this._virtualization.positionCache;
    const row = this._rows[rowIndex];

    // Determine the new height
    let height = newHeight;
    if (height === undefined) {
      // Query plugin for height
      height = this.#pluginManager?.getRowHeight?.(row, rowIndex);
    }
    if (height === undefined) {
      // Fall back to base row height
      height = this._virtualization.rowHeight;
    }

    const currentEntry = positionCache[rowIndex];
    if (!currentEntry || Math.abs(currentEntry.height - height) < 1) {
      // No significant change
      return;
    }

    // Update position cache incrementally (updates this row + all subsequent offsets)
    updateRowHeight(positionCache, rowIndex, height);

    // Update spacer height
    if (this._virtualization.totalHeightEl) {
      const newTotalHeight = this.#calculateTotalSpacerHeight(this._rows.length);
      this._virtualization.totalHeightEl.style.height = `${newTotalHeight}px`;
    }
  }

  /**
   * Measure rendered row heights and update position cache.
   * Called after rows are rendered to capture actual DOM heights.
   * Only runs when variable heights mode is enabled.
   * @internal
   */
  #measureRenderedRowHeights(start: number, end: number): void {
    if (!this._virtualization.variableHeights) return;
    if (!this._virtualization.positionCache) return;
    if (!this._bodyEl) return;

    const rowElements = this._bodyEl.querySelectorAll('.data-grid-row');
    const getRowId = this.#effectiveConfig.getRowId;

    const result = measureRenderedRowHeights(
      {
        positionCache: this._virtualization.positionCache,
        heightCache: this._virtualization.heightCache,
        rows: this._rows,
        defaultHeight: this._virtualization.rowHeight,
        start,
        end,
        getPluginHeight: (row, index) => this.#pluginManager?.getRowHeight?.(row, index),
        getRowId: getRowId ? (row: T) => getRowId(row) : undefined,
      },
      rowElements,
    );

    if (result.hasChanges) {
      this._virtualization.measuredCount = result.measuredCount;
      this._virtualization.averageHeight = result.averageHeight;

      // Update total height spacer
      if (this._virtualization.totalHeightEl) {
        const newTotalHeight = this.#calculateTotalSpacerHeight(this._rows.length);
        this._virtualization.totalHeightEl.style.height = `${newTotalHeight}px`;
      }
    }
  }

  /**
   * Core virtualization routine. Chooses between bypass (small datasets), grouped window rendering,
   * or standard row window rendering.
   * @param force - Whether to force a full refresh (not just scroll update)
   * @param skipAfterRender - When true, skip calling afterRender (used by scheduler which calls it separately)
   * @internal Plugin API
   */
  refreshVirtualWindow(force = false, skipAfterRender = false): void {
    if (!this._bodyEl) return;

    const totalRows = this._rows.length;

    if (!this._virtualization.enabled) {
      this.#renderVisibleRows(0, totalRows);
      if (!skipAfterRender) {
        this.#pluginManager?.afterRender();
      }
      return;
    }

    if (this._rows.length <= this._virtualization.bypassThreshold) {
      this._virtualization.start = 0;
      this._virtualization.end = totalRows;
      // Only reset transform on force refresh (initial render, data change)
      // Don't reset on scroll-triggered updates - the scroll handler manages transforms
      if (force) {
        this._bodyEl.style.transform = 'translateY(0px)';
      }
      this.#renderVisibleRows(0, totalRows, force ? ++this.__rowRenderEpoch : this.__rowRenderEpoch);
      // Only recalculate height on force refresh (structural changes)
      // Skip on scroll-only updates to prevent scrollbar jumpiness
      if (force && this._virtualization.totalHeightEl) {
        this._virtualization.totalHeightEl.style.height = `${this.#calculateTotalSpacerHeight(totalRows)}px`;
      }
      // Update ARIA counts on the grid container
      this.#updateAriaCounts(totalRows, this._visibleColumns.length);
      if (!skipAfterRender) {
        this.#pluginManager?.afterRender();
      }
      return;
    }

    // --- Normal virtualization path with faux scrollbar pattern ---
    // Faux scrollbar provides scrollTop, viewport provides visible height
    const fauxScrollbar = this._virtualization.container ?? this;
    const viewportEl = this._virtualization.viewportEl ?? fauxScrollbar;
    const viewportHeight = viewportEl.clientHeight;
    const rowHeight = this._virtualization.rowHeight;
    const scrollTop = fauxScrollbar.scrollTop;

    let start: number;
    const positionCache = this._virtualization.positionCache;

    // Variable row heights: use binary search on position cache
    if (this._virtualization.variableHeights && positionCache && positionCache.length > 0) {
      start = getRowIndexAtOffset(positionCache, scrollTop);
      if (start === -1) start = 0;
    } else {
      // Uniform row heights: simple division
      // When plugins add extra height (e.g., expanded details), the scroll position
      // includes that extra height. We need to find the actual row at scrollTop
      // by iteratively accounting for cumulative extra heights.
      // This prevents jumping when scrolling past expanded content.
      start = Math.floor(scrollTop / rowHeight);

      // Iteratively refine: the initial guess may be too high because scrollTop
      // includes extra heights from expanded rows before it. Adjust downward.
      let iterations = 0;
      const maxIterations = 10; // Prevent infinite loop
      while (iterations < maxIterations) {
        const extraHeightBefore = this.#pluginManager?.getExtraHeightBefore?.(start) ?? 0;
        const adjustedStart = Math.floor((scrollTop - extraHeightBefore) / rowHeight);
        if (adjustedStart >= start || adjustedStart < 0) break;
        start = adjustedStart;
        iterations++;
      }
    }

    // Faux scrollbar pattern: calculate effective position for this start
    // With translateY(0), the first rendered row appears at viewport top
    // Round down to even number so DOM nth-child(even) always matches data row parity
    // This prevents zebra stripe flickering during scroll since rows shift in pairs
    start = start - (start % 2);
    if (start < 0) start = 0;

    // Allow plugins to extend the start index backwards
    // (e.g., to keep expanded detail rows visible as they scroll out)
    const pluginAdjustedStart = this.#pluginManager?.adjustVirtualStart(start, scrollTop, rowHeight);
    if (pluginAdjustedStart !== undefined && pluginAdjustedStart < start) {
      start = pluginAdjustedStart;
      // Re-apply even alignment after plugin adjustment
      start = start - (start % 2);
      if (start < 0) start = 0;
    }

    // Faux pattern buffer: render enough rows to fill viewport + overscan
    // For variable heights, calculate based on actual heights from position cache
    // This ensures expanded detail rows don't cause blank space at bottom
    let end: number;

    if (this._virtualization.variableHeights && positionCache && positionCache.length > 0) {
      // Variable heights: walk forward from start, summing actual heights
      // until we've covered the viewport height plus some overscan
      const targetHeight = viewportHeight + rowHeight * 3; // 3 rows overscan
      let accumulatedHeight = 0;
      end = start;

      while (end < totalRows && accumulatedHeight < targetHeight) {
        accumulatedHeight += positionCache[end].height;
        end++;
      }

      // Ensure we always have at least a few rows for edge cases
      const minRows = Math.ceil(viewportHeight / rowHeight) + 3;
      if (end - start < minRows) {
        end = Math.min(start + minRows, totalRows);
      }
    } else {
      // Fixed heights: simple calculation
      const visibleCount = Math.ceil(viewportHeight / rowHeight) + 3;
      end = start + visibleCount;
    }

    if (end > totalRows) end = totalRows;

    this._virtualization.start = start;
    this._virtualization.end = end;

    // Height spacer for scrollbar
    // The faux-vscroll is a sibling of .tbw-scroll-area, so it doesn't shrink when
    // elements inside scroll-area (header, column groups, footer, hScrollbar) take vertical space.
    // viewportHeightDiff captures ALL these differences - no extra buffer needed.
    const fauxScrollHeight = fauxScrollbar.clientHeight;

    // Guard: Skip height calculation if faux scrollbar has no height but viewport does
    // This indicates stale DOM references during recreation (e.g., shell toggle)
    // When both are 0 (test environment or not in DOM), proceed normally
    if (fauxScrollHeight === 0 && viewportHeight > 0) {
      // Stale refs detected, schedule retry through the scheduler
      // Using scheduler ensures this batches with other pending work
      this.#scheduler.requestPhase(RenderPhase.VIRTUALIZATION, 'stale-refs-retry');
      return;
    }

    // Only recalculate height on force refresh (structural changes like data/plugin changes)
    // Skip on scroll-only updates to prevent scrollbar jumpiness from repeated DOM reads
    if (force && this._virtualization.totalHeightEl) {
      const totalHeight = this.#calculateTotalSpacerHeight(totalRows);
      this._virtualization.totalHeightEl.style.height = `${totalHeight}px`;
    }

    // Smooth scroll: apply offset for fluid motion
    // Since start is even-aligned, offset is distance from that aligned position
    // This creates smooth sliding while preserving zebra stripe parity
    //
    // Get actual offset for the start row:
    // - Variable heights mode: use position cache offset (already includes heights from getRowHeight())
    // - Fixed heights mode: use simple multiplication + extraHeightBefore for deprecated hooks
    let startRowOffset: number;
    if (this._virtualization.variableHeights && positionCache && positionCache[start]) {
      // Position cache offset already accounts for variable heights via getRowHeight()
      // Do NOT add extraHeightBefore - it would double-count
      startRowOffset = positionCache[start].offset;
    } else {
      // Fixed heights mode: add extra heights from deprecated hooks
      const extraHeightBeforeStart = this.#pluginManager?.getExtraHeightBefore?.(start) ?? 0;
      startRowOffset = start * rowHeight + extraHeightBeforeStart;
    }

    const subPixelOffset = -(scrollTop - startRowOffset);
    this._bodyEl.style.transform = `translateY(${subPixelOffset}px)`;

    this.#renderVisibleRows(start, end, force ? ++this.__rowRenderEpoch : this.__rowRenderEpoch);

    // Measure rendered row heights for variable height mode
    // Only on force refresh to avoid hot path overhead during scroll
    if (force && this._virtualization.variableHeights) {
      this.#measureRenderedRowHeights(start, end);
    }

    // Update ARIA counts on the grid container
    this.#updateAriaCounts(totalRows, this._visibleColumns.length);

    // Only run plugin afterRender hooks on force refresh (structural changes)
    // Skip on scroll-triggered renders for maximum performance
    if (force && !skipAfterRender) {
      this.#pluginManager?.afterRender();

      // After plugins modify the DOM (e.g., add footer, column groups),
      // heights may have changed. Recalculate spacer height in a microtask
      // to catch these changes before the next paint.
      queueMicrotask(() => {
        const newFauxHeight = fauxScrollbar.clientHeight;
        const newViewportHeight = viewportEl.clientHeight;
        // Skip if faux scrollbar is stale (0 height but viewport has height)
        if (newFauxHeight === 0 && newViewportHeight > 0) return;

        // Recalculate using the shared helper
        const newTotalHeight = this.#calculateTotalSpacerHeight(totalRows);

        if (this._virtualization.totalHeightEl) {
          this._virtualization.totalHeightEl.style.height = `${newTotalHeight}px`;
        }
      });
    }
  }
  // #endregion

  // #region Render
  #render(): void {
    // Parse light DOM shell elements before rendering
    parseLightDomShell(this, this.#shellState);
    parseLightDomToolButtons(this, this.#shellState);
    parseLightDomToolPanels(this, this.#shellState, this.#getToolPanelRendererFactory());

    // Mark sources as changed since shell parsing may have updated state maps
    this.#configManager.markSourcesChanged();

    // Re-merge config to pick up any newly parsed light DOM shell settings
    this.#configManager.merge();

    const shellConfig = this.#effectiveConfig?.shell;

    // Render using direct DOM construction (2-3x faster than innerHTML)
    // Pass only minimal runtime state (isPanelOpen, expandedSections) - config comes from effectiveConfig.shell
    const hasShell = buildGridDOMIntoElement(
      this.#renderRoot,
      shellConfig,
      { isPanelOpen: this.#shellState.isPanelOpen, expandedSections: this.#shellState.expandedSections },
      this.#effectiveConfig?.icons,
    );

    if (hasShell) {
      this.#setupShellListeners();
      this.#shellController.setInitialized(true);
    }
  }

  /**
   * Set up shell event listeners after render.
   */
  #setupShellListeners(): void {
    setupShellEventListeners(this.#renderRoot, this.#effectiveConfig?.shell, this.#shellState, {
      onPanelToggle: () => this.toggleToolPanel(),
      onSectionToggle: (sectionId: string) => this.toggleToolPanelSection(sectionId),
    });

    // Set up tool panel resize
    this.#resizeCleanup?.();
    this.#resizeCleanup = setupToolPanelResize(this.#renderRoot, this.#effectiveConfig?.shell, (width: number) => {
      // Update the CSS variable to persist the new width
      this.style.setProperty('--tbw-tool-panel-width', `${width}px`);
    });
  }
  // #endregion
}

// Self-registering custom element
if (!customElements.get(DataGridElement.tagName)) {
  customElements.define(DataGridElement.tagName, DataGridElement);
}

// Make DataGridElement accessible globally for framework adapters
(globalThis as unknown as { DataGridElement: typeof DataGridElement }).DataGridElement = DataGridElement;

// Type augmentation for querySelector/createElement
declare global {
  interface HTMLElementTagNameMap {
    'tbw-grid': DataGridElement;
  }
}
