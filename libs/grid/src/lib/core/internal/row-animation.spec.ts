import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RowAnimationType } from '../types';
import { animateRow, animateRowById, animateRowElement, animateRows } from './row-animation';

describe('row-animation', () => {
  let rowEl: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    rowEl = document.createElement('div');
    rowEl.className = 'data-grid-row';
    document.body.appendChild(rowEl);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('animateRowElement', () => {
    it('should set data-animating attribute with animation type', () => {
      animateRowElement(rowEl, 'change');
      expect(rowEl.getAttribute('data-animating')).toBe('change');
    });

    it('should remove attribute after animation duration', () => {
      animateRowElement(rowEl, 'change');
      expect(rowEl.getAttribute('data-animating')).toBe('change');

      // Fast-forward past the default 'change' duration (500ms)
      vi.advanceTimersByTime(500);

      expect(rowEl.hasAttribute('data-animating')).toBe(false);
    });

    it('should call onComplete callback when animation ends', () => {
      const onComplete = vi.fn();
      animateRowElement(rowEl, 'insert', onComplete);

      // Fast-forward past the default 'insert' duration (300ms)
      vi.advanceTimersByTime(300);

      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('should handle all animation types', () => {
      const typesAndDurations: [RowAnimationType, number, boolean][] = [
        ['change', 500, false], // attribute removed after animation
        ['insert', 300, false], // attribute removed after animation
        ['remove', 200, true], // attribute kept for forwards fill-mode
      ];

      for (const [type, duration, shouldKeepAttr] of typesAndDurations) {
        rowEl.removeAttribute('data-animating'); // reset between iterations
        animateRowElement(rowEl, type);
        expect(rowEl.getAttribute('data-animating')).toBe(type);

        vi.advanceTimersByTime(duration);
        expect(rowEl.hasAttribute('data-animating')).toBe(shouldKeepAttr);
      }
    });

    it('should clear previous animation before starting new one', () => {
      animateRowElement(rowEl, 'change');
      expect(rowEl.getAttribute('data-animating')).toBe('change');

      animateRowElement(rowEl, 'insert');
      expect(rowEl.getAttribute('data-animating')).toBe('insert');
    });
  });

  describe('animateRow', () => {
    it('should return false if row not found', () => {
      const grid: any = {
        findRenderedRowElement: () => null,
      };

      const result = animateRow(grid, 5, 'change');
      expect(result).toBe(false);
    });

    it('should animate row element when found', () => {
      const grid: any = {
        findRenderedRowElement: (index: number) => (index === 3 ? rowEl : null),
      };

      const result = animateRow(grid, 3, 'change');

      expect(result).toBe(true);
      expect(rowEl.getAttribute('data-animating')).toBe('change');
    });

    it('should return false for negative indices', () => {
      const grid: any = {
        findRenderedRowElement: vi.fn(() => rowEl),
      };

      const result = animateRow(grid, -1, 'change');
      expect(result).toBe(false);
      // Should not even call findRenderedRowElement for invalid index
      expect(grid.findRenderedRowElement).not.toHaveBeenCalled();
    });
  });

  describe('animateRows', () => {
    it('should animate multiple rows and return count', () => {
      const rows = [document.createElement('div'), document.createElement('div'), document.createElement('div')];

      const grid: any = {
        findRenderedRowElement: (index: number) => rows[index] ?? null,
      };

      const result = animateRows(grid, [0, 1, 2], 'insert');

      expect(result).toBe(3);
      expect(rows[0].getAttribute('data-animating')).toBe('insert');
      expect(rows[1].getAttribute('data-animating')).toBe('insert');
      expect(rows[2].getAttribute('data-animating')).toBe('insert');
    });

    it('should handle partial matches', () => {
      const grid: any = {
        findRenderedRowElement: (index: number) => (index === 1 ? rowEl : null),
      };

      const result = animateRows(grid, [0, 1, 2], 'change');

      expect(result).toBe(1);
      expect(rowEl.getAttribute('data-animating')).toBe('change');
    });

    it('should handle empty array', () => {
      const grid: any = {
        findRenderedRowElement: vi.fn(),
      };

      const result = animateRows(grid, [], 'change');

      expect(result).toBe(0);
      expect(grid.findRenderedRowElement).not.toHaveBeenCalled();
    });
  });

  describe('animateRowById', () => {
    it('should return false if getRowId not configured', () => {
      const grid: any = {
        _rows: [{ id: '1' }],
        getRowId: undefined,
      };

      const result = animateRowById(grid, '1', 'change');
      expect(result).toBe(false);
    });

    it('should return false if row not found', () => {
      const grid: any = {
        _rows: [{ id: '1' }, { id: '2' }],
        getRowId: (row: any) => row.id,
        findRenderedRowElement: () => null,
      };

      const result = animateRowById(grid, 'nonexistent', 'change');
      expect(result).toBe(false);
    });

    it('should animate row when found by ID', () => {
      const grid: any = {
        _rows: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        getRowId: (row: any) => row.id,
        findRenderedRowElement: (index: number) => (index === 1 ? rowEl : null),
      };

      const result = animateRowById(grid, 'b', 'insert');

      expect(result).toBe(true);
      expect(rowEl.getAttribute('data-animating')).toBe('insert');
    });

    it('should handle empty rows array', () => {
      const grid: any = {
        _rows: [],
        getRowId: (row: any) => row.id,
        findRenderedRowElement: vi.fn(),
      };

      const result = animateRowById(grid, '1', 'change');

      expect(result).toBe(false);
      expect(grid.findRenderedRowElement).not.toHaveBeenCalled();
    });

    it('should handle undefined _rows', () => {
      const grid: any = {
        _rows: undefined,
        getRowId: (row: any) => row.id,
        findRenderedRowElement: vi.fn(),
      };

      const result = animateRowById(grid, '1', 'change');

      expect(result).toBe(false);
    });
  });
});
