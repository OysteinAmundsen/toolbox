import { bench, describe } from 'vitest';
import { expandAll, flattenTree } from './tree-data';
import type { TreeConfig, TreeRow } from './types';

// #region Data Generators

/** Build a balanced tree with the given depth and branching factor. */
function generateTree(totalNodes: number, depth: number, branchFactor = 5): TreeRow[] {
  let id = 0;

  function buildLevel(currentDepth: number, maxNodes: number): TreeRow[] {
    const rows: TreeRow[] = [];
    const count = Math.min(branchFactor, maxNodes);

    for (let i = 0; i < count && id < totalNodes; i++) {
      const node: TreeRow = {
        id: id++,
        name: `Node ${id}`,
        department: ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'][id % 5],
        value: Math.round(Math.random() * 10_000),
      };

      if (currentDepth < depth - 1) {
        const childBudget = Math.floor((totalNodes - id) / (count - i));
        node.children = buildLevel(currentDepth + 1, childBudget);
      }

      rows.push(node);
    }
    return rows;
  }

  return buildLevel(0, totalNodes);
}

/** Build a wide, shallow tree (many roots, few children). */
function generateWideTree(rootCount: number, childrenPerRoot: number): TreeRow[] {
  let id = 0;
  const rows: TreeRow[] = [];

  for (let r = 0; r < rootCount; r++) {
    const children: TreeRow[] = [];
    for (let c = 0; c < childrenPerRoot; c++) {
      children.push({ id: id++, name: `Child ${id}`, value: Math.random() * 1000 });
    }
    rows.push({ id: id++, name: `Root ${r}`, children, value: Math.random() * 10_000 });
  }
  return rows;
}

// #endregion

// #region flattenTree — varying depth

describe('flattenTree — balanced tree', () => {
  const config: TreeConfig = { childrenField: 'children' };

  const tree1K_d3 = generateTree(1_000, 3);
  const tree10K_d4 = generateTree(10_000, 4);
  const tree100K_d5 = generateTree(100_000, 5);

  // All expanded
  const expanded1K = expandAll(tree1K_d3, config);
  const expanded10K = expandAll(tree10K_d4, config);
  const expanded100K = expandAll(tree100K_d5, config);

  bench('1K nodes — depth 3 — all expanded', () => {
    flattenTree(tree1K_d3, config, expanded1K);
  });

  bench('10K nodes — depth 4 — all expanded', () => {
    flattenTree(tree10K_d4, config, expanded10K);
  });

  bench('100K nodes — depth 5 — all expanded', () => {
    flattenTree(tree100K_d5, config, expanded100K);
  });
});

// #endregion

// #region flattenTree — collapsed vs expanded

describe('flattenTree — expansion state', () => {
  const config: TreeConfig = { childrenField: 'children' };
  const tree10K = generateTree(10_000, 4);
  const expandedAll = expandAll(tree10K, config);
  const expandedNone = new Set<string>();

  // Partially expanded: only root nodes
  const partialExpanded = new Set<string>();
  for (const row of tree10K) {
    partialExpanded.add(String(row.id));
  }

  bench('10K nodes — all collapsed (roots only)', () => {
    flattenTree(tree10K, config, expandedNone);
  });

  bench('10K nodes — roots expanded only', () => {
    flattenTree(tree10K, config, partialExpanded);
  });

  bench('10K nodes — all expanded', () => {
    flattenTree(tree10K, config, expandedAll);
  });
});

// #endregion

// #region flattenTree — wide tree

describe('flattenTree — wide tree', () => {
  const config: TreeConfig = { childrenField: 'children' };

  const wide1K = generateWideTree(100, 10);
  const wide10K = generateWideTree(1_000, 10);
  const wide50K = generateWideTree(5_000, 10);

  const expanded1K = expandAll(wide1K, config);
  const expanded10K = expandAll(wide10K, config);
  const expanded50K = expandAll(wide50K, config);

  bench('1K nodes (100 roots × 10 children)', () => {
    flattenTree(wide1K, config, expanded1K);
  });

  bench('10K nodes (1K roots × 10 children)', () => {
    flattenTree(wide10K, config, expanded10K);
  });

  bench('50K nodes (5K roots × 10 children)', () => {
    flattenTree(wide50K, config, expanded50K);
  });
});

// #endregion
