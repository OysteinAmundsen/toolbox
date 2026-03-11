import { afterEach, describe, expect, it } from 'vitest';
import '../../lib/core/grid';
import { EditingPlugin } from '../../lib/plugins/editing';
import { SelectionPlugin } from '../../lib/plugins/selection';
import { UndoRedoPlugin } from '../../lib/plugins/undo-redo';

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

describe('updateRow with custom boolean renderer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should update cell content when boolean value is toggled via updateRow with custom renderer', async () => {
    const grid = document.createElement('tbw-grid') as any;
    document.body.appendChild(grid);

    grid.gridConfig = {
      getRowId: (row: any) => row.id,
      columns: [
        { field: 'id', width: 80 },
        {
          field: 'confidential',
          type: 'boolean',
          width: 80,
          renderer: (ctx: { value: unknown }) => {
            if (ctx.value == null) return '';
            const span = document.createElement('span');
            span.className = 'confidential-icon';
            span.textContent = ctx.value ? 'lock' : 'lock_open';
            return span;
          },
        },
        {
          field: 'available',
          type: 'boolean',
          width: 80,
        },
      ],
      typeDefaults: {
        boolean: {
          renderer: (ctx: { value: unknown }) => {
            const span = document.createElement('span');
            span.className = 'boolean-icon';
            span.textContent = ctx.value ? 'check_box' : 'check_box_outline_blank';
            return span;
          },
        },
      },
    };

    grid.rows = [
      { id: 'row-1', confidential: true, available: true },
      { id: 'row-2', confidential: false, available: false },
    ];

    await waitUpgrade(grid);
    await nextFrame();
    await nextFrame();

    // Verify initial render
    const getConfidentialCell = (rowIdx: number): HTMLElement | null => {
      const rows = grid.querySelectorAll('.data-grid-row');
      if (!rows[rowIdx]) return null;
      // Find the confidential column index in visible columns
      const confColIdx = grid._visibleColumns.findIndex((c: any) => c.field === 'confidential');
      return rows[rowIdx].children[confColIdx] as HTMLElement;
    };

    const getAvailableCell = (rowIdx: number): HTMLElement | null => {
      const rows = grid.querySelectorAll('.data-grid-row');
      if (!rows[rowIdx]) return null;
      const availColIdx = grid._visibleColumns.findIndex((c: any) => c.field === 'available');
      return rows[rowIdx].children[availColIdx] as HTMLElement;
    };

    // Check initial state for row-1
    let confCell = getConfidentialCell(0);
    let availCell = getAvailableCell(0);

    expect(confCell?.querySelector('.confidential-icon')?.textContent).toBe('lock');
    expect(availCell?.querySelector('.boolean-icon')?.textContent).toBe('check_box');

    // Toggle CONFIDENTIAL via updateRow (from true → false)
    grid.updateRow('row-1', { confidential: false });
    await nextFrame();
    await nextFrame();

    confCell = getConfidentialCell(0);
    expect(confCell?.querySelector('.confidential-icon')?.textContent).toBe('lock_open');

    // Toggle AVAILABLE via updateRow (from true → false)
    grid.updateRow('row-1', { available: false });
    await nextFrame();
    await nextFrame();

    availCell = getAvailableCell(0);
    expect(availCell?.querySelector('.boolean-icon')?.textContent).toBe('check_box_outline_blank');

    // Toggle both back
    grid.updateRow('row-1', { confidential: true, available: true });
    await nextFrame();
    await nextFrame();

    confCell = getConfidentialCell(0);
    availCell = getAvailableCell(0);
    expect(confCell?.querySelector('.confidential-icon')?.textContent).toBe('lock');
    expect(availCell?.querySelector('.boolean-icon')?.textContent).toBe('check_box');
  });

  it('should update cell content for row-2 (false → true) via updateRow', async () => {
    const grid = document.createElement('tbw-grid') as any;
    document.body.appendChild(grid);

    grid.gridConfig = {
      getRowId: (row: any) => row.id,
      columns: [
        { field: 'id', width: 80 },
        {
          field: 'confidential',
          type: 'boolean',
          width: 80,
          renderer: (ctx: { value: unknown }) => {
            if (ctx.value == null) return '';
            const span = document.createElement('span');
            span.className = 'confidential-icon';
            span.textContent = ctx.value ? 'lock' : 'lock_open';
            return span;
          },
        },
      ],
    };

    grid.rows = [{ id: 'row-2', confidential: false }];

    await waitUpgrade(grid);
    await nextFrame();
    await nextFrame();

    // Verify initial: lock_open
    const getConfCell = () => {
      const row = grid.querySelector('.data-grid-row');
      const colIdx = grid._visibleColumns.findIndex((c: any) => c.field === 'confidential');
      return row?.children[colIdx] as HTMLElement;
    };

    let cell = getConfCell();
    expect(cell?.querySelector('.confidential-icon')?.textContent).toBe('lock_open');

    // Toggle false → true
    grid.updateRow('row-2', { confidential: true });
    await nextFrame();
    await nextFrame();

    cell = getConfCell();
    expect(cell?.querySelector('.confidential-icon')?.textContent).toBe('lock');
  });

  it('should update with EditingPlugin + SelectionPlugin + UndoRedoPlugin active', async () => {
    const grid = document.createElement('tbw-grid') as any;
    document.body.appendChild(grid);

    grid.gridConfig = {
      getRowId: (row: any) => row.id,
      columns: [
        { field: 'id', width: 80 },
        {
          field: 'confidential',
          type: 'boolean',
          width: 80,
          editable: true,
          renderer: (ctx: { value: unknown }) => {
            if (ctx.value == null) return '';
            const span = document.createElement('span');
            span.className = 'confidential-icon';
            span.textContent = ctx.value ? 'lock' : 'lock_open';
            return span;
          },
        },
        {
          field: 'available',
          type: 'boolean',
          width: 80,
          editable: true,
        },
      ],
      typeDefaults: {
        boolean: {
          renderer: (ctx: { value: unknown }) => {
            const span = document.createElement('span');
            span.className = 'boolean-icon';
            span.textContent = ctx.value ? 'check_box' : 'check_box_outline_blank';
            return span;
          },
        },
      },
      plugins: [
        new EditingPlugin({ editOn: 'dblclick', dirtyTracking: true }),
        new SelectionPlugin({ mode: 'row' }),
        new UndoRedoPlugin(),
      ],
      rowClass: (row: any) => {
        const classes: string[] = [];
        if (row.confidential) classes.push('confidential-cargo');
        return classes;
      },
    };

    grid.rows = [
      { id: 'row-1', confidential: true, available: true },
      { id: 'row-2', confidential: false, available: false },
    ];

    await waitUpgrade(grid);
    await nextFrame();
    await nextFrame();

    const getCell = (rowIdx: number, field: string) => {
      const rows = grid.querySelectorAll('.data-grid-row');
      if (!rows[rowIdx]) return null;
      const colIdx = grid._visibleColumns.findIndex((c: any) => c.field === field);
      return rows[rowIdx].children[colIdx] as HTMLElement;
    };

    // Verify initial
    expect(getCell(0, 'confidential')?.querySelector('.confidential-icon')?.textContent).toBe('lock');
    expect(getCell(0, 'available')?.querySelector('.boolean-icon')?.textContent).toBe('check_box');

    // Toggle confidential via updateRow (simulating onCellActivate flow)
    grid.updateRow('row-1', { confidential: false });
    await nextFrame();
    await nextFrame();

    expect(getCell(0, 'confidential')?.querySelector('.confidential-icon')?.textContent).toBe('lock_open');

    // Toggle available via updateRow
    grid.updateRow('row-1', { available: false });
    await nextFrame();
    await nextFrame();

    expect(getCell(0, 'available')?.querySelector('.boolean-icon')?.textContent).toBe('check_box_outline_blank');

    // Verify row class changes too
    const row1 = grid.querySelectorAll('.data-grid-row')[0] as HTMLElement;
    expect(row1.classList.contains('confidential-cargo')).toBe(false);

    // Toggle back
    grid.updateRow('row-1', { confidential: true });
    await nextFrame();
    await nextFrame();

    expect(getCell(0, 'confidential')?.querySelector('.confidential-icon')?.textContent).toBe('lock');
    expect(row1.classList.contains('confidential-cargo')).toBe(true);
  });
});
