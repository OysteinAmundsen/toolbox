import { describe, expect, it, vi } from 'vitest';
import type { ColumnConfig, ColumnEditorContext } from '../../core/types';
import { defaultEditorFor, getInputValue, isSameEditorValue, setInputValue } from './editors';

/** Build the real select editor, so its options carry their configured values. */
function builtInSelect(col: ColumnConfig, value: unknown): HTMLSelectElement {
  const ctx = {
    row: {},
    value,
    field: 'tags',
    column: col,
    rowId: '',
    commit: vi.fn(),
    cancel: vi.fn(),
    updateRow: vi.fn(),
  } satisfies ColumnEditorContext;
  return defaultEditorFor(col)(ctx) as HTMLSelectElement;
}

// Read flags, not `selectedOptions` — happy-dom caches that collection across `option.selected` writes.
const selectedValues = (select: HTMLSelectElement) =>
  Array.from(select.options)
    .filter((o) => o.selected)
    .map((o) => o.value);

function multiSelect(values: string[], selected: string[]): HTMLSelectElement {
  const select = document.createElement('select');
  select.multiple = true;
  for (const v of values) {
    const o = document.createElement('option');
    o.value = v;
    o.selected = selected.includes(v);
    select.appendChild(o);
  }
  return select;
}

describe('getInputValue — multi-select (#551)', () => {
  const column: ColumnConfig = {
    field: 'tags',
    type: 'select',
    multi: true,
    options: [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
    ],
  };

  it('returns every selected option, not just the first', () => {
    expect(getInputValue(multiSelect(['a', 'b'], ['a', 'b']), column, ['a', 'b'])).toEqual(['a', 'b']);
  });

  it('returns an empty array when nothing is selected', () => {
    expect(getInputValue(multiSelect(['a', 'b'], []), column, ['a'])).toEqual([]);
  });

  it('maps option strings back to typed option values', () => {
    const numeric: ColumnConfig = {
      ...column,
      options: [
        { label: 'One', value: 1 },
        { label: 'Two', value: 2 },
      ],
    };
    expect(getInputValue(multiSelect(['1', '2'], ['2']), numeric, [1])).toEqual([2]);
  });

  it('maps a lone nullable blank sentinel to null and drops it alongside real values', () => {
    const nullable: ColumnConfig = { ...column, nullable: true };
    expect(getInputValue(multiSelect(['__tbw_null__', 'a', 'b'], ['__tbw_null__']), nullable, null)).toBeNull();
    expect(getInputValue(multiSelect(['__tbw_null__', 'a', 'b'], ['__tbw_null__', 'b']), nullable, null)).toEqual([
      'b',
    ]);
  });

  it('keeps a sentinel-valued option intact on a non-nullable column', () => {
    const sentinel: ColumnConfig = { ...column, options: [{ label: 'S', value: '__tbw_null__' }] };
    expect(getInputValue(multiSelect(['__tbw_null__'], ['__tbw_null__']), sentinel, [])).toEqual(['__tbw_null__']);
  });

  it('keeps a configured sentinel-valued option intact on a nullable column', () => {
    const sentinel: ColumnConfig = {
      ...column,
      nullable: true,
      options: [
        { label: 'S', value: '__tbw_null__' },
        { label: 'A', value: 'a' },
      ],
    };
    expect(getInputValue(builtInSelect(sentinel, ['__tbw_null__']), sentinel, [])).toEqual(['__tbw_null__']);
    expect(getInputValue(builtInSelect(sentinel, ['__tbw_null__', 'a']), sentinel, [])).toEqual(['__tbw_null__', 'a']);
  });

  it('preserves option identity when distinct values share a string form', () => {
    const mixed: ColumnConfig = {
      ...column,
      options: [
        { label: 'Number one', value: 1 },
        { label: 'String one', value: '1' },
      ],
    };
    expect(getInputValue(builtInSelect(mixed, ['1']), mixed, ['1'])).toEqual(['1']);
  });
});

