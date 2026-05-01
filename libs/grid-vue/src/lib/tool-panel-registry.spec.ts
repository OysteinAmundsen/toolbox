/**
 * Tests for the tool panel registry.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getToolPanelRenderer, toolPanelRegistry, type ToolPanelContext } from './tool-panel-registry';

describe('tool-panel-registry', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('toolPanelRegistry', () => {
    it('should be a WeakMap', () => {
      expect(toolPanelRegistry).toBeInstanceOf(WeakMap);
    });

    it('should store and retrieve renderer for a panel element', () => {
      const element = document.createElement('tbw-grid-tool-panel');
      const renderer = (_ctx: ToolPanelContext) => undefined;

      toolPanelRegistry.set(element, renderer);
      expect(toolPanelRegistry.get(element)).toBe(renderer);

      // Cleanup
      toolPanelRegistry.delete(element);
    });

    it('should keep separate renderers for separate panels', () => {
      const a = document.createElement('tbw-grid-tool-panel');
      const b = document.createElement('tbw-grid-tool-panel');
      const rendererA = (_ctx: ToolPanelContext) => undefined;
      const rendererB = (_ctx: ToolPanelContext) => undefined;

      toolPanelRegistry.set(a, rendererA);
      toolPanelRegistry.set(b, rendererB);

      expect(toolPanelRegistry.get(a)).toBe(rendererA);
      expect(toolPanelRegistry.get(b)).toBe(rendererB);

      toolPanelRegistry.delete(a);
      toolPanelRegistry.delete(b);
    });
  });

  describe('getToolPanelRenderer', () => {
    it('should return undefined for an unregistered panel element', () => {
      const panel = document.createElement('tbw-grid-tool-panel');
      container.appendChild(panel);

      expect(getToolPanelRenderer(panel)).toBeUndefined();
    });

    it('should return the renderer registered for a panel element', () => {
      const panel = document.createElement('tbw-grid-tool-panel');
      container.appendChild(panel);

      const renderer = (_ctx: ToolPanelContext) => undefined;
      toolPanelRegistry.set(panel, renderer);

      expect(getToolPanelRenderer(panel)).toBe(renderer);

      // Cleanup
      toolPanelRegistry.delete(panel);
    });

    it('should return undefined after the panel is removed from the registry', () => {
      const panel = document.createElement('tbw-grid-tool-panel');
      container.appendChild(panel);

      toolPanelRegistry.set(panel, (_ctx: ToolPanelContext) => undefined);
      toolPanelRegistry.delete(panel);

      expect(getToolPanelRenderer(panel)).toBeUndefined();
    });
  });

  describe('ToolPanelContext', () => {
    it('should expose the gridElement to the renderer', () => {
      const grid = document.createElement('tbw-grid');
      const ctx: ToolPanelContext = { gridElement: grid };
      expect(ctx.gridElement).toBe(grid);
    });
  });
});
