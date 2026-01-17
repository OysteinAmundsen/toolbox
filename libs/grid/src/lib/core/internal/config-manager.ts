/**
 * ConfigManager - Unified Configuration Lifecycle Management
 *
 * Manages all configuration concerns for the grid:
 * - Source collection (gridConfig, columns, attributes, Light DOM)
 * - Two-layer config (frozen original + mutable effective)
 * - State persistence (collect/apply/reset via diff)
 * - Change notification for re-rendering
 *
 * This is an internal module - grid.ts delegates to ConfigManager
 * but the public API remains unchanged.
 */

import type { BaseGridPlugin } from '../plugin';
import type {
  ColumnConfig,
  ColumnConfigMap,
  ColumnInternal,
  ColumnSortState,
  ColumnState,
  FitMode,
  GridColumnState,
  GridConfig,
  HeaderContentDefinition,
  ToolbarButtonConfig,
  ToolPanelDefinition,
} from '../types';
import { mergeColumns, parseLightDomColumns } from './columns';
import { inferColumns } from './inference';
import { compileTemplate } from './sanitize';

/** Debounce timeout for state change events */
const STATE_CHANGE_DEBOUNCE_MS = 100;

/**
 * Callbacks for ConfigManager to notify the grid of changes.
 */
export interface ConfigManagerCallbacks<T> {
  /** Get current rows for column inference */
  getRows: () => T[];
  /** Get current sort state */
  getSortState: () => { field: string; direction: 1 | -1 } | null;
  /** Set sort state */
  setSortState: (state: { field: string; direction: 1 | -1 } | null) => void;
  /** Notify that config changed and re-render is needed */
  onConfigChange: () => void;
  /** Emit a custom event */
  emit: (eventName: string, detail: unknown) => void;
  /** Clear row pool for visibility changes */
  clearRowPool: () => void;
  /** Run setup after state changes */
  setup: () => void;
  /** Render header */
  renderHeader: () => void;
  /** Update column template */
  updateTemplate: () => void;
  /** Refresh virtual window */
  refreshVirtualWindow: () => void;
  /** Get virtualization state for row height application */
  getVirtualization: () => { rowHeight: number };
  /** Set row height on virtualization state */
  setRowHeight: (height: number) => void;
  /** Apply animation config to host element */
  applyAnimationConfig: (config: GridConfig<T>) => void;
  /** Get light DOM title from shell state (synced from parseLightDomShell) */
  getShellLightDomTitle: () => string | null;
  /** Get registered tool panels from shell state */
  getShellToolPanels: () => Map<string, ToolPanelDefinition>;
  /** Get registered header contents from shell state */
  getShellHeaderContents: () => Map<string, HeaderContentDefinition>;
  /** Get registered toolbar buttons from shell state */
  getShellToolbarButtons: () => Map<string, ToolbarButtonConfig>;
  /** Get light DOM header content elements */
  getShellLightDomHeaderContent: () => HTMLElement[];
  /** Get whether a tool buttons container was found in light DOM */
  getShellHasToolButtonsContainer: () => boolean;
}

/**
 * ConfigManager handles all configuration lifecycle for the grid.
 *
 * Manages:
 * - Source collection (gridConfig, columns, attributes, Light DOM)
 * - Effective config (merged from all sources)
 * - State persistence (collectState, applyState, resetState)
 * - Column visibility and ordering
 */
export class ConfigManager<T = unknown> {
  // ============================================================================
  // Sources (raw input from user)
  // ============================================================================
  #gridConfig?: GridConfig<T>;
  #columns?: ColumnConfig<T>[] | ColumnConfigMap<T>;
  #fitMode?: FitMode;
  #editOn?: string | boolean;

  // Light DOM cache
  #lightDomColumnsCache?: ColumnInternal<T>[];
  #originalColumnNodes?: HTMLElement[];

  // ============================================================================
  // Two-Layer Config Architecture
  // ============================================================================
  /**
   * Original config (frozen) - Built from sources, never mutated.
   * This is the "canonical" config that sources compile into.
   * Used as the reset point for effectiveConfig.
   */
  #originalConfig: GridConfig<T> = {};

  /**
   * Effective config (mutable) - Cloned from original, runtime mutations here.
   * This is what rendering reads from.
   * Runtime changes: hidden, width, sort order, column order.
   */
  #effectiveConfig: GridConfig<T> = {};

