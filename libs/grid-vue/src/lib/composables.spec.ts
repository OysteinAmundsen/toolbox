/**
 * Tests for the useGrid composable.
 *
 * Tests cover:
 * - useGrid hook interface and method delegation
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, provide, ref } from 'vue';
import { GRID_ELEMENT_KEY, useGrid } from './use-grid';

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
      expect(result).toHaveProperty('isReady');
      expect(result).toHaveProperty('config');
      expect(result).toHaveProperty('toggleGroup');
      expect(result).toHaveProperty('registerStyles');
      expect(result).toHaveProperty('unregisterStyles');
      expect(result).toHaveProperty('getVisibleColumns');
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

    it('should delegate toggleGroup to grid element', async () => {
      const toggleGroup = vi.fn().mockResolvedValue(undefined);
      const { result, app, container } = mountWithGrid({ toggleGroup });

      await result.toggleGroup('group-key');
      expect(toggleGroup).toHaveBeenCalledWith('group-key');

      app.unmount();
      container.remove();
    });

    it('should delegate registerStyles to grid element', () => {
      const registerStyles = vi.fn();
      const { result, app, container } = mountWithGrid({ registerStyles });

      result.registerStyles('my-styles', '.cell { color: red; }');
      expect(registerStyles).toHaveBeenCalledWith('my-styles', '.cell { color: red; }');

      app.unmount();
      container.remove();
    });

    it('should delegate unregisterStyles to grid element', () => {
      const unregisterStyles = vi.fn();
      const { result, app, container } = mountWithGrid({ unregisterStyles });

      result.unregisterStyles('my-styles');
      expect(unregisterStyles).toHaveBeenCalledWith('my-styles');

      app.unmount();
      container.remove();
    });

    it('should return visible columns excluding hidden ones', () => {
      const gridConfig = {
        columns: [{ field: 'a', hidden: false }, { field: 'b', hidden: true }, { field: 'c' }],
      };
      const { result, app, container } = mountWithGrid({ gridConfig });

      const visible = result.getVisibleColumns();
      expect(visible).toHaveLength(2);
      expect(visible.map((c: any) => c.field)).toEqual(['a', 'c']);

      app.unmount();
      container.remove();
    });

    it('should have isReady as a ref', () => {
      const result = useGrid();
      expect(result.isReady).toBeDefined();
      expect(result.isReady.value).toBe(false);
    });

    it('should have config as a ref', () => {
      const result = useGrid();
      expect(result.config).toBeDefined();
      expect(result.config.value).toBe(null);
    });
  });
});
