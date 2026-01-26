import { describe, expect, it, vi } from 'vitest';

// Mock the columns module to provide addPart
vi.mock('./columns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./columns')>();
  return {
    ...actual,
    addPart: (el: Element, part: string) => {
      const current = el.getAttribute('part') || '';
      el.setAttribute('part', current ? `${current} ${part}` : part);
    },
  };
});

import { renderHeader } from './header';

/**
 * Creates a minimal InternalGrid mock for header tests.
 */
function makeGrid(opts: Partial<any> = {}) {
  const host = document.createElement('div');
  host.innerHTML = '<div class="header-row"></div><div class="rows"></div>';
  const grid: any = {
    _rows: opts.rows || [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ],
    _columns: opts.columns || [
      { field: 'id', sortable: true },
      { field: 'name', resizable: true },
    ],
    get _visibleColumns() {
      return this._columns.filter((c: any) => !c.hidden);
    },
    _headerRowEl: host.querySelector('.header-row') as HTMLElement,
    _bodyEl: host.querySelector('.rows') as HTMLElement,
    _rowPool: [],
    _sortState: opts._sortState || null,
    findHeaderRow: function () {
      return this._headerRowEl;
    },
    _resizeController: {
      start: () => {
        /* empty */
      },
    },
    dispatchEvent: () => {
      /* empty */
    },
    _dispatchHeaderClick: () => false,
    refreshVirtualWindow: () => {
      /* empty */
    },
  };
  return grid;
}

