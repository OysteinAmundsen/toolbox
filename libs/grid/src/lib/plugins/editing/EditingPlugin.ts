/**
 * Editing Plugin
 *
 * Provides complete editing functionality for tbw-grid.
 * This plugin is FULLY SELF-CONTAINED - the grid has ZERO editing knowledge.
 *
 * The plugin:
 * - Owns all editing state (active cell, snapshots, changed rows)
 * - Uses event distribution (onCellClick, onKeyDown) to handle edit lifecycle
 * - Uses afterRender() hook to inject editors into cells
 * - Uses processColumns() to augment columns with editing metadata
 * - Emits its own events (cell-commit, row-commit, changed-rows-reset)
 *
 * Without this plugin, the grid cannot edit. With this plugin, editing
 * is fully functional without any core changes.
 */

import { announce, getA11yMessage } from '../../core/internal/aria';
import { ensureCellVisible } from '../../core/internal/keyboard';
import type {
  AfterCellRenderContext,
  AfterRowRenderContext,
  PluginManifest,
  PluginQuery,
} from '../../core/plugin/base-plugin';
import { BaseGridPlugin, type CellClickEvent, type GridElement } from '../../core/plugin/base-plugin';
import type { ColumnConfig, GridHost, InternalGrid, RowElementInternal } from '../../core/types';
import styles from './editing.css?inline';
import { getInputValue } from './editors';
import { CellValidationManager } from './internal/cell-validation';
import { type BaselinesCapturedDetail, type DirtyChangeDetail, type DirtyRowEntry } from './internal/dirty-tracking';
import { DirtyTrackingManager } from './internal/dirty-tracking-manager';
import { type EditorInjectionDeps, injectEditor as injectEditorImpl } from './internal/editor-injection';
import {
  clearEditingState,
  FOCUSABLE_EDITOR_SELECTOR,
  hasRowChanged,
  isSafePropertyKey,
  noopUpdateRow,
  shouldPreventEditClose,
} from './internal/helpers';
import type {
  BeforeEditCloseDetail,
  CellCancelDetail,
  CellCommitDetail,
  ChangedRowsResetDetail,
  EditCloseDetail,
  EditingConfig,
  EditOpenDetail,
  RowCommitDetail,
} from './types';

// ============================================================================
// EditingPlugin
// ============================================================================

/**
 * Editing Plugin for tbw-grid
 *
 * Enables inline cell editing in the grid. Provides built-in editors for common data types
 * and supports custom editor functions for specialized input scenarios.
 *
 * ## Why Opt-In?
 *
 * Editing is delivered as a plugin rather than built into the core grid:
 *
 * - **Smaller bundle** — Apps that only display data don't pay for editing code
 * - **Clear intent** — Explicit plugin registration makes editing capability obvious
 * - **Runtime validation** — Using `editable: true` without the plugin throws a helpful error
 *
 * ## Installation
 *
 * ```ts
 * import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';
 * ```
 *
 * ## Edit Triggers
 *
 * Configure how editing is triggered with the `editOn` option:
 *
 * | Value | Behavior |
 * |-------|----------|
 * | `'click'` | Single click enters edit mode (default) |
 * | `'dblclick'` | Double-click enters edit mode |
 *
 * ## Keyboard Shortcuts
 *
 * | Key | Action |
 * |-----|--------|
 * | `Enter` | Commit edit and move down |
 * | `Tab` | Commit edit and move right |
 * | `Escape` | Cancel edit, restore original value |
 * | `Arrow Keys` | Navigate between cells (when not editing) |
 *
 * @example Basic editing with double-click trigger
 * ```ts
 * grid.gridConfig = {
 *   columns: [
 *     { field: 'name', editable: true },
 *     { field: 'price', type: 'number', editable: true },
 *     { field: 'active', type: 'boolean', editable: true },
 *   ],
 *   plugins: [new EditingPlugin({ editOn: 'dblclick' })],
 * };
 *
 * grid.on('cell-commit', ({ field, oldValue, newValue }) => {
 *   console.log(`${field}: ${oldValue} → ${newValue}`);
 * });
 * ```
 *
 * @example Custom editor function
 * ```ts
 * columns: [
 *   {
 *     field: 'status',
 *     editable: true,
 *     editor: (ctx) => {
 *       const select = document.createElement('select');
 *       ['pending', 'active', 'completed'].forEach(opt => {
 *         const option = document.createElement('option');
 *         option.value = opt;
 *         option.textContent = opt;
 *         option.selected = ctx.value === opt;
 *         select.appendChild(option);
 *       });
 *       select.addEventListener('change', () => ctx.commit(select.value));
 *       return select;
 *     },
 *   },
 * ]
 * ```
 *
 * @see {@link EditingConfig} for configuration options
 * @see {@link EditorContext} for custom editor context
 * @see {@link EditingConfig} for interactive examples in the docs site
 */
export class EditingPlugin<T = unknown> extends BaseGridPlugin<EditingConfig> {
  /**
   * Plugin manifest - declares owned properties for configuration validation.
   * @internal
   */
  static override readonly manifest: PluginManifest = {
    ownedProperties: [
      {
        property: 'editable',
        level: 'column',
        description: 'the "editable" column property',
        isUsed: (v) => v === true || typeof v === 'function',
      },
      {
        property: 'editor',
        level: 'column',
        description: 'the "editor" column property',
      },
      {
        property: 'editorParams',
        level: 'column',
        description: 'the "editorParams" column property',
      },
      {
        property: 'nullable',
        level: 'column',
        description: 'the "nullable" column property (allows null values)',
      },
    ],
    events: [
      {
        type: 'cell-edit-committed',
        description: 'Emitted when a cell edit is committed (for plugin-to-plugin coordination)',
      },
    ],
    queries: [
      {
        type: 'isEditing',
        description: 'Returns whether any cell is currently being edited',
      },
    ],
  };

  /** @internal */
  readonly name = 'editing';
  /** @internal */
  override readonly styles = styles;

  /** @internal */
  protected override get defaultConfig(): Partial<EditingConfig> {
    return {
      mode: 'row',
      editOn: 'click',
    };
  }

