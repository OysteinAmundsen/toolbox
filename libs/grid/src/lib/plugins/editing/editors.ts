/**
 * Default Editors Module
 *
 * Provides built-in editor factories for different column types.
 * Each editor type has its own factory function for consistency and readability.
 *
 * IMPORTANT: Editor factories should NOT call focus() on elements - they are called
 * before the element is appended to the DOM. The calling code (beginBulkEdit,
 * inlineEnterEdit) is responsible for focusing the correct editor after insertion.
 */

import { readCellField } from '../../core/internal/value-accessor';
import type { ColumnConfig, ColumnEditorContext } from '../../core/types';
import type { DateEditorParams, NumberEditorParams, SelectEditorParams, TextEditorParams } from './types';

// ============================================================================
// Type Aliases
// ============================================================================

/** Option shape used by select editor (matches column.options) */
type ColumnOption = { label: string; value: unknown };

/** Column with any row type (used for editor factories) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyColumn = ColumnConfig<any>;

// ============================================================================
// Utilities
// ============================================================================

/** Resolve column.options (handles both array and function forms) */
function resolveOptions(column: AnyColumn): ColumnOption[] {
  const raw = column.options;
  if (!raw) return [];
  return typeof raw === 'function' ? raw() : raw;
}

/** Format a Date as YYYY-MM-DD string */
function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ============================================================================
// Editor Factories
// ============================================================================

/** Creates a number input editor */
function createNumberEditor(column: AnyColumn): (ctx: ColumnEditorContext) => HTMLElement {
  return (ctx) => {
    const params = column.editorParams as NumberEditorParams | undefined;
    const input = document.createElement('input');
    input.type = 'number';
    input.value = ctx.value != null ? String(ctx.value) : '';

    if (params?.min !== undefined) input.min = String(params.min);
    if (params?.max !== undefined) input.max = String(params.max);
    if (params?.step !== undefined) input.step = String(params.step);
    if (params?.placeholder) input.placeholder = params.placeholder;

    const commit = () => {
      if (input.value === '') {
        if (column.nullable) {
          ctx.commit(null);
        } else {
          // Non-nullable: fall back to min value or 0
          ctx.commit(params?.min ?? 0);
        }
      } else {
        ctx.commit(Number(input.value));
      }
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') ctx.cancel();
    });

    return input;
  };
}

/** Creates a checkbox editor for boolean values */
function createBooleanEditor(): (ctx: ColumnEditorContext) => HTMLElement {
  return (ctx) => {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!ctx.value;
    input.addEventListener('change', () => ctx.commit(input.checked));
    return input;
  };
}

/** Creates a date input editor */
function createDateEditor(column: AnyColumn): (ctx: ColumnEditorContext) => HTMLElement {
  return (ctx) => {
    const params = column.editorParams as DateEditorParams | undefined;
    const input = document.createElement('input');
    input.type = 'date';

    // Set initial value - handle both Date objects and string dates
    if (ctx.value instanceof Date) {
      input.valueAsDate = ctx.value;
    } else if (typeof ctx.value === 'string' && ctx.value) {
      // String date like "2019-10-09" - set directly as value
      input.value = ctx.value.split('T')[0]; // Handle ISO strings too
    }
    if (params?.min) input.min = params.min;
    if (params?.max) input.max = params.max;
    if (params?.placeholder) input.placeholder = params.placeholder;

    // Commit function preserves original type (string vs Date)
    const commit = () => {
      if (!input.value) {
        if (column.nullable) {
          ctx.commit(null);
        } else {
          // Non-nullable: use configured default or today
          const fallback = params?.default;
          if (typeof ctx.value === 'string' || typeof fallback === 'string') {
            // String mode: use default string or today as YYYY-MM-DD
            ctx.commit(typeof fallback === 'string' ? fallback : toISODate(fallback ?? new Date()));
          } else {
            // Date object mode
            ctx.commit(fallback instanceof Date ? fallback : new Date());
          }
        }
        return;
      }
      if (typeof ctx.value === 'string') {
        // Original was string, return string in YYYY-MM-DD format
        ctx.commit(input.value);
      } else {
        ctx.commit(input.valueAsDate);
      }
    };

    input.addEventListener('change', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') ctx.cancel();
    });

    return input;
  };
}

