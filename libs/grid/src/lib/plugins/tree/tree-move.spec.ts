/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest';
import { resolveTreeMove, type TreeMoveContext } from './tree-move';
import type { FlattenedTreeRow, TreeRow } from './types';

/** Context over `roots`, with metadata for every row in `tree` (which may be detached from `roots`). */
function context(roots: TreeRow[], tree: TreeRow[]): TreeMoveContext {
  const meta = new Map<unknown, FlattenedTreeRow>();
  const byKey = new Map<string, FlattenedTreeRow>();
  const visit = (list: TreeRow[], parentKey: string | null, depth: number) =>
    list.forEach((row, i) => {
      const entry: FlattenedTreeRow = {
        key: String(row.id),
        data: row,
        depth,
        hasChildren: Array.isArray(row.children),
        isExpanded: true,
        parentKey,
        posInSet: i + 1,
        setSize: list.length,
      };
      meta.set(row, entry);
      byKey.set(entry.key, entry);
      if (Array.isArray(row.children)) visit(row.children as TreeRow[], entry.key, depth + 1);
    });
  visit(tree, null, 0);
  let order = 0;
  const orders = new Map([...meta.keys()].map((row) => [row, order++]));
  return {
    roots,
    childrenField: 'children',
    metaOf: (row) => meta.get(row),
    metaByKey: (key) => byKey.get(key),
    orderOf: (row) => orders.get(row),
    wasParent: () => false,
    onCopy: () => undefined,
  };
}

describe('resolveTreeMove', () => {
  it('vetoes a move whose parent is not reachable from the roots (e.g. ServerSide-owned roots)', () => {
    const [c1, c2] = [{ id: 'c1' }, { id: 'c2' }];
    const parent = { id: 'P', children: [c1, c2] };
    // ServerSide feeds Tree its own nodes; `grid.sourceRows` stays empty.
    const ctx = context([], [parent]);

    const result = resolveTreeMove(ctx, {
      op: 'move',
      row: c2,
      fromIndex: 2,
      target: c1,
      toIndex: 1,
      position: 'before',
    });

    expect(result).toBe(false);
  });

  it('vetoes removing a rendered child whose parent is not reachable from the roots', () => {
    const child = { id: 'c' };
    const ctx = context([], [{ id: 'P', children: [child] }]);

    expect(resolveTreeMove(ctx, { op: 'remove', rows: [child] })).toBe(false);
  });

  it('vetoes removing a row the tree has no metadata for, instead of reporting success', () => {
    const roots = [{ id: 'A' }];
    const ctx = context(roots, roots);

    expect(resolveTreeMove(ctx, { op: 'remove', rows: [{ id: 'ghost' }] })).toBe(false);
  });

  it('removes selected rows from several sibling lists at once, keeping the rest in order', () => {
    const [a1, a2, a3] = [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }];
    const roots: TreeRow[] = [{ id: 'A', children: [a1, a2, a3] }, { id: 'B' }, { id: 'C' }];

    const result = resolveTreeMove(context(roots, roots), { op: 'remove', rows: [a1, roots[2], a3] });

    expect(result && result.rows).toEqual([{ id: 'A', children: [a2] }, { id: 'B' }]);
  });

  it('vetoes removing a row its parent no longer holds', () => {
    const c = { id: 'c' };
    const roots: TreeRow[] = [{ id: 'P', children: [c, { id: 'd' }] }];
    const ctx = context(roots, roots);
    roots[0].children = [{ id: 'd' }]; // stale metadata

    expect(resolveTreeMove(ctx, { op: 'remove', rows: [c] })).toBe(false);
  });
});
