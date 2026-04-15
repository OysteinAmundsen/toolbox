import { describe, expect, it } from 'vitest';
import { countTopLevelNodes, getTopLevelNodeIndex } from './tree-datasource';
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
});
