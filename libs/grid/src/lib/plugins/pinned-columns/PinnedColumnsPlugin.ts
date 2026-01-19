/**
 * Pinned Columns Plugin (Class-based)
 *
 * Enables column pinning (sticky left/right positioning).
 */

import { BaseGridPlugin, PLUGIN_QUERIES, type PluginQuery } from '../../core/plugin/base-plugin';
import type { ColumnConfig } from '../../core/types';
import {
  applyStickyOffsets,
  clearStickyOffsets,
  getLeftStickyColumns,
  getRightStickyColumns,
  hasStickyColumns,
} from './pinned-columns';
import type { PinnedColumnsConfig } from './types';

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
 * | `pinned` | `'left' \| 'right'` | Pin column to left or right edge |
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
 * @example Left Pinned Only
 * ```ts
 * grid.gridConfig = {
 *   columns: [
 *     { field: 'id', header: 'ID', pinned: 'left' },
 *     { field: 'name', header: 'Name' },
 *     // ... scrollable columns
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
  override onPluginQuery(query: PluginQuery): unknown {
    switch (query.type) {
      case PLUGIN_QUERIES.CAN_MOVE_COLUMN: {
        // Prevent pinned columns from being moved/reordered.
        // Pinned columns have fixed positions and should not be draggable.
        const column = query.context as ColumnConfig;
        const sticky = (column as ColumnConfig & { sticky?: 'left' | 'right' }).sticky;
        if (sticky === 'left' || sticky === 'right') {
          return false;
        }
        // Also check meta.sticky for backwards compatibility
        const metaSticky = (column.meta as { sticky?: 'left' | 'right' } | undefined)?.sticky;
        if (metaSticky === 'left' || metaSticky === 'right') {
          return false;
        }
        return undefined; // Let other plugins or default behavior decide
      }
      default:
        return undefined;
    }
  }
  // #endregion

  // #region Public API

  /**
   * Re-apply sticky offsets (e.g., after column resize).
   */
  refreshStickyOffsets(): void {
    const columns = [...this.columns];
    applyStickyOffsets(this.grid as unknown as HTMLElement, columns);
  }

  /**
   * Get columns pinned to the left.
   */
  getLeftPinnedColumns(): ColumnConfig[] {
    const columns = [...this.columns];
    return getLeftStickyColumns(columns);
  }

  /**
   * Get columns pinned to the right.
   */
  getRightPinnedColumns(): ColumnConfig[] {
    const columns = [...this.columns];
    return getRightStickyColumns(columns);
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
