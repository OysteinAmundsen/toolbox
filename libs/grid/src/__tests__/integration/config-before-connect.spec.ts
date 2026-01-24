/**
 * Integration test for Config-Before-Connect pattern:
 * Setting gridConfig and rows BEFORE connecting element to DOM.
 *
 * This is common in vanilla JavaScript/TypeScript apps where you create
 * an element, configure it, then append it to the DOM. Framework adapters
 * (React, Angular) typically connect first, then update properties reactively.
 *
 * This reproduces an issue where headers were not rendered when
 * configuration was set before the element was connected.
 */
import { afterEach, describe, expect, it } from 'vitest';
import '../../lib/core/grid';
import type { DataGridElement } from '../../lib/core/grid';

function nextFrame() {
  return new Promise((r) => requestAnimationFrame(r));
}

async function waitForReady(grid: DataGridElement): Promise<void> {
  // Wait for upgrade
  await customElements.whenDefined('tbw-grid');
  // Wait for grid.ready()
  if (typeof grid.ready === 'function') {
    await grid.ready();
  }
  // Extra frame for rendering
  await nextFrame();
  await nextFrame();
}

describe('Vanilla Demo Pattern - Config Before Connect', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should render headers when gridConfig is set before appendChild', async () => {
    // Create element (not connected yet)
    const grid = document.createElement('tbw-grid') as DataGridElement;
    grid.id = 'test-grid';

    // Set gridConfig BEFORE connecting to DOM (vanilla demo pattern)
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name' },
        { field: 'email', header: 'Email' },
      ],
    };

    // Set rows BEFORE connecting
    grid.rows = [
      { id: 1, name: 'Alice', email: 'alice@test.com' },
      { id: 2, name: 'Bob', email: 'bob@test.com' },
    ];

    // Now connect to DOM
    document.body.appendChild(grid);
    await waitForReady(grid);

    // Verify columns are configured
    expect(grid.gridConfig.columns?.length).toBe(3);
    expect(grid._columns.length).toBe(3);
    expect(grid._visibleColumns.length).toBe(3);

    // Verify header row has children
    const headerRow = grid.querySelector('.header-row');
    expect(headerRow).not.toBeNull();
    expect(headerRow!.children.length).toBe(3);

    // Verify column headers have role="columnheader"
    const columnHeaders = grid.querySelectorAll('[role="columnheader"]');
    expect(columnHeaders.length).toBe(3);

    // Verify header text content
    const headerTexts = Array.from(columnHeaders).map((h) => h.querySelector('span')?.textContent);
    expect(headerTexts).toEqual(['ID', 'Name', 'Email']);
  });

  it('should render headers when gridConfig includes shell header (vanilla demo)', async () => {
    // Create element (not connected yet)
    const grid = document.createElement('tbw-grid') as DataGridElement;
    grid.id = 'employee-grid';
    grid.className = 'demo-grid';

    // IMPORTANT: Vanilla demo appends tool buttons BEFORE setting gridConfig
    const toolButtons = document.createElement('tbw-grid-tool-buttons');
    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export';
    toolButtons.appendChild(exportBtn);
    grid.appendChild(toolButtons);

    // Set gridConfig with shell (like vanilla demo)
    grid.gridConfig = {
      shell: {
        header: {
          title: 'Employee Management System (JS)',
        },
      },
      columns: [
        { field: 'id', header: 'ID' },
        { field: 'firstName', header: 'First Name' },
        { field: 'lastName', header: 'Last Name' },
      ],
    };

    // Set rows
    grid.rows = [
      { id: 1, firstName: 'Alice', lastName: 'Smith' },
      { id: 2, firstName: 'Bob', lastName: 'Jones' },
    ];

    // Connect to DOM
    document.body.appendChild(grid);
    await waitForReady(grid);

    // Verify shell header is rendered
    const shellHeader = grid.querySelector('.tbw-shell-header');
    expect(shellHeader).not.toBeNull();

    // Verify columns are configured
    expect(grid.gridConfig.columns?.length).toBe(3);
    expect(grid._columns.length).toBe(3);
    expect(grid._visibleColumns.length).toBe(3);

    // Verify header row has children (THE KEY TEST)
    const headerRow = grid.querySelector('.header-row');
    expect(headerRow).not.toBeNull();
    expect(headerRow!.children.length, 'Header row should have column cells').toBe(3);

    // Verify column headers
    const columnHeaders = grid.querySelectorAll('[role="columnheader"]');
    expect(columnHeaders.length, 'Should have columnheader elements').toBe(3);
  });

  it('should work when connecting element first, then setting config', async () => {
    // Create and connect first
    const grid = document.createElement('tbw-grid') as DataGridElement;
    document.body.appendChild(grid);

    // Now set config
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name' },
      ],
    };
    grid.rows = [{ id: 1, name: 'Test' }];

    await waitForReady(grid);
    await nextFrame();

    // Verify headers rendered
    const columnHeaders = grid.querySelectorAll('[role="columnheader"]');
    expect(columnHeaders.length).toBe(2);
  });

  it('should render headers with plugins like vanilla demo', async () => {
    // Import plugins dynamically
    const { SelectionPlugin } = await import('../../lib/plugins/selection');
    const { MultiSortPlugin } = await import('../../lib/plugins/multi-sort');
    const { FilteringPlugin } = await import('../../lib/plugins/filtering');
    const { EditingPlugin } = await import('../../lib/plugins/editing');
    const { MasterDetailPlugin } = await import('../../lib/plugins/master-detail');
    const { ReorderPlugin } = await import('../../lib/plugins/reorder');
    const { GroupingColumnsPlugin } = await import('../../lib/plugins/grouping-columns');
    const { PinnedColumnsPlugin } = await import('../../lib/plugins/pinned-columns');
    const { VisibilityPlugin } = await import('../../lib/plugins/visibility');
    const { ContextMenuPlugin } = await import('../../lib/plugins/context-menu');
    const { ClipboardPlugin } = await import('../../lib/plugins/clipboard');
    const { ExportPlugin } = await import('../../lib/plugins/export');

    // Create element (not connected yet)
    const grid = document.createElement('tbw-grid') as DataGridElement;
    grid.id = 'employee-grid';
    grid.className = 'demo-grid';

    // Add tool buttons like vanilla demo
    const toolButtons = document.createElement('tbw-grid-tool-buttons');
    const exportBtn = document.createElement('button');
    exportBtn.textContent = '📄';
    toolButtons.appendChild(exportBtn);
    grid.appendChild(toolButtons);

    // Set gridConfig with shell AND plugins (like vanilla demo)
    grid.gridConfig = {
      shell: {
        header: {
          title: 'Employee Management System (JS)',
        },
        toolPanel: { position: 'right', width: 300 },
      },
      columnGroups: [
        { id: 'employee', header: 'Employee Info', children: ['firstName', 'lastName', 'email'] },
        { id: 'organization', header: 'Organization', children: ['department', 'title'] },
      ],
      columns: [
        { field: 'id', header: 'ID', type: 'number', width: 70, sortable: true },
        { field: 'firstName', header: 'First Name', minWidth: 100, editable: true, sortable: true },
        { field: 'lastName', header: 'Last Name', minWidth: 100, editable: true, sortable: true },
        { field: 'email', header: 'Email', minWidth: 200 },
        { field: 'department', header: 'Dept', width: 120, sortable: true },
        { field: 'title', header: 'Title', minWidth: 160, editable: true },
        { field: 'salary', header: 'Salary', type: 'number', width: 110 },
        { field: 'status', header: 'Status', width: 140, sortable: true },
      ],
      plugins: [
        new SelectionPlugin({ mode: 'range' }),
        new MultiSortPlugin(),
        new FilteringPlugin({ debounceMs: 200 }),
        new EditingPlugin({ editOn: 'dblclick' }),
        new ClipboardPlugin(),
        new ContextMenuPlugin(),
        new ReorderPlugin(),
        new GroupingColumnsPlugin(),
        new PinnedColumnsPlugin(),
        new VisibilityPlugin(),
        new MasterDetailPlugin({
          detailRenderer: () => '<div>Detail</div>',
          showExpandColumn: true,
        }),
        new ExportPlugin(),
      ],
    };

    // Set rows
    grid.rows = [
      {
        id: 1,
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@test.com',
        department: 'Eng',
        title: 'Engineer',
        salary: 100000,
        status: 'Active',
      },
      {
        id: 2,
        firstName: 'Bob',
        lastName: 'Jones',
        email: 'bob@test.com',
        department: 'Sales',
        title: 'Manager',
        salary: 120000,
        status: 'Active',
      },
    ];

    // Connect to DOM
    document.body.appendChild(grid);
    await waitForReady(grid);

    // Debug output like E2E
    console.log('=== Grid Internal State ===');
    console.log('gridConfig columns count:', grid.gridConfig.columns?.length);
    console.log('_columns count:', grid._columns.length);
    console.log('_visibleColumns count:', grid._visibleColumns.length);

    const headerRow = grid.querySelector('.header-row');
    console.log('Header row child count:', headerRow?.children.length);

    // Verify shell header is rendered
    const shellHeader = grid.querySelector('.tbw-shell-header');
    expect(shellHeader).not.toBeNull();

    // Verify columns are configured (should be 8 base + 1 utility from MasterDetail = 9)
    expect(grid._columns.length).toBeGreaterThanOrEqual(8);
    expect(grid._visibleColumns.length).toBeGreaterThanOrEqual(8);

    // Verify header row has children (THE KEY TEST)
    expect(headerRow).not.toBeNull();
    expect(headerRow!.children.length, 'Header row should have column cells').toBeGreaterThanOrEqual(8);

    // Verify column headers
    const columnHeaders = grid.querySelectorAll('[role="columnheader"]');
    expect(columnHeaders.length, 'Should have columnheader elements').toBeGreaterThanOrEqual(8);

    // Verify column group row is rendered (GroupingColumnsPlugin)
    const groupRow = grid.querySelector('.header-group-row');
    expect(groupRow, 'Should have column group header row').not.toBeNull();
    expect(groupRow!.children.length, 'Should have group cells').toBeGreaterThan(0);
  });

  it('should render column groups after refreshShellHeader is called (regression test)', async () => {
    // This specifically tests the fix for the regression where refreshShellHeader()
    // was only requesting VIRTUALIZATION phase instead of COLUMNS phase
    const { GroupingColumnsPlugin } = await import('../../lib/plugins/grouping-columns');

    // Create element (not connected yet)
    const grid = document.createElement('tbw-grid') as DataGridElement;
    grid.id = 'test-grid';

    // Set gridConfig with column groups
    grid.gridConfig = {
      shell: {
        header: {
          title: 'Test Grid',
        },
      },
      columnGroups: [
        { id: 'personal', header: 'Personal Info', children: ['firstName', 'lastName'] },
        { id: 'contact', header: 'Contact', children: ['email', 'phone'] },
      ],
      columns: [
        { field: 'id', header: 'ID' },
        { field: 'firstName', header: 'First Name' },
        { field: 'lastName', header: 'Last Name' },
        { field: 'email', header: 'Email' },
        { field: 'phone', header: 'Phone' },
      ],
      plugins: [new GroupingColumnsPlugin()],
    };

    grid.rows = [{ id: 1, firstName: 'Alice', lastName: 'Smith', email: 'alice@test.com', phone: '555-1234' }];

    // Connect to DOM
    document.body.appendChild(grid);
    await waitForReady(grid);

    // Verify initial state has column groups
    let groupRow = grid.querySelector('.header-group-row');
    expect(groupRow, 'Initial: Should have column group header row').not.toBeNull();
    expect(groupRow!.children.length, 'Initial: Should have group cells').toBeGreaterThan(0);

    // Now simulate what the vanilla demo does: call refreshShellHeader()
    // This was the bug - it would clear the header and not repopulate column groups
    if (typeof (grid as { refreshShellHeader?: () => void }).refreshShellHeader === 'function') {
      (grid as { refreshShellHeader?: () => void }).refreshShellHeader!();

      // Wait for microtask + render cycle
      await new Promise((r) => setTimeout(r, 50));
      await nextFrame();
      await nextFrame();
    }

    // Verify column groups are STILL rendered after refreshShellHeader
    const headerRow = grid.querySelector('.header-row');
    expect(headerRow, 'After refresh: Should have header row').not.toBeNull();
    expect(headerRow!.children.length, 'After refresh: Header row should have cells').toBe(5);

    groupRow = grid.querySelector('.header-group-row');
    expect(groupRow, 'After refresh: Should have column group header row').not.toBeNull();
    expect(groupRow!.children.length, 'After refresh: Should have group cells').toBeGreaterThan(0);

    // Verify column headers
    const columnHeaders = grid.querySelectorAll('[role="columnheader"]');
    expect(columnHeaders.length, 'After refresh: Should have columnheader elements').toBe(5);
  });
});