  // ============================================================================
  // State Tracking
  // ============================================================================
  #sourcesChanged = true;
  #changeListeners: Array<() => void> = [];
  #lightDomObserver?: MutationObserver;
  #stateChangeTimeoutId?: ReturnType<typeof setTimeout>;
  #initialColumnState?: GridColumnState;
  #callbacks: ConfigManagerCallbacks<T>;

  // Shell state (Light DOM title)
  #lightDomTitle?: string;

  constructor(callbacks: ConfigManagerCallbacks<T>) {
    this.#callbacks = callbacks;
  }

  // ============================================================================
  // Getters for Grid Access
  // ============================================================================

  /** Get the frozen original config (compiled from sources, immutable) */
  get original(): GridConfig<T> {
    return this.#originalConfig;
  }

  /** Get the mutable effective config (current runtime state) */
  get effective(): GridConfig<T> {
    return this.#effectiveConfig;
  }

  /** Get columns from effective config */
  get columns(): ColumnInternal<T>[] {
    return (this.#effectiveConfig.columns ?? []) as ColumnInternal<T>[];
  }

  /** Set columns on effective config */
  set columns(value: ColumnInternal<T>[]) {
    this.#effectiveConfig.columns = value as ColumnConfig<T>[];
  }

  /** Get light DOM columns cache */
  get lightDomColumnsCache(): ColumnInternal<T>[] | undefined {
    return this.#lightDomColumnsCache;
  }

  /** Set light DOM columns cache */
  set lightDomColumnsCache(value: ColumnInternal<T>[] | undefined) {
    this.#lightDomColumnsCache = value;
  }

  /** Get original column nodes */
  get originalColumnNodes(): HTMLElement[] | undefined {
    return this.#originalColumnNodes;
  }

  /** Set original column nodes */
  set originalColumnNodes(value: HTMLElement[] | undefined) {
    this.#originalColumnNodes = value;
  }

  /** Get light DOM title */
  get lightDomTitle(): string | undefined {
    return this.#lightDomTitle;
  }

  /** Set light DOM title */
  set lightDomTitle(value: string | undefined) {
    this.#lightDomTitle = value;
  }

  /** Get initial column state */
  get initialColumnState(): GridColumnState | undefined {
    return this.#initialColumnState;
  }

  /** Set initial column state */
  set initialColumnState(value: GridColumnState | undefined) {
    this.#initialColumnState = value;
  }

  // ============================================================================
  // Source Management
  // ============================================================================

  /**
   * Check if sources have changed since last merge.
   */
  get sourcesChanged(): boolean {
    return this.#sourcesChanged;
  }

  /**
   * Mark that sources have changed and need re-merging.
   * Call this when external state (shell maps, etc.) that feeds into
   * collectAllSources() has been updated.
   */
  markSourcesChanged(): void {
    this.#sourcesChanged = true;
  }

  // ============================================================================
  // Source Setters (mark dirty)
  // ============================================================================

  /** Set gridConfig source */
  setGridConfig(config: GridConfig<T> | undefined): void {
    this.#gridConfig = config;
    this.#sourcesChanged = true;
    // Clear light DOM cache for framework async content
    this.#lightDomColumnsCache = undefined;
  }

  /** Get the raw gridConfig source */
  getGridConfig(): GridConfig<T> | undefined {
    return this.#gridConfig;
  }

  /** Set columns source */
  setColumns(columns: ColumnConfig<T>[] | ColumnConfigMap<T> | undefined): void {
    this.#columns = columns;
    this.#sourcesChanged = true;
  }

  /** Get the raw columns source */
  getColumns(): ColumnConfig<T>[] | ColumnConfigMap<T> | undefined {
    return this.#columns;
  }

  /** Set fitMode source */
  setFitMode(mode: FitMode | undefined): void {
    this.#fitMode = mode;
    this.#sourcesChanged = true;
  }

  /** Get the raw fitMode source */
  getFitMode(): FitMode | undefined {
    return this.#fitMode;
  }

  /** Set editOn source */
  setEditOn(editOn: string | boolean | undefined): void {
    this.#editOn = editOn;
    this.#sourcesChanged = true;
  }

  /** Get the raw editOn source */
  getEditOn(): string | boolean | undefined {
    return this.#editOn;
  }

  // ============================================================================
  // Config Lifecycle
  // ============================================================================

  /**
   * Merge all sources into effective config.
   * Also applies post-merge operations (rowHeight, fixed mode widths, animation).
   *
   * Called by RenderScheduler's mergeConfig phase.
   *
   * Two-layer architecture:
   * 1. Sources → #originalConfig (frozen, immutable)
   * 2. Clone → #effectiveConfig (mutable, runtime changes)
   *
   * When sources change, both layers are rebuilt.
   * When sources haven't changed AND columns exist, this is a no-op.
   * Runtime mutations only affect effectiveConfig.
   * resetState() clones originalConfig back to effectiveConfig.
   */
  merge(): void {
    // Only rebuild when sources have actually changed.
    // Exception: always rebuild if we don't have columns yet (inference may be needed)
    const hasColumns = (this.#effectiveConfig.columns?.length ?? 0) > 0;
    if (!this.#sourcesChanged && hasColumns) {
      return; // effectiveConfig is already valid
    }

    // Build config from all sources
    const base = this.#collectAllSources();

    // Mark sources as processed
    this.#sourcesChanged = false;

    // Freeze as the new original config (immutable reference point)
    this.#originalConfig = base;
    Object.freeze(this.#originalConfig);
    if (this.#originalConfig.columns) {
      // Deep freeze columns array (but not the column objects themselves,
      // as we need effectiveConfig columns to be mutable)
      Object.freeze(this.#originalConfig.columns);
    }

    // Clone to effective config (mutable copy for runtime changes)
    this.#effectiveConfig = this.#cloneConfig(this.#originalConfig);

    // Apply post-merge operations to effectiveConfig
    this.#applyPostMergeOperations();
  }

  /**
   * Deep clone a config object, handling functions (renderers, editors).
   * Uses structuredClone where possible, with fallback for function properties.
   */
  #cloneConfig(config: GridConfig<T>): GridConfig<T> {
    // Can't use structuredClone because config may contain functions
    const clone: GridConfig<T> = { ...config };

    // Deep clone columns (they may have runtime-mutable state)
    if (config.columns) {
      clone.columns = config.columns.map((col) => ({ ...col }));
    }

    // Deep clone shell if present
    if (config.shell) {
      clone.shell = {
        ...config.shell,
        header: config.shell.header ? { ...config.shell.header } : undefined,
        toolPanel: config.shell.toolPanel ? { ...config.shell.toolPanel } : undefined,
        toolPanels: config.shell.toolPanels?.map((p) => ({ ...p })),
        headerContents: config.shell.headerContents?.map((h) => ({ ...h })),
      };
    }

    return clone;
  }

  /**
   * Apply operations that depend on the merged effective config.
   * These were previously in grid.ts #mergeEffectiveConfig().
   */
  #applyPostMergeOperations(): void {
    const config = this.#effectiveConfig;

    // Apply rowHeight from config if specified
    if (config.rowHeight && config.rowHeight > 0) {
      this.#callbacks.setRowHeight(config.rowHeight);
    }

    // If fixed mode and width not specified: assign default 80px
    if (config.fitMode === 'fixed') {
      const columns = this.columns;
      columns.forEach((c) => {
        if (c.width == null) c.width = 80;
      });
    }

    // Apply animation configuration to host element
    this.#callbacks.applyAnimationConfig(config);
  }

  /**
   * Collect all sources into a single config object.
   * This is the core merge logic extracted from grid.ts #mergeEffectiveConfig.
   *
   * Collects all sources into a canonical config object.
   * This becomes the frozen #originalConfig.
   *
   * Sources (in order of precedence, low to high):
   * 1. gridConfig.columns
   * 2. Light DOM columns (merged with config columns)
   * 3. columns prop (overrides if set)
   * 4. Inferred columns (if still empty)
   *
   * Runtime state (hidden, width) is NOT preserved here - that's in effectiveConfig.
   */
  #collectAllSources(): GridConfig<T> {
    const base: GridConfig<T> = this.#gridConfig ? { ...this.#gridConfig } : {};
    const configColumns: ColumnConfig<T>[] = Array.isArray(base.columns) ? [...base.columns] : [];

    // Light DOM cached parse - clone to avoid mutation
    const domCols: ColumnConfig<T>[] = (this.#lightDomColumnsCache ?? []).map((c) => ({
      ...c,
    })) as ColumnConfig<T>[];

