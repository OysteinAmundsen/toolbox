/**
 * Context Menu Plugin (Class-based)
 *
 * Provides right-click context menu functionality for tbw-grid.
 * Supports custom menu items, submenus, icons, shortcuts, and dynamic item generation.
 */

import type { PluginManifest } from '../../core/plugin/base-plugin';
import { BaseGridPlugin } from '../../core/plugin/base-plugin';
import contextMenuStyles from './context-menu.css?inline';
import {
  buildMenuItems,
  collapseSeparators,
  createMenuElement,
  focusFirstMenuItem,
  positionMenu,
  setupMenuKeyboard,
} from './menu';
import type { ContextMenuConfig, ContextMenuItem, ContextMenuParams, HeaderContextMenuItem } from './types';

/** Query type for collecting context menu items from plugins */
const QUERY_GET_CONTEXT_MENU_ITEMS = 'getContextMenuItems';

/** Shared AbortController for global document listeners (all instances share one) */
let globalAbortController: AbortController | null = null;
/** Global stylesheet for context menu (injected once) */
let globalStyleSheet: HTMLStyleElement | null = null;
/** Reference count for instances using global handlers */
let globalHandlerRefCount = 0;

/** Default menu items when none are configured */
const defaultItems: ContextMenuItem[] = [
  {
    id: 'copy',
    name: 'Copy',
    shortcut: 'Ctrl+C',
    action: (params) => {
      // Use the query system instead of direct plugin access for proper decoupling
      const grid = (params as ContextMenuParams & { grid?: { query?: (type: string) => unknown[] } }).grid;
      grid?.query?.('clipboard:copy');
    },
  },
  { separator: true, id: 'sep1', name: '' },
  {
    id: 'export-csv',
    name: 'Export CSV',
    action: (params) => {
      // Use the query system instead of direct plugin access for proper decoupling
      const grid = (params as ContextMenuParams & { grid?: { query?: (type: string) => unknown[] } }).grid;
      grid?.query?.('export:csv');
    },
  },
];

/**
 * Context Menu Plugin for tbw-grid
 *
 * Adds a customizable right-click menu to grid cells. Build anything from simple
 * copy/paste actions to complex nested menus with conditional visibility, icons,
 * and keyboard shortcuts.
 *
 * ## Installation
 *
 * ```ts
 * import { ContextMenuPlugin } from '@toolbox-web/grid/plugins/context-menu';
 * ```
 *
 * ## Menu Item Structure
 *
 * | Property | Type | Description |
 * |----------|------|-------------|
 * | `id` | `string` | Unique item identifier |
 * | `name` | `string` | Display label |
 * | `icon` | `string` | Icon class or HTML |
 * | `shortcut` | `string` | Keyboard shortcut hint |
 * | `action` | `(params) => void` | Click handler |
 * | `disabled` | `boolean \| (params) => boolean` | Disable condition |
 * | `visible` | `boolean \| (params) => boolean` | Visibility condition |
 * | `items` | `MenuItem[]` | Submenu items |
 * | `separator` | `boolean` | Create a divider line |
 *
 * ## Menu Context (params)
 *
 * | Property | Type | Description |
 * |----------|------|-------------|
 * | `rowIndex` | `number` | Clicked row index |
 * | `colIndex` | `number` | Clicked column index |
 * | `field` | `string` | Column field name |
 * | `value` | `any` | Cell value |
 * | `row` | `any` | Full row data |
 * | `column` | `ColumnConfig` | Column configuration |
 *
 * ## CSS Custom Properties
 *
 * | Property | Default | Description |
 * |----------|---------|-------------|
 * | `--tbw-context-menu-bg` | `var(--tbw-color-panel-bg)` | Menu background |
 * | `--tbw-context-menu-fg` | `var(--tbw-color-fg)` | Menu text color |
 * | `--tbw-context-menu-hover` | `var(--tbw-color-row-hover)` | Item hover background |
 *
 * @example Basic Context Menu
 * ```ts
 * import '@toolbox-web/grid';
 * import { ContextMenuPlugin } from '@toolbox-web/grid/plugins/context-menu';
 *
 * grid.gridConfig = {
 *   plugins: [
 *     new ContextMenuPlugin({
 *       items: [
 *         { id: 'copy', name: 'Copy', shortcut: 'Ctrl+C', action: (ctx) => navigator.clipboard.writeText(ctx.value) },
 *         { separator: true, id: 'sep1', name: '' },
 *         { id: 'delete', name: 'Delete', action: (ctx) => removeRow(ctx.rowIndex) },
 *       ],
 *     }),
 *   ],
 * };
 * ```
 *
 * @example Conditional Menu Items
 * ```ts
 * new ContextMenuPlugin({
 *   items: [
 *     { id: 'edit', name: 'Edit', visible: (ctx) => ctx.column.editable === true },
 *     { id: 'delete', name: 'Delete', disabled: (ctx) => ctx.row.locked === true },
 *   ],
 * })
 * ```
 *
 * @see {@link ContextMenuConfig} for configuration options
 * @see {@link ContextMenuItem} for menu item structure
 * @see {@link ContextMenuParams} for action callback parameters
 *
 * @internal Extends BaseGridPlugin
 */
