/**
 * Plugin Manager
 *
 * Manages plugin instances for a single grid.
 * Each grid has its own PluginManager with its own set of plugin instances.
 */

import type { ColumnConfig } from '../types';
import type {
  BaseGridPlugin,
  CellClickEvent,
  CellEditor,
  CellMouseEvent,
  CellRenderer,
  ContextMenuItem,
  ContextMenuParams,
  HeaderClickEvent,
  HeaderRenderer,
  RowClickEvent,
  ScrollEvent,
} from './base-plugin';

/**
 * Manages plugins for a single grid instance.
 */
export class PluginManager {
  /** Plugin instances in order of attachment */
  private plugins: BaseGridPlugin[] = [];

  /** Map from plugin class to instance for fast lookup */
  private pluginMap: Map<new (...args: unknown[]) => BaseGridPlugin, BaseGridPlugin> = new Map();

  /** Cell renderers registered by plugins */
  private cellRenderers: Map<string, CellRenderer> = new Map();

  /** Header renderers registered by plugins */
  private headerRenderers: Map<string, HeaderRenderer> = new Map();

  /** Cell editors registered by plugins */
  private cellEditors: Map<string, CellEditor> = new Map();

  constructor(private grid: any) {}

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
   */
  attach(plugin: BaseGridPlugin): void {
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

    // Call attach lifecycle method
    plugin.attach(this.grid);
  }

  /**
   * Detach all plugins and clean up.
   */
  detachAll(): void {
    // Detach in reverse order
    for (let i = this.plugins.length - 1; i >= 0; i--) {
      this.plugins[i].detach();
    }
    this.plugins = [];
    this.pluginMap.clear();
    this.cellRenderers.clear();
    this.headerRenderers.clear();
    this.cellEditors.clear();
  }

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
   * Get all CSS styles from all plugins.
   */
  getAllStyles(): string {
    return this.plugins
      .filter((p) => p.styles)
      .map((p) => p.styles)
      .join('\n');
  }

  // ===== Hook execution methods =====

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

  /**
   * Collect context menu items from all plugins.
   */
  getContextMenuItems(params: ContextMenuParams): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];
    for (const plugin of this.plugins) {
      const pluginItems = plugin.getContextMenuItems?.(params);
      if (pluginItems) {
        items.push(...pluginItems);
      }
    }
    return items;
  }

  // ===== Shell Integration Hooks =====

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
}
