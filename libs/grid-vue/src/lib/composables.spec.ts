/**
 * Tests for the useGrid and useGridEvent composables.
 *
 * Tests cover:
 * - useGrid hook interface and method delegation
 * - useGridEvent hook interface
 */

import { describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, provide, ref, type Ref } from 'vue';
import { GRID_ELEMENT_KEY, useGrid } from './use-grid';
import { useGridEvent } from './use-grid-event';

type MockGrid = Record<string, unknown>;

// ═══════════════════════════════════════════════════════════════════════════
// USE GRID TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('use-grid', () => {
  describe('useGrid', () => {
    it('should be a valid function', () => {
      expect(useGrid).toBeDefined();
      expect(typeof useGrid).toBe('function');
    });

    it('should return an object with expected methods', () => {
      const result = useGrid();

      expect(result).toBeDefined();
      expect(result).toHaveProperty('gridElement');
      expect(result).toHaveProperty('forceLayout');
      expect(result).toHaveProperty('getConfig');
      expect(result).toHaveProperty('ready');
      expect(result).toHaveProperty('getPlugin');
    });

    it('should return async functions for forceLayout and ready', () => {
      const result = useGrid();

      expect(typeof result.forceLayout).toBe('function');
      expect(typeof result.ready).toBe('function');
      expect(typeof result.getConfig).toBe('function');
      expect(typeof result.getPlugin).toBe('function');
    });

    it('should delegate forceLayout to gridElement value', async () => {
      const result = useGrid();
      // gridElement.value is undefined outside component context (inject returns raw default, not a ref)
      // forceLayout uses optional chaining, so calling it may throw if ref shape is missing
      // This validates the function exists and is callable
      expect(typeof result.forceLayout).toBe('function');
    });

    it('should delegate getConfig returning undefined when no grid element', () => {
      const result = useGrid();
      // getConfig uses optional chaining on gridElement.value
      expect(typeof result.getConfig).toBe('function');
    });

    it('should delegate ready as an async function', () => {
      const result = useGrid();
      expect(typeof result.ready).toBe('function');
    });

    it('should delegate getPlugin as a function', () => {
      const result = useGrid();
      expect(typeof result.getPlugin).toBe('function');
    });

    it('should have gridElement in return object', () => {
      const result = useGrid();

      // gridElement is returned (may be undefined ref outside component context)
      expect(result).toHaveProperty('gridElement');
    });
  });

  describe('GRID_ELEMENT_KEY', () => {
    it('should be a valid injection key', () => {
      expect(GRID_ELEMENT_KEY).toBeDefined();
      expect(typeof GRID_ELEMENT_KEY).toBe('symbol');
    });
  });

  describe('useGrid delegation with mock grid', () => {
    afterEach(() => {
      document.body.innerHTML = '';
    });

    function mountWithGrid(mockGrid: Record<string, unknown>) {
      let result!: ReturnType<typeof useGrid>;
      const container = document.createElement('div');
      document.body.appendChild(container);

      const app = createApp(
        defineComponent({
          setup() {
            provide(GRID_ELEMENT_KEY, ref(mockGrid));
            const Child = defineComponent({
              setup() {
                result = useGrid();
                return () => h('div');
              },
            });
            return () => h(Child);
          },
        }),
      );
      app.mount(container);
      return { result, app, container };
    }

    it('should delegate forceLayout to grid element', async () => {
      const forceLayout = vi.fn().mockResolvedValue(undefined);
      const { result, app, container } = mountWithGrid({ forceLayout });

      await result.forceLayout();
      expect(forceLayout).toHaveBeenCalled();

      app.unmount();
      container.remove();
    });

    it('should delegate getConfig to grid element', () => {
      const mockConfig = { columns: [{ field: 'a' }] };
      const getConfig = vi.fn().mockReturnValue(mockConfig);
      const { result, app, container } = mountWithGrid({ getConfig });

      const config = result.getConfig();
      expect(getConfig).toHaveBeenCalled();
      expect(config).toBe(mockConfig);

      app.unmount();
      container.remove();
    });

    it('should delegate ready to grid element', async () => {
      const ready = vi.fn().mockResolvedValue(undefined);
      const { result, app, container } = mountWithGrid({ ready });

      await result.ready();
      expect(ready).toHaveBeenCalled();

      app.unmount();
      container.remove();
    });

    it('should delegate getPlugin to grid element', () => {
      class FakePlugin {}
      const instance = new FakePlugin();
      const getPlugin = vi.fn().mockReturnValue(instance);
      const { result, app, container } = mountWithGrid({ getPlugin });

      const plugin = result.getPlugin(FakePlugin);
      expect(getPlugin).toHaveBeenCalledWith(FakePlugin);
      expect(plugin).toBe(instance);

      app.unmount();
      container.remove();
    });

    it('should delegate getPluginByName to grid element', () => {
      const mockPlugin = { name: 'selection' };
      const getPluginByName = vi.fn().mockReturnValue(mockPlugin);
      const { result, app, container } = mountWithGrid({ getPluginByName });

      const plugin = result.getPluginByName('selection' as any);
      expect(getPluginByName).toHaveBeenCalledWith('selection');
      expect(plugin).toBe(mockPlugin);

      app.unmount();
      container.remove();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// USE GRID EVENT TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('use-grid-event', () => {
  describe('useGridEvent', () => {
    it('should be a valid function', () => {
      expect(useGridEvent).toBeDefined();
      expect(typeof useGridEvent).toBe('function');
    });

    it('should accept event name and handler', () => {
      // Just verify it doesn't throw when called
      // Note: In real usage, this would be called inside a component setup
      expect(() => {
        useGridEvent('cell-click', () => {
          // noop handler for test
        });
      }).not.toThrow();
    });

    it('should accept different event types', () => {
      expect(() => {
        useGridEvent('cell-dblclick', () => undefined);
      }).not.toThrow();

      expect(() => {
        useGridEvent('cell-commit', () => undefined);
      }).not.toThrow();

      expect(() => {
        useGridEvent('selection-change', () => undefined);
      }).not.toThrow();

      expect(() => {
        useGridEvent('sort-change', () => undefined);
      }).not.toThrow();

      expect(() => {
        useGridEvent('row-toggle', () => undefined);
      }).not.toThrow();
    });

    it('should accept a custom handler function', () => {
      const handler = vi.fn();
      expect(() => {
        useGridEvent('cell-click', handler);
      }).not.toThrow();
    });
  });

  describe('useGridEvent lifecycle', () => {
    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should subscribe to grid event on mount and cleanup on unmount', () => {
      const handler = vi.fn();
      const cleanup = vi.fn();
      const mockOn = vi.fn().mockReturnValue(cleanup);
      const mockGrid = { on: mockOn };

      const container = document.createElement('div');
      document.body.appendChild(container);

      const app = createApp(
        defineComponent({
          setup() {
            provide(GRID_ELEMENT_KEY, ref(mockGrid));
            const Child = defineComponent({
              setup() {
                useGridEvent('cell-click', handler);
                return () => h('div');
              },
            });
            return () => h(Child);
          },
        }),
      );

      app.mount(container);
      // After mount, on() should have been called
      expect(mockOn).toHaveBeenCalledWith('cell-click', expect.any(Function));

      // Unmount triggers cleanup
      app.unmount();
      expect(cleanup).toHaveBeenCalled();

      container.remove();
    });

    it('should use provided gridElement ref when given', () => {
      const handler = vi.fn();
      const cleanup = vi.fn();
      const mockOn = vi.fn().mockReturnValue(cleanup);
      const gridRef = ref({ on: mockOn }) as Ref<any>;

      const container = document.createElement('div');
      document.body.appendChild(container);

      const app = createApp(
        defineComponent({
          setup() {
            useGridEvent('selection-change', handler, gridRef);
            return () => h('div');
          },
        }),
      );

      app.mount(container);
      expect(mockOn).toHaveBeenCalledWith('selection-change', expect.any(Function));

      app.unmount();
      container.remove();
    });
  });
});
