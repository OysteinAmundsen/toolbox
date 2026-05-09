/**
 * Selection Plugin (Class-based)
 *
 * Provides selection functionality for tbw-grid.
 * Supports three modes:
 * - 'cell': Single cell selection (default). No border, just focus highlight.
 * - 'row': Row selection. Clicking a cell selects the entire row.
 * - 'range': Range selection. Shift+click or drag to select rectangular cell ranges.
 */

import { GridClasses } from '../../core/constants';
import { announce, getA11yMessage } from '../../core/internal/aria';
import { clearCellFocus, getRowIndexFromCell } from '../../core/internal/utils';
import type { GridElement, HeaderClickEvent, PluginManifest, PluginQuery } from '../../core/plugin/base-plugin';
import { BaseGridPlugin, CellClickEvent, CellMouseEvent } from '../../core/plugin/base-plugin';
import { isExpanderColumn, isUtilityColumn } from '../../core/plugin/expander-column';
import type { ColumnConfig } from '../../core/types';
import {
  computeKeyboardExtension,
  fieldsBetween,
  type NormalizedModeConfig,
  normalizeMode,
  selectableColumnFields,
} from './column-selection';
import {
  createRangeFromAnchor,
  getAllCellsInRanges,
  isCellInAnyRange,
  normalizeRange,
  rangesEqual,
  toPublicRanges,
} from './range-selection';
import styles from './selection.css?inline';
import type {
  CellRange,
  InternalCellRange,
  SelectionAxis,
  SelectionChangeDetail,
  SelectionConfig,
  SelectionMode,
  SelectionResult,
} from './types';

/**
 * Resolve the primary in-row mode from a config that may be a single string
 * or an array. Used by `configRules` (which run before `attach()` populates
 * the cached normalized mode). Falls back to `'cell'` on invalid input —
 * `attach()` will throw the proper error message later.
 */
function primaryModeOf(mode: SelectionMode | SelectionMode[] | undefined): SelectionMode {
  if (typeof mode === 'string') return mode;
  if (Array.isArray(mode)) {
    const other = mode.find((m) => m !== 'column');
    if (other) return other;
    if (mode.includes('column')) return 'column';
  }
  return 'cell';
}

/** Special field name for the selection checkbox column */
const CHECKBOX_COLUMN_FIELD = '__tbw_checkbox';

/**
 * Build the selection change event detail for the current state.
 *
 * `axis` decides which axis "won" — when both row and column are populated
 * (which can only happen in transient states inside mutual-exclusion handling),
 * `axis` is the source of truth for which one to report.
 */
function buildSelectionEvent(
  configuredMode: SelectionMode | SelectionMode[],
  axis: SelectionAxis,
  primary: SelectionMode,
  state: {
    selectedCell: { row: number; col: number } | null;
    selected: Set<number>;
    ranges: InternalCellRange[];
    selectedColumns: Set<string>;
  },
  colCount: number,
): SelectionChangeDetail {
  // Column axis active → ignore in-row state, report column field names.
  if (axis === 'column' && state.selectedColumns.size > 0) {
    return {
      mode: configuredMode,
      activeAxis: 'column',
      ranges: [],
      selectedColumns: [...state.selectedColumns],
    };
  }

  if (primary === 'cell' && state.selectedCell) {
    return {
      mode: configuredMode,
      activeAxis: 'cell',
      ranges: [
        {
          from: { row: state.selectedCell.row, col: state.selectedCell.col },
          to: { row: state.selectedCell.row, col: state.selectedCell.col },
        },
      ],
      selectedColumns: [],
    };
  }

  if (primary === 'row' && state.selected.size > 0) {
    // Sort rows and merge contiguous indices into minimal ranges
    const sorted = [...state.selected].sort((a, b) => a - b);
    const ranges: CellRange[] = [];
    let start = sorted[0];
    let end = start;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push({ from: { row: start, col: 0 }, to: { row: end, col: colCount - 1 } });
        start = sorted[i];
        end = start;
      }
    }
    ranges.push({ from: { row: start, col: 0 }, to: { row: end, col: colCount - 1 } });
    return { mode: configuredMode, activeAxis: 'row', ranges, selectedColumns: [] };
  }

  if (primary === 'range' && state.ranges.length > 0) {
    return {
      mode: configuredMode,
      activeAxis: 'range',
      ranges: toPublicRanges(state.ranges),
      selectedColumns: [],
    };
  }

  return { mode: configuredMode, activeAxis: 'none', ranges: [], selectedColumns: [] };
}

/**
 * Selection Plugin for tbw-grid
 *
 * Adds cell, row, and range selection capabilities to the grid with full keyboard support.
 * Whether you need simple cell highlighting or complex multi-range selections, this plugin has you covered.
 *
 * ## Installation
 *
 * ```ts
 * import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';
 * ```
 *
 * ## Selection Modes
 *
 * Configure the plugin with one of three modes via {@link SelectionConfig}:
 *
 * - **`'cell'`** - Single cell selection (default). Click cells to select individually.
 * - **`'row'`** - Full row selection. Click anywhere in a row to select the entire row.
 * - **`'range'`** - Rectangular selection. Click and drag or Shift+Click to select ranges.
 *
 * ## Keyboard Shortcuts
 *
 * | Shortcut | Action |
 * |----------|--------|
 * | `Arrow Keys` | Move selection |
 * | `Shift + Arrow` | Extend selection (range mode) |
 * | `Ctrl/Cmd + Click` | Toggle selection (multi-select) |
 * | `Shift + Click` | Extend to clicked cell/row |
 * | `Ctrl/Cmd + A` | Select all (range mode) |
 * | `Escape` | Clear selection |
 *
 * > **Note:** When `multiSelect: false`, Ctrl/Shift modifiers are ignored —
 * > clicks always select a single item.
 *
 * ## CSS Custom Properties
 *
 * | Property | Description |
 * |----------|-------------|
 * | `--tbw-focus-background` | Focused row background |
 * | `--tbw-range-selection-bg` | Range selection fill |
 * | `--tbw-range-border-color` | Range selection border |
 *
 * @example Basic row selection
 * ```ts
 * grid.gridConfig = {
 *   columns: [...],
 *   plugins: [new SelectionPlugin({ mode: 'row' })],
 * };
 * ```
 *
 * @example Range selection with event handling
 * ```ts
 * grid.gridConfig = {
 *   plugins: [new SelectionPlugin({ mode: 'range' })],
 * };
 *
 * grid.on('selection-change', ({ mode, ranges }) => {
 *   console.log(`Selected ${ranges.length} ranges in ${mode} mode`);
 * });
 * ```
 *
 * @example Programmatic selection control
 * ```ts
 * const plugin = grid.getPluginByName('selection');
 *
 * // Get current selection
 * const selection = plugin.getSelection();
 * console.log(selection.ranges);
 *
 * // Set selection programmatically
 * plugin.setRanges([{ from: { row: 0, col: 0 }, to: { row: 5, col: 3 } }]);
 *
 * // Clear all selection
 * plugin.clearSelection();
 * ```
 *
 * @see {@link SelectionMode} for detailed mode descriptions
 * @see {@link SelectionConfig} for configuration options
 * @see {@link SelectionResult} for the selection result structure
 * @see {@link SelectionConfig} for interactive examples in the docs site
 * @since 0.1.1
 */
export class SelectionPlugin extends BaseGridPlugin<SelectionConfig> {
  /**
   * Plugin manifest - declares queries and configuration validation rules.
   * @internal
   */
  static override readonly manifest: PluginManifest<SelectionConfig> = {
    queries: [
      { type: 'getSelection', description: 'Get the current selection state' },
      { type: 'selectRows', description: 'Select specific rows by index (row mode only)' },
      { type: 'getSelectedRowIndices', description: 'Get sorted array of selected row indices' },
      { type: 'getSelectedRows', description: 'Get actual row objects for the current selection (works in all modes)' },
      { type: 'getSelectedColumns', description: 'Get field names of selected columns (column mode only)' },
      { type: 'selectColumns', description: 'Select specific columns by field name (column mode only)' },
    ],
    configRules: [
      {
        id: 'selection/range-dblclick',
        severity: 'warn',
        message:
          `"triggerOn: 'dblclick'" has no effect when mode is "range".\n` +
          `  → Range selection uses drag interaction (mousedown → mousemove), not click events.\n` +
          `  → The "triggerOn" option only affects "cell" and "row" selection modes.`,
        check: (config) => primaryModeOf(config.mode) === 'range' && config.triggerOn === 'dblclick',
      },
      {
        id: 'selection/column-checkbox',
        severity: 'warn',
        message:
          `"checkbox: true" only renders in row mode.\n` +
          `  → Column selection has no checkbox UI; activate columns via Ctrl+Click on a header or Ctrl+Space on a focused cell.`,
        check: (config) => !!config.checkbox && primaryModeOf(config.mode) !== 'row',
      },
    ],
  };

