/**
 * Grid DOM Constants
 *
 * Centralized constants for CSS classes, data attributes, and selectors
 * used throughout the grid. Use these instead of magic strings.
 *
 * Note: Some constants here are used by plugins but defined in core because:
 * 1. The core CSS needs to style these elements (e.g., sticky positioning)
 * 2. Multiple plugins may share the same class names
 *
 * Plugins can define their own additional constants and export them.
 * See each plugin's index.ts for plugin-specific exports.
 */

// #region CSS Classes

/**
 * CSS class names used in the grid's shadow DOM.
 * Use these when adding/removing classes or querying elements.
 *
 * Classes are organized by:
 * - Core: Used by the grid core for structure and basic functionality
 * - Shared: Used by multiple features/plugins, styled by core CSS
 */
export const GridClasses = {
  // ─── Core Structure ───────────────────────────────────────────────
  ROOT: 'tbw-grid-root',
  HEADER: 'header',
  HEADER_ROW: 'header-row',
  HEADER_CELL: 'header-cell',

  // Body structure
  ROWS_VIEWPORT: 'rows-viewport',
  ROWS_SPACER: 'rows-spacer',
  ROWS_CONTAINER: 'rows',

  // Row elements
  DATA_ROW: 'data-row',
  GROUP_ROW: 'group-row',

  // Cell elements
  DATA_CELL: 'data-cell',

  // ─── Core States ──────────────────────────────────────────────────
  SELECTED: 'selected',
  FOCUSED: 'focused',
  EDITING: 'editing',
  EXPANDED: 'expanded',
  COLLAPSED: 'collapsed',
  DRAGGING: 'dragging',
  RESIZING: 'resizing',

  // Sorting (core feature)
  SORTABLE: 'sortable',
  SORTED_ASC: 'sorted-asc',
  SORTED_DESC: 'sorted-desc',

  // Visibility
  HIDDEN: 'hidden',

  // ─── Shared Classes (used by plugins, styled by core CSS) ────────
  // These are defined here because core CSS provides the base styling.
  // Plugins apply these classes; core CSS defines how they look.

  // Sticky positioning (PinnedColumnsPlugin applies, core CSS styles)
  STICKY_LEFT: 'sticky-left',
  STICKY_RIGHT: 'sticky-right',

  // Pinned rows (PinnedRowsPlugin applies, core CSS styles)
  PINNED_TOP: 'pinned-top',
  PINNED_BOTTOM: 'pinned-bottom',

  // Tree structure (TreePlugin applies, core CSS styles)
  TREE_TOGGLE: 'tree-toggle',
  TREE_INDENT: 'tree-indent',

  // Grouping (GroupingRowsPlugin applies, core CSS styles)
  GROUP_TOGGLE: 'group-toggle',
  GROUP_LABEL: 'group-label',
  GROUP_COUNT: 'group-count',

  // Selection (SelectionPlugin applies, core CSS styles)
  RANGE_SELECTION: 'range-selection',
  SELECTION_OVERLAY: 'selection-overlay',
} as const;

// #endregion

// #region Data Attributes

/**
 * Data attribute names used on grid elements.
 * Use these when getting/setting data attributes.
 */
export const GridDataAttrs = {
  // ─── Core Attributes ──────────────────────────────────────────────
  ROW_INDEX: 'data-row-index',
  COL_INDEX: 'data-col-index',
  FIELD: 'data-field',

  // ─── Shared Attributes (used by plugins) ──────────────────────────
  GROUP_KEY: 'data-group-key', // GroupingRowsPlugin
  TREE_LEVEL: 'data-tree-level', // TreePlugin
  STICKY: 'data-sticky', // PinnedColumnsPlugin
} as const;

// #endregion

// #region Selectors

/**
 * Common CSS selectors for querying grid elements.
 * Built from the class constants for consistency.
 */
export const GridSelectors = {
  ROOT: `.${GridClasses.ROOT}`,
  HEADER: `.${GridClasses.HEADER}`,
  HEADER_ROW: `.${GridClasses.HEADER_ROW}`,
  HEADER_CELL: `.${GridClasses.HEADER_CELL}`,
  ROWS_VIEWPORT: `.${GridClasses.ROWS_VIEWPORT}`,
  ROWS_CONTAINER: `.${GridClasses.ROWS_CONTAINER}`,
  DATA_ROW: `.${GridClasses.DATA_ROW}`,
  DATA_CELL: `.${GridClasses.DATA_CELL}`,
  GROUP_ROW: `.${GridClasses.GROUP_ROW}`,

  // By data attribute
  ROW_BY_INDEX: (index: number) => `.${GridClasses.DATA_ROW}[${GridDataAttrs.ROW_INDEX}="${index}"]`,
  CELL_BY_FIELD: (field: string) => `.${GridClasses.DATA_CELL}[${GridDataAttrs.FIELD}="${field}"]`,
  CELL_AT: (row: number, col: number) =>
    `.${GridClasses.DATA_ROW}[${GridDataAttrs.ROW_INDEX}="${row}"] .${GridClasses.DATA_CELL}[${GridDataAttrs.COL_INDEX}="${col}"]`,

  // State selectors
  SELECTED_ROWS: `.${GridClasses.DATA_ROW}.${GridClasses.SELECTED}`,
  EDITING_CELL: `.${GridClasses.DATA_CELL}.${GridClasses.EDITING}`,
} as const;

// #endregion

// #region CSS Custom Properties

/**
 * CSS custom property names for theming.
 * Use these when programmatically setting styles.
 */
export const GridCSSVars = {
  // Colors
  COLOR_BG: '--tbw-color-bg',
  COLOR_FG: '--tbw-color-fg',
  COLOR_FG_MUTED: '--tbw-color-fg-muted',
  COLOR_BORDER: '--tbw-color-border',
  COLOR_ACCENT: '--tbw-color-accent',
  COLOR_HEADER_BG: '--tbw-color-header-bg',
  COLOR_HEADER_FG: '--tbw-color-header-fg',
  COLOR_SELECTION: '--tbw-color-selection',
  COLOR_ROW_HOVER: '--tbw-color-row-hover',
  COLOR_ROW_ALT: '--tbw-color-row-alt',

  // Sizing
  ROW_HEIGHT: '--tbw-row-height',
  HEADER_HEIGHT: '--tbw-header-height',
  CELL_PADDING: '--tbw-cell-padding',

  // Typography
  FONT_FAMILY: '--tbw-font-family',
  FONT_SIZE: '--tbw-font-size',

  // Borders
  BORDER_RADIUS: '--tbw-border-radius',
  FOCUS_OUTLINE: '--tbw-focus-outline',
} as const;

// #endregion

// Type helpers
export type GridClassName = (typeof GridClasses)[keyof typeof GridClasses];
export type GridDataAttr = (typeof GridDataAttrs)[keyof typeof GridDataAttrs];
export type GridCSSVar = (typeof GridCSSVars)[keyof typeof GridCSSVars];
