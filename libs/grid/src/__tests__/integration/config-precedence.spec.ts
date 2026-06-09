import { describe, expect, it, vi } from 'vitest';
import '../../lib/core/grid';
import { FitModeEnum } from '../../lib/core/types';
import { EditingPlugin } from '../../lib/plugins/editing';
import { GroupingRowsPlugin } from '../../lib/plugins/grouping-rows';

async function waitForUpgraded(el: HTMLElement, timeout = 5000) {
  const start = Date.now();
  while (!el.hasAttribute('data-upgraded')) {
    if (Date.now() - start > timeout) throw new Error('upgrade timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
  // allow double rAF like other tests in suite
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

describe('config precedence', () => {
  it('prop fitMode overrides gridConfig.fitMode', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.innerHTML = '';
    document.body.appendChild(grid);
    grid.gridConfig = {
      fitMode: FitModeEnum.STRETCH,
      plugins: [new GroupingRowsPlugin({ groupOn: (r: any) => r.type })],
    };
    // Assign overriding props after base config
    grid.fitMode = 'fixed';
    grid.rows = [{ id: 1, type: 'a' }];
    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);
    const cfg = await grid.getConfig();
    expect(cfg.fitMode).toBe('fixed');
  }, 20000);

  it('columns prop wins over gridConfig.columns', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.innerHTML = '';
    document.body.appendChild(grid);
    grid.gridConfig = { columns: [{ field: 'a' }], fitMode: FitModeEnum.STRETCH };
    grid.columns = [{ field: 'b' }];
    grid.rows = [{ a: 1, b: 2 }];
    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);
    const cfg = await grid.getConfig();
    expect(cfg.columns.map((c: any) => c.field)).toEqual(['b']);
  }, 20000);
});

describe('columnInference: merge', () => {
  it('infers the full column set even when a column is declared (auto would show only the declared one)', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.innerHTML = '';
    document.body.appendChild(grid);
    grid.columnInference = 'merge';
    grid.columns = [{ field: 'salary', type: 'number', header: 'Salary (USD)' }];
    grid.rows = [{ id: 1, name: 'Alice', salary: 100 }];
    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);
    const cfg = await grid.getConfig();
    // All data fields appear in data-key order
    expect(cfg.columns.map((c: any) => c.field)).toEqual(['id', 'name', 'salary']);
    // Provided column overlays only its own field (config wins) and keeps position
    const salary = cfg.columns.find((c: any) => c.field === 'salary');
    expect(salary.header).toBe('Salary (USD)');
    expect(salary.type).toBe('number');
    // Inferred columns keep their derived header
    expect(cfg.columns.find((c: any) => c.field === 'name').header).toBe('Name');
  }, 20000);

  it('appends a provided column absent from the data as a computed column', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.innerHTML = '';
    document.body.appendChild(grid);
    grid.columnInference = 'merge';
    grid.columns = [{ field: 'actions', header: 'Actions' }];
    grid.rows = [{ id: 1, name: 'Alice' }];
    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);
    const cfg = await grid.getConfig();
    expect(cfg.columns.map((c: any) => c.field)).toEqual(['id', 'name', 'actions']);
  }, 20000);

  it('reads the mode from gridConfig and via the column-inference attribute', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.innerHTML = '';
    document.body.appendChild(grid);
    grid.setAttribute('column-inference', 'merge');
    grid.gridConfig = { columns: [{ field: 'salary', type: 'number' }] };
    grid.rows = [{ id: 1, name: 'Alice', salary: 100 }];
    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);
    const cfg = await grid.getConfig();
    expect(cfg.columns.map((c: any) => c.field)).toEqual(['id', 'name', 'salary']);
  }, 20000);

  it('auto mode (default) is unchanged — declaring a column shows only that column', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.innerHTML = '';
    document.body.appendChild(grid);
    grid.columns = [{ field: 'salary', type: 'number' }];
    grid.rows = [{ id: 1, name: 'Alice', salary: 100 }];
    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);
    const cfg = await grid.getConfig();
    expect(cfg.columns.map((c: any) => c.field)).toEqual(['salary']);
  }, 20000);
});

