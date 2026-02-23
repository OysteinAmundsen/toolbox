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
    it('should resolve false if row not found', async () => {
      const grid: any = {
        findRenderedRowElement: () => null,
      };

      const result = await animateRow(grid, 5, 'change');
      expect(result).toBe(false);
    });

    it('should animate row element and resolve true when found', async () => {
      const grid: any = {
        findRenderedRowElement: (index: number) => (index === 3 ? rowEl : null),
      };

      const promise = animateRow(grid, 3, 'change');

      expect(rowEl.getAttribute('data-animating')).toBe('change');

      // Advance past the default 'change' duration (500ms)
      vi.advanceTimersByTime(500);
      const result = await promise;
      expect(result).toBe(true);
    });

    it('should resolve false for negative indices', async () => {
      const grid: any = {
        findRenderedRowElement: vi.fn(() => rowEl),
      };

      const result = await animateRow(grid, -1, 'change');
      expect(result).toBe(false);
      // Should not even call findRenderedRowElement for invalid index
      expect(grid.findRenderedRowElement).not.toHaveBeenCalled();
    });
  });

  describe('animateRows', () => {
    it('should animate multiple rows and resolve with count', async () => {
      const rows = [document.createElement('div'), document.createElement('div'), document.createElement('div')];

      const grid: any = {
        findRenderedRowElement: (index: number) => rows[index] ?? null,
      };

      const promise = animateRows(grid, [0, 1, 2], 'insert');

      expect(rows[0].getAttribute('data-animating')).toBe('insert');
      expect(rows[1].getAttribute('data-animating')).toBe('insert');
      expect(rows[2].getAttribute('data-animating')).toBe('insert');

      vi.advanceTimersByTime(300);
      const result = await promise;
      expect(result).toBe(3);
    });

    it('should handle partial matches', async () => {
      const grid: any = {
        findRenderedRowElement: (index: number) => (index === 1 ? rowEl : null),
      };

      const promise = animateRows(grid, [0, 1, 2], 'change');

      expect(rowEl.getAttribute('data-animating')).toBe('change');

      vi.advanceTimersByTime(500);
      const result = await promise;
      expect(result).toBe(1);
    });

    it('should handle empty array', async () => {
      const grid: any = {
        findRenderedRowElement: vi.fn(),
      };

      const result = await animateRows(grid, [], 'change');

      expect(result).toBe(0);
      expect(grid.findRenderedRowElement).not.toHaveBeenCalled();
    });
  });

  describe('animateRowById', () => {
    it('should resolve false if getRowId not configured', async () => {
      const grid: any = {
        _rows: [{ id: '1' }],
        getRowId: undefined,
      };

      const result = await animateRowById(grid, '1', 'change');
      expect(result).toBe(false);
    });

    it('should resolve false if row not found', async () => {
      const grid: any = {
        _rows: [{ id: '1' }, { id: '2' }],
        getRowId: (row: any) => row.id,
        findRenderedRowElement: () => null,
      };

      const result = await animateRowById(grid, 'nonexistent', 'change');
      expect(result).toBe(false);
    });

    it('should animate row when found by ID', async () => {
      const grid: any = {
        _rows: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        getRowId: (row: any) => row.id,
        findRenderedRowElement: (index: number) => (index === 1 ? rowEl : null),
      };

      const promise = animateRowById(grid, 'b', 'insert');

      expect(rowEl.getAttribute('data-animating')).toBe('insert');

      vi.advanceTimersByTime(300);
      const result = await promise;
      expect(result).toBe(true);
    });

    it('should handle empty rows array', async () => {
      const grid: any = {
        _rows: [],
        getRowId: (row: any) => row.id,
        findRenderedRowElement: vi.fn(),
      };

      const result = await animateRowById(grid, '1', 'change');

      expect(result).toBe(false);
      expect(grid.findRenderedRowElement).not.toHaveBeenCalled();
    });

    it('should handle undefined _rows', async () => {
      const grid: any = {
        _rows: undefined,
        getRowId: (row: any) => row.id,
        findRenderedRowElement: vi.fn(),
      };

      const result = await animateRowById(grid, '1', 'change');

      expect(result).toBe(false);
    });
  });
});
