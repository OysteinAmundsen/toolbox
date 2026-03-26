import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ColumnConfig } from '../../core/types';
import { TooltipPlugin } from './TooltipPlugin';

// #region Mock Grid
function createMockGrid(overrides: Record<string, unknown> = {}) {
  const root = document.createElement('div');
  root.className = 'tbw-grid-root';

  const gridEl = document.createElement('div');
  gridEl.appendChild(root);
  document.body.appendChild(gridEl);

  return {
    rows: [],
    sourceRows: [],
    columns: [],
    _visibleColumns: [],
    effectiveConfig: {},
    gridConfig: {},
    getPlugin: () => undefined,
    getPluginByName: () => undefined,
    query: () => [],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
    requestRender: vi.fn(),
    querySelector: (sel: string) => gridEl.querySelector(sel),
    querySelectorAll: (sel: string) => gridEl.querySelectorAll(sel),
    children: [root],
    clientWidth: 800,
    classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn(() => false) },
    _hostElement: gridEl,
    _root: root,
    ...overrides,
  };
}
// #endregion

// #region Helpers
function createHeaderCell(field: string, colIndex: number, text: string, overflow = false): HTMLElement {
  const cell = document.createElement('div');
  cell.setAttribute('part', 'header-cell');
  cell.setAttribute('data-field', field);
  cell.setAttribute('data-col', String(colIndex));

  const span = document.createElement('span');
  span.textContent = text;
  cell.appendChild(span);

  if (overflow) {
    Object.defineProperty(span, 'scrollWidth', { value: 200, configurable: true });
    Object.defineProperty(span, 'clientWidth', { value: 100, configurable: true });
  }

  return cell;
}

function createDataCell(rowIndex: number, colIndex: number, text: string, overflow = false): HTMLElement {
  const cell = document.createElement('div');
  cell.setAttribute('data-row', String(rowIndex));
  cell.setAttribute('data-col', String(colIndex));
  cell.textContent = text;

  if (overflow) {
    Object.defineProperty(cell, 'scrollWidth', { value: 200, configurable: true });
    Object.defineProperty(cell, 'clientWidth', { value: 100, configurable: true });
  }

  return cell;
}

/** Get the shared popover element created by the plugin. */
function getPopover(): HTMLElement | null {
  return document.querySelector('.tbw-tooltip-popover');
}
// #endregion

