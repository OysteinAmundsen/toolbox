import { describe, expect, it } from 'vitest';
import { computeRowDiff } from './row-diff';

interface Row {
  id: number;
  name: string;
}

const getId = (row: Row) => String(row.id);

describe('computeRowDiff', () => {
  it('returns null when prev is empty (initial load)', () => {
    expect(computeRowDiff([{ id: 1, name: 'Alice' }], [], getId)).toBeNull();
  });

  it('returns null when next has more rows than prev (row added)', () => {
    const prev = [{ id: 1, name: 'Alice' }];
    const next = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];
    expect(computeRowDiff(next, prev, getId)).toBeNull();
  });

  it('returns null when next has fewer rows than prev (row removed)', () => {
    const prev = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];
    const next = [{ id: 1, name: 'Alice' }];
    expect(computeRowDiff(next, prev, getId)).toBeNull();
  });

  it('returns null when a row ID changes (structural change / reorder)', () => {
    const prev = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];
    const next = [
      { id: 1, name: 'Alice' },
      { id: 3, name: 'Charlie' },
    ];
    expect(computeRowDiff(next, prev, getId)).toBeNull();
  });

  it('returns null when first row ID changes', () => {
    const prev = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];
    const next = [
      { id: 9, name: 'Zara' },
      { id: 2, name: 'Bob' },
    ];
    expect(computeRowDiff(next, prev, getId)).toBeNull();
  });

  it('returns empty array when all rows are identical references (no-op)', () => {
    const row1 = { id: 1, name: 'Alice' };
    const row2 = { id: 2, name: 'Bob' };
    expect(computeRowDiff([row1, row2], [row1, row2], getId)).toEqual([]);
  });

  it('returns an update entry for a single changed row', () => {
    const alice = { id: 1, name: 'Alice' };
    const prev = [alice, { id: 2, name: 'Bob' }];
    const next = [alice, { id: 2, name: 'Robert' }];
    expect(computeRowDiff(next, prev, getId)).toEqual([{ id: '2', changes: { id: 2, name: 'Robert' } }]);
  });

  it('returns update entries for all changed rows', () => {
    const prev = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];
    const next = [
      { id: 1, name: 'Alicia' },
      { id: 2, name: 'Robert' },
    ];
    expect(computeRowDiff(next, prev, getId)).toEqual([
      { id: '1', changes: { id: 1, name: 'Alicia' } },
      { id: '2', changes: { id: 2, name: 'Robert' } },
    ]);
  });

  it('returns empty array for a single-row list with unchanged value', () => {
    const row = { id: 42, name: 'Sam' };
    expect(computeRowDiff([row], [row], getId)).toEqual([]);
  });

  it('returns update for a single-row list with changed value', () => {
    const prev = [{ id: 42, name: 'Sam' }];
    const next = [{ id: 42, name: 'Samuel' }];
    expect(computeRowDiff(next, prev, getId)).toEqual([{ id: '42', changes: { id: 42, name: 'Samuel' } }]);
  });

  it('returns null for a pure reorder (same IDs, same objects, swapped order)', () => {
    const alice = { id: 1, name: 'Alice' };
    const bob = { id: 2, name: 'Bob' };
    // updateRows() patches values by id and never reorders, so a pure reorder
    // must fall back to a full replace (null) even though the ID *set* matches.
    expect(computeRowDiff([bob, alice], [alice, bob], getId)).toBeNull();
  });
});
