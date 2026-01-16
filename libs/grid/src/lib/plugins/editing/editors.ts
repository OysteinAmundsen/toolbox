/**
 * Default Editors Module
 *
 * Provides built-in editor factories for different column types.
 *
 * IMPORTANT: Editor factories should NOT call focus() on elements - they are called
 * before the element is appended to the DOM. The calling code (beginBulkEdit,
 * inlineEnterEdit) is responsible for focusing the correct editor after insertion.
 */

import type { ColumnConfig, EditorContext } from '../../core/types';

/**
 * Returns a default editor factory function for the given column type.
 * Each editor handles commit on blur/Enter, and cancel on Escape.
 * Note: Focus is NOT called here - the calling code handles focusing after DOM insertion.
 */
export function defaultEditorFor(column: ColumnConfig<any>): (ctx: EditorContext) => HTMLElement | string {
  switch (column.type) {
    case 'number':
      return (ctx: EditorContext) => {
        const input = document.createElement('input');
        input.type = 'number';
        input.value = ctx.value != null ? String(ctx.value) : '';
        input.addEventListener('blur', () => ctx.commit(input.value === '' ? null : Number(input.value)));
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') ctx.commit(input.value === '' ? null : Number(input.value));
          if (e.key === 'Escape') ctx.cancel();
        });
        return input;
      };
    case 'boolean':
      return (ctx: EditorContext) => {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!ctx.value;
        input.addEventListener('change', () => ctx.commit(input.checked));
        return input;
      };
    case 'date':
      return (ctx: EditorContext) => {
        const input = document.createElement('input');
        input.type = 'date';
        if (ctx.value instanceof Date) input.valueAsDate = ctx.value;
        input.addEventListener('change', () => ctx.commit(input.valueAsDate));
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') ctx.cancel();
        });
        return input;
      };
    case 'select':
    case 'typeahead':
      return (ctx: EditorContext) => {
        const select = document.createElement('select');
        const col = ctx.column;
        if (col.multi) select.multiple = true;
        const rawOptions = col.options;
        const options = typeof rawOptions === 'function' ? rawOptions() : rawOptions || [];
        options.forEach((opt) => {
          const o = document.createElement('option');
          o.value = String(opt.value);
          o.textContent = opt.label;
          if (col.multi && Array.isArray(ctx.value) && ctx.value.includes(opt.value)) o.selected = true;
          else if (!col.multi && ctx.value === opt.value) o.selected = true;
          select.appendChild(o);
        });
        const commitValue = () => {
          if (col.multi) {
            const values: unknown[] = [];
            Array.from(select.selectedOptions).forEach((o) => {
              values.push(o.value);
            });
            ctx.commit(values);
          } else {
            ctx.commit(select.value);
          }
        };
        select.addEventListener('change', commitValue);
        select.addEventListener('blur', commitValue);
        select.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') ctx.cancel();
        });
        return select;
      };
    default:
      return (ctx: EditorContext) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = ctx.value != null ? String(ctx.value) : '';
        input.addEventListener('blur', () => ctx.commit(input.value));
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') ctx.commit(input.value);
          if (e.key === 'Escape') ctx.cancel();
        });
        return input;
      };
  }
}