describe('setInputValue (#555)', () => {
  const column: ColumnConfig = {
    field: 'tags',
    type: 'select',
    multi: true,
    options: [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
      { label: 'C', value: 'c' },
    ],
  };

  it('selects every array member on a multi-select instead of clearing it', () => {
    const select = builtInSelect(column, ['a']);
    setInputValue(select, ['a', 'c']);
    expect(selectedValues(select)).toEqual(['a', 'c']);
    expect(getInputValue(select, column, ['a'])).toEqual(['a', 'c']);
  });

  it('deselects everything for an empty array and selects a lone non-array value', () => {
    const select = builtInSelect(column, ['a', 'b']);
    setInputValue(select, []);
    expect(selectedValues(select)).toEqual([]);
    setInputValue(select, 'b');
    expect(selectedValues(select)).toEqual(['b']);
  });

  it('matches configured options by their original value, not their string form', () => {
    const mixed: ColumnConfig = {
      ...column,
      options: [
        { label: 'Number one', value: 1 },
        { label: 'String one', value: '1' },
      ],
    };
    const select = builtInSelect(mixed, []);
    setInputValue(select, [1]);
    expect(Array.from(select.options).map((o) => o.selected)).toEqual([true, false]);
    expect(getInputValue(select, mixed, [])).toEqual([1]);
  });

  it('falls back to string matching for options of a custom multi-select', () => {
    const select = multiSelect(['1', '2', '3'], []);
    setInputValue(select, [1, 3]);
    expect(selectedValues(select)).toEqual(['1', '3']);
  });

  it('selects only the blank sentinel for null on a nullable multi-select', () => {
    const nullable: ColumnConfig = { ...column, nullable: true };
    const select = builtInSelect(nullable, ['a']);
    setInputValue(select, null, nullable);
    expect(selectedValues(select)).toEqual(['__tbw_null__']);
    expect(getInputValue(select, nullable, ['a'])).toBeNull();
  });

  it('selects the blank sentinel for null on a nullable single select', () => {
    const single: ColumnConfig = { ...column, multi: false, nullable: true };
    const select = builtInSelect(single, 'a');
    setInputValue(select, null, single);
    expect(select.value).toBe('__tbw_null__');
    expect(getInputValue(select, single, 'a')).toBeNull();
    setInputValue(select, 'b', single);
    expect(select.value).toBe('b');
  });

  // A custom select on a non-nullable column may carry a real '__tbw_null__' option — the
  // writer must treat it as an ordinary value, exactly like the readers do.
  it('round-trips a real sentinel-valued option on a non-nullable custom multi-select', () => {
    const select = multiSelect(['__tbw_null__', 'a'], ['a']);
    setInputValue(select, ['__tbw_null__'], column);
    expect(selectedValues(select)).toEqual(['__tbw_null__']);
    expect(getInputValue(select, column, ['a'])).toEqual(['__tbw_null__']);
  });

  it('does not select a real sentinel-valued option for null on a non-nullable custom single select', () => {
    const single: ColumnConfig = { ...column, multi: false };
    const select = document.createElement('select');
    select.innerHTML = '<option value="__tbw_null__">Literal</option><option value="a" selected>A</option>';
    setInputValue(select, null, single);
    expect(select.value).not.toBe('__tbw_null__');
    expect(getInputValue(select, single, null)).toBe('');
  });

  it('writes Date objects and ISO strings into a date input', () => {
    const input = document.createElement('input');
    input.type = 'date';
    setInputValue(input, new Date(Date.UTC(2026, 9, 23)));
    expect(input.value).toBe('2026-10-23');
    setInputValue(input, '2026-01-02T10:00:00Z');
    expect(input.value).toBe('2026-01-02');
  });

  it('toggles checkboxes and stringifies plain inputs', () => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    setInputValue(checkbox, 1);
    expect(checkbox.checked).toBe(true);

    const text = document.createElement('input');
    setInputValue(text, 42);
    expect(text.value).toBe('42');
    setInputValue(text, null);
    expect(text.value).toBe('');
  });
});

describe('isSameEditorValue', () => {
  it('compares arrays as sets', () => {
    expect(isSameEditorValue(['b', 'a'], ['a', 'b'])).toBe(true);
    expect(isSameEditorValue(['a', 'b'], ['a'])).toBe(false);
    expect(isSameEditorValue(['a', 'b'], ['a', 'c'])).toBe(false);
    expect(isSameEditorValue([1], ['1'])).toBe(false);
  });

  it('ignores duplicate members when comparing sets', () => {
    expect(isSameEditorValue(['a', 'b'], ['a', 'a'])).toBe(false);
    expect(isSameEditorValue(['a', 'a', 'b'], ['a', 'b'])).toBe(true);
  });

  it('uses strict equality for non-arrays', () => {
    expect(isSameEditorValue('a', 'a')).toBe(true);
    expect(isSameEditorValue(null, null)).toBe(true);
    expect(isSameEditorValue(['a'], 'a')).toBe(false);
    expect(isSameEditorValue(1, '1')).toBe(false);
  });
});
