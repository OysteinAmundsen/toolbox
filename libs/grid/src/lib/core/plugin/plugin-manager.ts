/**
 * Plugin Manager
 *
 * Manages plugin instances for a single grid.
 * Each grid has its own PluginManager with its own set of plugin instances.
 *
 * **Plugin Order Matters**: Plugins are executed in the order they appear in the
 * `plugins` array. This affects the order of hook execution (processRows, processColumns,
 * afterRender, etc.). For example, if you want filtering to run before grouping,
 * add FilteringPlugin before GroupingRowsPlugin in the array.
 */

import { isDevelopment } from '../internal/utils';
import { validatePluginDependencies } from '../internal/validate-config';
import type { ColumnConfig } from '../types';
import type {
  AfterCellRenderContext,
  AfterRowRenderContext,
  BaseGridPlugin,
  CellClickEvent,
  CellEditor,
  CellMouseEvent,
  CellRenderer,
  GridElement,
  HeaderClickEvent,
  HeaderRenderer,
  PluginQuery,
  RowClickEvent,
  ScrollEvent,
} from './base-plugin';

/**
 * Manages plugins for a single grid instance.
 *
 * Plugins are executed in array order. This is intentional and documented behavior.
 * Place plugins in the order you want their hooks to execute.
 */
export class PluginManager {
  // #region Properties
  /** Plugin instances in order of attachment */
  private plugins: BaseGridPlugin[] = [];

  /** Get all registered plugins (read-only) */
  getPlugins(): readonly BaseGridPlugin[] {
    return this.plugins;
  }

  /** Map from plugin class to instance for fast lookup */
  private pluginMap: Map<new (...args: unknown[]) => BaseGridPlugin, BaseGridPlugin> = new Map();

  /** Cell renderers registered by plugins */
  private cellRenderers: Map<string, CellRenderer> = new Map();

  /** Header renderers registered by plugins */
  private headerRenderers: Map<string, HeaderRenderer> = new Map();

  /** Cell editors registered by plugins */
  private cellEditors: Map<string, CellEditor> = new Map();
  // #endregion

  // #region Event Bus State
  /**
   * Event listeners indexed by event type.
   * Maps event type → Map<plugin instance → callback>.
   * Using plugin instance as key enables auto-cleanup on detach.
   */
  private eventListeners: Map<string, Map<BaseGridPlugin, (detail: unknown) => void>> = new Map();
  // #endregion

  // #region Query System State
  /**
   * Query handlers indexed by query type.
   * Maps query type → Set of plugin instances that declare handling it.
   * Built from manifest.queries during plugin attach.
   */
  private queryHandlers: Map<string, Set<BaseGridPlugin>> = new Map();
  // #endregion

  // #region Deprecation Warnings
  /** Set of plugin constructors that have been warned about deprecated hooks */
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- WeakSet key is plugin.constructor identity
  private static deprecationWarned = new WeakSet<Function>();
  // #endregion

  // #region Lifecycle
  constructor(private grid: GridElement) {}

  /**
   * Attach all plugins from the config.
   */
  attachAll(plugins: BaseGridPlugin[]): void {
    for (const plugin of plugins) {
      this.attach(plugin);
    }
  }

  /**
   * Attach a plugin to this grid.
   * Validates dependencies and notifies other plugins of the new attachment.
   */
  attach(plugin: BaseGridPlugin): void {
    // Validate plugin dependencies BEFORE attaching
    // This throws if a required dependency is missing
    validatePluginDependencies(plugin, this.plugins);

    // Store by constructor for type-safe lookup
    this.pluginMap.set(plugin.constructor as new (...args: unknown[]) => BaseGridPlugin, plugin);
    this.plugins.push(plugin);

    // Register renderers/editors
    if (plugin.cellRenderers) {
      for (const [type, renderer] of Object.entries(plugin.cellRenderers)) {
        this.cellRenderers.set(type, renderer);
      }
    }
    if (plugin.headerRenderers) {
      for (const [type, renderer] of Object.entries(plugin.headerRenderers)) {
        this.headerRenderers.set(type, renderer);
      }
    }
    if (plugin.cellEditors) {
      for (const [type, editor] of Object.entries(plugin.cellEditors)) {
        this.cellEditors.set(type, editor);
      }
    }

    // Register query handlers from manifest
    this.registerQueryHandlers(plugin);

    // Warn about deprecated hooks (once per plugin class)
    this.warnDeprecatedHooks(plugin);

    // Call attach lifecycle method
    plugin.attach(this.grid);

    // Notify existing plugins of the new attachment
    for (const existingPlugin of this.plugins) {
      if (existingPlugin !== plugin && existingPlugin.onPluginAttached) {
        existingPlugin.onPluginAttached(plugin.name, plugin);
      }
    }
  }

