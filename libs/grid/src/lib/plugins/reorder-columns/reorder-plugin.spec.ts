/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReorderPlugin } from './reorder-plugin';
import type { ColumnMoveDetail } from './types';

function createGridMock(columns: any[] = []) {
  const gridEl = document.createElement('div');
  // Create header row with cells
  const headerRow = document.createElement('div');
  headerRow.className = 'header-row';
  for (const col of columns) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.setAttribute('data-field', col.field);
    headerRow.appendChild(cell);
  }
  gridEl.appendChild(headerRow);

  const columnOrder = columns.map((c: any) => c.field);

  return {
    rows: [],
    sourceRows: [],
    columns,
    _visibleColumns: columns.filter((c: any) => !c.hidden),
    _hostElement: gridEl,
    _focusRow: 0,
    _focusCol: 0,
    gridConfig: {},
    effectiveConfig: {} as { a11y?: { dragAlternatives?: 'menu' | 'inline' } },
    getPlugin: () => undefined,
    getPluginByName: (() => undefined) as (name: string) => unknown,
    query: vi.fn(() => []),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
    requestRender: vi.fn(),
    requestStateChange: vi.fn(),
    requestAfterRender: vi.fn(),
    refreshVirtualWindow: vi.fn(),
    _activeEditRows: -1,
    _bodyEl: gridEl,
    _virtualization: { start: 0, end: 100, enabled: false },
    _rows: [],
    setColumnOrder: vi.fn((order: string[]) => {
      columnOrder.splice(0, columnOrder.length, ...order);
    }),
    getColumnOrder: vi.fn(() => [...columnOrder]),
    forceLayout: vi.fn(() => Promise.resolve()),
    children: [gridEl],
    querySelectorAll: (sel: string) => gridEl.querySelectorAll(sel),
    querySelector: (sel: string) => gridEl.querySelector(sel),
    clientWidth: 800,
    classList: { add: vi.fn(), remove: vi.fn() },
    disconnectSignal: new AbortController().signal,
  };
}

const sampleColumns = [
  { field: 'id', header: 'ID' },
  { field: 'name', header: 'Name' },
  { field: 'email', header: 'Email' },
  { field: 'city', header: 'City' },
];

