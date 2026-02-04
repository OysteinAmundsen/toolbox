/**
 * Tests for type-level renderer and editor defaults.
 *
 * Tests the resolution priority:
 * 1. Column-level (highest priority)
 * 2. Grid-level typeDefaults
 * 3. App-level (framework adapter getTypeDefault)
 * 4. Built-in
 * 5. Fallback (plain text)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../lib/core/grid';
import type { ColumnConfig, FrameworkAdapter, GridConfig } from '../../lib/core/types';
import { EditingPlugin } from '../../lib/plugins/editing';

interface TestRow {
  id: number;
  name: string;
  country: string;
  status: string;
  price: number;
}

const testData: TestRow[] = [
  { id: 1, name: 'Alice', country: 'US', status: 'active', price: 100 },
  { id: 2, name: 'Bob', country: 'UK', status: 'pending', price: 200 },
];

async function waitForUpgraded(el: HTMLElement, timeout = 5000) {
  const start = Date.now();
  while (!el.hasAttribute('data-upgraded')) {
    if (Date.now() - start > timeout) throw new Error('upgrade timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

describe('Type Defaults - Renderer Resolution', () => {
  let grid: HTMLElement & { gridConfig: GridConfig<TestRow>; rows: TestRow[] };

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('uses column-level renderer over type default', async () => {
    grid = document.createElement('tbw-grid') as any;
    document.body.appendChild(grid);

    const columnRenderer = vi.fn((ctx) => {
      const span = document.createElement('span');
      span.className = 'column-renderer';
      span.textContent = ctx.value;
      return span;
    });

    const typeRenderer = vi.fn((ctx) => {
      const span = document.createElement('span');
      span.className = 'type-renderer';
      span.textContent = ctx.value;
      return span;
    });

    grid.gridConfig = {
      columns: [{ field: 'name' }, { field: 'country', type: 'country' as any, renderer: columnRenderer }],
      typeDefaults: {
        country: { renderer: typeRenderer },
      },
    };
    grid.rows = testData;

    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);

    // Column-level renderer should be called, not type-level
    expect(columnRenderer).toHaveBeenCalled();
    expect(typeRenderer).not.toHaveBeenCalled();

    // Verify the DOM has the column renderer's output (use .cell to target data cells, not header)
    const cell = grid.querySelector('.cell[data-field="country"] .column-renderer');
    expect(cell).toBeTruthy();
  }, 20000);

  it('uses grid-level typeDefaults when column has no renderer', async () => {
    grid = document.createElement('tbw-grid') as any;
    document.body.appendChild(grid);

    const typeRenderer = vi.fn((ctx) => {
      const span = document.createElement('span');
      span.className = 'type-renderer';
      span.textContent = `🏳️ ${ctx.value}`;
      return span;
    });

    grid.gridConfig = {
      columns: [{ field: 'name' }, { field: 'country', type: 'country' as any }],
      typeDefaults: {
        country: { renderer: typeRenderer },
      },
    };
    grid.rows = testData;

    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);

    // Type-level renderer should be called
    expect(typeRenderer).toHaveBeenCalled();

    // Verify the DOM has the type renderer's output (use .cell to target data cells)
    const cell = grid.querySelector('.cell[data-field="country"] .type-renderer');
    expect(cell).toBeTruthy();
    expect(cell!.textContent).toContain('🏳️');
  }, 20000);

  it('uses built-in renderer when no custom renderer is defined', async () => {
    grid = document.createElement('tbw-grid') as any;
    document.body.appendChild(grid);

    grid.gridConfig = {
      columns: [{ field: 'name' }, { field: 'status', type: 'boolean' as any }],
      typeDefaults: {}, // Empty - no type defaults
    };
    // Override status to be a boolean for this test
    grid.rows = [{ id: 1, name: 'Alice', country: 'US', status: true as any, price: 100 }];

    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);

    // Built-in boolean renderer should create checkbox
    const checkbox = grid.querySelector('[data-field="status"] [role="checkbox"]');
    expect(checkbox).toBeTruthy();
  }, 20000);

  it('overrides built-in boolean renderer with grid-level typeDefaults', async () => {
    grid = document.createElement('tbw-grid') as any;
    document.body.appendChild(grid);

    const customBooleanRenderer = vi.fn((ctx) => {
      const span = document.createElement('span');
      span.className = 'custom-boolean-renderer';
      span.textContent = ctx.value ? '✓ Yes' : '✗ No';
      return span;
    });

    grid.gridConfig = {
      columns: [{ field: 'name' }, { field: 'active', type: 'boolean' }],
      typeDefaults: {
        boolean: { renderer: customBooleanRenderer },
      },
    };
    grid.rows = [
      { id: 1, name: 'Alice', country: 'US', status: 'active', price: 100, active: true } as any,
      { id: 2, name: 'Bob', country: 'UK', status: 'pending', price: 200, active: false } as any,
    ];

    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);

    // Custom boolean renderer should be called instead of built-in
    expect(customBooleanRenderer).toHaveBeenCalled();

    // Verify the DOM has the custom renderer's output (NOT the built-in checkbox)
    const customCell = grid.querySelector('.custom-boolean-renderer');
    expect(customCell).toBeTruthy();
    expect(customCell?.textContent).toContain('Yes');

    // Should NOT have the built-in checkbox
    const checkbox = grid.querySelector('[data-field="active"] [role="checkbox"]');
    expect(checkbox).toBeFalsy();
  }, 20000);

  it('overrides built-in boolean renderer when columns and gridConfig are separate props', async () => {
    grid = document.createElement('tbw-grid') as any;
    document.body.appendChild(grid);

    const customBooleanRenderer = vi.fn((ctx) => {
      const span = document.createElement('span');
      span.className = 'custom-boolean-renderer';
      span.textContent = ctx.value ? '✓ Yes' : '✗ No';
      return span;
    });

    // Simulating how cargo-tracker-apps passes props:
    // - columns as separate property
    // - gridConfig with only typeDefaults
    grid.gridConfig = {
      typeDefaults: {
        boolean: { renderer: customBooleanRenderer },
      },
    };
    (grid as any).columns = [
      { field: 'name' },
      { field: 'available', header: 'Available', type: 'boolean', width: 75 },
    ];
    grid.rows = [{ id: 1, name: 'Alice', available: true } as any, { id: 2, name: 'Bob', available: false } as any];

    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);

    // Custom boolean renderer should be called instead of built-in
    expect(customBooleanRenderer).toHaveBeenCalled();

    // Verify the DOM has the custom renderer's output
    const customCell = grid.querySelector('.custom-boolean-renderer');
    expect(customCell).toBeTruthy();

    // Should NOT have the built-in checkbox
    const checkbox = grid.querySelector('[data-field="available"] [role="checkbox"]');
    expect(checkbox).toBeFalsy();
  }, 20000);

  it('uses plain text fallback for custom type without renderer', async () => {
    grid = document.createElement('tbw-grid') as any;
    document.body.appendChild(grid);

    grid.gridConfig = {
      columns: [{ field: 'name' }, { field: 'country', type: 'unknown-custom-type' as any }],
      typeDefaults: {}, // No type defaults for 'unknown-custom-type'
    };
    grid.rows = testData;

    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);

    // Should render as plain text (use role="gridcell" to target data cells, not headers)
    const cell = grid.querySelector('[role="gridcell"][data-field="country"]');
    expect(cell?.textContent?.trim()).toBe('US');
  }, 20000);

  it('supports multiple custom types with different renderers', async () => {
    grid = document.createElement('tbw-grid') as any;
    document.body.appendChild(grid);

    const countryRenderer = vi.fn((ctx) => {
      const span = document.createElement('span');
      span.className = 'country-cell';
      span.textContent = `🌍 ${ctx.value}`;
      return span;
    });

    const statusRenderer = vi.fn((ctx) => {
      const span = document.createElement('span');
      span.className = 'status-badge';
      span.textContent = ctx.value.toUpperCase();
      return span;
    });

    grid.gridConfig = {
      columns: [
        { field: 'name' },
        { field: 'country', type: 'country' as any },
        { field: 'status', type: 'status' as any },
      ],
      typeDefaults: {
        country: { renderer: countryRenderer },
        status: { renderer: statusRenderer },
      },
    };
    grid.rows = testData;

    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);

    expect(countryRenderer).toHaveBeenCalled();
    expect(statusRenderer).toHaveBeenCalled();

    const countryCell = grid.querySelector('.country-cell');
    const statusCell = grid.querySelector('.status-badge');
    expect(countryCell?.textContent).toContain('🌍');
    expect(statusCell?.textContent).toBe('ACTIVE');
  }, 20000);
});

describe('Type Defaults - Editor Resolution', () => {
  let grid: HTMLElement & { gridConfig: GridConfig<TestRow>; rows: TestRow[] };

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('uses column-level editor over type default editor', async () => {
    grid = document.createElement('tbw-grid') as any;
    document.body.appendChild(grid);

    const columnEditor = vi.fn((ctx) => {
      const input = document.createElement('input');
      input.className = 'column-editor';
      input.value = ctx.value;
      return input;
    });

    const typeEditor = vi.fn((ctx) => {
      const input = document.createElement('input');
      input.className = 'type-editor';
      input.value = ctx.value;
      return input;
    });

    grid.gridConfig = {
      columns: [{ field: 'name' }, { field: 'country', type: 'country' as any, editable: true, editor: columnEditor }],
      typeDefaults: {
        country: { editor: typeEditor },
      },
      plugins: [new EditingPlugin({ editOn: 'click' })],
    };
    grid.rows = testData;

    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);

    // Simulate click to start editing (use role="gridcell" to target data cells)
    const cell = grid.querySelector('[role="gridcell"][data-field="country"]') as HTMLElement;
    expect(cell).toBeTruthy();
    cell?.click();
    await new Promise((r) => setTimeout(r, 100));

    // Column-level editor should be called
    expect(columnEditor).toHaveBeenCalled();
    expect(typeEditor).not.toHaveBeenCalled();

    const editor = grid.querySelector('.column-editor');
    expect(editor).toBeTruthy();
  }, 20000);

  it('uses grid-level typeDefaults editor when column has no editor', async () => {
    grid = document.createElement('tbw-grid') as any;
    document.body.appendChild(grid);

    const typeEditor = vi.fn((ctx) => {
      const select = document.createElement('select');
      select.className = 'type-editor';
      ['US', 'UK', 'CA'].forEach((code) => {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = code;
        opt.selected = code === ctx.value;
        select.appendChild(opt);
      });
      return select;
    });

    grid.gridConfig = {
      columns: [{ field: 'name' }, { field: 'country', type: 'country' as any, editable: true }],
      typeDefaults: {
        country: { editor: typeEditor },
      },
      plugins: [new EditingPlugin({ editOn: 'click' })],
    };
    grid.rows = testData;

    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);

    // Simulate click to start editing (use role="gridcell" to target data cells)
    const cell = grid.querySelector('[role="gridcell"][data-field="country"]') as HTMLElement;
    expect(cell).toBeTruthy();
    cell?.click();
    await new Promise((r) => setTimeout(r, 100));

    // Type-level editor should be called
    expect(typeEditor).toHaveBeenCalled();

    const editor = grid.querySelector('.type-editor');
    expect(editor).toBeTruthy();
    expect(editor?.tagName).toBe('SELECT');
  }, 20000);
});

describe('Type Defaults - editorParams Merging', () => {
  let grid: HTMLElement & { gridConfig: GridConfig<TestRow>; rows: TestRow[] };

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('merges type-level editorParams with column-level (column wins on conflict)', async () => {
    grid = document.createElement('tbw-grid') as any;
    document.body.appendChild(grid);

    grid.gridConfig = {
      columns: [
        { field: 'name' },
        {
          field: 'price',
          type: 'number',
          editable: true,
          editorParams: { max: 500 }, // Column-level overrides max
        },
      ],
      typeDefaults: {
        number: {
          editorParams: { min: 0, max: 1000, step: 0.01 }, // Type-level defaults
        },
      },
      plugins: [new EditingPlugin({ editOn: 'click' })],
    };
    grid.rows = testData;

    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);

    // Get the effective column config
    const config = await (grid as any).getConfig();
    const priceCol = config.columns.find((c: ColumnConfig) => c.field === 'price');

    // Should have merged: min=0 (from type), max=500 (column wins), step=0.01 (from type)
    expect(priceCol.editorParams).toEqual({
      min: 0,
      max: 500,
      step: 0.01,
    });
  }, 20000);

  it('uses type-level editorParams when column has none', async () => {
    grid = document.createElement('tbw-grid') as any;
    document.body.appendChild(grid);

    grid.gridConfig = {
      columns: [{ field: 'name' }, { field: 'price', type: 'number', editable: true }],
      typeDefaults: {
        number: {
          editorParams: { min: 0, max: 1000, step: 0.01 },
        },
      },
      plugins: [new EditingPlugin({ editOn: 'click' })],
    };
    grid.rows = testData;

    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);

    const config = await (grid as any).getConfig();
    const priceCol = config.columns.find((c: ColumnConfig) => c.field === 'price');

    // Should have type-level editorParams
    expect(priceCol.editorParams).toEqual({
      min: 0,
      max: 1000,
      step: 0.01,
    });
  }, 20000);
});

describe('Type Defaults - ColumnType Extension', () => {
  it('allows custom type strings while keeping IntelliSense for built-ins', () => {
    // This test verifies TypeScript accepts custom type strings
    // The actual type checking happens at compile time
    const columns: ColumnConfig<TestRow>[] = [
      { field: 'name', type: 'string' }, // Built-in
      { field: 'price', type: 'number' }, // Built-in
      { field: 'country', type: 'country' as any }, // Custom type
      { field: 'status', type: 'status' as any }, // Custom type
    ];

    expect(columns).toHaveLength(4);
    expect(columns[0].type).toBe('string');
    expect(columns[2].type).toBe('country');
  });
});

describe('Type Defaults - Framework Adapter Integration', () => {
  let grid: HTMLElement & { gridConfig: GridConfig<TestRow>; rows: TestRow[]; __frameworkAdapter?: FrameworkAdapter };

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('uses app-level registry from framework adapter when no grid-level default', async () => {
    grid = document.createElement('tbw-grid') as any;
    document.body.appendChild(grid);

    const adapterRenderer = vi.fn((ctx) => {
      const span = document.createElement('span');
      span.className = 'adapter-renderer';
      span.textContent = `[Adapter] ${ctx.value}`;
      return span;
    });

    // Mock framework adapter with getTypeDefault
    const mockAdapter: FrameworkAdapter = {
      canHandle: () => false,
      createRenderer: () => () => null,
      createEditor: () => () => document.createElement('input'),
      getTypeDefault: (type: string) => {
        if (type === 'country') {
          return { renderer: adapterRenderer };
        }
        return undefined;
      },
    };

    grid.gridConfig = {
      columns: [{ field: 'name' }, { field: 'country', type: 'country' as any }],
      // No typeDefaults - should fall through to adapter
    };
    grid.rows = testData;

    // Inject mock adapter before upgrade
    (grid as any).__frameworkAdapter = mockAdapter;

    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);

    // Adapter renderer should be called
    expect(adapterRenderer).toHaveBeenCalled();

    const cell = grid.querySelector('.adapter-renderer');
    expect(cell).toBeTruthy();
    expect(cell?.textContent).toContain('[Adapter]');
  }, 20000);

  it('grid-level typeDefaults take precedence over adapter', async () => {
    grid = document.createElement('tbw-grid') as any;
    document.body.appendChild(grid);

    const gridRenderer = vi.fn((ctx) => {
      const span = document.createElement('span');
      span.className = 'grid-renderer';
      span.textContent = `[Grid] ${ctx.value}`;
      return span;
    });

    const adapterRenderer = vi.fn((ctx) => {
      const span = document.createElement('span');
      span.className = 'adapter-renderer';
      span.textContent = `[Adapter] ${ctx.value}`;
      return span;
    });

    const mockAdapter: FrameworkAdapter = {
      canHandle: () => false,
      createRenderer: () => () => null,
      createEditor: () => () => document.createElement('input'),
      getTypeDefault: (type: string) => {
        if (type === 'country') {
          return { renderer: adapterRenderer };
        }
        return undefined;
      },
    };

    grid.gridConfig = {
      columns: [{ field: 'name' }, { field: 'country', type: 'country' as any }],
      typeDefaults: {
        country: { renderer: gridRenderer },
      },
    };
    grid.rows = testData;

    (grid as any).__frameworkAdapter = mockAdapter;

    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);

    // Grid-level renderer should be called, not adapter
    expect(gridRenderer).toHaveBeenCalled();
    expect(adapterRenderer).not.toHaveBeenCalled();

    const cell = grid.querySelector('.grid-renderer');
    expect(cell).toBeTruthy();
  }, 20000);
});
