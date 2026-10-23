import { describe, expect, it, vi } from 'vitest';
import type { ColumnConfig, ColumnEditorContext } from '../../core/types';
import { defaultEditorFor, getInputValue, isSameEditorValue } from './editors';

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
