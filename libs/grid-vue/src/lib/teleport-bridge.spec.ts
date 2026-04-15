/**
 * Tests for teleport-bridge — the module-level registry that connects
 * non-Vue code to per-grid TeleportManagers for context-preserving rendering.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h, type VNode } from 'vue';
import {
  clearAllContainers,
  clearContainersForGrid,
  getTeleportManager,
  removeFromContainer,
  renderToContainer,
  resetBridge,
  setTeleportManager,
} from './teleport-bridge';
import type { TeleportManagerHandle } from './teleport-manager';

/** Create a mock grid element for testing. */
function createMockGrid(): HTMLElement {
  const el = document.createElement('tbw-grid');
  document.body.appendChild(el);
  return el;
}

/** Create a mock TeleportManager handle. */
function createMockManager(): TeleportManagerHandle {
  return {
    renderTeleport: vi.fn(),
    removeTeleport: vi.fn(),
    clear: vi.fn(),
  };
}

/** Create a simple VNode for testing. */
function testVNode(): VNode {
  return h('span', 'test');
}

describe('teleport-bridge', () => {
  beforeEach(() => {
    resetBridge();
  });

  afterEach(() => {
    resetBridge();
    document.body.innerHTML = '';
  });

  // #region setTeleportManager / getTeleportManager

  describe('setTeleportManager / getTeleportManager', () => {
    it('should return null when no manager is set', () => {
      expect(getTeleportManager()).toBeNull();
    });

    it('should store and retrieve a manager by grid element', () => {
      const gridEl = createMockGrid();
      const mockManager = createMockManager();
      setTeleportManager(gridEl, mockManager);
      expect(getTeleportManager(gridEl)).toBe(mockManager);
    });

    it('should return the single manager when no gridEl is provided', () => {
      const gridEl = createMockGrid();
      const mockManager = createMockManager();
      setTeleportManager(gridEl, mockManager);
      expect(getTeleportManager()).toBe(mockManager);
    });

    it('should return null for unregistered grid', () => {
      const gridEl = createMockGrid();
      const otherEl = createMockGrid();
      const mockManager = createMockManager();
      setTeleportManager(gridEl, mockManager);
      expect(getTeleportManager(otherEl)).toBeNull();
    });

    it('should clear the manager when set to null', () => {
      const gridEl = createMockGrid();
      const mockManager = createMockManager();
      setTeleportManager(gridEl, mockManager);
      setTeleportManager(gridEl, null);
      expect(getTeleportManager(gridEl)).toBeNull();
    });

    it('should return null when multiple managers exist and no gridEl is provided', () => {
      const grid1 = createMockGrid();
      const grid2 = createMockGrid();
      setTeleportManager(grid1, createMockManager());
      setTeleportManager(grid2, createMockManager());
      expect(getTeleportManager()).toBeNull();
    });
  });

  // #endregion

  // #region renderToContainer

  describe('renderToContainer', () => {
    it('should use TeleportManager when available', () => {
      const gridEl = createMockGrid();
      const mockManager = createMockManager();
      setTeleportManager(gridEl, mockManager);

      const container = document.createElement('div');
      gridEl.appendChild(container);

      const vnode = testVNode();
      const key = renderToContainer(container, vnode);

      expect(key).toMatch(/^t-\d+$/);
      expect(mockManager.renderTeleport).toHaveBeenCalledWith(key, container, vnode);
    });

    it('should fall back to createApp when no TeleportManager', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const key = renderToContainer(container, testVNode());

      expect(key).toMatch(/^t-\d+$/);
      // Fallback should mount content into the container
      // (createApp path — content may or may not render in happy-dom)
    });

    it('should reuse existing key for updates', () => {
      const gridEl = createMockGrid();
      const mockManager = createMockManager();
      setTeleportManager(gridEl, mockManager);

      const container = document.createElement('div');
      gridEl.appendChild(container);

      const key1 = renderToContainer(container, testVNode());
      const vnode2 = h('span', 'updated');
      const key2 = renderToContainer(container, vnode2, key1);

      expect(key2).toBe(key1);
      expect(mockManager.renderTeleport).toHaveBeenCalledTimes(2);
    });

    it('should resolve grid via closest ancestor', () => {
      const gridEl = createMockGrid();
      const mockManager = createMockManager();
      setTeleportManager(gridEl, mockManager);

      const cell = document.createElement('div');
      gridEl.appendChild(cell);

      renderToContainer(cell, testVNode());
      expect(mockManager.renderTeleport).toHaveBeenCalled();
    });

    it('should accept explicit gridEl parameter', () => {
      const gridEl = createMockGrid();
      const mockManager = createMockManager();
      setTeleportManager(gridEl, mockManager);

      // Container NOT inside grid DOM
      const container = document.createElement('div');
      document.body.appendChild(container);

      renderToContainer(container, testVNode(), undefined, gridEl);
      expect(mockManager.renderTeleport).toHaveBeenCalled();
    });

    it('should generate unique keys', () => {
      const gridEl = createMockGrid();
      setTeleportManager(gridEl, createMockManager());

      const c1 = document.createElement('div');
      const c2 = document.createElement('div');
      gridEl.appendChild(c1);
      gridEl.appendChild(c2);

      const key1 = renderToContainer(c1, testVNode());
      const key2 = renderToContainer(c2, testVNode());
      expect(key1).not.toBe(key2);
    });
  });

  // #endregion

  // #region removeFromContainer

  describe('removeFromContainer', () => {
    it('should call removeTeleport on the correct manager', () => {
      const gridEl = createMockGrid();
      const mockManager = createMockManager();
      setTeleportManager(gridEl, mockManager);

      const container = document.createElement('div');
      gridEl.appendChild(container);

      const key = renderToContainer(container, testVNode());
      removeFromContainer(key);

      expect(mockManager.removeTeleport).toHaveBeenCalledWith(key);
    });

    it('should handle removal of non-existent key gracefully', () => {
      expect(() => removeFromContainer('non-existent')).not.toThrow();
    });
  });

  // #endregion

  // #region clearContainersForGrid

  describe('clearContainersForGrid', () => {
    it('should clear all teleports for a specific grid', () => {
      const gridEl = createMockGrid();
      const mockManager = createMockManager();
      setTeleportManager(gridEl, mockManager);

      const container = document.createElement('div');
      gridEl.appendChild(container);

      renderToContainer(container, testVNode());
      clearContainersForGrid(gridEl);

      expect(mockManager.clear).toHaveBeenCalled();
    });

    it('should not affect other grids', () => {
      const grid1 = createMockGrid();
      const grid2 = createMockGrid();
      const mockManager1 = createMockManager();
      const mockManager2 = createMockManager();
      setTeleportManager(grid1, mockManager1);
      setTeleportManager(grid2, mockManager2);

      clearContainersForGrid(grid1);

      expect(mockManager1.clear).toHaveBeenCalled();
      expect(mockManager2.clear).not.toHaveBeenCalled();
    });
  });

  // #endregion

  // #region clearAllContainers

  describe('clearAllContainers', () => {
    it('should clear all teleports across all grids', () => {
      const grid1 = createMockGrid();
      const grid2 = createMockGrid();
      const mockManager1 = createMockManager();
      const mockManager2 = createMockManager();
      setTeleportManager(grid1, mockManager1);
      setTeleportManager(grid2, mockManager2);

      clearAllContainers();

      expect(mockManager1.clear).toHaveBeenCalled();
      expect(mockManager2.clear).toHaveBeenCalled();
    });
  });

  // #endregion

  // #region Multi-grid scenarios

  describe('multi-grid scenarios', () => {
    it('should route renderToContainer to the correct grid manager', () => {
      const grid1 = createMockGrid();
      const grid2 = createMockGrid();
      const manager1 = createMockManager();
      const manager2 = createMockManager();
      setTeleportManager(grid1, manager1);
      setTeleportManager(grid2, manager2);

      const cell1 = document.createElement('div');
      grid1.appendChild(cell1);
      const cell2 = document.createElement('div');
      grid2.appendChild(cell2);

      renderToContainer(cell1, testVNode());
      renderToContainer(cell2, testVNode());

      expect(manager1.renderTeleport).toHaveBeenCalledTimes(1);
      expect(manager2.renderTeleport).toHaveBeenCalledTimes(1);
    });
  });

  // #endregion
});
