/**
 * Pinned Columns Core Logic
 *
 * Pure functions for applying pinned (sticky) column positioning.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { GridClasses } from '../../core/constants';
import { getDirection, resolveInlinePosition, type TextDirection } from '../../core/internal/utils';
import type { PinnedPosition, ResolvedPinnedPosition } from './types';

/**
 * Get the effective pinned position from a column.
 *
 * @param col - Column configuration object
 * @returns The pinned position, or undefined if not pinned
 */
export function getColumnPinned(col: any): PinnedPosition | undefined {
  return col.pinned ?? col.meta?.pinned;
}

/**
 * Resolve a pinned position to a physical position based on text direction.
 *
 * - `'left'` / `'right'` → unchanged (physical values)
 * - `'start'` → `'left'` in LTR, `'right'` in RTL
 * - `'end'` → `'right'` in LTR, `'left'` in RTL
 *
 * @param position - The pinned position (logical or physical)
 * @param direction - Text direction ('ltr' or 'rtl')
 * @returns Physical pinned position ('left' or 'right')
 */
export function resolveStickyPosition(position: PinnedPosition, direction: TextDirection): ResolvedPinnedPosition {
  return resolveInlinePosition(position, direction);
}

/**
 * Check if a column is pinned on the left (after resolving logical positions).
 */
function isResolvedLeft(col: any, direction: TextDirection): boolean {
  const pinned = getColumnPinned(col);
  if (!pinned) return false;
  return resolveStickyPosition(pinned, direction) === 'left';
}

/**
 * Check if a column is pinned on the right (after resolving logical positions).
 */
function isResolvedRight(col: any, direction: TextDirection): boolean {
  const pinned = getColumnPinned(col);
  if (!pinned) return false;
  return resolveStickyPosition(pinned, direction) === 'right';
}

/**
 * Get columns that should be sticky on the left.
 *
 * @param columns - Array of column configurations
 * @param direction - Text direction (default: 'ltr')
 * @returns Array of columns with sticky='left' or sticky='start' (in LTR)
 */
export function getLeftStickyColumns(columns: any[], direction: TextDirection = 'ltr'): any[] {
  return columns.filter((col) => isResolvedLeft(col, direction));
}

/**
 * Get columns that should be sticky on the right.
 *
 * @param columns - Array of column configurations
 * @param direction - Text direction (default: 'ltr')
 * @returns Array of columns with sticky='right' or sticky='end' (in LTR)
 */
export function getRightStickyColumns(columns: any[], direction: TextDirection = 'ltr'): any[] {
  return columns.filter((col) => isResolvedRight(col, direction));
}

/**
 * Check if any columns have sticky positioning.
 *
 * @param columns - Array of column configurations
 * @returns True if any column has sticky position
 */
export function hasStickyColumns(columns: any[]): boolean {
  for (let i = 0; i < columns.length; i++) {
    if (columns[i].pinned != null || columns[i].meta?.pinned != null) return true;
  }
  return false;
}

/**
 * Get the sticky position of a column.
 *
 * @param column - Column configuration
 * @returns The sticky position or null if not sticky
 */
export function getColumnStickyPosition(column: any): PinnedPosition | null {
  return getColumnPinned(column) ?? null;
}

/**
 * Calculate left offsets for sticky-left columns.
 * Returns a map of field -> offset in pixels.
 *
 * @param columns - Array of column configurations (in order)
 * @param getColumnWidth - Function to get column width by field
 * @param direction - Text direction (default: 'ltr')
 * @returns Map of field to left offset
 */
export function calculateLeftStickyOffsets(
  columns: any[],
  getColumnWidth: (field: string) => number,
  direction: TextDirection = 'ltr',
): Map<string, number> {
  const offsets = new Map<string, number>();
  let currentOffset = 0;

  for (const col of columns) {
    if (isResolvedLeft(col, direction)) {
      offsets.set(col.field, currentOffset);
      currentOffset += getColumnWidth(col.field);
    }
  }

  return offsets;
}

/**
 * Calculate right offsets for sticky-right columns.
 * Processes columns in reverse order.
 *
 * @param columns - Array of column configurations (in order)
 * @param getColumnWidth - Function to get column width by field
 * @param direction - Text direction (default: 'ltr')
 * @returns Map of field to right offset
 */