  /** @internal */
  readonly name = 'selection';
  /** @internal */
  override readonly styles = styles;

  /** @internal */
  protected override get defaultConfig(): Partial<SelectionConfig> {
    return {
      mode: 'cell',
      triggerOn: 'click',
      enabled: true,
      multiSelect: true,
    };
  }

  // #region Internal State
  /** Row selection state (row mode) */
  private selected = new Set<number>();
  private lastSelected: number | null = null;
  private anchor: number | null = null;

  /** Range selection state (range mode) */
  private ranges: InternalCellRange[] = [];
  private activeRange: InternalCellRange | null = null;
  private cellAnchor: { row: number; col: number } | null = null;
  private isDragging = false;

  /** Pending keyboard navigation update (processed in afterRender) */
  private pendingKeyboardUpdate: { shiftKey: boolean } | null = null;

  /** Pending row-mode keyboard update (processed in afterRender) */
  private pendingRowKeyUpdate: { shiftKey: boolean } | null = null;

  /** Cell selection state (cell mode) */
  private selectedCell: { row: number; col: number } | null = null;

  /**
   * Column selection state (column mode / `['row','column']` array mode).
   * Stored as field-name strings so selection survives column pinning,
   * reordering, and virtualization recycling.
   */
  private selectedColumns = new Set<string>();
  /** Anchor column for Ctrl+Shift+click range extension. */
  private columnAnchor: string | null = null;
  /** Head column for Ctrl+Shift+Arrow keyboard extension. */
  private columnHead: string | null = null;
  /** Which axis last won. Drives `SelectionChangeDetail.activeAxis` and mutual exclusion. */
  private activeAxis: SelectionAxis = 'none';

  /**
   * Normalized mode config, computed once in `attach()`. All mode checks in this
   * plugin go through `this.#mode` rather than `this.config.mode` so the
   * single-string vs. array distinction is resolved in exactly one place.
   */
  #mode: NormalizedModeConfig = { primary: 'cell', columnEnabled: false, bothAxes: false };

  /** Last synced focus row — used to detect when grid focus moves so selection follows */
  private lastSyncedFocusRow = -1;
  /** Last synced focus col (cell mode) */
  private lastSyncedFocusCol = -1;

  /** Debounce timer for selection announcements */
  private announceTimer: ReturnType<typeof setTimeout> | null = null;

  /** True when selection was explicitly set (click/keyboard) — prevents #syncSelectionToFocus from overwriting */
  private explicitSelection = false;

  // #endregion

  // #region Private Helpers - Selection Enabled Check

  /**
   * Check if selection is enabled at the grid level.
   * Grid-wide `selectable: false` or plugin's `enabled: false` disables all selection.
   */
  private isSelectionEnabled(): boolean {
    // Check plugin config first
    if (this.config.enabled === false) return false;
    // Check grid-level config
    return this.grid.effectiveConfig?.selectable !== false;
  }

  // #endregion

  // #region Private Helpers - Selectability

  /**
   * Check if a row/cell is selectable.
   * Returns true if selectable, false if not.
   */
  private checkSelectable(rowIndex: number, colIndex?: number): boolean {
    const { isSelectable } = this.config;
    if (!isSelectable) return true; // No callback = all selectable

    const row = this.rows[rowIndex];
    if (!row) return false;

    // colIndex is a visible-column index (from data-col), so use visibleColumns
    const column = colIndex !== undefined ? this.visibleColumns[colIndex] : undefined;
    return isSelectable(row, rowIndex, column, colIndex);
  }

  /**
   * Check if an entire row is selectable (for row mode).
   */
  private isRowSelectable(rowIndex: number): boolean {
    return this.checkSelectable(rowIndex);
  }

  /**
   * Check if a cell is selectable (for cell/range modes).
   */
  private isCellSelectable(rowIndex: number, colIndex: number): boolean {
    return this.checkSelectable(rowIndex, colIndex);
  }

  // #endregion

  // #region Lifecycle

