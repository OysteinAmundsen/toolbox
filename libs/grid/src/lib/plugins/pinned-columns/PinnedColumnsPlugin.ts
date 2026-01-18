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
 * @example
 * ```ts
 * new PinnedColumnsPlugin({ enabled: true })
 * ```
 */
export class PinnedColumnsPlugin extends BaseGridPlugin<PinnedColumnsConfig> {
  readonly name = 'pinnedColumns';

  protected override get defaultConfig(): Partial<PinnedColumnsConfig> {
    return {};
  }

  // #region Internal State
  private isApplied = false;
  private leftOffsets = new Map<string, number>();
  private rightOffsets = new Map<string, number>();
  // #endregion

  // #region Lifecycle

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

  override processColumns(columns: readonly ColumnConfig[]): ColumnConfig[] {
    // Mark that we have sticky columns to apply
    this.isApplied = hasStickyColumns([...columns]);
    return [...columns];
  }

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