export function calculateRightStickyOffsets(
  columns: any[],
  getColumnWidth: (field: string) => number,
  direction: TextDirection = 'ltr',
): Map<string, number> {
  const offsets = new Map<string, number>();
  let currentOffset = 0;

  // Process in reverse for right-sticky columns
  const reversed = [...columns].reverse();
  for (const col of reversed) {
    if (isResolvedRight(col, direction)) {
      offsets.set(col.field, currentOffset);
      currentOffset += getColumnWidth(col.field);
    }
  }

  return offsets;
}

/**
 * Adjustments to `group-end` borders at pin boundaries within implicit groups.
 * - `addGroupEnd`: fields that should gain `group-end` (last pinned column at boundary)
 * - `removeGroupEnd`: fields that should lose `group-end` (lone non-pinned remnant)
 */
export interface GroupEndAdjustments {
  addGroupEnd: Set<string>;
  removeGroupEnd: Set<string>;
}

/**
 * Result of applying sticky offsets — includes both the group-end adjustments
 * and the measured left/right offset maps for use in per-cell rendering hooks.
 */
export interface StickyOffsetsResult {
  groupEndAdjustments: GroupEndAdjustments;
  leftOffsets: Map<string, number>;
  rightOffsets: Map<string, number>;
  splitGroups: SplitGroupState[];
}

/**
 * State for an explicit group header that was split at a pin boundary.
 *
 * The pinned fragment is sticky and initially empty. The non-pinned fragment
 * holds the label in a CSS-sticky span that floats toward the pinned area on
 * horizontal scroll.  When the non-pinned fragment scrolls far enough, the
 * plugin's `onScroll` handler transfers the label into the pinned fragment.
 */
export interface SplitGroupState {
  /** Group identifier (data-group attribute value). */
  groupId: string;
  /** Original group label text. */
  label: string;
  /** The sticky (pinned) fragment element. */
  pinnedFragment: HTMLElement;
  /** The scrollable (non-pinned) fragment element. */
  scrollableFragment: HTMLElement;
  /** The floating <span> inside the scrollable fragment. */
  floatLabel: HTMLElement;
  /** Field of the last pinned column — used to toggle `.group-end`. */
  pinnedField: string;
  /** Whether the label is currently shown inside the pinned fragment. */
  isTransferred: boolean;
  /** Current translateX offset applied to the floating label (px). */
  floatOffset: number;
}

/**
 * Apply sticky offsets to header and body cells.
 * This modifies the DOM elements in place.
 *
 * @param host - The grid host element (render root for DOM queries)
 * @param columns - Array of column configurations
 * @returns Sticky offsets result with group-end adjustments and measured offset maps
 */
