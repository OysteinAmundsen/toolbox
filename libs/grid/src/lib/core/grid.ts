import styles from './grid.css?inline';
import { autoSizeColumns, updateTemplate } from './internal/columns';
import { ConfigManager } from './internal/config-manager';
import { setupCellEventDelegation, setupRootEventDelegation } from './internal/event-delegation';
import { renderHeader } from './internal/header';
import { cancelIdle, scheduleIdle } from './internal/idle-scheduler';
import { ensureCellVisible } from './internal/keyboard';
import { RenderPhase, RenderScheduler } from './internal/render-scheduler';
import { createResizeController } from './internal/resize';
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
import {
  cancelMomentum,
  createTouchScrollState,
  setupTouchScrollListeners,
  type TouchScrollState,
} from './internal/touch-scroll';
import { validatePluginProperties } from './internal/validate-config';
import type { CellMouseEvent, ScrollEvent } from './plugin';
import type {
  BaseGridPlugin,
  CellClickEvent,
  HeaderClickEvent,
  PluginQuery,
  RowClickEvent,
} from './plugin/base-plugin';
import { PluginManager } from './plugin/plugin-manager';
import type {
  AnimationConfig,
  ColumnConfig,
  ColumnConfigMap,
  ColumnInternal,
  FitMode,
  FrameworkAdapter,
  GridColumnState,
  GridConfig,
  HeaderContentDefinition,
  InternalGrid,
  ResizeController,
  ToolbarButtonConfig,
  ToolbarButtonInfo,
  ToolbarContentDefinition,
  ToolPanelDefinition,
  VirtualState,
} from './types';
import { DEFAULT_ANIMATION_CONFIG, DEFAULT_GRID_ICONS } from './types';

/**
 * High-performance data grid web component.
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
 * 5. `editOn` property → merged into `effectiveConfig.editOn`
 * 6. Column inference from first row (if no columns defined)
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
 * @fires cell-commit - Fired when a cell value is committed
 * @fires row-commit - Fired when a bulk row edit session commits
 * @fires changed-rows-reset - Fired after resetChangedRows() unless silent
 * @fires mount-external-view - Fired to request mounting of an external view renderer
 * @fires mount-external-editor - Fired to request mounting of an external editor renderer
 * @fires sort-change - Fired when sort state changes for a column
 * @fires column-resize - Fired after a column resize drag completes
 * @fires activate-cell - Fired when a cell activation intent occurs
 * @fires group-toggle - Fired when a group row is toggled
 *
 * @cssprop --tbw-color-bg - Background color
 * @cssprop --tbw-color-fg - Foreground/text color
 */
// Injected by Vite at build time from package.json
declare const __GRID_VERSION__: string;

export class DataGridElement<T = any> extends HTMLElement implements InternalGrid<T> {
  // TODO: Rename to 'data-grid' when migration is complete
  static readonly tagName = 'tbw-grid';
  static readonly version = typeof __GRID_VERSION__ !== 'undefined' ? __GRID_VERSION__ : 'dev';

  // ---------------- Framework Adapters ----------------
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
   */
  static registerAdapter(adapter: FrameworkAdapter): void {
    this.adapters.push(adapter);
  }

  /**
   * Get all registered framework adapters.
   * Used internally by light DOM parsing to find adapters that can handle templates.
   */
  static getAdapters(): readonly FrameworkAdapter[] {
    return this.adapters;
  }

  /**
   * Clear all registered adapters (primarily for testing).
   */
  static clearAdapters(): void {
    this.adapters = [];
  }

  // ---------------- Observed Attributes ----------------
  static get observedAttributes(): string[] {
    return ['rows', 'columns', 'grid-config', 'fit-mode', 'edit-on'];
  }

