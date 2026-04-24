/**
 * Row Drag-Drop Plugin
 *
 * Drag rows within a single grid (parity with the deprecated
 * `RowReorderPlugin`) **and** between grids that share a `dropZone`.
 *
 * Architecture overview is documented in the issue body and in
 * `.github/knowledge/grid-plugins.md`. Key invariants:
 *
 * - Mutations write to `grid._rows`; the user's input `sourceRows` array is
 *   never mutated on either side. Persistence is consumer-driven via the
 *   `row-move` (intra-grid) and `row-transfer` (cross-grid) events.
 * - Same-window cross-grid drops use the WeakRef registry in
 *   `core/internal/drag-drop-registry` to recover live row references.
 *   Cross-window drops fall back to `JSON.parse(JSON.stringify(row))` (or the
 *   `serializeRow`/`deserializeRow` hooks for non-JSON values).
 * - `RowReorderPlugin` is an alias re-export of this class. The PluginManager
 *   alias-collapse pre-pass merges configs when both names are instantiated.
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
import { BaseGridPlugin, type GridElement, type PluginManifest } from '../../core/plugin/base-plugin';
import type { ColumnConfig, GridHost } from '../../core/types';
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
import styles from './row-drag-drop.css?inline';
import type {
  PendingMove,
  RowDragDropConfig,
  RowDragEndDetail,
  RowDragStartDetail,
  RowDropDetail,
  RowMoveDetail,
  RowTransferDetail,
} from './types';

/** Field name for the drag handle column. */
export const ROW_DRAG_HANDLE_FIELD = '__tbw_row_drag';

