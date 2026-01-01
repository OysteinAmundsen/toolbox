/**
 * Default Editors Module
 *
 * Provides built-in editor factories for different column types.
 */

import type { ColumnConfig, EditorContext } from '../types';

/**
 * Returns a default editor factory function for the given column type.
 * Each editor handles focus, commit on blur/Enter, and cancel on Escape.
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
        input.focus();
        return input;
      };
    case 'boolean':
      return (ctx: EditorContext) => {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!ctx.value;
        input.addEventListener('change', () => ctx.commit(input.checked));
        input.focus();
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
        input.focus();
        return input;
      };
    case 'select':
    case 'typeahead':
      return (ctx: EditorContext) => {
        const select = document.createElement('select');
        if ((ctx.column as any).multi) select.multiple = true;
        const options =
          typeof (ctx.column as any).options === 'function'
            ? (ctx.column as any).options()
            : (ctx.column as any).options || [];
        options.forEach((opt: any) => {
          const o = document.createElement('option');
          o.value = String(opt.value);
          o.textContent = opt.label;
          if ((ctx.column as any).multi && Array.isArray(ctx.value) && ctx.value.includes(opt.value)) o.selected = true;
          else if (!(ctx.column as any).multi && ctx.value === opt.value) o.selected = true;
          select.appendChild(o);
        });
        const commitValue = () => {
          if ((ctx.column as any).multi) {
            const values: any[] = [];
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
        select.focus();
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
        input.focus();
        return input;
      };
  }
}
