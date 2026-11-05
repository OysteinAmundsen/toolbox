/**
 * Pinned Columns Plugin (Class-based)
 *
 * Enables column pinning (sticky left/right positioning).
 */

import { GridClasses } from '../../core/constants';
import { applyInitialOrder } from '../../core/internal/columns';
import { getDirection, resolveInlinePosition, type TextDirection } from '../../core/internal/utils';
import type { AfterCellRenderContext, PluginManifest, PluginQuery, ScrollEvent } from '../../core/plugin/base-plugin';
import { BaseGridPlugin } from '../../core/plugin/base-plugin';
import type { ColumnConfig, ColumnInternal } from '../../core/types';
import type { ContextMenuParams, HeaderContextMenuItem } from '../context-menu/types';
import { dataFieldSelector } from '../shared/data-field-selector';
import { applyCellStickyOffset, PINNED_OFFSETS_CHANGE, type StickyOffsets } from '../shared/pin-order';
import {
  applyStickyOffsets,
  clearCellStickyOffset,
  clearStickyOffsets,
  getColumnPinned,
  getLeftStickyColumns,
  getRightStickyColumns,
  hasStickyColumns,
  queryOwn,
  reorderColumnsForPinning,
  type GroupEndAdjustments,
  type SplitGroupState,
  type StickyOffsetsResult,
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
 * @since 0.1.1
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
    events: [
      {
        type: PINNED_OFFSETS_CHANGE,
        description: 'Emitted on the plugin bus when the measured sticky offsets change',
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
  /** Direction the offset maps were measured in; resolves logical pins per cell without a style read. */
  #offsetsDirection: TextDirection = 'ltr';
  /** Group-end adjustments for pin boundaries within implicit groups. */
  #groupEndAdjustments: GroupEndAdjustments = { addGroupEnd: new Set(), removeGroupEnd: new Set() };
  /** Split explicit-group state for scroll-driven label transfer. */
  #splitGroups: SplitGroupState[] = [];
  /**
   * Field order before the columns were pinned, re-synced with the column set on every
   * `setPinPosition`. Used to restore original positions when unpinning.
   */
  #originalColumnOrder: string[] = [];
  /** Fields pinned as of the last `setPinPosition`, including pins absent from the current layout. */
  #pinnedFields = new Set<string>();
  /**
   * The list the last `setPinPosition` assigned to `grid.columns`, in the order processing will give it,
   * and the `effectiveConfig.columns` array at that moment. The grid applies the assignment in a
   * microtask, so until that array is replaced the next same-tick call must build on this list, not
   * the stale `this.columns` (#618).
   */
  #pendingColumns: { columns: ColumnConfig[]; base: readonly ColumnConfig[] } | null = null;
  /**
   * Light-DOM elements whose `pinned` attribute has already seeded a column.
   * The attribute supplies the INITIAL pin only — seeding once guarantees a
   * later runtime unpin (which clears `col.pinned`) is not re-applied on the
   * next `processColumns` pass (issue #272).
   */
  #seededFromAttr = new WeakSet<HTMLElement>();
  /** `getStickyOffsets` response, built once per offset change instead of per query. */
  #offsetsSnapshot: StickyOffsets | null = null;
  // #endregion

  // #region Lifecycle

  /** @internal */
  override detach(): void {
    this.leftOffsets.clear();
    this.rightOffsets.clear();
    this.#offsetsSnapshot = null;
    this.isApplied = false;
    this.#groupEndAdjustments = { addGroupEnd: new Set(), removeGroupEnd: new Set() };
    this.#splitGroups = [];
    this.#originalColumnOrder = [];
    this.#pinnedFields.clear();
    this.#pendingColumns = null;
    // Reset seeded elements so a re-attached instance re-seeds from the same
    // light-DOM `pinned` attributes instead of permanently ignoring them (#272).
    this.#seededFromAttr = new WeakSet<HTMLElement>();
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

  /**
   * Seed `col.pinned` from the declarative `pinned` attribute on the originating
   * light-DOM element (issue #272). Each element seeds a column at most once: after
   * the first pass the element is recorded, so a later runtime unpin (which clears
   * `col.pinned`) is never overridden by re-reading the attribute. The
   * `pinned != null` guard lets a programmatic config value win on that first pass.
   */
  #seedFromAttributes(cols: readonly ColumnConfig[]): void {
    for (const col of cols) {
      const el = (col as ColumnInternal).__element;
      if (!el || this.#seededFromAttr.has(el)) continue;
      this.#seededFromAttr.add(el);
      if (col.pinned != null) continue;
      const pinned = el.getAttribute('pinned');
      if (pinned === 'left' || pinned === 'right' || pinned === 'start' || pinned === 'end') {
        col.pinned = pinned;
      }
    }
  }

  /**
   * Move pinned columns to the edges on the FULL column list, so hidden columns keep
   * their place among the unpinned ones and reappear there when shown (#512).
   * @internal
   */
  override orderColumns(columns: readonly ColumnConfig[]): ColumnConfig[] {
    const cols = [...columns];
    this.#seedFromAttributes(cols);
    if (!hasStickyColumns(cols)) return cols;
    const host = this.gridElement;
    return reorderColumnsForPinning(cols, host ? getDirection(host) : 'ltr') as ColumnConfig[];
  }

  /** @internal */
  override processColumns(columns: readonly ColumnConfig[]): ColumnConfig[] {
    const cols = [...columns];
    this.#seedFromAttributes(cols);
    this.isApplied = hasStickyColumns(cols);
    if (!this.isApplied) return cols;

    const host = this.gridElement;
    const direction = host ? getDirection(host) : 'ltr';
    return reorderColumnsForPinning(cols, direction) as ColumnConfig[];
  }

  /**
   * Rebuild the unpin snapshot from the current columns: unpinned columns in their current order,
   * each pinned column after the unpinned column that preceded it in the previous snapshot (or in
   * the current order, for pins the snapshot hasn't seen). So column-set and order changes
   * (pivot toggle, `columns` replacement, reorder) can't leave it stale (#615). A pin keeps the
   * absent fields since its last present unpinned predecessor, and an absent pin (e.g. a source
   * column during pivot) keeps its own slot too, so either still restores after a round-trip,
   * hidden or not. Other absent fields are dropped, keeping the snapshot bounded by the layout.
   */
  #syncOriginalOrder(columns: readonly ColumnConfig[]): void {
    const present = new Set<string>();
    const pinned = new Set<string>();
    const hiddenPins = new Set<string>();
    const unpinned: string[] = [];
    for (const c of columns) {
      present.add(c.field);
      if (!getColumnPinned(c)) unpinned.push(c.field);
      else {
        pinned.add(c.field);
        if (c.hidden) hiddenPins.add(c.field);
      }
    }
    const unpinnedSet = new Set(unpinned);
    const stillPinned = new Set(pinned);
    const byAnchor = new Map<string | null, string[]>(); // null = leading edge
    const place = (prev: string | null, fields: string[]) => {
      const list = byAnchor.get(prev);
      if (list) list.push(...fields);
      else byAnchor.set(prev, fields);
    };
    let prev: string | null = null;
    let run: string[] = []; // absent unpinned fields since `prev`, kept only as anchors of a pin
    for (const f of this.#originalColumnOrder) {
      if (unpinnedSet.has(f)) {
        prev = f;
        run = [];
        continue;
      }
      const isAbsent = !present.has(f);
      if (!pinned.delete(f) && !(isAbsent && this.#pinnedFields.has(f))) {
        if (isAbsent) run.push(f);
        continue;
      }
      // Only hidden or absent pins return to a source slot; a visible pin is a persistent column.
      const keepRun = isAbsent || hiddenPins.has(f);
      place(prev, keepRun ? [...run, f] : [f]);
      if (keepRun) run = [];
      stillPinned.add(f);
    }
    prev = null;
    for (const { field } of columns) {
      if (unpinnedSet.has(field)) prev = field;
      else if (pinned.delete(field)) place(prev, [field]);
    }
    this.#pinnedFields = stillPinned;
    this.#originalColumnOrder = [
      ...(byAnchor.get(null) ?? []),
      ...unpinned.flatMap((f) => [f, ...(byAnchor.get(f) ?? [])]),
    ];
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

    // Apply sticky offsets after a microtask to ensure DOM is ready. Offsets map header-group
    // `grid-column` tracks, which exist only for RENDERED columns (column windowing, #603).
    queueMicrotask(() => {
      this.#storeOffsets(applyStickyOffsets(host, [...this.visibleColumns]));
      // Re-apply scroll-driven state (transfer + translateX) to the fresh DOM elements
      this.#updateSplitGroupScroll();
    });
  }

  /** Keep the measured offsets and tell offset-caching plugins (Pivot) that they changed. */
  #storeOffsets(result: StickyOffsetsResult): void {
    this.#clearLostPins(this.leftOffsets, result);
    this.#clearLostPins(this.rightOffsets, result);
    this.#groupEndAdjustments = result.groupEndAdjustments;
    this.leftOffsets = result.leftOffsets;
    this.rightOffsets = result.rightOffsets;
    this.#offsetsDirection = result.direction;
    this.#splitGroups = result.splitGroups;
    this.#offsetsSnapshot = null;
    this.emitPluginEvent(PINNED_OFFSETS_CHANGE, null);
  }

  /**
   * Clear body cells of fields that were sticky in the previous measure but not in this one.
   * `afterCellRender` clears most of them during the render, but core skips it for cells with an
   * active editor, and the re-measure only visits columns that are still pinned (PR #630).
   */
  #clearLostPins(previous: ReadonlyMap<string, number>, result: StickyOffsetsResult): void {
    for (const field of previous.keys()) {
      if (result.leftOffsets.has(field) || result.rightOffsets.has(field)) continue;
      for (const el of queryOwn(this.gridElement, `.data-grid-row .cell${dataFieldSelector(field)}`)) {
        clearCellStickyOffset(el);
      }
    }
  }

  /** This grid's own header and body cells of `field` (never a nested grid's). */
  #ownFieldCells(field: string): HTMLElement[] {
    const sel = dataFieldSelector(field);
    return queryOwn(this.gridElement, `.header-row .cell${sel}, .data-grid-row .cell${sel}`);
  }

  /**
   * Apply sticky positioning and group-end adjustments on cells rendered during scroll.
   * When virtualization recycles row pool elements, newly rendered cells lack the
   * inline sticky styles applied by `applyStickyOffsets` in `afterRender`. This hook
   * ensures every cell gets correct sticky positioning using the cached offset maps.
   *
   * The maps are only re-measured after the render, so a cached offset is replayed only for
   * the column's CURRENT side. A cell whose field is cached for a side it no longer has
   * (re-pinned to the other side #619, or unpinned #621) is cleared instead; core patches
   * cells in place, and the re-measure only visits columns that are still pinned.
   * @internal
   */
  override afterCellRender(context: AfterCellRenderContext): void {
    if (!this.isApplied) return;
    const column = context.column;
    const field = column.field;
    const cellEl = context.cellElement;

    const pinned = getColumnPinned(column);
    const side = pinned ? resolveInlinePosition(pinned, this.#offsetsDirection) : undefined;
    const left = side === 'left' ? this.leftOffsets.get(field) : undefined;
    const right = side === 'right' ? this.rightOffsets.get(field) : undefined;
    if (left !== undefined || right !== undefined) {
      applyCellStickyOffset(cellEl, left, right);
    } else if (this.leftOffsets.has(field) || this.rightOffsets.has(field)) {
      clearCellStickyOffset(cellEl);
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
        for (const el of this.#ownFieldCells(sg.pinnedField)) el.classList.add('group-end');

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
        for (const el of this.#ownFieldCells(sg.pinnedField)) el.classList.remove('group-end');

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
        // Pivot re-applies these to its custom rows; the snapshot is rebuilt only when offsets change.
        return (this.#offsetsSnapshot ??= {
          left: Object.fromEntries(this.leftOffsets),
          right: Object.fromEntries(this.rightOffsets),
        });
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
            label: this.t('pinnedColumns.unpin', 'Unpin Column'),
            icon: '📌',
            order: 40,
            action: () => this.setPinPosition(column.field, undefined),
          });
        } else {
          items.push({
            id: 'pinned/pin-left',
            label: this.t('pinnedColumns.pinLeft', 'Pin Left'),
            icon: '⬅',
            order: 40,
            action: () => this.setPinPosition(column.field, 'left'),
          });
          items.push({
            id: 'pinned/pin-right',
            label: this.t('pinnedColumns.pinRight', 'Pin Right'),
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
    const currentColumns = this.#latestColumns();
    if (!currentColumns?.length) return;

    const currentIndex = currentColumns.findIndex((col) => col.field === field);
    if (currentIndex === -1) return;

    this.#syncOriginalOrder(currentColumns);

    // Pin the live column in place, like `setColumnVisible` writes `hidden`: a copy would drop
    // runtime changes made to the live column before the grid applies the list (PR #628).
    const col = currentColumns[currentIndex] as ColumnConfig & { pinned?: PinnedPosition };
    if (position) {
      this.#pinnedFields.add(field);
      col.pinned = position;
      // processColumns moves it to the edge on the next render
      this.#assignColumns([...currentColumns]);
    } else {
      // UNPINNING: restore column to its original position
      this.#pinnedFields.delete(field);
      delete col.pinned;

      // Remove from current position
      const remaining = [...currentColumns];
      remaining.splice(currentIndex, 1);

      // Insert before the first unpinned column whose original position is after this one.
      const originalIndex = this.#originalColumnOrder.indexOf(field);
      let insertIndex = remaining.length;
      for (let i = 0; i < remaining.length; i++) {
        if (getColumnPinned(remaining[i])) continue;
        if (this.#originalColumnOrder.indexOf(remaining[i].field) > originalIndex) {
          insertIndex = i;
          break;
        }
      }
      remaining.splice(insertIndex, 0, col);

      this.#assignColumns(remaining);
    }
  }

  /**
   * The full column list to build a pin change on: the post-processColumns list (hidden included,
   * never the render-only column window — #606), or the list a same-tick `setPinPosition` queued (#618).
   */
  #latestColumns(): ColumnConfig[] {
    const pending = this.#pendingColumns;
    if (pending && pending.base === this.grid?.effectiveConfig?.columns) return pending.columns;
    this.#pendingColumns = null;
    return this.columns;
  }

  #assignColumns(columns: ColumnConfig[]): void {
    const host = this.gridElement as HTMLElement & { columns?: ColumnConfig[] };
    const base = this.grid?.effectiveConfig?.columns;
    host.columns = columns;
    // Order the pending list as `merge()` + `orderColumns` will, but assign the source unordered:
    // pre-partitioning it would shift where `applyInitialOrder` places `order` columns (PR #628).
    this.#pendingColumns = base
      ? {
          columns: reorderColumnsForPinning(applyInitialOrder([...columns] as ColumnInternal[]), getDirection(host)),
          base,
        }
      : null;
  }

  /**
   * Re-apply sticky offsets (e.g., after column resize).
   */
  refreshStickyOffsets(): void {
    this.#storeOffsets(applyStickyOffsets(this.gridElement, [...this.visibleColumns]));
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
      // Calculate from the row's own cells (a nested grid in a cell renderer has its own pins)
      const stickyLeftCells = rowEl.querySelectorAll(`:scope > .${GridClasses.STICKY_LEFT}`);
      const stickyRightCells = rowEl.querySelectorAll(`:scope > .${GridClasses.STICKY_RIGHT}`);
      stickyLeftCells.forEach((el) => {
        left += (el as HTMLElement).offsetWidth;
      });
      stickyRightCells.forEach((el) => {
        right += (el as HTMLElement).offsetWidth;
      });
    } else {
      // Fall back to header row if no row element provided
      const headerCells = queryOwn(this.gridElement, '.header-row .cell');
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