export class ContextMenuPlugin extends BaseGridPlugin<ContextMenuConfig> {
  /**
   * Plugin manifest - declares queries used by this plugin.
   * @internal
   */
  static override readonly manifest: PluginManifest = {
    queries: [
      {
        type: QUERY_GET_CONTEXT_MENU_ITEMS,
        description: 'Collects context menu items from other plugins for header right-click menus',
      },
    ],
  };

  /** @internal */
  readonly name = 'contextMenu';

  /** @internal */
  protected override get defaultConfig(): Partial<ContextMenuConfig> {
    return {
      items: defaultItems,
    };
  }

  // #region Internal State
  private isOpen = false;
  private position = { x: 0, y: 0 };
  private params: ContextMenuParams | null = null;
  private menuElement: HTMLElement | null = null;
  // #endregion

  // #region Lifecycle

  /** @internal */
  override attach(grid: import('../../core/plugin/base-plugin').GridElement): void {
    super.attach(grid);
    this.installGlobalHandlers();
    globalHandlerRefCount++;
  }

  /** @internal */
  override detach(): void {
    if (this.menuElement) {
      this.menuElement.remove();
      this.menuElement = null;
    }
    this.isOpen = false;
    this.params = null;
    this.uninstallGlobalHandlers();
  }
  // #endregion

  // #region Private Methods

  /**
   * Sync selection with the right-clicked row.
   * If the right-clicked row is already selected, keeps the multi-selection.
   * If not, selects only the right-clicked row (standard behavior in file managers / spreadsheets).
   *
   * @returns Sorted array of selected row indices after sync
   */
  private syncSelectionOnContextMenu(rowIndex: number): number[] {
    if (rowIndex < 0) return [];

    // Use the query system for loose coupling — no import of SelectionPlugin needed
    const selectionResult = this.grid?.query<number[]>('getSelectedRowIndices');
    const currentSelection = selectionResult?.[0];

    // No selection plugin loaded
    if (!currentSelection) return [rowIndex];

    if (currentSelection.includes(rowIndex)) {
      // Right-clicked row is already selected — preserve multi-selection
      return currentSelection;
    }

    // Right-clicked row is NOT selected — select only this row
    this.grid?.query('selectRows', [rowIndex]);
    return [rowIndex];
  }

  /**
   * CSS variables to copy from the grid element to the context menu.
   * Includes both base variables and context-menu specific overrides.
   */
  private static readonly CSS_VARS_TO_COPY = [
    // Base palette (for themes that only set base vars)
    '--tbw-color-panel-bg',
    '--tbw-color-fg',
    '--tbw-color-fg-muted',
    '--tbw-color-border',
    '--tbw-color-row-hover',
    '--tbw-color-shadow',
    '--tbw-color-danger',
    '--tbw-border-radius',
    '--tbw-font-family',
    '--tbw-font-size-sm',
    '--tbw-font-size-xs',
    '--tbw-font-size-2xs',
    '--tbw-spacing-xs',
    '--tbw-icon-size',
    '--tbw-menu-min-width',
    '--tbw-menu-item-padding',
    '--tbw-menu-item-gap',
    // Context menu specific overrides
    '--tbw-context-menu-bg',
    '--tbw-context-menu-fg',
    '--tbw-context-menu-border',
    '--tbw-context-menu-radius',
    '--tbw-context-menu-shadow',
    '--tbw-context-menu-hover',
    '--tbw-context-menu-danger',
    '--tbw-context-menu-muted',
    '--tbw-context-menu-min-width',
    '--tbw-context-menu-font-size',
    '--tbw-context-menu-font-family',
    '--tbw-context-menu-item-padding',
    '--tbw-context-menu-item-gap',
    '--tbw-context-menu-icon-size',
    '--tbw-context-menu-shortcut-size',
    '--tbw-context-menu-arrow-size',
    // Icon variables for context menu icons rendered outside tbw-grid
    '--tbw-icon-submenu-arrow',
  ];

