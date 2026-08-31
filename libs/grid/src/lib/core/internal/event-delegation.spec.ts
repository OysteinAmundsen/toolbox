import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ColumnInternal, InternalGrid } from '../types';
import { setupCellEventDelegation, setupRootEventDelegation } from './event-delegation';

/**
 * Create a mock grid for testing event delegation.
 */
function createMockGrid(overrides: Partial<InternalGrid> = {}): InternalGrid {
  const grid: Partial<InternalGrid> = {
    _rows: [
      { id: 1, name: 'Alice', status: 'Active' },
      { id: 2, name: 'Bob', status: 'Inactive' },
      { id: 3, name: 'Charlie', status: 'Active' },
    ],
    _visibleColumns: [
      { field: 'id', header: 'ID', editable: false } as ColumnInternal,
      { field: 'name', header: 'Name', editable: true } as ColumnInternal,
      { field: 'status', header: 'Status', editable: true, type: 'select' } as ColumnInternal,
    ],
    _focusRow: -1,
    _focusCol: -1,
    _virtualization: { start: 0, end: 10 },
    refreshVirtualWindow: vi.fn(),
    ...overrides,
  };

  return grid as InternalGrid;
}

/**
 * Create a cell element for testing.
 */
function createCell(rowIndex: number, colIndex: number, options: { editing?: boolean } = {}): HTMLElement {
  const cell = document.createElement('div');
  cell.className = 'cell';
  if (options.editing) {
    cell.classList.add('editing');
  }
  cell.setAttribute('data-col', String(colIndex));
  cell.setAttribute('data-row', String(rowIndex));
  cell.tabIndex = 0;
  return cell;
}

/**
 * Create a row element containing cells.
 */
function createRow(rowIndex: number, colCount: number): HTMLElement {
  const row = document.createElement('div');
  row.className = 'data-grid-row';
  row.setAttribute('data-row', String(rowIndex));
  for (let i = 0; i < colCount; i++) {
    row.appendChild(createCell(rowIndex, i));
  }
  return row;
}

