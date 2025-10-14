import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  toggleDetailRow,
  expandDetailRow,
  collapseDetailRow,
  isDetailExpanded,
  createDetailElement,
} from './master-detail';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Tests use `any` for flexibility with test row data.

describe('masterDetail', () => {
  describe('toggleDetailRow', () => {
    it('should expand a collapsed row', () => {
      const expanded = new Set<number>();
      const result = toggleDetailRow(expanded, 0);

      expect(result.has(0)).toBe(true);
      expect(result.size).toBe(1);
    });

    it('should collapse an expanded row', () => {
      const expanded = new Set<number>([0]);
      const result = toggleDetailRow(expanded, 0);

      expect(result.has(0)).toBe(false);
      expect(result.size).toBe(0);
    });

    it('should toggle same row twice back to original state', () => {
      const expanded = new Set<number>();
      const afterExpand = toggleDetailRow(expanded, 2);
      const afterCollapse = toggleDetailRow(afterExpand, 2);

      expect(afterExpand.has(2)).toBe(true);
      expect(afterCollapse.has(2)).toBe(false);
    });

    it('should not mutate the original Set', () => {
      const expanded = new Set<number>([1, 2]);
      const result = toggleDetailRow(expanded, 3);

      expect(expanded.size).toBe(2);
      expect(result.size).toBe(3);
      expect(result).not.toBe(expanded);
    });

    it('should handle multiple expanded rows', () => {
      const expanded = new Set<number>([0, 2, 4]);
      const result = toggleDetailRow(expanded, 3);

      expect(result.has(0)).toBe(true);
      expect(result.has(2)).toBe(true);
      expect(result.has(3)).toBe(true);
      expect(result.has(4)).toBe(true);
      expect(result.size).toBe(4);
    });
  });

  describe('expandDetailRow', () => {
    it('should expand a row', () => {
      const expanded = new Set<number>();
      const result = expandDetailRow(expanded, 5);

      expect(result.has(5)).toBe(true);
    });

    it('should not duplicate already expanded row', () => {
      const expanded = new Set<number>([5]);
      const result = expandDetailRow(expanded, 5);

      expect(result.has(5)).toBe(true);
      expect(result.size).toBe(1);
    });

    it('should not mutate the original Set', () => {
      const expanded = new Set<number>();
      const result = expandDetailRow(expanded, 0);

      expect(expanded.size).toBe(0);
      expect(result.size).toBe(1);
    });
  });

  describe('collapseDetailRow', () => {
    it('should collapse an expanded row', () => {
      const expanded = new Set<number>([0, 1, 2]);
      const result = collapseDetailRow(expanded, 1);

      expect(result.has(0)).toBe(true);
      expect(result.has(1)).toBe(false);
      expect(result.has(2)).toBe(true);
      expect(result.size).toBe(2);
    });

    it('should handle collapsing non-existent row gracefully', () => {
      const expanded = new Set<number>([0, 1]);
      const result = collapseDetailRow(expanded, 99);

      expect(result.size).toBe(2);
      expect(result.has(0)).toBe(true);
      expect(result.has(1)).toBe(true);
    });

    it('should not mutate the original Set', () => {
      const expanded = new Set<number>([0]);
      const result = collapseDetailRow(expanded, 0);

      expect(expanded.size).toBe(1);
      expect(result.size).toBe(0);
    });
  });

  describe('isDetailExpanded', () => {
    it('should return true for expanded row', () => {
      const expanded = new Set<number>([0, 5, 10]);

      expect(isDetailExpanded(expanded, 0)).toBe(true);
      expect(isDetailExpanded(expanded, 5)).toBe(true);
      expect(isDetailExpanded(expanded, 10)).toBe(true);
    });

    it('should return false for collapsed row', () => {
      const expanded = new Set<number>([0, 5, 10]);

      expect(isDetailExpanded(expanded, 1)).toBe(false);
      expect(isDetailExpanded(expanded, 6)).toBe(false);
      expect(isDetailExpanded(expanded, 99)).toBe(false);
    });

    it('should return false for empty expanded set', () => {
      const expanded = new Set<number>();

      expect(isDetailExpanded(expanded, 0)).toBe(false);
    });
  });

  describe('createDetailElement', () => {
    beforeEach(() => {
      // Clean up any previous test artifacts
      document.body.innerHTML = '';
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should create a detail row element with string content', () => {
      const row = { id: 1, name: 'Test' };
      const renderer = () => '<p>Detail content</p>';

      const element = createDetailElement(row, 0, renderer, 3);

      expect(element.className).toBe('master-detail-row');
      expect(element.getAttribute('data-detail-for')).toBe('0');
      expect(element.getAttribute('role')).toBe('row');

      const cell = element.querySelector('.master-detail-cell');
      expect(cell).not.toBeNull();
      expect(cell?.getAttribute('role')).toBe('cell');
      expect(cell?.innerHTML).toBe('<p>Detail content</p>');
      expect(cell?.getAttribute('style')).toContain('grid-column: 1 / 4');
    });

    it('should create a detail row element with HTMLElement content', () => {
      const row = { id: 2, name: 'Test' };
      const renderer = (r: any) => {
        const div = document.createElement('div');
        div.textContent = `Name: ${r.name}`;
        div.className = 'custom-detail';
        return div;
      };

      const element = createDetailElement(row, 1, renderer, 5);

      const cell = element.querySelector('.master-detail-cell');
      expect(cell).not.toBeNull();

      const customDetail = cell?.querySelector('.custom-detail');
      expect(customDetail).not.toBeNull();
      expect(customDetail?.textContent).toBe('Name: Test');
      expect(cell?.getAttribute('style')).toContain('grid-column: 1 / 6');
    });

    it('should pass row and rowIndex to renderer', () => {
      const row = { id: 3, value: 42 };
      let receivedRow: any;
      let receivedIndex: number | undefined;

      const renderer = (r: any, idx: number) => {
        receivedRow = r;
        receivedIndex = idx;
        return 'content';
      };

      createDetailElement(row, 7, renderer, 2);

      expect(receivedRow).toBe(row);
      expect(receivedIndex).toBe(7);
    });

    it('should set correct grid column span based on column count', () => {
      const row = { id: 1 };
      const renderer = () => 'test';

      const element1 = createDetailElement(row, 0, renderer, 1);
      const element5 = createDetailElement(row, 0, renderer, 5);
      const element10 = createDetailElement(row, 0, renderer, 10);

      expect(element1.querySelector('.master-detail-cell')?.getAttribute('style')).toContain('grid-column: 1 / 2');
      expect(element5.querySelector('.master-detail-cell')?.getAttribute('style')).toContain('grid-column: 1 / 6');
      expect(element10.querySelector('.master-detail-cell')?.getAttribute('style')).toContain('grid-column: 1 / 11');
    });

    it('should handle empty string content', () => {
      const row = { id: 1 };
      const renderer = () => '';

      const element = createDetailElement(row, 0, renderer, 2);
      const cell = element.querySelector('.master-detail-cell');

      expect(cell?.innerHTML).toBe('');
    });

    it('should handle complex HTML string content', () => {
      const row = { id: 1, items: ['a', 'b', 'c'] };
      const renderer = (r: any) => `
        <ul>
          ${r.items.map((item: string) => `<li>${item}</li>`).join('')}
        </ul>
      `;

      const element = createDetailElement(row, 0, renderer, 3);
      const cell = element.querySelector('.master-detail-cell');
      const listItems = cell?.querySelectorAll('li');

      expect(listItems?.length).toBe(3);
    });
  });
});