  /**
   * Register query handlers from a plugin's manifest.
   */
  private registerQueryHandlers(plugin: BaseGridPlugin): void {
    const PluginClass = plugin.constructor as typeof BaseGridPlugin;
    const manifest = PluginClass.manifest;
    if (!manifest?.queries) return;

    for (const queryDef of manifest.queries) {
      let handlers = this.queryHandlers.get(queryDef.type);
      if (!handlers) {
        handlers = new Set();
        this.queryHandlers.set(queryDef.type, handlers);
      }
      handlers.add(plugin);
    }
  }

  /**
   * Warn about deprecated plugin hooks.
   * Only warns once per plugin class, only in development environments.
   */
  private warnDeprecatedHooks(plugin: BaseGridPlugin): void {
    const PluginClass = plugin.constructor;

    // Skip if already warned for this plugin class
    if (PluginManager.deprecationWarned.has(PluginClass)) return;

    // Only warn in development
    if (!isDevelopment()) return;

    const hasOldHooks =
      typeof plugin.getExtraHeight === 'function' || typeof plugin.getExtraHeightBefore === 'function';

    const hasNewHook = typeof plugin.getRowHeight === 'function';

    // Warn if using old hooks without new hook
    if (hasOldHooks && !hasNewHook) {
      PluginManager.deprecationWarned.add(PluginClass);
      console.warn(
        `[tbw-grid] Deprecation warning: "${plugin.name}" uses getExtraHeight() / getExtraHeightBefore() ` +
          `which are deprecated and will be removed in v3.0.\n` +
          `  → Migrate to getRowHeight(row, index) for better variable row height support.\n` +
          `  → See: https://toolbox-web.dev/docs/grid/plugins/migration#row-height-hooks`,
      );
    }
  }

  /**
   * Unregister query handlers for a plugin.
   */
  private unregisterQueryHandlers(plugin: BaseGridPlugin): void {
    for (const [queryType, handlers] of this.queryHandlers) {
      handlers.delete(plugin);
      if (handlers.size === 0) {
        this.queryHandlers.delete(queryType);
      }
    }
  }

  /**
   * Detach all plugins and clean up.
   * Notifies plugins of detachment via onPluginDetached hook.
   */
  detachAll(): void {
    // Notify all plugins before detaching (in forward order)
    for (const plugin of this.plugins) {
      for (const otherPlugin of this.plugins) {
        if (otherPlugin !== plugin && otherPlugin.onPluginDetached) {
          otherPlugin.onPluginDetached(plugin.name);
        }
      }
    }

    // Detach in reverse order
    for (let i = this.plugins.length - 1; i >= 0; i--) {
      const plugin = this.plugins[i];
      this.unsubscribeAll(plugin); // Clean up event subscriptions
      this.unregisterQueryHandlers(plugin); // Clean up query handlers
      plugin.detach();
    }
    this.plugins = [];
    this.pluginMap.clear();
    this.cellRenderers.clear();
    this.headerRenderers.clear();
    this.cellEditors.clear();
    this.eventListeners.clear();
    this.queryHandlers.clear();
  }
  // #endregion

  // #region Plugin Lookup
  /**
   * Get a plugin instance by its class.
   */
  getPlugin<T extends BaseGridPlugin>(PluginClass: new (...args: any[]) => T): T | undefined {
    return this.pluginMap.get(PluginClass) as T | undefined;
  }

  /**
   * Get a plugin instance by its name.
   */
  getPluginByName(name: string): BaseGridPlugin | undefined {
    return this.plugins.find((p) => p.name === name);
  }

  /**
   * Check if a plugin is attached.
   */
  hasPlugin<T extends BaseGridPlugin>(PluginClass: new (...args: any[]) => T): boolean {
    return this.pluginMap.has(PluginClass);
  }

  /**
   * Get all attached plugins.
   */
  getAll(): readonly BaseGridPlugin[] {
    return this.plugins;
  }

  /**
   * Get names of all registered plugins (for debugging).
   */
  getRegisteredPluginNames(): string[] {
    return this.plugins.map((p) => p.name);
  }
  // #endregion

  // #region Renderers & Styles
  /**
   * Get a cell renderer by type name.
   */
  getCellRenderer(type: string): CellRenderer | undefined {
    return this.cellRenderers.get(type);
  }

  /**
   * Get a header renderer by type name.
   */
  getHeaderRenderer(type: string): HeaderRenderer | undefined {
    return this.headerRenderers.get(type);
  }

