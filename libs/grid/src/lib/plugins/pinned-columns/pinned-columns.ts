/**
 * Pinned Columns Core Logic
 *
 * Pure functions for applying pinned (sticky) column positioning.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { getDirection, resolveInlinePosition, type TextDirection } from '../../core/internal/utils';
import type { PinnedPosition, ResolvedPinnedPosition } from './types';

// Keep deprecated imports working (StickyPosition = PinnedPosition)
type StickyPosition = PinnedPosition;
type ResolvedStickyPosition = ResolvedPinnedPosition;

/**
 * Get the effective pinned position from a column, checking `pinned` first then `sticky` (deprecated).
 *
 * @param col - Column configuration object
 * @returns The pinned position, or undefined if not pinned
 */
export function getColumnPinned(col: any): PinnedPosition | undefined {
  return col.pinned ?? col.sticky ?? col.meta?.pinned ?? col.meta?.sticky;
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
export function resolveStickyPosition(position: StickyPosition, direction: TextDirection): ResolvedStickyPosition {
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
  return columns.some((col) => getColumnPinned(col) != null);
}

/**
 * Get the sticky position of a column.
 *
 * @param column - Column configuration
 * @returns The sticky position or null if not sticky
 */
export function getColumnStickyPosition(column: any): StickyPosition | null {
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
 * Apply sticky offsets to header and body cells.
 * This modifies the DOM elements in place.
 *
 * @param host - The grid host element (render root for DOM queries)
 * @param columns - Array of column configurations
 */
export function applyStickyOffsets(host: HTMLElement, columns: any[]): void {
  // With light DOM, query the host element directly
  const headerCells = Array.from(host.querySelectorAll('.header-row .cell')) as HTMLElement[];
  if (!headerCells.length) return;

  // Detect text direction from the host element
  const direction = getDirection(host);

  // Apply left sticky (includes 'start' in LTR, 'end' in RTL)
  let left = 0;
  for (const col of columns) {
    if (isResolvedLeft(col, direction)) {
      const cell = headerCells.find((c) => c.getAttribute('data-field') === col.field);
      if (cell) {
        cell.classList.add('sticky-left');
        cell.style.position = 'sticky';
        cell.style.left = left + 'px';
        // Body cells: use data-field for reliable matching (data-col indices may differ
        // between _columns and _visibleColumns due to hidden/utility columns)
        host.querySelectorAll(`.data-grid-row .cell[data-field="${col.field}"]`).forEach((el) => {
          el.classList.add('sticky-left');
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
        cell.classList.add('sticky-right');
        cell.style.position = 'sticky';
        cell.style.right = right + 'px';
        // Body cells: use data-field for reliable matching
        host.querySelectorAll(`.data-grid-row .cell[data-field="${col.field}"]`).forEach((el) => {
          el.classList.add('sticky-right');
          (el as HTMLElement).style.position = 'sticky';
          (el as HTMLElement).style.right = right + 'px';
        });
        right += cell.offsetWidth;
      }
    }
  }
}

/**
 * Clear sticky positioning from all cells.
 *
 * @param host - The grid host element (render root for DOM queries)
 */
export function clearStickyOffsets(host: HTMLElement): void {
  // With light DOM, query the host element directly
  const cells = host.querySelectorAll('.sticky-left, .sticky-right');
  cells.forEach((cell) => {
    cell.classList.remove('sticky-left', 'sticky-right');
    (cell as HTMLElement).style.position = '';
    (cell as HTMLElement).style.left = '';
    (cell as HTMLElement).style.right = '';
  });
}
