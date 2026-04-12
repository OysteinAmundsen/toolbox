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
  });

  // #endregion
});
