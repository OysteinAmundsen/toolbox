/**
 * RowManager — encapsulates row CRUD operations that were previously
 * inline in the DataGridElement class.
 *
 * Owns:
 * - Row ID resolution (tryResolveRowId, resolveRowIdOrThrow)
 * - Row lookup (getRow, getRowEntry)
 * - Row mutation (updateRow, updateRows, insertRow, removeRow)
 *
 * Communicates with the grid through a narrow RowManagerHost interface.
 */
import type { CellChangeDetail, RowAnimationType, UpdateSource } from '../types';
import { RenderPhase } from './render-scheduler';
import { gridPrefix } from './utils';

// #region Standalone Row ID Helpers

/**
 * Try to resolve the ID for a row using a configured getRowId or fallback.
 * Returns undefined if no ID can be determined (non-throwing).
 *
 * Exported so grid.ts can use it in `#rebuildRowIdMap` without going
 * through the RowManager instance.
 */
export function tryResolveRowId<T>(row: T, getRowId?: (row: T) => string): string | undefined {
  if (getRowId) {
    return getRowId(row);
  }

  // Fallback: common ID fields
  const r = row as Record<string, unknown>;
  if ('id' in r && r.id != null) return String(r.id);
  if ('_id' in r && r._id != null) return String(r._id);

  return undefined;
}

/**
 * Resolve the ID for a row, throwing if not found.
 * Exported so grid.ts `getRowId()` can call it without the RowManager.
 */
export function resolveRowIdOrThrow<T>(row: T, gridId: string, getRowId?: (row: T) => string): string {
  const id = tryResolveRowId(row, getRowId);
  if (id === undefined) {
    throw new Error(
      `${gridPrefix(gridId)} Cannot determine row ID. ` +
        'Configure getRowId in gridConfig or ensure rows have an "id" property.',
    );
  }
  return id;
}

// #endregion

// #region Host Interface

/**
 * Narrow contract a grid must satisfy so the RowManager can
 * read data, mutate rows, and trigger rendering without knowing the full grid API.
 */
export interface RowManagerHost<T = any> {
  // --- Data access (getters) ---
  readonly rows: T[];
  readonly sourceRows: T[];

  // --- Configuration ---
  readonly gridId: string;
  readonly getRowIdFn: ((row: T) => string) | undefined;

  // --- Row ID map ---
  getRowEntry(id: string): { row: T; index: number } | undefined;

  // --- Sort state ---
  readonly sortState: { field: string; direction: 1 | -1 } | null;
  readonly originalOrder: T[];

  // --- State mutation ---
  setRows(rows: T[]): void;
  setSourceRows(rows: T[]): void;
  setOriginalOrder(rows: T[]): void;

  // --- Render epoch/pool ---
  bumpRenderEpoch(): void;

  // --- Operations ---
  invalidateCellCache(): void;
  rebuildRowIdMap(): void;
  refreshVirtualWindow(full: boolean): boolean;

  // --- Events ---
  emit(event: string, detail: unknown): void;
  emitDataChange(): void;
  emitPluginEvent(event: string, detail: unknown): void;

  // --- Scheduler ---
  requestRender(phase: RenderPhase, source: string): void;

  // --- Animation ---
  animateRow(rowIndex: number, type: RowAnimationType): Promise<boolean>;

  // --- DOM cleanup ---
  cleanupAnimatingRows(): void;
}

// #endregion

// #region RowManager

export class RowManager<T = any> {
  readonly #host: RowManagerHost<T>;

  constructor(host: RowManagerHost<T>) {
    this.#host = host;
  }

  // --- Row ID resolution ---

  resolveRowId(row: T): string {
    return resolveRowIdOrThrow(row, this.#host.gridId, this.#host.getRowIdFn);
  }

  // --- Row lookup ---

  getRow(id: string): T | undefined {
    return this.#host.getRowEntry(id)?.row;
  }

  getRowEntry(id: string): { row: T; index: number } | undefined {
    return this.#host.getRowEntry(id);
  }

  // --- Row updates ---

  updateRow(id: string, changes: Partial<T>, source: UpdateSource = 'api'): void {
    const host = this.#host;
    const entry = host.getRowEntry(id);
    if (!entry) {
      throw new Error(
        `${gridPrefix(host.gridId)} Row with ID "${id}" not found. ` +
          `Ensure the row exists and getRowId is correctly configured.`,
      );
    }

    const { row, index } = entry;
    const changedFields: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];

    // Compute changes and apply in-place
    for (const [field, newValue] of Object.entries(changes)) {
      const oldValue = (row as Record<string, unknown>)[field];
      if (oldValue !== newValue) {
        changedFields.push({ field, oldValue, newValue });
        (row as Record<string, unknown>)[field] = newValue;
      }
    }

    // Emit cell-change for each changed field
    for (const { field, oldValue, newValue } of changedFields) {
      host.emit('cell-change', {
        row,
        rowId: id,
        rowIndex: index,
        field,
        oldValue,
        newValue,
        changes,
        source,
      } as CellChangeDetail<T>);
    }

    // Schedule re-render if anything changed.
    // Use VIRTUALIZATION (not ROWS) so the visible cells are re-rendered
    // without rebuilding the row model. A ROWS-phase rebuild re-applies
    // sort/filter from #rows, which moves rows inserted via insertRow()
    // to their sorted position — appearing as "ghost" duplicates.
    // Since data was already mutated in-place, fastPatchRow will pick up
    // the new values from the row object directly.
    if (changedFields.length > 0) {
      host.invalidateCellCache();
      host.requestRender(RenderPhase.VIRTUALIZATION, 'updateRow');
      host.emitDataChange();
    }
  }

