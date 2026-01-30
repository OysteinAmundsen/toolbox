import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../../lib/core/grid';
import { createGrid, type DataGridElement } from '../../public';

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function waitUpgrade(grid: DataGridElement): Promise<void> {
  await customElements.whenDefined('tbw-grid');
  if ('ready' in grid && typeof grid.ready === 'function') {
    await grid.ready();
  }
}

describe('Loading State', () => {
  let grid: DataGridElement<{ id: string; name: string }>;

  beforeEach(async () => {
    grid = createGrid<{ id: string; name: string }>({
      columns: [
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name' },
      ],
      getRowId: (row) => row.id,
    });
    grid.rows = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];
    document.body.appendChild(grid);
    await waitUpgrade(grid);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Grid-level loading', () => {
    it('should set loading property', () => {
      expect(grid.loading).toBe(false);
      grid.loading = true;
      expect(grid.loading).toBe(true);
    });

    it('should toggle loading attribute when property changes', () => {
      expect(grid.hasAttribute('loading')).toBe(false);

      grid.loading = true;
      expect(grid.hasAttribute('loading')).toBe(true);

      grid.loading = false;
      expect(grid.hasAttribute('loading')).toBe(false);
    });

    it('should set loading via HTML attribute', async () => {
      grid.setAttribute('loading', '');
      await nextFrame();
      expect(grid.loading).toBe(true);
    });

    it('should show loading overlay when loading is true', async () => {
      grid.loading = true;
      await nextFrame();

      const overlay = grid.querySelector('.tbw-loading-overlay');
      expect(overlay).toBeTruthy();
      expect(overlay?.getAttribute('role')).toBe('status');
    });

    it('should remove loading overlay when loading becomes false', async () => {
      grid.loading = true;
      await nextFrame();
      expect(grid.querySelector('.tbw-loading-overlay')).toBeTruthy();

      grid.loading = false;
      await nextFrame();
      expect(grid.querySelector('.tbw-loading-overlay')).toBeNull();
    });

    it('should render default spinner in overlay', async () => {
      grid.loading = true;
      await nextFrame();

      const spinner = grid.querySelector('.tbw-spinner');
      expect(spinner).toBeTruthy();
      expect(spinner?.classList.contains('tbw-spinner--large')).toBe(true);
    });

    it('should use custom loadingRenderer when provided', async () => {
      grid.gridConfig = {
        ...grid.gridConfig,
        loadingRenderer: (ctx) => {
          const el = document.createElement('div');
          el.className = 'custom-loader';
          el.textContent = `Loading (${ctx.size})...`;
          return el;
        },
      };
      await grid.ready();

      grid.loading = true;
      await nextFrame();

      const customLoader = grid.querySelector('.custom-loader');
      expect(customLoader).toBeTruthy();
      expect(customLoader?.textContent).toBe('Loading (large)...');
    });

    it('should accept HTML string from loadingRenderer', async () => {
      grid.gridConfig = {
        ...grid.gridConfig,
        loadingRenderer: () => '<span class="html-loader">Please wait</span>',
      };
      await grid.ready();

      grid.loading = true;
      await nextFrame();

      const loader = grid.querySelector('.html-loader');
      expect(loader).toBeTruthy();
      expect(loader?.textContent).toBe('Please wait');
    });
  });

  describe('Row-level loading', () => {
    it('should track row loading state', () => {
      expect(grid.isRowLoading?.('1')).toBe(false);

      grid.setRowLoading?.('1', true);
      expect(grid.isRowLoading?.('1')).toBe(true);

      grid.setRowLoading?.('1', false);
      expect(grid.isRowLoading?.('1')).toBe(false);
    });

    it('should add loading class to row element', async () => {
      grid.setRowLoading?.('1', true);
      await nextFrame();

      const rows = grid.querySelectorAll('.data-grid-row');
      const firstRow = rows[0];
      expect(firstRow?.classList.contains('tbw-row-loading')).toBe(true);
    });

    it('should set aria-busy on loading row', async () => {
      grid.setRowLoading?.('1', true);
      await nextFrame();

      const rows = grid.querySelectorAll('.data-grid-row');
      expect(rows[0]?.getAttribute('aria-busy')).toBe('true');
    });

    it('should handle multiple rows loading simultaneously', () => {
      grid.setRowLoading?.('1', true);
      grid.setRowLoading?.('2', true);

      expect(grid.isRowLoading?.('1')).toBe(true);
      expect(grid.isRowLoading?.('2')).toBe(true);

      grid.setRowLoading?.('1', false);
      expect(grid.isRowLoading?.('1')).toBe(false);
      expect(grid.isRowLoading?.('2')).toBe(true);
    });
  });

  describe('Cell-level loading', () => {
    it('should track cell loading state', () => {
      expect(grid.isCellLoading?.('1', 'name')).toBe(false);

      grid.setCellLoading?.('1', 'name', true);
      expect(grid.isCellLoading?.('1', 'name')).toBe(true);

      grid.setCellLoading?.('1', 'name', false);
      expect(grid.isCellLoading?.('1', 'name')).toBe(false);
    });

    it('should add loading class to cell element', async () => {
      grid.setCellLoading?.('1', 'name', true);
      await nextFrame();

      // Find the name cell (second column, first row)
      const rows = grid.querySelectorAll('.data-grid-row');
      const nameCell = rows[0]?.children[1];
      expect(nameCell?.classList.contains('tbw-cell-loading')).toBe(true);
    });

    it('should handle multiple cells loading in same row', () => {
      grid.setCellLoading?.('1', 'id', true);
      grid.setCellLoading?.('1', 'name', true);

      expect(grid.isCellLoading?.('1', 'id')).toBe(true);
      expect(grid.isCellLoading?.('1', 'name')).toBe(true);

      grid.setCellLoading?.('1', 'id', false);
      expect(grid.isCellLoading?.('1', 'id')).toBe(false);
      expect(grid.isCellLoading?.('1', 'name')).toBe(true);
    });

    it('should handle cells loading across different rows', () => {
      grid.setCellLoading?.('1', 'name', true);
      grid.setCellLoading?.('2', 'name', true);

      expect(grid.isCellLoading?.('1', 'name')).toBe(true);
      expect(grid.isCellLoading?.('2', 'name')).toBe(true);
    });
  });

  describe('clearAllLoading', () => {
    it('should clear grid loading state', () => {
      grid.loading = true;
      grid.clearAllLoading?.();
      expect(grid.loading).toBe(false);
    });

    it('should clear all row loading states', () => {
      grid.setRowLoading?.('1', true);
      grid.setRowLoading?.('2', true);

      grid.clearAllLoading?.();

      expect(grid.isRowLoading?.('1')).toBe(false);
      expect(grid.isRowLoading?.('2')).toBe(false);
    });

    it('should clear all cell loading states', () => {
      grid.setCellLoading?.('1', 'name', true);
      grid.setCellLoading?.('2', 'id', true);

      grid.clearAllLoading?.();

      expect(grid.isCellLoading?.('1', 'name')).toBe(false);
      expect(grid.isCellLoading?.('2', 'id')).toBe(false);
    });

    it('should clear overlay from DOM', async () => {
      grid.loading = true;
      await nextFrame();
      expect(grid.querySelector('.tbw-loading-overlay')).toBeTruthy();

      grid.clearAllLoading?.();
      await nextFrame();
      expect(grid.querySelector('.tbw-loading-overlay')).toBeNull();
    });
  });

  describe('Loading with no matching row', () => {
    it('should not throw when setting loading on non-existent row', () => {
      expect(() => {
        grid.setRowLoading?.('nonexistent', true);
      }).not.toThrow();
    });

    it('should return false for non-existent row loading state', () => {
      expect(grid.isRowLoading?.('nonexistent')).toBe(false);
    });

    it('should not throw when setting loading on non-existent cell', () => {
      expect(() => {
        grid.setCellLoading?.('nonexistent', 'name', true);
        grid.setCellLoading?.('1', 'nonexistent', true);
      }).not.toThrow();
    });

    it('should return false for non-existent cell loading state', () => {
      expect(grid.isCellLoading?.('nonexistent', 'name')).toBe(false);
      expect(grid.isCellLoading?.('1', 'nonexistent')).toBe(false);
    });
  });
});
