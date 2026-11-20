/**
 * Row Drag-Drop Plugin
 *
 * Drag rows within a single grid **and** between grids that share a
 * `dropZone`.
 *
 * Architecture overview is documented in the issue body and in
 * `.github/knowledge/grid-plugins.md`. Key invariants:
 *
 * - Indices in events and APIs are DISPLAY indices (`grid.rows`), but moves
 *   are applied to the source rows by row IDENTITY — display and source only
 *   line up when no plugin reshapes the rows. Row-model plugins (Tree,
 *   GroupingRows) translate or veto moves via the `rows:resolve-move` query
 *   (`plugins/shared/row-move.ts`, #663). The consumer's `sourceRows` array is
 *   never mutated on either side; a move assigns a new array to `grid.rows`.
 *   Persistence is consumer-driven via the `row-move` (intra-grid) and
 *   `row-transfer` (cross-grid) events.
 * - Same-window cross-grid drops use the WeakRef registry in
 *   `core/internal/drag-drop-registry` to recover live row references.
 *   Cross-window drops fall back to `JSON.parse(JSON.stringify(row))` (or the
 *   `serializeRow`/`deserializeRow` hooks for non-JSON values).
 * - Duplicate instances of this plugin collapse via the PluginManager
 *   alias-collapse pre-pass, which merges their configs.
 *
 * @see {@link RowDragDropConfig} for all configuration options.
 */

import { GridClasses } from '../../core/constants';
import {
  clearDragSession,
  lookupDragSession,
  newDragSessionId,
  registerDragSession,
} from '../../core/internal/drag-drop-registry';
import { ensureCellVisible } from '../../core/internal/keyboard';
import {
  BaseGridPlugin,
  type GridElement,
  type PluginDependency,
  type PluginManifest,
} from '../../core/plugin/base-plugin';
import type { ColumnConfig, GridHost } from '../../core/types';
import {
  type DragAlternativeAction,
  type DragAlternativeMenu,
  createDragAlternativeMenu,
} from '../shared/drag-alternative-menu';
import {
  type AutoScroller,
  type RowDragPayload,
  TBW_ROW_DRAG_MIME,
  clearCurrentDragSession,
  computeDropPosition,
  createAutoScroller,
  decodePayload,
  encodePayload,
  findMatchingZoneMime,
  formatRowsAsTSV,
  getCurrentDragSession,
  hasAnyRowDragMime,
  mimeForZone,
  setCurrentDragSession,
} from '../shared/drag-drop-protocol';
import type { RowMovePosition, RowMoveResolution, RowMoveStep } from '../shared/row-move';
import {
  type RemoteTransferListener,
  type RemoteTransferMessage,
  broadcastRemoteTransfer,
  registerRemoteTransferListener,
  unregisterRemoteTransferListener,
} from './cross-window-channel';
import styles from './row-drag-drop.css?inline';
import { setRowDragImage } from './row-drag-image';
import type { PlannedMove, ResolveMove } from './row-order';
import {
  END_OF_ROWS,
  moveAt,
  relocate,
  shiftedIndex,
  sourceIndexOf,
  sourceOrderAfterMove,
  sourceWith,
  sourceWithout,
  towardSourceRow,
  trackDragSelection,
  trackRows,
} from './row-order';
import type {
  PendingMove,
  RowDragDropConfig,
  RowDragEndDetail,
  RowDragStartDetail,
  RowDropDetail,
  RowMoveDetail,
  RowTransferDetail,
} from './types';

/**
 * Field name for the drag handle column.
 *
 * @since 2.4.0
 */
export const ROW_DRAG_HANDLE_FIELD = '__tbw_row_drag';

/** Rows a drag picked up, by occurrence: `display[indices[k]] === rows[k]`. */
interface DragSelection<T> {
  sessionId: string;
  rows: T[];
  indices: number[];
  display: readonly unknown[];
}

/**
 * Every plugin instance attached in this window.
 *
 * Drag-and-drop discovers its target from the pointer position, so it never
 * needed a registry. The click-only transfer control (WCAG 2.2 SC 2.5.7) does:
 * it has to *list* the grids a row can be sent to before the user picks one.
 *
 * Typed as `unknown` because the class is generic over the row type and every
 * instance in the window may have a different one; `peersInDropZone()` narrows.
 */
const attachedPlugins = new Set<unknown>();

/**
 * Row Drag-Drop Plugin for `<tbw-grid>`.
 *
 * @example Intra-grid reordering
 * ```ts
 * import { RowDragDropPlugin } from '@toolbox-web/grid/plugins/row-drag-drop';
 *
 * grid.gridConfig = {
 *   plugins: [new RowDragDropPlugin()],
 * };
 * ```
 *
 * @example Cross-grid transfer list
 * ```ts
 * gridA.gridConfig = { plugins: [new RowDragDropPlugin({ dropZone: 'tasks' })] };
 * gridB.gridConfig = { plugins: [new RowDragDropPlugin({ dropZone: 'tasks' })] };
 *
 * gridA.addEventListener('row-transfer', (e) => persist(e.detail));
 * gridB.addEventListener('row-transfer', (e) => persist(e.detail));
 * ```
 *
 * @category Plugin
 */
export class RowDragDropPlugin<T = unknown> extends BaseGridPlugin<RowDragDropConfig<T>> {
  /** @internal */
  readonly name = 'rowDragDrop';

  /** @internal */
  override readonly styles = styles;

  /** @internal */
  static override readonly manifest: PluginManifest<RowDragDropConfig> = {
    events: [
      { type: 'row-move', description: 'Intra-grid row reorder.', cancelable: true },
      { type: 'row-drag-start', description: 'Cross-grid drag started on this grid.', cancelable: true },
      { type: 'row-drag-end', description: 'Drag finished on this grid (regardless of outcome).' },
      { type: 'row-drop', description: 'Cross-grid drop landing on this grid.', cancelable: true },
      { type: 'row-transfer', description: 'Cross-grid transfer completed (fires on both grids).' },
    ],
  };

  /**
   * Optional dependencies.
   * - `pivot`: answers `columns:is-replaced`, so the drag handle is left out of the pivot layout (#616).
   * - `tree`, `groupingRows`: answer `rows:resolve-move`, translating moves into their row model (#663).
   */
  static override readonly dependencies: PluginDependency[] = [
    { name: 'pivot', required: false, reason: 'Queries columns:is-replaced to omit the drag handle while pivoting' },
    { name: 'tree', required: false, reason: 'Queries rows:resolve-move to move tree nodes among their siblings' },
    { name: 'groupingRows', required: false, reason: 'Queries rows:resolve-move to keep moves inside their group' },
  ];

  /** @internal */
  protected override get defaultConfig(): Partial<RowDragDropConfig<T>> {
    return {
      enableKeyboard: true,
      // `showDragHandle` default depends on `dragFrom` — resolved by
      // `shouldRenderDragHandle()` rather than here so a single `dragFrom`
      // change reshapes both at once.
      dragHandlePosition: 'left',
      dragHandleWidth: 40,
      debounceMs: 150,
      animation: 'flip',
      operation: 'move',
      autoScroll: true,
      dragFrom: 'handle',
    };
  }

  /**
   * Resolve whether the grip column should be rendered. The handle is shown
   * unless the user explicitly set `showDragHandle: false`, OR `dragFrom`
   * is `'row'` and `showDragHandle` was not explicitly set to `true`.
   */
  private shouldRenderDragHandle(): boolean {
    const explicit = this.config.showDragHandle;
    if (explicit === false) return false;
    if (explicit === true) return true;
    return this.config.dragFrom !== 'row';
  }

  /** Whether the row element itself should accept native HTML5 drag. */
  private get rowIsDraggable(): boolean {
    return this.config.dragFrom === 'row' || this.config.dragFrom === 'both';
  }

  /** Resolve animation type from plugin config (respects grid-level reduced-motion). */
  private get animationType(): false | 'flip' {
    if (!this.isAnimationEnabled) return false;
    if (this.config.animation !== undefined) return this.config.animation;
    return 'flip';
  }

