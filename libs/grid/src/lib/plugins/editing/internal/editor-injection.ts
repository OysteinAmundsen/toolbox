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
import type {
  ColumnConfig,
  ColumnEditorContext,
  ColumnInternal,
  GridHost,
  RowElementInternal,
} from '../../../core/types';
import { defaultEditorFor, getInputValue } from '../editors';
import type { EditingConfig } from '../types';
import {
  FOCUSABLE_EDITOR_SELECTOR,
  incrementEditingCount,
  isSafePropertyKey,
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
  /** Commit a single cell value change. */
  commitCellValue: (rowIndex: number, column: ColumnConfig<T>, newValue: unknown, rowData: T) => void;
  /** Exit editing for a row (commit or revert). */
  exitRowEdit: (rowIndex: number, revert: boolean) => void;
}

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

  // Get row ID for updateRow helper (may not exist)
  let rowId: string | undefined;
  try {
    rowId = grid.getRowId?.(rowData);
  } catch {
    // Row has no ID
  }

  // Create updateRow helper for cascade updates (noop if row has no ID)
  const updateRow: (changes: Partial<T>) => void = rowId
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (changes) => (grid as any).updateRow(rowId!, changes as Record<string, unknown>, 'cascade')
    : noopUpdateRow;

  const originalValue = isSafePropertyKey(column.field)
    ? (rowData as Record<string, unknown>)[column.field]
    : undefined;

  cell.classList.add('editing');
  editingCells.add(`${rowIndex}:${colIndex}`);

  // Use explicit parentRowEl when cell is in a DocumentFragment (not yet in DOM),
  // otherwise fall back to cell.parentElement for cells already attached to a row.
  const rowEl = (parentRowEl ?? cell.parentElement) as RowElementInternal | null;
  if (rowEl) incrementEditingCount(rowEl);

  let editFinalized = false;
  const commit = (newValue: unknown) => {
    // In grid mode, always allow commits (we're always editing)
    // In row mode, only allow commits if we're in an active edit session
    if (editFinalized || (!isGridMode && !deps.isEditSessionActive())) return;
    // Resolve row and index fresh at commit time.
    // With a row ID we use _getRowEntry for O(1) lookup — this is resilient
    // against _rows being replaced (e.g. Angular directive effect).
    // Without a row ID we fall back to the captured rowData reference.
    // Using _rows[rowIndex] without an ID is unsafe: the index may be stale
    // after _rows replacement, which would commit to the WRONG row.
    const entry = rowId ? grid._getRowEntry(rowId) : undefined;
    const currentRowData = (entry?.row ?? rowData) as T;
    const currentIndex = entry?.index ?? rowIndex;
    deps.commitCellValue(currentIndex, column, newValue, currentRowData);
  };
  const cancel = () => {
    editFinalized = true;
    if (isSafePropertyKey(column.field)) {
      // Same ID-first / captured-rowData fallback as commit — see comment above.
      const entry = rowId ? grid._getRowEntry(rowId) : undefined;
      const currentRowData = (entry?.row ?? rowData) as T;
      (currentRowData as Record<string, unknown>)[column.field] = originalValue;
    }
  };

  const editorHost = document.createElement('div');
  editorHost.className = 'tbw-editor-host';
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

  // Keydown handler for Enter/Escape
  editorHost.addEventListener('keydown', (e: KeyboardEvent) => {
    // Respect editor-level preventDefault: portal-based pickers (combobox,
    // autocomplete, calendar) call preventDefault on Enter to confirm an
    // option without exiting the row. Bubbling reaches editorHost with
    // defaultPrevented=true; honor that and skip the row-exit logic (#250).
    if (e.defaultPrevented) return;
    // ARIA-expanded fallback (#251): when the focused control declares
    // an open overlay via aria-expanded="true" + aria-controls, defer
    // Enter to the overlay so combobox confirmation does not close the
    // row edit. Covers libraries like Downshift / Headless UI / MUI
    // Autocomplete that do not call preventDefault on confirm.
    // Only short-circuit Enter — Escape and other keys must still flow
    // through the normal handlers (Escape closes the overlay first via
    // its own listener, then dispatches up to cancel-edit if unhandled).
    if (e.key === 'Enter') {
      const ariaTarget = e.target as HTMLElement | null;
      if (
        ariaTarget &&
        ariaTarget.getAttribute?.('aria-expanded') === 'true' &&
        ariaTarget.hasAttribute?.('aria-controls')
      ) {
        return;
      }
    }
    if (e.key === 'Enter') {
      // In grid mode, Enter just commits without exiting
      if (isGridMode) {
        e.stopPropagation();
        e.preventDefault();
        // Get current value and commit
        const input = editorHost.querySelector('input,textarea,select') as
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLSelectElement
          | null;
        if (input) {
          commit(getInputValue(input, column as ColumnConfig<unknown>, originalValue));
        }
        return;
      }
      if (shouldPreventEditClose(config, e)) return;
      e.stopPropagation();
      e.preventDefault();
      editFinalized = true;
      deps.exitRowEdit(rowIndex, false);
    }
    if (e.key === 'Escape') {
      // In grid mode, Escape doesn't exit edit mode
      if (isGridMode) {
        e.stopPropagation();
        e.preventDefault();
        return;
      }
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
  const value = originalValue;

  // Value-change callback registration.
  // Editors call onValueChange(cb) to receive pushes when the underlying row
  // is mutated externally (e.g., via updateRow from another cell's commit).
  // Multiple callbacks can be registered (user + auto-wire).
  const callbackKey = `${rowIndex}:${column.field}`;
  const callbacks: Array<(newValue: unknown) => void> = [];
  editorValueCallbacks.set(callbackKey, (newVal) => {
    for (const cb of callbacks) cb(newVal);
  });
  const onValueChange = (cb: (newValue: unknown) => void) => {
    callbacks.push(cb);
  };

  if (editorSpec === 'template' && tplHolder) {
    renderTemplateEditor(deps, editorHost, colInternal, rowData, originalValue, commit, cancel, skipFocus, rowIndex);
    // Auto-update built-in template editors when value changes externally.
    // Skip non-primitive values (arrays, objects) — framework adapters manage
    // those via the cell-cancel event. String() on arrays produces comma-separated junk.
    onValueChange((newVal) => {
      if (newVal != null && typeof newVal === 'object') return;
      const input = editorHost.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        'input,textarea,select',
      );
      if (input) {
        if (input instanceof HTMLInputElement && input.type === 'checkbox') {
          input.checked = !!newVal;
        } else {
          input.value = String(newVal ?? '');
        }
      }
    });
  } else if (typeof editorSpec === 'string') {
    const el = document.createElement(editorSpec) as HTMLElement & { value?: unknown };
    el.value = value;
    el.addEventListener('change', () => commit(el.value));
    // Auto-update custom element editors when value changes externally
    onValueChange((newVal) => {
      el.value = newVal;
    });
    editorHost.appendChild(el);
    if (!skipFocus) {
      queueMicrotask(() => {
        const focusable = editorHost.querySelector(FOCUSABLE_EDITOR_SELECTOR) as HTMLElement | null;
        focusable?.focus({ preventScroll: true });
      });
    }
  } else if (typeof editorSpec === 'function') {
    const ctx: ColumnEditorContext<T> = {
      row: rowData,
      rowId: rowId ?? '',
      value,
      field: column.field,
      column,
      commit,
      cancel,
      updateRow,
      onValueChange,
      grid: deps.grid as ColumnEditorContext<T>['grid'],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const produced = (editorSpec as any)(ctx);
    if (typeof produced === 'string') {
      editorHost.innerHTML = produced;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      wireEditorInputs(editorHost, column as any, commit, originalValue);
      // Auto-update wired inputs when value changes externally
      onValueChange((newVal) => {
        const input = editorHost.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
          'input,textarea,select',
        );
        if (input) {
          if (input instanceof HTMLInputElement && input.type === 'checkbox') {
            input.checked = !!newVal;
          } else {
            input.value = String(newVal ?? '');
          }
        }
      });
    } else if (produced instanceof Node) {
      editorHost.appendChild(produced);
      const isSimpleInput =
        produced instanceof HTMLInputElement ||
        produced instanceof HTMLSelectElement ||
        produced instanceof HTMLTextAreaElement;
      if (!isSimpleInput) {
        cell.setAttribute('data-editor-managed', '');
      } else {
        // Auto-update simple inputs returned by factory functions
        onValueChange((newVal) => {
          if (produced instanceof HTMLInputElement && produced.type === 'checkbox') {
            produced.checked = !!newVal;
          } else {
            (produced as HTMLInputElement).value = String(newVal ?? '');
          }
        });
      }
    } else if (!produced && editorHost.hasChildNodes()) {
      // Factory returned void but mounted content into the editor host
      // (e.g. Angular/React/Vue adapter component editor). Mark the cell
      // as externally managed so the native commit loop in #exitRowEdit
      // does not read raw input values from framework editor DOM.
      cell.setAttribute('data-editor-managed', '');
    }
    if (!skipFocus) {
      queueMicrotask(() => {
        const focusable = editorHost.querySelector(FOCUSABLE_EDITOR_SELECTOR) as HTMLElement | null;
        focusable?.focus({ preventScroll: true });
      });
    }
  } else if (editorSpec && typeof editorSpec === 'object') {
    const placeholder = document.createElement('div');
    placeholder.setAttribute('data-external-editor', '');
    placeholder.setAttribute('data-field', column.field);
    editorHost.appendChild(placeholder);
    cell.setAttribute('data-editor-managed', '');
    const context: ColumnEditorContext<T> = {
      row: rowData,
      rowId: rowId ?? '',
      value,
      field: column.field,
      column,
      commit,
      cancel,
      updateRow,
      onValueChange,
      grid: deps.grid as ColumnEditorContext<T>['grid'],
    };
    if (editorSpec.mount) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        editorSpec.mount({ placeholder, context: context as any, spec: editorSpec });
      } catch (e) {
        warnDiagnostic(
          EDITOR_MOUNT_ERROR,
          `External editor mount error for column '${column.field}': ${e}`,
          deps.grid.id,
        );
      }
    } else {
      grid.dispatchEvent(
        new CustomEvent('mount-external-editor', { detail: { placeholder, spec: editorSpec, context } }),
      );
    }
  }
}