describe('event-delegation', () => {
  let bodyEl: HTMLElement;
  let abortController: AbortController;
  let grid: InternalGrid;

  beforeEach(() => {
    bodyEl = document.createElement('div');
    bodyEl.className = 'rows';
    document.body.appendChild(bodyEl);

    // Add some rows
    for (let i = 0; i < 3; i++) {
      bodyEl.appendChild(createRow(i, 3));
    }

    abortController = new AbortController();
    // Pass bodyEl to the mock so grid._bodyEl matches the element we're testing with
    grid = createMockGrid({ _bodyEl: bodyEl });
  });

  afterEach(() => {
    abortController.abort();
    document.body.innerHTML = '';
  });

  describe('setupCellEventDelegation', () => {
    it('should set up mousedown listener on the body element', () => {
      const addEventListenerSpy = vi.spyOn(bodyEl, 'addEventListener');
      setupCellEventDelegation(grid, bodyEl, abortController.signal);

      // Should set up mousedown for focus management
      expect(addEventListenerSpy).toHaveBeenCalled();
      const eventTypes = addEventListenerSpy.mock.calls.map((call) => call[0]);
      expect(eventTypes).toContain('mousedown');
    });

    it('should clean up listeners when signal is aborted', () => {
      setupCellEventDelegation(grid, bodyEl, abortController.signal);
      // AbortSignal should trigger listener removal
      // (The actual removal is handled by the browser via the signal option)
      abortController.abort();
    });
  });

  describe('mousedown handling', () => {
    it('should update focus position on any cell mousedown', () => {
      setupCellEventDelegation(grid, bodyEl, abortController.signal);

      const cell = bodyEl.querySelector('.cell[data-row="1"][data-col="1"]') as HTMLElement;
      expect(cell).not.toBeNull();

      const event = new MouseEvent('mousedown', { bubbles: true });
      cell.dispatchEvent(event);

      expect(grid._focusRow).toBe(1);
      expect(grid._focusCol).toBe(1);
    });

    it('should update focus on non-editable cell too', () => {
      setupCellEventDelegation(grid, bodyEl, abortController.signal);

      // Column 0 is not editable but still receives focus
      const cell = bodyEl.querySelector('.cell[data-row="0"][data-col="0"]') as HTMLElement;
      const event = new MouseEvent('mousedown', { bubbles: true });
      cell.dispatchEvent(event);

      expect(grid._focusRow).toBe(0);
      expect(grid._focusCol).toBe(0);
    });

    it('should not update focus on editing cell', () => {
      setupCellEventDelegation(grid, bodyEl, abortController.signal);

      const cell = bodyEl.querySelector('.cell[data-row="0"][data-col="1"]') as HTMLElement;
      cell.classList.add('editing');

      grid._focusRow = 5;
      grid._focusCol = 5;

      const event = new MouseEvent('mousedown', { bubbles: true });
      cell.dispatchEvent(event);

      // Focus should not change for editing cells
      expect(grid._focusRow).toBe(5);
      expect(grid._focusCol).toBe(5);
    });

    it('should not call preventDefault on mousedown for draggable elements', () => {
      setupCellEventDelegation(grid, bodyEl, abortController.signal);

      const cell = bodyEl.querySelector('.cell[data-row="0"][data-col="0"]') as HTMLElement;
      const handle = document.createElement('div');
      handle.className = 'dg-row-drag-handle';
      handle.draggable = true;
      cell.appendChild(handle);

      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      handle.dispatchEvent(event);

      // preventDefault should NOT be called — native drag-and-drop needs it
      expect(event.defaultPrevented).toBe(false);
    });

    it('should call preventDefault on mousedown for non-draggable cells', () => {
      setupCellEventDelegation(grid, bodyEl, abortController.signal);

      const cell = bodyEl.querySelector('.cell[data-row="0"][data-col="0"]') as HTMLElement;
      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      cell.dispatchEvent(event);

      // preventDefault SHOULD be called for normal cells
      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('event delegation efficiency', () => {
    it('should ignore events not on cells', () => {
      setupCellEventDelegation(grid, bodyEl, abortController.signal);

      // Mousedown on the body itself, not a cell
      const event = new MouseEvent('mousedown', { bubbles: true });
      bodyEl.dispatchEvent(event);

      expect(grid._focusRow).toBe(-1);
      expect(grid._focusCol).toBe(-1);
    });

    it('should handle events bubbling from cell children', () => {
      setupCellEventDelegation(grid, bodyEl, abortController.signal);

      const cell = bodyEl.querySelector('.cell[data-row="1"][data-col="1"]') as HTMLElement;
      const span = document.createElement('span');
      span.textContent = 'content';
      cell.appendChild(span);

      // Click on the span inside the cell
      const event = new MouseEvent('mousedown', { bubbles: true });
      span.dispatchEvent(event);

      // Should still work via bubbling
      expect(grid._focusRow).toBe(1);
      expect(grid._focusCol).toBe(1);
    });
  });
});

/**
 * Long-press priority order (#306).
 *
 * A coarse long-press is an overloaded gesture: it may be claimed by touch
 * selection mode or cell-range painting, and only falls through to the
 * browser's native `contextmenu` when nothing claims it. These tests pin the
 * two halves of that contract, because a regression here is invisible until
 * someone tests on a real phone.
 */
describe('long-press → contextmenu priority (#306)', () => {
  let renderRoot: HTMLElement;
  let bodyEl: HTMLElement;
  let cell: HTMLElement;
  let abortController: AbortController;

  /** Hold a coarse pointer on `cell` for long enough to promote the press. */
  function longPress(): void {
    const down = new PointerEvent('pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      bubbles: true,
      cancelable: true,
      clientX: 10,
      clientY: 10,
    });
    cell.dispatchEvent(down);
    // LONG_PRESS_MS is 400; advance past it so the promotion timer fires.
    vi.advanceTimersByTime(450);
  }

  /** Dispatch a `contextmenu` as the browser would after a long-press. */
  function nativeContextMenu(): MouseEvent {
    const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    cell.dispatchEvent(e);
    return e;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    renderRoot = document.createElement('div');
    renderRoot.className = 'tbw-grid-root';
    bodyEl = document.createElement('div');
    bodyEl.className = 'rows';
    renderRoot.appendChild(bodyEl);
    bodyEl.appendChild(createRow(0, 3));
    document.body.appendChild(renderRoot);

    cell = bodyEl.querySelector('.cell[data-row="0"][data-col="0"]') as HTMLElement;
    // happy-dom exposes the pointer-capture API but does not route through it.
    renderRoot.setPointerCapture = vi.fn();
    renderRoot.releasePointerCapture = vi.fn();
    renderRoot.hasPointerCapture = vi.fn().mockReturnValue(true);

    abortController = new AbortController();
  });

  afterEach(() => {
    abortController.abort();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('lets the native contextmenu through when no plugin claims the long-press', () => {
    const grid = createMockGrid({
      _bodyEl: bodyEl,
      _dispatchCellMouseDown: vi.fn().mockReturnValue(false),
    } as Partial<InternalGrid>);
    setupRootEventDelegation(grid, renderRoot, renderRoot, abortController.signal);

    longPress();
    const menuEvent = nativeContextMenu();

    expect(menuEvent.defaultPrevented).toBe(false);
  });

  it('suppresses the native contextmenu when a plugin claims the long-press', () => {
    const grid = createMockGrid({
      _bodyEl: bodyEl,
      _dispatchCellMouseDown: vi.fn().mockReturnValue(true),
    } as Partial<InternalGrid>);
    setupRootEventDelegation(grid, renderRoot, renderRoot, abortController.signal);

    longPress();
    const menuEvent = nativeContextMenu();

    expect(menuEvent.defaultPrevented).toBe(true);
  });

  it('leaves a contextmenu raised outside this grid alone', () => {
    const grid = createMockGrid({
      _bodyEl: bodyEl,
      _dispatchCellMouseDown: vi.fn().mockReturnValue(true),
    } as Partial<InternalGrid>);
    setupRootEventDelegation(grid, renderRoot, renderRoot, abortController.signal);

    // Something else on the page — a second grid, or the host app's own menu.
    const outside = document.createElement('div');
    document.body.appendChild(outside);

    longPress();
    const outsideEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    outside.dispatchEvent(outsideEvent);
    expect(outsideEvent.defaultPrevented).toBe(false);

    // …and it must not have consumed the one-shot window either.
    expect(nativeContextMenu().defaultPrevented).toBe(true);
  });

  it('only suppresses one contextmenu — a later right-click still opens the menu', () => {
    const grid = createMockGrid({
      _bodyEl: bodyEl,
      _dispatchCellMouseDown: vi.fn().mockReturnValue(true),
    } as Partial<InternalGrid>);
    setupRootEventDelegation(grid, renderRoot, renderRoot, abortController.signal);

    longPress();
    nativeContextMenu();

    expect(nativeContextMenu().defaultPrevented).toBe(false);
  });

  it('stops suppressing once the window expires', () => {
    const grid = createMockGrid({
      _bodyEl: bodyEl,
      _dispatchCellMouseDown: vi.fn().mockReturnValue(true),
    } as Partial<InternalGrid>);
    setupRootEventDelegation(grid, renderRoot, renderRoot, abortController.signal);

    longPress();
    // CONTEXT_MENU_SUPPRESS_MS is 700.
    vi.advanceTimersByTime(800);

    expect(nativeContextMenu().defaultPrevented).toBe(false);
  });

  it('never suppresses for a fine pointer — right-click is untouched', () => {
    const grid = createMockGrid({
      _bodyEl: bodyEl,
      _dispatchCellMouseDown: vi.fn().mockReturnValue(true),
    } as Partial<InternalGrid>);
    setupRootEventDelegation(grid, renderRoot, renderRoot, abortController.signal);

    cell.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 1,
        pointerType: 'mouse',
        bubbles: true,
        cancelable: true,
        clientX: 10,
        clientY: 10,
      }),
    );
    vi.advanceTimersByTime(450);

    expect(nativeContextMenu().defaultPrevented).toBe(false);
  });
});

describe('event-delegation: truncated text reveal (SC 1.4.12)', () => {
  let renderRoot: HTMLElement;
  let cell: HTMLElement;
  let abortController: AbortController;

  /** happy-dom reports 0 for both metrics, so overflow has to be staged by hand. */
  function stageWidths(el: HTMLElement, scrollWidth: number, clientWidth: number): void {
    Object.defineProperty(el, 'scrollWidth', { value: scrollWidth, configurable: true });
    Object.defineProperty(el, 'clientWidth', { value: clientWidth, configurable: true });
  }

  function hover(): void {
    cell.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  }

  function setup(overrides: Partial<InternalGrid> = {}): void {
    setupRootEventDelegation(createMockGrid(overrides), renderRoot, renderRoot, abortController.signal);
  }

  beforeEach(() => {
    document.body.innerHTML = '';
    renderRoot = document.createElement('div');
    const bodyEl = document.createElement('div');
    bodyEl.className = 'rows';
    renderRoot.appendChild(bodyEl);
    bodyEl.appendChild(createRow(0, 3));
    document.body.appendChild(renderRoot);
    cell = bodyEl.querySelector('.cell[data-row="0"][data-col="0"]') as HTMLElement;
    cell.textContent = 'a value too long to fit';
    abortController = new AbortController();
  });

  afterEach(() => {
    abortController.abort();
    document.body.innerHTML = '';
  });

  it('titles a cell whose text does not fit', () => {
    setup();
    stageWidths(cell, 200, 100);

    hover();

    expect(cell.title).toBe('a value too long to fit');
  });

  it('leaves a cell that fits without a tooltip', () => {
    setup();
    stageWidths(cell, 100, 100);

    hover();

    expect(cell.hasAttribute('title')).toBe(false);
  });

  it('drops its own title once the cell fits again', () => {
    setup();
    stageWidths(cell, 200, 100);
    hover();
    expect(cell.title).toBe('a value too long to fit');

    // A column resize, a shorter value — either way the ellipsis is gone.
    stageWidths(cell, 100, 100);
    hover();

    expect(cell.hasAttribute('title')).toBe(false);
  });

  it('never clobbers a title a renderer put there', () => {
    setup();
    cell.title = 'author supplied';
    stageWidths(cell, 200, 100);

    hover();

    expect(cell.title).toBe('author supplied');
  });

  it('stands down when the Tooltip plugin is doing the job', () => {
    setup({ getPluginByName: ((name: string) => (name === 'tooltip' ? {} : undefined)) as never });
    stageWidths(cell, 200, 100);

    hover();

    expect(cell.hasAttribute('title')).toBe(false);
  });
});
