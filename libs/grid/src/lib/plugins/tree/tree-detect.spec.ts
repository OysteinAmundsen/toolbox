import { describe, expect, it } from 'vitest';
import type { TreeRow } from './types';
import { countNodes, detectTreeStructure, getMaxDepth, inferChildrenField } from './tree-detect';

const rows = (...value: unknown[]) => value as TreeRow[];

describe('detectTreeStructure', () => {
  it('returns false for empty or non-array input', () => {
    expect(detectTreeStructure([])).toBe(false);
    expect(detectTreeStructure(undefined as unknown as TreeRow[])).toBe(false);
  });

  it('returns false for a flat list', () => {
    expect(detectTreeStructure(rows({ id: 1 }, { id: 2 }))).toBe(false);
  });

  it('ignores null rows and empty children arrays', () => {
    expect(detectTreeStructure(rows(null, { id: 1, children: [] }))).toBe(false);
  });

  it('detects embedded children arrays', () => {
    expect(detectTreeStructure(rows({ id: 1 }, { id: 2, children: [{ id: 3 }] }))).toBe(true);
  });

  it('detects lazy children indicators (truthy non-array)', () => {
    expect(detectTreeStructure(rows({ id: 1, children: true }))).toBe(true);
    expect(detectTreeStructure(rows({ id: 1, children: 5 }))).toBe(true);
    expect(detectTreeStructure(rows({ id: 1, children: 0 }))).toBe(false);
  });

  it('honours a custom children field', () => {
    expect(detectTreeStructure(rows({ id: 1, subRows: [{ id: 2 }] }))).toBe(false);
    expect(detectTreeStructure(rows({ id: 1, subRows: [{ id: 2 }] }), 'subRows')).toBe(true);
  });

  it('detects the purely lazy case via the hasChildren predicate', () => {
    const data = rows({ id: 1, hasKids: true }, { id: 2, hasKids: false });
    expect(detectTreeStructure(data)).toBe(false);
    expect(detectTreeStructure(data, 'children', (row) => row['hasKids'] === true)).toBe(true);
  });
});

describe('inferChildrenField', () => {
  it('returns null for empty input', () => {
    expect(inferChildrenField([])).toBe(null);
    expect(inferChildrenField(undefined as unknown as TreeRow[])).toBe(null);
  });

  it('returns null when no common field holds a non-empty array', () => {
    expect(inferChildrenField(rows({ id: 1 }, { id: 2, children: [] }))).toBe(null);
  });

  it('finds the first matching common field, scanning rows in order', () => {
    expect(inferChildrenField(rows({ id: 1 }, { id: 2, nodes: [{ id: 3 }] }))).toBe('nodes');
    expect(inferChildrenField(rows({ id: 1, subRows: [{ id: 2 }] }))).toBe('subRows');
  });

  it('prefers the earlier candidate when a row has several', () => {
    expect(inferChildrenField(rows({ items: [{ id: 1 }], children: [{ id: 2 }] }))).toBe('children');
  });

  it('skips null and non-object rows', () => {
    expect(inferChildrenField(rows(null, 'x', { nested: [{ id: 1 }] }))).toBe('nested');
  });
});

describe('getMaxDepth', () => {
  it('returns the starting depth for empty or non-array input', () => {
    expect(getMaxDepth([])).toBe(0);
    expect(getMaxDepth(undefined as unknown as TreeRow[])).toBe(0);
    expect(getMaxDepth([], 'children', 3)).toBe(3);
  });

  it('returns 0 for a flat list', () => {
    expect(getMaxDepth(rows({ id: 1 }, { id: 2, children: [] }))).toBe(0);
  });

  it('measures the deepest branch, not the first', () => {
    const data = rows(
      { id: 1, children: [{ id: 2 }] },
      { id: 3, children: [{ id: 4, children: [{ id: 5, children: [{ id: 6 }] }] }] },
    );
    expect(getMaxDepth(data)).toBe(3);
  });

  it('honours a custom children field and skips null rows', () => {
    expect(getMaxDepth(rows(null, { id: 1, kids: [{ id: 2, kids: [{ id: 3 }] }] }), 'kids')).toBe(2);
  });
});

describe('countNodes', () => {
  it('returns 0 for non-array input', () => {
    expect(countNodes(undefined as unknown as TreeRow[])).toBe(0);
    expect(countNodes([])).toBe(0);
  });

  it('counts every descendant, skipping null rows', () => {
    const data = rows(null, { id: 1, children: [{ id: 2, children: [{ id: 3 }] }] }, { id: 4 });
    expect(countNodes(data)).toBe(4);
  });

  it('honours a custom children field', () => {
    const data = rows({ id: 1, kids: [{ id: 2 }, { id: 3 }] });
    expect(countNodes(data)).toBe(1);
    expect(countNodes(data, 'kids')).toBe(3);
  });
});