/** Sentinel value used internally to identify the nullable "(Blank)" option */
const NULLABLE_BLANK_VALUE = '__tbw_null__';

/** Configured value behind each built-in select `<option>` — string matching would conflate `1` and `'1'`. */
const optionValues = new WeakMap<HTMLOptionElement, unknown>();

/**
 * Read a `multiple` select as an array of the configured option values, preserving
 * their original type (DOM option values are always strings). For nullable columns the
 * blank sentinel maps to `null` when it is the only selection and is dropped otherwise.
 */
function readMultiSelectValue(select: HTMLSelectElement, column?: AnyColumn): unknown {
  let options: ReturnType<typeof resolveOptions> | undefined;
  const values: unknown[] = [];
  let blankSelected = false;
  // Filter `options` rather than read `selectedOptions`: happy-dom caches that collection
  // and misses programmatic `option.selected` writes (e.g. setInputValue's external push).
  for (const o of Array.from(select.options)) {
    if (!o.selected) continue;
    if (optionValues.has(o)) {
      values.push(optionValues.get(o));
      continue;
    }
    if (column?.nullable && o.value === NULLABLE_BLANK_VALUE) {
      blankSelected = true;
      continue;
    }
    // Fallback for selects not built by createSelectEditor (custom editors).
    options ??= column ? resolveOptions(column) : [];
    const match = options.find((opt) => String(opt.value) === o.value);
    values.push(match ? match.value : o.value);
  }
  return blankSelected && values.length === 0 ? null : values;
}

/** Creates a select dropdown editor */
function createSelectEditor(column: AnyColumn): (ctx: ColumnEditorContext) => HTMLElement {
  return (ctx) => {
    const params = column.editorParams as SelectEditorParams | undefined;
    const select = document.createElement('select');
    if (column.multi) select.multiple = true;

    // Add blank option: nullable columns always get one, otherwise respect includeEmpty
    const showBlank = column.nullable || params?.includeEmpty;
    if (showBlank) {
      const emptyOpt = document.createElement('option');
      emptyOpt.value = column.nullable ? NULLABLE_BLANK_VALUE : '';
      emptyOpt.textContent = column.nullable ? (params?.emptyLabel ?? '(Blank)') : (params?.emptyLabel ?? '');
      if (ctx.value == null) emptyOpt.selected = true;
      select.appendChild(emptyOpt);
    }

    // Populate options from column.options
    const options = resolveOptions(column);
    options.forEach((opt) => {
      const o = document.createElement('option');
      o.value = String(opt.value);
      o.textContent = opt.label;
      optionValues.set(o, opt.value);
      if (column.multi && Array.isArray(ctx.value) && ctx.value.includes(opt.value)) {
        o.selected = true;
      } else if (!column.multi && ctx.value === opt.value) {
        o.selected = true;
      }
      select.appendChild(o);
    });

    const commit = () => {
      if (column.multi) {
        const next = readMultiSelectValue(select, column);
        // Compare with the row, not a local cache: a vetoed commit leaves it unchanged, so blur retries.
        if (isSameEditorValue(readCellField(ctx.row, ctx.field), next)) return;
        ctx.commit(next);
      } else if (column.nullable && select.value === NULLABLE_BLANK_VALUE) {
        ctx.commit(null);
      } else {
        ctx.commit(select.value);
      }
    };

    select.addEventListener('change', commit);
    select.addEventListener('blur', commit);
    select.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') ctx.cancel();
    });

    return select;
  };
}