  /** @internal */
  override attach(grid: GridElement): void {
    super.attach(grid);

    // Resolve the user-supplied mode (string OR array) into a single normalized
    // shape. Throws on invalid combinations (e.g. ['row', 'cell']).
    this.#mode = normalizeMode(this.config.mode);

    // Subscribe to events that invalidate selection
    // When rows change due to filtering/grouping/tree/sort operations, selection indices become invalid
    this.on('filter-change', () => this.clearSelectionSilent());
    this.on('group-toggle', () => this.clearSelectionSilent());
    this.on('tree-expand', () => this.clearSelectionSilent());
    this.on('sort-change', () => this.clearSelectionSilent());

    // Auto-select the row currently being edited so consumers of getSelectedRows()
    // / selectedRows() always see the row the user is actually working with.
    // Issue #284: editing and selection were independent, so a row could be in
    // edit mode while selectedRows() returned a stale (or different) row.
    // Only meaningful in row mode — cell mode tracks single-cell focus, range
    // mode is for bulk selection. We listen to `edit-open` (broadcast by
    // EditingPlugin) — `edit-close` is intentionally ignored so existing
    // selections are preserved when the user finishes editing.
    this.on<{ rowIndex: number; row: unknown }>('edit-open', ({ rowIndex, row }) => {
      if (!this.isSelectionEnabled()) return;
      if (row == null || rowIndex < 0) return;
      if (this.#mode.primary !== 'row') return;
      if (!this.isRowSelectable(rowIndex)) return;
      if (this.selected.has(rowIndex)) return;
      // multiSelect: false → replace; otherwise add to existing set so
      // multi-selection is preserved when the user enters edit on one row.
      if (this.config.multiSelect === false) {
        this.selected.clear();
      }
      this.selected.add(rowIndex);
      this.lastSelected = rowIndex;
      this.anchor = rowIndex;
      this.explicitSelection = true;
      this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
      this.requestAfterRender();
    });

    // Source-row collection replaced from outside (host swapped `[rows]`).
    // `data-change` also fires for in-place cell edits, so gate on sourceRowCount
    // changing — the only signal that the source collection actually grew/shrank.
    // Without this, stored row indices resolve against a different array and
    // getSelectedRows() silently returns the wrong rows.
    let lastSourceRowCount = -1;
    grid.addEventListener(
      'data-change',
      ((event: CustomEvent<{ sourceRowCount: number }>) => {
        const { sourceRowCount } = event.detail;
        const hasSelection = this.selected.size > 0 || this.ranges.length > 0 || this.selectedCell !== null;
        if (lastSourceRowCount !== -1 && sourceRowCount !== lastSourceRowCount && hasSelection) {
          this.clearSelectionSilent();
        }
        lastSourceRowCount = sourceRowCount;
      }) as EventListener,
      { signal: this.disconnectSignal },
    );
  }

  /**
   * Handle queries from other plugins.
   * @internal
   */
  override handleQuery(query: PluginQuery): unknown {
    if (query.type === 'getSelection') {
      return this.getSelection();
    }
    if (query.type === 'getSelectedRowIndices') {
      return this.getSelectedRowIndices();
    }
    if (query.type === 'getSelectedRows') {
      return this.getSelectedRows();
    }
    if (query.type === 'selectRows') {
      this.selectRows(query.context as number[]);
      return true;
    }
    if (query.type === 'getSelectedColumns') {
      return this.getSelectedColumns();
    }
    if (query.type === 'selectColumns') {
      const fields = query.context as string[];
      this.clearColumnSelection();
      for (const f of fields) this.selectColumn(f, { toggle: true });
      return true;
    }
    return undefined;
  }

  /** @internal */
  override detach(): void {
    // Clear aria-multiselectable that we set on the role=grid element.
    // Other lifecycle teardown happens below.
    const rowsBodyEl = this.gridElement?.querySelector('.rows-body');
    rowsBodyEl?.removeAttribute('aria-multiselectable');

    this.selected.clear();
    this.ranges = [];
    this.activeRange = null;
    this.cellAnchor = null;
    this.isDragging = false;
    this.selectedCell = null;
    this.selectedColumns.clear();
    this.columnAnchor = null;
    this.columnHead = null;
    this.activeAxis = 'none';
    this.pendingKeyboardUpdate = null;
    this.pendingRowKeyUpdate = null;
    this.lastSyncedFocusRow = -1;
    this.lastSyncedFocusCol = -1;
  }

  /**
   * Clear selection without emitting an event.
   * Used when selection is invalidated by external changes (filtering, grouping, etc.)
   *
   * Column selection is intentionally PRESERVED here — it tracks field names,
   * not row indices, so it stays valid across filter/sort/group changes. Use
   * {@link clearSelection} (public) or {@link #clearAllAxesSilent} for a full wipe.
   */
  private clearSelectionSilent(): void {
    this.selected.clear();
    this.ranges = [];
    this.activeRange = null;
    this.cellAnchor = null;
    this.selectedCell = null;
    this.lastSelected = null;
    this.anchor = null;
    this.lastSyncedFocusRow = -1;
    this.lastSyncedFocusCol = -1;
    if (this.activeAxis !== 'column') {
      this.activeAxis = 'none';
    }
    this.requestAfterRender();
  }

  // #endregion

  // #region Event Handlers

  /** @internal */
  override onCellClick(event: CellClickEvent): boolean {
    // Skip all selection if disabled at grid level or plugin level
    if (!this.isSelectionEnabled()) return false;

    const { rowIndex, colIndex, originalEvent } = event;
    const { triggerOn = 'click' } = this.config;
    const mode = this.#mode.primary;

    // Skip if event type doesn't match configured trigger
    // This allows dblclick mode to only select on double-click
    if (originalEvent.type !== triggerOn) {
      return false;
    }

    // Check if this is a utility column (expander columns, etc.)
    // event.column is already resolved from _visibleColumns in the event builder
    const column = event.column;
    const isUtility = column && isUtilityColumn(column);

    // CELL MODE: Single cell selection - skip utility columns and non-selectable cells
    if (mode === 'cell') {
      if (isUtility) {
        return false; // Allow event to propagate, but don't select utility cells
      }
      if (!this.isCellSelectable(rowIndex, colIndex)) {
        return false; // Cell is not selectable
      }
      // Only emit if selection actually changed
      const currentCell = this.selectedCell;
      if (currentCell && currentCell.row === rowIndex && currentCell.col === colIndex) {
        return false; // Same cell already selected
      }
      this.selectedCell = { row: rowIndex, col: colIndex };
      this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
      this.requestAfterRender();
      return false;
    }

    // ROW MODE: Multi-select with Shift/Ctrl, checkbox toggle, or single select
    if (mode === 'row') {
      if (!this.isRowSelectable(rowIndex)) {
        return false; // Row is not selectable
      }

      const multiSelect = this.config.multiSelect !== false;
      const shiftKey = originalEvent.shiftKey && multiSelect;
      const ctrlKey = (originalEvent.ctrlKey || originalEvent.metaKey) && multiSelect;
      const isCheckbox = column?.checkboxColumn === true;

      if (shiftKey && this.anchor !== null) {
        // Shift+Click: Range select from anchor to clicked row
        const start = Math.min(this.anchor, rowIndex);
        const end = Math.max(this.anchor, rowIndex);
        if (!ctrlKey) {
          this.selected.clear();
        }
        for (let i = start; i <= end; i++) {
          if (this.isRowSelectable(i)) {
            this.selected.add(i);
          }
        }
      } else if (ctrlKey || (isCheckbox && multiSelect)) {
        // Ctrl+Click or checkbox click: Toggle individual row
        if (this.selected.has(rowIndex)) {
          this.selected.delete(rowIndex);
        } else {
          this.selected.add(rowIndex);
        }
        this.anchor = rowIndex;
      } else {
        // Plain click (or any click when multiSelect is false): select only clicked row
        if (this.selected.size === 1 && this.selected.has(rowIndex)) {
          return false; // Same row already selected
        }
        this.selected.clear();
        this.selected.add(rowIndex);
        this.anchor = rowIndex;
      }

      this.lastSelected = rowIndex;
      this.explicitSelection = true;
      this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
      this.requestAfterRender();
      return false;
    }

    // RANGE MODE: Shift+click extends selection, click starts new
    if (mode === 'range') {
      // Skip utility columns in range mode - don't start selection from them
      if (isUtility) {
        return false;
      }

      // Skip non-selectable cells in range mode
      if (!this.isCellSelectable(rowIndex, colIndex)) {
        return false;
      }

      const shiftKey = originalEvent.shiftKey;
      const ctrlKey = (originalEvent.ctrlKey || originalEvent.metaKey) && this.config.multiSelect !== false;

      if (shiftKey && this.cellAnchor) {
        // Extend selection from anchor
        const newRange = createRangeFromAnchor(this.cellAnchor, { row: rowIndex, col: colIndex });

        // Check if range actually changed
        const currentRange = this.ranges.length > 0 ? this.ranges[this.ranges.length - 1] : null;
        if (currentRange && rangesEqual(currentRange, newRange)) {
          return false; // Same range already selected
        }

        if (ctrlKey) {
          if (this.ranges.length > 0) {
            this.ranges[this.ranges.length - 1] = newRange;
          } else {
            this.ranges.push(newRange);
          }
        } else {
          this.ranges = [newRange];
        }
        this.activeRange = newRange;
      } else if (ctrlKey) {
        const newRange: InternalCellRange = {
          startRow: rowIndex,
          startCol: colIndex,
          endRow: rowIndex,
          endCol: colIndex,
        };
        this.ranges.push(newRange);
        this.activeRange = newRange;
        this.cellAnchor = { row: rowIndex, col: colIndex };
      } else {
        // Plain click - check if same single-cell range already selected
        const newRange: InternalCellRange = {
          startRow: rowIndex,
          startCol: colIndex,
          endRow: rowIndex,
          endCol: colIndex,
        };

        // Only emit if selection actually changed
        if (this.ranges.length === 1 && rangesEqual(this.ranges[0], newRange)) {
          return false; // Same cell already selected
        }

        this.ranges = [newRange];
        this.activeRange = newRange;
        this.cellAnchor = { row: rowIndex, col: colIndex };
      }

      this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());

      this.requestAfterRender();
      return false;
    }

    return false;
  }

