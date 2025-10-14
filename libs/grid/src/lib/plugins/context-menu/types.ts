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
  /** Optional keyboard shortcut hint (display only) */
  shortcut?: string;
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
}

/**
 * Configuration options for the context menu plugin.
 */
export interface ContextMenuConfig {
  /** Whether the context menu is enabled (default: true) */
  enabled?: boolean;
  /** Menu items - static array or function returning items */
  items?: ContextMenuItem[] | ((params: ContextMenuParams) => ContextMenuItem[]);
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
