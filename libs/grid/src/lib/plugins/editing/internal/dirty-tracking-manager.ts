/**
 * Stateful manager for dirty tracking in the EditingPlugin.
 *
 * Owns all dirty-tracking-related state (baselines, changed/new/committed sets)
 * and exposes high-level methods that coordinate pure functions from
 * `dirty-tracking.ts`.
 *
 * The EditingPlugin delegates all dirty tracking operations to this manager,
 * keeping the plugin class focused on orchestration (row resolution, event
 * emission, render scheduling).
 *
 * @internal
 */

import {
  captureBaselines,
  getOriginalRow,
  isCellDirty,
  isRowDirty,
  markPristine,
  revertToBaseline,
  type DirtyRowEntry,
} from './dirty-tracking';

// #region Types

/**
 * Callback that resolves a row object by its ID.
 * Returns `undefined` when the row is not found.
 */
export type RowResolver<T> = (rowId: string) => T | undefined;

// #endregion

// #region DirtyTrackingManager

export class DirtyTrackingManager<T> {
  // --- Owned state ---

  /** Baseline snapshots: rowId → deep-cloned original row data (first-write-wins) */
  readonly baselines = new Map<string, T>();

  /** Whether new baselines were captured during the current processRows cycle */
  private baselinesWereCaptured = false;

  /** Row IDs inserted via `insertRow()` (no baseline available) */
  readonly newRowIds = new Set<string>();

  /** Row IDs that have been modified (edit committed) */
  readonly changedRowIds = new Set<string>();

  /** Row IDs whose edit session was committed (gates `tbw-row-dirty` CSS class) */
  readonly committedDirtyRowIds = new Set<string>();

  // --- Lifecycle ---

  /** Reset all dirty tracking state (called from detach / resetChangedRows). */
  clear(): void {
    this.changedRowIds.clear();
    this.committedDirtyRowIds.clear();
    this.baselines.clear();
    this.newRowIds.clear();
    this.baselinesWereCaptured = false;
  }

  // --- Baseline capture (called from processRows) ---

  /**
   * Capture baselines for rows not already tracked (first-write-wins).
   * Sets the `baselinesWereCaptured` flag when new rows are snapshotted.
   */
  capture(rows: readonly T[], getRowId: (r: T) => string | undefined): void {
    const sizeBefore = this.baselines.size;
    captureBaselines(this.baselines, rows, getRowId);
    if (this.baselines.size > sizeBefore) {
      this.baselinesWereCaptured = true;
    }
  }

  /**
   * Drain the baselines-captured flag (called from afterRender).
   * Returns `null` when no new captures occurred, or the baseline count.
   */
  drainCapturedFlag(): number | null {
    if (!this.baselinesWereCaptured) return null;
    this.baselinesWereCaptured = false;
    return this.baselines.size;
  }

  // --- Row dirty queries ---

  /** Check if a specific row differs from its baseline. */
  isRowDirty(rowId: string, row: T): boolean {
    return isRowDirty(this.baselines, rowId, row);
  }

  /** Check if ANY row is dirty (requires row resolver for baseline iteration). */
  hasAnyDirty(resolveRow: RowResolver<T>): boolean {
    if (this.newRowIds.size > 0) return true;
    for (const [rowId] of this.baselines) {
      const row = resolveRow(rowId);
      if (row && isRowDirty(this.baselines, rowId, row)) return true;
    }
    return false;
  }

  // --- Cell dirty queries ---

  /** Check if a single cell differs from its baseline value. */
  isCellDirty(rowId: string, row: T, field: string): boolean {
    return isCellDirty(this.baselines, rowId, row, field);
  }

  // --- Render-time helpers ---

  /**
   * Get the dirty-state tuple needed by afterRowRender to toggle CSS classes.
   *
   * `isCommittedDirty` requires BOTH committed status AND actual data divergence
   * from baseline (handles undo: after CTRL+Z, row is no longer visually dirty).
   */
  getRowDirtyState(rowId: string, row: T): { isNew: boolean; isCommittedDirty: boolean; hasBaseline: boolean } {
    const isNew = this.newRowIds.has(rowId);
    const isCommittedDirty = !isNew && this.committedDirtyRowIds.has(rowId) && isRowDirty(this.baselines, rowId, row);
    return { isNew, isCommittedDirty, hasBaseline: this.baselines.has(rowId) };
  }

