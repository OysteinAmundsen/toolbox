import { describe, expect, it } from 'vitest';
import {
  collapseAll,
  expandAll,
  expandToKey,
  flattenTree,
  generateRowKey,
  getDescendants,
  getPathToKey,
  toggleExpand,
} from './tree-data';
import { countNodes, detectTreeStructure, getMaxDepth, inferChildrenField } from './tree-detect';
import { TreePlugin } from './TreePlugin';
import type { FlattenedTreeRow, TreeConfig } from './types';

describe('tree-data', () => {
  const defaultConfig: TreeConfig = {
    childrenField: 'children',
  };

  describe('generateRowKey', () => {
    it('should use row.id if available', () => {
      const row = { id: 'abc123', name: 'Test' };
      expect(generateRowKey(row, 0, null)).toBe('abc123');
    });

    it('should use numeric id', () => {
      const row = { id: 42, name: 'Test' };
      expect(generateRowKey(row, 0, null)).toBe('42');
    });

    it('should generate key from index when no id', () => {
      const row = { name: 'Test' };
      expect(generateRowKey(row, 0, null)).toBe('0');
      expect(generateRowKey(row, 5, null)).toBe('5');
    });

    it('should include parent key in generated path', () => {
      const row = { name: 'Child' };
      expect(generateRowKey(row, 2, 'parent-0')).toBe('parent-0-2');
      expect(generateRowKey(row, 0, '0-1')).toBe('0-1-0');
    });

    it('should prefer row.id over path generation even with parentKey', () => {
      const row = { id: 'child-id', name: 'Child' };
      expect(generateRowKey(row, 2, 'parent-0')).toBe('child-id');
    });
  });

  describe('flattenTree', () => {
    it('should flatten single level (no children)', () => {
      const rows = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];

      const result = flattenTree(rows, defaultConfig, new Set());

      expect(result).toHaveLength(3);
      expect(result[0].key).toBe('0');
      expect(result[0].depth).toBe(0);
      expect(result[0].hasChildren).toBe(false);
      expect(result[0].isExpanded).toBe(false);
    });

    it('should flatten with collapsed children', () => {
      const rows = [
        {
          name: 'Parent',
          children: [{ name: 'Child 1' }, { name: 'Child 2' }],
        },
      ];

      const result = flattenTree(rows, defaultConfig, new Set());

      expect(result).toHaveLength(1);
      expect(result[0].hasChildren).toBe(true);
      expect(result[0].isExpanded).toBe(false);
    });

    it('should include children when parent is expanded', () => {
      const rows = [
        {
          id: 'parent',
          name: 'Parent',
          children: [{ name: 'Child 1' }, { name: 'Child 2' }],
        },
      ];

      const result = flattenTree(rows, defaultConfig, new Set(['parent']));

      expect(result).toHaveLength(3);
      expect(result[0].key).toBe('parent');
      expect(result[0].isExpanded).toBe(true);
      expect(result[1].depth).toBe(1);
      expect(result[1].parentKey).toBe('parent');
      expect(result[2].depth).toBe(1);
    });

    it('should handle deeply nested trees', () => {
      const rows = [
        {
          id: 'level0',
          children: [
            {
              id: 'level1',
              children: [
                {
                  id: 'level2',
                  children: [{ id: 'level3' }],
                },
              ],
            },
          ],
        },
      ];

      const expandedKeys = new Set(['level0', 'level1', 'level2']);
      const result = flattenTree(rows, defaultConfig, expandedKeys);

      expect(result).toHaveLength(4);
      expect(result[0].depth).toBe(0);
      expect(result[1].depth).toBe(1);
      expect(result[2].depth).toBe(2);
      expect(result[3].depth).toBe(3);
    });

    it('should handle multiple root nodes', () => {
      const rows = [
        { id: 'root1', children: [{ name: 'Child 1' }] },
        { id: 'root2', children: [{ name: 'Child 2' }] },
        { id: 'root3' },
      ];

      const result = flattenTree(rows, defaultConfig, new Set(['root1', 'root2']));

      expect(result).toHaveLength(5);
      expect(result[0].key).toBe('root1');
      expect(result[1].parentKey).toBe('root1');
      expect(result[2].key).toBe('root2');
      expect(result[3].parentKey).toBe('root2');
      expect(result[4].key).toBe('root3');
    });

    it('should handle empty children array', () => {
      const rows = [{ name: 'Node', children: [] }];

      const result = flattenTree(rows, defaultConfig, new Set());

      expect(result).toHaveLength(1);
      expect(result[0].hasChildren).toBe(false);
    });

    it('should use custom children field', () => {
      const rows = [
        {
          id: 'parent',
          items: [{ name: 'Child' }],
        },
      ];

      const config: TreeConfig = { childrenField: 'items' };
      const result = flattenTree(rows, config, new Set(['parent']));

      expect(result).toHaveLength(2);
    });
  });

  describe('toggleExpand', () => {
    it('should add key when not present', () => {
      const expanded = new Set(['a', 'b']);
      const result = toggleExpand(expanded, 'c');

      expect(result.has('c')).toBe(true);
      expect(result.size).toBe(3);
    });

    it('should remove key when present', () => {
      const expanded = new Set(['a', 'b', 'c']);
      const result = toggleExpand(expanded, 'b');

      expect(result.has('b')).toBe(false);
      expect(result.size).toBe(2);
    });

    it('should return a new Set (immutable)', () => {
      const expanded = new Set(['a']);
      const result = toggleExpand(expanded, 'b');

      expect(result).not.toBe(expanded);
      expect(expanded.has('b')).toBe(false);
    });
  });

  describe('expandAll', () => {
    it('should return empty set for flat data', () => {
      const rows = [{ name: 'A' }, { name: 'B' }];
      const result = expandAll(rows, defaultConfig);

      expect(result.size).toBe(0);
    });

    it('should expand all parent nodes', () => {
      const rows = [
        {
          id: 'parent1',
          children: [{ name: 'Child 1' }],
        },
        {
          id: 'parent2',
          children: [
            {
              id: 'nested',
              children: [{ name: 'Deep' }],
            },
          ],
        },
      ];

      const result = expandAll(rows, defaultConfig);

      expect(result.size).toBe(3);
      expect(result.has('parent1')).toBe(true);
      expect(result.has('parent2')).toBe(true);
      expect(result.has('nested')).toBe(true);
    });

    it('should not include leaf nodes', () => {
      const rows = [
        {
          id: 'parent',
          children: [{ id: 'leaf' }],
        },
      ];

      const result = expandAll(rows, defaultConfig);

      expect(result.has('parent')).toBe(true);
      expect(result.has('leaf')).toBe(false);
    });
  });

  describe('collapseAll', () => {
    it('should return empty set', () => {
      const result = collapseAll();
      expect(result.size).toBe(0);
    });
  });

  describe('getDescendants', () => {
    it('should return empty array for leaf node', () => {
      const flatRows: FlattenedTreeRow[] = [
        { key: 'leaf', data: {}, depth: 0, hasChildren: false, isExpanded: false, parentKey: null },
      ];

      const result = getDescendants(flatRows, 'leaf');
      expect(result).toHaveLength(0);
    });

    it('should return all children of a node', () => {
      const flatRows: FlattenedTreeRow[] = [
        { key: 'parent', data: {}, depth: 0, hasChildren: true, isExpanded: true, parentKey: null },
        { key: 'child1', data: {}, depth: 1, hasChildren: false, isExpanded: false, parentKey: 'parent' },
        { key: 'child2', data: {}, depth: 1, hasChildren: false, isExpanded: false, parentKey: 'parent' },
        { key: 'sibling', data: {}, depth: 0, hasChildren: false, isExpanded: false, parentKey: null },
      ];

      const result = getDescendants(flatRows, 'parent');

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('child1');
      expect(result[1].key).toBe('child2');
    });

    it('should return nested descendants', () => {
      const flatRows: FlattenedTreeRow[] = [
        { key: 'root', data: {}, depth: 0, hasChildren: true, isExpanded: true, parentKey: null },
        { key: 'child', data: {}, depth: 1, hasChildren: true, isExpanded: true, parentKey: 'root' },
        { key: 'grandchild', data: {}, depth: 2, hasChildren: false, isExpanded: false, parentKey: 'child' },
      ];

      const result = getDescendants(flatRows, 'root');

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('child');
      expect(result[1].key).toBe('grandchild');
    });
  });

  describe('getPathToKey', () => {
    it('should return path to root level node', () => {
      const rows = [{ id: 'a' }, { id: 'b' }];
      const result = getPathToKey(rows, 'b', defaultConfig);

      expect(result).toEqual(['b']);
    });

    it('should return path to nested node', () => {
      const rows = [
        {
          id: 'root',
          children: [
            {
              id: 'parent',
              children: [{ id: 'target' }],
            },
          ],
        },
      ];

      const result = getPathToKey(rows, 'target', defaultConfig);

      expect(result).toEqual(['root', 'parent', 'target']);
    });

    it('should return null for non-existent key', () => {
      const rows = [{ id: 'a' }];
      const result = getPathToKey(rows, 'missing', defaultConfig);

      expect(result).toBeNull();
    });
  });

  describe('expandToKey', () => {
    it('should expand ancestors to make key visible', () => {
      const rows = [
        {
          id: 'root',
          children: [
            {
              id: 'parent',
              children: [{ id: 'target' }],
            },
          ],
        },
      ];

      const result = expandToKey(rows, 'target', defaultConfig, new Set());

      expect(result.has('root')).toBe(true);
      expect(result.has('parent')).toBe(true);
      expect(result.has('target')).toBe(false); // Target itself not expanded
    });

    it('should preserve existing expanded keys', () => {
      const rows = [
        { id: 'other', children: [{ id: 'otherChild' }] },
        { id: 'root', children: [{ id: 'target' }] },
      ];

      const existing = new Set(['other']);
      const result = expandToKey(rows, 'target', defaultConfig, existing);

      expect(result.has('other')).toBe(true);
      expect(result.has('root')).toBe(true);
    });
  });
});

