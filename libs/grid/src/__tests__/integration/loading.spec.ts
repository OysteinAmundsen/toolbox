import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../lib/core/grid';
import { BaseGridPlugin } from '../../lib/core/plugin';
import { createGrid, type DataGridElement } from '../../public';
import { nextFrame, waitUpgrade } from '../../../test/helpers';

/** `ready()` only settles for the initial render, so later config changes need the render event. */
function nextRender(grid: HTMLElement): Promise<void> {
  return new Promise((resolve) => grid.addEventListener('render', () => resolve(), { once: true }));
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

    it('should toggle aria-busy on host when loading state changes', () => {
      expect(grid.hasAttribute('aria-busy')).toBe(false);

      grid.loading = true;
      expect(grid.getAttribute('aria-busy')).toBe('true');

      grid.loading = false;
      expect(grid.hasAttribute('aria-busy')).toBe(false);
    });

    it('should keep aria-busy="true" across overlapping loading=true assignments', () => {
      grid.loading = true;
      expect(grid.getAttribute('aria-busy')).toBe('true');

      // Second async caller starts while first is still in flight — aria-busy
      // must stay set, not toggle off and on.
      grid.loading = true;
      expect(grid.getAttribute('aria-busy')).toBe('true');

      // Only the final transition to false clears it.
      grid.loading = false;
      expect(grid.hasAttribute('aria-busy')).toBe(false);
    });

    it('should not clobber a plugin-driven aria-busy when grid loading is false', () => {
      // Plugins (e.g. FilteringPlugin async filterHandler) set aria-busy directly
      // on the grid host while the grid's own `loading` flag is unrelated. The
      // grid's `loading=false` setter clears aria-busy by design — document and
      // verify that the plugin owns the attribute lifecycle in that mode.
      expect(grid.hasAttribute('aria-busy')).toBe(false);

      // Plugin marks busy independently
      grid.setAttribute('aria-busy', 'true');
      expect(grid.getAttribute('aria-busy')).toBe('true');

      // Grid loading flag transitioning false → false is a no-op (#updateLoadingOverlay
      // is gated on wasLoading !== value) and must NOT remove the plugin's aria-busy.
      grid.loading = false;
      expect(grid.getAttribute('aria-busy')).toBe('true');

      // But explicitly cycling through loading=true→false WILL clear it. This is
      // expected: when the grid owns loading, it owns aria-busy. Plugins that set
      // aria-busy independently should not also expect the grid to coexist with
      // their value across grid.loading transitions.
      grid.loading = true;
      grid.loading = false;
      expect(grid.hasAttribute('aria-busy')).toBe(false);
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

    it('should render custom loading content and restore it after rows are rebuilt', async () => {
      const renderer = vi.fn((ctx: { size: 'large' | 'small' }) => {
        const el = document.createElement('span');
        el.className = 'custom-cell-loader';
        el.textContent = ctx.size;
        return el;
      });
      grid.gridConfig = { ...grid.gridConfig, loadingRenderer: renderer };
      await nextRender(grid);

      grid.setCellLoading('1', 'name', true);
      await nextFrame();

      let nameCell = grid.querySelector('.data-grid-row')?.children[1] as HTMLElement;
      expect(nameCell.querySelector('.custom-cell-loader')?.textContent).toBe('small');
      expect(renderer).toHaveBeenCalledWith({ size: 'small' });

      // Fresh row identities force a real cell rebuild, which discards the overlay and
      // makes the post-render replay re-invoke the renderer.
      grid.rows = grid.rows.map((row) => ({ ...row }));
      await nextRender(grid);

      nameCell = grid.querySelector('.data-grid-row')?.children[1] as HTMLElement;
      expect(nameCell.classList.contains('tbw-cell-loading')).toBe(true);
      expect(nameCell.querySelector('.custom-cell-loader')?.textContent).toBe('small');
      expect(renderer).toHaveBeenCalledTimes(2);
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

    it('should skip fields with no rendered cell on a plugin-rendered row', async () => {
      /** Stand-in for Responsive's `cardRenderer`: the row's children are no longer cells. */
      class CardRowPlugin extends BaseGridPlugin {
        readonly name = 'cardRowTest';
        override renderRow(_row: unknown, rowEl: HTMLElement): boolean {
          rowEl.replaceChildren();
          rowEl.className = 'data-grid-row card';
          const card = document.createElement('div');
          card.setAttribute('role', 'gridcell');
          rowEl.appendChild(card);
          return true;
        }
      }

      const cardGrid = createGrid<{ id: string; name: string }>({
        columns: [{ field: 'id' }, { field: 'name' }],
        getRowId: (row) => row.id,
        plugins: [new CardRowPlugin()],
      });
      cardGrid.rows = [{ id: '1', name: 'Alice' }];
      document.body.appendChild(cardGrid);
      await waitUpgrade(cardGrid);

      // Row loading appends an overlay, so `children[1]` is no longer column 1's cell.
      cardGrid.setRowLoading('1', true);
      cardGrid.setCellLoading('1', 'name', true);
      await nextFrame();

      const rowEl = cardGrid.querySelector('.data-grid-row') as HTMLElement;
      expect(rowEl.querySelector('.tbw-row-loading-overlay')).not.toBeNull();
      expect(rowEl.querySelector('.tbw-cell-loading')).toBeNull();
      expect(rowEl.querySelector('.tbw-cell-loading-overlay')).toBeNull();
      expect(rowEl.querySelector('[aria-busy="true"]')).toBeNull();
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
