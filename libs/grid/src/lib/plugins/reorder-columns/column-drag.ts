/**
 * Column Reordering Core Logic
 *
 * Pure functions for column drag and reordering operations.
 */

/**
 * Check if a column can be moved based on its own metadata.
 * This checks column-level properties like lockPosition, utility, and suppressMovable.
 *
 * Both the top-level `lockPosition` (preferred) and legacy `meta.lockPosition` /
 * `meta.suppressMovable` are honored. `utility: true` columns (system columns
 * synthesized by plugins or authored by the app) are always treated as locked.
 *
 * Note: For full movability checks including plugin constraints (e.g., pinned columns),
 * use `grid.query<boolean>('canMoveColumn', column)` which queries all plugins that
 * declare the 'canMoveColumn' query in their manifest.
 *
 * @param column - The column configuration to check
 * @returns True if the column can be moved based on its metadata
 */
export function canMoveColumn(column: {
  lockPosition?: boolean;
  utility?: boolean;
  meta?: Record<string, unknown>;
}): boolean {
  if (column.lockPosition === true) return false;
  if (column.utility === true) return false;
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
