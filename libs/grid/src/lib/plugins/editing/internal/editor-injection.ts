/**
 * Editor injection logic for the Editing Plugin.
 *
 * Extracted from EditingPlugin to reduce the main file size.
 * Contains the DOM-heavy editor creation and template rendering,
 * while the plugin retains state management and event emission.
 *
 * @internal
 */

import { EDITOR_MOUNT_ERROR, warnDiagnostic } from '../../../core/internal/diagnostics';
import { parkCellLoadingOverlay } from '../../../core/internal/loading';
import { compileTemplate, scrubEditorMarkup } from '../../../core/internal/sanitize';
import { readCellField, writeCellField } from '../../../core/internal/value-accessor';
import type {
  ColumnConfig,
  ColumnEditorContext,
  ColumnInternal,
  GridHost,
  RowElementInternal,
} from '../../../core/types';
import { defaultEditorFor, getInputValue, isSameEditorValue, setInputValue } from '../editors';
import type { EditingConfig } from '../types';
import {
  FOCUSABLE_EDITOR_SELECTOR,
  getEditorAncestor,
  incrementEditingCount,
  isEscapeForOpenOverlay,
  isSafePropertyKey,
  markEnterDeferredToEditor,
  noopUpdateRow,
  resolveEditor,
  shouldPreventEditClose,
  wireEditorInputs,
} from './helpers';

// #region Types

/**
 * Dependencies injected by the EditingPlugin so the extraction
 * can call back into plugin-owned state and methods.
 */
export interface EditorInjectionDeps<T> {
  /** Internal grid reference (also serves as HTMLElement). */
  grid: GridHost<T>;
  /** Whether the grid is in always-editing "grid" mode. */
  isGridMode: boolean;
  /** Plugin configuration. */
  config: EditingConfig;
  /** Set of cells currently in edit mode ("rowIndex:colIndex"). */
  editingCells: Set<string>;
  /** Value-change callbacks keyed by "rowIndex:field". */
  editorValueCallbacks: Map<string, (newValue: unknown) => void>;
  /** Returns `true` when an edit session is active (#activeEditRow !== -1). */
  isEditSessionActive: () => boolean;
  /**
   * Commit a single cell value change. `rowIndex` is honoured in grid mode only — in
   * row mode the plugin substitutes the active edit row, because editors outlive
   * their row moving to another index and this index can be stale (#572).
   */
  commitCellValue: (rowIndex: number, column: ColumnConfig<T>, newValue: unknown, rowData: T) => void;
  /**
   * Exit editing for a row (commit or revert). `rowIndex` is honoured in grid mode
   * only — row mode always exits the active edit row (#572).
   */
  exitRowEdit: (rowIndex: number, revert: boolean) => void;
}

type NativeInput = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const NATIVE_INPUT_SELECTOR = 'input,textarea,select';

// #endregion

// #region Editor Injection

/**
 * Inject an editor into a cell element.
 *
 * Handles the full editor lifecycle: creates the editor host, resolves
 * the editor spec (template / custom-element / factory / component),
 * wires commit/cancel callbacks, and registers value-change listeners.
 */
