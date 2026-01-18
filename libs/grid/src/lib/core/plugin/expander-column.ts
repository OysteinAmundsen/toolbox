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
  return column.meta?.utility === true;
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
    meta: {
      lockPosition: true,
      suppressMovable: true,
      expanderColumn: true,
      expanderPlugin: pluginName,
      utility: true, // Marks this as a utility column (excluded from selection, clipboard, etc.)
    },
  };
}

/**
 * Create a container element for expand/collapse toggle icons.
 * Used by plugins to wrap their expand icons with consistent styling.
 *
 * @param expanded - Whether the item is currently expanded
 * @param pluginClass - CSS class prefix for the plugin (e.g., 'master-detail', 'tree')
 * @returns Container span element
 */
export function createExpanderContainer(expanded: boolean, pluginClass: string): HTMLSpanElement {
  const container = document.createElement('span');
  container.className = `${pluginClass}-expander expander-cell`;
  if (expanded) {
    container.classList.add('expanded');
  }
  return container;
}

/**
 * CSS styles for the expander column.
 * Plugins should include this in their styles to ensure consistent appearance.
 */
export const EXPANDER_COLUMN_STYLES = `
/* Expander column data cells - always first, borderless right edge */
.cell[data-field="${EXPANDER_COLUMN_FIELD}"] {
  border-right: none !important;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Expander column header - completely hidden, no content, no border, no width contribution */
.header-row .cell[data-field="${EXPANDER_COLUMN_FIELD}"] {
  visibility: hidden;
  border: none !important;
  padding: 0;
  overflow: hidden;
}

/* The column after the expander should visually extend into the expander header space */
.header-row .cell[data-field="${EXPANDER_COLUMN_FIELD}"] + .cell {
  /* Pull left to cover the hidden expander header */
  margin-left: -${EXPANDER_COLUMN_WIDTH}px;
  padding-left: calc(var(--tbw-cell-padding, 8px) + ${EXPANDER_COLUMN_WIDTH}px);
}

/* Expander cell contents */
.expander-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  cursor: pointer;
}
`;
