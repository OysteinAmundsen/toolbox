/**
 * Pinned Columns Plugin (Class-based)
 *
 * Enables column pinning (sticky left/right positioning).
 */

import { getDirection } from '../../core/internal/utils';
import type { PluginManifest, PluginQuery } from '../../core/plugin/base-plugin';
import { BaseGridPlugin } from '../../core/plugin/base-plugin';
import type { ColumnConfig } from '../../core/types';
import type { ContextMenuParams, HeaderContextMenuItem } from '../context-menu/types';
import {
  applyStickyOffsets,
  clearStickyOffsets,
  getColumnPinned,
  getLeftStickyColumns,
  getRightStickyColumns,
  hasStickyColumns,
} from './pinned-columns';
import type { PinnedColumnsConfig, PinnedPosition } from './types';

/** Query type constant for checking if a column can be moved */
const QUERY_CAN_MOVE_COLUMN = 'canMoveColumn';

/**
 * Pinned Columns Plugin for tbw-grid
 *
 * Freezes columns to the left or right edge of the grid—essential for keeping key
 * identifiers or action buttons visible while scrolling through wide datasets. Just set
 * `pinned: 'left'` or `pinned: 'right'` on your column definitions.
 *
 * ## Installation
 *
 * ```ts
 * import { PinnedColumnsPlugin } from '@toolbox-web/grid/plugins/pinned-columns';
 * ```
 *
 * ## Column Configuration
 *
 * | Property | Type | Description |
 * |----------|------|-------------|
 * | `pinned` | `'left' \| 'right' \| 'start' \| 'end'` | Pin column to edge (logical or physical) |
 * | `meta.lockPinning` | `boolean` | `false` | Prevent user from pin/unpin via context menu |
 *
 * ### RTL Support
 *
 * Use logical values (`start`/`end`) for grids that work in both LTR and RTL layouts:
 * - `'start'` - Pins to left in LTR, right in RTL
 * - `'end'` - Pins to right in LTR, left in RTL
 *
 * ## CSS Custom Properties
 *
 * | Property | Default | Description |
 * |----------|---------|-------------|
 * | `--tbw-pinned-shadow` | `4px 0 8px rgba(0,0,0,0.1)` | Shadow on pinned column edge |
 * | `--tbw-pinned-border` | `var(--tbw-color-border)` | Border between pinned and scrollable |
 *
 * @example Pin ID Left and Actions Right
 * ```ts
 * import '@toolbox-web/grid';
 * import { PinnedColumnsPlugin } from '@toolbox-web/grid/plugins/pinned-columns';
 *
 * const grid = document.querySelector('tbw-grid');
 * grid.gridConfig = {
 *   columns: [
 *     { field: 'id', header: 'ID', pinned: 'left', width: 80 },
 *     { field: 'name', header: 'Name' },
 *     { field: 'email', header: 'Email' },
 *     { field: 'department', header: 'Department' },
 *     { field: 'actions', header: 'Actions', pinned: 'right', width: 120 },
 *   ],
 *   plugins: [new PinnedColumnsPlugin()],
 * };
 * ```
 *
 * @example RTL-Compatible Pinning
 * ```ts
 * // Same config works in LTR and RTL
 * grid.gridConfig = {
 *   columns: [
 *     { field: 'id', header: 'ID', pinned: 'start' },  // Left in LTR, Right in RTL
 *     { field: 'name', header: 'Name' },
 *     { field: 'actions', header: 'Actions', pinned: 'end' },  // Right in LTR, Left in RTL
 *   ],
 *   plugins: [new PinnedColumnsPlugin()],
 * };
 * ```
 *
 * @see {@link PinnedColumnsConfig} for configuration options
 *
 * @internal Extends BaseGridPlugin
 */