export function injectEditor<T>(
  deps: EditorInjectionDeps<T>,
  rowData: T,
  rowIndex: number,
  column: ColumnConfig<T>,
  colIndex: number,
  cell: HTMLElement,
  skipFocus: boolean,
  parentRowEl?: HTMLElement,
): void {
  if (!column.editable) return;
  if (cell.classList.contains('editing')) return;

  const { grid, isGridMode, config, editingCells, editorValueCallbacks } = deps;

  const rowId = tryGetRowId(grid, rowData);

  // Cascade updates from the editor context (noop if the row has no ID)
  const updateRow: (changes: Partial<T>) => void = rowId
    ? (changes) => grid.updateRow?.(rowId, changes, 'cascade')
    : noopUpdateRow;

  const originalValue = isSafePropertyKey(column.field) ? readCellField(rowData, column.field) : undefined;

  cell.classList.add('editing');
  editingCells.add(`${rowIndex}:${colIndex}`);

  // Use explicit parentRowEl when cell is in a DocumentFragment (not yet in DOM),
  // otherwise fall back to cell.parentElement for cells already attached to a row.
  const rowEl = (parentRowEl ?? cell.parentElement) as RowElementInternal | null;
  if (rowEl) incrementEditingCount(rowEl);

  // Resolve row and index fresh at commit/cancel time. With a row ID we use
  // _getRowEntry for O(1) lookup — resilient against _rows being replaced
  // (e.g. Angular directive effect). Without a row ID we fall back to the
  // captured rowData reference: _rows[rowIndex] would be unsafe because the
  // index may be stale after replacement and commit to the WRONG row.
  const resolveCurrentRow = (): { row: T; index: number } => {
    const entry = rowId ? grid._getRowEntry(rowId) : undefined;
    return { row: (entry?.row ?? rowData) as T, index: entry?.index ?? rowIndex };
  };
  // The row's CURRENT value — what native-control re-reads dedupe against (#551).
  const currentValue = (): unknown =>
    isSafePropertyKey(column.field) ? readCellField(resolveCurrentRow().row, column.field) : undefined;

  let editFinalized = false;
  const commit = (newValue: unknown) => {
    // In grid mode, always allow commits (we're always editing)
    // In row mode, only allow commits if we're in an active edit session
    if (editFinalized || (!isGridMode && !deps.isEditSessionActive())) return;
    const { row, index } = resolveCurrentRow();
    deps.commitCellValue(index, column, newValue, row);
  };
  const cancel = () => {
    editFinalized = true;
    if (isSafePropertyKey(column.field)) writeCellField(resolveCurrentRow().row, column.field, originalValue);
  };

  const editorHost = document.createElement('div');
  editorHost.className = 'tbw-editor-host';
  const loadingOverlay = parkCellLoadingOverlay(cell);
  // Let the framework adapter (React/Vue/Angular) tear down any renderer
  // it mounted into this cell BEFORE we wipe the DOM. The `cell.innerHTML`
  // assignment below removes adapter-managed nodes synchronously without
  // notifying the framework — which leaves React's fiber tree pointing at
  // orphan DOM and throws `removeChild` on the next user-triggered commit
  // (issue #250). Calling `releaseCell` here unmounts cleanly while the
  // adapter's container is still attached to its remembered children.
  // Guard with `firstElementChild` so default-rendered cells (no
  // adapter-managed nodes) skip the no-op call — matches the wipe-guard
  // pattern in `core/internal/rows.ts`.
  if (cell.firstElementChild) grid.__frameworkAdapter?.releaseCell?.(cell);
  cell.innerHTML = '';
  cell.appendChild(editorHost);
  if (loadingOverlay) cell.appendChild(loadingOverlay);

  // Single Enter/Escape handler for EVERY editor kind — template editors
  // included. Keeping the guards below in one place is what makes the
  // #250/#251/#427/#557/#558 behaviour hold across all paths.
  editorHost.addEventListener('keydown', (e: KeyboardEvent) => {
    // Respect editor-level preventDefault: portal-based pickers (combobox,
    // autocomplete, calendar) call preventDefault on Enter to confirm an
    // option without exiting the row. Bubbling reaches editorHost with
    // defaultPrevented=true; honor that and skip the row-exit logic (#250).
    // Marked so the plugin's grid-mode Enter handler leaves focus alone too.
    if (e.defaultPrevented) {
      if (e.key === 'Enter') markEnterDeferredToEditor(e);
      return;
    }
    if (e.key === 'Enter') {
      // ARIA-expanded fallback (#251): when the focused control declares
      // an open overlay via aria-expanded="true" + aria-controls, defer
      // Enter to the overlay so combobox confirmation does not close the
      // row edit. Covers libraries like Downshift / Headless UI / MUI
      // Autocomplete that do not call preventDefault on confirm.
      // Only short-circuit Enter here — Escape is guarded below by
      // `isEscapeForOpenOverlay` (#558), whose verdict is cached per event
      // because the overlay's own handler may already have closed it.
      const target = e.target as HTMLElement | null;
      if (target?.getAttribute?.('aria-expanded') === 'true' && target.hasAttribute?.('aria-controls')) {
        markEnterDeferredToEditor(e);
        return;
      }
      // Native <select> open-popup guard — applies in BOTH grid and row mode.
      // When Enter's target is a *descendant* of the editor (most notably an
      // <option> inside an open native <select> popup), do nothing: let the
      // browser commit the highlighted option and close the popup, which fires
      // `change` on the editor (committing via the change listener wired below).
      // Calling preventDefault / stopPropagation / exitRowEdit here would
      // destroy the open popup and discard the selection. A subsequent Enter
      // (popup closed → target IS the editor) then exits the row as usual.
      // Row mode previously lacked this guard, so keyboard selection in custom
      // <select> editors closed the row instead of picking the value (#427).
      const enterEditorAncestor = getEditorAncestor(target);
      if (enterEditorAncestor && enterEditorAncestor !== target) return;
      // In grid mode, Enter just commits without exiting
      if (isGridMode) {
        // Target IS the editor itself (SELECT with no popup open, or
        // INPUT/TEXTAREA): commit the current value. preventDefault
        // suppresses the browser opening the SELECT popup on Enter.
        // We deliberately do NOT stopPropagation — the event must
        // bubble so EditingPlugin can blur the editor and return
        // focus to the grid for cell navigation.
        e.preventDefault();
        // Framework / wrapper editors own their value: reading a raw inner
        // input here would commit a draft string ahead of the editor's own
        // blur-commit (mirrors the `#commitActiveEditors` skip on row close).
        if (cell.hasAttribute('data-editor-managed')) return;
        const input = editorHost.querySelector<NativeInput>(NATIVE_INPUT_SELECTOR);
        if (!input) return;
        // Same live-row dedupe as `wireEditorInputs` (#551): a multi-select's
        // `change` already committed this selection, and `getInputValue`
        // returns a fresh array that `#commitCellValue`'s `===` would accept
        // again — repeating consumer validation and cascades.
        const next = getInputValue(input, column, originalValue);
        if (isSameEditorValue(currentValue(), next)) return;
        commit(next);
        return;
      }
      if (shouldPreventEditClose(config, e)) return;
      e.stopPropagation();
      e.preventDefault();
      // Finalize AFTER exitRowEdit (#557): it emits `before-edit-close`, during
      // which blur-commit editors (adapter blur bridge) must still be able to
      // flush via commit(). Teardown blurs are rejected by the session guard.
      deps.exitRowEdit(rowIndex, false);
      editFinalized = true;
    } else if (e.key === 'Escape') {
      // In grid mode, Escape doesn't exit edit mode
      if (isGridMode) {
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      if (isEscapeForOpenOverlay(e, editorHost)) return;
      if (shouldPreventEditClose(config, e)) return;
      e.stopPropagation();
      e.preventDefault();
      cancel();
      deps.exitRowEdit(rowIndex, true);
    }
  });

  const colInternal = column as ColumnInternal<T>;
  const tplHolder = colInternal.__editorTemplate;
  // Resolve editor using priority chain: column → template → typeDefaults → adapter → built-in
  const editorSpec = resolveEditor(grid, colInternal) ?? defaultEditorFor(column);

  // Value-change callback registration.
  // Editors call onValueChange(cb) to receive pushes when the underlying row
  // is mutated externally (e.g., via updateRow from another cell's commit).
  // Multiple callbacks can be registered (user + auto-wire).
  const callbacks: Array<(newValue: unknown) => void> = [];
  editorValueCallbacks.set(`${rowIndex}:${column.field}`, (newVal) => {
    for (const cb of callbacks) cb(newVal);
  });
  const onValueChange = (cb: (newValue: unknown) => void) => {
    callbacks.push(cb);
  };
  // Push an external update into the host's first native control — the
  // inverse of getInputValue (#555), never `input.value = String(v)`.
  const pushIntoNativeInput = (newVal: unknown) => {
    const input = editorHost.querySelector<NativeInput>(NATIVE_INPUT_SELECTOR);
    if (input) setInputValue(input, newVal, column);
  };

  const ctx: ColumnEditorContext<T> = {
    row: rowData,
    rowId: rowId ?? '',
    value: originalValue,
    field: column.field,
    column,
    commit,
    cancel,
    updateRow,
    onValueChange,
    grid: grid as ColumnEditorContext<T>['grid'],
  };

  let autoFocus = !skipFocus;

  if (editorSpec === 'template' && tplHolder) {
    renderTemplateEditor(editorHost, colInternal, tplHolder, rowData, originalValue, commit, cancel, currentValue);
    // Skip non-primitive values (arrays, objects) — framework adapters manage
    // those via the cell-cancel event — except those setInputValue can map:
    // arrays onto a multi-select's options, and a Date into a date input (#555).
    onValueChange((newVal) => {
      const input = editorHost.querySelector<NativeInput>(NATIVE_INPUT_SELECTOR);
      if (!input) return;
      const isMultiSelect = input instanceof HTMLSelectElement && input.multiple;
      const isDateIntoDateInput = newVal instanceof Date && input instanceof HTMLInputElement && input.type === 'date';
      if (!isMultiSelect && !isDateIntoDateInput && newVal != null && typeof newVal === 'object') return;
      setInputValue(input, newVal, column);
    });
  } else if (typeof editorSpec === 'string') {
    const el = document.createElement(editorSpec) as HTMLElement & { value?: unknown };
    el.value = originalValue;
    el.addEventListener('change', () => commit(el.value));
    onValueChange((newVal) => {
      el.value = newVal;
    });
    editorHost.appendChild(el);
  } else if (typeof editorSpec === 'function') {
    // Adapter factories mount into the host and return nothing, which the
    // declared `HTMLElement | string` return type does not admit.
    const produced = (editorSpec as (context: ColumnEditorContext<T>) => HTMLElement | string | undefined)(ctx);
    if (typeof produced === 'string') {
      // Not `setSanitizedHTML`: it strips `input`/`select`/`textarea`/`button`,
      // which is exactly what an editor is made of. The string is author code,
      // but it may interpolate row data, so the parsed tree gets the editor-safe
      // scrub (event handlers, `javascript:` URLs) with the controls kept.
      // eslint-disable-next-line no-restricted-syntax
      editorHost.innerHTML = produced;
      scrubEditorMarkup(editorHost);
      wireEditorInputs(editorHost, column, commit, originalValue, currentValue);
      onValueChange(pushIntoNativeInput);
    } else if (produced instanceof Node) {
      editorHost.appendChild(produced);
      if (
        produced instanceof HTMLInputElement ||
        produced instanceof HTMLSelectElement ||
        produced instanceof HTMLTextAreaElement
      ) {
        onValueChange((newVal) => setInputValue(produced, newVal, column));
      } else {
        cell.setAttribute('data-editor-managed', '');
      }
    } else if (!produced && editorHost.hasChildNodes()) {
      // Factory returned void but mounted content into the editor host
      // (e.g. Angular/React/Vue adapter component editor). Mark the cell
      // as externally managed so the native commit loop in #exitRowEdit
      // does not read raw input values from framework editor DOM.
      cell.setAttribute('data-editor-managed', '');
    }
  } else if (editorSpec && typeof editorSpec === 'object') {
    autoFocus = false;
    const placeholder = document.createElement('div');
    placeholder.setAttribute('data-external-editor', '');
    placeholder.setAttribute('data-field', column.field);
    editorHost.appendChild(placeholder);
    cell.setAttribute('data-editor-managed', '');
    if (editorSpec.mount) {
      try {
        editorSpec.mount({ placeholder, context: ctx, spec: editorSpec });
      } catch (e) {
        warnDiagnostic(EDITOR_MOUNT_ERROR, `External editor mount error for column '${column.field}': ${e}`, grid.id);
      }
    } else {
      grid.dispatchEvent(
        new CustomEvent('mount-external-editor', { detail: { placeholder, spec: editorSpec, context: ctx } }),
      );
    }
  }

  // Deferred a microtask so editors that mount asynchronously are covered.
  // Name BEFORE focus: the initial screen-reader announcement reads the name
  // present at focus time, so a label assigned afterwards is announced late.
  queueMicrotask(() => {
    const control = editorHost.querySelector<HTMLElement>(FOCUSABLE_EDITOR_SELECTOR);
    if (!control) return;
    nameEditorFromHeader(control, editorHost, column);
    if (autoFocus) control.focus({ preventScroll: true });
  });
}

function tryGetRowId<T>(grid: GridHost<T>, row: T): string | undefined {
  try {
    return grid.getRowId?.(row);
  } catch {
    return undefined; // Row has no ID
  }
}

/**
 * Give the editor an accessible name taken from its column header.
 *
 * A screen reader announces the header when focus lands on a *gridcell*, but an
 * `<input>` inside that cell is a control in its own right and needs its own
 * name (SC 4.1.2 / SC 3.3.2) — otherwise it is announced as a bare "edit text".
 * Skipped entirely whenever the control already has a name of any kind.
 */
function nameEditorFromHeader<T>(control: HTMLElement, editorHost: HTMLElement, column: ColumnConfig<T>): void {
  const label = typeof column.header === 'string' ? column.header : column.field;
  if (!label) return;
  const named =
    control.hasAttribute('aria-label') ||
    control.hasAttribute('aria-labelledby') ||
    control.hasAttribute('title') ||
    (control.id && editorHost.querySelector(`label[for="${CSS.escape(control.id)}"]`)) ||
    control.closest('label');
  if (!named) control.setAttribute('aria-label', label);
}

// #endregion

// #region Template Editor

/**
 * Render a `<tbw-grid-column-editor>` template inside an editor host element.
 *
 * Enter/Escape are handled by the host keydown listener in {@link injectEditor};
 * only blur/change commits are wired here (via `wireEditorInputs`, like the
 * HTML-string factory path).
 */
function renderTemplateEditor<T>(
  editorHost: HTMLElement,
  column: ColumnInternal<T>,
  tplHolder: HTMLElement,
  rowData: T,
  originalValue: unknown,
  commit: (value: unknown) => void,
  cancel: () => void,
  currentValue: () => unknown,
): void {
  // Compiled lazily and plugin-owned: `__editorTemplate` is assigned in the
  // plugin's `processColumns` hook; config-manager compiles view templates only.
  // `keepMarkupWhenEmpty` — unlike a view, an editor whose every `{{ }}` is
  // blank (`<input value="{{ value }}">` on a null cell) must still render.
  const compiled = (column.__compiledEditor ??= compileTemplate(tplHolder.innerHTML, { keepMarkupWhenEmpty: true }));

  const wrapper = tplHolder.cloneNode(false) as HTMLElement;
  // Not `setSanitizedHTML`: editor markup is author light-DOM (`<template editor>`)
  // and contains form controls the sanitizer would strip. `{{ }}` escaping stops
  // row data from breaking out of an attribute, but not a `javascript:` value
  // landing in `href="{{ row.url }}"` — the editor-safe scrub below drops those
  // (and event handlers) while keeping the controls.
  // eslint-disable-next-line no-restricted-syntax
  wrapper.innerHTML = compiled({
    row: rowData,
    value: originalValue,
    field: column.field,
    column,
    commit,
    cancel,
  });
  scrubEditorMarkup(wrapper);
  editorHost.appendChild(wrapper);

  const input = wrapper.querySelector<NativeInput>(NATIVE_INPUT_SELECTOR);
  if (!input) return;
  // Seed through the inverse of getInputValue (#555): `input.value = String(v)`
  // would deselect every option of a multi-select and blank a date input.
  setInputValue(input, originalValue, column);
  wireEditorInputs(editorHost, column, commit, originalValue, currentValue);
}

// #endregion
