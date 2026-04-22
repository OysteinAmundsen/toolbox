/**
 * Pinned Columns Plugin (Class-based)
 *
 * Enables column pinning (sticky left/right positioning).
 */

import { GridClasses } from '../../core/constants';
import { getDirection } from '../../core/internal/utils';
import type { AfterCellRenderContext, PluginManifest, PluginQuery, ScrollEvent } from '../../core/plugin/base-plugin';
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
  reorderColumnsForPinning,
  type GroupEndAdjustments,
  type SplitGroupState,
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
 * | `lockPinning` | `boolean` | `false` | Prevent user from pin/unpin via context menu (legacy `meta.lockPinning` is honored) |
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
 * import { queryGrid } from '@toolbox-web/grid';
 * import { PinnedColumnsPlugin } from '@toolbox-web/grid/plugins/pinned-columns';
 *
 * const grid = queryGrid('tbw-grid');
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
    hookPriority: {
      // Reorder columns before other plugins (e.g. TreePlugin) wrap them
      processColumns: -10,
    },
    ownedProperties: [
      {
        property: 'pinned',
        level: 'column',
        description: 'the "pinned" column property',
        isUsed: (v) => v === 'left' || v === 'right' || v === 'start' || v === 'end',
      },
    ],
    queries: [
      {
        type: QUERY_CAN_MOVE_COLUMN,
        description: 'Prevents pinned columns from being moved/reordered',
      },
      {
        type: 'getStickyOffsets',
        description: 'Returns the offsets for left/right pinned columns',
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
  /** Group-end adjustments for pin boundaries within implicit groups. */
  #groupEndAdjustments: GroupEndAdjustments = { addGroupEnd: new Set(), removeGroupEnd: new Set() };
  /** Split explicit-group state for scroll-driven label transfer. */
  #splitGroups: SplitGroupState[] = [];
  /**
   * Snapshot of the column field order before the first context-menu pin.
   * Used to restore original positions when unpinning.
   */
  #originalColumnOrder: string[] = [];
  // #endregion

  // #region Lifecycle

  /** @internal */
  override detach(): void {
    this.leftOffsets.clear();
    this.rightOffsets.clear();
    this.isApplied = false;
    this.#groupEndAdjustments = { addGroupEnd: new Set(), removeGroupEnd: new Set() };
    this.#splitGroups = [];
    this.#originalColumnOrder = [];
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
    const cols = [...columns];
    this.isApplied = hasStickyColumns(cols);
    if (!this.isApplied) return cols;

    const host = this.gridElement;
    const direction = host ? getDirection(host) : 'ltr';
    return reorderColumnsForPinning(cols, direction) as ColumnConfig[];
  }

  /** @internal */
  override afterRender(): void {
    if (!this.isApplied) {
      return;
    }

    const host = this.gridElement;
    const columns = [...this.columns];

    if (!hasStickyColumns(columns)) {
      clearStickyOffsets(host);
      this.isApplied = false;
      return;
    }

    // Apply sticky offsets after a microtask to ensure DOM is ready
    queueMicrotask(() => {
      const result = applyStickyOffsets(host, columns);
      this.#groupEndAdjustments = result.groupEndAdjustments;
      this.leftOffsets = result.leftOffsets;
      this.rightOffsets = result.rightOffsets;
      this.#splitGroups = result.splitGroups;
      // Re-apply scroll-driven state (transfer + translateX) to the fresh DOM elements
      this.#updateSplitGroupScroll();
    });
  }

  /**
   * Apply sticky positioning and group-end adjustments on cells rendered during scroll.
   * When virtualization recycles row pool elements, newly rendered cells lack the
   * inline sticky styles applied by `applyStickyOffsets` in `afterRender`. This hook
   * ensures every cell gets correct sticky positioning using the cached offset maps.
   * @internal
   */
  override afterCellRender(context: AfterCellRenderContext): void {
    if (!this.isApplied) return;
    const field = context.column.field;
    const cellEl = context.cellElement;

    // Apply sticky positioning from cached offset maps
    const leftOffset = this.leftOffsets.get(field);
    if (leftOffset !== undefined) {
      if (!cellEl.classList.contains(GridClasses.STICKY_LEFT)) {
        cellEl.classList.add(GridClasses.STICKY_LEFT);
      }
      cellEl.style.position = 'sticky';
      cellEl.style.left = leftOffset + 'px';
    } else {
      const rightOffset = this.rightOffsets.get(field);
      if (rightOffset !== undefined) {
        if (!cellEl.classList.contains(GridClasses.STICKY_RIGHT)) {
          cellEl.classList.add(GridClasses.STICKY_RIGHT);
        }
        cellEl.style.position = 'sticky';
        cellEl.style.right = rightOffset + 'px';
      }
    }

    // Maintain group-end adjustments at pin boundaries
    if (this.#groupEndAdjustments.addGroupEnd.has(field)) {
      context.cellElement.classList.add('group-end');
    } else if (this.#groupEndAdjustments.removeGroupEnd.has(field)) {
      context.cellElement.classList.remove('group-end');
    }
  }

  /**
   * Handle horizontal scroll to manage floating group labels.
   *
   * When an explicit column group has a mix of pinned and non-pinned columns,
   * the label starts in the scrollable fragment and floats toward the pinned
   * column via CSS `position: sticky`.  Once the scrollable fragment scrolls
   * far enough that the label would be clipped, this hook transfers the label
   * into the sticky pinned fragment and applies `.group-end` to the pinned
   * column cells, creating a visual separator.  Scrolling back reverses the
   * transfer.
   * @internal
   */
  override onScroll(_event: ScrollEvent): void {
    this.#updateSplitGroupScroll();
  }

  /**
   * Apply scroll-driven state to split group headers.
   *
   * Handles both the manual translateX positioning (simulating sticky) and the
   * transfer of the label into/out of the pinned fragment with `.group-end`.
   * Called from `onScroll` on every scroll event and from `afterRender` after
   * the split group DOM is rebuilt (e.g. after selection click triggers re-render).
   */
  #updateSplitGroupScroll(): void {
    if (!this.isApplied || this.#splitGroups.length === 0) return;

    const host = this.gridElement;

    for (const sg of this.#splitGroups) {
      const pinnedRect = sg.pinnedFragment.getBoundingClientRect();
      const scrollableRect = sg.scrollableFragment.getBoundingClientRect();

      // Transfer when the non-pinned fragment's right edge reaches the pinned
      // fragment's right edge — all non-pinned columns scrolled behind the pin.
      const shouldTransfer = scrollableRect.right <= pinnedRect.right;

      if (shouldTransfer && !sg.isTransferred) {
        // Move label into the pinned fragment
        sg.pinnedFragment.textContent = sg.label;
        sg.pinnedFragment.style.overflow = 'hidden';
        sg.pinnedFragment.style.textOverflow = 'ellipsis';
        sg.pinnedFragment.style.whiteSpace = 'nowrap';
        sg.pinnedFragment.style.borderRightStyle = '';
        sg.floatLabel.style.visibility = 'hidden';
        sg.floatLabel.style.transform = '';
        sg.floatOffset = 0;

        // Add group-end to pinned column header + body cells
        this.#groupEndAdjustments.addGroupEnd.add(sg.pinnedField);
        host
          .querySelectorAll(
            `.header-row .cell[data-field="${sg.pinnedField}"], .data-grid-row .cell[data-field="${sg.pinnedField}"]`,
          )
          .forEach((el) => el.classList.add('group-end'));

        sg.isTransferred = true;
      } else if (!shouldTransfer && sg.isTransferred) {
        // Reverse transfer — label goes back to the floating span
        sg.pinnedFragment.textContent = '';
        sg.pinnedFragment.style.overflow = '';
        sg.pinnedFragment.style.textOverflow = '';
        sg.pinnedFragment.style.whiteSpace = '';
        sg.pinnedFragment.style.borderRightStyle = 'none';
        sg.floatLabel.style.visibility = '';
        sg.floatLabel.style.transform = '';
        sg.floatOffset = 0;

        // Remove group-end from pinned column cells
        this.#groupEndAdjustments.addGroupEnd.delete(sg.pinnedField);
        host
          .querySelectorAll(
            `.header-row .cell[data-field="${sg.pinnedField}"], .data-grid-row .cell[data-field="${sg.pinnedField}"]`,
          )
          .forEach((el) => el.classList.remove('group-end'));

        sg.isTransferred = false;
      }

      // Manually position the floating label to simulate sticky behavior.
      // CSS sticky can't be used because .header-group-cell has overflow:hidden.
      // We track the current translateX offset to correctly compute the span's
      // natural (un-translated) position from its measured rect.
      if (!sg.isTransferred) {
        const spanRect = sg.floatLabel.getBoundingClientRect();
        const spanNaturalLeft = spanRect.left - sg.floatOffset;
        const targetLeft = pinnedRect.left;
        if (spanNaturalLeft < targetLeft) {
          sg.floatOffset = targetLeft - spanNaturalLeft;
          sg.floatLabel.style.transform = `translateX(${sg.floatOffset}px)`;
        } else {
          sg.floatOffset = 0;
          sg.floatLabel.style.transform = '';
        }
      }
    }
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
        // (top-level `lockPinning` preferred; legacy `meta.lockPinning` honored for back-compat)
        if (column.lockPinning || column.meta?.lockPinning) return undefined;

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

    const currentIndex = currentColumns.findIndex((col) => col.field === field);
    if (currentIndex === -1) return;

    const gridEl = this.gridElement as HTMLElement & { columns?: ColumnConfig[] };

    if (position) {
      // PINNING: snapshot original column order if this is the first context-menu pin.
      // The snapshot lets us restore columns to their original positions on unpin.
      if (this.#originalColumnOrder.length === 0) {
        this.#originalColumnOrder = currentColumns.map((c) => c.field);
      }

      // Set the pinned property; processColumns will reorder on next render
      const updated = currentColumns.map((col) => {
        if (col.field !== field) return col;
        const copy = { ...col };
        (copy as ColumnConfig & { pinned?: PinnedPosition }).pinned = position;
        return copy;
      });

      gridEl.columns = updated;
    } else {
      // UNPINNING: restore column to its original position
      const col = currentColumns[currentIndex];
      const copy = { ...col };
      delete (copy as ColumnConfig & { pinned?: PinnedPosition }).pinned;

      // Remove from current position
      const remaining = [...currentColumns];
      remaining.splice(currentIndex, 1);

      // Find the best insertion point using the original order snapshot
      const originalIndex = this.#originalColumnOrder.indexOf(field);
      if (originalIndex >= 0) {
        // Scan remaining non-pinned columns and find the first whose original
        // position is greater than this column's original position.
        let insertIndex = remaining.length;
        for (let i = 0; i < remaining.length; i++) {
          if (getColumnPinned(remaining[i])) continue; // skip pinned columns
          const otherOriginal = this.#originalColumnOrder.indexOf(remaining[i].field);
          if (otherOriginal > originalIndex) {
            insertIndex = i;
            break;
          }
        }
        remaining.splice(insertIndex, 0, copy);
      } else {
        // Original position unknown — keep at current index
        remaining.splice(Math.min(currentIndex, remaining.length), 0, copy);
      }

      // If no more pinned columns remain, clear the snapshot
      if (!remaining.some((c) => getColumnPinned(c) != null)) {
        this.#originalColumnOrder = [];
      }

      gridEl.columns = remaining;
    }
  }

  /**
   * Re-apply sticky offsets (e.g., after column resize).
   */
  refreshStickyOffsets(): void {
    const columns = [...this.columns];
    const result = applyStickyOffsets(this.gridElement, columns);
    this.#groupEndAdjustments = result.groupEndAdjustments;
    this.leftOffsets = result.leftOffsets;
    this.rightOffsets = result.rightOffsets;
    this.#splitGroups = result.splitGroups;
  }

  /**
   * Get columns pinned to the left (after resolving logical positions for current direction).
   */
  getLeftPinnedColumns(): ColumnConfig[] {
    const columns = [...this.columns];
    const direction = getDirection(this.gridElement);
    return getLeftStickyColumns(columns, direction);
  }

  /**
   * Get columns pinned to the right (after resolving logical positions for current direction).
   */
  getRightPinnedColumns(): ColumnConfig[] {
    const columns = [...this.columns];
    const direction = getDirection(this.gridElement);
    return getRightStickyColumns(columns, direction);
  }

  /**
   * Clear all sticky positioning.
   */
  clearStickyPositions(): void {
    clearStickyOffsets(this.gridElement);
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
      const stickyLeftCells = rowEl.querySelectorAll(`.${GridClasses.STICKY_LEFT}`);
      const stickyRightCells = rowEl.querySelectorAll(`.${GridClasses.STICKY_RIGHT}`);
      stickyLeftCells.forEach((el) => {
        left += (el as HTMLElement).offsetWidth;
      });
      stickyRightCells.forEach((el) => {
        right += (el as HTMLElement).offsetWidth;
      });
    } else {
      // Fall back to header row if no row element provided
      const host = this.gridElement;
      const headerCells = host.querySelectorAll('.header-row .cell');
      headerCells.forEach((cell) => {
        if (cell.classList.contains(GridClasses.STICKY_LEFT)) {
          left += (cell as HTMLElement).offsetWidth;
        } else if (cell.classList.contains(GridClasses.STICKY_RIGHT)) {
          right += (cell as HTMLElement).offsetWidth;
        }
      });
    }

    // Skip horizontal scrolling if focused cell is pinned (it's always visible)
    const skipScroll =
      focusedCell?.classList.contains(GridClasses.STICKY_LEFT) ||
      focusedCell?.classList.contains(GridClasses.STICKY_RIGHT);

    return { left, right, skipScroll };
  }
  // #endregion
}