/** Creates a text input editor (default) */
function createTextEditor(column: AnyColumn): (ctx: ColumnEditorContext) => HTMLElement {
  return (ctx) => {
    const params = column.editorParams as TextEditorParams | undefined;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = ctx.value != null ? String(ctx.value) : '';

    if (params?.maxLength !== undefined) input.maxLength = params.maxLength;
    if (params?.pattern) input.pattern = params.pattern;
    if (params?.placeholder) input.placeholder = params.placeholder;

    // Commit function preserves original type when possible
    const commit = () => {
      const inputVal = input.value;

      // Empty input handling
      if (inputVal === '') {
        if (column.nullable) {
          ctx.commit(null);
        } else {
          // Non-nullable: commit empty string so the field is never null
          ctx.commit('');
        }
        return;
      }

      // Preserve values with characters that <input> can't represent (newlines, etc.).
      // If stripping those characters produces the same string, the user didn't change anything.
      if (typeof ctx.value === 'string' && inputVal === ctx.value.replace(/[\n\r]/g, '')) {
        return;
      }
      // Preserve numeric type for custom column types (e.g., currency)
      if (typeof ctx.value === 'number') {
        ctx.commit(Number(inputVal));
      } else {
        ctx.commit(inputVal);
      }
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') ctx.cancel();
    });

    return input;
  };
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Returns a default editor factory function for the given column type.
 * Each editor handles commit on blur/Enter, and cancel on Escape.
 *
 * Note: Focus is NOT called here - the calling code handles focusing after DOM insertion.
 * @since 0.4.0
 */
export function defaultEditorFor(column: AnyColumn): (ctx: ColumnEditorContext) => HTMLElement | string {
  switch (column.type) {
    case 'number':
      return createNumberEditor(column);
    case 'boolean':
      return createBooleanEditor();
    case 'date':
      return createDateEditor(column);
    case 'select':
      return createSelectEditor(column);
    default:
      return createTextEditor(column);
  }
}

// ============================================================================
// Utility Export (used by EditingPlugin)
// ============================================================================

/**
 * Resolve a numeric editor value. Empty input falls back to `null` for nullable
 * columns, otherwise to the configured `min` (or `0`).
 */
function readNumericValue(raw: string, column?: AnyColumn): unknown {
  if (raw === '') {
    if (column?.nullable) return null;
    const params = column?.editorParams as NumberEditorParams | undefined;
    return params?.min ?? 0;
  }
  return Number(raw);
}

/**
 * Resolve a `<input type="date">` value, preserving the original value's type
 * (string dates stay `YYYY-MM-DD` strings, Date objects stay `Date`).
 */
function readDateValue(input: HTMLInputElement, column?: AnyColumn, originalValue?: unknown): unknown {
  if (!input.value) {
    if (column?.nullable) return null;
    // Non-nullable: preserve original or fall back to today
    if (typeof originalValue === 'string') return originalValue || new Date().toISOString().slice(0, 10);
    return (originalValue as Date) ?? new Date();
  }
  // Preserve original type: if original was a string, return string (YYYY-MM-DD format)
  if (typeof originalValue === 'string') {
    return input.value; // input.value is already in YYYY-MM-DD format
  }
  return input.valueAsDate;
}

/**
 * Resolve a plain text `<input>` value, preserving numeric originals and values
 * containing characters `<input>` cannot represent.
 */
function readTextInputValue(input: HTMLInputElement, column?: AnyColumn, originalValue?: unknown): unknown {
  // For text inputs, check if original value was a number to preserve type
  if (typeof originalValue === 'number') return readNumericValue(input.value, column);
  // Nullable text: empty → null; non-nullable: empty → ''
  if (input.value === '' && (originalValue === null || originalValue === undefined)) {
    return column?.nullable ? null : '';
  }
  // Preserve values with characters <input> can't represent (newlines, etc.)
  if (typeof originalValue === 'string' && input.value === originalValue.replace(/[\n\r]/g, '')) {
    return originalValue;
  }
  return input.value;
}

/**
 * Resolve a `<textarea>` / `<select>` value using the column type or the
 * original value's type.
 */
function readTextControlValue(
  input: HTMLTextAreaElement | HTMLSelectElement,
  column?: AnyColumn,
  originalValue?: unknown,
): unknown {
  // `input.value` on a multi-select is only the FIRST selected option — read the full set.
  if (input instanceof HTMLSelectElement && input.multiple) return readMultiSelectValue(input, column);
  // Nullable select's "(Blank)" option carries an internal sentinel — map it back to null
  // (before the numeric branch, which would turn it into NaN). Mirrors createSelectEditor's commit.
  if (input instanceof HTMLSelectElement && column?.nullable && input.value === NULLABLE_BLANK_VALUE) {
    return null;
  }
  // Check column type OR original value type — preserves numeric type for
  // custom column types (e.g., currency).
  if (input.value !== '' && (column?.type === 'number' || typeof originalValue === 'number')) {
    return Number(input.value);
  }
  // Nullable: empty → null; non-nullable: empty → ''
  if ((originalValue === null || originalValue === undefined) && input.value === '') {
    return column?.nullable ? null : '';
  }
  return input.value;
}

