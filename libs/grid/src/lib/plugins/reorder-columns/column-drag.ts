/**
 * Column Reordering Core Logic
 *
 * Pure functions for column drag and reordering operations.
 */

import type { ColumnConfig } from '../../core/types';

/**
 * Check if a column can be moved based on its own metadata.
 * This checks column-level properties like lockPosition and suppressMovable.
 *
 * Note: For full movability checks including plugin constraints (e.g., pinned columns),
 * use `grid.query<boolean>('canMoveColumn', column)` which queries all plugins that
 * declare the 'canMoveColumn' query in their manifest.
 *
 * @param column - The column configuration to check
 * @returns True if the column can be moved based on its metadata
 */
export function canMoveColumn<TRow = unknown>(column: ColumnConfig<TRow>): boolean {
  // Check for lockPosition or suppressMovable properties in the column config
  const meta = column.meta ?? {};
  return meta.lockPosition !== true && meta.suppressMovable !== true;
}

/**
 * Move a column from one position to another in the order array.
 *
 * @param columns - Array of field names in current order
 * @param fromIndex - The current index of the column to move
 * @param toIndex - The target index to move the column to
 * @returns New array with updated order
 */
export function moveColumn(columns: string[], fromIndex: number, toIndex: number): string[] {
  if (fromIndex === toIndex) return columns;
  if (fromIndex < 0 || fromIndex >= columns.length) return columns;
  if (toIndex < 0 || toIndex > columns.length) return columns;

  const result = [...columns];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

/**
 * Calculate the drop index based on the current drag position.
 *
 * @param dragX - The current X position of the drag
 * @param headerRect - The bounding rect of the header container
 * @param columnWidths - Array of column widths in order
 * @returns The index where the column should be dropped
 */
export function getDropIndex(dragX: number, headerRect: DOMRect, columnWidths: number[]): number {
  let x = headerRect.left;

  for (let i = 0; i < columnWidths.length; i++) {
    const mid = x + columnWidths[i] / 2;
    if (dragX < mid) return i;
    x += columnWidths[i];
  }

  return columnWidths.length;
}

/**
 * Reorder columns according to a specified order.
 * Columns not in the order array are appended at the end.
 *
 * @param columns - Array of column configurations
 * @param order - Array of field names specifying the desired order
 * @returns New array of columns in the specified order
 */
export function reorderColumns<TRow = unknown>(columns: ColumnConfig<TRow>[], order: string[]): ColumnConfig<TRow>[] {
  const columnMap = new Map<string, ColumnConfig<TRow>>(columns.map((c) => [c.field as string, c]));
  const reordered: ColumnConfig<TRow>[] = [];

  // Add columns in specified order
  for (const field of order) {
    const col = columnMap.get(field);
    if (col) {
      reordered.push(col);
      columnMap.delete(field);
    }
  }

  // Add any remaining columns not in order
  for (const col of columnMap.values()) {
    reordered.push(col);
  }

  return reordered;
}