  /**
   * Get a cell editor by type name.
   */
  getCellEditor(type: string): CellEditor | undefined {
    return this.cellEditors.get(type);
  }

  /**
   * Get all CSS styles from all plugins as structured data.
   * Returns an array of { name, styles } for each plugin with styles.
   */
  getPluginStyles(): Array<{ name: string; styles: string }> {
    return this.plugins.filter((p) => p.styles).map((p) => ({ name: p.name, styles: p.styles! }));
  }
  // #endregion

  // #region Hook Execution

  /**
   * Execute processRows hook on all plugins.
   */
  processRows(rows: readonly any[]): any[] {
    let result = [...rows];
    for (const plugin of this.plugins) {
      if (plugin.processRows) {
        result = plugin.processRows(result);
      }
    }
    return result;
  }

  /**
   * Execute processColumns hook on all plugins.
   */
  processColumns(columns: readonly ColumnConfig[]): ColumnConfig[] {
    let result = [...columns];
    for (const plugin of this.plugins) {
      if (plugin.processColumns) {
        result = plugin.processColumns(result);
      }
    }
    return result;
  }

  /**
   * Execute beforeRender hook on all plugins.
   */
  beforeRender(): void {
    for (const plugin of this.plugins) {
      plugin.beforeRender?.();
    }
  }

  /**
   * Execute afterRender hook on all plugins.
   */
  afterRender(): void {
    for (const plugin of this.plugins) {
      plugin.afterRender?.();
    }
  }

  /**
   * Execute afterCellRender hook on all plugins for a single cell.
   * Called during cell rendering for efficient cell-level modifications.
   *
   * @param context - The cell render context
   */
  afterCellRender(context: AfterCellRenderContext): void {
    for (const plugin of this.plugins) {
      plugin.afterCellRender?.(context);
    }
  }

  /**
   * Check if any plugin has the afterCellRender hook implemented.
   * Used to skip the hook call overhead when no plugins need it.
   */
  hasAfterCellRenderHook(): boolean {
    return this.plugins.some((p) => typeof p.afterCellRender === 'function');
  }

  /**
   * Execute afterRowRender hook on all plugins for a single row.
   * Called after all cells in a row are rendered for efficient row-level modifications.
   *
   * @param context - The row render context
   */
  afterRowRender(context: AfterRowRenderContext): void {
    for (const plugin of this.plugins) {
      plugin.afterRowRender?.(context);
    }
  }

  /**
   * Check if any plugin has the afterRowRender hook implemented.
   * Used to skip the hook call overhead when no plugins need it.
   */
  hasAfterRowRenderHook(): boolean {
    return this.plugins.some((p) => typeof p.afterRowRender === 'function');
  }

  /**
   * Execute onScrollRender hook on all plugins.
   * Called after scroll-triggered row rendering for lightweight visual state updates.
   */
  onScrollRender(): void {
    for (const plugin of this.plugins) {
      plugin.onScrollRender?.();
    }
  }

  /**
   * Get total extra height contributed by plugins (e.g., expanded detail rows).
   * Used to adjust scrollbar height calculations.
   */
  getExtraHeight(): number {
    let total = 0;
    for (const plugin of this.plugins) {
      if (typeof plugin.getExtraHeight === 'function') {
        total += plugin.getExtraHeight();
      }
    }
    return total;
  }

