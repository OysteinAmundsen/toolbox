/**
 * Context Menu Plugin (Class-based)
 *
 * Provides right-click context menu functionality for tbw-grid.
 * Supports custom menu items, submenus, icons, shortcuts, and dynamic item generation.
 */

import { BaseGridPlugin } from '../../core/plugin/base-plugin';
import { buildMenuItems, createMenuElement, positionMenu } from './menu';
import type { ContextMenuConfig, ContextMenuItem, ContextMenuParams } from './types';

/** Global click handler reference for cleanup */
let globalClickHandler: ((e: Event) => void) | null = null;
/** Global keydown handler reference for cleanup */
let globalKeydownHandler: ((e: KeyboardEvent) => void) | null = null;
/** Global stylesheet for context menu (injected once) */
let globalStyleSheet: HTMLStyleElement | null = null;

/** Context menu styles for light DOM rendering */
const contextMenuStyles = `
  .tbw-context-menu {
    position: fixed;
    background: light-dark(#f5f5f5, #2a2a2a);
    color: light-dark(#222, #eee);
    border: 1px solid light-dark(#d0d0d4, #454545);
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
    min-width: 160px;
    padding: 4px 0;
    z-index: 10000;
    font-size: 13px;
    font-family: system-ui, sans-serif;
  }
  .tbw-context-menu-item {
    display: flex;
    align-items: center;
    padding: 6px 12px;
    cursor: pointer;
    gap: 8px;
  }
  .tbw-context-menu-item:hover:not(.disabled) {
    background: light-dark(#e8e8e8, #3a3a3a);
  }
  .tbw-context-menu-item.disabled {
    opacity: 0.5;
    cursor: default;
  }
  .tbw-context-menu-item.danger {
    color: light-dark(#c00, #f66);
  }
  .tbw-context-menu-icon {
    width: 16px;
    text-align: center;
  }
  .tbw-context-menu-label {
    flex: 1;
  }
  .tbw-context-menu-shortcut {
    color: light-dark(#888, #888);
    font-size: 11px;
  }
  .tbw-context-menu-arrow {
    font-size: 10px;
    color: light-dark(#888, #888);
  }
  .tbw-context-menu-separator {
    height: 1px;
    background: light-dark(#d0d0d4, #454545);
    margin: 4px 0;
  }
`;

/** Default menu items when none are configured */
const defaultItems: ContextMenuItem[] = [
  {
    id: 'copy',
    name: 'Copy',
    shortcut: 'Ctrl+C',
    action: (params) => {
      const grid = (params as ContextMenuParams & { grid?: { plugins?: { clipboard?: { copy?: () => void } } } }).grid;
      grid?.plugins?.clipboard?.copy?.();
    },
  },
  { separator: true, id: 'sep1', name: '' },
  {
    id: 'export-csv',
    name: 'Export CSV',
    action: (params) => {
      const grid = (params as ContextMenuParams & { grid?: { plugins?: { export?: { exportCsv?: () => void } } } })
        .grid;
      grid?.plugins?.export?.exportCsv?.();
    },
  },
];

/**
 * Context Menu Plugin for tbw-grid
 *
 * @example
 * ```ts
 * new ContextMenuPlugin({
 *   enabled: true,
 *   items: [
 *     { id: 'edit', name: 'Edit', action: (params) => console.log('Edit', params) },
 *     { separator: true, id: 'sep', name: '' },
 *     { id: 'delete', name: 'Delete', action: (params) => console.log('Delete', params) },
 *   ],
 * })
 * ```
 */
export class ContextMenuPlugin extends BaseGridPlugin<ContextMenuConfig> {
  readonly name = 'contextMenu';
  override readonly version = '1.0.0';

  protected override get defaultConfig(): Partial<ContextMenuConfig> {
    return {
      enabled: true,
      items: defaultItems,
    };
  }

  // ===== Internal State =====
  private isOpen = false;
  private position = { x: 0, y: 0 };
  private params: ContextMenuParams | null = null;
  private menuElement: HTMLElement | null = null;

  // ===== Lifecycle =====

  override attach(grid: import('../../core/plugin/base-plugin').GridElement): void {
    super.attach(grid);
    this.installGlobalHandlers();
  }