  /**
   * Copy CSS custom properties from the grid element to the menu element.
   * This allows the context menu (appended to document.body) to inherit
   * theme variables set on tbw-grid.
   */
  private copyGridStyles(menuElement: HTMLElement): void {
    const gridEl = this.gridElement;
    if (!gridEl) return;

    const computed = getComputedStyle(gridEl);
    const styles: string[] = [];

    // Copy color-scheme so light-dark() can resolve in the context menu
    const colorScheme = computed.getPropertyValue('color-scheme').trim();
    if (colorScheme) {
      styles.push(`color-scheme: ${colorScheme}`);
    }

    for (const varName of ContextMenuPlugin.CSS_VARS_TO_COPY) {
      const value = computed.getPropertyValue(varName).trim();
      if (value) {
        styles.push(`${varName}: ${value}`);
      }
    }

    if (styles.length > 0) {
      // Append to existing inline styles (don't overwrite)
      const existing = menuElement.getAttribute('style') || '';
      menuElement.setAttribute('style', existing + styles.join('; ') + ';');
    }
  }

  private installGlobalHandlers(): void {
    // Inject global stylesheet for context menu (once)
    // Only inject if we have valid CSS text (Vite's ?inline import)
    // When importing from source without Vite, the import is a module object, not a string
    if (
      !globalStyleSheet &&
      typeof document !== 'undefined' &&
      typeof contextMenuStyles === 'string' &&
      contextMenuStyles
    ) {
      globalStyleSheet = document.createElement('style');
      globalStyleSheet.id = 'tbw-context-menu-styles';
      globalStyleSheet.textContent = contextMenuStyles;
      document.head.appendChild(globalStyleSheet);
    }

    if (!globalAbortController) {
      globalAbortController = new AbortController();
      const signal = globalAbortController.signal;

      const closeAllMenus = () => {
        const menus = document.querySelectorAll('.tbw-context-menu');
        menus.forEach((menu) => menu.remove());
      };

      // Close menu on click outside
      document.addEventListener('click', closeAllMenus, { signal });

      // Close on escape
      document.addEventListener(
        'keydown',
        (e: KeyboardEvent) => {
          if (e.key === 'Escape') closeAllMenus();
        },
        { signal },
      );

      // Close on scroll (any scrollable ancestor)
      document.addEventListener('scroll', closeAllMenus, { capture: true, signal });
    }
  }

  /**
   * Clean up global handlers when the last instance detaches.
   * Uses reference counting to ensure handlers persist while any grid uses the plugin.
   */
  private uninstallGlobalHandlers(): void {
    globalHandlerRefCount--;
    if (globalHandlerRefCount > 0) return;

    // Last instance - abort all global listeners at once
    if (globalAbortController) {
      globalAbortController.abort();
      globalAbortController = null;
    }
    if (globalStyleSheet) {
      globalStyleSheet.remove();
      globalStyleSheet = null;
    }
  }

  /**
   * Query all plugins for context menu items via the query system.
   * Each plugin that handles `getContextMenuItems` can return an array of HeaderContextMenuItem.
   */
  private collectPluginItems(params: ContextMenuParams): HeaderContextMenuItem[] {
    if (!this.grid) return [];

    const responses = this.grid.query<HeaderContextMenuItem[]>(QUERY_GET_CONTEXT_MENU_ITEMS, params);
    const items: HeaderContextMenuItem[] = [];

    for (const response of responses) {
      if (Array.isArray(response)) {
        items.push(...response);
      }
    }

    // Sort by order (default 100), then stable by insertion order
    items.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

    // Insert separators between different order groups
    return this.insertGroupSeparators(items);
  }