/**
 * Row Drag-Drop Plugin for `<tbw-grid>`.
 *
 * @example Intra-grid (parity with deprecated `RowReorderPlugin`)
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

  /**
   * Backwards-compatible aliases. `RowReorderPlugin`'s legacy plugin name
   * (`reorderRows`) and short alias (`rowReorder`) both resolve here so that
   * `getPluginByName('reorderRows')` keeps working.
   * @internal
   */
  override readonly aliases = ['reorderRows', 'rowReorder'] as const;

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

  /** @internal */
  protected override get defaultConfig(): Partial<RowDragDropConfig<T>> {
    return {
      enableKeyboard: true,
      showDragHandle: true,
      dragHandlePosition: 'left',
      dragHandleWidth: 40,
      debounceMs: 150,
      animation: 'flip',
      operation: 'move',
      autoScroll: true,
    };
  }

  /** Resolve animation type from plugin config (respects grid-level reduced-motion). */
  private get animationType(): false | 'flip' {
    if (!this.isAnimationEnabled) return false;
    if (this.config.animation !== undefined) return this.config.animation;
    return 'flip';
  }

  // #region Internal State
  private isDragging = false;
  private draggedRowIndex: number | null = null;
  private draggedRows: T[] = [];
  private draggedIndices: number[] = [];
  private dragSessionId: string | null = null;
  private dragAccepted = false;
  private dropRowIndex: number | null = null;
  private pendingMove: PendingMove | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastFocusCol = 0;
  private autoScroller: AutoScroller | null = null;
  /** Stable id for this grid instance (used as `sourceGridId` in payloads). */
  private gridId = '';

  /** Typed internal grid accessor. */
  private get internalGrid(): GridHost {
    return this.grid as unknown as GridHost;
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
    }
  }

  /** @internal */
  override detach(): void {
    this.clearDebounceTimer();
    this.autoScroller?.stop();
    this.autoScroller = null;
    if (this.dragSessionId) clearDragSession(this.dragSessionId);
    clearCurrentDragSession();
    this.resetDragState();
    super.detach();
  }
  // #endregion

  // #region Hooks

  /** @internal */
  override processColumns(columns: readonly ColumnConfig[]): ColumnConfig[] {
    if (!this.config.showDragHandle) return [...columns];

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
        container.setAttribute('aria-label', 'Drag to reorder');
        container.setAttribute('role', 'button');
        container.setAttribute('tabindex', '-1');
        container.draggable = true;
        this.setIcon(container, 'dragHandle');
        return container;
      },
    };

    return this.config.dragHandlePosition === 'right' ? [...columns, dragHandleColumn] : [dragHandleColumn, ...columns];
  }

  /** @internal */
  override afterRender(): void {
    /* drag listeners are delegated; nothing to do per render */
  }

  /** @internal */
  override onKeyDown(event: KeyboardEvent): boolean | void {
    if (!this.config.enableKeyboard) return;
    if (!event.ctrlKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;

    const grid = this.internalGrid;
    const focusRow = grid._focusRow;
    const rows = grid._rows ?? this.sourceRows;
    if (focusRow < 0 || focusRow >= rows.length) return;

    const direction = event.key === 'ArrowUp' ? 'up' : 'down';
    const toIndex = direction === 'up' ? focusRow - 1 : focusRow + 1;
    if (toIndex < 0 || toIndex >= rows.length) return;

    const row = rows[focusRow];
    if (!this.canMoveRow(focusRow, toIndex)) return;

    this.handleKeyboardMove(row, focusRow, toIndex, grid._focusCol);
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  /** @internal */
  override onCellClick(): void {
    this.flushPendingMove();
  }
  // #endregion

  // #region Public API
  /** Move a row to a new position programmatically (intra-grid). */
  moveRow(fromIndex: number, toIndex: number): void {
    const rows = [...this.sourceRows];
    if (fromIndex < 0 || fromIndex >= rows.length) return;
    if (toIndex < 0 || toIndex >= rows.length) return;
    if (fromIndex === toIndex) return;
    if (!this.canMoveRow(fromIndex, toIndex)) return;
    this.executeIntraGridMove(rows[fromIndex], fromIndex, toIndex, 'keyboard');
  }

  /**
   * Check if a row can be moved within this grid.
   * Consults the user-provided `canMove` callback (or `canDrag` veto for the
   * source row), the plugin query system (`canMoveRow`), and `canDrop` for
   * the target.
   */
  canMoveRow(fromIndex: number, toIndex: number): boolean {
    const rows = this.sourceRows;
    if (fromIndex < 0 || fromIndex >= rows.length) return false;
    if (toIndex < 0 || toIndex >= rows.length) return false;
    if (fromIndex === toIndex) return false;

    // Plugin query veto (Tree, GroupingRows)
    const row = rows[fromIndex] as T;
    const queryResults = this.grid?.query?.<boolean>('canMoveRow', row);
    if (Array.isArray(queryResults) && queryResults.includes(false)) return false;

    // canDrag veto (dragstart side)
    if (this.config.canDrag && !this.config.canDrag(row, fromIndex)) return false;

    // Legacy canMove callback
    if (this.config.canMove) {
      const direction = toIndex < fromIndex ? 'up' : 'down';
      if (!this.config.canMove(row, fromIndex, toIndex, direction)) return false;
    }

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
  // #endregion

  // #region Drag Setup

  private setupDelegatedDragListeners(): void {
    const gridEl = this.gridElement;
    if (!gridEl) return;
    const signal = this.disconnectSignal;

    gridEl.addEventListener('dragstart', (e) => this.onDragStart(e as DragEvent), { signal });
    gridEl.addEventListener('dragend', () => this.onDragEnd(), { signal });
    gridEl.addEventListener('dragover', (e) => this.onDragOver(e as DragEvent), { signal });
    gridEl.addEventListener('dragleave', (e) => this.onDragLeave(e as DragEvent), { signal });
    gridEl.addEventListener('drop', (e) => this.onDrop(e as DragEvent), { signal });
  }

  private onDragStart(de: DragEvent): void {
    const handle = (de.target as HTMLElement).closest('.dg-row-drag-handle') as HTMLElement | null;
    if (!handle) return;
    const rowEl = handle.closest('.data-grid-row') as HTMLElement | null;
    if (!rowEl) return;

    const rowIndex = this.getRowIndex(rowEl);
    if (rowIndex < 0) return;

    // Resolve the rows being dragged: whole selection if dragged row is selected.
    const { rows, indices } = this.resolveDraggedRows(rowIndex);
    if (rows.length === 0) return;

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
    this.draggedRowIndex = rowIndex;
    this.draggedRows = rows;
    this.draggedIndices = indices;
    this.dragSessionId = sessionId;
    this.dragAccepted = false;

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

      // Multi-row drag count badge
      if (rows.length > 1) {
        const badge = document.createElement('div');
        badge.className = 'tbw-row-drag-count';
        badge.textContent = `${rows.length} rows`;
        document.body.appendChild(badge);
        try {
          de.dataTransfer.setDragImage(badge, 10, 10);
        } catch {
          /* ignore */
        }
        // Remove the badge after the browser has snapshotted it
        setTimeout(() => badge.remove(), 0);
      }
    }

    // Same-window registry + current-session marker
    registerDragSession(sessionId, rows as unknown[]);
    setCurrentDragSession(sessionId, payload);

    rowEl.classList.add(GridClasses.DRAGGING);
    this.gridElement.classList.add('tbw-grid--drag-source');
  }

  private onDragOver(de: DragEvent): void {
    const dt = de.dataTransfer;
    if (!dt) return;

    // Identify whether a tbw row drag is in progress and whether it matches our zone.
    const types = dt.types ? Array.from(dt.types) : [];
    if (!hasAnyRowDragMime(types) && !this.isDragging) return;

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
    if (isIntra && pos.overIndex !== null && pos.overIndex === this.draggedRowIndex) {
      this.clearDropTargetClasses();
      return;
    }

    // canDrop check (same-window only — payload visible)
    if (session && this.config.canDrop) {
      const accepted = this.config.canDrop(session.payload, pos.insertIndex);
      this.gridElement.classList.toggle('tbw-grid--drop-target-active', accepted);
      this.gridElement.classList.toggle('tbw-grid--drop-target-rejected', !accepted);
      if (!accepted) {
        this.clearDropTargetClasses();
        return;
      }
    } else {
      this.gridElement.classList.add('tbw-grid--drop-target-active');
    }

    this.dropRowIndex = pos.insertIndex;
    this.applyDropPositionClasses(rowEl, pos.isBefore);

    // Auto-scroll the target viewport
    if (this.config.autoScroll !== false) {
      this.ensureAutoScroller();
      this.autoScroller?.onPointerMove(de.clientY);
    }
  }

  private onDragLeave(de: DragEvent): void {
    const rowEl = (de.target as HTMLElement).closest('.data-grid-row') as HTMLElement | null;
    if (rowEl) rowEl.classList.remove('drop-target', 'drop-before', 'drop-after');
    // Tear down grid-level state when the cursor leaves the grid entirely
    if (de.currentTarget && !this.gridElement.contains(de.relatedTarget as Node)) {
      this.gridElement.classList.remove('tbw-grid--drop-target-active', 'tbw-grid--drop-target-rejected');
      this.autoScroller?.stop();
    }
  }

  private onDrop(de: DragEvent): void {
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
    if (!payload) return;

    // Drop position (recompute in case dragover wasn't called for a few frames)
    const rowEl = (de.target as HTMLElement).closest('.data-grid-row') as HTMLElement | null;
    const rows = this.internalGrid._rows ?? [];
    const pos = computeDropPosition(rowEl, de.clientY, (el) => this.getRowIndex(el), rows.length);
    let targetIndex = this.dropRowIndex ?? pos.insertIndex;

    const isIntra = payload.sourceGridId === this.gridId;
    const dropZone = this.config.dropZone ?? '';

    if (isIntra) {
      // Intra-grid path — preserve `RowReorderPlugin` semantics: emit `row-move`.
      const fromIndex = payload.rowIndices[0];
      // Adjust toIndex when dropping after the dragged row (single-row only)
      if (payload.rowIndices.length === 1 && targetIndex > fromIndex) targetIndex--;
      if (fromIndex === targetIndex) return;
      const row = (liveRows ?? payload.rows)[0];
      if (!this.canMoveRow(fromIndex, targetIndex)) return;
      this.executeIntraGridMove(row, fromIndex, targetIndex, 'drag');
      return;
    }

    // Cross-grid path
    if (!dropZone || dropZone !== payload.dropZone) return;

    // canDrop final check
    if (this.config.canDrop && !this.config.canDrop(payload, targetIndex)) {
      this.gridElement.classList.add('tbw-grid--drop-target-rejected');
      setTimeout(() => this.gridElement.classList.remove('tbw-grid--drop-target-rejected'), 200);
      return;
    }

    // Resolve final row references — live (same-window) or deserialized JSON
    const deserialize = this.config.deserializeRow ?? ((r: unknown) => r as T);
    const incomingRows: T[] = liveRows ?? payload.rows.map((r) => deserialize(r as unknown));

    const dropDetail: RowDropDetail<T> = {
      payload,
      sourceGridId: payload.sourceGridId,
      targetIndex,
      operation: payload.operation,
    };
    if (this.emitCancelable('row-drop', dropDetail)) return;

    // Insert into target grid's _rows
    const targetRows = [...rows];
    targetRows.splice(targetIndex, 0, ...(incomingRows as unknown[]));
    this.grid.rows = targetRows;

    // Remove from source grid's _rows when operation === 'move'
    if (payload.operation === 'move') {
      const sourceGrid = document.getElementById(payload.sourceGridId) as
        | (HTMLElement & { rows?: unknown[]; _rows?: unknown[] })
        | null;
      if (sourceGrid) {
        const srcRows = (sourceGrid._rows ?? sourceGrid.rows ?? []).slice();
        // Remove from highest index down so earlier indices stay stable
        const sortedIndices = [...payload.rowIndices].sort((a, b) => b - a);
        for (const idx of sortedIndices) {
          if (idx >= 0 && idx < srcRows.length) srcRows.splice(idx, 1);
        }
        sourceGrid.rows = srcRows;
      }
    }

    // Mark accepted on the source plugin so dragend knows
    const sourcePlugin = this.findPeerOnGrid(payload.sourceGridId);
    if (sourcePlugin) sourcePlugin.dragAccepted = true;

    // Emit row-transfer on BOTH grids
    const transferDetail: RowTransferDetail<T> = {
      rows: incomingRows,
      fromGridId: payload.sourceGridId,
      toGridId: this.gridId,
      fromIndices: payload.rowIndices,
      toIndex: targetIndex,
      operation: payload.operation,
    };
    this.emit('row-transfer', transferDetail);
    sourcePlugin?.emitTransfer(transferDetail);
  }

  private onDragEnd(): void {
    if (this.dragSessionId) clearDragSession(this.dragSessionId);
    clearCurrentDragSession();
    this.autoScroller?.stop();
    this.gridElement.classList.remove('tbw-grid--drag-source');

    if (this.isDragging) {
      const endDetail: RowDragEndDetail<T> = {
        rows: this.draggedRows,
        indices: this.draggedIndices,
        accepted: this.dragAccepted,
      };
      this.emit('row-drag-end', endDetail);
    }
    this.clearDragClasses();
    this.resetDragState();
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
      | (HTMLElement & { getPluginByName?: (name: string) => RowDragDropPlugin<T> | undefined })
      | null;
    if (!peerEl?.getPluginByName) return null;
    return peerEl.getPluginByName('rowDragDrop') ?? null;
  }

  private resolveDraggedRows(originIndex: number): { rows: T[]; indices: number[] } {
    const rows = this.internalGrid._rows ?? this.sourceRows;
    const originRow = rows[originIndex] as T;

    // If a selection plugin is loaded and the dragged row is selected, drag the whole selection.
    const selection = this.grid?.getPluginByName?.('selection') as
      | { getSelectedRowIndices?: () => number[]; getSelectedRows?: <U>() => U[] }
      | undefined;
    if (selection?.getSelectedRowIndices) {
      const selectedIndices = selection.getSelectedRowIndices();
      if (selectedIndices.includes(originIndex) && selectedIndices.length > 1) {
        const sorted = [...selectedIndices].sort((a, b) => a - b);
        return {
          rows: sorted.map((i) => rows[i] as T),
          indices: sorted,
        };
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
    this.gridElement?.querySelectorAll('.data-grid-row.drop-target').forEach((row) => {
      row.classList.remove('drop-target', 'drop-before', 'drop-after');
    });
  }

  private clearDragClasses(): void {
    this.gridElement?.querySelectorAll('.data-grid-row').forEach((row) => {
      row.classList.remove(GridClasses.DRAGGING, 'drop-target', 'drop-before', 'drop-after');
    });
  }

  private resetDragState(): void {
    this.isDragging = false;
    this.draggedRowIndex = null;
    this.draggedRows = [];
    this.draggedIndices = [];
    this.dragSessionId = null;
    this.dragAccepted = false;
    this.dropRowIndex = null;
    this.pendingMove = null;
  }

  private getRowIndex(rowEl: HTMLElement): number {
    const cell = rowEl.querySelector('.cell[data-row]');
    return cell ? parseInt(cell.getAttribute('data-row') ?? '-1', 10) : -1;
  }

  private clearDebounceTimer(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  // #endregion

  // #region Intra-Grid Move (parity with RowReorderPlugin)

  private handleKeyboardMove(row: T, fromIndex: number, toIndex: number, focusCol: number): void {
    if (!this.pendingMove) {
      this.pendingMove = { originalIndex: fromIndex, currentIndex: toIndex, row };
    } else {
      this.pendingMove.currentIndex = toIndex;
    }
    this.lastFocusCol = focusCol;

    const grid = this.internalGrid;
    const rows = [...(grid._rows ?? this.sourceRows)];
    const [movedRow] = rows.splice(fromIndex, 1);
    rows.splice(toIndex, 0, movedRow);

    grid._rows = rows;
    grid._focusRow = toIndex;
    grid._focusCol = focusCol;
    grid.refreshVirtualWindow(true);
    ensureCellVisible(grid);

    this.clearDebounceTimer();
    this.debounceTimer = setTimeout(() => this.flushPendingMove(), this.config.debounceMs ?? 300);
  }

  private flushPendingMove(): void {
    this.clearDebounceTimer();
    if (!this.pendingMove) return;
    const { originalIndex, currentIndex, row: movedRow } = this.pendingMove;
    this.pendingMove = null;
    if (originalIndex === currentIndex) return;

    const detail: RowMoveDetail<T> = {
      row: movedRow as T,
      fromIndex: originalIndex,
      toIndex: currentIndex,
      rows: [...this.sourceRows] as T[],
      source: 'keyboard',
    };
    const cancelled = this.emitCancelable('row-move', detail);
    if (cancelled) {
      const rows = [...this.sourceRows];
      const [row] = rows.splice(currentIndex, 1);
      rows.splice(originalIndex, 0, row);
      const grid = this.internalGrid;
      grid._rows = rows;
      grid._focusRow = originalIndex;
      grid._focusCol = this.lastFocusCol;
      grid.refreshVirtualWindow(true);
      ensureCellVisible(grid);
    }
  }

  private executeIntraGridMove(row: unknown, fromIndex: number, toIndex: number, source: 'keyboard' | 'drag'): void {
    const rows = [...this.sourceRows];
    const [movedRow] = rows.splice(fromIndex, 1);
    rows.splice(toIndex, 0, movedRow);
    const detail: RowMoveDetail<T> = {
      row: row as T,
      fromIndex,
      toIndex,
      rows: rows as T[],
      source,
    };
    const cancelled = this.emitCancelable('row-move', detail);
    if (cancelled) return;
    if (this.animationType === 'flip' && this.gridElement) {
      const oldPositions = this.captureRowPositions();
      this.grid.rows = rows;
      requestAnimationFrame(() => {
        void this.gridElement.offsetHeight;
        this.animateFLIP(oldPositions, fromIndex, toIndex);
      });
    } else {
      this.grid.rows = rows;
    }
  }

  private captureRowPositions(): Map<number, number> {
    const positions = new Map<number, number>();
    this.gridElement?.querySelectorAll('.data-grid-row').forEach((row) => {
      const rowIndex = this.getRowIndex(row as HTMLElement);
      if (rowIndex >= 0) positions.set(rowIndex, row.getBoundingClientRect().top);
    });
    return positions;
  }

  private animateFLIP(oldPositions: Map<number, number>, fromIndex: number, toIndex: number): void {
    const gridEl = this.gridElement;
    if (!gridEl || oldPositions.size === 0) return;

    const minIndex = Math.min(fromIndex, toIndex);
    const maxIndex = Math.max(fromIndex, toIndex);
    const rowsToAnimate: { el: HTMLElement; deltaY: number }[] = [];

    gridEl.querySelectorAll('.data-grid-row').forEach((row) => {
      const rowEl = row as HTMLElement;
      const newRowIndex = this.getRowIndex(rowEl);
      if (newRowIndex < 0 || newRowIndex < minIndex || newRowIndex > maxIndex) return;
      let oldIndex: number;
      if (newRowIndex === toIndex) oldIndex = fromIndex;
      else if (fromIndex < toIndex) oldIndex = newRowIndex + 1;
      else oldIndex = newRowIndex - 1;
      const oldTop = oldPositions.get(oldIndex);
      if (oldTop === undefined) return;
      const newTop = rowEl.getBoundingClientRect().top;
      const deltaY = oldTop - newTop;
      if (Math.abs(deltaY) > 1) rowsToAnimate.push({ el: rowEl, deltaY });
    });

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
