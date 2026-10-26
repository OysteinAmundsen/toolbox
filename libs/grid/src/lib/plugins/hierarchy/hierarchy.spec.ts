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
    endHierarchy: () => true,
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
    endHierarchy: () => true,
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
      processSiblings: (nodes) => nodes.map((n) => ({ ...n, expanded: false, children: [{ row: child }] })),
      endHierarchy: () => true,
    };
    expect(buildHierarchy([{ id: 'p' }], [collapse])).toEqual([{ id: 'p' }]);
  });

  it('keeps no positions when every contributor reports no structure', () => {
    const a = { id: 'a' };
    const meta = new WeakMap<object, HierarchyRowMeta>();
    const seen: Array<HierarchyRowMeta | undefined> = [];
    const noop: HierarchyContributor = {
      hierarchyStage: 'transform',
      beginHierarchy: () => true,
      processSiblings: (nodes) => nodes,
      endHierarchy: (_rows, positionOf) => {
        seen.push(positionOf(a));
        return false;
      },
    };

    expect(buildHierarchy([a], [noop], meta)).toEqual([a]);
    // Positions are still visible to contributors during endHierarchy, then dropped.
    expect(seen).toEqual([{ level: 1, setSize: 1, posInSet: 1 }]);
    expect(meta.has(a)).toBe(false);
  });

  it('substitutes rows at every nesting level before contributors see them', () => {
    const tree = treeLike();
    const pinnedChild = { id: 'c', value: 'in-progress' };
    const pinnedParent = { id: 'p', children: [{ id: 'old-kid' }] };
    const freshChild = { id: 'c', value: 'fresh' };
    const freshParent = { id: 'p', children: [freshChild] };
    const pinned = new Map<string, unknown>([['c', pinnedChild]]);
    const substitute = (row: unknown) => pinned.get((row as Row).id) ?? row;
    const meta = new WeakMap<object, HierarchyRowMeta>();

    const out = buildHierarchy([freshParent], [tree], meta, substitute);

    expect(out).toEqual([freshParent, pinnedChild]);
    expect(out[1]).toBe(pinnedChild);
    expect(meta.get(pinnedChild)).toEqual({ level: 2, setSize: 1, posInSet: 1 });

    // A pinned PARENT keeps its own children, like EditingPlugin's top-level swap.
    pinned.set('p', pinnedParent);
    expect(buildHierarchy([freshParent], [treeLike()], undefined, substitute)).toEqual([
      pinnedParent,
      { id: 'old-kid' },
    ]);
  });

  it('copies on write: a contributor-owned children list is left untouched', () => {
    const fresh = { id: 'c' };
    const pinnedRow = { id: 'c', pinned: true };
    let ownedChildren: HierarchyNode[] | undefined;
    const tree: HierarchyContributor = {
      hierarchyStage: 'structure',
      beginHierarchy: () => true,
      processSiblings(nodes) {
        for (const node of nodes) {
          const row = node.row as Row;
          if (row.children) {
            node.expanded = true;
            node.children = ownedChildren = row.children.map((child) => ({ row: child }));
          }
        }
        return nodes;
      },
      endHierarchy: () => true,
    };
    const substitute = (row: unknown) => ((row as Row).id === 'c' ? pinnedRow : row);

    const out = buildHierarchy([{ id: 'p', children: [fresh] }], [tree], undefined, substitute);

    expect(out[1]).toBe(pinnedRow);
    expect(ownedChildren?.[0].row).toBe(fresh);
  });

  it('substitutes roots once, before contributors decide whether to activate', () => {
    const pinnedParent = { id: 'p', children: [{ id: 'kid' }] };
    const freshParent = { id: 'p', children: [] };
    const seenByBegin: unknown[][] = [];
    const calls: unknown[] = [];
    const tree = treeLike();
    const gated: HierarchyContributor = {
      ...tree,
      // Like TreePlugin: sit out unless some root actually has children.
      beginHierarchy: (rows) => (seenByBegin.push([...rows]), rows.some((r) => (r as Row).children?.length)),
    };
    const substitute = (row: unknown) => (calls.push(row), (row as Row).id === 'p' ? pinnedParent : row);

    const out = buildHierarchy([freshParent], [gated], undefined, substitute);

    expect(seenByBegin).toEqual([[pinnedParent]]);
    expect(out).toEqual([pinnedParent, { id: 'kid' }]);
    expect(calls.filter((r) => (r as Row).id === 'p')).toHaveLength(1);
  });
});
