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
import { getInputValue, isSameEditorValue } from '../editors';
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

/**
 * Returns the closest ancestor (or `target` itself) that matches
 * {@link FOCUSABLE_EDITOR_SELECTOR}, or `null` if none exists.
 *
 * Always prefer this over `target.matches(FOCUSABLE_EDITOR_SELECTOR)` —
 * non-focusable editor descendants (e.g. `<option>` inside an open
 * native `<select>` popup; spans inside `contenteditable`) need to be
 * recognised as "inside the editor" but do not themselves match the
 * selector.
 *
 * @internal
 */
export function getEditorAncestor(target: EventTarget | null | undefined): Element | null {
  const el = target as Element | null | undefined;
  return el?.closest?.(FOCUSABLE_EDITOR_SELECTOR) ?? null;
}

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
 * Auto-wire blur/change commits for the first native control in an editor host
 * (HTML-string factory editors and `<tbw-grid-column-editor>` templates).
 *
 * `currentValue` reads the row's live value. A re-read that is already equal to
 * it is skipped — `getInputValue` returns a fresh array per call for a
 * `<select multiple>` and `#commitCellValue` compares by reference, so `change`
 * followed by `blur` would otherwise emit two accepted `cell-commit`s for one
 * selection (#551). The comparison is against the ROW, never a cached baseline:
 * a vetoed commit or an external update must stay retryable.
 */
export function wireEditorInputs<T>(
  editorHost: HTMLElement,
  column: ColumnConfig<T>,
  commit: (value: unknown) => void,
  originalValue?: unknown,
  currentValue?: () => unknown,
): void {
  const input = editorHost.querySelector('input,textarea,select') as
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  if (!input) return;

  const commitRead = () => {
    const next = getInputValue(input, column, originalValue);
    if (currentValue && isSameEditorValue(currentValue(), next)) return;
    commit(next);
  };

  input.addEventListener('blur', commitRead);

  if (input instanceof HTMLInputElement && input.type === 'checkbox') {
    input.addEventListener('change', () => commit(input.checked));
  } else if (input instanceof HTMLSelectElement) {
    input.addEventListener('change', commitRead);
  }
}

// #endregion

// #region Edit Guard

type BeforeEditCloseFn = NonNullable<EditingConfig['onBeforeEditClose']>;

/**
 * Enter events the editor host deferred to the editor itself — editor-level
 * `preventDefault()` (#250) or an open ARIA overlay (#251). Marked per event so
 * `EditingPlugin`'s grid-mode Enter handler, which runs later on the same
 * bubble, can tell "the editor owns this Enter" from "the host already
 * committed it" — both reach the plugin with `defaultPrevented === true`.
 */
const enterDeferredToEditor = new WeakSet<Event>();

/** Record that the host keydown handler handed `event` (Enter) to the editor. */
export function markEnterDeferredToEditor(event: KeyboardEvent): void {
  enterDeferredToEditor.add(event);
}

/**
 * Whether Enter belongs to the editor: the host deferred it, or the target
 * declares an open overlay (`aria-expanded="true"` + `aria-controls`). The
 * attribute check repeats the host's so the verdict holds even when the host
 * handler did not see the event (editor focused outside the host).
 */
export function isEnterOwnedByEditor(event: KeyboardEvent): boolean {
  if (enterDeferredToEditor.has(event)) return true;
  const target = event.target as HTMLElement | null;
  return target?.getAttribute?.('aria-expanded') === 'true' && !!target.hasAttribute?.('aria-controls');
}

/** Per-event cache of `onBeforeEditClose` verdicts, keyed by callback (#558). */
const editCloseVerdicts = new WeakMap<Event, Map<BeforeEditCloseFn, boolean>>();

/**
 * Returns `true` when the configured `onBeforeEditClose` callback vetoes
 * the close (i.e. returns `false`).  Use as a one-liner guard:
 *
 * ```ts
 * if (shouldPreventEditClose(config, e)) return;
 * ```
 *
 * The callback is consulted at most once per event (#558): one keystroke
 * reaches several close paths (document capture, editor host, plugin
 * `onKeyDown`) with different DOM state in between, so every path reuses
 * the first verdict instead of re-asking.
 */
export function shouldPreventEditClose(config: EditingConfig, event: MouseEvent | KeyboardEvent): boolean {
  const callback = config.onBeforeEditClose;
  if (!callback) return false;
  let verdicts = editCloseVerdicts.get(event);
  const cached = verdicts?.get(callback);
  if (cached !== undefined) return cached;
  const prevent = callback(event) === false;
  if (!verdicts) editCloseVerdicts.set(event, (verdicts = new Map()));
  verdicts.set(callback, prevent);
  return prevent;
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

/** Escape keystrokes already claimed by an open ARIA overlay → the scope that claimed them (#558). */
const escapesForOpenOverlay = new WeakMap<Event, HTMLElement>();

/**
 * `true` when the event's composed path (crosses web-component shadow roots)
 * passes through an expanded overlay trigger between its target and `scopeEl`.
 */
function pathHasOpenAriaTrigger(event: Event, scopeEl: HTMLElement): boolean {
  const path = event.composedPath?.() ?? [];
  if (!path.includes(scopeEl)) return false;
  for (const node of path) {
    if (node === scopeEl) return false;
    const el = node as Element;
    if (el.getAttribute?.('aria-expanded') === 'true' && el.hasAttribute('aria-controls')) return true;
  }
  return false;
}

/**
 * Returns `true` when this Escape keystroke belongs to an open ARIA overlay
 * (combobox list, menu, picker) rather than to the row edit — i.e. the
 * keystroke originates from an `aria-expanded="true"` + `aria-controls`
 * control (or a descendant of one) inside `scopeEl`, or from inside the
 * panel such a control owns — whether that panel is portalled to `<body>`
 * or rendered inline beside its trigger. Standard dialog-stack behaviour:
 * the first Escape closes the overlay, the next one cancels the edit (#558).
 *
 * The verdict is remembered per event: the overlay's own handler flips
 * `aria-expanded` to `"false"` while the event is still propagating, so the
 * later (bubble-phase) close paths must not re-read the live DOM. It is
 * shared only with related scopes (the row and its editor host nest); an
 * unrelated grid's row judges the keystroke on its own.
 *
 * @internal
 */
export function isEscapeForOpenOverlay(event: KeyboardEvent, scopeEl: HTMLElement | null | undefined): boolean {
  if (!scopeEl) return false;
  const claimedBy = escapesForOpenOverlay.get(event);
  if (claimedBy && (claimedBy.contains(scopeEl) || scopeEl.contains(claimedBy))) return true;
  const claimed =
    pathHasOpenAriaTrigger(event, scopeEl) || isInsideOpenAriaOverlay(event.target as Node | null, scopeEl);
  if (claimed) escapesForOpenOverlay.set(event, scopeEl);
  return claimed;
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