describe('renderHeader', () => {
  it('creates header cells for each column', () => {
    const g = makeGrid();
    renderHeader(g);
    const cells = g._headerRowEl.querySelectorAll('.cell');
    expect(cells.length).toBe(2);
  });

  it('sets columnheader role on each cell', () => {
    const g = makeGrid();
    renderHeader(g);
    const cells = g._headerRowEl.querySelectorAll('.cell');
    cells.forEach((cell: Element) => {
      expect(cell.getAttribute('role')).toBe('columnheader');
    });
  });

  it('sets aria-colindex (1-based) on each cell', () => {
    const g = makeGrid();
    renderHeader(g);
    const cells = g._headerRowEl.querySelectorAll('.cell');
    expect(cells[0].getAttribute('aria-colindex')).toBe('1');
    expect(cells[1].getAttribute('aria-colindex')).toBe('2');
  });

  it('sets data-field attribute on each cell', () => {
    const g = makeGrid();
    renderHeader(g);
    const cells = g._headerRowEl.querySelectorAll('.cell');
    expect(cells[0].getAttribute('data-field')).toBe('id');
    expect(cells[1].getAttribute('data-field')).toBe('name');
  });

  it('sets data-col attribute on each cell', () => {
    const g = makeGrid();
    renderHeader(g);
    const cells = g._headerRowEl.querySelectorAll('.cell');
    expect(cells[0].getAttribute('data-col')).toBe('0');
    expect(cells[1].getAttribute('data-col')).toBe('1');
  });

  it('displays column header text or field name', () => {
    const g = makeGrid({
      columns: [
        { field: 'id', header: 'ID' },
        { field: 'name' }, // no header, should use field
      ],
    });
    renderHeader(g);
    const cells = g._headerRowEl.querySelectorAll('.cell');
    expect(cells[0].textContent).toContain('ID');
    expect(cells[1].textContent).toContain('name');
  });

  it('renders custom header template when provided', () => {
    const tpl = document.createElement('div');
    tpl.innerHTML = '<strong>Custom</strong>';
    const g = makeGrid({
      columns: [{ field: 'id', __headerTemplate: tpl }],
    });
    renderHeader(g);
    const cell = g._headerRowEl.querySelector('.cell');
    expect(cell.querySelector('strong')).toBeTruthy();
    expect(cell.textContent).toContain('Custom');
  });

  describe('sortable columns', () => {
    it('adds sortable class to sortable columns', () => {
      const g = makeGrid({ columns: [{ field: 'id', sortable: true }] });
      renderHeader(g);
      const cell = g._headerRowEl.querySelector('.cell');
      expect(cell.classList.contains('sortable')).toBe(true);
    });

    it('makes sortable cells focusable', () => {
      const g = makeGrid({ columns: [{ field: 'id', sortable: true }] });
      renderHeader(g);
      const cell = g._headerRowEl.querySelector('.cell');
      expect(cell.tabIndex).toBe(0);
    });

    it('adds sort indicator span', () => {
      const g = makeGrid({ columns: [{ field: 'id', sortable: true }] });
      renderHeader(g);
      const indicator = g._headerRowEl.querySelector('[part="sort-indicator"]');
      expect(indicator).toBeTruthy();
    });

    it('shows neutral indicator when not sorted', () => {
      const g = makeGrid({ columns: [{ field: 'id', sortable: true }] });
      renderHeader(g);
      const indicator = g._headerRowEl.querySelector('[part="sort-indicator"]');
      expect(indicator.textContent).toBe('⇅');
    });

    it('shows ascending indicator when sorted asc', () => {
      const g = makeGrid({
        columns: [{ field: 'id', sortable: true }],
        _sortState: { field: 'id', direction: 1 },
      });
      renderHeader(g);
      const indicator = g._headerRowEl.querySelector('[part="sort-indicator"]');
      expect(indicator.textContent).toBe('▲');
    });

    it('shows descending indicator when sorted desc', () => {
      const g = makeGrid({
        columns: [{ field: 'id', sortable: true }],
        _sortState: { field: 'id', direction: -1 },
      });
      renderHeader(g);
      const indicator = g._headerRowEl.querySelector('[part="sort-indicator"]');
      expect(indicator.textContent).toBe('▼');
    });

    it('sets aria-sort=none when not sorted', () => {
      const g = makeGrid({ columns: [{ field: 'id', sortable: true }] });
      renderHeader(g);
      const cell = g._headerRowEl.querySelector('.cell');
      expect(cell.getAttribute('aria-sort')).toBe('none');
    });

    it('sets aria-sort=ascending when sorted asc', () => {
      const g = makeGrid({
        columns: [{ field: 'id', sortable: true }],
        _sortState: { field: 'id', direction: 1 },
      });
      renderHeader(g);
      const cell = g._headerRowEl.querySelector('.cell');
      expect(cell.getAttribute('aria-sort')).toBe('ascending');
    });

    it('sets aria-sort=descending when sorted desc', () => {
      const g = makeGrid({
        columns: [{ field: 'id', sortable: true }],
        _sortState: { field: 'id', direction: -1 },
      });
      renderHeader(g);
      const cell = g._headerRowEl.querySelector('.cell');
      expect(cell.getAttribute('aria-sort')).toBe('descending');
    });
  });

  describe('resizable columns', () => {
    it('adds resize handle to resizable columns', () => {
      const g = makeGrid({ columns: [{ field: 'name', resizable: true }] });
      renderHeader(g);
      const handle = g._headerRowEl.querySelector('.resize-handle');
      expect(handle).toBeTruthy();
    });

    it('resize handle has aria-hidden', () => {
      const g = makeGrid({ columns: [{ field: 'name', resizable: true }] });
      renderHeader(g);
      const handle = g._headerRowEl.querySelector('.resize-handle');
      expect(handle.getAttribute('aria-hidden')).toBe('true');
    });

    it('adds resizable class on resizable cells for positioning context', () => {
      const g = makeGrid({ columns: [{ field: 'name', resizable: true }] });
      renderHeader(g);
      const cell = g._headerRowEl.querySelector('.cell') as HTMLElement;
      expect(cell.classList.contains('resizable')).toBe(true);
    });

    it('adds resizable class on all resizable cells (plugin overrides for sticky)', () => {
      // Core always adds resizable class for resize handle positioning
      // PinnedColumnsPlugin will override to position: sticky when it applies offsets
      const g = makeGrid({ columns: [{ field: 'name', resizable: true, sticky: 'left' }] });
      renderHeader(g);
      const cell = g._headerRowEl.querySelector('.cell') as HTMLElement;
      expect(cell.classList.contains('resizable')).toBe(true);
    });
  });

  // Note: sticky class application is handled by PinnedColumnsPlugin, tested in pinned-columns.spec.ts

  describe('headerLabelRenderer', () => {
    it('uses headerLabelRenderer output for label content', () => {
      const g = makeGrid({
        columns: [
          {
            field: 'id',
            headerLabelRenderer: (ctx: any) => {
              const span = document.createElement('span');
              span.className = 'custom-label';
              span.textContent = `Custom: ${ctx.value}`;
              return span;
            },
          },
        ],
      });
      renderHeader(g);
      const cell = g._headerRowEl.querySelector('.cell');
      const customLabel = cell.querySelector('.custom-label');
      expect(customLabel).toBeTruthy();
      expect(customLabel.textContent).toBe('Custom: id');
    });

    it('adds sort indicator automatically when sortable', () => {
      const g = makeGrid({
        columns: [
          {
            field: 'id',
            sortable: true,
            headerLabelRenderer: () => 'Custom Label',
          },
        ],
      });
      renderHeader(g);
      const indicator = g._headerRowEl.querySelector('[part="sort-indicator"]');
      expect(indicator).toBeTruthy();
    });

    it('adds resize handle automatically when resizable', () => {
      const g = makeGrid({
        columns: [
          {
            field: 'id',
            resizable: true,
            headerLabelRenderer: () => 'Custom Label',
          },
        ],
      });
      renderHeader(g);
      const handle = g._headerRowEl.querySelector('.resize-handle');
      expect(handle).toBeTruthy();
    });

    it('receives correct context with column and value', () => {
      let receivedCtx: any = null;
      const g = makeGrid({
        columns: [
          {
            field: 'id',
            header: 'ID Column',
            headerLabelRenderer: (ctx: any) => {
              receivedCtx = ctx;
              return 'Test';
            },
          },
        ],
      });
      renderHeader(g);
      expect(receivedCtx).toBeTruthy();
      expect(receivedCtx.value).toBe('ID Column');
      expect(receivedCtx.column.field).toBe('id');
    });

    it('handles string return value with sanitization', () => {
      const g = makeGrid({
        columns: [
          {
            field: 'id',
            headerLabelRenderer: () => '<strong>Bold</strong>',
          },
        ],
      });
      renderHeader(g);
      const cell = g._headerRowEl.querySelector('.cell');
      // Sanitized content should be present
      expect(cell.textContent).toContain('Bold');
    });

    it('handles null return value by using default header', () => {
      const g = makeGrid({
        columns: [
          {
            field: 'id',
            header: 'ID',
            headerLabelRenderer: () => null,
          },
        ],
      });
      renderHeader(g);
      const cell = g._headerRowEl.querySelector('.cell');
      expect(cell.textContent).toContain('ID');
    });
  });

  describe('headerRenderer (full control)', () => {
    it('uses headerRenderer output for entire cell content', () => {
      const g = makeGrid({
        columns: [
          {
            field: 'id',
            headerRenderer: (ctx: any) => {
              const div = document.createElement('div');
              div.className = 'fully-custom';
              div.textContent = 'Full Control';
              return div;
            },
          },
        ],
      });
      renderHeader(g);
      const cell = g._headerRowEl.querySelector('.cell');
      const custom = cell.querySelector('.fully-custom');
      expect(custom).toBeTruthy();
      expect(custom.textContent).toBe('Full Control');
    });

    it('does not add sort indicator automatically', () => {
      const g = makeGrid({
        columns: [
          {
            field: 'id',
            sortable: true,
            headerRenderer: () => 'No auto icons',
          },
        ],
      });
      renderHeader(g);
      const indicator = g._headerRowEl.querySelector('[part="sort-indicator"]');
      expect(indicator).toBeFalsy();
    });

    it('provides renderSortIcon helper that creates sort indicator', () => {
      const g = makeGrid({
        columns: [
          {
            field: 'id',
            sortable: true,
            headerRenderer: (ctx: any) => {
              const container = document.createElement('div');
              container.textContent = 'Custom ';
              const icon = ctx.renderSortIcon();
              if (icon) container.appendChild(icon);
              return container;
            },
          },
        ],
      });
      renderHeader(g);
      const indicator = g._headerRowEl.querySelector('[part="sort-indicator"]');
      expect(indicator).toBeTruthy();
    });

    it('provides renderResizeHandle helper', () => {
      const g = makeGrid({
        columns: [
          {
            field: 'id',
            resizable: true,
            headerRenderer: (ctx: any) => {
              const container = document.createElement('div');
              container.textContent = 'Custom ';
              const handle = ctx.renderResizeHandle();
              if (handle) container.appendChild(handle);
              return container;
            },
          },
        ],
      });
      renderHeader(g);
      const handle = g._headerRowEl.querySelector('.resize-handle');
      expect(handle).toBeTruthy();
    });

    it('still sets up sort handlers when sortable', () => {
      const g = makeGrid({
        columns: [
          {
            field: 'id',
            sortable: true,
            headerRenderer: () => 'Click me',
          },
        ],
      });
      renderHeader(g);
      const cell = g._headerRowEl.querySelector('.cell');
      expect(cell.classList.contains('sortable')).toBe(true);
      expect(cell.tabIndex).toBe(0);
    });

    it('receives context with sortState', () => {
      let receivedCtx: any = null;
      const g = makeGrid({
        columns: [
          {
            field: 'id',
            sortable: true,
            headerRenderer: (ctx: any) => {
              receivedCtx = ctx;
              return 'Test';
            },
          },
        ],
        _sortState: { field: 'id', direction: 1 },
      });
      renderHeader(g);
      expect(receivedCtx).toBeTruthy();
      expect(receivedCtx.sortState).toBe('asc');
    });

    it('receives context with cellEl reference', () => {
      let receivedCtx: any = null;
      const g = makeGrid({
        columns: [
          {
            field: 'id',
            headerRenderer: (ctx: any) => {
              receivedCtx = ctx;
              return 'Test';
            },
          },
        ],
      });
      renderHeader(g);
      expect(receivedCtx.cellEl).toBeTruthy();
      expect(receivedCtx.cellEl.classList.contains('cell')).toBe(true);
    });

    it('renderSortIcon returns null when column is not sortable', () => {
      let sortIcon: any = undefined;
      const g = makeGrid({
        columns: [
          {
            field: 'id',
            sortable: false,
            headerRenderer: (ctx: any) => {
              sortIcon = ctx.renderSortIcon();
              return 'Test';
            },
          },
        ],
      });
      renderHeader(g);
      expect(sortIcon).toBeNull();
    });

    it('takes precedence over headerLabelRenderer', () => {
      const g = makeGrid({
        columns: [
          {
            field: 'id',
            headerRenderer: () => {
              const span = document.createElement('span');
              span.className = 'full-renderer';
              return span;
            },
            headerLabelRenderer: () => {
              const span = document.createElement('span');
              span.className = 'label-renderer';
              return span;
            },
          },
        ],
      });
      renderHeader(g);
      const cell = g._headerRowEl.querySelector('.cell');
      expect(cell.querySelector('.full-renderer')).toBeTruthy();
      expect(cell.querySelector('.label-renderer')).toBeFalsy();
    });
  });

  describe('header row attributes', () => {
    it('sets role=row on header row', () => {
      const g = makeGrid();
      renderHeader(g);
      expect(g._headerRowEl.getAttribute('role')).toBe('row');
    });

    it('sets aria-rowindex=1 on header row', () => {
      const g = makeGrid();
      renderHeader(g);
      expect(g._headerRowEl.getAttribute('aria-rowindex')).toBe('1');
    });
  });
});