describe('TooltipPlugin', () => {
  let plugin: TooltipPlugin;
  let grid: ReturnType<typeof createMockGrid>;

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    plugin?.detach();
    document.body.innerHTML = '';
  });

  // #region Basic Plugin Tests
  it('should have correct name', () => {
    plugin = new TooltipPlugin();
    expect(plugin.name).toBe('tooltip');
  });

  it('should attach and detach cleanly', () => {
    plugin = new TooltipPlugin();
    grid = createMockGrid();
    plugin.attach(grid as any);
    plugin.detach();
  });

  it('should create a popover element after first render', () => {
    grid = createMockGrid();
    plugin = new TooltipPlugin();
    plugin.attach(grid as any);

    expect(getPopover()).toBeNull();
    plugin.afterRender();
    expect(getPopover()).not.toBeNull();
    expect(getPopover()!.getAttribute('popover')).toBe('hint');
  });

  it('should remove popover element on detach', () => {
    grid = createMockGrid();
    plugin = new TooltipPlugin();
    plugin.attach(grid as any);
    plugin.afterRender();

    expect(getPopover()).not.toBeNull();
    plugin.detach();
    expect(getPopover()).toBeNull();
  });

  it('should inject CSS via styles property', () => {
    plugin = new TooltipPlugin();
    expect(plugin.styles).toBeDefined();
    expect(typeof plugin.styles).toBe('string');
  });
  // #endregion

  // #region Header Tooltip Tests
  describe('header tooltips', () => {
    it('should show popover on overflowing header', () => {
      const columns: ColumnConfig[] = [{ field: 'name', header: 'Full Name' }];
      grid = createMockGrid({ _visibleColumns: columns });
      plugin = new TooltipPlugin();
      plugin.attach(grid as any);

      const headerCell = createHeaderCell('name', 0, 'Full Name', true);
      (grid as any)._root.appendChild(headerCell);

      plugin.afterRender();
      headerCell.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

      const popover = getPopover();
      expect(popover).not.toBeNull();
      expect(popover!.textContent).toBe('Full Name');
    });

    it('should not show tooltip on non-overflowing header', () => {
      const columns: ColumnConfig[] = [{ field: 'name', header: 'Name' }];
      grid = createMockGrid({ _visibleColumns: columns });
      plugin = new TooltipPlugin();
      plugin.attach(grid as any);

      const headerCell = createHeaderCell('name', 0, 'Name', false);
      (grid as any)._root.appendChild(headerCell);

      plugin.afterRender();
      headerCell.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

      const popover = getPopover();
      // Popover exists but should have no text set (no showPopover in happy-dom)
      expect(popover!.textContent).toBe('');
    });

    it('should show static headerTooltip regardless of overflow', () => {
      const columns: ColumnConfig[] = [{ field: 'revenue', header: 'Rev', headerTooltip: 'Total revenue in USD' }];
      grid = createMockGrid({ _visibleColumns: columns });
      plugin = new TooltipPlugin();
      plugin.attach(grid as any);

      const headerCell = createHeaderCell('revenue', 0, 'Rev', false);
      (grid as any)._root.appendChild(headerCell);

      plugin.afterRender();
      headerCell.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

      expect(getPopover()!.textContent).toBe('Total revenue in USD');
    });

    it('should support dynamic headerTooltip function', () => {
      const columns: ColumnConfig[] = [
        {
          field: 'price',
          header: 'Price',
          headerTooltip: (ctx) => `${ctx.value} (sortable)`,
        },
      ];
      grid = createMockGrid({ _visibleColumns: columns });
      plugin = new TooltipPlugin();
      plugin.attach(grid as any);

      const headerCell = createHeaderCell('price', 0, 'Price', false);
      (grid as any)._root.appendChild(headerCell);

      plugin.afterRender();
      headerCell.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

      expect(getPopover()!.textContent).toBe('Price (sortable)');
    });

    it('should suppress header tooltip when headerTooltip is false', () => {
      const columns: ColumnConfig[] = [{ field: 'id', header: 'ID', headerTooltip: false }];
      grid = createMockGrid({ _visibleColumns: columns });
      plugin = new TooltipPlugin();
      plugin.attach(grid as any);

      const headerCell = createHeaderCell('id', 0, 'ID', true);
      (grid as any)._root.appendChild(headerCell);

      plugin.afterRender();
      headerCell.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

      // Popover exists but should have no text (tooltip suppressed)
      expect(getPopover()!.textContent).toBe('');
    });

    it('should not show header tooltips when header option is false', () => {
      const columns: ColumnConfig[] = [{ field: 'name', header: 'Full Name' }];
      grid = createMockGrid({ _visibleColumns: columns });
      plugin = new TooltipPlugin({ header: false });
      plugin.attach(grid as any);

      const headerCell = createHeaderCell('name', 0, 'Full Name', true);
      (grid as any)._root.appendChild(headerCell);

      plugin.afterRender();
      headerCell.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

      expect(getPopover()!.textContent).toBe('');
    });
  });
  // #endregion

  // #region Cell Tooltip Tests
  describe('cell tooltips', () => {
    it('should show popover on overflowing cell', () => {
      const columns: ColumnConfig[] = [{ field: 'name' }];
      const rows = [{ name: 'Alice Anderson' }];
      grid = createMockGrid({ _visibleColumns: columns, rows });
      plugin = new TooltipPlugin();
      plugin.attach(grid as any);

      const cell = createDataCell(0, 0, 'Alice Anderson', true);
      (grid as any)._root.appendChild(cell);

      plugin.afterRender();
      cell.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

      expect(getPopover()!.textContent).toBe('Alice Anderson');
    });

    it('should not show tooltip on non-overflowing cell', () => {
      const columns: ColumnConfig[] = [{ field: 'name' }];
      const rows = [{ name: 'Ali' }];
      grid = createMockGrid({ _visibleColumns: columns, rows });
      plugin = new TooltipPlugin();
      plugin.attach(grid as any);

      const cell = createDataCell(0, 0, 'Ali', false);
      (grid as any)._root.appendChild(cell);

      plugin.afterRender();
      cell.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

      expect(getPopover()!.textContent).toBe('');
    });

    it('should show static cellTooltip regardless of overflow', () => {
      const columns: ColumnConfig[] = [{ field: 'status', cellTooltip: 'Current status of this record' }];
      const rows = [{ status: 'Active' }];
      grid = createMockGrid({ _visibleColumns: columns, rows });
      plugin = new TooltipPlugin();
      plugin.attach(grid as any);

      const cell = createDataCell(0, 0, 'Active', false);
      (grid as any)._root.appendChild(cell);

      plugin.afterRender();
      cell.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

      expect(getPopover()!.textContent).toBe('Current status of this record');
    });

    it('should support dynamic cellTooltip function with row data', () => {
      const columns: ColumnConfig[] = [
        {
          field: 'name',
          cellTooltip: (ctx: any) => `${ctx.row.first} ${ctx.row.last}\nDept: ${ctx.row.dept}`,
        },
      ];
      const rows = [{ name: 'A. Smith', first: 'Alice', last: 'Smith', dept: 'Engineering' }];
      grid = createMockGrid({ _visibleColumns: columns, rows });
      plugin = new TooltipPlugin();
      plugin.attach(grid as any);

      const cell = createDataCell(0, 0, 'A. Smith', false);
      (grid as any)._root.appendChild(cell);

      plugin.afterRender();
      cell.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

      expect(getPopover()!.textContent).toBe('Alice Smith\nDept: Engineering');
    });

    it('should suppress cell tooltip when cellTooltip is false', () => {
      const columns: ColumnConfig[] = [{ field: 'actions', cellTooltip: false }];
      const rows = [{ actions: 'Edit | Delete' }];
      grid = createMockGrid({ _visibleColumns: columns, rows });
      plugin = new TooltipPlugin();
      plugin.attach(grid as any);

      const cell = createDataCell(0, 0, 'Edit | Delete', true);
      (grid as any)._root.appendChild(cell);

      plugin.afterRender();
      cell.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

      expect(getPopover()!.textContent).toBe('');
    });

    it('should suppress when dynamic function returns null', () => {
      const columns: ColumnConfig[] = [{ field: 'name', cellTooltip: () => null }];
      const rows = [{ name: 'Alice' }];
      grid = createMockGrid({ _visibleColumns: columns, rows });
      plugin = new TooltipPlugin();
      plugin.attach(grid as any);

      const cell = createDataCell(0, 0, 'Alice', true);
      (grid as any)._root.appendChild(cell);

      plugin.afterRender();
      cell.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

      expect(getPopover()!.textContent).toBe('');
    });

    it('should not show cell tooltips when cell option is false', () => {
      const columns: ColumnConfig[] = [{ field: 'name' }];
      const rows = [{ name: 'Alice Anderson' }];
      grid = createMockGrid({ _visibleColumns: columns, rows });
      plugin = new TooltipPlugin({ cell: false });
      plugin.attach(grid as any);

      const cell = createDataCell(0, 0, 'Alice Anderson', true);
      (grid as any)._root.appendChild(cell);

      plugin.afterRender();
      cell.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

      expect(getPopover()!.textContent).toBe('');
    });
  });
  // #endregion

  // #region Anchor Positioning Tests
  describe('CSS anchor positioning', () => {
    it('should set anchor-name on hovered cell', () => {
      const columns: ColumnConfig[] = [{ field: 'name' }];
      const rows = [{ name: 'Long text that overflows the cell container' }];
      grid = createMockGrid({ _visibleColumns: columns, rows });
      plugin = new TooltipPlugin();
      plugin.attach(grid as any);

      const cell = createDataCell(0, 0, 'Long text that overflows the cell container', true);
      (grid as any)._root.appendChild(cell);

      plugin.afterRender();
      cell.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

      expect(cell.style.getPropertyValue('anchor-name')).toBe('--tbw-tooltip-anchor');
    });

    it('should clear anchor-name on mouseout', () => {
      const columns: ColumnConfig[] = [{ field: 'name' }];
      const rows = [{ name: 'Long text' }];
      grid = createMockGrid({ _visibleColumns: columns, rows });
      plugin = new TooltipPlugin();
      plugin.attach(grid as any);

      const cell = createDataCell(0, 0, 'Long text', true);
      (grid as any)._root.appendChild(cell);

      plugin.afterRender();

      // Show tooltip
      cell.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      expect(cell.style.getPropertyValue('anchor-name')).toBe('--tbw-tooltip-anchor');

      // Hide tooltip
      cell.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: (grid as any)._root }));
      expect(cell.style.getPropertyValue('anchor-name')).toBe('');
    });
  });
  // #endregion

  // #region Cleanup Tests
  describe('cleanup', () => {
    it('should clear popover content on mouseout', () => {
      const columns: ColumnConfig[] = [{ field: 'name' }];
      const rows = [{ name: 'Alice Anderson' }];
      grid = createMockGrid({ _visibleColumns: columns, rows });
      plugin = new TooltipPlugin();
      plugin.attach(grid as any);

      const cell = createDataCell(0, 0, 'Alice Anderson', true);
      (grid as any)._root.appendChild(cell);

      plugin.afterRender();

      // Show tooltip
      cell.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      expect(getPopover()!.textContent).toBe('Alice Anderson');

      // Hide tooltip — relatedTarget outside the cell
      cell.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: (grid as any)._root }));

      // Anchor cleared
      expect(cell.style.getPropertyValue('anchor-name')).toBe('');
    });
  });
  // #endregion
});