  /**
   * Check if any plugin is contributing extra height.
   * When true, plugins are managing variable row heights and the grid should
   * not override the base row height via #measureRowHeight().
   */
  hasExtraHeight(): boolean {
    for (const plugin of this.plugins) {
      if (typeof plugin.getExtraHeight === 'function' && plugin.getExtraHeight() > 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get extra height from plugins that appears before a given row index.
   * Used by virtualization to correctly position the scroll window.
   */
  getExtraHeightBefore(beforeRowIndex: number): number {
    let total = 0;
    for (const plugin of this.plugins) {
      if (typeof plugin.getExtraHeightBefore === 'function') {
        total += plugin.getExtraHeightBefore(beforeRowIndex);
      }
    }
    return total;
  }

  /**
   * Get the height of a specific row from plugins.
   * Used for synthetic rows (group headers, etc.) that have fixed heights.
   * Returns undefined if no plugin provides a height for this row.
   */
  getRowHeight(row: unknown, index: number): number | undefined {
    for (const plugin of this.plugins) {
      if (typeof plugin.getRowHeight === 'function') {
        const height = plugin.getRowHeight(row, index);
        if (height !== undefined) {
          return height;
        }
      }
    }
    return undefined;
  }

  /**
   * Check if any plugin implements the getRowHeight() hook.
   * When true, the grid should use variable heights mode with position caching.
   */
  hasRowHeightPlugin(): boolean {
    for (const plugin of this.plugins) {
      if (typeof plugin.getRowHeight === 'function') {
        return true;
      }
    }
    return false;
  }

  /**
   * Adjust the virtualization start index based on plugin needs.
   * Returns the minimum start index from all plugins.
   */
  adjustVirtualStart(start: number, scrollTop: number, rowHeight: number): number {
    let adjustedStart = start;
    for (const plugin of this.plugins) {
      if (typeof plugin.adjustVirtualStart === 'function') {
        const pluginStart = plugin.adjustVirtualStart(start, scrollTop, rowHeight);
        if (pluginStart < adjustedStart) {
          adjustedStart = pluginStart;
        }
      }
    }
    return adjustedStart;
  }

  /**
   * Execute renderRow hook on all plugins.
   * Returns true if any plugin handled the row.
   */
  renderRow(row: any, rowEl: HTMLElement, rowIndex: number): boolean {
    for (const plugin of this.plugins) {
      if (plugin.renderRow?.(row, rowEl, rowIndex)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Query all plugins with a generic query and collect responses.
   * This enables inter-plugin communication without the core knowing plugin-specific concepts.
   *
   * Uses manifest-based routing when available: only plugins that declare handling
   * the query type in their `manifest.queries` are invoked. Falls back to querying
   * all plugins for backwards compatibility with legacy plugins.
   *
   * Checks both `handleQuery` (preferred) and `onPluginQuery` (legacy) hooks.
   *
   * @param query - The query object containing type and context
   * @returns Array of non-undefined responses from plugins
   */
  queryPlugins<T>(query: PluginQuery): T[] {
    const responses: T[] = [];

    // Try manifest-based routing first
    const handlers = this.queryHandlers.get(query.type);
    if (handlers && handlers.size > 0) {
      // Route only to plugins that declared this query type
      for (const plugin of handlers) {
        const response = plugin.handleQuery?.(query) ?? plugin.onPluginQuery?.(query);
        if (response !== undefined) {
          responses.push(response as T);
        }
      }
      return responses;
    }

    // Fallback: query all plugins (legacy behavior for plugins without manifest)
    for (const plugin of this.plugins) {
      // Try handleQuery first (new API), fall back to onPluginQuery (legacy)
      const response = plugin.handleQuery?.(query) ?? plugin.onPluginQuery?.(query);
      if (response !== undefined) {
        responses.push(response as T);
      }
    }
    return responses;
  }
  // #endregion

  // #region Event Bus
  /**
   * Subscribe a plugin to an event type.
   * The subscription is automatically cleaned up when the plugin is detached.
   *
   * @param plugin - The subscribing plugin instance
   * @param eventType - The event type to listen for
   * @param callback - The callback to invoke when the event is emitted
   */
  subscribe(plugin: BaseGridPlugin, eventType: string, callback: (detail: unknown) => void): void {
    let listeners = this.eventListeners.get(eventType);
    if (!listeners) {
      listeners = new Map();
      this.eventListeners.set(eventType, listeners);
    }
    listeners.set(plugin, callback);
  }

  /**
   * Unsubscribe a plugin from an event type.
   *
   * @param plugin - The subscribing plugin instance
   * @param eventType - The event type to stop listening for
   */
  unsubscribe(plugin: BaseGridPlugin, eventType: string): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(plugin);
      if (listeners.size === 0) {
        this.eventListeners.delete(eventType);
      }
    }
  }

  /**
   * Unsubscribe a plugin from all events.
   * Called automatically when a plugin is detached.
   *
   * @param plugin - The plugin to unsubscribe
   */
  unsubscribeAll(plugin: BaseGridPlugin): void {
    for (const [eventType, listeners] of this.eventListeners) {
      listeners.delete(plugin);
      if (listeners.size === 0) {
        this.eventListeners.delete(eventType);
      }
    }
  }

  /**
   * Emit an event to all subscribed plugins.
   * This is for inter-plugin communication only; it does not dispatch DOM events.
   *
   * @param eventType - The event type to emit
   * @param detail - The event payload
   */
  emitPluginEvent<T>(eventType: string, detail: T): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      for (const callback of listeners.values()) {
        try {
          callback(detail);
        } catch (error) {
          console.error(`[tbw-grid] Error in plugin event handler for "${eventType}":`, error);
        }
      }
    }
  }
  // #endregion

  // #region Event Hooks
  /**
   * Execute onKeyDown hook on all plugins.
   * Returns true if any plugin handled the event.
   */
  onKeyDown(event: KeyboardEvent): boolean {
    for (const plugin of this.plugins) {
      if (plugin.onKeyDown?.(event)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Execute onCellClick hook on all plugins.
   * Returns true if any plugin handled the event.
   */
  onCellClick(event: CellClickEvent): boolean {
    for (const plugin of this.plugins) {
      if (plugin.onCellClick?.(event)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Execute onRowClick hook on all plugins.
   * Returns true if any plugin handled the event.
   */
  onRowClick(event: RowClickEvent): boolean {
    for (const plugin of this.plugins) {
      if (plugin.onRowClick?.(event)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Execute onHeaderClick hook on all plugins.
   * Returns true if any plugin handled the event.
   */
  onHeaderClick(event: HeaderClickEvent): boolean {
    for (const plugin of this.plugins) {
      if (plugin.onHeaderClick?.(event)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Execute onScroll hook on all plugins.
   */
  onScroll(event: ScrollEvent): void {
    for (const plugin of this.plugins) {
      plugin.onScroll?.(event);
    }
  }

  /**
   * Execute onCellMouseDown hook on all plugins.
   * Returns true if any plugin handled the event.
   */
  onCellMouseDown(event: CellMouseEvent): boolean {
    for (const plugin of this.plugins) {
      if (plugin.onCellMouseDown?.(event)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Execute onCellMouseMove hook on all plugins.
   * Returns true if any plugin handled the event.
   */
  onCellMouseMove(event: CellMouseEvent): boolean {
    for (const plugin of this.plugins) {
      if (plugin.onCellMouseMove?.(event)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Execute onCellMouseUp hook on all plugins.
   * Returns true if any plugin handled the event.
   */
  onCellMouseUp(event: CellMouseEvent): boolean {
    for (const plugin of this.plugins) {
      if (plugin.onCellMouseUp?.(event)) {
        return true;
      }
    }
    return false;
  }

  // #endregion

  // #region Scroll Boundary Hooks

  /**
   * Collect horizontal scroll boundary offsets from all plugins.
   * Combines offsets from all plugins that report them.
   *
   * @param rowEl - The row element (optional, for calculating widths from rendered cells)
   * @param focusedCell - The currently focused cell element (optional, to determine if scrolling should be skipped)
   * @returns Combined left and right pixel offsets, plus skipScroll if any plugin requests it
   */
  getHorizontalScrollOffsets(
    rowEl?: HTMLElement,
    focusedCell?: HTMLElement,
  ): { left: number; right: number; skipScroll?: boolean } {
    let left = 0;
    let right = 0;
    let skipScroll = false;
    for (const plugin of this.plugins) {
      const offsets = plugin.getHorizontalScrollOffsets?.(rowEl, focusedCell);
      if (offsets) {
        left += offsets.left;
        right += offsets.right;
        if (offsets.skipScroll) {
          skipScroll = true;
        }
      }
    }
    return { left, right, skipScroll };
  }
  // #endregion

  // #region Shell Integration Hooks

  /**
   * Collect tool panels from all plugins.
   * Returns panels sorted by order (ascending).
   */
  getToolPanels(): {
    plugin: BaseGridPlugin;
    panel: NonNullable<ReturnType<NonNullable<BaseGridPlugin['getToolPanel']>>>;
  }[] {
    const panels: {
      plugin: BaseGridPlugin;
      panel: NonNullable<ReturnType<NonNullable<BaseGridPlugin['getToolPanel']>>>;
    }[] = [];
    for (const plugin of this.plugins) {
      const panel = plugin.getToolPanel?.();
      if (panel) {
        panels.push({ plugin, panel });
      }
    }
    // Sort by order (ascending), default to 0
    return panels.sort((a, b) => (a.panel.order ?? 0) - (b.panel.order ?? 0));
  }

  /**
   * Collect header contents from all plugins.
   * Returns contents sorted by order (ascending).
   */
  getHeaderContents(): {
    plugin: BaseGridPlugin;
    content: NonNullable<ReturnType<NonNullable<BaseGridPlugin['getHeaderContent']>>>;
  }[] {
    const contents: {
      plugin: BaseGridPlugin;
      content: NonNullable<ReturnType<NonNullable<BaseGridPlugin['getHeaderContent']>>>;
    }[] = [];
    for (const plugin of this.plugins) {
      const content = plugin.getHeaderContent?.();
      if (content) {
        contents.push({ plugin, content });
      }
    }
    // Sort by order (ascending), default to 0
    return contents.sort((a, b) => (a.content.order ?? 0) - (b.content.order ?? 0));
  }
  // #endregion
}
