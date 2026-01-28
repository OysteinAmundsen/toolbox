/**
 * Editing Plugin Types
 *
 * Configuration and event types for the EditingPlugin.
 */

import type { ColumnConfig } from '../../core/types';

// Re-export event types from core for consumers importing from plugin
export type { CellCommitDetail, ChangedRowsResetDetail, RowCommitDetail } from '../../core/types';

// ============================================================================
// Module Augmentation - Add editing properties to column config
// ============================================================================

/**
 * When EditingPlugin is imported, these properties become available on column config.
 * This augments the core BaseColumnConfig interface.
 */
declare module '../../core/types' {
  interface BaseColumnConfig<TRow, TValue> {
    /** Whether the field is editable (enables editors). Requires EditingPlugin. */
    editable?: boolean;
    /** Optional custom editor factory or element tag name. Requires EditingPlugin. */
    editor?: ColumnEditorSpec<TRow, TValue>;
    /**
     * Configuration parameters for built-in editors.
     * Shape depends on column type (NumberEditorParams, TextEditorParams, DateEditorParams, SelectEditorParams).
     * Requires EditingPlugin.
     *
     * @example
     * ```typescript
     * { field: 'price', type: 'number', editable: true, editorParams: { min: 0, max: 1000, step: 0.01 } }
     * ```
     */
    editorParams?: EditorParams;
  }

  interface TypeDefault {
    /**
     * Default editor for all columns of this type. Requires EditingPlugin.
     *
     * Use type-level editors when multiple columns share the same editing behavior.
     * Column-level `editor` takes precedence over type-level.
     *
     * **Resolution Priority**: Column `editor` → Type `editor` → Built-in
     *
     * @example
     * ```typescript
     * // All 'date' columns use a custom datepicker
     * typeDefaults: {
     *   date: {
     *     editor: (ctx) => {
     *       const picker = new MyDatePicker();
     *       picker.value = ctx.value;
     *       picker.onSelect = (d) => ctx.commit(d);
     *       picker.onCancel = () => ctx.cancel();
     *       return picker;
     *     }
     *   }
     * }
     * ```
     */
    editor?: ColumnEditorSpec<unknown, unknown>;

    /**
     * Default editor parameters for all columns of this type. Requires EditingPlugin.
     *
     * Applied to built-in editors when no column-level `editorParams` is set.
     * Useful for setting consistent constraints across columns (e.g., all currency
     * fields should have `min: 0` and `step: 0.01`).
     *
     * **Resolution Priority**: Column `editorParams` → Type `editorParams` → Built-in defaults
     *
     * @example
     * ```typescript
     * // All 'currency' columns use these number editor params
     * typeDefaults: {
     *   currency: {
     *     editorParams: { min: 0, step: 0.01 }
     *   }
     * }
     *
     * // Column can still override:
     * columns: [
     *   { field: 'price', type: 'currency', editable: true },  // Uses type defaults
     *   { field: 'discount', type: 'currency', editable: true,
     *     editorParams: { min: -100, max: 100 } }  // Overrides type defaults
     * ]
     * ```
     */
    editorParams?: Record<string, unknown>;
  }

  interface GridConfig {
    /**
     * Edit trigger mode. Requires `EditingPlugin` to be loaded.
     *
     * Configure via `new EditingPlugin({ editOn: 'click' })` or set on gridConfig.
     * Plugin config takes precedence over gridConfig.
     *
     * - `'click'`: Single click to edit
     * - `'dblclick'`: Double-click to edit (default)
     * - `'manual'`: Only via programmatic API (beginEdit)
     * - `false`: Disable editing entirely
     */
    editOn?: 'click' | 'dblclick' | 'manual' | false;
  }
}

// ============================================================================
// Plugin Configuration
// ============================================================================

/**
 * Configuration options for EditingPlugin.
 */
export interface EditingConfig {
  /**
   * Controls when editing is triggered.
   * - 'click': Edit on single click (default)
   * - 'dblclick': Edit on double click
   * - 'manual': Only via programmatic API (beginEdit)
   * - false: Disable editing entirely
   */
  editOn?: 'click' | 'dblclick' | 'manual' | false;
}

/**
 * Context passed to editor factory functions.
 */
export interface EditorContext<T = any, V = unknown> {
  /** The row data object */
  row: T;
  /** Stable row identifier (from getRowId) */
  rowId: string;
  /** Current cell value */
  value: V;
  /** Field name being edited */
  field: string;
  /** Column configuration */
  column: ColumnConfig<T>;
  /** Call to commit the new value */
  commit: (newValue: V) => void;
  /** Call to cancel editing */
  cancel: () => void;
  /**
   * Update other fields in this row.
   * Useful for editors that affect multiple fields (e.g., address lookup).
   * Changes will be committed with source: 'cascade'.
   */
  updateRow: (changes: Partial<T>) => void;
}

// ============================================================================
// Editor Parameters - Configuration for built-in editors
// ============================================================================

/**
 * Configuration parameters for the built-in number editor.
 *
 * @example
 * ```typescript
 * { field: 'price', type: 'number', editable: true, editorParams: { min: 0, max: 1000, step: 0.01 } }
 * ```
 */
export interface NumberEditorParams {
  /** Minimum allowed value */
  min?: number;
  /** Maximum allowed value */
  max?: number;
  /** Step increment for up/down arrows */
  step?: number;
  /** Placeholder text when empty */
  placeholder?: string;
}

/**
 * Configuration parameters for the built-in text editor.
 *
 * @example
 * ```typescript
 * { field: 'name', editable: true, editorParams: { maxLength: 50, placeholder: 'Enter name...' } }
 * ```
 */
export interface TextEditorParams {
  /** Maximum character length */
  maxLength?: number;
  /** Regex pattern for validation (HTML5 pattern attribute) */
  pattern?: string;
  /** Placeholder text when empty */
  placeholder?: string;
}

/**
 * Configuration parameters for the built-in date editor.
 *
 * @example
 * ```typescript
 * { field: 'startDate', type: 'date', editable: true, editorParams: { min: '2024-01-01' } }
 * ```
 */
export interface DateEditorParams {
  /** Minimum date (ISO string: 'YYYY-MM-DD') */
  min?: string;
  /** Maximum date (ISO string: 'YYYY-MM-DD') */
  max?: string;
  /** Placeholder text when empty */
  placeholder?: string;
}

/**
 * Configuration parameters for the built-in select editor.
 *
 * @example
 * ```typescript
 * { field: 'status', type: 'select', editable: true, editorParams: { includeEmpty: true, emptyLabel: '-- Select --' } }
 * ```
 */
export interface SelectEditorParams {
  /** Include an empty option at the start */
  includeEmpty?: boolean;
  /** Label for the empty option (default: '') */
  emptyLabel?: string;
}

/**
 * Union type of all editor parameter configurations.
 * The applicable shape depends on the column type.
 */
export type EditorParams = NumberEditorParams | TextEditorParams | DateEditorParams | SelectEditorParams;
