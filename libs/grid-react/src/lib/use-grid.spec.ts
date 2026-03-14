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
      // Deprecated selection methods
      expect(typeof hook.selectAll).toBe('function');
      expect(typeof hook.clearSelection).toBe('function');
      expect(typeof hook.getSelectedIndices).toBe('function');
      expect(typeof hook.getSelectedRows).toBe('function');
      // Deprecated export methods
      expect(typeof hook.exportToCsv).toBe('function');
      expect(typeof hook.exportToJson).toBe('function');

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

  // #region Selection Methods Without Plugin

  describe('selection methods without plugin', () => {
    it('selectAll should warn and return without plugin', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result, cleanup } = captureHook();

      // Simulate ref with element but no selection plugin
      const mockElement = { getPluginByName: () => undefined } as any;
      (result.current!.ref as any).current = { element: mockElement };

      result.current!.selectAll();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('selectAll'));

      warnSpy.mockRestore();
      cleanup();
    });

    it('clearSelection should no-op without plugin', () => {
      const { result, cleanup } = captureHook();

      (result.current!.ref as any).current = {
        element: { getPluginByName: () => undefined },
      };

      expect(() => result.current!.clearSelection()).not.toThrow();

      cleanup();
    });

    it('getSelectedIndices should return empty set without plugin', () => {
      const { result, cleanup } = captureHook();

      (result.current!.ref as any).current = {
        element: { getPluginByName: () => undefined },
      };

      expect(result.current!.getSelectedIndices().size).toBe(0);

      cleanup();
    });

    it('getSelectedRows should return empty array without plugin', () => {
      const { result, cleanup } = captureHook();

      (result.current!.ref as any).current = {
        element: { getPluginByName: () => undefined },
      };

      expect(result.current!.getSelectedRows()).toEqual([]);

      cleanup();
    });
  });

  // #endregion

  // #region Selection Methods With Mock Plugin

  describe('selection methods with mock plugin', () => {
    it('selectAll should set all row indices on the plugin', () => {
      const { result, cleanup } = captureHook();

      const mockPlugin = {
        config: { mode: 'row' },
        selected: new Set<number>(),
        requestAfterRender: vi.fn(),
      };
      const mockElement = {
        getPluginByName: (name: string) => (name === 'selection' ? mockPlugin : undefined),
        rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
      };
      (result.current!.ref as any).current = { element: mockElement };

      result.current!.selectAll();
      expect(mockPlugin.selected.size).toBe(3);
      expect(mockPlugin.selected.has(0)).toBe(true);
      expect(mockPlugin.selected.has(2)).toBe(true);
      expect(mockPlugin.requestAfterRender).toHaveBeenCalled();

      cleanup();
    });

    it('clearSelection should call plugin.clearSelection', () => {
      const { result, cleanup } = captureHook();

      const mockPlugin = { clearSelection: vi.fn() };
      (result.current!.ref as any).current = {
        element: {
          getPluginByName: (name: string) => (name === 'selection' ? mockPlugin : undefined),
        },
      };

      result.current!.clearSelection();
      expect(mockPlugin.clearSelection).toHaveBeenCalled();

      cleanup();
    });

    it('getSelectedIndices should return selected set', () => {
      const { result, cleanup } = captureHook();

      const mockPlugin = { selected: new Set([1, 3, 5]) };
      (result.current!.ref as any).current = {
        element: {
          getPluginByName: (name: string) => (name === 'selection' ? mockPlugin : undefined),
        },
      };

      const indices = result.current!.getSelectedIndices();
      expect(indices.size).toBe(3);
      expect(indices.has(1)).toBe(true);
      expect(indices.has(3)).toBe(true);

      cleanup();
    });

    it('getSelectedRows should return filtered rows', () => {
      const { result, cleanup } = captureHook();

      const rows = [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }];
      const mockPlugin = { selected: new Set([0, 2]) };
      (result.current!.ref as any).current = {
        element: {
          getPluginByName: (name: string) => (name === 'selection' ? mockPlugin : undefined),
          rows,
        },
      };

      const selected = result.current!.getSelectedRows();
      expect(selected).toEqual([{ name: 'Alice' }, { name: 'Carol' }]);

      cleanup();
    });
  });

  // #endregion

  // #region Export Methods

  describe('export methods', () => {
    it('exportToCsv should warn without plugin', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result, cleanup } = captureHook();

      (result.current!.ref as any).current = {
        element: { getPluginByName: () => undefined },
      };

      result.current!.exportToCsv();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('exportToCsv'));

      warnSpy.mockRestore();
      cleanup();
    });

    it('exportToJson should warn without plugin', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result, cleanup } = captureHook();

      (result.current!.ref as any).current = {
        element: { getPluginByName: () => undefined },
      };

      result.current!.exportToJson();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('exportToJson'));

      warnSpy.mockRestore();
      cleanup();
    });

    it('exportToCsv should call plugin with filename', () => {
      const { result, cleanup } = captureHook();

      const mockPlugin = { exportCsv: vi.fn() };
      (result.current!.ref as any).current = {
        element: {
          getPluginByName: (name: string) => (name === 'export' ? mockPlugin : undefined),
        },
      };

      result.current!.exportToCsv('my-data.csv');
      expect(mockPlugin.exportCsv).toHaveBeenCalledWith({ filename: 'my-data.csv' });

      cleanup();
    });

    it('exportToCsv should use default filename', () => {
      const { result, cleanup } = captureHook();

      const mockPlugin = { exportCsv: vi.fn() };
      (result.current!.ref as any).current = {
        element: {
          getPluginByName: (name: string) => (name === 'export' ? mockPlugin : undefined),
        },
      };

      result.current!.exportToCsv();
      expect(mockPlugin.exportCsv).toHaveBeenCalledWith({ filename: 'export.csv' });

      cleanup();
    });

    it('exportToJson should call plugin with filename', () => {
      const { result, cleanup } = captureHook();

      const mockPlugin = { exportJson: vi.fn() };
      (result.current!.ref as any).current = {
        element: {
          getPluginByName: (name: string) => (name === 'export' ? mockPlugin : undefined),
        },
      };

      result.current!.exportToJson('data.json');
      expect(mockPlugin.exportJson).toHaveBeenCalledWith({ filename: 'data.json' });

      cleanup();
    });
  });

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
});