describe('HTML attribute configuration', () => {
  it('parses rows from JSON attribute', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.innerHTML = '';
    document.body.appendChild(grid);

    // Set rows via HTML attribute
    grid.setAttribute(
      'rows',
      JSON.stringify([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ]),
    );

    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);

    expect(grid.rows.length).toBe(2);
    expect(grid.rows[0].name).toBe('Alice');
    expect(grid.rows[1].name).toBe('Bob');
  }, 20000);

  it('parses columns from JSON attribute', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.innerHTML = '';
    document.body.appendChild(grid);

    grid.setAttribute(
      'columns',
      JSON.stringify([
        { field: 'id', header: 'ID', type: 'number' },
        { field: 'name', header: 'Name' },
      ]),
    );
    grid.rows = [{ id: 1, name: 'Test' }];

    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);

    const cfg = await grid.getConfig();
    expect(cfg.columns.length).toBe(2);
    expect(cfg.columns[0].field).toBe('id');
    expect(cfg.columns[0].type).toBe('number');
    expect(cfg.columns[1].field).toBe('name');
  }, 20000);

  it('parses fit-mode from string attribute', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.innerHTML = '';
    document.body.appendChild(grid);

    grid.setAttribute('fit-mode', 'fixed');
    grid.rows = [{ id: 1 }];

    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);

    expect(grid.fitMode).toBe('fixed');
  }, 20000);

  it('parses grid-config from JSON attribute', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.innerHTML = '';
    document.body.appendChild(grid);

    grid.setAttribute(
      'grid-config',
      JSON.stringify({
        fitMode: 'stretch',
        columns: [{ field: 'name', header: 'Full Name' }],
      }),
    );
    grid.rows = [{ name: 'Test' }];

    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);

    const cfg = await grid.getConfig();
    expect(cfg.fitMode).toBe('stretch');
    expect(cfg.columns[0].header).toBe('Full Name');
  }, 20000);

  it('property assignment takes precedence over attribute', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.innerHTML = '';
    document.body.appendChild(grid);

    // Set via attribute first
    grid.setAttribute('fit-mode', 'stretch');
    // Override via property
    grid.fitMode = 'fixed';
    grid.rows = [{ id: 1 }];

    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);

    expect(grid.fitMode).toBe('fixed');
  }, 20000);

  it('handles invalid JSON gracefully', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.innerHTML = '';
    document.body.appendChild(grid);

    // Invalid JSON should not throw, just warn
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    grid.setAttribute('rows', 'not valid json');

    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid JSON'));
    expect(grid.rows).toEqual([]);
    warnSpy.mockRestore();
  }, 20000);

  it('re-parses light DOM columns when gridConfig is set after initial render', async () => {
    // This simulates Angular's async content projection:
    // 1. Grid connects to DOM
    // 2. Grid does initial render (light DOM empty or incomplete)
    // 3. Angular projects <tbw-grid-column> elements
    // 4. Angular sets gridConfig
    // 5. Grid should re-parse light DOM and pick up columns with width/editable
    const grid: any = document.createElement('tbw-grid');
    document.body.innerHTML = '';
    document.body.appendChild(grid);

    // Wait for grid to initialize (simulates initial render before content projection)
    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);

    // Now simulate Angular projecting content into light DOM
    grid.innerHTML = `
      <tbw-grid-column field="id" header="ID" width="80" sortable></tbw-grid-column>
      <tbw-grid-column field="name" header="Name" width="150" editable></tbw-grid-column>
    `;

    // Simulate Angular setting gridConfig (which should trigger re-parse)
    // Include EditingPlugin since the light DOM uses editable attribute
    grid.gridConfig = { plugins: [new EditingPlugin()] };
    grid.rows = [{ id: 1, name: 'Test' }];

    // Wait for update
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const cfg = await grid.getConfig();

    // Columns should be parsed from light DOM with width and editable
    expect(cfg.columns.length).toBe(2);
    const idCol = cfg.columns.find((c: any) => c.field === 'id');
    const nameCol = cfg.columns.find((c: any) => c.field === 'name');

    expect(idCol).toBeDefined();
    expect(idCol.width).toBe(80);
    expect(idCol.sortable).toBe(true);

    expect(nameCol).toBeDefined();
    expect(nameCol.width).toBe(150);
    expect(nameCol.editable).toBe(true);
  }, 20000);
});
