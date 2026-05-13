/**
 * Pure helper functions for the Editing Plugin.
 *
 * Extracted from EditingPlugin to reduce the main plugin file size.
 * All functions are stateless — they have no `this` access.
 *
 * @internal
 */

import type {
  ColumnConfig,
  ColumnEditorSpec,
  ColumnInternal,
  InternalGrid,
  RowElementInternal,
} from '../../../core/types';
import { getInputValue } from '../editors';
import type { EditingConfig } from '../types';

// #region Constants

/**
 * CSS selector for focusable editor elements inside a cell.
 * Duplicated from core/internal/rows to avoid cross-boundary imports
 * that Vite externalises to `@toolbox-web/grid` during plugin bundling.
 *
 * @internal
 */
export const FOCUSABLE_EDITOR_SELECTOR =
  'input,select,textarea,[contenteditable="true"],[contenteditable=""],[tabindex]:not([tabindex="-1"])';

// #endregion

// #region Editor Resolution

/**
 * Resolves the editor for a column using the priority chain:
 * 1. Column-level (`column.editor`)
 * 2. Light DOM template (`__editorTemplate` → returns 'template')
 * 3. Grid-level (`gridConfig.typeDefaults[column.type]`)
 * 4. App-level (framework adapter's `getTypeDefault`)
 * 5. Returns undefined (caller uses built-in defaultEditorFor)
 */
export function resolveEditor<TRow>(
  grid: InternalGrid<TRow>,
  col: ColumnInternal<TRow>,
): ColumnEditorSpec<TRow, unknown> | 'template' | undefined {
  // 1. Column-level editor (highest priority)
  if (col.editor) return col.editor;

  // 2. Light DOM template
  const tplHolder = col.__editorTemplate;
  if (tplHolder) return 'template';

  // No type specified - no type defaults to check
  if (!col.type) return undefined;

  // 3. Grid-level typeDefaults (access via effectiveConfig)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gridTypeDefaults = (grid as any).effectiveConfig?.typeDefaults;
  if (gridTypeDefaults?.[col.type]?.editor) {
    return gridTypeDefaults[col.type].editor as ColumnEditorSpec<TRow, unknown>;
  }

  // 4. App-level registry (via framework adapter)
  const adapter = grid.__frameworkAdapter;
  if (adapter?.getTypeDefault) {
    const appDefault = adapter.getTypeDefault<TRow>(col.type, grid._hostElement);
    if (appDefault?.editor) {
      return appDefault.editor as ColumnEditorSpec<TRow, unknown>;
    }
  }

  // 5. No custom editor - caller uses built-in defaultEditorFor
  return undefined;
}

// #endregion

// #region Property Key Safety

/**
 * Returns true if the given property key is safe to use on a plain object.
 */
export function isSafePropertyKey(key: unknown): key is string {
  if (typeof key !== 'string') return false;
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') return false;
  return true;
}

// #endregion

// #region Row Element State

/**
 * Increment the editing cell count on a row element.
 */
export function incrementEditingCount(rowEl: RowElementInternal): void {
  const count = (rowEl.__editingCellCount ?? 0) + 1;
  rowEl.__editingCellCount = count;
  rowEl.setAttribute('data-has-editing', '');
}

/**
 * Clear all editing state from a row element.
 */
export function clearEditingState(rowEl: RowElementInternal): void {
  rowEl.__editingCellCount = 0;
  rowEl.removeAttribute('data-has-editing');
}

// #endregion

// #region No-op Helpers

/**
 * No-op updateRow function for rows without IDs.
 * Extracted to a named function to satisfy eslint no-empty-function.
 */
export function noopUpdateRow(_changes: unknown): void {
  // Row has no ID - cannot update
}

// #endregion

// #region Editor Input Wiring

/**
 * Auto-wire commit/cancel lifecycle for input elements in string-returned editors.
 */
export function wireEditorInputs(
  editorHost: HTMLElement,
  column: ColumnConfig<unknown>,
  commit: (value: unknown) => void,
  originalValue?: unknown,
): void {
  const input = editorHost.querySelector('input,textarea,select') as
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement
    | null;
  if (!input) return;

  input.addEventListener('blur', () => {
    commit(getInputValue(input, column, originalValue));
  });

  if (input instanceof HTMLInputElement && input.type === 'checkbox') {
    input.addEventListener('change', () => commit(input.checked));
  } else if (input instanceof HTMLSelectElement) {
    input.addEventListener('change', () => commit(getInputValue(input, column, originalValue)));
  }
}

// #endregion

// #region Edit Guard

/**
 * Returns `true` when the configured `onBeforeEditClose` callback vetoes
 * the close (i.e. returns `false`).  Use as a one-liner guard:
 *
 * ```ts
 * if (shouldPreventEditClose(config, e)) return;
 * ```
 */
export function shouldPreventEditClose(config: EditingConfig, event: MouseEvent | KeyboardEvent): boolean {
  return config.onBeforeEditClose?.(event) === false;
}

// #endregion

// #region ARIA Overlay Detection

/**
 * Returns `true` when `target` is inside an overlay panel that is currently
 * "owned" by an open combobox/listbox/menu inside `scopeEl`.
 *
 * Detection uses the WAI-ARIA pattern: a control with
 * `aria-expanded="true"` and `aria-controls="<id>"` declares ownership of
 * the panel with that id. Used by the editing plugin as a generic fallback
 * so portal-rendered overlays from libraries like Downshift, Material UI,
 * or Headless UI are recognised as part of the active editor without the
 * consumer having to call `registerExternalFocusContainer` (#251).
 *
 * Cheap: only walks elements with `aria-expanded="true"` inside the
 * editor scope (typically zero or one).
 *
 * @internal
 */
export function isInsideOpenAriaOverlay(target: Node | null | undefined, scopeEl: HTMLElement): boolean {
  if (!target) return false;
  const triggers = scopeEl.querySelectorAll<HTMLElement>('[aria-expanded="true"][aria-controls]');
  for (let i = 0; i < triggers.length; i++) {
    const id = triggers[i].getAttribute('aria-controls');
    if (!id) continue;
    const panel = scopeEl.ownerDocument?.getElementById(id);
    if (panel && panel.contains(target as Node)) return true;
  }
  return false;
}

// #endregion

// #region Row Comparison

/**
 * Shallow-compare a snapshot against the current row to detect changes.
 * Returns `true` if any own-property value differs between the two objects.
 */
export function hasRowChanged<T>(snapshot: T | undefined, current: T): boolean {
  if (!snapshot) return false;
  const snapshotObj = snapshot as Record<string, unknown>;
  const currentObj = current as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(snapshotObj), ...Object.keys(currentObj)]);
  for (const key of allKeys) {
    if (snapshotObj[key] !== currentObj[key]) return true;
  }
  return false;
}

// #endregion