describe('tree-detect', () => {
  describe('detectTreeStructure', () => {
    it('should return false for empty array', () => {
      expect(detectTreeStructure([])).toBe(false);
    });

    it('should return false for flat data', () => {
      const rows = [{ name: 'A' }, { name: 'B' }];
      expect(detectTreeStructure(rows)).toBe(false);
    });

    it('should return false for empty children arrays', () => {
      const rows = [{ name: 'A', children: [] }];
      expect(detectTreeStructure(rows)).toBe(false);
    });

    it('should return true when children exist', () => {
      const rows = [{ name: 'A' }, { name: 'B', children: [{ name: 'Child' }] }];
      expect(detectTreeStructure(rows)).toBe(true);
    });

    it('should use custom children field', () => {
      const rows = [{ name: 'A', items: [{ name: 'Child' }] }];

      expect(detectTreeStructure(rows, 'children')).toBe(false);
      expect(detectTreeStructure(rows, 'items')).toBe(true);
    });

    it('should handle null rows in array', () => {
      const rows = [null, { name: 'A', children: [{ name: 'Child' }] }];
      expect(detectTreeStructure(rows)).toBe(true);
    });
  });

  describe('inferChildrenField', () => {
    it('should return null for empty array', () => {
      expect(inferChildrenField([])).toBeNull();
    });

    it('should return null for flat data', () => {
      const rows = [{ name: 'A', data: 'test' }];
      expect(inferChildrenField(rows)).toBeNull();
    });

    it('should detect "children" field', () => {
      const rows = [{ children: [{ name: 'Child' }] }];
      expect(inferChildrenField(rows)).toBe('children');
    });

    it('should detect "items" field', () => {
      const rows = [{ items: [{ name: 'Item' }] }];
      expect(inferChildrenField(rows)).toBe('items');
    });

    it('should detect "nodes" field', () => {
      const rows = [{ nodes: [{ name: 'Node' }] }];
      expect(inferChildrenField(rows)).toBe('nodes');
    });

    it('should detect "subRows" field', () => {
      const rows = [{ subRows: [{ name: 'SubRow' }] }];
      expect(inferChildrenField(rows)).toBe('subRows');
    });

    it('should detect "nested" field', () => {
      const rows = [{ nested: [{ name: 'Nested' }] }];
      expect(inferChildrenField(rows)).toBe('nested');
    });

    it('should prioritize "children" over other fields', () => {
      const rows = [{ children: [{ name: 'A' }], items: [{ name: 'B' }] }];
      expect(inferChildrenField(rows)).toBe('children');
    });

    it('should skip empty arrays', () => {
      const rows = [{ children: [], items: [{ name: 'Item' }] }];
      expect(inferChildrenField(rows)).toBe('items');
    });

    it('should skip non-object rows', () => {
      const rows = [null, undefined, 'string', { items: [{ name: 'Item' }] }];
      expect(inferChildrenField(rows)).toBe('items');
    });
  });

  describe('getMaxDepth', () => {
    it('should return 0 for empty array', () => {
      expect(getMaxDepth([])).toBe(0);
    });

    it('should return 0 for flat data', () => {
      const rows = [{ name: 'A' }, { name: 'B' }];
      expect(getMaxDepth(rows)).toBe(0);
    });

    it('should return 1 for single level nesting', () => {
      const rows = [{ children: [{ name: 'Child' }] }];
      expect(getMaxDepth(rows)).toBe(1);
    });

    it('should return correct depth for deep nesting', () => {
      const rows = [
        {
          children: [
            {
              children: [
                {
                  children: [{ name: 'Deep' }],
                },
              ],
            },
          ],
        },
      ];
      expect(getMaxDepth(rows)).toBe(3);
    });

    it('should find max across multiple branches', () => {
      const rows = [
        { children: [{ name: 'Shallow' }] },
        {
          children: [
            {
              children: [{ name: 'Deep' }],
            },
          ],
        },
      ];
      expect(getMaxDepth(rows)).toBe(2);
    });
  });

  describe('countNodes', () => {
    it('should return 0 for empty array', () => {
      expect(countNodes([])).toBe(0);
    });

    it('should count flat nodes', () => {
      const rows = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
      expect(countNodes(rows)).toBe(3);
    });

    it('should count all nodes in tree', () => {
      const rows = [
        {
          name: 'Parent',
          children: [{ name: 'Child 1' }, { name: 'Child 2', children: [{ name: 'Grandchild' }] }],
        },
      ];
      expect(countNodes(rows)).toBe(4);
    });

    it('should handle null rows', () => {
      const rows = [null, { name: 'A' }, null];
      expect(countNodes(rows)).toBe(1);
    });
  });
});