  /**
   * Insert separators between groups of items with different order ranges.
   * Groups are defined by the tens digit (10-19, 20-29, etc.).
   */
  private insertGroupSeparators(items: HeaderContextMenuItem[]): HeaderContextMenuItem[] {
    if (items.length <= 1) return items;

    const result: HeaderContextMenuItem[] = [];
    let lastGroup = -1;

    for (const item of items) {
      if (item.separator) {
        result.push(item);
        continue;
      }
      const group = Math.floor((item.order ?? 100) / 10);
      if (lastGroup >= 0 && group !== lastGroup) {
        result.push({
          id: `__sep-${lastGroup}-${group}`,
          label: '',
          separator: true,
          action: () => {
            /* noop */
          },
        });
      }
      lastGroup = group;
      result.push(item);
    }

    return result;
  }

  /**
   * Convert plugin-contributed HeaderContextMenuItems to the internal ContextMenuItem format.
   */
  private convertPluginItems(items: HeaderContextMenuItem[]): ContextMenuItem[] {
    return items.map((item) => ({
      id: item.id,
      name: item.label,
      icon: item.icon,
      shortcut: item.shortcut,
      disabled: item.disabled ?? false,
      action: () => item.action(),
      separator: item.separator,
      cssClass: item.cssClass,
    }));
  }
  // #endregion

  // #region Hooks

  /**
   * Shared logic to build menu items, create the menu element, and show it.
   * Used by both the contextmenu mouse handler and keyboard triggers.
   *
   * @param params - Context menu parameters
   * @param x - Viewport X coordinate
   * @param y - Viewport Y coordinate
   * @param focusFirst - Whether to focus the first menu item (keyboard-triggered)
   */
  private openMenuAt(params: ContextMenuParams, x: number, y: number, focusFirst = false): void {
    this.params = params;
    this.position = { x, y };

    // Collect plugin-contributed items via the query system
    const pluginItems = this.collectPluginItems(params);

    // Build configured items
    let items = buildMenuItems(this.config.items ?? defaultItems, params);

    // Merge plugin items with configured items
    if (pluginItems.length > 0) {
      const converted = this.convertPluginItems(pluginItems);
      if (items.length > 0 && converted.length > 0) {
        items = [...items, { id: '__plugin-sep', name: '', separator: true }, ...converted];
      } else {
        items = [...items, ...converted];
      }
    }

    // Collapse consecutive/leading/trailing separators
    items = collapseSeparators(items);

    if (!items.length) return;

    // Close any open context menu (including from other grids)
    document.querySelectorAll('.tbw-context-menu').forEach((m) => m.remove());
    this.menuElement = null;

    this.menuElement = createMenuElement(
      items,
      params,
      (item) => {
        if (item.action) {
          item.action(params);
        }
        this.menuElement?.remove();
        this.menuElement = null;
        this.isOpen = false;
      },
      this.grid?.gridConfig?.icons?.submenuArrow,
    );

    // Attach keyboard navigation (arrow keys, Enter, Escape)
    setupMenuKeyboard(this.menuElement, () => this.hideMenu());

    document.body.appendChild(this.menuElement);
    this.copyGridStyles(this.menuElement);
    positionMenu(this.menuElement, x, y);
    this.isOpen = true;

    if (focusFirst) {
      focusFirstMenuItem(this.menuElement);
    }

    this.emit('context-menu-open', { params, items });
  }

  /** @internal */
  override afterRender(): void {
    const gridEl = this.gridElement;
    if (!gridEl) return;

    // Use querySelector instead of children[0] because light DOM children
    // (e.g. <tbw-grid-column>) are re-appended before .tbw-grid-root, making
    // children[0] point to a declarative element instead of the data container.
    const container = gridEl.querySelector('.tbw-grid-root');
    if (!container) return;

    // Check if handler already attached
    if (container.getAttribute('data-context-menu-bound') === 'true') return;
    container.setAttribute('data-context-menu-bound', 'true');

    container.addEventListener('contextmenu', (e: Event) => {
      const event = e as MouseEvent;
      event.preventDefault();

      const target = event.target as HTMLElement;
      const cell = target.closest('[data-row][data-col]');
      const header = target.closest('[part~="header-cell"]');

      let params: ContextMenuParams;

      if (cell) {
        const rowIndex = parseInt(cell.getAttribute('data-row') ?? '-1', 10);
        const colIndex = parseInt(cell.getAttribute('data-col') ?? '-1', 10);
        const column = this.visibleColumns[colIndex];
        const row = this.rows[rowIndex];

        // Sync selection: if the right-clicked row is not already selected,
        // select it (clearing multi-selection). If it IS selected, keep all.
        const selectedRows = this.syncSelectionOnContextMenu(rowIndex);

        params = {
          row,
          rowIndex,
          column,
          columnIndex: colIndex,
          field: column?.field ?? '',
          value: row?.[column?.field as keyof typeof row] ?? null,
          isHeader: false,
          event,
          selectedRows,
        };
      } else if (header) {
        const colIndex = parseInt(header.getAttribute('data-col') ?? '-1', 10);
        const column = this.visibleColumns[colIndex];

        params = {
          row: null,
          rowIndex: -1,
          column,
          columnIndex: colIndex,
          field: column?.field ?? '',
          value: null,
          isHeader: true,
          event,
          selectedRows: [],
        };
      } else {
        return;
      }

      this.openMenuAt(params, event.clientX, event.clientY);
    });
  }

