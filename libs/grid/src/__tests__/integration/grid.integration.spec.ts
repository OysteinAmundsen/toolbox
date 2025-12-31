import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../../lib/core/grid';
// Import plugins used by integration tests
import { GroupingColumnsPlugin } from '../../lib/plugins/grouping-columns';
import { GroupingRowsPlugin } from '../../lib/plugins/grouping-rows';
import { SelectionPlugin } from '../../lib/plugins/selection';

function nextFrame() {
  return new Promise((r) => requestAnimationFrame(r));
}

async function waitUpgrade(grid: any) {
  await customElements.whenDefined('tbw-grid');
  const start = Date.now();
  while (!grid.hasAttribute('data-upgraded')) {
    if (Date.now() - start > 3000) break;
    await new Promise((r) => setTimeout(r, 10));
  }
  if (grid.ready) {
    try {
      await grid.ready();
    } catch {
      /* empty */
    }
  }
  if (grid.forceLayout) {
    try {
      await grid.forceLayout();
    } catch {
      /* empty */
    }
  }
  await nextFrame();
}

describe('tbw-grid integration: inference, sorting, editing', () => {
  let grid: any;
  beforeEach(() => {
    document.body.innerHTML = '';
    grid = document.createElement('tbw-grid');
    document.body.appendChild(grid);
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('infers columns when none provided', async () => {
    grid.rows = [{ id: 1, name: 'A' }];
    await nextFrame();
    expect(grid._columns.length).toBe(2);
  });

  it('emits sort-change cycling states', async () => {
    grid.rows = [{ id: 2 }, { id: 1 }];
    grid.columns = [{ field: 'id', sortable: true }];
    await nextFrame();
    const header = grid.shadowRoot!.querySelector('.header-row .cell') as HTMLElement;
    const directions: number[] = [];
    grid.addEventListener('sort-change', (e: any) => directions.push(e.detail.direction));
    header.click();
    header.click();
    header.click();
    expect(directions).toEqual([1, -1, 0]);
  });

  it('row editing commit & revert (Escape)', async () => {
    grid.rows = [{ id: 1, name: 'Alpha' }];
    grid.columns = [{ field: 'id' }, { field: 'name', editable: true }];
    await nextFrame();
    const row = grid.shadowRoot!.querySelector('.data-grid-row') as HTMLElement;
    row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await nextFrame();
    const nameCell = row.querySelector('.cell[data-col="1"]') as HTMLElement;
    const input = nameCell.querySelector('input') as HTMLInputElement;
    input.value = 'Beta';
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(grid.rows[0].name).toBe('Alpha');
    expect(grid.changedRows.length).toBe(0);
  });
});

describe('tbw-grid integration: config-based row grouping', () => {
  let grid: any;
  beforeEach(() => {
    document.body.innerHTML = '';
    grid = document.createElement('tbw-grid');
    document.body.appendChild(grid);
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('does not render group rows without grouping-rows plugin enabled', async () => {
    grid.columns = [
      { field: 'dept', header: 'Dept' },
      { field: 'name', header: 'Name' },
    ];
    grid.rows = [
      { dept: 'A', name: 'One' },
      { dept: 'A', name: 'Two' },
      { dept: 'B', name: 'Three' },
    ];
    await waitUpgrade(grid);
    const groupRow = grid.shadowRoot.querySelector('.group-row');
    expect(groupRow).toBeFalsy();
    const dataRows = grid.shadowRoot.querySelectorAll('.data-grid-row');
    expect(dataRows.length).toBeGreaterThan(0);
  });

  it('renders group rows when grouping enabled', async () => {
    grid.columns = [
      { field: 'dept', header: 'Dept' },
      { field: 'name', header: 'Name' },
    ];
    grid.rows = [
      { dept: 'A', name: 'One' },
      { dept: 'A', name: 'Two' },
      { dept: 'B', name: 'Three' },
    ];
    grid.gridConfig = {
      plugins: [new GroupingRowsPlugin({ groupOn: (r: any) => r.dept })],
    };
    await waitUpgrade(grid);
    const groupRows = grid.shadowRoot.querySelectorAll('.group-row');
    expect(groupRows.length).toBe(2);
    const dataRowsInitial = grid.shadowRoot.querySelectorAll('.data-grid-row');
    expect(dataRowsInitial.length).toBe(0);
  });

  it('toggles group expansion state', async () => {
    grid.columns = [
      { field: 'dept', header: 'Dept' },
      { field: 'name', header: 'Name' },
    ];
    grid.rows = [
      { dept: 'A', name: 'One' },
      { dept: 'A', name: 'Two' },
      { dept: 'B', name: 'Three' },
    ];
    grid.gridConfig = {
      plugins: [new GroupingRowsPlugin({ groupOn: (r: any) => r.dept })],
    };
    await waitUpgrade(grid);
    const firstToggle = grid.shadowRoot.querySelector('.group-row .group-toggle') as HTMLButtonElement;
    firstToggle.click();
    await nextFrame();
    const dataRowsExpandedOnce = grid.shadowRoot.querySelectorAll('.data-grid-row');
    expect(dataRowsExpandedOnce.length).toBe(2);
    firstToggle.click();
    await nextFrame();
    const dataRowsAfterCollapse = grid.shadowRoot.querySelectorAll('.data-grid-row');
    expect(dataRowsAfterCollapse.length).toBe(0);
  });

  it('supports nested grouping paths', async () => {
    grid.columns = [
      { field: 'region', header: 'Region' },
      { field: 'country', header: 'Country' },
      { field: 'city', header: 'City' },
    ];
    grid.rows = [
      { region: 'EU', country: 'DE', city: 'Berlin' },
      { region: 'EU', country: 'DE', city: 'Munich' },
      { region: 'EU', country: 'FR', city: 'Paris' },
      { region: 'NA', country: 'US', city: 'Austin' },
    ];
    grid.gridConfig = {
      plugins: [new GroupingRowsPlugin({ groupOn: (r: any) => [r.region, r.country] })],
    };
    await waitUpgrade(grid);
    const topGroups = grid.shadowRoot.querySelectorAll('.group-row');
    expect(topGroups.length).toBe(2);
    const euToggle = (Array.from(topGroups) as HTMLElement[])
      .find((g) => g.textContent?.includes('EU'))!
      .querySelector('.group-toggle') as HTMLButtonElement;
    euToggle.click();
    await nextFrame();
    const allGroupRowsAfter = grid.shadowRoot.querySelectorAll('.group-row');
    expect(allGroupRowsAfter.length).toBe(4);
    const dataRowsNow = grid.shadowRoot.querySelectorAll('.data-grid-row');
    expect(dataRowsNow.length).toBe(0);
    const deGroup = (Array.from(allGroupRowsAfter) as HTMLElement[]).find((g) => g.textContent?.includes('DE'))!;
    (deGroup.querySelector('.group-toggle') as HTMLButtonElement).click();
    await nextFrame();
    const dataRowsAfterDE = grid.shadowRoot.querySelectorAll('.data-grid-row');
    expect(dataRowsAfterDE.length).toBe(2);
  });

  it('renders per-column aggregates in group rows when fullWidth: false', async () => {
    grid.columns = [
      { field: 'month', header: 'Month' },
      { field: 'cost', header: 'Cost', type: 'number' },
      { field: 'profit', header: 'Profit', type: 'number' },
    ];
    grid.rows = [
      { month: 'Jan', cost: 10, profit: 100 },
      { month: 'Jan', cost: 15, profit: 120 },
      { month: 'Feb', cost: 20, profit: 200 },
    ];
    grid.gridConfig = {
      plugins: [
        new GroupingRowsPlugin({
          groupOn: (r: any) => r.month,
          fullWidth: false,
          aggregators: {
            cost: 'sum',
            profit: 'sum',
          },
        }),
      ],
    };
    await waitUpgrade(grid);
    const groupRows = grid.shadowRoot.querySelectorAll('.group-row');
    expect(groupRows.length).toBe(2);
    // Check that Jan group row has per-column cells with aggregated values
    const janRow = (Array.from(groupRows) as HTMLElement[]).find((g) => g.textContent?.includes('Jan'))!;
    const cells = janRow.querySelectorAll('.group-cell');
    expect(cells.length).toBe(3); // 3 columns
    // First cell should have group label + toggle
    expect(cells[0].textContent).toContain('Jan');
    expect(cells[0].querySelector('.group-toggle')).toBeTruthy();
    // Cost cell: sum of 10 + 15 = 25
    expect(cells[1].textContent?.trim()).toBe('25');
    // Profit cell: sum of 100 + 120 = 220
    expect(cells[2].textContent?.trim()).toBe('220');
  });

  it('uses formatLabel for group row labels', async () => {
    grid.columns = [
      { field: 'date', header: 'Date' },
      { field: 'value', header: 'Value', type: 'number' },
    ];
    grid.rows = [
      { date: '2024-01-15', value: 10 },
      { date: '2024-01-20', value: 15 },
    ];
    grid.gridConfig = {
      plugins: [
        new GroupingRowsPlugin({
          groupOn: (r: any) => r.date.substring(0, 7), // Group by YYYY-MM
          formatLabel: (value: string) => {
            const [year, month] = value.split('-');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${months[parseInt(month, 10) - 1]} ${year}`;
          },
        }),
      ],
    };
    await waitUpgrade(grid);
    const groupRow = grid.shadowRoot.querySelector('.group-row');
    expect(groupRow.textContent).toContain('Jan 2024');
  });
});

describe('tbw-grid integration: column grouping / sticky', () => {
  let grid: any;
  beforeEach(async () => {
    document.body.innerHTML = '';
    grid = document.createElement('tbw-grid');
    document.body.appendChild(grid);
    grid.columns = [
      { field: 'id', header: 'ID', group: 'meta', sticky: 'left' },
      { field: 'name', header: 'Name', group: { id: 'meta', label: 'Meta Data' } },
      { field: 'status', header: 'Status' },
      { field: 'amount', header: 'Amount' },
    ];
    grid.rows = [
      { id: 1, name: 'Alpha', status: 'open', amount: 10 },
      { id: 2, name: 'Beta', status: 'open', amount: 5 },
      { id: 3, name: 'Gamma', status: 'closed', amount: 7 },
    ];
    grid.gridConfig = {
      plugins: [new GroupingColumnsPlugin()],
    };
    await waitUpgrade(grid);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders grouped header row', () => {
    const groupHeaders = (grid.shadowRoot as any).querySelectorAll('.header-group-cell');
    expect(groupHeaders.length).toBeGreaterThan(0);
  });

  it('renders data rows (no group rows in header-only grouping mode)', () => {
    const groupRow = (grid.shadowRoot as any).querySelector('.group-row');
    expect(groupRow).toBeFalsy();
    const dataRows = grid.shadowRoot.querySelectorAll('.data-grid-row');
    expect(dataRows.length).toBeGreaterThan(0);
  });

  it('applies sticky class to left column', () => {
    const stickyHeader = (grid.shadowRoot as any).querySelector('.header-row .cell.sticky-left');
    expect(stickyHeader).toBeTruthy();
  });
});

describe('tbw-grid integration: aria row/col indices', () => {
  it('applies correct aria-rowindex / aria-colindex values', async () => {
    const grid = document.createElement('tbw-grid') as any;
    grid.style.display = 'block';
    grid.style.height = '260px';
    grid.rows = [
      { id: 1, name: 'Alpha', score: 10 },
      { id: 2, name: 'Bravo', score: 20 },
      { id: 3, name: 'Charlie', score: 30 },
    ];
    grid.columns = [
      { field: 'id', header: 'ID', sortable: true },
      { field: 'name', header: 'Name' },
      { field: 'score', header: 'Score', type: 'number' },
    ];
    document.body.appendChild(grid);
    await waitUpgrade(grid);
    const shadow = grid.shadowRoot!;
    const headerRow = shadow.querySelector('.header-row') as HTMLElement;
    expect(headerRow.getAttribute('aria-rowindex')).toBe('1');
    const headerCells = Array.from(headerRow.querySelectorAll('.cell')) as HTMLElement[];
    headerCells.forEach((c, i) => expect(c.getAttribute('aria-colindex')).toBe(String(i + 1)));
    const dataRows = Array.from(shadow.querySelectorAll('.rows .data-grid-row')) as HTMLElement[];
    dataRows.forEach((r, i) => {
      expect(r.getAttribute('aria-rowindex')).toBe(String(i + 2));
      const cells = Array.from(r.querySelectorAll('.cell[data-col]')) as HTMLElement[];
      cells.forEach((c, ci) => expect(c.getAttribute('aria-colindex')).toBe(String(ci + 1)));
    });
    // aria-rowcount/colcount are on inner .rows-body (role=grid), not host element
    const innerGrid = shadow.querySelector('.rows-body');
    expect(innerGrid?.getAttribute('aria-rowcount')).toBe(String(grid.rows.length));
    expect(innerGrid?.getAttribute('aria-colcount')).toBe(String(grid.columns.length));
  });
});

describe('tbw-grid integration: public API & events', () => {
  it('exposes DGEvents and registers custom element', async () => {
    const mod = await import('../../index');
    expect(mod.DGEvents).toBeTruthy();
    expect(Object.keys(mod.DGEvents)).toEqual(expect.arrayContaining(['CELL_COMMIT', 'ROW_COMMIT', 'SORT_CHANGE']));
    expect(customElements.get('tbw-grid')).toBeTruthy();
  });

  it('dispatches and listens for a public event (cell-commit)', async () => {
    const grid = document.createElement('tbw-grid') as any;
    grid.rows = [{ id: 1, name: 'Alpha' }];
    grid.columns = [{ field: 'id' }, { field: 'name', editable: true }];
    document.body.appendChild(grid);
    await waitUpgrade(grid);
    const row = grid.shadowRoot!.querySelector('.data-grid-row') as HTMLElement;
    row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await nextFrame();
    const nameCell = row.querySelector('.cell[data-col="1"]') as HTMLElement;
    const input = nameCell.querySelector('input') as HTMLInputElement;
    const commits: any[] = [];
    grid.addEventListener('cell-commit', (e: any) => commits.push(e.detail));
    input.value = 'Beta';
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    await nextFrame();
    expect(commits.length).toBe(1);
    expect(commits[0]).toMatchObject({ field: 'name', value: 'Beta' });
  });
});

describe('tbw-grid integration: template sandbox rendering', () => {
  async function setupGrid(tpl: string, rows: any[] = [{ v: 1 }, { v: 2 }]) {
    const grid = document.createElement('tbw-grid') as any;
    grid.style.display = 'block';
    grid.style.height = '240px';
    grid.innerHTML = `
      <tbw-grid-column field="v" header="V">
        <tbw-grid-column-view>${tpl}</tbw-grid-column-view>
      </tbw-grid-column>
    `;
    grid.rows = rows;
    document.body.appendChild(grid);
    await waitUpgrade(grid);
    return grid;
  }

  const blocked = [
    '{{ window.location }}',
    '{{ constructor }}',
    '{{ value.constructor }}',
    '{{ Function("return 1")() }}',
    '{{ (row.__proto__) }}',
    '{{ process.env }}',
    '{{ import("fs") }}',
    '{{ a.b.c.d }}',
    '{{ veryLongExpressionAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA }}',
    // Additional security-focused blocked expressions
    '{{ document.cookie }}',
    '{{ location.href }}',
    '{{ localStorage.getItem("x") }}',
    '{{ sessionStorage }}',
    '{{ fetch("evil.com") }}',
    '{{ XMLHttpRequest }}',
    '{{ this.shadowRoot }}',
    '{{ eval("1") }}',
    '{{ globalThis }}',
  ];
  blocked.forEach((tpl) => {
    it(`blocks expression: ${tpl}`, async () => {
      const grid = await setupGrid(`<span>${tpl}</span>`);
      const shadow = grid.shadowRoot!;
      const texts = Array.from(shadow.querySelectorAll('.rows .data-grid-row .cell')).map(
        (el) => (el as HTMLElement).textContent || '',
      );
      texts.forEach((t) => expect(t.trim().length === 0).toBe(true));
    });
  });

  it('allows simple arithmetic & row reference', async () => {
    const grid = await setupGrid('<span>{{ value + 2 }}</span>', [{ v: 3 }]);
    const cell = grid.shadowRoot!.querySelector('.rows .data-grid-row .cell') as HTMLElement;
    expect(cell.textContent?.trim()).toBe('5');
  });

  it('allows row.field direct access', async () => {
    const grid = await setupGrid('<span>{{ row.v }}</span>', [{ v: 42 }]);
    const cell = grid.shadowRoot!.querySelector('.rows .data-grid-row .cell') as HTMLElement;
    expect(cell.textContent?.trim()).toBe('42');
  });
});

// Note: tiny dataset virtualization bypass test is in tiny-dataset.spec.ts

describe('tbw-grid integration: inline plugin registration', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should register and enable plugin when passed directly in plugins config', async () => {
    const grid = document.createElement('tbw-grid') as any;
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name' },
        { field: 'category', header: 'Category' },
      ],
      plugins: [
        // Direct plugin instance = register + enable with defaults
        new GroupingRowsPlugin(),
      ],
    };
    grid.rows = [
      { id: 1, name: 'Alice', category: 'A' },
      { id: 2, name: 'Bob', category: 'A' },
    ];
    document.body.appendChild(grid);
    await waitUpgrade(grid);
    await nextFrame();

    // Verify grid initialized correctly
    const shadow = grid.shadowRoot!;
    const dataRows = shadow.querySelectorAll('.data-grid-row');
    expect(dataRows.length).toBe(2);
  });

  it('should register and enable plugin with config via use property', async () => {
    const grid = document.createElement('tbw-grid') as any;
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name' },
        { field: 'dept', header: 'Dept' },
      ],
      plugins: [
        // Plugin instance with custom config
        new GroupingRowsPlugin({ groupOn: (r: any) => r.dept }),
      ],
    };
    grid.rows = [
      { id: 1, name: 'Alice', dept: 'A' },
      { id: 2, name: 'Bob', dept: 'A' },
      { id: 3, name: 'Carol', dept: 'B' },
    ];
    document.body.appendChild(grid);
    await waitUpgrade(grid);
    await nextFrame();

    // Verify grouping is active (group rows should be rendered)
    const shadow = grid.shadowRoot!;
    const groupRows = shadow.querySelectorAll('.group-row');
    expect(groupRows.length).toBeGreaterThan(0);
  });
});

describe('tbw-grid integration: shell header & tool panels', () => {
  let grid: any;

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders shell header when title is configured', async () => {
    grid = document.createElement('tbw-grid');
    grid.gridConfig = {
      shell: { header: { title: 'My Grid' } },
    };
    grid.rows = [{ id: 1 }];
    document.body.appendChild(grid);
    await waitUpgrade(grid);

    const shadow = grid.shadowRoot!;
    expect(shadow.querySelector('.tbw-shell-header')).not.toBeNull();
    expect(shadow.querySelector('.tbw-shell-title')?.textContent).toBe('My Grid');
  });

  it('renders shell when toolbar buttons are configured', async () => {
    let clicked = false;
    grid = document.createElement('tbw-grid');
    grid.gridConfig = {
      shell: {
        header: {
          toolbarButtons: [
            {
              id: 'refresh',
              label: 'Refresh',
              icon: '↻',
              action: () => {
                clicked = true;
              },
            },
          ],
        },
      },
    };
    grid.rows = [{ id: 1 }];
    document.body.appendChild(grid);
    await waitUpgrade(grid);

    const shadow = grid.shadowRoot!;
    const btn = shadow.querySelector('[data-btn="refresh"]') as HTMLButtonElement;
    expect(btn).not.toBeNull();

    btn.click();
    expect(clicked).toBe(true);
  });

  it('opens and closes tool panels via API', async () => {
    grid = document.createElement('tbw-grid');
    grid.rows = [{ id: 1 }];
    grid.registerToolPanel({
      id: 'test-panel',
      title: 'Test Panel',
      icon: '⚙',
      render: (container: HTMLElement) => {
        container.innerHTML = '<span class="test-content">Hello</span>';
      },
    });
    document.body.appendChild(grid);
    await waitUpgrade(grid);

    // Panel should be registered but closed
    expect(grid.isToolPanelOpen).toBe(false);

    // Open panel - first section is auto-expanded
    grid.openToolPanel();
    await nextFrame();
    expect(grid.isToolPanelOpen).toBe(true);
    // First (and only) panel should be auto-expanded
    expect(grid.expandedToolPanelSections).toContain('test-panel');

    const shadow = grid.shadowRoot!;
    const panel = shadow.querySelector('.tbw-tool-panel');
    expect(panel?.classList.contains('open')).toBe(true);
    expect(shadow.querySelector('.test-content')?.textContent).toBe('Hello');

    // Close panel
    grid.closeToolPanel();
    await nextFrame();
    expect(grid.isToolPanelOpen).toBe(false);
  });

  it('toggles tool panels', async () => {
    grid = document.createElement('tbw-grid');
    grid.rows = [{ id: 1 }];
    grid.registerToolPanel({
      id: 'columns',
      title: 'Columns',
      icon: '☰',
      render: () => {
        /* noop */
      },
    });
    document.body.appendChild(grid);
    await waitUpgrade(grid);

    // Toggle on
    grid.toggleToolPanel();
    expect(grid.isToolPanelOpen).toBe(true);

    // Toggle off
    grid.toggleToolPanel();
    expect(grid.isToolPanelOpen).toBe(false);
  });

  it('clicks panel toggle button to open panel', async () => {
    grid = document.createElement('tbw-grid');
    grid.rows = [{ id: 1 }];
    grid.registerToolPanel({
      id: 'columns',
      title: 'Columns',
      icon: '☰',
      render: () => {
        /* noop */
      },
    });
    document.body.appendChild(grid);
    await waitUpgrade(grid);

    const shadow = grid.shadowRoot!;
    const toggleBtn = shadow.querySelector('[data-panel-toggle]') as HTMLButtonElement;
    expect(toggleBtn).not.toBeNull();

    toggleBtn.click();
    await nextFrame();
    expect(grid.isToolPanelOpen).toBe(true);
  });

  it('closes panel by toggling toolbar button again', async () => {
    grid = document.createElement('tbw-grid');
    grid.rows = [{ id: 1 }];
    grid.registerToolPanel({
      id: 'columns',
      title: 'Columns',
      icon: '☰',
      render: () => {
        /* noop */
      },
    });
    document.body.appendChild(grid);
    await waitUpgrade(grid);

    // Open panel
    grid.openToolPanel();
    await nextFrame();
    expect(grid.isToolPanelOpen).toBe(true);

    // Toggle via toolbar button to close
    const shadow = grid.shadowRoot!;
    const toggleBtn = shadow.querySelector('[data-panel-toggle]') as HTMLButtonElement;
    expect(toggleBtn).not.toBeNull();

    toggleBtn.click();
    await nextFrame();
    expect(grid.isToolPanelOpen).toBe(false);
  });

  it('renders header content from plugin', async () => {
    grid = document.createElement('tbw-grid');
    grid.rows = [{ id: 1 }];
    grid.registerHeaderContent({
      id: 'status',
      order: 10,
      render: (container: HTMLElement) => {
        container.innerHTML = '<span class="status-text">Ready</span>';
      },
    });
    document.body.appendChild(grid);
    await waitUpgrade(grid);

    const shadow = grid.shadowRoot!;
    expect(shadow.querySelector('.tbw-shell-header')).not.toBeNull();
    expect(shadow.querySelector('.status-text')?.textContent).toBe('Ready');
  });

  it('registers and unregisters toolbar buttons dynamically', async () => {
    grid = document.createElement('tbw-grid');
    grid.gridConfig = { shell: { header: { title: 'Test' } } };
    grid.rows = [{ id: 1 }];
    document.body.appendChild(grid);
    await waitUpgrade(grid);

    // Register button
    grid.registerToolbarButton({
      id: 'dynamic',
      label: 'Dynamic',
      icon: '★',
      action: () => {
        /* noop */
      },
    });

    // Need to refresh shell to see the button
    grid.refreshShellHeader();
    await nextFrame();

    const shadow = grid.shadowRoot!;
    let btn = shadow.querySelector('[data-btn="dynamic"]');
    expect(btn).not.toBeNull();

    // Unregister button
    grid.unregisterToolbarButton('dynamic');
    grid.refreshShellHeader();
    await nextFrame();

    btn = shadow.querySelector('[data-btn="dynamic"]');
    expect(btn).toBeNull();
  });

  it('does not render shell when nothing configured', async () => {
    grid = document.createElement('tbw-grid');
    grid.rows = [{ id: 1 }];
    document.body.appendChild(grid);
    await waitUpgrade(grid);

    const shadow = grid.shadowRoot!;
    expect(shadow.querySelector('.tbw-shell-header')).toBeNull();
    expect(shadow.querySelector('.tbw-grid-root.has-shell')).toBeNull();
  });

  it('opens default section when configured', async () => {
    grid = document.createElement('tbw-grid');
    grid.registerToolPanel({
      id: 'columns',
      title: 'Columns',
      icon: '☰',
      render: () => {
        /* noop */
      },
    });
    grid.gridConfig = {
      shell: { toolPanel: { defaultOpen: 'columns' } },
    };
    grid.rows = [{ id: 1 }];
    document.body.appendChild(grid);
    await waitUpgrade(grid);

    expect(grid.isToolPanelOpen).toBe(true);
    expect(grid.expandedToolPanelSections).toContain('columns');
  });
});

describe('tbw-grid integration: selection plugin', () => {
  let grid: any;
  beforeEach(() => {
    document.body.innerHTML = '';
    grid = document.createElement('tbw-grid');
    document.body.appendChild(grid);
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('range selection classes update correctly during scroll', async () => {
    // Create many rows to enable virtualization
    const rows = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Row ${i}` }));
    const selectionPlugin = new SelectionPlugin({ mode: 'range' });

    grid.gridConfig = {
      plugins: [selectionPlugin],
    };
    grid.columns = [
      { field: 'id', header: 'ID' },
      { field: 'name', header: 'Name' },
    ];
    grid.rows = rows;
    await waitUpgrade(grid);

    const shadow = grid.shadowRoot!;

    // Find a cell in the first visible row and click it to select
    const firstVisibleCell = shadow.querySelector('.cell[data-row="0"][data-col="0"]') as HTMLElement;
    expect(firstVisibleCell).not.toBeNull();

    // Click to select the cell
    firstVisibleCell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    firstVisibleCell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    firstVisibleCell.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await nextFrame();

    // Verify the cell has the selected class
    expect(firstVisibleCell.classList.contains('selected')).toBe(true);

    // Verify the selection plugin tracks the correct data indices
    const ranges = selectionPlugin.getRanges();
    expect(ranges.length).toBe(1);
    expect(ranges[0].from).toEqual({ row: 0, col: 0 });
    expect(ranges[0].to).toEqual({ row: 0, col: 0 });

    // Simulate scroll by triggering the scroll handler
    // The faux scrollbar container is used for virtualization
    const fauxScrollbar = grid.virtualization?.container;
    if (fauxScrollbar) {
      // Scroll down significantly
      fauxScrollbar.scrollTop = 500;
      fauxScrollbar.dispatchEvent(new Event('scroll'));
      await nextFrame();
      await nextFrame(); // Extra frame for scroll batching

      // After scrolling, row 0 should not be visible anymore
      // The DOM elements that previously showed row 0 now show different rows
      // But the selection should still be tied to data row 0

      // Verify no cells currently visible have the selected class
      // (since row 0 is scrolled out of view)
      const visibleSelectedCells = shadow.querySelectorAll('.cell.selected');
      // Row 0 should be scrolled out of view, so no selected cells
      for (const cell of visibleSelectedCells) {
        const cellRowIndex = parseInt(cell.getAttribute('data-row') ?? '-1', 10);
        // If any cells are selected, they should only be row 0
        expect(cellRowIndex).toBe(0);
      }

      // Scroll back to top
      fauxScrollbar.scrollTop = 0;
      fauxScrollbar.dispatchEvent(new Event('scroll'));
      await nextFrame();
      await nextFrame();

      // Now row 0 should be visible again with the selected class
      const restoredCell = shadow.querySelector('.cell[data-row="0"][data-col="0"]') as HTMLElement;
      expect(restoredCell).not.toBeNull();
      expect(restoredCell.classList.contains('selected')).toBe(true);
    }
  });

  it('row selection classes update correctly during scroll', async () => {
    // Create many rows to enable virtualization
    const rows = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Row ${i}` }));
    const selectionPlugin = new SelectionPlugin({ mode: 'row' });

    grid.gridConfig = {
      plugins: [selectionPlugin],
    };
    grid.columns = [
      { field: 'id', header: 'ID' },
      { field: 'name', header: 'Name' },
    ];
    grid.rows = rows;
    await waitUpgrade(grid);

    const shadow = grid.shadowRoot!;

    // Find a cell in the first visible row and click it to select the row
    const firstVisibleCell = shadow.querySelector('.cell[data-row="0"][data-col="0"]') as HTMLElement;
    expect(firstVisibleCell).not.toBeNull();

    // Click to select the row
    firstVisibleCell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextFrame();

    // Verify the row has the row-focus class
    const firstRow = firstVisibleCell.closest('.data-grid-row') as HTMLElement;
    expect(firstRow.classList.contains('row-focus')).toBe(true);

    // Verify the selection plugin tracks the correct data index
    const selectedRows = selectionPlugin.getSelectedRows();
    expect(selectedRows).toEqual([0]);

    // Simulate scroll
    const fauxScrollbar = grid.virtualization?.container;
    if (fauxScrollbar) {
      fauxScrollbar.scrollTop = 500;
      fauxScrollbar.dispatchEvent(new Event('scroll'));
      await nextFrame();
      await nextFrame();

      // After scrolling, row 0 should not be visible
      // Verify no rows currently visible have the row-focus class for wrong data
      const visibleSelectedRows = shadow.querySelectorAll('.data-grid-row.row-focus');
      for (const row of visibleSelectedRows) {
        const firstCell = row.querySelector('.cell[data-row]');
        const rowIndex = parseInt(firstCell?.getAttribute('data-row') ?? '-1', 10);
        // Only row 0 should have row-focus
        expect(rowIndex).toBe(0);
      }

      // Scroll back to top
      fauxScrollbar.scrollTop = 0;
      fauxScrollbar.dispatchEvent(new Event('scroll'));
      await nextFrame();
      await nextFrame();

      // Now row 0 should be visible again with the row-focus class
      const restoredRow = shadow
        .querySelector('.data-grid-row .cell[data-row="0"]')
        ?.closest('.data-grid-row') as HTMLElement;
      expect(restoredRow).not.toBeNull();
      expect(restoredRow.classList.contains('row-focus')).toBe(true);
    }
  });
});

describe('tbw-grid integration: core cell focus', () => {
  let grid: any;
  beforeEach(() => {
    document.body.innerHTML = '';
    grid = document.createElement('tbw-grid');
    document.body.appendChild(grid);
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('cell-focus class stays on correct data cell during scroll', async () => {
    // Create many rows to enable virtualization
    const rows = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Row ${i}` }));

    grid.columns = [
      { field: 'id', header: 'ID' },
      { field: 'name', header: 'Name' },
    ];
    grid.rows = rows;
    await waitUpgrade(grid);

    const shadow = grid.shadowRoot!;

    // Find a cell in the first visible row and click it to set focus
    const firstVisibleCell = shadow.querySelector('.cell[data-row="0"][data-col="0"]') as HTMLElement;
    expect(firstVisibleCell).not.toBeNull();

    // Click to focus the cell
    firstVisibleCell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextFrame();

    // Verify the cell has the cell-focus class
    expect(firstVisibleCell.classList.contains('cell-focus')).toBe(true);

    // Verify focusRow and focusCol are set correctly
    expect(grid.focusRow).toBe(0);
    expect(grid.focusCol).toBe(0);

    // Simulate scroll
    const fauxScrollbar = grid.virtualization?.container;
    if (fauxScrollbar) {
      fauxScrollbar.scrollTop = 500;
      fauxScrollbar.dispatchEvent(new Event('scroll'));
      await nextFrame();
      await nextFrame();

      // After scrolling, row 0 should not be visible anymore
      // No visible cell should have cell-focus unless it's data-row="0" data-col="0"
      const visibleFocusedCells = shadow.querySelectorAll('.cell.cell-focus');
      for (const cell of visibleFocusedCells) {
        const cellRowIndex = parseInt(cell.getAttribute('data-row') ?? '-1', 10);
        const cellColIndex = parseInt(cell.getAttribute('data-col') ?? '-1', 10);
        // Only row 0, col 0 should have focus
        expect(cellRowIndex).toBe(0);
        expect(cellColIndex).toBe(0);
      }

      // Scroll back to top
      fauxScrollbar.scrollTop = 0;
      fauxScrollbar.dispatchEvent(new Event('scroll'));
      await nextFrame();
      await nextFrame();

      // Now row 0 should be visible again with the cell-focus class
      const restoredCell = shadow.querySelector('.cell[data-row="0"][data-col="0"]') as HTMLElement;
      expect(restoredCell).not.toBeNull();
      expect(restoredCell.classList.contains('cell-focus')).toBe(true);
    }
  });
});
