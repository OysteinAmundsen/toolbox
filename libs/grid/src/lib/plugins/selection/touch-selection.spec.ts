import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SelectionPlugin } from './SelectionPlugin';
import { RangeCornerHandles, SelectionToolbar } from './touch-selection';

// Tests use `any` for flexibility with mock grid objects, matching the
// convention in `selection-plugin.spec.ts`.

/** Build a `CellMouseEvent`-shaped object with a pointer-typed original event. */
function mouseEvent(rowIndex: number, pointerType: 'touch' | 'mouse' | 'pen', colIndex = 0): any {
  const originalEvent = new MouseEvent('mousedown', { bubbles: true });
  Object.defineProperty(originalEvent, 'pointerType', { value: pointerType });
  return { type: 'mousedown', rowIndex, colIndex, isHeader: false, originalEvent };
}

/** Build a `CellClickEvent`-shaped object for tap-to-toggle assertions. */
function clickEvent(rowIndex: number, modifiers: Partial<MouseEventInit> = {}): any {
  return {
    type: 'click',
    rowIndex,
    colIndex: 0,
    isHeader: false,
    originalEvent: new MouseEvent('click', { bubbles: true, ...modifiers }),
  };
}

describe('touch selection mode (#304)', () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({ id: i, name: `Row ${i}` }));
  const columns = [
    { field: 'id', header: 'ID' },
    { field: 'name', header: 'Name' },
  ];

  let coarse: boolean;

  const createMockGrid = (): any => {
    const grid = document.createElement('div');
    grid.className = 'tbw-grid';
    const container = document.createElement('div');
    container.className = 'tbw-grid-root';
    grid.appendChild(container);

    Object.assign(grid, {
      rows,
      columns,
      _visibleColumns: columns,
      gridConfig: {},
      focusRow: 0,
      focusCol: 0,
      disconnectSignal: new AbortController().signal,
      requestRender: vi.fn(),
      requestAfterRender: vi.fn(),
      forceLayout: vi.fn().mockResolvedValue(undefined),
      getPlugin: vi.fn(),
      getPluginByName: vi.fn(),
      query: vi.fn().mockReturnValue([]),
      queryPlugins: vi.fn().mockReturnValue([]),
      _hostElement: grid,
    });
    grid.dispatchEvent = vi.fn();
    document.body.appendChild(grid);
    return grid;
  };

  beforeEach(() => {
    coarse = true;
    document.body.innerHTML = '';
    // `pointer-modality.ts` reads a shared MediaQueryList; stub matchMedia so
    // the coarse/fine branch is deterministic.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('coarse') ? coarse : !coarse,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  describe('mode entry', () => {
    it('enters selection mode on a coarse long-press and selects that row', () => {
      const plugin = new SelectionPlugin({ mode: 'row' });
      plugin.attach(createMockGrid());

      expect(plugin.touchSelectionActive).toBe(false);
      const handled = plugin.onCellMouseDown!(mouseEvent(3, 'touch'));

      expect(handled).toBe(true);
      expect(plugin.touchSelectionActive).toBe(true);
      expect(plugin.getSelectedRowIndices()).toEqual([3]);
    });

    it('does not enter selection mode for a mouse press', () => {
      const plugin = new SelectionPlugin({ mode: 'row' });
      plugin.attach(createMockGrid());

      plugin.onCellMouseDown!(mouseEvent(3, 'mouse'));

      expect(plugin.touchSelectionActive).toBe(false);
    });

    it('does not enter selection mode when multiSelect is disabled', () => {
      const plugin = new SelectionPlugin({ mode: 'row', multiSelect: false });
      plugin.attach(createMockGrid());

      plugin.onCellMouseDown!(mouseEvent(3, 'touch'));

      expect(plugin.touchSelectionActive).toBe(false);
    });

    it('ignores header presses so the column header menu (#270) can own them', () => {
      const plugin = new SelectionPlugin({ mode: 'row' });
      plugin.attach(createMockGrid());

      plugin.onCellMouseDown!(mouseEvent(-1, 'touch'));

      expect(plugin.touchSelectionActive).toBe(false);
    });

    it('treats a pen press as coarse', () => {
      const plugin = new SelectionPlugin({ mode: 'row' });
      plugin.attach(createMockGrid());

      plugin.onCellMouseDown!(mouseEvent(1, 'pen'));

      expect(plugin.touchSelectionActive).toBe(true);
    });
  });

  describe('tap to toggle', () => {
    it('toggles rows on a plain tap while in selection mode', () => {
      const plugin = new SelectionPlugin({ mode: 'row' });
      plugin.attach(createMockGrid());
      plugin.onCellMouseDown!(mouseEvent(2, 'touch'));

      plugin.onCellClick!(clickEvent(5));
      expect(plugin.getSelectedRowIndices()).toEqual([2, 5]);

      plugin.onCellClick!(clickEvent(2));
      expect(plugin.getSelectedRowIndices()).toEqual([5]);
    });

    it('replaces selection on a plain click when NOT in selection mode', () => {
      const plugin = new SelectionPlugin({ mode: 'row' });
      plugin.attach(createMockGrid());

      plugin.onCellClick!(clickEvent(2));
      plugin.onCellClick!(clickEvent(5));

      expect(plugin.getSelectedRowIndices()).toEqual([5]);
    });
  });

  describe('long-press range extension', () => {
    it('extends from the anchor when a second row is long-pressed', () => {
      const plugin = new SelectionPlugin({ mode: 'row' });
      plugin.attach(createMockGrid());

      plugin.onCellMouseDown!(mouseEvent(2, 'touch'));
      plugin.onCellMouseDown!(mouseEvent(5, 'touch'));

      expect(plugin.getSelectedRowIndices()).toEqual([2, 3, 4, 5]);
      expect(plugin.touchSelectionActive).toBe(true);
    });
  });

  describe('mode exit', () => {
    it('clears the selection on exit with the default transient touchMode', () => {
      const plugin = new SelectionPlugin({ mode: 'row' });
      plugin.attach(createMockGrid());
      plugin.onCellMouseDown!(mouseEvent(2, 'touch'));

      plugin.exitTouchSelection();

      expect(plugin.touchSelectionActive).toBe(false);
      expect(plugin.getSelectedRowIndices()).toEqual([]);
    });

    it('keeps the selection on exit when touchMode is sticky', () => {
      const plugin = new SelectionPlugin({ mode: 'row', touchMode: 'sticky' });
      plugin.attach(createMockGrid());
      plugin.onCellMouseDown!(mouseEvent(2, 'touch'));

      plugin.exitTouchSelection();

      expect(plugin.touchSelectionActive).toBe(false);
      expect(plugin.getSelectedRowIndices()).toEqual([2]);
    });

    it('exits on Escape before clearing the selection', () => {
      const plugin = new SelectionPlugin({ mode: 'row', touchMode: 'sticky' });
      plugin.attach(createMockGrid());
      plugin.onCellMouseDown!(mouseEvent(2, 'touch'));

      const handled = plugin.onKeyDown!(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(handled).toBe(true);
      expect(plugin.touchSelectionActive).toBe(false);
      expect(plugin.getSelectedRowIndices()).toEqual([2]);
    });

    it('is a no-op when the mode is not active', () => {
      const plugin = new SelectionPlugin({ mode: 'row' });
      plugin.attach(createMockGrid());

      expect(() => plugin.exitTouchSelection()).not.toThrow();
      expect(plugin.touchSelectionActive).toBe(false);
    });
  });

  describe('mouse chords are unaffected', () => {
    it('still supports Ctrl+click multi-select', () => {
      const plugin = new SelectionPlugin({ mode: 'row' });
      plugin.attach(createMockGrid());

      plugin.onCellClick!(clickEvent(1));
      plugin.onCellClick!(clickEvent(4, { ctrlKey: true }));

      expect(plugin.getSelectedRowIndices()).toEqual([1, 4]);
      expect(plugin.touchSelectionActive).toBe(false);
    });

    it('still supports Shift+click range select', () => {
      const plugin = new SelectionPlugin({ mode: 'row' });
      plugin.attach(createMockGrid());

      plugin.onCellClick!(clickEvent(1));
      plugin.onCellClick!(clickEvent(3, { shiftKey: true }));

      expect(plugin.getSelectedRowIndices()).toEqual([1, 2, 3]);
    });
  });

  describe('toolbar rendering', () => {
    it('renders the toolbar while selection mode is active on a coarse pointer', () => {
      const grid = createMockGrid();
      const plugin = new SelectionPlugin({ mode: 'row' });
      plugin.attach(grid);
      plugin.onCellMouseDown!(mouseEvent(2, 'touch'));

      plugin.afterRender!();

      const toolbar = grid.querySelector('.tbw-selection-toolbar');
      expect(toolbar).not.toBeNull();
      expect(toolbar!.querySelector('.tbw-selection-toolbar-count')!.textContent).toBe('1 selected');
    });

    it('removes the toolbar once selection mode is exited', () => {
      const grid = createMockGrid();
      const plugin = new SelectionPlugin({ mode: 'row' });
      plugin.attach(grid);
      plugin.onCellMouseDown!(mouseEvent(2, 'touch'));
      plugin.afterRender!();

      plugin.exitTouchSelection();
      plugin.afterRender!();

      expect(grid.querySelector('.tbw-selection-toolbar')).toBeNull();
    });

    it('does not render the toolbar for a mouse-driven selection', () => {
      const grid = createMockGrid();
      const plugin = new SelectionPlugin({ mode: 'row' });
      plugin.attach(grid);
      // A mouse press never enters the mode, so the chrome must stay away even
      // on a device whose primary pointer reports coarse (hybrid tablets).
      plugin.onCellMouseDown!(mouseEvent(2, 'mouse'));
      plugin.onCellClick!(clickEvent(2));

      plugin.afterRender!();

      expect(plugin.touchSelectionActive).toBe(false);
      expect(grid.querySelector('.tbw-selection-toolbar')).toBeNull();
    });

    it('hides "More…" when no ContextMenuPlugin is registered', () => {
      const grid = createMockGrid();
      const plugin = new SelectionPlugin({ mode: 'row' });
      plugin.attach(grid);
      plugin.onCellMouseDown!(mouseEvent(2, 'touch'));
      plugin.afterRender!();

      const more = grid.querySelector('.tbw-selection-toolbar-btn[data-action="more"]') as HTMLButtonElement;
      expect(more.hidden).toBe(true);
    });

    it('surfaces ContextMenuPlugin items through "More…"', () => {
      const grid = createMockGrid();
      const showMenu = vi.fn();
      grid.getPluginByName = vi.fn((name: string) => (name === 'contextMenu' ? { showMenu } : undefined));
      const plugin = new SelectionPlugin({ mode: 'row' });
      plugin.attach(grid);
      plugin.onCellMouseDown!(mouseEvent(2, 'touch'));
      plugin.afterRender!();

      const more = grid.querySelector('.tbw-selection-toolbar-btn[data-action="more"]') as HTMLButtonElement;
      expect(more.hidden).toBe(false);
      more.click();

      expect(showMenu).toHaveBeenCalledTimes(1);
      expect(showMenu.mock.calls[0][2]).toMatchObject({ rowIndex: 2 });
      // `ContextMenuParams.selectedRows` is `number[]` (row indices), not row objects.
      expect(showMenu.mock.calls[0][2].selectedRows).toEqual([2]);
    });

    it('wires Done, Clear and Select all', () => {
      const grid = createMockGrid();
      const plugin = new SelectionPlugin({ mode: 'row' });
      plugin.attach(grid);
      plugin.onCellMouseDown!(mouseEvent(2, 'touch'));
      plugin.afterRender!();

      const btn = (action: string) =>
        grid.querySelector(`.tbw-selection-toolbar-btn[data-action="${action}"]`) as HTMLButtonElement;

      btn('select-all').click();
      expect(plugin.getSelectedRowIndices().length).toBe(rows.length);

      btn('clear').click();
      expect(plugin.getSelectedRowIndices()).toEqual([]);

      btn('done').click();
      expect(plugin.touchSelectionActive).toBe(false);
    });
  });

  describe('range corner drags', () => {
    it('ignores cells belonging to a different grid on the same page', () => {
      const grid = createMockGrid();
      const plugin = new SelectionPlugin({ mode: 'range' });
      plugin.attach(grid);
      // Handles only render for a coarse-pointer range, so seed one via touch.
      plugin.onCellMouseDown!(mouseEvent(0, 'touch', 0));
      plugin.ranges = [{ startRow: 0, startCol: 0, endRow: 1, endCol: 1 }];
      plugin.afterRender!();

      // A cell rendered by a *second* grid elsewhere in the document.
      const otherGrid = document.createElement('div');
      const foreign = document.createElement('div');
      foreign.className = 'cell';
      foreign.setAttribute('data-row', '7');
      foreign.setAttribute('data-col', '1');
      otherGrid.appendChild(foreign);
      document.body.appendChild(otherGrid);
      const originalElementFromPoint = document.elementFromPoint;
      document.elementFromPoint = vi.fn().mockReturnValue(foreign);

      const before = { ...plugin.ranges[0] };
      const handle = grid.querySelector('.tbw-range-handle-end') as HTMLElement;
      handle.setPointerCapture = vi.fn();
      handle.releasePointerCapture = vi.fn();
      handle.hasPointerCapture = vi.fn().mockReturnValue(true);
      handle.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, bubbles: true, clientX: 0, clientY: 0 }));
      handle.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, bubbles: true, clientX: 40, clientY: 40 }));

      expect(plugin.ranges[0]).toEqual(before);
      document.elementFromPoint = originalElementFromPoint;
    });

    it('does not render handles for a mouse-started range', () => {
      const grid = createMockGrid();
      const plugin = new SelectionPlugin({ mode: 'range' });
      plugin.attach(grid);
      plugin.onCellMouseDown!(mouseEvent(0, 'mouse', 0));
      plugin.ranges = [{ startRow: 0, startCol: 0, endRow: 1, endCol: 1 }];
      plugin.afterRender!();

      expect(grid.querySelector('.tbw-range-handle')).toBeNull();
    });

    it('renders handles for a tap-created range (no long-press involved)', () => {
      const grid = createMockGrid();
      const plugin = new SelectionPlugin({ mode: 'range' });
      plugin.attach(grid);
      // A coarse tap never reaches onCellMouseDown — only onCellClick.
      plugin.onCellClick!(clickEvent(0));
      plugin.afterRender!();

      expect(grid.querySelector('.tbw-range-handle')).not.toBeNull();
    });
  });

  describe('teardown', () => {
    it('removes the toolbar on detach', () => {
      const grid = createMockGrid();
      const plugin = new SelectionPlugin({ mode: 'row' });
      plugin.attach(grid);
      plugin.onCellMouseDown!(mouseEvent(2, 'touch'));
      plugin.afterRender!();

      plugin.detach();

      expect(grid.querySelector('.tbw-selection-toolbar')).toBeNull();
      expect(plugin.touchSelectionActive).toBe(false);
    });
  });
});

