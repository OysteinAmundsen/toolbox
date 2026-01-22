import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResponsivePlugin } from './ResponsivePlugin';

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
      getPlugin: vi.fn(),
      getPluginByName: vi.fn(),
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

    it('should debounce resize events', () => {
      const plugin = new ResponsivePlugin({ breakpoint: 500, debounceMs: 200 });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as never);

      // Multiple rapid resizes
      resizeObserverInstance?.callback([{ contentRect: { width: 600 } }]);
      resizeObserverInstance?.callback([{ contentRect: { width: 550 } }]);
      resizeObserverInstance?.callback([{ contentRect: { width: 400 } }]);

      // Before debounce timeout
      expect(plugin.isResponsive()).toBe(false);

      // After debounce timeout - only last value should matter
      vi.runAllTimers();
      expect(plugin.isResponsive()).toBe(true);
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
});