  /**
   * Handle keyboard shortcuts to open the context menu.
   * Shift+F10 and the dedicated ContextMenu key open the menu at the focused cell.
   * @internal
   */
  override onKeyDown(event: KeyboardEvent): boolean | void {
    // Shift+F10 or the dedicated ContextMenu/Application key
    const isShiftF10 = event.key === 'F10' && event.shiftKey;
    const isContextMenuKey = event.key === 'ContextMenu';

    if (!isShiftF10 && !isContextMenuKey) return;

    // Prevent the browser's native context menu from appearing
    event.preventDefault();

    const grid = this.grid;
    if (!grid) return;

    const rowIndex = grid._focusRow;
    const colIndex = grid._focusCol;
    const column = this.visibleColumns[colIndex];
    const row = this.rows[rowIndex];

    // Find the focused cell element to position the menu near it
    const gridEl = this.gridElement;
    const cellEl = gridEl?.querySelector<HTMLElement>(`[data-row="${rowIndex}"][data-col="${colIndex}"]`);
    let x = 0;
    let y = 0;
    if (cellEl) {
      const rect = cellEl.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.bottom;
    }

    const selectedRows = this.syncSelectionOnContextMenu(rowIndex);

    const params: ContextMenuParams = {
      row,
      rowIndex,
      column,
      columnIndex: colIndex,
      field: column?.field ?? '',
      value: row?.[column?.field as keyof typeof row] ?? null,
      isHeader: false,
      event: event,
      selectedRows,
    };

    this.openMenuAt(params, x, y, true);
    return true;
  }
  // #endregion

  // #region Public API

  /**
   * Programmatically show the context menu at the specified position.
   *
   * Use this to open the menu from custom UI elements or keyboard shortcuts
   * without requiring a native `contextmenu` event.
   *
   * @param x - Viewport X coordinate (pixels)
   * @param y - Viewport Y coordinate (pixels)
   * @param params - Partial context menu parameters — unspecified fields receive sensible defaults
   *
   * @example
   * ```ts
   * const menu = grid.getPluginByName('context-menu');
   * // Open menu at a button's position with row context
   * const rect = button.getBoundingClientRect();
   * menu.showMenu(rect.left, rect.bottom, {
   *   row: selectedRow,
   *   rowIndex: 3,
   *   column: columns[0],
   * });
   * ```
   */
  showMenu(x: number, y: number, params: Partial<ContextMenuParams>): void {
    const fullParams: ContextMenuParams = {
      row: params.row ?? null,
      rowIndex: params.rowIndex ?? -1,
      column: params.column ?? null,
      columnIndex: params.columnIndex ?? -1,
      field: params.field ?? '',
      value: params.value ?? null,
      isHeader: params.isHeader ?? false,
      event: params.event ?? new MouseEvent('contextmenu'),
      selectedRows: params.selectedRows ?? [],
    };

    this.openMenuAt(fullParams, x, y);
  }

  /**
   * Hide the context menu if it is currently open.
   *
   * Safe to call even when the menu is already closed.
   */
  hideMenu(): void {
    if (this.menuElement) {
      this.menuElement.remove();
      this.menuElement = null;
      this.isOpen = false;
    }
  }

  /**
   * Check if the context menu is currently open.
   *
   * @returns `true` when the menu is visible
   */
  isMenuOpen(): boolean {
    return this.isOpen;
  }
  // #endregion

  // Styles are injected globally via installGlobalHandlers() since menu renders in document.body
}