describe('TreePlugin sorting', () => {
  /**
   * Test helper to access the private sortTree method.
   * We create a plugin instance and properly initialize it with a mock grid.
   */
  function sortTree(rows: any[], field: string, direction: 1 | -1): any[] {
    const plugin = new TreePlugin({});
    // Mock grid to initialize plugin properly
    const mockGrid = {
      shadowRoot: null,
      rows: [],
      columns: [],
      gridConfig: {},
      _focusRow: 0,
      _focusCol: 0,
      disconnectSignal: new AbortController().signal,
      requestRender: () => {
        /* noop */
      },
      requestAfterRender: () => {
        /* noop */
      },
      forceLayout: async () => {
        /* noop */
      },
      getPlugin: () => undefined,
      getPluginByName: () => undefined,
      dispatchEvent: () => true,
    };
    plugin.attach(mockGrid as any);
    // Access private method via bracket notation for testing
    return (plugin as any).sortTree(rows, field, direction);
  }

  describe('sortTree', () => {
    it('should sort root level ascending', () => {
      const rows = [{ name: 'Pictures' }, { name: 'Documents' }, { name: 'readme.md' }];

      const result = sortTree(rows, 'name', 1);

      expect(result.map((r: any) => r.name)).toEqual(['Documents', 'Pictures', 'readme.md']);
    });

    it('should sort root level descending', () => {
      const rows = [{ name: 'Documents' }, { name: 'Pictures' }, { name: 'readme.md' }];

      const result = sortTree(rows, 'name', -1);

      expect(result.map((r: any) => r.name)).toEqual(['readme.md', 'Pictures', 'Documents']);
    });

    it('should sort children within their parent (ASC)', () => {
      const rows = [
        {
          name: 'Documents',
          children: [{ name: 'Resume.pdf' }, { name: 'Cover Letter.docx' }, { name: 'Projects' }],
        },
        { name: 'Pictures' },
        { name: 'readme.md' },
      ];

      const result = sortTree(rows, 'name', 1);

      // Root level should be sorted
      expect(result.map((r: any) => r.name)).toEqual(['Documents', 'Pictures', 'readme.md']);

      // Children of Documents should be sorted
      const docsChildren = result[0].children;
      expect(docsChildren.map((r: any) => r.name)).toEqual(['Cover Letter.docx', 'Projects', 'Resume.pdf']);
    });

    it('should sort children within their parent (DESC)', () => {
      const rows = [
        {
          name: 'Documents',
          children: [{ name: 'Resume.pdf' }, { name: 'Cover Letter.docx' }, { name: 'Projects' }],
        },
        { name: 'Pictures' },
        { name: 'readme.md' },
      ];

      const result = sortTree(rows, 'name', -1);

      // Root level should be sorted descending
      expect(result.map((r: any) => r.name)).toEqual(['readme.md', 'Pictures', 'Documents']);

      // Children of Documents should be sorted descending
      const docsChildren = result[2].children; // Documents is now last
      expect(docsChildren.map((r: any) => r.name)).toEqual(['Resume.pdf', 'Projects', 'Cover Letter.docx']);
    });

    it('should sort deeply nested children', () => {
      const rows = [
        {
          name: 'Root',
          children: [
            {
              name: 'Level1-B',
              children: [{ name: 'Level2-C' }, { name: 'Level2-A' }, { name: 'Level2-B' }],
            },
            { name: 'Level1-A' },
          ],
        },
      ];

      const result = sortTree(rows, 'name', 1);

      expect(result[0].name).toBe('Root');
      expect(result[0].children.map((r: any) => r.name)).toEqual(['Level1-A', 'Level1-B']);
      expect(result[0].children[1].children.map((r: any) => r.name)).toEqual(['Level2-A', 'Level2-B', 'Level2-C']);
    });

    it('should handle null/undefined values in sort field', () => {
      const rows = [{ name: 'B' }, { name: null }, { name: 'A' }, { name: undefined }];

      const result = sortTree(rows, 'name', 1);

      // Null/undefined come first, then sorted values
      expect(result[0].name).toBeNull();
      expect(result[1].name).toBeUndefined();
      expect(result[2].name).toBe('A');
      expect(result[3].name).toBe('B');
    });

    it('should sort by numeric field', () => {
      const rows = [
        { name: 'Item', size: 100 },
        { name: 'Item', size: 50 },
        { name: 'Item', size: 200 },
      ];

      const result = sortTree(rows, 'size', 1);

      expect(result.map((r: any) => r.size)).toEqual([50, 100, 200]);
    });

    it('should preserve tree structure after sorting', () => {
      const rows = [
        {
          name: 'Parent',
          children: [{ name: 'Child' }],
        },
      ];

      const result = sortTree(rows, 'name', 1);

      // Original should not be mutated
      expect(rows[0]).not.toBe(result[0]);
      expect(rows[0].children).not.toBe(result[0].children);

      // Structure should be preserved
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children[0].name).toBe('Child');
    });
  });
});