  /** @internal */
  override onKeyDown(event: KeyboardEvent): boolean {
    // Skip all selection if disabled at grid level or plugin level
    if (!this.isSelectionEnabled()) return false;

    const mode = this.#mode.primary;
    const columnEnabled = this.#mode.columnEnabled;
    const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End', 'PageUp', 'PageDown'];
    const isNavKey = navKeys.includes(event.key);

    // Ctrl+Space — WAI-ARIA Grid: toggle column selection for the focused column.
    // Per-spec uses ' ' (Space). Some browsers report `key === 'Spacebar'` on
    // older hosts; cover both.
    if (columnEnabled && (event.ctrlKey || event.metaKey) && (event.key === ' ' || event.key === 'Spacebar')) {
      const colIndex = this.grid._focusCol;
      const column = this.visibleColumns[colIndex];
      if (column && !isUtilityColumn(column) && typeof column.field === 'string') {
        event.preventDefault();
        event.stopPropagation();
        this.selectColumn(column.field, { toggle: true });
        return true;
      }
    }

    // Ctrl+Shift+ArrowLeft / ArrowRight — extend column selection along visible columns.
    if (
      columnEnabled &&
      this.activeAxis === 'column' &&
      this.config.multiSelect !== false &&
      (event.ctrlKey || event.metaKey) &&
      event.shiftKey &&
      (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
    ) {
      const fields = selectableColumnFields(this.visibleColumns);
      const direction = event.key === 'ArrowLeft' ? 'left' : 'right';
      const newHead = computeKeyboardExtension(this.columnHead, fields, direction);
      if (newHead !== null && this.columnAnchor !== null) {
        event.preventDefault();
        event.stopPropagation();
        this.selectColumn(newHead, { range: true });
        return true;
      }
    }

    // Escape clears selection in all modes
    // But if editing is active, let the EditingPlugin handle Escape first
    if (event.key === 'Escape') {
      const isEditing = this.grid.query<boolean>('isEditing');
      if (isEditing.some(Boolean)) {
        return false; // Defer to EditingPlugin to cancel the active edit
      }

      // Column axis — clear it; falls through to clear in-row when both axes
      // are configured but we want a single Escape to clear the active axis only.
      if (this.activeAxis === 'column') {
        this.selectedColumns.clear();
        this.columnAnchor = null;
        this.columnHead = null;
        this.activeAxis = 'none';
        this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
        this.requestAfterRender();
        return true;
      }

      if (mode === 'cell') {
        this.selectedCell = null;
      } else if (mode === 'row') {
        this.selected.clear();
        this.anchor = null;
      } else if (mode === 'range') {
        this.ranges = [];
        this.activeRange = null;
        this.cellAnchor = null;
      }
      this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
      this.requestAfterRender();
      return true;
    }

    // CELL MODE: Selection follows focus (but respects selectability)
    if (mode === 'cell' && isNavKey) {
      // Use queueMicrotask so grid's handler runs first and updates focusRow/focusCol
      queueMicrotask(() => {
        const focusRow = this.grid._focusRow;
        const focusCol = this.grid._focusCol;
        // Only select if the cell is selectable
        if (this.isCellSelectable(focusRow, focusCol)) {
          this.selectedCell = { row: focusRow, col: focusCol };
        } else {
          // Clear selection when navigating to non-selectable cell
          this.selectedCell = null;
        }
        this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
        this.requestAfterRender();
      });
      return false; // Let grid handle navigation
    }

    // ROW MODE: Arrow/Page/Home/End keys move selection, Shift extends, Ctrl+A selects all
    if (mode === 'row') {
      const multiSelect = this.config.multiSelect !== false;
      const isRowNavKey =
        event.key === 'ArrowUp' ||
        event.key === 'ArrowDown' ||
        event.key === 'PageUp' ||
        event.key === 'PageDown' ||
        ((event.ctrlKey || event.metaKey) && (event.key === 'Home' || event.key === 'End'));

      if (isRowNavKey) {
        const shiftKey = event.shiftKey && multiSelect;

        // Set anchor SYNCHRONOUSLY before grid moves focus
        if (shiftKey && this.anchor === null) {
          this.anchor = this.grid._focusRow;
        }

        // Mark explicit selection SYNCHRONOUSLY so #syncSelectionToFocus
        // won't overwrite the anchor if afterRender fires before our update
        this.explicitSelection = true;

        // Store pending update — processed in afterRender when grid has updated focusRow
        this.pendingRowKeyUpdate = { shiftKey };

        // Schedule afterRender (grid's refreshVirtualWindow(false) may skip it)
        queueMicrotask(() => this.requestAfterRender());
        return false; // Let grid handle navigation
      }

      // Ctrl+A: Select all rows (skip when editing, skip when single-select)
      if (multiSelect && event.key === 'a' && (event.ctrlKey || event.metaKey)) {
        const isEditing = this.grid.query<boolean>('isEditing');
        if (isEditing.some(Boolean)) return false;
        event.preventDefault();
        event.stopPropagation();
        this.selectAll();
        return true;
      }
    }

    // RANGE MODE: Shift+Arrow extends, plain Arrow resets
    // Tab key always navigates without extending (even with Shift)
    if (mode === 'range' && isNavKey) {
      // Tab should not extend selection - it just navigates to the next/previous cell
      const isTabKey = event.key === 'Tab';
      const shouldExtend = event.shiftKey && !isTabKey;

      // Capture anchor BEFORE grid moves focus (synchronous)
      // This ensures the anchor is the starting point, not the destination
      if (shouldExtend && !this.cellAnchor) {
        this.cellAnchor = { row: this.grid._focusRow, col: this.grid._focusCol };
      }

      // Mark pending update - will be processed in afterRender when grid updates focus
      this.pendingKeyboardUpdate = { shiftKey: shouldExtend };

      // Schedule afterRender to run after grid's keyboard handler completes
      // Grid's refreshVirtualWindow(false) skips afterRender for performance,
      // so we explicitly request it to process pendingKeyboardUpdate
      queueMicrotask(() => this.requestAfterRender());

      return false; // Let grid handle navigation
    }

    // Ctrl+A selects all in range mode (skip when editing, skip when single-select)
    if (
      mode === 'range' &&
      this.config.multiSelect !== false &&
      event.key === 'a' &&
      (event.ctrlKey || event.metaKey)
    ) {
      const isEditing = this.grid.query<boolean>('isEditing');
      if (isEditing.some(Boolean)) return false;
      event.preventDefault();
      event.stopPropagation();
      this.selectAll();
      return true;
    }

    return false;
  }

  /** @internal */
  override onCellMouseDown(event: CellMouseEvent): boolean | void {
    // Skip all selection if disabled at grid level or plugin level
    if (!this.isSelectionEnabled()) return;

    if (this.#mode.primary !== 'range') return;
    if (event.rowIndex === undefined || event.colIndex === undefined) return;
    if (event.rowIndex < 0) return; // Header

    // Skip utility columns (expander columns, etc.)
    // event.column is already resolved from _visibleColumns in the event builder
    if (event.column && isUtilityColumn(event.column)) {
      return; // Don't start selection on utility columns
    }

    // Skip non-selectable cells - don't start drag from them
    if (!this.isCellSelectable(event.rowIndex, event.colIndex)) {
      return;
    }

    // Let onCellClick handle shift+click for range extension
    if (event.originalEvent.shiftKey && this.cellAnchor) {
      return;
    }

    // Start drag selection
    this.isDragging = true;
    const rowIndex = event.rowIndex;
    const colIndex = event.colIndex;

    // When multiSelect is false, Ctrl+click starts a new single range instead of adding
    const ctrlKey = (event.originalEvent.ctrlKey || event.originalEvent.metaKey) && this.config.multiSelect !== false;

    const newRange: InternalCellRange = {
      startRow: rowIndex,
      startCol: colIndex,
      endRow: rowIndex,
      endCol: colIndex,
    };

    // Check if selection is actually changing (for non-Ctrl clicks)
    if (!ctrlKey && this.ranges.length === 1 && rangesEqual(this.ranges[0], newRange)) {
      // Same cell already selected, just update anchor for potential drag
      this.cellAnchor = { row: rowIndex, col: colIndex };
      return true;
    }

    this.cellAnchor = { row: rowIndex, col: colIndex };

    if (!ctrlKey) {
      this.ranges = [];
    }

    this.ranges.push(newRange);
    this.activeRange = newRange;

    this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
    this.requestAfterRender();
    return true;
  }

  /** @internal */
  override onCellMouseMove(event: CellMouseEvent): boolean | void {
    // Skip all selection if disabled at grid level or plugin level
    if (!this.isSelectionEnabled()) return;

    if (this.#mode.primary !== 'range') return;
    if (!this.isDragging || !this.cellAnchor) return;
    if (event.rowIndex === undefined || event.colIndex === undefined) return;
    if (event.rowIndex < 0) return;

    // When dragging, clamp to first data column (skip utility columns)
    // colIndex from events is a visible-column index (from data-col)
    let targetCol = event.colIndex;
    const column = this.visibleColumns[targetCol];
    if (column && isUtilityColumn(column)) {
      // Find the first non-utility visible column
      const firstDataCol = this.visibleColumns.findIndex((col) => !isUtilityColumn(col));
      if (firstDataCol >= 0) {
        targetCol = firstDataCol;
      }
    }

    const newRange = createRangeFromAnchor(this.cellAnchor, { row: event.rowIndex, col: targetCol });

    // Only update and emit if the range actually changed
    const currentRange = this.ranges.length > 0 ? this.ranges[this.ranges.length - 1] : null;
    if (currentRange && rangesEqual(currentRange, newRange)) {
      return true; // Range unchanged, no need to update
    }

    if (this.ranges.length > 0) {
      this.ranges[this.ranges.length - 1] = newRange;
    } else {
      this.ranges.push(newRange);
    }
    this.activeRange = newRange;

    this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
    this.requestAfterRender();
    return true;
  }

  /** @internal */
  override onCellMouseUp(_event: CellMouseEvent): boolean | void {
    // Skip all selection if disabled at grid level or plugin level
    if (!this.isSelectionEnabled()) return;

    if (this.#mode.primary !== 'range') return;
    if (this.isDragging) {
      this.isDragging = false;
      return true;
    }
  }

  /**
   * Header click handler — drives column-axis selection.
   *
   * - Plain click (and plain Shift+click): defer to MultiSort / core sort by
   *   returning `false`. Header-click sort behavior is unchanged.
   * - **Ctrl/Cmd+click**: toggle selection of the clicked column (or replace,
   *   when `multiSelect: false`).
   * - **Ctrl/Cmd+Shift+click**: extend selection from the column anchor to the
   *   clicked column. Avoids the plain `Shift+click` chord owned by MultiSort.
   *
   * No-ops when column selection isn't enabled or when the clicked column is
   * a utility column (`utility: true`).
   * @internal
   */
  override onHeaderClick(event: HeaderClickEvent): boolean | void {
    if (!this.isSelectionEnabled()) return false;
    if (!this.#mode.columnEnabled) return false;
    if (event.column && isUtilityColumn(event.column)) return false;

    const e = event.originalEvent;
    const ctrlKey = e.ctrlKey || e.metaKey;
    if (!ctrlKey) return false; // Plain / Shift click → sort path

    const field = event.field;
    if (!field) return false;

    e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();

    const range = e.shiftKey === true && this.config.multiSelect !== false && this.columnAnchor !== null;
    this.selectColumn(field, range ? { range: true } : { toggle: true });
    return true; // Handled — suppress sort
  }

  // #region Checkbox Column

  /**
   * Inject checkbox column when `checkbox: true` and mode is `'row'`.
   * @internal
   */
  override processColumns(columns: ColumnConfig[]): ColumnConfig[] {
    if (this.config.checkbox && this.#mode.primary === 'row') {
      // Check if checkbox column already exists
      if (columns.some((col) => col.field === CHECKBOX_COLUMN_FIELD)) {
        return columns;
      }
      const checkboxCol = this.#createCheckboxColumn();
      // Insert after expander column if present, otherwise first
      const expanderIdx = columns.findIndex(isExpanderColumn);
      const insertAt = expanderIdx >= 0 ? expanderIdx + 1 : 0;
      return [...columns.slice(0, insertAt), checkboxCol, ...columns.slice(insertAt)];
    }
    return columns;
  }

  /**
   * Create the checkbox utility column configuration.
   */
  #createCheckboxColumn(): ColumnConfig {
    return {
      field: CHECKBOX_COLUMN_FIELD,
      header: '',
      width: 32,
      resizable: false,
      sortable: false,
      lockPosition: true,
      utility: true,
      checkboxColumn: true,
      headerRenderer: () => {
        const container = document.createElement('div');
        container.className = 'tbw-checkbox-header';
        // Hide "select all" checkbox in single-select mode
        if (this.config.multiSelect === false) return container;
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'tbw-select-all-checkbox';
        checkbox.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent header sort
          if ((e.target as HTMLInputElement).checked) {
            this.selectAll();
          } else {
            this.clearSelection();
          }
        });
        container.appendChild(checkbox);
        return container;
      },
      renderer: (ctx) => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'tbw-select-row-checkbox';
        // Set initial checked state from current selection
        const cellEl = ctx.cellEl;
        if (cellEl) {
          const rowIndex = parseInt(cellEl.getAttribute('data-row') ?? '-1', 10);
          if (rowIndex >= 0) {
            checkbox.checked = this.selected.has(rowIndex);
          }
        }
        return checkbox;
      },
    };
  }

  /**
   * Update checkbox checked states to reflect current selection.
   * Called from #applySelectionClasses.
   */
  #updateCheckboxStates(gridEl: HTMLElement): void {
    // Update row checkboxes
    const rowCheckboxes = gridEl.querySelectorAll('.tbw-select-row-checkbox') as NodeListOf<HTMLInputElement>;
    rowCheckboxes.forEach((checkbox) => {
      const cell = checkbox.closest('.cell');
      const rowIndex = cell ? getRowIndexFromCell(cell) : -1;
      if (rowIndex >= 0) {
        checkbox.checked = this.selected.has(rowIndex);
      }
    });

    // Update header select-all checkbox
    const headerCheckbox = gridEl.querySelector('.tbw-select-all-checkbox') as HTMLInputElement | null;
    if (headerCheckbox) {
      const rowCount = this.rows.length;
      let selectableCount = 0;
      if (this.config.isSelectable) {
        for (let i = 0; i < rowCount; i++) {
          if (this.isRowSelectable(i)) selectableCount++;
        }
      } else {
        selectableCount = rowCount;
      }
      const allSelected = selectableCount > 0 && this.selected.size >= selectableCount;
      const someSelected = this.selected.size > 0;
      headerCheckbox.checked = allSelected;
      headerCheckbox.indeterminate = someSelected && !allSelected;
    }
  }