export function applyStickyOffsets(host: HTMLElement, columns: any[]): StickyOffsetsResult {
  const emptyResult: StickyOffsetsResult = {
    groupEndAdjustments: { addGroupEnd: new Set(), removeGroupEnd: new Set() },
    leftOffsets: new Map(),
    rightOffsets: new Map(),
    splitGroups: [],
  };

  // With light DOM, query the host element directly
  const headerCells = Array.from(host.querySelectorAll('.header-row .cell')) as HTMLElement[];
  if (!headerCells.length) return emptyResult;

  // Detect text direction from the host element
  const direction = getDirection(host);

  // Collect measured offsets for caching in the plugin
  const leftOffsets = new Map<string, number>();
  const rightOffsets = new Map<string, number>();

  // Apply left sticky (includes 'start' in LTR, 'end' in RTL)
  let left = 0;
  for (const col of columns) {
    if (isResolvedLeft(col, direction)) {
      const cell = headerCells.find((c) => c.getAttribute('data-field') === col.field);
      if (cell) {
        leftOffsets.set(col.field, left);
        cell.classList.add(GridClasses.STICKY_LEFT);
        cell.style.position = 'sticky';
        cell.style.left = left + 'px';
        // Body cells: use data-field for reliable matching (data-col indices may differ
        // between _columns and _visibleColumns due to hidden/utility columns)
        host.querySelectorAll(`.data-grid-row .cell[data-field="${col.field}"]`).forEach((el) => {
          el.classList.add(GridClasses.STICKY_LEFT);
          (el as HTMLElement).style.position = 'sticky';
          (el as HTMLElement).style.left = left + 'px';
        });
        left += cell.offsetWidth;
      }
    }
  }

  // Apply right sticky (includes 'end' in LTR, 'start' in RTL) - process in reverse
  let right = 0;
  for (const col of [...columns].reverse()) {
    if (isResolvedRight(col, direction)) {
      const cell = headerCells.find((c) => c.getAttribute('data-field') === col.field);
      if (cell) {
        rightOffsets.set(col.field, right);
        cell.classList.add(GridClasses.STICKY_RIGHT);
        cell.style.position = 'sticky';
        cell.style.right = right + 'px';
        // Body cells: use data-field for reliable matching
        host.querySelectorAll(`.data-grid-row .cell[data-field="${col.field}"]`).forEach((el) => {
          el.classList.add(GridClasses.STICKY_RIGHT);
          (el as HTMLElement).style.position = 'sticky';
          (el as HTMLElement).style.right = right + 'px';
        });
        right += cell.offsetWidth;
      }
    }
  }

  // Apply sticky offsets to column group header cells and collect group-end adjustments
  const splitGroups: SplitGroupState[] = [];
  const adjustments = applyGroupHeaderStickyOffsets(host, columns, headerCells, direction, splitGroups);

  // Apply group-end adjustments to header cells and visible body cells
  if (adjustments.addGroupEnd.size > 0 || adjustments.removeGroupEnd.size > 0) {
    for (const field of adjustments.addGroupEnd) {
      const hCell = headerCells.find((c) => c.getAttribute('data-field') === field);
      if (hCell) hCell.classList.add('group-end');
      host.querySelectorAll(`.data-grid-row .cell[data-field="${field}"]`).forEach((el) => {
        el.classList.add('group-end');
      });
    }
    for (const field of adjustments.removeGroupEnd) {
      const hCell = headerCells.find((c) => c.getAttribute('data-field') === field);
      if (hCell) hCell.classList.remove('group-end');
      host.querySelectorAll(`.data-grid-row .cell[data-field="${field}"]`).forEach((el) => {
        el.classList.remove('group-end');
      });
    }
  }

  return { groupEndAdjustments: adjustments, leftOffsets, rightOffsets, splitGroups };
}

/**
 * Apply sticky offsets to column group header cells.
 * - If ALL columns in a group are pinned the same direction, the whole cell is pinned.
 * - If an implicit (unlabelled) group mixes pinned and non-pinned columns,
 *   the cell is split at pin boundaries so pinned portions can be sticky.
 *
 * @param host - The grid host element
 * @param columns - Array of column configurations
 * @param headerCells - Already-queried header cells (with sticky offsets applied)
 * @param direction - Text direction
 * @returns Group-end adjustments for pin boundaries within implicit groups
 */
function applyGroupHeaderStickyOffsets(
  host: HTMLElement,
  columns: any[],
  headerCells: HTMLElement[],
  direction: TextDirection,
  splitGroups: SplitGroupState[],
): GroupEndAdjustments {
  const adjustments: GroupEndAdjustments = { addGroupEnd: new Set(), removeGroupEnd: new Set() };
  const groupCells = Array.from(host.querySelectorAll('.header-group-row .header-group-cell')) as HTMLElement[];
  if (!groupCells.length) return adjustments;

  for (const groupCell of groupCells) {
    // Parse gridColumn to find which column range this group spans
    // Format: "startCol / span N" (1-based)
    const gridCol = groupCell.style.gridColumn;
    if (!gridCol) continue;

    const match = gridCol.match(/^(\d+)\s*\/\s*span\s+(\d+)$/);
    if (!match) continue;

    const startIdx = parseInt(match[1], 10) - 1; // Convert to 0-based
    const span = parseInt(match[2], 10);
    const endIdx = startIdx + span - 1;

    // Get the columns this group spans
    const spannedColumns = columns.slice(startIdx, endIdx + 1);
    if (!spannedColumns.length) continue;

    const allLeft = spannedColumns.every((col: any) => isResolvedLeft(col, direction));
    const allRight = spannedColumns.every((col: any) => isResolvedRight(col, direction));

    if (allLeft) {
      const firstField = spannedColumns[0].field;
      const firstCell = headerCells.find((c) => c.getAttribute('data-field') === firstField);
      if (firstCell) {
        groupCell.classList.add(GridClasses.STICKY_LEFT);
        groupCell.style.position = 'sticky';
        groupCell.style.left = firstCell.style.left;
      }
    } else if (allRight) {
      const lastField = spannedColumns[spannedColumns.length - 1].field;
      const lastCell = headerCells.find((c) => c.getAttribute('data-field') === lastField);
      if (lastCell) {
        groupCell.classList.add(GridClasses.STICKY_RIGHT);
        groupCell.style.position = 'sticky';
        groupCell.style.right = lastCell.style.right;
      }
    } else if (groupCell.classList.contains('implicit-group')) {
      // Implicit group with mixed pinning: split into separate cells so pinned
      // portions become sticky while non-pinned portions scroll normally.
      splitMixedPinImplicitGroup(groupCell, spannedColumns, startIdx, headerCells, direction, adjustments);
    } else {
      // Explicit (labelled) group with mixed pinning: split the group header so
      // the pinned fragment keeps the label and sticks, while the non-pinned
      // remainder scrolls away. This makes the group header visually shrink to
      // the pinned column width when scrolled horizontally.
      const someLeft = spannedColumns.some((col: any) => isResolvedLeft(col, direction));
      const someRight = spannedColumns.some((col: any) => isResolvedRight(col, direction));
      if (someLeft || someRight) {
        splitMixedPinExplicitGroup(
          groupCell,
          spannedColumns,
          startIdx,
          headerCells,
          direction,
          adjustments,
          splitGroups,
        );
      }
    }
  }

  return adjustments;
}