    // Use mergeColumns to combine config columns with light DOM columns
    // This handles all the complex merge logic including templates and renderers
    let columns: ColumnInternal<T>[] = mergeColumns(
      configColumns as ColumnInternal<T>[],
      domCols as ColumnInternal<T>[],
    ) as ColumnInternal<T>[];

    // Columns prop highest structural precedence (overrides merged result)
    if (this.#columns && (this.#columns as ColumnConfig<T>[]).length) {
      // When columns prop is set, merge with light DOM columns for renderers/templates
      columns = mergeColumns(
        this.#columns as ColumnInternal<T>[],
        domCols as ColumnInternal<T>[],
      ) as ColumnInternal<T>[];
    }

    // Inference if still empty
    const rows = this.#callbacks.getRows();
    if (columns.length === 0 && rows.length) {
      const result = inferColumns(rows as Record<string, unknown>[]);
      columns = result.columns as ColumnInternal<T>[];
    }

    if (columns.length) {
      // Apply per-column defaults
      columns.forEach((c) => {
        if (c.sortable === undefined) c.sortable = true;
        if (c.resizable === undefined) c.resizable = true;
        if (c.__originalWidth === undefined && typeof c.width === 'number') {
          c.__originalWidth = c.width;
        }
      });

      // Compile inline templates (from light DOM <template> elements)
      columns.forEach((c) => {
        if (c.__viewTemplate && !c.__compiledView) {
          c.__compiledView = compileTemplate((c.__viewTemplate as HTMLElement).innerHTML);
        }
        if (c.__editorTemplate && !c.__compiledEditor) {
          c.__compiledEditor = compileTemplate(c.__editorTemplate.innerHTML);
        }
      });

      base.columns = columns as ColumnConfig<T>[];
    }

