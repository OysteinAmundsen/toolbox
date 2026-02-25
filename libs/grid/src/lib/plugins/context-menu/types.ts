/**
 * Context Menu Plugin Types
 *
 * Type definitions for the context menu feature.
 */

/**
 * Context menu item definition.
 * Supports icons, shortcuts, submenus, separators, and dynamic disabled/hidden states.
 */
export interface ContextMenuItem {
  /** Unique identifier for the menu item */
  id: string;
  /** Display label for the menu item */
  name: string;
  /** Optional icon (HTML string, emoji, or icon class) */
  icon?: string;
  /** Optional keyboard shortcut hint (display only). String array renders as key combo (e.g. ['Ctrl', 'A'] → `<code>Ctrl</code>+<code>A</code>`) */
  shortcut?: string | string[];
  /** Whether the item is disabled (static or dynamic) */
  disabled?: boolean | ((params: ContextMenuParams) => boolean);
  /** Whether the item is hidden (static or dynamic) */
  hidden?: boolean | ((params: ContextMenuParams) => boolean);
  /** Action handler when the item is clicked */
  action?: (params: ContextMenuParams) => void;
  /** Nested submenu items */
  subMenu?: ContextMenuItem[];
  /** Whether this is a separator (id and name required but ignored) */
  separator?: boolean;
  /** Optional CSS class to add to the menu item */
  cssClass?: string;
}

/**
 * Parameters passed to context menu callbacks.
 * Provides context about what element triggered the menu.
 */
export interface ContextMenuParams {
  /** The row data object (null for header clicks) */
  row: unknown;
  /** The row index (-1 for header clicks) */
  rowIndex: number;
  /** The column configuration */
  column: unknown;
  /** The column index */
  columnIndex: number;
  /** The field name of the column */
  field: string;
  /** The cell value (null for header clicks) */
  value: unknown;
  /** Whether the context menu was triggered on a header */
  isHeader: boolean;
  /** The original mouse event */
  event: MouseEvent;
  /**
   * The currently selected row indices (sorted ascending).
   * Populated when the SelectionPlugin is active in row mode.
   * If the right-clicked row was not part of a multi-selection,
   * this contains only the right-clicked row index.
   */
  selectedRows: number[];
}

/**
 * Configuration options for the context menu plugin.
 */
export interface ContextMenuConfig {
  /** Menu items - static array or function returning items */
  items?: ContextMenuItem[] | ((params: ContextMenuParams) => ContextMenuItem[]);
}

/**
 * Context menu item contributed by plugins via the `getContextMenuItems` query.
 *
 * Plugins return these from `handleQuery({ type: 'getContextMenuItems' })` to add
 * items to the right-click context menu. Unlike user-configured `ContextMenuItem`,
 * these are lightweight and statically typed — no dynamic `disabled`/`hidden` callbacks
 * (the plugin decides at query time what to include).
 *
 * @example
 * ```typescript
 * override handleQuery(query: PluginQuery): unknown {
 *   if (query.type === 'getContextMenuItems') {
 *     const { column } = query.context as ContextMenuParams;
 *     return [
 *       { id: 'hide-column', label: 'Hide Column', icon: '👁', action: () => this.hideColumn(column.field) },
 *     ] satisfies HeaderContextMenuItem[];
 *   }
 * }
 * ```
 *
 * @category Plugin Development
 */
export interface HeaderContextMenuItem {
  /** Unique identifier for the menu item */
  id: string;
  /** Display label */
  label: string;
  /** Optional icon (HTML string, emoji, or SVG string) */
  icon?: string;
  /** Optional keyboard shortcut hint (display only). String array renders as key combo (e.g. ['Ctrl', 'A'] → `<code>Ctrl</code>+<code>A</code>`) */
  shortcut?: string | string[];
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Action handler when the item is clicked */
  action: () => void;
  /** Whether this is a separator (only `id` is required) */
  separator?: boolean;
  /** Optional CSS class to add to the menu item (e.g. 'danger') */
  cssClass?: string;
  /**
   * Sort order for positioning within the menu.
   * Lower values appear first. Default is `100`.
   * Built-in ranges: sort (10-19), filter (20-29), visibility (30-39), pinning (40-49).
   */
  order?: number;
}

/**
 * Internal state managed by the context menu plugin.
 */
export interface ContextMenuState {
  /** Whether the menu is currently open */
  isOpen: boolean;
  /** Current menu position in viewport coordinates */
  position: { x: number; y: number };
  /** Parameters from the context menu trigger */
  params: ContextMenuParams | null;
  /** Reference to the menu DOM element */
  menuElement: HTMLElement | null;
}

// Module Augmentation - Register plugin name for type-safe getPluginByName()
declare module '../../core/types' {
  interface PluginNameMap {
    contextMenu: import('./ContextMenuPlugin').ContextMenuPlugin;
  }
}