/** Classify a column's pin state after resolving logical positions. */
type PinState = 'left' | 'right' | 'none';

function getPinState(col: any, direction: TextDirection): PinState {
  if (isResolvedLeft(col, direction)) return 'left';
  if (isResolvedRight(col, direction)) return 'right';
  return 'none';
}

/**
 * Split an implicit (unlabelled) group header cell into fragments at pin-state
 * boundaries. Each fragment becomes its own header-group-cell; pinned fragments
 * get sticky positioning.
 *
 * Also populates `adjustments` with group-end border changes:
 * - Last column of a left-pinned run gets `group-end` (visual separator at pin edge)
 * - Last column of a subsequent non-pinned run that contains only utility columns
 *   loses `group-end` (it visually merges with the adjacent explicit group)
 */
function splitMixedPinImplicitGroup(
  groupCell: HTMLElement,
  spannedColumns: any[],
  startIdx: number,
  headerCells: HTMLElement[],
  direction: TextDirection,
  adjustments: GroupEndAdjustments,
): void {
  // Partition columns into contiguous runs of the same pin state
  const runs: { state: PinState; cols: any[]; colStart: number }[] = [];
  for (let i = 0; i < spannedColumns.length; i++) {
    const state = getPinState(spannedColumns[i], direction);
    const prev = runs[runs.length - 1];
    if (prev && prev.state === state) {
      prev.cols.push(spannedColumns[i]);
    } else {
      runs.push({ state, cols: [spannedColumns[i]], colStart: startIdx + i });
    }
  }

  if (runs.length <= 1) return; // Nothing to split

  const parent = groupCell.parentElement;
  if (!parent) return;

  const nextSibling = groupCell.nextSibling;
  parent.removeChild(groupCell);

  for (const run of runs) {
    const cell = document.createElement('div');
    cell.className = groupCell.className; // Preserves implicit-group, cell, header-group-cell
    cell.setAttribute('data-group', groupCell.getAttribute('data-group') || '');
    cell.style.gridColumn = `${run.colStart + 1} / span ${run.cols.length}`;

    if (run.state === 'left') {
      const firstField = run.cols[0].field;
      const firstCell = headerCells.find((c) => c.getAttribute('data-field') === firstField);
      if (firstCell) {
        cell.classList.add(GridClasses.STICKY_LEFT);
        cell.style.position = 'sticky';
        cell.style.left = firstCell.style.left;
      }
    } else if (run.state === 'right') {
      const lastField = run.cols[run.cols.length - 1].field;
      const lastCell = headerCells.find((c) => c.getAttribute('data-field') === lastField);
      if (lastCell) {
        cell.classList.add(GridClasses.STICKY_RIGHT);
        cell.style.position = 'sticky';
        cell.style.right = lastCell.style.right;
      }
    } else if (run.state === 'none') {
      // Suppress border on utility-only non-pinned remnants — they visually merge
      // with the adjacent explicit group.
      const allUtility = run.cols.every((c: any) => String(c.field || '').startsWith('__tbw_'));
      if (allUtility) {
        cell.style.borderRightStyle = 'none';
      }
    }

    if (nextSibling) {
      parent.insertBefore(cell, nextSibling);
    } else {
      parent.appendChild(cell);
    }
  }

  // Compute group-end adjustments at pin boundaries.
  // When a pinned run is followed by a non-pinned run, the last column of the
  // pinned run should be the visual group boundary (group-end).
  // The non-pinned remnant's last column should lose group-end if all its
  // columns are utility columns (e.g. __tbw_expander) — they visually merge
  // with the adjacent explicit group.
  for (let ri = 0; ri < runs.length; ri++) {
    const run = runs[ri];
    const nextRun = runs[ri + 1];

    if (run.state !== 'none' && nextRun && nextRun.state === 'none') {
      // Last column of pinned run gets group-end
      const lastPinnedField = run.cols[run.cols.length - 1].field;
      if (lastPinnedField) adjustments.addGroupEnd.add(lastPinnedField);
    }

    if (run.state === 'none') {
      // Check if all columns in this non-pinned run are utility columns
      const allUtility = run.cols.every((c: any) => String(c.field || '').startsWith('__tbw_'));
      if (allUtility) {
        // Remove group-end from the last column — it visually merges with the next group
        const lastField = run.cols[run.cols.length - 1].field;
        if (lastField) adjustments.removeGroupEnd.add(lastField);
      }
    }
  }
}