export class PinnedColumnsPlugin extends BaseGridPlugin<PinnedColumnsConfig> {
  /**
   * Plugin manifest - declares owned properties and handled queries.
   * @internal
   */
  static override readonly manifest: PluginManifest = {
    ownedProperties: [
      {
        property: 'pinned',
        level: 'column',
        description: 'the "pinned" column property',
        isUsed: (v) => v === 'left' || v === 'right' || v === 'start' || v === 'end',
      },
      {
        property: 'sticky',
        level: 'column',
        description: 'the "sticky" column property (deprecated, use "pinned")',
        isUsed: (v) => v === 'left' || v === 'right' || v === 'start' || v === 'end',
      },
    ],
    queries: [
      {
        type: QUERY_CAN_MOVE_COLUMN,
        description: 'Prevents pinned (sticky) columns from being moved/reordered',
      },
      {
        type: 'getStickyOffsets',
        description: 'Returns the sticky offsets for left/right pinned columns',
      },
      {
        type: 'getContextMenuItems',
        description: 'Contributes pin/unpin items to the header context menu',
      },
    ],
  };

  /** @internal */
  readonly name = 'pinnedColumns';

  /** @internal */
  protected override get defaultConfig(): Partial<PinnedColumnsConfig> {
    return {};
  }

  // #region Internal State
  private isApplied = false;
  private leftOffsets = new Map<string, number>();
  private rightOffsets = new Map<string, number>();
  // #endregion

  // #region Lifecycle

  /** @internal */
  override detach(): void {
    this.leftOffsets.clear();
    this.rightOffsets.clear();
    this.isApplied = false;
  }
  // #endregion

  // #region Detection

  /**
   * Auto-detect sticky columns from column configuration.
   */
  static detect(rows: readonly unknown[], config: { columns?: ColumnConfig[] }): boolean {
    const columns = config?.columns;
    if (!Array.isArray(columns)) return false;
    return hasStickyColumns(columns);
  }
  // #endregion

  // #region Hooks

  /** @internal */
  override processColumns(columns: readonly ColumnConfig[]): ColumnConfig[] {
    // Mark that we have sticky columns to apply
    this.isApplied = hasStickyColumns([...columns]);
    return [...columns];
  }

  /** @internal */
  override afterRender(): void {
    if (!this.isApplied) {
      return;
    }

    const host = this.grid as unknown as HTMLElement;
    const columns = [...this.columns];

    if (!hasStickyColumns(columns)) {
      clearStickyOffsets(host);
      this.isApplied = false;
      return;
    }

    // Apply sticky offsets after a microtask to ensure DOM is ready
    queueMicrotask(() => {
      applyStickyOffsets(host, columns);
    });
  }

  /**
   * Handle inter-plugin queries.
   * @internal
   */
  override handleQuery(query: PluginQuery): unknown {
    switch (query.type) {
      case QUERY_CAN_MOVE_COLUMN: {
        // Prevent pinned columns from being moved/reordered.
        // Pinned columns have fixed positions and should not be draggable.
        const column = query.context as ColumnConfig;
        if (getColumnPinned(column) != null) {
          return false;
        }
        return undefined; // Let other plugins or default behavior decide
      }
      case 'getStickyOffsets': {
        // Return the calculated sticky offsets for column virtualization
        return {
          left: Object.fromEntries(this.leftOffsets),
          right: Object.fromEntries(this.rightOffsets),
        };
      }
      case 'getContextMenuItems': {
        const params = query.context as ContextMenuParams;
        if (!params.isHeader) return undefined;

        const column = params.column as ColumnConfig;
        if (!column?.field) return undefined;

        // Don't offer pin/unpin for locked-pinning columns
        if (column.meta?.lockPinning) return undefined;

        const pinned = getColumnPinned(column);
        const isPinned = pinned != null;
        const items: HeaderContextMenuItem[] = [];

        if (isPinned) {
          items.push({
            id: 'pinned/unpin',
            label: 'Unpin Column',
            icon: '📌',
            order: 40,
            action: () => this.setPinPosition(column.field, undefined),
          });
        } else {
          items.push({
            id: 'pinned/pin-left',
            label: 'Pin Left',
            icon: '⬅',
            order: 40,
            action: () => this.setPinPosition(column.field, 'left'),
          });
          items.push({
            id: 'pinned/pin-right',
            label: 'Pin Right',
            icon: '➡',
            order: 41,
            action: () => this.setPinPosition(column.field, 'right'),
          });
        }

        return items;
      }
      default:
        return undefined;
    }
  }
  // #endregion