describe('SelectionToolbar', () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  const callbacks = () => ({
    selectAll: vi.fn(),
    clear: vi.fn(),
    done: vi.fn(),
    more: vi.fn(),
  });

  it('mounts once and updates the count in place', () => {
    const toolbar = new SelectionToolbar();
    const cb = callbacks();

    toolbar.show(container, 1, false, cb);
    const first = toolbar.element;
    toolbar.show(container, 4, false, cb);

    expect(toolbar.element).toBe(first);
    expect(container.querySelectorAll('.tbw-selection-toolbar').length).toBe(1);
    expect(first!.querySelector('.tbw-selection-toolbar-count')!.textContent).toBe('4 selected');
    expect(first!.getAttribute('data-selected-count')).toBe('4');
  });

  it('exposes the toolbar as an ARIA toolbar', () => {
    const toolbar = new SelectionToolbar();
    toolbar.show(container, 1, false, callbacks());

    expect(toolbar.element!.getAttribute('role')).toBe('toolbar');
    expect(toolbar.element!.getAttribute('aria-label')).toBe('Selection');
  });

  it('destroy is idempotent', () => {
    const toolbar = new SelectionToolbar();
    toolbar.show(container, 1, false, callbacks());

    toolbar.destroy();
    expect(() => toolbar.destroy()).not.toThrow();
    expect(toolbar.mounted).toBe(false);
    expect(container.querySelector('.tbw-selection-toolbar')).toBeNull();
  });
});

