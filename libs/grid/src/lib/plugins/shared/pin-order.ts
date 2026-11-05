/**
 * Pinned-column helpers shared by PinnedColumnsPlugin and PivotPlugin. Pivot regenerates its
 * columns and renders its own rows, so it must keep a carried pin at its edge and re-apply the
 * cached sticky offsets to the cells it recreates (#613).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { GridClasses } from '../../core/constants';
import { resolveInlinePosition, type TextDirection } from '../../core/internal/utils';
import type { PinnedPosition } from '../pinned-columns/types';

/** Response of PinnedColumnsPlugin's `getStickyOffsets` query: measured px offset per field. */
export interface StickyOffsets {
  left: Record<string, number>;
  right: Record<string, number>;
}

/**
 * Plugin-bus event PinnedColumnsPlugin emits whenever its measured offsets change, so a plugin
 * caching `getStickyOffsets` (Pivot's per-pass pin plan) knows to drop it.
 */
export const PINNED_OFFSETS_CHANGE = 'pinned:offsets-change';

/** Sticky offset of one pinned field for its current side; the other side is undefined. */
export interface PinnedCellOffset {
  left: number | undefined;
  right: number | undefined;
}

/**
 * Make a cell sticky on exactly one side: a left offset wins over a right one, and the opposite
 * side's class and inset are cleared. Exclusivity is what lets a later measure correct a stale
 * replay (old side after a pin-side or direction switch) instead of leaving both sides set (#613).
 *
 * @param cell - The cell element (header or body)
 * @param left - Left offset in px, or undefined when the column is not left-pinned
 * @param right - Right offset in px, or undefined when the column is not right-pinned
 */
export function applyCellStickyOffset(cell: HTMLElement, left: number | undefined, right: number | undefined): void {
  if (left === undefined && right === undefined) return;
  const isLeft = left !== undefined;
  const [add, remove] = isLeft
    ? [GridClasses.STICKY_LEFT, GridClasses.STICKY_RIGHT]
    : [GridClasses.STICKY_RIGHT, GridClasses.STICKY_LEFT];
  // Guarded: classList.add/remove re-write the attribute even when the token is unchanged.
  if (!cell.classList.contains(add)) cell.classList.add(add);
  if (cell.classList.contains(remove)) cell.classList.remove(remove);
  cell.style.position = 'sticky';
  cell.style.left = isLeft ? left + 'px' : '';
  cell.style.right = isLeft ? '' : right + 'px';
}

/**
 * Get the effective pinned position from a column.
 * Prefers `column.pinned` and falls back to `column.meta.pinned`.
 *
 * @param col - Column configuration object
 * @returns The pinned position, or undefined if not pinned
 */
export function getColumnPinned(col: any): PinnedPosition | undefined {
  return col.pinned ?? col.meta?.pinned;
}

/**
 * Get the physical side a column is pinned to, resolving logical `start`/`end` for the direction.
 *
 * @param col - Column configuration object
 * @param direction - Text direction ('ltr' or 'rtl')
 * @returns `'left'`, `'right'`, or undefined when the column is not pinned
 */
function getResolvedPinSide(col: any, direction: TextDirection): 'left' | 'right' | undefined {
  const pinned = getColumnPinned(col);
  return pinned ? resolveInlinePosition(pinned, direction) : undefined;
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
    const side = getResolvedPinSide(col, direction);
    if (side === 'left') left.push(col);
    else if (side === 'right') right.push(col);
    else middle.push(col);
  }

  return [...left, ...middle, ...right];
}