  // #endregion

  /**
   * Sync selection state to the grid's current focus position.
   * In row mode, keeps `selected` in sync with `_focusRow`.
   * In cell mode, keeps `selectedCell` in sync with `_focusRow`/`_focusCol`.
   * Only updates when the focus has changed since the last sync.
   * Skips when `explicitSelection` is set (click/keyboard set selection directly).
   */
  #syncSelectionToFocus(mode: string): void {
    const focusRow = this.grid._focusRow;
    const focusCol = this.grid._focusCol;

    if (mode === 'row') {
      // Skip auto-sync when selection was explicitly set (Shift/Ctrl click, keyboard)
      if (this.explicitSelection) {
        this.explicitSelection = false;
        this.lastSyncedFocusRow = focusRow;
        return;
      }

      if (focusRow !== this.lastSyncedFocusRow) {
        this.lastSyncedFocusRow = focusRow;
        if (this.isRowSelectable(focusRow)) {
          if (!this.selected.has(focusRow) || this.selected.size !== 1) {
            this.selected.clear();
            this.selected.add(focusRow);
            this.lastSelected = focusRow;
            this.anchor = focusRow;
            this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
          }
        }
      }
    }

    if (mode === 'cell') {
      if (this.explicitSelection) {
        this.explicitSelection = false;
        this.lastSyncedFocusRow = focusRow;
        this.lastSyncedFocusCol = focusCol;
        return;
      }

      if (focusRow !== this.lastSyncedFocusRow || focusCol !== this.lastSyncedFocusCol) {
        this.lastSyncedFocusRow = focusRow;
        this.lastSyncedFocusCol = focusCol;
        if (this.isCellSelectable(focusRow, focusCol)) {
          const cur = this.selectedCell;
          if (!cur || cur.row !== focusRow || cur.col !== focusCol) {
            this.selectedCell = { row: focusRow, col: focusCol };
            this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
          }
        }
      }
    }
  }

  /**
   * Apply CSS selection classes to row/cell elements.
   * Shared by afterRender and onScrollRender.
   */
  #applySelectionClasses(): void {
    const gridEl = this.gridElement;
    if (!gridEl) return;

    const mode = this.#mode.primary;
    const columnEnabled = this.#mode.columnEnabled;
    const hasSelectableCallback = !!this.config.isSelectable;

    // Reflect multi-select capability on the role=grid element so screen readers
    // announce the grid as multi-selectable. WAI-ARIA requires aria-multiselectable
    // on the element carrying role="grid" — that's `.rows-body` in our render tree,
    // not the host. `multiSelect` defaults to true; only `false` opts out.
    const rowsBodyEl = gridEl.querySelector('.rows-body');
    if (rowsBodyEl) {
      const multi = this.config.multiSelect !== false;
      rowsBodyEl.setAttribute('aria-multiselectable', multi ? 'true' : 'false');
    }

    // Clear all selection classes first (including column-selected)
    const allCells = gridEl.querySelectorAll('.cell');
    allCells.forEach((cell) => {
      cell.classList.remove(GridClasses.SELECTED, 'top', 'bottom', 'first', 'last', 'column-selected');
      // Clear selectable attribute - will be re-applied below
      if (hasSelectableCallback) {
        cell.removeAttribute('data-selectable');
      }
    });

    const allRows = gridEl.querySelectorAll('.data-grid-row');
    allRows.forEach((row) => {
      row.classList.remove(GridClasses.SELECTED, 'row-focus');
      row.setAttribute('aria-selected', 'false');
      // Clear selectable attribute - will be re-applied below
      if (hasSelectableCallback) {
        row.removeAttribute('data-selectable');
      }
    });

    // Clear column-selected from header cells too
    if (columnEnabled) {
      const headerCells = gridEl.querySelectorAll('.header-row > .cell');
      headerCells.forEach((cell) => {
        cell.classList.remove('column-selected');
        cell.removeAttribute('aria-selected');
      });
    }

    // ROW MODE: Add row-focus class to selected rows, disable cell-focus, update checkboxes
    if (mode === 'row') {
      // In row mode, disable ALL cell-focus styling - row selection takes precedence
      clearCellFocus(gridEl);

      allRows.forEach((row) => {
        const firstCell = row.querySelector('.cell[data-row]');
        const rowIndex = getRowIndexFromCell(firstCell);
        if (rowIndex >= 0) {
          // Mark non-selectable rows
          if (hasSelectableCallback && !this.isRowSelectable(rowIndex)) {
            row.setAttribute('data-selectable', 'false');
          }
          if (this.selected.has(rowIndex)) {
            row.classList.add(GridClasses.SELECTED, 'row-focus');
            row.setAttribute('aria-selected', 'true');
          }
        }
      });

      // Update checkbox states if checkbox column is enabled
      if (this.config.checkbox) {
        this.#updateCheckboxStates(gridEl);
      }
    }

    // CELL/RANGE MODE: Mark non-selectable cells
    if ((mode === 'cell' || mode === 'range') && hasSelectableCallback) {
      const cells = gridEl.querySelectorAll('.cell[data-row][data-col]');
      cells.forEach((cell) => {
        const rowIndex = parseInt(cell.getAttribute('data-row') ?? '-1', 10);
        const colIndex = parseInt(cell.getAttribute('data-col') ?? '-1', 10);
        if (rowIndex >= 0 && colIndex >= 0) {
          if (!this.isCellSelectable(rowIndex, colIndex)) {
            cell.setAttribute('data-selectable', 'false');
          }
        }
      });
    }

    // RANGE MODE: Add selected and edge classes to cells
    // Uses neighbor-based edge detection for correct multi-range borders
    if (mode === 'range' && this.ranges.length > 0) {
      // Clear all cell-focus first - selection plugin manages focus styling in range mode
      clearCellFocus(gridEl);

      // Pre-normalize ranges for efficient neighbor checks
      const normalizedRanges = this.ranges.map(normalizeRange);

      // Fast selection check against pre-normalized ranges
      const isInSelection = (r: number, c: number): boolean => {
        for (const range of normalizedRanges) {
          if (r >= range.startRow && r <= range.endRow && c >= range.startCol && c <= range.endCol) {
            return true;
          }
        }
        return false;
      };

      const cells = gridEl.querySelectorAll('.cell[data-row][data-col]');
      cells.forEach((cell) => {
        const rowIndex = parseInt(cell.getAttribute('data-row') ?? '-1', 10);
        const colIndex = parseInt(cell.getAttribute('data-col') ?? '-1', 10);
        if (rowIndex >= 0 && colIndex >= 0) {
          // Skip utility columns entirely - don't add any selection classes
          // colIndex from data-col is a visible-column index
          const column = this.visibleColumns[colIndex];
          if (column && isUtilityColumn(column)) {
            return;
          }

          if (isInSelection(rowIndex, colIndex)) {
            cell.classList.add(GridClasses.SELECTED);
            cell.setAttribute('aria-selected', 'true');

            // Edge detection: add border class where neighbor is not selected
            // This handles single ranges, multi-range, and irregular selections correctly
            if (!isInSelection(rowIndex - 1, colIndex)) cell.classList.add('top');
            if (!isInSelection(rowIndex + 1, colIndex)) cell.classList.add('bottom');
            if (!isInSelection(rowIndex, colIndex - 1)) cell.classList.add('first');
            if (!isInSelection(rowIndex, colIndex + 1)) cell.classList.add('last');
          }
        }
      });
    }

    // CELL MODE: Let the grid's native .cell-focus styling handle cell highlighting
    // No additional action needed - the grid already manages focus styling

    // COLUMN AXIS: Apply column-selected class + aria-selected to the header cell
    // and every data cell in the matching column. Identifies columns by their
    // visible-index (data-col matches the visibleColumns position) so it works
    // regardless of pinning / reordering — selectedColumns stores fields, not
    // indices, so the rendering layer resolves them per-render.
    if (columnEnabled && this.selectedColumns.size > 0) {
      // Build visible-index → field map once for O(1) lookups.
      const colFieldByIndex: (string | undefined)[] = this.visibleColumns.map((c) =>
        typeof c.field === 'string' ? c.field : undefined,
      );

      // Header cells — the grid renders header cells with data-col attributes.
      const headerCells = gridEl.querySelectorAll<HTMLElement>('.header-row > .cell[data-col]');
      headerCells.forEach((cell) => {
        const colIndex = parseInt(cell.getAttribute('data-col') ?? '-1', 10);
        const field = colIndex >= 0 ? colFieldByIndex[colIndex] : undefined;
        if (field && this.selectedColumns.has(field)) {
          cell.classList.add('column-selected');
          cell.setAttribute('aria-selected', 'true');
        }
      });

      // Data cells.
      const cells = gridEl.querySelectorAll<HTMLElement>('.cell[data-col]:not(.header-row .cell)');
      cells.forEach((cell) => {
        // Skip header cells (filter above isn't reliable for nested .header-row scoping)
        if (cell.closest('.header-row')) return;
        const colIndex = parseInt(cell.getAttribute('data-col') ?? '-1', 10);
        if (colIndex < 0) return;
        const column = this.visibleColumns[colIndex];
        if (!column || isUtilityColumn(column)) return;
        const field = colFieldByIndex[colIndex];
        if (field && this.selectedColumns.has(field)) {
          cell.classList.add('column-selected');
          cell.setAttribute('aria-selected', 'true');
        }
      });
    }
  }

  /** @internal */
  override afterRender(): void {
    // Skip rendering selection if disabled at grid level or plugin level
    if (!this.isSelectionEnabled()) return;

    const gridEl = this.gridElement;
    if (!gridEl) return;

    const container = gridEl.querySelector('.tbw-grid-root');
    const mode = this.#mode.primary;

    // Process pending row keyboard navigation update (row mode)
    // This runs AFTER the grid has updated focusRow
    if (this.pendingRowKeyUpdate && mode === 'row') {
      const { shiftKey } = this.pendingRowKeyUpdate;
      this.pendingRowKeyUpdate = null;

      const focusRow = this.grid._focusRow;

      if (shiftKey && this.anchor !== null) {
        // Shift+nav: Extend selection from anchor to new focus
        this.selected.clear();
        const start = Math.min(this.anchor, focusRow);
        const end = Math.max(this.anchor, focusRow);
        for (let i = start; i <= end; i++) {
          if (this.isRowSelectable(i)) {
            this.selected.add(i);
          }
        }
      } else {
        // Plain nav: Single select
        if (this.isRowSelectable(focusRow)) {
          this.selected.clear();
          this.selected.add(focusRow);
          this.anchor = focusRow;
        } else {
          this.selected.clear();
        }
      }

      this.lastSelected = focusRow;
      this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
    }

    // Process pending keyboard navigation update (range mode)
    // This runs AFTER the grid has updated focusRow/focusCol
    if (this.pendingKeyboardUpdate && mode === 'range') {
      const { shiftKey } = this.pendingKeyboardUpdate;
      this.pendingKeyboardUpdate = null;

      const currentRow = this.grid._focusRow;
      const currentCol = this.grid._focusCol;

      if (shiftKey && this.cellAnchor) {
        // Extend selection from anchor to current focus
        const newRange = createRangeFromAnchor(this.cellAnchor, { row: currentRow, col: currentCol });
        this.ranges = [newRange];
        this.activeRange = newRange;
      } else if (!shiftKey) {
        // Without shift, clear selection (cell-focus will show instead)
        this.ranges = [];
        this.activeRange = null;
        this.cellAnchor = { row: currentRow, col: currentCol }; // Reset anchor to current position
      }

      this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
    }

    // Sync selection to grid's focus position.
    // This ensures selection follows keyboard navigation (Tab, arrows, etc.)
    // regardless of which plugin moved the focus.
    this.#syncSelectionToFocus(mode);

    // Set data attribute on host for CSS variable scoping
    this.gridElement.setAttribute('data-selection-mode', mode);

    // Toggle .selecting class during drag to prevent text selection
    if (container) {
      container.classList.toggle('selecting', this.isDragging);
    }

    this.#applySelectionClasses();
  }

  /**
   * Called after scroll-triggered row rendering.
   * Reapplies selection classes to recycled DOM elements.
   * @internal
   */
  override onScrollRender(): void {
    // Skip rendering selection classes if disabled
    if (!this.isSelectionEnabled()) return;

    this.#applySelectionClasses();
  }

  // #endregion

  // #region Public API

  /**
   * Get the current selection as a unified result.
   * Works for all selection modes and always returns ranges.
   *
   * @example
   * ```ts
   * const selection = plugin.getSelection();
   * if (selection.ranges.length > 0) {
   *   const { from, to } = selection.ranges[0];
   *   // For cell mode: from === to (single cell)
   *   // For row mode: from.col = 0, to.col = lastCol (full row)
   *   // For range mode: rectangular selection
   * }
   * ```
   */
  getSelection(): SelectionResult {
    const event = this.#buildEvent();
    return {
      mode: this.config.mode,
      activeAxis: event.activeAxis,
      ranges: event.ranges,
      selectedColumns: event.selectedColumns,
      anchor: this.cellAnchor,
    };
  }

  /**
   * Get all selected cells across all ranges.
   */
  getSelectedCells(): Array<{ row: number; col: number }> {
    return getAllCellsInRanges(this.ranges);
  }

  /**
   * Check if a specific cell is in range selection.
   */
  isCellSelected(row: number, col: number): boolean {
    return isCellInAnyRange(row, col, this.ranges);
  }

  /**
   * Select all selectable rows (row mode) or all cells (range mode).
   *
   * In row mode, selects every row where `isSelectable` returns true (or all rows if no callback).
   * In range mode, creates a single range spanning all rows and columns.
   * Has no effect in cell mode.
   *
   * @example
   * ```ts
   * const plugin = grid.getPluginByName('selection');
   * plugin.selectAll(); // Selects everything in current mode
   * ```
   */
  selectAll(): void {
    const { mode, multiSelect } = this.config;

    // Single-select mode: selectAll is a no-op
    if (multiSelect === false) return;

    if (mode === 'row') {
      this.selected.clear();
      for (let i = 0; i < this.rows.length; i++) {
        if (this.isRowSelectable(i)) {
          this.selected.add(i);
        }
      }
      this.explicitSelection = true;
      this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
      this.requestAfterRender();
    } else if (mode === 'range') {
      const rowCount = this.rows.length;
      const colCount = this.columns.length;
      if (rowCount > 0 && colCount > 0) {
        const allRange: InternalCellRange = {
          startRow: 0,
          startCol: 0,
          endRow: rowCount - 1,
          endCol: colCount - 1,
        };
        this.ranges = [allRange];
        this.activeRange = allRange;
        this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
        this.requestAfterRender();
      }
    }
  }

  /**
   * Select specific rows by index (row mode only).
   * Replaces the current selection with the provided row indices.
   * Indices that are out of bounds or fail the `isSelectable` check are ignored.
   *
   * @param indices - Array of row indices to select
   *
   * @example
   * ```ts
   * const plugin = grid.getPluginByName('selection');
   * plugin.selectRows([0, 2, 4]); // Select rows 0, 2, and 4
   * ```
   */
  selectRows(indices: number[]): void {
    if (this.#mode.primary !== 'row') return;
    // In single-select mode, only use the last index
    const effectiveIndices =
      this.config.multiSelect === false && indices.length > 1 ? [indices[indices.length - 1]] : indices;
    this.selected.clear();
    for (const idx of effectiveIndices) {
      if (idx >= 0 && idx < this.rows.length && this.isRowSelectable(idx)) {
        this.selected.add(idx);
      }
    }
    this.anchor = effectiveIndices.length > 0 ? effectiveIndices[effectiveIndices.length - 1] : null;
    this.explicitSelection = true;
    this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
    this.requestAfterRender();
  }

  /**
   * Get the indices of all selected rows (convenience for row mode).
   * Returns indices sorted in ascending order.
   *
   * @example
   * ```ts
   * const plugin = grid.getPluginByName('selection');
   * const rows = plugin.getSelectedRowIndices(); // [0, 2, 4]
   * ```
   */
  getSelectedRowIndices(): number[] {
    return [...this.selected].sort((a, b) => a - b);
  }

  /**
   * Get the actual row objects for the current selection.
   *
   * Works across all selection modes:
   * - **Row mode**: Returns the row objects for all selected rows.
   * - **Cell mode**: Returns the single row containing the selected cell, or `[]`.
   * - **Range mode**: Returns the unique row objects that intersect any selected range.
   *
   * Row objects are resolved from the grid's processed (sorted/filtered) row array,
   * so they always reflect the current visual order.
   *
   * @example
   * ```ts
   * const plugin = grid.getPluginByName('selection');
   * const selected = plugin.getSelectedRows(); // [{ id: 1, name: 'Alice' }, ...]
   * ```
   */
  getSelectedRows<T = unknown>(): T[] {
    const mode = this.#mode.primary;
    const rows = this.rows;

    if (mode === 'row') {
      return this.getSelectedRowIndices()
        .filter((i) => i >= 0 && i < rows.length)
        .map((i) => rows[i]) as T[];
    }

    if (mode === 'cell' && this.selectedCell) {
      const { row } = this.selectedCell;
      return row >= 0 && row < rows.length ? [rows[row] as T] : [];
    }

    if (mode === 'range' && this.ranges.length > 0) {
      // Collect unique row indices across all ranges
      const rowIndices = new Set<number>();
      for (const range of this.ranges) {
        const minRow = Math.max(0, Math.min(range.startRow, range.endRow));
        const maxRow = Math.min(rows.length - 1, Math.max(range.startRow, range.endRow));
        for (let r = minRow; r <= maxRow; r++) {
          rowIndices.add(r);
        }
      }
      return [...rowIndices].sort((a, b) => a - b).map((i) => rows[i]) as T[];
    }

    return [];
  }

  /**
   * Toggle, add, or replace a column in the column-axis selection.
   *
   * Column selection is identified by **field name**, so it survives column
   * pinning, reordering, and virtualization recycling. The column must be
   * present in the grid's visible columns and must not be a utility column.
   *
   * Only available when `mode` includes `'column'`. With `multiSelect: false`,
   * `range`/`toggle` options are ignored and the call always replaces the
   * current selection with the single column.
   *
   * @param field - The column field name to select.
   * @param options.range - When true and a {@link columnAnchor} exists, selects
   *   every column from anchor to `field` inclusive (Ctrl+Shift+Click semantics).
   * @param options.toggle - When true, removes `field` if already selected;
   *   otherwise adds it. Without `toggle`, plain calls replace the selection.
   * @since 2.8.0
   */
  selectColumn(field: string, options: { range?: boolean; toggle?: boolean } = {}): void {
    if (!this.#mode.columnEnabled) return;
    const fields = selectableColumnFields(this.visibleColumns);
    if (!fields.includes(field)) return;

    this.#enforceMutualExclusion('column');

    const multiSelect = this.config.multiSelect !== false;
    if (!multiSelect) {
      this.selectedColumns.clear();
      this.selectedColumns.add(field);
      this.columnAnchor = field;
      this.columnHead = field;
    } else if (options.range && this.columnAnchor) {
      const range = fieldsBetween(this.columnAnchor, field, fields);
      this.selectedColumns.clear();
      for (const f of range) this.selectedColumns.add(f);
      this.columnHead = field;
    } else if (options.toggle) {
      if (this.selectedColumns.has(field)) {
        this.selectedColumns.delete(field);
      } else {
        this.selectedColumns.add(field);
      }
      this.columnAnchor = field;
      this.columnHead = field;
    } else {
      this.selectedColumns.clear();
      this.selectedColumns.add(field);
      this.columnAnchor = field;
      this.columnHead = field;
    }

    this.activeAxis = this.selectedColumns.size > 0 ? 'column' : 'none';
    this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
    this.requestAfterRender();
  }

  /**
   * Remove a column from the column-axis selection. No-op if `field` isn't selected.
   * @since 2.8.0
   */
  deselectColumn(field: string): void {
    if (!this.#mode.columnEnabled) return;
    if (!this.selectedColumns.delete(field)) return;
    if (this.selectedColumns.size === 0) {
      this.columnAnchor = null;
      this.columnHead = null;
      if (this.activeAxis === 'column') this.activeAxis = 'none';
    }
    this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
    this.requestAfterRender();
  }

  /**
   * Select every selectable column. No-op when `multiSelect: false` or column
   * mode isn't enabled.
   * @since 2.8.0
   */
  selectAllColumns(): void {
    if (!this.#mode.columnEnabled) return;
    if (this.config.multiSelect === false) return;
    const fields = selectableColumnFields(this.visibleColumns);
    if (fields.length === 0) return;
    this.#enforceMutualExclusion('column');
    this.selectedColumns.clear();
    for (const f of fields) this.selectedColumns.add(f);
    this.columnAnchor = fields[0];
    this.columnHead = fields[fields.length - 1];
    this.activeAxis = 'column';
    this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
    this.requestAfterRender();
  }

  /**
   * Clear column-axis selection only. Leaves any row/cell/range selection intact.
   * @since 2.8.0
   */
  clearColumnSelection(): void {
    if (this.selectedColumns.size === 0) return;
    this.selectedColumns.clear();
    this.columnAnchor = null;
    this.columnHead = null;
    if (this.activeAxis === 'column') this.activeAxis = 'none';
    this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
    this.requestAfterRender();
  }

  /**
   * Get the field names of all currently selected columns, in visible-column
   * order. Returns an empty array when the column axis is inactive or empty.
   * @since 2.8.0
   */
  getSelectedColumns(): readonly string[] {
    if (this.selectedColumns.size === 0) return [];
    const fields = selectableColumnFields(this.visibleColumns);
    return fields.filter((f) => this.selectedColumns.has(f));
  }

  /**
   * Clear all selection (every axis).
   */
  clearSelection(): void {
    this.selectedCell = null;
    this.selected.clear();
    this.anchor = null;
    this.ranges = [];
    this.activeRange = null;
    this.cellAnchor = null;
    this.selectedColumns.clear();
    this.columnAnchor = null;
    this.columnHead = null;
    this.activeAxis = 'none';
    this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
    this.requestAfterRender();
  }

  /**
   * Set selected ranges programmatically.
   */
  setRanges(ranges: CellRange[]): void {
    this.ranges = ranges.map((r) => ({
      startRow: r.from.row,
      startCol: r.from.col,
      endRow: r.to.row,
      endCol: r.to.col,
    }));
    this.activeRange = this.ranges.length > 0 ? this.ranges[this.ranges.length - 1] : null;
    this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
    this.requestAfterRender();
  }

  // #endregion

  // #region Private Helpers

  #buildEvent(): SelectionChangeDetail {
    // Derive the axis from current state so all existing in-row code paths
    // (which mutate state then emit) report the correct axis without needing
    // to pre-set `this.activeAxis` themselves. Mutual exclusion is enforced
    // separately in {@link #enforceMutualExclusion}.
    const primary = this.#mode.primary;
    const inRowPopulated =
      (primary === 'row' && this.selected.size > 0) ||
      (primary === 'cell' && this.selectedCell !== null) ||
      (primary === 'range' && this.ranges.length > 0);

    // Mutual exclusion: in `bothAxes` mode, the user just mutated the in-row
    // axis (we know because `#buildEvent` is called from the in-row code paths
    // immediately after state changes) — so clear stale column selection. The
    // column-axis code paths call `#enforceMutualExclusion('column')`
    // explicitly BEFORE mutating; they then update `activeAxis` to 'column'
    // so the in-row state seen here is empty and this branch doesn't trigger.
    if (this.#mode.bothAxes && inRowPopulated && this.selectedColumns.size > 0) {
      this.selectedColumns.clear();
      this.columnAnchor = null;
      this.columnHead = null;
      if (this.gridElement) {
        announce(this.gridElement, getA11yMessage(this.gridElement, 'selectionAxisChanged', 'row'));
      }
    }

    let axis: SelectionAxis;
    if (inRowPopulated) {
      // In-row state always wins when populated — column-axis paths clear
      // in-row state via #enforceMutualExclusion before mutating columns.
      if (primary === 'row') axis = 'row';
      else if (primary === 'cell') axis = 'cell';
      else axis = 'range';
    } else if (this.selectedColumns.size > 0) {
      axis = 'column';
    } else {
      axis = 'none';
    }
    this.activeAxis = axis;

    const event = buildSelectionEvent(
      this.config.mode,
      axis,
      primary,
      {
        selectedCell: this.selectedCell,
        selected: this.selected,
        ranges: this.ranges,
        selectedColumns: this.selectedColumns,
      },
      this.columns.length,
    );
    // Debounced screen reader announcement for selection changes
    if (this.announceTimer) clearTimeout(this.announceTimer);
    this.announceTimer = setTimeout(() => {
      if (event.activeAxis === 'column') {
        const cols = event.selectedColumns;
        if (cols.length === 1) {
          const field = cols[0];
          const col = this.columns.find((c) => c.field === field);
          const label = (typeof col?.header === 'string' && col.header) || field;
          announce(this.gridElement, getA11yMessage(this.gridElement, 'columnSelected', label));
        } else if (cols.length > 1) {
          announce(this.gridElement, getA11yMessage(this.gridElement, 'columnSelectionChanged', cols.length));
        } else {
          announce(this.gridElement, getA11yMessage(this.gridElement, 'columnSelectionCleared'));
        }
      } else {
        const count = event.activeAxis === 'row' ? this.selected.size : event.ranges.length;
        if (count > 0) {
          announce(this.gridElement, getA11yMessage(this.gridElement, 'selectionChanged', count));
        }
      }
    }, 150);
    return event;
  }

  /**
   * Enforce row↔column mutual exclusion when both axes are configured
   * (`mode: ['row', 'column']` etc.). Call BEFORE mutating the destination
   * axis so its data won't be wiped along with the inactive axis.
   *
   * Single-string-mode configs are no-ops (the inactive axis can't have data
   * because there's no UI path to populate it). The in-row → column path is
   * called explicitly by the column-axis code; the column → in-row path is
   * handled automatically inside {@link #buildEvent} (which runs on every
   * in-row state change immediately before emitting).
   */
  #enforceMutualExclusion(toAxis: 'row' | 'cell' | 'range' | 'column'): void {
    if (!this.#mode.bothAxes) return;
    if (toAxis === 'column') {
      const hadInRow = this.selected.size > 0 || this.selectedCell !== null || this.ranges.length > 0;
      if (!hadInRow) return;
      this.selected.clear();
      this.lastSelected = null;
      this.anchor = null;
      this.selectedCell = null;
      this.ranges = [];
      this.activeRange = null;
      this.cellAnchor = null;
      if (this.gridElement) {
        announce(this.gridElement, getA11yMessage(this.gridElement, 'selectionAxisChanged', 'column'));
      }
    }
    // Column → in-row flip is handled inside #buildEvent (auto-detected by
    // observing populated in-row state with stale columns).
  }

  // #endregion
}
