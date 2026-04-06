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
import type { CellChangeDetail, GridHost, RowTransaction, TransactionResult, UpdateSource } from '../types';
import { MISSING_ROW_ID, ROW_NOT_FOUND, throwDiagnostic } from './diagnostics';
import { RenderPhase } from './render-scheduler';
import { animateRow } from './row-animation';
import { invalidateCellCache } from './rows';

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
    throwDiagnostic(
      MISSING_ROW_ID,
      'Cannot determine row ID. ' + 'Configure getRowId in gridConfig or ensure rows have an "id" property.',
      gridId,
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
      throwDiagnostic(
        ROW_NOT_FOUND,
        `Row with ID "${id}" not found. ` + `Ensure the row exists and getRowId is correctly configured.`,
        grid.id,
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
        throwDiagnostic(
          ROW_NOT_FOUND,
          `Row with ID "${id}" not found. ` + `Ensure the row exists and getRowId is correctly configured.`,
          grid.id,
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
    for (let i = 0; i < grid._rowPool.length; i++) grid._rowPool[i].__epoch = -1;
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
    for (let i = 0; i < grid._rowPool.length; i++) grid._rowPool[i].__epoch = -1;
    grid.refreshVirtualWindow(true);

    grid._emitDataChange();

    // Clean up stale remove animation attributes after re-render
    if (animate) {
      requestAnimationFrame(() => {
        const els = grid.querySelectorAll('[data-animating="remove"]');
        for (let i = 0; i < els.length; i++) {
          els[i].removeAttribute('data-animating');
        }
      });
    }

    return row;
  }

  // --- Transaction API ---

  async applyTransaction(transaction: RowTransaction<T>, animate = true): Promise<TransactionResult<T>> {
    const grid = this.#grid;
    const result: TransactionResult<T> = { added: [], updated: [], removed: [] };

    // 1. Process removes first (before indices shift from inserts)
    if (transaction.remove?.length) {
      for (const { id } of transaction.remove) {
        const entry = grid._getRowEntry(id);
        if (!entry) continue;

        const { row } = entry;

        if (animate) {
          const idx = grid._rows.indexOf(row);
          if (idx >= 0) await animateRow(grid, idx, 'remove');
        }

        // Find current position (may have shifted during animation)
        const currentIdx = grid._rows.indexOf(row);
        if (currentIdx < 0) {
          result.removed.push(row);
          continue;
        }

        const newRows = [...grid._rows];
        newRows.splice(currentIdx, 1);
        grid._rows = newRows;

        const srcIdx = grid.sourceRows.indexOf(row);
        if (srcIdx >= 0) {
          const newSource = [...grid.sourceRows];
          newSource.splice(srcIdx, 1);
          grid.sourceRows = newSource;
        }

        if (grid._sortState) {
          const origIdx = grid.__originalOrder.indexOf(row);
          if (origIdx >= 0) {
            const newOrig = [...grid.__originalOrder];
            newOrig.splice(origIdx, 1);
            grid.__originalOrder = newOrig;
          }
        }

        result.removed.push(row);
      }
    }

    // Collect removed IDs so updates don't target removed rows
    const removedIds = new Set(transaction.remove?.map((r) => r.id));

    // 2. Process updates (in-place mutation, no structural change)
    if (transaction.update?.length) {
      for (const { id, changes } of transaction.update) {
        if (removedIds.has(id)) continue;
        const entry = grid._getRowEntry(id);
        if (!entry) continue;

        const { row, index } = entry;
        let changed = false;

        for (const [field, newValue] of Object.entries(changes)) {
          const oldValue = (row as Record<string, unknown>)[field];
          if (oldValue !== newValue) {
            changed = true;
            (row as Record<string, unknown>)[field] = newValue;

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
                  source: 'api',
                } as CellChangeDetail<T>,
                bubbles: true,
                composed: true,
              }),
            );
          }
        }

        if (changed) result.updated.push(row);
      }
    }

    // 3. Process adds (append to end)
    if (transaction.add?.length) {
      for (const row of transaction.add) {
        grid.sourceRows = [...grid.sourceRows, row];

        const newRows = [...grid._rows];
        newRows.push(row);
        grid._rows = newRows;

        if (grid._sortState) {
          grid.__originalOrder = [...grid.__originalOrder, row];
        }

        result.added.push(row);
      }
    }

    // 4. Single render pass for all mutations
    const hasStructuralChange = result.added.length > 0 || result.removed.length > 0;
    const hasUpdates = result.updated.length > 0;

    if (hasStructuralChange) {
      invalidateCellCache(grid);
      grid._rebuildRowIdMap();
      grid.__rowRenderEpoch++;
      for (let i = 0; i < grid._rowPool.length; i++) grid._rowPool[i].__epoch = -1;
      grid.refreshVirtualWindow(true);
    } else if (hasUpdates) {
      invalidateCellCache(grid);
      grid._requestSchedulerPhase(RenderPhase.VIRTUALIZATION, 'applyTransaction');
    }

    if (hasStructuralChange || hasUpdates) {
      grid._emitDataChange();
    }

    // 5. Animate added rows
    if (animate && result.added.length > 0) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      for (const row of result.added) {
        const idx = grid._rows.indexOf(row);
        if (idx >= 0) await animateRow(grid, idx, 'insert');
      }
    }

    // 6. Animate updated rows
    if (animate && result.updated.length > 0) {
      for (const row of result.updated) {
        const idx = grid._rows.indexOf(row);
        if (idx >= 0) await animateRow(grid, idx, 'change');
      }
    }

    // 7. Clean up stale remove animations
    if (animate && result.removed.length > 0) {
      requestAnimationFrame(() => {
        const els = grid.querySelectorAll('[data-animating="remove"]');
        for (let i = 0; i < els.length; i++) {
          els[i].removeAttribute('data-animating');
        }
      });
    }

    return result;
  }

  #pendingTransaction: RowTransaction<T> | null = null;
  #pendingTransactionResolvers: Array<(result: TransactionResult<T>) => void> = [];
  #transactionRafId: number | null = null;

  applyTransactionAsync(transaction: RowTransaction<T>): Promise<TransactionResult<T>> {
    // Merge into pending batch
    if (!this.#pendingTransaction) {
      this.#pendingTransaction = { add: [], update: [], remove: [] };
    }
    if (transaction.add) this.#pendingTransaction.add!.push(...transaction.add);
    if (transaction.update) this.#pendingTransaction.update!.push(...transaction.update);
    if (transaction.remove) this.#pendingTransaction.remove!.push(...transaction.remove);

    return new Promise<TransactionResult<T>>((resolve) => {
      this.#pendingTransactionResolvers.push(resolve);

      if (this.#transactionRafId === null) {
        this.#transactionRafId = requestAnimationFrame(() => {
          this.#transactionRafId = null;
          const batch = this.#pendingTransaction!;
          const resolvers = this.#pendingTransactionResolvers;
          this.#pendingTransaction = null;
          this.#pendingTransactionResolvers = [];

          // Apply batched transaction without per-row animation (too many)
          this.applyTransaction(batch, false).then((result) => {
            for (const resolver of resolvers) resolver(result);
          });
        });
      }
    });
  }
}

// #endregion
