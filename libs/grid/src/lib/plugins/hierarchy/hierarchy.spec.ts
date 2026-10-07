import { describe, expect, it } from 'vitest';
import { buildHierarchy } from './hierarchy';
import type { HierarchyContributor, HierarchyNode, HierarchyRowMeta, HierarchySiblingContext } from './types';

type Row = { id: string; children?: Row[]; kind?: string };

/** Structure contributor: expands every row's `children`. */
function treeLike(): HierarchyContributor & { contexts: HierarchySiblingContext[] } {
  const contexts: HierarchySiblingContext[] = [];
  return {
    hierarchyStage: 'structure',
    contexts,
    beginHierarchy: () => true,
    processSiblings(nodes, context) {
      contexts.push(context);
      for (const node of nodes) {
        const row = node.row as Row;
        node.key = row.id;
        if (row.children) {
          node.expanded = true;
          node.children = row.children.map((child) => ({ row: child }));
        }
      }
      return nodes;
    },
    endHierarchy: () => undefined,
  };
}

/** Transform contributor: wraps rows with a `kind` into one header per kind. */
function groupLike(): HierarchyContributor {
  return {
    hierarchyStage: 'transform',
    beginHierarchy: () => true,
    processSiblings(nodes, context) {
      if (!nodes.some((n) => (n.row as Row).kind)) return nodes;
      const groups = new Map<string, HierarchyNode>();
      for (const node of nodes) {
        const kind = (node.row as Row).kind ?? '-';
        let group = groups.get(kind);
        if (!group) {
          group = { row: { header: kind, under: context.parentKey }, expanded: true, shaped: true, children: [] };
          groups.set(kind, group);
        }
        group.children?.push(node);
      }
      return [...groups.values()];
    },
    endHierarchy: () => undefined,
  };
}

describe('buildHierarchy', () => {
  it('passes rows through (as a copy) when no contributor is active', () => {
    const rows = [{ id: 'a' }, { id: 'b' }];
    const idle: HierarchyContributor = {
      hierarchyStage: 'structure',
      beginHierarchy: () => false,
      processSiblings: () => {
        throw new Error('must not run');
      },
      endHierarchy: () => {
        throw new Error('must not run');
      },
    };
    const out = buildHierarchy(rows, [idle]);
    expect(out).toEqual(rows);
    expect(out).not.toBe(rows);
  });

  it('flattens expanded children in pre-order and records ARIA positions', () => {
    const c1 = { id: 'c1' };
    const c2 = { id: 'c2' };
    const a = { id: 'a', children: [c1, c2] };
    const b = { id: 'b' };
    const meta = new WeakMap<object, HierarchyRowMeta>();

    const out = buildHierarchy([a, b], [treeLike()], meta);

    expect(out).toEqual([a, c1, c2, b]);
    expect(meta.get(a)).toEqual({ level: 1, setSize: 2, posInSet: 1 });
    expect(meta.get(c2)).toEqual({ level: 2, setSize: 2, posInSet: 2 });
    expect(meta.get(b)).toEqual({ level: 1, setSize: 2, posInSet: 2 });
  });

  it('runs structure contributors before transforms on every natural list', () => {
    const tree = treeLike();
    const leafA = { id: 'x', kind: 'A' };
    const leafB = { id: 'y', kind: 'B' };
    const root = { id: 'r', children: [leafA, leafB] };
    const meta = new WeakMap<object, HierarchyRowMeta>();

    // Transform listed first — the structure stage must still run first.
    const out = buildHierarchy([root], [groupLike(), tree], meta);

    expect(out).toEqual([root, { header: 'A', under: 'r' }, leafA, { header: 'B', under: 'r' }, leafB]);
    expect(meta.get(leafA)?.level).toBe(3);
    expect(tree.contexts.map((c) => [c.parentKey, c.depth])).toEqual([
      [null, 0],
      ['r', 1],
    ]);
  });

  it('does not re-process shaped children but descends into their natural children', () => {
    const tree = treeLike();
    const grandchild = { id: 'g' };
    const member = { id: 'm', kind: 'A', children: [grandchild] };

    const out = buildHierarchy([member], [tree, groupLike()]);

    expect(out).toEqual([{ header: 'A', under: null }, member, grandchild]);
    // root list + the member's own children — the group's member list is shaped.
    expect(tree.contexts.map((c) => c.parentKey)).toEqual([null, 'm']);
  });

  it('skips collapsed children', () => {
    const child = { id: 'c' };
    const collapse: HierarchyContributor = {
      hierarchyStage: 'structure',
      beginHierarchy: () => true,
      processSiblings: (nodes) =>
        nodes.map((n) => ({ ...n, expanded: false, children: [{ row: child }] })),
      endHierarchy: () => undefined,
    };
    expect(buildHierarchy([{ id: 'p' }], [collapse])).toEqual([{ id: 'p' }]);
  });
});
