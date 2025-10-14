import { describe, it, expect } from 'vitest';
import { handleRowClick, selectAll, computeSelectionDiff } from './row-selection';
import type { SelectionState } from './types';

describe('row-selection', () => {
  describe('handleRowClick', () => {
    describe('single mode', () => {
      it('should select clicked row and clear others', () => {
        const state: SelectionState = {
          selected: new Set([0, 2]),
          lastSelected: 0,
          anchor: 0,
        };

        const result = handleRowClick(state, 1, 'single', {
          shiftKey: false,
          ctrlKey: false,
          metaKey: false,
        });

        expect(result.selected.size).toBe(1);
        expect(result.selected.has(1)).toBe(true);
        expect(result.lastSelected).toBe(1);
        expect(result.anchor).toBe(1);
      });

      it('should ignore shift key in single mode', () => {
        const state: SelectionState = {
          selected: new Set([0]),
          lastSelected: 0,
          anchor: 0,
        };

        const result = handleRowClick(state, 3, 'single', {
          shiftKey: true,
          ctrlKey: false,
          metaKey: false,
        });

        expect(result.selected.size).toBe(1);
        expect(result.selected.has(3)).toBe(true);
      });

      it('should ignore ctrl key in single mode', () => {
        const state: SelectionState = {
          selected: new Set([0]),
          lastSelected: 0,
          anchor: 0,
        };

        const result = handleRowClick(state, 2, 'single', {
          shiftKey: false,
          ctrlKey: true,
          metaKey: false,
        });

        expect(result.selected.size).toBe(1);
        expect(result.selected.has(2)).toBe(true);
      });

      it('should select first row from empty state', () => {
        const state: SelectionState = {
          selected: new Set(),
          lastSelected: null,
          anchor: null,
        };

        const result = handleRowClick(state, 0, 'single', {
          shiftKey: false,
          ctrlKey: false,
          metaKey: false,
        });

        expect(result.selected.size).toBe(1);
        expect(result.selected.has(0)).toBe(true);
        expect(result.anchor).toBe(0);
      });
    });

    describe('multiple mode', () => {
      describe('plain click', () => {
        it('should clear selection and select only clicked row', () => {
          const state: SelectionState = {
            selected: new Set([0, 1, 2]),
            lastSelected: 2,
            anchor: 0,
          };

          const result = handleRowClick(state, 5, 'multiple', {
            shiftKey: false,
            ctrlKey: false,
            metaKey: false,
          });

          expect(result.selected.size).toBe(1);
          expect(result.selected.has(5)).toBe(true);
          expect(result.anchor).toBe(5);
        });
      });

      describe('ctrl/cmd click', () => {
        it('should add to selection with ctrl key', () => {
          const state: SelectionState = {
            selected: new Set([0]),
            lastSelected: 0,
            anchor: 0,
          };

          const result = handleRowClick(state, 2, 'multiple', {
            shiftKey: false,
            ctrlKey: true,
            metaKey: false,
          });

          expect(result.selected.size).toBe(2);
          expect(result.selected.has(0)).toBe(true);
          expect(result.selected.has(2)).toBe(true);
          expect(result.anchor).toBe(2);
        });

        it('should add to selection with meta key', () => {
          const state: SelectionState = {
            selected: new Set([0]),
            lastSelected: 0,
            anchor: 0,
          };

          const result = handleRowClick(state, 2, 'multiple', {
            shiftKey: false,
            ctrlKey: false,
            metaKey: true,
          });

          expect(result.selected.size).toBe(2);
          expect(result.selected.has(0)).toBe(true);
          expect(result.selected.has(2)).toBe(true);
        });

        it('should toggle off already selected row with ctrl', () => {
          const state: SelectionState = {
            selected: new Set([0, 2, 4]),
            lastSelected: 4,
            anchor: 0,
          };

          const result = handleRowClick(state, 2, 'multiple', {
            shiftKey: false,
            ctrlKey: true,
            metaKey: false,
          });

          expect(result.selected.size).toBe(2);
          expect(result.selected.has(0)).toBe(true);
          expect(result.selected.has(2)).toBe(false);
          expect(result.selected.has(4)).toBe(true);
        });

        it('should update anchor on ctrl click', () => {
          const state: SelectionState = {
            selected: new Set([0]),
            lastSelected: 0,
            anchor: 0,
          };

          const result = handleRowClick(state, 5, 'multiple', {
            shiftKey: false,
            ctrlKey: true,
            metaKey: false,
          });

          expect(result.anchor).toBe(5);
        });
      });

      describe('shift click (range selection)', () => {
        it('should select range from anchor to clicked row (forward)', () => {
          const state: SelectionState = {
            selected: new Set([2]),
            lastSelected: 2,
            anchor: 2,
          };

          const result = handleRowClick(state, 5, 'multiple', {
            shiftKey: true,
            ctrlKey: false,
            metaKey: false,
          });

          expect(result.selected.size).toBe(4);
          expect([...result.selected].sort((a, b) => a - b)).toEqual([2, 3, 4, 5]);
        });

        it('should select range from anchor to clicked row (backward)', () => {
          const state: SelectionState = {
            selected: new Set([5]),
            lastSelected: 5,
            anchor: 5,
          };

          const result = handleRowClick(state, 2, 'multiple', {
            shiftKey: true,
            ctrlKey: false,
            metaKey: false,
          });

          expect(result.selected.size).toBe(4);
          expect([...result.selected].sort((a, b) => a - b)).toEqual([2, 3, 4, 5]);
        });

        it('should keep anchor when shift-clicking', () => {
          const state: SelectionState = {
            selected: new Set([2]),
            lastSelected: 2,
            anchor: 2,
          };

          const result = handleRowClick(state, 5, 'multiple', {
            shiftKey: true,
            ctrlKey: false,
            metaKey: false,
          });

          // anchor should remain unchanged for subsequent shift-clicks
          expect(result.anchor).toBe(2);
        });

        it('should add to existing selection with shift click', () => {
          const state: SelectionState = {
            selected: new Set([0, 10]),
            lastSelected: 10,
            anchor: 5,
          };

          const result = handleRowClick(state, 7, 'multiple', {
            shiftKey: true,
            ctrlKey: false,
            metaKey: false,
          });

          // Should include original selections plus range 5-7
          expect(result.selected.has(0)).toBe(true);
          expect(result.selected.has(10)).toBe(true);
          expect(result.selected.has(5)).toBe(true);
          expect(result.selected.has(6)).toBe(true);
          expect(result.selected.has(7)).toBe(true);
        });

        it('should behave as plain click when anchor is null', () => {
          const state: SelectionState = {
            selected: new Set([0, 1]),
            lastSelected: 1,
            anchor: null,
          };

          const result = handleRowClick(state, 5, 'multiple', {
            shiftKey: true,
            ctrlKey: false,
            metaKey: false,
          });

          // Without anchor, shift-click behaves as plain click (clears and selects)
          expect(result.selected.size).toBe(1);
          expect(result.selected.has(5)).toBe(true);
          expect(result.anchor).toBe(5);
        });
      });
    });

    describe('none mode', () => {
      it('should not modify selection in none mode', () => {
        const state: SelectionState = {
          selected: new Set([0]),
          lastSelected: 0,
          anchor: 0,
        };

        const result = handleRowClick(state, 1, 'none', {
          shiftKey: false,
          ctrlKey: false,
          metaKey: false,
        });

        // None mode returns unmodified copy
        expect(result.selected.size).toBe(1);
        expect(result.selected.has(0)).toBe(true);
        expect(result.lastSelected).toBe(1);
      });
    });

    describe('edge cases', () => {
      it('should handle selecting same row twice in single mode', () => {
        const state: SelectionState = {
          selected: new Set([0]),
          lastSelected: 0,
          anchor: 0,
        };

        const result = handleRowClick(state, 0, 'single', {
          shiftKey: false,
          ctrlKey: false,
          metaKey: false,
        });

        expect(result.selected.size).toBe(1);
        expect(result.selected.has(0)).toBe(true);
      });

      it('should handle row index 0', () => {
        const state: SelectionState = {
          selected: new Set(),
          lastSelected: null,
          anchor: null,
        };

        const result = handleRowClick(state, 0, 'multiple', {
          shiftKey: false,
          ctrlKey: false,
          metaKey: false,
        });

        expect(result.selected.has(0)).toBe(true);
        expect(result.anchor).toBe(0);
      });

      it('should handle large row indices', () => {
        const state: SelectionState = {
          selected: new Set(),
          lastSelected: null,
          anchor: null,
        };

        const result = handleRowClick(state, 999999, 'single', {
          shiftKey: false,
          ctrlKey: false,
          metaKey: false,
        });

        expect(result.selected.has(999999)).toBe(true);
      });
    });
  });

  describe('selectAll', () => {
    it('should create set with all row indices', () => {
      const result = selectAll(5);

      expect(result.size).toBe(5);
      expect([...result].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
    });

    it('should return empty set for 0 rows', () => {
      const result = selectAll(0);

      expect(result.size).toBe(0);
    });

    it('should handle single row', () => {
      const result = selectAll(1);

      expect(result.size).toBe(1);
      expect(result.has(0)).toBe(true);
    });

    it('should handle large row count efficiently', () => {
      const start = performance.now();
      const result = selectAll(10000);
      const elapsed = performance.now() - start;

      expect(result.size).toBe(10000);
      expect(elapsed).toBeLessThan(100); // Should complete well under 100ms
    });
  });

  describe('computeSelectionDiff', () => {
    it('should identify added rows', () => {
      const oldSelected = new Set([0, 1]);
      const newSelected = new Set([0, 1, 2, 3]);

      const result = computeSelectionDiff(oldSelected, newSelected);

      expect(result.added.sort((a, b) => a - b)).toEqual([2, 3]);
      expect(result.removed).toEqual([]);
    });

    it('should identify removed rows', () => {
      const oldSelected = new Set([0, 1, 2, 3]);
      const newSelected = new Set([0, 1]);

      const result = computeSelectionDiff(oldSelected, newSelected);

      expect(result.added).toEqual([]);
      expect(result.removed.sort((a, b) => a - b)).toEqual([2, 3]);
    });

    it('should identify both added and removed rows', () => {
      const oldSelected = new Set([0, 1, 2]);
      const newSelected = new Set([2, 3, 4]);

      const result = computeSelectionDiff(oldSelected, newSelected);

      expect(result.added.sort((a, b) => a - b)).toEqual([3, 4]);
      expect(result.removed.sort((a, b) => a - b)).toEqual([0, 1]);
    });

    it('should return empty arrays when selections are equal', () => {
      const oldSelected = new Set([0, 1, 2]);
      const newSelected = new Set([0, 1, 2]);

      const result = computeSelectionDiff(oldSelected, newSelected);

      expect(result.added).toEqual([]);
      expect(result.removed).toEqual([]);
    });

    it('should handle empty old selection', () => {
      const oldSelected = new Set<number>();
      const newSelected = new Set([0, 1, 2]);

      const result = computeSelectionDiff(oldSelected, newSelected);

      expect(result.added.sort((a, b) => a - b)).toEqual([0, 1, 2]);
      expect(result.removed).toEqual([]);
    });

    it('should handle empty new selection', () => {
      const oldSelected = new Set([0, 1, 2]);
      const newSelected = new Set<number>();

      const result = computeSelectionDiff(oldSelected, newSelected);

      expect(result.added).toEqual([]);
      expect(result.removed.sort((a, b) => a - b)).toEqual([0, 1, 2]);
    });

    it('should handle both empty selections', () => {
      const oldSelected = new Set<number>();
      const newSelected = new Set<number>();

      const result = computeSelectionDiff(oldSelected, newSelected);

      expect(result.added).toEqual([]);
      expect(result.removed).toEqual([]);
    });

    it('should compute diff efficiently for large sets', () => {
      const oldSelected = new Set<number>();
      const newSelected = new Set<number>();

      for (let i = 0; i < 10000; i++) {
        if (i % 2 === 0) oldSelected.add(i);
        if (i % 2 === 1) newSelected.add(i);
      }

      const start = performance.now();
      const result = computeSelectionDiff(oldSelected, newSelected);
      const elapsed = performance.now() - start;

      expect(result.added.length).toBe(5000);
      expect(result.removed.length).toBe(5000);
      expect(elapsed).toBeLessThan(100); // Should complete well under 100ms
    });
  });

  describe('performance', () => {
    it('should handle 10K row selection operations in <1ms', () => {
      const state: SelectionState = {
        selected: new Set(),
        lastSelected: null,
        anchor: null,
      };

      // Measure time for 100 selection operations
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        handleRowClick(state, i % 10000, 'multiple', {
          shiftKey: false,
          ctrlKey: true,
          metaKey: false,
        });
      }
      const elapsed = performance.now() - start;
      const avgTime = elapsed / 100;

      expect(avgTime).toBeLessThan(1); // Average <1ms per operation
    });

    it('should handle range selection of 10K rows efficiently', () => {
      const state: SelectionState = {
        selected: new Set([0]),
        lastSelected: 0,
        anchor: 0,
      };

      const start = performance.now();
      const result = handleRowClick(state, 9999, 'multiple', {
        shiftKey: true,
        ctrlKey: false,
        metaKey: false,
      });
      const elapsed = performance.now() - start;

      expect(result.selected.size).toBe(10000);
      expect(elapsed).toBeLessThan(100); // Should complete well under 100ms
    });
  });
});
