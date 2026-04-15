/**
 * Tests for portal-bridge — the module-level singleton that connects
 * non-React code to the PortalManager for context-preserving rendering.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAllContainers,
  getPortalManager,
  removeFromContainer,
  renderToContainer,
  resetKeyCounter,
  setPortalManager,
} from './portal-bridge';
import type { PortalManagerHandle } from './portal-manager';

describe('portal-bridge', () => {
  beforeEach(() => {
    setPortalManager(null);
    clearAllContainers();
    resetKeyCounter();
  });

  afterEach(() => {
    setPortalManager(null);
    clearAllContainers();
    document.body.innerHTML = '';
  });

  // #region setPortalManager / getPortalManager

  describe('setPortalManager / getPortalManager', () => {
    it('should return null when no manager is set', () => {
      expect(getPortalManager()).toBeNull();
    });

    it('should store and retrieve the portal manager', () => {
      const mockManager: PortalManagerHandle = {
        renderPortal: vi.fn(),
        removePortal: vi.fn(),
        clear: vi.fn(),
      };
      setPortalManager(mockManager);
      expect(getPortalManager()).toBe(mockManager);
    });

    it('should clear the manager when set to null', () => {
      const mockManager: PortalManagerHandle = {
        renderPortal: vi.fn(),
        removePortal: vi.fn(),
        clear: vi.fn(),
      };
      setPortalManager(mockManager);
      setPortalManager(null);
      expect(getPortalManager()).toBeNull();
    });
  });

  // #endregion

  // #region renderToContainer — with PortalManager

  describe('renderToContainer (with PortalManager)', () => {
    it('should delegate to portalManager.renderPortal', () => {
      const mockManager: PortalManagerHandle = {
        renderPortal: vi.fn(),
        removePortal: vi.fn(),
        clear: vi.fn(),
      };
      setPortalManager(mockManager);

      const container = document.createElement('div');
      const element = 'hello';
      const key = renderToContainer(container, element);

      expect(mockManager.renderPortal).toHaveBeenCalledWith(key, container, element);
      expect(key).toMatch(/^p-\d+$/);
    });

    it('should reuse existing key when provided', () => {
      const mockManager: PortalManagerHandle = {
        renderPortal: vi.fn(),
        removePortal: vi.fn(),
        clear: vi.fn(),
      };
      setPortalManager(mockManager);

      const container = document.createElement('div');
      const key = renderToContainer(container, 'hello', 'existing-key');

      expect(key).toBe('existing-key');
      expect(mockManager.renderPortal).toHaveBeenCalledWith('existing-key', container, 'hello');
    });

    it('should generate unique keys', () => {
      const mockManager: PortalManagerHandle = {
        renderPortal: vi.fn(),
        removePortal: vi.fn(),
        clear: vi.fn(),
      };
      setPortalManager(mockManager);

      const key1 = renderToContainer(document.createElement('div'), 'a');
      const key2 = renderToContainer(document.createElement('div'), 'b');

      expect(key1).not.toBe(key2);
    });
  });

  // #endregion

  // #region renderToContainer — fallback (no PortalManager)

  describe('renderToContainer (fallback, no PortalManager)', () => {
    it('should render content into container using createRoot fallback', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const key = renderToContainer(container, 'fallback content');

      expect(key).toMatch(/^p-\d+$/);
      expect(container.textContent).toBe('fallback content');
    });

    it('should reuse the fallback root on update', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const key = renderToContainer(container, 'first');
      expect(container.textContent).toBe('first');

      renderToContainer(container, 'second', key);
      expect(container.textContent).toBe('second');
    });
  });

  // #endregion

  // #region removeFromContainer

  describe('removeFromContainer', () => {
    it('should call portalManager.removePortal when manager is set', () => {
      const mockManager: PortalManagerHandle = {
        renderPortal: vi.fn(),
        removePortal: vi.fn(),
        clear: vi.fn(),
      };
      setPortalManager(mockManager);

      removeFromContainer('some-key');
      expect(mockManager.removePortal).toHaveBeenCalledWith('some-key');
    });

    it('should unmount fallback root when no manager', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const key = renderToContainer(container, 'to remove');
      expect(container.textContent).toBe('to remove');

      // Should not throw
      expect(() => removeFromContainer(key)).not.toThrow();
    });

    it('should handle removing non-existent key gracefully', () => {
      expect(() => removeFromContainer('non-existent')).not.toThrow();
    });
  });

  // #endregion

  // #region clearAllContainers

  describe('clearAllContainers', () => {
    it('should call portalManager.clear when manager is set', () => {
      const mockManager: PortalManagerHandle = {
        renderPortal: vi.fn(),
        removePortal: vi.fn(),
        clear: vi.fn(),
      };
      setPortalManager(mockManager);

      clearAllContainers();
      expect(mockManager.clear).toHaveBeenCalled();
    });

    it('should clear fallback roots', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      renderToContainer(container, 'content');
      expect(() => clearAllContainers()).not.toThrow();
    });
  });

  // #endregion
});
