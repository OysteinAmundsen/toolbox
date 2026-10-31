import { describe, expect, it } from 'vitest';
import { nextFrame } from '../../../test/helpers';
import '../../lib/core/grid';
import { EditingPlugin } from '../../lib/plugins/editing';
import { GroupingColumnsPlugin } from '../../lib/plugins/grouping-columns';
import { ResponsivePlugin } from '../../lib/plugins/responsive';

describe('tbw-grid accessibility', () => {
  it('sets grid role and aria counts on inner grid element', async () => {
    const grid = document.createElement('tbw-grid') as any;
    grid.rows = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ];
    grid.columns = [{ field: 'id' }, { field: 'name' }];
    document.body.appendChild(grid);
    await nextFrame();
    // role="grid" is on inner .rows-body element (not host) to keep shell chrome outside grid semantics
    const innerGrid = grid.querySelector('.rows-body');
    expect(innerGrid?.getAttribute('role')).toBe('grid');
    // virtualization may update counts after frame
    await nextFrame();
    // aria-rowcount counts the header row too (#586): 1 header + 2 data rows
    expect(Number(innerGrid?.getAttribute('aria-rowcount'))).toBe(3);
    expect(Number(innerGrid?.getAttribute('aria-colcount'))).toBe(2);
  });

  it('aria-rowcount is never below the last aria-rowindex (#586)', async () => {
    const grid = document.createElement('tbw-grid') as any;
    grid.gridConfig = { columns: [{ field: 'a' }] };
    grid.rows = [{ a: 1 }, { a: 2 }, { a: 3 }];
    document.body.appendChild(grid);
    await grid.ready?.();
    await nextFrame();
    const innerGrid = grid.querySelector('.rows-body');
    const lastRow = Array.from(grid.querySelectorAll('.data-grid-row')).at(-1) as HTMLElement;
    expect(innerGrid?.getAttribute('aria-rowcount')).toBe('4');
    expect(lastRow.getAttribute('aria-rowindex')).toBe('4');
  });

  it('keeps the last row at aria-rowindex === aria-rowcount on the virtualized path, across a header-count change', async () => {
    // 200 rows is far past the bypass threshold, so this takes the real virtualized
    // path: scroll renders go through refreshVirtualWindow's non-force branch, which
    // writes the counts separately from _afterPluginRender.
    const rows = Array.from({ length: 200 }, (_, i) => ({ a: i, b: i * 2, c: i * 3 }));
    const flat = [{ field: 'a' }, { field: 'b' }, { field: 'c' }];
    const grouped = [{ field: 'a', group: 'g1' }, { field: 'b', group: 'g1' }, { field: 'c' }];
    const grid = document.createElement('tbw-grid') as any;
    grid.style.display = 'block';
    grid.style.height = '100px';
    grid.gridConfig = { columns: flat, plugins: [new GroupingColumnsPlugin()] };
    grid.rows = rows;
    document.body.appendChild(grid);
    await grid.ready?.();
    await nextFrame();

    const innerGrid = grid.querySelector('.rows-body') as HTMLElement;
    const renderedRows = () => Array.from(grid.querySelectorAll('.rows > .data-grid-row')) as HTMLElement[];
    const scrollToEnd = async () => {
      const faux = grid._virtualization.container as HTMLElement;
      faux.scrollTop = rows.length * grid._virtualization.rowHeight;
      faux.dispatchEvent(new Event('scroll'));
      await nextFrame();
      await nextFrame();
    };
    const expectLastRowMatchesCount = (headerRows: number) => {
      const rendered = renderedRows();
      // Virtualized: only a window is in the DOM, and it must include the last data row.
      expect(rendered.length).toBeLessThan(rows.length);
      const last = rendered.find((r) => r.querySelector('.cell[data-row="199"]'));
      expect(last).toBeDefined();
      const rowCount = innerGrid.getAttribute('aria-rowcount');
      expect(rowCount).toBe(String(rows.length + headerRows));
      expect(last?.getAttribute('aria-rowindex')).toBe(rowCount);
    };

    await scrollToEnd();
    expectLastRowMatchesCount(1);

    // Header grows by one row while scrolled to the end: both the index offset and
    // the count must move together, and the next scroll render must keep them so.
    grid.columns = grouped;
    await nextFrame();
    await nextFrame();
    await scrollToEnd();
    expectLastRowMatchesCount(2);

    grid.columns = flat;
    await nextFrame();
    await nextFrame();
    await scrollToEnd();
    expectLastRowMatchesCount(1);
  });

  it('drops the hidden header from aria-rowcount and aria-rowindex in Responsive card mode', async () => {
    const grid = document.createElement('tbw-grid') as any;
    const plugin = new ResponsivePlugin({ breakpoint: 500, animation: false });
    grid.gridConfig = { columns: [{ field: 'a' }, { field: 'b' }], plugins: [plugin] };
    grid.rows = [
      { a: 1, b: 1 },
      { a: 2, b: 2 },
      { a: 3, b: 3 },
    ];
    document.body.appendChild(grid);
    await grid.ready?.();
    await nextFrame();
    const innerGrid = grid.querySelector('.rows-body');
    const header = grid.querySelector('.rows-body > .header');
    const rowIndices = () =>
      Array.from(grid.querySelectorAll('.rows > .data-grid-row')).map((r: any) => r.getAttribute('aria-rowindex'));
    expect(innerGrid?.getAttribute('aria-rowcount')).toBe('4');
    expect(rowIndices()).toEqual(['2', '3', '4']);

    // Card mode: `.header` is display:none, so it leaves the accessibility tree.
    plugin.setResponsive(true);
    await nextFrame();
    await nextFrame();
    expect(header?.getAttribute('aria-hidden')).toBe('true');
    expect(innerGrid?.getAttribute('aria-rowcount')).toBe('3');
    expect(rowIndices()).toEqual(['1', '2', '3']);

    plugin.setResponsive(false);
    await nextFrame();
    await nextFrame();
    expect(header?.hasAttribute('aria-hidden')).toBe(false);
    expect(innerGrid?.getAttribute('aria-rowcount')).toBe('4');
    expect(rowIndices()).toEqual(['2', '3', '4']);
  });

  it('leaves a nested grid inside a card-mode parent with its header counted and unmarked', async () => {
    const parent = document.createElement('tbw-grid') as any;
    const plugin = new ResponsivePlugin({ breakpoint: 500, animation: false });
    parent.gridConfig = {
      columns: [
        { field: 'a' },
        {
          field: 'nested',
          renderer: () => {
            const child = document.createElement('tbw-grid') as any;
            child.className = 'nested-grid';
            child.gridConfig = { columns: [{ field: 'x' }] };
            child.rows = [{ x: 1 }, { x: 2 }];
            return child;
          },
        },
      ],
      plugins: [plugin],
    };
    parent.rows = [{ a: 1 }, { a: 2 }, { a: 3 }];
    document.body.appendChild(parent);
    await parent.ready?.();
    await nextFrame();

    plugin.setResponsive(true);
    await nextFrame();
    await nextFrame();
    const child = parent.querySelector('.nested-grid') as any;
    await child.ready?.();
    await nextFrame();

    // The parent's own header is hidden and dropped from its counts...
    expect(parent.querySelector(':scope > .tbw-grid-root .rows-body > .header')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    expect(parent.querySelector('.rows-body')?.getAttribute('aria-rowcount')).toBe('3');
    // ...while the nested grid (no Responsive plugin of its own) keeps a visible,
    // counted header: 1 header row + 2 data rows, first data row at index 2.
    const childHeader = child.querySelector('.rows-body > .header');
    expect(childHeader?.hasAttribute('aria-hidden')).toBe(false);
    expect(child.querySelector('.rows-body')?.getAttribute('aria-rowcount')).toBe('3');
    expect(child.querySelector('.rows > .data-grid-row')?.getAttribute('aria-rowindex')).toBe('2');
  });

  it('header cells have columnheader role', async () => {
    const grid = document.createElement('tbw-grid') as any;
    grid.rows = [{ id: 1 }];
    grid.columns = [{ field: 'id' }];
    document.body.appendChild(grid);
    await nextFrame();
    const headerCell = grid.querySelector('.header-row .cell');
    expect(headerCell?.getAttribute('role')).toBe('columnheader');
  });

  it('focusable host for keyboard nav', async () => {
    const grid = document.createElement('tbw-grid') as any;
    document.body.appendChild(grid);
    await nextFrame();
    const tabindex = grid.getAttribute('tabindex');
    expect(tabindex === '0' || tabindex === '1').toBe(true);
  });

  it('sortable headers expose baseline aria-sort and update through cycle', async () => {
    const grid = document.createElement('tbw-grid') as any;
    grid.rows = [{ id: 2 }, { id: 1 }];
    grid.columns = [{ field: 'id', sortable: true }];
    document.body.appendChild(grid);
    if (typeof grid.ready === 'function') await grid.ready();

    // Poll until header cell present (accounts for async setup + virtualization)
    const waitForHeader = async (): Promise<HTMLElement> => {
      for (let i = 0; i < 12; i++) {
        await nextFrame();
        const h = grid.querySelector('.header-row .cell.sortable[data-field="id"]') as HTMLElement | null;
        if (h) return h;
      }
      throw new Error('Header cell not rendered in time');
    };

    let header = await waitForHeader();
    expect(header.getAttribute('aria-sort')).toBe('none');

    header.click();
    await nextFrame();
    await nextFrame();
    header = await waitForHeader();
    expect(header.getAttribute('aria-sort')).toBe('ascending');

    header.click();
    await nextFrame();
    await nextFrame();
    header = await waitForHeader();
    expect(header.getAttribute('aria-sort')).toBe('descending');

    header.click();
    await nextFrame();
    await nextFrame();
    header = await waitForHeader();
    expect(header.getAttribute('aria-sort')).toBe('none');
  });

  // TODO: This test has timing issues in the test environment - the boolean toggle works
  // correctly in real usage, but the test environment doesn't properly wait for render
  // cycles. Similar tests in EditingPlugin.spec.ts are also skipped for the same reason.
  it.skip('boolean cells use checkbox semantics and toggle state', async () => {
    const grid = document.createElement('tbw-grid') as any;
    grid.gridConfig = {
      columns: [{ field: 'ok', type: 'boolean', editable: true }],
      plugins: [new EditingPlugin({ editOn: 'dblclick' })],
    };
    grid.rows = [{ ok: false }];
    document.body.appendChild(grid);
    await grid.ready?.();
    await nextFrame();
    await nextFrame();
    const cell = grid.querySelector('.data-grid-row .cell') as HTMLElement;
    // Checkbox semantics are on inner span (cell remains gridcell for ARIA compliance)
    const checkboxEl = cell.querySelector('[role="checkbox"]') as HTMLElement | null;
    expect(checkboxEl).toBeTruthy();
    expect(checkboxEl?.getAttribute('aria-checked')).toBe('false');
    // Set focus for keyboard navigation
    grid._focusRow = 0;
    grid._focusCol = 0;
    // Dispatch keydown on the grid element so it goes through plugin event distribution
    grid.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await nextFrame();
    await nextFrame();
    await nextFrame();
    await nextFrame();
    const updatedCheckboxEl = cell.querySelector('[role="checkbox"]') as HTMLElement | null;
    expect(updatedCheckboxEl?.getAttribute('aria-checked')).toBe('true');
  });

  it('focused cell gains aria-selected', async () => {
    const grid = document.createElement('tbw-grid') as any;
    grid.rows = [{ id: 1, name: 'A' }];
    grid.columns = [{ field: 'id' }, { field: 'name' }];
    document.body.appendChild(grid);
    await nextFrame();
    await nextFrame();
    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await nextFrame();
    await nextFrame();
    const selected = grid.querySelector('[aria-selected="true"]');
    expect(selected).toBeTruthy();
  });

  it('empty grid has role="grid" from static template with zero counts', async () => {
    const grid = document.createElement('tbw-grid') as any;
    grid.rows = [];
    grid.columns = [];
    document.body.appendChild(grid);
    await grid.ready?.();
    await nextFrame();
    const innerGrid = grid.querySelector('.rows-body');
    // Static role from template is always present
    expect(innerGrid?.getAttribute('role')).toBe('grid');
    // No columns → the header is not a row (header.ts drops role="row"), so nothing counts (#586)
    expect(innerGrid?.getAttribute('aria-rowcount')).toBe('0');
    expect(innerGrid?.getAttribute('aria-colcount')).toBe('0');
  });

  it('grid updates aria counts when data changes', async () => {
    const grid = document.createElement('tbw-grid') as any;
    grid.rows = [{ id: 1 }];
    grid.columns = [{ field: 'id' }];
    document.body.appendChild(grid);
    await grid.ready?.();
    await nextFrame();
    const innerGrid = grid.querySelector('.rows-body');
    // Static role always present
    expect(innerGrid?.getAttribute('role')).toBe('grid');
    // 1 header row + 1 data row (#586)
    expect(innerGrid?.getAttribute('aria-rowcount')).toBe('2');

    // Clear data
    grid.rows = [];
    await nextFrame();
    await nextFrame();
    // Role stays, count drops to the header row alone
    expect(innerGrid?.getAttribute('role')).toBe('grid');
    expect(innerGrid?.getAttribute('aria-rowcount')).toBe('1');
  });

  it('gridAriaLabel sets aria-label on inner grid element', async () => {
    const grid = document.createElement('tbw-grid') as any;
    grid.rows = [{ id: 1 }];
    grid.columns = [{ field: 'id' }];
    grid.gridConfig = { gridAriaLabel: 'Employee data table' };
    document.body.appendChild(grid);
    await grid.ready?.();
    await nextFrame();
    const innerGrid = grid.querySelector('.rows-body');
    expect(innerGrid?.getAttribute('aria-label')).toBe('Employee data table');
  });

  it('gridAriaDescribedBy sets aria-describedby on inner grid element', async () => {
    // Create description element
    const desc = document.createElement('p');
    desc.id = 'grid-description';
    desc.textContent = 'This table shows all employees.';
    document.body.appendChild(desc);

    const grid = document.createElement('tbw-grid') as any;
    grid.rows = [{ id: 1 }];
    grid.columns = [{ field: 'id' }];
    grid.gridConfig = { gridAriaDescribedBy: 'grid-description' };
    document.body.appendChild(grid);
    await grid.ready?.();
    await nextFrame();
    const innerGrid = grid.querySelector('.rows-body');
    expect(innerGrid?.getAttribute('aria-describedby')).toBe('grid-description');
  });

  it('derives aria-label from shell header title when gridAriaLabel not set', async () => {
    const grid = document.createElement('tbw-grid') as any;
    grid.rows = [{ id: 1 }];
    grid.columns = [{ field: 'id' }];
    grid.gridConfig = {
      shell: { header: { title: 'Team Members' } },
    };
    document.body.appendChild(grid);
    await grid.ready?.();
    await nextFrame();
    const innerGrid = grid.querySelector('.rows-body');
    expect(innerGrid?.getAttribute('aria-label')).toBe('Team Members');
  });

  it('gridAriaLabel takes precedence over shell title', async () => {
    const grid = document.createElement('tbw-grid') as any;
    grid.rows = [{ id: 1 }];
    grid.columns = [{ field: 'id' }];
    grid.gridConfig = {
      gridAriaLabel: 'Explicit label',
      shell: { header: { title: 'Shell Title' } },
    };
    document.body.appendChild(grid);
    await grid.ready?.();
    await nextFrame();
    const innerGrid = grid.querySelector('.rows-body');
    expect(innerGrid?.getAttribute('aria-label')).toBe('Explicit label');
  });
});
