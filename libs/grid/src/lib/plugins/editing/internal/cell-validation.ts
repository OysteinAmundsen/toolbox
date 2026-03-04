/**
 * Cell Validation Manager
 *
 * Manages invalid-cell state for the Editing Plugin.
 * Extracted from EditingPlugin to reduce the main plugin file size.
 *
 * The manager owns the `Map<rowId, Map<field, message>>` state and exposes
 * read/write methods. DOM synchronization is handled via an injected callback.
 *
 * @internal
 */

/** Callback to sync the data-invalid attribute on a cell element in the DOM. */
export type SyncInvalidAttributeFn = (rowId: string, field: string, invalid: boolean) => void;

/**
 * Manages validation state for grid cells.
 *
 * Tracks which cells are marked invalid and their validation messages.
 * The DOM side-effect (adding/removing `data-invalid` attribute) is delegated
 * to the `syncAttribute` callback provided at construction time.
 */
export class CellValidationManager {
  /** Invalid cell tracking: Map<rowId, Map<field, message>> */
  readonly #cells = new Map<string, Map<string, string>>();

  /** Callback to sync DOM attributes when validation state changes */
  readonly #syncAttribute: SyncInvalidAttributeFn;

  constructor(syncAttribute: SyncInvalidAttributeFn) {
    this.#syncAttribute = syncAttribute;
  }

  // #region Write Operations

  /**
   * Mark a cell as invalid with an optional validation message.
   *
   * @param rowId - The row ID (from getRowId)
   * @param field - The field name
   * @param message - Optional validation message (for tooltips or display)
   */
  setInvalid(rowId: string, field: string, message = ''): void {
    let rowInvalids = this.#cells.get(rowId);
    if (!rowInvalids) {
      rowInvalids = new Map();
      this.#cells.set(rowId, rowInvalids);
    }
    rowInvalids.set(field, message);
    this.#syncAttribute(rowId, field, true);
  }

  /**
   * Clear the invalid state for a specific cell.
   *
   * @param rowId - The row ID (from getRowId)
   * @param field - The field name
   */
  clearInvalid(rowId: string, field: string): void {
    const rowInvalids = this.#cells.get(rowId);
    if (rowInvalids) {
      rowInvalids.delete(field);
      if (rowInvalids.size === 0) {
        this.#cells.delete(rowId);
      }
    }
    this.#syncAttribute(rowId, field, false);
  }

  /**
   * Clear all invalid cells for a specific row.
   *
   * @param rowId - The row ID (from getRowId)
   */
  clearRowInvalid(rowId: string): void {
    const rowInvalids = this.#cells.get(rowId);
    if (rowInvalids) {
      const fields = Array.from(rowInvalids.keys());
      this.#cells.delete(rowId);
      fields.forEach((field) => this.#syncAttribute(rowId, field, false));
    }
  }

  /**
   * Clear all invalid cell states across all rows.
   */
  clearAllInvalid(): void {
    const entries = Array.from(this.#cells.entries());
    this.#cells.clear();
    entries.forEach(([rowId, fields]) => {
      fields.forEach((_, field) => this.#syncAttribute(rowId, field, false));
    });
  }

  // #endregion

  // #region Read Operations

  /**
   * Check if a specific cell is marked as invalid.
   *
   * @param rowId - The row ID (from getRowId)
   * @param field - The field name
   * @returns True if the cell is marked as invalid
   */
  isCellInvalid(rowId: string, field: string): boolean {
    return this.#cells.get(rowId)?.has(field) ?? false;
  }

  /**
   * Get the validation message for an invalid cell.
   *
   * @param rowId - The row ID (from getRowId)
   * @param field - The field name
   * @returns The validation message, or undefined if cell is valid
   */
  getInvalidMessage(rowId: string, field: string): string | undefined {
    return this.#cells.get(rowId)?.get(field);
  }

  /**
   * Check if a row has any invalid cells.
   *
   * @param rowId - The row ID (from getRowId)
   * @returns True if the row has at least one invalid cell
   */
  hasInvalidCells(rowId: string): boolean {
    const rowInvalids = this.#cells.get(rowId);
    return rowInvalids ? rowInvalids.size > 0 : false;
  }

  /**
   * Get all invalid fields for a row.
   *
   * @param rowId - The row ID (from getRowId)
   * @returns Map of field names to validation messages
   */
  getInvalidFields(rowId: string): Map<string, string> {
    return new Map(this.#cells.get(rowId) ?? []);
  }

  // #endregion
}