  // #region Internal State
  private isDragging = false;
  private draggedRows: T[] = [];
  /** Display the drag's `draggedIndices` refer to — maps them across renders by occurrence. */
  private dragDisplay: readonly unknown[] = [];
  private draggedIndices: number[] = [];
  private dragStartIndices: number[] = [];
  private dragSessionId: string | null = null;
  private dragAccepted = false;
  /**
   * The last cross-grid `move` drag, kept past `dragend` because a target in
   * another window acknowledges it over the channel, possibly after `dragend`
   * (#666). `indices` point into `display`; one session only, replaced by the
   * next drag, so an unacknowledged drag cannot pile up.
   */
  private unackedDrag: DragSelection<T> | null = null;
  private dropRowIndex: number | null = null;
  /** Row under the pointer at the last `dragover`, and which half of it (#663). */
  private dropTarget: { index: number; before: boolean } | null = null;
  /** Memo of the last structural `dragover` check — `dragover` repeats for the same spot. */
  private dropCheck: { index: number; before: boolean; ok: boolean } | null = null;
  /** A row mutation was applied; the displayed rows are stale until the next render. */
  private awaitingRender = false;
  /**
   * Displayed order after a flat move committed this tick: `grid.rows =` only
   * queues the rebuild, so `_rows` is stale until the next render and a second
   * `moveRow()` in the same tick would index the old order.
   */
  private pendingDisplay: T[] | null = null;
  /** Occurrence (`display[index]`) the keyboard focus follows once an immediate keyboard move has rendered. */
  private focusAfterRender: { display: readonly unknown[]; index: number; col: number } | null = null;
  private pendingMove: PendingMove | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastFocusCol = 0;
  private autoScroller: AutoScroller | null = null;
  /** Whether the most recent press inside the host landed in a nested grid (#585). */
  private pressInsideChild = false;
  /** Stable id for this grid instance (used as `sourceGridId` in payloads). */
  private gridId = '';

  /** Bound listener so we can register/unregister the same reference. */
  private readonly remoteTransferListener: RemoteTransferListener = (msg) => this.onRemoteTransfer(msg);

  /** Click-only move menu (WCAG 2.2 SC 2.5.7), created lazily on first tap. */
  private moveMenu: DragAlternativeMenu | null = null;

  /** Typed internal grid accessor. */
  private get internalGrid(): GridHost {
    return this.grid;
  }
  // #endregion

  // #region Lifecycle
  /** @internal */
  override attach(grid: GridElement): void {
    super.attach(grid);
    const host = this.gridElement;
    if (host) {
      this.gridId = host.id || `tbw-grid-${newDragSessionId().slice(0, 8)}`;
      if (!host.id) host.id = this.gridId;
      this.setupDelegatedDragListeners();
      registerRemoteTransferListener(this.remoteTransferListener);
      attachedPlugins.add(this);
    }
  }

  /** @internal */
  override detach(): void {
    this.clearDebounceTimer();
    this.autoScroller?.stop();
    this.autoScroller = null;
    unregisterRemoteTransferListener(this.remoteTransferListener);
    attachedPlugins.delete(this);
    this.moveMenu?.dispose();
    this.moveMenu = null;
    if (this.dragSessionId) clearDragSession(this.dragSessionId);
    clearCurrentDragSession();
    this.resetDragState();
    this.unackedDrag = null;
    this.awaitingRender = false;
    this.pendingDisplay = null;
    this.focusAfterRender = null;
    super.detach();
  }
  // #endregion

  // #region Hooks

