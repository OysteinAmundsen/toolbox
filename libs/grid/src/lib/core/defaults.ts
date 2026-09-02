/**
 * Runtime default values for grid configuration.
 *
 * Kept out of `core/types.ts` so that file stays type-only apart from the two
 * enum-like consts whose `type` aliases are derived from them via `typeof`.
 * Import types from `./types`; import the values that back them from here.
 */

import type { A11yMessages, AnimationConfig, GridIcons } from './types';

/**
 * Default English announcement messages.
 * Used when no custom messages are provided via {@link A11yConfig.messages}.
 * @since 2.0.0
 */
export const DEFAULT_A11Y_MESSAGES: A11yMessages = {
  sortApplied: (column, direction) => `Sorted by ${column}, ${direction}`,
  sortCleared: () => 'Sort cleared',
  filterApplied: (column) => `Filter applied on ${column}`,
  filterCleared: (column) => `Filter cleared from ${column}`,
  allFiltersCleared: () => 'All filters cleared',
  groupExpanded: (name, count) => `Group ${name} expanded, ${count} rows`,
  groupCollapsed: (name) => `Group ${name} collapsed`,
  selectionChanged: (count) => `${count} rows selected`,
  selectAllRows: () => 'Select all rows',
  selectRow: (rowIndex) => `Select row ${rowIndex + 1}`,
  columnSelected: (label) => `Column ${label} selected`,
  columnSelectionChanged: (count) => `${count} columns selected`,
  columnSelectionCleared: () => 'Column selection cleared',
  selectionAxisChanged: (toAxis) =>
    toAxis === 'column'
      ? 'Row selection cleared, column selection active'
      : 'Column selection cleared, row selection active',
  editingStarted: (rowIndex) => `Editing row ${rowIndex + 1}`,
  editingCommitted: (rowIndex) => `Row ${rowIndex + 1} saved`,
  dataLoaded: (count) => `${count} rows loaded`,
};

/**
 * Default animation configuration
 * @since 0.2.7
 */
export const DEFAULT_ANIMATION_CONFIG: Required<Omit<AnimationConfig, 'sort'>> = {
  mode: 'reduced-motion',
  duration: 200,
  easing: 'ease-out',
};

/**
 * Default icons used when not overridden. Most entries are short text/emoji;
 * `filter` and `filterActive` are empty strings because the actual rendering
 * is driven by the `--tbw-icon-filter[-active]-mask` CSS custom properties
 * (see `core/styles/variables.css`). Userland that wants an HTML/SVG fallback
 * via `gridConfig.icons.filter = '<svg…>'` is unaffected — that path overrides this default.
 * @since 0.1.1
 */
export const DEFAULT_GRID_ICONS: Required<GridIcons> = {
  expand: '▶',
  collapse: '▼',
  sortAsc: '▲',
  sortDesc: '▼',
  sortNone: '⇅',
  submenuArrow: '▶',
  dragHandle: '⋮⋮',
  toolPanel: '☰',
  filter: '',
  filterActive: '',
  print: '🖨️',
};
