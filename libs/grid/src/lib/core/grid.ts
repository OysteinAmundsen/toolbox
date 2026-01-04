import styles from './grid.css?inline';
import { applyColumnState, collectColumnState, createStateChangeHandler } from './internal/column-state';
import { autoSizeColumns, getColumnConfiguration, updateTemplate } from './internal/columns';
import { exitRowEdit, inlineEnterEdit, startRowEdit } from './internal/editing';
import { renderHeader } from './internal/header';
import { inferColumns } from './internal/inference';
import { ensureCellVisible, handleGridKeyDown } from './internal/keyboard';
import { createResizeController } from './internal/resize';
import { invalidateCellCache, renderVisibleRows } from './internal/rows';
import {
  cleanupShellState,
  createShellController,
  createShellState,
  parseLightDomShell,
  renderCustomToolbarButtons,
  renderHeaderContent,
  renderShellBody,
  renderShellHeader,
  setupShellEventListeners,
  setupToolPanelResize,
  shouldRenderShellHeader,
  type ShellController,
  type ShellState,
} from './internal/shell';
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
  ActivateCellDetail,
  AnimationConfig,
  CellCommitDetail,
  ColumnConfig,
  ColumnConfigMap,
  ColumnInternal,
  ColumnResizeDetail,
  FitMode,
  GridColumnState,
  GridConfig,
  HeaderContentDefinition,
  InternalGrid,
  ResizeController,
  RowCommitDetail,
  SortChangeDetail,
  ToolbarButtonConfig,
  ToolbarButtonInfo,
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
 * converges into `#effectiveConfig`. Users can set configuration via multiple inputs:
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
 * The `#mergeEffectiveConfig()` method is the single place where all inputs converge.
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

  // ---------------- Observed Attributes ----------------
  static get observedAttributes(): string[] {
    return ['rows', 'columns', 'grid-config', 'fit-mode', 'edit-on'];
  }

  readonly #shadow: ShadowRoot;
  #initialized = false;

  // ---------------- Ready Promise ----------------
  #readyPromise: Promise<void>;
  #readyResolve?: () => void;

  // #region Input Properties
  // These backing fields store raw user input. They are merged into
  // #effectiveConfig by #mergeEffectiveConfig(). Never read directly
  // for rendering logic - always use effectiveConfig or derived state.
  #rows: T[] = [];
  #columns?: ColumnConfig<T>[] | ColumnConfigMap<T>;
  #gridConfig?: GridConfig<T>;
  #fitMode?: FitMode;
  #editOn?: string;
  // #endregion

  // #region Private properties
  // All input sources converge here. This is the canonical config
  // that all rendering and logic should read from.
  #effectiveConfig: GridConfig<T> = {};
  #connected = false;
  #scrollRaf = 0;
  #pendingScrollTop: number | null = null;
  #hasScrollPlugins = false; // Cached flag for plugin scroll handlers
  #renderRowHook?: (row: any, rowEl: HTMLElement, rowIndex: number) => boolean; // Cached hook to avoid closures
  #isDragging = false;
  #touchStartY: number | null = null;
  #touchStartX: number | null = null;
  #touchScrollTop: number | null = null;
  #touchScrollLeft: number | null = null;
  #touchLastY: number | null = null;
  #touchLastX: number | null = null;
  #touchLastTime: number | null = null;
  #touchVelocityY = 0;
  #touchVelocityX = 0;
  #momentumRaf = 0;
  #eventAbortController?: AbortController;
  #resizeObserver?: ResizeObserver;

  // ---------------- Plugin System ----------------
  #pluginManager!: PluginManager;

  // ---------------- Column State ----------------
  #stateChangeHandler?: () => void;
  #initialColumnState?: GridColumnState;

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

  // Sort state
  _sortState: { field: string; direction: 1 | -1 } | null = null;

  // Edit state
  _activeEditRows = -1;
  _rowEditSnapshots = new Map<number, T>();
  _changedRowIndices = new Set<number>();

  // Layout
  _gridTemplate = '';
  // #endregion

  // #region Implementation Details (Internal only)
  __rowRenderEpoch = 0;
  __didInitialAutoSize = false;
  __lightDomColumnsCache?: ColumnInternal[];
  __originalColumnNodes?: HTMLElement[];
  __originalOrder: T[] = [];
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
      this.#onRowsChanged();
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
    const oldValue = this.#columns;
    this.#columns = value;
    if (oldValue !== value) {
      this.#onColsChanged();
    }
  }

  get gridConfig(): GridConfig<T> {
    return this.#effectiveConfig;
  }
  set gridConfig(value: GridConfig<T> | undefined) {
    const oldValue = this.#gridConfig;
    this.#gridConfig = value;
    if (oldValue !== value) {
      this.#onGridConfigChanged();
    }
  }

  get fitMode(): FitMode {
    return this.#effectiveConfig.fitMode ?? 'stretch';
  }
  set fitMode(value: FitMode | undefined) {
    const oldValue = this.#fitMode;
    this.#fitMode = value;
    if (oldValue !== value) {
      this.#onFitChanged();
    }
  }

  get editOn(): string | undefined {
    return this.#effectiveConfig.editOn;
  }
  set editOn(value: string | undefined) {
    const oldValue = this.#editOn;
    this.#editOn = value;
    if (oldValue !== value) {
      this.#onEditModeChanged();
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
    this.#shadow = this.attachShadow({ mode: 'open' });
    this.#injectStyles();
    this.#readyPromise = new Promise((res) => (this.#readyResolve = res));

    // Initialize shell controller with callbacks
    this.#shellController = createShellController(this.#shellState, {
      getShadow: () => this.#shadow,
      getShellConfig: () => this.#effectiveConfig?.shell,
      getAccordionIcons: () => ({
        expand: this.#effectiveConfig?.icons?.expand ?? DEFAULT_GRID_ICONS.expand,
        collapse: this.#effectiveConfig?.icons?.collapse ?? DEFAULT_GRID_ICONS.collapse,
      }),
      emit: (eventName, detail) => this.#emit(eventName, detail),
      refreshShellHeader: () => this.refreshShellHeader(),
    });
  }

  #injectStyles(): void {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    this.#shadow.adoptedStyleSheets = [sheet];
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
    this.#rebuildRowModel();
    this.#processColumns();
    renderHeader(this);
    updateTemplate(this);
    this.refreshVirtualWindow(true);
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
    this.#pluginManager?.afterRender();
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
   * Inject all plugin styles into the shadow DOM.
   * Must be called after #render() since innerHTML wipes existing content.
   */
  #injectAllPluginStyles(): void {
    const allStyles = this.#pluginManager?.getAllStyles() ?? '';
    if (allStyles) {
      const styleEl = document.createElement('style');
      styleEl.setAttribute('data-plugin', 'all');
      styleEl.textContent = allStyles;
      this.#shadow.appendChild(styleEl);
    }
  }

  /**
   * Update plugins when grid config changes.
   * With class-based plugins, we need to detach old and attach new.
   */
  #updatePluginConfigs(): void {
    // With class-based plugins, config changes require re-initialization
    // The new plugins are in the new config - detach old, attach new
    if (this.#pluginManager) {
      this.#pluginManager.detachAll();
    }
    this.#initializePlugins();
    this.#injectAllPluginStyles();
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

  // ---------------- Lifecycle ----------------
  connectedCallback(): void {
    if (!this.hasAttribute('tabindex')) (this as any).tabIndex = 0;
    if (!this.hasAttribute('version')) this.setAttribute('version', DataGridElement.version);
    this._rows = Array.isArray(this.#rows) ? [...this.#rows] : [];

    // Create AbortController for all event listeners (grid internal + plugins)
    // This must happen BEFORE plugins attach so they can use disconnectSignal
    // Abort any previous controller first (in case of re-connect)
    this.#eventAbortController?.abort();
    this.#eventAbortController = new AbortController();

    // Merge all config sources into effectiveConfig (including columns)
    this.#mergeEffectiveConfig();

    // Initialize plugin system (now plugins can access disconnectSignal)
    this.#initializePlugins();

    // Collect tool panels and header content from plugins (must be before render)
    this.#collectPluginShellContributions();

    if (!this.#initialized) {
      this.#render();
      this.#injectAllPluginStyles(); // Inject plugin styles after render
      this.#initialized = true;
    }
    this.#afterConnect();
  }

  disconnectedCallback(): void {
    // Clean up plugin states
    this.#destroyPlugins();

    // Clean up shell state
    cleanupShellState(this.#shellState);
    this.#shellController.setInitialized(false);

    // Clean up tool panel resize handler
    this.#resizeCleanup?.();
    this.#resizeCleanup = undefined;

    // Abort all event listeners (internal + document-level)
    // This cleans up all listeners added with { signal } option
    if (this.#eventAbortController) {
      this.#eventAbortController.abort();
      this.#eventAbortController = undefined;
    }

    if (this._resizeController) {
      this._resizeController.dispose();
    }
    if (this.#resizeObserver) {
      this.#resizeObserver.disconnect();
      this.#resizeObserver = undefined;
    }
    this.#connected = false;
  }

  /**
   * Handle HTML attribute changes.
   * Only processes attribute values when SET (non-null).
   * Removing an attribute does NOT clear JS-set properties.
   */
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue || !newValue || newValue === 'null' || newValue === 'undefined') return;

    // Map kebab-case attributes to camelCase properties
    const propMap: Record<string, keyof this> = {
      rows: 'rows',
      columns: 'columns',
      'grid-config': 'gridConfig',
      'fit-mode': 'fitMode',
      'edit-on': 'editOn',
    };

    const prop = propMap[name];
    if (!prop) return;

    // JSON attributes need parsing
    if (name === 'rows' || name === 'columns' || name === 'grid-config') {
      try {
        (this as any)[prop] = JSON.parse(newValue);
      } catch {
        console.warn(`[tbw-grid] Invalid JSON for '${name}' attribute:`, newValue);
      }
    } else {
      // String attributes (fit-mode, edit-on)
      (this as any)[prop] = newValue;
    }
  }

  #afterConnect(): void {
    // Shell changes the DOM structure - need to find elements appropriately
    const gridContent = this.#shadow.querySelector('.tbw-grid-content');
    const gridRoot = gridContent ?? this.#shadow.querySelector('.tbw-grid-root');

    this._headerRowEl = gridRoot?.querySelector('.header-row') as HTMLElement;
    // Faux scrollbar pattern:
    // - .faux-vscroll-spacer sets virtual height
    // - .rows-viewport provides visible height for virtualization calculations
    this._virtualization.totalHeightEl = gridRoot?.querySelector('.faux-vscroll-spacer') as HTMLElement;
    this._virtualization.viewportEl = gridRoot?.querySelector('.rows-viewport') as HTMLElement;
    this._bodyEl = gridRoot?.querySelector('.rows') as HTMLElement;

    // Initialize shell header content and custom buttons if shell is active
    if (this.#shellController.isInitialized) {
      // Render plugin header content
      renderHeaderContent(this.#shadow, this.#shellState);
      // Render custom toolbar buttons (element/render modes)
      renderCustomToolbarButtons(this.#shadow, this.#effectiveConfig?.shell, this.#shellState);
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

    // Get the signal for event listener cleanup (AbortController created in connectedCallback)
    const signal = this.disconnectSignal;

    // Create resize controller BEFORE setup - renderHeader() needs it for resize handle mousedown events
    this._resizeController = createResizeController(this as any);

    // Run setup
    this.#setup();

    // Element-level keydown handler (uses signal for automatic cleanup)
    this.addEventListener('keydown', (e) => handleGridKeyDown(this as any, e), { signal });

    // Document-level listeners (also use signal for automatic cleanup)
    // Escape key to cancel row editing
    document.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (e.key === 'Escape' && this._activeEditRows !== -1) {
          exitRowEdit(this, this._activeEditRows, true);
        }
      },
      { capture: true, signal },
    );

    // Click outside to commit row editing
    document.addEventListener(
      'mousedown',
      (e: MouseEvent) => {
        if (this._activeEditRows === -1) return;
        const rowEl = this.findRenderedRowElement(this._activeEditRows);
        if (!rowEl) return;
        const path = (e.composedPath && e.composedPath()) || [];
        if (path.includes(rowEl)) return;
        exitRowEdit(this, this._activeEditRows, false);
      },
      { signal },
    );

    // Faux scrollbar pattern: scroll events come from the fake scrollbar element
    // Content area doesn't scroll - rows are positioned via transforms
    // This prevents blank viewport: old content stays until transforms are updated
    // Reuse gridRoot from earlier in this function
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

          // Smooth scroll: apply offset immediately for fluid motion
          // Calculate even-aligned start to preserve zebra stripe parity
          // DOM nth-child(even) will always match data row parity
          const rawStart = Math.floor(currentScrollTop / rowHeight);
          const evenAlignedStart = rawStart - (rawStart % 2);
          const subPixelOffset = -(currentScrollTop - evenAlignedStart * rowHeight);
          rowsEl.style.transform = `translateY(${subPixelOffset}px)`;

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
        { passive: true, signal },
      );

      // Forward wheel events from content area to faux scrollbar
      // Without this, mouse wheel over content wouldn't scroll
      // Listen on .tbw-grid-content to capture wheel events from entire grid area
      // Note: gridRoot may already BE .tbw-grid-content when shell is active, so search from shadow root
      const gridContentEl = this.#shadow.querySelector('.tbw-grid-content') as HTMLElement;
      const scrollArea = this.#shadow.querySelector('.tbw-scroll-area') as HTMLElement;
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
          { passive: false, signal },
        );

        // Touch scrolling support for mobile devices
        // Supports both vertical (via faux scrollbar) and horizontal (via scroll area) scrolling
        // Includes momentum scrolling for natural "flick" behavior
        gridContentEl.addEventListener(
          'touchstart',
          (e: TouchEvent) => {
            if (e.touches.length === 1) {
              // Cancel any ongoing momentum animation
              if (this.#momentumRaf) {
                cancelAnimationFrame(this.#momentumRaf);
                this.#momentumRaf = 0;
              }

              this.#touchStartY = e.touches[0].clientY;
              this.#touchStartX = e.touches[0].clientX;
              this.#touchLastY = e.touches[0].clientY;
              this.#touchLastX = e.touches[0].clientX;
              this.#touchLastTime = performance.now();
              this.#touchScrollTop = fauxScrollbar.scrollTop;
              this.#touchScrollLeft = scrollArea?.scrollLeft ?? 0;
              this.#touchVelocityY = 0;
              this.#touchVelocityX = 0;
            }
          },
          { passive: true, signal },
        );

        gridContentEl.addEventListener(
          'touchmove',
          (e: TouchEvent) => {
            if (
              e.touches.length === 1 &&
              this.#touchStartY !== null &&
              this.#touchStartX !== null &&
              this.#touchScrollTop !== null &&
              this.#touchScrollLeft !== null
            ) {
              const currentY = e.touches[0].clientY;
              const currentX = e.touches[0].clientX;
              const now = performance.now();

              const deltaY = this.#touchStartY - currentY;
              const deltaX = this.#touchStartX - currentX;

              // Calculate velocity for momentum scrolling
              if (this.#touchLastTime !== null && this.#touchLastY !== null && this.#touchLastX !== null) {
                const dt = now - this.#touchLastTime;
                if (dt > 0) {
                  // Velocity in pixels per millisecond
                  this.#touchVelocityY = (this.#touchLastY - currentY) / dt;
                  this.#touchVelocityX = (this.#touchLastX - currentX) / dt;
                }
              }
              this.#touchLastY = currentY;
              this.#touchLastX = currentX;
              this.#touchLastTime = now;

              // Check if grid can scroll in the requested directions
              const { scrollTop, scrollHeight, clientHeight } = fauxScrollbar;
              const maxScrollY = scrollHeight - clientHeight;
              const canScrollVertically = (deltaY > 0 && scrollTop < maxScrollY) || (deltaY < 0 && scrollTop > 0);

              let canScrollHorizontally = false;
              if (scrollArea) {
                const { scrollLeft, scrollWidth, clientWidth } = scrollArea;
                const maxScrollX = scrollWidth - clientWidth;
                canScrollHorizontally = (deltaX > 0 && scrollLeft < maxScrollX) || (deltaX < 0 && scrollLeft > 0);
              }

              // Apply scroll if grid can scroll in that direction
              if (canScrollVertically) {
                fauxScrollbar.scrollTop = this.#touchScrollTop + deltaY;
              }
              if (canScrollHorizontally && scrollArea) {
                scrollArea.scrollLeft = this.#touchScrollLeft + deltaX;
              }

              // Only prevent page scroll when we actually scrolled the grid
              if (canScrollVertically || canScrollHorizontally) {
                e.preventDefault();
              }
            }
          },
          { passive: false, signal },
        );

        gridContentEl.addEventListener(
          'touchend',
          () => {
            // Start momentum scrolling if there's significant velocity
            const minVelocity = 0.1; // pixels per ms threshold
            if (Math.abs(this.#touchVelocityY) > minVelocity || Math.abs(this.#touchVelocityX) > minVelocity) {
              this.#startMomentumScroll(fauxScrollbar, scrollArea);
            }

            this.#touchStartY = null;
            this.#touchStartX = null;
            this.#touchScrollTop = null;
            this.#touchScrollLeft = null;
            this.#touchLastY = null;
            this.#touchLastX = null;
            this.#touchLastTime = null;
          },
          { passive: true, signal },
        );
      }
    }

    // Central mouse event handling for plugins (uses signal for automatic cleanup)
    this.#shadow.addEventListener('mousedown', (e) => this.#handleMouseDown(e as MouseEvent), { signal });

    // Track global mousemove/mouseup for drag operations (uses signal for automatic cleanup)
    document.addEventListener('mousemove', (e: MouseEvent) => this.#handleMouseMove(e), { signal });
    document.addEventListener('mouseup', (e: MouseEvent) => this.#handleMouseUp(e), { signal });

    if (this._virtualization.enabled) {
      requestAnimationFrame(() => this.refreshVirtualWindow(true));
    }

    // Determine row height for virtualization:
    // 1. User-configured rowHeight in gridConfig takes precedence
    // 2. Otherwise, measure actual row height from DOM (respects CSS variable --tbw-row-height)
    const userRowHeight = this.#effectiveConfig.rowHeight;
    if (userRowHeight && userRowHeight > 0) {
      this._virtualization.rowHeight = userRowHeight;
    } else {
      // Measure after first render to pick up CSS-defined row height
      requestAnimationFrame(() => {
        const firstRow = this._bodyEl?.querySelector('.data-grid-row');
        if (firstRow) {
          const measuredHeight = (firstRow as HTMLElement).getBoundingClientRect().height;
          if (measuredHeight > 0) {
            this._virtualization.rowHeight = measuredHeight;
            this.refreshVirtualWindow(true);
          }
        }
      });
    }

    // Resize observer to refresh virtualization and maintain focus when viewport size changes
    if (this._virtualization.viewportEl) {
      this.#resizeObserver = new ResizeObserver(() => {
        // Debounce with RAF to avoid excessive recalculations
        if (!this.#scrollRaf) {
          this.#scrollRaf = requestAnimationFrame(() => {
            this.#scrollRaf = 0;
            this.refreshVirtualWindow(true);

            // Ensure focused cell remains visible after resize
            // (viewport size may have changed, pushing the focused cell out of view)
            ensureCellVisible(this as any);
          });
        }
      });
      this.#resizeObserver.observe(this._virtualization.viewportEl);
    }

    // Initialize ARIA selection state
    queueMicrotask(() => this.#updateAriaSelection());

    requestAnimationFrame(() => requestAnimationFrame(() => this.#readyResolve?.()));
  }

  // ---------------- Event Emitters ----------------
  #emit<D>(eventName: string, detail: D): void {
    this.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: true, composed: true }));
  }

  _emitCellCommit(detail: CellCommitDetail<T>): void {
    this.#emit('cell-commit', detail);
  }

  _emitRowCommit(detail: RowCommitDetail<T>): void {
    this.#emit('row-commit', detail);
  }

  _emitSortChange(detail: SortChangeDetail): void {
    this.#emit('sort-change', detail);
  }

  _emitColumnResize(detail: ColumnResizeDetail): void {
    this.#emit('column-resize', detail);
  }

  _emitActivateCell(detail: ActivateCellDetail): void {
    this.#emit('activate-cell', detail);
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

  // ---------------- Watch Handlers ----------------
  #onFitChanged(): void {
    if (!this.#connected) return;
    this.#mergeEffectiveConfig();
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

  #onEditModeChanged(): void {
    if (!this.#connected) return;
    this.#mergeEffectiveConfig();
    this._rowPool.length = 0;
    if (this._bodyEl) this._bodyEl.innerHTML = '';
    this.__rowRenderEpoch++;
    this.refreshVirtualWindow(true);
  }

  #onRowsChanged(): void {
    this._rows = Array.isArray(this.#rows) ? [...this.#rows] : [];
    this.#rebuildRowModel();
    // If no explicit columns provided, trigger full setup so inference runs
    if (!this.#columns || (Array.isArray(this.#columns) && this.#columns.length === 0)) {
      this.#setup();
    } else {
      this.refreshVirtualWindow(true);
    }
  }

  #onColsChanged(): void {
    // Invalidate caches that depend on column configuration
    invalidateCellCache(this);

    // Re-merge config and setup - _columns will be set through effectiveConfig
    if (this.#connected) {
      this.#mergeEffectiveConfig();
      this.#setup();
    }
  }

  #onGridConfigChanged(): void {
    if (!this.#connected) return;
    this.#mergeEffectiveConfig();
    this.#updatePluginConfigs(); // Sync plugin configs with new grid config
    this.#rebuildRowModel();
    this.#processColumns(); // Process columns after rows for tree plugin
    renderHeader(this);
    updateTemplate(this);
    this.refreshVirtualWindow(true);
  }

  #processColumns(): void {
    // Let plugins process visible columns (column grouping, etc.)
    // Start from base columns (before any plugin transformation) - like #rebuildRowModel uses #rows
    if (this.#pluginManager) {
      // Use base columns as source of truth, falling back to current _columns if not set
      const sourceColumns = this.#baseColumns.length > 0 ? this.#baseColumns : this._columns;
      const visibleCols = sourceColumns.filter((c) => !c.hidden);
      const hiddenCols = sourceColumns.filter((c) => c.hidden);
      const processedColumns = this.#pluginManager.processColumns([...visibleCols] as any[]);

      // If plugins modified visible columns, update them
      if (processedColumns !== visibleCols) {
        // Build a map of processed columns by field for quick lookup
        const processedMap = new Map(processedColumns.map((c: any, i: number) => [c.field, { col: c, order: i }]));

        // Check if this is a complete column replacement (e.g., pivot mode)
        // If no processed columns match original columns, use processed columns directly
        const hasMatchingFields = visibleCols.some((c) => processedMap.has(c.field));

        if (!hasMatchingFields && processedColumns.length > 0) {
          // Complete replacement: use processed columns directly (pivot mode)
          // Preserve hidden columns at the end
          this._columns = [...processedColumns, ...hiddenCols] as ColumnInternal<T>[];
        } else {
          // Plugins returned original fields (possibly modified) - merge back
          // Use source columns as base, not current _columns
          const updatedColumns = sourceColumns.map((c) => {
            if (c.hidden) return c; // Keep hidden columns unchanged
            const processed = processedMap.get(c.field);
            return processed ? processed.col : c;
          });

          this._columns = updatedColumns as ColumnInternal<T>[];
        }
      } else {
        // Plugins returned columns unchanged, but we may need to restore from base
        this._columns = [...sourceColumns] as ColumnInternal<T>[];
      }
    }
  }

  /** Recompute row model via plugin hooks (grouping, tree, filtering, etc.). */
  #rebuildRowModel(): void {
    // Invalidate cell display value cache - rows are changing
    invalidateCellCache(this);

    // Start fresh from original rows (plugins will transform them)
    const originalRows = Array.isArray(this.#rows) ? [...this.#rows] : [];

    // Let plugins process rows (row grouping, tree, filtering, etc.)
    // Plugins can transform the rows array, adding markers like __isGroupRow
    // The renderRow hook will handle rendering specialized row types
    const processedRows = this.#pluginManager?.processRows(originalRows) ?? originalRows;

    // Store processed rows for rendering
    // Note: processedRows may contain group markers that plugins handle via renderRow hook
    this._rows = processedRows as T[];
  }

  /**
   * Build the canonical effective configuration by merging all input sources.
   *
   * This is the **single source of truth** for the grid's configuration.
   * All inputs (gridConfig, light DOM, individual props) converge here.
   *
   * **Precedence (lowest → highest):**
   * 1. `gridConfig` property - base config object
   * 2. Light DOM `<tbw-grid-column>` elements - declarative columns
   * 3. `columns` property - programmatic columns override
   * 4. Inferred columns - auto-detected from row data
   * 5. Individual props (`fitMode`, `editOn`) - convenience overrides
   *
   * After this method runs:
   * - `#effectiveConfig` contains the merged result
   * - `_columns` is NOT set here (done by #getColumnConfiguration + #processColumns)
   * - Plugins receive config via their attach() method
   */
  #mergeEffectiveConfig(): void {
    const base: GridConfig<T> = this.#gridConfig ? { ...this.#gridConfig } : {};
    let columns: ColumnConfig<T>[] = Array.isArray(base.columns) ? [...base.columns] : [];

    // Light DOM cached parse (if already parsed by columns pipeline); non-invasive merge (fill gaps only)
    const domCols: ColumnConfig<T>[] = ((this as any).__lightDomColumnsCache || []).map((c: ColumnConfig<T>) => ({
      ...c,
    }));
    if (domCols.length) {
      const map: Record<string, ColumnConfig<T>> = {};
      columns.forEach((c) => (map[(c as any).field] = c));
      domCols.forEach((c: any) => {
        const exist = map[c.field];
        if (!exist) {
          columns.push(c);
          map[c.field] = c;
        } else {
          if (c.header && !exist.header) exist.header = c.header;
          if (c.type && !exist.type) exist.type = c.type;
          exist.sortable = exist.sortable || c.sortable;
          if (c.resizable) exist.resizable = true;
          if (c.editable) exist.editable = true;
        }
      });
    }

    // Columns prop highest structural precedence
    if (this.#columns && (this.#columns as ColumnConfig<T>[]).length) {
      columns = [...(this.#columns as ColumnConfig<T>[])];
    }

    // Inference if still empty
    if ((!columns || columns.length === 0) && this._rows.length) {
      const result = inferColumns(this._rows as Record<string, unknown>[]);
      columns = result.columns as ColumnConfig<T>[];
    }

    if (columns.length) {
      // Apply per-column defaults (sortable/resizable default true unless explicitly false)
      columns.forEach((c) => {
        if (c.sortable === undefined) c.sortable = true;
        if (c.resizable === undefined) c.resizable = true;
        // Store original configured width for reset on double-click (only numeric widths)
        const internal = c as ColumnInternal<T>;
        if (internal.__originalWidth === undefined && typeof c.width === 'number') {
          internal.__originalWidth = c.width;
        }
      });
      // Preserve processed columns (with __compiledView etc.) if already set by #getColumnConfiguration
      // Only set base.columns if effectiveConfig.columns is empty or doesn't have compiled templates
      const existingCols = this.#effectiveConfig.columns as ColumnInternal<T>[] | undefined;
      const alreadyProcessed = existingCols?.some((c) => c.__compiledView || c.__compiledEditor);
      if (alreadyProcessed) {
        // Keep existing processed columns
        base.columns = existingCols as ColumnConfig<T>[];
      } else {
        base.columns = columns;
      }
    } else {
      // No new columns computed, but preserve existing if processed
      const existingCols = this.#effectiveConfig.columns as ColumnInternal<T>[] | undefined;
      if (existingCols?.some((c) => c.__compiledView || c.__compiledEditor)) {
        base.columns = existingCols as ColumnConfig<T>[];
      }
    }

    // Individual prop overrides (behavioral)
    if (this.#fitMode) base.fitMode = this.#fitMode;
    if (!base.fitMode) base.fitMode = 'stretch';
    if (this.#editOn) base.editOn = this.#editOn;

    // Apply rowHeight from config if specified
    if (base.rowHeight && base.rowHeight > 0) {
      this._virtualization.rowHeight = base.rowHeight;
    }

    // Store columnState from gridConfig if not already set
    if (base.columnState && !this.#initialColumnState) {
      this.#initialColumnState = base.columnState;
    }

    this.#effectiveConfig = base;
    // Note: _columns is a getter/setter for effectiveConfig.columns
    // #getColumnConfiguration() populates it, and we preserve those processed columns above
    // Plugins (like ReorderPlugin) modify effectiveConfig.columns via the _columns setter

    // If fixed mode and width not specified: assign default 80px
    if (base.fitMode === 'fixed') {
      this._columns.forEach((c) => {
        if (c.width == null) (c as ColumnConfig<T>).width = 80;
      });
    }

    // Apply animation configuration to CSS variables
    this.#applyAnimationConfig();
  }

  /**
   * Apply animation configuration to CSS custom properties on the host element.
   * This makes the grid's animation settings available to plugins via CSS variables.
   */
  #applyAnimationConfig(): void {
    const config: AnimationConfig = {
      ...DEFAULT_ANIMATION_CONFIG,
      ...this.#effectiveConfig.animation,
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
    renderVisibleRows(this as any, start, end, epoch, this.#renderRowHook);
  }

  // ---------------- Core Helpers ----------------
  #setup(): void {
    if (!this.isConnected) return;
    if (!this._headerRowEl || !this._bodyEl) {
      return;
    }

    // Seed effectiveConfig.columns from config sources before getColumnConfiguration
    // This ensures columns from gridConfig/columns prop are available for merging with light DOM
    // Preserve hidden state from existing columns (visibility is runtime state)
    const configCols = (this.#gridConfig?.columns || this.#columns || []) as ColumnConfig<T>[];
    if (configCols.length) {
      // Preserve hidden state from existing effectiveConfig.columns
      const existingHiddenMap = new Map(this._columns.filter((c) => c.hidden).map((c) => [c.field, true]));
      const seeded = configCols.map((c) => ({
        ...c,
        hidden: existingHiddenMap.get(c.field) ?? c.hidden,
      }));
      this._columns = seeded as ColumnInternal<T>[];
    }

    getColumnConfiguration(this);
    this.#mergeEffectiveConfig();
    this.#updatePluginConfigs(); // Sync plugin configs (including auto-detection) before processing

    // Store base columns before plugin transformation (like #rows for row processing)
    this.#baseColumns = [...this._columns];

    this.#rebuildRowModel(); // Runs processRows hooks (must run before processColumns for tree plugin)
    this.#processColumns(); // Runs processColumns hooks

    // Apply initial column state (from gridConfig.columnState or columnState setter)
    if (this.#initialColumnState) {
      const state = this.#initialColumnState;
      this.#initialColumnState = undefined; // Clear to avoid re-applying
      this.#applyColumnStateInternal(state);
    }

    renderHeader(this);
    updateTemplate(this);
    this.refreshVirtualWindow(true);

    const mode = this.#effectiveConfig.fitMode;
    if (mode === 'fixed' && !this.__didInitialAutoSize) {
      requestAnimationFrame(() => autoSizeColumns(this));
    }

    // Ensure legacy inline grid styles are cleared from container
    if (this._bodyEl) {
      this._bodyEl.style.display = '';
      this._bodyEl.style.gridTemplateColumns = '';
    }

    // Run plugin afterRender hooks (column groups, sticky, etc.)
    queueMicrotask(() => this.#pluginManager?.afterRender());
  }

  /** Internal method to apply column state without triggering setup loop */
  #applyColumnStateInternal(state: GridColumnState): void {
    // Get all columns from effectiveConfig (single source of truth)
    const allCols = (this.#effectiveConfig.columns ?? []) as ColumnInternal<T>[];

    const plugins = (this.#pluginManager?.getAll() ?? []) as BaseGridPlugin[];
    applyColumnState(this, state, allCols, plugins);

    // Update hidden property on columns based on state
    for (const colState of state.columns) {
      const col = allCols.find((c) => c.field === colState.field);
      if (col) {
        col.hidden = !colState.visible;
      }
    }
  }

  #onScrollBatched(scrollTop: number): void {
    // Faux scrollbar pattern: content never scrolls, just update transforms
    // Old content stays visible until new transforms are applied
    this.refreshVirtualWindow(false);

    // Let plugins reapply visual state to recycled DOM elements
    this.#pluginManager?.onScrollRender();

    // Dispatch to plugins (using cached flag)
    if (this.#hasScrollPlugins) {
      const fauxScrollbar = this._virtualization.container;
      const scrollEvent: ScrollEvent = {
        scrollTop,
        scrollLeft: fauxScrollbar?.scrollLeft ?? 0,
        scrollHeight: fauxScrollbar?.scrollHeight ?? 0,
        scrollWidth: fauxScrollbar?.scrollWidth ?? 0,
        clientHeight: fauxScrollbar?.clientHeight ?? 0,
        clientWidth: fauxScrollbar?.clientWidth ?? 0,
        originalEvent: new Event('scroll'),
      };
      this.#pluginManager?.onScroll(scrollEvent);
    }
  }

  /**
   * Find the header row element in the shadow DOM.
   * Used by plugins that need to access header cells for styling or measurement.
   * @internal Plugin API
   */
  findHeaderRow(): HTMLElement {
    return this.#shadow.querySelector('.header-row') as HTMLElement;
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
      value: (row as any)[col.field],
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
   * Build a CellMouseEvent from a native MouseEvent.
   * Extracts cell/row information from the event target.
   */
  #buildCellMouseEvent(e: MouseEvent, type: 'mousedown' | 'mousemove' | 'mouseup'): CellMouseEvent {
    // For document-level events (mousemove/mouseup during drag), e.target won't be inside shadow DOM.
    // Use composedPath to find elements inside shadow roots, or fall back to elementFromPoint.
    let target: Element | null = null;

    // composedPath gives us the full path including shadow DOM elements
    const path = e.composedPath?.() as Element[] | undefined;
    if (path && path.length > 0) {
      target = path[0];
    } else {
      target = e.target as Element;
    }

    // If target is still not inside our shadow root (e.g., for document-level events),
    // use elementFromPoint to find the actual element under the mouse
    if (target && !this.#shadow.contains(target)) {
      const elAtPoint = this.#shadow.elementFromPoint(e.clientX, e.clientY);
      if (elAtPoint) {
        target = elAtPoint;
      }
    }

    // Cells have data-col and data-row attributes
    const cellEl = target?.closest?.('[data-col]') as HTMLElement | null;
    const rowEl = target?.closest?.('.data-grid-row') as HTMLElement | null;
    const headerEl = target?.closest?.('.header-row') as HTMLElement | null;

    let rowIndex: number | undefined;
    let colIndex: number | undefined;
    let row: T | undefined;
    let field: string | undefined;
    let value: unknown;
    let column: any;

    if (cellEl) {
      // Get indices from cell attributes
      rowIndex = parseInt(cellEl.getAttribute('data-row') ?? '-1', 10);
      colIndex = parseInt(cellEl.getAttribute('data-col') ?? '-1', 10);
      if (rowIndex >= 0 && colIndex >= 0) {
        row = this._rows[rowIndex];
        column = this._columns[colIndex];
        field = column?.field;
        value = row && field ? (row as any)[field] : undefined;
      }
    }

    return {
      type,
      row,
      rowIndex: rowIndex !== undefined && rowIndex >= 0 ? rowIndex : undefined,
      colIndex: colIndex !== undefined && colIndex >= 0 ? colIndex : undefined,
      field,
      value,
      column,
      originalEvent: e,
      cellElement: cellEl ?? undefined,
      rowElement: rowEl ?? undefined,
      isHeader: !!headerEl,
      cell:
        rowIndex !== undefined && colIndex !== undefined && rowIndex >= 0 && colIndex >= 0
          ? { row: rowIndex, col: colIndex }
          : undefined,
    };
  }

  /**
   * Apply momentum scrolling animation after touch release.
   * Decelerates smoothly until velocity drops below threshold.
   */
  #startMomentumScroll(fauxScrollbar: HTMLElement, scrollArea: HTMLElement | null): void {
    const friction = 0.95; // Deceleration factor per frame
    const minVelocity = 0.01; // Stop threshold in px/ms

    const animate = () => {
      // Apply friction
      this.#touchVelocityY *= friction;
      this.#touchVelocityX *= friction;

      // Convert velocity (px/ms) to per-frame scroll amount (~16ms per frame)
      const scrollY = this.#touchVelocityY * 16;
      const scrollX = this.#touchVelocityX * 16;

      // Apply scroll if above threshold
      if (Math.abs(this.#touchVelocityY) > minVelocity) {
        fauxScrollbar.scrollTop += scrollY;
      }
      if (Math.abs(this.#touchVelocityX) > minVelocity && scrollArea) {
        scrollArea.scrollLeft += scrollX;
      }

      // Continue animation if still moving
      if (Math.abs(this.#touchVelocityY) > minVelocity || Math.abs(this.#touchVelocityX) > minVelocity) {
        this.#momentumRaf = requestAnimationFrame(animate);
      } else {
        this.#momentumRaf = 0;
      }
    };

    this.#momentumRaf = requestAnimationFrame(animate);
  }

  /**
   * Handle mousedown events and dispatch to plugin system.
   */
  #handleMouseDown(e: MouseEvent): void {
    const event = this.#buildCellMouseEvent(e, 'mousedown');
    const handled = this.#pluginManager?.onCellMouseDown(event) ?? false;

    // If any plugin handled mousedown, start tracking for drag
    if (handled) {
      this.#isDragging = true;
    }
  }

  /**
   * Handle mousemove events (only when dragging).
   */
  #handleMouseMove(e: MouseEvent): void {
    if (!this.#isDragging) return;

    const event = this.#buildCellMouseEvent(e, 'mousemove');
    this.#pluginManager?.onCellMouseMove(event);
  }

  /**
   * Handle mouseup events.
   */
  #handleMouseUp(e: MouseEvent): void {
    if (!this.#isDragging) return;

    const event = this.#buildCellMouseEvent(e, 'mouseup');
    this.#pluginManager?.onCellMouseUp(event);
    this.#isDragging = false;
  }

  // API consumed by internal utils (rows.ts)
  get changedRows(): T[] {
    return Array.from(this._changedRowIndices).map((i) => this._rows[i]);
  }

  get changedRowIndices(): number[] {
    return Array.from(this._changedRowIndices);
  }

  async resetChangedRows(silent?: boolean): Promise<void> {
    this._changedRowIndices.clear();
    if (!silent) {
      this.#emit('changed-rows-reset', { rows: this.changedRows, indices: this.changedRowIndices });
    }
    this._rowPool.forEach((r) => r.classList.remove('changed'));
  }

  async beginBulkEdit(rowIndex: number): Promise<void> {
    // Check if any columns are editable - if not, skip edit mode entirely
    const hasEditableColumn = this._columns.some((col) => (col as ColumnInternal<T>).editable);
    if (!hasEditableColumn) return;

    const rowData = this._rows[rowIndex];
    startRowEdit(this, rowIndex, rowData);

    // Enter edit mode on all editable cells in the row (same as click/dblclick)
    const rowEl = this.findRenderedRowElement?.(rowIndex);
    if (rowEl) {
      Array.from(rowEl.children).forEach((cell, i) => {
        // Use visibleColumns to match the cell index - _columns may include hidden columns
        const col = this._visibleColumns[i] as ColumnInternal<T> | undefined;
        if (col?.editable) {
          const cellEl = cell as HTMLElement;
          if (!cellEl.classList.contains('editing')) {
            inlineEnterEdit(this as unknown as InternalGrid, rowData, rowIndex, col, cellEl);
          }
        }
      });

      // Focus the editor in the focused cell
      queueMicrotask(() => {
        const targetCell = rowEl.querySelector(`.cell[data-col="${this._focusCol}"]`);
        if (targetCell?.classList.contains('editing')) {
          const editor = (targetCell as HTMLElement).querySelector(
            'input,select,textarea,[contenteditable="true"],[contenteditable=""],[tabindex]:not([tabindex="-1"])',
          ) as HTMLElement | null;
          try {
            editor?.focus();
          } catch {
            /* empty */
          }
        }
      });
    }
  }

  async commitActiveRowEdit(): Promise<void> {
    if (this._activeEditRows !== -1) {
      exitRowEdit(this, this._activeEditRows, false);
    }
  }

  async ready(): Promise<void> {
    return this.#readyPromise;
  }

  async forceLayout(): Promise<void> {
    this.#setup();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }

  /** Public method: returns a frozen snapshot of the merged effective configuration */
  async getConfig(): Promise<Readonly<GridConfig<T>>> {
    return Object.freeze({ ...(this.#effectiveConfig || {}) });
  }

  // ---------------- Column Visibility API ----------------

  /**
   * Set the visibility of a column.
   * @param field - The field name of the column
   * @param visible - Whether the column should be visible
   * @returns True if visibility was changed, false if column not found or locked
   */
  setColumnVisible(field: string, visible: boolean): boolean {
    // Find the column in effectiveConfig.columns (includes hidden columns)
    const allCols = this.#effectiveConfig.columns as ColumnInternal<T>[] | undefined;
    const col = allCols?.find((c) => c.field === field);

    // If column not found, cannot change visibility
    if (!col) return false;

    // Check lockVisible - cannot hide locked columns
    if (!visible && col.lockVisible) return false;

    // Check if at least one column would remain visible
    if (!visible) {
      const currentVisible = (allCols ?? []).filter((c) => !c.hidden && c.field !== field).length;
      if (currentVisible === 0) return false;
    }

    const wasHidden = !!col.hidden;
    const willBeHidden = !visible;

    // Only refresh if visibility actually changed
    if (wasHidden !== willBeHidden) {
      // Update the hidden property on the column in effectiveConfig
      col.hidden = willBeHidden;

      // Emit event for consumer preference saving
      this.#emit('column-visibility', {
        field,
        visible,
        visibleColumns: (allCols ?? []).filter((c) => !c.hidden).map((c) => c.field),
      });

      // Clear row pool to force complete rebuild with new column count
      this._rowPool.length = 0;
      if (this._bodyEl) this._bodyEl.innerHTML = '';
      this.__rowRenderEpoch++;

      // Re-setup to rebuild columns with updated visibility
      this.#setup();

      // Trigger state change after visibility change
      this.requestStateChange();
      return true;
    }
    return false;
  }

  /**
   * Toggle the visibility of a column.
   * @param field - The field name of the column
   * @returns True if visibility was toggled, false if column not found or locked
   */
  toggleColumnVisibility(field: string): boolean {
    const allCols = this.#effectiveConfig.columns as ColumnInternal<T>[] | undefined;
    const col = allCols?.find((c) => c.field === field);
    const isCurrentlyHidden = !!col?.hidden;
    return this.setColumnVisible(field, isCurrentlyHidden);
  }

  /**
   * Check if a column is currently visible.
   * @param field - The field name of the column
   * @returns True if visible, false if hidden or not found
   */
  isColumnVisible(field: string): boolean {
    const allCols = this.#effectiveConfig.columns as ColumnInternal<T>[] | undefined;
    const col = allCols?.find((c) => c.field === field);
    return col ? !col.hidden : false;
  }

  /**
   * Show all columns.
   */
  showAllColumns(): void {
    const allCols = this.#effectiveConfig.columns as ColumnInternal<T>[] | undefined;
    const hasHidden = allCols?.some((c) => c.hidden);
    if (!hasHidden) return;

    // Clear hidden flag on all columns
    allCols?.forEach((c) => {
      c.hidden = false;
    });

    this.#emit('column-visibility', {
      visibleColumns: (allCols ?? []).map((c) => c.field),
    });

    // Clear row pool to force complete rebuild with new column count
    this._rowPool.length = 0;
    if (this._bodyEl) this._bodyEl.innerHTML = '';
    this.__rowRenderEpoch++;

    this.#setup();

    // Trigger state change after visibility change
    this.requestStateChange();
  }

  /**
   * Get list of all column fields (including hidden).
   * Returns columns reflecting current display order (after reordering).
   * Hidden columns are interleaved at their original relative positions.
   * @returns Array of all field names with their visibility status
   */
  getAllColumns(): Array<{ field: string; header: string; visible: boolean; lockVisible?: boolean }> {
    // effectiveConfig.columns is the single source of truth
    const allCols = (this.#effectiveConfig.columns ?? []) as ColumnInternal<T>[];

    // Return all columns with their current visibility state
    return allCols.map((c) => ({
      field: c.field,
      header: c.header || c.field,
      visible: !c.hidden,
      lockVisible: c.lockVisible,
    }));
  }

  /**
   * Reorder columns according to the specified field order.
   * This directly updates _columns in place without going through processColumns.
   * @param order - Array of field names in the desired order
   */
  setColumnOrder(order: string[]): void {
    if (!order.length) return;

    const columnMap = new Map<string, ColumnInternal<T>>(this._columns.map((c) => [c.field as string, c]));
    const reordered: ColumnInternal<T>[] = [];

    // Add columns in specified order
    for (const field of order) {
      const col = columnMap.get(field);
      if (col) {
        reordered.push(col);
        columnMap.delete(field);
      }
    }

    // Add any remaining columns not in order
    for (const col of columnMap.values()) {
      reordered.push(col);
    }

    this._columns = reordered;

    // Re-render with new order
    renderHeader(this);
    updateTemplate(this);
    this.refreshVirtualWindow(true);
  }

  /**
   * Get the current column order as an array of field names.
   * @returns Array of field names in display order
   */
  getColumnOrder(): string[] {
    return this._columns.map((c) => c.field);
  }

  // ---------------- Column State API ----------------

  /**
   * Get the current column state, including order, width, visibility, sort, and plugin state.
   * Returns a serializable object suitable for localStorage or database storage.
   */
  getColumnState(): GridColumnState {
    const plugins = this.#pluginManager?.getAll() ?? [];
    return collectColumnState(this, plugins as BaseGridPlugin[]);
  }

  /**
   * Set the column state, restoring order, width, visibility, sort, and plugin state.
   * Use this to restore previously saved column state.
   */
  set columnState(state: GridColumnState | undefined) {
    if (!state) return;

    // Store for use after initialization if called before ready
    this.#initialColumnState = state;

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
    // Clear hidden flags before applying state
    const allCols = (this.#effectiveConfig.columns ?? []) as ColumnInternal<T>[];
    allCols.forEach((c) => {
      c.hidden = false;
    });

    this.#applyColumnStateInternal(state);

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
    if (!this.#stateChangeHandler) {
      this.#stateChangeHandler = createStateChangeHandler(
        this,
        () => (this.#pluginManager?.getAll() ?? []) as BaseGridPlugin[],
        (state) => this.#emit('column-state-change', state),
      );
    }
    this.#stateChangeHandler();
  }

  /**
   * Reset column state to initial configuration.
   * Clears all user modifications (order, width, visibility, sort).
   */
  resetColumnState(): void {
    // Clear initial state
    this.#initialColumnState = undefined;

    // Clear hidden flag on all columns
    const allCols = (this.#effectiveConfig.columns ?? []) as ColumnInternal<T>[];
    allCols.forEach((c) => {
      c.hidden = false;
    });

    // Reset sort state
    this._sortState = null;
    this.__originalOrder = [];

    // Re-initialize columns from config
    this.#mergeEffectiveConfig();
    this.#setup();

    // Notify plugins to reset their state
    const plugins = (this.#pluginManager?.getAll() ?? []) as BaseGridPlugin[];
    for (const plugin of plugins) {
      if (plugin.applyColumnState) {
        // Pass empty state to indicate reset
        for (const col of this._columns) {
          plugin.applyColumnState(col.field, {
            field: col.field,
            order: 0,
            visible: true,
          });
        }
      }
    }

    // Emit state change
    this.requestStateChange();
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
    this.#shellController.registerToolPanel(panel);
  }

  /** Unregister a custom tool panel. */
  unregisterToolPanel(panelId: string): void {
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

  /** Get all registered toolbar buttons. */
  getToolbarButtons(): ToolbarButtonInfo[] {
    return this.#shellController.getToolbarButtons();
  }

  /** Register a custom toolbar button programmatically. */
  registerToolbarButton(button: ToolbarButtonConfig): void {
    this.#shellController.registerToolbarButton(button);
  }

  /** Unregister a custom toolbar button. */
  unregisterToolbarButton(buttonId: string): void {
    this.#shellController.unregisterToolbarButton(buttonId);
  }

  /** Enable/disable a toolbar button by ID. */
  setToolbarButtonDisabled(buttonId: string, disabled: boolean): void {
    this.#shellController.setToolbarButtonDisabled(buttonId, disabled);
  }

  /**
   * Re-parse light DOM shell elements and refresh shell header.
   * Call this after dynamically modifying <tbw-grid-header> children.
   */
  refreshShellHeader(): void {
    // Re-parse light DOM
    parseLightDomShell(this, this.#shellState);

    // Re-render the entire grid (shell structure may change)
    this.#render();
    this.#afterConnect();
  }

  // ---------------- Virtual Window ----------------
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
      this._bodyEl.style.transform = 'translateY(0px)';
      this.#renderVisibleRows(0, totalRows, force ? ++this.__rowRenderEpoch : this.__rowRenderEpoch);
      if (this._virtualization.totalHeightEl) {
        // Account for horizontal scrollbar height even in bypass mode
        const scrollAreaEl = this.#shadow.querySelector('.tbw-scroll-area') as HTMLElement;
        const hScrollbarHeight = scrollAreaEl ? scrollAreaEl.offsetHeight - scrollAreaEl.clientHeight : 0;
        this._virtualization.totalHeightEl.style.height = `${totalRows * this._virtualization.rowHeight + hScrollbarHeight}px`;
      }
      // Set ARIA counts on inner grid element (not host, which may contain shell chrome)
      const innerGrid = this.#shadow.querySelector('.rows-body');
      innerGrid?.setAttribute('aria-rowcount', String(totalRows));
      innerGrid?.setAttribute('aria-colcount', String(this._visibleColumns.length));
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
    // Add 1 extra row height to account for even-alignment: when we round down
    // from odd to even start, we need extra scroll range to reveal the last row
    // Also add footer height: faux-vscroll is outside .tbw-scroll-area so it doesn't
    // shrink when footer is present - we need extra spacer to scroll past the footer
    const footerEl = this.#shadow.querySelector('.tbw-footer') as HTMLElement;
    const footerHeight = footerEl?.offsetHeight ?? 0;
    // Add extra height from plugins (e.g., expanded master-detail rows)
    // This ensures the scrollbar range accounts for all content including expanded details
    const pluginExtraHeight = this.#pluginManager?.getExtraHeight() ?? 0;
    // Add horizontal scrollbar height: when horizontal scrollbar is visible in .tbw-scroll-area,
    // it takes space at the bottom that the faux vertical scrollbar doesn't account for.
    // Detect by comparing offsetHeight (includes scrollbar) vs clientHeight (excludes scrollbar).
    const scrollAreaEl = this.#shadow.querySelector('.tbw-scroll-area') as HTMLElement;
    const hScrollbarHeight = scrollAreaEl ? scrollAreaEl.offsetHeight - scrollAreaEl.clientHeight : 0;
    if (this._virtualization.totalHeightEl) {
      this._virtualization.totalHeightEl.style.height = `${
        totalRows * rowHeight + rowHeight + footerHeight + pluginExtraHeight + hScrollbarHeight
      }px`;
    }

    // Smooth scroll: apply offset for fluid motion
    // Since start is even-aligned, offset is distance from that aligned position
    // This creates smooth sliding while preserving zebra stripe parity
    // Account for extra heights (expanded details) before the start row
    const extraHeightBeforeStart = this.#pluginManager?.getExtraHeightBefore?.(start) ?? 0;
    const subPixelOffset = -(scrollTop - start * rowHeight - extraHeightBeforeStart);
    this._bodyEl.style.transform = `translateY(${subPixelOffset}px)`;

    this.#renderVisibleRows(start, end, force ? ++this.__rowRenderEpoch : this.__rowRenderEpoch);

    // Set ARIA counts on inner grid element (not host, which may contain shell chrome)
    const innerGrid = this.#shadow.querySelector('.rows-body');
    innerGrid?.setAttribute('aria-rowcount', String(totalRows));
    innerGrid?.setAttribute('aria-colcount', String(this._visibleColumns.length));

    // Only run plugin afterRender hooks on force refresh (structural changes)
    // Skip on scroll-triggered renders for maximum performance
    if (force) {
      this.#pluginManager?.afterRender();
    }
  }

  // ---------------- Render ----------------
  #render(): void {
    // Parse light DOM shell elements before rendering
    parseLightDomShell(this, this.#shellState);

    // Get shell config
    const shellConfig = this.#effectiveConfig?.shell;

    // Determine if shell should be rendered
    const hasShell = shouldRenderShellHeader(shellConfig, this.#shellState);

    // Core grid content HTML
    // Uses faux scrollbar pattern (like AG Grid) for smooth virtualized scrolling:
    // - .tbw-grid-content: outer container (row layout: scroll-area + faux-vscroll)
    // - .tbw-scroll-area: horizontal scroll container (overflow-x: auto) - footer appends here
    // - .rows-body-wrapper: header + rows in column layout
    // - .faux-vscroll: vertical scrollbar at inline-end, sticky during horizontal scroll
    // - .rows-viewport: visible rows area (no scroll, overflow hidden)
    // - Scroll events come from faux scrollbar, content positioned via transforms
    // This prevents blank viewport during fast scroll - old content stays until new renders
    const gridContentHtml = `
      <div class="tbw-scroll-area">
        <div class="rows-body-wrapper">
          <div class="rows-body" role="grid">
            <div class="header">
              <div class="header-row" part="header-row"></div>
            </div>
            <div class="rows-container">
              <div class="rows-viewport">
                <div class="rows"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="faux-vscroll">
        <div class="faux-vscroll-spacer"></div>
      </div>
    `;

    if (hasShell) {
      // Build shell DOM structure
      const toolPanelIcon = this.#effectiveConfig?.icons?.toolPanel ?? DEFAULT_GRID_ICONS.toolPanel;
      const accordionIcons = {
        expand: this.#effectiveConfig?.icons?.expand ?? DEFAULT_GRID_ICONS.expand,
        collapse: this.#effectiveConfig?.icons?.collapse ?? DEFAULT_GRID_ICONS.collapse,
      };
      const shellHeaderHtml = renderShellHeader(shellConfig, this.#shellState, toolPanelIcon);
      const shellBodyHtml = renderShellBody(shellConfig, this.#shellState, gridContentHtml, accordionIcons);

      this.#shadow.innerHTML = `
        <div class="tbw-grid-root has-shell">
          ${shellHeaderHtml}
          ${shellBodyHtml}
        </div>
      `;

      // Set up shell event listeners
      this.#setupShellListeners();

      // Mark shell as initialized
      this.#shellController.setInitialized(true);
    } else {
      // Build minimal DOM structure (no shell)
      // Wrap in .tbw-grid-content for consistent horizontal scroll behavior
      this.#shadow.innerHTML = `
        <div class="tbw-grid-root">
          <div class="tbw-grid-content">
            ${gridContentHtml}
          </div>
        </div>
      `;
    }
  }

  /**
   * Set up shell event listeners after render.
   */
  #setupShellListeners(): void {
    setupShellEventListeners(this.#shadow, this.#effectiveConfig?.shell, this.#shellState, {
      onPanelToggle: () => this.toggleToolPanel(),
      onSectionToggle: (sectionId: string) => this.toggleToolPanelSection(sectionId),
      onToolbarButtonClick: (buttonId) => this.#handleToolbarButtonClick(buttonId),
    });

    // Set up tool panel resize
    this.#resizeCleanup?.();
    this.#resizeCleanup = setupToolPanelResize(this.#shadow, this.#effectiveConfig?.shell, (width: number) => {
      // Update the CSS variable to persist the new width
      this.style.setProperty('--tbw-tool-panel-width', `${width}px`);
    });
  }

  /**
   * Handle toolbar button click (for config buttons with action).
   */
  #handleToolbarButtonClick(buttonId: string): void {
    // Check config buttons
    const configButtons = this.#effectiveConfig?.shell?.header?.toolbarButtons ?? [];
    const configBtn = configButtons.find((b) => b.id === buttonId);
    if (configBtn?.action) {
      configBtn.action();
      return;
    }

    // Check API-registered buttons
    const apiBtn = this.#shellState.toolbarButtons.get(buttonId);
    if (apiBtn?.action) {
      apiBtn.action();
    }
  }
}

// Self-registering custom element
if (!customElements.get(DataGridElement.tagName)) {
  customElements.define(DataGridElement.tagName, DataGridElement);
}

// Type augmentation for querySelector/createElement
declare global {
  interface HTMLElementTagNameMap {
    'tbw-grid': DataGridElement;
  }
}
