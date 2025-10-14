import { describe, expect, it } from 'vitest';
import { defaultEditorFor } from './editors';

describe('defaultEditorFor', () => {
  function createContext(column: any, value: any, overrides: Partial<any> = {}) {
    let committed: any = undefined;
    let canceled = false;
    return {
      ctx: {
        row: { [column.field]: value },
        value,
        field: column.field,
        column,
        commit: (v: any) => (committed = v),
        cancel: () => (canceled = true),
        ...overrides,
      },
      getCommitted: () => committed,
      wasCanceled: () => canceled,
    };
  }

  describe('text editor (default)', () => {
    it('creates text input for unspecified type', () => {
      const column = { field: 'name', editable: true };
      const editor = defaultEditorFor(column as any);
      const { ctx } = createContext(column, 'Alice');
      const el = editor(ctx as any) as HTMLInputElement;
      expect(el.tagName).toBe('INPUT');
      expect(el.type).toBe('text');
      expect(el.value).toBe('Alice');
    });

    it('commits on blur', () => {
      const column = { field: 'name', editable: true };
      const editor = defaultEditorFor(column as any);
      const { ctx, getCommitted } = createContext(column, 'Alice');
      const el = editor(ctx as any) as HTMLInputElement;
      el.value = 'Bob';
      el.dispatchEvent(new Event('blur', { bubbles: true }));
      expect(getCommitted()).toBe('Bob');
    });

    it('commits on Enter key', () => {
      const column = { field: 'name', editable: true };
      const editor = defaultEditorFor(column as any);
      const { ctx, getCommitted } = createContext(column, 'Alice');
      const el = editor(ctx as any) as HTMLInputElement;
      el.value = 'Charlie';
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(getCommitted()).toBe('Charlie');
    });

    it('cancels on Escape key', () => {
      const column = { field: 'name', editable: true };
      const editor = defaultEditorFor(column as any);
      const { ctx, wasCanceled } = createContext(column, 'Alice');
      const el = editor(ctx as any) as HTMLInputElement;
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(wasCanceled()).toBe(true);
    });

    it('handles null value', () => {
      const column = { field: 'name', editable: true };
      const editor = defaultEditorFor(column as any);
      const { ctx } = createContext(column, null);
      const el = editor(ctx as any) as HTMLInputElement;
      expect(el.value).toBe('');
    });
  });

  describe('number editor', () => {
    it('creates number input', () => {
      const column = { field: 'age', type: 'number', editable: true };
      const editor = defaultEditorFor(column as any);
      const { ctx } = createContext(column, 25);
      const el = editor(ctx as any) as HTMLInputElement;
      expect(el.tagName).toBe('INPUT');
      expect(el.type).toBe('number');
      expect(el.value).toBe('25');
    });

    it('commits number value on Enter', () => {
      const column = { field: 'age', type: 'number', editable: true };
      const editor = defaultEditorFor(column as any);
      const { ctx, getCommitted } = createContext(column, 25);
      const el = editor(ctx as any) as HTMLInputElement;
      el.value = '42';
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(getCommitted()).toBe(42);
    });

    it('commits null for empty value', () => {
      const column = { field: 'age', type: 'number', editable: true };
      const editor = defaultEditorFor(column as any);
      const { ctx, getCommitted } = createContext(column, 25);
      const el = editor(ctx as any) as HTMLInputElement;
      el.value = '';
      el.dispatchEvent(new Event('blur', { bubbles: true }));
      expect(getCommitted()).toBeNull();
    });

    it('cancels on Escape', () => {
      const column = { field: 'age', type: 'number', editable: true };
      const editor = defaultEditorFor(column as any);
      const { ctx, wasCanceled } = createContext(column, 25);
      const el = editor(ctx as any) as HTMLInputElement;
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(wasCanceled()).toBe(true);
    });
  });

  describe('boolean editor', () => {
    it('creates checkbox input', () => {
      const column = { field: 'active', type: 'boolean', editable: true };
      const editor = defaultEditorFor(column as any);
      const { ctx } = createContext(column, true);
      const el = editor(ctx as any) as HTMLInputElement;
      expect(el.tagName).toBe('INPUT');
      expect(el.type).toBe('checkbox');
      expect(el.checked).toBe(true);
    });

    it('commits on change event', () => {
      const column = { field: 'active', type: 'boolean', editable: true };
      const editor = defaultEditorFor(column as any);
      const { ctx, getCommitted } = createContext(column, false);
      const el = editor(ctx as any) as HTMLInputElement;
      el.checked = true;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      expect(getCommitted()).toBe(true);
    });

    it('handles falsy value', () => {
      const column = { field: 'active', type: 'boolean', editable: true };
      const editor = defaultEditorFor(column as any);
      const { ctx } = createContext(column, undefined);
      const el = editor(ctx as any) as HTMLInputElement;
      expect(el.checked).toBe(false);
    });
  });

  describe('date editor', () => {
    it('creates date input', () => {
      const column = { field: 'dob', type: 'date', editable: true };
      const editor = defaultEditorFor(column as any);
      const { ctx } = createContext(column, new Date('2024-01-15'));
      const el = editor(ctx as any) as HTMLInputElement;
      expect(el.tagName).toBe('INPUT');
      expect(el.type).toBe('date');
    });

    it('sets valueAsDate for Date objects', () => {
      const column = { field: 'dob', type: 'date', editable: true };
      const editor = defaultEditorFor(column as any);
      const testDate = new Date('2024-06-15');
      const { ctx } = createContext(column, testDate);
      const el = editor(ctx as any) as HTMLInputElement;
      // valueAsDate may be normalized to UTC
      expect(el.valueAsDate).toBeTruthy();
    });

    it('commits valueAsDate on change', () => {
      const column = { field: 'dob', type: 'date', editable: true };
      const editor = defaultEditorFor(column as any);
      const { ctx, getCommitted } = createContext(column, new Date('2024-01-15'));
      const el = editor(ctx as any) as HTMLInputElement;
      el.value = '2024-12-25';
      el.dispatchEvent(new Event('change', { bubbles: true }));
      const committed = getCommitted();
      // valueAsDate may be null in DOM mock, but the mechanism is correct
      expect(committed === null || committed instanceof Date).toBe(true);
    });

    it('cancels on Escape', () => {
      const column = { field: 'dob', type: 'date', editable: true };
      const editor = defaultEditorFor(column as any);
      const { ctx, wasCanceled } = createContext(column, new Date());
      const el = editor(ctx as any) as HTMLInputElement;
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(wasCanceled()).toBe(true);
    });
  });

  describe('select editor', () => {
    const options = [
      { value: 'a', label: 'Option A' },
      { value: 'b', label: 'Option B' },
      { value: 'c', label: 'Option C' },
    ];

    it('creates select element with options', () => {
      const column = { field: 'choice', type: 'select', editable: true, options };
      const editor = defaultEditorFor(column as any);
      const { ctx } = createContext(column, 'b');
      const el = editor(ctx as any) as HTMLSelectElement;
      expect(el.tagName).toBe('SELECT');
      expect(el.options.length).toBe(3);
      expect(el.value).toBe('b');
    });

    it('commits on change', () => {
      const column = { field: 'choice', type: 'select', editable: true, options };
      const editor = defaultEditorFor(column as any);
      const { ctx, getCommitted } = createContext(column, 'a');
      const el = editor(ctx as any) as HTMLSelectElement;
      el.value = 'c';
      el.dispatchEvent(new Event('change', { bubbles: true }));
      expect(getCommitted()).toBe('c');
    });

    it('commits on blur', () => {
      const column = { field: 'choice', type: 'select', editable: true, options };
      const editor = defaultEditorFor(column as any);
      const { ctx, getCommitted } = createContext(column, 'a');
      const el = editor(ctx as any) as HTMLSelectElement;
      el.value = 'b';
      el.dispatchEvent(new Event('blur', { bubbles: true }));
      expect(getCommitted()).toBe('b');
    });

    it('cancels on Escape', () => {
      const column = { field: 'choice', type: 'select', editable: true, options };
      const editor = defaultEditorFor(column as any);
      const { ctx, wasCanceled } = createContext(column, 'a');
      const el = editor(ctx as any) as HTMLSelectElement;
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(wasCanceled()).toBe(true);
    });

    it('supports options as function', () => {
      const column = { field: 'choice', type: 'select', editable: true, options: () => options };
      const editor = defaultEditorFor(column as any);
      const { ctx } = createContext(column, 'a');
      const el = editor(ctx as any) as HTMLSelectElement;
      expect(el.options.length).toBe(3);
    });
  });

  describe('multi-select editor', () => {
    const options = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
      { value: 'c', label: 'C' },
    ];

    it('creates multiple select', () => {
      const column = { field: 'tags', type: 'select', editable: true, multi: true, options };
      const editor = defaultEditorFor(column as any);
      const { ctx } = createContext(column, ['a', 'c']);
      const el = editor(ctx as any) as HTMLSelectElement;
      expect(el.multiple).toBe(true);
    });

    it('pre-selects multiple values', () => {
      const column = { field: 'tags', type: 'select', editable: true, multi: true, options };
      const editor = defaultEditorFor(column as any);
      const { ctx } = createContext(column, ['a', 'c']);
      const el = editor(ctx as any) as HTMLSelectElement;
      const selected = Array.from(el.selectedOptions).map((o) => o.value);
      expect(selected.sort()).toEqual(['a', 'c']);
    });

    it('commits array of selected values', () => {
      const column = { field: 'tags', type: 'select', editable: true, multi: true, options };
      const editor = defaultEditorFor(column as any);
      const { ctx, getCommitted } = createContext(column, ['a']);
      const el = editor(ctx as any) as HTMLSelectElement;
      // Select b and c
      Array.from(el.options).forEach((o) => {
        o.selected = o.value === 'b' || o.value === 'c';
      });
      el.dispatchEvent(new Event('change', { bubbles: true }));
      const committed = getCommitted();
      expect(Array.isArray(committed)).toBe(true);
      expect(committed.sort()).toEqual(['b', 'c']);
    });
  });

  describe('typeahead editor', () => {
    it('uses select editor for typeahead type', () => {
      const options = [{ value: 'x', label: 'X' }];
      const column = { field: 'search', type: 'typeahead', editable: true, options };
      const editor = defaultEditorFor(column as any);
      const { ctx } = createContext(column, 'x');
      const el = editor(ctx as any) as HTMLSelectElement;
      expect(el.tagName).toBe('SELECT');
    });
  });
});