/**
 * Split an explicit (labelled) group header cell at pin boundaries.
 *
 * **Pinned fragment:** sticky, initially empty (no label, no `.group-end`).
 * **Non-pinned fragment:** carries the label inside a CSS-sticky elevated `<span>`.
 * The span floats left over the pinned fragment as the user scrolls horizontally.
 *
 * When the non-pinned fragment's left edge reaches the pinned fragment's right
 * edge (i.e. only the pinned column width remains), the plugin's `onScroll` hook
 * transfers the label into the pinned fragment and adds `.group-end`.
 */
function splitMixedPinExplicitGroup(
  groupCell: HTMLElement,
  spannedColumns: any[],
  startIdx: number,
  headerCells: HTMLElement[],
  direction: TextDirection,
  _adjustments: GroupEndAdjustments,
  splitGroups: SplitGroupState[],
): void {
  // Partition columns into contiguous runs of the same pin state
  const runs: { state: PinState; cols: any[]; colStart: number }[] = [];
  for (let i = 0; i < spannedColumns.length; i++) {
    const state = getPinState(spannedColumns[i], direction);
    const prev = runs[runs.length - 1];
    if (prev && prev.state === state) {
      prev.cols.push(spannedColumns[i]);
    } else {
      runs.push({ state, cols: [spannedColumns[i]], colStart: startIdx + i });
    }
  }

  if (runs.length <= 1) return; // Nothing to split

  const parent = groupCell.parentElement;
  if (!parent) return;

  const label = groupCell.textContent || '';
  const groupId = groupCell.getAttribute('data-group') || '';
  const nextSibling = groupCell.nextSibling;
  parent.removeChild(groupCell);

  // Identify the pinned run and the adjacent non-pinned run.
  const firstLeftRunIdx = runs.findIndex((r) => r.state === 'left');
  let lastRightRunIdx = -1;
  for (let i = runs.length - 1; i >= 0; i--) {
    if (runs[i].state === 'right') {
      lastRightRunIdx = i;
      break;
    }
  }
  const pinnedRunIdx = firstLeftRunIdx >= 0 ? firstLeftRunIdx : lastRightRunIdx;
  const floatRunIdx =
    firstLeftRunIdx >= 0 && firstLeftRunIdx + 1 < runs.length
      ? firstLeftRunIdx + 1
      : lastRightRunIdx >= 0 && lastRightRunIdx - 1 >= 0
        ? lastRightRunIdx - 1
        : -1;

  let pinnedFragment: HTMLElement | undefined;
  let scrollableFragment: HTMLElement | undefined;
  let floatLabel: HTMLElement | undefined;
  let pinnedField = '';

  for (let ri = 0; ri < runs.length; ri++) {
    const run = runs[ri];
    const cell = document.createElement('div');
    cell.className = groupCell.className;
    cell.setAttribute('data-group', groupId);
    cell.style.gridColumn = `${run.colStart + 1} / span ${run.cols.length}`;

    if (run.state === 'left') {
      const firstField = run.cols[0].field;
      const firstCell = headerCells.find((c) => c.getAttribute('data-field') === firstField);
      if (firstCell) {
        cell.classList.add(GridClasses.STICKY_LEFT);
        cell.style.position = 'sticky';
        cell.style.left = firstCell.style.left;
      }

      if (ri === pinnedRunIdx) {
        // Pinned fragment: empty, no group-end, hide border so it merges visually
        cell.style.borderRightStyle = 'none';
        pinnedFragment = cell;
        pinnedField = run.cols[run.cols.length - 1].field;
      }
    } else if (run.state === 'right') {
      const lastField = run.cols[run.cols.length - 1].field;
      const lastCell = headerCells.find((c) => c.getAttribute('data-field') === lastField);
      if (lastCell) {
        cell.classList.add(GridClasses.STICKY_RIGHT);
        cell.style.position = 'sticky';
        cell.style.right = lastCell.style.right;
      }

      if (ri === pinnedRunIdx) {
        cell.style.borderLeftStyle = 'none';
        pinnedFragment = cell;
        pinnedField = run.cols[0].field;
      }
    }

    // The non-pinned run that carries the floating label.
    // CSS sticky won't work here because .header-group-cell has overflow:hidden
    // (set by grouping-columns.css for text clipping). So the plugin's onScroll
    // handler manually translates the span to simulate sticky behavior.
    if (ri === floatRunIdx) {
      // Allow the span to overflow outside the cell when translated left
      cell.style.overflow = 'visible';

      const span = document.createElement('span');
      span.textContent = label;
      span.style.position = 'relative';
      span.style.zIndex = '36';
      span.style.display = 'block';
      span.style.overflow = 'hidden';
      span.style.textOverflow = 'ellipsis';
      span.style.whiteSpace = 'nowrap';

      cell.appendChild(span);
      scrollableFragment = cell;
      floatLabel = span;
    }

    if (nextSibling) {
      parent.insertBefore(cell, nextSibling);
    } else {
      parent.appendChild(cell);
    }
  }

  // Register the split group state so the plugin can manage label transfer on scroll.
  if (pinnedFragment && scrollableFragment && floatLabel && pinnedField) {
    splitGroups.push({
      groupId,
      label,
      pinnedFragment,
      scrollableFragment,
      floatLabel,
      pinnedField,
      isTransferred: false,
      floatOffset: 0,
    });
  }
}