describe('ReorderPlugin (class)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('constructor & defaults', () => {
    it('should have name "reorderColumns"', () => {
      const plugin = new ReorderPlugin();
      expect(plugin.name).toBe('reorderColumns');
    });

    it('should have alias "reorder"', () => {
      const plugin = new ReorderPlugin();
      expect(plugin.aliases).toContain('reorder');
    });
  });

  describe('getColumnOrder', () => {
    it('should return current column order from grid', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock(sampleColumns);
      plugin.attach(grid as any);

      const order = plugin.getColumnOrder();
      expect(order).toEqual(['id', 'name', 'email', 'city']);
    });
  });

  describe('moveColumn', () => {
    it('should emit column-move event with correct detail', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock(sampleColumns);
      plugin.attach(grid as any);

      plugin.moveColumn('name', 3);

      expect(grid.dispatchEvent).toHaveBeenCalled();
      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<ColumnMoveDetail>;
      expect(event.type).toBe('column-move');
      expect(event.detail.field).toBe('name');
      expect(event.detail.fromIndex).toBe(1);
      expect(event.detail.toIndex).toBe(3);
      expect(event.detail.columnOrder).toBeDefined();
    });

    it('should update column order when event is not cancelled', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock(sampleColumns);
      grid.dispatchEvent = vi.fn(() => true); // Not cancelled
      plugin.attach(grid as any);

      plugin.moveColumn('id', 2);

      expect(grid.setColumnOrder).toHaveBeenCalled();
    });

    it('should not update column order when event is cancelled', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock(sampleColumns);
      grid.dispatchEvent = vi.fn((event: Event) => {
        event.preventDefault();
        return false;
      });
      plugin.attach(grid as any);

      plugin.moveColumn('id', 2);

      expect(grid.setColumnOrder).not.toHaveBeenCalled();
    });

    it('should not move when field is not found', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock(sampleColumns);
      plugin.attach(grid as any);

      plugin.moveColumn('nonexistent', 2);

      expect(grid.dispatchEvent).not.toHaveBeenCalled();
    });
  });

  describe('setColumnOrder', () => {
    it('should update grid column order directly', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock(sampleColumns);
      plugin.attach(grid as any);

      plugin.setColumnOrder(['city', 'name', 'email', 'id']);

      expect(grid.setColumnOrder).toHaveBeenCalledWith(['city', 'name', 'email', 'id']);
    });
  });

  describe('resetColumnOrder', () => {
    it('should reset to original column order', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock(sampleColumns);
      plugin.attach(grid as any);

      plugin.resetColumnOrder();

      expect(grid.setColumnOrder).toHaveBeenCalledWith(['id', 'name', 'email', 'city']);
    });
  });

  describe('onKeyDown', () => {
    it('should handle Alt+ArrowRight to move column right', () => {
      const plugin = new ReorderPlugin();
      const columns = [
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name' },
        { field: 'email', header: 'Email' },
      ];
      const grid = createGridMock(columns);
      grid._focusCol = 0;
      plugin.attach(grid as any);

      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: vi.fn() });

      const result = plugin.onKeyDown(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should handle Alt+ArrowLeft to move column left', () => {
      const plugin = new ReorderPlugin();
      const columns = [
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name' },
        { field: 'email', header: 'Email' },
      ];
      const grid = createGridMock(columns);
      grid._focusCol = 2;
      plugin.attach(grid as any);

      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: vi.fn() });

      const result = plugin.onKeyDown(event);

      expect(result).toBe(true);
    });

    it('should not move when Alt is not pressed', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock(sampleColumns);
      grid._focusCol = 1;
      plugin.attach(grid as any);

      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: false });
      const result = plugin.onKeyDown(event);

      expect(result).toBeUndefined();
    });

    it('should not move for non-arrow keys', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock(sampleColumns);
      grid._focusCol = 1;
      plugin.attach(grid as any);

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true });
      const result = plugin.onKeyDown(event);

      expect(result).toBeUndefined();
    });

    it('should not move column left when at leftmost position', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock(sampleColumns);
      grid._focusCol = 0;
      plugin.attach(grid as any);

      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true });
      const result = plugin.onKeyDown(event);

      expect(result).toBeUndefined();
    });

    it('should not move column right when at rightmost position', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock(sampleColumns);
      grid._focusCol = 3; // Last column
      plugin.attach(grid as any);

      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true });
      const result = plugin.onKeyDown(event);

      expect(result).toBeUndefined();
    });

    it('should not move locked columns', () => {
      const plugin = new ReorderPlugin();
      const columns = [
        { field: 'id', header: 'ID', meta: { lockPosition: true } },
        { field: 'name', header: 'Name' },
      ];
      const grid = createGridMock(columns);
      grid._focusCol = 0;
      plugin.attach(grid as any);

      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true });
      const result = plugin.onKeyDown(event);

      expect(result).toBeUndefined();
    });

    it('should respect plugin query responses (e.g., pinned columns)', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock(sampleColumns);
      grid._focusCol = 1;
      // Simulate a plugin responding with false (e.g., PinnedColumnsPlugin)
      grid.query = vi.fn(() => [false]);
      plugin.attach(grid as any);

      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true });
      const result = plugin.onKeyDown(event);

      expect(result).toBeUndefined();
    });
  });

  describe('afterRender (drag setup)', () => {
    it('should set draggable=true on movable header cells', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock(sampleColumns);
      plugin.attach(grid as any);

      plugin.afterRender();

      const headers = grid._hostElement.querySelectorAll('.header-row > .cell');
      headers.forEach((h) => {
        expect((h as HTMLElement).draggable).toBe(true);
      });
    });

    it('should not set draggable on locked columns', () => {
      const columns = [
        { field: 'id', header: 'ID', meta: { lockPosition: true } },
        { field: 'name', header: 'Name' },
      ];
      const plugin = new ReorderPlugin();
      const grid = createGridMock(columns);
      plugin.attach(grid as any);

      plugin.afterRender();

      const idCell = grid._hostElement.querySelector('.cell[data-field="id"]') as HTMLElement;
      expect(idCell.draggable).toBe(false);

      const nameCell = grid._hostElement.querySelector('.cell[data-field="name"]') as HTMLElement;
      expect(nameCell.draggable).toBe(true);
    });
  });

  /**
   * WCAG 2.2 SC 2.5.7 "Dragging Movements". The `Alt + Arrow` shortcuts satisfy
   * SC 2.1.1 but not 2.5.7 — that criterion needs controls a pointer user can
   * click or tap, not a keyboard equivalent. The criterion does not require the
   * alternative to be *visible*, so the default path is the header's context
   * menu (right-click, long-press, Shift+F10) and no header width is spent.
   */
  describe('click-only move controls (SC 2.5.7)', () => {
    const moveButton = (grid: ReturnType<typeof createGridMock>, field: string) =>
      grid._hostElement.querySelector<HTMLButtonElement>(`.cell[data-field="${field}"] > .tbw-col-move-btn`);

    const menu = () => document.getElementById('tbw-col-move-menu');

    const items = () => Array.from(menu()?.querySelectorAll<HTMLButtonElement>('button') ?? []);

    const item = (label: string) => items().find((b) => b.textContent === label);

    const headerCell = (grid: ReturnType<typeof createGridMock>, field: string) =>
      grid._hostElement.querySelector(`.cell[data-field="${field}"]`) as HTMLElement;

    /** Right-click a header — the always-available pointer alternative. */
    const openMenu = (grid: ReturnType<typeof createGridMock>, field: string) => {
      headerCell(grid, field).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      return items();
    };

    const inlineGrid = (columns: any[] = sampleColumns) => {
      const grid = createGridMock(columns);
      grid.effectiveConfig.a11y = { dragAlternatives: 'inline' };
      return grid;
    };

    afterEach(() => {
      menu()?.remove();
    });

    it('spends no header width by default', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock(sampleColumns);
      plugin.attach(grid as any);

      plugin.afterRender();

      expect(moveButton(grid, 'name')).toBeNull();
    });

    it('opens a named menu of plain buttons from the header context menu', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock(sampleColumns);
      plugin.attach(grid as any);
      plugin.afterRender();

      const actions = openMenu(grid, 'name');

      expect(menu()?.getAttribute('aria-label')).toBe('Move column Name');
      expect(actions.map((b) => b.textContent)).toEqual(['Move left', 'Move right', 'Move to start', 'Move to end']);
    });

    it('moves the column one position per activation', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock(sampleColumns);
      plugin.attach(grid as any);
      plugin.afterRender();

      openMenu(grid, 'name');
      item('Move right')!.click();
      expect(grid.getColumnOrder()).toEqual(['id', 'email', 'name', 'city']);

      openMenu(grid, 'name');
      item('Move left')!.click();
      expect(grid.getColumnOrder()).toEqual(['id', 'name', 'email', 'city']);
    });

    it('jumps to either end', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock(sampleColumns);
      plugin.attach(grid as any);
      plugin.afterRender();

      openMenu(grid, 'name');
      item('Move to end')!.click();
      expect(grid.getColumnOrder()).toEqual(['id', 'email', 'city', 'name']);
    });

    it('disables the directions that would run off the edge', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock(sampleColumns);
      plugin.attach(grid as any);
      plugin.afterRender();

      openMenu(grid, 'id');
      expect(item('Move left')!.disabled).toBe(true);
      expect(item('Move to start')!.disabled).toBe(true);
      expect(item('Move right')!.disabled).toBe(false);

      openMenu(grid, 'city');
      expect(item('Move right')!.disabled).toBe(true);
      expect(item('Move to end')!.disabled).toBe(true);
    });

    it('offers nothing for a locked column', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock([{ field: 'id', header: 'ID', meta: { lockPosition: true } }, ...sampleColumns]);
      plugin.attach(grid as any);
      plugin.afterRender();

      openMenu(grid, 'id');

      expect(menu()).toBeNull();
    });

    it('yields to the context menu plugin rather than stacking a second menu', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock(sampleColumns);
      plugin.attach(grid as any);
      plugin.afterRender();
      grid.getPluginByName = () => ({});

      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      headerCell(grid, 'name').dispatchEvent(event);

      expect(menu()).toBeNull();
      expect(event.defaultPrevented).toBe(false);
    });

    it('contributes the same actions to the context menu plugin', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock(sampleColumns);
      plugin.attach(grid as any);
      plugin.afterRender();

      const contributed = plugin.handleQuery({
        type: 'getContextMenuItems',
        context: { isHeader: true, field: 'name' },
      } as any) as Array<{ label: string; disabled?: boolean }>;

      expect(contributed.map((i) => i.label)).toEqual(['Move left', 'Move right', 'Move to start', 'Move to end']);
      // A cell right-click is not a column operation.
      expect(plugin.handleQuery({ type: 'getContextMenuItems', context: { isHeader: false } } as any)).toBeUndefined();
    });

    describe("a11y.dragAlternatives: 'inline'", () => {
      it('renders a labelled move button on every movable header', () => {
        const plugin = new ReorderPlugin();
        const grid = inlineGrid();
        plugin.attach(grid as any);

        plugin.afterRender();

        const btn = moveButton(grid, 'name');
        expect(btn).not.toBeNull();
        expect(btn!.getAttribute('aria-label')).toBe('Move column Name');
        // Out of the tab order — Alt+Arrow is the keyboard path, and one extra
        // tab stop per column would swamp header navigation.
        expect(btn!.tabIndex).toBe(-1);
      });

      it('places the button in the header flow so it cannot cover the sort target', () => {
        const plugin = new ReorderPlugin();
        const grid = inlineGrid();
        plugin.attach(grid as any);

        plugin.afterRender();

        const cell = headerCell(grid, 'name');
        // The button is the last child, a sibling of the label — not an overlay.
        expect(cell.lastElementChild).toBe(moveButton(grid, 'name'));
      });

      it('does not render a control for a locked column', () => {
        const plugin = new ReorderPlugin();
        const grid = inlineGrid([{ field: 'id', header: 'ID', meta: { lockPosition: true } }, ...sampleColumns]);
        plugin.attach(grid as any);

        plugin.afterRender();

        expect(moveButton(grid, 'id')).toBeNull();
      });

      it('is idempotent across renders', () => {
        const plugin = new ReorderPlugin();
        const grid = inlineGrid();
        plugin.attach(grid as any);

        plugin.afterRender();
        plugin.afterRender();
        plugin.afterRender();

        expect(grid._hostElement.querySelectorAll('.cell[data-field="name"] > .tbw-col-move-btn').length).toBe(1);
      });

      it('reclaims the header width when the mode is turned off again', () => {
        const plugin = new ReorderPlugin();
        const grid = inlineGrid();
        plugin.attach(grid as any);
        plugin.afterRender();

        grid.effectiveConfig.a11y = { dragAlternatives: 'menu' };
        plugin.afterRender();

        expect(moveButton(grid, 'name')).toBeNull();
      });

      it('opens the same menu, and does not let the click reach the header sort handler', () => {
        const plugin = new ReorderPlugin();
        const grid = inlineGrid();
        plugin.attach(grid as any);
        plugin.afterRender();

        const onCellClick = vi.fn();
        headerCell(grid, 'name').addEventListener('click', onCellClick);

        moveButton(grid, 'name')!.click();

        expect(items().map((b) => b.textContent)).toEqual(['Move left', 'Move right', 'Move to start', 'Move to end']);
        expect(onCellClick).not.toHaveBeenCalled();
      });
    });
  });

  describe('detach', () => {
    it('should clear internal state on detach', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock(sampleColumns);
      plugin.attach(grid as any);

      plugin.detach();

      // After detach, plugin should be in clean state
      expect(() => plugin.getColumnOrder()).not.toThrow();
    });
  });

  describe('column-reorder-request event', () => {
    it('should handle column-reorder-request events from other plugins', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock(sampleColumns);
      plugin.attach(grid as any);

      // Simulate another plugin dispatching a reorder request
      const requestEvent = new CustomEvent('column-reorder-request', {
        detail: { field: 'name', toIndex: 3 },
        bubbles: true,
      });
      grid._hostElement.dispatchEvent(requestEvent);

      // Should process the reorder request
      expect(grid.dispatchEvent).toHaveBeenCalled();
    });
  });

  describe('animation config', () => {
    it('should default to flip animation', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock(sampleColumns);
      grid.dispatchEvent = vi.fn(() => true);
      plugin.attach(grid as any);

      plugin.moveColumn('id', 2);

      // forceLayout is only called for flip animation
      expect(grid.forceLayout).toHaveBeenCalled();
    });

    it('should use no animation when animation is false', () => {
      const plugin = new ReorderPlugin({ animation: false });
      const grid = createGridMock(sampleColumns);
      grid.dispatchEvent = vi.fn(() => true);
      plugin.attach(grid as any);

      plugin.moveColumn('id', 2);

      // setColumnOrder should be called directly without forceLayout
      expect(grid.setColumnOrder).toHaveBeenCalled();
      expect(grid.forceLayout).not.toHaveBeenCalled();
    });
  });

  // #region Group Header Drag
  describe('group header drag', () => {
    function createGroupedGridMock() {
      const columns = [
        { field: 'id', header: 'ID' },
        { field: 'firstName', header: 'First', meta: { group: 'personal' } },
        { field: 'lastName', header: 'Last', meta: { group: 'personal' } },
        { field: 'dept', header: 'Dept', meta: { group: 'org' } },
        { field: 'title', header: 'Title', meta: { group: 'org' } },
      ];

      const grid = createGridMock(columns);

      // Add a .header-group-row with group header cells
      const groupRow = document.createElement('div');
      groupRow.className = 'header-group-row';

      // Implicit group for 'id' (column 1)
      const implicitCell = document.createElement('div');
      implicitCell.className = 'cell header-group-cell implicit-group';
      implicitCell.setAttribute('data-group', '__implicit__0');
      implicitCell.style.gridColumn = '1 / span 1';
      groupRow.appendChild(implicitCell);

      // Personal group (columns 2-3)
      const personalCell = document.createElement('div');
      personalCell.className = 'cell header-group-cell';
      personalCell.setAttribute('data-group', 'personal');
      personalCell.textContent = 'Personal';
      personalCell.style.gridColumn = '2 / span 2';
      groupRow.appendChild(personalCell);

      // Org group (columns 4-5)
      const orgCell = document.createElement('div');
      orgCell.className = 'cell header-group-cell';
      orgCell.setAttribute('data-group', 'org');
      orgCell.textContent = 'Organization';
      orgCell.style.gridColumn = '4 / span 2';
      groupRow.appendChild(orgCell);

      // Insert group row before header row
      const headerRow = grid._hostElement.querySelector('.header-row')!;
      grid._hostElement.insertBefore(groupRow, headerRow);

      return { grid, columns };
    }

    it('should make non-implicit group headers draggable after microtask', async () => {
      const { grid } = createGroupedGridMock();
      const plugin = new ReorderPlugin();
      plugin.attach(grid as any);

      plugin.afterRender();

      // setupGroupHeaderDrag is deferred via queueMicrotask
      await new Promise<void>((resolve) => queueMicrotask(resolve));

      const personalHeader = grid._hostElement.querySelector('.cell[data-group="personal"]') as HTMLElement;
      const orgHeader = grid._hostElement.querySelector('.cell[data-group="org"]') as HTMLElement;
      const implicitHeader = grid._hostElement.querySelector('.cell[data-group="__implicit__0"]') as HTMLElement;

      expect(personalHeader.draggable).toBe(true);
      expect(orgHeader.draggable).toBe(true);
      expect(implicitHeader.draggable).toBeFalsy();
    });

    it('should mark group headers with data-group-drag-bound', async () => {
      const { grid } = createGroupedGridMock();
      const plugin = new ReorderPlugin();
      plugin.attach(grid as any);
      plugin.afterRender();
      await new Promise<void>((resolve) => queueMicrotask(resolve));

      const personalHeader = grid._hostElement.querySelector('.cell[data-group="personal"]') as HTMLElement;
      expect(personalHeader.getAttribute('data-group-drag-bound')).toBe('true');
    });

    it('should resolve fragment fields from grid-column style', async () => {
      const { grid } = createGroupedGridMock();
      const plugin = new ReorderPlugin();
      plugin.attach(grid as any);
      plugin.afterRender();
      await new Promise<void>((resolve) => queueMicrotask(resolve));

      // Simulate dragstart on personal group (columns 2-3 → firstName, lastName)
      const personalHeader = grid._hostElement.querySelector('.cell[data-group="personal"]') as HTMLElement;
      const dragstart = new Event('dragstart', { bubbles: true }) as any;
      dragstart.dataTransfer = { effectAllowed: '', setData: vi.fn() };
      personalHeader.dispatchEvent(dragstart);

      // The header should get 'dragging' class
      expect(personalHeader.classList.contains('dragging')).toBe(true);
    });

    it('should move group as block on drop', async () => {
      const { grid } = createGroupedGridMock();
      grid.dispatchEvent = vi.fn(() => true); // Not cancelled
      const plugin = new ReorderPlugin();
      plugin.attach(grid as any);
      plugin.afterRender();
      await new Promise<void>((resolve) => queueMicrotask(resolve));

      const personalHeader = grid._hostElement.querySelector('.cell[data-group="personal"]') as HTMLElement;
      const orgHeader = grid._hostElement.querySelector('.cell[data-group="org"]') as HTMLElement;

      // Dragstart on personal group
      const dragstart = new Event('dragstart', { bubbles: true }) as any;
      dragstart.dataTransfer = { effectAllowed: '', setData: vi.fn() };
      personalHeader.dispatchEvent(dragstart);

      // Drop on org group (right side = after)
      const orgRect = { left: 300, width: 200, top: 0, height: 30 };
      orgHeader.getBoundingClientRect = () => orgRect as DOMRect;

      const dropEvent = new Event('drop', { bubbles: true, cancelable: true }) as any;
      dropEvent.clientX = 450; // Right side of org header → after
      dropEvent.preventDefault = vi.fn();
      orgHeader.dispatchEvent(dropEvent);

      // column-move event should have been dispatched
      expect(grid.dispatchEvent).toHaveBeenCalled();
      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<ColumnMoveDetail>;
      expect(event.type).toBe('column-move');

      // The new order should have personal group after org group:
      // id, dept, title, firstName, lastName
      expect(event.detail.columnOrder).toEqual(['id', 'dept', 'title', 'firstName', 'lastName']);
    });

    it('should not make locked group headers draggable', async () => {
      const columns = [
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name', meta: { group: 'locked', lockPosition: true } },
        { field: 'email', header: 'Email', meta: { group: 'locked', lockPosition: true } },
      ];
      const grid = createGridMock(columns);

      const groupRow = document.createElement('div');
      groupRow.className = 'header-group-row';
      const lockedCell = document.createElement('div');
      lockedCell.className = 'cell header-group-cell';
      lockedCell.setAttribute('data-group', 'locked');
      lockedCell.style.gridColumn = '2 / span 2';
      groupRow.appendChild(lockedCell);
      const headerRow = grid._hostElement.querySelector('.header-row')!;
      grid._hostElement.insertBefore(groupRow, headerRow);

      const plugin = new ReorderPlugin();
      plugin.attach(grid as any);
      plugin.afterRender();
      await new Promise<void>((resolve) => queueMicrotask(resolve));

      expect(lockedCell.draggable).toBeFalsy();
    });

    describe('click-only group move (SC 2.5.7)', () => {
      const menu = () => document.getElementById('tbw-col-move-menu');
      const items = () => Array.from(menu()?.querySelectorAll<HTMLButtonElement>('button') ?? []);
      const item = (label: string) => items().find((b) => b.textContent === label);

      afterEach(() => menu()?.remove());

      /** Mount the plugin and wait out the microtask the group setup defers on. */
      async function mount(grid: ReturnType<typeof createGroupedGridMock>['grid']) {
        const plugin = new ReorderPlugin();
        plugin.attach(grid as any);
        plugin.afterRender();
        await new Promise<void>((resolve) => queueMicrotask(resolve));
        return plugin;
      }

      const groupCell = (grid: ReturnType<typeof createGroupedGridMock>['grid'], id: string) =>
        grid._hostElement.querySelector(`.cell[data-group="${id}"]`) as HTMLElement;

      /** Right-click a group header — the always-available pointer alternative. */
      const openMenu = (grid: ReturnType<typeof createGroupedGridMock>['grid'], id: string) => {
        groupCell(grid, id).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        return items();
      };

      it('spends no group-header width by default', async () => {
        const { grid } = createGroupedGridMock();
        await mount(grid);

        expect(groupCell(grid, 'personal').querySelector('.tbw-col-move-btn')).toBeNull();
      });

      it('opens a menu named after the group', async () => {
        const { grid } = createGroupedGridMock();
        await mount(grid);

        const actions = openMenu(grid, 'personal');

        expect(menu()?.getAttribute('aria-label')).toBe('Move group Personal');
        expect(actions.map((b) => b.textContent)).toEqual(['Move left', 'Move right', 'Move to start', 'Move to end']);
      });

      it('moves the whole fragment past its whole neighbour', async () => {
        const { grid } = createGroupedGridMock();
        grid.dispatchEvent = vi.fn(() => true);
        await mount(grid);

        openMenu(grid, 'personal');
        item('Move right')!.click();

        const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<ColumnMoveDetail>;
        // The org group is not split — personal lands past both of its columns.
        expect(event.detail.columnOrder).toEqual(['id', 'dept', 'title', 'firstName', 'lastName']);
      });

      it('jumps to either end', async () => {
        const { grid } = createGroupedGridMock();
        grid.dispatchEvent = vi.fn(() => true);
        await mount(grid);

        openMenu(grid, 'org');
        item('Move to start')!.click();

        const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<ColumnMoveDetail>;
        expect(event.detail.columnOrder).toEqual(['dept', 'title', 'id', 'firstName', 'lastName']);
      });

      it('disables the steps that would run off the row', async () => {
        const { grid } = createGroupedGridMock();
        await mount(grid);

        openMenu(grid, 'org');

        expect(item('Move right')!.disabled).toBe(true);
        expect(item('Move to end')!.disabled).toBe(true);
        expect(item('Move left')!.disabled).toBe(false);
      });

      it("shows the inline handle only for a11y.dragAlternatives: 'inline'", async () => {
        const { grid } = createGroupedGridMock();
        grid.effectiveConfig.a11y = { dragAlternatives: 'inline' };
        await mount(grid);

        const btn = groupCell(grid, 'personal').querySelector<HTMLButtonElement>(':scope > .tbw-col-move-btn');
        expect(btn?.getAttribute('aria-label')).toBe('Move group Personal');

        btn!.click();
        expect(menu()?.getAttribute('aria-label')).toBe('Move group Personal');
      });
    });
  });
  // #endregion

  describe('fade animation', () => {
    it('should use fade animation when configured', () => {
      const plugin = new ReorderPlugin({ animation: 'fade' });
      const grid = createGridMock(sampleColumns);
      grid.dispatchEvent = vi.fn(() => true);
      plugin.attach(grid as any);

      plugin.moveColumn('id', 2);

      // For fade, forceLayout should NOT be called (only used by flip)
      expect(grid.forceLayout).not.toHaveBeenCalled();
      // But setColumnOrder should still be called
      expect(grid.setColumnOrder).toHaveBeenCalled();
    });
  });

  describe('custom animation duration', () => {
    it('should accept custom animationDuration', () => {
      const plugin = new ReorderPlugin({ animation: false, animationDuration: 500 });
      const grid = createGridMock(sampleColumns);
      grid.dispatchEvent = vi.fn(() => true);
      plugin.attach(grid as any);

      plugin.moveColumn('id', 2);

      expect(grid.setColumnOrder).toHaveBeenCalled();
    });
  });

  describe('drag-and-drop individual column headers', () => {
    it('should handle dragstart on header cell', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock(sampleColumns);
      plugin.attach(grid as any);
      plugin.afterRender();

      const nameCell = grid._hostElement.querySelector('.cell[data-field="name"]') as HTMLElement;

      const event = new Event('dragstart', { bubbles: true }) as any;
      event.dataTransfer = { effectAllowed: '', setData: vi.fn() };
      nameCell.dispatchEvent(event);

      expect(nameCell.classList.contains('dragging')).toBe(true);
      expect(event.dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'name');
    });

    it('should handle dragend to clean up', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock(sampleColumns);
      plugin.attach(grid as any);
      plugin.afterRender();

      const nameCell = grid._hostElement.querySelector('.cell[data-field="name"]') as HTMLElement;

      // Start drag
      const startEvent = new Event('dragstart', { bubbles: true }) as any;
      startEvent.dataTransfer = { effectAllowed: '', setData: vi.fn() };
      nameCell.dispatchEvent(startEvent);

      // End drag
      nameCell.dispatchEvent(new Event('dragend', { bubbles: true }));

      expect(nameCell.classList.contains('dragging')).toBe(false);
    });

    it('should handle drop on header cell to execute column move', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock(sampleColumns);
      grid.dispatchEvent = vi.fn(() => true);
      plugin.attach(grid as any);
      plugin.afterRender();

      const idCell = grid._hostElement.querySelector('.cell[data-field="id"]') as HTMLElement;
      const cityCell = grid._hostElement.querySelector('.cell[data-field="city"]') as HTMLElement;

      // Start drag on 'id'
      const startEvent = new Event('dragstart', { bubbles: true }) as any;
      startEvent.dataTransfer = { effectAllowed: '', setData: vi.fn() };
      idCell.dispatchEvent(startEvent);

      // Dragover city to set drop index
      cityCell.getBoundingClientRect = () => ({
        left: 600,
        width: 200,
        top: 0,
        bottom: 40,
        height: 40,
        right: 800,
        x: 600,
        y: 0,
        toJSON: () => ({}),
      });
      const overEvent = new Event('dragover', { bubbles: true }) as any;
      overEvent.clientX = 750; // Right side → after
      overEvent.preventDefault = vi.fn();
      cityCell.dispatchEvent(overEvent);

      // Drop
      const dropEvent = new Event('drop', { bubbles: true, cancelable: true }) as any;
      dropEvent.preventDefault = vi.fn();
      cityCell.dispatchEvent(dropEvent);

      expect(grid.dispatchEvent).toHaveBeenCalled();
      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<ColumnMoveDetail>;
      expect(event.type).toBe('column-move');
    });

    it('should handle dragleave to clear styling', () => {
      const plugin = new ReorderPlugin();
      const grid = createGridMock(sampleColumns);
      plugin.attach(grid as any);
      plugin.afterRender();

      const nameCell = grid._hostElement.querySelector('.cell[data-field="name"]') as HTMLElement;
      nameCell.classList.add('drop-target', 'drop-before', 'drop-after');

      nameCell.dispatchEvent(new Event('dragleave', { bubbles: true }));

      expect(nameCell.classList.contains('drop-target')).toBe(false);
      expect(nameCell.classList.contains('drop-before')).toBe(false);
      expect(nameCell.classList.contains('drop-after')).toBe(false);
    });
  });

  describe('requestStateChange', () => {
    it('should call requestStateChange after column order update', () => {
      const plugin = new ReorderPlugin({ animation: false });
      const grid = createGridMock(sampleColumns);
      grid.dispatchEvent = vi.fn(() => true);
      plugin.attach(grid as any);

      plugin.moveColumn('id', 2);

      expect(grid.requestStateChange).toHaveBeenCalled();
    });
  });

  describe('styles', () => {
    it('should have styles property', () => {
      const plugin = new ReorderPlugin();
      expect(typeof plugin.styles).toBe('string');
    });
  });
});