  /**
   * The render root for the grid. Without Shadow DOM, this is the element itself.
   * This abstraction allows internal code to work the same way regardless of DOM mode.
   */
  get #renderRoot(): HTMLElement {
    return this;
  }

  /**
   * Access the grid's ShadowRoot.
   *
   * Note: The grid renders into its light DOM and does not attach a shadow root,
   * so this getter returns `null`. Use `grid.querySelector()` directly for DOM queries.
   *
   * @deprecated This property returns `null` since Shadow DOM was removed.
   *             Use `grid.querySelector()` or `grid.querySelectorAll()` directly.
   * @returns null (no shadow root is attached)
   */
  override get shadowRoot(): ShadowRoot | null {
    return super.shadowRoot;
  }

  #initialized = false;

  // ---------------- Ready Promise ----------------
  #readyPromise: Promise<void>;
  #readyResolve?: () => void;

  // #region Input Properties
  // Raw rows are stored here. Config sources (gridConfig, columns, fitMode, editOn)
  // are owned by ConfigManager. Grid.ts property setters delegate to ConfigManager.
  #rows: T[] = [];
  // #endregion

  // #region Private properties
  // effectiveConfig is owned by ConfigManager - access via getter
  get #effectiveConfig(): GridConfig<T> {
    return this.#configManager?.effective ?? {};
  }

  #connected = false;

  // ---------------- Batched Updates ----------------
  // When multiple properties are set in rapid succession (within same microtask),
  // we batch them into a single update to avoid redundant re-renders.
  #pendingUpdate = false;
  #pendingUpdateFlags = {
    rows: false,
    columns: false,
    gridConfig: false,
    fitMode: false,
    editMode: false,
  };

  // ---------------- Render Scheduler ----------------
  // Centralizes all rendering through a single RAF-based pipeline
  #scheduler!: RenderScheduler;

  #scrollRaf = 0;
  #pendingScrollTop: number | null = null;
  #hasScrollPlugins = false; // Cached flag for plugin scroll handlers
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

  // ---------------- Plugin System ----------------
  #pluginManager!: PluginManager;
  #lastPluginsArray?: BaseGridPlugin[]; // Track last attached plugins to avoid unnecessary re-initialization

  // ---------------- Event Listeners ----------------
  #eventListenersAdded = false; // Guard against adding duplicate component-level listeners
  #scrollAbortController?: AbortController; // Separate controller for DOM scroll listeners (recreated on DOM changes)

  // ---------------- Column State ----------------
  #initialColumnState?: GridColumnState;

  // ---------------- Config Manager ----------------
  #configManager!: ConfigManager<T>;

  // ---------------- Shell State ----------------
  #shellState: ShellState = createShellState();
  #shellController!: ShellController;
  #resizeCleanup?: () => void;
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
   * Get the original unfiltered/unprocessed rows.
   * Use this when you need access to all source data regardless of active filters.
   */
  get sourceRows(): T[] {
    return this.#rows;
  }

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

  get editOn(): string | boolean | undefined {
    return this.#effectiveConfig.editOn;
  }
  set editOn(value: string | boolean | undefined) {
    const oldValue = this.#configManager?.getEditOn();
    this.#configManager?.setEditOn(value);
    if (oldValue !== value) {
      this.#queueUpdate('editMode');
    }
  }

  /**
   * Effective config accessor for internal modules and plugins.
   * Returns the merged config (single source of truth) before plugin processing.
   * Use this when you need the raw merged config (e.g., for column definitions including hidden).
   * @internal Plugin API
   */
  get effectiveConfig(): GridConfig<T> {
    return this.#effectiveConfig;
  }

  /**
   * Get the disconnect signal for event listener cleanup.
   * This signal is aborted when the grid disconnects from the DOM.
   * Plugins and internal code can use this for automatic listener cleanup.
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
        // Store base columns before plugin transformation
        this.#baseColumns = [...this._columns];
      },
      processColumns: () => this.#processColumns(),
      processRows: () => this.#rebuildRowModel(),
      renderHeader: () => renderHeader(this),
      updateTemplate: () => updateTemplate(this),
      renderVirtualWindow: () => this.refreshVirtualWindow(true),
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

  /** ID for the consolidated grid stylesheet in document.head */
  static readonly #STYLE_ELEMENT_ID = 'tbw-grid-styles';

  /** Track injected base styles CSS text */
  static #baseStyles = '';

  /** Track injected plugin styles by plugin name (accumulates across all grid instances) */
  static #pluginStylesMap = new Map<string, string>();

  /**
   * Get or create the consolidated style element in document.head.
   * All grid and plugin styles are combined into this single element.
   */
  static #getStyleElement(): HTMLStyleElement {
    let styleEl = document.getElementById(this.#STYLE_ELEMENT_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = this.#STYLE_ELEMENT_ID;
      styleEl.setAttribute('data-tbw-grid', 'true');
      document.head.appendChild(styleEl);
    }
    return styleEl;
  }

  /**
   * Update the consolidated stylesheet with current base + plugin styles.
   */
  static #updateStyleElement(): void {
    const styleEl = this.#getStyleElement();
    // Combine base styles and all accumulated plugin styles
    const pluginStyles = Array.from(this.#pluginStylesMap.values()).join('\n');
    styleEl.textContent = `${this.#baseStyles}\n\n/* Plugin Styles */\n${pluginStyles}`;
  }

  /**
   * Inject grid styles into the document.
   * All styles go into a single <style id="tbw-grid-styles"> element in document.head.
   * Uses a singleton pattern to avoid duplicate injection across multiple grid instances.
   */
  async #injectStyles(): Promise<void> {
    // If base styles already injected, nothing to do
    if (DataGridElement.#baseStyles) {
      return;
    }

    // If styles is a string (from ?inline import in Vite builds), use it directly
    if (typeof styles === 'string' && styles.length > 0) {
      DataGridElement.#baseStyles = styles;
      DataGridElement.#updateStyleElement();
      return;
    }

    // Fallback: styles is undefined (e.g., when imported in Angular from source without Vite processing)
    // Angular includes grid.css in global styles - extract it from document.styleSheets
    // Wait a bit for Angular to finish loading styles
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      let gridCssText = '';

      // Try to find the stylesheet containing grid CSS
      // Angular bundles all CSS files from angular.json styles array into one stylesheet
      // We need to find the stylesheet with grid CSS and extract ALL of it (including plugin CSS)
      for (const stylesheet of Array.from(document.styleSheets)) {
        try {
          // For inline/bundled stylesheets, check if it contains grid CSS
          const rules = Array.from(stylesheet.cssRules || []);
          const cssText = rules.map((rule) => rule.cssText).join('\n');

          // Check if this stylesheet contains grid CSS by looking for distinctive selectors
          // Without Shadow DOM, we look for tbw-grid nesting selectors
          if (cssText.includes('.tbw-grid-root') && cssText.includes('tbw-grid')) {
            // Found the bundled stylesheet with grid CSS - use ALL of it
            // This includes core grid.css + all plugin CSS files
            gridCssText = cssText;
            break;
          }
        } catch (e) {
          // CORS or access restriction - skip
          continue;
        }
      }

      if (gridCssText) {
        DataGridElement.#baseStyles = gridCssText;
        DataGridElement.#updateStyleElement();
      } else if (typeof process === 'undefined' || process.env?.['NODE_ENV'] !== 'test') {
        // Only warn in non-test environments - test environments (happy-dom, jsdom) don't load stylesheets
        console.warn(
          '[tbw-grid] Could not find grid.css in document.styleSheets. Grid styling will not work.',
          'Available stylesheets:',
          Array.from(document.styleSheets).map((s) => s.href || '(inline)'),
        );
      }
    } catch (err) {
      console.warn('[tbw-grid] Failed to extract grid.css from document stylesheets:', err);
    }
  }

  // ---------------- Plugin System ----------------

  /**
   * Get a plugin instance by its class.
   * Used by plugins for inter-plugin communication.
   * @internal Plugin API
   */
  getPlugin<P extends BaseGridPlugin>(PluginClass: new (...args: any[]) => P): P | undefined {
    return this.#pluginManager?.getPlugin(PluginClass);
  }

  /**
   * Get a plugin instance by its name.
   * Used for loose coupling between plugins (avoids static imports).
   * @internal Plugin API
   */
  getPluginByName(name: string): BaseGridPlugin | undefined {
    return this.#pluginManager?.getPluginByName(name);
  }

  /**
   * Request a full re-render of the grid.
   * Called by plugins when they need the grid to update.
   * Note: This does NOT reset plugin state - just re-processes rows/columns and renders.
   * @internal Plugin API
   */
  requestRender(): void {
    this.#scheduler.requestPhase(RenderPhase.ROWS, 'plugin:requestRender');
  }

  /**
   * Request a full re-render and restore focus styling afterward.
   * Use this when a plugin action (like expand/collapse) triggers a render
   * but needs to maintain keyboard navigation focus.
   * @internal Plugin API
   */
  requestRenderWithFocus(): void {
    this._restoreFocusAfterRender = true;
    this.#scheduler.requestPhase(RenderPhase.ROWS, 'plugin:requestRenderWithFocus');
  }

  /**
   * Update the grid's column template CSS.
   * Called by resize controller during column resize operations.
   * @internal
   */
  updateTemplate(): void {
    updateTemplate(this);
  }

  /**
   * Request a lightweight style update without rebuilding DOM.
   * Called by plugins when they only need to update CSS classes/styles.
   * This runs all plugin afterRender hooks without rebuilding row/column DOM.
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
    let hasNewStyles = false;

    for (const { name, styles } of pluginStyles) {
      if (!DataGridElement.#pluginStylesMap.has(name)) {
        DataGridElement.#pluginStylesMap.set(name, styles);
        hasNewStyles = true;
      }
    }

    if (hasNewStyles) {
      DataGridElement.#updateStyleElement();
    }
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

  // ---------------- Lifecycle ----------------
  connectedCallback(): void {
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    if (!this.hasAttribute('version')) this.setAttribute('version', DataGridElement.version);
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

  disconnectedCallback(): void {
    // Cancel any pending idle work
    if (this.#idleCallbackHandle) {
      cancelIdle(this.#idleCallbackHandle);
      this.#idleCallbackHandle = undefined;
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
   */
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
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
    } else if (name === 'edit-on') {
      this.editOn = newValue;
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
    if (userRowHeight && userRowHeight > 0) {
      this._virtualization.rowHeight = userRowHeight;
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
    if (measuredHeight > 0 && measuredHeight !== this._virtualization.rowHeight) {
      this._virtualization.rowHeight = measuredHeight;
      // Use scheduler to batch with other pending work
      this.#scheduler.requestPhase(RenderPhase.VIRTUALIZATION, 'measureRowHeight');
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

      // Forward wheel events from content area to faux scrollbar
      // Without this, mouse wheel over content wouldn't scroll
      // Listen on .tbw-grid-content to capture wheel events from entire grid area
      // Note: gridRoot may already BE .tbw-grid-content when shell is active, so search from shadow root
      const gridContentEl = this.#renderRoot.querySelector('.tbw-grid-content') as HTMLElement;
      const scrollArea = this.#renderRoot.querySelector('.tbw-scroll-area') as HTMLElement;
      if (gridContentEl) {
        gridContentEl.addEventListener(
          'wheel',
          (e: WheelEvent) => {
            // SHIFT+wheel or trackpad deltaX = horizontal scroll
            const isHorizontal = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);

            if (isHorizontal && scrollArea) {
              const delta = e.shiftKey ? e.deltaY : e.deltaX;
              const { scrollLeft, scrollWidth, clientWidth } = scrollArea;
              const canScroll = (delta > 0 && scrollLeft < scrollWidth - clientWidth) || (delta < 0 && scrollLeft > 0);
              if (canScroll) {
                e.preventDefault();
                scrollArea.scrollLeft += delta;
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
        setupTouchScrollListeners(gridContentEl, this.#touchState, { fauxScrollbar, scrollArea }, scrollSignal);
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
        this.#scheduler.requestPhase(RenderPhase.VIRTUALIZATION, 'resize-observer');
      });
      this.#resizeObserver.observe(this._virtualization.viewportEl);
    }

    if (this._virtualization.enabled) {
      // Schedule initial virtualization through scheduler
      this.#scheduler.requestPhase(RenderPhase.VIRTUALIZATION, 'init-virtualization');
      // Row height observer is set up in afterRender callback when rows are in DOM
    }

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
    this.#rowHeightObserver = new ResizeObserver(() => {
      this.#measureRowHeight();
    });
    this.#rowHeightObserver.observe(firstRow);

    // Measure row height after a paint cycle to ensure custom renderers have fully rendered.
    // ResizeObserver only fires on size changes, not initial size, and custom renderers
    // may not have painted their content yet when this function is first called.
    requestAnimationFrame(() => {
      this.#measureRowHeight();
    });
  }

  // ---------------- Event Emitters ----------------
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

  // ---------------- Batched Update System ----------------
  // Allows multiple property changes within the same microtask to be coalesced
  // into a single update cycle, dramatically reducing redundant renders.

  /**
   * Queue an update for a specific property type.
   * All updates queued within the same microtask are batched together.
   */
  #queueUpdate(type: 'rows' | 'columns' | 'gridConfig' | 'fitMode' | 'editMode'): void {
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
      editMode: false,
    };

    // If gridConfig changed, it supersedes columns/rows/fit/edit changes
    // because gridConfig includes all of those
    if (flags.gridConfig) {
      this.#applyGridConfigUpdate();
      return; // gridConfig handles everything
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
    if (flags.editMode) {
      this.#applyEditModeUpdate();
    }
  }

  // Individual update applicators - these do the actual work
  #applyRowsUpdate(): void {
    this._rows = Array.isArray(this.#rows) ? [...this.#rows] : [];
    // Request a ROWS phase render through the scheduler.
    // This batches with any other pending work (e.g., React adapter's refreshColumns).
    this.#scheduler.requestPhase(RenderPhase.ROWS, 'applyRowsUpdate');
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

  #applyEditModeUpdate(): void {
    this.#configManager.merge();
    this._rowPool.length = 0;
    if (this._bodyEl) this._bodyEl.innerHTML = '';
    this.__rowRenderEpoch++;
    // Request render through scheduler to batch with other pending work
    this.#scheduler.requestPhase(RenderPhase.VIRTUALIZATION, 'applyEditModeUpdate');
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
      return;
    }

    // Update shell header in place if it exists (e.g., title changed)
    // This avoids a full re-render when only shell config changed
    if (hadShell) {
      this.#updateShellHeaderInPlace();
    }

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
        // Build sets for quick lookup
        const sourceFields = new Set(visibleCols.map((c) => c.field));
        const processedFields = new Set(processedColumns.map((c: any) => c.field));

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

    // Let plugins process rows (they may add, remove, or transform rows)
    // Plugins can add markers for specialized rendering via the renderRow hook
    const processedRows = this.#pluginManager?.processRows(originalRows) ?? originalRows;

    // Store processed rows for rendering
    // Note: processedRows may contain group markers that plugins handle via renderRow hook
    this._rows = processedRows as T[];
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

  // ---------------- Delegate Wrappers ----------------
  #renderVisibleRows(start: number, end: number, epoch = this.__rowRenderEpoch): void {
    // Use cached hook to avoid creating closures on every render (hot path optimization)
    if (!this.#renderRowHook) {
      this.#renderRowHook = (row: any, rowEl: HTMLElement, rowIndex: number): boolean => {
        return this.#pluginManager?.renderRow(row, rowEl, rowIndex) ?? false;
      };
    }
    renderVisibleRows(this as unknown as InternalGrid<T>, start, end, epoch, this.#renderRowHook);
  }

  // Cache for ARIA counts to avoid redundant DOM writes on scroll (hot path)
  #lastAriaRowCount = -1;
  #lastAriaColCount = -1;

  /**
   * Updates ARIA row/col counts on the grid container.
   * Also sets role="rowgroup" on .rows container only when there are rows.
   * Uses caching to avoid redundant DOM writes on every scroll frame.
   */
  #updateAriaCounts(rowCount: number, colCount: number): void {
    // Skip if nothing changed (hot path optimization for scroll)
    if (rowCount === this.#lastAriaRowCount && colCount === this.#lastAriaColCount) {
      return;
    }
    const prevRowCount = this.#lastAriaRowCount;
    this.#lastAriaRowCount = rowCount;
    this.#lastAriaColCount = colCount;

    // Update ARIA counts on inner grid element
    if (this.__rowsBodyEl) {
      this.__rowsBodyEl.setAttribute('aria-rowcount', String(rowCount));
      this.__rowsBodyEl.setAttribute('aria-colcount', String(colCount));
    }

    // Set role="rowgroup" on .rows only when there are rows (ARIA compliance)
    if (rowCount !== prevRowCount && this._bodyEl) {
      if (rowCount > 0) {
        this._bodyEl.setAttribute('role', 'rowgroup');
      } else {
        this._bodyEl.removeAttribute('role');
      }
    }
  }

  // ---------------- Core Helpers ----------------
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

    // Dispatch to plugins (using cached flag and pooled event object to avoid GC)
    if (this.#hasScrollPlugins) {
      const fauxScrollbar = this._virtualization.container;
      // Reuse pooled event object - update values in-place instead of allocating new object
      const scrollEvent = this.#pooledScrollEvent;
      scrollEvent.scrollTop = scrollTop;
      scrollEvent.scrollLeft = fauxScrollbar?.scrollLeft ?? 0;
      scrollEvent.scrollHeight = fauxScrollbar?.scrollHeight ?? 0;
      scrollEvent.scrollWidth = fauxScrollbar?.scrollWidth ?? 0;
      scrollEvent.clientHeight = fauxScrollbar?.clientHeight ?? 0;
      scrollEvent.clientWidth = fauxScrollbar?.clientWidth ?? 0;
      // Note: originalEvent removed to avoid allocation - plugins should not rely on it
      this.#pluginManager?.onScroll(scrollEvent);
    }
  }

  /**
   * Find the header row element in the shadow DOM.
   * Used by plugins that need to access header cells for styling or measurement.
   * @internal Plugin API
   */
  findHeaderRow(): HTMLElement {
    return this.#renderRoot.querySelector('.header-row') as HTMLElement;
  }

  /**
   * Find a rendered row element by its data row index.
   * Returns null if the row is not currently rendered (virtualized out of view).
   * Used by plugins that need to access specific row elements for styling or measurement.
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
   * Dispatch a cell click event to the plugin system.
   * Returns true if any plugin handled the event.
   */
  _dispatchCellClick(event: MouseEvent, rowIndex: number, colIndex: number, cellEl: HTMLElement): boolean {
    const row = this._rows[rowIndex];
    const col = this._columns[colIndex];
    if (!row || !col) return false;

    const cellClickEvent: CellClickEvent = {
      row,
      rowIndex,
      colIndex,
      field: col.field,
      value: (row as Record<string, unknown>)[col.field],
      cellEl,
      originalEvent: event,
    };

    return this.#pluginManager?.onCellClick(cellClickEvent) ?? false;
  }

  /**
   * Dispatch a row click event to the plugin system.
   * Returns true if any plugin handled the event.
   */
  _dispatchRowClick(event: MouseEvent, rowIndex: number, row: any, rowEl: HTMLElement): boolean {
    if (!row) return false;

    const rowClickEvent: RowClickEvent = {
      rowIndex,
      row,
      rowEl,
      originalEvent: event,
    };

    return this.#pluginManager?.onRowClick(rowClickEvent) ?? false;
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
   * @internal Plugin API
   *
   * @example
   * // Check if any plugin vetoes moving a column
   * const responses = grid.queryPlugins<boolean>({ type: PLUGIN_QUERIES.CAN_MOVE_COLUMN, context: column });
   * const canMove = !responses.includes(false);
   */
  queryPlugins<T>(query: PluginQuery): T[] {
    return this.#pluginManager?.queryPlugins<T>(query) ?? [];
  }

  /**
   * Dispatch cell mouse events for drag operations.
   * Returns true if any plugin started a drag.
   * @internal Plugin API - called by event-delegation.ts
   */
  _dispatchCellMouseDown(event: CellMouseEvent): boolean {
    return this.#pluginManager?.onCellMouseDown(event) ?? false;
  }

  /**
   * Dispatch cell mouse move during drag.
   * @internal Plugin API - called by event-delegation.ts
   */
  _dispatchCellMouseMove(event: CellMouseEvent): void {
    this.#pluginManager?.onCellMouseMove(event);
  }

  /**
   * Dispatch cell mouse up to end drag.
   * @internal Plugin API - called by event-delegation.ts
   */
  _dispatchCellMouseUp(event: CellMouseEvent): void {
    this.#pluginManager?.onCellMouseUp(event);
  }

  async ready(): Promise<void> {
    return this.#readyPromise;
  }

  async forceLayout(): Promise<void> {
    // Request a full render cycle through the scheduler
    this.#scheduler.requestPhase(RenderPhase.FULL, 'forceLayout');
    // Wait for the render cycle to complete
    return this.#scheduler.whenReady();
  }

  /**
   * Trim the internal row pool to match the current visible window size.
   *
   * The grid maintains a pool of reusable row DOM elements for virtualization.
   * When the dataset shrinks significantly (e.g., after filtering or deleting rows),
   * the pool may have excess elements that consume memory unnecessarily.
   *
  /** Public method: returns a frozen snapshot of the merged effective configuration */
  async getConfig(): Promise<Readonly<GridConfig<T>>> {
    return Object.freeze({ ...(this.#effectiveConfig || {}) });
  }

  // ---------------- Column Visibility API ----------------
  // Delegates to ConfigManager

  setColumnVisible(field: string, visible: boolean): boolean {
    const result = this.#configManager.setColumnVisible(field, visible);
    if (result) {
      this.requestStateChange();
    }
    return result;
  }

  toggleColumnVisibility(field: string): boolean {
    const result = this.#configManager.toggleColumnVisibility(field);
    if (result) {
      this.requestStateChange();
    }
    return result;
  }

  isColumnVisible(field: string): boolean {
    return this.#configManager.isColumnVisible(field);
  }

  showAllColumns(): void {
    this.#configManager.showAllColumns();
    this.requestStateChange();
  }

  getAllColumns(): Array<{
    field: string;
    header: string;
    visible: boolean;
    lockVisible?: boolean;
    utility?: boolean;
  }> {
    return this.#configManager.getAllColumns();
  }

  setColumnOrder(order: string[]): void {
    this.#configManager.setColumnOrder(order);
    this.requestStateChange();
  }

  getColumnOrder(): string[] {
    return this.#configManager.getColumnOrder();
  }

  // ---------------- Column State API ----------------

  /**
   * Get the current column state, including order, width, visibility, sort, and plugin state.
   * Returns a serializable object suitable for localStorage or database storage.
   */
  getColumnState(): GridColumnState {
    const plugins = this.#pluginManager?.getAll() ?? [];
    return this.#configManager.collectState(plugins as BaseGridPlugin[]);
  }

  /**
   * Set the column state, restoring order, width, visibility, sort, and plugin state.
   * Use this to restore previously saved column state.
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
   * @internal Plugin API
   */
  requestStateChange(): void {
    const plugins = (this.#pluginManager?.getAll() ?? []) as BaseGridPlugin[];
    this.#configManager.requestStateChange(plugins);
  }

  /**
   * Reset column state to initial configuration.
   * Clears all user modifications (order, width, visibility, sort).
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

  // ---------------- Shell / Tool Panel API ----------------
  // These methods delegate to ShellController for implementation.
  // The controller encapsulates all tool panel logic while grid.ts
  // exposes the public API surface.

  /** Check if the tool panel is currently open. */
  get isToolPanelOpen(): boolean {
    return this.#shellController.isPanelOpen;
  }

  /**
   * Get the currently active tool panel ID, or null if none is open.
   * @deprecated Use isToolPanelOpen and expandedToolPanelSections instead.
   */
  get activeToolPanel(): string | null {
    return this.#shellController.activePanel;
  }

  /** Get the IDs of expanded accordion sections. */
  get expandedToolPanelSections(): string[] {
    return this.#shellController.expandedSections;
  }

  /** Open the tool panel (accordion view with all registered panels). */
  openToolPanel(): void {
    this.#shellController.openToolPanel();
  }

  /** Close the tool panel. */
  closeToolPanel(): void {
    this.#shellController.closeToolPanel();
  }

  /** Toggle the tool panel open/closed. */
  toggleToolPanel(): void {
    this.#shellController.toggleToolPanel();
  }

  /** Toggle an accordion section expanded/collapsed. */
  toggleToolPanelSection(sectionId: string): void {
    this.#shellController.toggleToolPanelSection(sectionId);
  }

  /** Get registered tool panel definitions. */
  getToolPanels(): ToolPanelDefinition[] {
    return this.#shellController.getToolPanels();
  }

  /** Register a custom tool panel (without creating a plugin). */
  registerToolPanel(panel: ToolPanelDefinition): void {
    this.#shellState.apiToolPanelIds.add(panel.id);
    this.#shellController.registerToolPanel(panel);
  }

  /** Unregister a custom tool panel. */
  unregisterToolPanel(panelId: string): void {
    this.#shellState.apiToolPanelIds.delete(panelId);
    this.#shellController.unregisterToolPanel(panelId);
  }

  /** Get registered header content definitions. */
  getHeaderContents(): HeaderContentDefinition[] {
    return this.#shellController.getHeaderContents();
  }

  /** Register custom header content (without creating a plugin). */
  registerHeaderContent(content: HeaderContentDefinition): void {
    this.#shellController.registerHeaderContent(content);
  }

  /** Unregister custom header content. */
  unregisterHeaderContent(contentId: string): void {
    this.#shellController.unregisterHeaderContent(contentId);
  }

  /** Get all registered toolbar contents. */
  getToolbarContents(): ToolbarContentDefinition[] {
    return this.#shellController.getToolbarContents();
  }

  /** Register custom toolbar content programmatically. */
  registerToolbarContent(content: ToolbarContentDefinition): void {
    this.#shellController.registerToolbarContent(content);
  }

  /** Unregister custom toolbar content. */
  unregisterToolbarContent(contentId: string): void {
    this.#shellController.unregisterToolbarContent(contentId);
  }

  /**
   * Get all registered toolbar buttons.
   * @deprecated Use `getToolbarContents()` instead.
   */
  getToolbarButtons(): ToolbarButtonInfo[] {
    console.warn('[tbw-grid] getToolbarButtons() is deprecated. Use getToolbarContents() instead.');
    return [];
  }

  /**
   * Register a custom toolbar button programmatically.
   * @deprecated Use `registerToolbarContent()` instead.
   */
  registerToolbarButton(button: ToolbarButtonConfig): void {
    console.warn('[tbw-grid] registerToolbarButton() is deprecated. Use registerToolbarContent() instead.');
    // Migrate to new API for backward compatibility
    this.#shellController.registerToolbarContent({
      id: button.id,
      order: button.order ?? 100,
      render:
        button.render ??
        ((container) => {
          if (button.element) container.appendChild(button.element);
        }),
    });
  }

  /**
   * Unregister a custom toolbar button.
   * @deprecated Use `unregisterToolbarContent()` instead.
   */
  unregisterToolbarButton(buttonId: string): void {
    console.warn('[tbw-grid] unregisterToolbarButton() is deprecated. Use unregisterToolbarContent() instead.');
    this.#shellController.unregisterToolbarContent(buttonId);
  }

  /**
   * Enable/disable a toolbar button by ID.
   * @deprecated Manage your own button disabled state directly.
   */
  setToolbarButtonDisabled(_buttonId: string, _disabled: boolean): void {
    console.warn(
      '[tbw-grid] setToolbarButtonDisabled() is deprecated. Manage your own button disabled state directly.',
    );
  }

  /**
   * Re-parse light DOM shell elements and refresh shell header.
   * Call this after dynamically modifying <tbw-grid-header> children.
   */
  refreshShellHeader(): void {
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
    this.#afterConnect();
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
   * @param id - The ID used when registering the styles
   */
  unregisterStyles(id: string): void {
    if (this.#customStyleSheets.delete(id)) {
      this.#updateAdoptedStyleSheets();
    }
  }

  /**
   * Get list of registered custom style IDs.
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
   * @internal Used by framework integration libraries (Angular, React, Vue)
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

  // ---------------- Virtual Window ----------------
  /**
   * Calculate total height for the faux scrollbar spacer element.
   * Used by both bypass and virtualized rendering paths to ensure consistent scroll behavior.
   */
  #calculateTotalSpacerHeight(totalRows: number): number {
    const rowHeight = this._virtualization.rowHeight;
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

    // Add extra height from plugins (e.g., expanded master-detail rows)
    const pluginExtraHeight = this.#pluginManager?.getExtraHeight() ?? 0;

    // Horizontal scrollbar compensation: When a horizontal scrollbar appears inside scroll-area,
    // the faux scrollbar (sibling) is taller than scroll-area. Add the difference as padding.
    const hScrollbarPadding = Math.max(0, fauxScrollHeight - scrollAreaHeight);

    return totalRows * rowHeight + viewportHeightDiff + pluginExtraHeight + hScrollbarPadding;
  }

  /**
   * Core virtualization routine. Chooses between bypass (small datasets), grouped window rendering,
   * or standard row window rendering.
   * @internal Plugin API
   */
  refreshVirtualWindow(force = false): void {
    if (!this._bodyEl) return;

    const totalRows = this._rows.length;

    if (!this._virtualization.enabled) {
      this.#renderVisibleRows(0, totalRows);
      this.#pluginManager?.afterRender();
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
      if (this._virtualization.totalHeightEl) {
        this._virtualization.totalHeightEl.style.height = `${this.#calculateTotalSpacerHeight(totalRows)}px`;
      }
      // Update ARIA counts on the grid container
      this.#updateAriaCounts(totalRows, this._visibleColumns.length);
      this.#pluginManager?.afterRender();
      return;
    }

    // --- Normal virtualization path with faux scrollbar pattern ---
    // Faux scrollbar provides scrollTop, viewport provides visible height
    const fauxScrollbar = this._virtualization.container ?? this;
    const viewportEl = this._virtualization.viewportEl ?? fauxScrollbar;
    const viewportHeight = viewportEl.clientHeight;
    const rowHeight = this._virtualization.rowHeight;
    const scrollTop = fauxScrollbar.scrollTop;

    // When plugins add extra height (e.g., expanded details), the scroll position
    // includes that extra height. We need to find the actual row at scrollTop
    // by iteratively accounting for cumulative extra heights.
    // This prevents jumping when scrolling past expanded content.
    let start = Math.floor(scrollTop / rowHeight);

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

    // Faux pattern buffer: render 2 extra rows below for smooth edge transition
    // This is smaller than traditional overscan since sub-pixel offset handles smoothness
    // +1 extra to account for the even-alignment above potentially showing 1 more row at top
    const visibleCount = Math.ceil(viewportHeight / rowHeight) + 3;
    let end = start + visibleCount;
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

    const totalHeight = this.#calculateTotalSpacerHeight(totalRows);

    if (this._virtualization.totalHeightEl) {
      this._virtualization.totalHeightEl.style.height = `${totalHeight}px`;
    }

    // Smooth scroll: apply offset for fluid motion
    // Since start is even-aligned, offset is distance from that aligned position
    // This creates smooth sliding while preserving zebra stripe parity
    // Account for extra heights (expanded details) before the start row
    const extraHeightBeforeStart = this.#pluginManager?.getExtraHeightBefore?.(start) ?? 0;
    const subPixelOffset = -(scrollTop - start * rowHeight - extraHeightBeforeStart);
    this._bodyEl.style.transform = `translateY(${subPixelOffset}px)`;

    this.#renderVisibleRows(start, end, force ? ++this.__rowRenderEpoch : this.__rowRenderEpoch);

    // Update ARIA counts on the grid container
    this.#updateAriaCounts(totalRows, this._visibleColumns.length);

    // Only run plugin afterRender hooks on force refresh (structural changes)
    // Skip on scroll-triggered renders for maximum performance
    if (force) {
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

  // ---------------- Render ----------------
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
      onToolbarButtonClick: (buttonId) => this.#handleToolbarButtonClick(buttonId),
    });

    // Set up tool panel resize
    this.#resizeCleanup?.();
    this.#resizeCleanup = setupToolPanelResize(this.#renderRoot, this.#effectiveConfig?.shell, (width: number) => {
      // Update the CSS variable to persist the new width
      this.style.setProperty('--tbw-tool-panel-width', `${width}px`);
    });
  }

  /**
   * Handle toolbar button click.
   * Note: Config/API buttons use element or render, so they handle their own clicks.
   * This method is kept for backwards compatibility but may emit an event in the future.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  #handleToolbarButtonClick(_buttonId: string): void {
    // No-op: Config and API buttons now use element/render and handle their own events.
    // Light DOM buttons use slot and handle their own events.
    // This callback may be used for future extensibility (e.g., emitting an event).
  }
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
