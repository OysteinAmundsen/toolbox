import { describe, expect, it } from 'vitest';
import { mapViewportToRoots } from './tree-datasource';

describe('tree-datasource', () => {
  describe('mapViewportToRoots', () => {
    // a, a-1, a-2, b, b-1, c
    const owners = [0, 0, 0, 1, 1, 2];

    it('maps a viewport to the exclusive range of owning root nodes', () => {
      expect(mapViewportToRoots(owners, 3, 1, 4)).toEqual({ startNode: 0, endNode: 2, totalLoadedNodes: 3 });
    });

    it('maps a child row to its root', () => {
      expect(mapViewportToRoots(owners, 3, 4, 4)).toEqual({ startNode: 1, endNode: 2, totalLoadedNodes: 3 });
    });

    it('clamps indices beyond the rendered rows', () => {
      expect(mapViewportToRoots(owners, 3, 0, 100)).toEqual({ startNode: 0, endNode: 3, totalLoadedNodes: 3 });
    });

    it('attributes rows before the first root (e.g. a leading group header) to root 0', () => {
      expect(mapViewportToRoots([-1, 0, 0, 1], 2, 0, 0)).toEqual({ startNode: 0, endNode: 1, totalLoadedNodes: 2 });
    });
  });
});
