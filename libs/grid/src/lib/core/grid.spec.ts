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
  });
});
