/**
 * Pivot Row Rendering Unit Tests
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ColumnConfig } from '../../core/types';
import {
  renderPivotGrandTotalRow,
  renderPivotGroupRow,
  renderPivotLeafRow,
  type PivotRowData,
  type RowRenderContext,
} from './pivot-rows';

describe('pivot-rows', () => {
  let rowEl: HTMLElement;

  beforeEach(() => {
    rowEl = document.createElement('div');
    document.body.appendChild(rowEl);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('renderPivotGroupRow', () => {
    const createContext = (overrides: Partial<RowRenderContext> = {}): RowRenderContext => ({
      columns: [
        { field: 'label', header: 'Label' },
        { field: 'value', header: 'Value' },
        { field: 'count', header: 'Count' },
      ] as ColumnConfig[],
      rowIndex: 0,
      onToggle: vi.fn(),
      resolveIcon: vi.fn((key) => (key === 'expand' ? '▶' : '▼')),
      setIcon: vi.fn((el, icon) => {
        el.textContent = String(icon);
      }),
      ...overrides,
    });

    it('should render a group row with correct classes and attributes', () => {
      const row: PivotRowData = {
        __pivotRowKey: 'group-1',
        __pivotLabel: 'Category A',
        __pivotDepth: 1,
        __pivotExpanded: true,
        __pivotHasChildren: true,
        __pivotRowCount: 5,
      };

      const ctx = createContext();
      const result = renderPivotGroupRow(row, rowEl, ctx);

      expect(result).toBe(true);
      expect(rowEl.className).toBe('data-grid-row pivot-group-row');
      expect(rowEl.getAttribute('data-pivot-depth')).toBe('1');
      expect(rowEl.getAttribute('data-pivot-key')).toBe('group-1');
      expect(rowEl.getAttribute('role')).toBe('row');
    });

    it('should render cells for each column', () => {
      const row: PivotRowData = {
        __pivotRowKey: 'group-1',
        __pivotLabel: 'Category A',
        __pivotDepth: 0,
        __pivotExpanded: true,
        __pivotRowCount: 3,
        value: 100,
        count: 42,
      };

      const ctx = createContext();
      renderPivotGroupRow(row, rowEl, ctx);

      const cells = rowEl.querySelectorAll('.cell');
      expect(cells).toHaveLength(3);
      expect(cells[0].getAttribute('data-col')).toBe('0');
      expect(cells[1].getAttribute('data-col')).toBe('1');
      expect(cells[2].getAttribute('data-col')).toBe('2');
    });

    it('should render toggle button in first column', () => {
      const row: PivotRowData = {
        __pivotRowKey: 'group-1',
        __pivotLabel: 'Test Group',
        __pivotExpanded: false,
        __pivotRowCount: 10,
      };

      const ctx = createContext();
      renderPivotGroupRow(row, rowEl, ctx);

      const toggleBtn = rowEl.querySelector('.pivot-toggle') as HTMLButtonElement;
      expect(toggleBtn).not.toBeNull();
      expect(toggleBtn.type).toBe('button');
      expect(toggleBtn.getAttribute('aria-label')).toBe('Expand group');
    });

    it('should call onToggle when toggle button is clicked', () => {
      const onToggle = vi.fn();
      const row: PivotRowData = {
        __pivotRowKey: 'test-key',
        __pivotLabel: 'Test',
        __pivotRowCount: 1,
      };

      const ctx = createContext({ onToggle });
      renderPivotGroupRow(row, rowEl, ctx);

      const toggleBtn = rowEl.querySelector('.pivot-toggle') as HTMLButtonElement;
      const event = new MouseEvent('click', { bubbles: true });
      vi.spyOn(event, 'stopPropagation');
      toggleBtn.dispatchEvent(event);

      expect(onToggle).toHaveBeenCalledWith('test-key');
      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('should render collapse icon when expanded', () => {
      const row: PivotRowData = {
        __pivotRowKey: 'group-1',
        __pivotLabel: 'Expanded Group',
        __pivotExpanded: true,
        __pivotRowCount: 5,
      };

      const ctx = createContext();
      renderPivotGroupRow(row, rowEl, ctx);

      expect(ctx.resolveIcon).toHaveBeenCalledWith('collapse');
    });

    it('should render expand icon when collapsed', () => {
      const row: PivotRowData = {
        __pivotRowKey: 'group-1',
        __pivotLabel: 'Collapsed Group',
        __pivotExpanded: false,
        __pivotRowCount: 5,
      };

      const ctx = createContext();
      renderPivotGroupRow(row, rowEl, ctx);

      expect(ctx.resolveIcon).toHaveBeenCalledWith('expand');
    });

    it('should render label and count in first column', () => {
      const row: PivotRowData = {
        __pivotRowKey: 'group-1',
        __pivotLabel: 'My Category',
        __pivotRowCount: 42,
      };

      const ctx = createContext();
      renderPivotGroupRow(row, rowEl, ctx);

      const label = rowEl.querySelector('.pivot-label');
      const count = rowEl.querySelector('.pivot-count');

      expect(label?.textContent).toBe('My Category');
      expect(count?.textContent).toBe(' (42)');
    });

    it('should apply indent based on __pivotIndent', () => {
      const row: PivotRowData = {
        __pivotRowKey: 'group-1',
        __pivotLabel: 'Indented',
        __pivotIndent: 40,
        __pivotRowCount: 1,
      };

      const ctx = createContext();
      renderPivotGroupRow(row, rowEl, ctx);

      const firstCell = rowEl.querySelector('.cell') as HTMLElement;
      expect(firstCell.style.paddingLeft).toBe('40px');
    });

    it('should render values in non-first columns', () => {
      const row: PivotRowData = {
        __pivotRowKey: 'group-1',
        __pivotLabel: 'Group',
        __pivotRowCount: 1,
        value: 999,
        count: 123,
      };

      const ctx = createContext();
      renderPivotGroupRow(row, rowEl, ctx);

      const cells = rowEl.querySelectorAll('.cell');
      expect(cells[1].textContent).toBe('999');
      expect(cells[2].textContent).toBe('123');
    });

    it('should handle null/undefined values in columns', () => {
      const row: PivotRowData = {
        __pivotRowKey: 'group-1',
        __pivotLabel: 'Group',
        __pivotRowCount: 1,
        value: null,
        count: undefined,
      };

      const ctx = createContext();
      renderPivotGroupRow(row, rowEl, ctx);

      const cells = rowEl.querySelectorAll('.cell');
      expect(cells[1].textContent).toBe('');
      expect(cells[2].textContent).toBe('');
    });

    it('should handle missing pivot metadata with defaults', () => {
      const row: PivotRowData = {};

      const ctx = createContext();
      renderPivotGroupRow(row, rowEl, ctx);

      expect(rowEl.getAttribute('data-pivot-depth')).toBe('0');
      expect(rowEl.getAttribute('data-pivot-key')).toBe('');

      const label = rowEl.querySelector('.pivot-label');
      const count = rowEl.querySelector('.pivot-count');
      expect(label?.textContent).toBe('');
      expect(count?.textContent).toBe(' (0)');
    });
  });

  describe('renderPivotLeafRow', () => {
    const columns: ColumnConfig[] = [
      { field: 'name', header: 'Name' },
      { field: 'amount', header: 'Amount' },
    ];

    it('should render a leaf row with correct classes and attributes', () => {
      const row: PivotRowData = {
        __pivotRowKey: 'leaf-1',
        __pivotLabel: 'Item A',
        __pivotDepth: 2,
      };

      const result = renderPivotLeafRow(row, rowEl, columns, 0);

      expect(result).toBe(true);
      expect(rowEl.className).toBe('data-grid-row pivot-leaf-row');
      expect(rowEl.getAttribute('data-pivot-depth')).toBe('2');
      expect(rowEl.getAttribute('data-pivot-key')).toBe('leaf-1');
    });

    it('should render cells for each column', () => {
      const row: PivotRowData = {
        __pivotRowKey: 'leaf-1',
        __pivotLabel: 'Item',
        name: 'Product A',
        amount: 50,
      };

      renderPivotLeafRow(row, rowEl, columns, 0);

      const cells = rowEl.querySelectorAll('.cell');
      expect(cells).toHaveLength(2);
      expect(cells[0].getAttribute('role')).toBe('gridcell');
      expect(cells[1].getAttribute('role')).toBe('gridcell');
    });

    it('should render label in first column with extra indent', () => {
      const row: PivotRowData = {
        __pivotRowKey: 'leaf-1',
        __pivotLabel: 'Leaf Item',
        __pivotIndent: 40,
      };

      renderPivotLeafRow(row, rowEl, columns, 0);

      const firstCell = rowEl.querySelector('.cell') as HTMLElement;
      // Extra 20px for toggle button alignment
      expect(firstCell.style.paddingLeft).toBe('60px');

      const label = firstCell.querySelector('.pivot-label');
      expect(label?.textContent).toBe('Leaf Item');
    });

    it('should render values in non-first columns', () => {
      const row: PivotRowData = {
        __pivotRowKey: 'leaf-1',
        __pivotLabel: 'Item',
        name: 'Product B',
        amount: 75.5,
      };

      renderPivotLeafRow(row, rowEl, columns, 0);

      const cells = rowEl.querySelectorAll('.cell');
      expect(cells[1].textContent).toBe('75.5');
    });

    it('should handle null/undefined values', () => {
      const row: PivotRowData = {
        __pivotRowKey: 'leaf-1',
        __pivotLabel: 'Item',
        name: null,
        amount: undefined,
      };

      renderPivotLeafRow(row, rowEl, columns, 0);

      const cells = rowEl.querySelectorAll('.cell');
      expect(cells[1].textContent).toBe('');
    });

    it('should handle missing metadata with defaults', () => {
      const row: PivotRowData = {};

      renderPivotLeafRow(row, rowEl, columns, 0);

      expect(rowEl.getAttribute('data-pivot-depth')).toBe('0');
      expect(rowEl.getAttribute('data-pivot-key')).toBe('');
    });
  });

  describe('renderPivotGrandTotalRow', () => {
    const columns: ColumnConfig[] = [
      { field: 'label', header: 'Label' },
      { field: 'total', header: 'Total' },
      { field: 'avg', header: 'Average' },
    ];

    it('should render grand total row with correct classes and attributes', () => {
      const row: PivotRowData = {
        __pivotIsGrandTotal: true,
        total: 1000,
        avg: 25,
      };

      const result = renderPivotGrandTotalRow(row, rowEl, columns);

      expect(result).toBe(true);
      expect(rowEl.className).toBe('pivot-grand-total-row');
      expect(rowEl.getAttribute('role')).toBe('presentation');
    });

    it('should render "Grand Total" label in first column', () => {
      const row: PivotRowData = {
        __pivotIsGrandTotal: true,
      };

      renderPivotGrandTotalRow(row, rowEl, columns);

      const firstCell = rowEl.querySelector('.cell');
      const label = firstCell?.querySelector('.pivot-label');
      expect(label?.textContent).toBe('Grand Total');
    });

    it('should render totals in other columns', () => {
      const row: PivotRowData = {
        __pivotIsGrandTotal: true,
        total: 5000,
        avg: 125.5,
      };

      renderPivotGrandTotalRow(row, rowEl, columns);

      const cells = rowEl.querySelectorAll('.cell');
      expect(cells[1].textContent).toBe('5000');
      expect(cells[2].textContent).toBe('125.5');
    });

    it('should handle null/undefined values', () => {
      const row: PivotRowData = {
        __pivotIsGrandTotal: true,
        total: null,
        avg: undefined,
      };

      renderPivotGrandTotalRow(row, rowEl, columns);

      const cells = rowEl.querySelectorAll('.cell');
      expect(cells[1].textContent).toBe('');
      expect(cells[2].textContent).toBe('');
    });

    it('should clear existing content before rendering', () => {
      rowEl.innerHTML = '<div>Old content</div>';

      const row: PivotRowData = {
        __pivotIsGrandTotal: true,
      };

      renderPivotGrandTotalRow(row, rowEl, columns);

      expect(rowEl.querySelector('div:not(.cell)')).toBeNull();
    });
  });
});
