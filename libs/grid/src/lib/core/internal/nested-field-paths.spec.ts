/**
 * Tests for nested dotted-path field access (issue #438):
 * the path helpers, nested reads via resolveCellValue, the back-compat
 * precedence rules, prototype-pollution guards, and the type surface.
 */

import { describe, expect, expectTypeOf, it } from 'vitest';
import { filterRows, getUniqueValues } from '../../plugins/filtering/filter-model';
import type { ColumnConfig, ColumnFieldKey, GridConfig, NestedPaths } from '../types';
import { aggregatorRegistry } from './aggregators';
import { builtInSort } from './sorting';
import {
  getByPath,
  parseFieldPath,
  readCellField,
  resolveCellValue,
  setByPath,
  writeCellField,
} from './value-accessor';

interface Deal {
  deal: {
    capture: { field: string; comments: string[] };
    otherStuff: { other: string };
  };
  flat: number;
}

function makeDeal(): Deal {
  return {
    deal: {
      capture: { field: 'Test', comments: ['a', 'b'] },
      otherStuff: { other: 'x' },
    },
    flat: 42,
  };
}

describe('parseFieldPath', () => {
  it('returns null for a plain (non-dotted) key', () => {
    expect(parseFieldPath('flat')).toBeNull();
  });

  it('splits a dotted path into segments', () => {
    expect(parseFieldPath('deal.capture.field')).toEqual(['deal', 'capture', 'field']);
  });

  it('memoizes the same segment array across calls', () => {
    const a = parseFieldPath('deal.capture.comments');
    const b = parseFieldPath('deal.capture.comments');
    expect(a).toBe(b);
  });
});

describe('getByPath', () => {
  it('reads a nested value', () => {
    expect(getByPath(makeDeal(), ['deal', 'capture', 'field'])).toBe('Test');
  });

  it('returns undefined on a nullish hop', () => {
    expect(getByPath({ deal: null }, ['deal', 'capture', 'field'])).toBeUndefined();
  });

  it('refuses to traverse prototype-polluting segments', () => {
    expect(getByPath({}, ['__proto__', 'polluted'])).toBeUndefined();
  });
});