  updateRows(updates: Array<{ id: string; changes: Partial<T> }>, source: UpdateSource = 'api'): void {
    const host = this.#host;
    let anyChanged = false;

    for (const { id, changes } of updates) {
      const entry = host.getRowEntry(id);
      if (!entry) {
        throw new Error(
          `${gridPrefix(host.gridId)} Row with ID "${id}" not found. ` +
            `Ensure the row exists and getRowId is correctly configured.`,
        );
      }

      const { row, index } = entry;

      // Compute changes and apply in-place
      for (const [field, newValue] of Object.entries(changes)) {
        const oldValue = (row as Record<string, unknown>)[field];
        if (oldValue !== newValue) {
          anyChanged = true;
          (row as Record<string, unknown>)[field] = newValue;

          // Emit cell-change for each changed field
          host.emit('cell-change', {
            row,
            rowId: id,
            rowIndex: index,
            field,
            oldValue,
            newValue,
            changes,
            source,
          } as CellChangeDetail<T>);
        }
      }
    }

    // Schedule single re-render for all changes.
    // Use VIRTUALIZATION (not ROWS) — see updateRow for rationale.
    if (anyChanged) {
      host.invalidateCellCache();
      host.requestRender(RenderPhase.VIRTUALIZATION, 'updateRows');
      host.emitDataChange();
    }
  }

  // --- Row mutation ---

  async insertRow(index: number, row: T, animate = true): Promise<void> {
    const host = this.#host;

    // Clamp index to valid range
    const idx = Math.max(0, Math.min(index, host.rows.length));

    // Add to source data (position irrelevant — pipeline will re-sort later)
    host.setSourceRows([...host.sourceRows, row]);

    // Insert into processed view at the exact visible position
    const newRows = [...host.rows];
    newRows.splice(idx, 0, row);
    host.setRows(newRows);

    // Keep __originalOrder in sync so "clear sort" includes the new row
    if (host.sortState) {
      host.setOriginalOrder([...host.originalOrder, row]);
    }

    // Refresh caches and trigger immediate re-render
    host.invalidateCellCache();
    host.rebuildRowIdMap();
    host.bumpRenderEpoch();
    host.refreshVirtualWindow(true);

    // Notify plugins about the inserted row (e.g., editing dirty tracking)
    host.emitPluginEvent('row-inserted', { row, index: idx });

    host.emitDataChange();

    if (animate) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await host.animateRow(idx, 'insert');
    }
  }

  async removeRow(index: number, animate = true): Promise<T | undefined> {
    const host = this.#host;
    const row = host.rows[index];
    if (!row) return undefined;

    if (animate) {
      await host.animateRow(index, 'remove');
    }

    // Find current position by reference (may have shifted during animation)
    const currentIdx = host.rows.indexOf(row);
    if (currentIdx < 0) return row; // Already removed by something else

    // Remove from processed view
    const newRows = [...host.rows];
    newRows.splice(currentIdx, 1);
    host.setRows(newRows);

    // Remove from source data
    const srcIdx = host.sourceRows.indexOf(row);
    if (srcIdx >= 0) {
      const newSource = [...host.sourceRows];
      newSource.splice(srcIdx, 1);
      host.setSourceRows(newSource);
    }

    // Keep __originalOrder in sync
    if (host.sortState) {
      const origIdx = host.originalOrder.indexOf(row);
      if (origIdx >= 0) {
        const newOrig = [...host.originalOrder];
        newOrig.splice(origIdx, 1);
        host.setOriginalOrder(newOrig);
      }
    }

    // Refresh caches and trigger immediate re-render
    host.invalidateCellCache();
    host.rebuildRowIdMap();
    host.bumpRenderEpoch();
    host.refreshVirtualWindow(true);

    host.emitDataChange();

    // Clean up stale remove animation attributes after re-render
    if (animate) {
      host.cleanupAnimatingRows();
    }

    return row;
  }
}

// #endregion
