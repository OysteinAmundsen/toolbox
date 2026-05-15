import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid, queryGrid } from '../../public';
import { DataGridElement } from './grid';

describe('DataGridElement', () => {
  beforeEach(() => {
    // Ensure custom element is defined
    if (!customElements.get('tbw-grid')) {
      customElements.define('tbw-grid', DataGridElement);
    }
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should create an tbw-grid element', () => {
    const grid = document.createElement('tbw-grid') as DataGridElement;
    expect(grid).toBeInstanceOf(DataGridElement);
  });

  it('should return null for shadowRoot (no Shadow DOM)', () => {
    const grid = document.createElement('tbw-grid') as DataGridElement;
    document.body.appendChild(grid);
    // Grid uses light DOM, so shadowRoot should be null
    expect(grid.shadowRoot).toBeNull();
  });

  it('should resolve ready() promise when connected', async () => {
    const grid = document.createElement('tbw-grid') as DataGridElement;
    document.body.appendChild(grid);
    await expect(grid.ready()).resolves.toBeUndefined();
  });

  describe('createGrid', () => {
    it('should create a tbw-grid element', () => {
      const grid = createGrid();
      expect(grid.tagName.toLowerCase()).toBe('tbw-grid');
    });

    it('should return a typed DataGridElement', () => {
      interface TestRow {
        id: number;
        name: string;
      }
      const grid = createGrid<TestRow>();

      // TypeScript should allow setting rows without casting
      expect(() => {
        grid.rows = [{ id: 1, name: 'Test' }];
      }).not.toThrow();
    });

    it('should apply initial config when provided', async () => {
      const grid = createGrid({
        columns: [{ field: 'name', header: 'Name' }],
        fitMode: 'fill',
      });
      document.body.appendChild(grid);
      await grid.ready();

      const config = grid.gridConfig;
      expect(config.columns).toHaveLength(1);
      expect(config.fitMode).toBe('fill');
    });

    it('should create grid without config', () => {
      const grid = createGrid();
      expect(grid.gridConfig).toBeDefined();
    });
  });

  describe('queryGrid', () => {
    it('should return null when grid not found', () => {
      const grid = queryGrid('#nonexistent');
      expect(grid).toBeNull();
    });

    it('should find grid by selector', () => {
      const created = createGrid();
      created.id = 'test-grid';
      document.body.appendChild(created);

      const found = queryGrid('#test-grid');
      expect(found).toBe(created);
    });

    it('should return typed DataGridElement', () => {
      interface Employee {
        name: string;
        salary: number;
      }

      const created = createGrid<Employee>();
      created.id = 'employee-grid';
      document.body.appendChild(created);

      const found = queryGrid<Employee>('#employee-grid');
      expect(found).toBe(created);
      expect(found?.tagName.toLowerCase()).toBe('tbw-grid');
    });

    it('should search within parent element', () => {
      const container = document.createElement('div');
      const grid = createGrid();
      grid.id = 'nested-grid';
      container.appendChild(grid);
      document.body.appendChild(container);

      // Should not find when searching wrong parent
      const notFound = queryGrid('#nested-grid', document.createElement('div'));
      expect(notFound).toBeNull();

      // Should find when searching correct parent
      const found = queryGrid('#nested-grid', container);
      expect(found).toBe(grid);
    });

    it('should return a promise when awaitUpgrade is true', async () => {
      const created = createGrid();
      created.id = 'await-grid';
      document.body.appendChild(created);

      const result = queryGrid('#await-grid', true);
      expect(result).toBeInstanceOf(Promise);

      const found = await result;
      expect(found).toBe(created);
    });

    it('should resolve to null when element not found with awaitUpgrade', async () => {
      const found = await queryGrid('#nonexistent', true);
      expect(found).toBeNull();
    });

    it('should return a promise when parent + awaitUpgrade are provided', async () => {
      const container = document.createElement('div');
      const grid = createGrid();
      grid.id = 'parent-await-grid';
      container.appendChild(grid);
      document.body.appendChild(container);

      const result = queryGrid('#parent-await-grid', container, true);
      expect(result).toBeInstanceOf(Promise);

      const found = await result;
      expect(found).toBe(grid);
    });

    it('should resolve to null with wrong parent and awaitUpgrade', async () => {
      const container = document.createElement('div');
      const grid = createGrid();
      grid.id = 'wrong-parent-await';
      container.appendChild(grid);
      document.body.appendChild(container);

      const found = await queryGrid('#wrong-parent-await', document.createElement('div'), true);
      expect(found).toBeNull();
    });
  });

  describe('rows setter', () => {
    it('should coerce undefined to empty array (regression: ServerSidePlugin crash)', async () => {
      const grid = createGrid();
      document.body.appendChild(grid);
      await grid.ready();

      // Frameworks may sync `grid.rows = undefined` when caller did not provide rows.
      // This previously crashed in _emitDataChange (Cannot read properties of undefined).
      expect(() => {
        (grid as { rows: unknown }).rows = undefined;
      }).not.toThrow();
      expect(grid.rows).toEqual([]);
      expect(grid.sourceRows).toEqual([]);
    });

    it('should coerce null to empty array', async () => {
      const grid = createGrid();
      document.body.appendChild(grid);
      await grid.ready();

      expect(() => {
        (grid as { rows: unknown }).rows = null;
      }).not.toThrow();
      expect(grid.sourceRows).toEqual([]);
    });
  });

  // #region _clearRowPool batching (#330)

  describe('_clearRowPool batching', () => {
    /**
     * Verifies that `_clearRowPool` brackets the per-cell `releaseCell`
     * loop in `adapter.beginBatch` / `endBatch`. Without this, framework
     * adapters that synchronously commit teardown per cell (React's
     * `flushSync`) emit one warning per cell during full rebuilds.
     */
    it('wraps releases in adapter.beginBatch / endBatch', () => {
      const calls: string[] = [];
      const grid = document.createElement('tbw-grid') as DataGridElement;
      document.body.appendChild(grid);
      grid._bodyEl = document.createElement('div') as HTMLElement;

      // Manually populate the row pool with rows whose cells contain
      // adapter-managed children so `releaseCell` is invoked.
      const rowEl = document.createElement('div');
      for (let i = 0; i < 3; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.innerHTML = '<div class="react-cell-renderer"></div>';
        rowEl.appendChild(cell);
      }
      grid._rowPool = [rowEl];

      grid.__frameworkAdapter = {
        canHandle: () => false,
        createRenderer: () => () => null,
        createEditor: () => () => document.createElement('input'),
        releaseCell: () => calls.push('release'),
        beginBatch: () => calls.push('begin'),
        endBatch: () => calls.push('end'),
      };

      grid._clearRowPool();

      expect(calls[0]).toBe('begin');
      expect(calls[calls.length - 1]).toBe('end');
      expect(calls.filter((c) => c === 'release').length).toBe(3);
      expect(calls.filter((c) => c === 'begin').length).toBe(1);
      expect(calls.filter((c) => c === 'end').length).toBe(1);
      expect(grid._rowPool.length).toBe(0);
    });

    it('still calls endBatch in finally when releaseCell throws', () => {
      const order: string[] = [];
      const grid = document.createElement('tbw-grid') as DataGridElement;
      document.body.appendChild(grid);
      grid._bodyEl = document.createElement('div') as HTMLElement;

      const rowEl = document.createElement('div');
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.innerHTML = '<div class="react-cell-renderer"></div>';
      rowEl.appendChild(cell);
      grid._rowPool = [rowEl];

      grid.__frameworkAdapter = {
        canHandle: () => false,
        createRenderer: () => () => null,
        createEditor: () => () => document.createElement('input'),
        releaseCell: () => {
          order.push('release');
          throw new Error('boom');
        },
        beginBatch: () => order.push('begin'),
        endBatch: () => order.push('end'),
      };

      expect(() => grid._clearRowPool()).toThrow('boom');
      expect(order[0]).toBe('begin');
      expect(order[order.length - 1]).toBe('end');
    });
  });

  // #endregion
});