describe('setByPath', () => {
  it('writes a nested value into an existing structure', () => {
    const row = makeDeal();
    expect(setByPath(row, ['deal', 'capture', 'field'], 'Updated')).toBe(true);
    expect(row.deal.capture.field).toBe('Updated');
  });

  it('does not fabricate missing intermediates', () => {
    const row: { deal?: { capture?: { field?: string } } } = {};
    expect(setByPath(row, ['deal', 'capture', 'field'], 'X')).toBe(false);
    expect(row.deal).toBeUndefined();
  });

  it('refuses prototype-polluting segments', () => {
    const row = {};
    expect(setByPath(row, ['__proto__', 'polluted'], 'X')).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('readCellField / resolveCellValue nested reads', () => {
  it('resolves a nested path with no valueAccessor', () => {
    const row = makeDeal();
    const c = { field: 'deal.capture.field' } as ColumnConfig<Deal>;
    expect(resolveCellValue(row, c)).toBe('Test');
    expect(readCellField(row, 'deal.otherStuff.other')).toBe('x');
  });

  it('still reads a plain top-level field unchanged', () => {
    expect(readCellField(makeDeal(), 'flat')).toBe(42);
  });

  it('a literal own key containing a dot wins over traversal (back-compat)', () => {
    const row = { 'deal.capture.field': 'literal', deal: { capture: { field: 'nested' } } };
    expect(readCellField(row, 'deal.capture.field')).toBe('literal');
  });

  it('valueAccessor still takes precedence over nested reads', () => {
    const row = makeDeal();
    const c = {
      field: 'deal.capture.field',
      valueAccessor: () => 'from-accessor',
    } as ColumnConfig<Deal>;
    expect(resolveCellValue(row, c)).toBe('from-accessor');
  });

  it('rejects unsafe plain keys on read (prototype-pollution guard)', () => {
    // Symmetric with writeCellField: `__proto__`/`constructor`/`prototype`
    // must never leak the prototype chain via a plain (non-dotted) read.
    expect(readCellField(makeDeal(), '__proto__')).toBeUndefined();
    expect(readCellField(makeDeal(), 'constructor')).toBeUndefined();
    expect(readCellField(makeDeal(), 'prototype')).toBeUndefined();
  });
});

describe('writeCellField', () => {
  it('writes a nested value', () => {
    const row = makeDeal();
    expect(writeCellField(row, 'deal.otherStuff.other', 'y')).toBe(true);
    expect(row.deal.otherStuff.other).toBe('y');
  });

  it('writes a plain field', () => {
    const row = makeDeal();
    expect(writeCellField(row, 'flat', 7)).toBe(true);
    expect(row.flat).toBe(7);
  });

  it('refuses an unsafe plain key', () => {
    expect(writeCellField({}, '__proto__', 'X')).toBe(false);
  });
});

describe('type surface (issue #438)', () => {
  it('ColumnFieldKey accepts both top-level keys and dotted paths', () => {
    const columns: ColumnConfig<Deal>[] = [
      { field: 'flat' },
      { field: 'deal.capture.field' },
      { field: 'deal.capture.comments' },
      { field: 'deal.otherStuff.other' },
    ];
    expect(columns).toHaveLength(4);
    expectTypeOf<ColumnFieldKey<Deal>>().toMatchTypeOf<string>();
  });

  it('NestedPaths enumerates the valid nested paths for strict opt-in', () => {
    type P = NestedPaths<Deal>;
    expectTypeOf<'flat'>().toMatchTypeOf<P>();
    expectTypeOf<'deal.capture.field'>().toMatchTypeOf<P>();
    expectTypeOf<'deal.otherStuff.other'>().toMatchTypeOf<P>();
    // Strict grid config compiles with the opt-in field type.
    const config: GridConfig<Deal, NestedPaths<Deal>> = {
      columns: [{ field: 'deal.capture.field' }, { field: 'flat' }],
    };
    expect(config.columns).toHaveLength(2);
  });
});

/**
 * Regression coverage for the consumers that used to read `row[field]` directly
 * and therefore silently ignored dotted paths (issue #430).
 */
describe('nested dotted paths in sort, filter and aggregate', () => {
  interface AddressRow extends Record<string, unknown> {
    id: number;
    address: { city: string; zip: number };
  }

  const rows: AddressRow[] = [
    { id: 1, address: { city: 'Oslo', zip: 3 } },
    { id: 2, address: { city: 'Bergen', zip: 1 } },
    { id: 3, address: { city: 'Trondheim', zip: 2 } },
  ];

  const columns = [{ field: 'address.city' }, { field: 'address.zip' }] as unknown as ColumnConfig[];

  it('sorts ascending by a nested path', () => {
    const sorted = builtInSort(rows, { field: 'address.city', direction: 1 }, columns);
    expect(sorted.map((r) => r.address.city)).toEqual(['Bergen', 'Oslo', 'Trondheim']);
  });

  it('sorts descending by a nested path', () => {
    const sorted = builtInSort(rows, { field: 'address.zip', direction: -1 }, columns);
    expect(sorted.map((r) => r.address.zip)).toEqual([3, 2, 1]);
  });

  it('leaves the source array untouched when sorting by a nested path', () => {
    builtInSort(rows, { field: 'address.city', direction: 1 }, columns);
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it('sorting by a nested path is stable for equal keys', () => {
    const tied = [
      { id: 1, address: { city: 'Oslo', zip: 1 } },
      { id: 2, address: { city: 'Oslo', zip: 1 } },
      { id: 3, address: { city: 'Bergen', zip: 1 } },
    ];
    const sorted = builtInSort(tied, { field: 'address.city', direction: 1 }, columns);
    expect(sorted.map((r) => r.id)).toEqual([3, 1, 2]);
  });

  it('filters by a nested path', () => {
    const out = filterRows(rows, [{ field: 'address.city', operator: 'contains', value: 'os' } as never]);
    expect(out.map((r) => (r as AddressRow).id)).toEqual([1]);
  });

  it('filters numerically by a nested path', () => {
    const out = filterRows(rows, [
      { field: 'address.zip', operator: 'greaterThan', value: 1, type: 'number' } as never,
    ]);
    expect(out).toHaveLength(2);
  });

  it('collects unique values from a nested path', () => {
    expect(getUniqueValues(rows, 'address.city')).toEqual(expect.arrayContaining(['Oslo', 'Bergen', 'Trondheim']));
  });

  it('aggregates a nested path', () => {
    expect(aggregatorRegistry.run('sum', rows, 'address.zip')).toBe(6);
    expect(aggregatorRegistry.run('max', rows, 'address.zip')).toBe(3);
  });
});
