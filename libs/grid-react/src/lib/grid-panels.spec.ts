/**
 * Tests for GridDetailPanel and GridToolPanel components.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getDetailRenderer } from './grid-detail-panel';
import { getToolPanelElements, getToolPanelRenderer } from './grid-tool-panel';

describe('GridDetailPanel', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('getDetailRenderer', () => {
    it('should return undefined for grid without detail element', () => {
      const gridElement = document.createElement('tbw-grid');
      container.appendChild(gridElement);

      const renderer = getDetailRenderer(gridElement);
      expect(renderer).toBeUndefined();
    });

    it('should return undefined for grid with unregistered detail element', () => {
      const gridElement = document.createElement('tbw-grid');
      const detailElement = document.createElement('tbw-grid-detail');
      gridElement.appendChild(detailElement);
      container.appendChild(gridElement);

      const renderer = getDetailRenderer(gridElement);
      expect(renderer).toBeUndefined();
    });

    it('should return undefined for grid without id or data-grid-id (no fallback)', () => {
      const gridElement = document.createElement('tbw-grid');
      // No detail element, no id, no data-grid-id → no fallback
      container.appendChild(gridElement);

      const renderer = getDetailRenderer(gridElement);
      expect(renderer).toBeUndefined();
    });

    it('should attempt id-based fallback when detail element exists but has no WeakMap entry', () => {
      const gridElement = document.createElement('tbw-grid');
      gridElement.id = 'test-grid-123';
      const detailElement = document.createElement('tbw-grid-detail');
      gridElement.appendChild(detailElement);
      container.appendChild(gridElement);

      // Even with ID, the gridDetailRegistry is a module-level Map we can't populate
      // from outside, so it should still return undefined
      const renderer = getDetailRenderer(gridElement);
      expect(renderer).toBeUndefined();
    });

    it('should try data-grid-id attribute as fallback', () => {
      const gridElement = document.createElement('tbw-grid');
      gridElement.setAttribute('data-grid-id', 'fallback-grid');
      container.appendChild(gridElement);

      // No WeakMap entry and no Map entry → undefined
      const renderer = getDetailRenderer(gridElement);
      expect(renderer).toBeUndefined();
    });
  });
});

describe('GridToolPanel', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('getToolPanelRenderer', () => {
    it('should return undefined for element without registered renderer', () => {
      const panelElement = document.createElement('tbw-grid-tool-panel');
      container.appendChild(panelElement);

      const renderer = getToolPanelRenderer(panelElement);
      expect(renderer).toBeUndefined();
    });

    it('should return undefined for element with id but no id-based registry entry', () => {
      const panelElement = document.createElement('tbw-grid-tool-panel');
      panelElement.id = 'my-panel';
      container.appendChild(panelElement);

      const renderer = getToolPanelRenderer(panelElement);
      expect(renderer).toBeUndefined();
    });

    it('should return undefined for element without id and no WeakMap entry', () => {
      const panelElement = document.createElement('tbw-grid-tool-panel');
      // No id attribute set
      container.appendChild(panelElement);

      const renderer = getToolPanelRenderer(panelElement);
      expect(renderer).toBeUndefined();
    });
  });

  describe('getToolPanelElements', () => {
    it('should return empty array for grid without tool panels', () => {
      const gridElement = document.createElement('tbw-grid');
      container.appendChild(gridElement);

      const elements = getToolPanelElements(gridElement);
      expect(elements).toEqual([]);
    });

    it('should return empty array when tool panels have no registered renderers', () => {
      const gridElement = document.createElement('tbw-grid');
      const panel1 = document.createElement('tbw-grid-tool-panel');
      const panel2 = document.createElement('tbw-grid-tool-panel');
      gridElement.appendChild(panel1);
      gridElement.appendChild(panel2);
      container.appendChild(gridElement);

      const elements = getToolPanelElements(gridElement);
      expect(elements).toEqual([]);
    });

    it('should filter out panels without id or WeakMap entry', () => {
      const gridElement = document.createElement('tbw-grid');
      const panel1 = document.createElement('tbw-grid-tool-panel');
      panel1.id = 'unregistered-panel';
      const panel2 = document.createElement('tbw-grid-tool-panel');
      gridElement.appendChild(panel1);
      gridElement.appendChild(panel2);
      container.appendChild(gridElement);

      const elements = getToolPanelElements(gridElement);
      // Neither panel1 nor panel2 have registered renderers
      expect(elements).toEqual([]);
    });
  });
});
