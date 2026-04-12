/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReorderPlugin } from './ReorderPlugin';
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
    effectiveConfig: {},
    getPlugin: () => undefined,
    getPluginByName: () => undefined,
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