    // Individual prop overrides
    if (this.#fitMode) base.fitMode = this.#fitMode;
    if (!base.fitMode) base.fitMode = 'stretch';
    if (this.#editOn) base.editOn = this.#editOn;

    // ========================================================================
    // Merge shell configuration from ShellState into effectiveConfig.shell
    // This ensures a single source of truth for all shell config
    // ========================================================================
    this.#mergeShellConfig(base);

    // Store columnState from gridConfig if not already set
    if (base.columnState && !this.#initialColumnState) {
      this.#initialColumnState = base.columnState;
    }

    return base;
  }

  /**
   * Merge shell state into base config's shell property.
   * Ensures effectiveConfig.shell is the single source of truth.
   *
   * IMPORTANT: This method must NOT mutate the original gridConfig.
   * We shallow-clone the shell hierarchy to avoid side effects.
   */
  #mergeShellConfig(base: GridConfig<T>): void {
    // Clone shell hierarchy to avoid mutating original gridConfig
    // base.shell may still reference this.#gridConfig.shell, so we need fresh objects
    base.shell = base.shell ? { ...base.shell } : {};
    base.shell.header = base.shell.header ? { ...base.shell.header } : {};

    // Sync light DOM title
    const shellLightDomTitle = this.#callbacks.getShellLightDomTitle();
    if (shellLightDomTitle) {
      this.#lightDomTitle = shellLightDomTitle;
    }
    if (this.#lightDomTitle && !base.shell.header.title) {
      base.shell.header.title = this.#lightDomTitle;
    }

    // Sync light DOM header content elements
    const lightDomHeaderContent = this.#callbacks.getShellLightDomHeaderContent();
    if (lightDomHeaderContent?.length > 0) {
      base.shell.header.lightDomContent = lightDomHeaderContent;
    }

    // Sync hasToolButtonsContainer from shell state
    if (this.#callbacks.getShellHasToolButtonsContainer()) {
      base.shell.header.hasToolButtonsContainer = true;
    }

    // Sync tool panels (from plugins + API + Light DOM)
    const toolPanelsMap = this.#callbacks.getShellToolPanels();
    if (toolPanelsMap.size > 0) {
      const panels = Array.from(toolPanelsMap.values());
      // Sort by order (lower = first, default 100)
      panels.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
      base.shell.toolPanels = panels;
    }

    // Sync header contents (from plugins + API)
    const headerContentsMap = this.#callbacks.getShellHeaderContents();
    if (headerContentsMap.size > 0) {
      const contents = Array.from(headerContentsMap.values());
      // Sort by order
      contents.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
      base.shell.headerContents = contents;
    }

    // Sync toolbar buttons (from API - config buttons are already in base.shell.header.toolbarButtons)
    // We need to merge config buttons (from gridConfig) with API buttons (from registerToolbarButton)
    // API buttons can be added/removed dynamically, so we need to rebuild from current state each time
    const toolbarButtonsMap = this.#callbacks.getShellToolbarButtons();
    const apiButtons = Array.from(toolbarButtonsMap.values());

    // Get ORIGINAL config buttons (from gridConfig, not from previous merges)
    // We use a fresh read from gridConfig to avoid accumulating stale API buttons
    const originalConfigButtons = this.#gridConfig?.shell?.header?.toolbarButtons ?? [];

    // Merge: config buttons + API buttons (config takes precedence by id)
    const configIds = new Set(originalConfigButtons.map((b) => b.id));
    const mergedButtons = [...originalConfigButtons];
    for (const btn of apiButtons) {
      if (!configIds.has(btn.id)) {
        mergedButtons.push(btn);
      }
    }

    // Sort by order
    mergedButtons.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
    base.shell.header.toolbarButtons = mergedButtons;
  }