// #endregion

// #region Template Editor

/**
 * Render a template-based editor inside an editor host element.
 */
function renderTemplateEditor<T>(
  deps: Pick<EditorInjectionDeps<T>, 'config' | 'exitRowEdit'>,
  editorHost: HTMLElement,
  column: ColumnInternal<T>,
  rowData: T,
  originalValue: unknown,
  commit: (value: unknown) => void,
  cancel: () => void,
  skipFocus: boolean,
  rowIndex: number,
): void {
  const tplHolder = column.__editorTemplate;
  if (!tplHolder) return;

  const clone = tplHolder.cloneNode(true) as HTMLElement;
  const compiledEditor = column.__compiledEditor;

  if (compiledEditor) {
    clone.innerHTML = compiledEditor({
      row: rowData,
      value: originalValue,
      field: column.field,
      column,
      commit,
      cancel,
    });
  } else {
    clone.querySelectorAll<HTMLElement>('*').forEach((node) => {
      if (node.childNodes.length === 1 && node.firstChild?.nodeType === Node.TEXT_NODE) {
        node.textContent =
          node.textContent
            ?.replace(/{{\s*value\s*}}/g, originalValue == null ? '' : String(originalValue))
            .replace(/{{\s*row\.([a-zA-Z0-9_]+)\s*}}/g, (_m, g: string) => {
              if (!isSafePropertyKey(g)) return '';
              const v = (rowData as Record<string, unknown>)[g];
              return v == null ? '' : String(v);
            }) || '';
      }
    });
  }

  const input = clone.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    'input,textarea,select',
  );
  if (input) {
    if (input instanceof HTMLInputElement && input.type === 'checkbox') {
      input.checked = !!originalValue;
    } else {
      input.value = String(originalValue ?? '');
    }

    let editFinalized = false;
    input.addEventListener('blur', () => {
      if (editFinalized) return;
      commit(getInputValue(input, column, originalValue));
    });
    input.addEventListener('keydown', (evt) => {
      const e = evt as KeyboardEvent;
      if (e.key === 'Enter') {
        if (shouldPreventEditClose(deps.config, e)) return;
        e.stopPropagation();
        e.preventDefault();
        editFinalized = true;
        commit(getInputValue(input, column, originalValue));
        deps.exitRowEdit(rowIndex, false);
      }
      if (e.key === 'Escape') {
        if (shouldPreventEditClose(deps.config, e)) return;
        e.stopPropagation();
        e.preventDefault();
        cancel();
        deps.exitRowEdit(rowIndex, true);
      }
    });
    if (input instanceof HTMLInputElement && input.type === 'checkbox') {
      input.addEventListener('change', () => commit(input.checked));
    }
    if (!skipFocus) {
      setTimeout(() => input.focus({ preventScroll: true }), 0);
    }
  }
  editorHost.appendChild(clone);
}

// #endregion
