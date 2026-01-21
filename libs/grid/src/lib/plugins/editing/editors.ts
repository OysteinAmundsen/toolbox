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

import type { ColumnConfig, EditorContext } from '../../core/types';
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

// ============================================================================
// Editor Factories
// ============================================================================

/** Creates a number input editor */
function createNumberEditor(column: AnyColumn): (ctx: EditorContext) => HTMLElement {
  return (ctx) => {
    const params = column.editorParams as NumberEditorParams | undefined;
    const input = document.createElement('input');
    input.type = 'number';
    input.value = ctx.value != null ? String(ctx.value) : '';

    if (params?.min !== undefined) input.min = String(params.min);
    if (params?.max !== undefined) input.max = String(params.max);
    if (params?.step !== undefined) input.step = String(params.step);
    if (params?.placeholder) input.placeholder = params.placeholder;

    const commit = () => ctx.commit(input.value === '' ? null : Number(input.value));
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') ctx.cancel();
    });

    return input;
  };
}

/** Creates a checkbox editor for boolean values */
function createBooleanEditor(): (ctx: EditorContext) => HTMLElement {
  return (ctx) => {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!ctx.value;
    input.addEventListener('change', () => ctx.commit(input.checked));
    return input;
  };
}

/** Creates a date input editor */
function createDateEditor(column: AnyColumn): (ctx: EditorContext) => HTMLElement {
  return (ctx) => {
    const params = column.editorParams as DateEditorParams | undefined;
    const input = document.createElement('input');
    input.type = 'date';

    if (ctx.value instanceof Date) input.valueAsDate = ctx.value;
    if (params?.min) input.min = params.min;
    if (params?.max) input.max = params.max;
    if (params?.placeholder) input.placeholder = params.placeholder;

    input.addEventListener('change', () => ctx.commit(input.valueAsDate));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') ctx.cancel();
    });

    return input;
  };
}

/** Creates a select dropdown editor */
function createSelectEditor(column: AnyColumn): (ctx: EditorContext) => HTMLElement {
  return (ctx) => {
    const params = column.editorParams as SelectEditorParams | undefined;
    const select = document.createElement('select');
    if (column.multi) select.multiple = true;

    // Add empty option if requested
    if (params?.includeEmpty) {
      const emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.textContent = params.emptyLabel ?? '';
      select.appendChild(emptyOpt);
    }

    // Populate options from column.options
    const options = resolveOptions(column);
    options.forEach((opt) => {
      const o = document.createElement('option');
      o.value = String(opt.value);
      o.textContent = opt.label;
      if (column.multi && Array.isArray(ctx.value) && ctx.value.includes(opt.value)) {
        o.selected = true;
      } else if (!column.multi && ctx.value === opt.value) {
        o.selected = true;
      }
      select.appendChild(o);
    });

    const commit = () => {
      if (column.multi) {
        const values = Array.from(select.selectedOptions).map((o) => o.value);
        ctx.commit(values);
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
function createTextEditor(column: AnyColumn): (ctx: EditorContext) => HTMLElement {
  return (ctx) => {
    const params = column.editorParams as TextEditorParams | undefined;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = ctx.value != null ? String(ctx.value) : '';

    if (params?.maxLength !== undefined) input.maxLength = params.maxLength;
    if (params?.pattern) input.pattern = params.pattern;
    if (params?.placeholder) input.placeholder = params.placeholder;

    input.addEventListener('blur', () => ctx.commit(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') ctx.commit(input.value);
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
 */
export function defaultEditorFor(column: AnyColumn): (ctx: EditorContext) => HTMLElement | string {
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
 * Gets the current value from an input element, with type coercion based on column type.
 */
export function getInputValue(
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  col: AnyColumn,
): unknown {
  if (input instanceof HTMLSelectElement) {
    if (col.multi) {
      return Array.from(input.selectedOptions).map((o) => o.value);
    }
    return input.value;
  }
  if (input instanceof HTMLInputElement) {
    if (input.type === 'checkbox') return input.checked;
    if (input.type === 'number') return input.value === '' ? null : Number(input.value);
    if (input.type === 'date') return input.valueAsDate;
  }
  return input.value;
}