  // ============================================================================
  // State Persistence (Replaces column-state.ts)
  // ============================================================================

  /**
   * Collect current column state by diffing original vs effective.
   * Returns only the changes from the original configuration.
   */
  collectState(plugins: BaseGridPlugin[]): GridColumnState {
    const columns = this.columns;
    const sortStates = this.#getSortState();

    return {
      columns: columns.map((col, index) => {
        const state: ColumnState = {
          field: col.field,
          order: index,
          visible: !col.hidden,
        };

        // Include width if set
        const internalCol = col as ColumnInternal<T>;
        if (internalCol.__renderedWidth !== undefined) {
          state.width = internalCol.__renderedWidth;
        } else if (col.width !== undefined) {
          state.width = typeof col.width === 'string' ? parseFloat(col.width) : col.width;
        }

        // Include sort state
        const sortState = sortStates.get(col.field);
        if (sortState) {
          state.sort = sortState;
        }

        // Collect from plugins
        for (const plugin of plugins) {
          if (plugin.getColumnState) {
            const pluginState = plugin.getColumnState(col.field);
            if (pluginState) {
              Object.assign(state, pluginState);
            }
          }
        }

        return state;
      }),
    };
  }

  /**
   * Apply column state to the grid.
   */
  applyState(state: GridColumnState, plugins: BaseGridPlugin[]): void {
    if (!state.columns || state.columns.length === 0) return;

    const allColumns = this.columns;
    const stateMap = new Map(state.columns.map((s) => [s.field, s]));

    // Apply width and visibility
    const updatedColumns = allColumns.map((col) => {
      const s = stateMap.get(col.field);
      if (!s) return col;

      const updated: ColumnInternal<T> = { ...col };

      if (s.width !== undefined) {
        updated.width = s.width;
        updated.__renderedWidth = s.width;
      }

      if (s.visible !== undefined) {
        updated.hidden = !s.visible;
      }

      return updated;
    });

    // Reorder columns
    updatedColumns.sort((a, b) => {
      const orderA = stateMap.get(a.field)?.order ?? Infinity;
      const orderB = stateMap.get(b.field)?.order ?? Infinity;
      return orderA - orderB;
    });

    this.columns = updatedColumns;

    // Apply sort state
    const sortedByPriority = state.columns
      .filter((s) => s.sort !== undefined)
      .sort((a, b) => (a.sort?.priority ?? 0) - (b.sort?.priority ?? 0));

    if (sortedByPriority.length > 0) {
      const primarySort = sortedByPriority[0];
      if (primarySort.sort) {
        this.#callbacks.setSortState({
          field: primarySort.field,
          direction: primarySort.sort.direction === 'asc' ? 1 : -1,
        });
      }
    } else {
      this.#callbacks.setSortState(null);
    }

    // Let plugins apply their state
    for (const plugin of plugins) {
      if (plugin.applyColumnState) {
        for (const colState of state.columns) {
          plugin.applyColumnState(colState.field, colState);
        }
      }
    }
  }

  /**
   * Reset state to original configuration.
   *
   * Two-layer architecture: Clones #originalConfig back to #effectiveConfig.
   * This discards all runtime changes (hidden, width, order) and restores
   * the state to what was compiled from sources.
   */
  resetState(plugins: BaseGridPlugin[]): void {
    // Clear initial state
    this.#initialColumnState = undefined;

    // Reset sort state
    this.#callbacks.setSortState(null);

    // Clone original config back to effective (discards all runtime changes)
    this.#effectiveConfig = this.#cloneConfig(this.#originalConfig);

    // Apply post-merge operations (rowHeight, fixed mode widths, animation)
    this.#applyPostMergeOperations();

    // Notify plugins to reset
    for (const plugin of plugins) {
      if (plugin.applyColumnState) {
        for (const col of this.columns) {
          plugin.applyColumnState(col.field, {
            field: col.field,
            order: 0,
            visible: true,
          });
        }
      }
    }

    // Request state change notification
    this.requestStateChange(plugins);
  }

  /**
   * Get sort state as a map.
   */
  #getSortState(): Map<string, ColumnSortState> {
    const sortMap = new Map<string, ColumnSortState>();
    const sortState = this.#callbacks.getSortState();

    if (sortState) {
      sortMap.set(sortState.field, {
        direction: sortState.direction === 1 ? 'asc' : 'desc',
        priority: 0,
      });
    }

    return sortMap;
  }

  /**
   * Request a debounced state change event.
   */
  requestStateChange(plugins: BaseGridPlugin[]): void {
    if (this.#stateChangeTimeoutId) {
      clearTimeout(this.#stateChangeTimeoutId);
    }

    this.#stateChangeTimeoutId = setTimeout(() => {
      this.#stateChangeTimeoutId = undefined;
      const state = this.collectState(plugins);
      this.#callbacks.emit('column-state-change', state);
    }, STATE_CHANGE_DEBOUNCE_MS);
  }

  // ============================================================================
  // Column Visibility API
  // ============================================================================

  /**
   * Set the visibility of a column.
   * @returns true if visibility changed, false otherwise
   */
  setColumnVisible(field: string, visible: boolean): boolean {
    const allCols = this.columns;
    const col = allCols.find((c) => c.field === field);

    if (!col) return false;
    if (!visible && col.lockVisible) return false;

    // Ensure at least one column remains visible
    if (!visible) {
      const remainingVisible = allCols.filter((c) => !c.hidden && c.field !== field).length;
      if (remainingVisible === 0) return false;
    }

    const wasHidden = !!col.hidden;
    if (wasHidden === !visible) return false; // No change

    col.hidden = !visible;

    this.#callbacks.emit('column-visibility', {
      field,
      visible,
      visibleColumns: allCols.filter((c) => !c.hidden).map((c) => c.field),
    });

    this.#callbacks.clearRowPool();
    this.#callbacks.setup();

    return true;
  }

  /**
   * Toggle column visibility.
   */
  toggleColumnVisibility(field: string): boolean {
    const col = this.columns.find((c) => c.field === field);
    return col ? this.setColumnVisible(field, !!col.hidden) : false;
  }

  /**
   * Check if a column is visible.
   */
  isColumnVisible(field: string): boolean {
    const col = this.columns.find((c) => c.field === field);
    return col ? !col.hidden : false;
  }

  /**
   * Show all columns.
   */
  showAllColumns(): void {
    const allCols = this.columns;
    if (!allCols.some((c) => c.hidden)) return;

    allCols.forEach((c) => (c.hidden = false));

    this.#callbacks.emit('column-visibility', {
      visibleColumns: allCols.map((c) => c.field),
    });

    this.#callbacks.clearRowPool();
    this.#callbacks.setup();
  }

  /**
   * Get all columns with visibility info.
   */
  getAllColumns(): Array<{
    field: string;
    header: string;
    visible: boolean;
    lockVisible?: boolean;
    utility?: boolean;
  }> {
    return this.columns.map((c) => ({
      field: c.field,
      header: c.header || c.field,
      visible: !c.hidden,
      lockVisible: c.lockVisible,
      utility: c.meta?.utility,
    }));
  }

  /**
   * Get current column order.
   */
  getColumnOrder(): string[] {
    return this.columns.map((c) => c.field);
  }

  /**
   * Set column order.
   */
  setColumnOrder(order: string[]): void {
    if (!order.length) return;

    const columnMap = new Map(this.columns.map((c) => [c.field as string, c]));
    const reordered: ColumnInternal<T>[] = [];

    for (const field of order) {
      const col = columnMap.get(field);
      if (col) {
        reordered.push(col);
        columnMap.delete(field);
      }
    }

    // Add remaining columns not in order
    for (const col of columnMap.values()) {
      reordered.push(col);
    }

    this.columns = reordered;

    this.#callbacks.renderHeader();
    this.#callbacks.updateTemplate();
    this.#callbacks.refreshVirtualWindow();
  }

  // ============================================================================
  // Light DOM Observer
  // ============================================================================

  /**
   * Parse light DOM columns from host element.
   */
  parseLightDomColumns(host: HTMLElement): void {
    if (!this.#lightDomColumnsCache) {
      this.#originalColumnNodes = Array.from(host.querySelectorAll('tbw-grid-column')) as HTMLElement[];
      this.#lightDomColumnsCache = this.#originalColumnNodes.length ? parseLightDomColumns(host) : [];
    }
  }

  /**
   * Clear the light DOM columns cache.
   */
  clearLightDomCache(): void {
    this.#lightDomColumnsCache = undefined;
  }

  /**
   * Registered Light DOM element handlers.
   * Maps element tag names to callbacks that are invoked when those elements change.
   *
   * This is a generic mechanism - plugins (or future ShellPlugin) register
   * what elements they care about and handle parsing themselves.
   */
  #lightDomHandlers: Map<string, () => void> = new Map();

  /**
   * Register a handler for Light DOM element changes.
   * When elements matching the tag name are added/removed/changed,
   * the callback will be invoked (debounced).
   *
   * @param tagName - The lowercase tag name to watch (e.g., 'tbw-grid-header')
   * @param callback - Called when matching elements change
   */
  registerLightDomHandler(tagName: string, callback: () => void): void {
    this.#lightDomHandlers.set(tagName.toLowerCase(), callback);
  }

  /**
   * Unregister a Light DOM element handler.
   */
  unregisterLightDomHandler(tagName: string): void {
    this.#lightDomHandlers.delete(tagName.toLowerCase());
  }

  /**
   * Set up MutationObserver to watch for Light DOM changes.
   * This is generic infrastructure - specific handling is done via registered handlers.
   *
   * When Light DOM elements are added/removed/changed, the observer:
   * 1. Identifies which registered tag names were affected
   * 2. Debounces multiple mutations into a single callback per handler
   * 3. Invokes the registered callbacks
   *
   * This mechanism allows plugins to register their own Light DOM elements
   * and handle parsing themselves, then hand config to ConfigManager.
   *
   * @param host - The host element to observe (the grid element)
   */
  observeLightDOM(host: HTMLElement): void {
    // Clean up any existing observer
    if (this.#lightDomObserver) {
      this.#lightDomObserver.disconnect();
    }

    // Track which handlers need to be called (debounced)
    const pendingCallbacks = new Set<string>();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const processPendingCallbacks = () => {
      debounceTimer = null;
      for (const tagName of pendingCallbacks) {
        const handler = this.#lightDomHandlers.get(tagName);
        handler?.();
      }
      pendingCallbacks.clear();
    };

    this.#lightDomObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Check added nodes
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          const el = node as Element;
          const tagName = el.tagName.toLowerCase();

          // Check if any handler is interested in this element
          if (this.#lightDomHandlers.has(tagName)) {
            pendingCallbacks.add(tagName);
          }
        }

        // Check for attribute changes
        if (mutation.type === 'attributes' && mutation.target.nodeType === Node.ELEMENT_NODE) {
          const el = mutation.target as Element;
          const tagName = el.tagName.toLowerCase();
          if (this.#lightDomHandlers.has(tagName)) {
            pendingCallbacks.add(tagName);
          }
        }
      }

      // Debounce - batch all mutations into single callbacks
      if (pendingCallbacks.size > 0 && !debounceTimer) {
        debounceTimer = setTimeout(processPendingCallbacks, 0);
      }
    });

    // Observe children and their attributes
    this.#lightDomObserver.observe(host, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['title', 'field', 'header', 'width', 'hidden', 'id', 'icon', 'tooltip', 'order'],
    });
  }

  // ============================================================================
  // Change Notification
  // ============================================================================

  /**
   * Register a change listener.
   */
  onChange(callback: () => void): void {
    this.#changeListeners.push(callback);
  }

  /**
   * Notify all change listeners.
   */
  notifyChange(): void {
    for (const cb of this.#changeListeners) {
      cb();
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Dispose of the ConfigManager and clean up resources.
   */
  dispose(): void {
    this.#lightDomObserver?.disconnect();
    this.#changeListeners = [];
    if (this.#stateChangeTimeoutId) {
      clearTimeout(this.#stateChangeTimeoutId);
    }
  }
}
