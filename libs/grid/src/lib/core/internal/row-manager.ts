/**
 * RowManager — encapsulates row CRUD operations that were previously
 * inline in the DataGridElement class.
 *
 * Owns:
 * - Row ID resolution (tryResolveRowId, resolveRowIdOrThrow)
 * - Row lookup (getRow, getRowEntry)
 * - Row mutation (updateRow, updateRows, insertRow, removeRow)
 *
 * Takes the grid reference directly (tightly coupled — this manager
 * can never live outside the grid).
 */
import type { CellChangeDetail, GridHost, UpdateSource } from '../types';
import { RenderPhase } from './render-scheduler';
import { animateRow } from './row-animation';
import { invalidateCellCache } from './rows';
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

// #region RowManager

export class RowManager<T = any> {
  readonly #grid: GridHost<T>;

  constructor(grid: GridHost<T>) {
    this.#grid = grid;
  }

  // --- Row ID resolution ---

  resolveRowId(row: T): string {
    return resolveRowIdOrThrow(row, this.#grid.id, this.#grid.effectiveConfig?.getRowId);
  }

  // --- Row lookup ---

  getRow(id: string): T | undefined {
    return this.#grid._getRowEntry(id)?.row;
  }

  getRowEntry(id: string): { row: T; index: number } | undefined {
    return this.#grid._getRowEntry(id);
  }

  // --- Row updates ---

  updateRow(id: string, changes: Partial<T>, source: UpdateSource = 'api'): void {
    const grid = this.#grid;
    const entry = grid._getRowEntry(id);
    if (!entry) {
      throw new Error(
        `${gridPrefix(grid.id)} Row with ID "${id}" not found. ` +
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
      grid.dispatchEvent(
        new CustomEvent('cell-change', {
          detail: {
            row,
            rowId: id,
            rowIndex: index,
            field,
            oldValue,
            newValue,
            changes,
            source,
          } as CellChangeDetail<T>,
          bubbles: true,
          composed: true,
        }),
      );
    }

    // Schedule re-render if anything changed.
    // Use VIRTUALIZATION (not ROWS) so the visible cells are re-rendered
    // without rebuilding the row model. A ROWS-phase rebuild re-applies
    // sort/filter from #rows, which moves rows inserted via insertRow()
    // to their sorted position — appearing as "ghost" duplicates.
    // Since data was already mutated in-place, fastPatchRow will pick up
    // the new values from the row object directly.
    if (changedFields.length > 0) {
      invalidateCellCache(grid);
      grid._requestSchedulerPhase(RenderPhase.VIRTUALIZATION, 'updateRow');
      grid._emitDataChange();
    }
  }

  updateRows(updates: Array<{ id: string; changes: Partial<T> }>, source: UpdateSource = 'api'): void {
    const grid = this.#grid;
    let anyChanged = false;

    for (const { id, changes } of updates) {
      const entry = grid._getRowEntry(id);
      if (!entry) {
        throw new Error(
          `${gridPrefix(grid.id)} Row with ID "${id}" not found. ` +
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
          grid.dispatchEvent(
            new CustomEvent('cell-change', {
              detail: {
                row,
                rowId: id,
                rowIndex: index,
                field,
                oldValue,
                newValue,
                changes,
                source,
              } as CellChangeDetail<T>,
              bubbles: true,
              composed: true,
            }),
          );
        }
      }
    }

    // Schedule single re-render for all changes.
    // Use VIRTUALIZATION (not ROWS) — see updateRow for rationale.
    if (anyChanged) {
      invalidateCellCache(grid);
      grid._requestSchedulerPhase(RenderPhase.VIRTUALIZATION, 'updateRows');
      grid._emitDataChange();
    }
  }

  // --- Row mutation ---

  async insertRow(index: number, row: T, animate = true): Promise<void> {
    const grid = this.#grid;

    // Clamp index to valid range
    const idx = Math.max(0, Math.min(index, grid._rows.length));

    // Add to source data (position irrelevant — pipeline will re-sort later)
    grid.sourceRows = [...grid.sourceRows, row];

    // Insert into processed view at the exact visible position
    const newRows = [...grid._rows];
    newRows.splice(idx, 0, row);
    grid._rows = newRows;

    // Keep __originalOrder in sync so "clear sort" includes the new row
    if (grid._sortState) {
      grid.__originalOrder = [...grid.__originalOrder, row];
    }

    // Refresh caches and trigger immediate re-render
    invalidateCellCache(grid);
    grid._rebuildRowIdMap();
    grid.__rowRenderEpoch++;
    for (const r of grid._rowPool) r.__epoch = -1;
    grid.refreshVirtualWindow(true);

    // Notify plugins about the inserted row (e.g., editing dirty tracking)
    grid._emitPluginEvent('row-inserted', { row, index: idx });

    grid._emitDataChange();

    if (animate) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await animateRow(grid, idx, 'insert');
    }
  }

  async removeRow(index: number, animate = true): Promise<T | undefined> {
    const grid = this.#grid;
    const row = grid._rows[index];
    if (!row) return undefined;

    if (animate) {
      await animateRow(grid, index, 'remove');
    }

    // Find current position by reference (may have shifted during animation)
    const currentIdx = grid._rows.indexOf(row);
    if (currentIdx < 0) return row; // Already removed by something else

    // Remove from processed view
    const newRows = [...grid._rows];
    newRows.splice(currentIdx, 1);
    grid._rows = newRows;

    // Remove from source data
    const srcIdx = grid.sourceRows.indexOf(row);
    if (srcIdx >= 0) {
      const newSource = [...grid.sourceRows];
      newSource.splice(srcIdx, 1);
      grid.sourceRows = newSource;
    }

    // Keep __originalOrder in sync
    if (grid._sortState) {
      const origIdx = grid.__originalOrder.indexOf(row);
      if (origIdx >= 0) {
        const newOrig = [...grid.__originalOrder];
        newOrig.splice(origIdx, 1);
        grid.__originalOrder = newOrig;
      }
    }

    // Refresh caches and trigger immediate re-render
    invalidateCellCache(grid);
    grid._rebuildRowIdMap();
    grid.__rowRenderEpoch++;
    for (const r of grid._rowPool) r.__epoch = -1;
    grid.refreshVirtualWindow(true);

    grid._emitDataChange();

    // Clean up stale remove animation attributes after re-render
    if (animate) {
      requestAnimationFrame(() => {
        grid.querySelectorAll('[data-animating="remove"]').forEach((el) => {
          el.removeAttribute('data-animating');
        });
      });
    }

    return row;
  }
}

// #endregion
