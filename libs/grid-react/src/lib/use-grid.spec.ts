/**
 * Tests for the useGrid hook.
 *
 * @vitest-environment happy-dom
 *
 * Since we can't call hooks outside React components and don't have
 * @testing-library/react, we test the returned methods by simulating
 * the ref object they rely on.
 */
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGrid, type UseGridReturn } from './use-grid';

// #region Helpers

/** Captures the return value of useGrid inside a component render. */
function captureHook<TRow = unknown>(): {
  result: { current: UseGridReturn<TRow> | null };
  container: HTMLDivElement;
  cleanup: () => void;
} {
  const result: { current: UseGridReturn<TRow> | null } = { current: null };
  const container = document.createElement('div');
  document.body.appendChild(container);

  function TestComponent() {
    const hookReturn = useGrid<TRow>();
    result.current = hookReturn;
    return null;
  }

  const root = createRoot(container);
  flushSync(() => root.render(createElement(TestComponent)));

  return {
    result,
    container,
    cleanup: () => {
      flushSync(() => root.unmount());
      container.remove();
    },
  };
}

// #endregion

describe('use-grid', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // #region Hook Shape

  describe('hook return shape', () => {
    it('should return all expected properties', () => {
      const { result, cleanup } = captureHook();
      const hook = result.current!;

      expect(hook.ref).toBeDefined();
      expect(hook.isReady).toBe(false);
      expect(hook.config).toBeNull();
      expect(typeof hook.getConfig).toBe('function');
      expect(typeof hook.forceLayout).toBe('function');
      expect(typeof hook.toggleGroup).toBe('function');
      expect(typeof hook.getPlugin).toBe('function');
      expect(typeof hook.getPluginByName).toBe('function');
      expect(typeof hook.registerStyles).toBe('function');
      expect(typeof hook.unregisterStyles).toBe('function');
      expect(typeof hook.getVisibleColumns).toBe('function');

      cleanup();
    });

    it('should start with isReady false and config null', () => {
      const { result, cleanup } = captureHook();

      expect(result.current!.isReady).toBe(false);
      expect(result.current!.config).toBeNull();

      cleanup();
    });

    it('should return element as null when ref is unset', () => {
      const { result, cleanup } = captureHook();

      expect(result.current!.element).toBeNull();

      cleanup();
    });
  });

  // #endregion

  // #region Convenience Methods (no-op when ref is null)

  describe('convenience methods without ref', () => {
    it('getConfig should resolve to null', async () => {
      const { result, cleanup } = captureHook();

      const config = await result.current!.getConfig();
      expect(config).toBeNull();

      cleanup();
    });

    it('forceLayout should resolve without error', async () => {
      const { result, cleanup } = captureHook();

      await expect(result.current!.forceLayout()).resolves.toBeUndefined();

      cleanup();
    });

    it('toggleGroup should resolve without error', async () => {
      const { result, cleanup } = captureHook();

      await expect(result.current!.toggleGroup('group-key')).resolves.toBeUndefined();

      cleanup();
    });

    it('registerStyles should not throw', () => {
      const { result, cleanup } = captureHook();

      expect(() => result.current!.registerStyles('id', '.cls { color: red }')).not.toThrow();

      cleanup();
    });

    it('unregisterStyles should not throw', () => {
      const { result, cleanup } = captureHook();

      expect(() => result.current!.unregisterStyles('id')).not.toThrow();

      cleanup();
    });

    it('getVisibleColumns should return empty array', () => {
      const { result, cleanup } = captureHook();

      expect(result.current!.getVisibleColumns()).toEqual([]);

      cleanup();
    });
  });

  // #endregion

  // #endregion

  // #region Delegation Methods With Mock Ref

  describe('delegation methods with mock ref', () => {
    it('getConfig should delegate to ref.current.getConfig', async () => {
      const { result, cleanup } = captureHook();

      const mockConfig = { columns: [{ field: 'name' }] };
      (result.current!.ref as any).current = {
        getConfig: vi.fn().mockResolvedValue(mockConfig),
      };

      const config = await result.current!.getConfig();
      expect(config).toBe(mockConfig);

      cleanup();
    });

    it('forceLayout should delegate to ref.current.forceLayout', async () => {
      const { result, cleanup } = captureHook();

      const forceLayoutFn = vi.fn().mockResolvedValue(undefined);
      (result.current!.ref as any).current = { forceLayout: forceLayoutFn };

      await result.current!.forceLayout();
      expect(forceLayoutFn).toHaveBeenCalled();

      cleanup();
    });

    it('toggleGroup should delegate to ref.current.toggleGroup', async () => {
      const { result, cleanup } = captureHook();

      const toggleGroupFn = vi.fn().mockResolvedValue(undefined);
      (result.current!.ref as any).current = { toggleGroup: toggleGroupFn };

      await result.current!.toggleGroup('dept-engineering');
      expect(toggleGroupFn).toHaveBeenCalledWith('dept-engineering');

      cleanup();
    });

    it('registerStyles should delegate to ref.current', () => {
      const { result, cleanup } = captureHook();

      const registerFn = vi.fn();
      (result.current!.ref as any).current = { registerStyles: registerFn };

      result.current!.registerStyles('my-styles', '.cell { color: red }');
      expect(registerFn).toHaveBeenCalledWith('my-styles', '.cell { color: red }');

      cleanup();
    });

    it('unregisterStyles should delegate to ref.current', () => {
      const { result, cleanup } = captureHook();

      const unregisterFn = vi.fn();
      (result.current!.ref as any).current = { unregisterStyles: unregisterFn };

      result.current!.unregisterStyles('my-styles');
      expect(unregisterFn).toHaveBeenCalledWith('my-styles');

      cleanup();
    });
  });

  // #endregion

  // #region Selector-Based Grid Discovery

  describe('selector-based grid discovery', () => {
    it('should resolve element via DOM query when selector is provided', () => {
      // Set up a mock tbw-grid element in the DOM
      const mockGrid = document.createElement('tbw-grid') as any;
      mockGrid.classList.add('primary');
      mockGrid.getPluginByName = () => undefined;
      document.body.appendChild(mockGrid);

      const result: { current: UseGridReturn | null } = { current: null };
      const container = document.createElement('div');
      document.body.appendChild(container);

      function TestComponent() {
        const hookReturn = useGrid('tbw-grid.primary');
        result.current = hookReturn;
        return null;
      }

      const root = createRoot(container);
      flushSync(() => root.render(createElement(TestComponent)));

      expect(result.current!.element).toBe(mockGrid);

      flushSync(() => root.unmount());
      container.remove();
      mockGrid.remove();
    });

    it('should return null element when selector matches nothing', () => {
      const result: { current: UseGridReturn | null } = { current: null };
      const container = document.createElement('div');
      document.body.appendChild(container);

      function TestComponent() {
        const hookReturn = useGrid('#non-existent');
        result.current = hookReturn;
        return null;
      }

      const root = createRoot(container);
      flushSync(() => root.render(createElement(TestComponent)));

      expect(result.current!.element).toBeNull();

      flushSync(() => root.unmount());
      container.remove();
    });

    it('forceLayout should call element directly when using selector', async () => {
      const forceLayoutFn = vi.fn().mockResolvedValue(undefined);
      const mockGrid = document.createElement('tbw-grid') as any;
      mockGrid.id = 'test-grid';
      mockGrid.forceLayout = forceLayoutFn;
      document.body.appendChild(mockGrid);

      const result: { current: UseGridReturn | null } = { current: null };
      const container = document.createElement('div');
      document.body.appendChild(container);

      function TestComponent() {
        const hookReturn = useGrid('#test-grid');
        result.current = hookReturn;
        return null;
      }

      const root = createRoot(container);
      flushSync(() => root.render(createElement(TestComponent)));

      await result.current!.forceLayout();
      expect(forceLayoutFn).toHaveBeenCalled();

      flushSync(() => root.unmount());
      container.remove();
      mockGrid.remove();
    });

    it('registerStyles/unregisterStyles delegate to element when selector resolves', () => {
      const registerStyles = vi.fn();
      const unregisterStyles = vi.fn();
      const mockGrid = document.createElement('tbw-grid') as any;
      mockGrid.id = 'styles-grid';
      mockGrid.registerStyles = registerStyles;
      mockGrid.unregisterStyles = unregisterStyles;
      document.body.appendChild(mockGrid);

      const result: { current: UseGridReturn | null } = { current: null };
      const container = document.createElement('div');
      document.body.appendChild(container);

      function TestComponent() {
        const hookReturn = useGrid('#styles-grid');
        result.current = hookReturn;
        return null;
      }

      const root = createRoot(container);
      flushSync(() => root.render(createElement(TestComponent)));

      result.current!.registerStyles('id-1', '.x{}');
      result.current!.unregisterStyles('id-1');
      expect(registerStyles).toHaveBeenCalledWith('id-1', '.x{}');
      expect(unregisterStyles).toHaveBeenCalledWith('id-1');

      flushSync(() => root.unmount());
      container.remove();
      mockGrid.remove();
    });

    it('getPlugin/getPluginByName delegate to element when selector resolves', () => {
      const plugin = { name: 'fake' };
      const getPlugin = vi.fn(() => plugin);
      const getPluginByName = vi.fn(() => plugin);
      const mockGrid = document.createElement('tbw-grid') as any;
      mockGrid.id = 'plugin-grid';
      mockGrid.getPlugin = getPlugin;
      mockGrid.getPluginByName = getPluginByName;
      document.body.appendChild(mockGrid);

      const result: { current: UseGridReturn | null } = { current: null };
      const container = document.createElement('div');
      document.body.appendChild(container);

      function TestComponent() {
        const hookReturn = useGrid('#plugin-grid');
        result.current = hookReturn;
        return null;
      }

      const root = createRoot(container);
      flushSync(() => root.render(createElement(TestComponent)));

      class FakePlugin {}
      expect(result.current!.getPlugin(FakePlugin as any)).toBe(plugin);
      expect((result.current!.getPluginByName as any)('fake')).toBe(plugin);

      flushSync(() => root.unmount());
      container.remove();
      mockGrid.remove();
    });

    it('toggleGroup delegates to element when selector resolves', async () => {
      const toggleGroup = vi.fn().mockResolvedValue(undefined);
      const mockGrid = document.createElement('tbw-grid') as any;
      mockGrid.id = 'group-grid';
      mockGrid.toggleGroup = toggleGroup;
      document.body.appendChild(mockGrid);

      const result: { current: UseGridReturn | null } = { current: null };
      const container = document.createElement('div');
      document.body.appendChild(container);

      function TestComponent() {
        const hookReturn = useGrid('#group-grid');
        result.current = hookReturn;
        return null;
      }

      const root = createRoot(container);
      flushSync(() => root.render(createElement(TestComponent)));

      await result.current!.toggleGroup('grp');
      expect(toggleGroup).toHaveBeenCalledWith('grp');

      flushSync(() => root.unmount());
      container.remove();
      mockGrid.remove();
    });

    it('getConfig delegates to element when selector resolves', async () => {
      const cfg = { columns: [{ field: 'a' }] };
      const getConfig = vi.fn().mockResolvedValue(cfg);
      const mockGrid = document.createElement('tbw-grid') as any;
      mockGrid.id = 'cfg-grid';
      mockGrid.getConfig = getConfig;
      document.body.appendChild(mockGrid);

      const result: { current: UseGridReturn | null } = { current: null };
      const container = document.createElement('div');
      document.body.appendChild(container);

      function TestComponent() {
        const hookReturn = useGrid('#cfg-grid');
        result.current = hookReturn;
        return null;
      }

      const root = createRoot(container);
      flushSync(() => root.render(createElement(TestComponent)));

      const out = await result.current!.getConfig();
      expect(out).toBe(cfg);

      flushSync(() => root.unmount());
      container.remove();
      mockGrid.remove();
    });

    it('getVisibleColumns filters out hidden columns when config is populated', async () => {
      const cfg = {
        columns: [{ field: 'a' }, { field: 'b', hidden: true }, { field: 'c', hidden: false }],
      };
      const mockGrid = document.createElement('tbw-grid') as any;
      mockGrid.id = 'visible-grid';
      mockGrid.ready = vi.fn().mockResolvedValue(undefined);
      mockGrid.getConfig = vi.fn().mockResolvedValue(cfg);
      document.body.appendChild(mockGrid);

      const result: { current: UseGridReturn | null } = { current: null };
      const container = document.createElement('div');
      document.body.appendChild(container);

      function TestComponent() {
        const hookReturn = useGrid('#visible-grid');
        result.current = hookReturn;
        return null;
      }

      const root = createRoot(container);
      flushSync(() => root.render(createElement(TestComponent)));

      // Wait for the ready→getConfig→setConfig chain to complete and re-render.
      const deadline = Date.now() + 1000;
      while (Date.now() < deadline && (!result.current!.config || !result.current!.config.columns)) {
        await new Promise((r) => setTimeout(r, 5));
      }

      const visible = result.current!.getVisibleColumns();
      expect(visible.map((c: any) => c.field)).toEqual(['a', 'c']);

      flushSync(() => root.unmount());
      container.remove();
      mockGrid.remove();
    });
  });

  // #endregion
});
