import { describe, expect, it } from 'vitest';
import { countTopLevelNodes, getTopLevelNodeIndex, shouldPrefetch } from './tree-datasource';
import type { FlattenedTreeRow } from './types';

function makeFlatRow(key: string, depth: number): FlattenedTreeRow {
  return {
    key,
    data: { id: key },
    depth,
    hasChildren: depth === 0,
    isExpanded: depth === 0,
    parentKey: depth > 0 ? 'parent' : null,
  };
}

describe('tree-datasource', () => {
  describe('getTopLevelNodeIndex', () => {
    it('should return 0 for the first depth-0 row', () => {
      const rows = [makeFlatRow('a', 0), makeFlatRow('b', 1), makeFlatRow('c', 0)];
      expect(getTopLevelNodeIndex(rows, 0)).toBe(0);
    });

    it('should return the parent top-level index for a child row', () => {
      const rows = [makeFlatRow('a', 0), makeFlatRow('a-1', 1), makeFlatRow('a-2', 1), makeFlatRow('b', 0)];
      // Row index 1 (a-1 at depth 1) belongs to top-level node 'a' which is index 0
      expect(getTopLevelNodeIndex(rows, 1)).toBe(0);
      // Row index 2 (a-2 at depth 1) also belongs to top-level node 'a'
      expect(getTopLevelNodeIndex(rows, 2)).toBe(0);
    });

    it('should return the correct top-level index for a later root node', () => {
      const rows = [makeFlatRow('a', 0), makeFlatRow('a-1', 1), makeFlatRow('b', 0), makeFlatRow('b-1', 1)];
      // Row index 2 is 'b' which is the 2nd top-level node (index 1)
      expect(getTopLevelNodeIndex(rows, 2)).toBe(1);
      // Row index 3 (b-1) belongs to 'b' at top-level index 1
      expect(getTopLevelNodeIndex(rows, 3)).toBe(1);
    });

    it('should handle deeply nested children', () => {
      const rows = [
        makeFlatRow('a', 0),
        makeFlatRow('a-1', 1),
        makeFlatRow('a-1-1', 2),
        makeFlatRow('a-1-1-1', 3),
        makeFlatRow('b', 0),
      ];
      // Row index 3 (depth 3) should walk back to 'a' (index 0)
      expect(getTopLevelNodeIndex(rows, 3)).toBe(0);
      expect(getTopLevelNodeIndex(rows, 4)).toBe(1);
    });

    it('should clamp to valid range', () => {
      const rows = [makeFlatRow('a', 0)];
      expect(getTopLevelNodeIndex(rows, 100)).toBe(0);
    });

    it('should return 0 for empty rows', () => {
      expect(getTopLevelNodeIndex([], 0)).toBe(0);
    });
  });

  describe('countTopLevelNodes', () => {
    it('should count only depth-0 rows', () => {
      const rows = [
        makeFlatRow('a', 0),
        makeFlatRow('a-1', 1),
        makeFlatRow('a-2', 1),
        makeFlatRow('b', 0),
        makeFlatRow('b-1', 1),
        makeFlatRow('c', 0),
      ];
      expect(countTopLevelNodes(rows)).toBe(3);
    });

    it('should return 0 for empty rows', () => {
      expect(countTopLevelNodes([])).toBe(0);
    });

    it('should handle all roots (no children)', () => {
      const rows = [makeFlatRow('a', 0), makeFlatRow('b', 0), makeFlatRow('c', 0)];
      expect(countTopLevelNodes(rows)).toBe(3);
    });
  });

  describe('shouldPrefetch', () => {
    it('should return true when viewport is near end of loaded data', () => {
      // 10 top-level nodes, each with 1 child = 20 flattened rows
      const rows: FlattenedTreeRow[] = [];
      for (let i = 0; i < 10; i++) {
        rows.push(makeFlatRow(`node-${i}`, 0));
        rows.push(makeFlatRow(`node-${i}-child`, 1));
      }
      // Viewport ends at row 15 → top-level node 7 of 10 → within threshold of 5
      expect(shouldPrefetch(rows, 15, 10, 5)).toBe(true);
    });

    it('should return false when viewport is far from end', () => {
      const rows: FlattenedTreeRow[] = [];
      for (let i = 0; i < 20; i++) {
        rows.push(makeFlatRow(`node-${i}`, 0));
        rows.push(makeFlatRow(`node-${i}-child`, 1));
      }
      // Viewport ends at row 5 → top-level node 2 of 20 → well within margin
      expect(shouldPrefetch(rows, 5, 20, 5)).toBe(false);
    });

    it('should return false for empty rows', () => {
      expect(shouldPrefetch([], 0, 0, 5)).toBe(false);
    });

    it('should return true when all data fits in viewport', () => {
      const rows = [makeFlatRow('a', 0), makeFlatRow('a-1', 1)];
      // Only 1 top-level, viewport at end
      expect(shouldPrefetch(rows, 1, 1, 5)).toBe(true);
    });
  });
});