  override detach(): void {
    if (this.menuElement) {
      this.menuElement.remove();
      this.menuElement = null;
    }
    this.isOpen = false;
    this.params = null;
  }

  // ===== Private Methods =====

  private installGlobalHandlers(): void {
    // Inject global stylesheet for context menu (once)
    if (!globalStyleSheet && typeof document !== 'undefined') {
      globalStyleSheet = document.createElement('style');
      globalStyleSheet.id = 'tbw-context-menu-styles';
      globalStyleSheet.textContent = contextMenuStyles;
      document.head.appendChild(globalStyleSheet);
    }

    // Close menu on click outside
    if (!globalClickHandler) {
      globalClickHandler = () => {
        const menus = document.querySelectorAll('.tbw-context-menu');
        menus.forEach((menu) => menu.remove());
      };
      document.addEventListener('click', globalClickHandler);
    }

    // Close on escape
    if (!globalKeydownHandler) {
      globalKeydownHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          const menus = document.querySelectorAll('.tbw-context-menu');
          menus.forEach((menu) => menu.remove());
        }
      };
      document.addEventListener('keydown', globalKeydownHandler);
    }
  }

  // ===== Hooks =====

  override afterRender(): void {
    if (!this.config.enabled) return;

    const shadowRoot = this.shadowRoot;
    if (!shadowRoot) return;

    const container = shadowRoot.children[0];
    if (!container) return;

    // Check if handler already attached
    if (container.getAttribute('data-context-menu-bound') === 'true') return;
    container.setAttribute('data-context-menu-bound', 'true');

    container.addEventListener('contextmenu', (e: Event) => {
      if (!this.config.enabled) return;

      const event = e as MouseEvent;
      event.preventDefault();

      const target = event.target as HTMLElement;
      const cell = target.closest('[data-row][data-col]');
      const header = target.closest('.header-cell');

      let params: ContextMenuParams;

      if (cell) {
        const rowIndex = parseInt(cell.getAttribute('data-row') ?? '-1', 10);
        const colIndex = parseInt(cell.getAttribute('data-col') ?? '-1', 10);
        const column = this.columns[colIndex];
        const row = this.rows[rowIndex];

        params = {
          row,
          rowIndex,
          column,
          columnIndex: colIndex,
          field: column?.field ?? '',
          value: row?.[column?.field as keyof typeof row] ?? null,
          isHeader: false,
          event,
        };
      } else if (header) {
        const colIndex = parseInt(header.getAttribute('data-col') ?? '-1', 10);
        const column = this.columns[colIndex];

        params = {
          row: null,
          rowIndex: -1,
          column,
          columnIndex: colIndex,
          field: column?.field ?? '',
          value: null,
          isHeader: true,
          event,
        };
      } else {
        return;
      }

      this.params = params;
      this.position = { x: event.clientX, y: event.clientY };

      const items = buildMenuItems(this.config.items ?? defaultItems, params);
      if (!items.length) return;

      if (this.menuElement) {
        this.menuElement.remove();
      }

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
        this.gridIcons.submenuArrow
      );

      document.body.appendChild(this.menuElement);
      positionMenu(this.menuElement, event.clientX, event.clientY);
      this.isOpen = true;

      this.emit('context-menu-open', { params, items });
    });
  }

  // ===== Public API =====

  /**
   * Programmatically show the context menu at the specified position.
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param params - Partial context menu parameters
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
    };

    const items = buildMenuItems(this.config.items ?? defaultItems, fullParams);

    if (this.menuElement) {
      this.menuElement.remove();
    }

    this.menuElement = createMenuElement(
      items,
      fullParams,
      (item) => {
        if (item.action) item.action(fullParams);
        this.menuElement?.remove();
        this.menuElement = null;
        this.isOpen = false;
      },
      this.gridIcons.submenuArrow
    );

    document.body.appendChild(this.menuElement);
    positionMenu(this.menuElement, x, y);
    this.isOpen = true;
  }

  /**
   * Hide the context menu.
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
   * @returns Whether the menu is open
   */
  isMenuOpen(): boolean {
    return this.isOpen;
  }

  // Styles are injected globally via installGlobalHandlers() since menu renders in document.body
}