/**
 * Get the typed value from an input element based on its type, column config, and original value.
 * Preserves the type of the original value (e.g., numeric currency values stay as numbers,
 * string dates stay as strings, null/undefined for empty fields).
 */
export function getInputValue(
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  column?: AnyColumn,
  originalValue?: unknown,
): unknown {
  if (!(input instanceof HTMLInputElement)) return readTextControlValue(input, column, originalValue);
  switch (input.type) {
    case 'checkbox':
      return input.checked;
    case 'number':
      return readNumericValue(input.value, column);
    case 'date':
      return readDateValue(input, column, originalValue);
    default:
      return readTextInputValue(input, column, originalValue);
  }
}

/**
 * Write a value into a native editor — the inverse of {@link getInputValue}. Used to push
 * external row updates (`updateRow`, cascades, reverts) into an open editor, where a blind
 * `input.value = String(value)` would corrupt it: a multi-select matches no option for
 * `'a,c'` and drops its whole selection, a date input rejects `Date.toString()`, and a
 * nullable select has no `''` option for `null`. Pass the column so the nullable blank
 * sentinel is only honoured where {@link getInputValue} decodes it.
 */
export function setInputValue(
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: unknown,
  column?: AnyColumn,
): void {
  if (input instanceof HTMLSelectElement) {
    writeSelectValue(input, value, !!column?.nullable);
  } else if (input instanceof HTMLInputElement && input.type === 'checkbox') {
    input.checked = !!value;
  } else if (input instanceof HTMLInputElement && input.type === 'date' && value instanceof Date) {
    input.valueAsDate = value;
  } else if (input instanceof HTMLInputElement && input.type === 'date' && typeof value === 'string') {
    input.value = value.split('T')[0];
  } else {
    input.value = String(value ?? '');
  }
}

/**
 * Whether `o` is the nullable "(Blank)" option built by `createSelectEditor`. Like the readers,
 * only on nullable columns: elsewhere a `'__tbw_null__'` option is an ordinary value.
 */
function isBlankSentinel(o: HTMLOptionElement, nullable: boolean): boolean {
  return nullable && o.value === NULLABLE_BLANK_VALUE && !optionValues.has(o);
}

function writeSelectValue(select: HTMLSelectElement, value: unknown, nullable: boolean): void {
  if (select.multiple) {
    writeMultiSelectValue(select, value, nullable);
  } else if (value == null && Array.from(select.options).some((o) => isBlankSentinel(o, nullable))) {
    select.value = NULLABLE_BLANK_VALUE;
  } else {
    select.value = String(value ?? '');
  }
}

/**
 * Select the options of a `multiple` select that match `value` (an array, a lone value, or
 * `null` → the blank sentinel on nullable columns). Mirrors {@link readMultiSelectValue}: configured options
 * match their original value strictly, others fall back to string matching.
 */
function writeMultiSelectValue(select: HTMLSelectElement, value: unknown, nullable: boolean): void {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  for (const o of Array.from(select.options)) {
    if (optionValues.has(o)) {
      const configured = optionValues.get(o);
      o.selected = values.some((v) => v === configured);
    } else if (isBlankSentinel(o, nullable)) {
      o.selected = value == null;
    } else {
      o.selected = values.some((v) => String(v) === o.value);
    }
  }
}

/**
 * Whether a value re-read from an editor equals the cell's original value. Arrays
 * (multi-select) compare as sets, since the DOM reports selections in option order
 * and every read yields a new array instance.
 */
export function isSameEditorValue(originalValue: unknown, value: unknown): boolean {
  if (Array.isArray(originalValue) && Array.isArray(value)) {
    const original = new Set(originalValue);
    const next = new Set(value);
    return original.size === next.size && [...next].every((v) => original.has(v));
  }
  return originalValue === value;
}