  /**
   * Whether the grid is in 'grid' mode (all cells always editable).
   */
  get #isGridMode(): boolean {
    return this.config.mode === 'grid';
  }

  /**
   * Resolve whether a given cell is editable.
   *
   * Resolution order:
   * 1. `gridConfig.rowEditable(row)` — row-level gate (if provided). Returns `false` → not editable.
   * 2. `column.editable` — `true`, `false`, or `(row) => boolean`.
   *
   * @returns `true` when the cell should be editable, `false` otherwise.
   */
  #isCellEditable(column: ColumnConfig<T>, row: T): boolean {
    // Row-level gate
    const rowEditable = this.#internalGrid.effectiveConfig?.rowEditable;
    if (rowEditable && !rowEditable(row as any)) return false;

    // Column-level check
    const { editable } = column;
    if (typeof editable === 'function') return editable(row);
    return editable === true;
  }

  /**
   * Check whether a column has ANY editability configured (static `true` or a
   * function). This is used for quick checks where no specific row is available
   * (e.g. "does this row have any potentially-editable columns?").
   */
  #hasEditableConfig(column: ColumnConfig<T>): boolean {
    return column.editable === true || typeof column.editable === 'function';
  }

  // #region Editing State (fully owned by plugin)

  /** Currently active edit row index, or -1 if not editing */
  #activeEditRow = -1;

  /** Row ID of the currently active edit row (stable across _rows replacement) */
  #activeEditRowId: string | undefined;

  /** Reference to the row object at edit-open time. Used as fallback in
   *  #exitRowEdit when no row ID is available (prevents stale-index access). */
  #activeEditRowRef: T | undefined;

  /** Currently active edit column index, or -1 if not editing */
  #activeEditCol = -1;

  /** Snapshots of row data before editing started */
  #rowEditSnapshots = new Map<number, T>();

  /** Set of cells currently in edit mode: "rowIndex:colIndex" */
  #editingCells = new Set<string>();

  /**
   * Value-change callbacks for active editors.
   * Keyed by "rowIndex:field" → callback that pushes updated values to the editor.
   * Populated during #injectEditor, cleaned up when editors are removed.
   */
  #editorValueCallbacks = new Map<string, (newValue: unknown) => void>();

  /** Flag to restore focus after next render (used when exiting edit mode) */
  #pendingFocusRestore = false;

  /** Row index pending animation after render, or -1 if none */
  #pendingRowAnimation = -1;

  /**
   * Cell validation manager — handles invalid-cell state tracking and DOM sync.
   * Initialized lazily in `attach()` since the sync callback needs grid access.
   */
  #validation!: CellValidationManager;

  /**
   * In grid mode, tracks whether an input field is currently focused.
   * When true: arrow keys work within input (edit mode).
   * When false: arrow keys navigate between cells (navigation mode).
   * Escape switches to navigation mode, Enter switches to edit mode.
   */
  #gridModeInputFocused = false;

  /**
   * In grid mode, when true, prevents inputs from auto-focusing.
   * This is set when Escape is pressed (navigation mode) and cleared
   * when Enter is pressed or user explicitly clicks an input.
   */
  #gridModeEditLocked = false;

  /**
   * When true, only a single cell is being edited (triggered by F2 or `beginCellEdit`).
   * Tab and Arrow keys commit and close the editor instead of navigating to adjacent cells.
   */
  #singleCellEdit = false;

  /**
   * In grid mode, snapshot of the focused cell's value when the editor first
   * receives focus. Used to revert on Escape (cell-level cancel).
   */
  #gridModeCellSnapshot: { rowIndex: number; colIndex: number; field: string; value: unknown } | null = null;

  // --- Dirty Tracking State (delegated to DirtyTrackingManager) ---

  /** Manages all dirty tracking state: baselines, changed/new/committed sets. */
  readonly #dirty = new DirtyTrackingManager<T>();

  // --- Editor Injection Deps (cached for #injectEditor delegation) ---

  /** Dependency bag created once in `attach()` and reused by every `#injectEditor` call. */
  #editorDeps!: EditorInjectionDeps<T>;

  /**
   * Typed accessor for `InternalGrid` — avoids repeating `as unknown as` at every call site.
   * Safe because `DataGridElement` implements `InternalGrid` at runtime.
   */
  get #internalGrid(): GridHost<T> {
    return this.grid as unknown as GridHost<T>;
  }

  // #endregion

  // #region Lifecycle

  /** @internal */
  override attach(grid: GridElement): void {
    super.attach(grid);

    const signal = this.disconnectSignal;
    const internalGrid = this.#internalGrid;

    // Initialize cell validation manager with DOM sync callback
    this.#validation = new CellValidationManager((rowId, field, invalid) => {
      this.#syncInvalidCellAttribute(rowId, field, invalid);
    });

    // Initialize editor injection deps (cached for all #injectEditor calls)
    this.#editorDeps = {
      grid: internalGrid,
      isGridMode: this.#isGridMode,
      config: this.config,
      editingCells: this.#editingCells,
      editorValueCallbacks: this.#editorValueCallbacks,
      isEditSessionActive: () => this.#activeEditRow !== -1,
      commitCellValue: (ri, col, val, row) => this.#commitCellValue(ri, col, val, row),
      exitRowEdit: (ri, revert) => this.#exitRowEdit(ri, revert),
    };

    // Inject editing state and methods onto grid for backward compatibility
    internalGrid._activeEditRows = -1;
    internalGrid._rowEditSnapshots = new Map();

    // Inject changedRows getter
    Object.defineProperty(grid, 'changedRows', {
      get: () => this.changedRows,
      configurable: true,
    });

    // Inject changedRowIds getter (new ID-based API)
    Object.defineProperty(grid, 'changedRowIds', {
      get: () => this.changedRowIds,
      configurable: true,
    });

    // Inject raw Set for O(1) lookup in the render hot path
    Object.defineProperty(grid, '_changedRowIdSet', {
      get: () => this.#dirty.changedRowIds,
      configurable: true,
    });

    // Inject resetChangedRows method
    (grid as any).resetChangedRows = (silent?: boolean) => this.resetChangedRows(silent);

    // Document-level Escape to cancel editing (only in 'row' mode)
    document.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        // In grid mode, Escape doesn't exit edit mode
        if (this.#isGridMode) return;
        if (e.key === 'Escape' && this.#activeEditRow !== -1) {
          if (shouldPreventEditClose(this.config, e)) return;
          this.#exitRowEdit(this.#activeEditRow, true);
        }
      },
      { capture: true, signal },
    );

    // Click outside to commit editing (only in 'row' mode)
    // Use queueMicrotask to allow pending change events to fire first.
    // This is important for Angular/React editors where the (change) event
    // fires after mousedown but before mouseup/click.
    document.addEventListener(
      'mousedown',
      (e: MouseEvent) => {
        // In grid mode, clicking outside doesn't exit edit mode
        if (this.#isGridMode) return;
        if (this.#activeEditRow === -1) return;
        const rowEl = internalGrid.findRenderedRowElement?.(this.#activeEditRow);
        if (!rowEl) return;
        const path = (e.composedPath && e.composedPath()) || [];
        if (path.includes(rowEl)) return;

        // Check if click is inside a registered external focus container
        // (e.g., overlays, datepickers, dropdowns at <body> level).
        // Only check targets OUTSIDE the grid — clicks on other rows inside
        // the grid should still commit the active edit row.
        const target = e.target as Node | null;
        if (target && !this.gridElement.contains(target) && this.grid.containsFocus?.(target)) {
          return;
        }

        if (shouldPreventEditClose(this.config, e)) return;

        // Delay exit to allow pending change/commit events to fire
        queueMicrotask(() => {
          if (this.#activeEditRow !== -1) {
            this.#exitRowEdit(this.#activeEditRow, false);
          }
        });
      },
      { signal },
    );

    // Focus trap: when enabled, prevent focus from leaving the grid
    // while a row is being edited. If focus moves outside the grid
    // (and its registered external containers), reclaim it.
    if (this.config.focusTrap) {
      this.gridElement.addEventListener(
        'focusout',
        (e: FocusEvent) => {
          // Only trap in row mode when actively editing
          if (this.#isGridMode) return;
          if (this.#activeEditRow === -1) return;

          const related = e.relatedTarget as Node | null;
          // If focus is going to an external container, that's fine
          if (related && this.grid.containsFocus?.(related)) return;
          // If focus is going to another element inside the grid, allow it
          if (related && this.gridElement.contains(related)) return;

          // Focus left the grid entirely — reclaim it
          queueMicrotask(() => {
            // Re-check in case editing was committed in the meantime
            if (this.#activeEditRow === -1) return;
            this.#focusCurrentCellEditor();
          });
        },
        { signal },
      );
    }

    // Listen for external row mutations to push updated values to active editors.
    // When field A commits and sets field B via updateRow(), field B's editor
    // (if open) must reflect the new value.
    this.gridElement.addEventListener(
      'cell-change',
      (e: Event) => {
        const detail = (e as CustomEvent).detail as {
          rowIndex: number;
          field: string;
          newValue: unknown;
          source: string;
        };
        // Only push updates from cascade/api sources — not from the editor's own commit
        if (detail.source === 'user') return;
        const key = `${detail.rowIndex}:${detail.field}`;
        const cb = this.#editorValueCallbacks.get(key);
        if (cb) cb(detail.newValue);
      },
      { signal },
    );

    // --- Dirty tracking: listen for undo/redo events to re-evaluate dirty state ---
    if (this.config.dirtyTracking) {
      const handleUndoRedo = (e: Event) => {
        const detail = (e as CustomEvent).detail as { action?: { rowIndex: number; field: string } };
        const action = detail?.action;
        if (!action) return;
        const row = this.rows[action.rowIndex] as T | undefined;
        if (!row) return;
        const rowId = this.grid.getRowId(row);
        if (!rowId) return;
        const dirty = this.#dirty.isRowDirty(rowId, row);
        this.emit<DirtyChangeDetail<T>>('dirty-change', {
          rowId,
          row,
          original: this.#dirty.getOriginalRow(rowId),
          type: dirty ? 'modified' : 'pristine',
        });
      };
      this.gridElement.addEventListener('undo', handleUndoRedo, { signal });
      this.gridElement.addEventListener('redo', handleUndoRedo, { signal });

      // Listen for row-inserted events to auto-mark new rows for dirty tracking
      this.on('row-inserted', (detail: { row: T; index: number }) => {
        const rowId = this.grid.getRowId(detail.row);
        if (rowId != null) {
          this.markAsNew(String(rowId));
        }
      });
    }

    // In grid mode, request a full render to trigger afterCellRender hooks
    if (this.#isGridMode) {
      internalGrid._isGridEditMode = true;
      this.gridElement.classList.add('tbw-grid-mode');
      this.requestRender();

      // Track focus/blur on inputs to maintain navigation vs edit mode state
      this.gridElement.addEventListener(
        'focusin',
        (e: FocusEvent) => {
          const target = e.target as HTMLElement;
          // Ignore focus on the grid element itself — it has tabindex=0 so it
          // matches FOCUSABLE_EDITOR_SELECTOR, but blurring + re-focusing it
          // would cause infinite recursion.
          if (target === this.gridElement) return;
          if (target.matches(FOCUSABLE_EDITOR_SELECTOR)) {
            // If edit is locked (navigation mode), blur the input immediately
            if (this.#gridModeEditLocked) {
              target.blur();
              this.gridElement.focus();
              return;
            }

            // Snapshot cell value on initial focus or when moving to a different cell.
            // This allows Escape to revert the cell to its pre-edit value.
            const focusRow = internalGrid._focusRow;
            const focusCol = internalGrid._focusCol;
            const snap = this.#gridModeCellSnapshot;
            if (!snap || snap.rowIndex !== focusRow || snap.colIndex !== focusCol) {
              const column = internalGrid._visibleColumns?.[focusCol];
              const rowData = internalGrid._rows?.[focusRow];
              if (column?.field && rowData) {
                const field = column.field as string;
                this.#gridModeCellSnapshot = {
                  rowIndex: focusRow,
                  colIndex: focusCol,
                  field,
                  value: (rowData as Record<string, unknown>)[field],
                };
              }
            }

            this.#gridModeInputFocused = true;
          }
        },
        { signal },
      );

      this.gridElement.addEventListener(
        'focusout',
        (e: FocusEvent) => {
          const related = e.relatedTarget as HTMLElement | null;
          // Only clear if focus went outside grid (and external containers) or to a non-input element
          if (
            !related ||
            (!this.gridElement.contains(related) && !this.grid.containsFocus?.(related)) ||
            !related.matches(FOCUSABLE_EDITOR_SELECTOR)
          ) {
            this.#gridModeInputFocused = false;
            // Clear cell snapshot when leaving edit mode normally (not via Escape)
            this.#gridModeCellSnapshot = null;
          }
        },
        { signal },
      );

      // Handle Escape key directly on the grid element (capture phase)
      // This ensures we intercept Escape even when focus is inside an input
      this.gridElement.addEventListener(
        'keydown',
        (e: KeyboardEvent) => {
          if (e.key === 'Escape' && this.#gridModeInputFocused) {
            // Check onBeforeEditClose to let overlays close first.
            if (shouldPreventEditClose(this.config, e)) {
              // Overlay is open — schedule deferred nav-mode transition
              // after the overlay tears down.
              queueMicrotask(() => {
                if (this.#gridModeInputFocused) {
                  this.#revertGridModeCellEdit();
                  const activeEl = document.activeElement as HTMLElement;
                  if (activeEl && this.gridElement.contains(activeEl)) {
                    activeEl.blur();
                    this.gridElement.focus();
                  }
                  this.#gridModeInputFocused = false;
                  this.#gridModeEditLocked = true;
                }
              });
              return;
            }
            // Revert cell value to pre-edit snapshot
            this.#revertGridModeCellEdit();

            const activeEl = document.activeElement as HTMLElement;
            if (activeEl && this.gridElement.contains(activeEl)) {
              activeEl.blur();
              // Move focus to the grid container so arrow keys work
              this.gridElement.focus();
            }
            this.#gridModeInputFocused = false;
            this.#gridModeEditLocked = true; // Lock edit mode until Enter/click
            e.preventDefault();
            e.stopPropagation();
          }
        },
        { capture: true, signal },
      );

      // Handle click on inputs - unlock edit mode when user explicitly clicks
      this.gridElement.addEventListener(
        'mousedown',
        (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          if (target.matches(FOCUSABLE_EDITOR_SELECTOR)) {
            this.#gridModeEditLocked = false; // User clicked input - allow edit
          }
        },
        { signal },
      );
    }
  }

  /** @internal */
  override detach(): void {
    const internalGrid = this.#internalGrid;
    internalGrid._isGridEditMode = false;
    this.gridElement.classList.remove('tbw-grid-mode');
    this.#activeEditRow = -1;
    this.#activeEditRowId = undefined;
    this.#activeEditRowRef = undefined;
    this.#activeEditCol = -1;
    this.#rowEditSnapshots.clear();
    this.#dirty.clear();
    this.#editingCells.clear();
    this.#editorValueCallbacks.clear();
    this.#gridModeInputFocused = false;
    this.#gridModeEditLocked = false;
    this.#gridModeCellSnapshot = null;
    this.#singleCellEdit = false;
    super.detach();
  }

  /**
   * Handle plugin queries.
   * @internal
   */
  override handleQuery(query: PluginQuery): unknown {
    if (query.type === 'isEditing') {
      // In grid mode, we're always editing
      return this.#isGridMode || this.#activeEditRow !== -1;
    }
    return undefined;
  }

  // #endregion

  // #region Event Handlers (event distribution)

  /**
   * Handle cell clicks - start editing if configured for click mode.
   * Both click and dblclick events come through this handler.
   * Starts row-based editing (all editable cells in the row get editors).
   * @internal
   */
  override onCellClick(event: CellClickEvent): boolean | void {
    // In grid mode, all cells are already editable - no need to trigger row edit
    if (this.#isGridMode) return false;

    const internalGrid = this.#internalGrid;
    const editOn = this.config.editOn ?? internalGrid.effectiveConfig?.editOn;

    // Check if editing is disabled
    if (editOn === false || editOn === 'manual') return false;

    // Check if this is click or dblclick mode
    if (editOn !== 'click' && editOn !== 'dblclick') return false;

    // Check if the event type matches the edit mode
    const isDoubleClick = event.originalEvent.type === 'dblclick';
    if (editOn === 'click' && isDoubleClick) return false; // In click mode, only handle single clicks
    if (editOn === 'dblclick' && !isDoubleClick) return false; // In dblclick mode, only handle double clicks

    const { rowIndex } = event;

    // Check if any column in the row is potentially editable
    const hasEditableColumn = internalGrid._columns?.some((col) => this.#hasEditableConfig(col as ColumnConfig<T>));
    if (!hasEditableColumn) return false;

    // Row-level gate
    const rowData = internalGrid._rows[rowIndex];
    const rowEditable = internalGrid.effectiveConfig?.rowEditable;
    if (rowData && rowEditable && !rowEditable(rowData as any)) return false;

    // Start row-based editing (all editable cells get editors)
    event.originalEvent.stopPropagation();
    this.beginBulkEdit(rowIndex);
    return true; // Handled
  }

  /**
   * Handle keyboard events for edit lifecycle.
   * @internal
   */
  override onKeyDown(event: KeyboardEvent): boolean | void {
    const internalGrid = this.#internalGrid;

    // Escape: cancel current edit (row mode) or exit edit mode (grid mode)
    if (event.key === 'Escape') {
      // In grid mode: revert cell, blur input, enter navigation mode.
      // NOTE: No onBeforeEditClose check here — the capture-phase handler
      // is the authoritative overlay guard. If the event reaches this
      // bubble-phase handler, either:
      //   a) the capture handler already bailed (overlay was open) and the
      //      template handler (e.g. select.close()) addressed it, or
      //   b) no overlay was open.
      // In both cases we should transition to navigation mode.
      if (this.#isGridMode && this.#gridModeInputFocused) {
        // Revert cell value to pre-edit snapshot
        this.#revertGridModeCellEdit();

        const activeEl = document.activeElement as HTMLElement;
        if (activeEl && this.gridElement.contains(activeEl)) {
          activeEl.blur();
          // Move focus to the grid so arrow keys navigate cells, not the editor
          this.gridElement.focus();
        }
        this.#gridModeInputFocused = false;
        this.#gridModeEditLocked = true; // Lock until Enter/click re-enables editing
        // Update focus styling
        this.requestAfterRender();
        return true;
      }

      // In row mode: cancel edit
      if (this.#activeEditRow !== -1 && !this.#isGridMode) {
        if (shouldPreventEditClose(this.config, event)) return true;
        this.#exitRowEdit(this.#activeEditRow, true);
        return true;
      }
    }

    // Arrow keys in grid mode when not editing input: navigate cells
    if (
      this.#isGridMode &&
      !this.#gridModeInputFocused &&
      (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight')
    ) {
      // Let the grid's default keyboard navigation handle this
      return false;
    }

    // Arrow Up/Down in grid mode when input is focused: let the editor handle it
    // (e.g., ArrowDown opens autocomplete/datepicker overlays, ArrowUp/Down navigates options)
    if (this.#isGridMode && this.#gridModeInputFocused && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      return true; // Handled: block grid navigation, let event reach editor
    }

    // Arrow Up/Down while editing: commit and exit edit mode, move to adjacent row (only in 'row' mode)
    if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && this.#activeEditRow !== -1 && !this.#isGridMode) {
      if (shouldPreventEditClose(this.config, event)) return true;

      const maxRow = internalGrid._rows.length - 1;
      const currentRow = this.#activeEditRow;

      // Commit the current edit
      this.#exitRowEdit(currentRow, false);

      // Move focus to adjacent row (same column)
      if (event.key === 'ArrowDown') {
        internalGrid._focusRow = Math.min(maxRow, internalGrid._focusRow + 1);
      } else {
        internalGrid._focusRow = Math.max(0, internalGrid._focusRow - 1);
      }

      event.preventDefault();
      // Ensure the focused cell is scrolled into view
      ensureCellVisible(internalGrid);
      // Request render to update focus styling
      this.requestAfterRender();
      return true;
    }

    // Tab/Shift+Tab while editing: move to next/prev editable cell
    if (event.key === 'Tab' && (this.#activeEditRow !== -1 || this.#isGridMode)) {
      event.preventDefault();

      // In single-cell edit mode (F2), commit and close instead of navigating
      if (this.#singleCellEdit) {
        this.#exitRowEdit(this.#activeEditRow, false);
        return true;
      }

      const forward = !event.shiftKey;
      this.#handleTabNavigation(forward);
      return true;
    }

    // Space: toggle boolean cells (only when not in edit mode - let editors handle their own space)
    if (event.key === ' ' || event.key === 'Spacebar') {
      // If we're in row edit mode, let the event pass through to the editor (e.g., checkbox)
      if (this.#activeEditRow !== -1) {
        return false;
      }

      const focusRow = internalGrid._focusRow;
      const focusCol = internalGrid._focusCol;
      if (focusRow >= 0 && focusCol >= 0) {
        const column = internalGrid._visibleColumns[focusCol];
        const rowData = internalGrid._rows[focusRow];
        if (
          column &&
          rowData &&
          this.#isCellEditable(column as ColumnConfig<T>, rowData as T) &&
          column.type === 'boolean'
        ) {
          const field = column.field;
          if (isSafePropertyKey(field)) {
            const currentValue = (rowData as Record<string, unknown>)[field];
            const newValue = !currentValue;
            this.#commitCellValue(focusRow, column, newValue, rowData);
            event.preventDefault();
            // Re-render to update the UI
            this.requestRender();
            return true;
          }
        }
      }
      // Space on non-boolean cell - don't block keyboard navigation
      return false;
    }

    // Enter (unmodified): start row edit, commit, or enter edit mode in grid mode
    if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
      // In grid mode when not editing: focus the current cell's input
      if (this.#isGridMode && !this.#gridModeInputFocused) {
        this.#focusCurrentCellEditor();
        return true;
      }

      if (this.#activeEditRow !== -1) {
        if (shouldPreventEditClose(this.config, event)) return true;
        // Already editing - let cell handlers deal with it
        return false;
      }

      // Start row-based editing (not just the focused cell)
      const editOn = this.config.editOn ?? internalGrid.effectiveConfig?.editOn;
      if (editOn === false || editOn === 'manual') return false;

      const focusRow = internalGrid._focusRow;
      const focusCol = internalGrid._focusCol;
      if (focusRow >= 0) {
        // Check if ANY column in the row is potentially editable
        const hasEditableColumn = internalGrid._columns?.some((col) => this.#hasEditableConfig(col as ColumnConfig<T>));
        // Row-level gate
        const rowData = internalGrid._rows[focusRow];
        const rowEditable = internalGrid.effectiveConfig?.rowEditable;
        const rowBlocked = rowData && rowEditable && !rowEditable(rowData as any);
        if (hasEditableColumn && !rowBlocked) {
          // Emit cell-activate event BEFORE starting edit
          // This ensures consumers always get the activation event
          const column = internalGrid._visibleColumns[focusCol];
          const row = internalGrid._rows[focusRow];
          const field = column?.field ?? '';
          const value = field && row ? (row as Record<string, unknown>)[field] : undefined;
          const cellEl = this.gridElement.querySelector(`[data-row="${focusRow}"][data-col="${focusCol}"]`) as
            | HTMLElement
            | undefined;

          const activateEvent = new CustomEvent('cell-activate', {
            cancelable: true,
            bubbles: true,
            detail: {
              rowIndex: focusRow,
              colIndex: focusCol,
              field,
              value,
              row,
              cellEl,
              trigger: 'keyboard' as const,
              originalEvent: event,
            },
          });
          this.gridElement.dispatchEvent(activateEvent);

          // If consumer canceled the activation, don't start editing
          if (activateEvent.defaultPrevented) {
            event.preventDefault();
            return true;
          }

          this.beginBulkEdit(focusRow);
          return true;
        }
      }
      // No editable columns - don't block keyboard navigation
      return false;
    }

    // F2: begin single-cell edit on the focused cell
    if (event.key === 'F2') {
      if (this.#activeEditRow !== -1 || this.#isGridMode) return false;

      const editOn = this.config.editOn ?? internalGrid.effectiveConfig?.editOn;
      if (editOn === false) return false;

      const focusRow = internalGrid._focusRow;
      const focusCol = internalGrid._focusCol;
      if (focusRow >= 0 && focusCol >= 0) {
        const column = internalGrid._visibleColumns[focusCol];
        const rowData = internalGrid._rows[focusRow];
        if (column && rowData && this.#isCellEditable(column as ColumnConfig<T>, rowData as T) && column.field) {
          event.preventDefault();
          this.beginCellEdit(focusRow, column.field);
          return true;
        }
      }
      return false;
    }

    // Don't block other keyboard events
    return false;
  }

  // #endregion

  // #region Render Hooks

  /**
   * Process columns to merge type-level editorParams with column-level.
   * Column-level params take precedence.
   * @internal
   */
  override processColumns(columns: ColumnConfig<T>[]): ColumnConfig<T>[] {
    const internalGrid = this.#internalGrid;
    const typeDefaults = (internalGrid as any).effectiveConfig?.typeDefaults;
    const adapter = internalGrid.__frameworkAdapter;

    // If no type defaults configured anywhere, skip processing
    if (!typeDefaults && !adapter?.getTypeDefault) return columns;

    return columns.map((col) => {
      if (!col.type) return col;

      // Get type-level editorParams
      let typeEditorParams: Record<string, unknown> | undefined;

      // Check grid-level typeDefaults first
      if (typeDefaults?.[col.type]?.editorParams) {
        typeEditorParams = typeDefaults[col.type].editorParams;
      }

      // Then check app-level (adapter) typeDefaults
      if (!typeEditorParams && adapter?.getTypeDefault) {
        const appDefault = adapter.getTypeDefault<T>(col.type, internalGrid._hostElement);
        if (appDefault?.editorParams) {
          typeEditorParams = appDefault.editorParams;
        }
      }

      // No type-level params to merge
      if (!typeEditorParams) return col;

      // Merge: type-level as base, column-level wins on conflicts
      return {
        ...col,
        editorParams: { ...typeEditorParams, ...col.editorParams },
      };
    });
  }

  /**
   * Stabilize the actively edited row across `rows` array replacements and
   * capture dirty tracking baselines.
   *
   * **Editing stability:** When the consumer reassigns `grid.rows` while
   * editing, the full pipeline (sort, filter, group) runs on the new data.
   * This hook finds the edited row in the new array by ID and swaps in the
   * in-progress row reference (`#activeEditRowRef`) so editors survive.
   *
   * **Dirty tracking baselines:** When `dirtyTracking` is enabled, captures
   * a `structuredClone` snapshot of each row on first appearance
   * (first-write-wins). This prevents Angular's feedback loop from
   * overwriting baselines.
   *
   * @internal Plugin API — part of the render pipeline
   */
  override processRows(rows: readonly T[]): T[] {
    const internalGrid = this.#internalGrid;

    // --- Dirty tracking: capture baselines (first-write-wins) ---
    if (this.config.dirtyTracking && internalGrid.getRowId) {
      this.#dirty.capture(rows, (r) => {
        try {
          return internalGrid.getRowId?.(r);
        } catch {
          return undefined;
        }
      });
    }

    // --- Editing stability: swap in the in-progress row ---
    if (this.#activeEditRow === -1 || this.#isGridMode) return rows as T[];

    const editRowId = this.#activeEditRowId;
    const editRowRef = this.#activeEditRowRef;

    // Without a stable row ID we cannot match across array replacements
    if (!editRowId || !editRowRef) return rows as T[];

    const result = [...rows] as T[];

    // Find the edited row's new position by ID
    let newIndex = -1;
    for (let i = 0; i < result.length; i++) {
      try {
        if (internalGrid.getRowId?.(result[i]) === editRowId) {
          newIndex = i;
          break;
        }
      } catch {
        // Row has no ID — skip
      }
    }

    if (newIndex === -1) {
      // Row was deleted server-side — close the editor.
      // Cannot close synchronously during the processRows pipeline;
      // schedule for after the current render cycle completes.
      setTimeout(() => this.cancelActiveRowEdit(), 0);
      return result;
    }

    // Swap in the in-progress row data to preserve editor state
    result[newIndex] = editRowRef;

    // Update index-keyed state if the position changed (due to sort/filter)
    if (this.#activeEditRow !== newIndex) {
      this.#migrateEditRowIndex(this.#activeEditRow, newIndex);
    }

    return result;
  }

  /**
   * After render, reapply editors to cells in edit mode.
   * This handles virtualization - when a row scrolls back into view,
   * we need to re-inject the editor.
   * @internal
   */
  override afterRender(): void {
    const internalGrid = this.#internalGrid;

    // --- Editing stability: verify active edit row index ---
    // After processRows, subsequent plugins (filtering, grouping) may have
    // shifted row indices. Verify the index is still correct and fix if needed
    // before re-injecting editors.
    if (this.#activeEditRow !== -1 && this.#activeEditRowRef && !this.#isGridMode) {
      if (internalGrid._rows[this.#activeEditRow] !== this.#activeEditRowRef) {
        const newIndex = (internalGrid._rows as T[]).indexOf(this.#activeEditRowRef);
        if (newIndex !== -1) {
          this.#migrateEditRowIndex(this.#activeEditRow, newIndex);
        } else {
          // Row no longer in rendered set (filtered out or deleted)
          setTimeout(() => this.cancelActiveRowEdit(), 0);
          return;
        }
      }
    }

    // Restore focus after exiting edit mode
    if (this.#pendingFocusRestore) {
      this.#pendingFocusRestore = false;
      this.#restoreCellFocus(internalGrid);
    }

    // Animate the row after render completes (so the row element exists)
    if (this.#pendingRowAnimation !== -1) {
      const rowIndex = this.#pendingRowAnimation;
      this.#pendingRowAnimation = -1;
      internalGrid.animateRow?.(rowIndex, 'change');
    }

    // Emit baselines-captured event when new baselines were captured this cycle.
    // Emitted post-render so consumers can safely read grid.rows, query the DOM,
    // or call getOriginalRow() in their handler.
    const capturedCount = this.#dirty.drainCapturedFlag();
    if (capturedCount != null) {
      this.emit<BaselinesCapturedDetail>('baselines-captured', {
        count: capturedCount,
      });
    }

    // In 'grid' mode, editors are injected via afterCellRender hook during render
    if (this.#isGridMode) return;

    if (this.#editingCells.size === 0) return;

    // Re-inject editors for any editing cells that are visible
    for (const cellKey of this.#editingCells) {
      const [rowStr, colStr] = cellKey.split(':');
      const rowIndex = parseInt(rowStr, 10);
      const colIndex = parseInt(colStr, 10);

      const rowEl = internalGrid.findRenderedRowElement?.(rowIndex);
      if (!rowEl) continue;

      const cellEl = rowEl.querySelector(`.cell[data-col="${colIndex}"]`) as HTMLElement | null;
      if (!cellEl || cellEl.classList.contains('editing')) continue;

      // Cell is visible but not in editing mode - reinject editor
      const rowData = internalGrid._rows[rowIndex];
      const column = internalGrid._visibleColumns[colIndex];
      if (rowData && column) {
        this.#injectEditor(rowData, rowIndex, column, colIndex, cellEl, true);
      }
    }
  }

  /**
   * Hook called after each cell is rendered.
   * In grid mode, injects editors into editable cells during render (no DOM queries needed).
   * @internal
   */
  override afterCellRender(context: AfterCellRenderContext): void {
    const { row, rowIndex, column, colIndex, cellElement } = context;

    const editable = this.#isCellEditable(column as ColumnConfig<T>, row as T);

    // Set aria-readonly on non-editable cells so screen readers can distinguish
    if (!editable) {
      cellElement.setAttribute('aria-readonly', 'true');
      // In grid mode, tear down stale editors on cells that are no longer editable
      // (e.g., after virtualization recycles a row element for different row data)
      if (this.#isGridMode && cellElement.classList.contains('editing')) {
        cellElement.classList.remove('editing');
        const value = (row as Record<string, unknown>)[(column as ColumnConfig<T>).field as string];
        cellElement.textContent = value == null ? '' : String(value);
      }
    } else {
      cellElement.removeAttribute('aria-readonly');
    }

    // Only inject editors in grid mode
    if (!this.#isGridMode) return;

    // Skip non-editable cells
    if (!editable) return;

    // Skip if already has editor
    if (cellElement.classList.contains('editing')) return;

    // Inject editor (don't track in editingCells - we're always editing in grid mode)
    // Pass rowElement so incrementEditingCount works even when cell is in a DocumentFragment
    this.#injectEditor(row as T, rowIndex, column as ColumnConfig<T>, colIndex, cellElement, true, context.rowElement);
  }

  /**
   * Apply dirty-tracking CSS classes to each rendered row.
   *
   * - `tbw-cell-dirty` on individual cells whose value differs from baseline
   *   (applied on cell-commit, visible during editing)
   * - `tbw-row-dirty` on the row element only after the row edit session is
   *   committed (edit-close without cancel)
   * - `tbw-row-new` when a row was inserted via `insertRow()` with no baseline
   *
   * Only active when `dirtyTracking: true`.
   *
   * @internal Plugin API
   */
  override afterRowRender(context: AfterRowRenderContext): void {
    if (!this.config.dirtyTracking) return;

    const internalGrid = this.#internalGrid;
    const rowId = internalGrid.getRowId?.(context.row as T);
    if (!rowId) return;

    const { isNew, isCommittedDirty, hasBaseline } = this.#dirty.getRowDirtyState(rowId, context.row as T);

    const el = context.rowElement;

    // Row-level classes (tbw-row-dirty only after row-commit AND data differs)
    el.classList.toggle('tbw-row-dirty', isCommittedDirty);
    el.classList.toggle('tbw-row-new', isNew);

    // Cell-level classes (tbw-cell-dirty on individual cells with changed values)
    // Only run the per-cell loop when the row has a baseline — avoids
    // querySelectorAll on the hot path for rows without dirty tracking state.
    if (hasBaseline) {
      const cells = el.querySelectorAll('.cell[data-field]');
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i] as HTMLElement;
        const field = cell.getAttribute('data-field');
        if (field) {
          cell.classList.toggle('tbw-cell-dirty', this.#dirty.isCellDirty(rowId, context.row as T, field));
        }
      }
    } else {
      // Clean up stale tbw-cell-dirty classes on recycled row elements
      // that previously displayed a dirty row but now show a pristine one.
      const dirtyCells = el.querySelectorAll('.tbw-cell-dirty');
      for (let i = 0; i < dirtyCells.length; i++) {
        dirtyCells[i].classList.remove('tbw-cell-dirty');
      }
    }
  }

  /**
   * On scroll render, reapply editors to recycled cells.
   * @internal
   */
  override onScrollRender(): void {
    this.afterRender();
  }

  // #endregion

  // #region Public API

  /**
   * Get all rows that have been modified.
   * Uses ID-based lookup for stability when rows are reordered.
   */
  get changedRows(): T[] {
    return this.#dirty.getChangedRows((id) => this.grid.getRow(id) as T | undefined);
  }

  /**
   * Get IDs of all modified rows.
   */
  get changedRowIds(): string[] {
    return this.#dirty.getChangedRowIds();
  }

  /**
   * Get the currently active edit row index, or -1 if not editing.
   */
  get activeEditRow(): number {
    return this.#activeEditRow;
  }

  /**
   * Get the currently active edit column index, or -1 if not editing.
   */
  get activeEditCol(): number {
    return this.#activeEditCol;
  }

  /**
   * Check if a specific row is currently being edited.
   */
  isRowEditing(rowIndex: number): boolean {
    return this.#activeEditRow === rowIndex;
  }

  /**
   * Check if a specific cell is currently being edited.
   */
  isCellEditing(rowIndex: number, colIndex: number): boolean {
    return this.#editingCells.has(`${rowIndex}:${colIndex}`);
  }

  /**
   * Check if a specific row has been modified.
   * @param rowIndex - Row index to check (will be converted to ID internally)
   */
  isRowChanged(rowIndex: number): boolean {
    const internalGrid = this.#internalGrid;
    const row = internalGrid._rows[rowIndex];
    if (!row) return false;
    try {
      const rowId = internalGrid.getRowId?.(row);
      return rowId ? this.#dirty.isRowChanged(rowId) : false;
    } catch {
      return false;
    }
  }

  /**
   * Check if a row with the given ID has been modified.
   * @param rowId - Row ID to check
   */
  isRowChangedById(rowId: string): boolean {
    return this.#dirty.isRowChanged(rowId);
  }

  // #region Dirty Tracking API (delegated to DirtyTrackingManager)

  /** Check if a row differs from its baseline. Requires `dirtyTracking: true`. */
  isDirty(rowId: string): boolean {
    if (!this.config.dirtyTracking) return false;
    if (this.#dirty.newRowIds.has(rowId)) return true;
    const row = this.grid.getRow(rowId) as T | undefined;
    if (!row) return false;
    return this.#dirty.isRowDirty(rowId, row);
  }

  /** Inverse of `isDirty`. */
  isPristine(rowId: string): boolean {
    return !this.isDirty(rowId);
  }

  /** Whether any row in the grid is dirty. */
  get dirty(): boolean {
    if (!this.config.dirtyTracking) return false;
    const internalGrid = this.#internalGrid;
    return this.#dirty.hasAnyDirty((rowId) => internalGrid._getRowEntry(rowId)?.row as T | undefined);
  }

  /** Whether all rows are pristine. */
  get pristine(): boolean {
    return !this.dirty;
  }

  /** Re-snapshot baseline from current data (call after a successful save). */
  markAsPristine(rowId: string): void {
    if (!this.config.dirtyTracking) return;
    const row = this.grid.getRow(rowId) as T | undefined;
    if (!row) return;
    this.#dirty.markPristine(rowId, row);
    this.emit<DirtyChangeDetail<T>>('dirty-change', {
      rowId,
      row,
      original: row, // after mark-pristine, original === current
      type: 'pristine',
    });
  }

  /** Mark a row as new (auto-called by `insertRow()` when dirty tracking is on). */
  markAsNew(rowId: string): void {
    if (!this.config.dirtyTracking) return;
    this.#dirty.markNew(rowId);
    const row = this.grid.getRow(rowId) as T | undefined;
    this.emit<DirtyChangeDetail<T>>('dirty-change', {
      rowId,
      row: row as T,
      original: undefined,
      type: 'new',
    });
  }

  /** Mark a row as dirty after an external mutation that bypassed the editing pipeline. */
  markAsDirty(rowId: string): void {
    if (!this.config.dirtyTracking) return;
    const row = this.grid.getRow(rowId) as T | undefined;
    if (!row) return;
    this.#dirty.markDirty(rowId);
    this.emit<DirtyChangeDetail<T>>('dirty-change', {
      rowId,
      row,
      original: this.#dirty.getOriginalRow(rowId),
      type: 'modified',
    });
  }

  /** Mark all tracked rows as pristine (call after a batch save). */
  markAllPristine(): void {
    if (!this.config.dirtyTracking) return;
    const internalGrid = this.#internalGrid;
    this.#dirty.markAllPristine((rowId) => internalGrid._getRowEntry(rowId)?.row as T | undefined);
  }

  /** Get a deep clone of the original (baseline) row data. Returns `undefined` for new rows. */
  getOriginalRow(rowId: string): T | undefined {
    if (!this.config.dirtyTracking) return undefined;
    return this.#dirty.getOriginalRow(rowId);
  }

  /** Lightweight check for whether a baseline exists (no cloning). */
  hasBaseline(rowId: string): boolean {
    if (!this.config.dirtyTracking) return false;
    return this.#dirty.hasBaseline(rowId);
  }

  /** Get all dirty rows with their original and current data. */
  getDirtyRows(): DirtyRowEntry<T>[] {
    if (!this.config.dirtyTracking) return [];
    const internalGrid = this.#internalGrid;
    return this.#dirty.getDirtyRows((rowId) => internalGrid._getRowEntry(rowId)?.row as T | undefined);
  }

  /**
   * Get IDs of all dirty rows.
   */
  get dirtyRowIds(): string[] {
    if (!this.config.dirtyTracking) return [];
    const internalGrid = this.#internalGrid;
    return this.#dirty.getDirtyRowIds((rowId) => internalGrid._getRowEntry(rowId)?.row as T | undefined);
  }

  /**
   * Revert a row to its baseline values (mutates the current row in-place).
   * Triggers a re-render.
   *
   * @param rowId - Row ID (from `getRowId`)
   */
  revertRow(rowId: string): void {
    if (!this.config.dirtyTracking) return;
    const row = this.grid.getRow(rowId) as T | undefined;
    if (!row) return;
    if (this.#dirty.revertRow(rowId, row)) {
      this.emit<DirtyChangeDetail<T>>('dirty-change', {
        rowId,
        row,
        original: this.#dirty.getOriginalRow(rowId),
        type: 'reverted',
      });
      this.requestRender();
    }
  }

  /**
   * Revert all dirty rows to their baseline values and re-render.
   */
  revertAll(): void {
    if (!this.config.dirtyTracking) return;
    const internalGrid = this.#internalGrid;
    this.#dirty.revertAll((rowId) => internalGrid._getRowEntry(rowId)?.row as T | undefined);
    this.requestRender();
  }

  // #endregion

  // #region Cell Validation (delegated to CellValidationManager)

  /**
   * Mark a cell as invalid with an optional validation message.
   * Invalid cells are marked with a `data-invalid` attribute for styling.
   *
   * @param rowId - The row ID (from getRowId)
   * @param field - The field name
   * @param message - Optional validation message (for tooltips or display)
   *
   * @example
   * ```typescript
   * // In cell-commit handler:
   * grid.on('cell-commit', (detail, e) => {
   *   if (detail.field === 'email' && !isValidEmail(detail.value)) {
   *     detail.setInvalid('Invalid email format');
   *   }
   * });
   *
   * // Or programmatically:
   * editingPlugin.setInvalid('row-123', 'email', 'Invalid email format');
   * ```
   */
  setInvalid(rowId: string, field: string, message = ''): void {
    this.#validation.setInvalid(rowId, field, message);
  }

  /** Clear the invalid state for a specific cell. */
  clearInvalid(rowId: string, field: string): void {
    this.#validation.clearInvalid(rowId, field);
  }

  /** Clear all invalid cells for a specific row. */
  clearRowInvalid(rowId: string): void {
    this.#validation.clearRowInvalid(rowId);
  }

  /** Clear all invalid cell states across all rows. */
  clearAllInvalid(): void {
    this.#validation.clearAllInvalid();
  }

  /** Check if a specific cell is marked as invalid. */
  isCellInvalid(rowId: string, field: string): boolean {
    return this.#validation.isCellInvalid(rowId, field);
  }

  /** Get the validation message for an invalid cell. */
  getInvalidMessage(rowId: string, field: string): string | undefined {
    return this.#validation.getInvalidMessage(rowId, field);
  }

  /** Check if a row has any invalid cells. */
  hasInvalidCells(rowId: string): boolean {
    return this.#validation.hasInvalidCells(rowId);
  }

  /** Get all invalid fields for a row. */
  getInvalidFields(rowId: string): Map<string, string> {
    return this.#validation.getInvalidFields(rowId);
  }

  // #endregion

  /**
   * Reset all change tracking.
   * @param silent - If true, suppresses the `changed-rows-reset` event
   * @fires changed-rows-reset - Emitted when tracking is reset (unless silent)
   */
  resetChangedRows(silent?: boolean): void {
    const rows = this.changedRows;
    const ids = this.changedRowIds;
    this.#dirty.changedRowIds.clear();
    this.#dirty.committedDirtyRowIds.clear();
    this.#syncGridEditState();

    if (!silent) {
      this.emit<ChangedRowsResetDetail<T>>('changed-rows-reset', { rows, ids });
    }

    // Clear visual indicators
    const internalGrid = this.#internalGrid;
    internalGrid._rowPool?.forEach((r) => r.classList.remove('changed'));
  }

  /**
   * Programmatically begin editing a cell.
   * @param rowIndex - Index of the row to edit
   * @param field - Field name of the column to edit
   * @fires cell-commit - Emitted when the cell value is committed (on blur or Enter)
   */
  beginCellEdit(rowIndex: number, field: string): void {
    const internalGrid = this.#internalGrid;
    const colIndex = internalGrid._visibleColumns.findIndex((c) => c.field === field);
    if (colIndex === -1) return;

    const column = internalGrid._visibleColumns[colIndex];
    const rowData = internalGrid._rows[rowIndex];
    if (!column || !rowData || !this.#isCellEditable(column as ColumnConfig<T>, rowData as T)) return;

    const rowEl = internalGrid.findRenderedRowElement?.(rowIndex);
    const cellEl = rowEl?.querySelector(`.cell[data-col="${colIndex}"]`) as HTMLElement | null;
    if (!cellEl) return;

    this.#singleCellEdit = true;
    this.#beginCellEdit(rowIndex, colIndex, cellEl);
  }

  /**
   * Programmatically begin editing all editable cells in a row.
   * @param rowIndex - Index of the row to edit
   * @fires cell-commit - Emitted for each cell value that is committed
   * @fires row-commit - Emitted when focus leaves the row
   */
  beginBulkEdit(rowIndex: number): void {
    const internalGrid = this.#internalGrid;
    const editOn = this.config.editOn ?? internalGrid.effectiveConfig?.editOn;
    if (editOn === false) return;

    const hasEditableColumn = internalGrid._columns?.some((col) => this.#hasEditableConfig(col as ColumnConfig<T>));
    if (!hasEditableColumn) return;

    const rowEl = internalGrid.findRenderedRowElement?.(rowIndex);
    if (!rowEl) return;

    // Row-level gate
    const rowData = internalGrid._rows[rowIndex];
    const rowEditable = internalGrid.effectiveConfig?.rowEditable;
    if (rowData && rowEditable && !rowEditable(rowData as any)) return;

    // Bulk edit clears single-cell mode
    this.#singleCellEdit = false;

    // Start row edit
    this.#startRowEdit(rowIndex, rowData);

    // Enter edit mode on all editable cells
    Array.from(rowEl.children).forEach((cell, i) => {
      const col = internalGrid._visibleColumns[i];
      if (col && this.#isCellEditable(col as ColumnConfig<T>, rowData as T)) {
        const cellEl = cell as HTMLElement;
        if (!cellEl.classList.contains('editing')) {
          this.#injectEditor(rowData, rowIndex, col, i, cellEl, true);
        }
      }
    });

    // Focus the first editable cell
    setTimeout(() => {
      let targetCell = rowEl.querySelector(`.cell[data-col="${internalGrid._focusCol}"]`);
      if (!targetCell?.classList.contains('editing')) {
        targetCell = rowEl.querySelector('.cell.editing');
      }
      if (targetCell?.classList.contains('editing')) {
        const editor = (targetCell as HTMLElement).querySelector(FOCUSABLE_EDITOR_SELECTOR) as HTMLElement | null;
        try {
          editor?.focus({ preventScroll: true });
        } catch {
          /* empty */
        }
      }
    }, 0);
  }

  /**
   * Commit the currently active row edit.
   * @fires row-commit - Emitted after the row edit is committed
   */
  commitActiveRowEdit(): void {
    if (this.#activeEditRow !== -1) {
      this.#exitRowEdit(this.#activeEditRow, false);
    }
  }

  /**
   * Cancel the currently active row edit.
   */
  cancelActiveRowEdit(): void {
    if (this.#activeEditRow !== -1) {
      this.#exitRowEdit(this.#activeEditRow, true);
    }
  }

  // #endregion

  // #region Internal Methods

  /**
   * Sync the data-invalid attribute on a cell element.
   * Used as the DOM callback for CellValidationManager.
   */
  #syncInvalidCellAttribute(rowId: string, field: string, invalid: boolean): void {
    const internalGrid = this.#internalGrid;
    const colIndex = internalGrid._visibleColumns?.findIndex((c) => c.field === field);
    if (colIndex === -1 || colIndex === undefined) return;

    // Find the row element by rowId
    const rows = internalGrid._rows;
    const rowIndex = rows?.findIndex((r) => {
      try {
        return internalGrid.getRowId?.(r) === rowId;
      } catch {
        return false;
      }
    });
    if (rowIndex === -1 || rowIndex === undefined) return;

    const rowEl = internalGrid.findRenderedRowElement?.(rowIndex);
    const cellEl = rowEl?.querySelector(`.cell[data-col="${colIndex}"]`) as HTMLElement | null;
    if (!cellEl) return;

    if (invalid) {
      cellEl.setAttribute('data-invalid', 'true');
      const message = this.#validation.getInvalidMessage(rowId, field);
      if (message) {
        cellEl.setAttribute('title', message);
      }
    } else {
      cellEl.removeAttribute('data-invalid');
      cellEl.removeAttribute('title');
    }
  }

  /**
   * Migrate all index-keyed editing state when the active edit row moves to
   * a different position in `_rows` (e.g. after sort, filter, or new data push).
   *
   * Updates: `#activeEditRow`, `#editingCells`, `#rowEditSnapshots`,
   * `#editorValueCallbacks`, and syncs `_activeEditRows` on the grid.
   */
  #migrateEditRowIndex(oldIndex: number, newIndex: number): void {
    this.#activeEditRow = newIndex;

    // Migrate #editingCells keys ("rowIndex:colIndex")
    const migratedCells = new Set<string>();
    const prefix = `${oldIndex}:`;
    for (const cellKey of this.#editingCells) {
      if (cellKey.startsWith(prefix)) {
        migratedCells.add(`${newIndex}:${cellKey.substring(prefix.length)}`);
      } else {
        migratedCells.add(cellKey);
      }
    }
    this.#editingCells.clear();
    for (const key of migratedCells) {
      this.#editingCells.add(key);
    }

    // Migrate #rowEditSnapshots key
    const snapshot = this.#rowEditSnapshots.get(oldIndex);
    if (snapshot !== undefined) {
      this.#rowEditSnapshots.delete(oldIndex);
      this.#rowEditSnapshots.set(newIndex, snapshot);
    }

    // Migrate #editorValueCallbacks keys ("rowIndex:field")
    const updates: [string, (newValue: unknown) => void][] = [];
    for (const [key, cb] of this.#editorValueCallbacks) {
      if (key.startsWith(prefix)) {
        updates.push([`${newIndex}:${key.substring(prefix.length)}`, cb]);
        this.#editorValueCallbacks.delete(key);
      }
    }
    for (const [key, cb] of updates) {
      this.#editorValueCallbacks.set(key, cb);
    }

    // Sync the grid's rendering state so rows.ts checks the correct index
    this.#syncGridEditState();
  }

  /**
   * Begin editing a single cell.
   */
  #beginCellEdit(rowIndex: number, colIndex: number, cellEl: HTMLElement): void {
    const internalGrid = this.#internalGrid;
    const rowData = internalGrid._rows[rowIndex];
    const column = internalGrid._visibleColumns[colIndex];

    if (!rowData || !column || !this.#isCellEditable(column as ColumnConfig<T>, rowData as T)) return;
    if (cellEl.classList.contains('editing')) return;

    // Start row edit if not already
    if (this.#activeEditRow !== rowIndex) {
      this.#startRowEdit(rowIndex, rowData);
    }

    this.#activeEditCol = colIndex;
    this.#injectEditor(rowData, rowIndex, column, colIndex, cellEl, false);
  }

  /**
   * Revert the focused cell's value from the snapshot taken when the editor
   * first received focus, then emit a `cell-cancel` event so framework
   * adapters (e.g., GridFormArray) can revert their FormControls.
   *
   * Called by the grid-mode Escape handlers (both capture and bubble phase).
   */
  #revertGridModeCellEdit(): void {
    const snapshot = this.#gridModeCellSnapshot;
    if (!snapshot) return;

    const internalGrid = this.#internalGrid;
    const rowData = internalGrid._rows?.[snapshot.rowIndex];
    if (rowData) {
      (rowData as Record<string, unknown>)[snapshot.field] = snapshot.value;
    }

    // Push the reverted value to the editor's input element so that the
    // subsequent blur-commit (triggered by activeEl.blur()) reads the
    // reverted value instead of the user's typed text. This makes the
    // blur-commit a no-op (oldValue === newValue) and prevents it from
    // overwriting the revert.
    const callbackKey = `${snapshot.rowIndex}:${snapshot.field}`;
    const cb = this.#editorValueCallbacks.get(callbackKey);
    if (cb) cb(snapshot.value);

    // Notify framework adapters to revert FormControls
    this.emit<CellCancelDetail>('cell-cancel', {
      rowIndex: snapshot.rowIndex,
      colIndex: snapshot.colIndex,
      field: snapshot.field,
      previousValue: snapshot.value,
    });

    // After reverting, clean up changedRowIds so the built-in `.changed` class
    // toggle in rows.ts doesn't fight with consumer's rowClass callback.
    // changedRowIds.add() is unconditional during commit, so cleanup must also
    // be unconditional — otherwise the Set retains stale IDs when dirtyTracking
    // is disabled and the built-in toggle re-adds `.changed` on every render.
    if (rowData) {
      let rowId: string | undefined;
      try {
        rowId = this.grid.getRowId(rowData);
      } catch {
        // Row has no ID
      }
      if (rowId) {
        if (this.config.dirtyTracking) {
          // With dirty tracking, only remove if the row has no other dirty cells
          if (!this.#dirty.isRowDirty(rowId, rowData as T)) {
            this.#dirty.changedRowIds.delete(rowId);
            this.emit<DirtyChangeDetail<T>>('dirty-change', {
              rowId,
              row: rowData as T,
              original: this.#dirty.getOriginalRow(rowId),
              type: 'reverted',
            });
          }
        } else {
          // Without dirty tracking there's no baseline to compare, so always
          // remove — the consumer manages their own change state via rowClass.
          this.#dirty.changedRowIds.delete(rowId);
        }
      }
    }

    // Always re-render after revert so rowClass callbacks re-evaluate
    // (e.g., consumer may toggle a 'changed' class based on local state
    // updated in response to the cell-cancel event above).
    this.requestRender();

    this.#gridModeCellSnapshot = null;
  }

  /**
   * Focus the editor input in the currently focused cell (grid mode only).
   * Used when pressing Enter to enter edit mode from navigation mode.
   */
  #focusCurrentCellEditor(): void {
    const internalGrid = this.#internalGrid;
    const focusRow = internalGrid._focusRow;
    const focusCol = internalGrid._focusCol;

    if (focusRow < 0 || focusCol < 0) return;

    const rowEl = internalGrid.findRenderedRowElement?.(focusRow);
    const cellEl = rowEl?.querySelector(`.cell[data-col="${focusCol}"]`) as HTMLElement | null;

    if (cellEl?.classList.contains('editing')) {
      const editor = cellEl.querySelector(FOCUSABLE_EDITOR_SELECTOR) as HTMLElement | null;
      if (editor) {
        this.#gridModeEditLocked = false; // Unlock edit mode - user pressed Enter
        editor.focus();
        this.#gridModeInputFocused = true;
        // Select all text in text inputs for quick replacement
        if (editor instanceof HTMLInputElement && (editor.type === 'text' || editor.type === 'number')) {
          editor.select();
        }
      }
    }
  }

  /**
   * Handle Tab/Shift+Tab navigation while editing.
   * Moves to next/previous editable cell, staying in edit mode.
   * Wraps to next/previous row when reaching row boundaries.
   */
  #handleTabNavigation(forward: boolean): void {
    const internalGrid = this.#internalGrid;
    const rows = internalGrid._rows;
    // In grid mode, use focusRow since there's no active edit row
    const currentRow = this.#isGridMode ? internalGrid._focusRow : this.#activeEditRow;
    const currentRowData = rows[currentRow] as T;

    // Get editable column indices for the CURRENT row
    const editableCols = internalGrid._visibleColumns
      .map((c, i) => (currentRowData && this.#isCellEditable(c as ColumnConfig<T>, currentRowData) ? i : -1))
      .filter((i) => i >= 0);
    if (editableCols.length === 0) return;

    const currentIdx = editableCols.indexOf(internalGrid._focusCol);
    const nextIdx = currentIdx + (forward ? 1 : -1);

    // Can move within same row?
    if (nextIdx >= 0 && nextIdx < editableCols.length) {
      internalGrid._focusCol = editableCols[nextIdx];
      const rowEl = internalGrid.findRenderedRowElement?.(currentRow);
      const cellEl = rowEl?.querySelector(`.cell[data-col="${editableCols[nextIdx]}"]`) as HTMLElement | null;
      if (cellEl?.classList.contains('editing')) {
        const editor = cellEl.querySelector(FOCUSABLE_EDITOR_SELECTOR) as HTMLElement | null;
        editor?.focus({ preventScroll: true });
      }
      ensureCellVisible(internalGrid, { forceHorizontalScroll: true });
      return;
    }

    // Can move to adjacent row?
    const nextRow = currentRow + (forward ? 1 : -1);
    if (nextRow >= 0 && nextRow < rows.length) {
      const nextRowData = rows[nextRow] as T;
      // Compute editable columns for the next row
      const nextEditableCols = internalGrid._visibleColumns
        .map((c, i) => (nextRowData && this.#isCellEditable(c as ColumnConfig<T>, nextRowData) ? i : -1))
        .filter((i) => i >= 0);
      if (nextEditableCols.length === 0) return; // Next row has no editable cells

      // In grid mode, just move focus (all rows are always editable)
      if (this.#isGridMode) {
        internalGrid._focusRow = nextRow;
        internalGrid._focusCol = forward ? nextEditableCols[0] : nextEditableCols[nextEditableCols.length - 1];
        ensureCellVisible(internalGrid, { forceHorizontalScroll: true });
        // Focus the editor in the new cell after render
        this.requestAfterRender();
        setTimeout(() => {
          const rowEl = internalGrid.findRenderedRowElement?.(nextRow);
          const cellEl = rowEl?.querySelector(`.cell[data-col="${internalGrid._focusCol}"]`) as HTMLElement | null;
          if (cellEl?.classList.contains('editing')) {
            const editor = cellEl.querySelector(FOCUSABLE_EDITOR_SELECTOR) as HTMLElement | null;
            editor?.focus({ preventScroll: true });
          }
        }, 0);
      } else {
        // In row mode, commit current row and enter next row
        this.#exitRowEdit(currentRow, false);
        internalGrid._focusRow = nextRow;
        internalGrid._focusCol = forward ? nextEditableCols[0] : nextEditableCols[nextEditableCols.length - 1];
        this.beginBulkEdit(nextRow);
        ensureCellVisible(internalGrid, { forceHorizontalScroll: true });
      }
    }
    // else: at boundary - stay put
  }

  /**
   * Sync the internal grid state with the plugin's editing state.
   */
  #syncGridEditState(): void {
    const internalGrid = this.#internalGrid;
    internalGrid._activeEditRows = this.#activeEditRow;
    internalGrid._rowEditSnapshots = this.#rowEditSnapshots;
  }

  /**
   * Snapshot original row data and mark as editing.
   */
  #startRowEdit(rowIndex: number, rowData: T): void {
    if (this.#activeEditRow !== rowIndex) {
      // Commit the previous row before starting a new one
      if (this.#activeEditRow !== -1) {
        this.#exitRowEdit(this.#activeEditRow, false);
      }
      this.#rowEditSnapshots.set(rowIndex, { ...rowData });
      this.#activeEditRow = rowIndex;
      this.#activeEditRowRef = rowData;

      // Store stable row ID for resilience against _rows replacement during editing
      const internalGrid = this.#internalGrid;
      try {
        this.#activeEditRowId = internalGrid.getRowId?.(rowData) ?? undefined;
      } catch {
        this.#activeEditRowId = undefined;
      }

      this.#syncGridEditState();

      // Emit edit-open event (row mode only)
      if (!this.#isGridMode) {
        this.emit<EditOpenDetail<T>>('edit-open', {
          rowIndex,
          rowId: this.#activeEditRowId ?? '',
          row: rowData,
        });
        announce(this.gridElement, getA11yMessage(this.gridElement, 'editingStarted', rowIndex));
      }
    }
  }

  /**
   * Exit editing for a row.
   */
  #exitRowEdit(rowIndex: number, revert: boolean): void {
    if (this.#activeEditRow !== rowIndex) return;

    const internalGrid = this.#internalGrid;
    const snapshot = this.#rowEditSnapshots.get(rowIndex);
    const rowEl = internalGrid.findRenderedRowElement?.(rowIndex);

    // Resolve the row being edited using the stored row ID.
    // The _rows array may have been replaced (e.g. Angular pushing new rows
    // via directive effect) since editing started, so _rows[rowIndex] could
    // point to a completely different row. The ID map is always up-to-date.
    // Without an ID we fall back to the stored row reference from edit-open
    // (#activeEditRowRef) — safer than _rows[rowIndex] which may be stale.
    let rowId = this.#activeEditRowId;
    const entry = rowId ? internalGrid._getRowEntry(rowId) : undefined;
    const current = entry?.row ?? this.#activeEditRowRef ?? internalGrid._rows[rowIndex];

    if (!rowId && current) {
      try {
        rowId = internalGrid.getRowId?.(current);
      } catch {
        // Row has no ID - skip ID-based tracking
      }
    }

    // Collect and commit values from active editors before re-rendering
    if (!revert && rowEl && current) {
      const editingCells = rowEl.querySelectorAll('.cell.editing');
      editingCells.forEach((cell) => {
        const colIndex = Number((cell as HTMLElement).getAttribute('data-col'));
        if (isNaN(colIndex)) return;
        const col = internalGrid._visibleColumns[colIndex];
        if (!col) return;

        // Skip cells with externally-managed editors (framework adapters like Angular/React/Vue).
        // These editors handle their own commits via the commit() callback - we should NOT
        // try to read values from their DOM inputs (which may contain formatted display values).
        if ((cell as HTMLElement).hasAttribute('data-editor-managed')) {
          return;
        }

        const input = cell.querySelector('input,textarea,select') as
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLSelectElement
          | null;
        if (input) {
          const field = col.field as keyof T;
          const originalValue = current[field];
          const val = getInputValue(input, col, originalValue);
          if (originalValue !== val) {
            this.#commitCellValue(rowIndex, col, val, current);
          }
        }
      });
    }

    // Flush managed editors (framework adapters) before clearing state.
    // At this point the commit() callback is still active, so editors can
    // synchronously commit their pending values in response to this event.
    if (!revert && !this.#isGridMode && current) {
      this.emit<BeforeEditCloseDetail<T>>('before-edit-close', {
        rowIndex,
        rowId: rowId ?? '',
        row: current,
      });
    }

    // Revert if requested
    if (revert && snapshot && current) {
      Object.keys(snapshot as object).forEach((k) => {
        (current as Record<string, unknown>)[k] = (snapshot as Record<string, unknown>)[k];
      });
      if (rowId) {
        this.#dirty.changedRowIds.delete(rowId);
        this.#dirty.committedDirtyRowIds.delete(rowId);
        this.clearRowInvalid(rowId);
      }
    } else if (!revert && current) {
      // Compare snapshot vs current to detect if changes were made during THIS edit session
      const changedThisSession = hasRowChanged(snapshot, current);

      // Check if this row has any cumulative changes (via ID tracking)
      // Fall back to session-based detection when no row ID is available
      const changed = rowId ? this.#dirty.changedRowIds.has(rowId) : changedThisSession;

      // Emit cancelable row-commit event
      const cancelled = this.emitCancelable<RowCommitDetail<T>>('row-commit', {
        rowIndex,
        rowId: rowId ?? '',
        row: current,
        oldValue: snapshot,
        newValue: current,
        changed,
        changedRows: this.changedRows,
        changedRowIds: this.changedRowIds,
      });

      // If consumer called preventDefault(), revert the row
      if (cancelled && snapshot) {
        Object.keys(snapshot as object).forEach((k) => {
          (current as Record<string, unknown>)[k] = (snapshot as Record<string, unknown>)[k];
        });
        if (rowId) {
          this.#dirty.changedRowIds.delete(rowId);
          this.#dirty.committedDirtyRowIds.delete(rowId);
          this.clearRowInvalid(rowId);
        }
      } else if (!cancelled) {
        // Mark row as committed-dirty if it has actual changes vs baseline
        if (rowId && this.config.dirtyTracking) {
          if (this.#dirty.isRowDirty(rowId, current)) {
            this.#dirty.committedDirtyRowIds.add(rowId);
          } else {
            this.#dirty.committedDirtyRowIds.delete(rowId);
          }
        }

        if (changedThisSession && this.isAnimationEnabled) {
          // Animate the row only if changes were made during this edit session
          // (deferred to afterRender so the row element exists after re-render)
          this.#pendingRowAnimation = rowIndex;
        }
      }
    }

    // Clear editing state
    this.#rowEditSnapshots.delete(rowIndex);
    this.#activeEditRow = -1;
    this.#activeEditRowId = undefined;
    this.#activeEditRowRef = undefined;
    this.#activeEditCol = -1;
    this.#singleCellEdit = false;
    this.#syncGridEditState();

    // Remove all editing cells for this row.
    // Note: these keys use the rowIndex captured at edit-open time. Even if _rows
    // was replaced and the row moved to a different index, the keys still match
    // what was inserted during this edit session (same captured rowIndex).
    for (const cellKey of this.#editingCells) {
      if (cellKey.startsWith(`${rowIndex}:`)) {
        this.#editingCells.delete(cellKey);
      }
    }
    // Remove value-change callbacks for this row (same captured-index rationale)
    for (const callbackKey of this.#editorValueCallbacks.keys()) {
      if (callbackKey.startsWith(`${rowIndex}:`)) {
        this.#editorValueCallbacks.delete(callbackKey);
      }
    }

    // Mark that focus should be restored after the upcoming render completes.
    // This must be set BEFORE refreshVirtualWindow because it calls afterRender()
    // synchronously, which reads this flag.
    this.#pendingFocusRestore = true;

    // Re-render the row to remove editors
    if (rowEl) {
      // Release framework editor components (Angular/React/Vue) BEFORE clearing
      // editing state. This ensures releaseCell runs while the editor DOM is
      // still inside each cell, so the adapter can find and destroy ComponentRefs.
      // Without this, overlay editors (BaseOverlayEditor) leak panels on <body>
      // with active MutationObservers that react to cell-focus class changes.
      const adapter = internalGrid.__frameworkAdapter;
      const editingCells = rowEl.querySelectorAll('.cell.editing');
      if (adapter?.releaseCell) {
        editingCells.forEach((cell) => {
          adapter.releaseCell!(cell as HTMLElement);
        });
      }

      // Remove editing class and re-render cells
      editingCells.forEach((cell) => {
        cell.classList.remove('editing');
        clearEditingState(cell.parentElement as RowElementInternal);
      });

      // Refresh the virtual window to restore cell content WITHOUT rebuilding
      // the row model. requestRender() would trigger processRows (ROWS phase)
      // which re-sorts — causing the edited row to jump to a new position and
      // disappear from view. refreshVirtualWindow re-renders visible cells from
      // the current _rows order, keeping the row in place until the user
      // explicitly sorts again or new data arrives.
      internalGrid.refreshVirtualWindow(true);
    } else {
      // Row not visible - restore focus immediately (no render will happen)
      this.#restoreCellFocus(internalGrid);
      this.#pendingFocusRestore = false;
    }

    // Emit edit-close event (row mode only, fires for both commit and revert)
    if (!this.#isGridMode && current) {
      this.emit<EditCloseDetail<T>>('edit-close', {
        rowIndex,
        rowId: rowId ?? '',
        row: current,
        reverted: revert,
      });
      if (!revert) {
        announce(this.gridElement, getA11yMessage(this.gridElement, 'editingCommitted', rowIndex));
      }
    }
  }

  /**
   * Commit a single cell value change.
   * Uses ID-based change tracking for stability when rows are reordered.
   */
  #commitCellValue(rowIndex: number, column: ColumnConfig<T>, newValue: unknown, rowData: T): void {
    const field = column.field;
    if (!isSafePropertyKey(field)) return;
    const oldValue = (rowData as Record<string, unknown>)[field];
    if (oldValue === newValue) return;

    const internalGrid = this.#internalGrid;

    // Get row ID for change tracking (may not exist if getRowId not configured)
    let rowId: string | undefined;
    try {
      rowId = this.grid.getRowId(rowData);
    } catch {
      // Row has no ID - will still work but won't be tracked in changedRowIds
    }

    const firstTime = rowId ? !this.#dirty.changedRowIds.has(rowId) : true;

    // Create updateRow helper for cascade updates (noop if row has no ID)
    const updateRow: (changes: Partial<T>) => void = rowId
      ? (changes) => this.grid.updateRow(rowId!, changes as Record<string, unknown>, 'cascade')
      : noopUpdateRow;

    // Track whether setInvalid was called during event handling
    let invalidWasSet = false;

    // Create setInvalid callback for validation (noop if row has no ID)
    const setInvalid = rowId
      ? (message?: string) => {
          invalidWasSet = true;
          this.setInvalid(rowId!, field, message ?? '');
        }
      : () => {}; // eslint-disable-line @typescript-eslint/no-empty-function

    // Emit cancelable event BEFORE applying the value
    const cancelled = this.emitCancelable<CellCommitDetail<T>>('cell-commit', {
      row: rowData,
      rowId: rowId ?? '',
      field,
      oldValue,
      value: newValue,
      rowIndex,
      changedRows: this.changedRows,
      changedRowIds: this.changedRowIds,
      firstTimeForRow: firstTime,
      updateRow,
      setInvalid,
    });

    // If consumer called preventDefault(), abort the commit
    if (cancelled) return;

    // Clear any previous invalid state for this cell ONLY if setInvalid wasn't called
    // (if setInvalid was called, the handler wants it to remain invalid)
    if (rowId && !invalidWasSet && this.isCellInvalid(rowId, field)) {
      this.clearInvalid(rowId, field);
    }

    // Apply the value and mark row as changed
    (rowData as Record<string, unknown>)[field] = newValue;
    if (rowId) {
      this.#dirty.changedRowIds.add(rowId);
    }
    this.#syncGridEditState();

    // Emit dirty-change event if dirty tracking is enabled
    if (this.config.dirtyTracking && rowId) {
      const dirty = this.#dirty.isRowDirty(rowId, rowData);
      this.emit<DirtyChangeDetail<T>>('dirty-change', {
        rowId,
        row: rowData,
        original: this.#dirty.getOriginalRow(rowId),
        type: dirty ? 'modified' : 'pristine',
      });
    }

    // Notify other plugins (e.g., UndoRedoPlugin) about the committed edit
    this.emitPluginEvent('cell-edit-committed', {
      rowIndex,
      field,
      oldValue,
      newValue,
    });

    // Mark the row visually as changed (animation happens when row edit closes)
    const rowEl = internalGrid.findRenderedRowElement?.(rowIndex);
    if (rowEl) {
      rowEl.classList.add('changed');
    }
  }

  /**
   * Inject an editor into a cell.
   * Delegates to the extracted `editor-injection` module.
   */
  #injectEditor(
    rowData: T,
    rowIndex: number,
    column: ColumnConfig<T>,
    colIndex: number,
    cell: HTMLElement,
    skipFocus: boolean,
    parentRowEl?: HTMLElement,
  ): void {
    injectEditorImpl(this.#editorDeps, rowData, rowIndex, column, colIndex, cell, skipFocus, parentRowEl);
  }

  /**
   * Restore focus to cell after exiting edit mode.
   */
  #restoreCellFocus(internalGrid: InternalGrid<T>): void {
    queueMicrotask(() => {
      try {
        const rowIdx = internalGrid._focusRow;
        const colIdx = internalGrid._focusCol;
        const rowEl = internalGrid.findRenderedRowElement?.(rowIdx);
        if (rowEl) {
          Array.from(internalGrid._bodyEl.querySelectorAll('.cell-focus')).forEach((el) =>
            el.classList.remove('cell-focus'),
          );
          const cell = rowEl.querySelector(`.cell[data-row="${rowIdx}"][data-col="${colIdx}"]`) as HTMLElement | null;
          if (cell) {
            cell.classList.add('cell-focus');
            cell.setAttribute('aria-selected', 'true');
            if (!cell.hasAttribute('tabindex')) cell.setAttribute('tabindex', '-1');
            cell.focus({ preventScroll: true });
          }
        }
      } catch {
        /* empty */
      }
    });
  }

  // #endregion
}
