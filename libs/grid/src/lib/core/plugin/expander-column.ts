/**
 * Shared Expander Column Utilities
 *
 * Provides a fixed expander column for plugins that need expand/collapse icons
 * (MasterDetail, Tree, RowGrouping). The column is:
 * - Always first in the grid
 * - Cannot be reordered (lockPosition: true)
 * - Has no header (empty string)
 * - Has no right border (borderless styling)
 * - Narrow width (just fits the icon)
 */

import type { ColumnConfig } from '../types';

/** Special field name for the expander column */
export const EXPANDER_COLUMN_FIELD = '__tbw_expander';

/** Default width for the expander column (pixels) */
export const EXPANDER_COLUMN_WIDTH = 32;

/**
 * Marker interface for expander column renderers.
 * Used to detect if expander column is already present.
 */
export interface ExpanderColumnRenderer {
  (ctx: any): HTMLElement;
  __expanderColumn?: true;
  /** Plugin name that created this expander */
  __expanderPlugin?: string;
}

/**
 * Check if a column is an expander column.
 */
export function isExpanderColumn(column: ColumnConfig): boolean {
  return column.field === EXPANDER_COLUMN_FIELD;
}

/**
 * Check if a column is a utility column (excluded from selection, clipboard, etc.).
 * Utility columns are non-data columns like expander columns.
 */
export function isUtilityColumn(column: ColumnConfig): boolean {
  return column.utility === true;
}

/**
 * Find an existing expander column in the column array.
 */
export function findExpanderColumn(columns: readonly ColumnConfig[]): ColumnConfig | undefined {
  return columns.find(isExpanderColumn);
}

/**
 * Create the base expander column config.
 * Plugins should add their own renderer to customize the expand icon behavior.
 *
 * @param pluginName - Name of the plugin creating the expander (for debugging)
 * @returns Base column config for the expander column
 */
export function createExpanderColumnConfig(pluginName: string): ColumnConfig {
  return {
    field: EXPANDER_COLUMN_FIELD as any,
    header: '', // No header text - visually merges with next column
    width: EXPANDER_COLUMN_WIDTH,
    resizable: false,
    sortable: false,
    filterable: false, // No filter button for expander column
    lockPosition: true,
    utility: true, // Marks this as a utility column (excluded from selection, clipboard, etc.)
    meta: {
      expanderColumn: true,
      expanderPlugin: pluginName,
    },
  };
}