  // --- Mark operations ---

  /** Re-snapshot baseline from current data and remove from all sets. */
  markPristine(rowId: string, row: T): void {
    markPristine(this.baselines, rowId, row);
    this.newRowIds.delete(rowId);
    this.changedRowIds.delete(rowId);
    this.committedDirtyRowIds.delete(rowId);
  }

  /** Mark a row as newly inserted (no baseline). */
  markNew(rowId: string): void {
    this.newRowIds.add(rowId);
    this.committedDirtyRowIds.add(rowId);
  }

  /** Mark a row as dirty (external mutation). */
  markDirty(rowId: string): void {
    this.changedRowIds.add(rowId);
    this.committedDirtyRowIds.add(rowId);
  }

  /** Re-snapshot all baselines and clear all tracking sets. */
  markAllPristine(resolveRow: RowResolver<T>): void {
    for (const [rowId] of this.baselines) {
      const row = resolveRow(rowId);
      if (row) markPristine(this.baselines, rowId, row);
    }
    this.newRowIds.clear();
    this.changedRowIds.clear();
    this.committedDirtyRowIds.clear();
  }

  // --- Original row access ---

  /** Get deep-cloned baseline (undefined for new/untracked rows). */
  getOriginalRow(rowId: string): T | undefined {
    return getOriginalRow<T>(this.baselines, rowId);
  }

  /** Lightweight check whether a baseline exists (no cloning). */
  hasBaseline(rowId: string): boolean {
    return this.baselines.has(rowId);
  }

  // --- Aggregate queries ---

  /** Get all dirty rows with original + current data. Requires a row resolver. */
  getDirtyRows(resolveRow: RowResolver<T>): DirtyRowEntry<T>[] {
    const result: DirtyRowEntry<T>[] = [];
    for (const [rowId, baseline] of this.baselines) {
      const row = resolveRow(rowId);
      if (row && isRowDirty(this.baselines, rowId, row)) {
        result.push({ id: rowId, original: structuredClone(baseline), current: row });
      }
    }
    for (const newId of this.newRowIds) {
      const row = resolveRow(newId);
      if (row) {
        result.push({ id: newId, original: undefined as unknown as T, current: row });
      }
    }
    return result;
  }

  /** Get IDs of all dirty rows. Requires a row resolver. */
  getDirtyRowIds(resolveRow: RowResolver<T>): string[] {
    const ids: string[] = [];
    for (const [rowId] of this.baselines) {
      const row = resolveRow(rowId);
      if (row && isRowDirty(this.baselines, rowId, row)) ids.push(rowId);
    }
    for (const newId of this.newRowIds) ids.push(newId);
    return ids;
  }

  // --- Revert operations ---

  /**
   * Revert a row to its baseline values (mutates row in-place).
   * Returns `true` when baseline existed and row was reverted.
   */
  revertRow(rowId: string, row: T): boolean {
    const reverted = revertToBaseline(this.baselines, rowId, row);
    if (reverted) {
      this.changedRowIds.delete(rowId);
      this.committedDirtyRowIds.delete(rowId);
    }
    return reverted;
  }

  /** Revert all rows to baseline values. Requires a row resolver. */
  revertAll(resolveRow: RowResolver<T>): void {
    for (const [rowId] of this.baselines) {
      const row = resolveRow(rowId);
      if (row) revertToBaseline(this.baselines, rowId, row);
    }
    this.changedRowIds.clear();
    this.committedDirtyRowIds.clear();
  }

  // --- Changed row queries ---

  /** Resolve changed row IDs to row objects. */
  getChangedRows(resolveRow: RowResolver<T>): T[] {
    const rows: T[] = [];
    for (const id of this.changedRowIds) {
      const row = resolveRow(id);
      if (row) rows.push(row);
    }
    return rows;
  }

  /** Get a copy of changed row IDs. */
  getChangedRowIds(): string[] {
    return Array.from(this.changedRowIds);
  }

  /** Check if a row has been marked as changed. */
  isRowChanged(rowId: string): boolean {
    return this.changedRowIds.has(rowId);
  }
}

// #endregion