  // #region Public API

  /**
   * Set the pin position for a column.
   * Updates the column's `pinned` property and triggers a full re-render.
   *
   * @param field - The field name of the column to pin/unpin
   * @param position - The pin position (`'left'`, `'right'`, `'start'`, `'end'`), or `undefined` to unpin
   */
  setPinPosition(field: string, position: PinnedPosition | undefined): void {
    // Read the currently-visible columns from the plugin accessor.
    // These are the post-processColumns result, which is the authoritative column set.
    const currentColumns = this.columns;
    if (!currentColumns?.length) return;

    const updated = currentColumns.map((col) => {
      if (col.field !== field) return col;
      const copy = { ...col };
      if (position) {
        (copy as ColumnConfig & { pinned?: PinnedPosition }).pinned = position;
      } else {
        delete (copy as ColumnConfig & { pinned?: PinnedPosition }).pinned;
      }
      // Clean up deprecated sticky property if present
      delete (copy as ColumnConfig & { sticky?: PinnedPosition }).sticky;
      return copy;
    });

    // Set via columns setter to trigger re-render
    const gridEl = this.grid as unknown as HTMLElement & {
      columns?: ColumnConfig[];
    };
    gridEl.columns = updated;
  }

  /**
   * Re-apply sticky offsets (e.g., after column resize).
   */
  refreshStickyOffsets(): void {
    const columns = [...this.columns];
    applyStickyOffsets(this.grid as unknown as HTMLElement, columns);
  }

  /**
   * Get columns pinned to the left (after resolving logical positions for current direction).
   */
  getLeftPinnedColumns(): ColumnConfig[] {
    const columns = [...this.columns];
    const direction = getDirection(this.grid as unknown as HTMLElement);
    return getLeftStickyColumns(columns, direction);
  }

  /**
   * Get columns pinned to the right (after resolving logical positions for current direction).
   */
  getRightPinnedColumns(): ColumnConfig[] {
    const columns = [...this.columns];
    const direction = getDirection(this.grid as unknown as HTMLElement);
    return getRightStickyColumns(columns, direction);
  }

  /**
   * Clear all sticky positioning.
   */
  clearStickyPositions(): void {
    clearStickyOffsets(this.grid as unknown as HTMLElement);
  }

  /**
   * Report horizontal scroll boundary offsets for pinned columns.
   * Used by keyboard navigation to ensure focused cells aren't hidden behind sticky columns.
   * @internal
   */
  override getHorizontalScrollOffsets(
    rowEl?: HTMLElement,
    focusedCell?: HTMLElement,
  ): { left: number; right: number; skipScroll?: boolean } | undefined {
    if (!this.isApplied) {
      return undefined;
    }

    let left = 0;
    let right = 0;

    if (rowEl) {
      // Calculate from rendered cells in the row
      const stickyLeftCells = rowEl.querySelectorAll('.sticky-left');
      const stickyRightCells = rowEl.querySelectorAll('.sticky-right');
      stickyLeftCells.forEach((el) => {
        left += (el as HTMLElement).offsetWidth;
      });
      stickyRightCells.forEach((el) => {
        right += (el as HTMLElement).offsetWidth;
      });
    } else {
      // Fall back to header row if no row element provided
      const host = this.grid as unknown as HTMLElement;
      const headerCells = host.querySelectorAll('.header-row .cell');
      headerCells.forEach((cell) => {
        if (cell.classList.contains('sticky-left')) {
          left += (cell as HTMLElement).offsetWidth;
        } else if (cell.classList.contains('sticky-right')) {
          right += (cell as HTMLElement).offsetWidth;
        }
      });
    }

    // Skip horizontal scrolling if focused cell is pinned (it's always visible)
    const skipScroll =
      focusedCell?.classList.contains('sticky-left') || focusedCell?.classList.contains('sticky-right');

    return { left, right, skipScroll };
  }
  // #endregion
}