describe('RangeCornerHandles', () => {
  let container: HTMLElement;

  const makeCellFor = () => {
    const cell = document.createElement('div');
    container.appendChild(cell);
    return () => cell;
  };

  const callbacks = () => ({
    cellAt: vi.fn().mockReturnValue({ row: 4, col: 2 }),
    resize: vi.fn(),
    commit: vi.fn(),
  });

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders two handles for an active range', () => {
    const handles = new RangeCornerHandles();
    handles.render(container, { startRow: 0, startCol: 0, endRow: 2, endCol: 3 }, makeCellFor(), callbacks());

    const els = container.querySelectorAll('.tbw-range-handle');
    expect(els.length).toBe(2);
    expect(els[0].getAttribute('data-corner')).toBe('start');
    expect(els[1].getAttribute('data-corner')).toBe('end');
  });

  it('hides the handles when there is no range', () => {
    const handles = new RangeCornerHandles();
    handles.render(container, { startRow: 0, startCol: 0, endRow: 1, endCol: 1 }, makeCellFor(), callbacks());
    handles.render(container, null, makeCellFor(), callbacks());

    container.querySelectorAll('.tbw-range-handle').forEach((el) => {
      expect((el as HTMLElement).hidden).toBe(true);
    });
  });

  it('hides a handle whose anchor cell is outside the rendered window', () => {
    const handles = new RangeCornerHandles();
    handles.render(container, { startRow: 0, startCol: 0, endRow: 2, endCol: 3 }, () => null, callbacks());

    container.querySelectorAll('.tbw-range-handle').forEach((el) => {
      expect((el as HTMLElement).hidden).toBe(true);
    });
  });

  it('resizes the range while a handle is dragged and commits on pointerup', () => {
    const handles = new RangeCornerHandles();
    const cb = callbacks();
    handles.render(container, { startRow: 0, startCol: 0, endRow: 2, endCol: 3 }, makeCellFor(), cb);

    const handle = container.querySelector('.tbw-range-handle-end') as HTMLElement;
    // happy-dom implements the pointer-capture API but does not route events
    // through it, so stub the capture calls and dispatch on the target.
    handle.setPointerCapture = vi.fn();
    handle.releasePointerCapture = vi.fn();
    handle.hasPointerCapture = vi.fn().mockReturnValue(true);

    handle.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, bubbles: true, clientX: 0, clientY: 0 }));
    expect(handle.classList.contains('dragging')).toBe(true);

    handle.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, bubbles: true, clientX: 40, clientY: 40 }));
    expect(cb.resize).toHaveBeenCalledWith('end', 4, 2);

    handle.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true, clientX: 40, clientY: 40 }));
    expect(cb.commit).toHaveBeenCalledTimes(1);
    expect(handle.classList.contains('dragging')).toBe(false);
  });

  it('destroy is idempotent', () => {
    const handles = new RangeCornerHandles();
    handles.render(container, { startRow: 0, startCol: 0, endRow: 1, endCol: 1 }, makeCellFor(), callbacks());

    handles.destroy();
    expect(() => handles.destroy()).not.toThrow();
    expect(container.querySelector('.tbw-range-handle')).toBeNull();
  });
});