/**
 * Reorder columns so that pinned-left columns come first and pinned-right columns come last.
 * Maintains the relative order within each group (left-pinned, unpinned, right-pinned).
 *
 * @param columns - Array of column configurations (in their current order)
 * @param direction - Text direction ('ltr' or 'rtl'), used to resolve logical positions
 * @returns New array with pinned columns moved to the edges
 */
export function reorderColumnsForPinning(columns: readonly any[], direction: TextDirection = 'ltr'): any[] {
  const left: any[] = [];
  const middle: any[] = [];
  const right: any[] = [];

  for (const col of columns) {
    const pinned = getColumnPinned(col);
    if (pinned) {
      const resolved = resolveStickyPosition(pinned, direction);
      if (resolved === 'left') left.push(col);
      else right.push(col);
    } else {
      middle.push(col);
    }
  }

  return [...left, ...middle, ...right];
}

/**
 * Clear sticky positioning from all cells.
 *
 * @param host - The grid host element (render root for DOM queries)
 */
export function clearStickyOffsets(host: HTMLElement): void {
  // With light DOM, query the host element directly
  const cells = host.querySelectorAll(`.${GridClasses.STICKY_LEFT}, .${GridClasses.STICKY_RIGHT}`);
  cells.forEach((cell) => {
    cell.classList.remove(GridClasses.STICKY_LEFT, GridClasses.STICKY_RIGHT);
    (cell as HTMLElement).style.position = '';
    (cell as HTMLElement).style.left = '';
    (cell as HTMLElement).style.right = '';
  });
}
