import { describe, expect, it } from 'vitest';
import { shiftedIndex, sourceWith, trackRows } from './row-order';

describe('shiftedIndex', () => {
  it('maps every slot through one splice, either direction', () => {
    expect([0, 1, 2, 3].map((i) => shiftedIndex(i, 2, 0))).toEqual([1, 2, 0, 3]);
    expect([0, 1, 2, 3].map((i) => shiftedIndex(i, 0, 2))).toEqual([2, 0, 1, 3]);
  });
});

describe('trackRows', () => {
  it('follows the same occurrence of a repeated row across a render, and empties when a row is gone', () => {
    const indices = [2]; // the second `a`
    const snapshot = trackRows(['a', 'b', 'a', 'c'], ['x', 'a', 'b', 'a', 'c'], ['a'], indices);
    expect(indices).toEqual([3]);
    trackRows(snapshot, ['x', 'b', 'c'], ['a'], indices);
    expect(indices).toEqual([]);
  });

  it('tracks several selected copies of one row at once', () => {
    const indices = [0, 2];
    trackRows(['a', 'b', 'a'], ['x', 'a', 'b', 'a'], ['a', 'a'], indices);
    expect(indices).toEqual([1, 3]);
  });
});

describe('sourceWith', () => {
  const [a, b, c, x] = ['a', 'b', 'c', 'x'];
  const header = { __isGroupRow: true };

  it('inserts rows dropped onto a non-source row (a group header) before the next source row', () => {
    expect(sourceWith([a, b, c], [header, a, header, b, c], [x], 2, () => undefined)).toEqual([a, x, b, c]);
  });

  it('appends when no source row follows the target', () => {
    expect(sourceWith([a], [header, a, header], [x], 2, () => undefined)).toEqual([a, x]);
  });
});
