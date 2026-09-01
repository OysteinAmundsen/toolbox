import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResponsivePlugin } from './responsive-plugin';

// Mock ResizeObserver
const mockResizeObserverCallback = vi.fn();
let resizeObserverInstance: {
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  callback: (entries: { contentRect: { width: number } }[]) => void;
} | null = null;

class MockResizeObserver {
  callback: (entries: { contentRect: { width: number } }[]) => void;
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();

  constructor(callback: (entries: { contentRect: { width: number } }[]) => void) {
    this.callback = callback;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    resizeObserverInstance = this;
    mockResizeObserverCallback(callback);
  }
}

// Replace global ResizeObserver
vi.stubGlobal('ResizeObserver', MockResizeObserver);

describe('ResponsivePlugin', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resizeObserverInstance = null;
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const createMockGrid = (rows: unknown[] = [], columns: unknown[] = []) => {
    const grid = document.createElement('div');
    grid.className = 'tbw-grid';

    // Add mock grid structure
    const container = document.createElement('div');
    container.className = 'tbw-grid-root';
    grid.appendChild(container);

    // Add row and cell elements
    const row = document.createElement('div');
    row.className = 'data-grid-row';
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.setAttribute('data-field', 'name');
    row.appendChild(cell);
    container.appendChild(row);

    document.body.appendChild(grid);

    Object.assign(grid, {
      rows,
      columns,
      gridConfig: {},
      disconnectSignal: new AbortController().signal,
      requestRender: vi.fn(),
      requestAfterRender: vi.fn(),
      forceLayout: vi.fn().mockResolvedValue(undefined),
      getPlugin: vi.fn(),
      getPluginByName: vi.fn(),
      _hostElement: grid,
    });

    grid.dispatchEvent = vi.fn();

    return grid as unknown as HTMLElement & {
      rows: unknown[];
      columns: unknown[];
      gridConfig: object;
      disconnectSignal: AbortSignal;
      requestRender: ReturnType<typeof vi.fn>;
      dispatchEvent: ReturnType<typeof vi.fn>;
    };
  };

  describe('lifecycle', () => {
    it('should initialize with default config', () => {
      const plugin = new ResponsivePlugin({});
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      expect(plugin.name).toBe('responsive');
      expect(plugin.isResponsive()).toBe(false);
    });

    it('should initialize with configured breakpoint', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500 });
      plugin.attach(createMockGrid() as never);

      expect(plugin.isResponsive()).toBe(false);
    });

    it('should observe the grid element', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500 });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      expect(resizeObserverInstance?.observe).toHaveBeenCalledWith(mockGrid);
    });

    it('should disconnect observer on detach', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500 });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);
      plugin.detach();

      expect(resizeObserverInstance?.disconnect).toHaveBeenCalled();
    });

    it('should remove data-responsive attribute on detach', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500 });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      // Simulate entering responsive mode
      resizeObserverInstance?.callback([{ contentRect: { width: 400 } }]);
      vi.runAllTimers();

      expect(mockGrid.hasAttribute('data-responsive')).toBe(true);

      plugin.detach();
      expect(mockGrid.hasAttribute('data-responsive')).toBe(false);
    });
  });

  describe('breakpoint detection', () => {
    it('should enter responsive mode when width < breakpoint', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500 });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      // Simulate resize to below breakpoint
      resizeObserverInstance?.callback([{ contentRect: { width: 400 } }]);
      vi.runAllTimers();

      expect(plugin.isResponsive()).toBe(true);
      expect(mockGrid.hasAttribute('data-responsive')).toBe(true);
    });

    it('should exit responsive mode when width >= breakpoint', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500 });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      // Enter responsive mode
      resizeObserverInstance?.callback([{ contentRect: { width: 400 } }]);
      vi.runAllTimers();
      expect(plugin.isResponsive()).toBe(true);

      // Exit responsive mode
      resizeObserverInstance?.callback([{ contentRect: { width: 600 } }]);
      vi.runAllTimers();
      expect(plugin.isResponsive()).toBe(false);
      expect(mockGrid.hasAttribute('data-responsive')).toBe(false);
    });

    it('should emit responsive-change event when crossing breakpoint', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500 });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      resizeObserverInstance?.callback([{ contentRect: { width: 400 } }]);
      vi.runAllTimers();

      expect(mockGrid.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'responsive-change',
          detail: {
            isResponsive: true,
            width: 400,
            breakpoint: 500,
          },
        }),
      );
    });

    it('should apply the first width change immediately', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500, debounceMs: 200 });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      resizeObserverInstance?.callback([{ contentRect: { width: 400 } }]);

      // No timer advance — a settled width must not wait out the debounce.
      expect(plugin.isResponsive()).toBe(true);
    });

    it('should ignore resizes that only change height', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500, debounceMs: 200 });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      resizeObserverInstance?.callback([{ contentRect: { width: 600, height: 100 } }]);
      vi.runAllTimers();

      const callsAfterFirst = mockGrid.dispatchEvent.mock.calls.length;

      // Height animating while width stays put must not schedule any work.
      resizeObserverInstance?.callback([{ contentRect: { width: 600, height: 200 } }]);
      resizeObserverInstance?.callback([{ contentRect: { width: 600, height: 300 } }]);
      vi.runAllTimers();

      expect(mockGrid.dispatchEvent.mock.calls.length).toBe(callsAfterFirst);
    });

    it('should rate-limit rapid width changes to one switch per window', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500, debounceMs: 200 });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      // First crossing applies on the leading edge.
      resizeObserverInstance?.callback([{ contentRect: { width: 400 } }]);
      expect(plugin.isResponsive()).toBe(true);

      // Crossings back and forth inside the window are deferred, not applied.
      resizeObserverInstance?.callback([{ contentRect: { width: 600 } }]);
      resizeObserverInstance?.callback([{ contentRect: { width: 550 } }]);
      expect(plugin.isResponsive()).toBe(true);

      // The trailing evaluation settles on the final width.
      vi.runAllTimers();
      expect(plugin.isResponsive()).toBe(false);
    });
  });

  describe('manual control', () => {
    it('should allow forcing responsive mode with setResponsive()', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500 });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      plugin.setResponsive(true);
      expect(plugin.isResponsive()).toBe(true);
      expect(mockGrid.hasAttribute('data-responsive')).toBe(true);

      plugin.setResponsive(false);
      expect(plugin.isResponsive()).toBe(false);
      expect(mockGrid.hasAttribute('data-responsive')).toBe(false);
    });

    it('should not set data-responsive-hide-header by default', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500 });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      plugin.setResponsive(true);
      expect(mockGrid.hasAttribute('data-responsive')).toBe(true);
      expect(mockGrid.hasAttribute('data-responsive-hide-header')).toBe(false);
    });

    it('should toggle data-responsive-hide-header when hideHeader is true', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500, hideHeader: true });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      plugin.setResponsive(true);
      expect(mockGrid.hasAttribute('data-responsive-hide-header')).toBe(true);

      // Attribute should clear when leaving card mode so it can't affect non-responsive layouts
      plugin.setResponsive(false);
      expect(mockGrid.hasAttribute('data-responsive-hide-header')).toBe(false);
    });

    it('should allow updating breakpoint with setBreakpoint()', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500 });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      // Set current width to 450
      resizeObserverInstance?.callback([{ contentRect: { width: 450 } }]);
      vi.runAllTimers();
      expect(plugin.isResponsive()).toBe(true);

      // Update breakpoint to 400 - should exit responsive mode
      plugin.setBreakpoint(400);
      expect(plugin.isResponsive()).toBe(false);
    });

    it('should return current width with getWidth()', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500 });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      resizeObserverInstance?.callback([{ contentRect: { width: 750 } }]);
      vi.runAllTimers();

      expect(plugin.getWidth()).toBe(750);
    });
  });

  describe('missing breakpoint warning', () => {
    it('should warn when no breakpoint is configured', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
      const plugin = new ResponsivePlugin({});
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      // Trigger a resize check
      resizeObserverInstance?.callback([{ contentRect: { width: 400 } }]);
      vi.runAllTimers();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No breakpoint configured'));

      consoleSpy.mockRestore();
    });

    it('should only warn once about missing breakpoint', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
      const plugin = new ResponsivePlugin({});
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      // Multiple resize checks
      resizeObserverInstance?.callback([{ contentRect: { width: 400 } }]);
      vi.runAllTimers();
      resizeObserverInstance?.callback([{ contentRect: { width: 300 } }]);
      vi.runAllTimers();

      expect(consoleSpy).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });
  });

  describe('hidden columns', () => {
    it('should mark cells for hidden columns in responsive mode', () => {
      const plugin = new ResponsivePlugin({
        breakpoint: 500,
        hiddenColumns: ['name'],
      });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      // Enter responsive mode
      resizeObserverInstance?.callback([{ contentRect: { width: 400 } }]);
      vi.runAllTimers();

      // Call afterRender to apply hidden column markers
      plugin.afterRender();

      const cell = mockGrid.querySelector('.cell[data-field="name"]');
      expect(cell?.hasAttribute('data-responsive-hidden')).toBe(true);
    });

    it('should not mark cells when not in responsive mode', () => {
      const plugin = new ResponsivePlugin({
        breakpoint: 500,
        hiddenColumns: ['name'],
      });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      // Stay in normal mode
      resizeObserverInstance?.callback([{ contentRect: { width: 600 } }]);
      vi.runAllTimers();

      plugin.afterRender();

      const cell = mockGrid.querySelector('.cell[data-field="name"]');
      expect(cell?.hasAttribute('data-responsive-hidden')).toBe(false);
    });

    it('should release hidden cells when the table layout returns', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500, hiddenColumns: ['name'] });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      resizeObserverInstance?.callback([{ contentRect: { width: 400 } }]);
      vi.runAllTimers();
      plugin.afterRender();

      const cell = mockGrid.querySelector('.cell[data-field="name"]');
      expect(cell?.hasAttribute('data-responsive-hidden')).toBe(true);

      // Cells come from a recycled pool, so the attribute written in card mode
      // survives the switch unless the table render explicitly clears it.
      resizeObserverInstance?.callback([{ contentRect: { width: 600 } }]);
      vi.runAllTimers();
      plugin.afterRender();

      expect(cell?.hasAttribute('data-responsive-hidden')).toBe(false);
      expect(cell?.hasAttribute('aria-hidden')).toBe(false);
    });
  });

  describe('keyboard navigation', () => {
    const createMockGridWithFocus = () => {
      const mockGrid = createMockGrid(
        [{ id: 1 }, { id: 2 }, { id: 3 }],
        [{ field: 'id' }, { field: 'name' }, { field: 'email' }],
      );

      // Create a mock body element for ensureCellVisible
      const bodyEl = document.createElement('div');
      bodyEl.className = 'tbw-body';
      // Add 3 rows with 3 cells each
      for (let r = 0; r < 3; r++) {
        const row = document.createElement('div');
        row.className = 'data-grid-row';
        for (let c = 0; c < 3; c++) {
          const cell = document.createElement('div');
          cell.className = 'cell';
          cell.setAttribute('data-col', String(c));
          row.appendChild(cell);
        }
        bodyEl.appendChild(row);
      }
      mockGrid.appendChild(bodyEl);

      // Add focus state properties and properties needed by ensureCellVisible
      Object.assign(mockGrid, {
        _focusRow: 1,
        _focusCol: 1,
        _rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
        _visibleColumns: [{ field: 'id' }, { field: 'name' }, { field: 'email' }],
        _bodyEl: bodyEl,
        _activeEditRows: -1,
        _virtualization: { enabled: false, start: 0, end: 3 },
        refreshVirtualWindow: vi.fn(),
        _hostElement: mockGrid,
      });
      return mockGrid as typeof mockGrid & {
        _focusRow: number;
        _focusCol: number;
        _rows: unknown[];
        _visibleColumns: unknown[];
      };
    };

    it('should not intercept keys when not in responsive mode', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500 });
      const mockGrid = createMockGridWithFocus();
      plugin.attach(mockGrid as never);

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      const handled = plugin.onKeyDown(event);

      expect(handled).toBe(false);
    });

    it('should swap ArrowDown to move within card (next field)', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500 });
      const mockGrid = createMockGridWithFocus();
      plugin.attach(mockGrid as never);

      // Enter responsive mode
      plugin.setResponsive(true);

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });

      const handled = plugin.onKeyDown(event);

      expect(handled).toBe(true);
      expect(mockGrid._focusRow).toBe(1); // Same row (card)
      expect(mockGrid._focusCol).toBe(2); // Moved to next field within card
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should swap ArrowUp to move within card (previous field)', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500 });
      const mockGrid = createMockGridWithFocus();
      plugin.attach(mockGrid as never);

      plugin.setResponsive(true);

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });

      const handled = plugin.onKeyDown(event);

      expect(handled).toBe(true);
      expect(mockGrid._focusRow).toBe(1); // Same row (card)
      expect(mockGrid._focusCol).toBe(0); // Moved to previous field within card
    });

    it('should swap ArrowRight to move between cards (next card)', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500 });
      const mockGrid = createMockGridWithFocus();
      plugin.attach(mockGrid as never);

      plugin.setResponsive(true);

      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });

      const handled = plugin.onKeyDown(event);

      expect(handled).toBe(true);
      expect(mockGrid._focusRow).toBe(2); // Moved to next card
      expect(mockGrid._focusCol).toBe(1); // Same field
    });

    it('should swap ArrowLeft to move between cards (previous card)', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500 });
      const mockGrid = createMockGridWithFocus();
      plugin.attach(mockGrid as never);

      plugin.setResponsive(true);

      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });

      const handled = plugin.onKeyDown(event);

      expect(handled).toBe(true);
      expect(mockGrid._focusRow).toBe(0); // Moved to previous card
      expect(mockGrid._focusCol).toBe(1); // Same field
    });

    it('should wrap to next card when at bottom of current card', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500 });
      const mockGrid = createMockGridWithFocus();
      mockGrid._focusCol = 2; // Last column (at bottom of card)
      plugin.attach(mockGrid as never);

      plugin.setResponsive(true);

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });

      const handled = plugin.onKeyDown(event);

      expect(handled).toBe(true);
      expect(mockGrid._focusRow).toBe(2); // Moved to next card
      expect(mockGrid._focusCol).toBe(0); // First field of next card
    });

    it('should not move past boundaries at first card/first field', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500 });
      const mockGrid = createMockGridWithFocus();
      mockGrid._focusRow = 0;
      mockGrid._focusCol = 0;
      plugin.attach(mockGrid as never);

      plugin.setResponsive(true);

      // Try to go above first field (ArrowUp at top of first card)
      const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      const handledUp = plugin.onKeyDown(upEvent);
      expect(handledUp).toBe(false);
      expect(mockGrid._focusRow).toBe(0);
      expect(mockGrid._focusCol).toBe(0);

      // Try to go to previous card (ArrowLeft at first card)
      const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
      const handledLeft = plugin.onKeyDown(leftEvent);
      expect(handledLeft).toBe(false);
      expect(mockGrid._focusRow).toBe(0);
    });

    it('should not intercept navigation when cardRenderer is provided', () => {
      const plugin = new ResponsivePlugin({
        breakpoint: 500,
        cardRenderer: () => document.createElement('div'),
      });
      const mockGrid = createMockGridWithFocus();
      plugin.attach(mockGrid as never);

      plugin.setResponsive(true);

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      const handled = plugin.onKeyDown(event);

      // Should NOT handle - let implementor handle it
      expect(handled).toBe(false);
      expect(mockGrid._focusRow).toBe(1); // Unchanged
    });
  });

  describe('cardRenderer (Phase 2)', () => {
    it('should not call cardRenderer when not in responsive mode', () => {
      const cardRenderer = vi.fn(() => document.createElement('div'));
      const plugin = new ResponsivePlugin({
        breakpoint: 500,
        cardRenderer,
      });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      const rowEl = document.createElement('div');
      rowEl.className = 'data-grid-row';

      // Not in responsive mode - should return undefined (let default render)
      const result = plugin.renderRow({ id: 1, name: 'Alice' }, rowEl, 0);

      expect(result).toBeUndefined();
      expect(cardRenderer).not.toHaveBeenCalled();
    });

    it('should call cardRenderer when in responsive mode', () => {
      const cardRenderer = vi.fn(() => {
        const card = document.createElement('div');
        card.className = 'custom-card';
        card.textContent = 'Custom content';
        return card;
      });
      const plugin = new ResponsivePlugin({
        breakpoint: 500,
        cardRenderer,
      });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      // Enter responsive mode
      plugin.setResponsive(true);

      const rowEl = document.createElement('div');
      rowEl.className = 'data-grid-row';
      const rowData = { id: 1, name: 'Alice' };

      const result = plugin.renderRow(rowData, rowEl, 0);

      expect(result).toBe(true); // Handled rendering
      expect(cardRenderer).toHaveBeenCalledWith(rowData, 0);
      expect(rowEl.querySelector('.custom-card')).toBeTruthy();
      expect(rowEl.textContent).toBe('Custom content');
    });

    it('should pass correct rowIndex to cardRenderer', () => {
      const cardRenderer = vi.fn(() => document.createElement('div'));
      const plugin = new ResponsivePlugin({
        breakpoint: 500,
        cardRenderer,
      });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      plugin.setResponsive(true);

      const rowEl = document.createElement('div');
      plugin.renderRow({ id: 5 }, rowEl, 42);

      expect(cardRenderer).toHaveBeenCalledWith({ id: 5 }, 42);
    });

    it('should add responsive-card class to row element', () => {
      const plugin = new ResponsivePlugin({
        breakpoint: 500,
        cardRenderer: () => document.createElement('div'),
      });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      plugin.setResponsive(true);

      const rowEl = document.createElement('div');
      plugin.renderRow({ id: 1 }, rowEl, 0);

      expect(rowEl.classList.contains('responsive-card')).toBe(true);
    });

    it('should clear existing content before rendering card', () => {
      const plugin = new ResponsivePlugin({
        breakpoint: 500,
        cardRenderer: () => {
          const card = document.createElement('div');
          card.textContent = 'New content';
          return card;
        },
      });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      plugin.setResponsive(true);

      const rowEl = document.createElement('div');
      rowEl.innerHTML = '<span>Old content</span><span>More old content</span>';

      plugin.renderRow({ id: 1 }, rowEl, 0);

      expect(rowEl.textContent).toBe('New content');
      expect(rowEl.querySelectorAll('span').length).toBe(0);
    });

    it('should apply explicit cardRowHeight when provided', () => {
      const plugin = new ResponsivePlugin({
        breakpoint: 500,
        cardRenderer: () => document.createElement('div'),
        cardRowHeight: 120,
      });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      plugin.setResponsive(true);

      const rowEl = document.createElement('div');
      plugin.renderRow({ id: 1 }, rowEl, 0);

      expect(rowEl.style.height).toBe('120px');
    });

    it('should set height to auto when cardRowHeight is auto', () => {
      const plugin = new ResponsivePlugin({
        breakpoint: 500,
        cardRenderer: () => document.createElement('div'),
        cardRowHeight: 'auto',
      });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      plugin.setResponsive(true);

      const rowEl = document.createElement('div');
      rowEl.style.height = '50px'; // Simulate virtualization height
      plugin.renderRow({ id: 1 }, rowEl, 0);

      expect(rowEl.style.height).toBe('auto');
    });

    it('should default to auto height when cardRowHeight not specified', () => {
      const plugin = new ResponsivePlugin({
        breakpoint: 500,
        cardRenderer: () => document.createElement('div'),
        // No cardRowHeight specified
      });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      plugin.setResponsive(true);

      const rowEl = document.createElement('div');
      rowEl.style.height = '50px';
      plugin.renderRow({ id: 1 }, rowEl, 0);

      expect(rowEl.style.height).toBe('auto');
    });

    it('should not use cardRenderer for CSS-only mode (no cardRenderer provided)', () => {
      const plugin = new ResponsivePlugin({
        breakpoint: 500,
        // No cardRenderer
      });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      plugin.setResponsive(true);

      const rowEl = document.createElement('div');
      rowEl.innerHTML = '<div class="cell">Original cell</div>';

      const result = plugin.renderRow({ id: 1 }, rowEl, 0);

      // Should not handle - let CSS-only mode work via default rendering
      expect(result).toBeUndefined();
      expect(rowEl.textContent).toBe('Original cell'); // Unchanged
    });

    it('should skip group rows when cardRenderer is provided', () => {
      const cardRenderer = vi.fn(() => document.createElement('div'));
      const plugin = new ResponsivePlugin({
        breakpoint: 500,
        cardRenderer,
      });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      plugin.setResponsive(true);

      // Simulate a group row from GroupingRowsPlugin
      const groupRow = {
        __isGroupRow: true,
        __groupKey: 'Engineering',
        __groupRows: [{ id: 1 }, { id: 2 }],
      };

      const rowEl = document.createElement('div');
      rowEl.innerHTML = '<div class="cell">Group header content</div>';

      const result = plugin.renderRow(groupRow, rowEl, 0);

      // Should return undefined to let GroupingRowsPlugin handle group row rendering
      expect(result).toBeUndefined();
      // cardRenderer should NOT have been called for group rows
      expect(cardRenderer).not.toHaveBeenCalled();
      // Content should be unchanged
      expect(rowEl.textContent).toBe('Group header content');
    });

    it('should allow updating cardRenderer via setCardRenderer', () => {
      const plugin = new ResponsivePlugin<{ id: number }>({
        breakpoint: 500,
      });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      plugin.setResponsive(true);

      // Initially no cardRenderer - renderRow returns undefined
      const rowEl = document.createElement('div');
      expect(plugin.renderRow({ id: 1 }, rowEl, 0)).toBeUndefined();

      // Set a cardRenderer dynamically
      const newRenderer = (row: { id: number }) => {
        const el = document.createElement('div');
        el.textContent = `Custom-${row.id}`;
        return el;
      };
      plugin.setCardRenderer(newRenderer);

      // Now renderRow should use the new renderer
      const rowEl2 = document.createElement('div');
      const result = plugin.renderRow({ id: 42 }, rowEl2, 0);

      expect(result).toBe(true);
      expect(rowEl2.textContent).toBe('Custom-42');
    });
  });

  describe('multiple breakpoints', () => {
    it('should activate breakpoints based on width', () => {
      const plugin = new ResponsivePlugin({
        breakpoints: [
          { maxWidth: 800, hiddenColumns: ['secondary'] },
          { maxWidth: 600, hiddenColumns: ['secondary', 'tertiary'] },
          { maxWidth: 400, cardLayout: true },
        ],
      });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      // Above all breakpoints - none active
      resizeObserverInstance?.callback([{ contentRect: { width: 900 } }]);
      vi.runAllTimers();
      expect(plugin.getActiveBreakpoint()).toBeNull();
      expect(plugin.isResponsive()).toBe(false);

      // At 800px - first breakpoint active
      resizeObserverInstance?.callback([{ contentRect: { width: 800 } }]);
      vi.runAllTimers();
      expect(plugin.getActiveBreakpoint()?.maxWidth).toBe(800);
      expect(plugin.isResponsive()).toBe(false);

      // At 600px - second breakpoint active (most specific match)
      resizeObserverInstance?.callback([{ contentRect: { width: 600 } }]);
      vi.runAllTimers();
      expect(plugin.getActiveBreakpoint()?.maxWidth).toBe(600);
      expect(plugin.isResponsive()).toBe(false);

      // At 400px - card layout breakpoint active
      resizeObserverInstance?.callback([{ contentRect: { width: 400 } }]);
      vi.runAllTimers();
      expect(plugin.getActiveBreakpoint()?.maxWidth).toBe(400);
      expect(plugin.isResponsive()).toBe(true);
    });

    it('should apply breakpoint-specific hiddenColumns', () => {
      const plugin = new ResponsivePlugin({
        breakpoints: [
          { maxWidth: 800, hiddenColumns: ['secondary'] },
          { maxWidth: 500, hiddenColumns: ['secondary', 'tertiary'] },
        ],
      });
      const mockGrid = createMockGridWithMultipleCells();
      plugin.attach(mockGrid as never);

      // Trigger 800px breakpoint
      resizeObserverInstance?.callback([{ contentRect: { width: 800 } }]);
      vi.runAllTimers();
      plugin.afterRender();

      // Check that 'secondary' is marked hidden
      const secondaryCell = mockGrid.querySelector('.cell[data-field="secondary"]');
      expect(secondaryCell?.hasAttribute('data-responsive-hidden')).toBe(true);

      const tertiaryCell = mockGrid.querySelector('.cell[data-field="tertiary"]');
      expect(tertiaryCell?.hasAttribute('data-responsive-hidden')).toBe(false);

      // Trigger 500px breakpoint
      resizeObserverInstance?.callback([{ contentRect: { width: 500 } }]);
      vi.runAllTimers();
      plugin.afterRender();

      // Both should be hidden now
      expect(secondaryCell?.hasAttribute('data-responsive-hidden')).toBe(true);
      expect(tertiaryCell?.hasAttribute('data-responsive-hidden')).toBe(true);
    });

    it('should fall back to top-level hiddenColumns when breakpoint has none', () => {
      const plugin = new ResponsivePlugin({
        hiddenColumns: ['fallback'],
        breakpoints: [
          { maxWidth: 800 }, // No hiddenColumns specified
        ],
      });
      const mockGrid = createMockGridWithMultipleCells();
      plugin.attach(mockGrid as never);

      // Trigger 800px breakpoint (no specific hiddenColumns)
      resizeObserverInstance?.callback([{ contentRect: { width: 800 } }]);
      vi.runAllTimers();
      plugin.afterRender();

      // Should use top-level hiddenColumns
      const fallbackCell = mockGrid.querySelector('.cell[data-field="fallback"]');
      expect(fallbackCell?.hasAttribute('data-responsive-hidden')).toBe(true);
    });

    it('should emit responsive-change event for breakpoint changes', () => {
      const plugin = new ResponsivePlugin({
        breakpoints: [{ maxWidth: 600, hiddenColumns: ['secondary'] }],
      });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      // Trigger breakpoint
      resizeObserverInstance?.callback([{ contentRect: { width: 600 } }]);
      vi.runAllTimers();

      expect(mockGrid.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'responsive-change',
          detail: expect.objectContaining({
            isResponsive: false,
            width: 600,
            breakpoint: 600,
          }),
        }),
      );
    });
  });

  describe('enhanced hiddenColumns', () => {
    it('should support string values (hide entire cell)', () => {
      const plugin = new ResponsivePlugin({
        breakpoint: 500,
        hiddenColumns: ['name'],
      });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      // Enter responsive mode
      resizeObserverInstance?.callback([{ contentRect: { width: 400 } }]);
      vi.runAllTimers();
      plugin.afterRender();

      const cell = mockGrid.querySelector('.cell[data-field="name"]');
      expect(cell?.hasAttribute('data-responsive-hidden')).toBe(true);
      expect(cell?.hasAttribute('data-responsive-value-only')).toBe(false);
    });

    it('should support object syntax with showValue: true', () => {
      const plugin = new ResponsivePlugin({
        breakpoint: 500,
        hiddenColumns: [{ field: 'email', showValue: true }],
      });
      const mockGrid = createMockGridWithMultipleCells();
      plugin.attach(mockGrid as never);

      // Enter responsive mode
      resizeObserverInstance?.callback([{ contentRect: { width: 400 } }]);
      vi.runAllTimers();
      plugin.afterRender();

      const emailCell = mockGrid.querySelector('.cell[data-field="email"]');
      expect(emailCell?.hasAttribute('data-responsive-value-only')).toBe(true);
      expect(emailCell?.hasAttribute('data-responsive-hidden')).toBe(false);
    });

    it('should support mixed hidden and value-only columns', () => {
      const plugin = new ResponsivePlugin({
        breakpoint: 500,
        hiddenColumns: ['secondary', { field: 'email', showValue: true }, 'tertiary'],
      });
      const mockGrid = createMockGridWithMultipleCells();
      plugin.attach(mockGrid as never);

      // Enter responsive mode
      resizeObserverInstance?.callback([{ contentRect: { width: 400 } }]);
      vi.runAllTimers();
      plugin.afterRender();

      const secondaryCell = mockGrid.querySelector('.cell[data-field="secondary"]');
      expect(secondaryCell?.hasAttribute('data-responsive-hidden')).toBe(true);

      const emailCell = mockGrid.querySelector('.cell[data-field="email"]');
      expect(emailCell?.hasAttribute('data-responsive-value-only')).toBe(true);

      const tertiaryCell = mockGrid.querySelector('.cell[data-field="tertiary"]');
      expect(tertiaryCell?.hasAttribute('data-responsive-hidden')).toBe(true);
    });

    it('should clear responsive attributes on non-hidden cells', () => {
      const plugin = new ResponsivePlugin({
        breakpoint: 500,
        hiddenColumns: ['secondary'],
      });
      const mockGrid = createMockGridWithMultipleCells();
      plugin.attach(mockGrid as never);

      // Add a stale attribute to a cell
      const nameCell = mockGrid.querySelector('.cell[data-field="name"]');
      nameCell?.setAttribute('data-responsive-hidden', '');

      // Enter responsive mode
      resizeObserverInstance?.callback([{ contentRect: { width: 400 } }]);
      vi.runAllTimers();
      plugin.afterRender();

      // Stale attribute should be removed
      expect(nameCell?.hasAttribute('data-responsive-hidden')).toBe(false);
    });

    it('should not fade columns out while the table shows every column', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500, hiddenColumns: ['secondary'] });
      const mockGrid = createMockGridWithMultipleCells();
      const secondary = mockGrid.querySelector<HTMLElement>('.cell[data-field="secondary"]');
      const animate = vi.fn(() => ({ id: '', currentTime: 0, cancel: vi.fn() }));
      Object.assign(secondary as object, { animate, getAnimations: () => [] });

      // Attaching in table layout must not start a fade: the column stays
      // visible, so a forwards-filling fade-out would strand it at opacity 0.
      plugin.attach(mockGrid as never);
      plugin.afterRender();

      expect(animate).not.toHaveBeenCalled();
      expect(mockGrid.hasAttribute('data-responsive-column-fade')).toBe(false);
    });

    it('should restore the card layout attributes when re-attached in card mode', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500, hideHeader: true });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);
      plugin.setResponsive(true);

      // A `gridConfig` rebuild detaches and re-attaches the same instance.
      plugin.detach();
      expect(mockGrid.hasAttribute('data-responsive')).toBe(false);
      plugin.attach(mockGrid as never);

      expect(plugin.isResponsive()).toBe(true);
      expect(mockGrid.hasAttribute('data-responsive')).toBe(true);
      expect(mockGrid.hasAttribute('data-responsive-hide-header')).toBe(true);
    });
  });

  describe('animation', () => {
    it('should enable animations by default', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500 });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      plugin.setResponsive(true);

      expect(mockGrid.hasAttribute('data-responsive-animate')).toBe(true);
    });

    it('should disable animations when animate: false', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500, animate: false });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      plugin.setResponsive(true);

      expect(mockGrid.hasAttribute('data-responsive-animate')).toBe(false);
    });

    it('should disable animations when animation: false', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500, animation: false });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      plugin.setResponsive(true);

      expect(mockGrid.hasAttribute('data-responsive-animate')).toBe(false);
    });

    it('should let animation win over the deprecated animate flag', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500, animate: false, animation: 'fade' });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      plugin.setResponsive(true);

      expect(mockGrid.hasAttribute('data-responsive-animate')).toBe(true);
    });

    it('should set custom animation duration CSS variable', () => {
      const plugin = new ResponsivePlugin({
        breakpoint: 500,
        animationDuration: 350,
      });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      plugin.setResponsive(true);

      expect(mockGrid.style.getPropertyValue('--tbw-responsive-duration')).toBe('350ms');
    });

    it('should fade only the column whose visibility changed', () => {
      const plugin = new ResponsivePlugin({
        debounceMs: 0,
        breakpoints: [
          { maxWidth: 800, hiddenColumns: ['secondary'] },
          { maxWidth: 500, hiddenColumns: ['secondary', 'tertiary'] },
        ],
      });
      const mockGrid = createMockGridWithMultipleCells();
      plugin.attach(mockGrid as never);

      // happy-dom implements neither of these.
      const animate = vi.fn(() => ({ id: '', currentTime: 0 }));
      for (const cell of mockGrid.querySelectorAll('.cell[data-field]')) {
        Object.assign(cell, { animate, getAnimations: () => [] });
      }

      resizeObserverInstance?.callback([{ contentRect: { width: 800 } }]);
      plugin.afterRender();

      // `secondary` is the only column that changed, so it is the only one that moves.
      expect(animate).toHaveBeenCalledTimes(1);
      expect(animate.mock.instances[0]).toBe(mockGrid.querySelector('.cell[data-field="secondary"]'));
      expect(animate).toHaveBeenCalledWith([{ opacity: 1 }, { opacity: 0 }], {
        duration: 200,
        easing: 'ease-out',
        fill: 'forwards',
      });
      // The cell collapses with its track straight away; the track transition carries it.
      expect(mockGrid.querySelector('.cell[data-field="secondary"]')?.hasAttribute('data-responsive-hidden')).toBe(
        true,
      );
      expect(mockGrid.hasAttribute('data-responsive-column-fade')).toBe(true);

      // Once the window closes the column stops animating and the transition is lifted.
      animate.mockClear();
      vi.advanceTimersByTime(200);
      plugin.afterRender();
      expect(animate).not.toHaveBeenCalled();
      expect(mockGrid.hasAttribute('data-responsive-column-fade')).toBe(false);
      expect(mockGrid.querySelector('.cell[data-field="secondary"]')?.hasAttribute('data-responsive-hidden')).toBe(
        true,
      );

      // Hiding `tertiary` must not drag the already-hidden `secondary` back into view.
      resizeObserverInstance?.callback([{ contentRect: { width: 500 } }]);
      plugin.afterRender();

      expect(animate).toHaveBeenCalledTimes(1);
      expect(animate.mock.instances[0]).toBe(mockGrid.querySelector('.cell[data-field="tertiary"]'));
      expect(mockGrid.querySelector('.cell[data-field="secondary"]')?.hasAttribute('data-responsive-hidden')).toBe(
        true,
      );
    });

    it('should fade a reappearing column back in', () => {
      const plugin = new ResponsivePlugin({
        debounceMs: 0,
        breakpoints: [{ maxWidth: 800, hiddenColumns: ['secondary'] }],
      });
      const mockGrid = createMockGridWithMultipleCells();
      plugin.attach(mockGrid as never);

      const animate = vi.fn(() => ({ id: '', currentTime: 0 }));
      for (const cell of mockGrid.querySelectorAll('.cell[data-field]')) {
        Object.assign(cell, { animate, getAnimations: () => [] });
      }

      resizeObserverInstance?.callback([{ contentRect: { width: 800 } }]);
      vi.advanceTimersByTime(200);
      plugin.afterRender();
      animate.mockClear();

      resizeObserverInstance?.callback([{ contentRect: { width: 1000 } }]);
      plugin.afterRender();

      expect(animate).toHaveBeenCalledTimes(1);
      expect(animate.mock.instances[0]).toBe(mockGrid.querySelector('.cell[data-field="secondary"]'));
      expect(animate).toHaveBeenCalledWith([{ opacity: 0 }, { opacity: 1 }], {
        duration: 200,
        easing: 'ease-out',
        fill: 'none',
      });
      expect(mockGrid.querySelector('.cell[data-field="secondary"]')?.hasAttribute('data-responsive-hidden')).toBe(
        false,
      );
    });

    it('should collapse the grid track of a hidden column and restore it', () => {
      const plugin = new ResponsivePlugin({
        debounceMs: 0,
        breakpoints: [{ maxWidth: 800, hiddenColumns: ['secondary'] }],
      });
      const mockGrid = createMockGridWithMultipleCells();
      const template = '60px 150px 1fr 100px minmax(80px, 1fr)';
      Object.assign(mockGrid, {
        _gridTemplate: template,
        _visibleColumns: [
          { field: 'name' },
          { field: 'email' },
          { field: 'secondary' },
          { field: 'tertiary' },
          { field: 'fallback' },
        ],
      });
      plugin.attach(mockGrid as never);

      resizeObserverInstance?.callback([{ contentRect: { width: 800 } }]);
      plugin.afterRender();

      // Only the hidden track collapses, and it keeps its unit family so the
      // track list still interpolates pairwise.
      expect(mockGrid.style.getPropertyValue('--tbw-column-template')).toBe('60px 150px 0fr 100px minmax(80px, 1fr)');

      // The collapse outlives the fade window — it is the resting state.
      vi.advanceTimersByTime(200);
      plugin.afterRender();
      expect(mockGrid.style.getPropertyValue('--tbw-column-template')).toBe('60px 150px 0fr 100px minmax(80px, 1fr)');

      resizeObserverInstance?.callback([{ contentRect: { width: 1000 } }]);
      plugin.afterRender();
      expect(mockGrid.style.getPropertyValue('--tbw-column-template')).toBe(template);
    });
  });

  describe('view transitions', () => {
    /** Stand in for `Element.startViewTransition()`, which happy-dom does not implement. */
    const stubViewTransition = (grid: HTMLElement) => {
      const finishers: Array<() => void> = [];
      const state = {
        calls: 0,
        update: undefined as (() => Promise<void>) | undefined,
        /** Settle the transition started by the nth call, or every pending one. */
        finish: (index?: number) => {
          if (index === undefined) finishers.forEach((resolve) => resolve());
          else finishers[index]?.();
        },
      };
      Object.assign(grid, {
        startViewTransition: (update: () => Promise<void>) => {
          state.calls++;
          state.update = update;
          let resolveFinished = (): void => undefined;
          const finished = new Promise<void>((resolve) => {
            resolveFinished = resolve;
          });
          finishers.push(resolveFinished);
          return { finished };
        },
      });
      return state;
    };

    it('should switch synchronously when view transitions are unsupported', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500 });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      resizeObserverInstance?.callback([{ contentRect: { width: 400 } }]);

      expect(mockGrid.hasAttribute('data-responsive')).toBe(true);
      expect(mockGrid.hasAttribute('data-responsive-transition')).toBe(false);
    });

    it('should drive the layout switch through a view transition when supported', async () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500 });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);
      const transition = stubViewTransition(mockGrid);

      resizeObserverInstance?.callback([{ contentRect: { width: 400 } }]);

      expect(transition.calls).toBe(1);
      expect(mockGrid.hasAttribute('data-responsive-transition')).toBe(true);
      // The DOM change is deferred into the transition's update callback...
      expect(mockGrid.hasAttribute('data-responsive')).toBe(false);
      // ...but the observable state flips immediately.
      expect(plugin.isResponsive()).toBe(true);

      await transition.update?.();
      expect(mockGrid.hasAttribute('data-responsive')).toBe(true);

      transition.finish();
      await vi.advanceTimersByTimeAsync(0);
      expect(mockGrid.hasAttribute('data-responsive-transition')).toBe(false);
    });

    it('should not use a view transition when animate is false', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500, animate: false });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);
      const transition = stubViewTransition(mockGrid);

      resizeObserverInstance?.callback([{ contentRect: { width: 400 } }]);

      expect(transition.calls).toBe(0);
      expect(mockGrid.hasAttribute('data-responsive')).toBe(true);
    });

    it('should withhold the keyframe fade when a view transition drives the switch', async () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500 });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);
      const transition = stubViewTransition(mockGrid);

      resizeObserverInstance?.callback([{ contentRect: { width: 400 } }]);
      await transition.update?.();

      // Leaving it on would replay `responsive-card-enter` once the transition
      // ends and `data-responsive-transition` is removed.
      expect(mockGrid.hasAttribute('data-responsive-animate')).toBe(false);
    });

    it("should name rows for morphing only when animation is 'morph-rows'", async () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500, animation: 'morph-rows' });
      const mockGrid = createMockGrid();
      const row = mockGrid.querySelector<HTMLElement>('.data-grid-row');
      row?.setAttribute('aria-rowindex', '2');
      plugin.attach(mockGrid as never);
      const transition = stubViewTransition(mockGrid);

      resizeObserverInstance?.callback([{ contentRect: { width: 400 } }]);

      expect(row?.style.getPropertyValue('view-transition-name')).toMatch(/^tbw-responsive-row-\d+-2$/);

      await transition.update?.();
      transition.finish();
      await vi.advanceTimersByTimeAsync(0);
      expect(row?.style.getPropertyValue('view-transition-name')).toBe('');
    });

    it('should leave rows unnamed by default', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500 });
      const mockGrid = createMockGrid();
      const row = mockGrid.querySelector<HTMLElement>('.data-grid-row');
      row?.setAttribute('aria-rowindex', '2');
      plugin.attach(mockGrid as never);
      stubViewTransition(mockGrid);

      resizeObserverInstance?.callback([{ contentRect: { width: 400 } }]);

      expect(row?.style.getPropertyValue('view-transition-name')).toBe('');
    });

    it("should name cells instead of rows when animation is 'morph-cells'", async () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500, animation: 'morph-cells' });
      const mockGrid = createMockGrid();
      const row = mockGrid.querySelector<HTMLElement>('.data-grid-row');
      const cell = mockGrid.querySelector<HTMLElement>('.data-grid-row > .cell');
      row?.setAttribute('aria-rowindex', '2');
      cell?.setAttribute('aria-colindex', '3');
      plugin.attach(mockGrid as never);
      const transition = stubViewTransition(mockGrid);

      resizeObserverInstance?.callback([{ contentRect: { width: 400 } }]);

      expect(cell?.style.getPropertyValue('view-transition-name')).toMatch(/^tbw-responsive-cell-\d+-2-3$/);
      // Naming the row too would lift the cell out of the row's own snapshot.
      expect(row?.style.getPropertyValue('view-transition-name')).toBe('');

      await transition.update?.();
      transition.finish();
      await vi.advanceTimersByTimeAsync(0);
      expect(cell?.style.getPropertyValue('view-transition-name')).toBe('');
    });

    it('should fall back to row morphing when the cell count exceeds the budget', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500, animation: 'morph-cells' });
      const mockGrid = createMockGrid();
      const row = mockGrid.querySelector<HTMLElement>('.data-grid-row');
      row?.setAttribute('aria-rowindex', '2');
      for (let i = 0; i < 151; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.setAttribute('aria-colindex', String(i + 1));
        row?.appendChild(cell);
      }
      plugin.attach(mockGrid as never);
      stubViewTransition(mockGrid);

      resizeObserverInstance?.callback([{ contentRect: { width: 400 } }]);

      expect(row?.style.getPropertyValue('view-transition-name')).toMatch(/^tbw-responsive-row-\d+-2$/);
      const cells = row?.querySelectorAll<HTMLElement>('.cell[aria-colindex]') ?? [];
      for (const cell of cells) {
        expect(cell.style.getPropertyValue('view-transition-name')).toBe('');
      }
    });

    it('should keep the newest transition intact when a superseded one settles', async () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500, debounceMs: 0, animation: 'morph-cells' });
      const mockGrid = createMockGrid();
      const row = mockGrid.querySelector<HTMLElement>('.data-grid-row');
      row?.setAttribute('aria-rowindex', '2');
      row?.querySelector('.cell')?.setAttribute('aria-colindex', '3');
      plugin.attach(mockGrid as never);
      const transition = stubViewTransition(mockGrid);

      // Dragging across the breakpoint starts a second switch before the first
      // one has settled.
      resizeObserverInstance?.callback([{ contentRect: { width: 400 } }]);
      resizeObserverInstance?.callback([{ contentRect: { width: 800 } }]);
      expect(transition.calls).toBe(2);

      transition.finish(0);
      await vi.advanceTimersByTimeAsync(0);

      const cell = row?.querySelector<HTMLElement>('.cell[aria-colindex]');
      expect(mockGrid.hasAttribute('data-responsive-transition')).toBe(true);
      expect(cell?.style.getPropertyValue('view-transition-name')).toMatch(/^tbw-responsive-cell-\d+-2-3$/);

      transition.finish(1);
      await vi.advanceTimersByTimeAsync(0);
      expect(mockGrid.hasAttribute('data-responsive-transition')).toBe(false);
      expect(cell?.style.getPropertyValue('view-transition-name')).toBe('');
    });

    it('should not snapshot the grid when only the hidden-column set changed', () => {
      const plugin = new ResponsivePlugin({
        debounceMs: 0,
        breakpoints: [
          { maxWidth: 900, hiddenColumns: ['startDate'] },
          { maxWidth: 700, hiddenColumns: ['startDate', 'email'] },
          { maxWidth: 400, cardLayout: true },
        ],
      });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);
      const transition = stubViewTransition(mockGrid);

      // Crossing 900 then 700 only changes which columns are hidden. Nothing
      // moves, so a whole-grid cross-fade would make every column shimmer.
      resizeObserverInstance?.callback([{ contentRect: { width: 800 } }]);
      resizeObserverInstance?.callback([{ contentRect: { width: 600 } }]);
      expect(transition.calls).toBe(0);
      expect(mockGrid.hasAttribute('data-responsive-transition')).toBe(false);

      // Crossing into card layout is a real layout switch.
      resizeObserverInstance?.callback([{ contentRect: { width: 300 } }]);
      expect(transition.calls).toBe(1);
    });

    it('should collapse the motion duration to zero when animation is off', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500, animate: false, animationDuration: 300 });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      resizeObserverInstance?.callback([{ contentRect: { width: 400 } }]);

      expect(mockGrid.style.getPropertyValue('--tbw-responsive-duration')).toBe('0ms');
    });
  });

  describe('light DOM configuration', () => {
    const createMockGridWithLightDom = (innerHTML: string) => {
      const grid = document.createElement('div');
      grid.className = 'tbw-grid';

      // Add light DOM element
      grid.innerHTML = innerHTML;

      // Add mock grid structure
      const container = document.createElement('div');
      container.className = 'tbw-grid-root';
      grid.appendChild(container);

      document.body.appendChild(grid);

      Object.assign(grid, {
        rows: [],
        columns: [],
        gridConfig: {},
        disconnectSignal: new AbortController().signal,
        requestRender: vi.fn(),
        requestAfterRender: vi.fn(),
        getPlugin: vi.fn(),
        getPluginByName: vi.fn(),
        _hostElement: grid,
      });

      grid.dispatchEvent = vi.fn();

      return grid as unknown as HTMLElement & {
        rows: unknown[];
        columns: unknown[];
        gridConfig: object;
        disconnectSignal: AbortSignal;
        requestRender: ReturnType<typeof vi.fn>;
        dispatchEvent: ReturnType<typeof vi.fn>;
      };
    };

    it('should parse breakpoint from light DOM element', () => {
      const mockGrid = createMockGridWithLightDom(
        '<tbw-grid-responsive-card breakpoint="600"></tbw-grid-responsive-card>',
      );
      const plugin = new ResponsivePlugin({});
      plugin.attach(mockGrid as never);

      // Trigger resize to check breakpoint
      resizeObserverInstance?.callback([{ contentRect: { width: 500 } }]);
      vi.runAllTimers();

      expect(plugin.isResponsive()).toBe(true);
    });

    it('should parse card-row-height from light DOM element', () => {
      const mockGrid = createMockGridWithLightDom(
        '<tbw-grid-responsive-card breakpoint="500" card-row-height="120"></tbw-grid-responsive-card>',
      );
      const plugin = new ResponsivePlugin({});
      plugin.attach(mockGrid as never);

      // Access private config via type assertion for testing
      const config = (plugin as unknown as { config: { cardRowHeight?: number | 'auto' } }).config;
      expect(config.cardRowHeight).toBe(120);
    });

    it('should parse card-row-height="auto" from light DOM element', () => {
      const mockGrid = createMockGridWithLightDom(
        '<tbw-grid-responsive-card breakpoint="500" card-row-height="auto"></tbw-grid-responsive-card>',
      );
      const plugin = new ResponsivePlugin({});
      plugin.attach(mockGrid as never);

      const config = (plugin as unknown as { config: { cardRowHeight?: number | 'auto' } }).config;
      expect(config.cardRowHeight).toBe('auto');
    });

    it('should parse hidden-columns from light DOM element', () => {
      const mockGrid = createMockGridWithLightDom(
        '<tbw-grid-responsive-card breakpoint="500" hidden-columns="createdAt, updatedAt, status"></tbw-grid-responsive-card>',
      );
      const plugin = new ResponsivePlugin({});
      plugin.attach(mockGrid as never);

      const config = (plugin as unknown as { config: { hiddenColumns?: string[] } }).config;
      expect(config.hiddenColumns).toEqual(['createdAt', 'updatedAt', 'status']);
    });

    it('should parse hide-header from light DOM element', () => {
      const mockGrid = createMockGridWithLightDom(
        '<tbw-grid-responsive-card breakpoint="500" hide-header="false"></tbw-grid-responsive-card>',
      );
      const plugin = new ResponsivePlugin({});
      plugin.attach(mockGrid as never);

      const config = (plugin as unknown as { config: { hideHeader?: boolean } }).config;
      expect(config.hideHeader).toBe(false);
    });

    it('should parse debounce-ms from light DOM element', () => {
      const mockGrid = createMockGridWithLightDom(
        '<tbw-grid-responsive-card breakpoint="500" debounce-ms="200"></tbw-grid-responsive-card>',
      );
      const plugin = new ResponsivePlugin({});
      plugin.attach(mockGrid as never);

      const config = (plugin as unknown as { config: { debounceMs?: number } }).config;
      expect(config.debounceMs).toBe(200);
    });

    it('should create cardRenderer from innerHTML template', () => {
      const mockGrid = createMockGridWithLightDom(
        `<tbw-grid-responsive-card breakpoint="500">
          <div class="custom-card">{{ row.name }}</div>
        </tbw-grid-responsive-card>`,
      );
      const plugin = new ResponsivePlugin({});
      plugin.attach(mockGrid as never);

      const config = (plugin as unknown as { config: { cardRenderer?: (row: unknown, idx: number) => HTMLElement } })
        .config;
      expect(config.cardRenderer).toBeDefined();

      // Test the renderer
      const result = config.cardRenderer!({ name: 'Alice' }, 0);
      expect(result).toBeInstanceOf(HTMLElement);
      expect(result.innerHTML).toContain('Alice');
      expect(result.classList.contains('tbw-responsive-card-content')).toBe(true);
    });

    it('should not override constructor config with light DOM if not present', () => {
      const mockGrid = createMockGridWithLightDom(
        '<tbw-grid-responsive-card breakpoint="600"></tbw-grid-responsive-card>',
      );
      const plugin = new ResponsivePlugin({ debounceMs: 300, hideHeader: false });
      plugin.attach(mockGrid as never);

      const config = (plugin as unknown as { config: { debounceMs?: number; hideHeader?: boolean } }).config;
      // Light DOM breakpoint overrides
      // But debounceMs and hideHeader should remain from constructor since not in light DOM
      expect(config.debounceMs).toBe(300);
      expect(config.hideHeader).toBe(false);
    });

    it('should light DOM values override constructor config when both present', () => {
      const mockGrid = createMockGridWithLightDom(
        '<tbw-grid-responsive-card breakpoint="600" debounce-ms="150"></tbw-grid-responsive-card>',
      );
      const plugin = new ResponsivePlugin({ breakpoint: 400, debounceMs: 300 });
      plugin.attach(mockGrid as never);

      const config = (plugin as unknown as { config: { breakpoint?: number; debounceMs?: number } }).config;
      // Light DOM values should override
      expect(config.breakpoint).toBe(600);
      expect(config.debounceMs).toBe(150);
    });

    it('should ignore light DOM parsing if no element present', () => {
      const mockGrid = createMockGridWithLightDom('');
      const plugin = new ResponsivePlugin({ breakpoint: 500 });
      plugin.attach(mockGrid as never);

      // Should use constructor config
      resizeObserverInstance?.callback([{ contentRect: { width: 400 } }]);
      vi.runAllTimers();

      expect(plugin.isResponsive()).toBe(true);
    });
  });
});

// Helper to create mock grid with multiple cells
function createMockGridWithMultipleCells() {
  const grid = document.createElement('div');
  grid.className = 'tbw-grid';

  const container = document.createElement('div');
  container.className = 'tbw-grid-root';
  grid.appendChild(container);

  // Row with multiple cells
  const row = document.createElement('div');
  row.className = 'data-grid-row';

  for (const field of ['name', 'email', 'secondary', 'tertiary', 'fallback']) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.setAttribute('data-field', field);
    row.appendChild(cell);
  }

  container.appendChild(row);
  document.body.appendChild(grid);

  Object.assign(grid, {
    rows: [],
    columns: [],
    gridConfig: {},
    disconnectSignal: new AbortController().signal,
    requestRender: vi.fn(),
    requestAfterRender: vi.fn(),
    getPlugin: vi.fn(),
    getPluginByName: vi.fn(),
    _hostElement: grid,
  });

  grid.dispatchEvent = vi.fn();

  return grid as unknown as HTMLElement & {
    rows: unknown[];
    columns: unknown[];
    gridConfig: object;
    disconnectSignal: AbortSignal;
    requestRender: ReturnType<typeof vi.fn>;
    dispatchEvent: ReturnType<typeof vi.fn>;
  };
}
