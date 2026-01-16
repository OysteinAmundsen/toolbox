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
}
