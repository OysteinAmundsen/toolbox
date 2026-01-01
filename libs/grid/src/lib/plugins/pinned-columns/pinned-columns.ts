/**
 * Sticky Columns Core Logic
 *
 * Pure functions for applying sticky (pinned) column positioning.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { StickyPosition } from './types';

/**
 * Get columns that should be sticky on the left.
 *
 * @param columns - Array of column configurations
 * @returns Array of columns with sticky='left'
 */
export function getLeftStickyColumns(columns: any[]): any[] {
  return columns.filter((col) => col.sticky === 'left');
}

/**
 * Get columns that should be sticky on the right.
 *
 * @param columns - Array of column configurations
 * @returns Array of columns with sticky='right'
 */
export function getRightStickyColumns(columns: any[]): any[] {
  return columns.filter((col) => col.sticky === 'right');
}

/**
 * Check if any columns have sticky positioning.
 *
 * @param columns - Array of column configurations
 * @returns True if any column has sticky position
 */
export function hasStickyColumns(columns: any[]): boolean {
  return columns.some((col) => col.sticky === 'left' || col.sticky === 'right');
}

/**
 * Get the sticky position of a column.
 *
 * @param column - Column configuration
 * @returns The sticky position or null if not sticky
 */
export function getColumnStickyPosition(column: any): StickyPosition | null {
  if (column.sticky === 'left') return 'left';
  if (column.sticky === 'right') return 'right';
  return null;
}

/**
 * Calculate left offsets for sticky-left columns.
 * Returns a map of field -> offset in pixels.
 *
 * @param columns - Array of column configurations (in order)
 * @param getColumnWidth - Function to get column width by field
 * @returns Map of field to left offset
 */
export function calculateLeftStickyOffsets(
  columns: any[],
  getColumnWidth: (field: string) => number,
): Map<string, number> {
  const offsets = new Map<string, number>();
  let currentOffset = 0;

  for (const col of columns) {
    if (col.sticky === 'left') {
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
 * @returns Map of field to right offset
 */
export function calculateRightStickyOffsets(
  columns: any[],
  getColumnWidth: (field: string) => number,
): Map<string, number> {
  const offsets = new Map<string, number>();
  let currentOffset = 0;

  // Process in reverse for right-sticky columns
  const reversed = [...columns].reverse();
  for (const col of reversed) {
    if (col.sticky === 'right') {
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
 * @param host - The grid host element
 * @param columns - Array of column configurations
 */
export function applyStickyOffsets(host: HTMLElement, columns: any[]): void {
  const shadowRoot = host.shadowRoot;
  if (!shadowRoot) return;

  const headerCells = Array.from(shadowRoot.querySelectorAll('.header-row .cell')) as HTMLElement[];
  if (!headerCells.length) return;

  // Build column index map for matching body cells (which use data-col, not data-field)
  const fieldToIndex = new Map<string, number>();
  columns.forEach((col, i) => {
    if (col.field) fieldToIndex.set(col.field, i);
  });

  // Apply left sticky
  let left = 0;
  for (const col of columns) {
    if (col.sticky === 'left') {
      const colIndex = fieldToIndex.get(col.field);
      const cell = headerCells.find((c) => c.getAttribute('data-field') === col.field);
      if (cell) {
        cell.classList.add('sticky-left');
        cell.style.position = 'sticky';
        cell.style.left = left + 'px';
        // Body cells use data-col (column index), not data-field
        if (colIndex !== undefined) {
          shadowRoot.querySelectorAll(`.data-grid-row .cell[data-col="${colIndex}"]`).forEach((el) => {
            el.classList.add('sticky-left');
            (el as HTMLElement).style.position = 'sticky';
            (el as HTMLElement).style.left = left + 'px';
          });
        }
        left += cell.offsetWidth;
      }
    }
  }

  // Apply right sticky (process in reverse)
  let right = 0;
  for (const col of [...columns].reverse()) {
    if (col.sticky === 'right') {
      const colIndex = fieldToIndex.get(col.field);
      const cell = headerCells.find((c) => c.getAttribute('data-field') === col.field);
      if (cell) {
        cell.classList.add('sticky-right');
        cell.style.position = 'sticky';
        cell.style.right = right + 'px';
        // Body cells use data-col (column index), not data-field
        if (colIndex !== undefined) {
          shadowRoot.querySelectorAll(`.data-grid-row .cell[data-col="${colIndex}"]`).forEach((el) => {
            el.classList.add('sticky-right');
            (el as HTMLElement).style.position = 'sticky';
            (el as HTMLElement).style.right = right + 'px';
          });
        }
        right += cell.offsetWidth;
      }
    }
  }
}

/**
 * Clear sticky positioning from all cells.
 *
 * @param host - The grid host element
 */
export function clearStickyOffsets(host: HTMLElement): void {
  const shadowRoot = host.shadowRoot;
  if (!shadowRoot) return;

  const cells = shadowRoot.querySelectorAll('.sticky-left, .sticky-right');
  cells.forEach((cell) => {
    cell.classList.remove('sticky-left', 'sticky-right');
    (cell as HTMLElement).style.position = '';
    (cell as HTMLElement).style.left = '';
    (cell as HTMLElement).style.right = '';
  });
}