  /** @internal */
  override processColumns(columns: readonly ColumnConfig[]): ColumnConfig[] {
    // Core re-feeds the previous pass's output on every COLUMNS pass, so an existing handle is
    // rebuilt in place (never stacked), keeping a runtime pin (`setPinPosition`) and its position.
    const existingIndex = columns.findIndex((c) => c.field === ROW_DRAG_HANDLE_FIELD);
    // A column-replacing plugin (Pivot) renders its own rows, where the handle would be empty (#616).
    if (!this.shouldRenderDragHandle() || this.queryBoolean('columns:is-replaced')) {
      return existingIndex < 0 ? [...columns] : columns.filter((c) => c.field !== ROW_DRAG_HANDLE_FIELD);
    }
    const existingPin = (columns[existingIndex] as (ColumnConfig & { pinned?: unknown }) | undefined)?.pinned;

    const dragHandleColumn: ColumnConfig = {
      field: ROW_DRAG_HANDLE_FIELD,
      header: '',
      width: this.config.dragHandleWidth ?? 40,
      resizable: false,
      sortable: false,
      filterable: false,
      lockPosition: true,
      utility: true,
      viewRenderer: () => {
        const container = document.createElement('div');
        container.className = 'dg-row-drag-handle';
        container.setAttribute('aria-label', 'Drag to reorder, or activate for move options');
        container.setAttribute('role', 'button');
        container.setAttribute('tabindex', '-1');
        container.draggable = true;
        // Press-and-release without moving is a tap, not a drag — HTML5 DnD
        // only fires `dragstart` on a real drag, so a plain `click` here means
        // the pointer user could not (or chose not to) drag. Offer the
        // click-only alternative instead (WCAG 2.2 SC 2.5.7).
        container.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openMoveMenu(container);
        });
        this.setIcon(container, 'dragHandle');
        return container;
      },
    };

    if (existingPin != null) (dragHandleColumn as ColumnConfig & { pinned?: unknown }).pinned = existingPin;
    if (existingIndex >= 0) {
      const next = [...columns];
      next[existingIndex] = dragHandleColumn;
      return next;
    }
    return this.config.dragHandlePosition === 'right' ? [...columns, dragHandleColumn] : [dragHandleColumn, ...columns];
  }

  /** @internal */
  override afterRender(): void {
    this.applyRowDraggable();
    this.awaitingRender = false;
    this.pendingDisplay = null;
    if (this.isDragging) {
      // Re-point the dragged occurrences (also the intra payload's `rowIndices`) at this render.
      this.dragDisplay = trackRows(this.dragDisplay, this.displayRows, this.draggedRows, this.draggedIndices);
      this.dropTarget = this.dropRowIndex = this.dropCheck = null; // display indices of the old render
    } else if (this.unackedDrag) trackDragSelection(this.unackedDrag, this.displayRows);
    const follow = this.focusAfterRender;
    if (!follow) return;
    this.focusAfterRender = null;
    const index = relocate(follow.display, follow.index, this.displayRows);
    if (index < 0) return;
    const grid = this.internalGrid;
    grid._focusRow = index;
    grid._focusCol = follow.col;
    ensureCellVisible(grid);
  }

  /** @internal */
  override onScrollRender(): void {
    // Virtualization recycles row DOM elements during scroll; re-apply the
    // `draggable` attribute so newly-shown rows still accept HTML5 drag.
    this.applyRowDraggable();
  }

  /**
   * Set or clear the `draggable` attribute on every visible row, depending on
   * `config.dragFrom`. Idempotent and cheap (one attribute write per row).
   */
  private applyRowDraggable(): void {
    const wantDraggable = this.rowIsDraggable;
    for (const row of this.#ownRows()) {
      if (wantDraggable) {
        if (row.getAttribute('draggable') !== 'true') row.setAttribute('draggable', 'true');
      } else if (row.hasAttribute('draggable')) {
        row.removeAttribute('draggable');
      }
    }
  }

  /** @internal */
  override onKeyDown(event: KeyboardEvent): boolean | void {
    if (!this.config.enableKeyboard) return;
    // Ctrl is deprecated (macOS reserves Ctrl+↑/↓); remove in the next major.
    if (!(event.altKey || event.ctrlKey) || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    if (this.#isKeyboardMoveBlocked(event)) return;

    const grid = this.internalGrid;
    const at = grid._focusRow;
    const row = this.displayRows[at];
    if (row === undefined) return;
    // Debouncing coalesces presses on ONE row (occurrence — matched by its slot, since
    // a row object can repeat). Settle another row's pending move first.
    const settled = this.pendingMove !== null && this.pendingMove.currentIndex !== at;
    const revert = settled ? this.flushPendingMove() : null;
    // A `grid.rows =` rebuild is queued (that flush, or a move committed this tick):
    // it would overwrite a debounced `_rows` edit, so commit this move at once.
    const immediate = settled || this.pendingDisplay !== null;

    const focusRow = revert ? shiftedIndex(at, ...revert) : at;
    const step = event.key === 'ArrowUp' ? -1 : 1;
    const toIndex = focusRow + step;
    if (focusRow < 0 || toIndex < 0 || toIndex >= this.displayRows.length) return;
    if (!this.canPickUp(focusRow, toIndex)) return;
    // A flat debounced move only needs a yes/no here: that path reorders `_rows` itself.
    const plan = this.planMove(focusRow, toIndex, step < 0 ? 'before' : 'after', step, !immediate);
    if (!plan) return;

    if (plan.structural || immediate) {
      // Apply now and let focus follow the row once it renders — the occurrence that
      // moved: a flat step lands it at `toIndex` (a Tree holds each row once).
      if (this.commitMove(plan, focusRow, toIndex, 'keyboard')) {
        // A flat move's display is known now: the next press, before the render, acts on the moved row.
        if (plan.display) grid._focusRow = toIndex;
        this.focusAfterRender = {
          display: plan.display ?? [row],
          index: plan.display ? toIndex : 0,
          col: grid._focusCol,
        };
      }
    } else {
      this.handleKeyboardMove(row, focusRow, toIndex, grid._focusCol);
    }
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  /** Editors, form controls and non-body chrome own the chord (e.g. `<select>` Alt+↓ opens it). */
  #isKeyboardMoveBlocked(event: KeyboardEvent): boolean {
    if (this.queryBoolean('isEditing')) return true;
    const target = (event.composedPath?.()[0] ?? event.target) as HTMLElement | null;
    if (!target?.closest || target === this.gridElement) return false;
    if (!target.closest('.rows-body')) return true;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || target.isContentEditable;
  }

  /** @internal */
  override onCellClick(): void {
    this.flushPendingMove();
  }
  // #endregion

  // #region Public API
  /**
   * Move a row to a new position programmatically (intra-grid). Both indices
   * are positions in the displayed rows (`grid.rows`); the row lands where the
   * row at `toIndex` is now. With a structural plugin such as Tree, the row
   * keeps its subtree and the move follows that plugin's rules, and further
   * moves are refused until the grid has rendered the first one (its next
   * `render` event).
   */
  moveRow(fromIndex: number, toIndex: number): void {
    [fromIndex, toIndex] = this.settlePending(fromIndex, toIndex);
    if (!this.canPickUp(fromIndex, toIndex)) return;
    const plan = this.planMove(fromIndex, toIndex, toIndex < fromIndex ? 'before' : 'after');
    if (plan) this.commitMove(plan, fromIndex, toIndex, 'keyboard');
  }

  /**
   * Check if a row can be moved within this grid.
   * Consults the `canDrag` veto for the source row, the plugin query system
   * (`canMoveRow`, `rows:resolve-move`), and `canDrop` for the target.
   */
  canMoveRow(fromIndex: number, toIndex: number): boolean {
    const position = toIndex < fromIndex ? 'before' : 'after';
    return this.canPickUp(fromIndex, toIndex) && this.planMove(fromIndex, toIndex, position, undefined, true) !== null;
  }
  // #endregion

  // #region Move resolution (`rows:resolve-move`, #663)

  /**
   * Displayed rows — every index this plugin handles refers to this array.
   * During debounced keyboard moves it is the plugin's own reordered `_rows`;
   * right after a flat move, the order that move will render.
   */
  private get displayRows(): T[] {
    return this.pendingDisplay ?? ((this.internalGrid._rows ?? this.sourceRows) as T[]);
  }

  /**
   * Row-level vetoes for moving the displayed row at `fromIndex` towards
   * `toIndex`: the `canMoveRow` query, `canDrag` and `canDrop`.
   */
  private canPickUp(fromIndex: number, toIndex: number): boolean {
    // A sort re-applies on the next rebuild and would undo the new order (MultiSort vetoes via the query).
    if (this.awaitingRender || this.internalGrid._sortState) return false;
    const rows = this.displayRows;
    if (fromIndex < 0 || fromIndex >= rows.length) return false;
    if (toIndex < 0 || toIndex >= rows.length) return false;

    // Plugin query veto (e.g. GroupingRows group headers)
    const row = rows[fromIndex];
    const queryResults = this.grid?.query?.<boolean>('canMoveRow', row);
    if (Array.isArray(queryResults) && queryResults.includes(false)) return false;

    // canDrag veto (dragstart side)
    if (this.config.canDrag && !this.config.canDrag(row, fromIndex)) return false;

    // canDrop callback (intra-grid synthesised payload)
    if (this.config.canDrop) {
      const payload: RowDragPayload<T> = {
        sessionId: 'intra',
        sourceGridId: this.gridId,
        dropZone: this.config.dropZone ?? '',
        rows: [row],
        rowIndices: [fromIndex],
        operation: 'move',
      };
      if (!this.config.canDrop(payload, toIndex)) return false;
    }

    return true;
  }

  /**
   * Ask row-model plugins (Tree, GroupingRows) to resolve `query`:
   * `false` = veto, a resolution = handled, `undefined` = nobody owns the row
   * structure, so the identity splice of `sourceRows` applies.
   */
  private readonly resolveStructure: ResolveMove = (query) => {
    const answers = this.grid?.query?.<RowMoveResolution | false>('rows:resolve-move', query);
    if (!Array.isArray(answers)) return undefined;
    if (answers.includes(false)) return false;
    return answers.find((a): a is RowMoveResolution => !!a && typeof a === 'object');
  };

  /**
   * Plan moving the displayed row at `fromIndex` before/after the displayed
   * row at `toIndex` (`END_OF_ROWS` = after everything, e.g. a drop below the
   * last row). Rows are matched by IDENTITY against `sourceRows`: display
   * indices only line up with source indices when no plugin reshapes the rows
   * (filtering, grouping, tree). `null` = the move is not possible.
   *
   * `validateOnly` skips the O(n) identity splice and no-op check when no
   * row-model plugin answers — for `dragover`, keyboard and the move menu, which
   * only need a yes/no.
   */
  private planMove(
    fromIndex: number,
    toIndex: number,
    position: RowMovePosition,
    step?: RowMoveStep,
    validateOnly = false,
  ): PlannedMove | null {
    const rows = this.displayRows;
    const row = rows[fromIndex];
    const atEnd = toIndex === END_OF_ROWS;
    const target = atEnd ? null : rows[toIndex];
    if (row === undefined || target === undefined || fromIndex === toIndex) return null;
    const answer = this.resolveStructure({
      op: 'move',
      row,
      fromIndex,
      target,
      toIndex: atEnd ? rows.length - 1 : toIndex,
      position: atEnd ? 'after' : position,
      step,
    });
    if (answer === false) return null;
    if (answer) return { ...answer, structural: true };

    const source = this.sourceRows as T[];
    // Rows outside the source (group headers, pivot rows) can't be placed by identity.
    const from = sourceIndexOf(source, rows, fromIndex);
    const to = atEnd ? source.length - 1 : sourceIndexOf(source, rows, toIndex);
    if (from < 0 || to < 0) return null;
    if (validateOnly) return { rows: [], structural: false };
    const pos = atEnd ? 'after' : position;
    const next = moveAt(source, from, to, pos);
    // A pending keyboard move has reordered only `_rows`, so source order can't judge a no-op then.
    if (!this.pendingMove && next.every((r, i) => r === source[i])) return null;
    return { rows: next, structural: false, display: moveAt(rows, fromIndex, atEnd ? rows.length - 1 : toIndex, pos) };
  }

  /** Emit the cancelable `row-move` for `plan` and apply it. `false` when cancelled. */
  private commitMove(plan: PlannedMove, fromIndex: number, toIndex: number, source: 'keyboard' | 'drag'): boolean {
    const before = this.displayRows;
    const detail: RowMoveDetail<T> = {
      row: this.displayRows[fromIndex],
      fromIndex: plan.fromIndex ?? fromIndex,
      toIndex: plan.toIndex ?? toIndex,
      rows: plan.rows as T[],
      source,
    };
    if (plan.fromParent !== undefined) detail.fromParent = plan.fromParent as T | null;
    if (plan.toParent !== undefined) detail.toParent = plan.toParent as T | null;
    if (this.emitCancelable('row-move', detail)) return false;

    // FLIP's index math assumes a flat splice; a structural move relocates whole subtrees.
    if (!plan.structural && this.animationType === 'flip' && this.gridElement) {
      const oldPositions = this.captureRowPositions();
      this.grid.rows = plan.rows;
      requestAnimationFrame(() => {
        void this.gridElement.offsetHeight;
        this.animateFLIP(oldPositions, fromIndex, toIndex);
      });
    } else {
      this.grid.rows = plan.rows;
    }
    if (plan.structural) this.awaitingRender = true;
    else if (plan.display) {
      this.pendingDisplay = plan.display as T[];
      if (source === 'keyboard') this.trackDragMove(fromIndex, toIndex, plan.display, before);
    }
    return true;
  }

  /** Relative move from the keyboard-equivalent move menu; `toIndex` is the display neighbour. */
  private moveBy(fromIndex: number, step: RowMoveStep, toIndex: number, dryRun: boolean): boolean {
    if (!dryRun) [fromIndex, toIndex] = this.settlePending(fromIndex, toIndex);
    if (typeof step === 'string') toIndex = towardSourceRow(this.sourceRows, this.displayRows, toIndex, fromIndex);
    if (!this.canPickUp(fromIndex, toIndex)) return false;
    const plan = this.planMove(fromIndex, toIndex, toIndex < fromIndex ? 'before' : 'after', step, dryRun);
    if (!plan) return false;
    return dryRun || this.commitMove(plan, fromIndex, toIndex, 'keyboard');
  }

  /**
   * Settle a pending debounced keyboard move before anything else reads or
   * edits the rows — its timer would later re-apply a stale index, or find its
   * row gone and drop the move. The indices keep naming the same slots: only a
   * cancelled `row-move` changes the display, by one known revert, so they are
   * mapped through it (exact even when a row object repeats); an index past the
   * last row (an insert at the end) stays past it.
   */
  private settlePending(...indices: number[]): number[] {
    const length = this.displayRows.length;
    const revert = this.flushPendingMove();
    return revert ? indices.map((i) => (i < 0 || i >= length ? i : shiftedIndex(i, ...revert))) : indices;
  }

  /**
   * Source rows once the rows shown at `indices` have left for another grid
   * (`null` = vetoed). `rows` are the live rows when known (same window).
   */
  private planRemoval(rows: readonly T[] | null, indices: readonly number[]): unknown[] | null {
    const display = this.displayRows;
    const moved = rows ?? indices.map((i) => display[i]).filter((r) => r !== undefined);
    return sourceWithout(this.sourceRows, display, moved, indices, this.resolveStructure);
  }
  // #endregion

  // #region Drag Setup

  private setupDelegatedDragListeners(): void {
    const gridEl = this.gridElement;
    if (!gridEl) return;
    const signal = this.disconnectSignal;

    // Native DnD fires `dragstart` at the nearest `draggable` ancestor, so when
    // a nested grid is rendered INSIDE a row-draggable parent row (cell
    // renderer), a press on a child cell surfaces as a dragstart on the PARENT
    // row. Decide ownership at press time (`composedPath()` is empty once the
    // event has finished dispatching) so onDragStart can tell (#585). Capture
    // phase: the child grid's own listeners must not matter.
    gridEl.addEventListener('pointerdown', (e) => (this.pressInsideChild = !this.isOwnTarget(e)), {
      capture: true,
      signal,
    });

    gridEl.addEventListener('dragstart', (e) => this.onDragStart(e as DragEvent), { signal });
    gridEl.addEventListener('dragend', () => this.onDragEnd(), { signal });
    gridEl.addEventListener('dragover', (e) => this.onDragOver(e as DragEvent), { signal });
    gridEl.addEventListener('dragleave', (e) => this.onDragLeave(e as DragEvent), { signal });
    gridEl.addEventListener('drop', (e) => this.onDrop(e as DragEvent), { signal });
  }

  private onDragStart(de: DragEvent): void {
    const target = de.target as HTMLElement | null;
    // A drag picked up inside a nested grid belongs to that grid (#585).
    if (!target || !this.isOwnTarget(de)) return;

    // …including when the browser retargeted it to our draggable row because
    // the press landed in a non-draggable child grid inside that row. The
    // row is still `draggable`, so the drag must be cancelled, not ignored.
    const pressInsideChild = this.pressInsideChild;
    this.pressInsideChild = false;
    if (pressInsideChild) {
      de.preventDefault();
      return;
    }

    // Resolve the row element being picked up. Order matters: a click on the
    // grip column inside a row-draggable grid should still go through the
    // handle path so the cursor offset feels right.
    const handle = target.closest('.dg-row-drag-handle') as HTMLElement | null;
    let rowEl: HTMLElement | null = null;
    let initiatedFromHandle = false;
    if (handle) {
      rowEl = handle.closest('.data-grid-row') as HTMLElement | null;
      initiatedFromHandle = true;
    } else if (this.rowIsDraggable) {
      // Row-as-handle: any cell may start the drag, but interactive
      // descendants (inputs, buttons, anchors, contenteditable, open
      // editors, selection checkboxes) keep their native behaviour.
      if (this.isInteractiveDragOrigin(target)) return;
      rowEl = target.closest('.data-grid-row') as HTMLElement | null;
    }
    if (!rowEl) return;

    const [rowIndex] = this.settlePending(this.getRowIndex(rowEl));
    if (rowIndex < 0) return;

    // Resolve the rows being dragged: whole selection if dragged row is selected.
    const { rows, indices } = this.resolveDraggedRows(rowIndex);
    if (rows.length === 0) {
      de.preventDefault(); // a row-model plugin vetoed the selection (`pick`)
      return;
    }

    // canDrag veto on the originating row
    if (this.config.canDrag && !this.config.canDrag(rows[0], rowIndex)) {
      de.preventDefault();
      return;
    }

    const operation = this.config.operation ?? 'move';
    const dropZone = this.config.dropZone ?? '';
    const sessionId = newDragSessionId();

    // Emit cancelable row-drag-start (source-side veto)
    const startDetail: RowDragStartDetail<T> = { rows, indices, operation, dropZone };
    if (this.emitCancelable('row-drag-start', startDetail)) {
      de.preventDefault();
      return;
    }

    this.isDragging = true;
    this.draggedRows = rows;
    [this.draggedIndices, this.dragStartIndices] = [indices, indices.slice()];
    this.dragDisplay = [...this.displayRows];
    this.dragSessionId = sessionId;
    this.dragAccepted = false;
    this.unackedDrag = null;

    // Build the cross-grid payload (always built, even when dropZone is empty —
    // intra-grid drops still benefit from the registry round-trip)
    const serialize = this.config.serializeRow ?? ((r: T) => r);
    const payload: RowDragPayload<T> = {
      sessionId,
      sourceGridId: this.gridId,
      dropZone,
      rows: rows.map(serialize) as T[],
      rowIndices: indices,
      operation,
    };

    if (de.dataTransfer) {
      de.dataTransfer.effectAllowed = operation === 'copy' ? 'copyMove' : 'move';
      try {
        de.dataTransfer.setData(TBW_ROW_DRAG_MIME, encodePayload(payload));
        if (dropZone) de.dataTransfer.setData(mimeForZone(dropZone), encodePayload(payload));
        // Plain-text TSV fallback for external drop targets
        de.dataTransfer.setData('text/plain', formatRowsAsTSV(rows as Record<string, unknown>[], this.columns));
      } catch {
        /* JSDOM/happy-dom may throw on setData; harmless */
      }

      // Drag image: full-row clone for single-row drags, count badge for multi-row drags.
      setRowDragImage(de, rowEl, initiatedFromHandle ? handle : null, this.gridElement, rows.length);
    }

    // Same-window registry + current-session marker
    registerDragSession(sessionId, rows as unknown[]);
    setCurrentDragSession(sessionId, payload);

    rowEl.classList.add(GridClasses.DRAGGING);
    this.gridElement.classList.add('tbw-grid--drag-source');
  }

  /**
   * Selectors whose dragstart should NOT initiate a row drag in `dragFrom: 'row'`
   * mode. Keeps native interactions (text input, button clicks, link drag,
   * cell editing, selection checkboxes) working unchanged.
   */
  private static readonly INTERACTIVE_DRAG_SELECTORS =
    'input,textarea,select,button,a,[contenteditable=""],[contenteditable="true"],.dg-cell-editor,.tbw-checkbox-cell';

  /** @internal */
  private isInteractiveDragOrigin(target: HTMLElement): boolean {
    return target.closest(RowDragDropPlugin.INTERACTIVE_DRAG_SELECTORS) !== null;
  }

  private onDragOver(de: DragEvent): void {
    const dt = de.dataTransfer;
    if (!dt) return;

    // Identify whether a tbw row drag is in progress and whether it matches our zone.
    const types = dt.types ? Array.from(dt.types) : [];
    if (!hasAnyRowDragMime(types) && !this.isDragging) return;

    // Over a nested grid the child owns the drop target (#585). Stand down
    // explicitly: the auto-scroll loop keeps ticking on its last own pointerY
    // and the last own row keeps its indicator until told otherwise.
    if (!this.isOwnTarget(de)) {
      this.gridElement.classList.remove('tbw-grid--drop-target-active', 'tbw-grid--drop-target-rejected');
      this.clearDropTargetClasses();
      this.autoScroller?.stop();
      return;
    }

    const dropZone = this.config.dropZone ?? '';
    const session = getCurrentDragSession<T>();

    // For cross-grid drags we require a matching zone-tagged MIME OR the
    // session payload's dropZone must match ours.
    const isIntra = this.isDragging && session?.payload.sourceGridId === this.gridId;
    if (!isIntra) {
      if (!dropZone) return; // intra-grid only — ignore external drags
      const matchingMime = findMatchingZoneMime(types, dropZone);
      if (!matchingMime && !(session && session.payload.dropZone === dropZone)) return;
    }

    de.preventDefault();
    if (dt) dt.dropEffect = (session?.payload.operation ?? this.config.operation ?? 'move') as 'copy' | 'move';

    // Compute drop position
    const rowEl = (de.target as HTMLElement).closest('.data-grid-row') as HTMLElement | null;
    const rows = this.internalGrid._rows ?? [];
    const pos = computeDropPosition(rowEl, de.clientY, (el) => this.getRowIndex(el), rows.length);

    // Same-row no-op for intra-grid
    if (isIntra && pos.overIndex !== null && pos.overIndex === this.draggedIndices[0]) {
      this.dropRowIndex = null;
      this.dropTarget = null;
      this.clearDropTargetClasses();
      return;
    }

    // canDrop check (same-window only — payload visible), plus the row model's
    // rules for an intra-grid move (e.g. Tree's sibling / reparent rules). Both
    // classes toggle on every hover, so an allowed spot clears an earlier rejection.
    const structuralOk = !isIntra || this.dropAllowed(pos.overIndex ?? END_OF_ROWS, pos.isBefore);
    const accepted =
      structuralOk && (!session || !this.config.canDrop || this.config.canDrop(session.payload, pos.insertIndex));
    this.gridElement.classList.toggle('tbw-grid--drop-target-active', accepted);
    this.gridElement.classList.toggle('tbw-grid--drop-target-rejected', !accepted);
    if (!accepted) {
      this.dropRowIndex = null;
      this.dropTarget = null;
      this.clearDropTargetClasses();
      return;
    }

    this.dropRowIndex = pos.insertIndex;
    this.dropTarget = pos.overIndex === null ? null : { index: pos.overIndex, before: pos.isBefore };
    this.applyDropPositionClasses(rowEl, pos.isBefore);

    // Auto-scroll the target viewport
    if (this.config.autoScroll !== false) {
      this.ensureAutoScroller();
      this.autoScroller?.onPointerMove(de.clientY);
    }
  }

  private onDragLeave(de: DragEvent): void {
    // A nested grid's row keeps its own classes (#585); the grid-level
    // teardown below still applies because the child sits inside this host.
    if (this.isOwnTarget(de)) {
      const rowEl = (de.target as HTMLElement).closest('.data-grid-row') as HTMLElement | null;
      if (rowEl) rowEl.classList.remove('drop-target', 'drop-before', 'drop-after');
    }
    // Tear down grid-level state when the cursor leaves the grid entirely
    if (de.currentTarget && !this.gridElement.contains(de.relatedTarget as Node)) {
      this.gridElement.classList.remove('tbw-grid--drop-target-active', 'tbw-grid--drop-target-rejected');
      this.autoScroller?.stop();
    }
  }

  private onDrop(de: DragEvent): void {
    if (!this.isOwnTarget(de)) return;
    de.preventDefault();
    this.autoScroller?.stop();
    this.gridElement.classList.remove('tbw-grid--drop-target-active', 'tbw-grid--drop-target-rejected');
    this.clearDropTargetClasses();

    const dt = de.dataTransfer;
    if (!dt) return;

    // Resolve payload — prefer same-window session, fall back to dataTransfer JSON
    const session = getCurrentDragSession<T>();
    let payload: RowDragPayload<T> | null = session?.payload ?? null;
    let liveRows: T[] | null = null;

    if (payload) {
      const lookup = lookupDragSession<T>(payload.sessionId);
      if (lookup) liveRows = lookup;
    } else {
      const raw = dt.getData(TBW_ROW_DRAG_MIME);
      payload = decodePayload<T>(raw);
      if (payload) {
        const lookup = lookupDragSession<T>(payload.sessionId);
        if (lookup) liveRows = lookup;
      }
    }
    // A dragged row left the display mid-drag (`trackRows` emptied the indices): nothing to drop.
    if (!payload || (payload.rows.length > 0 && payload.rowIndices.length === 0)) return;

    // Drop position (recompute in case dragover wasn't called for a few frames)
    const rowEl = (de.target as HTMLElement).closest('.data-grid-row') as HTMLElement | null;
    const rows = this.internalGrid._rows ?? [];
    const pos = computeDropPosition(rowEl, de.clientY, (el) => this.getRowIndex(el), rows.length);
    let targetIndex = this.dropRowIndex ?? pos.insertIndex;

    const isIntra = payload.sourceGridId === this.gridId;
    const dropZone = this.config.dropZone ?? '';

    if (isIntra) {
      // Intra-grid path — emit `row-move`. The row under the pointer and its
      // half decide the move: "after the last child of A" and "before B" share
      // an insert index but mean different parents in a tree.
      const fromIndex = payload.rowIndices[0];
      const over = this.dropTarget ??
        (pos.overIndex !== null ? { index: pos.overIndex, before: pos.isBefore } : null) ?? {
          // Below the last row: the end of the list (a tree's top level), not after its last descendant.
          index: END_OF_ROWS,
          before: false,
        };
      // Final index of a flat splice (single-row only), reported as `toIndex`.
      if (payload.rowIndices.length === 1 && targetIndex > fromIndex) targetIndex--;
      if (!this.canPickUp(fromIndex, targetIndex)) return;
      const plan = this.planMove(fromIndex, over.index, over.before ? 'before' : 'after');
      if (plan) this.commitMove(plan, fromIndex, targetIndex, 'drag');
      return;
    }

    // Cross-grid path
    if (!dropZone || dropZone !== payload.dropZone) return;
    [targetIndex] = this.settlePending(targetIndex);

    // canDrop final check
    if (this.config.canDrop && !this.config.canDrop(payload, targetIndex)) {
      this.gridElement.classList.add('tbw-grid--drop-target-rejected');
      setTimeout(() => this.gridElement.classList.remove('tbw-grid--drop-target-rejected'), 200);
      return;
    }

    // Resolve final row references — live (same-window) or deserialized JSON
    const deserialize = this.config.deserializeRow ?? ((r: unknown) => r as T);
    const incomingRows: T[] = liveRows ?? payload.rows.map((r) => deserialize(r as unknown));

    // Locate the source plugin in THIS window. If it's here we handle the
    // source-side mutation directly; if it isn't, we broadcast a message and
    // let the source-window plugin (if any) handle removal + transfer emit.
    const sourcePlugin = this.findPeerOnGrid(payload.sourceGridId);

    // Plan both halves (by identity — see `row-order.ts`) before committing
    // either, so a row-model veto on one side leaves both grids untouched.
    const nextTarget = sourceWith(this.sourceRows, this.displayRows, incomingRows, targetIndex, this.resolveStructure);
    const nextSource =
      payload.operation === 'move' && sourcePlugin ? sourcePlugin.planRemoval(liveRows, payload.rowIndices) : undefined;
    if (!nextTarget || nextSource === null) return;

    const dropDetail: RowDropDetail<T> = {
      payload,
      sourceGridId: payload.sourceGridId,
      targetIndex,
      operation: payload.operation,
    };
    if (this.emitCancelable('row-drop', dropDetail)) return;

    this.grid.rows = nextTarget;
    if (sourcePlugin && nextSource) sourcePlugin.grid.rows = nextSource;

    // Mark accepted on the source plugin so dragend knows (same-window only —
    // cross-window source flips its own flag in `onRemoteTransfer`).
    if (sourcePlugin) sourcePlugin.dragAccepted = true;

    // Emit row-transfer on the target. The source's `row-transfer` is fired
    // either here (same-window) or by the source plugin in `onRemoteTransfer`
    // (cross-window).
    const transferDetail: RowTransferDetail<T> = {
      rows: incomingRows,
      fromGridId: payload.sourceGridId,
      toGridId: this.gridId,
      fromIndices: payload.rowIndices,
      toIndex: targetIndex,
      operation: payload.operation,
    };
    this.emit('row-transfer', transferDetail);

    if (sourcePlugin) {
      sourcePlugin.emitTransfer(transferDetail);
    } else {
      // Cross-window: broadcast so the source window can finish its half of
      // the transfer (row removal on `move`, `row-transfer` emit, accepted flip).
      broadcastRemoteTransfer({
        type: 'tbw-row-drag-drop:transfer',
        sessionId: payload.sessionId,
        sourceGridId: payload.sourceGridId,
        toGridId: this.gridId,
        dropZone,
        rowIndices: payload.rowIndices,
        toIndex: targetIndex,
        operation: payload.operation,
        // Re-use the payload's already-serialized rows so the source side can
        // round-trip them through `deserializeRow` for its `row-transfer` event.
        serializedRows: payload.rows as unknown[],
      });
    }
  }

  /**
   * Source-window handler for a remote `row-transfer` broadcast from a target
   * window. Only runs on the plugin instance whose grid id matches the message.
   * @internal
   */
  private onRemoteTransfer(msg: RemoteTransferMessage): void {
    if (msg.sourceGridId !== this.gridId) return;
    // Defensive: only act when the message zone matches our zone. This prevents
    // a stray message from a grid sharing the same id but a different zone
    // (e.g. independent demos in different tabs) from mutating our rows.
    const dropZone = this.config.dropZone ?? '';
    if (!dropZone || msg.dropZone !== dropZone) return;

    if (msg.operation === 'move' && this.isDragging && this.dragSessionId === msg.sessionId && this.dragAccepted)
      return;

    // Resolve incoming rows (for the `row-transfer` event payload).
    const deserialize = this.config.deserializeRow ?? ((r: unknown) => r as T);
    const incomingRows: T[] = msg.serializedRows.map((r) => deserialize(r));

    if (msg.operation === 'move') {
      // The echoed `rowIndices` are dragstart's; renders since then may have shifted
      // the rows, so remove the occurrences this window tracked for the session (#666).
      // An unknown session is not a drag of ours (or one already settled): ignore it.
      if (!this.dragSelection(msg.sessionId)) return;
      this.settlePending();
      const drag = this.dragSelection(msg.sessionId);
      if (!drag) return;
      this.unackedDrag = null;
      const indices = [...drag.indices];
      trackRows(drag.display, this.displayRows, drag.rows, indices);
      // The target window already committed; a vetoed removal can only leave the source as-is.
      const next = this.planRemoval(drag.rows, indices);
      if (next) {
        this.awaitingRender = true;
        this.grid.rows = next;
      }
    }

    // Flip accepted before dragend (best-effort — the message may arrive after
    // dragend has already fired with `accepted: false`; `row-transfer` is the
    // authoritative success signal).
    if (this.isDragging && this.dragSessionId === msg.sessionId) this.dragAccepted = true;

    this.emit('row-transfer', {
      rows: incomingRows,
      fromGridId: msg.sourceGridId,
      toGridId: msg.toGridId,
      fromIndices: msg.rowIndices,
      toIndex: msg.toIndex,
      operation: msg.operation,
    } as RowTransferDetail<T>);
  }

  private onDragEnd(): void {
    if (this.dragSessionId) clearDragSession(this.dragSessionId);
    clearCurrentDragSession();
    this.autoScroller?.stop();
    this.gridElement.classList.remove('tbw-grid--drag-source');

    if (this.isDragging) {
      this.flushPendingMove();
      const indices = this.dragStartIndices.slice();
      const endDetail: RowDragEndDetail<T> = { rows: this.draggedRows, indices, accepted: this.dragAccepted };
      this.emit('row-drag-end', endDetail);
      // A target in another window acknowledges over the channel, possibly after this dragend.
      const awaitsRemote = !this.dragAccepted && !!this.config.dropZone && (this.config.operation ?? 'move') === 'move';
      this.unackedDrag = awaitsRemote ? this.dragSelection(this.dragSessionId) : null;
    }
    this.clearDragClasses();
    this.resetDragState();
  }

  /** The rows drag `sessionId` picked up, while dragging or after an unacknowledged `dragend`. */
  private dragSelection(sessionId: string | null): DragSelection<T> | null {
    if (sessionId === null) return null;
    if (this.isDragging && this.dragSessionId === sessionId) {
      return { sessionId, rows: this.draggedRows, indices: [...this.draggedIndices], display: this.dragDisplay };
    }
    return this.unackedDrag?.sessionId === sessionId ? this.unackedDrag : null;
  }
  // #endregion

  // #region Helpers

  /** Public wrapper so a peer plugin can dispatch `row-transfer` on this grid. @internal */
  emitTransfer(detail: RowTransferDetail<T>): void {
    this.emit('row-transfer', detail);
  }

  /** Find the peer `RowDragDropPlugin` instance on another grid by id. */
  private findPeerOnGrid(gridId: string): RowDragDropPlugin<T> | null {
    const peerEl = document.getElementById(gridId) as
      (HTMLElement & { getPluginByName?: (name: string) => RowDragDropPlugin<T> | undefined }) | null;
    if (!peerEl?.getPluginByName) return null;
    return peerEl.getPluginByName('rowDragDrop') ?? null;
  }

  // #region Click-only move menu (WCAG 2.2 SC 2.5.7)

  /** Grids in this window sharing our (non-empty) `dropZone`. */
  private peersInDropZone(): RowDragDropPlugin<T>[] {
    const dropZone = this.config.dropZone ?? '';
    if (!dropZone) return [];
    const peers: RowDragDropPlugin<T>[] = [];
    for (const candidate of attachedPlugins) {
      const peer = candidate as RowDragDropPlugin<T>;
      if (peer === this) continue;
      if ((peer.config.dropZone ?? '') === dropZone) peers.push(peer);
    }
    return peers;
  }

  /** Human-readable name for this grid, used in the transfer menu. */
  private get gridLabel(): string {
    const host = this.gridElement;
    return host?.getAttribute('aria-label') || host?.id || 'grid';
  }

  /**
   * Open the click-only alternative to dragging a row: reorder within this grid
   * and, when a `dropZone` is configured, send the row to a peer grid — all
   * with single clicks or taps, no press-hold-move gesture.
   */
  private openMoveMenu(handle: HTMLElement): void {
    const rowEl = handle.closest('.data-grid-row') as HTMLElement | null;
    if (!rowEl) return;
    const [rowIndex] = this.settlePending(this.getRowIndex(rowEl));
    if (rowIndex < 0) return;

    const rows = this.displayRows;
    const last = rows.length - 1;
    const option = (label: string, step: RowMoveStep, toIndex: number): DragAlternativeAction => ({
      label,
      disabled: !this.moveBy(rowIndex, step, toIndex, true),
      run: () => this.moveBy(rowIndex, step, toIndex, false),
    });
    const actions: DragAlternativeAction[] = [
      option('Move up', -1, rowIndex - 1),
      option('Move down', 1, rowIndex + 1),
      option('Move to top', 'first', 0),
      option('Move to bottom', 'last', last),
    ];

    const verb = (this.config.operation ?? 'move') === 'copy' ? 'Copy to' : 'Send to';
    for (const peer of this.peersInDropZone()) {
      actions.push({
        label: `${verb} ${peer.gridLabel}`,
        run: () => this.transferToPeer(peer, rowIndex),
      });
    }

    this.moveMenu ??= createDragAlternativeMenu('tbw-row-move-menu', 'tbw-row-move-menu');
    this.moveMenu.open(handle, `Move row ${rowIndex + 1}`, actions);
  }

  /**
   * Click-only equivalent of dropping the row onto `peer`. Runs the same vetoes
   * and emits the same events as the drag path (`row-drag-start`, `row-drop`,
   * `row-transfer`) so consumers cannot tell the two apart.
   */
  private transferToPeer(peer: RowDragDropPlugin<T>, rowIndex: number): void {
    const dropZone = this.config.dropZone ?? '';
    if (!dropZone) return;

    const { rows, indices } = this.resolveDraggedRows(rowIndex);
    if (rows.length === 0) return;
    if (this.config.canDrag && !this.config.canDrag(rows[0], rowIndex)) return;

    const operation = this.config.operation ?? 'move';
    if (this.emitCancelable('row-drag-start', { rows, indices, operation, dropZone } as RowDragStartDetail<T>)) return;

    const serialize = this.config.serializeRow ?? ((r: T) => r);
    const payload: RowDragPayload<T> = {
      sessionId: newDragSessionId(),
      sourceGridId: this.gridId,
      dropZone,
      rows: rows.map(serialize) as T[],
      rowIndices: indices,
      operation,
    };

    // Plan the source half first: a row-model veto must cancel before the peer commits.
    const nextSource = operation === 'move' ? this.planRemoval(rows, indices) : undefined;
    if (nextSource === null) return;

    const toIndex = peer.acceptTransfer(payload, rows);
    if (toIndex < 0) return;

    if (nextSource) this.grid.rows = nextSource;

    const detail: RowTransferDetail<T> = {
      rows,
      fromGridId: this.gridId,
      toGridId: peer.gridId,
      fromIndices: indices,
      toIndex,
      operation,
    };
    peer.emitTransfer(detail);
    this.emit('row-transfer', detail);
  }

  /**
   * Target half of {@link RowDragDropPlugin.transferToPeer}. Returns the insert
   * index, or `-1` when the transfer was rejected (zone mismatch, `canDrop`
   * veto, a row-model veto, or a cancelled `row-drop`).
   *
   * @internal
   */
  acceptTransfer(payload: RowDragPayload<T>, liveRows: readonly T[]): number {
    const dropZone = this.config.dropZone ?? '';
    if (!dropZone || dropZone !== payload.dropZone) return -1;
    this.settlePending();

    const targetIndex = this.displayRows.length;
    if (this.config.canDrop && !this.config.canDrop(payload, targetIndex)) return -1;
    const next = sourceWith(this.sourceRows, this.displayRows, liveRows, targetIndex, this.resolveStructure);
    if (!next) return -1;

    const dropDetail: RowDropDetail<T> = {
      payload,
      sourceGridId: payload.sourceGridId,
      targetIndex,
      operation: payload.operation,
    };
    if (this.emitCancelable('row-drop', dropDetail)) return -1;

    this.grid.rows = next;
    return targetIndex;
  }
  // #endregion

  private resolveDraggedRows(originIndex: number): { rows: T[]; indices: number[] } {
    const rows = this.internalGrid._rows ?? this.sourceRows;
    const originRow = rows[originIndex] as T;

    // If a selection plugin is loaded and the dragged row is selected, drag the whole selection.
    const selection = this.grid?.getPluginByName?.('selection') as
      { getSelectedRowIndices?: () => number[]; getSelectedRows?: <U>() => U[] } | undefined;
    if (selection?.getSelectedRowIndices) {
      const selectedIndices = selection.getSelectedRowIndices();
      if (selectedIndices.includes(originIndex) && selectedIndices.length > 1) {
        const sorted = [...selectedIndices].sort((a, b) => a - b);
        // Row-model plugins (Tree) drop rows that travel inside another selected row's subtree —
        // decided here, before the payload is serialised and identity is lost.
        const picked = this.resolveStructure({ op: 'pick', rows: sorted.map((i) => rows[i]) });
        if (picked === false) return { rows: [], indices: [] }; // vetoed: callers stop on an empty selection
        const keep = picked && new Set(picked.rows);
        const kept = keep ? sorted.filter((i) => keep.has(rows[i])) : sorted;
        return { rows: kept.map((i) => rows[i] as T), indices: kept };
      }
    }
    return { rows: [originRow], indices: [originIndex] };
  }

  private ensureAutoScroller(): void {
    if (this.autoScroller) return;
    const viewport = this.gridElement.querySelector<HTMLElement>('.rows-viewport');
    if (!viewport) return;
    const opts = typeof this.config.autoScroll === 'object' ? this.config.autoScroll : undefined;
    this.autoScroller = createAutoScroller(viewport, opts, (active) => {
      this.gridElement.classList.toggle('tbw-grid--auto-scrolling', active);
    });
  }

  private applyDropPositionClasses(rowEl: HTMLElement | null, isBefore: boolean): void {
    this.clearDropTargetClasses();
    if (!rowEl) return;
    rowEl.classList.add('drop-target');
    rowEl.classList.toggle('drop-before', isBefore);
    rowEl.classList.toggle('drop-after', !isBefore);
  }

  private clearDropTargetClasses(): void {
    for (const row of this.#ownRows('.data-grid-row.drop-target')) {
      row.classList.remove('drop-target', 'drop-before', 'drop-after');
    }
  }

  private clearDragClasses(): void {
    for (const row of this.#ownRows()) {
      row.classList.remove(GridClasses.DRAGGING, 'drop-target', 'drop-before', 'drop-after');
    }
  }

  private resetDragState(): void {
    this.isDragging = false;
    this.dragDisplay = this.draggedRows = [];
    this.draggedIndices = this.dragStartIndices = [];
    this.dragSessionId = null;
    this.dragAccepted = false;
    this.dropRowIndex = this.dropTarget = this.dropCheck = null;
    this.pendingMove = null;
  }

  /** Whether the row model accepts dropping the dragged row before/after display row `index` (memoised per spot). */
  private dropAllowed(index: number, before: boolean): boolean {
    const memo = this.dropCheck;
    if (memo && memo.index === index && memo.before === before) return memo.ok;
    // The first row actually dragged (`pick` may have narrowed the selection to the pressed row's parent) — as `onDrop` moves.
    const from = this.draggedIndices[0] ?? null;
    const ok = from !== null && this.planMove(from, index, before ? 'before' : 'after', undefined, true) !== null;
    this.dropCheck = { index, before, ok };
    return ok;
  }

  /**
   * Data index of a row element, or -1 when it is not one of this grid's rows.
   * The single chokepoint every drag handler and the move menu resolve through,
   * so a nested grid's row (same class, own `data-row`) is rejected here once.
   * StickyRows clones stay valid: their nearest grid is still this one.
   */
  private getRowIndex(rowEl: HTMLElement): number {
    if (!this.isOwnTarget(rowEl)) return -1;
    const cell = rowEl.querySelector(':scope > .cell[data-row]');
    return cell ? parseInt(cell.getAttribute('data-row') ?? '-1', 10) : -1;
  }

  /**
   * The grid's own row elements: direct children of `.rows` plus the own
   * StickyRows overlay (`.tbw-sticky-rows`, a `.rows` sibling whose clones keep
   * the source row's `draggable`/drag classes and are valid drag targets).
   * Overlay first = previous document order. The grid renders in light DOM, so
   * a nested `<tbw-grid>` in a master-detail panel or cell renderer lives INSIDE
   * `.rows` — a descendant `.data-grid-row` query would mark/unmark the child
   * grid's rows (#581).
   */
  #ownRows(selector = '.data-grid-row'): HTMLElement[] {
    const body = this.internalGrid?._bodyEl;
    if (!body) return [];
    const sticky = body.parentElement?.querySelector<HTMLElement>(':scope > .tbw-sticky-rows');
    const scopes = sticky ? [sticky, body] : [body];
    return scopes.flatMap((scope) => Array.from(scope.querySelectorAll<HTMLElement>(`:scope > ${selector}`)));
  }

  private clearDebounceTimer(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  // #endregion

  // #region Intra-Grid Move

  private handleKeyboardMove(row: T, fromIndex: number, toIndex: number, focusCol: number): void {
    if (!this.pendingMove) {
      const sourceIndex = sourceIndexOf(this.sourceRows, this.displayRows, fromIndex);
      this.pendingMove = { originalIndex: fromIndex, currentIndex: toIndex, row, sourceIndex };
    } else {
      this.pendingMove.currentIndex = toIndex;
    }
    this.lastFocusCol = focusCol;

    const grid = this.internalGrid;
    const rows = [...this.displayRows];
    const [movedRow] = rows.splice(fromIndex, 1);
    rows.splice(toIndex, 0, movedRow);

    this.trackDragMove(fromIndex, toIndex, rows, this.displayRows);
    grid._rows = rows;
    this.pendingDisplay = null;
    grid._focusRow = toIndex;
    grid._focusCol = focusCol;
    grid.refreshVirtualWindow(true);
    ensureCellVisible(grid);

    this.clearDebounceTimer();
    this.debounceTimer = setTimeout(() => this.flushPendingMove(), this.config.debounceMs ?? 300);
  }

  /** Commit (or drop) the pending debounced move. Returns the display move a cancelled `row-move` reverted (`[from, to]`), else `null`. */
  private flushPendingMove(): [number, number] | null {
    this.clearDebounceTimer();
    if (!this.pendingMove) return null;
    const { originalIndex, currentIndex, row: movedRow, sourceIndex } = this.pendingMove;
    this.pendingMove = null;
    if (originalIndex === currentIndex) return null;

    const grid = this.internalGrid;
    // `grid._rows` already reflects the post-move order (mutated incrementally
    // by `handleKeyboardMove`). Translate it to SOURCE order by identity —
    // `_rows` can hold group headers or omit filtered-out rows (#663).
    const display = this.displayRows;
    // The display was rebuilt under the pending move (new data, a filter hiding it): nothing to place.
    const rows =
      this.sourceRows[sourceIndex] === movedRow
        ? sourceOrderAfterMove(this.sourceRows as T[], display, sourceIndex, currentIndex)
        : null;
    if (!rows) return null;
    const detail: RowMoveDetail<T> = {
      row: movedRow as T,
      fromIndex: originalIndex,
      toIndex: currentIndex,
      rows,
      source: 'keyboard',
    };
    const cancelled = this.emitCancelable('row-move', detail);
    if (cancelled) {
      // Revert: `sourceRows` was never touched during the pending move, only
      // `grid._rows` was — move that one occurrence back (other copies stay).
      const reverted = moveAt(display, currentIndex, originalIndex, currentIndex < originalIndex ? 'after' : 'before');
      grid._rows = reverted;
      this.trackDragMove(currentIndex, originalIndex, reverted, display);
      grid._focusRow = originalIndex;
      grid._focusCol = this.lastFocusCol;
      grid.refreshVirtualWindow(true);
      ensureCellVisible(grid);
      return [currentIndex, originalIndex];
    }
    // Persist, so the next row-model rebuild (sort, filter, group toggle) keeps the order. Until it
    // renders, `_rows` is about to be overwritten: later moves must commit at once (as `commitMove`).
    this.grid.rows = rows;
    this.pendingDisplay = display;
    return null;
  }

  /** Keep a drag's exact displayed occurrences aligned across keyboard splices. */
  private trackDragMove(
    fromIndex: number,
    toIndex: number,
    display: readonly unknown[],
    before: readonly unknown[],
  ): void {
    const indices = this.isDragging ? this.draggedIndices : this.unackedDrag?.indices;
    if (!indices || indices.length === 0) return;
    if (!this.isDragging && this.unackedDrag) {
      this.unackedDrag.display = trackRows(this.unackedDrag.display, before, this.unackedDrag.rows, indices);
    }
    for (let i = 0; i < indices.length; i++) indices[i] = shiftedIndex(indices[i], fromIndex, toIndex);
    if (this.isDragging) this.dragDisplay = [...display];
    else if (this.unackedDrag) this.unackedDrag.display = [...display];
  }

  private captureRowPositions(): Map<number, number> {
    const positions = new Map<number, number>();
    for (const row of this.#ownRows()) {
      const rowIndex = this.getRowIndex(row);
      if (rowIndex >= 0) positions.set(rowIndex, row.getBoundingClientRect().top);
    }
    return positions;
  }

  private animateFLIP(oldPositions: Map<number, number>, fromIndex: number, toIndex: number): void {
    const gridEl = this.gridElement;
    if (!gridEl || oldPositions.size === 0) return;

    const minIndex = Math.min(fromIndex, toIndex);
    const maxIndex = Math.max(fromIndex, toIndex);
    const rowsToAnimate: { el: HTMLElement; deltaY: number }[] = [];

    for (const rowEl of this.#ownRows()) {
      const newRowIndex = this.getRowIndex(rowEl);
      if (newRowIndex < 0 || newRowIndex < minIndex || newRowIndex > maxIndex) continue;
      const oldTop = oldPositions.get(shiftedIndex(newRowIndex, toIndex, fromIndex)); // where it was before the move
      if (oldTop === undefined) continue;
      const newTop = rowEl.getBoundingClientRect().top;
      const deltaY = oldTop - newTop;
      if (Math.abs(deltaY) > 1) rowsToAnimate.push({ el: rowEl, deltaY });
    }

    if (rowsToAnimate.length === 0) return;

    rowsToAnimate.forEach(({ el, deltaY }) => {
      el.style.transform = `translateY(${deltaY}px)`;
    });
    void gridEl.offsetHeight;

    const duration = this.animationDuration;
    requestAnimationFrame(() => {
      rowsToAnimate.forEach(({ el }) => {
        el.classList.add('flip-animating');
        el.style.transform = '';
      });
      setTimeout(() => {
        rowsToAnimate.forEach(({ el }) => {
          el.style.transform = '';
          el.classList.remove('flip-animating');
        });
      }, duration + 50);
    });
  }

  // #endregion
}
