/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest';
import { applyColumnDefaults, hasColumnShorthands, normalizeColumns, parseColumnShorthand } from './column-shorthand';

describe('parseColumnShorthand', () => {
  it('parses a plain field name', () => {
    expect(parseColumnShorthand('name')).toEqual({ field: 'name', header: 'Name' });
  });

  it('special-cases id → ID', () => {
    expect(parseColumnShorthand('id')).toEqual({ field: 'id', header: 'ID' });
  });

  it('splits camelCase into spaced Title Case', () => {
    expect(parseColumnShorthand('firstName')).toEqual({ field: 'firstName', header: 'First Name' });
  });

  it('splits snake_case', () => {
    expect(parseColumnShorthand('last_name')).toEqual({ field: 'last_name', header: 'Last Name' });
  });

  it('splits kebab-case', () => {
    expect(parseColumnShorthand('email-address')).toEqual({
      field: 'email-address',
      header: 'Email Address',
    });
  });

  it('parses field:type shorthand', () => {
    expect(parseColumnShorthand('salary:number')).toEqual({
      field: 'salary',
      header: 'Salary',
      type: 'number',
    });
  });

  it('accepts all valid types', () => {
    for (const type of ['string', 'number', 'boolean', 'date', 'datetime', 'currency']) {
      const result = parseColumnShorthand(`foo:${type}`);
      expect(result.type).toBe(type);
    }
  });

  it('rejects unknown types — treats the whole string as a field', () => {
    expect(parseColumnShorthand('weird:xyz')).toEqual({ field: 'weird:xyz', header: 'Weird:xyz' });
  });
});

describe('normalizeColumns', () => {
  it('passes ColumnConfig objects through', () => {
    const col = { field: 'email', header: 'Email', width: 200 };
    expect(normalizeColumns([col])).toEqual([col]);
  });

  it('normalizes shorthand strings', () => {
    expect(normalizeColumns(['id:number', 'name'])).toEqual([
      { field: 'id', header: 'ID', type: 'number' },
      { field: 'name', header: 'Name' },
    ]);
  });

  it('handles mixed arrays', () => {
    const result = normalizeColumns(['id:number', { field: 'status', editable: true }]);
    expect(result).toEqual([
      { field: 'id', header: 'ID', type: 'number' },
      { field: 'status', editable: true },
    ]);
  });
});

describe('applyColumnDefaults', () => {
  it('returns input unchanged when no defaults provided', () => {
    const cols = [{ field: 'a' }];
    expect(applyColumnDefaults(cols, undefined)).toBe(cols);
  });

  it('merges defaults into every column', () => {
    const cols = [{ field: 'a' }, { field: 'b' }];
    expect(applyColumnDefaults(cols, { sortable: true })).toEqual([
      { field: 'a', sortable: true },
      { field: 'b', sortable: true },
    ]);
  });

  it('column props override defaults', () => {
    const cols = [{ field: 'a', sortable: false }];
    expect(applyColumnDefaults(cols, { sortable: true })).toEqual([{ field: 'a', sortable: false }]);
  });
});

describe('hasColumnShorthands', () => {
  it('returns true when any element is a string', () => {
    expect(hasColumnShorthands(['a', { field: 'b' }])).toBe(true);
  });
  it('returns false for all-object arrays', () => {
    expect(hasColumnShorthands([{ field: 'a' }])).toBe(false);
  });
  it('returns false for empty arrays', () => {
    expect(hasColumnShorthands([])).toBe(false);
  });
});
