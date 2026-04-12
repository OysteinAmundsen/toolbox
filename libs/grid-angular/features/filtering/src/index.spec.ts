/**
 * Tests for injectGridFiltering – deferred isReady behavior and method delegation.
 *
 * The key fix: when `grid.ready()` resolves before Angular's Grid directive
 * has applied gridConfig (including the FilteringPlugin), `isReady` must be
 * deferred so consumers don't call plugin methods before the plugin exists.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Angular DI before importing the module under test
const mockIsReady = { value: false };
const mockSignal = vi.fn((initial: boolean) => {
  mockIsReady.value = initial;
  const sig = Object.assign(() => mockIsReady.value, {
    set: (v: boolean) => {
      mockIsReady.value = v;
    },
    asReadonly: () => sig,
  });
  return sig;
});
const mockElementRef = { nativeElement: document.createElement('div') };
const mockDestroyRef = { onDestroy: vi.fn() };
let afterNextRenderCallback: (() => void) | null = null;

vi.mock('@angular/core', () => ({
  inject: vi.fn((token: unknown) => {
    // ElementRef
    if ((token as any)?.name === 'ElementRef' || token === 'ElementRef') return mockElementRef;
    // DestroyRef
    return mockDestroyRef;
  }),
  ElementRef: { name: 'ElementRef' },
  DestroyRef: { name: 'DestroyRef' },
  signal: mockSignal,
  afterNextRender: vi.fn((cb: () => void) => {
    afterNextRenderCallback = cb;
  }),
}));

// Mock the grid features/plugins imports (they are side-effect only or type imports)
vi.mock('@toolbox-web/grid/features/filtering', () => ({}));
vi.mock('@toolbox-web/grid/plugins/filtering', () => ({
  FilteringPlugin: class FilteringPlugin {},
}));

// Import after mocks are set up
const { injectGridFiltering } = await import('./index.js');

describe('injectGridFiltering', () => {
  let mockGrid: {
    ready: () => Promise<void>;
    getPluginByName: ReturnType<typeof vi.fn>;
    querySelector?: unknown;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockIsReady.value = false;
    afterNextRenderCallback = null;

    mockGrid = {
      ready: () => Promise.resolve(),
      getPluginByName: vi.fn().mockReturnValue(undefined),
    };

    // Place the mock grid inside the host element
    const gridEl = document.createElement('tbw-grid') as unknown as HTMLElement;
    Object.assign(gridEl, mockGrid);
    mockElementRef.nativeElement = document.createElement('div');
    mockElementRef.nativeElement.appendChild(gridEl);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should set isReady immediately if plugin is already attached', async () => {
    mockGrid.getPluginByName.mockReturnValue({ name: 'filtering' });

    const result = injectGridFiltering();

    // Trigger afterNextRender to discover the grid
    afterNextRenderCallback?.();

    // Flush the ready() promise microtask
    await vi.advanceTimersByTimeAsync(0);

    expect(result.isReady()).toBe(true);
  });

  it('should defer isReady via setTimeout when plugin is not yet attached', async () => {
    // Plugin not available initially
    mockGrid.getPluginByName.mockReturnValue(undefined);

    const result = injectGridFiltering();

    // Trigger afterNextRender to discover the grid
    afterNextRenderCallback?.();

    // Flush the ready() promise microtasks (but not setTimeout)
    await Promise.resolve();
    await Promise.resolve();

    // isReady should NOT be true yet — waiting for setTimeout(0)
    expect(result.isReady()).toBe(false);

    // Flush the setTimeout(0)
    vi.advanceTimersByTime(1);

    expect(result.isReady()).toBe(true);
  });

  describe('method delegation', () => {
    let mockPlugin: Record<string, ReturnType<typeof vi.fn>>;

    beforeEach(() => {
      mockPlugin = {
        setFilter: vi.fn(),
        getFilter: vi.fn().mockReturnValue({ field: 'name', operator: 'contains', value: 'test' }),
        getFilters: vi.fn().mockReturnValue([]),
        setFilterModel: vi.fn(),
        clearAllFilters: vi.fn(),
        clearFieldFilter: vi.fn(),
        isFieldFiltered: vi.fn().mockReturnValue(true),
        getFilteredRowCount: vi.fn().mockReturnValue(42),
        getUniqueValues: vi.fn().mockReturnValue(['a', 'b']),
        getStaleFilters: vi.fn().mockReturnValue([]),
        getBlankMode: vi.fn().mockReturnValue('nonBlank'),
        toggleBlankFilter: vi.fn(),
      };
      mockGrid.getPluginByName.mockReturnValue(mockPlugin);
    });

    it('should delegate setFilter to the plugin', () => {
      const result = injectGridFiltering();
      afterNextRenderCallback?.();

      result.setFilter('name', { type: 'text', operator: 'contains', value: 'test' });
      expect(mockPlugin.setFilter).toHaveBeenCalledWith(
        'name',
        { type: 'text', operator: 'contains', value: 'test' },
        undefined,
      );
    });

    it('should pass options to setFilter', () => {
      const result = injectGridFiltering();
      afterNextRenderCallback?.();

      result.setFilter('name', { type: 'text', operator: 'equals', value: 'x' }, { silent: true });
      expect(mockPlugin.setFilter).toHaveBeenCalledWith(
        'name',
        { type: 'text', operator: 'equals', value: 'x' },
        { silent: true },
      );
    });

    it('should delegate getFilter to the plugin', () => {
      const result = injectGridFiltering();
      afterNextRenderCallback?.();

      const filter = result.getFilter('name');
      expect(mockPlugin.getFilter).toHaveBeenCalledWith('name');
      expect(filter).toEqual({ field: 'name', operator: 'contains', value: 'test' });
    });

    it('should delegate getFilters to the plugin', () => {
      const result = injectGridFiltering();
      afterNextRenderCallback?.();

      const filters = result.getFilters();
      expect(mockPlugin.getFilters).toHaveBeenCalled();
      expect(filters).toEqual([]);
    });

    it('should delegate setFilterModel to the plugin', () => {
      const result = injectGridFiltering();
      afterNextRenderCallback?.();

      const filters = [{ field: 'status', operator: 'equals', value: 'active' }];
      result.setFilterModel(filters as any);
      expect(mockPlugin.setFilterModel).toHaveBeenCalledWith(filters, undefined);
    });

    it('should delegate clearAllFilters to the plugin', () => {
      const result = injectGridFiltering();
      afterNextRenderCallback?.();

      result.clearAllFilters();
      expect(mockPlugin.clearAllFilters).toHaveBeenCalledWith(undefined);
    });

    it('should delegate clearAllFilters with options', () => {
      const result = injectGridFiltering();
      afterNextRenderCallback?.();

      result.clearAllFilters({ silent: true });
      expect(mockPlugin.clearAllFilters).toHaveBeenCalledWith({ silent: true });
    });

    it('should delegate clearFieldFilter to the plugin', () => {
      const result = injectGridFiltering();
      afterNextRenderCallback?.();

      result.clearFieldFilter('name');
      expect(mockPlugin.clearFieldFilter).toHaveBeenCalledWith('name', undefined);
    });

    it('should delegate isFieldFiltered to the plugin', () => {
      const result = injectGridFiltering();
      afterNextRenderCallback?.();

      const filtered = result.isFieldFiltered('name');
      expect(mockPlugin.isFieldFiltered).toHaveBeenCalledWith('name');
      expect(filtered).toBe(true);
    });

    it('should delegate getFilteredRowCount to the plugin', () => {
      const result = injectGridFiltering();
      afterNextRenderCallback?.();

      const count = result.getFilteredRowCount();
      expect(mockPlugin.getFilteredRowCount).toHaveBeenCalled();
      expect(count).toBe(42);
    });

    it('should delegate getUniqueValues to the plugin', () => {
      const result = injectGridFiltering();
      afterNextRenderCallback?.();

      const values = result.getUniqueValues('status');
      expect(mockPlugin.getUniqueValues).toHaveBeenCalledWith('status');
      expect(values).toEqual(['a', 'b']);
    });

    it('should delegate getStaleFilters to the plugin', () => {
      const result = injectGridFiltering();
      afterNextRenderCallback?.();

      const stale = result.getStaleFilters();
      expect(mockPlugin.getStaleFilters).toHaveBeenCalled();
      expect(stale).toEqual([]);
    });

    it('should delegate getBlankMode to the plugin', () => {
      const result = injectGridFiltering();
      afterNextRenderCallback?.();

      const mode = result.getBlankMode('status');
      expect(mockPlugin.getBlankMode).toHaveBeenCalledWith('status');
      expect(mode).toBe('nonBlank');
    });

    it('should delegate toggleBlankFilter to the plugin', () => {
      const result = injectGridFiltering();
      afterNextRenderCallback?.();

      result.toggleBlankFilter('status', 'blank' as any);
      expect(mockPlugin.toggleBlankFilter).toHaveBeenCalledWith('status', 'blank');
    });
  });

  describe('methods without plugin', () => {
    beforeEach(() => {
      mockGrid.getPluginByName.mockReturnValue(undefined);
    });

    it('should warn and no-op for setFilter when plugin is missing', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
      const result = injectGridFiltering();
      afterNextRenderCallback?.();

      result.setFilter('name', { type: 'text', operator: 'contains', value: 'x' });
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0][0]).toContain('FilteringPlugin not found');
      warnSpy.mockRestore();
    });

    it('should warn and no-op for setFilterModel when plugin is missing', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
      const result = injectGridFiltering();
      afterNextRenderCallback?.();

      result.setFilterModel([]);
      expect(warnSpy).toHaveBeenCalledOnce();
      warnSpy.mockRestore();
    });

    it('should warn and no-op for clearAllFilters when plugin is missing', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
      const result = injectGridFiltering();
      afterNextRenderCallback?.();

      result.clearAllFilters();
      expect(warnSpy).toHaveBeenCalledOnce();
      warnSpy.mockRestore();
    });

    it('should warn and no-op for clearFieldFilter when plugin is missing', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
      const result = injectGridFiltering();
      afterNextRenderCallback?.();

      result.clearFieldFilter('name');
      expect(warnSpy).toHaveBeenCalledOnce();
      warnSpy.mockRestore();
    });

    it('should warn and no-op for toggleBlankFilter when plugin is missing', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
      const result = injectGridFiltering();
      afterNextRenderCallback?.();

      result.toggleBlankFilter('name', 'blank' as any);
      expect(warnSpy).toHaveBeenCalledOnce();
      warnSpy.mockRestore();
    });

    it('should return undefined for getFilter when plugin is missing', () => {
      const result = injectGridFiltering();
      afterNextRenderCallback?.();

      expect(result.getFilter('name')).toBeUndefined();
    });

    it('should return empty array for getFilters when plugin is missing', () => {
      const result = injectGridFiltering();
      afterNextRenderCallback?.();

      expect(result.getFilters()).toEqual([]);
    });

    it('should return false for isFieldFiltered when plugin is missing', () => {
      const result = injectGridFiltering();
      afterNextRenderCallback?.();

      expect(result.isFieldFiltered('name')).toBe(false);
    });

    it('should return 0 for getFilteredRowCount when plugin is missing', () => {
      const result = injectGridFiltering();
      afterNextRenderCallback?.();

      expect(result.getFilteredRowCount()).toBe(0);
    });

    it('should return empty array for getUniqueValues when plugin is missing', () => {
      const result = injectGridFiltering();
      afterNextRenderCallback?.();

      expect(result.getUniqueValues('name')).toEqual([]);
    });

    it('should return empty array for getStaleFilters when plugin is missing', () => {
      const result = injectGridFiltering();
      afterNextRenderCallback?.();

      expect(result.getStaleFilters()).toEqual([]);
    });

    it('should return "all" for getBlankMode when plugin is missing', () => {
      const result = injectGridFiltering();
      afterNextRenderCallback?.();

      expect(result.getBlankMode('name')).toBe('all');
    });
  });

  describe('MutationObserver fallback', () => {
    it('should set up MutationObserver when grid is not discovered immediately', () => {
      // Clear the host element so grid isn't found
      mockElementRef.nativeElement = document.createElement('div');

      const result = injectGridFiltering();
      afterNextRenderCallback?.();

      // onDestroy should have been called to register observer cleanup
      expect(mockDestroyRef.onDestroy).toHaveBeenCalled();
    });
  });
});
